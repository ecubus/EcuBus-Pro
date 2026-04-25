import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** True when the `cmsis_dap.node` addon exists and we are on Windows. */
const nodeAddon = path.join(__dirname, '../../src/main/cmsis_dap/build/Release/cmsis_dap.node')
const haveAddon = process.platform === 'win32' && fs.existsSync(nodeAddon)

/**
 * Real hardware / driver tests: run only when the Win32 addon is present.
 * In CI (no probe), these pass trivially; with a DAP on USB you get live enumeration.
 */
describe.sequential('cmsis_dap native (Win32, optional hardware)', () => {
  let listCmsisDapDevicePaths: () => string[]
  let CmsisDapSession: typeof import('../../src/main/cmsis_dap/index').CmsisDapSession

  beforeAll(async () => {
    if (!haveAddon) {
      return
    }
    const m = await import('../../src/main/cmsis_dap/index')
    listCmsisDapDevicePaths = m.listCmsisDapDevicePaths
    CmsisDapSession = m.CmsisDapSession
  })

  it('loads addon and may list zero or more device paths', () => {
    if (!haveAddon) {
      return
    }
    const paths = listCmsisDapDevicePaths!()
    expect(Array.isArray(paths)).toBe(true)
    for (const p of paths) {
      expect(p.length).toBeGreaterThan(0)
    }
  }, 15_000)

  it('open + DAP_Info vendor string when a probe is connected', () => {
    if (!haveAddon) {
      return
    }
    const paths = listCmsisDapDevicePaths!()
    if (paths.length === 0) {
      return
    }
    const s = CmsisDapSession.open(paths[0]!)
    try {
      const v = s.getVendorName()
      expect(typeof v).toBe('string')
    } finally {
      s.close()
    }
  }, 20_000)

  /**
   * SWD + MEM-AP to a real target: set `ECUBUS_DAP_MCU=1` and connect a powered target to the SWD header.
   * Reads `IDCODE` (DP) and CPUID at 0xE000ED00 (32-bit system bus read).
   */
  it('ECUBUS_DAP_MCU=1: read DP IDCODE + CPUID (target must be wired)', () => {
    if (!haveAddon || process.env.ECUBUS_DAP_MCU !== '1') {
      return
    }
    const paths = listCmsisDapDevicePaths!()
    if (paths.length === 0) {
      return
    }
    const s = CmsisDapSession.open(paths[0]!)
    try {
      s.dapConnect('swd')
      const id = s.readDpIdCode(0)
      expect(id >>> 0).toBe(id)
      expect(id).not.toBe(0)
      expect(id).not.toBe(0xffffffff)
      const cpuid = s.readCortexMMemU32(0xe000ed00, { ap: 0, dapIndex: 0 })
      /* CPUID must be non-zero; exact value depends on core (often 0x41xxxxxx for ARM). */
      expect(cpuid).not.toBe(0)
      expect(cpuid).not.toBe(0xffffffff)
    } finally {
      s.dapDisconnect()
      s.close()
    }
  }, 60_000)
})
