import {
  CanAddr,
  CanBase,
  CAN_ID_TYPE,
  CanMsgType,
  CAN_ERROR_ID,
  getLenByDlc,
  CanBaseInfo,
  CanDevice,
  CanMessage
} from '../../share/can'
import { EventEmitter } from 'events'
import { cloneDeep, set } from 'lodash'
import { addrToId, CanError } from '../../share/can'
import { CanLOG } from '../../log'
import KV from './../build/Release/kvaser.node'
import { v4 } from 'uuid'

function buf2str(buf: Buffer) {
  const nullCharIndex = buf.indexOf(0) // 0 是 '\0' 的 ASCII 码
  if (nullCharIndex === -1) {
    return buf.toString('utf8')
  }
  return buf.toString('utf8', 0, nullCharIndex)
}
function err2str(err: number, lang = 0x9) {
  const buf = Buffer.alloc(1024)

  KV.canGetErrorText(err, buf)
  return `error : ${buf2str(buf)}`
}
export class KVASER_CAN extends CanBase {
  event: EventEmitter
  info: CanBaseInfo
  handle: number
  closed = false
  cnt = 0
  id: string
  log: CanLOG
  timeOffset = 0
  private readAbort = new AbortController()
  pendingBaseCmds = new Map<
    string,
    {
      resolve: (value: number) => void
      reject: (reason: CanError) => void
      msgType: CanMsgType
      data: Buffer

    }[]
  >()
  
  rejectBaseMap = new Map<
    number,
    {
      reject: (reason: CanError) => void
      msgType: CanMsgType
    }
  >()

  rejectMap = new Map<number, Function>()
  constructor(info: CanBaseInfo) {
    super()
    this.info = info
    this.id = this.info.id

    let flag = KV.canOPEN_ACCEPT_VIRTUAL
    if (info.canfd) {
      flag |= KV.canOPEN_CAN_FD
    }
    const devices = KVASER_CAN.getValidDevices()
    let ret = KV.canOpenChannel(info.handle, flag)
    if (ret < 0) {
      throw new Error(err2str(ret))
    }
    this.handle = ret
    const targetDevice = devices.find((item) => item.handle == info.handle)
    if (targetDevice == undefined) {
      throw new Error('device not found')
    }
    this.event = new EventEmitter()
    this.log = new CanLOG('KVASER', `${targetDevice.label}-${info.handle}`, this.event)


    KV.canBusOff(this.handle)

    const buf = Buffer.alloc(4)
    buf.writeUInt32LE(1)
    ret = KV.canIoCtl(this.handle, KV.canIOCTL_SET_TXACK, buf)
    if (ret != 0) {
      throw new Error(err2str(ret))
    }

    //1us
    buf.writeUInt32LE(1)
    ret = KV.canIoCtl(this.handle, KV.canIOCTL_SET_TIMER_SCALE, buf)
    if (ret != 0) {
      throw new Error(err2str(ret))
    }

    ret = KV.canSetBusOutputControl(this.handle, KV.canDRIVER_NORMAL)
    if (ret != 0) {
      throw new Error(err2str(ret))
    }

    //bitrate
    ret = KV.canSetBusParams(this.handle, Number(info.bitrate.freq), info.bitrate.timeSeg1, info.bitrate.timeSeg2, info.bitrate.sjw, 1, 0);
    if (ret < 0) {
      throw new Error(err2str(ret))
    }
    if (info.canfd && info.bitratefd) {
      ret = KV.canSetBusParamsFd(this.handle, Number(info.bitratefd.freq), info.bitratefd.timeSeg1, info.bitratefd.timeSeg2, info.bitratefd.sjw);
      if (ret != 0) {
        throw new Error(err2str(ret))
      }
    }

    //buson
    ret = KV.canBusOn(this.handle)
    if (ret != 0) {
      throw new Error(err2str(ret))
    }
    KV.CreateTSFN(this.handle, this.id, this.callback.bind(this))
  }
  static loadDllPath(dllPath: string) {
    if(process.platform=='win32'){
      KV.LoadDll(dllPath)
      KV.canInitializeLibrary()
    }
  }
  static unloadDll() {
    if(process.platform=='win32'){
      KV.canUnloadLibrary()
    }
  }
  callback() {
    while (!this.closed) {
      const dlc = new KV.JSUINT32()
      const flag = new KV.JSUINT32()
      const time = new KV.JSUINT64()
      const id = new KV.JSINT64()
      const data = new KV.ByteArray(64)
      const ret = KV.canRead(this.handle, id.cast(), data.cast(), dlc.cast(), flag.cast(), time.cast())
      if (ret == KV.canERR_NOMSG) {
        break
      } else if (ret < 0) {
        this.close(false, err2str(ret))
        break
      } else {
        const flagVal = flag.value()
        const ts = time.value() + this.timeOffset
        const msgType: CanMsgType = {
          idType: CAN_ID_TYPE.STANDARD,
          brs: false,
          canfd: false,
          remote: false
        }
        if (flagVal & KV.canMSG_EXT) {
          msgType.idType = CAN_ID_TYPE.EXTENDED
        }
        if (flagVal & KV.canFDMSG_FDF) {
          msgType.canfd = true
        }
        if (flagVal & KV.canFDMSG_BRS) {
          msgType.brs = true
        }
        if (flagVal & KV.canMSG_RTR) {
          msgType.remote = true
        }
        const buf = Buffer.alloc(dlc.value())
        for (let i = 0; i < dlc.value(); i++) {
          buf[i] = data.getitem(i)
        }
        const cmdId = this.getReadBaseId(id.value(), msgType)
        if (flagVal & KV.canMSG_TXACK) {
          //tx confirm
          const items = this.pendingBaseCmds.get(cmdId)
          if (items) {
            const item = items.shift()!
            msgType.uuid = item.msgType.uuid
            if(items.length==0){
              this.pendingBaseCmds.delete(cmdId)
            }
            const message:CanMessage = {
              dir: 'OUT',
              id: id.value(),
              data: buf,
              ts: ts,
              msgType: msgType,
              device: this.info.name
            }
            this.log.canBase(message)
            this.event.emit(this.getReadBaseId(message.id,message.msgType), message)
            item.resolve(ts)
          }
          setImmediate(this.callback.bind(this))
          return
        } else if (flagVal & KV.canMSG_ERROR_FRAME) {
          //error frame

          //read bus status
          const status = new KV.JSUINT64()
          const err = KV.canReadStatus(this.handle, status.cast())
          if (err != 0) {
            this.close(false, err2str(err))
          } else {
            let str = ''
            const vv = status.value()
            if (vv & KV.canSTAT_ERROR_PASSIVE) {
              str += 'ERROR_PASSIVE '
            }
            if (vv & KV.canSTAT_BUS_OFF) {
              str += 'BUS_OFF '
            }
            if (vv & KV.canSTAT_ERROR_WARNING) {
              str += 'ERROR_WARNING '
            }
            if (vv & KV.canSTAT_ERROR_ACTIVE) {
              str += 'ERROR_ACTIVE '
            }
            if (vv & KV.canSTAT_TX_PENDING) {
              str += 'TX_PENDING '
            }
            if (vv & KV.canSTAT_OVERRUN) {
              str += 'OVERRUN '
            }
            this.log.error(ts, `bus error, ${str}`)
            this.timeOffset = ts
            this.close(true)
          }


        } else {
          //rx
          const message:CanMessage = {
            dir: 'IN',
            id: id.value(),
            data: buf,
            ts: ts,
            msgType: msgType,
            device: this.info.name
          }
          this.log.canBase(message)
          this.event.emit(cmdId, message)
        }
      }
    }
  }
  setOption(cmd: string, val: any): void {
    null
  }
  static override getValidDevices(): CanDevice[] {
    if (process.platform == 'win32') {
      KV.canUnloadLibrary()
      KV.canInitializeLibrary()
      const tsClass = new KV.JSINT32()
      const status = KV.canGetNumberOfChannels(tsClass.cast())
      if (status != 0) {
        throw new Error(err2str(status))
      }
      const num = tsClass.value()
      const devices: CanDevice[] = []
      for (let i = 0; i < num; i++) {
        const buf = Buffer.alloc(1024)
        KV.canGetChannelData(i, 13, buf)
        const serial = buf2str(buf)
        devices.push({
          id: `kvaser-${i}`,
          handle: i,
          label: `${serial}`
        })
      }
      return devices
    }
    return []
  }

  static override getLibVersion(): string {
    if (process.platform == 'win32') {
      const v = KV.canGetVersion()
      return `${v}`
    }
    return 'only support windows'
  }

  close(isReset = false, msg?: string) {

    this.readAbort.abort()



    for (const [key, value] of this.rejectBaseMap) {
      value.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, value.msgType))
    }
    this.rejectBaseMap.clear()
   
    //pendingBaseCmds
    for (const [key, vals] of this.pendingBaseCmds) {
      for (const val of vals) {
        val.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, val.msgType))
      }
    }
    this.pendingBaseCmds.clear()
    if (isReset) {
      KV.canBusOff(this.handle)
      KV.canBusOn(this.handle)
    } else {
      this.closed = true
      this.log.close()
      KV.canClose(this.handle)
      KV.FreeTSFN(this.id)
      this.event.emit('close', msg)
    }
  }
  writeBase(id: number, msgType: CanMsgType, data: Buffer) {
    let maxLen = msgType.canfd ? 64 : 8
    if (data.length > maxLen) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data)
    }

    const cmdId = this.getReadBaseId(id, msgType)

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
      }else {
        maxLen = data.length
      }
      data = Buffer.concat([data, Buffer.alloc(maxLen - data.length).fill(0)])


    }
    return this._writeBase(id, msgType, cmdId, data)
  }
  _writeBase(id: number, msgType: CanMsgType, cmdId: string, data: Buffer) {
    return new Promise<number>(
      (resolve: (value: number) => void, reject: (reason: CanError) => void) => {

        const item = this.pendingBaseCmds.get(cmdId)
        if (item) {
          item.push({ resolve, reject, data, msgType })
        } else {
          this.pendingBaseCmds.set(cmdId, [{ resolve, reject, data, msgType }])
        }
        let flag = 0
        if (msgType.idType == CAN_ID_TYPE.EXTENDED) {
          flag |= KV.canMSG_EXT
        } else {
          flag |= KV.canMSG_STD
        }
        if (msgType.canfd) {
          flag |= KV.canFDMSG_FDF
          if (msgType.brs) {
            flag |= KV.canFDMSG_BRS
          }
        }

        if (msgType.remote) {
          flag |= KV.canMSG_RTR
        }


        const array = new KV.ByteArray(data.length)
        for (let i = 0; i < data.length; i++) {
          array.setitem(i, data[i])
        }

        const res = KV.canWrite(this.handle, id, array.cast(), data.length, flag)
        if (res != 0) {
          this.pendingBaseCmds.get(cmdId)?.pop()
          const str = err2str(res)
          reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data, str))

          this.close(false, str)
        }

      }
    )
  }
  getReadBaseId(id: number, msgType: CanMsgType): string {
    return `${id}-${msgType.canfd ? msgType.brs : false}-${msgType.remote}-${msgType.canfd}-${msgType.idType}`
  }
  readBase(id: number, msgType: CanMsgType, timeout: number) {
    return new Promise<{ data: Buffer; ts: number }>(
      (
        resolve: (value: { data: Buffer; ts: number }) => void,
        reject: (reason: CanError) => void
      ) => {
        const cmdId = this.getReadBaseId(id, msgType)
        const cnt = this.cnt
        this.cnt++
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
      }
    )
  }
}
