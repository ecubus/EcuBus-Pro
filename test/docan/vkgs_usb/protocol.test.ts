import { describe, expect, test } from 'vitest'
import { VkgsUsbApi } from '../../../src/main/docan/vkgs_usb/protocol'
import { VkgsUsbTransport } from '../../../src/main/docan/vkgs_usb/transport'

const FEATURE_FD = 1 << 8
const FEATURE_BT_CONST_EXT = 1 << 10
const FEATURE_TERMINATION = 1 << 11

function capabilityPayload(feature: number, clock: number, offset = 0, size = 40) {
  const payload = Buffer.alloc(size)
  payload.writeUInt32LE(feature, 0)
  payload.writeUInt32LE(clock, 4)
  const values = [2, 256, 1, 128, 128, 1, 512, 1]
  values.forEach((value, index) => payload.writeUInt32LE(value, offset + 8 + index * 4))
  return payload
}

class FakeVkgsTransport {
  readonly interfaceNumber = 0
  readonly reads: number[] = []
  readonly writes: number[] = []
  failModernTermination = false

  controlIn(request: number, _value: number, _index: number, _length: number) {
    this.reads.push(request)
    if (request === 4) {
      return capabilityPayload(FEATURE_FD | FEATURE_BT_CONST_EXT | FEATURE_TERMINATION, 80_000_000)
    }
    if (request === 11) {
      return capabilityPayload(FEATURE_FD | FEATURE_BT_CONST_EXT, 80_000_000, 32, 72)
    }
    if (request === 37 && this.failModernTermination) throw new Error('unsupported request')
    if (request === 37 || request === 13) {
      const response = Buffer.alloc(4)
      response.writeUInt32LE(1)
      return response
    }
    throw new Error(`unexpected request ${request}`)
  }

  controlOut(request: number) {
    this.writes.push(request)
    if (request === 37 && this.failModernTermination) throw new Error('unsupported request')
  }
}

describe('VKGS USB protocol API', () => {
  test('reads extended gs_usb capabilities and caches the result', () => {
    const transport = new FakeVkgsTransport()
    const api = new VkgsUsbApi(transport as unknown as VkgsUsbTransport, 0)

    const first = api.readCapabilities()
    const second = api.readCapabilities()

    expect(first).toBe(second)
    expect(first).toMatchObject({
      fdSupported: true,
      terminationSupported: true,
      nominal: { fclk_can: 80_000_000, brp_max: 512 },
      data: { fclk_can: 80_000_000, tseg2_max: 128 }
    })
    expect(transport.reads).toEqual([4, 11])
  })

  test('keeps compatibility with legacy termination requests', () => {
    const transport = new FakeVkgsTransport()
    transport.failModernTermination = true
    const api = new VkgsUsbApi(transport as unknown as VkgsUsbTransport, 0)

    expect(api.getTermination()).toBe(true)
    api.setTermination(true)

    expect(transport.reads).toEqual([37, 13])
    expect(transport.writes).toEqual([37, 12])
  })

  test('rejects an interface/channel mismatch before USB configuration', () => {
    const transport = new FakeVkgsTransport()
    expect(() => new VkgsUsbApi(transport as unknown as VkgsUsbTransport, 1)).toThrow(
      /interface mismatch/
    )
  })
})
