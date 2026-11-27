import net from 'net'
import { EventEmitter } from 'events'
import {
  CAN_ERROR_ID,
  CAN_ID_TYPE,
  CanBaseInfo,
  CanDevice,
  CanError,
  CanMessage,
  CanMsgType,
  getTsUs,
  RENODE_DEFAULT_BUS,
  RENODE_DEFAULT_HOST,
  RENODE_DEFAULT_MACHINE,
  RENODE_DEFAULT_PORT
} from '../../share/can'
import { CanLOG } from '../../log'
import { CanBase } from '../base'

/** Renode 1.17 External Control commands. */
const CMD_CHECK_VERSION = 0
const CMD_GET_MACHINE = 3
const CMD_CAN_BUS = 9

const TYPE_REQUEST = 0
const TYPE_EVENT_REQUEST = 1
const TYPE_SUCCESS = 2
const TYPE_ERROR = 4

const CLIENT_INITIATED = 0x8000
const OP_SEND_FRAME = 0
const OP_REGISTER_CALLBACKS = 2
const PROTOCOL_VERSION = 0
const MAX_FRAME = 64
const IO_TIMEOUT_MS = 3000
const CANFD_VALID_LENGTHS = [12, 16, 20, 24, 32, 48, 64]

interface Pending {
  resolve: (payload: Buffer) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}

/**
 * TCP client for a Renode CANHub exposed by CANExternalControlBus.
 * Frame layout matches Renode 1.17 tools/external_control_client.
 */
export class RENODE_CAN extends CanBase {
  event: EventEmitter
  info: CanBaseInfo
  log: CanLOG
  /** Resolves after version, machine, bus, and RX callback registration. */
  readonly ready: Promise<void>

  private socket: net.Socket
  private closed = false
  private stopped = false
  private closeReason?: string
  /** Errors before this are handled by connect(); later errors tear the device down. */
  private handshaking = false
  private rx = Buffer.alloc(0)
  private nextId = 0
  private pending = new Map<number, Pending>()
  private writeChain: Promise<void> = Promise.resolve()
  private instanceId = 0
  private readAbort = new AbortController()
  private cnt = 0
  private startTime = getTsUs()
  private inFlightWrites = 0
  private lastTxTs = 0
  private deferredRx: CanMessage[] = []
  private readyRx: CanMessage[] = []
  private flushScheduled = false
  private readonly host: string
  private readonly port: number
  private readonly machine: string
  private readonly bus: string

  rejectBaseMap = new Map<number, { reject: (reason: CanError) => void; msgType: CanMsgType }>()

  constructor(info: CanBaseInfo) {
    super()
    this.info = info
    this.host = info.renodeHost?.trim() || RENODE_DEFAULT_HOST
    this.port = info.renodePort && info.renodePort > 0 ? info.renodePort : RENODE_DEFAULT_PORT
    this.machine = info.renodeMachine?.trim() || RENODE_DEFAULT_MACHINE
    this.bus = info.renodeBus?.trim() || RENODE_DEFAULT_BUS
    this.event = new EventEmitter()
    this.log = new CanLOG('RENODE', info.name, info.id, this.event)
    this.socket = new net.Socket()
    this.socket.on('error', (err) => {
      if (this.handshaking) this.fail(err.message)
    })
    this.attachCanMessage(this.busloadCb)
    this.ready = this.open().catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err)
      const message = `Renode connect failed (${this.host}:${this.port}): ${detail}`
      this.fail(message)
      throw new Error(message)
    })
    void this.ready.catch(() => undefined)
  }

  static override getValidDevices(): CanDevice[] {
    return [{ handle: 'renode', id: 'Renode', label: 'Renode', busy: false }]
  }

  static override getLibVersion(): string {
    return '1.0.0'
  }

  resetStartTs(): void {
    this.startTime = getTsUs()
    this.lastTxTs = 0
  }

  setOption(cmd: string, val: any): any {
    return this._setOption(cmd, val)
  }

  getReadBaseId(id: number, msgType: CanMsgType): string {
    // Renode External Control CAN events only carry (id, data) without EFF/FDF/BRS/RTR bits,
    // so routing by id and remote avoids dropping CAN-FD/BRS or <=0x7FF extended-ID frames.
    return `readBase-${id}-${msgType.remote}`
  }

  close() {
    this.fail('closed')
  }

  readBase(id: number, msgType: CanMsgType, timeout: number) {
    return new Promise<{ data: Buffer; ts: number }>((resolve, reject) => {
      if (this.closed) {
        reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, msgType, undefined, this.closeReason))
        return
      }
      const cmdId = this.getReadBaseId(id, msgType)
      const cnt = this.cnt++
      const cleanup = () => {
        clearTimeout(timer)
        this.event.off(cmdId, readCb)
        this.readAbort.signal.removeEventListener('abort', onAbort)
      }
      const onAbort = () => {
        if (!this.rejectBaseMap.delete(cnt)) return
        cleanup()
        reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, msgType, undefined, this.closeReason))
      }
      const readCb = (val: CanMessage | CanError) => {
        if (!this.rejectBaseMap.delete(cnt)) return
        cleanup()
        if (val instanceof CanError) reject(val)
        else resolve({ data: val.data, ts: val.ts ?? 0 })
      }
      const timer = setTimeout(() => {
        if (!this.rejectBaseMap.delete(cnt)) return
        cleanup()
        reject(new CanError(CAN_ERROR_ID.CAN_READ_TIMEOUT, msgType))
      }, timeout)
      this.rejectBaseMap.set(cnt, { reject, msgType })
      this.readAbort.signal.addEventListener('abort', onAbort, { once: true })
      this.event.once(cmdId, readCb)
    })
  }

  async writeBase(
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    if (this.closed) {
      throw new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, msgType, data)
    }
    if (msgType.remote) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data, 'Renode CAN has no RTR bit')
    }
    if (msgType.canfd && !this.info.canfd) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data, 'CAN FD is not enabled')
    }
    const maxId = msgType.idType === CAN_ID_TYPE.EXTENDED ? 0x1fffffff : 0x7ff
    if (!Number.isInteger(id) || id < 0 || id > maxId) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data, 'CAN id out of range')
    }
    const limit = msgType.canfd ? MAX_FRAME : 8
    if (data.length > limit) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data)
    }
    const payload = msgType.canfd ? padCanFdData(data) : data
    try {
      await this.ready
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, payload, message)
    }
    if (this.closed) {
      throw new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, msgType, payload)
    }

    const header = Buffer.alloc(5)
    header.writeInt32LE(this.instanceId, 0)
    header.writeInt8(OP_SEND_FRAME, 4)
    const length = Buffer.alloc(4)
    length.writeInt32LE(payload.length, 0)
    const canId = Buffer.alloc(4)
    canId.writeUInt32LE(id >>> 0, 0)

    const txTs = this.nowTs()
    this.lastTxTs = Math.max(this.lastTxTs, txTs)
    this.inFlightWrites++
    try {
      const response = await this.request(
        message(CMD_CAN_BUS, TYPE_REQUEST, header, length, canId, payload)
      )
      expectOk(response, CMD_CAN_BUS)
      const sent: CanMessage = {
        dir: 'OUT',
        id,
        data: payload,
        ts: txTs,
        msgType,
        device: this.info.name,
        database: extra?.database,
        name: extra?.name
      }
      this.log.canBase(sent)
      this.event.emit(this.getReadBaseId(id, msgType), sent)
      return txTs
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err)
      throw err instanceof CanError
        ? err
        : new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, payload, messageText)
    } finally {
      this.inFlightWrites--
      if (this.inFlightWrites === 0 && this.deferredRx.length > 0 && !this.closed) {
        this.readyRx.push(...this.deferredRx)
        this.deferredRx.length = 0
        this.scheduleFlushReadyRx()
      }
    }
  }

  private nowTs(): number {
    return Math.max(0, getTsUs() - this.startTime)
  }

  private async open(): Promise<void> {
    await this.connect()
    if (this.closed) return
    this.handshaking = true
    this.socket.on('data', (chunk: Buffer) => this.onData(chunk))
    this.socket.on('close', () => {
      if (!this.closed) this.fail('connection closed')
    })
    const version = await this.request(
      message(CMD_CHECK_VERSION, TYPE_REQUEST, u32(PROTOCOL_VERSION))
    )
    expectOk(version, CMD_CHECK_VERSION)
    const machineResponse = await this.request(
      message(
        CMD_GET_MACHINE,
        TYPE_REQUEST,
        u32(Buffer.byteLength(this.machine)),
        utf8(this.machine)
      )
    )
    const machineBody = expectOk(machineResponse, CMD_GET_MACHINE)
    if (machineBody.length < 4) throw new Error('Renode machine id missing')
    const machineId = machineBody.readInt32LE(0)
    const lookup = Buffer.alloc(4 + 4 + 4)
    lookup.writeInt32LE(-1, 0)
    lookup.writeInt32LE(machineId, 4)
    lookup.writeUInt32LE(Buffer.byteLength(this.bus), 8)
    const canResponse = await this.request(
      message(CMD_CAN_BUS, TYPE_REQUEST, lookup, utf8(this.bus))
    )
    const canBody = expectOk(canResponse, CMD_CAN_BUS)
    if (canBody.length < 4) throw new Error('Renode CAN instance id missing')
    this.instanceId = canBody.readInt32LE(0)
    if (this.instanceId < 0) throw new Error(`Renode CAN instance ${this.instanceId}`)
    const callbackHeader = Buffer.alloc(5)
    callbackHeader.writeInt32LE(this.instanceId, 0)
    callbackHeader.writeInt8(OP_REGISTER_CALLBACKS, 4)
    const registered = await this.request(
      message(CMD_CAN_BUS, TYPE_REQUEST, callbackHeader, i32(0))
    )
    expectOk(registered, CMD_CAN_BUS)
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.closed) {
        reject(new Error(this.closeReason || 'closed'))
        return
      }
      const cleanup = () => {
        clearTimeout(timer)
        this.socket.off('error', onError)
        this.socket.off('close', onClose)
        this.socket.off('connect', onConnect)
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Renode connect timeout ${this.host}:${this.port}`))
      }, IO_TIMEOUT_MS)
      const onError = (err: Error) => {
        cleanup()
        reject(err)
      }
      const onClose = () => {
        cleanup()
        reject(new Error(this.closeReason || 'connection closed'))
      }
      const onConnect = () => {
        cleanup()
        this.socket.setNoDelay(true)
        resolve()
      }
      this.socket.once('error', onError)
      this.socket.once('close', onClose)
      this.socket.once('connect', onConnect)
      this.socket.connect(this.port, this.host)
    })
  }

  private onData(chunk: Buffer) {
    this.rx = Buffer.concat([this.rx, chunk])
    while (this.rx.length >= 6) {
      const id = this.rx.readUInt16LE(0)
      const size = this.rx.readUInt32LE(2)
      if (size > 1_000_000) {
        this.fail('Renode frame too large')
        return
      }
      if (this.rx.length < 6 + size) return
      const payload = Buffer.from(this.rx.subarray(6, 6 + size))
      this.rx = this.rx.subarray(6 + size)
      if (id & CLIENT_INITIATED) {
        const waiter = this.pending.get(id)
        if (!waiter) continue
        this.pending.delete(id)
        clearTimeout(waiter.timer)
        waiter.resolve(payload)
      } else {
        this.handleServer(id, payload)
      }
    }
  }

  private sendReply(messageId: number, payload: Buffer) {
    void this.writeMessage(messageId, payload).catch((err: unknown) => {
      if (!this.closed) {
        this.fail(err instanceof Error ? err.message : String(err))
      }
    })
  }

  private emitRx(rx: CanMessage) {
    this.log.canBase(rx)
    this.event.emit(this.getReadBaseId(rx.id, rx.msgType), rx)
  }

  private scheduleFlushReadyRx() {
    if (this.flushScheduled) return
    this.flushScheduled = true
    setImmediate(() => {
      this.flushScheduled = false
      if (this.closed) {
        this.readyRx.length = 0
        return
      }
      const batch = this.readyRx.splice(0, this.readyRx.length)
      for (const rx of batch) {
        if (this.closed) break
        this.emitRx(rx)
      }
    })
  }

  private handleServer(messageId: number, payload: Buffer) {
    if (payload.length < 3) {
      this.sendReply(messageId, message(CMD_CAN_BUS, TYPE_ERROR, utf8('short event')))
      return
    }
    const command = payload.readUInt16LE(0)
    const type = payload.readUInt8(2)
    if (type !== TYPE_EVENT_REQUEST || command !== CMD_CAN_BUS) {
      this.sendReply(messageId, message(command, TYPE_ERROR, utf8('unsupported request')))
      return
    }
    const frame = parseCanEvent(payload.subarray(3))
    if (!frame) {
      this.log.error(this.nowTs(), 'Invalid Renode CAN event payload')
      this.sendReply(messageId, message(CMD_CAN_BUS, TYPE_ERROR, utf8('invalid CAN event')))
      return
    }
    this.sendReply(messageId, message(CMD_CAN_BUS, TYPE_SUCCESS))
    const msgType: CanMsgType = {
      idType: frame.id > 0x7ff ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
      canfd: frame.data.length > 8,
      brs: false,
      remote: false
    }
    const rx: CanMessage = {
      dir: 'IN',
      id: frame.id,
      data: frame.data,
      ts: Math.max(this.nowTs(), this.lastTxTs),
      msgType,
      device: this.info.name,
      database: this.info.database
    }
    if (this.inFlightWrites > 0) {
      this.deferredRx.push(rx)
    } else if (this.readyRx.length > 0) {
      this.readyRx.push(rx)
      this.scheduleFlushReadyRx()
    } else {
      this.emitRx(rx)
    }
  }

  private request(payload: Buffer): Promise<Buffer> {
    const id = CLIENT_INITIATED | (this.nextId & 0x7fff)
    this.nextId = (this.nextId + 1) & 0x7fff
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.delete(id)) return
        reject(new Error('Renode response timeout'))
      }, IO_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      this.writeMessage(id, payload).catch((err) => {
        if (!this.pending.delete(id)) return
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  private writeMessage(id: number, payload: Buffer): Promise<void> {
    const frame = Buffer.alloc(6 + payload.length)
    frame.writeUInt16LE(id, 0)
    frame.writeUInt32LE(payload.length, 2)
    payload.copy(frame, 6)
    const job = this.writeChain.then(() => this.writeAll(frame))
    this.writeChain = job.then(
      () => undefined,
      () => undefined
    )
    return job
  }

  private writeAll(frame: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.closed || this.socket.destroyed) {
        reject(new Error('Renode socket closed'))
        return
      }
      this.socket.write(frame, (err) => (err ? reject(err) : resolve()))
    })
  }

  private fail(message: string) {
    if (this.stopped) return
    this.stopped = true
    this.closed = true
    this.closeReason = message
    this.deferredRx.length = 0
    this.readyRx.length = 0
    this.readAbort.abort()
    for (const value of this.rejectBaseMap.values()) {
      value.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, value.msgType, undefined, message))
    }
    this.rejectBaseMap.clear()
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timer)
      waiter.reject(new Error(message))
    }
    this.pending.clear()
    this.socket.destroy()
    if (message !== 'closed') this.event.emit('close', message)
    this.log.close()
    this._close()
  }
}

function padCanFdData(data: Buffer): Buffer {
  if (data.length <= 8) return data
  const paddedLength = CANFD_VALID_LENGTHS.find((len) => data.length <= len) ?? MAX_FRAME
  if (data.length === paddedLength) return data
  return Buffer.concat([data, Buffer.alloc(paddedLength - data.length)])
}

function message(command: number, type: number, ...parts: Buffer[]): Buffer {
  const head = Buffer.alloc(3)
  head.writeUInt16LE(command, 0)
  head.writeUInt8(type, 2)
  return Buffer.concat([head, ...parts])
}

function u32(value: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(value >>> 0, 0)
  return buf
}

function i32(value: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeInt32LE(value, 0)
  return buf
}

function utf8(value: string): Buffer {
  return Buffer.from(value, 'utf8')
}

function expectOk(payload: Buffer, command: number): Buffer {
  if (payload.length < 3) throw new Error('short Renode payload')
  const got = payload.readUInt16LE(0)
  const type = payload.readUInt8(2)
  const body = payload.subarray(3)
  if (got !== command) throw new Error(`Renode command ${got}, expected ${command}`)
  if (type === TYPE_SUCCESS) return body
  const text = body.toString('utf8').replace(/\0/g, '').trim()
  throw new Error(text || `Renode status ${type}`)
}

/** Event body is int32 descriptor, then uint64 time, int32 length, uint32 id, data. */
function parseCanEvent(body: Buffer): { id: number; data: Buffer } | null {
  if (body.length < 20) return null
  const length = body.readInt32LE(12)
  const id = body.readUInt32LE(16)
  if (length < 0 || length > MAX_FRAME || body.length < 20 + length) return null
  return { id, data: Buffer.from(body.subarray(20, 20 + length)) }
}
