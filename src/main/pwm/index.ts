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
export async function getValidPwmDevices(vendor: string): Promise<PwmDevice[]> {
  vendor = vendor.toUpperCase()
  if (vendor === 'ECUBUS') {
    return EcuBusPwm.getValidDevices()
  } else {
    return []
  }
}

