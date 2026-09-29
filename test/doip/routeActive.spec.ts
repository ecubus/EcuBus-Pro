import { describe, expect, it } from 'vitest'
import { buildRouteActivePayload } from '../../src/main/doip/routeActive'

describe('buildRouteActivePayload', () => {
  it('omits the oem field as 7 bytes with reserved zeros', () => {
    const data = buildRouteActivePayload(0x0e80)
    expect(data.length).toBe(7)
    expect(data.readUInt16BE(0)).toBe(0x0e80)
    expect(data[2]).toBe(0)
    expect([...data.subarray(3, 7)]).toEqual([0, 0, 0, 0])
  })

  it('places a 4-byte oem field at offset 7', () => {
    const oem = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd])
    const data = buildRouteActivePayload(0x0e80, 0, oem)
    expect(data.length).toBe(11)
    expect(data[2]).toBe(0)
    expect([...data.subarray(3, 7)]).toEqual([0, 0, 0, 0])
    expect([...data.subarray(7, 11)]).toEqual([0xaa, 0xbb, 0xcc, 0xdd])
  })

  it('rejects an oem buffer that is not 4 bytes', () => {
    expect(() => buildRouteActivePayload(0x0e80, 0, Buffer.from([0x11, 0x22]))).toThrow(
      'oem specific must be 4 bytes'
    )
    expect(() =>
      buildRouteActivePayload(0x0e80, 0, Buffer.from([0x11, 0x22, 0x33, 0x44, 0x55]))
    ).toThrow('oem specific must be 4 bytes')
  })
})
