import type { PanelControl } from 'src/preload/panel'
import { rangeFraction } from './model'

export function progressValuePosition(control: PanelControl) {
  return control.progressValuePosition ?? (control.progressText === 'hidden' ? 'hidden' : 'top')
}

export function progressPresentation(control: PanelControl, value: number | string | undefined) {
  const fraction = rangeFraction(value, control.min, control.max)
  const origin = rangeFraction(control.progressOrigin ?? control.min, control.min, control.max) ?? 0
  const direction = control.progressDirection || 'right'
  const vertical = direction === 'up' || direction === 'down'
  const start = Math.min(origin, fraction ?? origin) * 100
  const size = Math.abs((fraction ?? origin) - origin) * 100
  const edge = { right: 'left', left: 'right', up: 'bottom', down: 'top' }[direction]
  const fill = { [edge]: `${start}%`, [vertical ? 'height' : 'width']: `${size}%` }
  let text = '—'
  if (fraction != null) {
    const percent = control.progressText === 'percent'
    const numeric = percent ? fraction * 100 : Number(value)
    const decimals = control.progressDecimals
    const formatted =
      decimals == null
        ? percent
          ? String(Math.round(numeric))
          : String(value)
        : numeric.toFixed(Math.max(0, Math.min(6, Math.round(decimals))))
    text = percent ? `${formatted}%` : `${formatted}${control.unit ? ` ${control.unit}` : ''}`
  }
  return { fraction, vertical, direction, fill, text }
}
