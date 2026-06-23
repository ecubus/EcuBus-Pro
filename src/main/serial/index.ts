import { SerialPort } from 'serialport'
import EventEmitter from 'events'
import { SerialAddr, SerialBaseInfo } from '../share/serial'

/**
 * Structural logger interface for serial frames. Decoupled from the concrete
 * SerialLOG implementation so the driver does not depend on the log module.
 */
export interface SerialFrameLogger {
  serialBase(data: {
    dir: 'TX' | 'RX'
    data: Buffer
    ts: number
    name: string
    canId?: number
  }): void
}

export enum SERIAL_TP_ERROR_ID {
  TP_BUS_ERROR,
  TP_TIMEOUT_A,
  TP_TIMEOUT_BS,
  TP_TIMEOUT_CR,
  TP_TIMEOUT_UPPER_READ,
  TP_BUS_CLOSED,
  TP_LEN_ERROR,
  TP_INVALID_FS,
  TP_BUFFER_OVERFLOW,
  TP_PARAM_ERROR,
  TP_WRONG_SN
}

const tpErrorMap: Record<SERIAL_TP_ERROR_ID, string> = {
  [SERIAL_TP_ERROR_ID.TP_BUS_ERROR]: 'bus error',
  [SERIAL_TP_ERROR_ID.TP_TIMEOUT_A]: 'N_TIMEOUT_A timeout',
  [SERIAL_TP_ERROR_ID.TP_TIMEOUT_BS]: 'N_TIMEOUT_BS timeout',
  [SERIAL_TP_ERROR_ID.TP_TIMEOUT_CR]: 'N_TIMEOUT_CR timeout',
  [SERIAL_TP_ERROR_ID.TP_TIMEOUT_UPPER_READ]: 'upper layer read timeout',
  [SERIAL_TP_ERROR_ID.TP_BUS_CLOSED]: 'bus closed',
  [SERIAL_TP_ERROR_ID.TP_LEN_ERROR]: 'data length error',
  [SERIAL_TP_ERROR_ID.TP_INVALID_FS]: 'invalid flow status',
  [SERIAL_TP_ERROR_ID.TP_BUFFER_OVERFLOW]: 'buffer overflow',
  [SERIAL_TP_ERROR_ID.TP_PARAM_ERROR]: 'param error',
  [SERIAL_TP_ERROR_ID.TP_WRONG_SN]: 'wrong SN'
}

export class TpError extends Error {
  errorId: SERIAL_TP_ERROR_ID
  addr: SerialAddr
  data?: Buffer
  constructor(errorId: SERIAL_TP_ERROR_ID, addr: SerialAddr, data?: Buffer, extMsg?: string) {
    super(tpErrorMap[errorId] + (extMsg ? `, ${extMsg}` : ''))
    this.errorId = errorId
    this.addr = addr
    this.data = data
  }
}

function getTsUs() {
  const hrtime = process.hrtime()
  return hrtime[0] * 1000000 + Math.floor(hrtime[1] / 1000)
}

/**
 * Serial port driver implementing ISO 15765-2 (ISO-TP) over UART.
 *
 * Frame format over the wire:
 *   [LEN_HI][LEN_LO][PDU_BYTES...]
 * where LEN is the number of bytes in the PDU (big-endian uint16).
 *
 * Each ISO-TP PDU (SF/FF/CF/FC) is wrapped in one such serial frame.
 */
export class SERIAL_TP {
  port: SerialPort
  event = new EventEmitter()
  serialLog?: SerialFrameLogger
  private startTs: number
  private recvBuf = Buffer.alloc(0)
  private closed = false
  private abortController = new AbortController()

  // ISO-TP receive state per registered id (keyed by SERIAL_TP_SOCKET recvId)
  private tpStatus: Record<string, number> = {}
  private tpDataBuffer: Record<string, Buffer> = {}
  private tpDataFc: Record<
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
  private addrMap = new Map<string, SerialAddr>()

  constructor(public info: SerialBaseInfo) {
    this.startTs = getTsUs()
    this.port = new SerialPort({
      path: info.device.handle,
      baudRate: info.baudRate,
      dataBits: info.dataBits,
      stopBits: info.stopBits,
      parity: info.parity,
      autoOpen: false
    })
  }

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) {
          reject(new Error(`Serial port open error: ${err.message}`))
          return
        }
        this.port.on('data', (data: Buffer) => {
          this.recvBuf = Buffer.concat([this.recvBuf, data])
          this.parseFrames()
        })
        this.port.on('error', (err) => {
          if (!this.closed) this.event.emit('error', err)
        })
        this.port.on('close', () => {
          if (!this.closed) {
            this.closed = true
            this.event.emit('close')
          }
        })
        resolve()
      })
    })
  }

  private parseFrames() {
    // Fixed 13-byte CAN-over-UART frame: [4B CAN ID BE][1B DLC][8B data padded]
    const FRAME_SIZE = 13
    while (this.recvBuf.length >= FRAME_SIZE) {
      const canId = this.recvBuf.readUInt32BE(0) & 0x1fffffff
      const dlc = Math.min(this.recvBuf[4] & 0x0f, 8)
      const data = Buffer.from(this.recvBuf.subarray(5, 5 + dlc))
      this.recvBuf = this.recvBuf.subarray(FRAME_SIZE)
      const ts = getTsUs() - this.startTs
      this.serialLog?.serialBase({ dir: 'RX', data, ts, name: '', canId })
      this.handleIncomingFrame(data, ts)
    }
  }

  private async sendFrame(pdu: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      const frame = Buffer.alloc(2 + pdu.length)
      frame.writeUInt16BE(pdu.length, 0)
      pdu.copy(frame, 2)
      this.port.write(frame, (err) => {
        if (err) {
          reject(new TpError(SERIAL_TP_ERROR_ID.TP_BUS_ERROR, {} as SerialAddr, pdu, err.message))
        } else {
          resolve(getTsUs() - this.startTs)
        }
      })
    })
  }

  private async sendFC(
    addr: SerialAddr,
    fs: number
  ): Promise<{ ts: number; bs: number; stMin: number }> {
    const stMin = addr.stMin > 127 ? 127 : addr.stMin
    const bs = addr.bs
    const raw = Buffer.from([0x30 | (fs & 0xf), bs, stMin])
    const pdu = this.applyPadding(raw, addr, 3)
    const timer = setTimeout(() => {}, addr.nAr)
    try {
      const ts = await this.sendFrame(pdu)
      clearTimeout(timer)
      return { ts, bs, stMin }
    } catch (e) {
      clearTimeout(timer)
      throw e
    }
  }

  private applyPadding(pdu: Buffer, addr: SerialAddr, minLen: number): Buffer {
    if (addr.padding && pdu.length < addr.maxFrameSize) {
      const padded = Buffer.alloc(addr.maxFrameSize).fill(addr.paddingValue)
      pdu.copy(padded)
      return padded
    }
    return pdu
  }

  private async waitForFC(addr: SerialAddr, nBs: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.event.off('fc-frame', handler)
        reject(new TpError(SERIAL_TP_ERROR_ID.TP_TIMEOUT_BS, addr))
      }, nBs)

      const handler = (pdu: Buffer) => {
        clearTimeout(timer)
        resolve(pdu)
      }
      this.event.once('fc-frame', handler)

      this.abortController.signal.addEventListener('abort', () => {
        clearTimeout(timer)
        this.event.off('fc-frame', handler)
        reject(new TpError(SERIAL_TP_ERROR_ID.TP_BUS_CLOSED, addr))
      })
    })
  }

  getReadId(addr: SerialAddr): string {
    return `serial-tp-${addr.name}`
  }

  registerAddr(id: string, addr: SerialAddr) {
    this.addrMap.set(id, addr)
    if (this.tpStatus[id] === undefined) {
      this.tpStatus[id] = 0
    }
  }

  unregisterAddr(id: string) {
    this.addrMap.delete(id)
    delete this.tpStatus[id]
    delete this.tpDataBuffer[id]
    if (this.tpDataFc[id]?.crTimer) clearTimeout(this.tpDataFc[id].crTimer)
    delete this.tpDataFc[id]
  }

  handleIncomingFrame(pdu: Buffer, ts: number) {
    if (pdu.length === 0) return
    const pciType = (pdu[0] & 0xf0) >> 4

    if (pciType === 3) {
      // FC: consumed by the pending writeTp multi-frame send
      this.event.emit('fc-frame', pdu, ts)
      return
    }

    // Dispatch to all registered sockets
    for (const id of Object.keys(this.tpStatus)) {
      this.processIncomingPdu(id, pdu, ts)
    }
  }

  private processIncomingPdu(id: string, pdu: Buffer, ts: number) {
    const status = this.tpStatus[id] ?? 0
    const pciType = (pdu[0] & 0xf0) >> 4

    if (status === 0) {
      if (pciType === 0) {
        // SF
        const len = pdu[0] & 0xf
        if (len === 0 || len > pdu.length - 1) return
        this.event.emit(id, { data: pdu.subarray(1, 1 + len), ts })
      } else if (pciType === 1) {
        // FF
        if (pdu.length < 2) return
        const len = ((pdu[0] & 0xf) << 8) | pdu[1]
        if (len < 7) return
        const payload = pdu.subarray(2)
        this.tpDataBuffer[id] = Buffer.from(payload)
        this.tpStatus[id] = 2

        const addr = this.addrMap.get(id) ?? this.getDefaultAddr()
        const nbrTimer = setTimeout(async () => {
          try {
            const fcResult = await this.sendFC(addr, 0)
            this.tpStatus[id] = 1
            this.tpDataFc[id] = {
              ts: fcResult.ts,
              bs: fcResult.bs,
              stMin: fcResult.stMin,
              bc: 1,
              leftLen: len - payload.length,
              curBs: 0,
              crTimer: setTimeout(() => {
                this.event.emit(id, new TpError(SERIAL_TP_ERROR_ID.TP_TIMEOUT_CR, addr))
                delete this.tpDataBuffer[id]
                this.tpStatus[id] = 0
                delete this.tpDataFc[id]
              }, addr.nCr)
            }
          } catch (e: any) {
            if (e instanceof TpError) this.event.emit(id, e)
            delete this.tpDataBuffer[id]
            this.tpStatus[id] = 0
            delete this.tpDataFc[id]
          }
        }, addr.nBr ?? 0)
        this.abortController.signal.addEventListener('abort', () => clearTimeout(nbrTimer))
      }
    } else if (status === 1) {
      if (pciType !== 2) return
      const fc = this.tpDataFc[id]
      if (!fc) return
      const addr = this.addrMap.get(id) ?? this.getDefaultAddr()
      const expectedSn = fc.bc & 0xf
      const receivedSn = pdu[0] & 0xf
      if (fc.crTimer) clearTimeout(fc.crTimer)

      if (receivedSn !== expectedSn) {
        this.event.emit(id, new TpError(SERIAL_TP_ERROR_ID.TP_WRONG_SN, addr, pdu))
        delete this.tpDataBuffer[id]
        this.tpStatus[id] = 0
        delete this.tpDataFc[id]
        return
      }

      const cfData = pdu.subarray(1)
      const leftLen = fc.leftLen

      if (cfData.length >= leftLen) {
        const finalData = Buffer.concat([this.tpDataBuffer[id], cfData.subarray(0, leftLen)])
        this.event.emit(id, { data: finalData, ts })
        delete this.tpDataBuffer[id]
        this.tpStatus[id] = 0
        delete this.tpDataFc[id]
      } else {
        this.tpDataBuffer[id] = Buffer.concat([this.tpDataBuffer[id], cfData])
        fc.leftLen -= cfData.length

        if (fc.bs !== 0) {
          fc.curBs++
          if (fc.curBs >= fc.bs) {
            fc.curBs = 0
            this.tpStatus[id] = 2
            this.sendFC(addr, 0)
              .then((val) => {
                this.tpStatus[id] = 1
                fc.stMin = val.stMin
                fc.bs = val.bs
                fc.crTimer = setTimeout(() => {
                  this.event.emit(id, new TpError(SERIAL_TP_ERROR_ID.TP_TIMEOUT_CR, addr))
                  delete this.tpDataBuffer[id]
                  this.tpStatus[id] = 0
                  delete this.tpDataFc[id]
                }, addr.nCr)
              })
              .catch((e: any) => {
                if (e instanceof TpError) this.event.emit(id, e)
                delete this.tpDataBuffer[id]
                this.tpStatus[id] = 0
                delete this.tpDataFc[id]
              })
            return
          }
        }

        fc.bc++
        if (fc.bc === 0x10) fc.bc = 0
        fc.crTimer = setTimeout(() => {
          this.event.emit(id, new TpError(SERIAL_TP_ERROR_ID.TP_TIMEOUT_CR, addr))
          delete this.tpDataBuffer[id]
          this.tpStatus[id] = 0
          delete this.tpDataFc[id]
        }, addr.nCr)
      }
    }
  }

  private getDefaultAddr(): SerialAddr {
    return {
      name: 'default',
      nAs: 1000,
      nAr: 1000,
      nBs: 1000,
      nBr: 0,
      nCs: 0,
      nCr: 1000,
      stMin: 0,
      bs: 0,
      maxWTF: 0,
      padding: false,
      paddingValue: 0xcc,
      maxFrameSize: 7
    }
  }

  async writeTp(addr: SerialAddr, data: Buffer): Promise<number> {
    if (this.closed) throw new TpError(SERIAL_TP_ERROR_ID.TP_BUS_CLOSED, addr)
    if (data.length === 0 || data.length > 4095) {
      throw new TpError(SERIAL_TP_ERROR_ID.TP_PARAM_ERROR, addr, data, 'data length error')
    }

    const maxPayload = Math.min(addr.maxFrameSize, 7)
    const sfLimit = maxPayload - 1

    if (data.length <= sfLimit) {
      const pdu = this.applyPadding(
        Buffer.concat([Buffer.from([data.length & 0xf]), data]),
        addr,
        2
      )
      return this.sendFrame(pdu)
    }

    // Multi-frame
    const ffPayloadLen = maxPayload - 2
    const pciHi = 0x10 | ((data.length >> 8) & 0xf)
    const pciLo = data.length & 0xff
    const ffPdu = this.applyPadding(
      Buffer.concat([Buffer.from([pciHi, pciLo]), data.subarray(0, ffPayloadLen)]),
      addr,
      2 + ffPayloadLen
    )
    const ffTs = await this.sendFrame(ffPdu)

    let sendLen = ffPayloadLen
    let sn = 1
    let sessionBs = 0
    let sessionStMin = 0
    let sessionCurBs = 0
    let waitFC = true

    while (sendLen < data.length) {
      if (waitFC) {
        const fcPdu = await this.waitForFC(addr, addr.nBs)
        if (fcPdu.length < 3 || (fcPdu[0] & 0xf0) !== 0x30) {
          throw new TpError(SERIAL_TP_ERROR_ID.TP_INVALID_FS, addr, fcPdu, 'expected FC frame')
        }
        const fs = fcPdu[0] & 0x0f
        sessionBs = fcPdu[1]
        let stMin = fcPdu[2]
        if ((stMin >= 0x80 && stMin <= 0xf0) || stMin > 0xfa) {
          stMin = 127
        } else if (stMin >= 0xf1 && stMin <= 0xf9) {
          stMin = 1
        }
        sessionStMin = Math.max(stMin, addr.nCs ?? 0)
        sessionCurBs = 0

        if (fs === 0) {
          waitFC = false
        } else if (fs === 1) {
          if (addr.maxWTF === 0) {
            throw new TpError(SERIAL_TP_ERROR_ID.TP_INVALID_FS, addr, fcPdu, 'WFT not supported')
          }
          continue
        } else if (fs === 2) {
          throw new TpError(SERIAL_TP_ERROR_ID.TP_BUFFER_OVERFLOW, addr, fcPdu)
        } else {
          throw new TpError(SERIAL_TP_ERROR_ID.TP_INVALID_FS, addr, fcPdu, `received fs:${fs}`)
        }
      }

      if (sessionStMin > 0) {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, sessionStMin)
          this.abortController.signal.addEventListener('abort', () => {
            clearTimeout(t)
            reject(new TpError(SERIAL_TP_ERROR_ID.TP_BUS_CLOSED, addr))
          })
        })
      }

      const cfPayloadLen = maxPayload - 1
      const cfSlice = data.subarray(sendLen, sendLen + cfPayloadLen)
      const cfPdu = this.applyPadding(
        Buffer.concat([Buffer.from([0x20 | (sn & 0xf)]), cfSlice]),
        addr,
        1 + cfSlice.length
      )
      await this.sendFrame(cfPdu)
      sendLen += cfSlice.length
      sn = (sn + 1) & 0xf
      if (sn === 0) sn = 1

      if (sessionBs !== 0) {
        sessionCurBs++
        if (sessionCurBs >= sessionBs) {
          waitFC = true
          sessionCurBs = 0
        }
      }
    }

    return ffTs
  }

  async sendRaw(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.write(data, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async sendCanFrame(canId: number, data: Buffer): Promise<void> {
    const frame = Buffer.alloc(13, 0x00)
    frame.writeUInt32BE(canId & 0x1fffffff, 0)
    const dlc = Math.min(data.length, 8)
    frame[4] = dlc
    data.copy(frame, 5, 0, dlc)
    return new Promise((resolve, reject) => {
      this.port.write(frame, (err) => {
        if (err) {
          reject(err)
        } else {
          const ts = getTsUs() - this.startTs
          this.serialLog?.serialBase({
            dir: 'TX',
            data: data.subarray(0, dlc),
            ts,
            name: '',
            canId
          })
          resolve()
        }
      })
    })
  }

  close() {
    this.closed = true
    this.abortController.abort()
    for (const id of Object.keys(this.tpDataFc)) {
      if (this.tpDataFc[id]?.crTimer) clearTimeout(this.tpDataFc[id].crTimer)
    }
    this.event.removeAllListeners()
    if (this.port.isOpen) {
      this.port.close()
    }
  }
}

export class SERIAL_TP_SOCKET {
  closed = false
  recvBuffer: ({ data: Buffer; ts: number } | TpError)[] = []
  recvTimer: NodeJS.Timeout | undefined = undefined
  cb: (val: { data: Buffer; ts: number } | TpError) => void
  abortController = new AbortController()
  pendingRecv: {
    resolve: (value: { data: Buffer; ts: number }) => void
    reject: (reason: TpError) => void
  } | null = null
  readonly recvId: string

  constructor(
    private tp: SERIAL_TP,
    private addr: SerialAddr
  ) {
    this.recvId = tp.getReadId(addr)
    tp.registerAddr(this.recvId, addr)
    this.cb = this.recvHandle.bind(this)
    tp.event.on(this.recvId, this.cb)
  }

  private recvHandle(val: { data: Buffer; ts: number } | TpError) {
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

  clear() {
    this.recvBuffer = []
  }

  async read(timeout: number): Promise<{ data: Buffer; ts: number }> {
    return new Promise((resolve, reject) => {
      if (this.closed) {
        reject(new TpError(SERIAL_TP_ERROR_ID.TP_BUS_CLOSED, this.addr))
        return
      }
      this.abortController.signal.addEventListener('abort', () => {
        reject(new TpError(SERIAL_TP_ERROR_ID.TP_BUS_CLOSED, this.addr))
        this.pendingRecv = null
        if (this.recvTimer) clearTimeout(this.recvTimer)
      })
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
            reject(new TpError(SERIAL_TP_ERROR_ID.TP_TIMEOUT_UPPER_READ, this.addr))
            this.pendingRecv = null
          }
        }, timeout)
      }
    })
  }

  async write(data: Buffer): Promise<number> {
    if (this.closed) throw new TpError(SERIAL_TP_ERROR_ID.TP_BUS_CLOSED, this.addr)
    return this.tp.writeTp(this.addr, data)
  }

  close() {
    if (this.pendingRecv) {
      this.pendingRecv.reject(new TpError(SERIAL_TP_ERROR_ID.TP_BUS_CLOSED, this.addr))
      this.pendingRecv = null
    }
    if (this.recvTimer) {
      clearTimeout(this.recvTimer)
      this.recvTimer = undefined
    }
    this.tp.event.off(this.recvId, this.cb)
    this.tp.unregisterAddr(this.recvId)
    this.abortController.abort()
    this.closed = true
  }
}
