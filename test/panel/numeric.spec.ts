import { expect, it, vi } from 'vitest'
import type { PanelBinding } from '../../src/preload/panel'
import type { DataSet } from '../../src/preload/data'
import type { Signal as CanSignal, CanDB } from '../../src/main/share/can'
import { createControl } from '../../src/renderer/src/views/uds/panel/free/model'
import {
  formatNumber,
  gaugeValueText,
  parseNumber,
  numericLabel,
  alarmColor
} from '../../src/renderer/src/views/uds/panel/free/numeric'
import {
  PanelConnection,
  sendControlValue,
  physicalWriteAvailable,
  type PanelUpdate
} from '../../src/renderer/src/views/uds/panel/free/runtime'
import { updateSignalPhys, updateSignalRaw } from '../../src/renderer/src/database/dbc/calc'

const binding: PanelBinding = {
  kind: 'signal',
  node: {
    id: 'signal',
    type: 'signal',
    enable: true,
    color: '',
    name: 'Value',
    bindValue: {
      dbKey: 'db',
      dbName: 'Test',
      frameId: 1,
      signalName: 'Value',
      startBit: 0,
      bitLength: 8
    }
  }
}

it('formats decimal precision, signed hex and binary and rejects fractional radix output', () => {
  const c = createControl('number', 'n', 'Value')
  c.numberDecimals = 2
  expect(formatNumber(c, 12.345)).toBe('12.35')
  c.numberFormat = 'hex'
  expect(formatNumber(c, 255)).toBe('0xFF')
  expect(formatNumber(c, -15)).toBe('-0xF')
  expect(formatNumber(c, 1.5)).toBe('—')
  c.numberFormat = 'binary'
  expect(formatNumber(c, 10)).toBe('0b1010')
  expect(formatNumber(c, undefined)).toBe('—')
})

it('keeps gauge values compact while preserving configured precision and units', () => {
  const c = createControl('gauge', 'g', 'Speed')
  expect(gaugeValueText(c, 37.800000000000004)).toBe('37.8')
  expect(gaugeValueText({ ...c, unit: 'km/h' }, 37.800000000000004)).toBe('37.8 km/h')
  expect(gaugeValueText({ ...c, numberDecimals: 0 }, 37.8)).toBe('38')
  expect(gaugeValueText(c, undefined)).toBe('—')
})

it('parses strict input with prefixes and rejects invalid, unsafe and out-of-range values', () => {
  const c = {
    ...createControl('number', 'n', 'Value'),
    min: -255,
    max: 255,
    numberFormat: 'hex' as const
  }
  expect(parseNumber(c, 'FF')).toBe(255)
  expect(parseNumber(c, '-0xA')).toBe(-10)
  for (const value of ['', 'GG', '0x', '12.5', '100', '1x2'])
    expect(() => parseNumber(c, value)).toThrow()
  expect(parseNumber({ ...c, numberFormat: 'binary' }, '0b101')).toBe(5)
  expect(() => parseNumber({ ...c, numberFormat: 'binary' }, '102')).toThrow()
})

it('adds optional range and unit and alarms only outside inclusive limits', () => {
  const c = {
    ...createControl('display', 'd', 'Speed'),
    unit: 'km/h',
    numberShowRange: true,
    alarmMode: 'limits' as const,
    alarmLower: 10,
    alarmUpper: 90
  }
  expect(numericLabel(c)).toBe('Speed [0 … 100] (km/h)')
  expect(numericLabel({ ...c, numberShowRange: false, numberShowUnit: false })).toBe('Speed')
  expect(alarmColor(c, 9)).toBe('#fa8072')
  expect(alarmColor({ ...c, alarmUpperColor: '#ff0000' }, 91)).toBe('#ff0000')
  for (const v of [undefined, NaN, 10, 90, '']) expect(alarmColor(c, v)).toBeUndefined()
})

it('shares a signal subscription while selecting raw and physical samples separately', () => {
  const listeners = new Map<string, (data: PanelUpdate) => void>()
  const update = vi.fn()
  const connection = new PanelConnection(
    { on: (key, fn) => listeners.set(key, fn), off: (key) => listeners.delete(key) },
    update
  )
  const raw = { ...createControl('display', 'raw', 'Raw'), binding }
  connection.connect([raw, { ...raw, id: 'physical', numberValueType: 'physical' }])
  listeners.get('signal')!({ key: 'signal', values: [[1, { rawValue: 60, value: '20' }]] })
  expect(update.mock.calls).toEqual([
    ['raw', 60],
    ['physical', '20']
  ])
  connection.disconnect()
  expect(listeners.size).toBe(0)
})

it('routes physical writes through existing CAN inverse conversion and blocks missing conversions', () => {
  const control = {
    ...createControl('number', 'n', 'Value'),
    binding,
    numberValueType: 'physical' as const
  }
  const signal = {
    name: 'Value',
    factor: '0.5',
    offset: '-10',
    min: '-10',
    max: '100',
    value: '0',
    values: {},
    bit_length: 8,
    is_signed: false
  } as CanSignal
  const database = {
    can: { db: { name: 'Test', messages: [{ id: 1, signals: [signal] }] } },
    lin: {}
  } as unknown as DataSet['database']
  expect(physicalWriteAvailable(control, database)).toBe(true)
  const send = vi.fn((_channel, payload) => {
    signal.physValue = payload.value
    updateSignalPhys(signal, database.can.db as CanDB)
  })
  expect(sendControlValue(control, 20, true, send)).toBe(true)
  expect(send).toHaveBeenCalledWith('ipc-signal-set', { name: 'Test.Value', value: '20' })
  expect(signal.value).toBe('60')
  updateSignalRaw(signal)
  expect(signal.physValue).toBe('20')
  signal.factor = '0'
  expect(physicalWriteAvailable(control, database)).toBe(false)
  expect(physicalWriteAvailable(control, { can: {}, lin: {} } as DataSet['database'])).toBe(false)
})
