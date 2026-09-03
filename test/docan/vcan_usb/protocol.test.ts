import { describe, expect, test } from 'vitest'
import { VcanUsbApi } from '../../../src/main/docan/vcan_usb/protocol'
import { VcanUsbTransport } from '../../../src/main/docan/vcan_usb/transport'
import { makeVcanControlPayload } from '../../../src/main/docan/vcan_usb/wire'

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

class FakeVcanTransport {
  readonly interfaceNumber = 1
  readonly reads: number[] = []
  malformed = false

  controlIn(request: number, _value: number, _index: number, _length: number) {
    this.reads.push(request)
    const baseRequest = request & 0x7f
    let payload: Buffer
    if (baseRequest === 16) {
      payload = capabilityPayload(
        FEATURE_FD | FEATURE_BT_CONST_EXT | FEATURE_TERMINATION,
        80_000_000
      )
    } else if (baseRequest === 17) {
      payload = capabilityPayload(FEATURE_FD | FEATURE_BT_CONST_EXT, 80_000_000, 32, 72)
    } else {
      throw new Error(`unexpected request ${baseRequest}`)
    }
    const response = makeVcanControlPayload(this.interfaceNumber, baseRequest, payload)
    if (this.malformed) response.writeUInt32LE(0, 0)
    return response
  }
}

describe('VCAN USB protocol API', () => {
  test('reads extended capabilities and caches the result', () => {
    const transport = new FakeVcanTransport()
    const api = new VcanUsbApi(transport as unknown as VcanUsbTransport, 1)

    const first = api.readCapabilities()
    const second = api.readCapabilities()

    expect(first).toBe(second)
    expect(first).toMatchObject({
      fdSupported: true,
      terminationSupported: true,
      nominal: { fclk_can: 80_000_000, brp_max: 512 },
      data: { fclk_can: 80_000_000, tseg1_max: 256 }
    })
    expect(transport.reads).toEqual([16 | 0x80, 17 | 0x80])
  })

  test('rejects a response whose VCAN control header is invalid', () => {
    const transport = new FakeVcanTransport()
    transport.malformed = true
    const api = new VcanUsbApi(transport as unknown as VcanUsbTransport, 1)
    expect(() => api.readCapabilities()).toThrow(/header is invalid/)
  })

  test('rejects an interface/channel mismatch before USB configuration', () => {
    const transport = new FakeVcanTransport()
    expect(() => new VcanUsbApi(transport as unknown as VcanUsbTransport, 0)).toThrow(
      /interface mismatch/
    )
  })
})
