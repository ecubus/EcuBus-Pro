import type { DataSet } from 'src/preload/data'
import { migrateLegacyPanel } from '../views/uds/panel/free/migration'

const ruleKeys = new Set([
  'type',
  'title',
  'field',
  'value',
  'props',
  'options',
  'children',
  '_fc_id',
  '_fc_drag_tag',
  'name',
  'display',
  'hidden',
  'info',
  'style',
  'effect',
  'on',
  'control',
  'link',
  'validate',
  '$required'
])

export function upgradeLegacyPanels(data: Pick<DataSet, 'panels' | 'vars'>) {
  for (const panel of Object.values(data.panels || {})) {
    if (panel.document || !Array.isArray(panel.rule) || !panel.rule.length) continue
    const options = panel.options as Record<string, any>
    const form = options?.form || {}
    if (
      Object.keys(options || {}).some(
        (key) => !['formName', 'form', 'submitBtn', 'resetBtn'].includes(key)
      ) ||
      Object.keys(form).some(
        (key) =>
          !['inline', 'hideRequiredAsterisk', 'labelPosition', 'size', 'labelWidth'].includes(key)
      ) ||
      form.inline ||
      (form.size && form.size !== 'default') ||
      [options?.submitBtn, options?.resetBtn].some((button) => button && button.show !== false)
    )
      continue
    if (
      panel.rule.some(
        (rule) =>
          !rule ||
          (rule.children && !Array.isArray(rule.children)) ||
          Object.keys(rule).some((key) => !ruleKeys.has(key)) ||
          rule.info ||
          (rule.style &&
            (rule.type !== 'TText' ||
              Object.entries(rule.style).some(
                ([key, value]) =>
                  !(
                    (key === 'whiteSpace' && value === 'pre-line') ||
                    (key === 'width' && value === '100%')
                  )
              )))
      )
    )
      continue
    const result = migrateLegacyPanel(panel, data.vars)
    if (result.skipped.length || result.document.controls.length !== panel.rule.length) continue
    if (
      result.document.controls.some((control) => {
        if (control.binding?.kind !== 'variable') return false
        const valueType = control.binding.node.bindValue.variableValueType
        return !valueType || (control.type !== 'display' && valueType !== 'number')
      })
    )
      continue
    for (const control of result.document.controls) {
      if (control.type !== 'text' && control.type !== 'button')
        control.labelPosition = form.labelPosition === 'top' ? 'top' : 'left'
    }
    panel.document = result.document
  }
}
