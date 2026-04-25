/**
 * High-level CMSIS-DAP (v2 USB bulk) session over the WinUSB native addon.
 * Prefer {@link CmsisDapSession} for command round-trips; use {@link dap-protocol} for wire encoding.
 */
import {
  CmsisDapU8Vector,
  cmsis_dap_get_last_error,
  cmsis_dap_list_device_paths,
  cmsis_dap_open,
  cmsis_dap_close,
  cmsis_dap_command
} from './client'
import * as Dap from './dap-protocol'
import { stringVectorToPathArray, u8VectorToBuffer } from './vector-helpers'
import * as Mem from './dap-cortex-m-mem'
import { buildDapTransfer, firstU32Value, parseDapTransferResponse } from './dap-swd-transfer'
export * from './dap-protocol'
export * from './dap-swd-transfer'
export * from './dap-cortex-m-mem'
export { stringVectorToPathArray, u8VectorToBuffer } from './vector-helpers'

/** Default timeout for DAP round-trips (ms). */
export const DEFAULT_DAP_TIMEOUT_MS = 5_000

type NativeU8 = InstanceType<typeof CmsisDapU8Vector>

/**
 * USB device interface paths (UTF-8) for CMSIS-DAP v2 WinUSB probes. Empty on non-Windows or if none.
 */
export function listCmsisDapDevicePaths(): string[] {
  const v = cmsis_dap_list_device_paths() as { size(): number; get(i: number): string }
  return stringVectorToPathArray(v)
}

function bufferToU8Vector(buf: Buffer | Uint8Array): NativeU8 {
  const v = new CmsisDapU8Vector() as unknown as NativeU8
  for (let i = 0; i < buf.length; i++) {
    v.add(buf[i]! & 0xff)
  }
  return v
}

export type CmsisDapHandle = object

/**
 * One open connection to a CMSIS-DAP v2 probe. Call {@link CmsisDapSession.writeRead} for raw
 * request/response, or helper methods for common DAP_Info / connect operations.
 */
export class CmsisDapSession {
  private _handle: CmsisDapHandle
  private _closed = false

  private constructor(handle: CmsisDapHandle) {
    this._handle = handle
  }

  /** Last Windows error from native layer (after failed operations), or 0. */
  get lastSystemError(): number {
    return cmsis_dap_get_last_error() >>> 0
  }

  get closed(): boolean {
    return this._closed
  }

  get nativeHandle(): CmsisDapHandle {
    return this._handle
  }

  /**
   * Open the first path from {@link listCmsisDapDevicePaths}, or a specific `devicePath` from that list.
   * @throws Error if the native open fails
   */
  static openFirstOr(options?: { devicePath?: string }): CmsisDapSession {
    const p = options?.devicePath
    if (p) {
      return CmsisDapSession.open(p)
    }
    const all = listCmsisDapDevicePaths()
    if (all.length === 0) {
      throw new Error('No CMSIS-DAP v2 (WinUSB) device found')
    }
    return CmsisDapSession.open(all[0]!)
  }

  static open(devicePath: string): CmsisDapSession {
    const h = cmsis_dap_open(devicePath) as CmsisDapHandle | null
    if (h == null) {
      const err = cmsis_dap_get_last_error()
      throw new Error(
        `cmsis_dap_open failed (Win32/last: 0x${(err >>> 0).toString(16)}): ${devicePath}`
      )
    }
    return new CmsisDapSession(h)
  }

  /**
   * Send one DAP command buffer and return the DAP response bytes (up to 4 KiB in firmware).
   */
  writeRead(request: Buffer | Uint8Array, timeoutMs: number = DEFAULT_DAP_TIMEOUT_MS): Buffer {
    this.ensureOpen()
    const req = bufferToU8Vector(
      request instanceof Buffer
        ? request
        : Buffer.from(request.buffer, request.byteOffset, request.byteLength)
    )
    const res = cmsis_dap_command(this._handle, req, timeoutMs >>> 0) as NativeU8
    if (!res) {
      const err = cmsis_dap_get_last_error()
      throw new Dap.DapProtocolError(
        `DAP transact failed (Win32/last: 0x${(err >>> 0).toString(16)})`
      )
    }
    if (res.size() === 0) {
      const err = cmsis_dap_get_last_error()
      throw new Dap.DapProtocolError(
        `DAP response empty (Win32/last: 0x${(err >>> 0).toString(16)})`
      )
    }
    return u8VectorToBuffer(res)
  }

  /**
   * DAP_Info for string fields (vendor, product, version, etc.).
   */
  readDapInfoString(infoId: number, timeoutMs: number = DEFAULT_DAP_TIMEOUT_MS): string {
    const res = this.writeRead(Dap.buildDapInfoRequest(infoId), timeoutMs)
    const { payload } = Dap.parseDapInfoResponse(res)
    return Dap.dapInfoPayloadToString(payload)
  }

  getVendorName(): string {
    return this.readDapInfoString(Dap.DapInfoId.Vendor)
  }
  getProductName(): string {
    return this.readDapInfoString(Dap.DapInfoId.Product)
  }
  getSerialNumber(): string {
    return this.readDapInfoString(Dap.DapInfoId.Serial)
  }
  getCmsisDapVersion(): string {
    return this.readDapInfoString(Dap.DapInfoId.CmsisDapProtocolVersion)
  }

  /** One-byte capabilities mask for ID 0xF0, or the two-byte form if the probe returns Len=2. */
  getCapabilitiesBytes(timeoutMs: number = DEFAULT_DAP_TIMEOUT_MS): Buffer {
    const res = this.writeRead(Dap.buildDapInfoRequest(Dap.DapInfoId.Capabilities), timeoutMs)
    const { payload } = Dap.parseDapInfoResponse(res)
    return Buffer.from(payload)
  }

  getMaxPacketSize(): number {
    const res = this.writeRead(Dap.buildDapInfoRequest(Dap.DapInfoId.PacketSize))
    const { payload } = Dap.parseDapInfoResponse(res)
    return Dap.dapInfoPayloadToUInt16LE(payload)
  }

  dapConnect(
    port: 'default' | 'swd' | 'jtag' = 'swd',
    timeoutMs: number = DEFAULT_DAP_TIMEOUT_MS
  ): Buffer {
    return this.writeRead(Dap.buildDapConnectRequest(port), timeoutMs)
  }

  dapDisconnect(timeoutMs: number = DEFAULT_DAP_TIMEOUT_MS): Buffer {
    return this.writeRead(Dap.buildDapDisconnectRequest(), timeoutMs)
  }

  /**
   * Read a 32-bit word from the Cortex-M AHB-AP (system bus) at a 4-byte–aligned address.
   * You must have SWD up (e.g. `dapConnect('swd')`) and the correct MEM-AP in `ap` (default 0).
   */
  readCortexMMemU32(
    alignedAddr: number,
    options?: { ap?: number; dapIndex?: number; csw?: number; timeoutMs?: number }
  ): number {
    this.ensureOpen()
    const ap = options?.ap ?? 0
    const dapIndex = options?.dapIndex ?? 0
    const t = options?.timeoutMs ?? DEFAULT_DAP_TIMEOUT_MS
    const csw = options?.csw ?? Mem.CORTEX_M_AHBP_AP_CSW_32
    const sequence = Mem.memApBuildReadU32CommandSequence(dapIndex, ap, alignedAddr >>> 0, csw)
    for (let i = 0; i < sequence.length - 1; i++) {
      this.writeRead(sequence[i]!, t)
    }
    return Mem.memApParseReadU32Value(this.writeRead(sequence[sequence.length - 1]!, t))
  }

  /**
   * Read the SW-DP `IDCODE` (DP register 0) — quick check that the SWD link is alive.
   */
  readDpIdCode(dapIndex: number = 0, timeoutMs: number = DEFAULT_DAP_TIMEOUT_MS): number {
    this.ensureOpen()
    const res = this.writeRead(
      buildDapTransfer(dapIndex, [{ ap: false, read: true, addr: 0x0 }]),
      timeoutMs
    )
    const w = firstU32Value(parseDapTransferResponse(res))
    if (w === undefined) {
      throw new Dap.DapProtocolError('IDCODE: no 32-bit value in response')
    }
    return w >>> 0
  }

  close(): void {
    if (this._closed) {
      return
    }
    cmsis_dap_close(this._handle as never)
    this._closed = true
  }

  private ensureOpen(): void {
    if (this._closed) {
      throw new Error('CmsisDapSession is closed')
    }
  }
}

export { listCmsisDapDevicePaths as listCmsisDapPaths }

export { CmsisDapU8Vector, CmsisDapStringVector } from './client'
export { default as cmsisDapNative } from './client'
