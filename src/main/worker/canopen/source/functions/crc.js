const { CRC } = require('../../../crc');



/**
 * Calculates a CRC16 on a block of data.
 *
 * @param {Buffer} data - data block.
 * @returns {number} crc value.
 */
function calculateCrc(data) {
    const crc16 = CRC.buildInCrc('CRC16_CCIT_ZERO');
    return crc16.compute(data);
}

module.exports = exports = calculateCrc;
