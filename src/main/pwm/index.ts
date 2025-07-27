import { PwmBaseInfo, PwmDevice } from '../share/uds'
import PwmBase from './base'
import { EcuBusPwm } from './ecubus'

export { PwmBase, EcuBusPwm }
export type { PwmBaseInfo, PwmDevice }

/**
 * Create a PWM device based on the provided info
 */
export function createPwmDevice(info: PwmBaseInfo): PwmBase {
  switch (info.vendor) {
    case 'ecubus':
      return new EcuBusPwm(info)
    default:
      throw new Error(`Unsupported PWM vendor: ${info.vendor}`)
  }
}

/**
 * Get all available PWM devices
 */
export async function getValidPwmDevices(): Promise<PwmDevice[]> {
  const devices: PwmDevice[] = []

  try {
    // Get EcuBus PWM devices
    const ecubusDevices = await EcuBusPwm.getValidDevices()
    devices.push(...ecubusDevices)
  } catch (error) {
    console.error('Error getting EcuBus PWM devices:', error)
  }

  return devices
}
