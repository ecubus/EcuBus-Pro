import { PwmBaseInfo } from '../share/uds'
import EventEmitter from 'events'

export default abstract class PwmBase extends EventEmitter {
  protected info: PwmBaseInfo
  protected isOpen = false

  constructor(info: PwmBaseInfo) {
    super()
    this.info = info
  }

  /**
   * Open the PWM device
   */
  abstract open(): Promise<void>

  /**
   * Close the PWM device
   */
  abstract close(): Promise<void>

  /**
   * Set PWM duty cycle (0-100)
   * @param dutyCycle Duty cycle percentage (0-100)
   */
  abstract setDutyCycle(dutyCycle: number): void

  /**
   * Check if device is open
   */
  isDeviceOpen(): boolean {
    return this.isOpen
  }

  /**
   * Get device info
   */
  getInfo(): PwmBaseInfo {
    return this.info
  }
}
