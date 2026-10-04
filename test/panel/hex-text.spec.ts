import { expect, it, vi } from 'vitest'
import {
  formatHex,
  parseEditorValue,
  validBytes
} from '../../src/renderer/src/views/uds/panel/free/hexText'
import { createControl } from '../../src/renderer/src/views/uds/panel/free/model'
import { sendControlValue } from '../../src/renderer/src/views/uds/panel/free/runtime'

it('round trips text using UTF-8 without losing NUL bytes or non-ASCII characters', () => {
  for (const text of ['', 'Hello', '中文', 'A\0B'])
    expect(parseEditorValue(formatHex(text), true, false)).toBe(text)
  expect(parseEditorValue('00 7f\nFF', true, true)).toEqual([0, 127, 255])
  expect(formatHex([0, 127, 255])).toBe('00 7F FF')
  expect(parseEditorValue('Aÿ', false, true)).toEqual([65, 255])
  expect(() => parseEditorValue('中文', false, true)).toThrow()
})

it('rejects incomplete hex, nonhex characters, and invalid UTF-8 for string targets', () => {
  for (const input of ['0', 'GG', '01 2', '0xAA'])
    expect(() => parseEditorValue(input, true, true)).toThrow()
  expect(() => parseEditorValue('FF', true, false)).toThrow()
  expect(validBytes([256])).toBe(false)
  expect(validBytes([-1])).toBe(false)
  expect(validBytes([1.5])).toBe(false)
})

it('writes validated byte arrays only to writable array variables', () => {
  const control = createControl('input', 'hex', 'Hex')
  control.binding = {
    kind: 'variable',
    node: {
      id: 'bytes',
      name: 'Bytes',
      type: 'variable',
      enable: true,
      color: '',
      bindValue: {
        variableId: 'bytes',
        variableName: 'Bytes',
        variableFullName: 'Bytes',
        variableType: 'user',
        variableValueType: 'array'
      }
    }
  }
  const send = vi.fn()
  expect(sendControlValue(control, [0, 255], true, send)).toBe(true)
  expect(sendControlValue(control, [256], true, send)).toBe(false)
  expect(sendControlValue(control, '00 FF', true, send)).toBe(false)
  expect(sendControlValue(control, [], false, send)).toBe(false)
  expect(send).toHaveBeenCalledExactlyOnceWith('ipc-var-set', { name: 'Bytes', value: [0, 255] })
})
