/**
 * @file Implements the CANopen Service Data Object (SDO) protocol.
 * @author Wilkins White
 * @copyright 2024 Daxbot
 */

const EventEmitter = require('events');

/**
 * CANopen abort codes.
 *
 * @enum {string}
 * @see CiA301 'Protocol SDO abort transfer' (§7.2.4.3.17)
 * @memberof SdoError
 */
const SdoCode = {
    /** Toggle bit not altered. */
    TOGGLE_BIT: 0x05030000,

    /** SDO protocol timed out. */
    TIMEOUT: 0x05040000,

    /** Command specifier not valid or unknown. */
    BAD_COMMAND: 0x05040001,

    /** Invalid block size in block mode. */
    BAD_BLOCK_SIZE: 0x05040002,

    /** Invalid sequence number in block mode. */
    BAD_BLOCK_SEQUENCE: 0x05040003,

    /** CRC error in block mode. */
    BAD_BLOCK_CRC: 0x05040004,

    /** Out of memory. */
    OUT_OF_MEMORY: 0x05040005,

    /** Unsupported access to an object. */
    UNSUPPORTED_ACCESS: 0x06010000,

    /** Attempt to read a write only object. */
    WRITE_ONLY: 0x06010001,

    /** Attempt to write a read only object. */
    READ_ONLY: 0x06010002,

    /** Object does not exist. */
    OBJECT_UNDEFINED: 0x06020000,

    /** Object cannot be mapped to the PDO. */
    OBJECT_NOT_MAPPABLE: 0x06040041,

    /** Number and length of object to be mapped exceeds PDO length. */
    MAP_LENGTH: 0x06040042,

    /** General parameter incompatibility reasons. */
    PARAMETER_INCOMPATIBILITY: 0x06040043,

    /** General internal incompatibility in device. */
    DEVICE_INCOMPATIBILITY: 0x06040047,

    /** Access failed due to hardware error. */
    HARDWARE_ERROR: 0x06060000,

    /** Data type does not match: length of service parameter does not match. */
    BAD_LENGTH: 0x06070010,

    /** Data type does not match: length of service parameter too high. */
    DATA_LONG: 0x06070012,

    /** Data type does not match: length of service parameter too short. */
    DATA_SHORT: 0x06070013,

    /** Sub index does not exist. */
    BAD_SUB_INDEX: 0x06090011,

    /** Invalid value for download parameter. */
    BAD_VALUE: 0x06090030,

    /** Value range of parameter written too high. */
    VALUE_HIGH: 0x06090031,

    /** Value range of parameter written too low. */
    VALUE_LOW: 0x06090032,

    /** Maximum value is less than minimum value. */
    RANGE_ERROR: 0x06090036,

    /** Resource not available: SDO connection. */
    SDO_NOT_AVAILBLE: 0x060A0023,

    /** General error. */
    GENERAL_ERROR: 0x08000000,

    /** Data cannot be transferred or stored to application. */
    DATA_TRANSFER: 0x08000020,

    /**
     * Data cannot be transferred or stored to application because of local
     * control
     */
    LOCAL_CONTROL: 0x08000021,

    /**
     * Data cannot be transferred or stored to application because of present
     * device state.
     */
    DEVICE_STATE: 0x08000022,

    /** Object dictionary not present or dynamic generation failed. */
    OD_ERROR: 0x08000023,

    /** No data available. */
    NO_DATA: 0x08000024,
};

/**
 * CANopen SDO 'Client Command Specifier' codes.
 *
 * @enum {number}
 * @see CiA301 'SDO protocols' (§7.2.4.3)
 * @private
 */
const ClientCommand = {
    DOWNLOAD_SEGMENT: 0,
    DOWNLOAD_INITIATE: 1,
    UPLOAD_INITIATE: 2,
    UPLOAD_SEGMENT: 3,
    ABORT: 4,
    BLOCK_UPLOAD: 5,
    BLOCK_DOWNLOAD: 6,
};

/**
 * CANopen SDO 'Server Command Specifier' codes.
 *
 * @enum {number}
 * @see CiA301 'SDO protocols' (§7.2.4.3)
 * @private
 */
const ServerCommand = {
    UPLOAD_SEGMENT: 0,
    DOWNLOAD_SEGMENT: 1,
    UPLOAD_INITIATE: 2,
    DOWNLOAD_INITIATE: 3,
    ABORT: 4,
    BLOCK_DOWNLOAD: 5,
    BLOCK_UPLOAD: 6,
};


/**
 * Return the error message associated with an AbortCode.
 *
 * @param {SdoCode} code - message to lookup.
 * @returns {string} abort code string.
 * @private
 */
function codeToString(code) {
    switch (code) {
        case SdoCode.TOGGLE_BIT:
            return 'Toggle bit not altered';
        case SdoCode.TIMEOUT:
            return 'SDO protocol timed out';
        case SdoCode.BAD_COMMAND:
            return 'Command specifier not valid or unknown';
        case SdoCode.BAD_BLOCK_SIZE:
            return 'Invalid block size in block mode';
        case SdoCode.BAD_BLOCK_SEQUENCE:
            return 'Invalid sequence number in block mode';
        case SdoCode.BAD_BLOCK_CRC:
            return 'CRC error in block mode';
        case SdoCode.OUT_OF_MEMORY:
            return 'Out of memory';
        case SdoCode.UNSUPPORTED_ACCESS:
            return 'Unsupported access to an object';
        case SdoCode.WRITE_ONLY:
            return 'Attempt to read a write only object';
        case SdoCode.READ_ONLY:
            return 'Attempt to write a read only object';
        case SdoCode.OBJECT_UNDEFINED:
            return 'Object does not exist';
        case SdoCode.OBJECT_NOT_MAPPABLE:
            return 'Object cannot be mapped to the PDO';
        case SdoCode.MAP_LENGTH:
            return 'Number and length of object to be mapped exceeds PDO length';
        case SdoCode.PARAMETER_INCOMPATIBILITY:
            return 'General parameter incompatibility reasons';
        case SdoCode.DEVICE_INCOMPATIBILITY:
            return 'General internal incompatibility in device';
        case SdoCode.HARDWARE_ERROR:
            return 'Access failed due to hardware error';
        case SdoCode.BAD_LENGTH:
            return 'Data type does not match: length of service parameter does not match';
        case SdoCode.DATA_LONG:
            return 'Data type does not match: length of service parameter too high';
        case SdoCode.DATA_SHORT:
            return 'Data type does not match: length of service parameter too short';
        case SdoCode.BAD_SUB_INDEX:
            return 'Sub index does not exist';
        case SdoCode.BAD_VALUE:
            return 'Invalid value for download parameter';
        case SdoCode.VALUE_HIGH:
            return 'Value range of parameter written too high';
        case SdoCode.VALUE_LOW:
            return 'Value range of parameter written too low';
        case SdoCode.RANGE_ERROR:
            return 'Maximum value is less than minimum value';
        case SdoCode.SDO_NOT_AVAILBLE:
            return 'Resource not available: SDO connection';
        case SdoCode.GENERAL_ERROR:
            return 'General error';
        case SdoCode.DATA_TRANSFER:
            return 'Data cannot be transferred or stored to application';
        case SdoCode.LOCAL_CONTROL:
            return 'Data cannot be transferred or stored to application because of local control';
        case SdoCode.DEVICE_STATE:
            return 'Data cannot be transferred or stored to application because of present device state';
        case SdoCode.OD_ERROR:
            return 'Object dictionary not present or dynamic generation failed';
        case SdoCode.NO_DATA:
            return 'No data available';
        default:
            return `Unknown error (0x${code.toString(16).padStart(8, '0')})`;
    }
}

/**
 * Represents an SDO transfer error.
 *
 * @param {SdoCode} code - error code.
 * @param {number} index - object index.
 * @param {number} subIndex - object subIndex.
 */
class SdoError extends Error {
    constructor(code, index, subIndex = null) {
        const message = codeToString(code);

        let tag = index;
        if (typeof index === 'number')
            tag = `0x${index.toString(16)}`;
        if (subIndex !== null)
            tag += `.${subIndex.toString()}`;

        super(`${message} [${tag}]`);

        this.code = code;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Represents an SDO transfer.
 *
 * @private
 */
class SdoTransfer extends EventEmitter {
    constructor(args) {
        super();

        this._resolve = args.resolve;
        this._reject = args.reject;
        this.index = args.index;
        this.subIndex = args.subIndex;
        this.timeout = args.timeout;
        this.cobId = args.cobId;
        this.data = args.data || Buffer.alloc(0);
        this.size = this.data.length;
        this.blockInterval = args.blockInterval;

        this.active = false;
        this.toggle = 0;
        this.timer = null;
        this.blockTimer = null;
        this.blockDownload = false;
        this.blockFinished = false;
        this.blockSequence = 0;
        this.blockCrc = false;
    }

    /** Reset internal values. */
    reset() {
        clearTimeout(this.timer);
        clearInterval(this.blockTimer);
        this.active = false;
        this.timer = null;
        this.blockTimer = null;
        this.blockTransfer = false;
        this.blockFinished = false;
        this.blockSequence = 0;
        this.blockCrc = false;
    }

    /** Begin the transfer timeout. */
    start() {
        this.active = true;
        if (this.timeout) {
            this.timer = setTimeout(
                () => this.abort(SdoCode.TIMEOUT), this.timeout);
        }
    }

    /** Refresh the transfer timeout. */
    refresh() {
        if (!this.timeout || this.timer == null)
            return;

        this.timer.refresh();
    }

    /**
     * Complete the transfer and resolve its promise.
     *
     * @param {Buffer | undefined} data - return data.
     */
    resolve(data) {
        this.reset();
        if (this._resolve)
            this._resolve(data);
    }

    /**
     * Complete the transfer and reject its promise.
     *
     * @param {SdoCode} code - SDO abort code.
     */
    reject(code) {
        this.reset();
        if (this._reject)
            this._reject(new SdoError(code, this.index, this.subIndex));
    }

    /**
     * Abort the transfer.
     *
     * @param {SdoCode} code - SDO abort code.
     */
    abort(code) {
        this.emit('abort', code);
    }
}

module.exports = exports = {
    ClientCommand,
    ServerCommand,
    SdoCode,
    SdoError,
    SdoTransfer,
};
