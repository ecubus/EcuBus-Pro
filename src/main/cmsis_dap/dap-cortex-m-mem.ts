/**
 * Cortex-M: read a 32-bit system address over AHB-AP (MEM-AP) using CMSIS-DAP `DAP_Transfer` SWD
 * (ADIv5: DP.SELECT, then AP CSW / TAR / DRW). Requires a live SWD link and a suitable MEM-AP in `apIndex`.
 */
import { DapProtocolError } from './dap-protocol'
import { buildDapTransfer, parseDapTransferResponse, firstU32Value } from './dap-swd-transfer'

/** e.g. CPUID in SCS. Must be 4-byte aligned. */
export const CortexM_Scs = {
  Cpuid: 0xe000ed00
} as const

/**
 * Default MEM-AP CSW: 32-bit, no auto-increment, debug access, AP selected by DP.SELECT.
 * Tune for your bus (HPROT/HNONSEC) on secure MCUs.
 */
export const CORTEX_M_AHBP_AP_CSW_32 = 0xa2000002

/**
 * `DP.SELECT` value: choose AP and AP register bank.
 * @param ap 0..255 — AP in the DAP-2 scan chain
 * @param apRegBank 0..15 — AP bank in ADIv5 (bank 0: CSW/TAR/DRW for MEM-AP)
 */
export function buildDpSelectValue(ap: number, apRegBank: number = 0): number {
  return ((ap & 0xff) << 24) | ((apRegBank & 0x0f) << 4)
}

/** Step 1: write DP.SELECT. */
export function memApBuildWriteDpSelect(dapIndex: number, ap: number, apBank: number = 0): Buffer {
  return buildDapTransfer(dapIndex, [
    { ap: false, read: false, addr: 0x8, wdata: buildDpSelectValue(ap, apBank) }
  ])
}

/** Step 2: write MEM-AP CSW. */
export function memApBuildWriteCsw(
  dapIndex: number,
  csw: number = CORTEX_M_AHBP_AP_CSW_32
): Buffer {
  return buildDapTransfer(dapIndex, [{ ap: true, read: false, addr: 0x0, wdata: csw >>> 0 }])
}

/** Step 3: write MEM-AP TAR. */
export function memApBuildWriteTar(dapIndex: number, tar: number): Buffer {
  if ((tar & 3) !== 0) {
    throw new DapProtocolError('TAR must be 4-byte aligned for this helper')
  }
  return buildDapTransfer(dapIndex, [{ ap: true, read: false, addr: 0x4, wdata: tar >>> 0 }])
}

/** Step 4: read MEM-AP DRW (returns 32-bit system bus data). */
export function memApBuildReadDrw(dapIndex: number): Buffer {
  return buildDapTransfer(dapIndex, [{ ap: true, read: true, addr: 0xc }])
}

/**
 * Buffers in order: DP.SELECT, CSW, TAR, read DRW (each is one full DAP `writeRead` for bulk v2).
 */
export function memApBuildReadU32CommandSequence(
  dapIndex: number,
  ap: number,
  systemAddrAligned: number,
  csw: number = CORTEX_M_AHBP_AP_CSW_32
): Buffer[] {
  return [
    memApBuildWriteDpSelect(dapIndex, ap, 0),
    memApBuildWriteCsw(dapIndex, csw),
    memApBuildWriteTar(dapIndex, systemAddrAligned),
    memApBuildReadDrw(dapIndex)
  ]
}

/** After `writeRead` on the last command (`read DRW`), parse the uint32. */
export function memApParseReadU32Value(response: Buffer): number {
  const p = parseDapTransferResponse(response)
  const v = firstU32Value(p)
  if (v === undefined) {
    throw new DapProtocolError('no u32 in MEM-AP read response')
  }
  return v >>> 0
}
