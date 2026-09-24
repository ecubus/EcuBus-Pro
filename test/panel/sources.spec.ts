import { describe, expect, it } from 'vitest'
import type { DataSet } from '../../src/preload/data'
import {
  panelSources,
  acceptsBinding,
  applyBinding
} from '../../src/renderer/src/views/uds/panel/free/sources'
import {
  commonProperties,
  patchControls
} from '../../src/renderer/src/views/uds/panel/free/properties'
import {
  cloneDocument,
  createControl,
  createDocument,
  PanelHistory
} from '../../src/renderer/src/views/uds/panel/free/model'

function fixture() {
  const database = {
    can: {
      db: {
        name: 'Vehicle',
        messages: [
          {
            id: 256,
            name: 'Status',
            signals: [{ name: 'Mode', start_bit: 0, bit_length: 8, values: { 0: 'Off', 1: 'On' } }]
          }
        ]
      }
    },
    lin: {
      ldf: {
        name: 'Lighting',
        frames: { frame: { id: 16, name: 'Lamp', signals: [{ name: 'Brightness', offset: 8 }] } },
        signals: { Brightness: { signalSizeBits: 8 } },
        signalRep: { brightness: ['Brightness'] },
        signalEncodeTypes: {
          brightness: {
            encodingTypes: [
              { type: 'logicalValue', logicalValue: { signalValue: 0, textInfo: 'Off' } }
            ]
          }
        }
      }
    }
  } as unknown as DataSet['database']
  const variables = {
    root: { id: 'root', name: 'Vehicle', type: 'user' },
    level: {
      id: 'level',
      name: 'Level',
      parentId: 'root',
      type: 'user',
      value: { type: 'number', min: -10, max: 0, unit: '%', enum: [{ name: 'Off', value: 0 }] }
    },
    text: { id: 'text', name: 'State', type: 'system', value: { type: 'string' } }
  } as DataSet['vars']
  return { database, variables }
}
describe('panel sources and batch properties', () => {
  it('builds CAN and LIN event identities and complete variable paths', () => {
    const { database, variables } = fixture()
    const entries = panelSources(database, variables)
    expect(entries.map((s) => s.binding.node.id)).toEqual([
      'can.Vehicle.Status.signals.Mode',
      'lin.Lighting.Lamp.signals.Brightness',
      'level',
      'text'
    ])
    expect(entries.find((s) => s.key === 'var:level')!.label).toBe('Vehicle.Level')
    expect(entries[1].binding.node.yAxis).toMatchObject({ enums: [{ label: 'Off', value: 0 }] })
    const control = createControl('select', 'select', 'Select')
    applyBinding(control, entries[0].binding)
    control.options[0].label = 'Changed'
    expect(entries[0].binding.node.yAxis).toMatchObject({
      enums: [
        { label: 'Off', value: 0 },
        { label: 'On', value: 1 }
      ]
    })
    expect(entries[1].binding.node.bindValue).toMatchObject({
      dbKey: 'ldf',
      frameId: 16,
      startBit: 8,
      bitLength: 8
    })
  })
  it('keeps library keys distinct for identically named databases', () => {
    const { database, variables } = fixture()
    database.can.copy = database.can.db
    const entries = panelSources(database, variables)
    expect(new Set(entries.map((s) => s.key)).size).toBe(entries.length)
  })
  it('copies metadata on first binding, preserves zero maximum and user settings on rebind', () => {
    const { database, variables } = fixture()
    const binding = panelSources(database, variables).find((s) => s.key === 'var:level')!.binding
    const control = createControl('slider', 'slider', 'Slider')
    expect(applyBinding(control, binding)).toBe(true)
    expect([control.min, control.max, control.unit]).toEqual([-10, 0, '%'])
    control.min = -100
    control.unit = 'custom'
    applyBinding(control, binding)
    expect([control.min, control.unit]).toEqual([-100, 'custom'])
    control.binding!.node.name = 'Edited'
    expect(binding.node.name).toBe('Level')
  })
  it('rejects nonnumeric binding for input controls and accepts it for display', () => {
    const { database, variables } = fixture()
    const binding = panelSources(database, variables).find((s) => s.key === 'var:text')!.binding
    expect(acceptsBinding(createControl('number', 'n', 'Number'), binding)).toBe(false)
    expect(acceptsBinding(createControl('display', 'd', 'Display'), binding)).toBe(true)
    expect(acceptsBinding(createControl('group', 'g', 'Group'), binding)).toBe(false)
  })
  it('only exposes properties shared by all selected control types', () => {
    const number = createControl('number', 'n', 'Number')
    const gauge = createControl('gauge', 'g', 'Gauge')
    expect(commonProperties([number, gauge])).toEqual(['unit', 'min', 'max', 'initialValue'])
    expect(commonProperties([number, createControl('text', 't', 'Text')])).toEqual([])
    expect(commonProperties([number, createControl('slider', 's', 'Slider')])).toContain('step')
  })
  it('updates unlocked controls in one history entry and normalizes ranges', () => {
    const doc = createDocument()
    doc.controls = ['a', 'b', 'c'].map((id) => createControl('slider', id, id))
    doc.controls[2].locked = true
    const original = cloneDocument(doc)
    const history = new PanelHistory(doc)
    patchControls(doc, ['a', 'b', 'c'], 'min', 200)
    history.record(doc)
    expect(doc.controls.map((c) => [c.min, c.max])).toEqual([
      [200, 200],
      [200, 200],
      [0, 100]
    ])
    expect(history.undo()).toEqual(original)
    expect(history.redo()).toEqual(doc)
  })
  it('does not update descendants of a locked parent', () => {
    const doc = createDocument()
    const group = createControl('group', 'g', 'Group')
    group.locked = true
    const child = { ...createControl('number', 'n', 'Number'), parentId: 'g' }
    doc.controls = [group, child]
    patchControls(doc, ['n'], 'unit', 'V')
    expect(child.unit).toBe('')
  })
})
