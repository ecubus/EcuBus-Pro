/**
 * Convert a value to a Buffer based on type.
 *
 * @param {number | bigint | string | Date} value - data to convert.
 * @param {DataType | string} type - how to interpret the data.
 * @param {number} [scaleFactor] - optional multiplier for numeric types.
 * @returns {Buffer} converted Buffer.
 */
declare function _exports(
  value: number | bigint | string | Date,
  type: DataType | string,
  scaleFactor?: number
): Buffer
export = _exports
import { DataType } from '../types'
