import { describe, expect, test, beforeAll } from 'vitest'
import { execBinary } from 'src/main/util'
import { getPythonPath } from 'src/main/python'
import path from 'path'
import fs from 'fs'
import { tmpdir } from 'os'

const odxParsePy = path.join(__dirname, '../../resources/odx/odxparse.py')
const pdxFile = path.join(__dirname, 'somersault.pdx')
// somersault.pdx with one PHYSICAL-DEFAULT-VALUE of an A_BYTEFIELD comparam
// rewritten as "0x3E80", the way tools other than the reference one write it.
const bytefieldPdxFile = path.join(__dirname, 'somersault-bytefield-0x.pdx')
const exampleEcuPdxFile = path.join(__dirname, 'UDS-ExampleEcu-5.2.1.pdx')
// UDS-ExampleEcu with its six LINEAR conversions relabelled SCALE-LINEAR,
// which this parser does not model. LINEAR and SCALE-LINEAR carry the same
// COMPU-SCALES structure, so the document stays valid.
const scaleLinearPdxFile = path.join(__dirname, 'UDS-ExampleEcu-scale-linear.pdx')
// UDS-ExampleEcu with one linear conversion scaling an integer-coded value
// by 0.5, and somersault exported without the comparam files it references.
const fractionalFactorPdxFile = path.join(__dirname, 'UDS-ExampleEcu-fractional-factor.pdx')
const noComparamsPdxFile = path.join(__dirname, 'somersault-no-comparams.pdx')

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

  test('names the services it could not import', () => {
    // schroedinger has no service identifier in its request, so it cannot be
    // filed under a SID. It used to vanish from the import with no trace.
    expect(result.skipped.map((s: any) => [s.service, s.reason])).toEqual([
      ['schroedinger', 'no service identifier in the request'],
      ['schroedinger', 'no service identifier in the request'],
      ['schroedinger', 'no service identifier in the request']
    ])
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

describe('ODX Parser - byte fields written with a 0x prefix', () => {
  function serviceNames(result: any) {
    const names: string[] = []
    for (const layers of Object.values(result.data as Record<string, any>)) {
      for (const tester of Object.values(layers as Record<string, any>)) {
        for (const items of Object.values((tester as any).allServiceList as Record<string, any>)) {
          for (const item of items as any[]) {
            names.push(item.name)
          }
        }
      }
    }
    return names.sort()
  }

  test('reads the document the same as one without the prefix', async () => {
    // A_BYTEFIELD is plain hexBinary, so odxtools takes it two characters at
    // a time: "0x3E80" makes the first pair "0x" and used to abort the whole
    // import with `invalid literal for int() with base 16: '0x'` (#422).
    const prefixed = await runOdxCommand('parseTesterInfo', bytefieldPdxFile, true)
    const plain = await runOdxCommand('parseTesterInfo', pdxFile, true)

    expect(prefixed.error).toBe(0)
    expect(serviceNames(prefixed)).toEqual(serviceNames(plain))
  })
})

describe('ODX Parser - UDS-ExampleEcu-5.2.1.pdx', () => {
  let result: any

  beforeAll(async () => {
    result = await runOdxCommand('parseTesterInfo', exampleEcuPdxFile, true)
    expect(result.error).toBe(0)
  })

  test('reports nothing skipped for a document it fully understands', () => {
    expect(result.skipped).toEqual([])
  })

  test('imports every service the document declares', () => {
    // Services used to disappear one by one, silently: the limits of a
    // linear conversion moved onto the compu method's segment in odxtools,
    // and encoding a single parameter outside its PDU context makes the
    // encoder refuse documents it has every right to refuse. Neither says
    // anything about whether the service can be imported.
    for (const tester of Object.values(result.data.Door) as any[]) {
      const services = Object.values(tester.allServiceList).flat()
      expect(services.length).toBe(86)
    }
  })

  test('a structure is as wide as its members say', () => {
    // Codingstring_STRUCTURE declares BYTE-SIZE 2 and its members cover two
    // bytes, but the encoder appends a third; the member layout wins.
    const service = (result.data.Door.Door.allServiceList['0x2E'] as any[]).find(
      (s) => s.name === 'Variant Coding Write'
    )
    const codingstring = service.params.find((p: any) => p.name === 'Codingstring')

    expect(codingstring.bitLen).toBe(16)
    expect(codingstring.value.data).toEqual([0x94, 0x21])
    expect(codingstring.meta.subParams.map((p: any) => [p.name, p.bitLen])).toEqual([
      ['CountryType', 4],
      ['VehicleType', 4],
      ['VehicleSpeedToLockDoor', 7],
      ['WindowLift_Support', 1]
    ])
  })
})

describe('ODX Parser - a conversion the parser does not model', () => {
  test('keeps the parameter on its coded type instead of losing the service', async () => {
    // Sixteen services per variant used to disappear over this: the physical
    // reading of a value is not what decides whether a service is importable.
    const result = await runOdxCommand('parseTesterInfo', scaleLinearPdxFile, true)

    expect(result.error).toBe(0)
    expect(result.skipped).toEqual([])
    for (const tester of Object.values(result.data.Door) as any[]) {
      expect(Object.values(tester.allServiceList).flat().length).toBe(86)
    }

    const session = (result.data.Door.Door.allServiceList['0x10'] as any[]).find(
      (s) => s.name === 'Default Session Start'
    )
    const p2Ex = session.respParams.find((p: any) => p.name === 'P2Ex')
    expect(p2Ex.meta.cm).toBe('ScaleLinearCompuMethod')
    expect(p2Ex.type).toBe('NUM')
    expect(p2Ex.bitLen).toBe(16)
  })
})

describe('ODX Parser - documents as tools in the field write them', () => {
  test('reads a conversion that scales an integer-coded value by a fraction', async () => {
    // COMPU-RATIONAL-COEFFS holds real numbers, but odxtools parses them
    // with the value's own (here integer) type, so the whole file failed
    // with "Expected an integer value, got 0.5".
    const result = await runOdxCommand('parseTesterInfo', fractionalFactorPdxFile, true)

    expect(result.error).toBe(0)
    expect(result.notes ?? []).toEqual([])
    for (const tester of Object.values(result.data.Door) as any[]) {
      expect(Object.values(tester.allServiceList).flat().length).toBe(86)
    }
  })

  test('reads a PDX exported without its comparam files', async () => {
    // The ISO comparam subsets are commonly treated as standard and left out
    // of the archive, which used to make the file unreadable outright.
    const result = await runOdxCommand('parseTesterInfo', noComparamsPdxFile, true)

    expect(result.error).toBe(0)
    const services = Object.values(result.data.somersault as Record<string, any>).flatMap((t) =>
      Object.values(t.allServiceList).flat()
    )
    expect(services.length).toBe(20)
    // The services are all there; what the comparams would have supplied is
    // not, and the user is told so rather than left guessing.
    expect(result.notes.length).toBe(1)
    expect(result.notes[0]).toContain('definitions it does not carry')
  })
})

describe('ODX Parser - CAN identifiers come from the document', () => {
  test('reads the identifier table rather than the ISO defaults', async () => {
    // ODX keeps the physical request and response identifiers in the
    // CP_UniqueRespIdTable complex parameter. Reading only the comparam
    // subset defaults gave every document 0x700/0x701, which is nobody's ECU.
    const result = await runOdxCommand('parseTesterInfo', exampleEcuPdxFile, true)
    const tester = result.data.Door.Door

    const [physical, functional] = tester.address
    expect(physical.canAddr.canIdTx).toBe('0x701')
    expect(physical.canAddr.canIdRx).toBe('0x601')
    // CP_CanFuncReqId = 1872
    expect(functional.canAddr.canIdTx).toBe('0x750')
    // CP_StMin is stated in microseconds
    expect(physical.canAddr.stMin).toBe(20)
    // CP_CanFillerByteHandling = Enabled
    expect(physical.canAddr.padding).toBe(true)
  })

  test('a 29-bit document keeps its extended identifiers', async () => {
    // somersault states 123/456 in its table, an 11-bit pair.
    const result = await runOdxCommand('parseTesterInfo', pdxFile, true)
    const tester = result.data.somersault.somersault_base_variant

    expect(tester.address[0].canAddr.canIdTx).toBe('0x7b')
    expect(tester.address[0].canAddr.canIdRx).toBe('0x1c8')
    expect(tester.address[0].canAddr.idType).toBe('STANDARD')
    // The filler byte comes from CP_CanFillerByte, here the subset default,
    // rather than from a hard-coded 0x00.
    expect(tester.address[0].canAddr.paddingValue).toBe('0x55')
  })
})
