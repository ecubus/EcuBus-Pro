import EventEmitter, { getEventListeners } from 'events'
import {
  addrToId,
  addrToStr,
  CAN_ADDR_FORMAT,
  CAN_ERROR_ID,
  CanAddr,
  CanError,
  swapAddr,
  getLenByDlc,
  getDlcByLen,
  CAN_ADDR_TYPE,
  CanMessage
} from '../share/can'
import { queue, QueueObject } from 'async'
import { CAN_SOCKET, CanBase } from './base'
import { v4 } from 'uuid'
import { i } from 'vite/dist/node/types.d-aGj9QkWt'
export interface CanTp {
  close: () => void
  writeTp(addr: CanAddr, data: Buffer): Promise<number>
  getReadId(addr: CanAddr): string
  setOption(cmd: string, val: any): void
  event: EventEmitter
}

export enum TP_ERROR_ID {
  TP_BUS_ERROR,
  TP_TIMEOUT_A,
  TP_TIMEOUT_BS,
  TP_TIMEOUT_CR,
  TP_TIMEOUT_UPPER_READ,
  TP_BUS_CLOSED,
  TP_LEN_ERROR,
  TP_INVALID_FS,
  TP_BUFFER_OVERFLOW,
  TP_INTERNAL_ERROR,
  TP_PARAM_ERROR,
  TP_WRONG_SN,
  TP_BUS_BUSY
}

const tpErrorMap: Record<TP_ERROR_ID, string> = {
  [TP_ERROR_ID.TP_BUS_ERROR]: 'bus error',
  [TP_ERROR_ID.TP_TIMEOUT_A]: 'N_TIMEOUT_A timeout',
  [TP_ERROR_ID.TP_TIMEOUT_BS]: 'N_TIMEOUT_BS timeout',
  [TP_ERROR_ID.TP_TIMEOUT_CR]: 'N_TIMEOUT_CR timeout',
  [TP_ERROR_ID.TP_TIMEOUT_UPPER_READ]: 'upper layer read timeout',
  [TP_ERROR_ID.TP_BUS_CLOSED]: 'bus closed',
  [TP_ERROR_ID.TP_LEN_ERROR]: 'data length error',
  [TP_ERROR_ID.TP_INVALID_FS]: 'invalid flow status',
  [TP_ERROR_ID.TP_BUFFER_OVERFLOW]: 'buffer overflow',
  [TP_ERROR_ID.TP_INTERNAL_ERROR]: 'dll lib internal error',
  [TP_ERROR_ID.TP_BUS_BUSY]: 'tp layer bus busy',
  [TP_ERROR_ID.TP_WRONG_SN]: 'wrong SN',
  [TP_ERROR_ID.TP_PARAM_ERROR]: 'param error'
}

export class TpError extends Error {
  errorId: TP_ERROR_ID
  addr: CanAddr
  data?: Buffer
  constructor(errorId: TP_ERROR_ID, addr: CanAddr, data?: Buffer, extMsg?: string) {
    super(tpErrorMap[errorId] + (extMsg ? `, ${extMsg}` : ''))
    this.errorId = errorId
    this.addr = addr
    this.data = data
  }
}
export class CAN_TP_SOCKET {
  inst: CanTp
  addr: CanAddr

  closed = false
  recvId: string
  recvBuffer: ({ data: Buffer; ts: number } | TpError)[] = []
  recvTimer: NodeJS.Timeout | undefined = undefined
  cb: any
  abortController = new AbortController()
  pendingRecv: {
    resolve: (value: { data: Buffer; ts: number }) => void
    reject: (reason: TpError) => void
  } | null = null
  constructor(inst: CanTp, addr: CanAddr) {
    this.inst = inst
    this.addr = addr
    this.recvId = this.inst.getReadId(swapAddr(addr))
    this.cb = this.recvHandle.bind(this)
    this.inst.event.on(this.recvId, this.cb)
  }
  recvHandle(val: { data: Buffer; ts: number } | TpError) {
    if (this.pendingRecv) {
      if (this.recvTimer) {
        clearTimeout(this.recvTimer)
        this.recvTimer = undefined
      }
      if (val instanceof TpError) {
        this.pendingRecv.reject(val)
      } else {
        this.pendingRecv.resolve(val)
      }
      this.pendingRecv = null
    } else {
      this.recvBuffer.push(val)
    }
  }
  error(id: TP_ERROR_ID) {
    return new TpError(id, this.addr)
  }
  async read(timeout: number): Promise<{ data: Buffer; ts: number }> {
    return new Promise((resolve, reject) => {
      if (this.closed) {
        reject(this.error(TP_ERROR_ID.TP_BUS_CLOSED))
        return
      }
      this.abortController.signal.onabort = () => {
        reject(this.error(TP_ERROR_ID.TP_BUS_CLOSED))
        this.pendingRecv = null
        clearTimeout(this.recvTimer)
      }
      const val = this.recvBuffer.shift()
      if (val) {
        if (val instanceof TpError) {
          reject(val)
        } else {
          resolve(val)
        }
      } else {
        this.pendingRecv = { resolve, reject }
        this.recvTimer = setTimeout(() => {
          if (this.pendingRecv) {
            reject(this.error(TP_ERROR_ID.TP_TIMEOUT_UPPER_READ))
            this.pendingRecv = null
          }
        }, timeout)
      }
    })
  }
  async write(data: Buffer): Promise<number> {
    if (this.closed) {
      throw this.error(TP_ERROR_ID.TP_BUS_CLOSED)
    }
    return this.inst.writeTp(this.addr, data)
  }
  close() {
    if (this.pendingRecv) {
      this.pendingRecv.reject(this.error(TP_ERROR_ID.TP_BUS_CLOSED))
    }
    this.inst.event.off(this.recvId, this.cb)
    this.abortController.abort()
    this.closed = true
  }
}

export class CAN_TP implements CanTp {
  uuid: string
  base: CanBase
  cnt = 0
  event = new EventEmitter()
  rejectMap = new Map<number, Function>()
  rxBaseHandleExist = new Map<string, any>()
  abortAllController = new AbortController()
  tpStatus: Record<string, number> = {}
  tpDataBuffer: Record<string, Buffer> = {}
  tpDataFc: Record<
    string,
    {
      ts: number
      bs: number
      stMin: number
      bc: number
      leftLen: number
      curBs: number
      crTimer?: NodeJS.Timeout
    }
  > = {}
  lastWriteError?: TpError
  constructor(base: CanBase, uuid?: string) {
    this.base = base
    this.uuid = uuid || v4()
    //close peak tp default handle

    this.tpStatus = {}
    this.tpDataBuffer = {}
    this.tpDataFc = {}
  }
  close(closeBase = true) {
    this.event.removeAllListeners()
    if (closeBase) {
      this.base.close()
    }
    this.abortAllController.abort()
    for (const cb of this.rxBaseHandleExist) {
      this.event.emit(cb[0], new TpError(TP_ERROR_ID.TP_BUS_CLOSED, cb[1].addr))
      this.base.event.off(cb[1].baseId, cb[1].cb)
    }
  }
  setOption(cmd: string, val: any): any {
    return this.base.setOption(cmd, val)
  }

  isSingleFrame(addr: CanAddr, data: Buffer) {
    let lenLimit = 7
    if (addr.addrFormat == CAN_ADDR_FORMAT.EXTENDED || addr.addrFormat == CAN_ADDR_FORMAT.MIXED) {
      lenLimit -= 1
    }
    if (data.length <= lenLimit) {
      return true
    } else {
      if (this.base.info.canfd) {
        let lenLimit = getLenByDlc(addr.dlc, addr.canfd) - 2
        if (
          addr.addrFormat == CAN_ADDR_FORMAT.EXTENDED ||
          addr.addrFormat == CAN_ADDR_FORMAT.MIXED
        ) {
          lenLimit -= 1
        }
        return data.length <= lenLimit
      } else {
        return false
      }
    }
  }
  getSendData(pci: Buffer, addr: CanAddr, data: Buffer) {
    const maxLen = getLenByDlc(addr.dlc, addr.canfd)
    const allLen = pci.length + data.length
    let usedLen = 0
    if (allLen > maxLen) {
      usedLen = maxLen - pci.length
    } else {
      usedLen = data.length
    }
    if (usedLen > 0) {
      let sendData = Buffer.concat([pci, data.subarray(0, usedLen)])
      let newLen = sendData.length
      if (sendData.length < 8 && addr.padding) {
        newLen = 8
      }
      if (addr.canfd && sendData.length < maxLen) {
        if (sendData.length > 8 && sendData.length <= 12) {
          newLen = 12
        } else if (sendData.length > 12 && sendData.length <= 16) {
          newLen = 16
        } else if (sendData.length > 16 && sendData.length <= 20) {
          newLen = 20
        } else if (sendData.length > 20 && sendData.length <= 24) {
          newLen = 24
        } else if (sendData.length > 24 && sendData.length <= 32) {
          newLen = 32
        } else if (sendData.length > 32 && sendData.length <= 48) {
          newLen = 48
        } else if (sendData.length > 48) {
          newLen = 64
        }
      }
      if (sendData.length < newLen) {
        sendData = Buffer.concat([
          sendData,
          Buffer.alloc(newLen - sendData.length).fill(Number(addr.paddingValue))
        ])
      }
      return { sendData, usedLen }
    } else {
      throw new TpError(TP_ERROR_ID.TP_LEN_ERROR, addr, data)
    }
  }
  async sendCanFrame(addr: CanAddr, data: Buffer) {
    return new Promise<{ ts: number }>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TpError(TP_ERROR_ID.TP_TIMEOUT_A, addr, data))
      }, addr.nAs)
      this.base
        .writeBase(
          addrToId(addr),
          {
            ...addr,
            uuid: this.uuid
          },
          data
        )
        .then((ts) => {
          clearTimeout(timer)
          resolve({ ts })
        })
        .catch((err) => {
          clearTimeout(timer)
          reject(new TpError(TP_ERROR_ID.TP_BUS_ERROR, addr, data, err.message))
        })

      this.abortAllController.signal.onabort = () => {
        reject(new TpError(TP_ERROR_ID.TP_BUS_CLOSED, addr))
      }
    })
  }
  async sendFC(addr: CanAddr, fs: number, listenOnly: boolean) {
    return new Promise<{ ts: number; bs: number; stMin: number }>((resolve, reject) => {
      const extAddr = []
      if (addr.addrFormat == CAN_ADDR_FORMAT.EXTENDED || addr.addrFormat == CAN_ADDR_FORMAT.MIXED) {
        if (addr.addrFormat == CAN_ADDR_FORMAT.EXTENDED) {
          extAddr.push(Number(addr.TA))
        } else {
          extAddr.push(Number(addr.AE))
        }
      }
      let stMin = addr.stMin
      if (stMin > 127) {
        stMin = 127
      }
      const bs = addr.bs
      if (listenOnly) {
        resolve({
          ts: 0,
          bs,
          stMin
        })
        return
      }
      const sendData = Buffer.from([...extAddr, 0x30 | (fs & 0xf), bs, stMin])
      const maxLen = getLenByDlc(addr.dlc, addr.canfd)
      let padding = addr.padding
      if (maxLen < sendData.length) {
        padding = false
      }
      const paddingData = Buffer.alloc(8).fill(Number(addr.paddingValue))
      //copy senddata to paddingData
      sendData.copy(paddingData, 0, 0, sendData.length)
      const timer = setTimeout(() => {
        reject(new TpError(TP_ERROR_ID.TP_TIMEOUT_A, addr, sendData))
      }, addr.nAr)
      this.base
        .writeBase(addrToId(addr), addr, padding ? paddingData : sendData)
        .then((ts) => {
          clearTimeout(timer)
          resolve({
            ts,
            bs,
            stMin
          })
        })
        .catch((err) => {
          clearTimeout(timer)
          reject(new TpError(TP_ERROR_ID.TP_BUS_ERROR, addr, sendData, err.message))
        })
    })
  }
  async waitFlowControl(socket: CAN_SOCKET, addr: CanAddr, waitTimes = 0, elapseMs = 0) {
    return new Promise<{ stMin: number; bs: number; recvTs: number }>((resolve, reject) => {
      const t1 = Date.now()
      const timeout = addr.nBs - elapseMs
      if (timeout <= 0) {
        socket.close()
        reject(new TpError(TP_ERROR_ID.TP_TIMEOUT_BS, addr))
        return
      }
      this.abortAllController.signal.onabort = () => {
        socket.close()
        reject(new TpError(TP_ERROR_ID.TP_BUS_CLOSED, addr))
      }
      socket
        .read(addr.nBs - elapseMs)
        .then((val) => {
          const t2 = Date.now()
          elapseMs += t2 - t1
          let index = 0
          if (
            addr.addrFormat == CAN_ADDR_FORMAT.EXTENDED ||
            addr.addrFormat == CAN_ADDR_FORMAT.MIXED
          ) {
            if (addr.addrFormat == CAN_ADDR_FORMAT.EXTENDED) {
              if (val.data[index] != Number(addr.SA)) {
                this.waitFlowControl(socket, addr, waitTimes, elapseMs).then(resolve).catch(reject)
                return
              }
            } else {
              if (val.data[index] != Number(addr.AE)) {
                this.waitFlowControl(socket, addr, waitTimes, elapseMs).then(resolve).catch(reject)
                return
              }
            }
            index++
          }
          if (val.data.length >= 3 + index && (val.data[index] & 0xf0) == 0x30) {
            const fs = val.data[index++] & 0x0f
            const bs = val.data[index++]

            let stMin = val.data[index++]
            if ((stMin >= 0x80 && stMin <= 0xf0) || stMin > 0xfa) {
              /*If an FC N_PDU message is received with a reserved STmin parameter value, then the sending network
                    entity shall use the longest STmin v alue s pecified b y t his p art o f I SO 15765 ( 7F16 = 127 ms) instead
                    of the value received from the receiving network entity for the duration of the on-going segmented
                    message transmission.*/
              stMin = 127
            } else if (stMin >= 0xf1 && stMin <= 0xf9) {
              stMin = 1
            }
            if (fs == 0) {
              resolve({ stMin, bs, recvTs: val.ts })
            } else if (fs == 1) {
              const maxWTF = addr.maxWTF
              if (maxWTF == 0) {
                reject(
                  new TpError(
                    TP_ERROR_ID.TP_INVALID_FS,
                    addr,
                    val.data,
                    'N_WFT is zero, no wait flow control'
                  )
                )
              } else {
                if (waitTimes < maxWTF) {
                  this.waitFlowControl(socket, addr, waitTimes + 1, elapseMs)
                    .then(resolve)
                    .catch(reject)
                } else {
                  reject(
                    new TpError(
                      TP_ERROR_ID.TP_TIMEOUT_BS,
                      addr,
                      val.data,
                      `wait flow control times exceed maxWTF ${maxWTF}`
                    )
                  )
                }
              }
            } else if (fs == 2) {
              reject(new TpError(TP_ERROR_ID.TP_BUFFER_OVERFLOW, addr, val.data))
            } else {
              reject(new TpError(TP_ERROR_ID.TP_INVALID_FS, addr, val.data, `received fs:${fs}`))
            }
          } else {
            this.waitFlowControl(socket, addr, waitTimes, elapseMs).then(resolve).catch(reject)
          }
        })
        .catch((err) => {
          socket.close()
          if (err instanceof CanError) {
            if (err.errorId == CAN_ERROR_ID.CAN_READ_TIMEOUT) {
              reject(new TpError(TP_ERROR_ID.TP_TIMEOUT_BS, addr))
            } else if (err.errorId == CAN_ERROR_ID.CAN_BUS_CLOSED) {
              reject(new TpError(TP_ERROR_ID.TP_BUS_CLOSED, addr))
            } else {
              reject(new TpError(TP_ERROR_ID.TP_BUS_ERROR, addr, err.data, err.message))
            }
          } else {
            reject(err)
          }
        })
    })
  }
  async delay(ms: number, addr: CanAddr): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms)
      this.abortAllController.signal.onabort = () => {
        clearTimeout(timer)
        reject(new TpError(TP_ERROR_ID.TP_BUS_CLOSED, addr))
      }
    })
  }
  async writeTp(addr: CanAddr, data: Buffer) {
    this.lastWriteError = undefined
    if (data.length == 0 || data.length > 4095) {
      throw new TpError(TP_ERROR_ID.TP_PARAM_ERROR, addr, data, 'data length error')
    }
    const prefixBuffer = []
    if (addr.addrFormat == CAN_ADDR_FORMAT.EXTENDED || addr.addrFormat == CAN_ADDR_FORMAT.MIXED) {
      if (addr.addrFormat == CAN_ADDR_FORMAT.EXTENDED) {
        prefixBuffer.push(Number(addr.TA))
      } else {
        prefixBuffer.push(Number(addr.AE))
      }
    }
    this.setOption('stopTesterPresent', addr)
    try {
      if (this.isSingleFrame(addr, data)) {
        let lenLimit = 7
        if (
          addr.addrFormat == CAN_ADDR_FORMAT.EXTENDED ||
          addr.addrFormat == CAN_ADDR_FORMAT.MIXED
        ) {
          lenLimit -= 1
        }
        let pci

        if (data.length > lenLimit) {
          pci = Buffer.from([...prefixBuffer, 0, data.length])
        } else {
          pci = Buffer.from([...prefixBuffer, data.length])
        }
        const { sendData } = this.getSendData(pci, addr, data)
        const { ts } = await this.sendCanFrame(addr, sendData)
        this.setOption('startTesterPresent', addr)
        return ts
      } else {
        if (addr.addrType == CAN_ADDR_TYPE.FUNCTIONAL) {
          throw new TpError(
            TP_ERROR_ID.TP_PARAM_ERROR,
            addr,
            data,
            'functional address not support multi frame'
          )
        }
        let waitFlowControl = true
        let sn = 1
        let sendLen = 0
        let sessionBs = 0
        let sessionStMin = 0
        let sessionCurBs = 0
        let lastFrameSentTs = 0
        const pci = Buffer.from([
          ...prefixBuffer,
          0x10 | (Math.floor(data.length / 256) & 0xf),
          data.length % 256
        ])
        //ff
        const { sendData, usedLen } = this.getSendData(pci, addr, data)
        const { ts } = await this.sendCanFrame(addr, sendData)
        lastFrameSentTs = ts
        sendLen = usedLen
        const recvId = addrToId(swapAddr(addr))
        const socket = new CAN_SOCKET(this.base, recvId, addr)
        while (sendLen < data.length) {
          if (this.lastWriteError) {
            socket.close()
            throw this.lastWriteError
          }
          if (waitFlowControl) {
            try {
              const { stMin, bs, recvTs } = await this.waitFlowControl(socket, addr)
              if (recvTs < lastFrameSentTs) {
                throw new TpError(
                  TP_ERROR_ID.TP_INTERNAL_ERROR,
                  addr,
                  data,
                  `received flow control ts(${recvTs}) less than last frame sent ts${lastFrameSentTs}`
                )
              }

              sessionBs = bs
              sessionStMin = Math.max(stMin, addr.nCs || 0)
              sessionCurBs = 0
              waitFlowControl = false

              await this.delay(sessionStMin, addr)
            } catch (e) {
              socket.close()
              throw e
            }
          }
          const snData = Buffer.from([...prefixBuffer, 0x20 | (sn & 0xf)])
          const { sendData, usedLen } = this.getSendData(snData, addr, data.subarray(sendLen))
          this.sendCanFrame(addr, sendData)
            .then(({ ts }) => {
              lastFrameSentTs = ts
            })
            .catch((e) => {
              this.lastWriteError = e
            })

          sendLen += usedLen

          sn++
          if (sessionStMin > 0) {
            await this.delay(sessionStMin, addr)
          }
          if (sn == 0x10) {
            sn = 0
          }

          if (sessionBs != 0) {
            sessionCurBs++
            if (sessionCurBs >= sessionBs) {
              waitFlowControl = true
              sessionCurBs = 0
            }
          }
        }
        socket.close()
        this.setOption('startTesterPresent', addr)
        return lastFrameSentTs
      }
    } catch (e) {
      this.setOption('startTesterPresent', addr)
      throw e
    }
  }

  getReadId(addr: CanAddr, listenOnly = false): string {
    const id = addrToId(addr)
    const tpIdStr = `tp-${id}-${addrToStr(addr)}`
    if (!this.rxBaseHandleExist.has(tpIdStr)) {
      const cb = baseHandle.bind({ addr, id, inst: this, listenOnly })
      const baseId = this.base.getReadBaseId(id, addr)
      this.rxBaseHandleExist.set(tpIdStr, {
        baseId,
        cb: cb,
        addr: addr
      })
      this.base.event.on(baseId, cb)
    }
    return tpIdStr
  }
  readTp(addr: CanAddr, timeout = 1000) {
    return new Promise<{ data: Buffer; ts: number }>(
      (
        resolve: (value: { data: Buffer; ts: number }) => void,
        reject: (reason: TpError) => void
      ) => {
        const cnt = this.cnt
        this.cnt++
        this.rejectMap.set(cnt, reject)
        const cmdId = this.getReadId(addr)
        const timer = setTimeout(() => {
          if (this.rejectMap.has(cnt)) {
            this.rejectMap.delete(cnt)
            reject(new TpError(TP_ERROR_ID.TP_TIMEOUT_UPPER_READ, addr))
          }
        }, timeout)
        this.event.once(cmdId, (val) => {
          clearTimeout(timer)
          if (this.rejectMap.has(cnt)) {
            if (val instanceof TpError) {
              reject(val)
            } else {
              resolve({ data: val.data, ts: val.ts })
            }
            this.rejectMap.delete(cnt)
          }
        })
      }
    )
  }
}

function baseHandle(val: CanMessage) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  const _this = this as { addr: CanAddr; id: number; inst: CAN_TP; listenOnly: boolean }

  if (val.msgType.uuid == _this.inst.uuid) {
    return
  }
  const tpCmdId = _this.inst.getReadId(_this.addr)

  const status = _this.inst.tpStatus[tpCmdId] || 0
  let index = 0
  if (
    _this.addr.addrFormat == CAN_ADDR_FORMAT.EXTENDED ||
    _this.addr.addrFormat == CAN_ADDR_FORMAT.MIXED
  ) {
    if (_this.addr.addrFormat == CAN_ADDR_FORMAT.EXTENDED) {
      if (val.data[index] != Number(_this.addr.TA)) {
        return
      }
    } else {
      if (val.data[index] != Number(_this.addr.AE)) {
        return
      }
    }
    index++
  }
  const canDl = val.data.length
  // const dlcLen = getLenByDlc(_this.inst.base.info.dlc,_this.addr.canfd)
  if (canDl >= index + 1) {
    const pci = (val.data[index] & 0xf0) >> 4
    if (status == 0) {
      //idle,only SF or FF
      if (pci == 0) {
        //SF
        if (canDl <= 8) {
          const len = val.data[index] & 0xf
          if (len == 0) {
            return
          }
          index++
          if (len > canDl - index) {
            return
          }
          // if (canDl < 8 && _this.addr.padding) {
          //   return
          // }
          if (len > canDl - index) {
            return
          }
          const data = val.data.subarray(index, index + len)
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          //@ts-ignore
          this.inst.event.emit(tpCmdId, {
            data,
            ts: val.ts,
            addr: {
              ..._this.addr,
              uuid: val.msgType.uuid
            }
          })
        } else {
          if (val.data[index] != 0) {
            return
          }
          index++
          const dlc = getDlcByLen(canDl, _this.addr.canfd)
          if (dlc == 0) {
            return
          }
          const minLen = getLenByDlc(dlc - 1, _this.addr.canfd) - index
          const maxLen = getLenByDlc(dlc, _this.addr.canfd) - index - 1

          const len = val.data[index]
          if (len < minLen || len > maxLen) {
            return
          }
          index++

          _this.inst.event.emit(tpCmdId, {
            addr: {
              ..._this.addr,
              uuid: val.msgType.uuid
            },
            data: val.data.subarray(index, index + len),
            ts: val.ts
          })
        }
        delete _this.inst.tpStatus[tpCmdId]
      } else if (pci == 1) {
        //FF
        const canDl = val.data.length

        if (canDl < 8) {
          return
        } else {
          const len = ((val.data[index] & 0xf) << 8) | val.data[index + 1]
          index += 2
          if (len < 7) {
            return
          }
          /* If the network layer receives a FirstFrame with an FF_DL that is less than FF_DLmin, the network layer
shall ignore the received FF N_PDU and not transmit a FC N_PDU.*/
          const dlc = getDlcByLen(canDl, _this.addr.canfd)
          if (dlc == 0) {
            return
          }
          const data = val.data.subarray(index)
          // this.inst.event.emit(tpCmdId,{data,ts:val.ts})
          _this.inst.tpDataBuffer[tpCmdId] = data
          _this.inst.tpStatus[tpCmdId] = 2
          const nbrTImer = setTimeout(() => {
            //write flow control
            _this.inst
              .sendFC(swapAddr(_this.addr), 0, _this.listenOnly)
              .then((val) => {
                _this.inst.tpStatus[tpCmdId] = 1
                _this.inst.tpDataFc[tpCmdId] = {
                  ...val,
                  bc: 1,
                  leftLen: len - data.length,
                  curBs: 0,
                  crTimer: setTimeout(() => {
                    _this.inst.event.emit(
                      tpCmdId,
                      new TpError(TP_ERROR_ID.TP_TIMEOUT_CR, _this.addr)
                    )
                    delete _this.inst.tpDataBuffer[tpCmdId]
                    delete _this.inst.tpStatus[tpCmdId]
                    delete _this.inst.tpDataFc[tpCmdId]
                  }, _this.addr.nCr)
                }
              })
              .catch((e: any) => {
                if (e instanceof TpError) {
                  _this.inst.event.emit(tpCmdId, e)
                }
                delete _this.inst.tpDataFc[tpCmdId]
                delete _this.inst.tpDataBuffer[tpCmdId]
                delete _this.inst.tpStatus[tpCmdId]
              })
          }, _this.addr.nBr || 0)

          _this.inst.abortAllController.signal.onabort = () => {
            clearTimeout(nbrTImer)
            _this.inst.event.emit(tpCmdId, new TpError(TP_ERROR_ID.TP_BUS_CLOSED, _this.addr))
          }
        }
      }
    } else if (status == 1) {
      const fcInfo = _this.inst.tpDataFc[tpCmdId]
      const dlc = getDlcByLen(canDl, _this.addr.canfd)
      if (dlc == 0) {
        return
      }
      if (fcInfo) {
        const needBc = fcInfo.bc
        const curBc = val.data[index] & 0xf
        clearTimeout(fcInfo.crTimer)
        if (curBc != needBc) {
          _this.inst.event.emit(
            tpCmdId,
            new TpError(
              TP_ERROR_ID.TP_WRONG_SN,
              _this.addr,
              val.data,
              `received block counter ${curBc} not equal to need block counter ${needBc}`
            )
          )
          delete _this.inst.tpDataBuffer[tpCmdId]
          delete _this.inst.tpStatus[tpCmdId]
          delete _this.inst.tpDataFc[tpCmdId]
          return
        } else {
          index++
          let data = val.data.subarray(index)
          const leftLen = fcInfo.leftLen
          if (data.length >= leftLen) {
            data = data.subarray(0, leftLen)
            //finish

            _this.inst.event.emit(tpCmdId, {
              addr: {
                ..._this.addr,
                uuid: val.msgType.uuid
              },
              data: Buffer.concat([_this.inst.tpDataBuffer[tpCmdId], data]),
              ts: val.ts
            })
            delete _this.inst.tpDataBuffer[tpCmdId]
            delete _this.inst.tpStatus[tpCmdId]
            delete _this.inst.tpDataFc[tpCmdId]
          } else {
            //continue
            _this.inst.tpDataBuffer[tpCmdId] = Buffer.concat([
              _this.inst.tpDataBuffer[tpCmdId],
              data
            ])
            _this.inst.tpDataFc[tpCmdId].leftLen -= data.length
            if (fcInfo.bs != 0) {
              fcInfo.curBs++

              if (fcInfo.curBs == fcInfo.bs) {
                fcInfo.curBs = 0
                //send flow control
                _this.inst.tpStatus[tpCmdId] = 2
                //TODO:add delay here?
                _this.inst
                  .sendFC(swapAddr(_this.addr), 0, _this.listenOnly)
                  .then((val) => {
                    _this.inst.tpStatus[tpCmdId] = 1
                    fcInfo.stMin = val.stMin
                    fcInfo.bs = val.bs
                    //start cr timer
                    fcInfo.crTimer = setTimeout(() => {
                      _this.inst.event.emit(
                        tpCmdId,
                        new TpError(TP_ERROR_ID.TP_TIMEOUT_CR, _this.addr)
                      )
                      delete _this.inst.tpDataBuffer[tpCmdId]
                      delete _this.inst.tpStatus[tpCmdId]
                      delete _this.inst.tpDataFc[tpCmdId]
                    }, _this.addr.nCr)
                  })
                  .catch((e: any) => {
                    if (e instanceof TpError) {
                      _this.inst.event.emit(tpCmdId, e)
                    }
                    delete _this.inst.tpDataBuffer[tpCmdId]
                    delete _this.inst.tpStatus[tpCmdId]
                    delete _this.inst.tpDataFc[tpCmdId]
                  })
              } else {
                //start cr timer
                fcInfo.crTimer = setTimeout(() => {
                  _this.inst.event.emit(tpCmdId, new TpError(TP_ERROR_ID.TP_TIMEOUT_CR, _this.addr))
                  delete _this.inst.tpDataBuffer[tpCmdId]
                  delete _this.inst.tpStatus[tpCmdId]
                  delete _this.inst.tpDataFc[tpCmdId]
                }, _this.addr.nCr)
              }
            } else {
              fcInfo.crTimer = setTimeout(() => {
                _this.inst.event.emit(tpCmdId, new TpError(TP_ERROR_ID.TP_TIMEOUT_CR, _this.addr))
                delete _this.inst.tpDataBuffer[tpCmdId]
                delete _this.inst.tpStatus[tpCmdId]
                delete _this.inst.tpDataFc[tpCmdId]
              }, _this.addr.nCr)
            }
            //update block counter
            fcInfo.bc++
            if (fcInfo.bc == 0x10) {
              fcInfo.bc = 0
            }
          }
        }
      }
    }
  }
}
