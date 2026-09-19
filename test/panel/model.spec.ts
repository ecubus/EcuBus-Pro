import { describe, expect, it, vi } from 'vitest'
import {
  arrangeControls,
  cloneDocument,
  createControl,
  createDocument,
  duplicateControls,
  PanelHistory,
  rangeFraction
} from '../../src/renderer/src/views/uds/panel/free/model'
import { resizeCanvas } from '../../src/renderer/src/views/uds/panel/free/model'

it('resizes the page without moving or clipping controls, and records a single undo step', () => {
  const doc = createDocument()
  const control = createControl('button', 'edge', 'Edge', 600, 300)
  doc.controls.push(control)
  const history = new PanelHistory(doc)
  resizeCanvas(doc, 10, 10)
  expect([doc.width, doc.height]).toEqual([760, 364])
  expect([control.x, control.y]).toEqual([600, 300])
  resizeCanvas(doc, 960, 640)
  history.record(doc)
  expect([history.undo().width, history.redo().height]).toEqual([800, 640])
  resizeCanvas(doc, 9000, 9000)
  expect([doc.width, doc.height]).toEqual([4096, 4096])
})
import {
  PanelConnection,
  sendControlValue,
  signalWriteIsUnique,
  type PanelUpdate
} from '../../src/renderer/src/views/uds/panel/free/runtime'

function fixture() {
  const document = createDocument()
  document.controls = ['a', 'b', 'c'].map((id, i) =>
    createControl('number', id, id, i * 200, i * 80)
  )
  return document
}
describe('panel document editing', () => {
  it('handles offset ranges, overflow and missing or invalid readings', () => {
    expect(rangeFraction(0, -40, 120)).toBe(0.25)
    expect(rangeFraction(-100, -40, 120)).toBe(0)
    expect(rangeFraction(200, -40, 120)).toBe(1)
    expect(rangeFraction('50', 0, 100)).toBe(0.5)
    for (const value of [undefined, '', ' ', 'invalid', Infinity, NaN])
      expect(rangeFraction(value, 0, 100)).toBeNull()
    expect(rangeFraction(1, 10, 10)).toBeNull()
    expect(rangeFraction(1, 20, 10)).toBeNull()
  })
  it('preserves embedded image data and fit through cloning and undo', () => {
    const doc = createDocument()
    doc.controls = [
      {
        ...createControl('image', 'image', 'Image'),
        imageSrc: 'data:image/png;base64,aGVsbG8=',
        imageFit: 'cover'
      }
    ]
    const history = new PanelHistory(doc)
    const initial = cloneDocument(doc)
    doc.controls[0].imageSrc = ''
    history.record(doc)
    expect(history.undo()).toEqual(initial)
    expect(history.redo()).toEqual(doc)
  })
  it('keeps the selected primary control as the alignment reference and skips locked controls', () => {
    const doc = fixture()
    doc.controls[2].locked = true
    arrangeControls(doc, ['b', 'a', 'c'], 'left')
    expect(doc.controls.map((c) => c.x)).toEqual([200, 200, 400])
  })
  it('distributes unequal widths with equal gaps while preserving endpoints', () => {
    const doc = fixture()
    doc.controls[1].width = 80
    arrangeControls(doc, ['c', 'a', 'b'], 'horizontal')
    const [a, b, c] = doc.controls
    expect(b.x - a.x - a.width).toBe(c.x - b.x - b.width)
    expect([a.x, c.x]).toEqual([0, 400])
  })
  it('duplicates independently with new ids and preserves JSON round trips', () => {
    const doc = fixture()
    duplicateControls(doc, ['a'], () => 'copy')
    doc.controls[3].label = 'copy'
    expect(doc.controls[0].label).toBe('a')
    expect(new Set(doc.controls.map((c) => c.id)).size).toBe(4)
    expect(cloneDocument(doc)).toEqual(doc)
  })
  it('undoes a group edit in one operation and drops redo after branching', () => {
    const doc = fixture()
    const history = new PanelHistory(doc)
    const original = cloneDocument(doc)
    arrangeControls(doc, ['a', 'b', 'c'], 'top')
    history.record(doc)
    expect(history.undo()).toEqual(original)
    expect(history.canRedo).toBe(true)
    const branch = history.undo()
    branch.controls.pop()
    history.record(branch)
    expect(history.canRedo).toBe(false)
  })
})
describe('panel runtime boundaries', () => {
  it('rejects signal writes that the name-only IPC cannot identify uniquely', () => {
    const c = createControl('number', 'signal', 'signal')
    const binding = {
      kind: 'signal' as const,
      node: {
        id: 's',
        name: 'Speed',
        type: 'signal' as const,
        color: '',
        enable: true,
        bindValue: {
          dbName: 'Vehicle',
          dbKey: 'db',
          signalName: 'Speed',
          frameId: 1,
          startBit: 0,
          bitLength: 8
        }
      }
    }
    const database = {
      can: { db: { name: 'Vehicle', messages: [{ signals: [{ name: 'Speed' }] }] } },
      lin: {},
      orti: {}
    } as unknown as Parameters<typeof signalWriteIsUnique>[1]
    expect(signalWriteIsUnique(binding, database)).toBe(true)
    database.can.db.messages.push(database.can.db.messages[0])
    expect(signalWriteIsUnique(binding, database)).toBe(false)
  })
  function control() {
    const c = createControl('button', 'button', 'button')
    c.binding = {
      kind: 'variable',
      node: {
        type: 'variable',
        id: 'var',
        name: 'value',
        enable: true,
        color: '',
        bindValue: {
          variableId: 'var',
          variableType: 'user',
          variableName: 'value',
          variableFullName: 'test.value',
          variableValueType: 'number'
        }
      }
    }
    return c
  }
  it('blocks stopped, read-only and system variable writes', () => {
    const c = control()
    const send = vi.fn()
    expect(sendControlValue(c, 1, false, send)).toBe(false)
    c.readOnly = true
    expect(sendControlValue(c, 1, true, send)).toBe(false)
    c.readOnly = false
    if (c.binding?.kind === 'variable') c.binding.node.bindValue.variableType = 'system'
    expect(sendControlValue(c, 1, true, send)).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })
  it('never writes from progress, gauge or image controls even with a writable binding', () => {
    const send = vi.fn()
    for (const type of ['progress', 'gauge', 'image'] as const)
      expect(sendControlValue({ ...control(), type }, 42, true, send)).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })
  it('sends exact press/release values and rejects non-finite values', () => {
    const c = control()
    const send = vi.fn()
    sendControlValue(c, 1, true, send)
    sendControlValue(c, 0, true, send)
    sendControlValue(c, NaN, true, send)
    expect(send.mock.calls).toEqual([
      ['ipc-var-set', { name: 'test.value', value: 1 }],
      ['ipc-var-set', { name: 'test.value', value: 0 }]
    ])
  })
  it('shares subscriptions, uses the last sample and cleans up on reconnect/close', () => {
    const listeners = new Map<string, (data: PanelUpdate) => void>()
    const bus = {
      on: vi.fn((key, fn) => listeners.set(key, fn)),
      off: vi.fn((key) => listeners.delete(key))
    }
    const update = vi.fn()
    const connection = new PanelConnection(bus, update)
    const a = control()
    const b = { ...control(), id: 'second' }
    connection.connect([a, b])
    expect(bus.on).toHaveBeenCalledTimes(1)
    listeners.get('var')!({
      key: 'var',
      values: [
        [1, { rawValue: 4 }],
        [2, { rawValue: 8 }]
      ]
    })
    expect(update.mock.calls).toEqual([
      ['button', 8],
      ['second', 8]
    ])
    connection.connect([a])
    expect(bus.off).toHaveBeenCalledTimes(1)
    connection.disconnect()
    expect(listeners.size).toBe(0)
  })
})
