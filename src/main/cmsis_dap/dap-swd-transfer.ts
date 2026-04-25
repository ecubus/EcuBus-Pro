/**
 * CMSIS-DAP `DAP_Transfer` (0x05) — SWD CoreSight access.
 * @see https://arm-software.github.io/CMSIS-DAP/latest/group__DAP__Transfer.html
 */
import { DapCommand, DapProtocolError } from './dap-protocol'

/** DAP_SWD (ADIv5) DP register address (only 0,4,8,C are used on SWD). */
export const DpReg = { IdCode: 0x0, CtlStatus: 0x4, Select: 0x8, Rdbuff: 0xc } as const

/** Bits in SWD request byte (CMSIS DAP.h). */
export const DapTransferBits = {
  Apndp: 1 << 0,
  Rnw: 1 << 1,
  A2: 1 << 2,
  A3: 1 << 3
} as const

export function swdRequestByte(p: { ap: boolean; read: boolean; addr: 0 | 4 | 8 | 0xc }): number {
  const a = (p.addr / 4) & 3
  let b = 0
  if (p.ap) {
    b |= DapTransferBits.Apndp
  }
  if (p.read) {
    b |= DapTransferBits.Rnw
  }
  if (a & 1) {
    b |= DapTransferBits.A2
  }
  if (a & 2) {
    b |= DapTransferBits.A3
  }
  return b
}

export type SwdTransferOp =
  | { ap: false; read: true; addr: 0 | 4 | 8 | 0xc }
  | { ap: false; read: false; addr: 0 | 4 | 8 | 0xc; wdata: number }
  | { ap: true; read: true; addr: 0 | 4 | 8 | 0xc; postRdbuffAfterRead?: false }
  | { ap: true; read: false; addr: 0 | 4 | 8 | 0xc; wdata: number }

/**
 * One CMSIS-DAP `DAP_Transfer` request buffer (v2 host sends this as a single command packet).
 */
export function buildDapTransfer(dapIndex: number, ops: SwdTransferOp[]): Buffer {
  if (ops.length < 1 || ops.length > 255) {
    throw new DapProtocolError('DAP_Transfer: bad op count')
  }
  const out: number[] = [DapCommand.Transfer, dapIndex & 0xff, ops.length & 0xff]
  for (const o of ops) {
    if (o.read) {
      out.push(swdRequestByte({ ap: o.ap, read: true, addr: o.addr as 0 | 4 | 8 | 0xc }))
    } else {
      out.push(swdRequestByte({ ap: o.ap, read: false, addr: o.addr as 0 | 4 | 8 | 0xc }))
      const w = o.wdata >>> 0
      out.push(w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, (w >> 24) & 0xff)
    }
  }
  return Buffer.from(out)
}

/**
 * Parse response from a single `CmsisDapSession.writeRead` after a DAP_Transfer command.
 * Layout (USB bulk, CMSIS-DAP v2):
 * - res[0] echoed command 0x05
 * - res[1] `responseCount` (number of data phases returned)
 * - res[2] final SWD `ack` status (bit0=OK, …)
 * - res[3..] optional `u32` read values (LE), one per successful read, order matches op order (with AP post rules).
 */
export function parseDapTransferResponse(res: Buffer): {
  count: number
  status: number
  /** Word values in transfer order; only filled when a read returned data. */
  values: number[]
} {
  if (res.length < 3) {
    throw new DapProtocolError('DAP_Transfer response too short')
  }
  if (res[0] !== DapCommand.Transfer) {
    throw new DapProtocolError('not a DAP_Transfer response')
  }
  const count = res[1]
  const status = res[2]
  const values: number[] = []
  let off = 3
  /* CMSIS appends one LE u32 per returned read; remainder length varies with probe. */
  while (off + 4 <= res.length) {
    values.push(res.readUInt32LE(off))
    off += 4
  }
  return { count, status, values }
}

/** First `u32` in the transfer response, or `undefined` if none. */
export function firstU32Value(parsed: { values: number[] }): number | undefined {
  return parsed.values[0]
}
