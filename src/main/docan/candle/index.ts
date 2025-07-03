import {
  CanAddr,
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
import { cloneDeep } from 'lodash'
import { addrToId, CanError } from '../../share/can'
import { CanLOG } from '../../log'
import Candle from './../build/Release/candle.node'
import { platform } from 'os'
import { CanBase } from '../base'

interface CANFrame {
  canId: number
  msgType: CanMsgType
  data: Buffer
  ts: number
}

let txCnt = 0
const pendingBaseCmds = new Map<
  number,
  {
    resolve: (value: number) => void
    reject: (reason: CanError) => void
    msgType: CanMsgType
    id: number
    data: Buffer
    extra?: { database?: string; name?: string }
  }
>()

export class Candle_CAN extends CanBase {
  event: EventEmitter
  info: CanBaseInfo
  target: any
  channel = 0
  closed = false
  cnt = 0

  id: string
  log: CanLOG
  canConfig: any
  canfdConfig: any
  startTime = getTsUs()
  tsOffset: number | undefined

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

    const devices = Candle_CAN.getRawDeviceList()
    const target = devices.find((item) => item.interfaceNumber == info.handle)
    if (!target) {
      throw new Error('Invalid handle')
    }
    this.target = target
    if (this.info.bitrate.clock == undefined) {
      throw new Error('Clock frequency is not set')
    }

    // 检查波特率配置
    const CLOCK = Number(this.info.bitrate.clock) * 1000000

    // 检查普通CAN波特率
    if (info.bitrate.freq) {
      const calcFreq = Math.floor(
        CLOCK / (info.bitrate.preScaler * (1 + info.bitrate.timeSeg1 + info.bitrate.timeSeg2))
      )
      // 允许1%的误差
      if (Math.abs(calcFreq - info.bitrate.freq) / info.bitrate.freq > 0.01) {
        throw new Error(
          `Invalid CAN bitrate config: expected ${info.bitrate.freq}, got ${calcFreq}. ` +
            `preScaler=${info.bitrate.preScaler}, ` +
            `timeSeg1=${info.bitrate.timeSeg1}, ` +
            `timeSeg2=${info.bitrate.timeSeg2}`
        )
      }
    }

    this.event = new EventEmitter()

    this.log = new CanLOG('CANABLE', info.name, this.event)

    if (!Candle.candle_dev_open(this.target)) {
      throw new Error('Open device failed')
    }

    // Check baud rate parameters against device capabilities
    const cap = this.target.bt_const

    if (CLOCK != cap.fclk_can) {
      throw new Error(`Clock frequency mismatch: expected ${CLOCK}, got ${cap.fclk_can}`)
    }
    // Check time segments
    if (info.bitrate.timeSeg1 < cap.tseg1_min || info.bitrate.timeSeg1 > cap.tseg1_max) {
      throw new Error(
        `Time segment 1 (${info.bitrate.timeSeg1}) out of valid range [${cap.tseg1_min}-${cap.tseg1_max}]`
      )
    }

    if (info.bitrate.timeSeg2 < cap.tseg2_min || info.bitrate.timeSeg2 > cap.tseg2_max) {
      throw new Error(
        `Time segment 2 (${info.bitrate.timeSeg2}) out of valid range [${cap.tseg2_min}-${cap.tseg2_max}]`
      )
    }

    // Check prescaler (BRP)
    if (info.bitrate.preScaler < cap.brp_min || info.bitrate.preScaler > cap.brp_max) {
      throw new Error(
        `Prescaler (${info.bitrate.preScaler}) out of valid range [${cap.brp_min}-${cap.brp_max}]`
      )
    }
    //sjw
    if (info.bitrate.sjw > cap.sjw_max) {
      throw new Error(`SJW (${info.bitrate.sjw}) out of valid range [0-${cap.sjw_max}]`)
    }
    const bittiming = new Candle.candle_bittiming_t()
    bittiming.prop_seg = 1
    bittiming.phase_seg1 = info.bitrate.timeSeg1
    bittiming.phase_seg2 = info.bitrate.timeSeg2
    bittiming.sjw = info.bitrate.sjw
    bittiming.brp = info.bitrate.preScaler

    if (!Candle.candle_channel_set_timing(this.target, this.channel, bittiming)) {
      throw new Error('Set timing failed')
    }
    let flag = 0
    //canfd config
    if (info.canfd && info.bitratefd) {
      //check
      const canfd_cap = this.target.data_bt_const
      if (
        info.bitratefd.timeSeg1 < canfd_cap.tseg1_min ||
        info.bitratefd.timeSeg1 > canfd_cap.tseg1_max
      ) {
        throw new Error(
          `Time segment 1 (${info.bitratefd.timeSeg1}) out of valid range [${canfd_cap.tseg1_min}-${canfd_cap.tseg1_max}]`
        )
      }
      if (
        info.bitratefd.timeSeg2 < canfd_cap.tseg2_min ||
        info.bitratefd.timeSeg2 > canfd_cap.tseg2_max
      ) {
        throw new Error(
          `Time segment 2 (${info.bitratefd.timeSeg2}) out of valid range [${canfd_cap.tseg2_min}-${canfd_cap.tseg2_max}]`
        )
      }
      if (
        info.bitratefd.preScaler < canfd_cap.brp_min ||
        info.bitratefd.preScaler > canfd_cap.brp_max
      ) {
        throw new Error(
          `Prescaler (${info.bitratefd.preScaler}) out of valid range [${canfd_cap.brp_min}-${canfd_cap.brp_max}]`
        )
      }
      if (info.bitratefd.sjw > canfd_cap.sjw_max) {
        throw new Error(`SJW (${info.bitratefd.sjw}) out of valid range [0-${canfd_cap.sjw_max}]`)
      }
      const bittimingfd = new Candle.candle_bittiming_t()
      bittimingfd.prop_seg = 1
      bittimingfd.phase_seg1 = info.bitratefd.timeSeg1
      bittimingfd.phase_seg2 = info.bitratefd.timeSeg2
      bittimingfd.sjw = info.bitratefd.sjw
      bittimingfd.brp = info.bitratefd.preScaler
      if (!Candle.candle_channel_set_data_timing(this.target, this.channel, bittimingfd)) {
        throw new Error('Set data timing failed')
      }
      //can-fd flag
      flag |= 0x100
    }
    //error report flag
    flag |= 1 << 12

    if (!Candle.candle_channel_start(this.target, this.channel, flag)) {
      throw new Error('Start channel failed')
    }

    if (!Candle.candle_channel_set_interfacenumber_endpoints(this.target, this.channel)) {
      throw new Error('Set interface number endpoints failed')
    }

    Candle.CreateTSFN(this.channel, this.id, this.callback.bind(this))
    Candle.SetContextDevice(this.id, this.target)

    this.attachCanMessage(this.busloadCb)
  }

  callback(msg: any) {
    console.log('xxx', msg)
    if (msg.id == 0xffffffff) {
      return
    }

    const frame: CANFrame = {
      canId: msg.ID & 0x1fffffff,
      msgType: {
        idType: msg.ID & 0x80000000 ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
        remote: msg.ID & 0x40000000 ? true : false,
        canfd: this.info.canfd,
        brs: false
      },
      data: msg.Data,
      ts: ((msg.TimeStampHigh << 32) | msg.TimeStamp) * 10
    }

    if (this.info.canfd) {
      // CANFD消息处理
      frame.msgType.brs = msg.Flags & 0x04 ? true : false // CANDLE_FLAG_BRS = 0x04
      frame.msgType.canfd = msg.Flags & 0x02 ? true : false // CANDLE_FLAG_FD = 0x02
    } else {
      // 普通CAN消息处理
      frame.msgType.brs = false
      frame.msgType.canfd = false

      // 普通CAN最大8字节
      if (frame.data.length > 8) {
        frame.data = frame.data.subarray(0, 8)
      }
    }

    this._read(frame)
  }

  setOption(cmd: string, val: any): any {
    return this._setOption(cmd, val)
  }
  _read(frame: CANFrame) {
    if (this.tsOffset == undefined) {
      this.tsOffset = frame.ts - (getTsUs() - this.startTime)
    }
    const ts = frame.ts - this.tsOffset

    const cmdId = this.getReadBaseId(frame.canId, frame.msgType)
    const message: CanMessage = {
      device: this.info.name,
      dir: 'IN',
      id: frame.canId,
      data: frame.data,
      ts: ts,
      msgType: frame.msgType,
      database: this.info.database
    }

    this.log.canBase(message)
    this.event.emit(cmdId, message)
  }

  static loadDllPath(dllPath: string) {}

  static getRawDeviceList() {
    const list: any[] = []
    if (process.platform == 'win32') {
      const readList = new Candle.candle_list_t()

      const ret = Candle.candle_list_scan(readList)

      if (ret && readList.num_devices > 0) {
        const devicesx = Candle.DeviceArray.frompointer(readList.dev)
        // Build device list
        for (let i = 0; i < readList.num_devices; i++) {
          const device = devicesx.getitem(i)
          list.push(device)
        }
      }

      return list
    }
    return []
  }
  static override getValidDevices(): CanDevice[] {
    const devices: CanDevice[] = []
    if (process.platform == 'win32') {
      const rawList = this.getRawDeviceList()
      for (const device of rawList) {
        const path = Candle.CharArray.frompointer(device.path)
        const buf = Buffer.alloc(256 * 2)
        for (let j = 0; j < 256 * 2; j++) {
          const val = path.getitem(j)
          if (val == 0) {
            break
          }
          buf[j] = val
        }
        let pathStr = buf.toString('ascii').replace(/\0/g, '')
        //remove {xxxx} guid info, maybe {xxx no }
        pathStr = pathStr.replace(/\{.*\}/g, '')
        pathStr = pathStr.replace(/\{.*/g, '')
        devices.push({
          label: `Candle Device ${device.interfaceNumber}`,
          id: `Candle_${device.interfaceNumber}`,
          handle: device.interfaceNumber,
          serialNumber: pathStr
        })
      }
    }
    return devices
  }

  static override getLibVersion(): string {
    if (process.platform == 'win32') {
      const v = Candle_CAN.getRawDeviceList()[0]
      if (v) {
        return `SW:${v.dconf.sw_version}/HW:${v.dconf.hw_version}`
      }
      return '1.0.0'
    } else {
      return 'only support windows'
    }
  }

  close(isReset = false, msg?: string) {
    // this.readAbort.abort()

    // for (const [key, value] of this.rejectBaseMap) {
    //   value.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, value.msgType))
    // }

    // this.rejectBaseMap.clear()

    // for (const [key, val] of pendingBaseCmds) {
    //   val.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, val.msgType))
    // }
    // pendingBaseCmds.clear()

    // if (isReset) {
    //   if (this.info.canfd) {
    //     TOOMOSS.CANFD_ClearMsg(this.handle, this.deviceIndex)
    //     TOOMOSS.CANFD_Stop(this.handle, this.deviceIndex)
    //     TOOMOSS.CANFD_Init(this.handle, this.deviceIndex, this.canfdConfig)
    //     TOOMOSS.CANFD_StartGetMsg(this.handle, this.deviceIndex)
    //   } else {
    //     TOOMOSS.CAN_ClearMsg(this.handle, this.deviceIndex)
    //     TOOMOSS.CAN_Stop(this.handle, this.deviceIndex)
    //     TOOMOSS.CAN_Init(this.handle, this.deviceIndex, this.canConfig)
    //     TOOMOSS.CAN_StartGetMsg(this.handle, this.deviceIndex)
    //   }
    //   return
    // } else {
    //   this.closed = true
    //   this.log.close()
    //   TOOMOSS.FreeTSFN(this.id)
    //   if (this.info.canfd) {
    //     TOOMOSS.CANFD_ClearMsg(this.handle, this.deviceIndex)
    //     TOOMOSS.CANFD_Stop(this.handle, this.deviceIndex)
    //   } else {
    //     TOOMOSS.CAN_ClearMsg(this.handle, this.deviceIndex)
    //     TOOMOSS.CAN_Stop(this.handle, this.deviceIndex)
    //   }
    // }

    // // 更新设备引用计数
    // const deviceInfo = global.toomossDeviceHandles?.get(this.handle)
    // if (deviceInfo) {
    //   deviceInfo.channels.delete(this.deviceIndex)
    //   deviceInfo.refCount--

    //   // 如果没有其他引用了，关闭设备
    //   if (deviceInfo.refCount <= 0) {
    //     TOOMOSS.USB_CloseDevice(this.handle)
    //     global.toomossDeviceHandles?.delete(this.handle)
    //   }
    // }
    this._close()
  }

  writeBase(
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const cmdId = txCnt++

      try {
        // 处理 CANFD buffer，类似 SLCAN 的逻辑
        let processedData = data
        if (msgType.canfd && data.length > 8) {
          let maxLen = 64
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
          processedData = Buffer.concat([data, Buffer.alloc(maxLen - data.length).fill(0)])
        }
        const frame = new Candle.candle_frame_t()
        pendingBaseCmds.set(cmdId, { resolve, reject, msgType, id, data, extra })
        Candle.SendCANMsg(this.id, this.target, this.channel, frame)
      } catch (err: any) {
        pendingBaseCmds.delete(cmdId)
        reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data, err))
      }
    })
  }

  readBase(id: number, msgType: CanMsgType, timeout: number) {
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
