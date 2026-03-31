/**
 * Construct a Date object from a CANopen timestamp.
 *
 * @param {number} days - days since Jan 1, 1984
 * @param {number} ms - milliseconds since midnight.
 * @returns {Date} converted Date.
 * @since 6.0.0
 */
export function timeToDate(days: number, ms: number): Date
/**
 * Deconstruct a Date object into a CANopen timestamp.
 *
 * @param {Date} date - Date object.
 * @returns { { days: number, ms: number } } CANopen timestamp { days, ms }
 * @since 6.0.0
 */
export function dateToTime(date: Date): { days: number; ms: number }
