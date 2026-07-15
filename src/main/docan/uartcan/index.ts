import { SerialPort } from 'serialport'
import {
  CanBaseInfo,
  CanDevice,
  CanError,
  CAN_ERROR_ID,
  CanMessage,
  CanMsgType,
  CAN_ID_TYPE,
  getTsUs
} from '../../share/can'
import { EventEmitter } from 'events'
import { CanLOG, SerialLOG } from '../../log'
import { CanBase } from '../base'
import type { SerialMessage } from '../../share/serial'

/*
 * UART-CAN: a virtual CAN bus tunneled over a serial (UART) port.
 *
 * Each CAN frame is carried in a fixed 13-byte record, compatible with the
 * SocketCAN `can_frame` layout used by common MCU-side UART↔CAN bridges:
 *
 *   byte 0-3  CAN ID, big-endian uint32
 *             bit31 (0x80000000) = extended (29-bit) frame flag
 *             bit30 (0x40000000) = remote frame flag
 *   byte 4    DLC (0-8)
 *   byte 5-12 data, zero-padded to 8 bytes
 *
 * Example: id=0x7DF, data=03 22 F1 90
 *   → 00 00 07 DF 04 03 22 F1 90 00 00 00 00
 *
 * The receiver re-syncs on a corrupted stream by validating the DLC and the
 * reserved ID bits of every candidate record, and by discarding a stale
 * partial record when the line has been idle longer than RX_IDLE_RESET_MS.
 * The format has no SOF or checksum, so a byte slip while extended-flag-like
 * garbage is in flight can still parse as one bogus frame; the idle-gap reset
 * restores framing on the next quiet period.
 */
const FRAME_SIZE = 13
const ID_FLAG_EXTENDED = 0x80000000
const ID_FLAG_REMOTE = 0x40000000
const ID_FLAG_ERROR = 0x20000000
const RX_IDLE_RESET_MS = 100

export class UARTCAN_CAN extends CanBase {
  id: string
  info: CanBaseInfo
  log: CanLOG
  serialLog: SerialLOG
  event = new EventEmitter()
  private serialPort: SerialPort

  private readAbort = new AbortController()
  private rejectBaseMap = new Map<
    number,
    {
      reject: (reason: CanError) => void
      msgType: CanMsgType
    }
  >()
  private cnt = 0
  private startTime = getTsUs()
  private closed = false
  private rxBuffer = Buffer.alloc(0)
  private lastRxMs = 0

  constructor(baseInfo: CanBaseInfo) {
    super()
    this.info = baseInfo
    this.id = this.info.id
    this.log = new CanLOG('UARTCAN', this.info.name, this.id, this.event)
    this.serialLog = new SerialLOG('uartcan', this.info.name, this.id, this.event)
    this.attachCanMessage(this.busloadCb)

    this.serialPort = new SerialPort({
      path: this.info.handle,
      baudRate: Number(this.info.bitrate.freq) || 115200,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: true
    })

    this.serialPort.on('data', (data: Buffer) => {
      const now = Date.now()
      if (this.rxBuffer.length > 0 && now - this.lastRxMs > RX_IDLE_RESET_MS) {
        // Stale partial record: the line was idle mid-frame, restart framing
        this.rxBuffer = Buffer.alloc(0)
      }
      this.lastRxMs = now
      this.rxBuffer = Buffer.concat([this.rxBuffer, data])
      this.processRxBuffer()
    })

    this.serialPort.on('error', (err) => {
      if (!this.closed) {
        this.log.error(this.getTs(), `Serial port error: ${err.message}`)
        this.event.emit('close', err.message)
      }
    })

    this.serialPort.on('close', () => {
      if (!this.closed) {
        this.log.error(this.getTs(), 'Serial port closed')
        this.event.emit('close', 'Serial port closed')
      }
    })
  }

  static getValidDevices(): Promise<CanDevice[]> {
    return SerialPort.list().then((ports) => {
      return ports.map((port) => {
        const desc = (port as any).friendlyName || port.manufacturer
        return {
          label: desc ? `${port.path} (${desc})` : port.path,
          id: port.path,
          handle: port.path,
          busy: false,
          serialNumber: port.serialNumber
        }
      })
    })
  }

  static getLibVersion(): string {
    return '1.0.0'
  }

  private processRxBuffer(): void {
    while (this.rxBuffer.length >= FRAME_SIZE) {
      const rawId = this.rxBuffer.readUInt32BE(0)
      const dlc = this.rxBuffer[4]
      const extended = (rawId & ID_FLAG_EXTENDED) !== 0
      const remote = (rawId & ID_FLAG_REMOTE) !== 0
      const id = rawId & (extended ? 0x1fffffff : 0x7ff)
      // Sanity check: the ERR flag is never used on this link, a
      // standard-frame record must not use bits above 10, and DLC is limited
      // to 8. Anything else means the byte stream slipped — drop one byte and
      // retry so framing can recover.
      const idValid = (rawId & ID_FLAG_ERROR) === 0 && (extended || (rawId & 0x3ffff800) === 0)
      if (dlc > 8 || !idValid) {
        this.rxBuffer = this.rxBuffer.subarray(1)
        continue
      }
      const frame = this.rxBuffer.subarray(0, FRAME_SIZE)
      this.rxBuffer = this.rxBuffer.subarray(FRAME_SIZE)

      const message: CanMessage = {
        dir: 'IN',
        id: id,
        data: Buffer.from(frame.subarray(5, 5 + dlc)),
        ts: this.getTs(),
        msgType: {
          idType: extended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
          canfd: false,
          brs: false,
          remote: remote
        },
        device: this.info.name,
        database: this.info.database
      }
      this.log.canBase(message)
      this.event.emit(this.getReadBaseId(id, message.msgType), message)
    }
  }

  close(isReset = false, msg?: string) {
    if (this.closed) {
      return
    }
    this.closed = true
    try {
      this.readAbort.abort()
      for (const [, value] of this.rejectBaseMap) {
        value.reject(
          new CanError(
            isReset ? CAN_ERROR_ID.CAN_BUS_ERROR : CAN_ERROR_ID.CAN_BUS_CLOSED,
            value.msgType,
            undefined,
            msg
          )
        )
      }
      this.rejectBaseMap.clear()
      this.log.close()
      this.serialLog.close()
      if (this.serialPort.isOpen) {
        this.serialPort.close()
      }
      this._close()
    } catch (e) {
      // Ignore errors during close
    }
  }

  setOption(option: string, value: any): any {
    return this._setOption(option, value)
  }

  readBase(
    id: number,
    msgType: CanMsgType,
    timeout: number
  ): Promise<{ data: Buffer; ts: number }> {
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
          clearTimeout(timer)
          if (this.rejectBaseMap.has(cnt)) {
            if (val instanceof CanError) {
              reject(val)
            } else {
              resolve({ data: val.data, ts: val.ts })
            }
            this.rejectBaseMap.delete(cnt)
          }
        }
        const timer = setTimeout(() => {
          this.event.off(cmdId, readCb)
          if (this.rejectBaseMap.has(cnt)) {
            this.rejectBaseMap.delete(cnt)
            reject(new CanError(CAN_ERROR_ID.CAN_READ_TIMEOUT, msgType))
          }
        }, timeout)
        this.event.once(cmdId, readCb)
      }
    )
  }

  writeBase(
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    if (msgType.canfd) {
      throw new CanError(
        CAN_ERROR_ID.CAN_PARAM_ERROR,
        msgType,
        data,
        'UART-CAN does not support CAN FD frames'
      )
    }
    if (data.length > 8) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data)
    }
    return new Promise<number>(
      (resolve: (value: number) => void, reject: (reason: CanError) => void) => {
        let rawId = id >>> 0
        if (msgType.idType === CAN_ID_TYPE.EXTENDED) {
          rawId = (rawId & 0x1fffffff) | ID_FLAG_EXTENDED
        } else {
          rawId = rawId & 0x7ff
        }
        if (msgType.remote) {
          rawId |= ID_FLAG_REMOTE
        }
        const frame = Buffer.alloc(FRAME_SIZE)
        frame.writeUInt32BE(rawId >>> 0, 0)
        frame[4] = data.length
        data.copy(frame, 5)

        this.serialPort.write(frame, (err) => {
          if (err) {
            reject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data, err.message))
            return
          }
          const ts = this.getTs()
          const message: CanMessage = {
            dir: 'OUT',
            id: id,
            data: data,
            ts: ts,
            msgType: msgType,
            device: this.info.name,
            database: extra?.database ?? this.info.database,
            name: extra?.name
          }
          this.log.canBase(message)
          this.event.emit(this.getReadBaseId(id, msgType), message)
          resolve(ts)
        })
      }
    )
  }

  /**
   * Write raw bytes to the underlying serial port, exactly as given (no
   * framing added). Used by the serial IA panel where the user hand-crafts
   * complete 13-byte records. Every write is logged as a raw serial OUT
   * message so it is always visible in the trace window.
   */
  writeRaw(data: Buffer): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.serialPort.write(data, (err) => {
        if (err) {
          reject(new Error(`Serial port ${this.info.handle} write error: ${err.message}`))
          return
        }
        const ts = this.getTs()
        const msg: SerialMessage = {
          dir: 'OUT',
          data: Buffer.from(data),
          ts: ts,
          name: this.info.name,
          device: this.info.id
        }
        this.serialLog.serialBase(msg)
        resolve(ts)
      })
    })
  }

  getTs(): number {
    return getTsUs() - this.startTime
  }

  private msgTypeToNumber(msgType: CanMsgType): number {
    let result = 0
    if (msgType.idType === CAN_ID_TYPE.EXTENDED) {
      result |= 0x80000000
    }
    if (msgType.canfd) {
      result |= 0x40000000
    }
    if (msgType.brs) {
      result |= 0x20000000
    }
    if (msgType.remote) {
      result |= 0x10000000
    }
    return result
  }

  getReadBaseId(id: number, msgType: CanMsgType): string {
    const msgTypeNum = this.msgTypeToNumber(msgType)
    return `readBase-${id}-${msgTypeNum}`
  }
}
