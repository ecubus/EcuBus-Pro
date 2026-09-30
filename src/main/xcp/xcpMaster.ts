/**
 * XCP master (client) built on top of the {@link module:xcpProtocol | protocol codec}.
 *
 * {@link XcpMaster} is transport-agnostic: it talks to any {@link XcpTransport}
 * implementation (XCP-on-CAN, XCP-on-Ethernet, a mock, ...). It negotiates the
 * slave byte order during {@link XcpMaster.connect} and applies it to every
 * subsequent multi-byte parameter, mirroring the behaviour of the mature
 * {@link https://github.com/christoph2/pyxcp | pyXCP} master.
 *
 * @module xcpMaster
 * @category XCP
 */

import * as P from './xcpProtocol'
import { ByteOrder } from './xcpProtocol'

/**
 * Transport abstraction used by {@link XcpMaster}. An implementation only has to
 * move raw XCP packets (CTOs) to/from the slave; framing is its own concern.
 * @category XCP
 */
export interface XcpTransport {
  /**
   * Send a CTO request and resolve with the CTO response packet.
   * @param request - Raw XCP request packet (starting with the command PID).
   * @param timeout - Max time to wait for the response, in milliseconds.
   */
  request(request: Buffer, timeout?: number): Promise<Buffer>
  /**
   * Send a request without waiting for a response (block-transfer intermediate packets).
   */
  send(request: Buffer): Promise<void>
  /** Release any resources held by the transport. */
  close(): void
}

/**
 * Properties of the connected slave, populated by {@link XcpMaster.connect}.
 * @category XCP
 */
export interface SlaveProperties {
  byteOrder: ByteOrder
  addressGranularity: P.AddressGranularity
  maxCto: number
  maxDto: number
  protocolLayerVersion: number
  transportLayerVersion: number
  resource: P.ConnectResponse['resource']
  supportsSlaveBlockMode: boolean
}

/**
 * High-level XCP master. Each method builds a request with the codec, sends it
 * through the transport, validates the response, and returns a parsed result.
 * @category XCP
 */
export class XcpMaster {
  readonly transport: XcpTransport
  /** Default response timeout, in milliseconds. */
  timeout: number
  slaveProperties: SlaveProperties = {
    byteOrder: ByteOrder.INTEL,
    addressGranularity: P.AddressGranularity.BYTE,
    maxCto: 8,
    maxDto: 8,
    protocolLayerVersion: 0,
    transportLayerVersion: 0,
    resource: { calpag: false, daq: false, stim: false, pgm: false, dbg: false },
    supportsSlaveBlockMode: false
  }
  connected = false

  constructor(transport: XcpTransport, timeout = 1000) {
    this.transport = transport
    this.timeout = timeout
  }

  private get bo(): ByteOrder {
    return this.slaveProperties.byteOrder
  }

  private async request(packet: Buffer): Promise<Buffer> {
    return this.transport.request(packet, this.timeout)
  }

  /* ------------------------------ STD ------------------------------ */

  /** CONNECT to the slave and record its properties (byte order, MAX_CTO, ...). */
  async connect(mode = 0): Promise<P.ConnectResponse> {
    const resp = await this.request(P.buildConnect(mode))
    const parsed = P.parseConnectResponse(resp)
    this.slaveProperties = {
      byteOrder: parsed.commModeBasic.byteOrder,
      addressGranularity: parsed.commModeBasic.addressGranularity,
      maxCto: parsed.maxCto,
      maxDto: parsed.maxDto,
      protocolLayerVersion: parsed.protocolLayerVersion,
      transportLayerVersion: parsed.transportLayerVersion,
      resource: parsed.resource,
      supportsSlaveBlockMode: parsed.commModeBasic.slaveBlockMode
    }
    this.connected = true
    return parsed
  }

  /** DISCONNECT from the slave. */
  async disconnect(): Promise<Buffer> {
    const resp = await this.request(P.buildDisconnect())
    const payload = P.checkResponse(resp)
    this.connected = false
    return Buffer.from(payload)
  }

  /** GET_STATUS: current session and resource-protection status. */
  async getStatus(): Promise<P.GetStatusResponse> {
    const resp = await this.request(P.buildGetStatus())
    return P.parseGetStatusResponse(resp, this.bo)
  }

  /** SYNCH: bring the command processor back to a defined state. */
  async synch(): Promise<Buffer> {
    const resp = await this.request(P.buildSynch())
    // SYNCH is answered either with a positive response or the standard
    // ERR_CMD_SYNCH (0xFE 0x00); both indicate success.
    if (resp[0] === P.XcpResponse.ERR && resp[1] === P.XcpErrorCode.ERR_CMD_SYNCH) {
      return Buffer.from([P.XcpErrorCode.ERR_CMD_SYNCH])
    }
    return Buffer.from(P.checkResponse(resp))
  }

  /** GET_COMM_MODE_INFO: optional communication modes and timing. */
  async getCommModeInfo(): Promise<P.GetCommModeInfoResponse> {
    const resp = await this.request(P.buildGetCommModeInfo())
    return P.parseGetCommModeInfoResponse(resp)
  }

  /** GET_VERSION: protocol and transport layer versions. */
  async getVersion(): Promise<P.GetVersionResponse> {
    const resp = await this.request(P.buildGetVersion())
    return P.parseGetVersionResponse(resp)
  }

  /** GET_ID: request the identifier header (bytes are then read via UPLOAD). */
  async getId(mode: number): Promise<P.GetIdResponse> {
    const resp = await this.request(P.buildGetId(mode))
    return P.parseGetIdResponse(resp, this.bo)
  }

  /** SET_REQUEST: request a persistent slave action (e.g. store CAL/DAQ). */
  async setRequest(mode: number, sessionConfigurationId: number): Promise<Buffer> {
    const resp = await this.request(P.buildSetRequest(mode, sessionConfigurationId))
    return Buffer.from(P.checkResponse(resp))
  }

  /** GET_SEED: request a seed for the seed & key unlock procedure. */
  async getSeed(mode: number, resource: number): Promise<P.GetSeedResponse> {
    const resp = await this.request(P.buildGetSeed(mode, resource))
    return P.parseGetSeedResponse(resp)
  }

  /** UNLOCK: send the computed key to unlock a protected resource. */
  async unlock(length: number, key: number[] | Buffer): Promise<P.ResourceFlags> {
    const resp = await this.request(P.buildUnlock(length, key))
    return P.parseUnlockResponse(resp)
  }

  /** SET_MTA: set the Memory Transfer Address pointer. */
  async setMta(address: number, addressExtension = 0): Promise<Buffer> {
    const resp = await this.request(P.buildSetMta(address, addressExtension, this.bo))
    return Buffer.from(P.checkResponse(resp))
  }

  /** UPLOAD: read `count` elements starting at the current MTA. */
  async upload(count: number): Promise<Buffer> {
    const resp = await this.request(P.buildUpload(count))
    return Buffer.from(P.checkResponse(resp))
  }

  /** SHORT_UPLOAD: read `count` elements from an explicit address in one command. */
  async shortUpload(count: number, address: number, addressExtension = 0): Promise<Buffer> {
    const resp = await this.request(P.buildShortUpload(count, address, addressExtension, this.bo))
    return Buffer.from(P.checkResponse(resp))
  }

  /** BUILD_CHECKSUM: compute a checksum over a memory block from the current MTA. */
  async buildChecksum(blockSize: number): Promise<P.BuildChecksumResponse> {
    const resp = await this.request(P.buildBuildChecksum(blockSize, this.bo))
    return P.parseBuildChecksumResponse(resp, this.bo)
  }

  /** USER_CMD: transmit a user-defined command. */
  async userCmd(subCommand: number, data: number[] | Buffer): Promise<Buffer> {
    const resp = await this.request(P.buildUserCmd(subCommand, data))
    return Buffer.from(P.checkResponse(resp))
  }

  /** TRANSPORT_LAYER_CMD: transmit a transport-layer specific command. */
  async transportLayerCmd(subCommand: number, data: number[] | Buffer): Promise<Buffer> {
    const resp = await this.request(P.buildTransportLayerCmd(subCommand, data))
    return Buffer.from(P.checkResponse(resp))
  }

  /* --------------------------- CAL / PAG --------------------------- */

  /** DOWNLOAD: write `data` to the current MTA. */
  async download(data: number[] | Buffer): Promise<Buffer> {
    const resp = await this.request(P.buildDownload(data))
    return Buffer.from(P.checkResponse(resp))
  }

  /** DOWNLOAD_NEXT: write the next block of a block-mode download. */
  async downloadNext(remainingBlockLength: number, data: number[] | Buffer): Promise<Buffer> {
    const resp = await this.request(P.buildDownloadNext(remainingBlockLength, data))
    return Buffer.from(P.checkResponse(resp))
  }

  /** DOWNLOAD_MAX: write a fixed MAX_CTO-sized block to the current MTA. */
  async downloadMax(data: number[] | Buffer): Promise<Buffer> {
    const resp = await this.request(P.buildDownloadMax(data))
    return Buffer.from(P.checkResponse(resp))
  }

  /** SHORT_DOWNLOAD: write `data` to an explicit address in one command. */
  async shortDownload(
    address: number,
    addressExtension: number,
    data: number[] | Buffer
  ): Promise<Buffer> {
    const resp = await this.request(P.buildShortDownload(address, addressExtension, data, this.bo))
    return Buffer.from(P.checkResponse(resp))
  }

  /** MODIFY_BITS: atomic read-modify-write of a 16-bit word at the current MTA. */
  async modifyBits(shiftValue: number, andMask: number, xorMask: number): Promise<Buffer> {
    const resp = await this.request(P.buildModifyBits(shiftValue, andMask, xorMask, this.bo))
    return Buffer.from(P.checkResponse(resp))
  }

  /** SET_CAL_PAGE: activate a calibration page for the given segment(s). */
  async setCalPage(mode: number, segment: number, page: number): Promise<Buffer> {
    const resp = await this.request(P.buildSetCalPage(mode, segment, page))
    return Buffer.from(P.checkResponse(resp))
  }

  /** GET_CAL_PAGE: get the active calibration page of a segment. */
  async getCalPage(mode: number, segment: number): Promise<number> {
    const resp = await this.request(P.buildGetCalPage(mode, segment))
    return P.parseGetCalPageResponse(resp)
  }

  /** COPY_CAL_PAGE: copy one calibration page to another. */
  async copyCalPage(
    srcSegment: number,
    srcPage: number,
    dstSegment: number,
    dstPage: number
  ): Promise<Buffer> {
    const resp = await this.request(P.buildCopyCalPage(srcSegment, srcPage, dstSegment, dstPage))
    return Buffer.from(P.checkResponse(resp))
  }

  /* ------------------------------ DAQ ------------------------------ */

  /** SET_DAQ_PTR: select the DAQ list / ODT / ODT-entry for subsequent WRITE_DAQ. */
  async setDaqPtr(
    daqListNumber: number,
    odtNumber: number,
    odtEntryNumber: number
  ): Promise<Buffer> {
    const resp = await this.request(
      P.buildSetDaqPtr(daqListNumber, odtNumber, odtEntryNumber, this.bo)
    )
    return Buffer.from(P.checkResponse(resp))
  }

  /** WRITE_DAQ: configure the currently selected ODT entry. */
  async writeDaq(
    bitOffset: number,
    size: number,
    addressExtension: number,
    address: number
  ): Promise<Buffer> {
    const resp = await this.request(
      P.buildWriteDaq(bitOffset, size, addressExtension, address, this.bo)
    )
    return Buffer.from(P.checkResponse(resp))
  }

  /** SET_DAQ_LIST_MODE: set the mode of a DAQ list (event channel, prescaler, ...). */
  async setDaqListMode(
    mode: number,
    daqListNumber: number,
    eventChannelNumber: number,
    prescaler: number,
    priority: number
  ): Promise<Buffer> {
    const resp = await this.request(
      P.buildSetDaqListMode(mode, daqListNumber, eventChannelNumber, prescaler, priority, this.bo)
    )
    return Buffer.from(P.checkResponse(resp))
  }

  /** START_STOP_DAQ_LIST: start/stop/select a single DAQ list. */
  async startStopDaqList(mode: number, daqListNumber: number): Promise<P.StartStopDaqListResponse> {
    const resp = await this.request(P.buildStartStopDaqList(mode, daqListNumber, this.bo))
    return P.parseStartStopDaqListResponse(resp)
  }

  /** START_STOP_SYNCH: start/stop all selected DAQ lists synchronously. */
  async startStopSynch(mode: number): Promise<Buffer> {
    const resp = await this.request(P.buildStartStopSynch(mode))
    return Buffer.from(P.checkResponse(resp))
  }

  /** GET_DAQ_CLOCK: get the current slave DAQ clock timestamp. */
  async getDaqClock(): Promise<number> {
    const resp = await this.request(P.buildGetDaqClock())
    return P.parseGetDaqClockResponse(resp, this.bo)
  }

  /** FREE_DAQ: free the dynamic DAQ list configuration. */
  async freeDaq(): Promise<Buffer> {
    const resp = await this.request(P.buildFreeDaq())
    return Buffer.from(P.checkResponse(resp))
  }

  /** ALLOC_DAQ: allocate a number of dynamic DAQ lists. */
  async allocDaq(daqCount: number): Promise<Buffer> {
    const resp = await this.request(P.buildAllocDaq(daqCount, this.bo))
    return Buffer.from(P.checkResponse(resp))
  }

  /** ALLOC_ODT: allocate ODTs for a dynamic DAQ list. */
  async allocOdt(daqListNumber: number, odtCount: number): Promise<Buffer> {
    const resp = await this.request(P.buildAllocOdt(daqListNumber, odtCount, this.bo))
    return Buffer.from(P.checkResponse(resp))
  }

  /** ALLOC_ODT_ENTRY: allocate ODT entries for a dynamic ODT. */
  async allocOdtEntry(
    daqListNumber: number,
    odtNumber: number,
    odtEntriesCount: number
  ): Promise<Buffer> {
    const resp = await this.request(
      P.buildAllocOdtEntry(daqListNumber, odtNumber, odtEntriesCount, this.bo)
    )
    return Buffer.from(P.checkResponse(resp))
  }

  /** CLEAR_DAQ_LIST: clear a DAQ list. */
  async clearDaqList(daqListNumber: number): Promise<Buffer> {
    const resp = await this.request(P.buildClearDaqList(daqListNumber, this.bo))
    return Buffer.from(P.checkResponse(resp))
  }

  /* ------------------------------ PGM ------------------------------ */

  /** PROGRAM_START: indicate the beginning of a programming sequence. */
  async programStart(): Promise<Buffer> {
    const resp = await this.request(P.buildProgramStart())
    return Buffer.from(P.checkResponse(resp))
  }

  /** PROGRAM_CLEAR: erase a range of program memory. */
  async programClear(mode: number, clearRange: number): Promise<Buffer> {
    const resp = await this.request(P.buildProgramClear(mode, clearRange, this.bo))
    return Buffer.from(P.checkResponse(resp))
  }

  /** PROGRAM: program `data` to the current MTA. */
  async program(numberOfElements: number, data: number[] | Buffer): Promise<Buffer> {
    const resp = await this.request(P.buildProgram(numberOfElements, data))
    return Buffer.from(P.checkResponse(resp))
  }

  /** PROGRAM_RESET: reset the slave after a programming sequence. */
  async programReset(): Promise<Buffer> {
    const resp = await this.request(P.buildProgramReset())
    return Buffer.from(P.checkResponse(resp))
  }

  /** PROGRAM_NEXT: program the next block of a block-mode programming sequence. */
  async programNext(remainingBlockLength: number, data: number[] | Buffer): Promise<Buffer> {
    const resp = await this.request(P.buildProgramNext(remainingBlockLength, data))
    return Buffer.from(P.checkResponse(resp))
  }

  /** PROGRAM_MAX: program a fixed MAX_CTO-sized block. */
  async programMax(data: number[] | Buffer): Promise<Buffer> {
    const resp = await this.request(P.buildProgramMax(data))
    return Buffer.from(P.checkResponse(resp))
  }

  /** PROGRAM_VERIFY: verify the programmed memory. */
  async programVerify(
    mode: number,
    verificationType: number,
    verificationValue: number
  ): Promise<Buffer> {
    const resp = await this.request(
      P.buildProgramVerify(mode, verificationType, verificationValue, this.bo)
    )
    return Buffer.from(P.checkResponse(resp))
  }

  /** Close the underlying transport. */
  close(): void {
    this.transport.close()
  }
}
