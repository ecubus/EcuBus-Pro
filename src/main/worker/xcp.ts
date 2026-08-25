/**
 * XCP (ASAM MCD-1 XCP) worker API — drive an XCP slave from a user script.
 *
 * @remarks
 * All functions bridge to the main process via `emitWorkerEventWithReply('xcpApi', ...)`.
 * Use {@link XcpCreateConnection} to open an XCP-on-CAN connection and obtain a handle,
 * then pass that handle to the command helpers. Always call {@link XcpCloseConnection}
 * when done.
 *
 * This first iteration targets XCP-on-CAN and the standard command set (session,
 * memory transfer, calibration/paging, basic DAQ and programming). The protocol
 * codec is validated against the test vectors of the mature
 * {@link https://github.com/christoph2/pyxcp | pyXCP} master.
 *
 * @module xcp
 * @category XCP
 *
 * @example
 * ```ts
 * import { XcpCreateConnection, XcpConnect, XcpShortUpload, XcpCloseConnection } from 'ecubus-worker'
 *
 * Util.Init(async () => {
 *   const handle = await XcpCreateConnection({
 *     name: 'ecu',
 *     canIdCmd: 0x7e0,
 *     canIdResp: 0x7e1,
 *     padding: true
 *   })
 *   const info = await XcpConnect(handle)
 *   console.log('MAX_CTO', info.maxCto, 'MAX_DTO', info.maxDto)
 *   const bytes = await XcpShortUpload(handle, 4, 0x1000)
 *   console.log('mem', bytes)
 *   await XcpCloseConnection(handle)
 * })
 * ```
 */

import { emitWorkerEventWithReply } from './uds'
import type { XcpCanAddr } from '../xcp/xcpCan'
import type {
  BuildChecksumResponse,
  ConnectResponse,
  GetCommModeInfoResponse,
  GetIdResponse,
  GetSeedResponse,
  GetStatusResponse,
  GetVersionResponse,
  ResourceFlags,
  StartStopDaqListResponse
} from '../xcp/xcpProtocol'

/**
 * XCP-on-CAN addressing configuration passed to {@link XcpCreateConnection}.
 * @category XCP
 */
export type { XcpCanAddr }

async function xcpCommand<T>(handle: string, method: string, args: any[] = []): Promise<T> {
  return (await emitWorkerEventWithReply('xcpApi', {
    op: 'command',
    handle,
    method,
    args
  })) as T
}

/**
 * Open an XCP-on-CAN connection and return an opaque handle string.
 *
 * @param addr - XCP-on-CAN addressing (command / response CAN identifiers, framing).
 * @param device - Optional CAN channel name; the first attached CAN channel is used when omitted.
 * @returns Opaque handle string to pass to the other Xcp* functions.
 * @throws If no suitable CAN device is found.
 * @category XCP
 */
export async function XcpCreateConnection(addr: XcpCanAddr, device?: string): Promise<string> {
  const handle = await emitWorkerEventWithReply('xcpApi', {
    op: 'createConnection',
    addr,
    device
  })
  return handle as string
}

/**
 * Close an XCP connection previously opened with {@link XcpCreateConnection}.
 * @category XCP
 */
export async function XcpCloseConnection(handle: string): Promise<void> {
  await emitWorkerEventWithReply('xcpApi', { op: 'closeConnection', handle })
}

/** CONNECT to the slave and read back its properties. @category XCP */
export function XcpConnect(handle: string, mode = 0): Promise<ConnectResponse> {
  return xcpCommand(handle, 'connect', [mode])
}

/** DISCONNECT from the slave. @category XCP */
export function XcpDisconnect(handle: string): Promise<number[]> {
  return xcpCommand(handle, 'disconnect')
}

/** GET_STATUS: current session and resource-protection status. @category XCP */
export function XcpGetStatus(handle: string): Promise<GetStatusResponse> {
  return xcpCommand(handle, 'getStatus')
}

/** GET_COMM_MODE_INFO: optional communication modes and timing. @category XCP */
export function XcpGetCommModeInfo(handle: string): Promise<GetCommModeInfoResponse> {
  return xcpCommand(handle, 'getCommModeInfo')
}

/** GET_VERSION: protocol and transport layer versions. @category XCP */
export function XcpGetVersion(handle: string): Promise<GetVersionResponse> {
  return xcpCommand(handle, 'getVersion')
}

/** GET_ID: request the identifier header (identifier bytes follow via {@link XcpUpload}). @category XCP */
export function XcpGetId(handle: string, mode: number): Promise<GetIdResponse> {
  return xcpCommand(handle, 'getId', [mode])
}

/** GET_SEED: request a seed for seed & key unlock. @category XCP */
export function XcpGetSeed(
  handle: string,
  mode: number,
  resource: number
): Promise<GetSeedResponse> {
  return xcpCommand(handle, 'getSeed', [mode, resource])
}

/** UNLOCK: send the computed key to unlock a protected resource. @category XCP */
export function XcpUnlock(handle: string, length: number, key: number[]): Promise<ResourceFlags> {
  return xcpCommand(handle, 'unlock', [length, key])
}

/** SET_MTA: set the Memory Transfer Address pointer. @category XCP */
export function XcpSetMta(
  handle: string,
  address: number,
  addressExtension = 0
): Promise<number[]> {
  return xcpCommand(handle, 'setMta', [address, addressExtension])
}

/** UPLOAD: read `count` elements from the current MTA. @category XCP */
export function XcpUpload(handle: string, count: number): Promise<number[]> {
  return xcpCommand(handle, 'upload', [count])
}

/** SHORT_UPLOAD: read `count` elements from an explicit address. @category XCP */
export function XcpShortUpload(
  handle: string,
  count: number,
  address: number,
  addressExtension = 0
): Promise<number[]> {
  return xcpCommand(handle, 'shortUpload', [count, address, addressExtension])
}

/** BUILD_CHECKSUM: compute a checksum over a memory block from the current MTA. @category XCP */
export function XcpBuildChecksum(
  handle: string,
  blockSize: number
): Promise<BuildChecksumResponse> {
  return xcpCommand(handle, 'buildChecksum', [blockSize])
}

/** DOWNLOAD: write `data` to the current MTA. @category XCP */
export function XcpDownload(handle: string, data: number[]): Promise<number[]> {
  return xcpCommand(handle, 'download', [data])
}

/** SHORT_DOWNLOAD: write `data` to an explicit address. @category XCP */
export function XcpShortDownload(
  handle: string,
  address: number,
  addressExtension: number,
  data: number[]
): Promise<number[]> {
  return xcpCommand(handle, 'shortDownload', [address, addressExtension, data])
}

/** MODIFY_BITS: atomic read-modify-write of a 16-bit word at the current MTA. @category XCP */
export function XcpModifyBits(
  handle: string,
  shiftValue: number,
  andMask: number,
  xorMask: number
): Promise<number[]> {
  return xcpCommand(handle, 'modifyBits', [shiftValue, andMask, xorMask])
}

/** SET_CAL_PAGE: activate a calibration page. @category XCP */
export function XcpSetCalPage(
  handle: string,
  mode: number,
  segment: number,
  page: number
): Promise<number[]> {
  return xcpCommand(handle, 'setCalPage', [mode, segment, page])
}

/** GET_CAL_PAGE: get the active calibration page of a segment. @category XCP */
export function XcpGetCalPage(handle: string, mode: number, segment: number): Promise<number> {
  return xcpCommand(handle, 'getCalPage', [mode, segment])
}

/** SET_DAQ_PTR: select the DAQ list / ODT / ODT-entry for subsequent WRITE_DAQ. @category XCP */
export function XcpSetDaqPtr(
  handle: string,
  daqListNumber: number,
  odtNumber: number,
  odtEntryNumber: number
): Promise<number[]> {
  return xcpCommand(handle, 'setDaqPtr', [daqListNumber, odtNumber, odtEntryNumber])
}

/** WRITE_DAQ: configure the currently selected ODT entry. @category XCP */
export function XcpWriteDaq(
  handle: string,
  bitOffset: number,
  size: number,
  addressExtension: number,
  address: number
): Promise<number[]> {
  return xcpCommand(handle, 'writeDaq', [bitOffset, size, addressExtension, address])
}

/** SET_DAQ_LIST_MODE: set the mode of a DAQ list. @category XCP */
export function XcpSetDaqListMode(
  handle: string,
  mode: number,
  daqListNumber: number,
  eventChannelNumber: number,
  prescaler: number,
  priority: number
): Promise<number[]> {
  return xcpCommand(handle, 'setDaqListMode', [
    mode,
    daqListNumber,
    eventChannelNumber,
    prescaler,
    priority
  ])
}

/** START_STOP_DAQ_LIST: start/stop/select a single DAQ list. @category XCP */
export function XcpStartStopDaqList(
  handle: string,
  mode: number,
  daqListNumber: number
): Promise<StartStopDaqListResponse> {
  return xcpCommand(handle, 'startStopDaqList', [mode, daqListNumber])
}

/** START_STOP_SYNCH: start/stop all selected DAQ lists synchronously. @category XCP */
export function XcpStartStopSynch(handle: string, mode: number): Promise<number[]> {
  return xcpCommand(handle, 'startStopSynch', [mode])
}

/** GET_DAQ_CLOCK: get the current slave DAQ clock timestamp. @category XCP */
export function XcpGetDaqClock(handle: string): Promise<number> {
  return xcpCommand(handle, 'getDaqClock')
}

/** FREE_DAQ: free the dynamic DAQ list configuration. @category XCP */
export function XcpFreeDaq(handle: string): Promise<number[]> {
  return xcpCommand(handle, 'freeDaq')
}

/** ALLOC_DAQ: allocate a number of dynamic DAQ lists. @category XCP */
export function XcpAllocDaq(handle: string, daqCount: number): Promise<number[]> {
  return xcpCommand(handle, 'allocDaq', [daqCount])
}

/** ALLOC_ODT: allocate ODTs for a dynamic DAQ list. @category XCP */
export function XcpAllocOdt(
  handle: string,
  daqListNumber: number,
  odtCount: number
): Promise<number[]> {
  return xcpCommand(handle, 'allocOdt', [daqListNumber, odtCount])
}

/** ALLOC_ODT_ENTRY: allocate ODT entries for a dynamic ODT. @category XCP */
export function XcpAllocOdtEntry(
  handle: string,
  daqListNumber: number,
  odtNumber: number,
  odtEntriesCount: number
): Promise<number[]> {
  return xcpCommand(handle, 'allocOdtEntry', [daqListNumber, odtNumber, odtEntriesCount])
}

/** PROGRAM_START: begin a programming sequence. @category XCP */
export function XcpProgramStart(handle: string): Promise<number[]> {
  return xcpCommand(handle, 'programStart')
}

/** PROGRAM_CLEAR: erase a range of program memory. @category XCP */
export function XcpProgramClear(
  handle: string,
  mode: number,
  clearRange: number
): Promise<number[]> {
  return xcpCommand(handle, 'programClear', [mode, clearRange])
}

/** PROGRAM: program `data` to the current MTA. @category XCP */
export function XcpProgram(
  handle: string,
  numberOfElements: number,
  data: number[]
): Promise<number[]> {
  return xcpCommand(handle, 'program', [numberOfElements, data])
}

/** PROGRAM_RESET: reset the slave after a programming sequence. @category XCP */
export function XcpProgramReset(handle: string): Promise<number[]> {
  return xcpCommand(handle, 'programReset')
}
