/**
 * XCP protocol codec (ASAM MCD-1 XCP).
 *
 * Pure, transport-agnostic helpers that build XCP master request packets (CTOs)
 * and parse slave response packets. The command/response byte layout follows the
 * ASAM XCP specification and is validated against the test vectors of the mature
 * open-source master {@link https://github.com/christoph2/pyxcp | pyXCP}.
 *
 * A "packet" here is the raw XCP PDU (starting with the command / response PID);
 * transport-specific framing (CAN id, Ethernet length/counter header, ...) is added
 * by the transport layer, not here.
 *
 * @module xcpProtocol
 * @category XCP
 */

/**
 * XCP master-to-slave command codes (the first byte / PID of a CTO request).
 * @category XCP
 */
export enum XcpCommand {
  CONNECT = 0xff,
  DISCONNECT = 0xfe,
  GET_STATUS = 0xfd,
  SYNCH = 0xfc,
  GET_COMM_MODE_INFO = 0xfb,
  GET_ID = 0xfa,
  SET_REQUEST = 0xf9,
  GET_SEED = 0xf8,
  UNLOCK = 0xf7,
  SET_MTA = 0xf6,
  UPLOAD = 0xf5,
  SHORT_UPLOAD = 0xf4,
  BUILD_CHECKSUM = 0xf3,
  TRANSPORT_LAYER_CMD = 0xf2,
  USER_CMD = 0xf1,
  // Calibration / paging
  DOWNLOAD = 0xf0,
  DOWNLOAD_NEXT = 0xef,
  DOWNLOAD_MAX = 0xee,
  SHORT_DOWNLOAD = 0xed,
  MODIFY_BITS = 0xec,
  SET_CAL_PAGE = 0xeb,
  GET_CAL_PAGE = 0xea,
  GET_PAG_PROCESSOR_INFO = 0xe9,
  GET_SEGMENT_INFO = 0xe8,
  GET_PAGE_INFO = 0xe7,
  SET_SEGMENT_MODE = 0xe6,
  GET_SEGMENT_MODE = 0xe5,
  COPY_CAL_PAGE = 0xe4,
  // DAQ
  CLEAR_DAQ_LIST = 0xe3,
  SET_DAQ_PTR = 0xe2,
  WRITE_DAQ = 0xe1,
  SET_DAQ_LIST_MODE = 0xe0,
  GET_DAQ_LIST_MODE = 0xdf,
  START_STOP_DAQ_LIST = 0xde,
  START_STOP_SYNCH = 0xdd,
  GET_DAQ_CLOCK = 0xdc,
  READ_DAQ = 0xdb,
  GET_DAQ_PROCESSOR_INFO = 0xda,
  GET_DAQ_RESOLUTION_INFO = 0xd9,
  GET_DAQ_LIST_INFO = 0xd8,
  GET_DAQ_EVENT_INFO = 0xd7,
  FREE_DAQ = 0xd6,
  ALLOC_DAQ = 0xd5,
  ALLOC_ODT = 0xd4,
  ALLOC_ODT_ENTRY = 0xd3,
  // PGM
  PROGRAM_START = 0xd2,
  PROGRAM_CLEAR = 0xd1,
  PROGRAM = 0xd0,
  PROGRAM_RESET = 0xcf,
  GET_PGM_PROCESSOR_INFO = 0xce,
  GET_SECTOR_INFO = 0xcd,
  PROGRAM_PREPARE = 0xcc,
  PROGRAM_FORMAT = 0xcb,
  PROGRAM_NEXT = 0xca,
  PROGRAM_MAX = 0xc9,
  PROGRAM_VERIFY = 0xc8,
  WRITE_DAQ_MULTIPLE = 0xc7,
  // 0xC0 introduces the second command level (sub-command in the next byte)
  GET_VERSION = 0xc0
}

/** GET_VERSION second-level sub-command (0xC0 0x00). @category XCP */
export const GET_VERSION_SUB = 0x00

/**
 * Response / packet identifier codes (first byte of a slave DTO/CTO).
 * @category XCP
 */
export enum XcpResponse {
  /** Positive response. */
  RES = 0xff,
  /** Error response, second byte is an {@link XcpErrorCode}. */
  ERR = 0xfe,
  /** Event packet. */
  EV = 0xfd,
  /** Service request packet. */
  SERV = 0xfc
}

/**
 * Byte order of multi-byte parameters, negotiated in the CONNECT response.
 * @category XCP
 */
export enum ByteOrder {
  INTEL = 0,
  MOTOROLA = 1
}

/**
 * Address granularity of the slave (smallest addressable element), from CONNECT.
 * @category XCP
 */
export enum AddressGranularity {
  BYTE = 0,
  WORD = 1,
  DWORD = 2
}

/**
 * Checksum algorithm returned by BUILD_CHECKSUM.
 * @category XCP
 */
export enum ChecksumType {
  XCP_ADD_11 = 0x01,
  XCP_ADD_12 = 0x02,
  XCP_ADD_14 = 0x03,
  XCP_ADD_22 = 0x04,
  XCP_ADD_24 = 0x05,
  XCP_ADD_44 = 0x06,
  XCP_CRC_16 = 0x07,
  XCP_CRC_16_CITT = 0x08,
  XCP_CRC_32 = 0x09,
  XCP_USER_DEFINED = 0xff
}

/**
 * XCP standard error codes (ERR response second byte).
 * @category XCP
 */
export enum XcpErrorCode {
  ERR_CMD_SYNCH = 0x00,
  ERR_CMD_BUSY = 0x10,
  ERR_DAQ_ACTIVE = 0x11,
  ERR_PGM_ACTIVE = 0x12,
  ERR_CMD_UNKNOWN = 0x20,
  ERR_CMD_SYNTAX = 0x21,
  ERR_OUT_OF_RANGE = 0x22,
  ERR_WRITE_PROTECTED = 0x23,
  ERR_ACCESS_DENIED = 0x24,
  ERR_ACCESS_LOCKED = 0x25,
  ERR_PAGE_NOT_VALID = 0x26,
  ERR_MODE_NOT_VALID = 0x27,
  ERR_SEGMENT_NOT_VALID = 0x28,
  ERR_SEQUENCE = 0x29,
  ERR_DAQ_CONFIG = 0x2a,
  ERR_MEMORY_OVERFLOW = 0x30,
  ERR_GENERIC = 0x31,
  ERR_VERIFY = 0x32,
  ERR_RESOURCE_TEMPORARY_NOT_ACCESSIBLE = 0x33
}

const errorMessages: Record<number, string> = {
  [XcpErrorCode.ERR_CMD_SYNCH]: 'command processor synchronization',
  [XcpErrorCode.ERR_CMD_BUSY]: 'command was not executed',
  [XcpErrorCode.ERR_DAQ_ACTIVE]: 'command rejected because DAQ is running',
  [XcpErrorCode.ERR_PGM_ACTIVE]: 'command rejected because PGM is running',
  [XcpErrorCode.ERR_CMD_UNKNOWN]: 'unknown command or not implemented',
  [XcpErrorCode.ERR_CMD_SYNTAX]: 'command syntax invalid',
  [XcpErrorCode.ERR_OUT_OF_RANGE]: 'command syntax valid but parameter out of range',
  [XcpErrorCode.ERR_WRITE_PROTECTED]: 'memory location is write protected',
  [XcpErrorCode.ERR_ACCESS_DENIED]: 'memory access denied',
  [XcpErrorCode.ERR_ACCESS_LOCKED]: 'selected resource is protected/locked',
  [XcpErrorCode.ERR_PAGE_NOT_VALID]: 'selected page not available',
  [XcpErrorCode.ERR_MODE_NOT_VALID]: 'selected page mode not available',
  [XcpErrorCode.ERR_SEGMENT_NOT_VALID]: 'selected segment not valid',
  [XcpErrorCode.ERR_SEQUENCE]: 'sequence error',
  [XcpErrorCode.ERR_DAQ_CONFIG]: 'DAQ configuration not valid',
  [XcpErrorCode.ERR_MEMORY_OVERFLOW]: 'memory overflow error',
  [XcpErrorCode.ERR_GENERIC]: 'generic error',
  [XcpErrorCode.ERR_VERIFY]: 'the slave internal program verify routine detects an error',
  [XcpErrorCode.ERR_RESOURCE_TEMPORARY_NOT_ACCESSIBLE]: 'resource temporarily not accessible'
}

/**
 * Error thrown when the slave answers a command with an ERR (0xFE) response.
 * @category XCP
 */
export class XcpError extends Error {
  /** Standard XCP error code (second byte of the ERR response). */
  code: number
  /** Full raw response packet. */
  response: Buffer
  constructor(code: number, response: Buffer) {
    super(`XCP error 0x${code.toString(16).padStart(2, '0')}: ${errorMessages[code] ?? 'unknown'}`)
    this.name = 'XcpError'
    this.code = code
    this.response = response
  }
}

/**
 * Pack an unsigned integer into `size` bytes using the given byte order.
 * @category XCP
 */
export function packUint(value: number, size: number, byteOrder: ByteOrder): Buffer {
  const buf = Buffer.alloc(size)
  if (byteOrder === ByteOrder.MOTOROLA) {
    buf.writeUIntBE(value, 0, size)
  } else {
    buf.writeUIntLE(value, 0, size)
  }
  return buf
}

/**
 * Unpack an unsigned integer from a buffer slice using the given byte order.
 * @category XCP
 */
export function unpackUint(
  buf: Buffer,
  offset: number,
  size: number,
  byteOrder: ByteOrder
): number {
  return byteOrder === ByteOrder.MOTOROLA
    ? buf.readUIntBE(offset, size)
    : buf.readUIntLE(offset, size)
}

function cmd(code: number, ...rest: number[]): Buffer {
  return Buffer.from([code & 0xff, ...rest.map((b) => b & 0xff)])
}

function concat(...parts: (Buffer | number[] | number)[]): Buffer {
  const bufs = parts.map((p) =>
    Buffer.isBuffer(p) ? p : Array.isArray(p) ? Buffer.from(p) : Buffer.from([p & 0xff])
  )
  return Buffer.concat(bufs)
}

/* -------------------------------------------------------------------------- */
/*  Standard (STD) commands                                                    */
/* -------------------------------------------------------------------------- */

/** Build a CONNECT request. `mode` 0 = normal, 1 = user-defined. @category XCP */
export function buildConnect(mode = 0): Buffer {
  return cmd(XcpCommand.CONNECT, mode)
}

/** Build a DISCONNECT request. @category XCP */
export function buildDisconnect(): Buffer {
  return cmd(XcpCommand.DISCONNECT)
}

/** Build a GET_STATUS request. @category XCP */
export function buildGetStatus(): Buffer {
  return cmd(XcpCommand.GET_STATUS)
}

/** Build a SYNCH request. @category XCP */
export function buildSynch(): Buffer {
  return cmd(XcpCommand.SYNCH)
}

/** Build a GET_COMM_MODE_INFO request. @category XCP */
export function buildGetCommModeInfo(): Buffer {
  return cmd(XcpCommand.GET_COMM_MODE_INFO)
}

/** Build a GET_ID request. @category XCP */
export function buildGetId(mode: number): Buffer {
  return cmd(XcpCommand.GET_ID, mode)
}

/**
 * Build a SET_REQUEST request. The session configuration id is transmitted MSB
 * first (Motorola) as mandated by the standard, independent of the slave byte order.
 * @category XCP
 */
export function buildSetRequest(mode: number, sessionConfigurationId: number): Buffer {
  return concat(
    XcpCommand.SET_REQUEST,
    mode,
    packUint(sessionConfigurationId, 2, ByteOrder.MOTOROLA)
  )
}

/** Build a GET_SEED request. @category XCP */
export function buildGetSeed(mode: number, resource: number): Buffer {
  return cmd(XcpCommand.GET_SEED, mode, resource)
}

/** Build an UNLOCK request. @category XCP */
export function buildUnlock(length: number, key: number[] | Buffer): Buffer {
  return concat(XcpCommand.UNLOCK, length, Buffer.from(key as number[]))
}

/** Build a SET_MTA request. @category XCP */
export function buildSetMta(
  address: number,
  addressExtension = 0,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(XcpCommand.SET_MTA, 0, 0, addressExtension, packUint(address, 4, byteOrder))
}

/** Build an UPLOAD request. @category XCP */
export function buildUpload(count: number): Buffer {
  return cmd(XcpCommand.UPLOAD, count)
}

/** Build a SHORT_UPLOAD request. @category XCP */
export function buildShortUpload(
  count: number,
  address: number,
  addressExtension = 0,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(
    XcpCommand.SHORT_UPLOAD,
    count,
    0,
    addressExtension,
    packUint(address, 4, byteOrder)
  )
}

/** Build a BUILD_CHECKSUM request. @category XCP */
export function buildBuildChecksum(blockSize: number, byteOrder = ByteOrder.INTEL): Buffer {
  return concat(XcpCommand.BUILD_CHECKSUM, 0, 0, 0, packUint(blockSize, 4, byteOrder))
}

/** Build a TRANSPORT_LAYER_CMD request. @category XCP */
export function buildTransportLayerCmd(subCommand: number, data: number[] | Buffer): Buffer {
  return concat(XcpCommand.TRANSPORT_LAYER_CMD, subCommand, Buffer.from(data as number[]))
}

/** Build a USER_CMD request. @category XCP */
export function buildUserCmd(subCommand: number, data: number[] | Buffer): Buffer {
  return concat(XcpCommand.USER_CMD, subCommand, Buffer.from(data as number[]))
}

/** Build a GET_VERSION request (second command level 0xC0 0x00). @category XCP */
export function buildGetVersion(): Buffer {
  return cmd(XcpCommand.GET_VERSION, GET_VERSION_SUB)
}

/* -------------------------------------------------------------------------- */
/*  Calibration / paging (CAL_PAG) commands                                    */
/* -------------------------------------------------------------------------- */

/** Build a DOWNLOAD request. @category XCP */
export function buildDownload(data: number[] | Buffer): Buffer {
  const d = Buffer.from(data as number[])
  return concat(XcpCommand.DOWNLOAD, d.length, d)
}

/**
 * Build a DOWNLOAD request in block mode, where `numberOfElements` describes the
 * total remaining block size rather than the payload length of this packet.
 * @category XCP
 */
export function buildDownloadBlock(numberOfElements: number, data: number[] | Buffer): Buffer {
  return concat(XcpCommand.DOWNLOAD, numberOfElements, Buffer.from(data as number[]))
}

/** Build a DOWNLOAD_NEXT request (block mode). @category XCP */
export function buildDownloadNext(remainingBlockLength: number, data: number[] | Buffer): Buffer {
  return concat(XcpCommand.DOWNLOAD_NEXT, remainingBlockLength, Buffer.from(data as number[]))
}

/** Build a DOWNLOAD_MAX request. @category XCP */
export function buildDownloadMax(data: number[] | Buffer): Buffer {
  return concat(XcpCommand.DOWNLOAD_MAX, Buffer.from(data as number[]))
}

/** Build a SHORT_DOWNLOAD request. @category XCP */
export function buildShortDownload(
  address: number,
  addressExtension: number,
  data: number[] | Buffer,
  byteOrder = ByteOrder.INTEL
): Buffer {
  const d = Buffer.from(data as number[])
  return concat(
    XcpCommand.SHORT_DOWNLOAD,
    d.length,
    0,
    addressExtension,
    packUint(address, 4, byteOrder),
    d
  )
}

/** Build a MODIFY_BITS request. @category XCP */
export function buildModifyBits(
  shiftValue: number,
  andMask: number,
  xorMask: number,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(
    XcpCommand.MODIFY_BITS,
    shiftValue,
    packUint(andMask, 2, byteOrder),
    packUint(xorMask, 2, byteOrder)
  )
}

/** Build a SET_CAL_PAGE request. @category XCP */
export function buildSetCalPage(mode: number, segment: number, page: number): Buffer {
  return cmd(XcpCommand.SET_CAL_PAGE, mode, segment, page)
}

/** Build a GET_CAL_PAGE request. @category XCP */
export function buildGetCalPage(mode: number, segment: number): Buffer {
  return cmd(XcpCommand.GET_CAL_PAGE, mode, segment)
}

/** Build a GET_PAG_PROCESSOR_INFO request. @category XCP */
export function buildGetPagProcessorInfo(): Buffer {
  return cmd(XcpCommand.GET_PAG_PROCESSOR_INFO)
}

/** Build a GET_SEGMENT_INFO request. @category XCP */
export function buildGetSegmentInfo(
  mode: number,
  segmentNumber: number,
  segmentInfo: number,
  mappingIndex: number
): Buffer {
  return cmd(XcpCommand.GET_SEGMENT_INFO, mode, segmentNumber, segmentInfo, mappingIndex)
}

/** Build a GET_PAGE_INFO request. @category XCP */
export function buildGetPageInfo(segmentNumber: number, pageNumber: number): Buffer {
  return cmd(XcpCommand.GET_PAGE_INFO, 0, segmentNumber, pageNumber)
}

/** Build a SET_SEGMENT_MODE request. @category XCP */
export function buildSetSegmentMode(mode: number, segmentNumber: number): Buffer {
  return cmd(XcpCommand.SET_SEGMENT_MODE, mode, segmentNumber)
}

/** Build a GET_SEGMENT_MODE request. @category XCP */
export function buildGetSegmentMode(segmentNumber: number): Buffer {
  return cmd(XcpCommand.GET_SEGMENT_MODE, 0, segmentNumber)
}

/** Build a COPY_CAL_PAGE request. @category XCP */
export function buildCopyCalPage(
  srcSegment: number,
  srcPage: number,
  dstSegment: number,
  dstPage: number
): Buffer {
  return cmd(XcpCommand.COPY_CAL_PAGE, srcSegment, srcPage, dstSegment, dstPage)
}

/* -------------------------------------------------------------------------- */
/*  Data acquisition (DAQ) commands                                            */
/* -------------------------------------------------------------------------- */

/** Build a SET_DAQ_PTR request. @category XCP */
export function buildSetDaqPtr(
  daqListNumber: number,
  odtNumber: number,
  odtEntryNumber: number,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(
    XcpCommand.SET_DAQ_PTR,
    0,
    packUint(daqListNumber, 2, byteOrder),
    odtNumber,
    odtEntryNumber
  )
}

/** Build a WRITE_DAQ request. @category XCP */
export function buildWriteDaq(
  bitOffset: number,
  size: number,
  addressExtension: number,
  address: number,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(
    XcpCommand.WRITE_DAQ,
    bitOffset,
    size,
    addressExtension,
    packUint(address, 4, byteOrder)
  )
}

/** Build a SET_DAQ_LIST_MODE request. @category XCP */
export function buildSetDaqListMode(
  mode: number,
  daqListNumber: number,
  eventChannelNumber: number,
  prescaler: number,
  priority: number,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(
    XcpCommand.SET_DAQ_LIST_MODE,
    mode,
    packUint(daqListNumber, 2, byteOrder),
    packUint(eventChannelNumber, 2, byteOrder),
    prescaler,
    priority
  )
}

/** Build a GET_DAQ_LIST_MODE request. @category XCP */
export function buildGetDaqListMode(daqListNumber: number, byteOrder = ByteOrder.INTEL): Buffer {
  return concat(XcpCommand.GET_DAQ_LIST_MODE, 0, packUint(daqListNumber, 2, byteOrder))
}

/** Build a START_STOP_DAQ_LIST request. @category XCP */
export function buildStartStopDaqList(
  mode: number,
  daqListNumber: number,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(XcpCommand.START_STOP_DAQ_LIST, mode, packUint(daqListNumber, 2, byteOrder))
}

/** Build a START_STOP_SYNCH request. @category XCP */
export function buildStartStopSynch(mode: number): Buffer {
  return cmd(XcpCommand.START_STOP_SYNCH, mode)
}

/** Build a GET_DAQ_CLOCK request. @category XCP */
export function buildGetDaqClock(): Buffer {
  return cmd(XcpCommand.GET_DAQ_CLOCK)
}

/** Build a READ_DAQ request. @category XCP */
export function buildReadDaq(): Buffer {
  return cmd(XcpCommand.READ_DAQ)
}

/** Build a GET_DAQ_PROCESSOR_INFO request. @category XCP */
export function buildGetDaqProcessorInfo(): Buffer {
  return cmd(XcpCommand.GET_DAQ_PROCESSOR_INFO)
}

/** Build a GET_DAQ_RESOLUTION_INFO request. @category XCP */
export function buildGetDaqResolutionInfo(): Buffer {
  return cmd(XcpCommand.GET_DAQ_RESOLUTION_INFO)
}

/** Build a GET_DAQ_LIST_INFO request. @category XCP */
export function buildGetDaqListInfo(daqListNumber: number, byteOrder = ByteOrder.INTEL): Buffer {
  return concat(XcpCommand.GET_DAQ_LIST_INFO, 0, packUint(daqListNumber, 2, byteOrder))
}

/** Build a GET_DAQ_EVENT_INFO request. @category XCP */
export function buildGetDaqEventInfo(
  eventChannelNumber: number,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(XcpCommand.GET_DAQ_EVENT_INFO, 0, packUint(eventChannelNumber, 2, byteOrder))
}

/** Build a CLEAR_DAQ_LIST request. @category XCP */
export function buildClearDaqList(daqListNumber: number, byteOrder = ByteOrder.INTEL): Buffer {
  return concat(XcpCommand.CLEAR_DAQ_LIST, 0, packUint(daqListNumber, 2, byteOrder))
}

/** Build a FREE_DAQ request. @category XCP */
export function buildFreeDaq(): Buffer {
  return cmd(XcpCommand.FREE_DAQ)
}

/** Build an ALLOC_DAQ request. @category XCP */
export function buildAllocDaq(daqCount: number, byteOrder = ByteOrder.INTEL): Buffer {
  return concat(XcpCommand.ALLOC_DAQ, 0, packUint(daqCount, 2, byteOrder))
}

/** Build an ALLOC_ODT request. @category XCP */
export function buildAllocOdt(
  daqListNumber: number,
  odtCount: number,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(XcpCommand.ALLOC_ODT, 0, packUint(daqListNumber, 2, byteOrder), odtCount)
}

/** Build an ALLOC_ODT_ENTRY request. @category XCP */
export function buildAllocOdtEntry(
  daqListNumber: number,
  odtNumber: number,
  odtEntriesCount: number,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(
    XcpCommand.ALLOC_ODT_ENTRY,
    0,
    packUint(daqListNumber, 2, byteOrder),
    odtNumber,
    odtEntriesCount
  )
}

/**
 * A single element for {@link buildWriteDaqMultiple}.
 * @category XCP
 */
export interface DaqElement {
  bitOffset: number
  size: number
  address: number
  addressExt: number
}

/** Build a WRITE_DAQ_MULTIPLE request. @category XCP */
export function buildWriteDaqMultiple(elements: DaqElement[], byteOrder = ByteOrder.INTEL): Buffer {
  const parts: Buffer[] = [Buffer.from([XcpCommand.WRITE_DAQ_MULTIPLE, elements.length & 0xff])]
  for (const e of elements) {
    parts.push(concat(e.bitOffset, e.size, packUint(e.address, 4, byteOrder), e.addressExt, 0))
  }
  return Buffer.concat(parts)
}

/* -------------------------------------------------------------------------- */
/*  Programming (PGM) commands                                                 */
/* -------------------------------------------------------------------------- */

/** Build a PROGRAM_START request. @category XCP */
export function buildProgramStart(): Buffer {
  return cmd(XcpCommand.PROGRAM_START)
}

/** Build a PROGRAM_CLEAR request. @category XCP */
export function buildProgramClear(
  mode: number,
  clearRange: number,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(XcpCommand.PROGRAM_CLEAR, mode, 0, 0, packUint(clearRange, 4, byteOrder))
}

/** Build a PROGRAM request. @category XCP */
export function buildProgram(numberOfElements: number, data: number[] | Buffer): Buffer {
  return concat(XcpCommand.PROGRAM, numberOfElements, Buffer.from(data as number[]))
}

/** Build a PROGRAM_RESET request. @category XCP */
export function buildProgramReset(): Buffer {
  return cmd(XcpCommand.PROGRAM_RESET)
}

/** Build a GET_PGM_PROCESSOR_INFO request. @category XCP */
export function buildGetPgmProcessorInfo(): Buffer {
  return cmd(XcpCommand.GET_PGM_PROCESSOR_INFO)
}

/** Build a GET_SECTOR_INFO request. @category XCP */
export function buildGetSectorInfo(mode: number, sectorNumber: number): Buffer {
  return cmd(XcpCommand.GET_SECTOR_INFO, mode, sectorNumber)
}

/** Build a PROGRAM_PREPARE request. @category XCP */
export function buildProgramPrepare(codeSize: number, byteOrder = ByteOrder.INTEL): Buffer {
  return concat(XcpCommand.PROGRAM_PREPARE, 0, packUint(codeSize, 2, byteOrder))
}

/** Build a PROGRAM_FORMAT request. @category XCP */
export function buildProgramFormat(
  compressionMethod: number,
  encryptionMethod: number,
  programmingMethod: number,
  accessMethod: number
): Buffer {
  return cmd(
    XcpCommand.PROGRAM_FORMAT,
    compressionMethod,
    encryptionMethod,
    programmingMethod,
    accessMethod
  )
}

/** Build a PROGRAM_NEXT request. @category XCP */
export function buildProgramNext(remainingBlockLength: number, data: number[] | Buffer): Buffer {
  return concat(XcpCommand.PROGRAM_NEXT, remainingBlockLength, Buffer.from(data as number[]))
}

/** Build a PROGRAM_MAX request. @category XCP */
export function buildProgramMax(data: number[] | Buffer): Buffer {
  return concat(XcpCommand.PROGRAM_MAX, Buffer.from(data as number[]))
}

/** Build a PROGRAM_VERIFY request. @category XCP */
export function buildProgramVerify(
  mode: number,
  verificationType: number,
  verificationValue: number,
  byteOrder = ByteOrder.INTEL
): Buffer {
  return concat(
    XcpCommand.PROGRAM_VERIFY,
    mode,
    packUint(verificationType, 2, byteOrder),
    packUint(verificationValue, 4, byteOrder)
  )
}

/* -------------------------------------------------------------------------- */
/*  Response parsing                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Validate a response packet: throw {@link XcpError} on an ERR (0xFE) packet,
 * otherwise return the payload (bytes after the response PID).
 * @category XCP
 */
export function checkResponse(response: Buffer): Buffer {
  if (response.length === 0) {
    throw new Error('empty XCP response')
  }
  if (response[0] === XcpResponse.ERR) {
    throw new XcpError(response[1] ?? 0, response)
  }
  return response.subarray(1)
}

/** Parsed CONNECT response. @category XCP */
export interface ConnectResponse {
  resource: { calpag: boolean; daq: boolean; stim: boolean; pgm: boolean; dbg: boolean }
  commModeBasic: {
    optional: boolean
    slaveBlockMode: boolean
    addressGranularity: AddressGranularity
    byteOrder: ByteOrder
  }
  maxCto: number
  maxDto: number
  protocolLayerVersion: number
  transportLayerVersion: number
}

/** Parse a CONNECT response packet. @category XCP */
export function parseConnectResponse(response: Buffer): ConnectResponse {
  const payload = checkResponse(response)
  const resourceByte = payload[0]
  const commModeBasic = payload[1]
  const byteOrder: ByteOrder = commModeBasic & 0x01 ? ByteOrder.MOTOROLA : ByteOrder.INTEL
  const addressGranularity: AddressGranularity = (commModeBasic >> 1) & 0x03
  return {
    resource: {
      calpag: !!(resourceByte & 0x01),
      daq: !!(resourceByte & 0x04),
      stim: !!(resourceByte & 0x08),
      pgm: !!(resourceByte & 0x10),
      dbg: !!(resourceByte & 0x20)
    },
    commModeBasic: {
      optional: !!(commModeBasic & 0x80),
      slaveBlockMode: !!(commModeBasic & 0x40),
      addressGranularity,
      byteOrder
    },
    maxCto: payload[2],
    maxDto: unpackUint(payload, 3, 2, byteOrder),
    protocolLayerVersion: payload[5],
    transportLayerVersion: payload[6]
  }
}

/** Resource protection / resource availability bit field. @category XCP */
export interface ResourceFlags {
  calpag: boolean
  daq: boolean
  stim: boolean
  pgm: boolean
}

function parseResourceFlags(byte: number): ResourceFlags {
  return {
    calpag: !!(byte & 0x01),
    daq: !!(byte & 0x04),
    stim: !!(byte & 0x08),
    pgm: !!(byte & 0x10)
  }
}

/** Parsed GET_STATUS response. @category XCP */
export interface GetStatusResponse {
  sessionStatus: {
    storeCalRequest: boolean
    storeDaqRequest: boolean
    clearDaqRequest: boolean
    daqRunning: boolean
    resume: boolean
  }
  resourceProtectionStatus: ResourceFlags
  sessionConfigurationId: number
}

/** Parse a GET_STATUS response packet. @category XCP */
export function parseGetStatusResponse(
  response: Buffer,
  byteOrder = ByteOrder.INTEL
): GetStatusResponse {
  const payload = checkResponse(response)
  const sessionStatus = payload[0]
  return {
    sessionStatus: {
      storeCalRequest: !!(sessionStatus & 0x01),
      storeDaqRequest: !!(sessionStatus & 0x04),
      clearDaqRequest: !!(sessionStatus & 0x08),
      daqRunning: !!(sessionStatus & 0x40),
      resume: !!(sessionStatus & 0x80)
    },
    resourceProtectionStatus: parseResourceFlags(payload[1]),
    sessionConfigurationId: unpackUint(payload, 3, 2, byteOrder)
  }
}

/** Parsed GET_COMM_MODE_INFO response. @category XCP */
export interface GetCommModeInfoResponse {
  commModeOptional: { masterBlockMode: boolean; interleavedMode: boolean }
  maxBs: number
  minSt: number
  queueSize: number
  xcpDriverVersionNumber: number
}

/** Parse a GET_COMM_MODE_INFO response packet. @category XCP */
export function parseGetCommModeInfoResponse(response: Buffer): GetCommModeInfoResponse {
  const payload = checkResponse(response)
  const commModeOptional = payload[1]
  return {
    commModeOptional: {
      masterBlockMode: !!(commModeOptional & 0x01),
      interleavedMode: !!(commModeOptional & 0x02)
    },
    maxBs: payload[3],
    minSt: payload[4],
    queueSize: payload[5],
    xcpDriverVersionNumber: payload[6]
  }
}

/** Parsed GET_VERSION response. @category XCP */
export interface GetVersionResponse {
  protocolMajor: number
  protocolMinor: number
  transportMajor: number
  transportMinor: number
}

/** Parse a GET_VERSION response packet. @category XCP */
export function parseGetVersionResponse(response: Buffer): GetVersionResponse {
  const payload = checkResponse(response)
  return {
    protocolMajor: payload[1],
    protocolMinor: payload[2],
    transportMajor: payload[3],
    transportMinor: payload[4]
  }
}

/** Parsed GET_ID response (header only; the identifier bytes follow via UPLOAD). @category XCP */
export interface GetIdResponse {
  mode: number
  length: number
}

/** Parse a GET_ID response packet. @category XCP */
export function parseGetIdResponse(response: Buffer, byteOrder = ByteOrder.INTEL): GetIdResponse {
  const payload = checkResponse(response)
  return {
    mode: payload[0],
    length: unpackUint(payload, 3, 4, byteOrder)
  }
}

/** Parsed GET_SEED response. @category XCP */
export interface GetSeedResponse {
  length: number
  seed: number[]
}

/** Parse a GET_SEED response packet. @category XCP */
export function parseGetSeedResponse(response: Buffer): GetSeedResponse {
  const payload = checkResponse(response)
  const length = payload[0]
  return {
    length,
    seed: Array.from(payload.subarray(1, 1 + length))
  }
}

/** Parse an UNLOCK response packet into the current resource protection status. @category XCP */
export function parseUnlockResponse(response: Buffer): ResourceFlags {
  const payload = checkResponse(response)
  return parseResourceFlags(payload[0])
}

/** Parsed BUILD_CHECKSUM response. @category XCP */
export interface BuildChecksumResponse {
  checksumType: ChecksumType
  checksum: number
}

/** Parse a BUILD_CHECKSUM response packet. @category XCP */
export function parseBuildChecksumResponse(
  response: Buffer,
  byteOrder = ByteOrder.INTEL
): BuildChecksumResponse {
  const payload = checkResponse(response)
  return {
    checksumType: payload[0],
    checksum: unpackUint(payload, 3, 4, byteOrder)
  }
}

/** Parse a GET_CAL_PAGE response packet into the logical data page number. @category XCP */
export function parseGetCalPageResponse(response: Buffer): number {
  const payload = checkResponse(response)
  return payload[2]
}

/** Parsed START_STOP_DAQ_LIST response. @category XCP */
export interface StartStopDaqListResponse {
  firstPid: number
}

/** Parse a START_STOP_DAQ_LIST response packet. @category XCP */
export function parseStartStopDaqListResponse(response: Buffer): StartStopDaqListResponse {
  const payload = checkResponse(response)
  return { firstPid: payload[0] }
}

/** Parse a GET_DAQ_CLOCK response packet into the receive timestamp. @category XCP */
export function parseGetDaqClockResponse(response: Buffer, byteOrder = ByteOrder.INTEL): number {
  const payload = checkResponse(response)
  return unpackUint(payload, 3, 4, byteOrder)
}
