import { describe, expect, test } from 'vitest'
import { getTxPdu, paramSetVal, type Param, type ServiceItem } from 'nodeCan/uds'
import {
  dtcToArrayString,
  getDtcOptions
} from '../../src/renderer/src/views/uds/tester/dtcSelection'

function dtcParam(): Param {
  return {
    id: 'dtc',
    name: 'DTC',
    type: 'ARRAY',
    bitLen: 24,
    value: Buffer.alloc(3),
    phyValue: '00 00 00',
    editable: true,
    DTC_Table: [
      { name: 'Overvoltage', codeText: 'P0100', hexNumber: '0x010017', hexValue: 0x010017 }
    ]
  }
}

describe('CDD DTC selection', () => {
  test('fills all three DTC bytes and preserves the failure type in a snapshot request', () => {
    const param = dtcParam()
    const option = getDtcOptions(param, true, '0x19')![0]
    expect(option.name).toBe('0x010017 · P0100 · Overvoltage')
    expect(option.value).toBe('01 00 17')
    paramSetVal(param, option.value)
    const service: ServiceItem = {
      id: 'snapshot',
      name: 'Read snapshot',
      serviceId: '0x19',
      params: [
        {
          id: 'sub',
          name: 'Subfunction',
          type: 'NUM',
          bitLen: 8,
          value: Buffer.from([4]),
          phyValue: 4
        },
        param,
        {
          id: 'record',
          name: 'Record',
          type: 'NUM',
          bitLen: 8,
          value: Buffer.from([1]),
          phyValue: 1
        }
      ],
      respParams: []
    }
    expect([...getTxPdu(service)]).toEqual([0x19, 4, 1, 0, 0x17, 1])
  })

  test('keeps leading zero bytes', () => {
    expect(dtcToArrayString(1)).toBe('00 00 01')
    expect(dtcToArrayString(0)).toBe('00 00 00')
    expect(dtcToArrayString(0xffffff)).toBe('FF FF FF')
  })

  test.each([-1, 0x1000000, 1.5, NaN, Infinity])('rejects invalid raw DTC %s', (raw) => {
    expect(() => dtcToArrayString(raw)).toThrow(RangeError)
  })

  test('does not offer DTC choices for responses, groups, locked fields or other services', () => {
    expect(getDtcOptions(dtcParam(), false, '0x19')).toBeUndefined()
    expect(getDtcOptions(dtcParam(), true, '0x14')).toBeUndefined()
    expect(getDtcOptions({ ...dtcParam(), name: 'GroupOfDTC' }, true, '0x19')).toBeUndefined()
    expect(getDtcOptions({ ...dtcParam(), editable: false }, true, '0x19')).toBeUndefined()
    expect(getDtcOptions({ ...dtcParam(), type: 'NUM' }, true, '0x19')).toBeUndefined()
    expect(getDtcOptions({ ...dtcParam(), bitLen: 16 }, true, '0x19')).toBeUndefined()
  })

  test('manual values outside the CDD list still use the existing parameter setter', () => {
    const param = dtcParam()
    paramSetVal(param, 'A1 02 03')
    expect([...param.value]).toEqual([0xa1, 2, 3])
    expect(param.phyValue).toBe('A1 02 03')
  })
})
