import {
  CAN_ID_TYPE,
  CanMsgType,
  CAN_ERROR_ID,
  CanBaseInfo,
  CanDevice,
  getTsUs,
  CanMessage
} from '../../share/can'
import { EventEmitter } from 'events'
import { CanError } from '../../share/can'
import { CanLOG } from '../../log'
import Socketcan from './../build/Release/socketcan.node'
import { platform } from 'os'
import { CanBase } from '../base'

export class Socketcan_CAN extends CanBase {
  event: EventEmitter
  info: CanBaseInfo
  closed = false
  cnt = 0
  id: string
  log: CanLOG
  ifaceName: string
  bitrate: number
  startTime = getTsUs()
  private readAbort = new AbortController()

  rejectBaseMap = new Map<
    number,
    {
      reject: (reason: CanError) => void
      msgType: CanMsgType
    }
  >()

  constructor(info: CanBaseInfo) {
    super()
    this.id = info.id
    this.info = info
    this.ifaceName = String(info.handle)
    this.bitrate = info.bitrate?.freq || 500000

    if (platform() !== 'linux') {
      throw new Error('SocketCAN is only supported on Linux')
    }

    const interfaces = Socketcan.ListInterfaces() as string[]
    if (!interfaces.includes(this.ifaceName)) {
      throw new Error(
        `SocketCAN interface ${this.ifaceName} not found. Available: ${interfaces.join(', ') || 'none'}`
      )
    }

    this.event = new EventEmitter()
    this.log = new CanLOG('SOCKETCAN', info.name, this.id, this.event)

    try {
      Socketcan.CreateTSFN(
        this.ifaceName,
        this.ifaceName.startsWith('vcan') ? 0 : this.bitrate,
        this.id,
        this.callback.bind(this),
        this.errorCallback.bind(this)
      )
    } catch (err: any) {
      throw new Error(`SocketCAN open failed: ${err.message}`)
    }

    this.attachCanMessage(this.busloadCb)
  }

  callback(msg: any) {
    if (!msg) return

    const canId = msg.ID & 0x1fffffff
    const isExtended = (msg.ID & 0x80000000) !== 0
    const isRtr = (msg.ID & 0x40000000) !== 0
    const isErr = msg.FrameType === 3

    const msgType: CanMsgType = {
      idType: isExtended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
      brs: false,
      canfd: false,
      remote: isRtr
    }

    const data = msg.Data ? Buffer.from(msg.Data) : Buffer.alloc(0)
    const cmdId = this.getReadBaseId(canId, msgType)

    if (!isErr) {
      const message: CanMessage = {
        device: this.info.name,
        dir: 'IN',
        id: canId,
        data: data,
        ts: msg.TimeStamp || getTsUs() - this.startTime,
        msgType: msgType,
        database: this.info.database
      }
      this.log.canBase(message)
      this.event.emit(cmdId, message)
    }
  }

  errorCallback(_error: any) {
    for (const [_, value] of this.rejectBaseMap) {
      value.reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, value.msgType))
    }
    this.rejectBaseMap.clear()
  }

  setOption(cmd: string, val: any): any {
    return this._setOption(cmd, val)
  }

  static loadDllPath(_dllPath: string) {}

  static override getValidDevices(): CanDevice[] {
    if (platform() !== 'linux') {
      return []
    }
    try {
      const ifaces = Socketcan.ListInterfaces() as string[]
      return ifaces.map((iface) => ({
        label: iface,
        id: `Socketcan_${iface}`,
        handle: iface
      }))
    } catch {
      return []
    }
  }

  static override getLibVersion(): string {
    if (platform() === 'linux') {
      return 'SocketCAN 1.0 (Linux)'
    }
    return 'SocketCAN only supported on Linux'
  }

  close() {
    this.readAbort.abort()
    for (const [_, value] of this.rejectBaseMap) {
      value.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, value.msgType))
    }
    this.rejectBaseMap.clear()
    this.closed = true
    this.log.close()
    Socketcan.FreeTSFN(this.id)
    this._close()
  }

  writeBase(
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    const maxLen = msgType.canfd ? 64 : 8
    if (data.length > maxLen) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data)
    }

    if (msgType.canfd) {
      throw new CanError(
        CAN_ERROR_ID.CAN_PARAM_ERROR,
        msgType,
        data,
        'SocketCAN: CAN FD not yet supported'
      )
    }

    const cmdId = this.getReadBaseId(id, msgType)
    return this._writeBase(id, msgType, cmdId, data, extra)
  }

  _writeBase(
    id: number,
    msgType: CanMsgType,
    cmdId: string,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      try {
        let canId = id
        if (msgType.idType === CAN_ID_TYPE.EXTENDED) {
          canId |= 0x80000000
        }
        if (msgType.remote) {
          canId |= 0x40000000
        }

        const dataBuf = Buffer.from(data)
        const ok = Socketcan.SendCANMsg(this.id, canId, 0, dataBuf)
        if (!ok) {
          reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data))
          return
        }

        const ts = getTsUs() - this.startTime
        const message: CanMessage = {
          device: this.info.name,
          dir: 'OUT',
          id: id,
          data: data,
          ts: ts,
          msgType: msgType,
          database: extra?.database,
          name: extra?.name
        }
        this.log.canBase(message)
        this.event.emit(cmdId, message)
        resolve(ts)
      } catch (err: any) {
        reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data, err.message))
      }
    })
  }

  readBase(
    id: number,
    msgType: CanMsgType,
    timeout: number
  ): Promise<{ data: Buffer; ts: number }> {
    return new Promise<{ data: Buffer; ts: number }>(
      (
        resolve: (value: { data: Buffer; ts: number }) => void,
        reject: (reason: CanError) => void
      ) => {
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
          if (this.rejectBaseMap.has(cnt)) {
            if (val instanceof CanError) {
              reject(val)
            } else {
              resolve({ data: val.data, ts: val.ts })
            }
            this.rejectBaseMap.delete(cnt)
          }
        }

        this.event.once(cmdId, readCb)
      }
    )
  }

  getReadBaseId(id: number, msgType: CanMsgType): string {
    return `${id}-${msgType.canfd ? msgType.brs : false}-${msgType.remote}-${msgType.canfd}-${msgType.idType}`
  }
}
