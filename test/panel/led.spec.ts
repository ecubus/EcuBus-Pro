import { expect, it } from 'vitest'
import {
  createControl,
  createDocument,
  PanelHistory
} from '../../src/renderer/src/views/uds/panel/free/model'
import { ledPresentation, ledShapes } from '../../src/renderer/src/views/uds/panel/free/led'
import { patchControls } from '../../src/renderer/src/views/uds/panel/free/properties'

it('renders all six shapes with configurable aspect ratio and frame', () => {
  const control = { ...createControl('led', 'led', 'LED'), width: 120, height: 80 }
  expect(ledPresentation(control, 1)).toMatchObject({
    width: 68,
    height: 68,
    state: 'on',
    fill: '#67c23a'
  })
  const paths = ledShapes.map((ledShape) => ledPresentation({ ...control, ledShape }, 1).path)
  expect(new Set(paths).size).toBe(6)
  expect(ledPresentation({ ...control, ledKeepAspect: false, ledFrame: false }, 0)).toMatchObject({
    width: 108,
    height: 68,
    stroke: 'none'
  })
})

it('uses exact on/off values and colors and distinguishes missing or unmatched data', () => {
  const control = {
    ...createControl('led', 'led', 'LED'),
    pressValue: 5,
    releaseValue: 2,
    ledOnColor: '#ff0000',
    ledOffColor: '#0000ff'
  }
  expect(ledPresentation(control, 5)).toMatchObject({ state: 'on', fill: '#ff0000' })
  expect(ledPresentation(control, 2)).toMatchObject({ state: 'off', fill: '#0000ff' })
  for (const value of [undefined, null, '', [], NaN, 3])
    expect(ledPresentation(control, value)).toMatchObject({ state: 'unknown', fill: 'none' })
})

it('persists LED properties through undo and JSON without modifying locked controls', () => {
  const doc = createDocument()
  doc.controls = [createControl('led', 'led', 'LED')]
  const history = new PanelHistory(doc)
  patchControls(doc, ['led'], 'ledShape', 'up')
  patchControls(doc, ['led'], 'ledOnColor', '#ff0000')
  history.record(doc)
  expect(history.undo().controls[0].ledShape).toBeUndefined()
  expect(JSON.parse(JSON.stringify(history.redo())).controls[0]).toMatchObject({
    ledShape: 'up',
    ledOnColor: '#ff0000'
  })
  doc.controls[0].locked = true
  patchControls(doc, ['led'], 'ledShape', 'down')
  expect(doc.controls[0].ledShape).toBe('up')
})
