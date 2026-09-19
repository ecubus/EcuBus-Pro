import type { PanelItem, VarItem } from 'src/preload/data'
import type { PanelControlType } from 'src/preload/panel'
import { createControl, createDocument } from './model'

interface LegacyOption {
  label: unknown
  value: number
  disabled?: boolean
  children?: unknown
}

const types: Record<string, PanelControlType> = {
  TText: 'text',
  inputNumber: 'number',
  slider: 'slider',
  BButton: 'button',
  select: 'select'
}
const sharedProps = ['variable', 'signal', 'disabled']
const propsByType: Record<string, string[]> = {
  TText: ['initValue'],
  inputNumber: ['min', 'max', 'step'],
  slider: ['min', 'max', 'step'],
  BButton: ['pressValue', 'releaseValue', 'toggleMode', 'type', 'plain', 'round', 'circle'],
  select: []
}

export function migrateLegacyPanel(panel: PanelItem, variables?: Record<string, VarItem>) {
  const document = createDocument()
  const skipped: {
    item: string
    reason: 'migrationType' | 'migrationBehavior' | 'migrationValue'
  }[] = []
  for (const [index, rule] of panel.rule.entries()) {
    const item = `${index + 1}. ${rule?.title || rule?.field || rule?.type || '?'}`
    const skip = (reason: (typeof skipped)[number]['reason']) => skipped.push({ item, reason })
    const type = Object.hasOwn(types, rule?.type) ? types[rule.type] : undefined
    if (!type) {
      skip('migrationType')
      continue
    }
    const props = rule.props || {}
    const active = (value: unknown) =>
      value != null &&
      value !== false &&
      value !== '' &&
      (typeof value !== 'object' || Object.keys(value).length > 0)
    if (
      (rule.display != null && rule.display !== true) ||
      ['on', 'control', 'link', 'hidden', 'validate', '$required'].some((key) =>
        active(rule[key])
      ) ||
      Object.values(rule.effect || {}).some(active) ||
      Object.keys(props).some(
        (key) => ![...sharedProps, ...propsByType[rule.type]].includes(key) && active(props[key])
      ) ||
      (rule.children &&
        (type !== 'button' || rule.children.some((child: unknown) => typeof child !== 'string')))
    ) {
      skip('migrationBehavior')
      continue
    }
    const node = props.variable || props.signal
    if (
      node &&
      (!node.id ||
        !node.bindValue ||
        (props.variable ? !node.bindValue.variableFullName : !node.bindValue.signalName))
    ) {
      skip('migrationValue')
      continue
    }
    const control = createControl(
      type === 'text' && node ? 'display' : type,
      `migrated-${index + 1}`,
      String(rule.title || ''),
      32,
      32 + document.controls.length * 96
    )
    if (type === 'number') {
      control.min = -Number.MAX_VALUE
      control.max = Number.MAX_VALUE
    }
    if (type === 'text' && !node) control.label = String(rule.value ?? props.initValue ?? 'Text')
    if (type === 'button') control.label = rule.children?.join('') || control.label
    const values = {
      min: props.min,
      max: props.max,
      step: props.step,
      pressValue: props.pressValue,
      releaseValue: props.releaseValue,
      initialValue: type === 'text' && !node ? undefined : rule.value
    }
    if (
      Object.values(values).some(
        (value) => value != null && (typeof value !== 'number' || !Number.isFinite(value))
      )
    ) {
      skip('migrationValue')
      continue
    }
    for (const key of Object.keys(values) as (keyof typeof values)[]) {
      if (values[key] != null) control[key] = values[key]
    }
    if (control.max < control.min || control.step <= 0) {
      skip('migrationValue')
      continue
    }
    if (type === 'select') {
      if (
        !Array.isArray(rule.options) ||
        rule.options.some(
          (option: LegacyOption) =>
            !option ||
            typeof option.value !== 'number' ||
            !Number.isFinite(option.value) ||
            option.disabled ||
            option.children
        )
      ) {
        skip('migrationValue')
        continue
      }
      control.options = rule.options.map((option: LegacyOption) => ({
        label: String(option.label),
        value: option.value
      }))
    }
    control.readOnly = !!props.disabled
    control.toggle = !!props.toggleMode
    if (type === 'button') {
      if (
        (props.type &&
          !['default', 'primary', 'success', 'warning', 'danger', 'info'].includes(props.type)) ||
        props.round
      ) {
        skip('migrationBehavior')
        continue
      }
      if (props.type && props.type !== 'default') control.buttonVariant = props.type
      if (props.plain) control.buttonPlain = true
      if (props.circle) control.buttonShape = 'circle'
    }
    if (node)
      control.binding = JSON.parse(
        JSON.stringify({ kind: props.variable ? 'variable' : 'signal', node })
      )
    if (control.binding?.kind === 'variable') {
      const target = control.binding.node.bindValue
      const variable = variables?.[target.variableId]
      if (!target.variableValueType && variable?.value)
        target.variableValueType = variable.value.type
    }
    document.controls.push(control)
  }
  document.height = Math.max(480, 64 + document.controls.length * 96)
  return { document, skipped }
}

export function migrationCopyName(name: string, panels: Record<string, PanelItem>) {
  let index = 1
  while (Object.values(panels).some((panel) => panel.name === `${name} (V2 ${index})`)) index++
  return `${name} (V2 ${index})`
}
