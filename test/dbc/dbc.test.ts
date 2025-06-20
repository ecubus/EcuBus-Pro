import { beforeAll, describe, expect, test } from 'vitest'
import parse, { isCanFd } from 'src/renderer/src/database/dbcParse'
import {
  getActiveSignals,
  getMessageData,
  getSignal,
  setSignal,
  writeMessageData
} from 'src/renderer/src/database/dbc/calc'
import fs from 'fs'
import path from 'path'
import { CAN_ID_TYPE } from 'src/main/share/can'

describe('DBC Parser Tests', () => {
  let dbcContentModel3: string
  let dbcContentHyundaiKia: string
  let dbcContentVwSkodaAudi: string
  let dbcContentTest: string
  let floatDbc: string
  let evDbc: string
  let sgDbc: string
  let id200Dbc: string
  beforeAll(() => {
    dbcContentModel3 = fs.readFileSync(path.join(__dirname, 'Model3CAN.dbc'), 'utf-8')
    dbcContentHyundaiKia = fs.readFileSync(
      path.join(__dirname, 'can1-hyundai-kia-uds-v2.4.dbc'),
      'utf-8'
    )
    dbcContentVwSkodaAudi = fs.readFileSync(
      path.join(__dirname, 'can1-vw-skoda-audi-uds-v2.5.dbc'),
      'utf-8'
    )
    dbcContentTest = fs.readFileSync(path.join(__dirname, 'testdbc.dbc'), 'utf-8')
    floatDbc = fs.readFileSync(path.join(__dirname, 'float.dbc'), 'utf-8')
    evDbc = fs.readFileSync(path.join(__dirname, 'ev.dbc'), 'utf-8')
    sgDbc = fs.readFileSync(path.join(__dirname, 'sig_group.dbc'), 'utf-8')
    id200Dbc = fs.readFileSync(path.join(__dirname, 'ID200.dbc'), 'utf-8')
  })
  test('id200', () => {
    const result = parse(id200Dbc)
    expect(result).toBeDefined()
    expect(result.messages[0x200].name).toBe('Message_200')
    const s = result.messages[0x200].signals['HhBmIO']
    const s1 = result.messages[0x200].signals['LwBmIO']

    setSignal(s, 1, result)
    setSignal(s1, 1, result)

    const buf = getMessageData(result.messages[0x200])
    expect(buf).toEqual(Buffer.from([0x81, 0, 0, 0, 0, 0, 0, 0]))

    const ns = result.messages[12].signals['UI_audioActive']
    const ns1 = result.messages[12].signals['UI_cellVector__XXXPower']

    setSignal(ns, 1, result)
    setSignal(ns1, '-116', result)

    const buf1 = getMessageData(result.messages[12])
    expect(buf1).toEqual(Buffer.from([0x2, 0, 0, 0xc, 0, 0, 0, 0]))
  })
  test('dbc model3', () => {
    const result = parse(dbcContentModel3)
    // Add assertions to verify the parsed values for Model3CAN.dbc
    expect(result).toBeDefined()
    expect(isCanFd(result.messages[0x113])).toBe(false)
    expect(result.messages[0x113].extId).toBe(true)

    const msg = result.messages[0x142]
    writeMessageData(msg, Buffer.from([0, 0, 0, 0xd0, 0x3c, 0, 0, 0]), result)
    const s1 = getSignal(msg.signals['VCLEFT_liftgateStatusIndex'], result)
    expect(s1.phy).toBe('LIFTGATE_STATUS_INDEX_0')
    /*Name	Generator Control	Generator Type	Raw Value	Raw Step	Phys Value	Phys Step	Unit	Start Bit	Length
VCLEFT_liftgateStoppingCondition		None	0	1	PLG_STOPPING_CONDITION_NONE	1		10	4*/
    const s2 = getSignal(msg.signals['VCLEFT_liftgateStoppingCondition'], result)
    expect(s2.phy).toBe('PLG_STOPPING_CONDITION_NONE')

    writeMessageData(msg, Buffer.from([0x9, 0x68, 0xde, 0xd0, 0x3c, 0, 0, 0]), result)
    /*Name	Generator Control	Generator Type	Raw Value	Raw Step	Phys Value	Phys Step	Unit	Start Bit	Length
VCLEFT_liftgateSpeed		None	3CD	33	-5.1	3.0	deg/s	28	10*/
    const s3 = getSignal(msg.signals['VCLEFT_liftgateSpeed'], result)
    expect(s3.phy).toBe('-5.1')
    expect(s3.raw).toBe(0x3cd)

    setSignal(msg.signals['VCLEFT_liftgateStatusIndex'], 1, result)
    setSignal(msg.signals['VCLEFT_liftgatePosition'], 6, result)
    setSignal(msg.signals['VCLEFT_liftgateStrutDutyCycle'], 1, result)
    setSignal(msg.signals['VCLEFT_liftgateSpeed'], '-2.1', result)
    setSignal(msg.signals['VCLEFT_liftgateStrutCurrent'], '-2.1', result)
    expect(msg.signals['VCLEFT_liftgateSpeed'].value).toBe(0x3eb)
    // console.log(msg)
    const buf = getMessageData(msg)
    expect(buf.toString('hex')).toBe(
      Buffer.from([0x9, 0x58, 0xdf, 0xb0, 0x3e, 0, 0, 0]).toString('hex')
    )
    // Add more specific assertions based on the expected structure of Model3CAN.dbc

    writeMessageData(msg, Buffer.from([0x9, 0x58, 0xdf, 0xb0, 0x3d, 0, 0, 0]), result)

    expect(msg.signals['VCLEFT_liftgateSpeed'].value).toBe(0x3db)
    expect(msg.signals['VCLEFT_liftgateSpeed'].physValue).toBe('-3.7')
  })
  test('dbc sig_group', () => {
    const result = parse(sgDbc)
    // Add assertions to verify the parsed values for Model3CAN.dbc
    expect(result).toBeDefined()

    // Add more specific assertions based on the expected structure of Model3CAN.dbc
  })

  test('dbc can1-hyundai-kia-uds-v2.4', () => {
    const result = parse(dbcContentHyundaiKia)
    // Add assertions to verify the parsed values for can1-hyundai-kia-uds-v2.4.dbc
    expect(result).toBeDefined()
    // Add more specific assertions based on the expected structure of can1-hyundai-kia-uds-v2.4.dbc
  })
  test('dbc testdbc', () => {
    const result = parse(dbcContentTest)
    // Add assertions to verify the parsed values for can1-hyundai-kia-uds-v2.4.dbc
    expect(result).toBeDefined()
    // Add more specific assertions based on the expected structure of can1-hyundai-kia-uds-v2.4.dbc
  })
  test('dbc ev', () => {
    const result = parse(evDbc)
    // Add assertions to verify the parsed values for can1-hyundai-kia-uds-v2.4.dbc
    expect(result).toBeDefined()
    expect(result.environmentVariables['V2CTxTime'].name).toBe('V2CTxTime')

    // Add more specific assertions based on the expected structure of can1-hyundai-kia-uds-v2.4.dbc
  })
  test('float', () => {
    const result = parse(floatDbc)
    // Add assertions to verify the parsed values for can1-hyundai-kia-uds-v2.4.dbc
    expect(result).toBeDefined()
    const id = 0x12332
    expect(result.messages[Number(id)].signals['Binary32'].valueType).toEqual(1)

    writeMessageData(result.messages[Number(id)], Buffer.from([0, 0, 0x80, 0x3f]), result)
    expect(result.messages[Number(id)].signals['Binary32'].physValue).toEqual('1')

    setSignal(result.messages[Number(id)].signals['Binary32'], '1', result)
    expect(result.messages[Number(id)].signals['Binary32'].physValue).toEqual('1')
    expect(getMessageData(result.messages[Number(id)])).toEqual(Buffer.from([0, 0, 0x80, 0x3f]))
  })
  test('dbc can1-vw-skoda-audi-uds-v2.5', () => {
    const result = parse(dbcContentVwSkodaAudi)
    // Add assertions to verify the parsed values for can1-vw-skoda-audi-uds-v2.5.dbc

    expect(result).toBeDefined()
    expect(result.version).toBe('')
    expect(result.nodes).toEqual({})
    const id = 2550005883 & 0x1fffffff
    expect(result.messages[id].name).toBe('Battery')
    expect(result.messages[id].signals['StateOfChargeBMS'].multiplexerRange).toEqual({
      name: 'R',
      range: [652]
    })
    expect(result.messages[id].signals['R'].multiplexerRange).toEqual({
      name: 'S',
      range: [98]
    })

    expect(result.messages[1968].name).toBe('Temperature')
    expect(result.messages[1968].signals['OutdoorTemp'].multiplexerRange).toEqual({
      name: 'R',
      range: [9737]
    })

    // Add assertions for signal values
    expect(result.messages[id].signals['StateOfChargeBMS'].factor).toBe(0.4)
    expect(result.messages[id].signals['StateOfChargeBMS'].offset).toBe(0)
    expect(result.messages[id].signals['StateOfChargeBMS'].minimum).toBe(0)
    expect(result.messages[id].signals['StateOfChargeBMS'].maximum).toBe(100)
    expect(result.messages[id].signals['StateOfChargeBMS'].unit).toBe('%')

    const id2 = 2550005945 & 0x1fffffff
    const msg = result.messages[id2]
    expect(msg.signals['Voltage'].isLittleEndian).toBe(false)
    writeMessageData(msg, Buffer.from([0x62, 0x46, 0x5d, 0x62, 0x11]), result)
    expect(msg.signals['Voltage'].value).toBe(0x6211)
    let buf = getMessageData(msg)
    expect(buf).toEqual(Buffer.from([0x62, 0x46, 0x5d, 0x62, 0x11]))
    setSignal(msg.signals['Voltage'], '6', result)
    buf = getMessageData(msg)
    expect(buf).toEqual(Buffer.from([0x62, 0x46, 0x5d, 0xc, 0x0]))

    expect(getActiveSignals(msg).map((v) => v.name)).toEqual(['S', 'R', 'Voltage'])

    setSignal(msg.signals['R'], 0x465b, result)
    setSignal(msg.signals['S'], 0x62, result)
    setSignal(msg.signals['Current'], 0x199a, result)

    expect(getMessageData(msg)).toEqual(Buffer.from([0x62, 0x46, 0x5b, 0x19, 0x9a]))
    expect(getActiveSignals(msg).map((v) => v.name)).toEqual(['S', 'R', 'Current'])

    expect(result.messages[id2].signals['Voltage'].factor).toBe(0.001953125)
    expect(result.messages[id2].signals['Voltage'].offset).toBe(0)
    expect(result.messages[id2].signals['Voltage'].minimum).toBe(0)
    expect(result.messages[id2].signals['Voltage'].maximum).toBe(0)
    expect(result.messages[id2].signals['Voltage'].unit).toBe('V')
    expect(result.messages[id2].name).toBe('VoltageCurrent')
    expect(result.messages[id2].signals['Voltage'].multiplexerRange).toEqual({
      name: 'R',
      range: [18013]
    })
    const id3 = 2550005878 & 0x1fffffff
    expect(result.messages[id3].name).toBe('Odometer')
    expect(result.messages[id3].signals['Odometer'].multiplexerRange).toEqual({
      name: 'R',
      range: [10586]
    })
    expect(result.messages[id3].signals['Odometer'].factor).toBe(1)
    expect(result.messages[id3].signals['Odometer'].offset).toBe(0)
    expect(result.messages[id3].signals['Odometer'].minimum).toBe(0)
    expect(result.messages[id3].signals['Odometer'].maximum).toBe(0)
    expect(result.messages[id3].signals['Odometer'].unit).toBe('km')

    expect(result.messages[1968].signals['OutdoorTemp'].factor).toBe(0.5)
    expect(result.messages[1968].signals['OutdoorTemp'].offset).toBe(-50)
    expect(result.messages[1968].signals['OutdoorTemp'].minimum).toBe(0)
    expect(result.messages[1968].signals['OutdoorTemp'].maximum).toBe(0)
    expect(result.messages[1968].signals['OutdoorTemp'].unit).toBe('degC')

    expect(result.messages[1968].attributes['TransportProtocolType'].currentValue).toBe('ISOTP')

    // Add assertions for BA_DEF_ and BA_DEF_DEF_
    expect(result.attributes['SignalIgnore']).toBeDefined()
    expect(result.attributes['SignalIgnore'].type).toBe('INT')
    expect(result.attributes['SignalIgnore'].min).toBe(0)
    expect(result.attributes['SignalIgnore'].max).toBe(1)
    expect(result.attributes['SignalIgnore'].defaultValue).toBe(0)

    expect(result.attributes['VFrameFormat']).toBeDefined()
    expect(result.attributes['VFrameFormat'].type).toBe('ENUM')
    expect(result.attributes['VFrameFormat'].enumList).toEqual([
      'StandardCAN',
      'ExtendedCAN',
      'StandardCAN_FD',
      'ExtendedCAN_FD',
      'J1939PG'
    ])
    expect(result.attributes['VFrameFormat'].defaultValue).toBe('')

    expect(result.attributes['MessageIgnore']).toBeDefined()
    expect(result.attributes['MessageIgnore'].type).toBe('INT')
    expect(result.attributes['MessageIgnore'].min).toBe(0)
    expect(result.attributes['MessageIgnore'].max).toBe(1)
    expect(result.attributes['MessageIgnore'].defaultValue).toBe(0)

    expect(result.attributes['TransportProtocolType']).toBeDefined()
    expect(result.attributes['TransportProtocolType'].type).toBe('STRING')
    expect(result.attributes['TransportProtocolType'].defaultValue).toBe('')

    expect(result.attributes['BusType']).toBeDefined()
    expect(result.attributes['BusType'].type).toBe('STRING')
    expect(result.attributes['BusType'].currentValue).toBe('CAN')

    expect(result.attributes['ProtocolType']).toBeDefined()
    expect(result.attributes['ProtocolType'].type).toBe('STRING')
    expect(result.attributes['ProtocolType'].currentValue).toBe('OBD')

    expect(result.attributes['DatabaseCompiler']).toBeDefined()
    expect(result.attributes['DatabaseCompiler'].type).toBe('STRING')
    expect(result.attributes['DatabaseCompiler'].defaultValue).toBe(
      'CSS Electronics (wwww.csselectronics.com)'
    )

    expect(result.messages[0x17fe007b].signals['S'].startBit).toBe(0)
    expect(result.messages[0x17fe007b].signals['R'].startBit).toBe(16)
    expect(result.messages[0x17fe007b].signals['BattTempMain'].startBit).toBe(24)
    expect(result.messages[0x17fe007b].signals['Speed'].startBit).toBe(24)
    expect(result.messages[0x17fe007b].signals['BatteryCurrentHV'].startBit).toBe(48)
    expect(result.messages[0x17fe007b].signals['BatteryVoltageHV'].startBit).toBe(32)
    expect(result.messages[0x17fe007b].signals['BatteryTotalChargeHV'].startBit).toBe(88)
    expect(result.messages[0x17fe007b].signals['BatteryTotalDischargeHV'].startBit).toBe(120)
  })
})
