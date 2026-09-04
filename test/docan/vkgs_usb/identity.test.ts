import { describe, expect, test } from 'vitest'
import {
  formatVkgsUsbSerialNumber,
  getVkgsUsbIdentity,
  isVkgsUsbIdentitySelector,
  makeVkgsUsbIdentitySelector
} from '../../../src/main/docan/vkgs_usb/identity'

describe('VKGS USB hardware identity', () => {
  test('prefers the immutable UUID and formats a stable selector', () => {
    const identity = getVkgsUsbIdentity({
      uid: [1, 2, 3, 4],
      uuid: [0x12345678, 0x90abcdef, 0x01020304, 0xaabbccdd]
    })

    expect(identity).toEqual({
      kind: 'uuid',
      value: '1234567890abcdef01020304aabbccdd'
    })
    expect(makeVkgsUsbIdentitySelector(identity!)).toBe(
      'vkgs-usb://uuid/1234567890abcdef01020304aabbccdd'
    )
    expect(formatVkgsUsbSerialNumber(identity!)).toBe('UUID:1234567890abcdef01020304aabbccdd')
  })

  test('falls back to UID when UUID is blank', () => {
    expect(
      getVkgsUsbIdentity({
        uid: [1, 2, 3, 4],
        uuid: [0, 0, 0, 0]
      })
    ).toEqual({ kind: 'uid', value: '00000001000000020000000300000004' })
  })

  test('rejects erased or malformed identities', () => {
    expect(
      getVkgsUsbIdentity({
        uid: [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff],
        uuid: [0, 0, 0, 0]
      })
    ).toBeUndefined()
    expect(isVkgsUsbIdentitySelector('vkgs-usb://uuid/not-hex')).toBe(false)
  })
})
