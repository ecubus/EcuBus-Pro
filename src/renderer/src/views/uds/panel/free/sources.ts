import type { DataSet } from 'src/preload/data'
import type { PanelBinding, PanelControl } from 'src/preload/panel'

export interface PanelSource {
  key: string
  label: string
  binding: PanelBinding
}
export function panelSources(
  database: DataSet['database'],
  variables: DataSet['vars']
): PanelSource[] {
  const entries: PanelSource[] = []
  for (const [key, db] of Object.entries(database.can)) {
    for (const frame of db.messages)
      for (const signal of frame.signals) {
        entries.push({
          key: `can:${key}:${frame.id}:${signal.name}`,
          label: `CAN.${db.name}.${frame.name}.${signal.name}`,
          binding: {
            kind: 'signal',
            node: {
              type: 'signal',
              enable: true,
              color: '',
              name: signal.name,
              id: `can.${db.name}.${frame.name}.signals.${signal.name}`,
              yAxis: {
                enums: signal.values
                  ? Object.entries(signal.values).map(([value, label]) => ({
                      value: Number(value),
                      label
                    }))
                  : undefined
              },
              bindValue: {
                dbKey: key,
                dbName: db.name,
                frameId: frame.id,
                signalName: signal.name,
                startBit: signal.start_bit,
                bitLength: signal.bit_length
              }
            }
          }
        })
      }
  }
  for (const [key, db] of Object.entries(database.lin)) {
    for (const frame of Object.values(db.frames))
      for (const signal of frame.signals) {
        const definition = db.signals[signal.name]
        if (!definition) continue
        const encoding =
          definition.singleType !== 'ByteArray'
            ? Object.entries(db.signalRep || {}).find(([, names]) =>
                names.includes(signal.name)
              )?.[0]
            : undefined
        const enums = encoding
          ? db.signalEncodeTypes[encoding]?.encodingTypes.flatMap((item) =>
              item.type === 'logicalValue' && item.logicalValue
                ? [
                    {
                      label: item.logicalValue.textInfo || '',
                      value: item.logicalValue.signalValue
                    }
                  ]
                : []
            )
          : undefined
        entries.push({
          key: `lin:${key}:${frame.id}:${signal.name}`,
          label: `LIN.${db.name}.${frame.name}.${signal.name}`,
          binding: {
            kind: 'signal',
            node: {
              type: 'signal',
              enable: true,
              color: '',
              name: signal.name,
              id: `lin.${db.name}.${frame.name}.signals.${signal.name}`,
              yAxis: { enums },
              bindValue: {
                dbKey: key,
                dbName: db.name,
                frameId: frame.id,
                signalName: signal.name,
                startBit: signal.offset,
                bitLength: definition.signalSizeBits
              }
            }
          }
        })
      }
  }
  for (const variable of Object.values(variables)) {
    if (!variable.value) continue
    const names = [variable.name]
    const seen = new Set([variable.id])
    let parent = variable.parentId
    while (parent && !seen.has(parent)) {
      seen.add(parent)
      const item = variables[parent]
      if (!item) break
      names.unshift(item.name)
      parent = item.parentId
    }
    const fullName = names.join('.')
    entries.push({
      key: `var:${variable.id}`,
      label: fullName,
      binding: {
        kind: 'variable',
        node: {
          type: 'variable',
          enable: true,
          color: '',
          id: variable.id,
          name: variable.name,
          yAxis:
            variable.value.type === 'number'
              ? { min: variable.value.min, max: variable.value.max, unit: variable.value.unit }
              : undefined,
          bindValue: {
            variableId: variable.id,
            variableType: variable.type,
            variableName: variable.name,
            variableFullName: fullName,
            variableValueType: variable.value.type,
            stringRange: variable.value.type === 'number' ? variable.value.enum : undefined
          }
        }
      }
    })
  }
  return entries
}
export function acceptsBinding(control: PanelControl, binding: PanelBinding) {
  if (control.type === 'input')
    return (
      binding.kind === 'variable' &&
      ['string', 'array'].includes(binding.node.bindValue.variableValueType || '')
    )
  if (control.type === 'path')
    return binding.kind === 'variable' && binding.node.bindValue.variableValueType === 'string'
  if (control.type === 'button' && control.buttonAction && control.buttonAction !== 'write')
    return false
  return (
    !['text', 'image', 'html', 'group', 'tabs', 'startStop'].includes(control.type) &&
    (binding.kind === 'signal' ||
      binding.node.bindValue.variableValueType === 'number' ||
      control.type === 'display')
  )
}
export function applyBinding(control: PanelControl, binding: PanelBinding) {
  if (!acceptsBinding(control, binding)) return false
  const first = !control.binding
  control.binding = JSON.parse(JSON.stringify(binding))
  if (first) {
    if (binding.kind === 'variable') {
      const axis = binding.node.yAxis as { min?: number; max?: number; unit?: string } | undefined
      if (typeof axis?.min === 'number') control.min = axis.min
      if (typeof axis?.max === 'number') control.max = Math.max(control.min, axis.max)
      control.unit = axis?.unit || ''
      control.options =
        binding.node.bindValue.stringRange?.map((o) => ({ label: o.name, value: o.value })) || []
    } else {
      const axis = binding.node.yAxis as { enums?: { label: string; value: number }[] } | undefined
      control.options = axis?.enums?.map((option) => ({ ...option })) || []
    }
  }
  return true
}
