import { beforeAll, describe, test, expect, it } from 'vitest'
import parse, { LDF } from 'src/renderer/src/database/ldfParse'
import fs from 'fs'
import path from 'path'
import { getFrameData } from 'src/main/share/lin'

test('ldf parse 2.2', () => {
  const ldf = fs.readFileSync(path.join(__dirname, '2.2.ldf'), 'utf-8')
  const r = parse(ldf)
})

test('ldf parse 2.1', () => {
  const ldf = fs.readFileSync(path.join(__dirname, '2.1.ldf'), 'utf-8')
  const r = parse(ldf)
})

test('ldf file1', () => {
  const ldf = fs.readFileSync(path.join(__dirname, 'file1.ldf'), 'utf-8')
  const r = parse(ldf)
  // console.log(r)
})
test('ldf door', () => {
  const ldf = fs.readFileSync(path.join(__dirname, 'Door.ldf'), 'utf-8')
  const r = parse(ldf)
  // console.log(r)
})

test('ldf CHANGAN_WLK151Z_LIN_1.1', () => {
  const ldf = fs.readFileSync(path.join(__dirname, 'CHANGAN_WLK151Z_LIN_1.1.ldf'), 'utf-8')
  const r = parse(ldf)
  expect(r.signalEncodeTypes['EF_temperature_Encoding'].encodingTypes[0].type).toEqual(
    'physicalValue'
  )
  expect(
    r.signalEncodeTypes['EF_temperature_Encoding'].encodingTypes[0].physicalValue?.minValue
  ).toEqual(0)
  expect(
    r.signalEncodeTypes['EF_temperature_Encoding'].encodingTypes[0].physicalValue?.maxValue
  ).toEqual(254)
  expect(
    r.signalEncodeTypes['EF_temperature_Encoding'].encodingTypes[0].physicalValue?.scale
  ).toEqual(1)
  expect(
    r.signalEncodeTypes['EF_temperature_Encoding'].encodingTypes[0].physicalValue?.offset
  ).toEqual(-50)
  expect(
    r.signalEncodeTypes['EF_temperature_Encoding'].encodingTypes[0].physicalValue?.textInfo
  ).toEqual('T')

  expect(r.signalEncodeTypes['EF_undervoltageError_Encoding'].encodingTypes[0].type).toEqual(
    'logicalValue'
  )
  expect(
    r.signalEncodeTypes['EF_undervoltageError_Encoding'].encodingTypes[0].logicalValue?.signalValue
  ).toEqual(0)
  expect(
    r.signalEncodeTypes['EF_undervoltageError_Encoding'].encodingTypes[0].logicalValue?.textInfo
  ).toEqual('NO ERROR')

  expect(r.signalEncodeTypes['EF_undervoltageError_Encoding'].encodingTypes[1].type).toEqual(
    'logicalValue'
  )
  expect(
    r.signalEncodeTypes['EF_undervoltageError_Encoding'].encodingTypes[1].logicalValue?.signalValue
  ).toEqual(1)
  expect(
    r.signalEncodeTypes['EF_undervoltageError_Encoding'].encodingTypes[1].logicalValue?.textInfo
  ).toEqual('ERROR')

  expect(r.signalEncodeTypes['EF_undervoltageError_Encoding'].encodingTypes[2].type).toEqual(
    'logicalValue'
  )
  expect(
    r.signalEncodeTypes['EF_undervoltageError_Encoding'].encodingTypes[2].logicalValue?.signalValue
  ).toEqual(2)
  expect(
    r.signalEncodeTypes['EF_undervoltageError_Encoding'].encodingTypes[2].logicalValue?.textInfo
  ).toEqual('SNA')
})

test('ldf t1', () => {
  test
  const ldf = fs.readFileSync(path.join(__dirname, 't1.ldf'), 'utf-8')
  const r = parse(ldf)
  // console.log(r)
})

test('ldf 2025', () => {
  const ldf = fs.readFileSync(path.join(__dirname, '20250109.ldf'), 'utf-8')
  const r = parse(ldf)
  // console.log(r)
})

describe('signal update', () => {
  let ldf: LDF
  beforeAll(() => {
    const ldfStr = fs.readFileSync(path.join(__dirname, '2.2.ldf'), 'utf-8')
    ldf = parse(ldfStr)
  })
  it('MotorControl-MotorDirection', () => {
    ldf.signals['MotorDirection'].value = 1
    const val = getFrameData(ldf, ldf.frames['MotorControl'])
    expect(val).toEqual(Buffer.from([1, 0]))
  })
  it('MotorControl-MotorDirection', () => {
    ldf.signals['MotorDirection'].value = 0
    ldf.signals['MotorSelection'].value = 0x0d
    const val = getFrameData(ldf, ldf.frames['MotorControl'])
    expect(val).toEqual(Buffer.from([0, 0xd0]))
  })
  it('Motor1State_Cycl', () => {
    ldf.signals['Motor1Position'].value = [0xf5, 0xf1, 0, 4]
    ldf.signals['Motor1LinError'].value = 1
    const val = getFrameData(ldf, ldf.frames['Motor1State_Cycl'])

    expect(val).toEqual(Buffer.from([5, 0x2, 0x80, 0xf8, 0x7a, 1]))
  })
})

test('ldf file2', () => {
  const ldf = fs.readFileSync(path.join(__dirname, 'file2.ldf'), 'utf-8')
  const r = parse(ldf)
  // console.log(r)
})
