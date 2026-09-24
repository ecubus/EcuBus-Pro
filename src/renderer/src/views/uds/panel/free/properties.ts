import type { PanelControl, PanelDocument } from 'src/preload/panel'
import { ancestors, boundControl, isLocked } from './model'
export const batchKeys = [
  'unit',
  'min',
  'max',
  'step',
  'initialValue',
  'readOnly',
  'pressValue',
  'releaseValue',
  'toggle'
] as const
export type BatchKey = (typeof batchKeys)[number]
export function commonProperties(controls: PanelControl[]): BatchKey[] {
  if (!controls.length) return []
  return batchKeys.filter((key) =>
    controls.every((c) => {
      if (['text', 'image', 'html', 'group', 'tabs'].includes(c.type)) return false
      if (c.type === 'startStop') return key === 'readOnly'
      if (['input', 'path'].includes(c.type)) return key === 'readOnly'
      if (c.type === 'button' && c.buttonAction && c.buttonAction !== 'write')
        return key === 'readOnly'
      if (key === 'unit' || key === 'initialValue') return true
      if (key === 'min' || key === 'max')
        return ['number', 'slider', 'progress', 'gauge'].includes(c.type)
      if (key === 'step') return ['number', 'slider'].includes(c.type)
      if (key === 'toggle') return c.type === 'button'
      if (key === 'readOnly')
        return ['number', 'button', 'checkbox', 'radio', 'switch', 'slider', 'select'].includes(
          c.type
        )
      return ['button', 'checkbox', 'switch'].includes(c.type)
    })
  )
}
export function patchControls<K extends keyof PanelControl>(
  doc: PanelDocument,
  ids: string[],
  key: K,
  value: PanelControl[K],
  includeLocked = false
) {
  doc.controls
    .filter(
      (c) =>
        ids.includes(c.id) &&
        (includeLocked ? !ancestors(doc, c).some((p) => p.locked) : !isLocked(doc, c))
    )
    .forEach((c) => {
      c[key] = value
      if (c.min > c.max) {
        if (key === 'min') c.max = c.min
        else c.min = c.max
      }
      boundControl(c, doc)
    })
}
