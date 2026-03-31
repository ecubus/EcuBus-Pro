const util = require('util');

/**
 * Time offset in milliseconds between January 1, 1970 and January 1, 1984.
 *
 * @private
 */
const EPOCH_OFFSET = 441763200 * 1000;

/**
 * Construct a Date object from a CANopen timestamp.
 *
 * @param {number} days - days since Jan 1, 1984
 * @param {number} ms - milliseconds since midnight.
 * @returns {Date} converted Date.
 * @since 6.0.0
 */
function timeToDate(days, ms) {
    return new Date((days * 8.64e7) + ms + EPOCH_OFFSET);
}

/**
 * Deconstruct a Date object into a CANopen timestamp.
 *
 * @param {Date} date - Date object.
 * @returns {object} CANopen timestamp { days, ms }
 * @since 6.0.0
 */
function dateToTime(date) {
    if (!util.types.isDate(date))
        date = new Date(date);

    // Milliseconds since January 1, 1984
    let time = date.getTime() - EPOCH_OFFSET;
    if (time < 0)
        time = 0;

    // Days since epoch
    const days = Math.floor(time / 8.64e7);

    // Milliseconds since midnight
    const ms = time - (days * 8.64e7);

    return { days, ms };
}

module.exports = exports = { timeToDate, dateToTime };