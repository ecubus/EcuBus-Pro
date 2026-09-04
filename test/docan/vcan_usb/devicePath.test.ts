import { describe, expect, test, vi } from 'vitest'
import { resolveVcanUsbPath } from '../../../src/main/docan/vcan_usb/devicePath'

describe('VCAN USB device path compatibility', () => {
  test('resolves a stable UUID selector to the current USB topology', () => {
    const selector = 'vcan-usb://uuid/1234567890abcdef01020304aabbccdd'
    const currentPath = 'libusb://1d50:6080/4/p3.2/1'
    expect(
      resolveVcanUsbPath(selector, 1, () => [
        {
          path: currentPath,
          interfaceNumber: 1,
          identitySelector: selector
        }
      ])
    ).toBe(currentPath)
  })

  test('rejects duplicate UUID selectors instead of opening an arbitrary adapter', () => {
    const selector = 'vcan-usb://uuid/1234567890abcdef01020304aabbccdd'
    expect(() =>
      resolveVcanUsbPath(selector, 0, () => [
        {
          path: 'libusb://1d50:6080/1/p1/0',
          interfaceNumber: 0,
          identitySelector: selector
        },
        {
          path: 'libusb://1d50:6080/2/p2/0',
          interfaceNumber: 0,
          identitySelector: selector
        }
      ])
    ).toThrow(/Multiple VCAN USB devices/)
  })

  test('keeps a current libusb path when it is still enumerated', () => {
    const path = 'libusb://1d50:6080/2/p2.1.3/0'
    const listDevices = vi.fn(() => [{ path, interfaceNumber: 0 }])

    expect(resolveVcanUsbPath(path, 0, listDevices)).toBe(path)
    expect(listDevices).toHaveBeenCalledOnce()
  })

  test('migrates a stale libusb topology path when the channel match is unique', () => {
    const stalePath = 'libusb://1d50:6080/2/p2.1.3/1'
    const currentPath = 'libusb://1d50:6080/2/p2.1.4/1'

    expect(
      resolveVcanUsbPath(stalePath, 1, () => [
        { path: 'libusb://1d50:6080/2/p2.1.4/0', interfaceNumber: 0 },
        { path: currentPath, interfaceNumber: 1 }
      ])
    ).toBe(currentPath)
  })

  test('does not guess a replacement for a stale path with multiple channel matches', () => {
    const stalePath = 'libusb://1d50:6080/2/p2.1.3/0'

    expect(() =>
      resolveVcanUsbPath(stalePath, 0, () => [
        { path: 'libusb://1d50:6080/2/p2.1.4/0', interfaceNumber: 0 },
        { path: 'libusb://1d50:6080/3/p3.2/0', interfaceNumber: 0 }
      ])
    ).toThrow(/multiple channel 0 interfaces/)
  })

  test('accepts selector and libusb scheme casing from older project files', () => {
    const selector = 'VCAN-USB://UUID/1234567890ABCDEF01020304AABBCCDD'
    const currentPath = 'libusb://1d50:6080/4/p3.2/1'
    expect(
      resolveVcanUsbPath(selector, 1, () => [
        { path: currentPath, interfaceNumber: 1, identitySelector: selector.toLowerCase() }
      ])
    ).toBe(currentPath)
    expect(
      resolveVcanUsbPath(currentPath.toUpperCase(), 1, () => [
        { path: currentPath, interfaceNumber: 1 }
      ])
    ).toBe(currentPath)
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
