import { SerialPort } from 'serialport'
import {
  getCheckSum,
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
import LIN from '../build/Release/peakLin.node'
import { v4 } from 'uuid'
import { queue, QueueObject } from 'async'
import { LinLOG } from 'src/main/log'
import EventEmitter from 'events'
import LinBase, { LinWriteOpt, QueueItem } from '../base'
import { getTsUs } from 'src/main/share/can'
import { LDF } from 'src/renderer/src/database/ldfParse'

export class LinCable extends LinBase {
  queue = queue((task: QueueItem, cb) => {
    if (task.discard) {
      cb()
    } else {
      this._write(task.data).then(task.resolve).catch(task.reject).finally(cb)
    }
  }, 1)
  private lastFrame: Map<number, LinMsg> = new Map()
  event = new EventEmitter()
  private rxBuffer = Buffer.alloc(0)
  pendingPromise?: {
    resolve: (msg: LinMsg) => void
    reject: (error: LinError) => void
    sendMsg: LinMsg
  }

  static loadDllPath(dllPath: string) {
    //do nothing
  }

  static getLibVersion() {
    return '1.0.0'
  }
  startTs: number
  // offsetTs = 0
  // offsetInit = false
  log: LinLOG
  db?: LDF
  private serialPort: SerialPort
  private slaveEntry: Map<number, LinMsg> = new Map()

  constructor(public info: LinBaseInfo) {
    super(info)

    this.serialPort = new SerialPort({
      path: this.info.device.handle,
      baudRate: 1000000,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: true
    })

    this.log = new LinLOG('VECTOR', info.name, this.event)
    this.startTs = getTsUs()

    if (info.database) {
      this.db = global.database.lin[info.database]
    }

    // for (let i = 0; i <= 0x3f; i++) {
    //   const checksum = i == 0x3c || i == 0x3d ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED
    //   this.setEntry(i, 8, LinDirection.RECV_AUTO_LEN, checksum, Buffer.alloc(8), 0)
    // }

    const baudMap: Record<number, string> = {
      2400: '00',
      9600: '01',
      10400: '02',
      19200: '03'
    }
    let str = 'O'
    const baud = baudMap[this.info.baudRate]
    if (baud == undefined) {
      throw new Error(`Unsupported baud rate, allowed baud rates are 2400, 9600, 10400, 19200`)
    }

    if (this.info.mode == LinMode.MASTER) {
      str += '1'
    } else {
      str += '0'
    }

    str += `${baud}\r`
    this.startReading()
    this.serialPort.flush()
    this.serialPort.write(str)
    this.serialPort.drain()
    this.serialPort.on('error', (err) => {
      if (!this.close) {
        this.log.error(this.getTs(), `Serial port error: ${err.message}`)
        this.close()
      }
    })

    this.serialPort.on('close', () => {
      if (!this.close) {
        this.log.error(this.getTs(), 'Serial port closed')
        this.close()
      }
    })
    this.startTs = getTsUs()
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
      this.slaveEntry.set(frameId, {
        frameId,
        data: initData,
        direction: dir,
        checksumType
      })
      //从机模式，仅回复数据
      let flag = 0x80
      if (dir == LinDirection.SEND) {
        flag |= 0x40
      }
      if (checksumType == LinChecksumType.ENHANCED) {
        flag |= 0x20
      }
      flag += length + 1
      let str = 'S'
      str += `${frameId.toString(16).padStart(2, '0')}`
      str += `${flag.toString(16).padStart(2, '0')}`
      //data
      str += initData.toString('hex').padStart(2 * length, '0')
      //checksum
      const checksum = getCheckSum(initData, checksumType, frameId)
      str += checksum.toString(16).padStart(2, '0')
      //end
      str += '\r'
      this.serialPort.write(str)
      this.serialPort.drain()
    }
  }
  getTs(): number {
    return getTsUs() - this.startTs
  }
  private startReading(): void {
    if (!this.serialPort) return

    this.serialPort.on('data', (data: Buffer) => {
      this.rxBuffer = Buffer.concat([this.rxBuffer, data])
      this.processRxBuffer()
    })
  }

  private processRxBuffer(): void {
    while (this.rxBuffer.length > 0) {
      const crIndex = this.rxBuffer.indexOf('\r')
      if (crIndex === -1) break

      const line = this.rxBuffer.subarray(0, crIndex).toString('ascii')
      this.rxBuffer = this.rxBuffer.subarray(crIndex + 1)

      if (line.length > 0) {
        this.parseMessage(line)
      }
    }
  }
  private parseMessage(line: string): void {
    if (line.length < 4) return
    const command = line[0]
    // const data = line.slice(1)
    const ts = this.getTs()
    switch (command) {
      case 'M': // master echo
        {
          if (this.pendingPromise == undefined) return
          const data = Buffer.from(line.slice(1), 'hex')
          const ret = data[0]
          const msg = {
            ts: ts,
            ...this.pendingPromise.sendMsg
          }

          if (ret == 0) {
            //ok, but not real ok
            const breakLength = data[1]
            const syncVal = data[2]
            const pid = data[3]
            const id = pid & 0x3f
            const val = data.subarray(4)
            msg.lincable = {
              breakLength,
              syncVal,
              pid
            }
            msg.data = val.subarray(0, val.length - 1)
            if (breakLength < 13) {
              this.log.error(ts, 'break length is too short', msg)

              this.pendingPromise.reject(
                new LinError(
                  LIN_ERROR_ID.LIN_BUS_ERROR,
                  msg,
                  `break length is too short, got ${breakLength}, expected at least 13`
                )
              )
              this.pendingPromise = undefined

              return
            }
            if (syncVal != 0x55) {
              this.log.error(ts, 'sync val is not 0x55', msg)

              this.pendingPromise.reject(
                new LinError(
                  LIN_ERROR_ID.LIN_BUS_ERROR,
                  msg,
                  `sync val is not 0x55, got ${syncVal}`
                )
              )
              this.pendingPromise = undefined

              return
            }
            const rPid = getPID(id)
            if (rPid != pid) {
              this.log.error(ts, 'parity of id is not valid', msg)

              this.pendingPromise.reject(
                new LinError(LIN_ERROR_ID.LIN_BUS_ERROR, msg, 'parity of id is not valid')
              )
              this.pendingPromise = undefined

              return
            }
            if (val.length - 1 < this.pendingPromise.sendMsg.data.length) {
              if (this.pendingPromise.sendMsg.direction == LinDirection.RECV) {
                const msgStr = `no response, got ${val.length - 1 < 0 ? 0 : val.length - 1}, expected ${this.pendingPromise.sendMsg.data.length}`
                this.log.error(ts, msgStr, msg)
                this.pendingPromise.reject(
                  new LinError(LIN_ERROR_ID.LIN_READ_TIMEOUT, this.pendingPromise.sendMsg, msgStr)
                )
              } else {
                const msgStr = `error echo, got ${val.length - 1 < 0 ? 0 : val.length - 1}, expected ${this.pendingPromise.sendMsg.data.length}`
                this.log.error(ts, msgStr, msg)
                this.pendingPromise.reject(
                  new LinError(LIN_ERROR_ID.LIN_READ_TIMEOUT, this.pendingPromise.sendMsg, msgStr)
                )
              }
              this.pendingPromise = undefined

              return
            }
            //only 0x3c and 0x3d are classic checksum
            const checksumType =
              this.pendingPromise?.sendMsg.checksumType ||
              (id == 0x3c || id == 0x3d ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED)

            const checksum = getCheckSum(val.subarray(0, val.length - 1), checksumType, pid)
            if (checksum != val[val.length - 1]) {
              const errorMsg = `checksum error, got ${val[val.length - 1]}, expected ${checksum}`
              this.log.error(ts, errorMsg, msg)

              this.pendingPromise.reject(new LinError(LIN_ERROR_ID.LIN_BUS_ERROR, msg, errorMsg))
              this.pendingPromise = undefined

              return
            }

            this.lastFrame.set(id, msg)

            this.log.linBase(msg)
            this.event.emit(`${id}`, msg)
            this.pendingPromise.resolve(msg)
            this.pendingPromise = undefined

            return
          } else if (ret == 1) {
            //no break
            this.log.error(ts, 'no break', msg)

            this.pendingPromise.reject(new LinError(LIN_ERROR_ID.LIN_BUS_ERROR, msg, 'no break'))
            this.pendingPromise = undefined

            return
          } else if (ret == 2) {
            //no sync
            this.log.error(ts, 'no sync', msg)

            this.pendingPromise.reject(new LinError(LIN_ERROR_ID.LIN_BUS_ERROR, msg, 'no sync'))
            this.pendingPromise = undefined

            return
          } else if (ret == 3) {
            //data format is not valid
            const errorMsg = `data format is not valid, error stop bit occur in ${data.length - 2} byte (start form sync phase,0:means sync phase,1:means PID phase)`
            this.log.error(ts, errorMsg, msg)

            this.pendingPromise.reject(new LinError(LIN_ERROR_ID.LIN_BUS_ERROR, msg, errorMsg))
            this.pendingPromise = undefined

            return
          } else {
            //unknown error
            const errorMsg = `unknown error, ret:${ret}`
            this.log.error(ts, errorMsg, msg)

            this.pendingPromise.reject(new LinError(LIN_ERROR_ID.LIN_INTERNAL_ERROR, msg, errorMsg))
            this.pendingPromise = undefined

            return
          }
        }
        break
      case 'S': // slave echo
        {
          const data = Buffer.from(line.slice(1), 'hex')

          if (data[0] == 0) {
            const id = data[1]
            const msg = this.slaveEntry.get(id)
            const val = data.subarray(2, data.length - 1)
            if (msg) {
              msg.data = val
              msg.checksum = data[data.length - 1]
              msg.ts = ts
              let isEvent = false
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
              //check checksum
              const checksum = getCheckSum(val, msg.checksumType, id)
              if (checksum != data[data.length - 1]) {
                const msg = `Checksum error, got ${data[data.length - 1]}, expected ${checksum}`
                this.log.error(ts, msg)
              } else {
                this.lastFrame.set(id, msg)
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
          } else if (data[0] == 0x81) {
            //error sync
            const msg = `Sync error, got ${data[2]}, expected 0x55`
            this.log.error(ts, msg)
          } else if (data[0] == 2) {
            this.log.error(ts, 'data too short')
          } else if (data[0] == 3) {
            //data format is not valid
            const msg = `Data format is not valid, error stop bit occur in ${data.length - 2} byte (start form sync phase,0:means sync phase,1:means PID phase)`
            this.log.error(ts, msg)
          } else if (data[0] == 0x82) {
            //no enough data
            const id = data[1]
            const msg = this.slaveEntry.get(id)
            if (msg) {
              const msgStr = `No enough data, got ${data.length - 3}, expected ${msg.data.length}`
              this.log.error(ts, msgStr)
            }
          } else {
            //unknown error
            const msg = `Unknown error, ret:${data[1]}`
            this.log.error(ts, msg)
          }
        }
        break
      default:
        // Unknown command, ignore
        break
    }
  }

  close() {
    //clear all pending promise and queue
    if (this.pendingPromise) {
      this.pendingPromise.reject(
        new LinError(LIN_ERROR_ID.LIN_BUS_ERROR, this.pendingPromise.sendMsg, 'close')
      )
      this.pendingPromise = undefined
    }

    this.serialPort.write('C\r')
    this.serialPort.flush()
    this.serialPort.close()
    this.event.emit('close')
  }

  async _write(m: LinMsg): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (this.info.mode == LinMode.MASTER) {
        let str = 'M'
        str += `${getPID(m.frameId).toString(16).padStart(2, '0')}`
        //break length
        str += (m.lincable?.breakLength || 13).toString(16).padStart(2, '0')
        //sync val
        str += (m.lincable?.syncVal || 0x55).toString(16).padStart(2, '0')
        // data len
        str += (m.data.length + 1).toString(16).padStart(2, '0')
        // data
        str += m.data.toString('hex').padStart(2 * m.data.length, '0')
        // checksum
        const checksum = getCheckSum(m.data, m.checksumType, getPID(m.frameId))

        str += checksum.toString(16).padStart(2, '0')
        // error inject
        const errorInject = Buffer.alloc(2, m.lincable?.errorInject1?.bit || 0)
        str += errorInject.toString('hex').padStart(4, '0')
        // error inject1
        const errorInject1 = Buffer.alloc(2, m.lincable?.errorInject2?.bit || 0)
        str += errorInject1.toString('hex').padStart(4, '0')
        // flag
        let flag = 0
        if (m.direction == LinDirection.SEND) {
          flag |= 0x80
        }
        if (m.lincable?.errorInject1) {
          if (m.lincable.errorInject1.value) {
            flag |= 0x1
          }
        }
        if (m.lincable?.errorInject2) {
          if (m.lincable.errorInject2.value) {
            flag |= 0x2
          }
        }
        flag = flag & 0xff
        str += flag.toString(16).padStart(2, '0')
        // end
        str += '\r'
        this.pendingPromise = {
          resolve: (msg) => resolve(msg.ts || 0),
          reject,
          sendMsg: m
        }
        this.serialPort.write(str, (err) => {
          if (err) {
            this.pendingPromise = undefined
            reject(new LinError(LIN_ERROR_ID.LIN_BUS_ERROR, m, 'write error, ' + err.message))
          }
        })

        this.serialPort.drain()
      } else {
        //entry
        this.setEntry(m.frameId, m.data.length, m.direction, m.checksumType, m.data, 0)
        resolve(0)
      }

      // let xlStatus = 0
      // const framedata = new VECTOR.s_xl_lin_msg()
      // framedata.id = m.frameId
      // framedata.dlc = Math.min(m.data.length, 8)
      // const checksum = new VECTOR.UINT16()
      // checksum.assign(m.checksumType == LinChecksumType.CLASSIC ? 0x100 : 0x200)
      // const b = VECTOR.UINT8ARRAY.frompointer(framedata.data)
      // for (let i = 0; i < framedata.dlc; i++) {
      //   b.setitem(i, m.data[i])
      // }
      // if (this.info.mode == LinMode.MASTER) {
      //   //主机模式
      //   if (this.pendingPromise != undefined) {
      //     reject(new LinError(LIN_ERROR_ID.LIN_BUS_BUSY, m))
      //     return
      //   }
      //   if (m.direction == LinDirection.SEND) {
      //     //发送
      //     xlStatus = VECTOR.xlLinSetSlave(
      //       this.PortHandle.value(),
      //       this.channelMask,
      //       framedata.id,
      //       framedata.data,
      //       framedata.dlc,
      //       checksum.value()
      //     )

      //     if (xlStatus !== 0) {
      //       throw new Error(this.getError(xlStatus))
      //     }

      //     xlStatus = VECTOR.xlLinSwitchSlave(
      //       this.PortHandle.value(),
      //       this.channelMask,
      //       framedata.id,
      //       0xff
      //     )
      //     if (xlStatus !== 0) {
      //       throw new Error(this.getError(xlStatus))
      //     }
      //   } else {
      //     xlStatus = VECTOR.xlLinSwitchSlave(
      //       this.PortHandle.value(),
      //       this.channelMask,
      //       framedata.id,
      //       0x00
      //     )
      //     if (xlStatus !== 0) {
      //       throw new Error(this.getError(xlStatus))
      //     }
      //   }
      //   xlStatus = VECTOR.xlLinSendRequest(
      //     this.PortHandle.value(),
      //     this.channelMask,
      //     framedata.id,
      //     0
      //   )
      //   if (xlStatus !== 0) {
      //     reject(new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, m, this.getError(xlStatus)))
      //     return
      //   }

      //   this.pendingPromise = {
      //     resolve: (msg) => resolve(msg.ts || 0),
      //     reject,
      //     sendMsg: m
      //   }
      // } else {
      //   //从机模式
      //   xlStatus = VECTOR.xlLinSetSlave(
      //     this.PortHandle.value(),
      //     this.channelMask,
      //     framedata.id,
      //     framedata.data,
      //     framedata.dlc,
      //     checksum.value()
      //   )
      //   if (xlStatus !== 0) {
      //     reject(new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, m, this.getError(xlStatus)))
      //     return
      //   } else {
      //     resolve(0)
      //   }
      // }
    })
  }

  read(frameId: number) {
    return this.lastFrame.get(frameId)
  }

  wakeup() {
    //   const xlStatus = VECTOR.wakeup(this.PortHandle.value(), this.channelMask)
    //   if (xlStatus !== 0) {
    //     throw new LinError(LIN_ERROR_ID.LIN_INTERNAL_ERROR, undefined, this.getError(xlStatus))
    //   }
  }

  getError(err: number) {
    //   //获取错误
    //   const msg = VECTOR.JSxlGetErrorString(err)
    //   return msg
  }
  static getValidDevices(): Promise<LinDevice[]> {
    return new Promise((r, j) => {
      const devices: LinDevice[] = []

      // Get available serial ports
      SerialPort.list()
        .then((ports) => {
          ports.forEach((port, index) => {
            // Check if this is a CANable device based on vendor and product IDs
            let isLinable = false

            if (
              parseInt(port.vendorId ?? '0', 16) === 0xecbb &&
              parseInt(port.productId ?? '0', 16) === 0xa001
            ) {
              isLinable = true
            }

            if (isLinable) {
              devices.push({
                label: `${port.path} (LinCable)`,
                id: port.path,
                handle: port.path,
                busy: false,
                serialNumber: port.serialNumber
              })
            }
          })
          r(devices)
        })
        .catch((err) => {
          j(err)
        })
    })
  }
}
