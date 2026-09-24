import { expect, it } from 'vitest'
import {
  createControl,
  createDocument,
  labelPosition,
  PanelHistory
} from '../../src/renderer/src/views/uds/panel/free/model'
import { patchControls } from '../../src/renderer/src/views/uds/panel/free/properties'

it('defaults labels to the left and stores batch changes with undo and locks', () => {
  const doc = createDocument()
  doc.controls = [
    createControl('switch', 's', 'Power'),
    createControl('progress', 'p', 'Charge'),
    createControl('led', 'l', 'Status')
  ]
  doc.controls[2].locked = true
  expect(doc.controls.map(labelPosition)).toEqual(['left', 'left', 'hidden'])
  const history = new PanelHistory(doc)
  patchControls(doc, ['s', 'p', 'l'], 'labelPosition', 'hidden')
  history.record(doc)
  expect(JSON.parse(JSON.stringify(doc)).controls.map(labelPosition)).toEqual([
    'hidden',
    'hidden',
    'hidden'
  ])
  expect(history.undo()!.controls.map(labelPosition)).toEqual(['left', 'left', 'hidden'])
  expect(history.redo()!.controls.map(labelPosition)).toEqual(['hidden', 'hidden', 'hidden'])
})

it('keeps explicitly configured label positions', () => {
  const control = createControl('number', 'n', 'Value')
  control.labelPosition = 'top'
  expect(labelPosition(control)).toBe('top')
})
