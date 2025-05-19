import {
  getPID,
  LIN_ERROR_ID,
  LIN_SCH_TYPE,
  LinBaseInfo,
  LinChecksumType,
  LinDevice,
  LinDirection,
  LinError,
  LinMode,
  LinMsg
} from '../../share/lin'
import VECTOR from '../build/Release/vectorLin.node'
import { v4 } from 'uuid'
import { queue, QueueObject } from 'async'
import { LinLOG } from 'src/main/log'
import EventEmitter from 'events'
import LinBase, { LinWriteOpt, QueueItem } from '../base'
import { getTsUs } from 'src/main/share/can'
import { LDF } from 'src/renderer/src/database/ldfParse'

export class VectorLin extends LinBase {
  queue = queue((task: QueueItem, cb) => {
    if (task.discard) {
      cb()
    } else {
      this._write(task.data).then(task.resolve).catch(task.reject).finally(cb)
    }
  }, 1)
  private lastFrame: Map<number, LinMsg> = new Map()
  event = new EventEmitter()
  pendingPromise?: {
    resolve: (msg: LinMsg) => void
    reject: (error: LinError) => void
    sendMsg: LinMsg
  }

  static loadDllPath(dllPath: string) {
    if (process.platform == 'win32') {
      VECTOR.LoadDll(dllPath)
    }
  }

  static getLibVersion() {
    if (process.platform == 'win32') {
      return '11.0.14.0'
    } else {
      return 'only support windows'
    }
  }

  startTs: number
  offsetTs = 0
  offsetInit = false
  log: LinLOG
  db?: LDF

  handle: number
  channel: number = 0
  index: number //设备索引
  deviceType: number //设备类型
  deviceIndex: number
  private channelConfig: any
  private channelMask = 0
  private PermissionMask = new VECTOR.XLACCESS()
  private PortHandle = new VECTOR.XLPORTHANDLE()
  constructor(public info: LinBaseInfo) {
    super(info)

    //'0:0' = 第几路总线：通道索引
    this.index = parseInt(info.device.handle.split(':')[1]) //通道索引： :0
    this.deviceType = parseInt(info.device.handle.split('_')[0]) //父类中设备类型：XL_HWTYPE_VN1611
    this.deviceIndex = parseInt(info.device.handle.split('_')[2]) //通道索引：_0

    this.handle = 1
    // 驱动初始化

    let xlStatus = 0
    const DrvConfig = new VECTOR.XL_DRIVER_CONFIG()
    xlStatus = VECTOR.xlGetDriverConfig(DrvConfig) //获取/打印硬件配置g_xlDrvConfig
    if (xlStatus !== 0) {
      throw new Error(this.getError(xlStatus))
    } else {
      const channles = VECTOR.CHANNEL_CONFIG.frompointer(DrvConfig.channel) //通道配置
      this.channelConfig = channles.getitem(this.index) //通道数组索引
    }

    // 通道掩码计算
    this.channelMask = VECTOR.xlGetChannelMask(
      this.channelConfig.hwType,
      this.channelConfig.hwIndex,
      this.channelConfig.hwChannel
    )

    // 总线类型处理
    if (this.channelConfig.busParams.busType === 2) {
      this.PermissionMask.assign(this.channelMask)
      xlStatus = VECTOR.xlOpenPort(
        this.PortHandle.cast(),
        'xlCANdemo',
        this.channelMask,
        this.PermissionMask.cast(),
        256,
        3,
        2
      )
      if (xlStatus !== 0) {
        VECTOR.xlClosePort(this.PortHandle.value())
        throw new Error(this.getError(xlStatus))
      }
      if (this.PermissionMask.value() == 0) {
        throw new Error('PermissionMask failed')
      }

      const LinStatPar = new VECTOR.XLlinStatPar()
      LinStatPar.LINMode = info.mode == LinMode.MASTER ? 1 : 2
      LinStatPar.baudrate = info.baudRate
      LinStatPar.LINVersion = 3
      xlStatus = VECTOR.xlLinSetChannelParams(
        this.PortHandle.value(),
        this.channelMask,
        LinStatPar
      )
      if (xlStatus !== 0) {
        throw new Error(this.getError(xlStatus))
      }

      const LinDLC = new VECTOR.UINT8ARRAY(64)
      for (let j = 0; j < 64; j++) {
        LinDLC[j] = 8
      }
      xlStatus = VECTOR.xlLinSetDLC(
        this.PortHandle.value(),
        this.channelMask,
        LinDLC
      )
      if (xlStatus !== 0) {
        throw new Error(this.getError(xlStatus))
      }

      xlStatus = VECTOR.xlActivateChannel(
        this.PortHandle.value(),
        this.channelMask,
        2,
        8
      )
      if (xlStatus !== 0) {
        throw new Error(this.getError(xlStatus))
      }

      xlStatus = VECTOR.xlFlushReceiveQueue(this.PortHandle.value())
      if (xlStatus !== 0) {
        throw new Error(this.getError(xlStatus))
      }
    }

    VECTOR.CreateTSFN(
      this.handle,
      this.info.id,
      this.callback.bind(this)
    )

    this.log = new LinLOG('VECTOR', info.name, this.event)
    this.startTs = getTsUs()

    if (info.database) {
      this.db = global.database.lin[info.database]
    }

    for (let i = 0; i <= 0x3f; i++) {
      const checksum = i == 0x3c || i == 0x3d ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED
      this.setEntry(i, 8, LinDirection.RECV_AUTO_LEN, checksum, Buffer.alloc(8), 0)
    }
    // this.getEntrys()
    // this.wakeup()
  }

  setEntry(
    frameId: number,
    length: number,
    dir: LinDirection,
    checksumType: LinChecksumType,
    initData: Buffer,
    flag: number
  ) {
    if (this.info.mode == LinMode.SLAVE) {
      //从机模式，仅回复数据
      let xlStatus = 0
      const framedata = new VECTOR.s_xl_lin_msg()
      framedata.id = frameId
      framedata.dlc = length
      const b = VECTOR.UINT8ARRAY.frompointer(framedata.data)
      for (let i = 0; i < length; i++) {
        b.setitem(i, initData[i])
      }
      xlStatus = VECTOR.xlLinSetSlave(this.PortHandle.value(), this.channelMask, framedata.id, framedata.data, framedata.dlc, 256)
      if (xlStatus !== 0) {
        throw new Error(this.getError(xlStatus))
      }
    }
  }

  async callback() {
    const num = 1
    let xlStatus = 0
    const recvxlevents = new VECTOR.XLEVENT(num)
    const pEventCountSend = new VECTOR.UINT32()
    const checksum = new VECTOR.UINT16()
    checksum.assign(0x100)
    xlStatus = VECTOR.xlLinSendRequest(this.PortHandle.value(), this.channelMask, 0x3d, checksum.value())
    if (xlStatus !== 0) {
      throw new Error(this.getError(xlStatus))
    }

    setTimeout(() => {
      console.log('10ms')
    }, 10)

    pEventCountSend.assign(num)
    xlStatus = VECTOR.xlReceive(this.PortHandle.value(), pEventCountSend.cast(), recvxlevents.cast())
    if (xlStatus !== 0) {
      // throw new Error(this.getError(xlStatus))
    }

    let ts = recvxlevents.timeStamp
    if (!this.offsetInit) {
      this.offsetTs = ts - (getTsUs() - this.startTs)
      this.offsetInit = true
    }
    ts -= this.offsetTs

    if (recvxlevents.tag == 20) {
      //mstStandard
      const recvxlevent = recvxlevents.getitem(0)
      const recvMsg = recvxlevent.tagData.linMsgApi
      const id = recvMsg.linMsg.id
      const data = Buffer.alloc(recvMsg.linMsg.dlc)
      const b = VECTOR.UINT8ARRAY.frompointer(recvMsg.linMsg.data)
      for (let j = 0; j < recvMsg.linMsg.dlc; j++) {
        data[j] = b.getitem(j)
      }

      const msg: LinMsg = {
        frameId: recvMsg.linMsg.id & 0x3f,
        data: data,
        direction: recvMsg.linMsg.flags == 0x40 ? LinDirection.SEND : LinDirection.RECV,
        checksumType:
          recvMsg.linCRCinfo.flags == 0x00 ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED,
        checksum: recvMsg.linCRCinfo.id,
        database: this.info.database
      }

      this.lastFrame.set(msg.frameId, msg)

      let isEvent = false
      if (this.pendingPromise && this.pendingPromise.sendMsg.frameId == (msg.frameId & 0x3f)) {
        this.pendingPromise.sendMsg.data = msg.data
        this.pendingPromise.sendMsg.ts = ts
        this.log.linBase(this.pendingPromise.sendMsg)
        this.event.emit(`${msg.frameId}`, this.pendingPromise.sendMsg)
        this.pendingPromise.resolve(this.pendingPromise.sendMsg)
        this.pendingPromise = undefined
      } else {
        //slave
        msg.ts = ts
        if (this.db) {
          // Find matching frame or event frame
          let frameName: string | undefined

          let publish: string | undefined

          // Check regular frames
          for (const fname in this.db.frames) {
            if (this.db.frames[fname].id === msg.frameId) {
              frameName = fname
              publish = this.db.frames[fname].publishedBy
              break
            }
          }

          // Check event triggered frames
          if (!frameName) {
            for (const ename in this.db.eventTriggeredFrames) {
              const eventFrame = this.db.eventTriggeredFrames[ename]
              if (eventFrame.frameId === msg.frameId) {
                frameName = ename
                isEvent = true
                break
              }
            }
          }

          // Enrich message with database info if frame found
          if (frameName) {
            msg.name = frameName
            msg.workNode = publish
            msg.isEvent = isEvent
          }
        }
        if (isEvent && this.db) {
          const pid = msg.data[0] & 0x3f
          for (const fname in this.db.frames) {
            if (this.db.frames[fname].id === pid) {
              msg.workNode = this.db.frames[fname].publishedBy
              break
            }
          }
        }
        this.log.linBase(msg)
        this.event.emit(`${msg.frameId}`, msg)
      }
    } else if (recvxlevents.tag == 25) {
      this.log.sendEvent('busSleep', ts)
    } else if (recvxlevents.tag == 24) {
      this.log.sendEvent('busWakeUp', ts)
    } else {
      this.log.error(ts, 'internal error')
    }

    await new Promise((resolve) => {
      setImmediate(() => {
        resolve(null)
      })
    })
    await this.callback()
  }

  close() {
    VECTOR.FreeTSFN(this.info.id)
    VECTOR.xlDeactivateChannel(this.PortHandle.value(), this.channelMask) //所选的通道退出总线。如果没有其他情况，通道将被禁用激活通道的端口。
    VECTOR.xlClosePort(this.PortHandle.value()) //这个函数关闭一个端口并禁用它的通道
  }

  async _write(m: LinMsg): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      let xlStatus = 0
      const framedata = new VECTOR.s_xl_lin_msg()
      framedata.id = m.frameId
      framedata.dlc = Math.min(m.data.length, 8)
      const checksum = new VECTOR.UINT16()
      checksum.assign(m.checksumType == LinChecksumType.CLASSIC ? 0x100 : 0x200)
      const b = VECTOR.UINT8ARRAY.frompointer(framedata.data)
      for (let i = 0; i < framedata.dlc; i++) {
        b.setitem(i, m.data[i])
      }
      if (this.info.mode == LinMode.MASTER) {
        //主机模式
        if (this.pendingPromise != undefined) {
          reject(new LinError(LIN_ERROR_ID.LIN_BUS_BUSY, m))
          return
        }
        if (m.direction == LinDirection.SEND) {
          //发送
          xlStatus = VECTOR.xlLinSetSlave(this.PortHandle.value(), this.channelMask, framedata.id, framedata.data, framedata.dlc, checksum.value())
          if (xlStatus !== 0) {
            throw new Error(this.getError(xlStatus))
          }
          xlStatus = VECTOR.xlLinSendRequest(this.PortHandle.value(), this.channelMask, framedata.id, 0)
          if (xlStatus !== 0) {
            reject(new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, m, this.getError(xlStatus)))
            return
          }
        }

        this.pendingPromise = {
          resolve: (msg) => resolve(msg.ts || 0),
          reject,
          sendMsg: m
        }
      } else {
        //从机模式
        xlStatus = VECTOR.xlLinSetSlave(this.PortHandle.value(), this.channelMask, framedata.id, framedata.data, framedata.dlc, checksum.value())
        if (xlStatus !== 0) {
          reject(new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, m, this.getError(xlStatus)))
          return
        } else {
          resolve(0)
        }
      }
    })
  }

  read(frameId: number) {
    return this.lastFrame.get(frameId)
  }

  wakeup() {
    const xlStatus = VECTOR.wakeup(this.PortHandle.value(), this.channelMask)
    if (xlStatus !== 0) {
      throw new LinError(LIN_ERROR_ID.LIN_INTERNAL_ERROR, undefined, this.getError(xlStatus))
    }
  }

  getError(err: number) {
    //获取错误
    const msg = VECTOR.JSxlGetErrorString(err)
    return msg
  }

  static getValidDevices(): LinDevice[] {
    const devices: LinDevice[] = []
    if (process.platform == 'win32') {
      const deviceHandle = new VECTOR.XL_DRIVER_CONFIG()
      const ret = VECTOR.xlGetDriverConfig(deviceHandle) //获取/打印硬件配置g_xlDrvConfig
      console.log('valid channle count', deviceHandle.channelCount)
      if (ret === 0) {
        const channles = VECTOR.CHANNEL_CONFIG.frompointer(deviceHandle.channel) //通道配置
        for (let num = 0; num < deviceHandle.channelCount; num++) {
          //设备通道循环索引
          const channel = channles.getitem(num) //通道数组索引
          const channelName = channel.name.replace(/\0/g, '') //通道名称
          let busType = ''

          if (channel.transceiverName.indexOf('LIN') !== -1) {
            busType = '#LIN' //总线类型
          } else if (channel.name.indexOf('Virtual') !== -1) {
            busType = ''
            continue
          } else {
            busType = '#CAN' //LIN版本不要添加CAN
            continue
          }

          devices.push({
            label: `${channelName}${busType}`, //'VN1640A Channel 1#LIN' = 通道名称#总线类型
            id: `VECTOR_${num}_${busType}`, //'VECTOR_0_#LIN' = 通道索引_#总线类型
            handle: `${channel.hwChannel}:${num}` //'0:0' = 第几路总线：通道索引
          })
        }
      }
    }
    return devices
  }
}
