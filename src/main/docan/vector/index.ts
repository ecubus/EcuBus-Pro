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
import { cloneDeep, set } from 'lodash'
import { addrToId, CanError } from '../../share/can'
import { CanLOG } from '../../log'
import VECTOR from './../build/Release/vector.node'
import { platform } from 'os'
import { CanBase } from '../base'

interface CANFrame {
  canId: number
  msgType: CanMsgType
  data: Buffer
  isEcho: boolean
}

//export导出类ZLG_CAN，extends继承类CanBase
export class VECTOR_CAN extends CanBase {
  //新建ZLG_CAN类，继承于CanBase，新建属性和方法
  event: EventEmitter //事件
  info: CanBaseInfo //CAN信息
  handle: number //句柄
  deviceIndex: number //设备索引
  index: number //设备索引
  deviceType: number //设备类型
  closed = false //关闭
  cnt = 0 //计数
  id: string //ID
  log: CanLOG //日志
  private channelConfig: any
  private channelMask = 0
  private PermissionMask = new VECTOR.XLACCESS()
  private PortHandle = new VECTOR.XLPORTHANDLE()
  periodIds: Record<
    number,
    {
      msg: CanMessage
      taskId: string[]
    }
  > = {}
  startTime = getTsUs() //启动时间
  tsOffset: number | undefined //偏移时间
  private readAbort = new AbortController() //创建一个控制器对象，用来中止一个或多个Web请求

  //待定基本命令，键-值
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

  //丢弃，键-值
  rejectBaseMap = new Map<
    number,
    {
      reject: (reason: CanError) => void
      msgType: CanMsgType
    }
  >()

  rejectMap = new Map<number, Function>() //丢弃，键-值

  //新建方法constructor
  constructor(info: CanBaseInfo) {
    super()
    this.id = info.id //当前子类使用=父类中属性
    this.info = info

    const devices = VECTOR_CAN.getValidDevices() //方法，获取设备列表

    const target = devices.find((item) => item.handle == info.handle) //获取设备列表中的句柄 == 下拉框中选择的句柄
    if (!target) {
      throw new Error('Invalid handle') //无效句柄，无效设备
    }

    this.event = new EventEmitter() //创建一个EventEmitter对象，然后使用其方法来发出和监听事件
    this.log = new CanLOG('VECTOR', info.name, this.id, this.event) //

    //'0:0' = 第几路总线：通道索引
    this.index = parseInt(info.handle.split(':')[1]) //通道索引： :0
    this.deviceType = parseInt(info.handle.split('_')[0]) //父类中设备类型：XL_HWTYPE_VN1611
    this.deviceIndex = parseInt(info.handle.split('_')[2]) //通道索引：_0

    this.handle = 1
    // 驱动初始化

    const DrvConfig = new VECTOR.XL_DRIVER_CONFIG()
    let xlStatus = VECTOR.xlGetDriverConfig(DrvConfig) //获取/打印硬件配置g_xlDrvConfig
    if (xlStatus !== 0) {
      throw new Error(this.getError(xlStatus))
    } else {
      const channles = VECTOR.CHANNEL_CONFIG.frompointer(DrvConfig.channel) //通道配置
      this.channelConfig = channles.getitem(this.index) //通道数组索引
    }

    if (info.canfd) {
      if (
        //CANFD使能
        this.channelConfig.channelCapabilities & 0x80000000
      ) {
        //ISO
      } else if (this.channelConfig.channelCapabilities & 0x40000000) {
        //BOSCH
      } else {
        throw new Error('CANFD failed')
      }
    }

    // 通道掩码计算
    this.channelMask = VECTOR.xlGetChannelMask(
      this.channelConfig.hwType,
      this.channelConfig.hwIndex,
      this.channelConfig.hwChannel
    )

    // 总线类型处理
    if (this.channelConfig.busParams.busType === 1) {
      // CAN端口配置（完整条件分支）
      this.PermissionMask.assign(this.channelMask)
      if (info.canfd) {
        //CANFD使能
        xlStatus = VECTOR.xlOpenPort(
          this.PortHandle.cast(),
          'EcuBus-Pro',
          this.channelMask,
          this.PermissionMask.cast(),
          16384,
          4,
          1
        )
      } else {
        //普通CAN
        xlStatus = VECTOR.xlOpenPort(
          this.PortHandle.cast(),
          'EcuBus-Pro',
          this.channelMask,
          this.PermissionMask.cast(),
          4096,
          3,
          1
        )
      }
      if (xlStatus !== 0) {
        VECTOR.xlClosePort(this.PortHandle.value())
        throw new Error(this.getError(xlStatus))
      }
      if (this.PermissionMask.value() == 0) {
        //allow failed
        // throw new Error('PermissionMask failed')
        global.sysLog.warn(
          `${this.info.name}: No init access for the channel. The channel is configured by another application.`
        )
      }

      // CAN波特率配置（完整逻辑）
      if (info.canfd && info.bitratefd) {
        //CANFD使能
        const fdParams = new VECTOR.XLcanFdConf()
        fdParams.arbitrationBitRate = info.bitrate.freq //普通波特率
        fdParams.tseg1Abr = info.bitrate.timeSeg1
        fdParams.tseg2Abr = info.bitrate.timeSeg2
        fdParams.sjwAbr = info.bitrate.sjw

        fdParams.dataBitRate = info.bitratefd.freq //CANFD波特率
        fdParams.tseg1Dbr = info.bitratefd.timeSeg1
        fdParams.tseg2Dbr = info.bitratefd.timeSeg2
        fdParams.sjwDbr = info.bitratefd.sjw
        fdParams.options = 0 // 可选：启用 ISO 标准帧格式

        xlStatus = VECTOR.xlCanFdSetConfiguration(
          this.PortHandle.value(),
          this.channelMask,
          fdParams
        )
        if (xlStatus !== 0) {
          throw new Error(this.getError(xlStatus))
        }
      } else {
        //普通CAN
        const params = new VECTOR.XLchipParams()
        params.bitRate = info.bitrate.freq
        params.sjw = info.bitrate.sjw
        params.tseg1 = info.bitrate.timeSeg1
        params.tseg2 = info.bitrate.timeSeg2
        params.sam = 1

        xlStatus = VECTOR.xlCanSetChannelParams(this.PortHandle.value(), this.channelMask, params)
        if (xlStatus !== 0) {
          throw new Error(this.getError(xlStatus))
        }
      }

      // 通道激活（完整操作序列）
      xlStatus = VECTOR.xlDeactivateChannel(this.PortHandle.value(), this.channelMask)

      xlStatus = VECTOR.xlCanSetChannelOutput(this.PortHandle.value(), this.channelMask, 1)
      if (xlStatus !== 0) {
        throw new Error('xlCanSetChannelOutput failed')
      }
      xlStatus = VECTOR.xlCanSetChannelMode(this.PortHandle.value(), this.channelMask, 1, 0)
      if (xlStatus !== 0) {
        throw new Error(this.getError(xlStatus))
      }
      // xlStatus = VECTOR.xlCanSetReceiveMode(PortHandle.value(),0, 1)
      // if (xlStatus !== 0) {
      //   throw new Error('xlCanSetReceiveMode failed')
      // }
      // xlStatus = VECTOR.xlCanSetChannelTransceiver(PortHandle.value(),  this.channelMask, 0, 6,0)
      // if (xlStatus !== 0) {
      //   throw new Error('xlCanSetChannelTransceiver failed')
      // }
      xlStatus = VECTOR.xlActivateChannel(this.PortHandle.value(), this.channelMask, 1, 8)
      if (xlStatus !== 0) {
        throw new Error('ActivateChannel failed')
      }
    }

    VECTOR.CreateTSFN(
      //创建线程安全函数
      this.PortHandle.value(), //设备句柄
      this.id,
      this.callback.bind(this), //标准CAN帧回调函数
      this.channelMask,
      this.info.canfd
    )
    this.attachCanMessage(this.busloadCb)
  }
  startPeriodSend(message: CanMessage, period: number, duration?: number): string {
    const taskId: string = VECTOR.StartPeriodSend(
      this.id,
      {
        id: message.id,
        extendId: message.msgType.idType == CAN_ID_TYPE.EXTENDED,
        remoteFrame: message.msgType.remote,
        brs: message.msgType.brs,
        canfd: message.msgType.canfd,
        data: [...message.data]
      },
      period / 1000,
      duration || 0
    )
    if (this.periodIds[message.id]) {
      this.periodIds[message.id].taskId.push(taskId)
    } else {
      this.periodIds[message.id] = {
        msg: message,
        taskId: [taskId]
      }
    }

    return taskId
  }
  stopPeriodSend(taskId: string): void {
    const target = Object.values(this.periodIds).find((item) => item.taskId.includes(taskId))
    if (target) {
      VECTOR.StopPeriodSend(taskId)
      this.periodIds[target.msg.id].taskId = this.periodIds[target.msg.id].taskId.filter(
        (item) => item != taskId
      )
      if (this.periodIds[target.msg.id].taskId.length == 0) {
        delete this.periodIds[target.msg.id]
      }
    }
  }
  changePeriodData(taskId: string, data: Buffer): void {
    VECTOR.ChangeData(taskId, [...data])
  }
  static dllLoaded = false
  static driverLoad = false
  static loadDllPath(dllPath: string) {
    if (process.platform == 'win32') {
      if (VECTOR.dllLoaded == false) {
        VECTOR.LoadDll(dllPath) //加载设备DLL
        VECTOR.dllLoaded = true
      }
      if (VECTOR.driverLoad == false) {
        const xlStatus = VECTOR.xlOpenDriver()
        if (xlStatus == 0) {
          VECTOR.driverLoad = true
        } else {
          throw new Error('xl open driver failed')
        }
      }
    }
  }

  _read(frame: CANFrame, ts: number) {
    if (this.tsOffset == undefined) {
      this.tsOffset = ts - (getTsUs() - this.startTime)
    }
    ts = ts - this.tsOffset
    const cmdId = this.getReadBaseId(frame.canId, frame.msgType) //获取ID
    if (frame.isEcho) {
      //回传
      //tx confirm
      const items = this.pendingBaseCmds.get(cmdId)
      if (items) {
        const item = items.shift()!
        frame.msgType.uuid = item.msgType.uuid
        if (items.length == 0) {
          this.pendingBaseCmds.delete(cmdId)
        }

        const message: CanMessage = {
          device: this.info.name,
          dir: 'OUT',
          id: frame.canId,
          data: frame.data,
          ts: ts,
          msgType: frame.msgType,
          database: item.extra?.database,
          name: item.extra?.name
        }
        this.log.canBase(message)
        this.event.emit(this.getReadBaseId(frame.canId, message.msgType), message)
        item.resolve(ts)
      } else {
        const period = this.periodIds[frame.canId]
        if (period) {
          const message: CanMessage = {
            dir: 'OUT',
            id: frame.canId,
            data: frame.data,
            ts: ts,
            msgType: frame.msgType,
            device: this.info.name,
            database: period.msg.database,
            name: period.msg.name
          }
          this.log.canBase(message)
          this.event.emit(this.getReadBaseId(message.id, message.msgType), message)
        }
      }
    } else {
      //非回传帧
      //rx
      const message: CanMessage = {
        device: this.info.name,
        dir: 'IN',
        id: frame.canId,
        data: frame.data,
        ts: ts,
        msgType: frame.msgType,
        database: this.info.database
      }
      this.log.canBase(message) //打印接收帧
      this.event.emit(cmdId, message) //EventEmitter触发事件，接收帧触发
    }
  }

  async callback() {
    let num = 1
    if (!this.info.canfd) {
      // 普通CAN接收
      let xlStatus = 0
      const len = new VECTOR.UINT32()
      len.assign(num)
      const frames = new VECTOR.XLEVENT(num)

      xlStatus = VECTOR.xlReceive(this.PortHandle.value(), len, frames.cast())
      if (xlStatus === 10) {
        return
      }
      num = len.value()

      if (num > 0) {
        for (let i = 0; i < num; i++) {
          const frame = frames.getitem(i)
          if (frame.tag == 1) {
            const msg = frame.tagData.msg

            const id = msg.id
            const data = Buffer.alloc(msg.dlc)
            const b = VECTOR.UINT8ARRAY.frompointer(msg.data)
            for (let j = 0; j < msg.dlc; j++) {
              data[j] = b.getitem(j)
            }
            //
            if (msg.flags & (0x4 | 0x1 | 0x2)) {
              //error
              this.log.error(frame.timeStamp, 'bus error')
              this.close(true, 'bus error')
              break
            }

            const jsFrame: CANFrame = {
              canId: id & 0x1fffffff,
              msgType: {
                idType: id & 0x80000000 ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
                brs: false,
                canfd: false,
                remote: msg.flags & 0x10 ? true : false
              },
              data: data,
              isEcho: msg.flags & 0x40 ? true : false
            }
            this._read(jsFrame, frame.timeStamp / 1000)
            //让出时间片
            await new Promise((resolve) => {
              setImmediate(() => {
                resolve(null)
              })
            })
          }
        }
      }
      await this.callback()
    } else {
      await this.callbackFd()
    }
  }

  async callbackFd() {
    let xlStatus = 0
    const frames = new VECTOR.XLCANRXEVENT(1)

    xlStatus = VECTOR.xlCanReceive(this.PortHandle.value(), frames.cast())
    if (xlStatus === 10) {
      return
    }

    //有数据

    const frame = frames.getitem(0)

    // convert to us
    const ts = frame.timeStampSync / 1000
    if (frame.tag == 0x0404 || frame.tag == 0x0400) {
      const f = frame.tagData.canRxOkMsg
      const id = f.canId
      const data = Buffer.alloc(getLenByDlc(f.dlc, true))
      const b = VECTOR.UINT8ARRAY.frompointer(f.data)
      for (let j = 0; j < data.length; j++) {
        data[j] = b.getitem(j)
      }

      const jsFrame: CANFrame = {
        canId: id & 0x1fffffff,
        msgType: {
          idType: id & 0x80000000 ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
          brs: f.msgFlags & 0x02 ? true : false,
          canfd: f.msgFlags & 0x01 ? true : false,
          remote: f.msgFlags & 0x10 ? true : false
        },
        data: data,
        isEcho: frame.tag == 0x0404 ? true : false
      }

      this._read(jsFrame, ts) //读取解析后的报文
    } else if (frame.tag == 0x0401 || frame.tag == 0x0402) {
      //XL_CAN_EV_ERROR           canError;
      const error = frame.tagData.canError
      let msg = ''
      switch (error.errorCode) {
        case 1:
          msg = 'XL_CAN_ERRC_BIT_ERROR'
          break
        case 2:
          msg = 'XL_CAN_ERRC_FORM_ERROR'
          break
        case 3:
          msg = 'XL_CAN_ERRC_STUFF_ERROR'
          break
        case 4:
          msg = 'XL_CAN_ERRC_OTHER_ERROR'
          break
        case 5:
          msg = 'XL_CAN_ERRC_CRC_ERROR'
          break
        case 6:
          msg = 'XL_CAN_ERRC_ACK_ERROR'
          break
        case 7:
          msg = 'XL_CAN_ERRC_NACK_ERROR'
          break
        case 8:
          msg = 'XL_CAN_ERRC_OVLD_ERROR'
          break
        case 9:
          msg = 'XL_CAN_ERRC_EXCPT_ERROR'
          break
      }

      this.log.error(ts, 'bus error ' + msg)
      this.close(true, 'bus error ' + msg)

      // //让出时间片
      // await new Promise((resolve) => {
      //   //等待下一个报文
      //   setImmediate(() => {
      //     resolve(null)
      //   })
      // })
    }
    setImmediate(() => {
      this.callbackFd()
    })
  }
  setOption(cmd: string, val: any): any {
    return this._setOption(cmd, val)
  }

  //-----------------------------------------------------------------------------------------
  //static定义类的数据成员（属性和方法）为静态的，静态成员可以直接通过类名调用
  //override重写，方法名称，参数名称，返回值类型全部相同
  static override getValidDevices(): CanDevice[] {
    //重写getValidDevices方法，返回值为CanDevice，返回可用设备的列表
    const devices: CanDevice[] = []
    if (process.platform === 'win32') {
      const deviceHandle = new VECTOR.XL_DRIVER_CONFIG()
      const ret = VECTOR.xlGetDriverConfig(deviceHandle) //获取/打印硬件配置g_xlDrvConfig
      if (ret === 0) {
        const channles = VECTOR.CHANNEL_CONFIG.frompointer(deviceHandle.channel) //通道配置
        for (let num = 0; num < deviceHandle.channelCount; num++) {
          //设备通道循环索引
          const channel = channles.getitem(num) //通道数组索引
          const channelName = channel.name.replace(/\0/g, '') //通道名称
          let busType = ''

          if (channel.transceiverName.indexOf('LIN') !== -1) {
            // busType = '#LIN' //总线类型
            continue
          } else if (channel.name.indexOf('Virtual') !== -1) {
            busType = ''
          } else {
            busType = '#CAN'
          }

          devices.push({
            label: `${channelName}${busType}`, //'VN1640A Channel 1#LIN' = 通道名称#总线类型
            id: `VECTOR_${num}_${busType}`, //'VECTOR_0_#LIN' = 通道索引_#总线类型
            //hwType channelBusCapabilities hwIndex hwChannel
            handle: `${channel.hwChannel}:${num}`, //'0:0' = 第几路总线：通道索引
            serialNumber: channel.serialNumber
          })
        }
      }
    }
    return devices
  }

  //-----------------------------------------------------------------------------------------
  static override getLibVersion(): string {
    //库版本信息
    if (process.platform == 'win32') {
      const deviceHandle = new VECTOR.XL_DRIVER_CONFIG()
      const ret = VECTOR.xlGetDriverConfig(deviceHandle) //获取/打印硬件配置g_xlDrvConfig
      if (ret === 0) {
        const version = deviceHandle.dllVersion

        return `${(version >> 24) & 0xff}.${(version >> 16) & 0xff}.${version & 0xffff}`
      } else {
        throw new Error('xlGetDriverConfig failed')
      }
    }
    return 'only support windows'
  }

  close(isReset = false, msg?: string) {
    //关闭设备
    // clearInterval(this.timer)

    this.readAbort.abort() //中止Web请求

    for (const [key, value] of this.rejectBaseMap) {
      //
      value.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, value.msgType, undefined, msg))
    }
    this.rejectBaseMap.clear() //移除 Map 对象的所有键/值对

    //pendingBaseCmds
    for (const [key, vals] of this.pendingBaseCmds) {
      for (const val of vals) {
        val.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, val.msgType, undefined, msg))
      }
    }
    this.pendingBaseCmds.clear()

    if (isReset) {
      //开启复位
      // VECTOR.ZCAN_ResetCAN(this.channel)                         //复位设备
      // VECTOR.ZCAN_StartCAN(this.channel)
      //this._close(CAN_ERROR_ID.CAN_BUS_CLOSED, msg)
      VECTOR.xlDeactivateChannel(this.PortHandle.value(), this.channelMask)
      //active
      VECTOR.xlActivateChannel(this.PortHandle.value(), this.channelMask, 1, 0)
    } else {
      //不复位
      this.closed = true
      this.log.close()

      VECTOR.xlDeactivateChannel(this.PortHandle.value(), this.channelMask) //所选的通道退出总线。如果没有其他情况，通道将被禁用激活通道的端口。
      VECTOR.xlClosePort(this.PortHandle.value()) //这个函数关闭一个端口并禁用它的通道

      VECTOR.FreeTSFN(this.id) //释放
      this._close()
      this.event.emit('close', msg)
    }
  }

  writeBase(
    //发送报文
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ) {
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
  ) {
    return new Promise<number>(
      (resolve: (value: number) => void, reject: (reason: CanError) => void) => {
        const item = this.pendingBaseCmds.get(cmdId)
        if (item) {
          item.push({ resolve, reject, data, msgType, extra })
        } else {
          this.pendingBaseCmds.set(cmdId, [{ resolve, reject, data, msgType, extra }])
        }
        if (this.info.canfd) {
          //CANFD使能
          let rid = id
          if (msgType.idType == CAN_ID_TYPE.EXTENDED) {
            rid += 0x80000000
          }
          let flag = 0
          if (msgType.remote) {
            flag |= 0x0010
          }
          if (msgType.canfd) {
            flag |= 0x0001
            if (msgType.brs) {
              flag |= 0x0002
            }
          }

          const canTxEvt = new VECTOR.XLcanTxEvent()
          canTxEvt.tag = 0x0440

          canTxEvt.tagData.canMsg.canId = rid
          canTxEvt.tagData.canMsg.msgFlags = flag
          canTxEvt.tagData.canMsg.dlc = getDlcByLen(data.length, true)
          const dataPtr = VECTOR.UINT8ARRAY.frompointer(canTxEvt.tagData.canMsg.data)
          for (let i = 0; i < data.length; i++) {
            dataPtr.setitem(i, data[i])
          }

          let xlStatus = 0
          const messageCount = 1
          const cntSent = new VECTOR.UINT32()
          cntSent.assign(1)
          xlStatus = VECTOR.xlCanTransmitEx(
            this.PortHandle.value(),
            this.channelMask,
            messageCount,
            cntSent.cast(),
            canTxEvt
          )

          if (xlStatus != 0) {
            this.pendingBaseCmds.get(cmdId)?.pop()
            const err = this.getError(xlStatus)
            // this.close(true)
            reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data, err))
            // this.log.error((getTsUs() - this.startTime),'bus error')
          }
        } else {
          //普通CAN
          let rid = id
          let flag = 0
          if (msgType.idType == CAN_ID_TYPE.EXTENDED) {
            rid += 0x80000000
          }
          if (msgType.remote) {
            flag |= 0x0010
          }

          const framedata = new VECTOR.s_xl_event()
          framedata.tag = 10
          framedata.tagData.msg.id = rid
          framedata.tagData.msg.dlc = getDlcByLen(data.length, false)
          framedata.tagData.msg.flags = flag
          const dataPtr = VECTOR.UINT8ARRAY.frompointer(framedata.tagData.msg.data)
          for (let i = 0; i < data.length; i++) {
            dataPtr.setitem(i, data[i])
          }

          const cntSent = new VECTOR.UINT32()
          cntSent.assign(1)
          const xlStatus = VECTOR.xlCanTransmit(
            this.PortHandle.value(),
            this.channelMask,
            cntSent.cast(),
            framedata
          )

          if (xlStatus !== 0) {
            //发送错误
            this.pendingBaseCmds.get(cmdId)?.pop()
            const msg = this.getError(xlStatus)
            reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data, msg))
            // this.close(true)
            // this.log.error((getTsUs() - this.startTime),'bus error')
          }
        }
      }
    )
  }

  getError(err: number) {
    //获取错误
    const msg = VECTOR.JSxlGetErrorString(err)

    return msg
  }
  getReadBaseId(id: number, msgType: CanMsgType): string {
    return `${id}-${msgType.canfd ? msgType.brs : false}-${msgType.remote}-${msgType.canfd}-${msgType.idType}`
  }

  readBase(id: number, msgType: CanMsgType, timeout: number) {
    //读取，不改变
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
        this.event.once(cmdId, readCb)
      }
    )
  }
}

export { VECTOR }
