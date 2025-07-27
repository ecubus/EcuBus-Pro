import { SerialPort } from 'serialport'
import { PwmDevice, PwmBaseInfo } from '../../share/uds'
import { v4 } from 'uuid'
import EventEmitter from 'events'
import PwmBase from '../base'
import { getTsUs } from 'src/main/share/can'

// Simple PWM logger class
class PwmLOG {
  constructor(
    private vendor: string,
    private instance: string,
    private event: EventEmitter
  ) {}

  info(ts: number, msg: string) {
    console.log(`[${this.vendor}-${this.instance}] INFO (${ts}): ${msg}`)
    this.event.emit('pwm-info', { ts, msg })
  }

  error(ts: number, msg: string) {
    console.error(`[${this.vendor}-${this.instance}] ERROR (${ts}): ${msg}`)
    this.event.emit('pwm-error', { ts, msg })
  }
}

export class EcuBusPwm extends PwmBase {
  event = new EventEmitter()
  private rxBuffer = Buffer.alloc(0)
  private currentDutyCycle = 0
  private currentFrequency = 1000
  private currentPolarity = false
  private serialPort: SerialPort
  startTs: number
  log: PwmLOG

  constructor(public info: PwmBaseInfo) {
    super(info)

    this.serialPort = new SerialPort({
      path: this.info.device.handle,
      baudRate: 115200,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false
    })

    this.log = new PwmLOG('EcuBusPwm', info.name, this.event)
    this.startTs = getTsUs()
    this.currentDutyCycle = this.info.initDuty
    this.currentFrequency = this.info.freq
    this.currentPolarity = this.info.polarity
  }

  static loadDllPath(dllPath: string) {
    //do nothing
  }

  static getLibVersion() {
    return '1.0.0'
  }

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.serialPort.open((err) => {
        if (err) {
          this.log.error(this.getTs(), `Failed to open serial port: ${err.message}`)
          reject(err)
          return
        }

        ;(this as any).isOpen = true
        this.startReading()

        // Initialize PWM with configured settings
        this.initializePwm()
          .then(() => {
            this.log.info(this.getTs(), 'PWM device opened successfully')
            resolve()
          })
          .catch(reject)
      })
    })
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (!(this as any).isOpen) {
        resolve()
        return
      }

      // Stop PWM output
      this.stopPwm()
        .then(() => {
          this.serialPort.close((err) => {
            if (err) {
              this.log.error(this.getTs(), `Error closing serial port: ${err.message}`)
            }
            ;(this as any).isOpen = false
            this.event.emit('close')
            resolve()
          })
        })
        .catch(() => {
          this.serialPort.close()
          ;(this as any).isOpen = false
          this.event.emit('close')
          resolve()
        })
    })
  }

  setDutyCycle(dutyCycle: number): void {
    if (dutyCycle < 0 || dutyCycle > 100) {
      throw new Error('Duty cycle must be between 0 and 100')
    }

    if (!(this as any).isOpen) {
      throw new Error('Device not open')
    }

    // Send duty cycle command directly
    const cmd = `DUTY:${dutyCycle}\r`
    this.serialPort.write(cmd, (err) => {
      if (err) {
        this.log.error(this.getTs(), `Failed to set duty cycle: ${err.message}`)
        throw err
      } else {
        this.currentDutyCycle = dutyCycle
        this.log.info(this.getTs(), `Duty cycle set to ${dutyCycle}%`)
      }
    })
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

    this.serialPort.on('error', (err) => {
      if ((this as any).isOpen) {
        this.log.error(this.getTs(), `Serial port error: ${err.message}`)
        this.close()
      }
    })

    this.serialPort.on('close', () => {
      if ((this as any).isOpen) {
        this.log.error(this.getTs(), 'Serial port closed')
        this.close()
      }
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
    const ts = this.getTs()

    if (line.startsWith('OK')) {
      this.log.info(ts, 'Command executed successfully')
    } else if (line.startsWith('ERROR')) {
      this.log.error(ts, `Command failed: ${line}`)
    } else if (line.startsWith('PWM:')) {
      // PWM status response
      const parts = line.split(':')
      if (parts.length >= 4) {
        const dutyCycle = parseFloat(parts[1])
        const frequency = parseFloat(parts[2])
        const polarity = parts[3] === 'HIGH'

        this.currentDutyCycle = dutyCycle
        this.currentFrequency = frequency
        this.currentPolarity = polarity

        this.log.info(
          ts,
          `PWM Status - Duty: ${dutyCycle}%, Freq: ${frequency}Hz, Polarity: ${polarity ? 'HIGH' : 'LOW'}`
        )
      }
    }
  }

  private async initializePwm(): Promise<void> {
    // Send initialization command with configured settings
    const initCmd = `INIT:${this.currentFrequency}:${this.currentDutyCycle}:${this.currentPolarity ? 'HIGH' : 'LOW'}\r`
    return this.writeCommand(initCmd)
  }

  private async stopPwm(): Promise<void> {
    const stopCmd = 'STOP\r'
    return this.writeCommand(stopCmd)
  }

  private writeCommand(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!(this as any).isOpen) {
        reject(new Error('Device not open'))
        return
      }

      this.serialPort.write(cmd, (err) => {
        if (err) {
          reject(err)
        } else {
          this.serialPort.drain((drainErr) => {
            if (drainErr) {
              reject(drainErr)
            } else {
              resolve()
            }
          })
        }
      })
    })
  }

  static getValidDevices(): Promise<PwmDevice[]> {
    return new Promise((resolve, reject) => {
      const devices: PwmDevice[] = []

      // Get available serial ports
      SerialPort.list()
        .then((ports) => {
          ports.forEach((port) => {
            // Check if this is an EcuBus PWM device based on vendor and product IDs
            let isEcuBusPwm = false

            if (
              parseInt(port.vendorId ?? '0', 16) === 0xecbb &&
              parseInt(port.productId ?? '0', 16) === 0xa002
            ) {
              isEcuBusPwm = true
            }

            if (isEcuBusPwm) {
              devices.push({
                label: `${port.path} (EcuBus PWM)`,
                id: port.path,
                handle: port.path,
                busy: false,
                serialNumber: port.serialNumber
              })
            }
          })
          resolve(devices)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }
}
