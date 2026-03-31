/**
 * Convert a Buffer to a value based on type.
 *
 * @param {Buffer} raw - data to convert.
 * @param {DataType | string} type - how to interpret the data.
 * @param {number} [scaleFactor] - optional multiplier for numeric types.
 * @returns {number | bigint | string | Date} converted data.
 */
declare function _exports(
  raw: Buffer,
  type: DataType | string,
  scaleFactor?: number
): number | bigint | string | Date
export = _exports
import { DataType } from '../types'
