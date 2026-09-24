export function valueBytes(value: string | number[] | undefined): number[] {
  return typeof value === 'string' ? Array.from(new TextEncoder().encode(value)) : value || []
}

export function formatHex(value: string | number[] | undefined) {
  return valueBytes(value)
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ')
}

export function parseEditorValue(text: string, hex: boolean, array: boolean): string | number[] {
  if (!hex) {
    if (!array) return text
    const bytes = Array.from(text, (character) => character.codePointAt(0)!)
    if (!validBytes(bytes)) throw new Error('Invalid byte text')
    return bytes
  }
  const compact = text.replace(/\s/g, '')
  if (!/^(?:[\da-fA-F]{2})*$/.test(compact)) throw new Error('Invalid hex')
  const bytes = compact.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || []
  return array ? bytes : new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
}

export function validBytes(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  )
}
