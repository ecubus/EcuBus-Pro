import { beforeEach, expect, it } from 'vitest'
import {
  recordSignalValues,
  currentSignalValue,
  clearSignalValues,
  signalValueSnapshot,
  restoreSignalSnapshot
} from '../../src/renderer/src/stores/signalValues'

beforeEach(clearSignalValues)

it('initializes a new window from a snapshot without overwriting newer samples', () => {
  const key = 'can.Vehicle.Status.signals.Speed'
  restoreSignalSnapshot({ [key]: { value: '60', rawValue: '600' } })
  expect(currentSignalValue(key)?.value).toBe('60')
  recordSignalValues({ [key]: [[2, { value: '80', rawValue: '800' }]] })
  restoreSignalSnapshot({ [key]: { value: '60', rawValue: '600' } })
  expect(signalValueSnapshot()[key].value).toBe('80')
})

it('reads the latest CAN and LIN samples without registering subscriptions', () => {
  recordSignalValues({
    'can.Vehicle.Status.signals.Speed': [
      [1, { value: '90', rawValue: '900' }],
      [2, { value: '140', rawValue: '1400' }]
    ],
    'lin.Body.Lamp.signals.Level': [[2, { value: 0, rawValue: 0 }]],
    canBase: [{ message: {} }]
  })
  expect(currentSignalValue('can.Vehicle.Status.signals.Speed')).toEqual({
    value: '140',
    rawValue: '1400'
  })
  expect(currentSignalValue('lin.Body.Lamp.signals.Level')).toEqual({ value: 0, rawValue: 0 })
  expect(currentSignalValue('canBase')).toBeUndefined()
})

it('updates a previously read value and preserves it across empty batches', () => {
  const key = 'can.Vehicle.Status.signals.Speed'
  recordSignalValues({ [key]: [[1, { value: '90', rawValue: '900' }]] })
  expect(currentSignalValue(key)?.value).toBe('90')
  recordSignalValues({ [key]: [[2, { value: '140', rawValue: '1400' }]] })
  recordSignalValues({ [key]: [] })
  expect(currentSignalValue(key)?.value).toBe('140')
})

it('discards previous measurement values when cleared', () => {
  const key = 'can.Vehicle.Status.signals.Speed'
  recordSignalValues({ [key]: [[1, { value: '90', rawValue: '900' }]] })
  clearSignalValues()
  expect(currentSignalValue(key)).toBeUndefined()
})
