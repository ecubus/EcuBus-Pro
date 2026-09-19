import type { PanelControl } from 'src/preload/panel'
import { labelPosition } from './model'

export const ledShapes = ['ellipse', 'rectangle', 'up', 'down', 'left', 'right'] as const
const paths = {
  ellipse: 'M 50 1 A 49 49 0 1 1 50 99 A 49 49 0 1 1 50 1 Z',
  rectangle: 'M 1 1 H 99 V 99 H 1 Z',
  up: 'M 50 1 L 99 99 H 1 Z',
  down: 'M 1 1 H 99 L 50 99 Z',
  left: 'M 1 50 L 99 1 V 99 Z',
  right: 'M 1 1 L 99 50 L 1 99 Z'
}
export function ledPresentation(control: PanelControl, value: unknown) {
  const position = labelPosition(control)
  let width = Math.max(
    4,
    control.width - (['left', 'right', 'center'].includes(position) ? 80 : 12)
  )
  let height = Math.max(4, control.height - (['top', 'bottom'].includes(position) ? 30 : 12))
  if (control.ledKeepAspect !== false) width = height = Math.min(width, height)
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN
  const state =
    numeric === control.pressValue ? 'on' : numeric === control.releaseValue ? 'off' : 'unknown'
  return {
    width,
    height,
    state,
    path: paths[control.ledShape || 'ellipse'],
    fill:
      state === 'on'
        ? control.ledOnColor || '#67c23a'
        : state === 'off'
          ? control.ledOffColor || '#dcdfe6'
          : 'none',
    stroke: control.ledFrame === false ? 'none' : 'var(--el-text-color-secondary)'
  } as const
}
