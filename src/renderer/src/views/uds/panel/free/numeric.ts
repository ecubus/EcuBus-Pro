import type { PanelControl } from 'src/preload/panel'

export function numericValue(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && !value.trim()) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}
export function formatNumber(control: PanelControl, value: unknown): string {
  const number = numericValue(value)
  if (number === undefined) return typeof value === 'string' && value ? value : '—'
  if (control.numberFormat === 'hex' || control.numberFormat === 'binary') {
    if (!Number.isSafeInteger(number)) return '—'
    const radix = control.numberFormat === 'hex' ? 16 : 2
    return `${number < 0 ? '-' : ''}${radix === 16 ? '0x' : '0b'}${Math.abs(number).toString(radix).toUpperCase()}`
  }
  return control.numberDecimals == null
    ? String(number)
    : number.toFixed(Math.max(0, Math.min(10, Math.round(control.numberDecimals))))
}

export function gaugeValueText(control: PanelControl, value: unknown): string {
  const number = numericValue(value)
  if (number === undefined) return '—'
  const decimals =
    control.numberDecimals == null
      ? 2
      : Math.max(0, Math.min(6, Math.round(control.numberDecimals)))
  const fixed = number.toFixed(decimals)
  const text = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed
  return `${text}${control.unit ? ` ${control.unit}` : ''}`
}

export function parseNumber(control: PanelControl, text: string) {
  const input = text.trim()
  const radix = control.numberFormat === 'hex' ? 16 : control.numberFormat === 'binary' ? 2 : 10
  const pattern =
    radix === 16
      ? /^[+-]?(?:0x)?[\da-f]+$/i
      : radix === 2
        ? /^[+-]?(?:0b)?[01]+$/i
        : /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i
  if (!pattern.test(input)) throw new Error('Invalid number')
  const unsigned = input
    .replace(/^[+-]/, '')
    .replace(radix === 16 ? /^0x/i : radix === 2 ? /^0b/i : /^$/, '')
  const value =
    radix === 10 ? Number(input) : parseInt(unsigned, radix) * (input.startsWith('-') ? -1 : 1)
  if (
    !Number.isFinite(value) ||
    (radix !== 10 && !Number.isSafeInteger(value)) ||
    value < control.min ||
    value > control.max
  )
    throw new Error('Out of range')
  return value
}
export function numericLabel(control: PanelControl) {
  const range = control.numberShowRange
    ? ` [${formatNumber(control, control.min)} … ${formatNumber(control, control.max)}]`
    : ''
  const unit =
    (control.numberShowUnit ?? control.type === 'display') && control.unit
      ? ` (${control.unit})`
      : ''
  return `${control.label}${range}${unit}`
}
export function alarmColor(control: PanelControl, value: unknown) {
  const number = numericValue(value)
  if (control.alarmMode !== 'limits' || number === undefined) return undefined
  if (control.alarmLower != null && number < control.alarmLower)
    return control.alarmLowerColor || '#fa8072'
  if (control.alarmUpper != null && number > control.alarmUpper)
    return control.alarmUpperColor || '#cd5c5c'
  return undefined
}
