import { EventTriggeredFrame, Frame, LDF, SchTable } from 'src/renderer/src/database/ldfParse'
import {
  getFrameData,
  getPID,
  LIN_ERROR_ID,
  LIN_SCH_TYPE,
  LinAddr,
  LinBaseInfo,
  LinChecksumType,
  LinDevice,
  LinDirection,
  LinError,
  LinMode,
  LinMsg
} from '../share/lin'
import EventEmitter from 'events'
import { LinLOG } from '../log'
import { getTsUs } from '../share/can'
import { v4 } from 'uuid'
import { QueueObject } from 'async'
import { cloneDeep } from 'lodash'

export interface LinWriteOpt {
  fromSch?: boolean
  diagnostic?: {
    addr: LinAddr
    abort?: AbortController
  }
  timeout?: number
}

interface DiagItem {
  msg: LinMsg
  reject: (reason?: LinError) => void
  resolve: (ts: number) => void
  addr: LinAddr
}

export interface QueueItem {
  resolve: any
  reject: any
  data: LinMsg
  discard?: boolean
}
export default abstract class LinBase {
  lastNad?: number
  schTimer?: NodeJS.Timeout
  sch?: {
    activeSchName: string
    activeIndex: number
    lastActiveSchName?: string
    lastActiveIndex?: number
    diag?: DiagItem
  }
  schName?: string
  abstract info: LinBaseInfo
  abstract log: LinLOG
  nodeList: {
    db: LDF
    nodeName: string
  }[] = []
  diagQueue: DiagItem[] = []
  constructor(info: LinBaseInfo) {}

  abstract queue: QueueObject<QueueItem>
  abstract startTs: number
  abstract event: EventEmitter
  static getValidDevices(): LinDevice[] {
    throw new Error('Method not implemented.')
  }
  attachLinMessage(cb: (msg: LinMsg) => void) {
    this.event.on('lin-frame', cb)
  }
  detachLinMessage(cb: (msg: LinMsg) => void) {
    this.event.off('lin-frame', cb)
  }
  pendingDiagRead: {
    addr: LinAddr
    id: number
    mode: LinMode
  }[] = []
  setPendingDiagRead(id: number, mode: LinMode, addr: LinAddr) {
    this.pendingDiagRead.push({ id, mode, addr })
  }
  clearPendingDiagRead(id: number) {
    this.pendingDiagRead = this.pendingDiagRead.filter((d) => d.id != id)
  }
  // calculateChecksum(data: Buffer, checksumType: LinChecksumType): number {
  //     let checksum = 0
  //     if (checksumType == LinChecksumType.CLASSIC) {
  //         for (let i = 0; i < data.length; i++) {
  //             checksum += data[i]
  //         }
  //         checksum = 0xff - (checksum & 0xff)
  //     } else {
  //         for (let i = 0; i < data.length; i++) {
  //             checksum += data[i]
  //             checksum = (checksum & 0xff) + (checksum >> 8)
  //         }
  //         checksum = 0xff - checksum
  //     }
  //     return checksum
  // }
  setupEntry(workNode: string) {
    if (this.info.database) {
      const dbName = workNode.split(':')[0]
      const nodeName = workNode.split(':')[1]
      const db = global.database.lin[this.info.database]
      if (db && db.name == dbName) {
        //setup entry for unconditional frames
        for (const frameName in db.frames) {
          const frame = db.frames[frameName]
          if (frame.publishedBy === nodeName) {
            const checksum =
              frame.id == 0x3c || frame.id == 0x3d
                ? LinChecksumType.CLASSIC
                : LinChecksumType.ENHANCED
            this.setEntry(
              frame.id,
              frame.frameSize,
              LinDirection.SEND,
              checksum,
              getFrameData(db, frame),
              1
            )
          }
        }

        //setup entry for event triggered frames
        for (const eventFrameName in db.eventTriggeredFrames) {
          const eventFrame = db.eventTriggeredFrames[eventFrameName]
          // Check if any associated frame is published by this node
          const containsPublishedFrame = eventFrame.frameNames.some(
            (fname) => db.frames[fname]?.publishedBy == nodeName
          )

          if (containsPublishedFrame) {
            // Find max frame size among associated frames
            let maxFrameSize = 0
            eventFrame.frameNames.forEach((fname) => {
              const frame = db.frames[fname]
              if (frame && frame.frameSize > maxFrameSize) {
                maxFrameSize = frame.frameSize
              }
            })

            this.setEntry(
              eventFrame.frameId,
              maxFrameSize + 1, // +1 for PID
              LinDirection.SEND,
              LinChecksumType.ENHANCED,
              Buffer.alloc(maxFrameSize + 1),
              2 | 4
            )
          }
        }

        return db
      }
    }
    return undefined
  }

  abstract close(): void
  abstract setEntry(
    frameId: number,
    length: number,
    dir: LinDirection,
    checksumType: LinChecksumType,
    initData: Buffer,
    flag: number
  ): void
  // abstract registerNode(nodeName:string):void
  abstract _write(msg: LinMsg): Promise<number>
  async write(m: LinMsg, opt?: LinWriteOpt): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const item: QueueItem = { resolve, reject, data: m }
      let timer: NodeJS.Timeout | undefined
      if (opt?.timeout) {
        timer = setTimeout(() => {
          reject(new LinError(LIN_ERROR_ID.LIN_BUS_ERROR, m, 'timeout'))
          item.discard = true
        }, opt.timeout)
      }
      if (opt?.fromSch) {
        this.queue.push(item)
      } else {
        if (opt?.diagnostic) {
          if (this.sch == undefined) {
            clearTimeout(timer)
            this.queue.push(item)
          } else {
            if (opt.diagnostic.abort) {
              opt.diagnostic.abort.signal.onabort = () => {
                //remove all uuid same from queue
                this.diagQueue = this.diagQueue.filter((d) => d.msg.uuid != m.uuid)
              }
            }
            this.diagQueue.push({ resolve, reject, msg: m, addr: opt.diagnostic.addr })
          }
        } else {
          if (this.sch) {
            clearTimeout(timer)
            reject(new LinError(LIN_ERROR_ID.LIN_BUS_BUSY, m, 'sch is running'))
          } else {
            this.queue.push({ resolve, reject, data: m })
          }
        }
      }
    })
  }
  registerNode(db: LDF, nodeName: string) {
    //find node
    nodeName = nodeName.split(':')[1]
    const node = this.nodeList.find((n) => n.db.name == db.name && n.nodeName == nodeName)
    if (node) {
      return
    }
    this.nodeList.push({ db, nodeName })
  }
  stopSch() {
    clearTimeout(this.schTimer)
    if (this.sch) {
      this.sch = undefined
    }
  }
  checkEventFramePID(data: number) {
    const id = data & 0x3f
    const pid = getPID(id)
    if (pid != data) {
      return false
    } else {
      return true
    }
  }

  getActiveSchName() {
    return this.schName
  }
  startSch(db: LDF, schName: string, activeMap: Record<string, boolean>, rIndex: number) {
    if (this.info.mode == LinMode.SLAVE) {
      return
    }
    this.schName = schName
    const backUpSchName = schName
    const backUpIndex = rIndex
    clearTimeout(this.schTimer)
    if (this.sch) {
      if (this.sch.activeSchName != schName) {
        this.log.sendEvent(
          `schChanged, changed from ${this.sch.activeSchName} to ${schName} at slot ${rIndex}`,
          getTsUs() - this.startTs
        )
        //判断this.sch.activeSchName是否为diag sch
        let isDiag = false
        if (
          this.sch.activeSchName == '__MasterReqTable' ||
          this.sch.activeSchName == '__SlaveRespTable'
        ) {
          isDiag = true
        }
        for (const s of db.schTables) {
          for (const e of s.entries) {
            if (
              e.name == 'DiagnosticMasterReq' ||
              (e.name == 'DiagnosticSlaveResp' && s.entries.length == 1)
            ) {
              isDiag = true
              break
            }
          }
          if (isDiag) {
            break
          }
        }
        if (!isDiag) {
          this.sch.lastActiveSchName = this.sch.activeSchName
          this.sch.lastActiveIndex = this.sch.activeIndex
        }
      }
    }
    let sch = db.schTables.find((s) => s.name == schName)
    if (sch == undefined) {
      const bytes = 8
      const baseTime = (bytes * 10 + 44) * (1 / db.global.LIN_speed)
      const maxFrameTime = baseTime * 1.4 // 考虑1.4倍的容差
      const getm = Math.ceil(maxFrameTime)
      if (schName == '__MasterReqTable') {
        const stubDiagSch: SchTable = {
          name: '__MasterReqTable',
          entries: [
            {
              delay: getm,
              isCommand: true,
              name: 'DiagnosticMasterReq'
            }
          ]
        }
        sch = stubDiagSch
      } else if (schName == '__SlaveRespTable') {
        const stubDiagSch: SchTable = {
          name: '__SlaveRespTable',
          entries: [
            {
              delay: getm,
              isCommand: true,
              name: 'DiagnosticSlaveResp'
            }
          ]
        }
        sch = stubDiagSch
      }
    }
    const entry = sch?.entries[rIndex]
    let nextDelay = 0

    if (sch && entry) {
      if (activeMap[`${schName}-${rIndex}`] != false) {
        nextDelay = entry.delay
        if (entry.isCommand) {
          // 处理command帧
          const data = Buffer.alloc(8, 0) // 默认8字节数据
          let frameId = 0x3c // Master request frame ID

          switch (entry.name) {
            case 'AssignNAD':
              frameId = 0x3c
              data[0] = 0x06 // PCI
              data[1] = 0xb0 // SID
              break

            case 'ConditionalChangeNAD':
              frameId = 0x3c
              data[0] = 0x06 // PCI
              data[1] = 0xb3 // SID
              break

            case 'DataDump':
              frameId = 0x3c
              data[0] = 0x06 // PCI
              data[1] = 0xb4 // SID
              break

            case 'SaveConfiguration':
              frameId = 0x3c
              data[0] = 0x06 // PCI
              data[1] = 0xb6 // SID
              break

            case 'AssignFrameIdRange':
              frameId = 0x3c
              data[0] = 0x06 // PCI
              data[1] = 0xb7 // SID
              break

            case 'FreeFormat':
              frameId = 0x3c
              data[0] = 0x06 // PCI
              data[1] = 0xb2 // SID
              break

            case 'AssignFrameId':
              frameId = 0x3c
              data[0] = 0x06 // PCI
              data[1] = 0xb1 // SID
              break

            case 'DiagnosticMasterReq':
              frameId = 0x3c
              // 让主机请求帧数据保持为0
              break

            case 'DiagnosticSlaveResp':
              frameId = 0x3d
              // 让从机响应帧数据保持为0
              break
          }
          const lastDiag = this.sch?.diag
          this.write(
            {
              database: db.name,
              frameId: frameId,
              data: this.sch?.diag?.msg.data || data,
              direction: this.sch?.diag?.msg.direction || LinDirection.SEND,
              checksumType: LinChecksumType.CLASSIC,
              name: entry.name
            },
            { fromSch: true, timeout: nextDelay }
          )
            .then((ts) => {
              if (lastDiag) {
                lastDiag.resolve(ts)
              }
            })
            .catch((e) => {
              if (lastDiag) {
                lastDiag.reject(e)
              }
            })
        } else {
          // 处理普通帧和Sporadic帧
          let frame: Frame = db.frames[entry.name]
          let frameId: number | undefined
          let frameData: Buffer | undefined
          let dir = LinDirection.RECV
          let workNode = db.node.master.nodeName
          // uncondition frame
          if (frame) {
            if (frame.publishedBy == db.node.master.nodeName) {
              dir = LinDirection.SEND
            }
            for (const r of this.nodeList) {
              if (r.db.name == db.name && r.nodeName == frame.publishedBy) {
                dir = LinDirection.SEND
                break
              }
            }
          }
          // 检查是否为事件触发帧
          const eventFrame = db.eventTriggeredFrames[entry.name]
          if (eventFrame) {
            dir = LinDirection.RECV
            frameId = eventFrame.frameId
            //sub frame max len
            let maxLen = 0
            eventFrame.frameNames.forEach((subFrameName) => {
              const subFrame = db.frames[subFrameName]
              if (subFrame) {
                if (subFrame.frameSize > maxLen) {
                  maxLen = subFrame.frameSize
                }
              }
            })
            frameData = Buffer.alloc(maxLen + 1)
            let sendCnt = 0
            for (const ff of eventFrame.frameNames) {
              const f = db.frames[ff]
              if (f) {
                for (const r of this.nodeList) {
                  if (r.db.name == db.name && r.nodeName == f.publishedBy) {
                    //check update
                    const hasUpdate = f.signals.some((signal) => {
                      const s = db.signals[signal.name]
                      return s && s.update
                    })
                    //clear update flag

                    if (hasUpdate) {
                      f.signals.forEach((signal) => {
                        const s = db.signals[signal.name]
                        if (s) {
                          s.update = false
                        }
                      })
                      if (sendCnt > 0) {
                        workNode += ',' + r.nodeName
                      } else {
                        workNode = r.nodeName
                      }

                      dir = LinDirection.SEND
                      if (sendCnt > 0) {
                        //two simulate node send, event frame collision
                        const last = frameData[0]
                        const newPID = getPID(f.id)
                        //bit and, 每一个bit AND操作，如果有一个为0，则结果为0，否则为1
                        frameData[0] = last & newPID
                      } else {
                        frameData[0] = getPID(f.id)
                      }
                      sendCnt++
                      const dd = getFrameData(db, f)
                      dd.copy(frameData, 1)
                    }

                    break
                  }
                }
              }
            }
            if (sendCnt > 1) {
              //two simulate node send, event frame collision
            }
          }
          // 如果是Sporadic帧
          else if (!frame && db.sporadicFrames[entry.name]) {
            const sporadicFrame = db.sporadicFrames[entry.name]
            // 获取第一个有更新的frame
            for (const frameName of sporadicFrame.frameNames) {
              const f = db.frames[frameName]
              if (f) {
                // 检查是否有信号更新
                const hasUpdate = f.signals.some((signal) => {
                  const s = db.signals[signal.name]
                  return s && s.update
                })
                if (hasUpdate) {
                  // 清除更新标志
                  f.signals.forEach((signal) => {
                    const s = db.signals[signal.name]
                    if (s) {
                      s.update = false
                    }
                  })
                  frame = f
                  break
                }
              }
            }
          }

          if ((frameId || frame?.id) && (frame || eventFrame)) {
            const data = frameData || getFrameData(db, frame)
            const id = frameId || frame.id
            const checksum =
              id == 0x3 || id == 0x3d ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED

            this.write(
              {
                frameId: id,
                data: data,
                direction: dir,
                checksumType: checksum,
                database: db.name,
                workNode: workNode,
                name: eventFrame ? eventFrame.name : frame.name,
                isEvent: eventFrame ? true : false
              },
              { fromSch: true, timeout: nextDelay }
            ).catch(() => {
              null
            })
          }
        }
      }

      // 设置下一个调度
      let nextIndex = (rIndex + 1) % sch.entries.length

      const checkNext = () => {
        let diag: DiagItem | undefined = undefined
        //sch end, check whether switch to diag sch to back to normal sch
        if (this.sch && nextIndex == 0) {
          let send = true
          if (this.sch?.diag == undefined) {
            //之前是normal sch
            send = true
          } else {
            //之前是diag sch
            if (this.sch.diag.addr.schType == LIN_SCH_TYPE.DIAG_INTERLEAVED) {
              //切换到normal sch
              send = false
            } else {
              //切换到diag sch
              send = true
            }
          }
          if (send) {
            send = false
            //switch diag sch
            if (this.pendingDiagRead.length > 0 || this.diagQueue.length > 0) {
              if (this.pendingDiagRead.length > 0) {
                const p = this.pendingDiagRead[0]
                for (const d of this.diagQueue) {
                  if (d.addr.nad == p.addr.nad && d.msg.frameId == 0x3d) {
                    diag = d
                    break
                  }
                }
                if (diag) {
                  //remove diag from diagQueue
                  const index = this.diagQueue.indexOf(diag)
                  if (index != -1) {
                    this.diagQueue.splice(index, 1)
                  }
                } else {
                  diag = {
                    addr: p.addr,
                    msg: {
                      frameId: 0x3d,
                      data: Buffer.alloc(8, 0),
                      direction: LinDirection.RECV,
                      checksumType: LinChecksumType.CLASSIC
                    },
                    reject: () => {},
                    resolve: (ts: number) => {}
                  }
                }
              } else {
                diag = this.diagQueue.shift()
              }

              if (diag) {
                let found = false
                //find sch table
                if (diag.msg.frameId == 0x3c) {
                  schName = '__MasterReqTable'
                  nextIndex = 0
                  for (const s of db.schTables) {
                    s.entries.forEach((e, i) => {
                      if (e.name == 'DiagnosticMasterReq' && s.entries.length == 1) {
                        schName = s.name
                        nextIndex = i
                        found = true
                      }
                    })
                    if (found) {
                      break
                    }
                  }
                  this.lastNad = diag.addr.nad
                } else if (diag.msg.frameId == 0x3d) {
                  schName = '__SlaveRespTable'
                  nextIndex = 0
                  for (const s of db.schTables) {
                    s.entries.forEach((e, i) => {
                      if (e.name == 'DiagnosticSlaveResp' && s.entries.length == 1) {
                        schName = s.name
                        nextIndex = i
                        found = true
                      }
                    })
                    if (found) {
                      break
                    }
                  }
                }
                send = true
              }
            }
          }

          //diag send, switch to normal sch
          if (
            send == false &&
            this.sch?.diag &&
            this.sch.lastActiveSchName != undefined &&
            this.sch.lastActiveIndex != undefined
          ) {
            schName = this.sch.lastActiveSchName
            sch = db.schTables.find((s) => s.name == schName)
            if (sch) {
              nextIndex = (this.sch.lastActiveIndex + 1) % sch.entries.length
            } else {
              nextIndex = 0
            }
          }
        }
        this.sch = {
          activeSchName: backUpSchName,
          activeIndex: backUpIndex,
          lastActiveSchName: this.sch?.lastActiveSchName,
          lastActiveIndex: this.sch?.lastActiveIndex,
          diag: diag
        }
      }

      this.schTimer = setTimeout(() => {
        if (this.queue.idle()) {
          checkNext()
          this.startSch(db, schName, activeMap, nextIndex)
        } else {
          const q = this.queue.drain()
          q.finally(() => {
            checkNext()
            this.startSch(db, schName, activeMap, nextIndex)
          })
        }
      }, nextDelay)
    }
  }
}
