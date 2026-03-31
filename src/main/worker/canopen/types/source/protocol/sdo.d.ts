/**
 * CANopen SDO 'Client Command Specifier' codes.
 *
 * @enum {number}
 * @see CiA301 "SDO protocols" (§7.2.4.3)
 */
export type ClientCommand = number
export namespace ClientCommand {
  let DOWNLOAD_SEGMENT: number
  let DOWNLOAD_INITIATE: number
  let UPLOAD_INITIATE: number
  let UPLOAD_SEGMENT: number
  let ABORT: number
  let BLOCK_UPLOAD: number
  let BLOCK_DOWNLOAD: number
}
/**
 * CANopen SDO 'Server Command Specifier' codes.
 *
 * @enum {number}
 * @see CiA301 "SDO protocols" (§7.2.4.3)
 */
export type ServerCommand = number
export namespace ServerCommand {
  let UPLOAD_SEGMENT_1: number
  export { UPLOAD_SEGMENT_1 as UPLOAD_SEGMENT }
  let DOWNLOAD_SEGMENT_1: number
  export { DOWNLOAD_SEGMENT_1 as DOWNLOAD_SEGMENT }
  let UPLOAD_INITIATE_1: number
  export { UPLOAD_INITIATE_1 as UPLOAD_INITIATE }
  let DOWNLOAD_INITIATE_1: number
  export { DOWNLOAD_INITIATE_1 as DOWNLOAD_INITIATE }
  let ABORT_1: number
  export { ABORT_1 as ABORT }
  let BLOCK_DOWNLOAD_1: number
  export { BLOCK_DOWNLOAD_1 as BLOCK_DOWNLOAD }
  let BLOCK_UPLOAD_1: number
  export { BLOCK_UPLOAD_1 as BLOCK_UPLOAD }
}
/**
 * CANopen abort codes.
 *
 * @enum {number}
 * @see CiA301 'Protocol SDO abort transfer' (§7.2.4.3.17)
 */
export type SdoCode = number
export namespace SdoCode {
  /** Toggle bit not altered. */
  let TOGGLE_BIT: number
  /** SDO protocol timed out. */
  let TIMEOUT: number
  /** Command specifier not valid or unknown. */
  let BAD_COMMAND: number
  /** Invalid block size in block mode. */
  let BAD_BLOCK_SIZE: number
  /** Invalid sequence number in block mode. */
  let BAD_BLOCK_SEQUENCE: number
  /** CRC error in block mode. */
  let BAD_BLOCK_CRC: number
  /** Out of memory. */
  let OUT_OF_MEMORY: number
  /** Unsupported access to an object. */
  let UNSUPPORTED_ACCESS: number
  /** Attempt to read a write only object. */
  let WRITE_ONLY: number
  /** Attempt to write a read only object. */
  let READ_ONLY: number
  /** Object does not exist. */
  let OBJECT_UNDEFINED: number
  /** Object cannot be mapped to the PDO. */
  let OBJECT_NOT_MAPPABLE: number
  /** Number and length of object to be mapped exceeds PDO length. */
  let MAP_LENGTH: number
  /** General parameter incompatibility reasons. */
  let PARAMETER_INCOMPATIBILITY: number
  /** General internal incompatibility in device. */
  let DEVICE_INCOMPATIBILITY: number
  /** Access failed due to hardware error. */
  let HARDWARE_ERROR: number
  /** Data type does not match: length of service parameter does not match. */
  let BAD_LENGTH: number
  /** Data type does not match: length of service parameter too high. */
  let DATA_LONG: number
  /** Data type does not match: length of service parameter too short. */
  let DATA_SHORT: number
  /** Sub index does not exist. */
  let BAD_SUB_INDEX: number
  /** Invalid value for download parameter. */
  let BAD_VALUE: number
  /** Value range of parameter written too high. */
  let VALUE_HIGH: number
  /** Value range of parameter written too low. */
  let VALUE_LOW: number
  /** Maximum value is less than minimum value. */
  let RANGE_ERROR: number
  /** Resource not available: SDO connection. */
  let SDO_NOT_AVAILBLE: number
  /** General error. */
  let GENERAL_ERROR: number
  /** Data cannot be transferred or stored to application. */
  let DATA_TRANSFER: number
  /** Data cannot be transferred or stored to application because of local control. */
  let LOCAL_CONTROL: number
  /** Data cannot be transferred or stored to application because of present device state. */
  let DEVICE_STATE: number
  /** Object dictionary not present or dynamic generation failed. */
  let OD_ERROR: number
  /** No data available. */
  let NO_DATA: number
}
/**
 * Represents an SDO transfer error.
 *
 * @param {SdoCode} code - error code.
 * @param {number} index - object index.
 * @param {number} subIndex - object subIndex.
 */
export class SdoError extends Error {
  constructor(code: SdoCode, index: number, subIndex?: number)
  code: SdoCode
}
/**
 * Represents an SDO transfer.
 *
 * @private
 */
export class SdoTransfer extends EventEmitter<any> {
  constructor(args: {
    resolve: Function
    reject: Function
    index: number
    subIndex: number
    timeout: number
    cobId: number
    data?: Buffer
    blockInterval?: number
  })
  _resolve: Function
  _reject: Function
  index: number
  subIndex: number
  timeout: number
  cobId: number
  data: Buffer
  size: number
  blockInterval: number | null
  active: boolean
  toggle: number
  timer: NodeJS.Timeout
  blockTimer: NodeJS.Timeout | null
  blockDownload: boolean
  blockFinished: boolean
  blockSequence: number
  blockCrc: boolean
  /** Reset internal values. */
  reset(): void
  blockTransfer: boolean
  /** Begin the transfer timeout. */
  start(): void
  /** Refresh the transfer timeout. */
  refresh(): void
  /**
   * Complete the transfer and resolve its promise.
   *
   * @param {Buffer | undefined} data - return data.
   */
  resolve(data: Buffer | undefined): void
  /**
   * Complete the transfer and reject its promise.
   *
   * @param {SdoCode} code - SDO abort code.
   */
  reject(code: SdoCode): void
  /**
   * Abort the transfer.
   *
   * @param {SdoCode} code - SDO abort code.
   */
  abort(code: SdoCode): void
}
import EventEmitter = require('node:events')
