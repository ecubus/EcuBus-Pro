import EventEmitter, { getEventListeners } from 'events'

import { queue, QueueObject } from 'async'
import {
  LIN_ADDR_TYPE,
  LinAddr,
  LinChecksumType,
  LinDirection,
  LinMode,
  LinMsg
} from '../share/lin'
import LinBase from './base'
import { v4 } from 'uuid'
export interface LinTp {
  close: () => void
  writeTp(mode: LinMode, addr: LinAddr, data: Buffer, id?: string): Promise<number>
  getReadId(mode: LinMode, addr: LinAddr): string
  setOption(cmd: string, val: any): void
  readTp(mode: LinMode, addr: LinAddr, timeout?: number): Promise<{ data: Buffer; ts: number }>
  event: EventEmitter
}

export enum LIN_TP_ERROR_ID {
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

const tpErrorMap: Record<LIN_TP_ERROR_ID, string> = {
  [LIN_TP_ERROR_ID.TP_BUS_ERROR]: 'bus error',
  [LIN_TP_ERROR_ID.TP_TIMEOUT_A]: 'N_TIMEOUT_A timeout',
  [LIN_TP_ERROR_ID.TP_TIMEOUT_BS]: 'N_TIMEOUT_BS timeout',
  [LIN_TP_ERROR_ID.TP_TIMEOUT_CR]: 'N_TIMEOUT_CR timeout',
  [LIN_TP_ERROR_ID.TP_TIMEOUT_UPPER_READ]: 'upper layer read timeout',
  [LIN_TP_ERROR_ID.TP_BUS_CLOSED]: 'bus closed',
  [LIN_TP_ERROR_ID.TP_LEN_ERROR]: 'data length error',
  [LIN_TP_ERROR_ID.TP_INVALID_FS]: 'invalid flow status',
  [LIN_TP_ERROR_ID.TP_BUFFER_OVERFLOW]: 'buffer overflow',
  [LIN_TP_ERROR_ID.TP_INTERNAL_ERROR]: 'dll lib internal error',
  [LIN_TP_ERROR_ID.TP_BUS_BUSY]: 'tp layer bus busy',
  [LIN_TP_ERROR_ID.TP_WRONG_SN]: 'wrong SN',
  [LIN_TP_ERROR_ID.TP_PARAM_ERROR]: 'param error'
}

export class TpError extends Error {
  errorId: LIN_TP_ERROR_ID
  addr: LinAddr
  data?: Buffer
  constructor(errorId: LIN_TP_ERROR_ID, addr: LinAddr, data?: Buffer, extMsg?: string) {
    super(tpErrorMap[errorId] + (extMsg ? `, ${extMsg}` : ''))
    this.errorId = errorId
    this.addr = addr
    this.data = data
  }
}

export class LIN_TP_SOCKET {
  inst: LinTp
  addr: LinAddr

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
  constructor(
    inst: LinTp,
    addr: LinAddr,
    public mode: LinMode
  ) {
    this.inst = inst
    this.addr = addr
    //TODO:
    this.recvId = '0'
    this.cb = this.recvHandle.bind(this)
    this.inst.event.on(this.recvId, this.cb)
  }
  clear() {
    this.recvBuffer = []
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
  error(id: LIN_TP_ERROR_ID) {
    return new TpError(id, this.addr)
  }
  async read(timeout: number): Promise<{ data: Buffer; ts: number }> {
    return await this.inst.readTp(this.mode, this.addr, timeout)
  }
  async write(data: Buffer): Promise<number> {
    if (this.closed) {
      throw this.error(LIN_TP_ERROR_ID.TP_BUS_CLOSED)
    }
    return this.inst.writeTp(this.mode, this.addr, data)
  }
  close() {
    if (this.pendingRecv) {
      this.pendingRecv.reject(this.error(LIN_TP_ERROR_ID.TP_BUS_CLOSED))
    }
    this.inst.event.off(this.recvId, this.cb)
    this.abortController.abort()
    this.closed = true
  }
}

export class LIN_TP implements LinTp {
  base: LinBase
  cnt = 0
  event = new EventEmitter()
  rejectMap = new Map<number, Function>()
  rxBaseHandleExist = new Map<string, any>()
  abortAllController = new AbortController()
  tpStatus: Record<string, number> = {}
  tpDataBuffer: Record<string, Buffer> = {}
  tpDataFc: Record<
    string,
    { bc: number; leftLen: number; curBs: number; crTimer?: NodeJS.Timeout }
  > = {}

  constructor(
    base: LinBase,
    private listenOnly = false
  ) {
    this.base = base
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
      this.event.emit(cb[0], new TpError(LIN_TP_ERROR_ID.TP_BUS_CLOSED, cb[1].addr))
      this.base.event.off(cb[1].baseId, cb[1].cb)
    }
  }
  setOption(cmd: string, val: any) {
    return
  }

  isSingleFrame(addr: LinAddr, data: Buffer) {
    const lenLimit = 6

    if (data.length <= lenLimit) {
      return true
    } else {
      return false
    }
  }
  getSendData(pci: Buffer, addr: LinAddr, data: Buffer) {
    const maxLen = 8
    const allLen = pci.length + data.length
    let usedLen = 0
    if (allLen > maxLen) {
      usedLen = maxLen - pci.length
    } else {
      usedLen = data.length
    }
    if (usedLen > 0) {
      let sendData = Buffer.concat([pci, data.subarray(0, usedLen)])
      const newLen = 8

      if (sendData.length < newLen) {
        sendData = Buffer.concat([sendData, Buffer.alloc(newLen - sendData.length).fill(0xff)])
      }
      return { sendData, usedLen }
    } else {
      throw new TpError(LIN_TP_ERROR_ID.TP_LEN_ERROR, addr, data)
    }
  }
  async sendLinFrame(mode: LinMode, addr: LinAddr, data: Buffer, uuid: string) {
    return new Promise<{ ts: number }>((resolve, reject) => {
      const abortController = new AbortController()
      const timer = setTimeout(() => {
        abortController.abort()
        reject(new TpError(LIN_TP_ERROR_ID.TP_TIMEOUT_A, addr, data))
      }, addr.nAs)

      const msg: LinMsg = {
        frameId: mode == LinMode.MASTER ? 0x3c : 0x3d,
        data: data,
        direction: LinDirection.SEND,
        checksumType: LinChecksumType.CLASSIC,
        uuid: uuid
      }

      this.base
        .write(msg, {
          diagnostic: {
            addr: addr,
            abort: abortController
          }
        })
        .then((ts) => {
          clearTimeout(timer)
          resolve({ ts })
        })
        .catch((err) => {
          clearTimeout(timer)
          reject(new TpError(LIN_TP_ERROR_ID.TP_BUS_ERROR, addr, data, err.message))
        })

      this.abortAllController.signal.onabort = () => {
        reject(new TpError(LIN_TP_ERROR_ID.TP_BUS_CLOSED, addr))
      }
    })
  }

  async delay(ms: number, addr: LinAddr): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms)
      this.abortAllController.signal.onabort = () => {
        clearTimeout(timer)
        reject(new TpError(LIN_TP_ERROR_ID.TP_BUS_CLOSED, addr))
      }
    })
  }
  async writeTp(mode: LinMode, addr: LinAddr, data: Buffer, id?: string) {
    if (data.length == 0 || data.length > 4095) {
      throw new TpError(LIN_TP_ERROR_ID.TP_PARAM_ERROR, addr, data, 'data length error')
    }
    const prefixBuffer = [addr.nad]

    if (id == undefined) {
      id = v4()
    }
    if (this.isSingleFrame(addr, data)) {
      const pci = Buffer.from([...prefixBuffer, data.length])

      const { sendData } = this.getSendData(pci, addr, data)
      const { ts } = await this.sendLinFrame(mode, addr, sendData, id)
      return ts
    } else {
      if (addr.addrType == LIN_ADDR_TYPE.FUNCTIONAL) {
        throw new TpError(
          LIN_TP_ERROR_ID.TP_PARAM_ERROR,
          addr,
          data,
          'functional address not support multi frame'
        )
      }
      const sendPList = []

      let sn = 1
      let sendLen = 0

      const pci = Buffer.from([
        ...prefixBuffer,
        0x10 | (Math.floor(data.length / 256) & 0xf),
        data.length % 256
      ])
      //ff
      const { sendData, usedLen } = this.getSendData(pci, addr, data)
      sendPList.push(this.sendLinFrame(mode, addr, sendData, id))

      sendLen = usedLen

      while (sendLen < data.length) {
        const snData = Buffer.from([...prefixBuffer, 0x20 | (sn & 0xf)])
        const { sendData, usedLen } = this.getSendData(snData, addr, data.subarray(sendLen))
        sendPList.push(this.sendLinFrame(mode, addr, sendData, id))
        sendLen += usedLen

        sn++
        // if (addr.stMin > 0) {
        //   await this.delay(addr.stMin, addr)
        // }
        if (sn == 0x10) {
          sn = 0
        }
      }

      const r = await Promise.all(sendPList)
      return r[r.length - 1].ts
    }
  }

  getReadId(mode: LinMode, addr: LinAddr): string {
    const tpIdStr = `tp-${mode == LinMode.MASTER ? '3c' : '3d'}-${addr.nad}`
    if (!this.rxBaseHandleExist.has(tpIdStr)) {
      const cb = baseHandle.bind({ addr, inst: this, mode })
      const baseId = mode == LinMode.MASTER ? 0x3c : 0x3d
      this.rxBaseHandleExist.set(tpIdStr, {
        baseId,
        cb: cb,
        addr: addr
      })
      this.base.event.on(`${baseId}`, cb)
    }
    return tpIdStr
  }
  readTp(mode: LinMode, addr: LinAddr, timeout = 1000) {
    return new Promise<{ data: Buffer; ts: number }>(
      (
        resolve: (value: { data: Buffer; ts: number }) => void,
        reject: (reason: TpError) => void
      ) => {
        let selfStart = false
        if (this.base.sch == undefined && this.base.info.database) {
          //start sch
          const db = global.database.lin[this.base.info.database]
          if (db) {
            let schName = '__SlaveRespTable'
            let nextIndex = 0
            let found = false
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
            selfStart = true
            this.base.startSch(
              db,
              schName,
              {
                DiagnosticSlaveResp: true
              },
              0
            )
          }
        }
        const cnt = this.cnt
        this.cnt++
        this.rejectMap.set(cnt, reject)
        const cmdId = this.getReadId(mode == LinMode.MASTER ? LinMode.SLAVE : LinMode.MASTER, addr)
        this.base.setPendingDiagRead(cnt, mode, addr)
        const timer = setTimeout(() => {
          if (this.rejectMap.has(cnt)) {
            this.rejectMap.delete(cnt)
            reject(new TpError(LIN_TP_ERROR_ID.TP_TIMEOUT_UPPER_READ, addr))
          }
          this.base.clearPendingDiagRead(cnt)
          if (selfStart) {
            this.base.stopSch()
          }
        }, timeout)

        this.event.once(cmdId, (val) => {
          clearTimeout(timer)
          if (this.rejectMap.has(cnt)) {
            this.base.clearPendingDiagRead(cnt)
            if (val instanceof TpError) {
              reject(val)
            } else {
              resolve({ data: val.data, ts: val.ts })
            }
            this.rejectMap.delete(cnt)
            if (selfStart) {
              this.base.stopSch()
            }
          }
        })
      }
    )
  }
}

function baseHandle(val: LinMsg) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  const _this = this as { addr: LinAddr; inst: LIN_TP; mode: LinMode }
  const tpCmdId = _this.inst.getReadId(_this.mode, _this.addr)
  const status = _this.inst.tpStatus[tpCmdId] || 0
  let index = 0

  if (val.data.length != 8) {
    return
  }
  // if (val.frameId != 0x3c && val.frameId != 0x3d) {
  //   return
  // }
  if (_this.addr.nad != val.data[index]) {
    return
  }

  index++

  const pci = (val.data[index] & 0xf0) >> 4
  if (status == 0) {
    //idle,only SF or FF
    if (pci == 0) {
      //SF

      const len = val.data[index] & 0xf
      if (len == 0) {
        return
      }
      index++
      if (len > 8 - index) {
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
          uuid: val.uuid
        }
      })

      delete _this.inst.tpStatus[tpCmdId]
    } else if (pci == 1) {
      //FF
      const len = ((val.data[index] & 0xf) << 8) | val.data[index + 1]
      index += 2
      if (len < 7) {
        return
      }
      const data = val.data.subarray(index)
      // this.inst.event.emit(tpCmdId,{data,ts:val.ts})
      _this.inst.tpDataBuffer[tpCmdId] = data
      _this.inst.tpStatus[tpCmdId] = 1

      _this.inst.tpDataFc[tpCmdId] = {
        bc: 1,
        leftLen: len - data.length,
        curBs: 0,
        crTimer: setTimeout(() => {
          _this.inst.event.emit(tpCmdId, new TpError(LIN_TP_ERROR_ID.TP_TIMEOUT_CR, _this.addr))
          delete _this.inst.tpDataBuffer[tpCmdId]
          delete _this.inst.tpStatus[tpCmdId]
          delete _this.inst.tpDataFc[tpCmdId]
        }, _this.addr.nCr)
      }
      _this.inst.abortAllController.signal.onabort = () => {
        _this.inst.event.emit(tpCmdId, new TpError(LIN_TP_ERROR_ID.TP_BUS_CLOSED, _this.addr))
      }
    }
  } else if (status == 1) {
    const fcInfo = _this.inst.tpDataFc[tpCmdId]

    if (fcInfo) {
      const needBc = fcInfo.bc
      const curBc = val.data[index] & 0xf
      clearTimeout(fcInfo.crTimer)
      if (curBc != needBc) {
        _this.inst.event.emit(
          tpCmdId,
          new TpError(
            LIN_TP_ERROR_ID.TP_WRONG_SN,
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
              uuid: val.uuid
            },
            data: Buffer.concat([_this.inst.tpDataBuffer[tpCmdId], data]),
            ts: val.ts
          })
          delete _this.inst.tpDataBuffer[tpCmdId]
          delete _this.inst.tpStatus[tpCmdId]
          delete _this.inst.tpDataFc[tpCmdId]
        } else {
          //continue
          _this.inst.tpDataBuffer[tpCmdId] = Buffer.concat([_this.inst.tpDataBuffer[tpCmdId], data])
          _this.inst.tpDataFc[tpCmdId].leftLen -= data.length

          fcInfo.crTimer = setTimeout(() => {
            _this.inst.event.emit(tpCmdId, new TpError(LIN_TP_ERROR_ID.TP_TIMEOUT_CR, _this.addr))
            delete _this.inst.tpDataBuffer[tpCmdId]
            delete _this.inst.tpStatus[tpCmdId]
            delete _this.inst.tpDataFc[tpCmdId]
          }, _this.addr.nCr)

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
