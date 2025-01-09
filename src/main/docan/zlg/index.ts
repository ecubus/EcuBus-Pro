import {
  CanAddr,

  CanBase,
  CAN_ID_TYPE,
  CanMsgType,
  CAN_ERROR_ID,
  getLenByDlc,
  CanBaseInfo,
  CanDevice,
  getTsUs,
  CanMessage
} from '../../share/can'
import { EventEmitter } from 'events'
import { cloneDeep, set } from 'lodash'
import { addrToId, CanError } from '../../share/can'
import { CanLOG } from '../../log'
import ZLG from './../build/Release/zlg.node'
import { platform } from 'os'

interface CANFrame {
  canId: number
  msgType: CanMsgType
  data: Buffer
  isEcho: boolean
}

const deviceMap = new Map<string, { device: any; channel: ZLG_CAN[] }>()

export class ZLG_CAN extends CanBase {
  event: EventEmitter
  info: CanBaseInfo
  handle: number
  channel: number
  deviceIndex: number
  index: number
  deviceType: number
  closed = false
  cnt = 0
  id: string
  log: CanLOG
  startTime = getTsUs()
  tsOffset: number | undefined
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
    this.id = info.id
    this.info = info

    const devices = ZLG_CAN.getValidDevices()
    const target = devices.find((item) => item.handle == info.handle)
    if (!target) {
      throw new Error('Invalid handle')
    }
    this.event = new EventEmitter()
    this.log = new CanLOG('ZLG', target.label,this.event)
   

    this.deviceType = parseInt(info.handle.split('_')[0])
    this.index = parseInt(info.handle.split('_')[1])
    this.deviceIndex = parseInt(info.handle.split('_')[2])
    const targetDevice = deviceMap.get(`${this.deviceType}_${this.index}`)
    if (targetDevice) {
      this.handle = targetDevice.device
      targetDevice.channel.push(this)
    } else {
      this.handle = ZLG.ZCAN_OpenDevice(this.deviceType, this.index, 0)

      deviceMap.set(`${this.deviceType}_${this.index}`, { device: this.handle, channel: [this] })
    }
    let ret
    ZLG.ZCAN_SetValue(this.handle, `${this.deviceIndex}/canfd_standard`, '0')
    // if (ret != 1) {
    //   throw new Error('Set canfd standard failed')
    // }
    // ret = ZLG.ZCAN_SetValue(this.handle, `${this.deviceIndex}/set_device_recv_merge`, '1')
    // if (ret != 1) {
    //   throw new Error('Set device recv merge failed')
    // }
    

    ZLG.ZCAN_SetValue(this.handle, `${this.deviceIndex}/initenal_resistance`, '0')

    if (info.bitrate.zlgSpec) {
      const path = `${this.deviceIndex}/baud_rate_custom`
      ret = ZLG.ZCAN_SetValue(this.handle, path, info.bitrate.zlgSpec)
      if (ret != 1) {
        // ZLG.ZCAN_CloseDevice(this.handle)
        throw new Error('Set custom baud rate failed')
      }
    } else {
      const path1 = `${this.deviceIndex}/canfd_abit_baud_rate`
      ret = ZLG.ZCAN_SetValue(this.handle, path1, `${info.bitrate.freq}`)
      if (ret != 1) {
        //close device

        throw new Error('Set abit baud rate failed')
      }
      if (info.canfd && info.bitratefd) {
        const path2 = `${this.deviceIndex}/canfd_dbit_baud_rate`
        ret = ZLG.ZCAN_SetValue(this.handle, path2, `${info.bitratefd.freq}`)
        if (ret != 1) {
          throw new Error('Set dbit baud rate failed')
        }
      } else {
        const path2 = `${this.deviceIndex}/canfd_dbit_baud_rate`
        ret = ZLG.ZCAN_SetValue(this.handle, path2, `${info.bitrate.freq}`)
        if (ret != 1) {
          throw new Error('Set dbit baud rate failed')
        }
      }
    }
    const cfg = new ZLG.ZCAN_CHANNEL_INIT_CONFIG()
    cfg.can_type = 1
    cfg.info.can.mode = 0

    this.channel = ZLG.ZCAN_InitCAN(this.handle, this.deviceIndex, cfg)
    const numHandle = new ZLG.U32Array(2)

    ZLG.handleConver(this.channel, numHandle.cast())

    if (numHandle.getitem(0) == 0 && numHandle.getitem(1) == 0) {
      throw new Error(`Init channel ${this.deviceIndex} failed`)
    }


    ret = ZLG.ZCAN_StartCAN(this.channel)
    if (ret != 1) {
      throw new Error(`Start channel ${this.deviceIndex} failed`)
    }

    ZLG.CreateTSFN(
      numHandle.getitem(0),
      numHandle.getitem(1),
      this.id,
      this.id + 'fd',
      this.callback.bind(this),
      this.callbackFd.bind(this),
      this.id + 'error',
      this.callbackError.bind(this)
    )
    
  }
  callbackError(){
    this.log.error((getTsUs() - this.startTime),'bus error')
    this.close(true)
  }
  static loadDllPath(dllPath: string) {
    if(process.platform=='win32'){
      ZLG.LoadDll(dllPath)
    }
    
  }
  _read(frame: CANFrame, ts: number) {
    if (this.tsOffset == undefined) {
      this.tsOffset = ts - (getTsUs() - this.startTime)
    }
    ts = ts - this.tsOffset
    const cmdId = this.getReadBaseId(frame.canId, frame.msgType)
    if (frame.isEcho) {
      //tx confirm
      const items = this.pendingBaseCmds.get(cmdId)
      if (items) {
        const item = items.shift()!
        frame.msgType.uuid = item.msgType.uuid
        if(items.length==0){
          this.pendingBaseCmds.delete(cmdId)
        }
        console.log('writeBase', items.length)
        const message:CanMessage = {
          device: this.info.name,
          dir: 'OUT',
          id: frame.canId,
          data: frame.data,
          ts: ts,
          msgType: frame.msgType
        }
        this.log.canBase(message)
        this.event.emit(this.getReadBaseId(frame.canId,message.msgType), message)
        item.resolve(ts)
      }
    } else {
      //rx
      const message:CanMessage = {
        device: this.info.name,
        dir: 'IN',
        id: frame.canId,
        data: frame.data,
        ts: ts,
        msgType: frame.msgType
      }
      this.log.canBase(message)
      this.event.emit(cmdId, message)
      
    }
    // console.log('read',id.value(),dlc.value(),flag.value(),time.value())
  }
  async callback(num: number) {
    if(num==0){
      return
    }
    const frames = new ZLG.ReceiveDataArray(num)
    const ret = ZLG.ZCAN_Receive(this.channel, frames.cast(), num, 0)
    if (ret > 0) {
      for (let i = 0; i < ret; i++) {
        const frame = frames.getitem(i)
        const id = frame.frame.can_id
        const data = Buffer.alloc(frame.frame.can_dlc)
        const b = ZLG.ByteArray.frompointer(frame.frame.data)
        for (let j = 0; j < frame.frame.can_dlc; j++) {
          data[j] = b.getitem(j)
        }
        const jsFrame: CANFrame = {
          canId: id & 0x1fffffff,
          msgType: {
            idType: id & 0x80000000 ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
            brs: false,
            canfd: false,
            remote: id & 0x40000000 ? true : false
          },
          data: data,
          isEcho: frame.frame.__pad & 0x20 ? true : false
        }
        this._read(jsFrame, frame.timestamp)
        //让出时间片
        await new Promise((resolve) => {
          setImmediate(() => {
            resolve(null)
          })
        })
        // console.log(jsFrame)
      }
      // setImmediate(()=>{this.callback(100)})
    }
   
  }
  async callbackFd(num: number) {
    if(num==0){
      return
    }
    const frames = new ZLG.ReceiveFDDataArray(num)
    const ret = ZLG.ZCAN_ReceiveFD(this.channel, frames.cast(), num, 0)
    if (ret > 0) {
      for (let i = 0; i < ret; i++) {
        const frame = frames.getitem(i)
        const id = frame.frame.can_id
        const data = Buffer.alloc(frame.frame.len)
        const b = ZLG.ByteArray.frompointer(frame.frame.data)
        for (let j = 0; j < data.length; j++) {
          data[j] = b.getitem(j)
        }
        const jsFrame: CANFrame = {
          canId: id & 0x1fffffff,
          msgType: {
            idType: id & 0x80000000 ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
            brs: frame.frame.flags & 0x01 ? true : false,
            canfd: true,
            remote: id & 0x40000000 ? true : false
          },
          data: data,
          isEcho: frame.frame.flags & 0x20 ? true : false
        }
        this._read(jsFrame, frame.timestamp)
        //让出时间片
        await new Promise((resolve) => {
          setImmediate(() => {
            resolve(null)
          })
        })
      }
      // setImmediate(()=>{this.callbackFd(100)})
    }
  }
  setOption(cmd: string, val: any): void {
    null
  }
  static override getValidDevices(): CanDevice[] {
    if (process.platform == 'win32') {
      const zcanArray: CanDevice[] = [
        {
          label: 'ZCAN_USBCANFD_200U_INDEX_0_CHANNEL_0',
          id: 'ZCAN_USBCANFD_200U_INDEX_0_CHANNEL_0',
          handle: `${ZLG.ZCAN_USBCANFD_200U}_0_0`
        },
        {
          label: 'ZCAN_USBCANFD_200U_INDEX_0_CHANNEL_1',
          id: 'ZCAN_USBCANFD_200U_INDEX_0_CHANNEL_1',
          handle: `${ZLG.ZCAN_USBCANFD_200U}_0_1`
        },
        {
          label: 'ZCAN_USBCANFD_200U_INDEX_1_CHANNEL_0',
          id: 'ZCAN_USBCANFD_200U_INDEX_1_CHANNEL_0',
          handle: `${ZLG.ZCAN_USBCANFD_200U}_1_0`
        },
        {
          label: 'ZCAN_USBCANFD_200U_INDEX_1_CHANNEL_1',
          id: 'ZCAN_USBCANFD_200U_INDEX_1_CHANNEL_1',
          handle: `${ZLG.ZCAN_USBCANFD_200U}_1_1`
        }
      ]
      return zcanArray
    }
    return []
  }
  
  static override getLibVersion(): string {
    if (process.platform == 'win32') {
      return '24.4.3.11'
    }
    return 'only support windows'
  }
  
  close(isReset = false, msg?: string) {
    // clearInterval(this.timer)

    this.readAbort.abort()


    for (const [key, value] of this.rejectBaseMap) {
      value.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, value.msgType))
    }
    this.rejectBaseMap.clear()
    
    //pendingBaseCmds
    for (const [key, vals] of this.pendingBaseCmds) {
      for(const val of vals){
        val.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, val.msgType))
      }
    }
    this.pendingBaseCmds.clear()




    if (isReset) {
      ZLG.ZCAN_ResetCAN(this.channel)
      ZLG.ZCAN_StartCAN(this.channel)
      //this._close(CAN_ERROR_ID.CAN_BUS_CLOSED, msg)
    } else {
      this.closed = true
      this.log.close()
  
      const target = deviceMap.get(`${this.deviceType}_${this.index}`)
      if (target) {
        //remove this channel

        target.channel = target.channel.filter((item) => item != this)
        if (target.channel.length == 0) {
          //close device
          ZLG.ZCAN_CloseDevice(this.handle)
          deviceMap.delete(`${this.deviceType}_${this.index}`)
        }
      }
      ZLG.FreeTSFN(this.id)
    }
  }

  writeBase(id: number, msgType: CanMsgType, data: Buffer) {
    let maxLen = msgType.canfd ? 64 : 8
    if (data.length > maxLen) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data)
    }
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
      }
      else {
        maxLen = data.length
      }
      data = Buffer.concat([data, Buffer.alloc(maxLen - data.length).fill(0)])


    }
   
    const cmdId = this.getReadBaseId(id, msgType)
    //queue
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

        if (msgType.canfd) {
          const frame = new ZLG.ZCAN_TransmitFD_Data()
          frame.transmit_type = 0
          let rid = id

          if (msgType.idType == CAN_ID_TYPE.EXTENDED) {
            rid += 0x80000000
          }
          if (msgType.remote) {
            rid += 0x40000000
          }
          frame.frame.can_id = rid
          //TX_ECHO_FLAG
          frame.frame.flags |= 0x20
          if (msgType.brs) {
            frame.frame.flags |= 0x01
          }
          frame.frame.len = data.length
          const b = ZLG.ByteArray.frompointer(frame.frame.data)

          for (let i = 0; i < data.length; i++) {
            b.setitem(i, data[i])
          }
          const len = ZLG.ZCAN_TransmitFD(this.channel, frame, 1)
          if (len != 1) {
            this.pendingBaseCmds.get(cmdId)?.pop()
            // const err = this.getError()
            // this.close(true)
            reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data))
            // this.log.error((getTsUs() - this.startTime),'bus error')

          }

        } else {
          const frame = new ZLG.ZCAN_Transmit_Data()
          frame.transmit_type = 0
          let rid = id

          if (msgType.idType == CAN_ID_TYPE.EXTENDED) {
            rid += 0x80000000
          }
          if (msgType.remote) {
            rid += 0x40000000
          }
          frame.frame.can_id = rid
          //TX_ECHO_FLAG
          frame.frame.__pad |= 0x20
          frame.frame.can_dlc = data.length
          const b = ZLG.ByteArray.frompointer(frame.frame.data)

          for (let i = 0; i < data.length; i++) {
            b.setitem(i, data[i])
          }
          const len = ZLG.ZCAN_Transmit(this.channel, frame, 1)
          if (len != 1) {
            this.pendingBaseCmds.get(cmdId)?.pop()
            // const msg = this.getError()
            reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data))
            // this.close(true)
            // this.log.error((getTsUs() - this.startTime),'bus error')
          }
        }
      }
    )
  }
  getError() {
    const errInfo = new ZLG.ZCAN_CHANNEL_ERR_INFO()
    ZLG.ZCAN_ReadChannelErrInfo(this.channel, errInfo)
    const errCode = errInfo.error_code
    let msg = ''
    if (errCode & 0x0001) {
      msg += 'ZCAN_ERROR_CAN_OVERFLOW '
    }
    if (errCode & 0x0002) {
      msg += 'ZCAN_ERROR_CAN_ERRALARM '
    }
    if (errCode & 0x0004) {
      msg += 'ZCAN_ERROR_CAN_PASSIVE '
    }
    if (errCode & 0x0008) {
      msg += 'ZCAN_ERROR_CAN_LOSE '
    }
    if (errCode & 0x0010) {
      msg += 'ZCAN_ERROR_CAN_BUSERR '
    }
    if (errCode & 0x0020) {
      msg += 'ZCAN_ERROR_CAN_BUSOFF '
    }
    if (errCode & 0x0040) {
      msg += 'ZCAN_ERROR_CAN_BUFFER_OVERFLOW '
    }
    if (errCode & 0x0100) {
      msg += 'ZCAN_ERROR_DEVICEOPENED '
    }
    if (errCode & 0x0200) {
      msg += 'ZCAN_ERROR_DEVICEOPEN '
    }
    if (errCode & 0x0400) {
      msg += 'ZCAN_ERROR_DEVICENOTOPEN '
    }
    if (errCode & 0x0800) {
      msg += 'ZCAN_ERROR_BUFFEROVERFLOW '
    }
    if (errCode & 0x1000) {
      msg += 'ZCAN_ERROR_DEVICENOTEXIST '
    }
    if (errCode & 0x2000) {
      msg += 'ZCAN_ERROR_LOADKERNELDLL '
    }
    if (errCode & 0x4000) {
      msg += 'ZCAN_ERROR_CMDFAILED '
    }
    if (errCode & 0x8000) {
      msg += 'ZCAN_ERROR_BUFFERCREATE '
    }
    return msg
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
          // clearTimeout(timer)
          if (this.rejectBaseMap.has(cnt)) {
            if (val instanceof CanError) {
              reject(val)
            } else {
              resolve({ data: val.data, ts: val.ts })
            }
            this.rejectBaseMap.delete(cnt)
          }
        }
        // const timer = setTimeout(() => {
        //   this.event.off(cmdId, readCb)
        //   if (this.rejectBaseMap.has(cnt)) {
        //     this.rejectBaseMap.delete(cnt)
        //     reject(new CanError(CAN_ERROR_ID.CAN_READ_TIMEOUT, msgType))
        //   }
        // }, timeout)
        this.event.once(cmdId, readCb)
      }
    )
  }
}
