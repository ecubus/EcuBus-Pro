import { beforeAll, describe, expect, test } from 'vitest'
import { parseFile } from 'src/main/canmartix'
import { updateSignalPhys } from 'src/renderer/src/database/dbc/calc'
import fs from 'fs'
import path from 'path'
import { CAN_ID_TYPE } from 'src/main/share/can'
import {
  getMessageData,
  updateSignalRaw,
  writeMessageData
} from 'src/renderer/src/database/dbc/calc'
import { tmpdir } from 'os'
const outputJson = path.join(tmpdir(), 'testDBC.json')

const parse = async (filePath: string) => {
  const v = await parseFile(filePath, outputJson)
  return v.data
}
describe('DBC Parser Tests', () => {
  let dbcContentModel3: string
  let dbcContentHyundaiKia: string
  let dbcContentVwSkodaAudi: string
  let dbcContentTest: string
  let floatDbc: string
  let evDbc: string
  let sgDbc: string
  let id200Dbc: string
  let test1Dbc: string
  let scuDbc: string
  let testDbc1: string
  beforeAll(() => {
    dbcContentModel3 = path.join(__dirname, 'Model3CAN.dbc')
    dbcContentHyundaiKia = path.join(__dirname, 'can1-hyundai-kia-uds-v2.4.dbc')

    dbcContentVwSkodaAudi = path.join(__dirname, 'can1-vw-skoda-audi-uds-v2.5.dbc')
    dbcContentTest = path.join(__dirname, 'testdbc.dbc')
    floatDbc = path.join(__dirname, 'float.dbc')
    ;((evDbc = path.join(__dirname, 'ev.dbc')), 'utf-8')
    sgDbc = path.join(__dirname, 'sig_group.dbc')
    id200Dbc = path.join(__dirname, 'ID200.dbc')
    test1Dbc = path.join(__dirname, 'test1.dbc')
    scuDbc = path.join(__dirname, 'SCU.dbc')
    testDbc1 = path.join(__dirname, 'TestDbc1.dbc')
  })
  test('scu', async () => {
    const result = await parse(scuDbc)

    const msg = result.messages.find((m: any) => m.name === 'EOL_Check_77')
    expect(msg).toBeDefined()
    if (msg) {
      expect(msg.signals.find((s) => s.name === 'Eol_KL30_ADC')?.name).toBe('Eol_KL30_ADC')
      expect(msg.signals.find((s) => s.name === 'Eol_KL15_ADC')?.name).toBe('Eol_KL15_ADC')
    }
  })
  test('test1', async () => {
    const result = await parse(test1Dbc)
    const msg = result.messages.find((m) => m.name === 'InternalReader1_Flt_D_Stat')
    expect(msg).toBeDefined()
    if (msg) {
      expect(msg.id).toBe(655)
      expect(msg.signals.find((s) => s.name === 'INT1_VoltageFault')?.name).toBe(
        'INT1_VoltageFault'
      )
      expect(msg.signals.find((s) => s.name === 'INT1_FaultStatus')?.name).toBe('INT1_FaultStatus')
      expect(msg.signals.find((s) => s.name === 'INT1_AntennaFault')?.name).toBe(
        'INT1_AntennaFault'
      )
    }
  })
  test('id200', async () => {
    const result = await parse(id200Dbc)
    expect(result).toBeDefined()

    const msg = result.messages.find((m) => m.id === 0x200)
    expect(msg).toBeDefined()

    expect(msg!.name).toBe('Message_200')
    const s = msg!.signals.find((s) => s.name === 'HhBmIO')
    const s1 = msg!.signals.find((s) => s.name === 'LwBmIO')

    s!.physValue = '1'
    s1!.physValue = '1'
    updateSignalPhys(s!, result)
    updateSignalPhys(s1!, result)

    const buf = getMessageData(msg!)
    expect(buf).toEqual(Buffer.from([0x81, 0, 0, 0, 0, 0, 0, 0]))

    const msg1 = result.messages.find((m) => m.id === 12)
    expect(msg1).toBeDefined()

    const ns = msg1!.signals.find((s) => s.name === 'UI_audioActive')
    const ns1 = msg1!.signals.find((s) => s.name === 'UI_cellVector__XXXPower')

    ns!.physValue = '1'
    ns1!.physValue = '-116'
    updateSignalPhys(ns!, result)
    updateSignalPhys(ns1!, result)

    const buf1 = getMessageData(msg1!)
    expect(buf1).toEqual(Buffer.from([0x2, 0, 0, 0xc, 0, 0, 0, 0]))
  })
  test('dbc model3', async () => {
    const result = await parse(dbcContentModel3)
    // Add assertions to verify the parsed values for Model3CAN.dbc
    expect(result).toBeDefined()
    const msg113 = result.messages.find((m) => m.id === 0x113)
    expect(msg113).toBeDefined()
    if (msg113) {
      expect(msg113.is_fd).toBe(false)
      expect(msg113.is_extended_frame).toBe(true)
    }
    // Add more specific assertions based on the expected structure of Model3CAN.dbc
  })
  test('dbc sig_group', async () => {
    const result = await parse(sgDbc)
    // Add assertions to verify the parsed values for Model3CAN.dbc
    expect(result).toBeDefined()

    // Add more specific assertions based on the expected structure of Model3CAN.dbc
  })

  test('dbc can1-hyundai-kia-uds-v2.4', async () => {
    const result = await parse(dbcContentHyundaiKia)
    // Add assertions to verify the parsed values for can1-hyundai-kia-uds-v2.4.dbc
    expect(result).toBeDefined()
    // Add more specific assertions based on the expected structure of can1-hyundai-kia-uds-v2.4.dbc
  })
  test('dbc testdbc', async () => {
    const result = await parse(dbcContentTest)
    // Add assertions to verify the parsed values for can1-hyundai-kia-uds-v2.4.dbc
    expect(result).toBeDefined()
    // Add more specific assertions based on the expected structure of can1-hyundai-kia-uds-v2.4.dbc
  })
  test('dbc ev', async () => {
    const result = await parse(evDbc)
    // Add assertions to verify the parsed values for can1-hyundai-kia-uds-v2.4.dbc
    expect(result).toBeDefined()
    expect(result.env_vars['V2CTxTime']).toBeDefined()

    // Add more specific assertions based on the expected structure of can1-hyundai-kia-uds-v2.4.dbc
  })
  test('float', async () => {
    const result = await parse(floatDbc)
    // Add assertions to verify the parsed values for can1-hyundai-kia-uds-v2.4.dbc
    expect(result).toBeDefined()
    const id = 0x12332
    const msg1 = result.messages.find((m) => m.id === id)
    expect(msg1).toBeDefined()
    const signal1 = msg1!.signals.find((s) => s.name === 'Binary32')
    if (msg1) {
      expect(signal1!.is_float).toBe(true)
    }

    writeMessageData(msg1!, Buffer.from([0, 0, 0x80, 0x3f]), result)
    expect(signal1!.physValue).toEqual('1.0')
    updateSignalRaw(signal1!)
    expect(signal1!.physValue).toEqual('1.0')
    expect(getMessageData(msg1!)).toEqual(Buffer.from([0, 0, 0x80, 0x3f]))

    const msg = result.messages.find((m) => m.id === 326)
    expect(msg!.name).toBe('ISGF_1')
    writeMessageData(msg!, Buffer.from([0xa0, 0x08, 0x7f, 0xff, 0x0, 0x3f, 0xc7, 0xf8]), result)
    const signal2 = msg!.signals.find((s) => s.name === 'ISGF_TorqMax_M146')
    expect(signal2!.value).toBeDefined()

    writeMessageData(msg!, Buffer.from([0xb2, 0xab, 0xff, 0xff, 0xff, 0xff, 0xf7, 0xf8]), result)
    expect(signal2!.value).toEqual('1023')
    expect(signal2!.physValue).toEqual('Invalid')

    writeMessageData(msg!, Buffer.from([0xa0, 0x08, 0x7f, 0xff, 0x0, 0x3f, 0xc7, 0xf8]), result)
    expect(signal2!.value).toEqual('0')
  })
  test('dbc can1-vw-skoda-audi-uds-v2.5', async () => {
    const result = await parse(dbcContentVwSkodaAudi)
    // Add assertions to verify the parsed values for can1-vw-skoda-audi-uds-v2.5.dbc
    expect(result).toBeDefined()

    const id = 2550005883 & 0x1fffffff
    const msgBattery = result.messages.find((m: { id: number }) => m.id === id)
    expect(msgBattery).toBeDefined()
    expect(msgBattery!.name).toBe('Battery')

    expect(
      msgBattery!.signals.find((s: { name: string }) => s.name === 'StateOfChargeBMS')!
        .muxer_for_signal
    ).toEqual('R')
    expect(
      msgBattery!.signals.find((s: { name: string }) => s.name === 'R')!.muxer_for_signal
    ).toEqual('S')

    const msgTemp = result.messages.find((m: { id: number }) => m.id === 1968)
    expect(msgTemp).toBeDefined()
    expect(msgTemp!.name).toBe('Temperature')
    expect(
      msgTemp!.signals.find((s: { name: string }) => s.name === 'OutdoorTemp')!.muxer_for_signal
    ).toEqual('R')

    // Add assertions for signal values
    const sigStateOfChargeBMS = msgBattery!.signals.find(
      (s: { name: string }) => s.name === 'StateOfChargeBMS'
    )
    expect(sigStateOfChargeBMS!.factor).toBe('0.4')
    expect(sigStateOfChargeBMS!.offset).toBe('0')
    expect(sigStateOfChargeBMS!.min).toBe('0')
    expect(sigStateOfChargeBMS!.max).toBe('100')
    expect(sigStateOfChargeBMS!.unit).toBe('%')

    const id2 = 2550005945 & 0x1fffffff
    const msgVoltage = result.messages.find((m: { id: number }) => m.id === id2)
    expect(msgVoltage).toBeDefined()
    const sigVoltage = msgVoltage!.signals.find((s: { name: string }) => s.name === 'Voltage')
    expect(sigVoltage!.factor).toBe('0.001953125')
    expect(sigVoltage!.offset).toBe('0')
    expect(sigVoltage!.min).toBe('0')
    expect(sigVoltage!.max).toBe('0')
    expect(sigVoltage!.unit).toBe('V')
    expect(msgVoltage!.name).toBe('VoltageCurrent')
    expect(sigVoltage!.muxer_for_signal).toEqual('R')
    const id3 = 2550005878 & 0x1fffffff
    const msgOdometer = result.messages.find((m: { id: number }) => m.id === id3)
    expect(msgOdometer).toBeDefined()
    expect(msgOdometer!.name).toBe('Odometer')
    const sigOdometer = msgOdometer!.signals.find((s: { name: string }) => s.name === 'Odometer')
    expect(sigOdometer!.muxer_for_signal).toEqual('R')
    expect(sigOdometer!.factor).toBe('1')
    expect(sigOdometer!.offset).toBe('0')
    expect(sigOdometer!.min).toBe('0')
    expect(sigOdometer!.max).toBe('0')
    expect(sigOdometer!.unit).toBe('km')

    const sigOutdoorTemp = msgTemp!.signals.find((s: { name: string }) => s.name === 'OutdoorTemp')
    expect(sigOutdoorTemp!.factor).toBe('0.5')
    expect(sigOutdoorTemp!.offset).toBe('-50')
    expect(sigOutdoorTemp!.min).toBe('0')
    expect(sigOutdoorTemp!.max).toBe('0')
    expect(sigOutdoorTemp!.unit).toBe('degC')

    expect(msgTemp!.attributes['TransportProtocolType']).toBe('ISOTP')

    const signalIgnore = result.signal_defines.find((s) => s.name === 'SignalIgnore')
    // Add assertions for BA_DEF_ and BA_DEF_DEF_
    expect(signalIgnore).toBeDefined()
    expect(signalIgnore!.type).toBe('INT')
    expect(signalIgnore!.define).toBe('INT 0 1')
    expect(signalIgnore!.default).toBe('0')

    const frameDefine = result.frame_defines.find((s) => s.name === 'VFrameFormat')
    expect(frameDefine).toBeDefined()
    expect(frameDefine!.type).toBe('ENUM')
    expect(frameDefine!.define).toEqual(
      'ENUM  "StandardCAN","ExtendedCAN","StandardCAN_FD","ExtendedCAN_FD","J1939PG"'
    )
    expect(frameDefine!.default).toBe('')

    const msg17fe = result.messages.find((m: { id: number }) => m.id === 0x17fe007b)
    expect(msg17fe).toBeDefined()
    expect(msg17fe!.signals.find((s: { name: string }) => s.name === 'S')!.start_bit).toBe(0)
    expect(msg17fe!.signals.find((s: { name: string }) => s.name === 'R')!.start_bit).toBe(16)
    expect(
      msg17fe!.signals.find((s: { name: string }) => s.name === 'BattTempMain')!.start_bit
    ).toBe(24)
    expect(msg17fe!.signals.find((s: { name: string }) => s.name === 'Speed')!.start_bit).toBe(24)
    expect(
      msg17fe!.signals.find((s: { name: string }) => s.name === 'BatteryCurrentHV')!.start_bit
    ).toBe(48)
    expect(
      msg17fe!.signals.find((s: { name: string }) => s.name === 'BatteryVoltageHV')!.start_bit
    ).toBe(32)
    expect(
      msg17fe!.signals.find((s: { name: string }) => s.name === 'BatteryTotalChargeHV')!.start_bit
    ).toBe(88)
    expect(
      msg17fe!.signals.find((s: { name: string }) => s.name === 'BatteryTotalDischargeHV')!
        .start_bit
    ).toBe(120)
  })

  test('id2001.dbc', async () => {
    const id2001Dbc = path.join(__dirname, 'id2001.dbc')
    const result = await parse(id2001Dbc)
    expect(result).toBeDefined()
    const msg = result.messages.find((m) => m.id === 0x200)
    expect(msg!.name).toBe('Message_200')
    //set signal value
    const s = msg!.signals.find((s) => s.name === 'test')
    expect(s).toBeDefined()
    s!.value = '14'
    updateSignalRaw(s!)
    expect(s!.physValue).toBe('14')
    const buf = getMessageData(msg!)

    expect(buf).toEqual(Buffer.from([0, 0, 0, 1, 0xc0, 0, 0, 0]))
    writeMessageData(msg!, Buffer.from([0, 0, 0, 0xce, 0x80, 0, 0, 0]), result)
    expect(s!.value).toBe('1652')
  })

  test('testDbc1.dbc', async () => {
    const result = await parse(testDbc1)
    expect(result).toBeDefined()
    const msg = result.messages.find((m) => m.id === 0x150)
    expect(msg).toBeDefined()
    writeMessageData(msg!, Buffer.from([0xb7, 0x1b, 0x80, 0x02, 0x80, 0, 0xb5, 0xa0]), result)
    const s = msg!.signals.find((s) => s.name === 'MCU_F_CrtSpd')
    expect(s!.value).toBe('32770')
    expect(s!.physValue).toBe('2')

    const buf = getMessageData(msg!)
    // The original buffer has 0xA0 (10100000) at the end, but the DBC defines no signal for bit 63 (MSB).
    // getMessageData reconstructs the buffer from signals, so the unmapped bit 63 becomes 0.
    // Result is 0x20 (00100000).
    expect(buf).toEqual(Buffer.from([0xb7, 0x1b, 0x80, 0x02, 0x80, 0, 0xb5, 0x20]))

    s!.physValue = '3'
    updateSignalPhys(s!, result)
    const buf1 = getMessageData(msg!)
    expect(buf1).toEqual(Buffer.from([0xb7, 0x1b, 0x80, 0x03, 0x80, 0, 0xb5, 0x20]))
  })
})
