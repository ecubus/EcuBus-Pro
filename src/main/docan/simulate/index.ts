import { CanAddr, CanBase, CAN_ID_TYPE, CanMsgType, CAN_ERROR_ID, getLenByDlc, CanBaseInfo, CanDevice, getTsUs, CanMessage } from '../../share/can'
import { EventEmitter } from 'events'
import { cloneDeep, set } from 'lodash'
import { addrToId, CanError } from '../../share/can'
import { TpError, CanTp } from '../cantp'
import { CanLOG } from '../../log'
const vBusCount = 8

const vBusCountEvent: Record<number, EventEmitter> = {}
for (let i = 0; i < vBusCount; i++) {
  const e = new EventEmitter()
  vBusCountEvent[i] = e
}

const busInitStatus = new Array(vBusCount).fill(false)



export class SIMULATE_CAN extends CanBase {
  event: EventEmitter
  info: CanBaseInfo
  closed = false
  cnt = 0;
  log: CanLOG
  busCb: any
  startTime = getTsUs()
  private readAbort = new AbortController()

  rejectBaseMap = new Map<number, {
    reject: (reason: CanError) => void
    msgType: CanMsgType
  }>()

  rejectMap = new Map<number, Function>()
  constructor(info: CanBaseInfo) {
    super()
    if (busInitStatus[info.handle]) {
      throw new Error('BUS ALREADY INIT')
    }
    busInitStatus[info.handle] = true
    this.info = info
    this.event = vBusCountEvent[info.handle]
    this.log = new CanLOG('SIMULATE', info.name, this.event)
    this.busCb = this.busCbFunction.bind(this)
    this.event.on('bus', this.busCb)

  }
  busCbFunction(val: CanMessage) {
    //rxNotify
    val.dir = 'IN'
    this.log.canBase(val)
    val.ts = getTsUs() - this.startTime
    const cmdId = this.getReadBaseId(val.id, val.msgType)
    this.event.emit(cmdId, val)
  }
  setOption(cmd: string, val: any): void {
    null
  }
  static override getValidDevices(): CanDevice[] {
    return Array.from({ length: vBusCount }, (_, i) => {
      return {
        handle: i,
        id: `Simulate-${i}`,
        label: `Simulate-${i}`,
        busy: false,
      }
    })
  }
  static override getLibVersion(): string {
    return '1.0.0'
  }
  close() {
    this.readAbort.abort()
    this.closed = true
    for (const [key, val] of this.rejectBaseMap) {
      val.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, val.msgType))
    }
    this.rejectBaseMap.clear()

    this.log.close()
    this.event.off('bus', this.busCb)

    busInitStatus[this.info.handle] = false
  }
  writeBase(
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?:{database?:string,name?:string}
  ) {
    let maxLen = msgType.canfd ? 64 : 8
    if (data.length > maxLen) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data)
    }
    const cmdId = `writeBase-${this.getReadBaseId(id, msgType)}`
    //queue
    
    if (msgType.canfd) {
      //detect data.length range by dlc
      if (data.length > 8 && data.length <= 12) {
        maxLen = 12
      } else if (data.length > 12 && data.length <= 16) {
        maxLen = 16
      } else if (data.length > 16 && data.length <= 20) {
        maxLen = 20
      } else if (data.length > 20 && data.length <= 24) {
        maxLen = 24
      } else if (data.length > 24 && data.length <= 32) {
        maxLen = 32
      } else if (data.length > 32 && data.length <= 48) {
        maxLen = 48
      } else if (data.length > 48) {
        maxLen = 64
      } else {
        maxLen = data.length
      }
      data = Buffer.concat([data, Buffer.alloc(maxLen - data.length).fill(0)])


    }
    return this._writeBase(id, msgType, cmdId, data,extra)
  }
  _writeBase(id: number, msgType: CanMsgType, cmdId: string, data: Buffer,extra?:{database?:string,name?:string}) {
    return new Promise<number>(
      (resolve: (value: number) => void, reject: (reason: CanError) => void) => {
        const msg: CanMessage = {
          dir: 'OUT',
          data,
          ts: getTsUs() - this.startTime,
          id,
          msgType,
          device: this.info.name,
          database:extra?.database,
          name:extra?.name
        }
        setTimeout(() => {
          //txNotify
          for (let i = 0; i < busInitStatus.length; i++) {
            if (busInitStatus[i]) {
              const event = vBusCountEvent[i]
              if (i != this.info.handle) {
                event.emit('bus', cloneDeep(msg))
              }



            }
          }
        }, 1);
        setImmediate(() => {
          const us = getTsUs() - this.startTime
          msg.ts = us
          this.log.canBase(msg)
          //txNotify emit/ trigger internal
          const tmpId = this.getReadBaseId(id, msgType)
          this.event.emit(tmpId, msg)
          resolve(us)
        })
      }
    )
  }
  getReadBaseId(id: number, msgType: CanMsgType): string {
    return `readBase-${id}-${msgType.brs}-${msgType.remote}-${msgType.canfd}-${msgType.idType}`
  }
  readBase(
    id: number,
    msgType: CanMsgType,
    timeout: number,
  ) {
    return new Promise<{ data: Buffer; ts: number }>(
      (
        resolve: (value: { data: Buffer; ts: number }) => void,
        reject: (reason: CanError) => void
      ) => {

        const cmdId = this.getReadBaseId(id, msgType)
        const cnt = this.cnt
        this.cnt++
        this.rejectBaseMap.set(cnt, { reject, msgType })

        this.readAbort.signal.onabort = () => {
          if (this.rejectBaseMap.has(cnt)) {
            this.rejectBaseMap.delete(cnt)
            reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, msgType))
          }
          this.event.off(cmdId, readCb)
        }

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
      }
    )
  }

}


export function getVBusEventInfo() {
  const num = []
  for (let i = 0; i < vBusCount; i++) {
    const obj: Record<string | symbol, number> = {}
    const evnets = vBusCountEvent[i].eventNames()
    for (const event of evnets) {
      obj[event] = vBusCountEvent[i].listenerCount(event)
    }
    num.push(obj)
  }
  return num
}