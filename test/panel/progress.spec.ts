import { describe, expect, it } from 'vitest'
import {
  createControl,
  createDocument,
  PanelHistory
} from '../../src/renderer/src/views/uds/panel/free/model'
import { progressPresentation } from '../../src/renderer/src/views/uds/panel/free/progress'
import { patchControls } from '../../src/renderer/src/views/uds/panel/free/properties'

describe('engineering progress bar', () => {
  it('keeps old documents horizontal with unrounded values and units', () => {
    const c = createControl('progress', 'p', 'Load')
    c.unit = 'A'
    expect(progressPresentation(c, 42.125)).toMatchObject({
      text: '42.125 A',
      direction: 'right',
      fill: { left: '0%', width: '42.125%' }
    })
  })
  it.each(['right', 'left', 'up', 'down'] as const)(
    'fills from the configured origin toward %s',
    (direction) => {
      const c = {
        ...createControl('progress', 'p', 'Torque'),
        min: -100,
        max: 100,
        progressOrigin: 0,
        progressDirection: direction
      }
      const output = progressPresentation(c, -50)
      const edge = { right: 'left', left: 'right', up: 'bottom', down: 'top' }[direction]
      expect(output.fill).toEqual({ [edge]: '25%', [output.vertical ? 'height' : 'width']: '25%' })
    }
  )
  it('formats percentages against the range, clamps the fill and keeps raw overrange readings', () => {
    const c = {
      ...createControl('progress', 'p', 'Load'),
      min: -50,
      max: 150,
      progressDecimals: 1,
      progressText: 'percent' as const
    }
    expect(progressPresentation(c, 0).text).toBe('25.0%')
    expect(progressPresentation(c, 300).text).toBe('100.0%')
    expect(progressPresentation({ ...c, progressText: 'value' }, 300).text).toBe('300.0')
  })
  it('renders missing, invalid and stopped values without an active fill', () => {
    const c = { ...createControl('progress', 'p', 'Load'), progressOrigin: 50 }
    for (const value of [undefined, NaN, Infinity, '', 'invalid']) {
      expect(progressPresentation(c, value)).toMatchObject({
        text: '—',
        fraction: null,
        fill: { width: '0%' }
      })
    }
    expect(progressPresentation({ ...c, min: 100, max: 100 }, 100).text).toBe('—')
  })
  it('persists optional settings and supports undo, locking and enough room for limits', () => {
    const doc = createDocument()
    doc.controls.push(createControl('progress', 'p', 'Load'))
    const history = new PanelHistory(doc)
    patchControls(doc, ['p'], 'progressDirection', 'up')
    patchControls(doc, ['p'], 'progressShowLimits', true)
    history.record(doc)
    const saved = JSON.parse(JSON.stringify(doc))
    expect(saved.controls[0]).toMatchObject({
      progressDirection: 'up',
      progressShowLimits: true,
      height: 56
    })
    expect(history.undo()!.controls[0].progressDirection).toBeUndefined()
    expect(history.redo()!.controls[0].progressDirection).toBe('up')
    doc.controls[0].locked = true
    patchControls(doc, ['p'], 'progressDirection', 'left')
    expect(doc.controls[0].progressDirection).toBe('up')
  })
})
