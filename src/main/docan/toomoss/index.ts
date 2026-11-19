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
import TOOMOSS from './../build/Release/toomoss.node'
import { arch, platform } from 'node:process'
import { CanBase } from '../base'

const isMacArm64 = platform === 'darwin' && arch === 'arm64'

interface CANFrame {
  canId: number
  msgType: CanMsgType
  data: Buffer
  ts: number
}

export class TOOMOSS_CAN extends CanBase {
  private txCnt = 0
  private pendingBaseCmds = new Map<
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
  event: EventEmitter
  info: CanBaseInfo
  handle: number
  deviceIndex: number
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

    const devices = TOOMOSS_CAN.getValidDevices()
    const target = devices.find((item) => item.handle == info.handle)
    if (!target) {
      throw new Error('Invalid handle')
    }
    if (info.canfd && target.extra?.toomoss?.fdSupported === false) {
      throw new Error('This Toomoss device does not support CAN FD')
    }
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

    // 检查CANFD波特率
    if (info.canfd && info.bitratefd?.freq) {
      // 检查仲裁域波特率
      const calcNbtFreq = Math.floor(
        CLOCK / (info.bitrate.preScaler * (1 + info.bitrate.timeSeg1 + info.bitrate.timeSeg2))
      )
      if (Math.abs(calcNbtFreq - info.bitrate.freq) / info.bitrate.freq > 0.01) {
        throw new Error(
          `Invalid CANFD NBT config: expected ${info.bitrate.freq}, got ${calcNbtFreq}. ` +
            `preScaler=${info.bitrate.preScaler}, ` +
            `timeSeg1=${info.bitrate.timeSeg1}, ` +
            `timeSeg2=${info.bitrate.timeSeg2}`
        )
      }

      // 检查数据域波特率
      const calcDbtFreq = Math.floor(
        CLOCK / (info.bitratefd.preScaler * (1 + info.bitratefd.timeSeg1 + info.bitratefd.timeSeg2))
      )
      if (Math.abs(calcDbtFreq - info.bitratefd.freq) / info.bitratefd.freq > 0.01) {
        throw new Error(
          `Invalid CANFD DBT config: expected ${info.bitratefd.freq}, got ${calcDbtFreq}. ` +
            `preScaler=${info.bitratefd.preScaler}, ` +
            `timeSeg1=${info.bitratefd.timeSeg1}, ` +
            `timeSeg2=${info.bitratefd.timeSeg2}`
        )
      }
    }

    this.event = new EventEmitter()

    this.log = new CanLOG('TOOMOSS', info.name, this.id, this.event)

    this.handle = parseInt(info.handle.split(':')[0])
    this.deviceIndex = parseInt(info.handle.split(':')[1])

    // 检查设备是否已经打开
    if (global.toomossDeviceHandles == undefined) {
      global.toomossDeviceHandles = new Map<
        number,
        {
          refCount: number // 引用计数
          channels: Set<number> // 当前使用的通道
        }
      >()
    }
    let deviceInfo = global.toomossDeviceHandles.get(this.handle)
    if (!deviceInfo) {
      // 首次打开设备
      const ret = TOOMOSS.USB_OpenDevice(this.handle)
      if (ret != 1) {
        throw new Error('Open device failed')
      }
      deviceInfo = {
        refCount: 1,
        channels: new Set([this.deviceIndex])
      }
      global.toomossDeviceHandles.set(this.handle, deviceInfo)
    } else {
      // 设备已打开，检查通道是否已被使用
      if (deviceInfo.channels.has(this.deviceIndex)) {
        throw new Error(`Channel ${this.deviceIndex} is already in use`)
      }
      deviceInfo.refCount++
      deviceInfo.channels.add(this.deviceIndex)
    }
    try {
      this.startChannel(info)
    } catch (err) {
      this.releaseDevice()
      throw err
    }
  }

  private startChannel(info: CanBaseInfo) {
    let ret: number
    TOOMOSS.DEV_ResetTimestamp(this.handle)
    // 初始化CAN配置
    if (info.canfd && info.bitratefd) {
      // CANFD配置

      this.canfdConfig = new TOOMOSS.CANFD_INIT_CONFIG()
      this.canfdConfig.Mode = 0 // 正常模式
      this.canfdConfig.ISOCRCEnable = 1
      this.canfdConfig.RetrySend = 0
      this.canfdConfig.ResEnable = info.toomossRes ? 1 : 0
      // 仲裁域波特率配置
      this.canfdConfig.NBT_BRP = info.bitrate.preScaler
      this.canfdConfig.NBT_SEG1 = info.bitrate.timeSeg1
      this.canfdConfig.NBT_SEG2 = info.bitrate.timeSeg2
      this.canfdConfig.NBT_SJW = info.bitrate.sjw
      // 数据域波特率配置
      this.canfdConfig.DBT_BRP = info.bitratefd.preScaler
      this.canfdConfig.DBT_SEG1 = info.bitratefd.timeSeg1
      this.canfdConfig.DBT_SEG2 = info.bitratefd.timeSeg2
      this.canfdConfig.DBT_SJW = info.bitratefd.sjw
      this.canfdConfig.TDC = 0

      ret = TOOMOSS.CANFD_Init(this.handle, this.deviceIndex, this.canfdConfig)
      if (ret != 0) {
        throw new Error('Init CANFD failed')
      }
      TOOMOSS.CANFD_ResetStartTime(this.handle, this.deviceIndex)

      // 启动CANFD
      ret = TOOMOSS.CANFD_StartGetMsg(this.handle, this.deviceIndex)
      if (ret != 0) {
        throw new Error('Start CANFD failed')
      }
    } else {
      // 普通CAN配置
      this.canConfig = new TOOMOSS.CAN_INIT_CONFIG()
      this.canConfig.CAN_BRP = info.bitrate.preScaler
      this.canConfig.CAN_SJW = info.bitrate.sjw
      this.canConfig.CAN_BS1 = info.bitrate.timeSeg1
      this.canConfig.CAN_BS2 = info.bitrate.timeSeg2
      this.canConfig.CAN_Mode = info.toomossRes ? 0x80 : 0 // 正常模式
      this.canConfig.CAN_ABOM = 0 // 自动离线恢复
      this.canConfig.CAN_NART = 1 // 自动重传
      this.canConfig.CAN_RFLM = 0 // 接收FIFO锁定模式

      this.canConfig.CAN_TXFP = 0 // 发送FIFO优先级

      ret = TOOMOSS.CAN_Init(this.handle, this.deviceIndex, this.canConfig)
      if (ret != 0) {
        throw new Error('Init CAN failed')
      }

      // 启动CAN
      ret = TOOMOSS.CAN_StartGetMsg(this.handle, this.deviceIndex)
      if (ret != 0) {
        throw new Error('Start CAN failed')
      }
      TOOMOSS.CAN_ResetStartTime(this.handle, this.deviceIndex)
    }
    this.attachCanMessage(this.busloadCb)
    // 初始化 TSFN
    TOOMOSS.CreateTSFN(
      this.handle,
      this.deviceIndex,
      this.info.canfd,
      this.id,
      this.callback.bind(this),
      'error-' + this.id,
      this.callbackError.bind(this),
      'tx-' + this.id,
      this.txCallback.bind(this)
    )
  }
  txCallback(obj: any) {
    const { id, timestamp, result } = obj
    const pendingCmds = this.pendingBaseCmds.get(id)
    if (!pendingCmds) return
    this.pendingBaseCmds.delete(id)
    if (result !== 1) {
      pendingCmds.reject(
        new CanError(
          CAN_ERROR_ID.CAN_INTERNAL_ERROR,
          pendingCmds.msgType,
          pendingCmds.data,
          `Send failed (${result})`
        )
      )
      return
    }

    // 更新时间戳偏移
    if (this.tsOffset == undefined) {
      this.tsOffset = timestamp * 10 - (getTsUs() - this.startTime)
    }
    const ts = timestamp * 10 - this.tsOffset

    const message: CanMessage = {
      device: this.info.name,
      dir: 'OUT',
      id: pendingCmds.id,
      data: pendingCmds.data,
      ts: ts,
      msgType: pendingCmds.msgType,
      database: pendingCmds.extra?.database,
      name: pendingCmds.extra?.name
    }
    this.log.canBase(message)
    this.event.emit(this.getReadBaseId(message.id, message.msgType), message)
    pendingCmds.resolve(ts)
  }
  callback(msg: any) {
    if (this.closed || msg.id == 0xffffffff) {
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
      ts: (msg.TimeStampHigh * 0x100000000 + msg.TimeStamp) * 10
    }

    if (this.info.canfd) {
      // CANFD消息处理
      frame.msgType.brs = msg.Flags & 0x01 ? true : false
      frame.msgType.canfd = msg.Flags & 0x04 ? true : false
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

  callbackError(err: any) {
    if (this.closed) return
    this.log.error(getTsUs() - this.startTime, 'bus error')
    this.close(true)
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

  static loadDllPath(dllPath: string) {
    if (platform === 'win32') {
      TOOMOSS.LoadDll(dllPath)
    }
  }

  static override getValidDevices(): CanDevice[] {
    const devices: CanDevice[] = []
    if (platform !== 'win32' && !isMacArm64) return devices

    const handles = new TOOMOSS.I32Array(256)
    const count = TOOMOSS.USB_ScanDevice(handles)
    for (let i = 0; i < count; i++) {
      const handle = handles.getitem(i)
      let channels = 2
      let extra: CanDevice['extra']
      if (isMacArm64) {
        const alreadyOpen = global.toomossDeviceHandles?.has(handle)
        if (!alreadyOpen && !TOOMOSS.USB_OpenDevice(handle)) continue
        try {
          const hardware = new TOOMOSS.HARDWARE_INFO()
          if (TOOMOSS.DEV_GetHardwareInfo(handle, hardware)) {
            channels = hardware.CANChannelNum
            extra = { toomoss: { fdSupported: Boolean(hardware.HaveCANFD) } }
          }
        } finally {
          if (!alreadyOpen) TOOMOSS.USB_CloseDevice(handle)
        }
      }
      for (let channel = 0; channel < channels; channel++) {
        const id = `TOOMOSS_USB_${i}_INDEX_${channel}`
        devices.push({ label: id, id, handle: `${handle}:${channel}`, extra })
      }
    }
    return devices
  }

  static override getLibVersion(): string {
    if (isMacArm64) return 'USB2XXX (9b2fc59e)'
    if (platform === 'win32') {
      return '1.8.6.0'
    } else {
      return 'Not supported'
    }
  }

  close(isReset = false, msg?: string) {
    if (this.closed) return
    this.readAbort.abort()

    for (const [key, value] of this.rejectBaseMap) {
      value.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, value.msgType))
    }

    this.rejectBaseMap.clear()

    for (const val of this.pendingBaseCmds.values()) {
      val.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, val.msgType))
    }
    this.pendingBaseCmds.clear()

    if (isReset) {
      if (this.info.canfd) {
        TOOMOSS.CANFD_ClearMsg(this.handle, this.deviceIndex)
        TOOMOSS.CANFD_Stop(this.handle, this.deviceIndex)
        TOOMOSS.CANFD_Init(this.handle, this.deviceIndex, this.canfdConfig)
        TOOMOSS.CANFD_StartGetMsg(this.handle, this.deviceIndex)
      } else {
        TOOMOSS.CAN_ClearMsg(this.handle, this.deviceIndex)
        TOOMOSS.CAN_Stop(this.handle, this.deviceIndex)
        TOOMOSS.CAN_Init(this.handle, this.deviceIndex, this.canConfig)
        TOOMOSS.CAN_StartGetMsg(this.handle, this.deviceIndex)
      }
      return
    } else {
      this.closed = true
      this.log.close()
      TOOMOSS.FreeTSFN(this.id)
      if (this.info.canfd) {
        TOOMOSS.CANFD_ClearMsg(this.handle, this.deviceIndex)
        TOOMOSS.CANFD_Stop(this.handle, this.deviceIndex)
      } else {
        TOOMOSS.CAN_ClearMsg(this.handle, this.deviceIndex)
        TOOMOSS.CAN_Stop(this.handle, this.deviceIndex)
      }
    }

    this.releaseDevice()
    this._close()
  }

  private releaseDevice() {
    const deviceInfo = global.toomossDeviceHandles?.get(this.handle)
    if (deviceInfo) {
      deviceInfo.channels.delete(this.deviceIndex)
      deviceInfo.refCount--

      // 如果没有其他引用了，关闭设备
      if (deviceInfo.refCount <= 0) {
        TOOMOSS.USB_CloseDevice(this.handle)
        global.toomossDeviceHandles?.delete(this.handle)
      }
    }
  }

  writeBase(
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const cmdId = this.txCnt++

      try {
        this.pendingBaseCmds.set(cmdId, { resolve, reject, msgType, id, data, extra })
        TOOMOSS.SendCANMsg(
          this.handle,
          this.deviceIndex,
          this.info.canfd,
          this.id,

          cmdId,
          {
            ID:
              id |
              (msgType.idType == CAN_ID_TYPE.EXTENDED ? 0x80000000 : 0) |
              (msgType.remote ? 0x40000000 : 0),
            RemoteFlag: msgType.remote ? 1 : 0,
            ExternFlag: msgType.idType == CAN_ID_TYPE.EXTENDED ? 1 : 0,
            DataLen: data.length,
            Data: data,
            DLC: data.length,
            Flags: (msgType.brs ? 0x01 : 0) | (msgType.canfd ? 0x04 : 0)
          }
        )
      } catch (err: any) {
        this.pendingBaseCmds.delete(cmdId)
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
