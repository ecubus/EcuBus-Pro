import { isEqual } from 'lodash'
import type { PanelItem, VarItem } from 'src/preload/data'
import type { PanelControl } from 'src/preload/panel'
import { parseEditorValue } from './hexText'
import { canWrite, type PanelValue } from './runtime'

function variableId(control: PanelControl) {
  return control.binding?.kind === 'variable'
    ? control.binding.node.bindValue.variableId
    : undefined
}

function writableControls(panels: Record<string, PanelItem>) {
  return Object.values(panels).flatMap((panel) =>
    (panel.document?.controls || []).filter((control) => variableId(control) && canWrite(control))
  )
}

function initialValue(control: PanelControl, variable: VarItem): PanelValue | undefined {
  const text = ['input', 'path'].includes(control.type)
  const type = variable.value?.type
  if (type === 'number') return text ? undefined : control.initialValue
  if (!text) return undefined
  if (type === 'string') return control.initialText || ''
  try {
    return parseEditorValue(control.initialText || '', control.editorMode === 'hex', true)
  } catch {
    return undefined
  }
}

export function panelStartValues(panels: Record<string, PanelItem>, vars: Record<string, VarItem>) {
  const values: Record<string, PanelValue> = {}
  for (const control of writableControls(panels)) {
    const id = variableId(control)!
    const variable = vars[id]
    if (control.rememberValue !== false || id in values || variable?.type !== 'user') continue
    const value = initialValue(control, variable)
    if (value !== undefined) values[id] = value
  }
  return values
}

export function rememberedVariableIds(
  panels: Record<string, PanelItem>,
  vars: Record<string, VarItem>
) {
  const reset = panelStartValues(panels, vars)
  return [
    ...new Set(
      writableControls(panels)
        .filter((control) => control.rememberValue !== false)
        .map((control) => variableId(control)!)
    )
  ].filter((id) => vars[id]?.type === 'user' && !(id in reset))
}

export function storeVariableValues(
  vars: Record<string, VarItem>,
  values: Record<string, PanelValue>
) {
  for (const [id, value] of Object.entries(values)) {
    const target = vars[id]?.value
    if (!target) continue
    const current = target.value ?? target.initValue
    const same = target.type === 'number' ? Number(current) === value : isEqual(current, value)
    if (!same) (target as { value?: PanelValue }).value = value
  }
}
