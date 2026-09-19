import { describe, expect, it } from 'vitest'
import type { PanelItem } from '../../src/preload/data'
import {
  migrateLegacyPanel,
  migrationCopyName
} from '../../src/renderer/src/views/uds/panel/free/migration'

const panel = (rule: any[]): PanelItem => ({ id: 'old', name: 'Old', rule, options: {} })

describe('legacy panel migration', () => {
  it('preserves numeric values, button semantics and variable precedence without mutating the source', () => {
    const node = { id: 'level', bindValue: { variableFullName: 'Level' } }
    const source = panel([
      { type: 'TText', props: { initValue: 'Caption' } },
      { type: 'TText', title: 'Reading', props: { variable: node } },
      { type: 'inputNumber', value: -2, props: { min: -10, max: 10, step: 0.5 } },
      {
        type: 'BButton',
        children: ['Hold'],
        props: {
          pressValue: 5,
          releaseValue: -1,
          toggleMode: true,
          variable: node,
          signal: { id: 'other' }
        }
      },
      { type: 'select', value: 2, options: [{ label: 'Two', value: 2 }] },
      { type: 'slider', value: 3, props: { disabled: true } }
    ])
    const before = JSON.stringify(source)
    const { document, skipped } = migrateLegacyPanel(source)
    expect(skipped).toEqual([])
    expect(document.controls.map((c) => c.type)).toEqual([
      'text',
      'display',
      'number',
      'button',
      'select',
      'slider'
    ])
    expect(document.controls[0].label).toBe('Caption')
    expect(document.controls[2]).toMatchObject({ initialValue: -2, min: -10, max: 10, step: 0.5 })
    expect(document.controls[3]).toMatchObject({
      label: 'Hold',
      pressValue: 5,
      releaseValue: -1,
      toggle: true,
      binding: { kind: 'variable', node }
    })
    expect(document.controls[4].options).toEqual([{ label: 'Two', value: 2 }])
    expect(document.controls[5].readOnly).toBe(true)
    document.controls[3].binding!.node.id = 'changed'
    expect(JSON.stringify(source)).toBe(before)
    for (const c of document.controls) expect(c.y + c.height).toBeLessThanOrEqual(document.height)
  })

  it('reports incompatible containers, events, props and values without flattening or coercion', () => {
    const { document, skipped } = migrateLegacyPanel(
      panel([
        { type: 'grid', children: [{ type: 'inputNumber' }] },
        { type: 'BButton', on: { click: 'script' } },
        { type: 'slider', props: { range: true }, value: [1, 2] },
        { type: 'select', options: [{ label: 'String', value: '2' }] },
        { type: 'inputNumber', value: '3' },
        { type: 'BButton', props: { pressValue: true } },
        { type: 'TText', props: { variable: { id: 'broken' } } },
        { type: 'select', props: { multiple: true } },
        { type: 'slider', props: { step: 0 } }
      ])
    )
    expect(document.controls).toEqual([])
    expect(skipped).toHaveLength(9)
    expect(skipped[0]).toMatchObject({ item: '1. grid', reason: 'migrationType' })
  })

  it('uses independent ids and non-conflicting copy names', () => {
    const source = panel([
      { type: 'inputNumber', field: 'same' },
      { type: 'inputNumber', field: 'same' }
    ])
    expect(new Set(migrateLegacyPanel(source).document.controls.map((c) => c.id)).size).toBe(2)
    expect(migrationCopyName('Old', { old: source, copy: { ...source, name: 'Old (V2 1)' } })).toBe(
      'Old (V2 2)'
    )
  })
})
