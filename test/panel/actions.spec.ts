import { expect, it, vi } from 'vitest'
import type { PanelBinding } from '../../src/preload/panel'
import {
  createControl,
  cloneDocument,
  createDocument
} from '../../src/renderer/src/views/uds/panel/free/model'
import { acceptsBinding } from '../../src/renderer/src/views/uds/panel/free/sources'
import { sendControlValue } from '../../src/renderer/src/views/uds/panel/free/runtime'
import { actionAvailable, selectPath } from '../../src/renderer/src/views/uds/panel/free/actions'

function binding(type: 'number' | 'string'): PanelBinding {
  return {
    kind: 'variable',
    node: {
      id: 'value',
      type: 'variable',
      name: 'Value',
      enable: true,
      color: '',
      bindValue: {
        variableId: 'value',
        variableType: 'user',
        variableName: 'Value',
        variableFullName: 'Value',
        variableValueType: type
      }
    }
  }
}

it('exposes a standalone measurement control in either state without a variable binding', () => {
  const control = createControl('startStop', 'run', 'Run')
  expect(actionAvailable(control, false, () => false)).toBe(true)
  expect(actionAvailable(control, true, () => false)).toBe(true)
  expect(acceptsBinding(control, binding('number'))).toBe(false)
  control.readOnly = true
  expect(actionAvailable(control, false, () => false)).toBe(false)
})

it('writes exact strings including empty values only to string variables while running', () => {
  for (const type of ['input', 'path'] as const) {
    const control = createControl(type, type, type)
    control.binding = binding('string')
    const send = vi.fn()
    expect(acceptsBinding(control, binding('number'))).toBe(false)
    expect(sendControlValue(control, 'C:\\中文\\file.bin', true, send)).toBe(true)
    expect(sendControlValue(control, '', true, send)).toBe(true)
    expect(sendControlValue(control, 10, true, send)).toBe(false)
    expect(sendControlValue(control, 'ignored', false, send)).toBe(false)
    control.readOnly = true
    expect(sendControlValue(control, 'ignored', true, send)).toBe(false)
    expect(send.mock.calls.map((call) => call[1].value)).toEqual(['C:\\中文\\file.bin', ''])
  }
})

it('writes checkbox states and only declared radio values without string coercion', () => {
  const send = vi.fn()
  const check = {
    ...createControl('checkbox', 'c', 'Check'),
    binding: binding('number'),
    pressValue: 8,
    releaseValue: 2
  }
  expect(sendControlValue(check, 8, true, send)).toBe(true)
  expect(sendControlValue(check, 2, true, send)).toBe(true)
  expect(sendControlValue(check, '8', true, send)).toBe(false)
  const radio = { ...createControl('radio', 'r', 'Radio'), binding: binding('number') }
  expect(sendControlValue(radio, 1, true, send)).toBe(true)
  expect(sendControlValue(radio, 99, true, send)).toBe(false)
  expect(acceptsBinding(radio, binding('string'))).toBe(false)
})

it('enables actions without bindings and gates start/stop and missing targets', () => {
  const control = createControl('button', 'b', 'Button')
  const exists = (id: string) => id === 'panel'
  control.buttonAction = 'start'
  expect(actionAvailable(control, false, exists)).toBe(true)
  expect(actionAvailable(control, true, exists)).toBe(false)
  control.buttonAction = 'stop'
  expect(actionAvailable(control, true, exists)).toBe(true)
  expect(actionAvailable(control, false, exists)).toBe(false)
  control.buttonAction = 'openPanel'
  expect(actionAvailable(control, false, exists)).toBe(false)
  control.actionPanelId = 'panel'
  expect(actionAvailable(control, false, exists)).toBe(true)
  control.buttonAction = 'openFile'
  control.actionPath = 'notes.txt'
  expect(actionAvailable(control, false, exists)).toBe(true)
  control.binding = binding('number')
  expect(sendControlValue(control, 1, true, vi.fn())).toBe(false)
  control.readOnly = true
  expect(actionAvailable(control, false, exists)).toBe(false)
})

it('selects files, folders and save paths and ignores canceled dialogs', async () => {
  const invoke = vi.fn().mockResolvedValue({ canceled: false, filePaths: ['picked'] })
  expect(await selectPath('directory', 'previous', invoke)).toBe('picked')
  expect(invoke).toHaveBeenLastCalledWith('ipc-show-open-dialog', {
    defaultPath: 'previous',
    properties: ['openDirectory']
  })
  await selectPath('file', '', invoke)
  expect(invoke).toHaveBeenLastCalledWith('ipc-show-open-dialog', { properties: ['openFile'] })
  invoke.mockResolvedValue({ canceled: false, filePath: 'output' })
  expect(await selectPath('save', '', invoke)).toBe('output')
  expect(invoke).toHaveBeenLastCalledWith('ipc-show-save-dialog', {})
  invoke.mockResolvedValue({ canceled: true, filePaths: ['ignored'] })
  expect(await selectPath('file', '', invoke)).toBeUndefined()
})

it('persists new controls and action configuration without changing old button defaults', () => {
  const doc = createDocument()
  doc.controls = (['input', 'path', 'checkbox', 'radio', 'button'] as const).map((type) =>
    createControl(type, type, type)
  )
  doc.controls[0].initialText = '中文'
  doc.controls[1].pathMode = 'save'
  doc.controls[4].buttonAction = 'openFile'
  doc.controls[4].actionPath = 'file.txt'
  expect(cloneDocument(doc)).toEqual(doc)
  expect(createControl('button', 'old', 'Old').buttonAction).toBeUndefined()
})
