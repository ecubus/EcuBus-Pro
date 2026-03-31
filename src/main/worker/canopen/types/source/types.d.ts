/**
 * CANopen object types.
 *
 * @enum {number}
 * @see CiA301 "Object code usage" (§7.4.3)
 */
export type ObjectType = number
export namespace ObjectType {
  /** An object with no data fields. */
  let NULL: number
  /** Large variable amount of data, e.g. executable program code. */
  let DOMAIN: number
  /** Denotes a type definition such as BOOLEAN, UNSIGNED16, etc. */
  let DEFTYPE: number
  /** Defines a new record type, e.g. PDO mapping structure. */
  let DEFSTRUCT: number
  /** A single value such as an UNSIGNED8, INTEGER16, etc. */
  let VAR: number
  /**
   * A multiple data field object where each data field is a simple variable
   * of the same basic data type, e.g. array of UNSIGNED16. Sub-index 0 of an
   * ARRAY is always UNSIGNED8 and therefore not part of the ARRAY data.
   */
  let ARRAY: number
  /**
   * A multiple data field object where the data fields may be any
   * combination of simple variables. Sub-index 0 of a RECORD is always
   * UNSIGNED8 and sub-index 255 is always UNSIGNED32 and therefore not part
   * of the RECORD data.
   */
  let RECORD: number
}
/**
 * CANopen access types.
 *
 * The access rights for a particular object. The viewpoint is from the network
 * into the CANopen device.
 *
 * @enum {string}
 * @see CiA301 "Access usage" (§7.4.5)
 */
export type AccessType = string
export namespace AccessType {
  /** Read and write access. */
  let READ_WRITE: string
  /** Write only access. */
  let WRITE_ONLY: string
  /** Read only access. */
  let READ_ONLY: string
  /** Read only access. Contents should not change after initialization. */
  let CONSTANT: string
}
/**
 * CANopen data types.
 *
 * The static data types are placed in the object dictionary at their specified
 * index for definition purposes only. Simple types may be mapped to an RPDO
 * as a way to define space for data that is not being used by this CANopen
 * device.
 *
 * @enum {number}
 * @see CiA301 "Data type entry usage" (§7.4.7)
 */
export type DataType = number
export namespace DataType {
  /** Boolean value (bool). */
  export let BOOLEAN: number
  /** 8-bit signed integer (int8_t). */
  export let INTEGER8: number
  /** 16-bit signed integer (int16_t). */
  export let INTEGER16: number
  /** 32-bit signed integer (int32_t). */
  export let INTEGER32: number
  /** 8-bit unsigned integer (uint8_t). */
  export let UNSIGNED8: number
  /** 16-bit unsigned integer (uint16_t). */
  export let UNSIGNED16: number
  /** 32-bit unsigned integer (uint32_t). */
  export let UNSIGNED32: number
  /** 32-bit floating point (float). */
  export let REAL32: number
  /** Null terminated c-string. */
  export let VISIBLE_STRING: number
  /** Raw character buffer. */
  export let OCTET_STRING: number
  /** Unicode string. */
  export let UNICODE_STRING: number
  /** Time since January 1, 1984. */
  export let TIME_OF_DAY: number
  /** Time difference. */
  export let TIME_DIFFERENCE: number
  /** Data of variable length. */
  let DOMAIN_1: number
  export { DOMAIN_1 as DOMAIN }
  /** 64-bit floating point (double). */
  export let REAL64: number
  /** 24-bit signed integer. */
  export let INTEGER24: number
  /** 40-bit signed integer. */
  export let INTEGER40: number
  /** 48-bit signed integer. */
  export let INTEGER48: number
  /** 56-bit signed integer. */
  export let INTEGER56: number
  /** 64-bit signed integer (int64_t). */
  export let INTEGER64: number
  /** 24-bit unsigned integer. */
  export let UNSIGNED24: number
  /** 40-bit unsigned integer. */
  export let UNSIGNED40: number
  /** 48-bit unsigned integer. */
  export let UNSIGNED48: number
  /** 56-bit unsigned integer. */
  export let UNSIGNED56: number
  /** 64-bit unsigned integer (uint64_t). */
  export let UNSIGNED64: number
  /** PDO parameter record. */
  export let PDO_PARAMETER: number
  /** PDO mapping parameter record. */
  export let PDO_MAPPING: number
  /** SDO parameter record. */
  export let SDO_PARAMETER: number
  /** Identity record. */
  export let IDENTITY: number
}
