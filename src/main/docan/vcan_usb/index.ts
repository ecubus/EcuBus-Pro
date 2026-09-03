import { CanBaseInfo, CanDevice } from '../../share/can'
import { getUsbCanDevices, UsbCanBase } from '../usbcan'

export class VCAN_USB_CAN extends UsbCanBase {
  constructor(info: CanBaseInfo) {
    super(info, 'vcan_usb')
  }

  static override getValidDevices(): CanDevice[] {
    return getUsbCanDevices('vcan_usb')
  }

  static override getLibVersion(): string {
    return process.platform === 'win32' ? '1.0.0 (WinUSB)' : 'only support windows'
  }
}
