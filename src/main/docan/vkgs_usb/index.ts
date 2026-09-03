import { CanBaseInfo, CanDevice } from '../../share/can'
import { getUsbCanDevices, UsbCanBase } from '../usbcan'

export class VKGS_USB_CAN extends UsbCanBase {
  constructor(info: CanBaseInfo) {
    super(info, 'vkgs_usb')
  }

  static override getValidDevices(): CanDevice[] {
    return getUsbCanDevices('vkgs_usb')
  }

  static override getLibVersion(): string {
    return process.platform === 'win32' ? '1.0.0 (WinUSB)' : 'only support windows'
  }
}
