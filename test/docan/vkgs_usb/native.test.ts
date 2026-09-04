import { describe, expect, test } from 'vitest'
import { VkgsUsbNative } from '../../../src/main/docan/vkgs_usb/native'

describe('VKGS USB native API contract', () => {
  test('loads the native module and returns complete fallback capabilities', () => {
    const capabilities = VkgsUsbNative.fallbackCapabilities()

    expect(capabilities.fdSupported).toBe(true)
    expect(capabilities.listenOnlySupported).toBe(true)
    expect(capabilities.nominal.fclk_can).toBe(80_000_000)
    expect(capabilities.nominal.brp_min).toBe(1)
    expect(capabilities.nominal.brp_max).toBe(256)
    expect(capabilities.nominal.brp_inc).toBe(1)
    expect(capabilities.nominal.tseg1_min).toBe(1)
    expect(capabilities.nominal.tseg1_max).toBe(128)
    expect(capabilities.nominal.tseg2_min).toBe(2)
    expect(capabilities.nominal.tseg2_max).toBe(32)
    expect(capabilities.data).toMatchObject({
      tseg1_min: 1,
      tseg1_max: 30,
      tseg2_min: 1,
      tseg2_max: 15,
      sjw_max: 15,
      brp_min: 1,
      brp_max: 32,
      brp_inc: 1
    })
  })
})
