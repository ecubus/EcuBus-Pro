import { describe, expect, test } from 'vitest'
import { execBinary } from 'src/main/util'
import { getPythonPath } from 'src/main/python'
import path from 'path'
import fs from 'fs'
import { tmpdir } from 'os'

const cddParsePy = path.join(__dirname, '../../resources/cdd/cddparse.py')
const testerInfoCdd = path.join(__dirname, 'fixtures/tester-info.cdd')

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
  test('detects supported CAN and DoIP interfaces from BusType', async () => {
    const result = await runCddCommand('parseTesterInfo', testerInfoCdd)

    expect(result.error).toBe(0)
    expect(result.data.SyntheticEcu).toBeDefined()

    const testers = result.data.SyntheticEcu
    expect(Object.keys(testers).sort()).toEqual(['CAN_FD', 'DoIP_ISO13400'])
    expect(testers.PrivateCAN).toBeUndefined()

    expect(testers.CAN_FD.type).toBe('can')
    expect(testers.DoIP_ISO13400.type).toBe('eth')
  })

  test('builds CAN addresses and tester-present timing', async () => {
    const result = await runCddCommand('parseTesterInfo', testerInfoCdd)
    const tester = result.data.SyntheticEcu.CAN_FD
    const addresses = tester.address

    expect(tester.udsTime.pTime).toBe(50)
    expect(tester.udsTime.pExtTime).toBe(500)
    expect(tester.udsTime.s3Time).toBe(5000)
    expect(tester.udsTime.testerPresentEnable).toBe(true)
    expect(tester.udsTime.testerPresentAddrIndex).toBe(0)

    expect(addresses.length).toBe(2)
    expect(addresses[0].canAddr.name).toBe('Physical')
    expect(addresses[0].canAddr.addrType).toBe('PHYSICAL')
    expect(addresses[0].canAddr.canIdTx).toBe('0x700')
    expect(addresses[0].canAddr.canIdRx).toBe('0x708')
    expect(addresses[0].canAddr.idType).toBe('STANDARD')
    expect(addresses[0].canAddr.canfd).toBe(true)
    expect(addresses[0].canAddr.brs).toBe(true)
    expect(addresses[0].canAddr.dlc).toBe(64)

    expect(addresses[1].canAddr.name).toBe('Functional')
    expect(addresses[1].canAddr.addrType).toBe('FUNCTIONAL')
    expect(addresses[1].canAddr.canIdTx).toBe('0x7df')
  })

  test('builds DoIP addresses without CAN flag leakage', async () => {
    const result = await runCddCommand('parseTesterInfo', testerInfoCdd)
    const tester = result.data.SyntheticEcu.DoIP_ISO13400
    const addresses = tester.address

    expect(tester.udsTime.pTime).toBe(50)
    expect(tester.udsTime.pExtTime).toBe(500)
    expect(tester.udsTime.s3Time).toBe(5000)
    expect(tester.udsTime.testerPresentEnable).toBe(false)

    expect(addresses.length).toBe(2)
    expect(addresses[0].ethAddr.name).toBe('Physical')
    expect(addresses[0].ethAddr.taType).toBe('physical')
    expect(addresses[0].ethAddr.entity.nodeType).toBe('gateway')
    expect(addresses[0].ethAddr.entity.logicalAddr).toBe(0x1000)
    expect(addresses[0].ethAddr.entity.nodeAddr).toBe(0x1001)
    expect(addresses[0].ethAddr.entity.vin).toBe('00000000000000000')
    expect(addresses[0].ethAddr.tester.testerLogicalAddr).toBe(0x0e00)

    expect(addresses[1].ethAddr.name).toBe('Functional')
    expect(addresses[1].ethAddr.taType).toBe('functional')
    expect(addresses[1].ethAddr.entity.nodeType).toBe('gateway')
    expect(addresses[1].ethAddr.entity.logicalAddr).toBe(0x1000)
    expect(addresses[1].ethAddr.entity.nodeAddr).toBe(0x1002)
  })
})
