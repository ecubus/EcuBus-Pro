/**
 * Test-only SocketCAN CanBase.
 *
 * Prefers a real Linux AF_CAN socket on a vcan/can interface. When the kernel
 * has no CONFIG_CAN (common in stripped CI kernels), falls back to an
 * in-process bus that still ships packed `struct can_frame` buffers between
 * independent sockets — the same isolation model as SocketCAN
 * (CAN_RAW_RECV_OWN_MSGS off).
 */
import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process'
import { EventEmitter } from 'events'
import { readdirSync, readFileSync } from 'fs'
import { platform } from 'os'
import path from 'path'
import { CanBase } from '../../src/main/docan/base'
import { CanLOG } from '../../src/main/log'
import {
  CAN_ERROR_ID,
  CAN_ID_TYPE,
  CanBaseInfo,
  CanError,
  CanMessage,
  CanMsgType,
  getTsUs
} from '../../src/main/share/can'
import { CAN_MAX_DLEN, CANFD_MAX_DLEN, packCanFrame, unpackCanFrame } from './socketcanFrame'

const workerPath = path.join(process.cwd(), 'test/helpers/socketcan_worker.py')

export type SocketcanBusKind = 'vcan' | 'memory'

export interface SocketcanTestBus {
  kind: SocketcanBusKind
  iface: string
  attach(node: SocketcanTestCan): Promise<void>
  detach(node: SocketcanTestCan): void
  send(node: SocketcanTestCan, frame: Buffer): Promise<void>
}

export interface LinuxSocketcanProbe {
  ok: boolean
  reason?: string
  iface?: string
}

function listCanIfaces(): string[] {
  try {
    const names = readdirSync('/sys/class/net')
    return names.filter((name) => {
      try {
        const t = readFileSync(`/sys/class/net/${name}/type`, 'utf8').trim()
        // ARPHRD_CAN = 280
        return t === '280' || /^(v?)can\d+$/.test(name)
      } catch {
        return /^(v?)can\d+$/.test(name)
      }
    })
  } catch {
    return []
  }
}

export function probeLinuxSocketcan(): LinuxSocketcanProbe {
  if (platform() !== 'linux') {
    return { ok: false, reason: `SocketCAN is Linux-only (platform=${platform()})` }
  }
  const probe = spawnSync(
    'python3',
    [
      '-c',
      'import socket; s=socket.socket(socket.AF_CAN, socket.SOCK_RAW, socket.CAN_RAW); s.close(); print("ok")'
    ],
    { encoding: 'utf8', timeout: 5000 }
  )
  if (probe.status !== 0) {
    const err = (probe.stderr || probe.stdout || '').trim()
    const reason = /Address family not supported/i.test(err)
      ? 'kernel has no CONFIG_CAN (AF_CAN EAFNOSUPPORT)'
      : err || `exit ${probe.status}`
    return { ok: false, reason: `AF_CAN not available: ${reason}` }
  }
  const ifaces = listCanIfaces()
  if (ifaces.length === 0) {
    return {
      ok: false,
      reason:
        'AF_CAN works but no can/vcan interface is up. Create one with: sudo ip link add dev vcan0 type vcan && sudo ip link set up vcan0'
    }
  }
  const vcan = ifaces.find((n) => n.startsWith('vcan')) || ifaces[0]
  return { ok: true, iface: vcan }
}

class MemorySocketcanBus implements SocketcanTestBus {
  kind: SocketcanBusKind = 'memory'
  iface: string
  private nodes = new Set<SocketcanTestCan>()
  constructor(iface = 'vcan-memory') {
    this.iface = iface
  }
  async attach(node: SocketcanTestCan) {
    this.nodes.add(node)
  }
  detach(node: SocketcanTestCan) {
    this.nodes.delete(node)
  }
  async send(node: SocketcanTestCan, frame: Buffer) {
    const others = [...this.nodes].filter((n) => n !== node)
    setImmediate(() => {
      for (const peer of others) {
        peer.injectRx(frame)
      }
    })
  }
}

class LinuxSocketcanBus implements SocketcanTestBus {
  kind: SocketcanBusKind = 'vcan'
  iface: string
  private workers = new Map<SocketcanTestCan, LinuxWorker>()
  constructor(iface: string) {
    this.iface = iface
  }
  async attach(node: SocketcanTestCan) {
    const worker = new LinuxWorker(this.iface, (frame) => node.injectRx(frame))
    await worker.ready
    this.workers.set(node, worker)
  }
  detach(node: SocketcanTestCan) {
    const worker = this.workers.get(node)
    if (worker) {
      worker.close()
      this.workers.delete(node)
    }
  }
  async send(node: SocketcanTestCan, frame: Buffer) {
    const worker = this.workers.get(node)
    if (!worker) {
      throw new Error('SocketCAN worker not attached')
    }
    await worker.send(frame)
  }
}

class LinuxWorker {
  ready: Promise<void>
  private proc: ChildProcessWithoutNullStreams
  private pending: Array<{ resolve: () => void; reject: (e: Error) => void }> = []
  private closed = false
  constructor(iface: string, onFrame: (frame: Buffer) => void) {
    this.proc = spawn('python3', ['-u', workerPath, iface], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let readyResolve: () => void
    let readyReject: (e: Error) => void
    this.ready = new Promise<void>((resolve, reject) => {
      readyResolve = resolve
      readyReject = reject
    })
    const timer = setTimeout(() => {
      readyReject(new Error(`SocketCAN worker for ${iface} timed out`))
    }, 5000)
    let buf = ''
    this.proc.stdout.setEncoding('utf8')
    this.proc.stdout.on('data', (chunk: string) => {
      buf += chunk
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        let msg: any
        try {
          msg = JSON.parse(line)
        } catch {
          continue
        }
        if (msg.evt === 'ready') {
          clearTimeout(timer)
          readyResolve()
        } else if (msg.evt === 'ok') {
          this.pending.shift()?.resolve()
        } else if (msg.evt === 'err') {
          const err = new Error(String(msg.msg || 'socketcan worker error'))
          if (this.pending.length) {
            this.pending.shift()?.reject(err)
          } else {
            readyReject(err)
          }
        } else if (msg.evt === 'rx') {
          const packed = packCanFrame(
            msg.id,
            {
              idType: msg.ext ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
              remote: !!msg.rtr,
              canfd: !!msg.canfd,
              brs: !!msg.brs
            },
            Buffer.from(msg.data || '', 'hex')
          )
          onFrame(packed)
        }
      }
    })
    this.proc.stderr.setEncoding('utf8')
    this.proc.on('exit', (code) => {
      if (!this.closed) {
        const err = new Error(`SocketCAN worker exited (${code})`)
        while (this.pending.length) {
          this.pending.shift()?.reject(err)
        }
        readyReject(err)
      }
    })
  }
  send(frame: Buffer): Promise<void> {
    const parsed = unpackCanFrame(frame)
    const payload = JSON.stringify({
      cmd: 'send',
      id: parsed.id,
      ext: parsed.msgType.idType === CAN_ID_TYPE.EXTENDED,
      rtr: parsed.msgType.remote,
      canfd: parsed.msgType.canfd,
      brs: parsed.msgType.brs,
      data: parsed.data.toString('hex')
    })
    return new Promise<void>((resolve, reject) => {
      this.pending.push({ resolve, reject })
      this.proc.stdin.write(payload + '\n')
    })
  }
  close() {
    this.closed = true
    try {
      this.proc.stdin.write(JSON.stringify({ cmd: 'close' }) + '\n')
    } catch {
      /* ignore */
    }
    this.proc.kill()
  }
}

export async function createSocketcanTestBus(): Promise<SocketcanTestBus> {
  const probe = probeLinuxSocketcan()
  if (probe.ok && probe.iface) {
    return new LinuxSocketcanBus(probe.iface)
  }
  return new MemorySocketcanBus()
}

export class SocketcanTestCan extends CanBase {
  event = new EventEmitter()
  info: CanBaseInfo
  log: CanLOG
  private closed = false
  private cnt = 0
  private startTime = getTsUs()
  private readAbort = new AbortController()
  private rejectBaseMap = new Map<
    number,
    {
      reject: (reason: CanError) => void
      msgType: CanMsgType
    }
  >()

  constructor(
    info: CanBaseInfo,
    private bus: SocketcanTestBus
  ) {
    super()
    this.info = info
    this.log = new CanLOG('SOCKETCAN', info.name, info.id, this.event)
    this.attachCanMessage(this.busloadCb)
  }

  async open() {
    await this.bus.attach(this)
  }

  injectRx(frame: Buffer) {
    if (this.closed) return
    const parsed = unpackCanFrame(frame)
    const ts = getTsUs() - this.startTime
    const message: CanMessage = {
      dir: 'IN',
      id: parsed.id,
      data: parsed.data,
      ts,
      msgType: parsed.msgType,
      device: this.info.name,
      database: this.info.database
    }
    this.log.canBase(message)
    this.event.emit(this.getReadBaseId(parsed.id, parsed.msgType), message)
  }

  setOption(cmd: string, val: any): any {
    return this._setOption(cmd, val)
  }

  close() {
    this.readAbort.abort()
    this.closed = true
    for (const [, val] of this.rejectBaseMap) {
      val.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, val.msgType))
    }
    this.rejectBaseMap.clear()
    this.bus.detach(this)
    this.log.close()
    this._close()
  }

  getReadBaseId(id: number, msgType: CanMsgType): string {
    return `${id}-${msgType.canfd ? msgType.brs : false}-${msgType.remote}-${msgType.canfd}-${msgType.idType}`
  }

  writeBase(
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    const maxLen = msgType.canfd ? CANFD_MAX_DLEN : CAN_MAX_DLEN
    if (data.length > maxLen) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data)
    }
    if (this.closed) {
      return Promise.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, msgType, data))
    }
    const packed = packCanFrame(id, msgType, data)
    return this.bus.send(this, packed).then(() => {
      const ts = getTsUs() - this.startTime
      const message: CanMessage = {
        dir: 'OUT',
        id,
        data,
        ts,
        msgType,
        device: this.info.name,
        database: extra?.database,
        name: extra?.name
      }
      this.log.canBase(message)
      this.event.emit(this.getReadBaseId(id, msgType), message)
      return ts
    })
  }

  readBase(
    id: number,
    msgType: CanMsgType,
    timeout: number
  ): Promise<{ data: Buffer; ts: number }> {
    return new Promise<{ data: Buffer; ts: number }>((resolve, reject) => {
      const cmdId = this.getReadBaseId(id, msgType)
      const cnt = this.cnt++
      this.rejectBaseMap.set(cnt, { reject, msgType })

      this.readAbort.signal.addEventListener('abort', () => {
        if (this.rejectBaseMap.has(cnt)) {
          this.rejectBaseMap.delete(cnt)
          reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, msgType))
        }
        this.event.off(cmdId, readCb)
      })

      const readCb = (val: any) => {
        clearTimeout(timer)
        if (this.rejectBaseMap.has(cnt)) {
          if (val instanceof CanError) {
            reject(val)
          } else {
            resolve({ data: val.data, ts: val.ts })
          }
          this.rejectBaseMap.delete(cnt)
        }
      }
      const timer = setTimeout(() => {
        this.event.off(cmdId, readCb)
        if (this.rejectBaseMap.has(cnt)) {
          this.rejectBaseMap.delete(cnt)
          reject(new CanError(CAN_ERROR_ID.CAN_READ_TIMEOUT, msgType))
        }
      }, timeout)
      this.event.once(cmdId, readCb)
    })
  }
}

export function socketcanTestInfo(name: string, handle: string): CanBaseInfo {
  return {
    id: name,
    name,
    handle,
    vendor: 'simulate',
    canfd: false,
    bitrate: { freq: 500000, timeSeg1: 0, timeSeg2: 0, sjw: 0, preScaler: 0 }
  }
}
