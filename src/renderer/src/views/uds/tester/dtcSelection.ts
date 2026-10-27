import type { Param, ServiceId } from 'nodeCan/uds'

export function dtcToArrayString(raw: number): string {
  if (!Number.isInteger(raw) || raw < 0 || raw > 0xffffff) {
    throw new RangeError('DTC must be a 24-bit unsigned integer')
  }
  return raw.toString(16).toUpperCase().padStart(6, '0').match(/.{2}/g)!.join(' ')
}

export function getDtcOptions(param: Param, request: boolean, serviceId: ServiceId) {
  const name = param.name.replace(/[^a-z0-9]/gi, '').toLowerCase()
  if (
    !request ||
    serviceId !== '0x19' ||
    param.type !== 'ARRAY' ||
    param.bitLen !== 24 ||
    param.editable === false ||
    !['dtc', 'dtcmaskrecord'].includes(name) ||
    !param.DTC_Table?.length
  ) {
    return undefined
  }
  return param.DTC_Table.filter(
    (entry) => Number.isInteger(entry.hexValue) && entry.hexValue >= 0 && entry.hexValue <= 0xffffff
  ).map((entry) => ({
    name: [
      `0x${entry.hexValue.toString(16).toUpperCase().padStart(6, '0')}`,
      entry.codeText,
      entry.name
    ]
      .filter(Boolean)
      .join(' · '),
    value: dtcToArrayString(entry.hexValue)
  }))
}
