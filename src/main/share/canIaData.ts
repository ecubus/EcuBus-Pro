import type { CanInterAction } from './can'

/**
 * Byte length shown in the CAN interaction raw editor and sent on the wire.
 * Classic CAN DLC 0..8 is the length; DLC 9..15 stays 8. CAN FD uses the ISO length map.
 */
export function interactionPayloadLength(dlc: number, canFd: boolean): number {
  const classic = [0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 8, 8, 8, 8, 8]
  const fd = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24, 32, 48, 64]
  const table = canFd ? fd : classic
  if (!Number.isInteger(dlc) || dlc < 0 || dlc >= table.length) return 0
  return table[dlc]
}

/** True while the user is still typing a single hex nibble. */
export function rawHexIsPartial(data: string[] | undefined | null): boolean {
  if (!data) return false
  return data.some((byte) => String(byte ?? '').trim().length === 1)
}

/** True when every stored nibble is empty or zero, so the row has no raw edit yet. */
export function rawPayloadIsBlank(data: string[] | undefined | null): boolean {
  if (!data || data.length === 0) return true
  return data.every((byte) => {
    if (byte == null) return true
    const text = String(byte).trim()
    if (text === '') return true
    const value = parseInt(text, 16)
    return Number.isNaN(value) || value === 0
  })
}

export function bufferFromRawHex(data: string[] | undefined | null, length: number): Buffer {
  const buf = Buffer.alloc(Math.max(0, length))
  if (!data) return buf
  const n = Math.min(data.length, buf.length)
  for (let i = 0; i < n; i++) {
    const value = parseInt(String(data[i] ?? ''), 16)
    if (!Number.isNaN(value)) buf[i] = value & 0xff
  }
  return buf
}

/**
 * Payload for one CAN interaction row.
 * For a database frame this hex is kept equal to the DBC signal encode
 * (`linkRawHexToSignals`). Manual frames are the bytes the user typed.
 */
export function buildCanInterPayload(ia: Pick<CanInterAction, 'dlc' | 'type' | 'data'>): Buffer {
  return bufferFromRawHex(ia.data, interactionPayloadLength(ia.dlc, ia.type.includes('fd')))
}
