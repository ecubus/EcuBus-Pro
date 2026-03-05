import { describe, expect, test, beforeAll } from 'vitest'
import { execBinary } from 'src/main/util'
import { getPythonPath } from 'src/main/python'
import path from 'path'
import fs from 'fs'
import { tmpdir } from 'os'

const odxParsePy = path.join(__dirname, '../../resources/odx/odxparse.py')
const pdxFile = path.join(__dirname, 'somersault.pdx')

async function runOdxCommand(command: string, odxFilePath: string, parseResp = false) {
  const pythonPath = getPythonPath()
  const outputPath = path.join(tmpdir(), `odx_test_${Date.now()}.json`)
  const args = [odxParsePy, command, odxFilePath, outputPath]
  if (parseResp) {
    args.push('--parseResp')
  }
  const result = await execBinary(pythonPath, args, { timeout: 120000 })
  if (!result.success) {
    throw new Error(result.stderr || 'ODX parse failed')
  }
  const jsonStr = fs.readFileSync(outputPath, 'utf-8')
  fs.unlinkSync(outputPath)
  return JSON.parse(jsonStr)
}

describe('ODX Parser - somersault.pdx', () => {
  test('parse: returns services grouped by container/layer/serviceId', async () => {
    const result = await runOdxCommand('parse', pdxFile)

    expect(result.error).toBe(0)
    expect(result.data).toBeDefined()
    expect(result.data['somersault']).toBeDefined()

    const base = result.data['somersault']['somersault_base_variant']
    expect(base).toBeDefined()

    expect(base['0x10']).toBeDefined()
    expect(base['0x10'].length).toBe(2)
    expect(base['0x10'].map((s: any) => s.name)).toContain('session_start')
    expect(base['0x10'].map((s: any) => s.name)).toContain('session_stop')

    expect(base['0x3E']).toBeDefined()
    expect(base['0x3E'][0].name).toBe('tester_present')

    expect(base['0x22']).toBeDefined()
    expect(base['0x22'][0].name).toBe('report_status')

    expect(base['0xBA']).toBeDefined()
    expect(base['0xBA'][0].name).toBe('do_forward_flips')

    expect(base['0xBB']).toBeDefined()
    expect(base['0xBB'][0].name).toBe('do_backward_flips')

    const lazy = result.data['somersault']['somersault_lazy']
    expect(lazy).toBeDefined()
    expect(lazy['0xBA']).toBeDefined()
    expect(lazy['0xBB']).toBeUndefined()

    const assiduous = result.data['somersault']['somersault_assiduous']
    expect(assiduous).toBeDefined()
    expect(assiduous['0xBB']).toBeDefined()
    expect(assiduous['0x3']).toBeDefined()
    expect(assiduous['0x3'][0].name).toBe('headstand')
  })

  test('parse with response: includes respParams', async () => {
    const result = await runOdxCommand('parse', pdxFile, true)

    expect(result.error).toBe(0)
    const base = result.data['somersault']['somersault_base_variant']

    const reportStatus = base['0x22'][0]
    expect(reportStatus.respParams.length).toBeGreaterThan(0)

    const forwardFlips = base['0xBA'][0]
    expect(forwardFlips.respParams.length).toBe(2)
  })

  test('parse: service params have correct structure', async () => {
    const result = await runOdxCommand('parse', pdxFile, true)
    const base = result.data['somersault']['somersault_base_variant']

    const forwardFlips = base['0xBA'][0]
    expect(forwardFlips.id).toBeDefined()
    expect(forwardFlips.serviceId).toBe('0xBA')
    expect(forwardFlips.params.length).toBe(2)

    for (const param of forwardFlips.params) {
      expect(param.id).toBeDefined()
      expect(param.name).toBeDefined()
      expect(param.type).toBeDefined()
      expect(param.bitLen).toBeTypeOf('number')
      expect(param.bitLen).toBeGreaterThan(0)
    }

    const sobernessCheck = forwardFlips.params.find(
      (p: any) => p.name === 'forward_soberness_check'
    )
    expect(sobernessCheck).toBeDefined()

    const numFlips = forwardFlips.params.find((p: any) => p.name === 'num_flips')
    expect(numFlips).toBeDefined()
  })
})

describe('ODX parseTesterInfo - somersault.pdx', () => {
  let result: any

  beforeAll(async () => {
    result = await runOdxCommand('parseTesterInfo', pdxFile, true)
  })

  test('returns valid result', () => {
    expect(result.error).toBe(0)
    expect(result.data).toBeDefined()
    expect(result.data['somersault']).toBeDefined()
  })

  test('contains all expected diag layers', () => {
    const layers = Object.keys(result.data['somersault'])
    expect(layers).toContain('somersault_base_variant')
    expect(layers).toContain('somersault_lazy')
    expect(layers).toContain('somersault_assiduous')
    expect(layers.length).toBe(3)
  })

  test('TesterInfo has correct structure', () => {
    const tester = result.data['somersault']['somersault_base_variant']

    expect(tester.id).toBeDefined()
    expect(typeof tester.id).toBe('string')
    expect(tester.id.length).toBe(36)

    expect(tester.name).toBe('somersault_base_variant')
    expect(tester.type).toBe('can')
    expect(tester.seqList).toEqual([])

    expect(tester.udsTime).toBeDefined()
    expect(tester.address).toBeDefined()
    expect(Array.isArray(tester.address)).toBe(true)
    expect(tester.allServiceList).toBeDefined()
  })

  test('udsTime has correct timing from comparams', () => {
    const uds = result.data['somersault']['somersault_base_variant'].udsTime

    expect(uds.pTime).toBe(100)
    expect(uds.pExtTime).toBe(6000)
    expect(uds.s3Time).toBe(3000)
    expect(uds.testerPresentEnable).toBe(true)
  })

  test('address contains physical and functional CAN addresses', () => {
    const addrs = result.data['somersault']['somersault_base_variant'].address

    expect(addrs.length).toBe(2)

    const phys = addrs.find((a: any) => a.canAddr.addrType === 'PHYSICAL')
    expect(phys).toBeDefined()
    expect(phys.type).toBe('can')
    expect(phys.canAddr.name).toBe('Physical')
    expect(phys.canAddr.addrFormat).toBe('NORMAL')
    expect(phys.canAddr.idType).toBe('STANDARD')
    expect(phys.canAddr.canfd).toBe(false)
    expect(phys.canAddr.dlc).toBe(8)
    expect(phys.canAddr.padding).toBe(true)
    expect(phys.canAddr.nAs).toBe(1000)
    expect(phys.canAddr.nBs).toBe(1000)

    const func = addrs.find((a: any) => a.canAddr.addrType === 'FUNCTIONAL')
    expect(func).toBeDefined()
    expect(func.canAddr.name).toBe('Functional')
    expect(func.canAddr.canIdTx).toBe('0x7df')
  })

  test('allServiceList groups services by serviceId', () => {
    const services = result.data['somersault']['somersault_base_variant'].allServiceList

    expect(services['0x10']).toBeDefined()
    expect(services['0x10'].length).toBe(2)

    expect(services['0x3E']).toBeDefined()
    expect(services['0x3E'].length).toBe(1)

    expect(services['0x22']).toBeDefined()
    expect(services['0xBA']).toBeDefined()
    expect(services['0xBB']).toBeDefined()
    expect(services['0xBD']).toBeDefined()
  })

  test('somersault_lazy has fewer services than somersault_assiduous', () => {
    const lazy = result.data['somersault']['somersault_lazy'].allServiceList
    const assiduous = result.data['somersault']['somersault_assiduous'].allServiceList

    const lazyCount = Object.values(lazy).flat().length
    const assiduousCount = Object.values(assiduous).flat().length

    expect(lazyCount).toBeLessThan(assiduousCount)

    expect(lazy['0xBB']).toBeUndefined()
    expect(lazy['0xBD']).toBeUndefined()
    expect(assiduous['0xBB']).toBeDefined()
    expect(assiduous['0xBD']).toBeDefined()
    expect(assiduous['0x3']).toBeDefined()
  })

  test('service items have valid params with respParams', () => {
    const services = result.data['somersault']['somersault_base_variant'].allServiceList

    const forwardFlips = services['0xBA'][0]
    expect(forwardFlips.name).toBe('do_forward_flips')
    expect(forwardFlips.serviceId).toBe('0xBA')
    expect(forwardFlips.params.length).toBe(2)
    expect(forwardFlips.respParams.length).toBe(2)

    const reportStatus = services['0x22'][0]
    expect(reportStatus.name).toBe('report_status')
    expect(reportStatus.respParams.length).toBeGreaterThan(0)
  })

  test('each tester has unique id', () => {
    const ids = Object.values(result.data['somersault']).map((t: any) => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  test('services with subfunctions keep subfunc as first param', () => {
    const services = result.data['somersault']['somersault_base_variant'].allServiceList

    for (const svc of services['0x10']) {
      expect(svc.autoSubfunc).toBe(true)
      expect(svc.suppress).toBe(false)
      expect(svc.params.length).toBeGreaterThan(0)
      const firstParam = svc.params[0]
      expect(firstParam.deletable).toBe(false)
      expect(firstParam.editable).toBe(true)
      expect(firstParam.bitLen).toBe(8)
      expect(firstParam.bytePos).toBe(1)

      if (svc.respParams.length > 0) {
        const firstResp = svc.respParams[0]
        expect(firstResp.deletable).toBe(false)
        expect(firstResp.editable).toBe(true)
      }
    }

    const testerPresent = services['0x3E'][0]
    expect(testerPresent.autoSubfunc).toBe(true)
    expect(testerPresent.suppress).toBe(false)
    expect(testerPresent.params.length).toBeGreaterThan(0)
    expect(testerPresent.params[0].deletable).toBe(false)
    expect(testerPresent.params[0].editable).toBe(true)
    expect(testerPresent.params[0].bitLen).toBe(8)

    const forwardFlips = services['0xBA'][0]
    expect(forwardFlips.autoSubfunc).toBeUndefined()

    const sessionStop = services['0x10'].find((s: any) => s.name === 'session_stop')
    expect(sessionStop).toBeDefined()
    expect(sessionStop.subfunc.data).toEqual([1])
    expect(sessionStop.params[0].value.data).toEqual([1])
  })
})
