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
import LIN from '../build/Release/toomossLin.node'
import { v4 } from 'uuid'
import { queue, QueueObject } from 'async'
import { LinLOG } from 'src/main/log'
import EventEmitter from 'events'
import LinBase, { LinWriteOpt, QueueItem } from '../base'
import { getTsUs } from 'src/main/share/can'
import type { LDF } from 'src/renderer/src/database/ldfParse'

let txCnt = 0
export class ToomossLin extends LinBase {
  // 添加静态设备管理Map

  queue = queue((task: QueueItem, cb) => {
    if (task.discard) {
      cb()
    } else {
      this._write(task.data).then(task.resolve).catch(task.reject).finally(cb)
    }
  }, 1)
  entryDir: Map<number, LinDirection> = new Map()
  private lastFrame: Map<number, LinMsg> = new Map()
  event = new EventEmitter()
  pendingPromise?: {
    resolve: (msg: LinMsg) => void
    reject: (error: LinError) => void
    sendMsg: LinMsg
  }
  static loadDllPath(dllPath: string) {
    if (process.platform == 'win32') {
      LIN.LoadDll(dllPath)
    }
  }
  static getLibVersion() {
    if (process.platform == 'win32') {
      return '1.8.6.0'
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
  deviceIndex: number
  constructor(public info: LinBaseInfo) {
    super(info)

    this.log = new LinLOG('TOOMOSS', info.name, this.event)
    this.startTs = getTsUs()
    this.handle = parseInt(info.device.handle.split(':')[0])
    this.deviceIndex = parseInt(info.device.handle.split(':')[1])
    let ret = 0

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
      LIN.USB_CloseDevice(this.handle)
      // 首次打开设备
      ret = LIN.USB_OpenDevice(this.handle)
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
    LIN.DEV_ResetTimestamp(this.handle)

    if (info.database) {
      this.db = global.database.lin[info.database]
    }

    // LIN.LIN_EX_Stop(this.handle, this.deviceIndex)
    ret = LIN.LIN_EX_Init(
      this.handle,
      this.deviceIndex,
      Number(info.baudRate),
      info.mode == LinMode.MASTER ? 1 : 0
    )

    for (let i = 0; i <= 0x3f; i++) {
      const checksum = i == 0x3c || i == 0x3d ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED
      this.setEntry(i, 8, LinDirection.RECV, checksum, Buffer.alloc(8), 0)
    }

    if (ret != 0) {
      throw new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, undefined, 'init failed')
    }
    LIN.LIN_EX_CtrlPowerOut(this.handle, this.deviceIndex, this.info.device.toomossVolt || 0)
    LIN.CreateTSFN(
      this.handle,
      this.deviceIndex,
      this.info.mode == LinMode.MASTER ? true : false,
      this.info.id,
      this.callback.bind(this)
    )
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
      const entry = new LIN.LIN_EX_MSG()
      entry.MsgType = dir == LinDirection.SEND ? 3 : 4
      // entry.MsgType = 3
      entry.CheckType = checksumType == LinChecksumType.CLASSIC ? 0 : 1
      entry.PID = getPID(frameId)
      entry.DataLen = length
      if (dir == LinDirection.SEND) {
        const ia = LIN.ByteArray.frompointer(entry.Data)
        for (let i = 0; i < length; i++) {
          ia.setitem(i, initData[i])
        }
      }
      const result = LIN.LIN_EX_SlaveSetIDMode(this.handle, this.deviceIndex, entry, 1)
      if (result != 0) {
        throw new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, undefined, 'set id mode failed')
      }
      this.entryDir.set(frameId, dir)
    }
  }
  async callback(msg: {
    id: number
    result: number
    linMsg: {
      MsgType: number
      CheckType: number
      PID: number
      Check: number
      BreakBits: number
      Data: Buffer
      Timestamp: number
    }
  }) {
    const ts = getTsUs() - this.startTs

    if (msg.result > 0) {
      const rmsg: LinMsg = {
        frameId: msg.linMsg.PID & 0x3f,
        data: msg.linMsg.Data,
        direction: this.entryDir.get(msg.linMsg.PID & 0x3f) || LinDirection.RECV,
        checksumType:
          msg.linMsg.CheckType == 0 ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED,
        checksum: msg.linMsg.Check,
        ts: ts,
        database: this.info.database
      }

      //mstStandard

      this.lastFrame.set(rmsg.frameId, rmsg)

      let isEvent = false
      if (this.pendingPromise && this.pendingPromise.sendMsg.frameId == (rmsg.frameId & 0x3f)) {
        if (msg.linMsg.MsgType == 8 || msg.linMsg.MsgType == 9) {
          this.pendingPromise.sendMsg.data = msg.linMsg.Data
          this.pendingPromise.sendMsg.ts = ts
          this.log.linBase(this.pendingPromise.sendMsg)
          this.event.emit(`${rmsg.frameId}`, this.pendingPromise.sendMsg)
          this.pendingPromise.resolve(this.pendingPromise.sendMsg)
        } else {
          const msgStr = `no response, code is ${msg.linMsg.MsgType}`
          this.log.error(ts, msgStr, this.pendingPromise.sendMsg)
          this.pendingPromise.reject(
            new LinError(LIN_ERROR_ID.LIN_BUS_ERROR, this.pendingPromise.sendMsg, msgStr)
          )
        }
        this.pendingPromise = undefined
      } else {
        //slave

        if (this.db) {
          // Find matching frame or event frame
          let frameName: string | undefined

          let publish: string | undefined

          // Check regular frames
          for (const fname in this.db.frames) {
            if (this.db.frames[fname].id === rmsg.frameId) {
              frameName = fname
              publish = this.db.frames[fname].publishedBy
              break
            }
          }

          // Check event triggered frames
          if (!frameName) {
            for (const ename in this.db.eventTriggeredFrames) {
              const eventFrame = this.db.eventTriggeredFrames[ename]
              if (eventFrame.frameId === rmsg.frameId) {
                frameName = ename
                isEvent = true
                break
              }
            }
          }

          // Enrich message with database info if frame found
          if (frameName) {
            rmsg.name = frameName
            rmsg.workNode = publish
            rmsg.isEvent = isEvent
          }
        }

        if (msg.linMsg.MsgType == 9 || msg.linMsg.MsgType == 8) {
          if (isEvent && this.db) {
            const pid = rmsg.data[0] & 0x3f
            for (const fname in this.db.frames) {
              if (this.db.frames[fname].id === pid) {
                rmsg.workNode = this.db.frames[fname].publishedBy
                break
              }
            }
          }
          this.log.linBase(rmsg)
          this.event.emit(`${rmsg.frameId}`, rmsg)
        } else {
          this.log.error(ts, `no response, code is ${msg.linMsg.MsgType}`, rmsg)
        }
      }
    } else {
      if (this.pendingPromise) {
        this.pendingPromise.reject(
          new LinError(
            LIN_ERROR_ID.LIN_BUS_ERROR,
            this.pendingPromise.sendMsg,
            'normal failed, check voltage'
          )
        )
        this.pendingPromise = undefined
      }
    }
  }
  close() {
    LIN.LIN_EX_Stop(this.handle, this.deviceIndex)
    LIN.FreeTSFN(this.info.id)

    const deviceInfo = global.toomossDeviceHandles?.get(this.handle)
    if (deviceInfo) {
      deviceInfo.channels.delete(this.deviceIndex)
      deviceInfo.refCount--

      // 如果没有其他引用了，关闭设备
      if (deviceInfo.refCount <= 0) {
        LIN.USB_CloseDevice(this.handle)
        global.toomossDeviceHandles?.delete(this.handle)
      }
    }
  }
  async _write(m: LinMsg): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const cmdId = txCnt++
      const msg: any = {}
      msg.PID = getPID(m.frameId)
      msg.BreakBits = 13
      msg.CheckType = m.checksumType == LinChecksumType.CLASSIC ? 0 : 1
      msg.Data = m.data
      msg.Check = 0

      if (this.info.mode == LinMode.MASTER) {
        if (this.pendingPromise != undefined) {
          reject(new LinError(LIN_ERROR_ID.LIN_BUS_BUSY, m))
          return
        }
        if (m.direction == LinDirection.SEND) {
          msg.MsgType = 1
        } else {
          msg.MsgType = 2
        }

        LIN.SendLinMsg(this.handle, this.deviceIndex, cmdId, this.info.id, msg)
        this.pendingPromise = {
          resolve: (msg) => resolve(msg.ts || 0),
          reject,
          sendMsg: m
        }
      } else {
        try {
          this.setEntry(m.frameId, m.data.length, m.direction, m.checksumType, m.data, 0)
          resolve(getTsUs() - this.startTs)
        } catch (e) {
          reject(new LinError(LIN_ERROR_ID.LIN_INTERNAL_ERROR, m, 'set entry failed'))
        }
      }
    })
  }

  read(frameId: number) {
    return this.lastFrame.get(frameId)
  }
  wakeup() {
    throw new LinError(LIN_ERROR_ID.LIN_INTERNAL_ERROR, undefined, 'not supported')
  }

  static getValidDevices(): LinDevice[] {
    const devices: LinDevice[] = []
    if (process.platform == 'win32') {
      const deviceHandle = new LIN.I32Array(10)
      const ret = LIN.USB_ScanDevice(deviceHandle)
      if (ret > 0) {
        for (let i = 0; i < ret; i++) {
          const v = deviceHandle.getitem(i)
          devices.push({
            label: `TOOMOSS_USB_${i}_INDEX_0`,
            id: `TOOMOSS_USB_${i}_INDEX_0`,
            handle: `${v}:0`
          })
          devices.push({
            label: `TOOMOSS_USB_${i}_INDEX_1`,
            id: `TOOMOSS_USB_${i}_INDEX_1`,
            handle: `${v}:1`
          })
          devices.push({
            label: `TOOMOSS_USB_${i}_INDEX_2`,
            id: `TOOMOSS_USB_${i}_INDEX_2`,
            handle: `${v}:2`
          })
          devices.push({
            label: `TOOMOSS_USB_${i}_INDEX_3`,
            id: `TOOMOSS_USB_${i}_INDEX_3`,
            handle: `${v}:3`
          })
        }
      }
    }
    return devices
  }
}
