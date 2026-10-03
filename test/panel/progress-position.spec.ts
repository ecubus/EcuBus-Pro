import { expect, it } from 'vitest'
import {
  createControl,
  createDocument,
  labelPosition,
  PanelHistory
} from '../../src/renderer/src/views/uds/panel/free/model'
import { progressValuePosition } from '../../src/renderer/src/views/uds/panel/free/progress'

it('keeps old hidden values hidden and separates label and value positions', () => {
  const control = createControl('progress', 'p', 'Progress')
  expect(labelPosition(control)).toBe('left')
  expect(progressValuePosition(control)).toBe('hidden')
  delete control.progressValuePosition
  expect(progressValuePosition(control)).toBe('top')
  control.progressText = 'hidden'
  expect(progressValuePosition(control)).toBe('hidden')
  for (const position of ['hidden', 'left', 'top', 'right', 'bottom'] as const) {
    control.progressValuePosition = position
    control.labelPosition = 'right'
    expect(progressValuePosition(control)).toBe(position)
  }
})

it('persists and undoes the independent value position', () => {
  const doc = createDocument()
  doc.controls = [createControl('progress', 'p', 'Progress')]
  const history = new PanelHistory(doc)
  doc.controls[0].progressValuePosition = 'bottom'
  history.record(doc)
  expect(history.undo().controls[0].progressValuePosition).toBe('hidden')
  expect(JSON.parse(JSON.stringify(history.redo())).controls[0].progressValuePosition).toBe(
    'bottom'
  )
})
