import EventEmitter from 'events'
import { cloneDeep } from 'lodash'
// import type { CanLOG } from '../log'

export interface CanBitrate {
  freq: number
  timeSeg1: number
  timeSeg2: number
  sjw: number
  preScaler: number
  clock?: string
  zlgSpec?: string
}

export type CanVendor =
  | 'peak'
  | 'simulate'
  | 'zlg'
  | 'kvaser'
  | 'toomoss'
  | 'vector'
  | 'slcan'
  | 'ecubus'
  | 'candle'
export interface CanBaseInfo {
  id: string
  handle: any
  name: string
  vendor: CanVendor
  canfd: boolean
  bitrate: CanBitrate
  bitratefd?: CanBitrate
  silent?: boolean
  database?: string
  toomossRes?: boolean
  zlgRes?: boolean
  candleRes?: boolean
  slcanDelay?: number
}

/**
 * Represents a CAN (Controller Area Network) message.
 *
 * @category CAN
 */
export interface CanMessage {
  /**
   * The name of the CAN message.
   */
  name?: string
  /**
   * The device associated with the CAN message.
   */
  device?: string

  /**
   * The direction of the CAN message, either 'IN' for incoming or 'OUT' for outgoing.
   */
  dir: 'IN' | 'OUT'

  /**
   * The data payload of the CAN message.
   */
  data: Buffer

  /**
   * The timestamp of when the CAN message was sent/recv.
   */
  ts?: number

  /**
   * The identifier of the CAN message.
   */
  id: number

  /**
   * The type of the CAN message.
   */
  msgType: CanMsgType

  /**
   * Indicates whether the CAN message is simulated.
   * This property is optional.
   */
  isSimulate?: boolean
  /**
   * The database name of the CAN message.
   */
  database?: string
  /**
   * The children signals of the CAN message.
   * internal use
   */
  children?: {
    name: string
    data: string
  }[]
}

/**
 * Enumeration representing different CAN (Controller Area Network) ID types.
 *
 * @category CAN
 * @enum {string}
 * @readonly
 */
export enum CAN_ID_TYPE {
  STANDARD = 'STANDARD',
  EXTENDED = 'EXTENDED'
}

/**
 * Enumeration representing different CAN (Controller Area Network) address types.
 *
 * @category CAN
 * @enum {string}
 * @readonly
 */
export enum CAN_ADDR_TYPE {
  PHYSICAL = 'PHYSICAL',
  FUNCTIONAL = 'FUNCTIONAL'
}

/**
 * Enumeration representing different CAN (Controller Area Network) address formats.
 *
 * @category CAN
 * @enum {string}
 * @readonly
 */
export enum CAN_ADDR_FORMAT {
  NORMAL = 'NORMAL',
  FIXED_NORMAL = 'NORMAL_FIXED',
  EXTENDED = 'EXTENDED',
  MIXED = 'MIXED',
  ENHANCED = 'ENHANCED'
}

/**
 * Represents a CAN (Controller Area Network) message type.
 * @category CAN

 */
export interface CanMsgType {
  /**
   * The type of CAN ID.
   */
  idType: CAN_ID_TYPE

  /**
   * Indicates if Bit Rate Switching (BRS) is enabled.
   */
  brs: boolean

  /**
   * Indicates if CAN FD (Flexible Data-rate) is used.
   */
  canfd: boolean

  /**
   * Indicates if the message is a remote frame.
   */
  remote: boolean

  /**
   * Optional unique identifier for the message.
   */
  uuid?: string
}

export enum CAN_ERROR_ID {
  CAN_BUS_ERROR,
  CAN_READ_TIMEOUT,
  CAN_BUS_BUSY,
  CAN_BUS_CLOSED,
  CAN_INTERNAL_ERROR,
  CAN_PARAM_ERROR,
  CAN_DRIVER_SILENT
}

const canErrorMap: Record<CAN_ERROR_ID, string> = {
  [CAN_ERROR_ID.CAN_BUS_ERROR]: 'bus error',
  [CAN_ERROR_ID.CAN_READ_TIMEOUT]: 'read timeout',
  [CAN_ERROR_ID.CAN_BUS_BUSY]: 'bus busy',
  [CAN_ERROR_ID.CAN_INTERNAL_ERROR]: 'dll lib internal error',
  [CAN_ERROR_ID.CAN_BUS_CLOSED]: 'bus closed',
  [CAN_ERROR_ID.CAN_PARAM_ERROR]: 'param error',
  [CAN_ERROR_ID.CAN_DRIVER_SILENT]: 'driver silent'
}

export function getTsUs() {
  const hrtime = process.hrtime()
  const seconds = hrtime[0]
  const nanoseconds = hrtime[1]
  return seconds * 1000000 + Math.floor(nanoseconds / 1000)
}

export interface CanInterAction {
  uuid: string
  trigger: {
    type: 'manual' | 'periodic'
    period?: number
    onKey?: string
  }
  name: string
  database?: string
  id: string
  channel: string
  type: 'canfd' | 'can' | 'ecan' | 'ecanfd'
  dlc: number
  brs?: boolean
  remote?: boolean
  data: string[]
}
export function formatError(error: Error) {
  const stack = error?.stack || ''

  // Get first stack line (usually contains error location)
  const locationLine = stack.split('\n')[1] || ''

  // Extract file location info
  const locationMatch = locationLine.match(/webpack:\\ecubuspro\\(.*):(\d+):(\d+)\)$/)

  let location = ''
  if (locationMatch) {
    const [, file, line, column] = locationMatch
    //
    // Convert webpack path to GitHub URL，#L${line}C${column}-L${line}C${column}
    location = `https://github.com/ecubus/EcuBus-Pro/blob/master/${file}#L${line}C${column}`
  } else {
    // at listener (D:\code\ecubus-pro\resources\examples\test_simple\node.ts:5:11)
    const newMatch = locationLine.match(/\((.*):(\d+):(\d+)\)/)
    if (newMatch) {
      const [, file, line, column] = newMatch
      location = `file://${file}:${line}:${column}`
    } else {
      location = locationLine
    }
  }

  // Return simplified error message
  return `Error: ${error.message}, Pos: ${location}`
}

export class CanError extends Error {
  errorId: CAN_ERROR_ID
  msgType: CanMsgType
  data?: Buffer
  constructor(errorId: CAN_ERROR_ID, msgType: CanMsgType, data?: Buffer, extMsg?: string) {
    super(canErrorMap[errorId] + (extMsg ? `,${extMsg}` : ''))
    this.errorId = errorId
    this.msgType = msgType
    this.data = data
  }
}

/**
 * @category CAN
 */
export interface CanAddr extends CanMsgType {
  name: string
  addrFormat: CAN_ADDR_FORMAT
  addrType: CAN_ADDR_TYPE
  desc?: string
  SA: string
  TA: string
  AE: string
  canIdTx: string
  canIdRx: string
  nAs: number
  nAr: number
  nBs: number
  nCr: number
  nBr?: number
  nCs?: number
  stMin: number
  bs: number
  maxWTF: number
  uuid?: string
  dlc: number
  padding: boolean
  paddingValue: string
}

export interface CanDevice {
  label: string
  id: string
  handle: any
  serialNumber?: string
  busy?: boolean
  candleRes?: boolean
}

export interface CanEventMap {
  sendTp: [
    info: {
      data: Buffer
      ts: number
      id: number
      idType: CAN_ID_TYPE
      canfd: boolean
      brs: boolean
      remote: boolean
    }
  ]
  sendBase: [
    info: {
      data: Buffer
      ts: number
      id: number
      idType: CAN_ID_TYPE
      canfd: boolean
      brs: boolean
      remote: boolean
    }
  ]
  recvTp: [
    info: {
      data: Buffer
      ts: number
      id: number
      idType: string
      canfd: boolean
      brs: boolean
      remote: boolean
    }
  ]
  recvBase: [
    info: {
      data: Buffer
      ts: number
      id: number
      idType: string
      canfd: boolean
      brs: boolean
      remote: boolean
    }
  ]
  errorTp: [
    info: {
      dir: 'send' | 'recv'
      data: Buffer
      ts: number
      id: number
      idType: string
      canfd: boolean
      brs: boolean
      remote: boolean
      msg: string
    }
  ]
}

export function getLenByDlc(dlc: number, canFd: boolean) {
  const map: Record<number, number> = {
    0: 8,
    1: 8,
    2: 8,
    3: 8,
    4: 8,
    5: 8,
    6: 8,
    7: 8,
    8: 8,
    9: 8,
    10: 8,
    11: 8,
    12: 8,
    13: 8,
    14: 8,
    15: 8
  }
  const mapFd: Record<number, number> = {
    0: 8,
    1: 8,
    2: 8,
    3: 8,
    4: 8,
    5: 8,
    6: 8,
    7: 8,
    8: 8,
    9: 12,
    10: 16,
    11: 20,
    12: 24,
    13: 32,
    14: 48,
    15: 64
  }
  if (canFd) {
    return mapFd[dlc] || 0
  } else {
    return map[dlc] || 0
  }
}
export function getDlcByLen(len: number, canFd: boolean) {
  const map: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8
  }
  const mapFd: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    12: 9,
    16: 10,
    20: 11,
    24: 12,
    32: 13,
    48: 14,
    64: 15
  }

  if (canFd) {
    return mapFd[len] || 0
  } else {
    return map[len] || 0
  }
}
export function addrToId(addr: CanAddr): number {
  let id = Number(addr.canIdTx)
  if (addr.addrFormat == CAN_ADDR_FORMAT.FIXED_NORMAL) {
    id = calcCanIdNormalFixed(Number(addr.SA), Number(addr.TA), addr.addrType)
  } else if (addr.addrFormat == CAN_ADDR_FORMAT.MIXED) {
    if (addr.idType == CAN_ID_TYPE.EXTENDED) {
      id = calcCanIdMixed(Number(addr.SA), Number(addr.TA), addr.addrType)
    }
  }
  return id
}
export function addrToStr(addr: CanAddr): string {
  const cAddr = cloneDeep(addr)
  delete cAddr.uuid
  const jsonString = JSON.stringify(cAddr, Object.keys(cAddr).sort())
  return jsonString
}

export function swapAddr(addr: CanAddr): CanAddr {
  const cloneAddr = cloneDeep(addr)
  const tmp = cloneAddr.SA
  cloneAddr.SA = cloneAddr.TA
  cloneAddr.TA = tmp
  const tmpid = cloneAddr.canIdTx
  cloneAddr.canIdTx = cloneAddr.canIdRx
  cloneAddr.canIdRx = tmpid
  return cloneAddr
}
export function calcCanIdMixed(sa: number, ta: number, addrType: CAN_ADDR_TYPE) {
  if (addrType === CAN_ADDR_TYPE.PHYSICAL) {
    //29bit 110|0|0|206|N_TA|N_SA
    return 0x18ce0000 | (ta << 8) | sa
  } else {
    //29bit 110|0|0|205|N_TA|N_SA
    return 0x18cd0000 | (ta << 8) | sa
  }
}

export function calcCanIdNormalFixed(sa: number, ta: number, addrType: CAN_ADDR_TYPE) {
  if (addrType === CAN_ADDR_TYPE.PHYSICAL) {
    //29bit 110|0|0|218|N_TA|N_SA
    return 0x18da0000 | (ta << 8) | sa
  } else {
    //29bit 110|0|0|219|N_TA|N_SA
    return 0x18db0000 | (ta << 8) | sa
  }
}
