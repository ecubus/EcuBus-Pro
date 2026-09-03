import { describe, expect, test } from 'vitest'
import {
  dlcToLength,
  encodeVcanFrame,
  encodeVkgsFrame,
  lengthToDlc,
  makeVcanControlPayload,
  stripVcanControlPayload,
  UsbCanFrame,
  VcanDecoder,
  VkgsDecoder
} from '../../src/main/docan/usbcan/wire'

const frame: UsbCanFrame = {
  id: 0x18daf110,
  data: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]),
  fd: true,
  brs: true,
  extended: true,
  remote: false,
  timestampUs: 0
}

describe('USB CAN wire codecs', () => {
  test('maps CAN FD lengths to canonical DLC values', () => {
    expect(lengthToDlc(9, true)).toBe(9)
    expect(dlcToLength(9, true)).toBe(12)
    expect(lengthToDlc(64, true)).toBe(15)
    expect(() => lengthToDlc(65, true)).toThrow(/0\.\.64/)
    expect(() => lengthToDlc(9, false)).toThrow(/0\.\.8/)
  })

  test('builds and validates VCAN control headers', () => {
    const request = 37
    const packet = makeVcanControlPayload(1, request, Buffer.from([1, 0, 0, 0]))
    expect(packet.length).toBe(12)
    expect(packet.readUInt16LE(4)).toBe(0x100c)
    expect(stripVcanControlPayload(1, request, packet)).toEqual(Buffer.from([1, 0, 0, 0]))

    const corrupt = Buffer.from(packet)
    corrupt.writeUInt16LE(0x000c, 4)
    expect(() => stripVcanControlPayload(1, request, corrupt)).toThrow(/invalid/)
  })

  test('decodes a VCAN FD frame split across USB transfers', () => {
    const packet = encodeVcanFrame(1, frame)
    packet.writeUInt32LE(0xa2c95e3d, 0)
    packet.writeBigUInt64LE(123456789n, 16)
    const decoder = new VcanDecoder()

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

  test('decodes aggregated VCAN frames using the opcode length', () => {
    const first = encodeVcanFrame(0, { ...frame, fd: false, brs: false, data: Buffer.from([1]) })
    first.writeUInt32LE(0xa2c95e3d, 0)
    const second = Buffer.from(first)
    second.writeUInt32LE(0x321, 8)

    const result = new VcanDecoder().push(Buffer.concat([first, second]))
    expect(result.frames.map((item) => item.id)).toEqual([frame.id, 0x321])
  })

  test('rejects an invalid VCAN frame length and resets buffered state', () => {
    const invalid = Buffer.alloc(8)
    invalid.writeUInt32LE(0xa2c95e3d, 0)
    invalid.writeUInt16LE(4, 4)
    const decoder = new VcanDecoder()
    expect(() => decoder.push(invalid)).toThrow(/frame size/)

    const valid = encodeVcanFrame(0, { ...frame, fd: false, brs: false, data: Buffer.alloc(0) })
    valid.writeUInt32LE(0xa2c95e3d, 0)
    expect(decoder.push(valid).frames).toHaveLength(1)
  })

  test('rejects VCAN frames received on the wrong interface', () => {
    const packet = encodeVcanFrame(1, { ...frame, fd: false, brs: false, data: Buffer.alloc(0) })
    packet.writeUInt32LE(0xa2c95e3d, 0)
    expect(() => new VcanDecoder(0).push(packet)).toThrow(/channel 1.*interface 0/)
  })

  test('rejects VKGS frames received on the wrong interface', () => {
    const packet = encodeVkgsFrame(
      1,
      { ...frame, fd: false, brs: false, data: Buffer.alloc(0) },
      false
    )
    packet.writeUInt32LE(0xffffffff, 0)
    expect(() => new VkgsDecoder(false, 0).push(packet)).toThrow(/channel 1.*interface 0/)
  })

  test('encodes VKGS FD mode with a fixed 64-byte data area', () => {
    const packet = encodeVkgsFrame(1, frame, true)
    expect(packet.length).toBe(76)
    expect(packet.readUInt8(8)).toBe(9)
    expect(packet.readUInt8(9)).toBe(1)
    expect(packet.subarray(12, 21)).toEqual(frame.data)
    expect(packet.subarray(21)).toEqual(Buffer.alloc(55))
  })

  test('decodes split VKGS frames with hardware timestamps', () => {
    const packet = encodeVkgsFrame(0, frame, true)
    packet.writeUInt32LE(0xffffffff, 0)
    const timestamp = Buffer.alloc(8)
    timestamp.writeBigUInt64LE(987654321n)
    const transfer = Buffer.concat([packet, timestamp])
    const decoder = new VkgsDecoder(true)

    expect(decoder.push(transfer.subarray(0, 25)).frames).toHaveLength(0)
    const result = decoder.push(transfer.subarray(25))
    expect(result.frames).toHaveLength(1)
    expect(result.frames[0].timestampUs).toBe(987654321)
    expect(result.frames[0].data).toEqual(Buffer.concat([frame.data, Buffer.alloc(3)]))
  })

  test('decodes VKGS state events without interpreting the event header as CAN data', () => {
    const state = Buffer.alloc(28)
    state.writeUInt32LE(0xa4c95e3d, 0)
    state.writeBigUInt64LE(5000n, 8)
    state.writeUInt32LE(2, 16)
    state.writeUInt32LE(7, 20)
    state.writeUInt32LE(9, 24)

    expect(new VkgsDecoder(false).push(state).events).toEqual([
      {
        kind: 'state',
        timestampUs: 5000,
        state: 2,
        rxErrorCount: 7,
        txErrorCount: 9
      }
    ])
  })
})
