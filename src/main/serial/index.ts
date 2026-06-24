import { SerialPort, SerialPortOpenOptions } from 'serialport'
import type { AutoDetectTypes } from '@serialport/bindings-cpp'
import EventEmitter from 'events'
import { getTsUs } from '../share/can'
import { SerialBaseInfo, SerialMessage } from '../share/serial'
import { SerialLOG } from '../log'

/**
 * Driver for a raw serial (UART) hardware device.
 *
 * The configured device is opened on global start (mirroring CAN/LIN). Received
 * bytes are emitted as `SerialMessage` frames (dir `IN`) and routed through the
 * attached {@link SerialLOG} so they appear in the trace window and are
 * delivered to script nodes bound to the device. Scripts send bytes through
 * {@link SerialBase.write} (dir `OUT`).
 */
export class SerialBase {
  port: SerialPort
  event = new EventEmitter()
  serialLog: SerialLOG
  private startTs: number
  private closed = false
  private msgCbs: ((msg: SerialMessage) => void)[] = []

  constructor(public info: SerialBaseInfo) {
    this.startTs = getTsUs()
    this.serialLog = new SerialLOG(info.vendor, info.name, info.id, this.event)
    this.port = new SerialPort(
      {
        path: info.device.handle,
        baudRate: info.baudRate,
        dataBits: info.dataBits ?? 8,
        stopBits: info.stopBits ?? 1,
        parity: info.parity ?? 'none',
        autoOpen: false
      } as SerialPortOpenOptions<AutoDetectTypes>,
      () => {
        // open is handled explicitly in open()
      }
    )
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) {
          reject(new Error(`Serial port ${this.info.device.handle} open error: ${err.message}`))
          return
        }
        this.port.on('data', (data: Buffer) => {
          const msg: SerialMessage = {
            dir: 'IN',
            data: Buffer.from(data),
            ts: getTsUs() - this.startTs,
            name: this.info.name,
            device: this.info.id
          }
          this.serialLog.serialBase(msg)
          for (const cb of this.msgCbs) {
            cb(msg)
          }
        })
        this.port.on('error', (e) => {
          if (!this.closed) this.event.emit('error', e)
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

  /**
   * Write raw bytes to the serial port.
   * @param data bytes to send
   * @param uuid uuid of the node that produced the frame (echo suppression)
   */
  write(data: Buffer, uuid?: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.port.write(data, (err) => {
        if (err) {
          reject(new Error(`Serial port ${this.info.device.handle} write error: ${err.message}`))
          return
        }
        const ts = getTsUs() - this.startTs
        const msg: SerialMessage = {
          dir: 'OUT',
          data: Buffer.from(data),
          ts,
          name: this.info.name,
          device: this.info.id,
          uuid
        }
        this.serialLog?.serialBase(msg)
        for (const cb of this.msgCbs) {
          cb(msg)
        }
        resolve(ts)
      })
    })
  }

  attachSerialMessage(cb: (msg: SerialMessage) => void) {
    this.msgCbs.push(cb)
  }

  detachSerialMessage(cb: (msg: SerialMessage) => void) {
    const idx = this.msgCbs.indexOf(cb)
    if (idx >= 0) this.msgCbs.splice(idx, 1)
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.closed = true
      this.serialLog.close()
      if (this.port.isOpen) {
        this.port.close(() => {
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}
