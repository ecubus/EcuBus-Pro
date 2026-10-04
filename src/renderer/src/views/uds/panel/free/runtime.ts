import type { PanelBinding, PanelControl } from 'src/preload/panel'
import { validBytes } from './hexText'
import { acceptsBinding } from './sources'
import type { DataSet } from 'src/preload/data'

export function signalWriteIsUnique(binding: PanelBinding, database: DataSet['database']) {
  if (binding.kind !== 'signal') return true
  const target = binding.node.bindValue
  const can = Object.values(database.can).filter((db) => db.name === target.dbName)
  const lin = Object.values(database.lin).filter((db) => db.name === target.dbName)
  if (can.length + lin.length !== 1) return false
  return can.length === 1
    ? can[0].messages
        .flatMap((message) => message.signals)
        .filter((signal) => signal.name === target.signalName).length === 1
    : !!lin[0].signals[target.signalName]
}

export function physicalWriteAvailable(control: PanelControl, database: DataSet['database']) {
  if (
    control.type !== 'number' ||
    control.numberValueType !== 'physical' ||
    control.binding?.kind !== 'signal'
  )
    return true
  const target = control.binding.node.bindValue
  const can = database.can[target.dbKey]?.messages
    .find((m) => m.id === target.frameId)
    ?.signals.find((s) => s.name === target.signalName)
  if (can)
    return (
      can.is_float ||
      (Number.isFinite(Number(can.factor)) &&
        Number(can.factor) !== 0 &&
        Number.isFinite(Number(can.offset)))
    )
  const lin = database.lin[target.dbKey]
  const encoding =
    lin &&
    Object.entries(lin.signalRep || {}).find(([, signals]) =>
      signals.includes(target.signalName)
    )?.[0]
  return (
    !!encoding &&
    !!lin.signalEncodeTypes[encoding]?.encodingTypes.some(
      (item) =>
        item.type === 'physicalValue' &&
        item.physicalValue &&
        Number.isFinite(item.physicalValue.scale) &&
        item.physicalValue.scale !== 0
    )
  )
}

export type PanelValue = number | string | number[]
export type PanelUpdate = {
  key: string
  values: [number, { rawValue: PanelValue; value?: PanelValue }][]
}
export type PanelBus = {
  on: (key: string, listener: (data: PanelUpdate) => void) => unknown
  off: (key: string, listener: (data: PanelUpdate) => void) => unknown
}

export function writeTarget(binding: PanelBinding) {
  if (binding.kind === 'variable') {
    const value = binding.node.bindValue
    return value.variableType === 'user' &&
      ['number', 'string', 'array'].includes(value.variableValueType || '')
      ? { channel: 'ipc-var-set', name: value.variableFullName }
      : null
  }
  return {
    channel: 'ipc-signal-set',
    name: `${binding.node.bindValue.dbName}.${binding.node.bindValue.signalName}`
  }
}

export function canWrite(control: PanelControl) {
  return (
    !control.readOnly &&
    [
      'number',
      'input',
      'path',
      'checkbox',
      'radio',
      'button',
      'switch',
      'slider',
      'select'
    ].includes(control.type) &&
    !!control.binding &&
    acceptsBinding(control, control.binding) &&
    !!writeTarget(control.binding)
  )
}

export class PanelConnection {
  private listeners = new Map<string, (data: PanelUpdate) => void>()
  constructor(
    private bus: PanelBus,
    private update: (id: string, value: PanelValue) => void
  ) {}
  connect(controls: PanelControl[]) {
    this.disconnect()
    const groups = new Map<string, PanelControl[]>()
    controls.forEach((control) => {
      if (!control.binding) return
      const key = control.binding.node.id
      groups.set(key, [...(groups.get(key) || []), control])
    })
    groups.forEach((ids, key) => {
      const listener = (data: PanelUpdate) => {
        const latest = data.values[data.values.length - 1]
        if (!latest) return
        ids.forEach((control) =>
          this.update(
            control.id,
            control.binding?.kind === 'signal' &&
              ['display', 'number'].includes(control.type) &&
              control.numberValueType === 'physical'
              ? (latest[1].value ?? NaN)
              : latest[1].rawValue
          )
        )
      }
      this.listeners.set(key, listener)
      this.bus.on(key, listener)
    })
  }
  disconnect() {
    this.listeners.forEach((listener, key) => this.bus.off(key, listener))
    this.listeners.clear()
  }
}

export function sendControlValue(
  control: PanelControl,
  value: PanelValue,
  running: boolean,
  send: (channel: string, data: { name: string; value: PanelValue }) => void
) {
  if (!running || !canWrite(control)) return false
  const array =
    control.type === 'input' &&
    control.binding?.kind === 'variable' &&
    control.binding.node.bindValue.variableValueType === 'array'
  const text = ['input', 'path'].includes(control.type)
  if (
    array
      ? !validBytes(value)
      : text
        ? typeof value !== 'string'
        : typeof value !== 'number' || !Number.isFinite(value)
  )
    return false
  if (control.type === 'radio' && !control.options.some((option) => option.value === value))
    return false
  const target = writeTarget(control.binding!)!
  const physical =
    control.type === 'number' &&
    control.binding?.kind === 'signal' &&
    control.numberValueType === 'physical'
  send(target.channel, { name: target.name, value: physical ? String(value) : value })
  return true
}
