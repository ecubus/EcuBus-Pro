import { beforeAll, describe, expect, test } from 'vitest'
import { execBinary } from 'src/main/util'
import { getPythonPath } from 'src/main/python'
import path from 'path'
import fs from 'fs'
import { tmpdir } from 'os'

const cddParsePy = path.join(__dirname, '../../resources/cdd/cddparse.py')
// A CANdelaStudio template-derived document from the cddtools project, saved
// back out of CANdelaStudio with DoIP declared as supported: 7 interfaces
// (CAN and DoIP enabled), 114 data types, 16 DIDs, 4 DTCs, 30 diagnostic
// classes.
const cddToolsCdd = path.join(__dirname, 'fixtures/CddTools-doip.cdd')

async function runCddCommand(command: string, cddFilePath: string) {
  const pythonPath = fs.existsSync(getPythonPath())
    ? getPythonPath()
    : process.platform === 'win32'
      ? 'python'
      : 'python3'
  const outputPath = path.join(tmpdir(), `cdd_test_${Date.now()}.json`)
  const result = await execBinary(pythonPath, [cddParsePy, command, cddFilePath, outputPath], {
    timeout: 120000
  })
  if (!result.success) {
    throw new Error(result.stderr || 'CDD parse failed')
  }
  const jsonStr = fs.readFileSync(outputPath, 'utf-8')
  fs.unlinkSync(outputPath)
  return JSON.parse(jsonStr)
}

describe('CDD parseTesterInfo', () => {
  let testers: any

  beforeAll(async () => {
    const result = await runCddCommand('parseTesterInfo', cddToolsCdd)
    expect(result.error).toBe(0)
    testers = result.data.CddTools_DoIP
  })

  test('splits testers by variant and supported interface', () => {
    // Two variants and two supported interfaces, so neither name alone
    // identifies a tester.
    expect(Object.keys(testers).sort()).toEqual([
      'Base_Variant.CAN',
      'Base_Variant.DoIP_ISO13400',
      'Base_Variant1.CAN',
      'Base_Variant1.DoIP_ISO13400'
    ])
    expect(testers['Base_Variant.CAN'].type).toBe('can')
    expect(testers['Base_Variant.DoIP_ISO13400'].type).toBe('eth')
    expect(testers['Base_Variant.CAN'].didList.length).toBe(16)
    expect(testers['Base_Variant.CAN'].dtcList.length).toBe(4)
  })

  test('reads CAN identifiers and timing the ECU overrides', () => {
    const tester = testers['Base_Variant.CAN']

    expect(tester.udsTime.pTime).toBe(150)
    expect(tester.udsTime.pExtTime).toBe(2000)
    expect(tester.udsTime.s3Time).toBe(4000)
    expect(tester.udsTime.testerPresentEnable).toBe(true)
    expect(tester.udsTime.testerPresentAddrIndex).toBe(0)

    const [physical, functional] = tester.address
    expect(physical.canAddr.name).toBe('Physical')
    expect(physical.canAddr.canIdTx).toBe('0x7aa')
    expect(physical.canAddr.canIdRx).toBe('0x7ab')
    expect(physical.canAddr.addrFormat).toBe('NORMAL')
    expect(physical.canAddr.idType).toBe('STANDARD')
    // A classic CAN interface carries no CanFd* parameters at all.
    expect(physical.canAddr.canfd).toBe(false)
    expect(physical.canAddr.dlc).toBe(8)

    expect(functional.canAddr.addrType).toBe('FUNCTIONAL')
    expect(functional.canAddr.canIdTx).toBe('0x7df')
  })

  test('builds DoIP addresses from the CP_DoIPLogical parameters', () => {
    const tester = testers['Base_Variant.DoIP_ISO13400']

    expect(tester.udsTime.pTime).toBe(50)
    expect(tester.udsTime.pExtTime).toBe(5000)
    expect(tester.udsTime.s3Time).toBe(2000)
    // Tester-present rides a CAN address, so an Ethernet tester has none.
    expect(tester.udsTime.testerPresentEnable).toBe(false)

    const [physical, functional] = tester.address
    expect(physical.ethAddr.name).toBe('Physical')
    expect(physical.ethAddr.taType).toBe('physical')
    expect(physical.ethAddr.tester.testerLogicalAddr).toBe(0x0e00)
    // A document that names a gateway makes the ECU a node behind it.
    expect(physical.ethAddr.entity.nodeType).toBe('gateway')
    expect(physical.ethAddr.entity.nodeAddr).toBe(1)

    expect(functional.ethAddr.taType).toBe('functional')
    expect(functional.ethAddr.entity.nodeAddr).toBe(0xe400)
  })

  test('groups every service by the SID the document writes', () => {
    const services = testers['Base_Variant.CAN'].allServiceList

    expect(Object.keys(services).sort()).toEqual([
      '0x10',
      '0x11',
      '0x14',
      '0x19',
      '0x22',
      '0x23',
      '0x27',
      '0x28',
      '0x2A',
      '0x2C',
      '0x2E',
      '0x2F',
      '0x31',
      '0x34',
      '0x35',
      '0x36',
      '0x37',
      '0x3D',
      '0x3E',
      '0x85'
    ])
    expect(Object.values(services).flat().length).toBe(96)
  })

  test('a subfunction service locks its subfunction parameter', () => {
    const session = testers['Base_Variant.CAN'].allServiceList['0x10'].find(
      (s: any) => s.name === 'Default Session'
    )

    expect(session.subfunc).toBe('0x01')
    expect(session.autoSubfunc).toBe(true)

    const [subfunc] = session.params
    expect(subfunc.name).toBe('Subfunction DiagnosticSessionControl')
    expect(subfunc.type).toBe('NUM')
    expect(subfunc.bitLen).toBe(8)
    expect(subfunc.value.data).toEqual([1])
    expect(subfunc.phyValue).toBe(1)
    expect(subfunc.editable).toBe(false)
    expect(subfunc.deletable).toBe(false)
    expect(subfunc.meta.cddField.spec).toBe('sub')
    expect(subfunc.meta.cddField.choices['1']).toBe('defaultSession')

    // The response payload container contributes its own parameters.
    expect(session.respParams.slice(1).map((p: any) => [p.name, p.bitLen])).toEqual([
      ['P2', 16],
      ['P2Ex', 16]
    ])
  })

  test('SecurityAccess marks its subfunction accm, not sub', () => {
    const seed = testers['Base_Variant.CAN'].allServiceList['0x27'].find(
      (s: any) => s.name === 'RequestSeed'
    )

    expect(seed.subfunc).toBe('0x01')
    const securitySeed = seed.respParams.find((p: any) => p.name === 'SecuritySeed')
    // HexDump (4 Byte): a byte string, edited byte-wise rather than as a number.
    expect(securitySeed.type).toBe('ARRAY')
    expect(securitySeed.bitLen).toBe(32)
  })

  test('a DID read expands into one parameter per DID member', () => {
    const service = testers['Base_Variant.CAN'].allServiceList['0x22'].find(
      (s: any) => s.name === 'Development Data'
    )

    const [identifier] = service.params
    expect(identifier.name).toBe('DataIdentifier')
    expect(identifier.bitLen).toBe(16)
    expect(identifier.value.data).toEqual([0x01, 0x00])
    expect(identifier.meta.cddField.spec).toBe('id')

    expect(service.respParams.slice(1).map((p: any) => [p.name, p.bitLen])).toEqual([
      ['Operating System (Version)', 16],
      ['CAN Driver (Version)', 16],
      ['NM (Version)', 16],
      ['Diagnostic Module (Version)', 16],
      ['Transport Layer (Version)', 16]
    ])
  })

  test('an ASCII data type becomes an ASCII parameter of the full width', () => {
    const service = testers['Base_Variant.CAN'].allServiceList['0x22'].find(
      (s: any) => s.name === 'Ecu Identification'
    )
    const partNumber = service.respParams.find((p: any) => p.type === 'ASCII')

    // ASCII (13 Byte) is a field data type: bl=8 is one element, 13 of them.
    expect(partNumber.bitLen).toBe(104)
    expect(partNumber.value.data.length).toBe(13)
    expect(partNumber.meta.cddField.encoding).toBe('asc')
  })
})
