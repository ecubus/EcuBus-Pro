import { describe, expect, test } from 'vitest'
import {
  encodeVcanFrame,
  lengthToVcanDlc,
  makeVcanControlPayload,
  stripVcanControlPayload,
  VcanDecoder,
  vcanDlcToLength,
  VcanUsbFrame
} from '../../../src/main/docan/vcan_usb/wire'

const frame: VcanUsbFrame = {
  id: 0x18daf110,
  data: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]),
  fd: true,
  brs: true,
  extended: true,
  remote: false,
  timestampUs: 0
}

describe('VCAN USB wire codec', () => {
  test('maps CAN FD lengths to canonical DLC values', () => {
    expect(lengthToVcanDlc(9, true)).toBe(9)
    expect(vcanDlcToLength(9, true)).toBe(12)
    expect(lengthToVcanDlc(64, true)).toBe(15)
    expect(() => lengthToVcanDlc(65, true)).toThrow(/0\.\.64/)
    expect(() => lengthToVcanDlc(9, false)).toThrow(/0\.\.8/)
  })

  test('builds and validates control headers', () => {
    const request = 37
    const packet = makeVcanControlPayload(1, request, Buffer.from([1, 0, 0, 0]))
    expect(packet.length).toBe(12)
    expect(packet.readUInt16LE(4)).toBe(0x100c)
    expect(stripVcanControlPayload(1, request, packet)).toEqual(Buffer.from([1, 0, 0, 0]))

    const corrupt = Buffer.from(packet)
    corrupt.writeUInt16LE(0x000c, 4)
    expect(() => stripVcanControlPayload(1, request, corrupt)).toThrow(/invalid/)
  })

  test('decodes an FD frame split across USB transfers', () => {
    const packet = encodeVcanFrame(1, frame)
    packet.writeUInt32LE(0xa2c95e3d, 0)
    packet.writeBigUInt64LE(123456789n, 16)
    const decoder = new VcanDecoder(1)

    expect(decoder.push(packet.subarray(0, 17)).frames).toHaveLength(0)
    const result = decoder.push(packet.subarray(17))

    expect(result.frames).toHaveLength(1)
    expect(result.frames[0]).toMatchObject({
      id: frame.id,
      fd: true,
      brs: true,
      extended: true,
      timestampUs: 123456789
    })
    expect(result.frames[0].data).toEqual(Buffer.concat([frame.data, Buffer.alloc(3)]))
    expect(result.tail).toHaveLength(0)
  })

  test('decodes aggregated frames using the opcode length', () => {
    const first = encodeVcanFrame(0, {
      ...frame,
      fd: false,
      brs: false,
      data: Buffer.from([1])
    })
    first.writeUInt32LE(0xa2c95e3d, 0)
    const second = Buffer.from(first)
    second.writeUInt32LE(0x321, 8)

    const result = new VcanDecoder(0).push(Buffer.concat([first, second]))
    expect(result.frames.map((item) => item.id)).toEqual([frame.id, 0x321])
  })

  test('rejects an invalid frame length and resets buffered state', () => {
    const invalid = Buffer.alloc(8)
    invalid.writeUInt32LE(0xa2c95e3d, 0)
    invalid.writeUInt16LE(4, 4)
    const decoder = new VcanDecoder(0)
    expect(() => decoder.push(invalid)).toThrow(/frame size/)

    const valid = encodeVcanFrame(0, {
      ...frame,
      fd: false,
      brs: false,
      data: Buffer.alloc(0)
    })
    valid.writeUInt32LE(0xa2c95e3d, 0)
    expect(decoder.push(valid).frames).toHaveLength(1)
  })

  test('rejects frames received on the wrong interface', () => {
    const packet = encodeVcanFrame(1, {
      ...frame,
      fd: false,
      brs: false,
      data: Buffer.alloc(0)
    })
    packet.writeUInt32LE(0xa2c95e3d, 0)
    expect(() => new VcanDecoder(0).push(packet)).toThrow(/channel 1.*interface 0/)
  })
})
