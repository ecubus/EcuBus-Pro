import { describe, expect, test } from 'vitest'
import {
  encodeVkgsFrame,
  lengthToVkgsDlc,
  VkgsDecoder,
  vkgsDlcToLength,
  VkgsUsbFrame
} from '../../../src/main/docan/vkgs_usb/wire'

const frame: VkgsUsbFrame = {
  id: 0x18daf110,
  data: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]),
  fd: true,
  brs: true,
  extended: true,
  remote: false,
  timestampUs: 0
}

describe('VKGS USB wire codec', () => {
  test('maps CAN FD lengths to canonical DLC values', () => {
    expect(lengthToVkgsDlc(9, true)).toBe(9)
    expect(vkgsDlcToLength(9, true)).toBe(12)
    expect(lengthToVkgsDlc(64, true)).toBe(15)
    expect(() => lengthToVkgsDlc(65, true)).toThrow(/0\.\.64/)
    expect(() => lengthToVkgsDlc(9, false)).toThrow(/0\.\.8/)
  })

  test('encodes FD mode with a fixed 64-byte data area', () => {
    const packet = encodeVkgsFrame(1, frame, true)
    expect(packet.length).toBe(76)
    expect(packet.readUInt8(8)).toBe(9)
    expect(packet.readUInt8(9)).toBe(1)
    expect(packet.subarray(12, 21)).toEqual(frame.data)
    expect(packet.subarray(21)).toEqual(Buffer.alloc(55))
  })

  test('decodes split frames with hardware timestamps', () => {
    const packet = encodeVkgsFrame(0, frame, true)
    packet.writeUInt32LE(0xffffffff, 0)
    const timestamp = Buffer.alloc(8)
    timestamp.writeBigUInt64LE(987654321n)
    const transfer = Buffer.concat([packet, timestamp])
    const decoder = new VkgsDecoder(true, 0)

    expect(decoder.push(transfer.subarray(0, 25)).frames).toHaveLength(0)
    const result = decoder.push(transfer.subarray(25))
    expect(result.frames).toHaveLength(1)
    expect(result.frames[0].timestampUs).toBe(987654321)
    expect(result.frames[0].data).toEqual(Buffer.concat([frame.data, Buffer.alloc(3)]))
  })

  test('decodes state events without interpreting them as CAN data', () => {
    const state = Buffer.alloc(28)
    state.writeUInt32LE(0xa4c95e3d, 0)
    state.writeUInt8(0, 4)
    state.writeBigUInt64LE(5000n, 8)
    state.writeUInt32LE(2, 16)
    state.writeUInt32LE(7, 20)
    state.writeUInt32LE(9, 24)

    expect(new VkgsDecoder(false, 0).push(state).events).toEqual([
      {
        kind: 'state',
        timestampUs: 5000,
        state: 2,
        rxErrorCount: 7,
        txErrorCount: 9
      }
    ])
  })

  test('rejects frames received on the wrong interface', () => {
    const packet = encodeVkgsFrame(
      1,
      { ...frame, fd: false, brs: false, data: Buffer.alloc(0) },
      false
    )
    packet.writeUInt32LE(0xffffffff, 0)
    expect(() => new VkgsDecoder(false, 0).push(packet)).toThrow(/channel 1.*interface 0/)
  })
})
