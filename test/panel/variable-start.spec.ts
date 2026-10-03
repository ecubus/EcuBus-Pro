import { expect, it } from 'vitest'
import type { PanelItem, VarItem } from '../../src/preload/data'
import type { PanelControl, PanelControlType } from '../../src/preload/panel'
import { createControl, createDocument } from '../../src/renderer/src/views/uds/panel/free/model'
import {
  panelStartValues,
  rememberedVariableIds,
  storeVariableValues
} from '../../src/renderer/src/views/uds/panel/free/variableStart'

const variable = (
  id: string,
  value: VarItem['value'],
  type: VarItem['type'] = 'user'
): VarItem => ({
  id,
  name: id,
  type,
  value
})

function control(
  type: PanelControlType,
  id: string,
  variableId: string,
  valueType: 'number' | 'string' | 'array',
  patch: Partial<PanelControl> = {}
): PanelControl {
  return {
    ...createControl(type, id, id),
    binding: {
      kind: 'variable',
      node: {
        id: variableId,
        name: variableId,
        type: 'variable',
        enable: true,
        color: '',
        bindValue: {
          variableId,
          variableType: 'user',
          variableName: variableId,
          variableFullName: variableId,
          variableValueType: valueType
        }
      }
    } as PanelControl['binding'],
    ...patch
  }
}

function panels(...controls: PanelControl[]): Record<string, PanelItem> {
  return {
    panel: {
      id: 'panel',
      name: 'Panel',
      rule: [],
      options: {},
      document: { ...createDocument(), controls }
    }
  }
}

const vars = {
  level: variable('level', { type: 'number', initValue: 5 }),
  text: variable('text', { type: 'string', initValue: 'default' }),
  bytes: variable('bytes', { type: 'array', initValue: [] })
}

it('uses control initial values only when remember value is off', () => {
  expect(
    panelStartValues(
      panels(
        control('slider', 'kept', 'level', 'number', { initialValue: 9 }),
        control('input', 'path', 'text', 'string', { rememberValue: false, initialText: 'reset' }),
        control('input', 'raw', 'bytes', 'array', {
          rememberValue: false,
          editorMode: 'hex',
          initialText: '01 ff'
        })
      ),
      vars
    )
  ).toEqual({ text: 'reset', bytes: [1, 255] })
})

it('defaults to zero or empty text and lets any disabled control reset a shared variable', () => {
  const layout = panels(
    control('slider', 'kept', 'level', 'number'),
    control('number', 'reset', 'level', 'number', { rememberValue: false }),
    control('path', 'path', 'text', 'string', { rememberValue: false })
  )
  expect(panelStartValues(layout, vars)).toEqual({ level: 0, text: '' })
  expect(rememberedVariableIds(layout, vars)).toEqual([])
})

it('writes back only user variables bound to writable remembering controls', () => {
  const layout = panels(
    control('slider', 'kept', 'level', 'number'),
    control('slider', 'readonly', 'text', 'string', { readOnly: true }),
    control('number', 'system', 'sys', 'number')
  )
  expect(
    rememberedVariableIds(layout, {
      ...vars,
      sys: variable('sys', { type: 'number', initValue: 0 }, 'system')
    })
  ).toEqual(['level'])
})

it('stores changed values and leaves unchanged values untouched', () => {
  const store = {
    level: variable('level', { type: 'number', initValue: '5' as unknown as number }),
    bytes: variable('bytes', { type: 'array', initValue: [1], value: [2] })
  }
  storeVariableValues(store, { level: 5, bytes: [2] })
  expect(store.level.value).toEqual({ type: 'number', initValue: '5' })
  expect(store.bytes.value).toEqual({ type: 'array', initValue: [1], value: [2] })
  storeVariableValues(store, { level: 7, bytes: [3], missing: 1 })
  expect(store.level.value?.value).toBe(7)
  expect(store.bytes.value?.value).toEqual([3])
})
