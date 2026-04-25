/**
 * CMSIS-DAP request/response helpers (no native code).
 * @see https://arm-software.github.io/CMSIS-DAP/latest/group__DAP__Commands__gr.html
 */

export const DapCommand = {
  Info: 0x00,
  /** @see ARM CMSIS DAP.h — ID_DAP_HostStatus */
  HostStatus: 0x01,
  Connect: 0x02,
  Disconnect: 0x03,
  /** DAP_Transfer: SWD/JTAG CoreSight register access (see dap-swd-transfer.ts). */
  Transfer: 0x05
} as const

/** Sub-ids for DAP_Info (byte after command id 0x00). */
export const DapInfoId = {
  Vendor: 0x01,
  Product: 0x02,
  Serial: 0x03,
  /** CMSIS-DAP protocol version (e.g. "2.1.0") */
  CmsisDapProtocolVersion: 0x04,
  Capabilities: 0xf0,
  /** Max DAP command packet size (2 bytes, little-endian) in response. */
  PacketSize: 0xff,
  /** Max DAP command packet count (1 byte) in response. */
  PacketCount: 0xfe
} as const

export class DapProtocolError extends Error {
  override readonly name = 'DapProtocolError'
  constructor(message: string) {
    super(message)
  }
}

export function buildDapInfoRequest(infoId: number): Buffer {
  return Buffer.from([DapCommand.Info, infoId & 0xff])
}

/**
 * A generic DAP response starts with the echoed command id; DAP_Info response is
 * [0x00, Len, ...Info]. Len is 0 (no data), 1 (one byte), or string length (incl. optional NUL per spec).
 */
export function parseDapInfoResponse(res: Buffer): { len: number; payload: Buffer; raw: Buffer } {
  if (res.length < 2) {
    throw new DapProtocolError('DAP_Info response too short')
  }
  if (res[0] !== DapCommand.Info) {
    throw new DapProtocolError(`DAP_Info expected first byte 0x00, got 0x${res[0].toString(16)}`)
  }
  const len = res[1]
  const need = 2 + len
  if (res.length < need) {
    throw new DapProtocolError(`DAP_Info len=${len} but response only ${res.length} bytes`)
  }
  return {
    len,
    payload: res.subarray(2, 2 + len),
    raw: res
  }
}

/**
 * Interprets DAP_Info payload as UTF-8 string (strips a trailing 0x00 if present).
 */
export function dapInfoPayloadToString(payload: Buffer): string {
  if (payload.length === 0) {
    return ''
  }
  let end = payload.length
  if (end > 0 && payload[end - 1] === 0) {
    end--
  }
  return payload.subarray(0, end).toString('utf8')
}

/**
 * For Len === 1 capability / numeric single-byte DAP_Info replies.
 */
export function dapInfoPayloadToByte(payload: Buffer): number {
  if (payload.length < 1) {
    throw new DapProtocolError('expected 1 byte')
  }
  return payload[0]!
}

/**
 * For Len === 2 (e.g. max packet size).
 */
export function dapInfoPayloadToUInt16LE(payload: Buffer): number {
  if (payload.length < 2) {
    throw new DapProtocolError('expected 2 bytes')
  }
  return payload[0]! | (payload[1]! << 8)
}

export function buildDapConnectRequest(port: 'default' | 'swd' | 'jtag'): Buffer {
  const p = port === 'swd' ? 1 : port === 'jtag' ? 2 : 0
  return Buffer.from([DapCommand.Connect, p])
}

export function buildDapDisconnectRequest(): Buffer {
  return Buffer.from([DapCommand.Disconnect])
}

/** DAP_HostStatus: see CMSIS DAP spec for the second byte (host + target sub-fields). */
export function buildDapHostStatusRequest(host: number = 0, target: number = 0): Buffer {
  return Buffer.from([DapCommand.HostStatus, host & 0xff, target & 0xff])
}

/**
 * Check response echoed command: first byte should match the request id.
 * Some errors use status in second byte; this only validates the first byte.
 */
export function checkResponseCommand(requestCmd: number, res: Buffer): void {
  if (res.length < 1) {
    throw new DapProtocolError('empty DAP response')
  }
  if (res[0] !== (requestCmd & 0xff)) {
    if (res[0] === 0xff) {
      throw new DapProtocolError('DAP command not implemented (0xFF)')
    }
    throw new DapProtocolError(
      `DAP response command mismatch: expected 0x${(requestCmd & 0xff).toString(16)}, got 0x${res[0].toString(16)}`
    )
  }
}
