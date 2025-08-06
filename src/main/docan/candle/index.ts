import {
  CanAddr,
  CAN_ID_TYPE,
  CanMsgType,
  CAN_ERROR_ID,
  getLenByDlc,
  CanBaseInfo,
  CanDevice,
  getTsUs,
  CanMessage,
  getDlcByLen
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

  // Add missing pendingBaseCmds property
  pendingBaseCmds = new Map<
    string,
    {
      resolve: (value: number) => void
      reject: (reason: CanError) => void
      msgType: CanMsgType
      data: Buffer
      extra?: { database?: string; name?: string }
    }[]
  >()

  constructor(info: CanBaseInfo) {
    super()
    this.id = info.id
    this.info = info
    const readList = new Candle.candle_list_t()

    Candle.candle_list_scan(readList)

    const devicesx = Candle.DeviceArray.frompointer(readList.dev)
    const devicesArray: any[] = []
    for (let i = 0; i < readList.num_devices; i++) {
      devicesArray.push(devicesx.getitem(i))
    }
    const targetDevice = devicesArray.find((device) => device.interfaceNumber === this.info.handle)
    if (!targetDevice) {
      throw new Error(`Device with interfaceNumber ${this.info.handle} not found`)
    }
    const target = new Candle.candle_device_t()

    this.target = targetDevice
    this.channel = targetDevice.interfaceNumber

    console.log(`device id ${this.id}: ${this.target.interfaceNumber}`)
    console.log('info: ', this.info)

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
    bittiming.phase_seg1 = info.bitrate.timeSeg1 - 1
    bittiming.phase_seg2 = info.bitrate.timeSeg2
    bittiming.sjw = info.bitrate.sjw
    bittiming.brp = info.bitrate.preScaler

    if (!Candle.candle_channel_set_timing(this.target, this.channel, bittiming)) {
      throw new Error('Set timing failed')
    }
    const ra = new Candle.Uint8Array(1)

    if (info.candleRes) {
      ra.setitem(0, 1)
    } else {
      ra.setitem(0, 0)
    }
    const currentRes = new Candle.Uint8Array(1)
    const getSuccess = Candle.candle_channel_get_can_resister_enable_state(
      this.target,
      this.channel,
      currentRes.cast()
    )

    if (getSuccess) {
      const currentResState = currentRes[0] === 1
      const configResState = info.candleRes

      // Only perform the set operation when the configuration value is inconsistent with the hardware state
      if (currentResState !== configResState) {
        if (
          !Candle.candle_channel_set_can_resister_enable_state(this.target, this.channel, ra.cast())
        ) {
          console.log('Set can resister enable state failed')
        }
      } else {
        console.log('Terminal resistor state matches configuration, no need to set')
      }
    } else {
      // Attempt to set even if fetching status fails (to avoid unknown hardware state).
      console.warn('Failed to get current terminal resistor state, attempting to set...')
      if (
        !Candle.candle_channel_set_can_resister_enable_state(this.target, this.channel, ra.cast())
      ) {
        console.log('Set can resister enable state failed')
      }
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
      bittimingfd.phase_seg1 = info.bitratefd.timeSeg1 - 1
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

    // flag |= (1 << 12)

    const ts = new Candle.TS()

    if (!Candle.candle_dev_get_timestamp_us(this.target, ts.cast())) {
      throw new Error('Get timestamp failed')
    }

    if (!Candle.candle_channel_set_interfacenumber_endpoints(this.target, this.channel)) {
      throw new Error('Set interface number endpoints failed')
    }

    if (!Candle.candle_channel_start(this.target, this.channel, flag)) {
      throw new Error('Start channel failed')
    }

    Candle.CreateTSFN(
      this.channel,
      this.id,
      this.callback.bind(this),
      this.errorCallback.bind(this)
    )
    if (!Candle.SetContextDevice(this.id, this.target)) {
      throw new Error('Set context device failed')
    }

    this.attachCanMessage(this.busloadCb)
  }

  callback(msg: any) {
    // Handle received CAN message
    if (msg) {
      // Extract CAN ID without flags
      const canId = msg.ID & 0x1fffffff
      const isEcho = msg.FrameType === 2 // CANDLE_FRAMETYPE_ECHO = 2
      const isExtended = (msg.ID & 0x80000000) !== 0 // CANDLE_ID_EXTENDED
      const isRtr = (msg.ID & 0x40000000) !== 0 // CANDLE_ID_RTR
      const isCanfd = (msg.Flags & 0x02) !== 0 // CANDLE_FLAG_FD
      const hasBrs = (msg.Flags & 0x04) !== 0 // CANDLE_FLAG_BRS

      const msgType: CanMsgType = {
        idType: isExtended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
        brs: hasBrs,
        canfd: isCanfd,
        remote: isRtr
      }

      const data = msg.Data || Buffer.alloc(0)
      const cmdId = this.getReadBaseId(canId, msgType)
      if (isEcho) {
        // Handle echo frame (transmission confirmation)

        const items = this.pendingBaseCmds.get(cmdId)
        if (items && items.length > 0) {
          const item = items.shift()!
          if (items.length == 0) {
            this.pendingBaseCmds.delete(cmdId)
          }

          const message: CanMessage = {
            device: this.info.name,
            dir: 'OUT',
            id: canId,
            data: data,
            ts: msg.TimeStamp,
            msgType: msgType,
            database: item.extra?.database,
            name: item.extra?.name
          }
          this.log.canBase(message)
          this.event.emit(cmdId, message)
          item.resolve(msg.TimeStamp)
        }
      } else {
        const message: CanMessage = {
          device: this.info.name,
          dir: 'IN',
          id: canId,
          data: data,
          ts: msg.TimeStamp,
          msgType: msgType,
          database: this.info.database
        }
        this.log.canBase(message) //打印接收帧
        this.event.emit(cmdId, message) //EventEmitter触发事件，接收帧触发
      }
    }
  }

  errorCallback(error: any) {
    //TODO: handle error
    console.error('Candle send error:', error)

    // Handle send errors
    for (const [key, items] of this.pendingBaseCmds) {
      for (const item of items) {
        item.reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, item.msgType, item.data, error))
      }
    }
    this.pendingBaseCmds.clear()
  }

  setOption(cmd: string, val: any): any {
    return this._setOption(cmd, val)
  }

  static loadDllPath(dllPath: string) {}

  static getRawDeviceList() {
    const list: any[] = []
    if (process.platform == 'win32') {
      const readList = new Candle.candle_list_t()
      const ret = Candle.candle_list_scan(readList)

      if (ret && readList.num_devices > 0) {
        const devicesx = Candle.DeviceArray.frompointer(readList.dev)
        // Convert device array to plain JS array
        const devicesArray: any[] = []
        for (let i = 0; i < readList.num_devices; i++) {
          devicesArray.push(devicesx.getitem(i))
        }
        // Sort by interfaceNumber in ascending order
        devicesArray.sort((a, b) => a.interfaceNumber - b.interfaceNumber)

        // 按排序后的顺序添加到列表
        for (const device of devicesArray) {
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
        // const path = Candle.CharArray.frompointer(device.path)
        // const buf = Buffer.alloc(256 * 2)
        // for (let j = 0; j < 256 * 2; j++) {
        //   const val = path.getitem(j)
        //   if (val == 0) {
        //     break
        //   }
        //   buf[j] = val
        // }
        // let pathStr = buf.toString('ascii').replace(/\0/g, '')
        // //remove {xxxx} guid info, maybe {xxx no }
        // pathStr = pathStr.replace(/\{.*\}/g, '')
        // pathStr = pathStr.replace(/\{.*/g, '')
        // 直接使用设备对象获取友好名称
        const pathStr = Candle.GetDevicePath(device)
        const friendlyNameStr = Candle.GetDeviceFriendlyName(device)
        devices.push({
          label: friendlyNameStr,
          id: `Candle_${device.interfaceNumber}`,
          handle: device.interfaceNumber,
          serialNumber: pathStr
          // serialNumber: pathStr
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
    this.readAbort.abort()

    for (const [key, value] of this.rejectBaseMap) {
      value.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, value.msgType))
    }

    this.rejectBaseMap.clear()

    for (const [key, vals] of this.pendingBaseCmds) {
      for (const val of vals) {
        val.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, val.msgType))
      }
    }
    this.pendingBaseCmds.clear()

    if (isReset) {
      // Reset logic would go here
      return
    } else {
      this.closed = true
      this.log.close()
      Candle.FreeTSFN(this.id)
      Candle.candle_channel_stop(this.target, this.channel)
      Candle.candle_dev_close(this.target)
    }

    this._close()
  }
  writeBase(
    //发送报文
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    let maxLen = msgType.canfd ? 64 : 8 //最大长度
    if (data.length > maxLen) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data)
    }

    if (msgType.canfd) {
      //CANFD帧
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
      data = Buffer.concat([data, Buffer.alloc(maxLen - data.length).fill(0)]) //合并数据和填充数据0
    }

    const cmdId = this.getReadBaseId(id, msgType)
    //queue
    return this._writeBase(id, msgType, cmdId, data, extra) //发送函数
  }
  _writeBase(
    //发送函数
    id: number,
    msgType: CanMsgType,
    cmdId: string,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const item = this.pendingBaseCmds.get(cmdId)
      if (item) {
        item.push({ resolve, reject, data, msgType, extra })
      } else {
        this.pendingBaseCmds.set(cmdId, [{ resolve, reject, data, msgType, extra }])
      }

      try {
        const frame = new Candle.candle_frame_t()

        // 设置 CAN ID，根据 ID 类型添加标志位
        let canId = id
        if (msgType.idType === CAN_ID_TYPE.EXTENDED) {
          canId += 0x80000000 // CANDLE_ID_EXTENDED
        }
        if (msgType.remote) {
          canId += 0x40000000 // CANDLE_ID_RTR
        }
        frame.can_id = canId
        frame.channel = this.channel
        // 设置 DLC (Data Length Code)
        if (msgType.canfd) {
          const dataArray = Candle.Uint8Array.frompointer(frame.msg.canfd.data)
          for (let i = 0; i < data.length; i++) {
            dataArray.setitem(i, data[i])
          }
          frame.can_dlc = getDlcByLen(data.length, true)
        } else {
          const dataArray = Candle.Uint8Array.frompointer(frame.msg.classic_can.data)
          for (let i = 0; i < data.length; i++) {
            dataArray.setitem(i, data[i])
          }
          frame.can_dlc = data.length
        }

        // 设置通道号
        frame.channel = this.channel

        // 设置标志位
        let falg = 0
        if (msgType.canfd) {
          falg += 0x02 // CANDLE_FLAG_FD
          if (msgType.brs) {
            falg += 0x04 // CANDLE_FLAG_BRS
          }
        }
        frame.flags = falg

        Candle.SendCANMsg(this.id, this.channel, frame)
      } catch (err: any) {
        const items = this.pendingBaseCmds.get(cmdId)
        if (items && items.length > 0) {
          items.pop()
        }
        reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data, err))
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

