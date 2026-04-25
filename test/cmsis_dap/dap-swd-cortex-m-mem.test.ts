import { describe, it, expect } from 'vitest'
import { DapCommand } from '../../src/main/cmsis_dap/dap-protocol'
import {
  buildDapTransfer,
  swdRequestByte,
  parseDapTransferResponse,
  firstU32Value,
  DpReg
} from '../../src/main/cmsis_dap/dap-swd-transfer'
import {
  buildDpSelectValue,
  CORTEX_M_AHBP_AP_CSW_32,
  CortexM_Scs,
  memApBuildReadU32CommandSequence,
  memApParseReadU32Value
} from '../../src/main/cmsis_dap/dap-cortex-m-mem'

describe('DAP_SWD DAP_Transfer (encode)', () => {
  it('swdRequestByte matches CMSIS (DP read IDCODE)', () => {
    expect(swdRequestByte({ ap: false, read: true, addr: DpReg.IdCode })).toBe(0x02)
  })

  it('buildDapTransfer single DP read = [0x05, dap, 1, req]', () => {
    const b = buildDapTransfer(0, [{ ap: false, read: true, addr: 0x0 }])
    expect([...b]).toEqual([DapCommand.Transfer, 0, 1, 0x02])
  })

  it('buildDapTransfer DP write SELECT (addr 0x8)', () => {
    const sel = buildDpSelectValue(0, 0)
    const b = buildDapTransfer(0, [{ ap: false, read: false, addr: 0x8, wdata: sel }])
    expect(b[0]).toBe(0x05)
    const w0 = b.readUInt32LE(4)
    expect(w0).toBe(0x00000000)
  })
})

describe('DAP_SWD DAP_Transfer (decode)', () => {
  it('parseDapTransferResponse reads u32 (example IDCODE)', () => {
    const idc = 0x1ba01477
    const res = Buffer.alloc(3 + 4)
    res[0] = DapCommand.Transfer
    res[1] = 1
    res[2] = 0x01
    res.writeUInt32LE(idc, 3)
    const p = parseDapTransferResponse(res)
    expect(p.values.length).toBe(1)
    expect(firstU32Value(p)).toBe(idc)
  })
})

describe('Cortex-M MEM-AP (CPU address) command sequence (encode only)', () => {
  it('produces 4 DAP packet buffers for a 32-bit system read (CPUID default)', () => {
    const addr = CortexM_Scs.Cpuid
    const seq = memApBuildReadU32CommandSequence(0, 0, addr, CORTEX_M_AHBP_AP_CSW_32)
    expect(seq).toHaveLength(4)
    for (const p of seq) {
      expect(p[0]).toBe(DapCommand.Transfer)
    }
    const tar = seq[2]!
    const w = tar.readUInt32LE(4)
    expect(w).toBe(addr)
  })

  it('memApParseReadU32Value on synthetic DRW response', () => {
    const v = 0x411fc231
    const r = Buffer.alloc(7)
    r[0] = DapCommand.Transfer
    r[1] = 1
    r[2] = 1
    r.writeUInt32LE(v, 3)
    expect(memApParseReadU32Value(r)).toBe(v)
  })
})
