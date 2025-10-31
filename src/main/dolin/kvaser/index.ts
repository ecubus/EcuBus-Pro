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
import LIN from '../build/Release/kvaserLin.node'
import { v4 } from 'uuid'
import { queue, QueueObject } from 'async'
import { LinLOG } from 'src/main/log'
import EventEmitter from 'events'
import LinBase, { LinWriteOpt, QueueItem } from '../base'
import { getTsUs } from 'src/main/share/can'
import { LDF } from 'src/renderer/src/database/ldfParse'
import { KVASER_CAN } from 'src/main/docan/kvaser'

function err2Str(result: number): string {
  return `Error Code:${result}`
}

export class KvaserLin extends LinBase {
  queue = queue((task: QueueItem, cb) => {
    if (task.discard) {
      cb()
    } else {
      this._write(task.data).then(task.resolve).catch(task.reject).finally(cb)
    }
  }, 1)
  private client: number
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
      LIN.linUnloadLibrary()
      LIN.linInitializeLibrary()
    }
  }
  static getLibVersion() {
    if (process.platform == 'win32') {
      const major = new LIN.IntPointer()
      const minor = new LIN.IntPointer()
      const build = new LIN.IntPointer()

      const result = LIN.linGetVersion(major.cast(), minor.cast(), build.cast())
      if (result == 0) {
        return `${major.value()}.${minor.value()}.${build.value()}`
      } else {
        throw new Error(err2Str(result))
      }
    } else {
      return 'only support windows'
    }
  }
  startTs: number
  offsetTs = 0
  offsetInit = false
  log: LinLOG
  db?: LDF
  constructor(public info: LinBaseInfo) {
    super(info)

    this.client = LIN.linOpenChannel(info.device.handle, info.mode == LinMode.MASTER ? 1 : 2)
    if (this.client == -1) {
      throw new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, undefined, 'open channel failed')
    }
    let result = LIN.linSetBitrate(this.client, Number(info.baudRate))
    if (result != 0) {
      throw new LinError(
        LIN_ERROR_ID.LIN_PARAM_ERROR,
        undefined,
        'set bitrate failed, please check 12v reference voltage connection'
      )
    }
    result = LIN.linBusOn(this.client)
    if (result != 0) {
      throw new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, undefined, 'bus on failed')
    }
    LIN.CreateTSFN(this.client, this.info.id, this.callback.bind(this))
    this.log = new LinLOG('PEAK', info.name, this.info.device.id, this.event)
    this.startTs = getTsUs()

    if (info.database) {
      this.db = global.dataSet.database.lin[info.database]
    }
    // for (let i = 0; i <= 0x3f; i++) {
    //   const checksum = i == 0x3c || i == 0x3d ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED
    //   this.setEntry(i, 8, LinDirection.RECV_AUTO_LEN, checksum, Buffer.alloc(8), 0)
    // }
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
      const result = LIN.linUpdateMessage(this.client, frameId, initData)
      if (result != 0) {
        throw new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, undefined, err2Str(result))
      }
    }
  }
  callback(id: number, msgx: Buffer, dlc: number, flags: number, msgInfo: any) {
    let ts = msgInfo.timestamp * 1000000
    if (!this.offsetInit) {
      this.offsetTs = ts - (getTsUs() - this.startTs)
      this.offsetInit = true
    }
    ts -= this.offsetTs

    if (flags & 0x4) {
      this.log.sendEvent('busWakeUp', ts)
      return
    }

    const msg: LinMsg = {
      frameId: id,
      data: Buffer.from(msgx),
      direction: (flags & 3) == 1 ? LinDirection.SEND : LinDirection.RECV,
      device: this.info.name,
      checksumType: id == 0x3c || id == 0x3d ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED,
      checksum: msgInfo.checkSum,
      database: this.info.database
    }

    //mstStandard

    this.lastFrame.set(msg.frameId, msg)

    const error: string[] = []
    const handle = () => {
      if (flags & 8) {
        error.push('No data, only a header')
      }
      if (flags & 16) {
        error.push('Checksum error')
      }
      if (flags & 32) {
        error.push('ID parity error')
      }
      if (flags & 64) {
        error.push('Synch error')
      }
      if (flags & 128) {
        error.push('Bit error when transmitting')
      }
    }
    let isEvent = false
    if (this.pendingPromise && this.pendingPromise.sendMsg.frameId == msg.frameId) {
      this.pendingPromise.sendMsg.data = msg.data
      this.pendingPromise.sendMsg.ts = ts
      this.pendingPromise.sendMsg.device = msg.device
      if (flags & 0xf8) {
        handle()
        this.log.error(ts, error.join(', '), this.pendingPromise.sendMsg)
        this.pendingPromise.reject(
          new LinError(LIN_ERROR_ID.LIN_BUS_ERROR, this.pendingPromise.sendMsg, error.join(', '))
        )
      } else {
        this.log.linBase(this.pendingPromise.sendMsg)
        this.event.emit(`${msg.frameId}`, this.pendingPromise.sendMsg)
        this.pendingPromise.resolve(this.pendingPromise.sendMsg)
      }
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
      if (flags & 0xf8) {
        handle()
        this.log.error(ts, error.join(', '), msg)
      } else {
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
    }
  }
  close() {
    LIN.FreeTSFN(this.info.id)
    LIN.linBusOff(this.client)
    LIN.linClose(this.client)
  }
  async _write(m: LinMsg): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      let result = 0

      if (this.info.mode == LinMode.MASTER) {
        if (this.pendingPromise != undefined) {
          reject(new LinError(LIN_ERROR_ID.LIN_BUS_BUSY, m))
          return
        }
        if (m.direction == LinDirection.SEND) {
          result = LIN.linWriteMessage(this.client, m.frameId, m.data)
        } else {
          result = LIN.linRequestMessage(this.client, m.frameId)
        }
        if (result != 0) {
          reject(new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, m, err2Str(result)))
          return
        }

        this.pendingPromise = {
          resolve: (msg) => resolve(msg.ts || 0),
          reject,
          sendMsg: m
        }
      } else {
        result = LIN.linUpdateMessage(this.client, m.frameId, m.data)
        if (result != 0) {
          reject(new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, m, err2Str(result)))
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
    const result = LIN.linWriteWakeup(this.client, 1, 0xff)
    if (result != 0) {
      throw new LinError(LIN_ERROR_ID.LIN_INTERNAL_ERROR, undefined, err2Str(result))
    }
  }
  static getValidDevices(reaload = true): LinDevice[] {
    const devices: LinDevice[] = []
    if (process.platform == 'win32') {
      return KVASER_CAN.getLinDevices(reaload)
    } else {
      return devices
    }
  }
}
