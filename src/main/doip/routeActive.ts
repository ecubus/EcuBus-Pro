/**
 * ISO 13400-2 routing activation request payload (type 0x0005).
 * 7 bytes by default; 11 when `oemSpec` is present.
 * Bytes 3–6 stay 0. `oemSpec` must be exactly 4 bytes.
 */
export function buildRouteActivePayload(
  testerLogicalAddr: number,
  activeType = 0,
  oemSpec?: Buffer
): Buffer {
  if (oemSpec && oemSpec.length !== 4) {
    throw new Error('oem specific must be 4 bytes')
  }
  const data = Buffer.alloc(7 + (oemSpec ? 4 : 0))
  data.writeUInt16BE(testerLogicalAddr, 0)
  data.writeUint8(activeType & 0xff, 2)
  if (oemSpec) {
    oemSpec.copy(data, 7)
  }
  return data
}

/** Empty or missing omits the field. A set value must be exactly 4 bytes (8 hex digits). */
export function parseOemSpecific(oemSpecific?: string): Buffer | undefined {
  if (oemSpecific == undefined || oemSpecific.trim() === '') {
    return undefined
  }
  const hex = oemSpecific.replace(/\s+/g, '')
  if (!/^[0-9A-Fa-f]{8}$/.test(hex)) {
    throw new Error('oem specific must be 4 bytes')
  }
  return Buffer.from(hex, 'hex')
}
