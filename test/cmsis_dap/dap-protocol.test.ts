import { describe, it, expect } from 'vitest'
import {
  DapCommand,
  DapInfoId,
  buildDapInfoRequest,
  buildDapConnectRequest,
  buildDapDisconnectRequest,
  buildDapHostStatusRequest,
  parseDapInfoResponse,
  dapInfoPayloadToString,
  dapInfoPayloadToByte,
  dapInfoPayloadToUInt16LE,
  DapProtocolError,
  checkResponseCommand
} from '../../src/main/cmsis_dap/dap-protocol'

describe('dap-protocol (wire encoding)', () => {
  it('buildDapInfoRequest', () => {
    expect([...buildDapInfoRequest(DapInfoId.Vendor)]).toEqual([DapCommand.Info, 0x01])
    expect([...buildDapInfoRequest(DapInfoId.Capabilities)]).toEqual([DapCommand.Info, 0xf0])
  })

  it('buildDapConnect / Disconnect / HostStatus', () => {
    expect([...buildDapConnectRequest('default')]).toEqual([0x02, 0x00])
    expect([...buildDapConnectRequest('swd')]).toEqual([0x02, 0x01])
    expect([...buildDapConnectRequest('jtag')]).toEqual([0x02, 0x02])
    expect([...buildDapDisconnectRequest()]).toEqual([0x03])
    expect([...buildDapHostStatusRequest()]).toEqual([0x01, 0x00, 0x00])
  })

  it('parseDapInfoResponse for string (vendor / zero-terminated)', () => {
    const vendorName = 'TestVendor'
    const u8 = Buffer.from(vendorName + '\0', 'utf8')
    const res = Buffer.concat([Buffer.from([DapCommand.Info, u8.length]), u8])
    const { len, payload } = parseDapInfoResponse(res)
    expect(len).toBe(u8.length)
    expect(dapInfoPayloadToString(payload)).toBe('TestVendor')
  })

  it('parseDapInfoResponse throws on short buffer', () => {
    expect(() => parseDapInfoResponse(Buffer.from([0x00]))).toThrow(DapProtocolError)
  })

  it('parseDapInfoResponse throws on bad command id', () => {
    const res = Buffer.from([0x01, 0x00])
    expect(() => parseDapInfoResponse(res)).toThrow(DapProtocolError)
  })

  it('dapInfoPayloadToByte and UInt16LE', () => {
    expect(dapInfoPayloadToByte(Buffer.from([0xab]))).toBe(0xab)
    expect(dapInfoPayloadToUInt16LE(Buffer.from([0x00, 0x02]))).toBe(0x200)
  })

  it('checkResponseCommand', () => {
    checkResponseCommand(0x00, Buffer.from([0x00, 0x01, 0x2a]))
    expect(() => checkResponseCommand(0x00, Buffer.from([0x05, 0x00]))).toThrow(DapProtocolError)
  })
})
