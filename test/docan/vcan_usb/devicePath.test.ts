import { describe, expect, test, vi } from 'vitest'
import { resolveVcanUsbPath } from '../../../src/main/docan/vcan_usb/devicePath'

describe('VCAN USB device path compatibility', () => {
  test('keeps a current libusb path without enumerating devices', () => {
    const listDevices = vi.fn(() => [])
    const path = 'libusb://1d50:6080/2/p2.1.3/0'

    expect(resolveVcanUsbPath(path, 0, listDevices)).toBe(path)
    expect(listDevices).not.toHaveBeenCalled()
  })

  test('migrates a legacy WinUSB path when the channel match is unique', () => {
    const legacyPath = String.raw`\\?\USB#VID_1D50&PID_6080&MI_01#device`
    const currentPath = 'libusb://1d50:6080/2/p2.1.3/1'

    expect(
      resolveVcanUsbPath(legacyPath, 1, () => [
        { path: 'libusb://1d50:6080/2/p2.1.3/0', interfaceNumber: 0 },
        { path: currentPath, interfaceNumber: 1 }
      ])
    ).toBe(currentPath)
  })

  test('does not guess when more than one physical device has the channel', () => {
    const legacyPath = String.raw`\\?\USB#VID_1D50&PID_6080&MI_00#device`

    expect(() =>
      resolveVcanUsbPath(legacyPath, 0, () => [
        { path: 'libusb://1d50:6080/1/p1/0', interfaceNumber: 0 },
        { path: 'libusb://1d50:6080/2/p2/0', interfaceNumber: 0 }
      ])
    ).toThrow(/multiple channel 0 interfaces/)
  })
})
