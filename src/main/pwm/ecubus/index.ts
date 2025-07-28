import { SerialPort } from 'serialport'
import { PwmDevice, PwmBaseInfo } from '../../share/uds'
import { v4 } from 'uuid'
import EventEmitter from 'events'
import PwmBase from '../base'
import { getTsUs } from 'src/main/share/can'

// PWM计算结果接口
export interface PwmCalculationResult {
  prescaler: number // PSC值 (分频器值)
  autoReload: number // ARR值 (自动重装载值)
  compareValue: number // CCR值 (比较寄存器值)
  actualFrequency: number // 实际计算出的频率
  actualDutyCycle: number // 实际计算出的占空比
}

export class EcuBusPwm extends PwmBase {
  private serialPort: SerialPort
  startTs: number
  private counterClock = 88000000 // 88MHz 计数器时钟频率
  private currentDutyCycle = 0
  private currentFrequency = 1000
  private currentPolarity = false

  // 当前PWM硬件参数
  private currentPrescaler = 0
  private currentAutoReload = 0
  private currentCompareValue = 0

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

    this.startTs = getTsUs()
    this.currentDutyCycle = this.info.initDuty
    this.currentFrequency = this.info.freq
    this.currentPolarity = this.info.polarity

    // 初始化时计算初始PWM参数
    const initialParams = this.calculatePwmParameters(this.currentFrequency, this.currentDutyCycle)
    this.currentPrescaler = initialParams.prescaler
    this.currentAutoReload = initialParams.autoReload
    this.currentCompareValue = initialParams.compareValue

    this.open().catch((err) => {
      sysLog.error(`Failed to open PWM device: ${err.message}`)
    })
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
          reject(err)
          return
        }
        this.isOpen = true

        // Initialize PWM with configured settings
        this.initializePwm()
          .then(() => {
            resolve()
          })
          .catch(reject)
      })
    })
  }

  close(): Promise<void> {
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
              sysLog.error(`Error closing serial port: ${err.message}`)
            }
            this.isOpen = false
            this.event.emit('close')
            resolve()
          })
        })
        .catch(() => {
          this.serialPort.close()
          this.isOpen = false
          this.event.emit('close')
          resolve()
        })
    })
  }

  async setDutyCycle(dutyCycle: number): Promise<void> {
    if (dutyCycle < 0 || dutyCycle > 100) {
      throw new Error('Duty cycle must be between 0 and 100')
    }

    if (!this.isOpen) {
      throw new Error('Device not open')
    }

    // 只计算新的CCR值，保持当前的PSC和ARR不变
    const newCompareValue = Math.round(((this.currentAutoReload + 1) * dutyCycle) / 100)

    // 计算实际占空比
    const actualDutyCycle = (newCompareValue / (this.currentAutoReload + 1)) * 100
    this.currentDutyCycle = actualDutyCycle
    this.currentCompareValue = newCompareValue
    // 发送只更新CCR的命令
    let str = 'W'
    const ccr = Buffer.alloc(2)
    ccr.writeUInt16BE(newCompareValue, 0)
    str += ccr.toString('hex').padStart(4, '0')
    str += '\r'
    return this.writeCommand(str)
  }
  getDutyCycle(): number {
    return this.currentDutyCycle
  }
  getFrequency(): number {
    return this.currentFrequency
  }
  private async initializePwm(): Promise<void> {
    // Send initialization command with calculated hardware parameters
    let str = 'P'
    const pcs = Buffer.alloc(2)
    pcs.writeUInt16BE(this.currentPrescaler, 0)
    str += pcs.toString('hex').padStart(4, '0')
    const arr = Buffer.alloc(2)
    arr.writeUInt16BE(this.currentAutoReload, 0)
    str += arr.toString('hex').padStart(4, '0')
    const ccr = Buffer.alloc(2)
    ccr.writeUInt16BE(this.currentCompareValue, 0)
    str += ccr.toString('hex').padStart(4, '0')
    if (this.currentPolarity) {
      str += '1'
    } else {
      str += '0'
    }
    if (this.info.resetStatus) {
      str += '1'
    } else {
      str += '0'
    }
    str += '\r'
    return this.writeCommand(str)
  }

  private async stopPwm(): Promise<void> {
    const stopCmd = 'E\r'
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
              parseInt(port.productId ?? '0', 16) === 0xa001
            ) {
              isEcuBusPwm = true
            }

            if (isEcuBusPwm) {
              devices.push({
                label: `${port.path} (LinCable)`,
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

  /**
   * 根据目标频率和占空比计算PWM参数
   * @param targetFrequency 目标频率 (Hz)
   * @param dutyCycle 占空比 (0-100)
   * @returns PWM计算结果
   */
  calculatePwmParameters(targetFrequency: number, dutyCycle: number): PwmCalculationResult {
    if (targetFrequency <= 0) {
      throw new Error(`targetFrequency must be greater than 0, but got ${targetFrequency}`)
    }

    if (dutyCycle < 0 || dutyCycle > 100) {
      throw new Error(`dutyCycle must be between 0 and 100, but got ${dutyCycle}`)
    }

    let bestPsc = 0
    let bestArr = 0
    let bestError = Number.MAX_VALUE
    let actualFreq = 0

    // 尝试不同的分频器值来找到最佳组合
    // PSC范围: 0-65535, ARR范围: 0-65535
    for (let psc = 0; psc <= 65535; psc++) {
      // 计算在当前分频器下需要的ARR值
      const clockAfterPsc = this.counterClock / (psc + 1)
      const requiredArr = Math.round(clockAfterPsc / targetFrequency) - 1

      // 检查ARR值是否在有效范围内
      if (requiredArr < 0 || requiredArr > 65535) {
        continue
      }

      // 计算实际频率
      const actualFrequency = clockAfterPsc / (requiredArr + 1)
      const error = Math.abs(actualFrequency - targetFrequency)

      // 如果这个组合更接近目标频率，则更新最佳值
      if (error < bestError) {
        bestError = error
        bestPsc = psc
        bestArr = requiredArr
        actualFreq = actualFrequency
      }

      // 如果找到了精确匹配，提前退出
      if (error < 0.01) {
        break
      }
    }

    if (bestArr === 0) {
      throw new Error(
        `No valid PSC and ARR combination found for frequency ${targetFrequency} Hz and duty cycle ${dutyCycle}%`
      )
    }

    // 计算CCR值 (比较寄存器值)
    const ccr = Math.round(((bestArr + 1) * dutyCycle) / 100)

    // 计算实际占空比
    const actualDutyCycle = (ccr / (bestArr + 1)) * 100

    return {
      prescaler: bestPsc,
      autoReload: bestArr,
      compareValue: ccr,
      actualFrequency: actualFreq,
      actualDutyCycle: actualDutyCycle
    }
  }
}
