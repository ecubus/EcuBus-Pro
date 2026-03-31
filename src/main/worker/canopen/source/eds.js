/**
 * @file Implements a CANopen Electronic Data Sheet (EDS)
 * @author Wilkins White
 * @copyright 2024 Daxbot
 */

// External modules
const { EOL } = require('os');
const EventEmitter = require('events');
const fs = require('fs');
const ini = require('ini');

// Local modules
const { ObjectType, AccessType, DataType, } = require('./types');
const rawToType = require('./functions/raw_to_type');
const typeToRaw = require('./functions/type_to_raw');

/**
 * Parse EDS date and time.
 *
 * @param {string} time - time string (hh:mm[AM|PM]).
 * @param {string} date - date string (mm-dd-yyyy).
 * @returns {Date} parsed Date.
 * @private
 */
function parseDate(time, date) {
    const postMeridiem = time.includes('PM');

    time = time
        .replace('AM', '')
        .replace('PM', '');

    let [hours, minutes] = time.split(':');
    let [month, day, year] = date.split('-');

    hours = parseInt(hours);
    minutes = parseInt(minutes);
    month = parseInt(month);
    day = parseInt(day);
    year = parseInt(year);

    if (postMeridiem)
        hours += 12;

    return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Helper method to turn EDS file data into {@link DataObject} data.
 *
 * @param {object} data - EDS style data to convert.
 * @returns {object} DataObject style data.
 * @private
 */
function edsToEntry(data) {
    return {
        parameterName: data['ParameterName'],
        subNumber: parseInt(data['SubNumber']) || undefined,
        objectType: parseInt(data['ObjectType']) || undefined,
        dataType: parseInt(data['DataType']) || undefined,
        lowLimit: parseInt(data['LowLimit']) || undefined,
        highLimit: parseInt(data['HighLimit']) || undefined,
        accessType: data['AccessType'],
        defaultValue: data['DefaultValue'],
        pdoMapping: data['PDOMapping'],
        objFlags: parseInt(data['ObjFlags']) || undefined,
        compactSubObj: parseInt(data['CompactSubObj']) || undefined
    };
}

/**
 * Formats a {@link DataObject} for writing to an EDS file.
 *
 * @param {DataObject} entry - DataObject style data to convert.
 * @returns {object} EDS style data.
 * @private
 */
function entryToEds(entry) {
    if(!DataObject.isDataObject(entry))
        throw new TypeError('entry is not a DataObject');

    let data = {};

    data['ParameterName'] = entry.parameterName;
    data['ObjectType'] = `0x${entry.objectType.toString(16)}`;

    if (entry.subNumber !== undefined)
        data['SubNumber'] = `0x${entry.subNumber.toString(16)}`;

    if (entry.dataType !== undefined)
        data['DataType'] = `0x${entry.dataType.toString(16)}`;

    if (entry.lowLimit !== undefined)
        data['LowLimit'] = entry.lowLimit.toString();

    if (entry.highLimit !== undefined)
        data['HighLimit'] = entry.highLimit.toString();

    if (entry.accessType !== undefined)
        data['AccessType'] = entry.accessType;

    if (entry.defaultValue !== undefined)
        data['DefaultValue'] = entry.defaultValue.toString();

    if (entry.pdoMapping !== undefined)
        data['PDOMapping'] = (entry.pdoMapping) ? '1' : '0';

    if (entry.objFlags !== undefined)
        data['ObjFlags'] = entry.objFlags.toString();

    if (entry.compactSubObj !== undefined)
        data['CompactSubObj'] = (entry.compactSubObj) ? '1' : '0';

    return data;
}

/**
 * Errors generated due to an improper EDS configuration.
 *
 * @param {string} message - error message.
 */
class EdsError extends Error {
    constructor(message) {
        super(message);

        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * A CANopen Data Object.
 *
 * DataObjects should not be created directly, use {@link Eds#addEntry} or
 * {@link Eds#addSubEntry} instead.
 *
 * @param {string} key - object index key (e.g., 1018sub3)
 * @param {object} data - creation parameters.
 * @param {string} data.parameterName - name of the data object.
 * @param {ObjectType} data.objectType - object type.
 * @param {DataType} data.dataType - data type.
 * @param {AccessType} data.accessType - access restrictions.
 * @param {number} data.lowLimit - minimum value.
 * @param {number} data.highLimit - maximum value.
 * @param {boolean} data.pdoMapping - enable PDO mapping.
 * @param {boolean} data.compactSubObj - use the compact sub-object format.
 * @param {number | string | Date} data.defaultValue - default value.
 * @param {number} data.scaleFactor - optional multiplier for numeric types.
 * @fires DataObject#update
 * @see CiA306 "Object descriptions" (§4.6.3)
 */
class DataObject extends EventEmitter {
    constructor(key, data) {
        super();

        Object.assign(this, data);
        this.parent = null;

        this.key = key;
        if (this.key === undefined)
            throw new ReferenceError('key must be defined');

        if (this.parameterName === undefined)
            throw new EdsError('parameterName is mandatory for DataObject');

        if (this.objectType === undefined)
            this.objectType = ObjectType.VAR;

        switch (this.objectType) {
            case ObjectType.DEFTYPE:
            case ObjectType.VAR:
                // Mandatory data
                if (this.dataType === undefined) {
                    throw new EdsError('dataType is mandatory for type '
                        + this.objectTypeString);
                }

                if (this.compactSubObj !== undefined) {
                    throw new EdsError('compactSubObj is not supported for type '
                        + this.objectTypeString);
                }

                // Optional data
                if (this.accessType === undefined)
                    this.accessType = AccessType.READ_WRITE;

                if (this.pdoMapping === undefined)
                    this.pdoMapping = false;

                // Check limits
                if (this.highLimit !== undefined
                    && this.lowLimit !== undefined) {
                    if (this.highLimit < this.lowLimit)
                        throw new EdsError('highLimit may not be less lowLimit');
                }

                // Create raw data buffer
                this._raw = typeToRaw(this.defaultValue, this.dataType);
                break;
            case ObjectType.DEFSTRUCT:
            case ObjectType.ARRAY:
            case ObjectType.RECORD:
                if (this.compactSubObj) {
                    // Mandatory data
                    if (this.dataType === undefined) {
                        throw new EdsError('dataType is mandatory for compact type '
                            + this.objectTypeString);
                    }

                    // Optional data
                    if (this.accessType === undefined)
                        this.accessType = AccessType.READ_WRITE;

                    if (this.pdoMapping === undefined)
                        this.pdoMapping = false;
                }
                else {
                    // Not supported data
                    if (this.dataType !== undefined) {
                        throw new EdsError('dataType is not supported for type '
                            + this.objectTypeString);
                    }

                    if (this.accessType !== undefined) {
                        throw new EdsError('accessType is not supported for type '
                            + this.objectTypeString);
                    }

                    if (this.defaultValue !== undefined) {
                        throw new EdsError('defaultValue is not supported for type '
                            + this.objectTypeString);
                    }

                    if (this.pdoMapping !== undefined) {
                        throw new EdsError('pdoMapping is not supported for type '
                            + this.objectTypeString);
                    }

                    if (this.lowLimit !== undefined) {
                        throw new EdsError('lowLimit is not supported for type '
                            + this.objectTypeString);
                    }

                    if (this.highLimit !== undefined) {
                        throw new EdsError('highLimit is not supported for type '
                            + this.objectTypeString);
                    }
                }

                // Create sub-objects array
                this._subObjects = [];
                Object.defineProperty(this, '_subObjects', {
                    enumerable: false
                });

                // Store max sub index at index 0
                this.addSubObject(0, {
                    parameterName: 'Max sub-index',
                    objectType: ObjectType.VAR,
                    dataType: DataType.UNSIGNED8,
                    accessType: AccessType.READ_WRITE,
                });

                break;

            case ObjectType.DOMAIN:
                // Not supported data
                if (this.pdoMapping !== undefined) {
                    throw new EdsError('pdoMapping is not supported for type '
                        + this.objectTypeString);
                }

                if (this.lowLimit !== undefined) {
                    throw new EdsError('lowLimit is not supported for type '
                        + this.objectTypeString);
                }

                if (this.highLimit !== undefined) {
                    throw new EdsError('highLimit is not supported for type '
                        + this.objectTypeString);
                }

                if (this.compactSubObj !== undefined) {
                    throw new EdsError('compactSubObj is not supported for type '
                        + this.objectTypeString);
                }

                // Optional data
                if (this.dataType === undefined)
                    this.dataType = DataType.DOMAIN;

                if (this.accessType === undefined)
                    this.accessType = AccessType.READ_WRITE;

                break;

            default:
                throw new EdsError(
                    `objectType not supported (${this.objectType})`);
        }
    }

    /**
     * The Eds index.
     *
     * @type {number}
     */
    get index() {
        return parseInt(this.key.split('sub')[0], 16);
    }

    /**
     * The Eds subIndex.
     *
     * @type {number | null}
     */
    get subIndex() {
        const key = this.key.split('sub');
        if (key.length < 2)
            return null;

        return parseInt(key[1], 16);
    }

    /**
     * The object type as a string.
     *
     * @type {string}
     */
    get objectTypeString() {
        switch (this.objectType) {
            case ObjectType.NULL:
                return 'NULL';
            case ObjectType.DOMAIN:
                return 'DOMAIN';
            case ObjectType.DEFTYPE:
                return 'DEFTYPE';
            case ObjectType.DEFSTRUCT:
                return 'DEFSTRUCT';
            case ObjectType.VAR:
                return 'VAR';
            case ObjectType.ARRAY:
                return 'ARRAY';
            case ObjectType.RECORD:
                return 'RECORD';
            default:
                return 'UNKNOWN';
        }
    }

    /**
     * The data type as a string.
     *
     * @type {string}
     */
    get dataTypeString() {
        switch (this.dataType) {
            case DataType.BOOLEAN:
                return 'BOOLEAN';
            case DataType.INTEGER8:
                return 'INTEGER8';
            case DataType.INTEGER16:
                return 'INTEGER16';
            case DataType.INTEGER32:
                return 'INTEGER32';
            case DataType.UNSIGNED8:
                return 'UNSIGNED8';
            case DataType.UNSIGNED16:
                return 'UNSIGNED16';
            case DataType.UNSIGNED32:
                return 'UNSIGNED32';
            case DataType.REAL32:
                return 'REAL32';
            case DataType.VISIBLE_STRING:
                return 'VISIBLE_STRING';
            case DataType.OCTET_STRING:
                return 'OCTET_STRING';
            case DataType.UNICODE_STRING:
                return 'UNICODE_STRING';
            case DataType.TIME_OF_DAY:
                return 'TIME_OF_DAY';
            case DataType.TIME_DIFFERENCE:
                return 'TIME_DIFFERENCE';
            case DataType.DOMAIN:
                return 'DOMAIN';
            case DataType.REAL64:
                return 'REAL64';
            case DataType.INTEGER24:
                return 'INTEGER24';
            case DataType.INTEGER40:
                return 'INTEGER40';
            case DataType.INTEGER48:
                return 'INTEGER48';
            case DataType.INTEGER56:
                return 'INTEGER56';
            case DataType.INTEGER64:
                return 'INTEGER64';
            case DataType.UNSIGNED24:
                return 'UNSIGNED24';
            case DataType.UNSIGNED40:
                return 'UNSIGNED40';
            case DataType.UNSIGNED48:
                return 'UNSIGNED48';
            case DataType.UNSIGNED56:
                return 'UNSIGNED56';
            case DataType.UNSIGNED64:
                return 'UNSIGNED64';
            case DataType.PDO_PARAMETER:
                return 'PDO_PARAMETER';
            case DataType.PDO_MAPPING:
                return 'PDO_MAPPING';
            case DataType.SDO_PARAMETER:
                return 'SDO_PARAMETER';
            case DataType.IDENTITY:
                return 'IDENTITY';
            default:
                return 'UNKNOWN';
        }
    }

    /**
     * Size of the raw data in bytes including sub-entries.
     *
     * @type {number}
     */
    get size() {
        if (!this.subNumber)
            return this.raw.length;

        let size = 0;
        for (let i = 1; i <= this._subObjects[0].value; ++i) {
            if (this._subObjects[i] === undefined)
                continue;

            size += this._subObjects[i].size;
        }

        return size;
    }

    /**
     * The raw data Buffer.
     *
     * @type {Buffer}
     */
    get raw() {
        if (!this.subNumber)
            return this._raw;

        const data = [];
        for (let i = 1; i <= this._subObjects[0].value; ++i) {
            if (this._subObjects[i] === undefined)
                continue;

            data.push(this._subObjects[i].raw);
        }

        return data;
    }

    set raw(raw) {
        if (this.subNumber) {
            throw new EdsError('not supported for type '
                + this.objectTypeString);
        }

        if (raw === undefined || raw === null)
            raw = typeToRaw(0, this.dataType);

        if(this.raw && Buffer.compare(raw, this.raw) == 0)
            return;

        this._raw = raw;
        this._emitUpdate();
    }

    /**
     * The cooked value.
     *
     * @type {number | bigint | string | Date}
     * @see {@link Eds.typeToRaw}
     */
    get value() {
        if (!this.subNumber)
            return rawToType(this.raw, this.dataType, this.scaleFactor);

        const data = [];
        for (let i = 1; i <= this._subObjects[0].value; ++i) {
            if (this._subObjects[i] === undefined)
                continue;

            data.push(this._subObjects[i].value);
        }

        return data;
    }

    set value(value) {
        if (this.subNumber) {
            throw new EdsError('not supported for type '
                + this.objectTypeString);
        }

        this.raw = typeToRaw(value, this.dataType, this.scaleFactor);
    }

    /**
     * Returns true if the object is an instance of DataObject;
     *
     * @param {*} obj - object to test.
     * @returns {boolean} true if obj is DataObject.
     * @since 6.0.0
     */
    static isDataObject(obj) {
        return obj instanceof DataObject;
    }

    /**
     * Primitive value conversion.
     *
     * @returns {number | bigint | string | Date} DataObject value.
     * @since 6.0.0
     */
    valueOf() {
        return this.value;
    }

    /**
     * Primitive string conversion.
     *
     * @returns {string} DataObject string representation.
     * @since 6.0.0
     */
    toString() {
        return '[' + this.key + ']';
    }

    /**
     * Get a sub-entry.
     *
     * @param {number} index - sub-entry index to get.
     * @returns {DataObject} new DataObject.
     * @since 6.0.0
     */
    at(index) {
        if (!this._subObjects)
            throw new TypeError('not an Array type');

        return this._subObjects[index];
    }

    /**
     * Create or add a new sub-entry.
     *
     * @param {number} subIndex - sub-entry index to add.
     * @param {DataObject | object} data - An existing {@link DataObject} or
     * the data to create one.
     * @returns {DataObject} new DataObject.
     * @see {@link Eds#addSubEntry}
     * @private
     */
    addSubObject(subIndex, data) {
        if (!this._subObjects)
            throw new TypeError('not an Array type');

        const key = this.key + 'sub' + subIndex;
        const entry = new DataObject(key, data);
        entry.parent = this;

        this._subObjects[subIndex] = entry;

        // Allow access to the sub-object using bracket notation
        if (!Object.prototype.hasOwnProperty.call(this, subIndex)) {
            Object.defineProperty(this, subIndex, {
                get: () => this.at(subIndex)
            });
        }

        // Update max sub-index
        if (this._subObjects[0].value < subIndex)
            this._subObjects[0]._raw.writeUInt8(subIndex);

        // Update subNumber
        this.subNumber = 1;
        for (let i = 1; i <= this._subObjects[0].value; ++i) {
            if (this._subObjects[i] !== undefined)
                this.subNumber += 1;
        }

        return entry;
    }

    /**
     * Remove a sub-entry and return it.
     *
     * @param {number} subIndex - sub-entry index to remove.
     * @returns {DataObject} removed DataObject.
     * @see {@link Eds#removeSubEntry}
     * @private
     */
    removeSubObject(subIndex) {
        if (!this._subObjects)
            throw new TypeError('not an Array type');

        const obj = this._subObjects[subIndex];
        delete this._subObjects[subIndex];

        // Update max sub-index
        if (subIndex >= this._subObjects[0].value) {
            // Find the next highest sub-index
            for (let i = subIndex; i >= 0; --i) {
                if (this._subObjects[i] !== undefined) {
                    this._subObjects[0]._raw.writeUInt8(i);
                    break;
                }
            }
        }

        // Update subNumber
        this.subNumber = 1;
        for (let i = 1; i <= this._subObjects[0].value; ++i) {
            if (this._subObjects[i] !== undefined)
                this.subNumber += 1;
        }

        return obj;
    }

    /**
     * Emit the update event.
     *
     * @param {DataObject} [obj] - updated object.
     * @fires DataObject#update
     * @private
     */
    _emitUpdate(obj) {
        if(this.parent) {
            this.parent._emitUpdate(this);
        }
        else {
            /**
             * The DataObject value was changed.
             *
             * @event DataObject#update
             */
            this.emit('update', obj || this);
        }
    }
}

/**
 * A CANopen Electronic Data Sheet.
 *
 * This class provides methods for loading and saving CANopen EDS v4.0 files.
 *
 * @param {object} info - file info.
 * @param {string} info.fileName - file name.
 * @param {string} info.fileVersion - file version.
 * @param {string} info.fileRevision - file revision.
 * @param {string} info.description - What the file is for.
 * @param {Date} info.creationDate - When the file was created.
 * @param {string} info.createdBy - Who created the file.
 * @param {string} info.vendorName - The device vendor name.
 * @param {number} info.vendorNumber - the device vendor number.
 * @param {string} info.productName - the device product name.
 * @param {number} info.productNumber - the device product number.
 * @param {number} info.revisionNumber - the device revision number.
 * @param {string} info.orderCode - the device order code.
 * @param {Array<number>} info.baudRates - supported buadrates
 * @param {boolean} info.lssSupported - true if LSS is supported.
 * @see CiA306 "Electronic data sheet specification for CANopen"
 */
class Eds extends EventEmitter {
    constructor(info = {}) {
        super();

        this.fileInfo = {
            EDSVersion: '4.0'
        };

        this.deviceInfo = {
            SimpleBootUpMaster: 0,
            SimpleBootUpSlave: 0,
            Granularity: 8,
            DynamicChannelsSupported: 0,
            CompactPDO: 0,
            GroupMessaging: 0,
        };

        this.dummyUsage = {};
        this._dataObjects = {};
        this.comments = [];
        this.nameLookup = {};

        if(typeof info === 'object') {
            // fileInfo
            this.fileName = info.fileName || '';
            this.fileVersion = info.fileVersion || 1;
            this.fileRevision = info.fileRevision || 1;
            this.description = info.description || '';
            this.creationDate = info.creationDate || new Date();
            this.createdBy = info.createdBy || 'node-canopen';

            // deviceInfo
            this.vendorName = info.vendorName || '';
            this.vendorNumber = info.vendorNumber || 0;
            this.productName = info.productName || '';
            this.productNumber = info.productNumber || 0;
            this.revisionNumber = info.revisionNumber || 0;
            this.orderCode = info.orderCode || '';
            this.baudRates = info.baudRates || [];
            this.lssSupported = info.lssSupported || false;

            // Add default data types
            for (const [name, index] of Object.entries(DataType)) {
                this.addEntry(index, {
                    parameterName: name,
                    objectType: ObjectType.DEFTYPE,
                    dataType: DataType[name],
                    accessType: AccessType.READ_WRITE,
                });
            }

            // Add mandatory objects (0x1000, 0x1001, 0x1018)
            this.addEntry(0x1000, {
                parameterName: 'Device type',
                objectType: ObjectType.VAR,
                dataType: DataType.UNSIGNED32,
                accessType: AccessType.READ_ONLY,
            });

            this.setErrorRegister(0);

            this.setIdentity({
                vendorId: info.vendorNumber,
                productCode: info.productNumber,
                revisionNumber: info.revisionNumber,
                serialNumber: 0,
            });
        }
        else if(typeof info === 'string') {
            this.load(info);
        }
    }

    /**
     * Constructs and returns the Eds DataObjects keyed by decimal string. This
     * is provided to support old tools. For new code use the new Eds iterator
     * methods (keyed by hex string) instead.
     *
     * @type {object}
     * @deprecated Use {@link Eds#entries} instead.
     */
    get dataObjects() {
        const entries = {};
        for(const entry of this.values())
            entries[entry.index] = entry;

        return entries;
    }

    [Symbol.iterator]() {
        return this.values();
    }

    /**
     * File name.
     *
     * @type {string}
     */
    get fileName() {
        return this.fileInfo['FileName'];
    }

    set fileName(value) {
        this.fileInfo['FileName'] = String(value);
    }

    /**
     * File version (8-bit unsigned integer).
     *
     * @type {number}
     */
    get fileVersion() {
        return this.fileInfo['FileVersion'];
    }

    set fileVersion(value) {
        this.fileInfo['FileVersion'] = Number(value);
    }

    /**
     * File revision (8-bit unsigned integer).
     *
     * @type {number}
     */
    get fileRevision() {
        return this.fileInfo['FileRevision'];
    }

    set fileRevision(value) {
        this.fileInfo['FileRevision'] = Number(value);
    }

    /**
     * File description.
     *
     * @type {string}
     */
    get description() {
        return this.fileInfo['Description'];
    }

    set description(value) {
        this.fileInfo['Description'] = String(value);
    }

    /**
     * File creation time.
     *
     * @type {Date}
     */
    get creationDate() {
        const time = this.fileInfo['CreationTime'];
        const date = this.fileInfo['CreationDate'];
        return parseDate(time, date);
    }

    set creationDate(value) {
        const hours = value.getHours().toString().padStart(2, '0');
        const minutes = value.getMinutes().toString().padStart(2, '0');
        const time = hours + ':' + minutes;

        const month = (value.getMonth() + 1).toString().padStart(2, '0');
        const day = value.getDate().toString().padStart(2, '0');
        const year = value.getFullYear().toString();
        const date = month + '-' + day + '-' + year;

        this.fileInfo['CreationTime'] = time;
        this.fileInfo['CreationDate'] = date;
    }

    /**
     * Name or description of the file creator (max 245 characters).
     *
     * @type {string}
     */
    get createdBy() {
        return this.fileInfo['CreatedBy'];
    }

    set createdBy(value) {
        this.fileInfo['CreatedBy'] = String(value);
    }

    /**
     * Time of the last modification.
     *
     * @type {Date}
     */
    get modificationDate() {
        const time = this.fileInfo['ModificationTime'];
        const date = this.fileInfo['ModificationDate'];
        return parseDate(time, date);
    }

    set modificationDate(value) {
        const hours = value.getHours().toString().padStart(2, '0');
        const minutes = value.getMinutes().toString().padStart(2, '0');
        const time = hours + ':' + minutes;

        const month = (value.getMonth() + 1).toString().padStart(2, '0');
        const day = value.getDate().toString().padStart(2, '0');
        const year = value.getFullYear().toString();
        const date = month + '-' + day + '-' + year;

        this.fileInfo['ModificationTime'] = time;
        this.fileInfo['ModificationDate'] = date;
    }

    /**
     * Name or description of the last modifier (max 244 characters).
     *
     * @type {string}
     */
    get modifiedBy() {
        return this.fileInfo['ModifiedBy'];
    }

    set modifiedBy(value) {
        this.fileInfo['ModifiedBy'] = String(value);
    }

    /**
     * Vendor name (max 244 characters).
     *
     * @type {string}
     */
    get vendorName() {
        return this.deviceInfo['VendorName'];
    }

    set vendorName(value) {
        this.deviceInfo['VendorName'] = String(value);
    }

    /**
     * Unique vendor ID (32-bit unsigned integer).
     *
     * @type {number}
     */
    get vendorNumber() {
        return this.deviceInfo['VendorNumber'];
    }

    set vendorNumber(value) {
        this.deviceInfo['VendorNumber'] = Number(value);
    }

    /**
     * Product name (max 243 characters).
     *
     * @type {string}
     */
    get productName() {
        return this.deviceInfo['ProductName'];
    }

    set productName(value) {
        this.deviceInfo['ProductName'] = String(value);
    }

    /**
     * Product code (32-bit unsigned integer).
     *
     * @type {number}
     */
    get productNumber() {
        return this.deviceInfo['ProductNumber'];
    }

    set productNumber(value) {
        this.deviceInfo['ProductNumber'] = Number(value);
    }

    /**
     * Revision number (32-bit unsigned integer).
     *
     * @type {number}
     */
    get revisionNumber() {
        return this.deviceInfo['RevisionNumber'];
    }

    set revisionNumber(value) {
        this.deviceInfo['RevisionNumber'] = Number(value);
    }

    /**
     * Product order code (max 245 characters).
     *
     * @type {string}
     */
    get orderCode() {
        return this.deviceInfo['OrderCode'];
    }

    set orderCode(value) {
        this.deviceInfo['OrderCode'] = String(value);
    }

    /**
     * Supported baud rates.
     *
     * @type {Array<number>}
     */
    get baudRates() {
        let rates = [];

        if (parseInt(this.deviceInfo['BaudRate_10']))
            rates.push(10000);
        if (parseInt(this.deviceInfo['BaudRate_20']))
            rates.push(20000);
        if (parseInt(this.deviceInfo['BaudRate_50']))
            rates.push(50000);
        if (parseInt(this.deviceInfo['BaudRate_125']))
            rates.push(125000);
        if (parseInt(this.deviceInfo['BaudRate_250']))
            rates.push(250000);
        if (parseInt(this.deviceInfo['BaudRate_500']))
            rates.push(500000);
        if (parseInt(this.deviceInfo['BaudRate_800']))
            rates.push(800000);
        if (parseInt(this.deviceInfo['BaudRate_1000']))
            rates.push(1000000);

        return rates;
    }

    set baudRates(rates) {
        this.deviceInfo['BaudRate_10'] = rates.includes(10000) ? '1' : '0';
        this.deviceInfo['BaudRate_20'] = rates.includes(20000) ? '1' : '0';
        this.deviceInfo['BaudRate_50'] = rates.includes(50000) ? '1' : '0';
        this.deviceInfo['BaudRate_125'] = rates.includes(125000) ? '1' : '0';
        this.deviceInfo['BaudRate_250'] = rates.includes(250000) ? '1' : '0';
        this.deviceInfo['BaudRate_500'] = rates.includes(500000) ? '1' : '0';
        this.deviceInfo['BaudRate_800'] = rates.includes(800000) ? '1' : '0';
        this.deviceInfo['BaudRate_1000'] = rates.includes(1e6) ? '1' : '0';
    }

    /**
     * Indicates simple boot-up master functionality (not supported).
     *
     * @type {boolean}
     */
    get simpleBootUpMaster() {
        return !!parseInt(this.deviceInfo['SimpleBootUpMaster']);
    }

    set simpleBootUpMaster(value) {
        this.deviceInfo['SimpleBootUpMaster'] = (value) ? 1 : 0;
    }

    /**
     * Indicates simple boot-up slave functionality (not supported).
     *
     * @type {boolean}
     */
    get simpleBootUpSlave() {
        return !!parseInt(this.deviceInfo['SimpleBootUpSlave']);
    }

    set simpleBootUpSlave(value) {
        this.deviceInfo['SimpleBootUpSlave'] = (value) ? 1 : 0;
    }

    /**
     * Provides the granularity allowed for the mapping on this device - most
     * devices support a granularity of 8. (8-bit integer, max 64).
     *
     * @type {number}
     */
    get granularity() {
        return parseInt(this.deviceInfo['Granularity']);
    }

    set granularity(value) {
        this.deviceInfo['Granularity'] = value;
    }

    /**
     * Indicates the facility of dynamic variable generation (not supported).
     *
     * @type {boolean}
     * @see CiA302
     */
    get dynamicChannelsSupported() {
        return !!parseInt(this.deviceInfo['DynamicChannelsSupported']);
    }

    set dynamicChannelsSupported(value) {
        this.deviceInfo['DynamicChannelsSupported'] = (value) ? 1 : 0;
    }

    /**
     * Indicates the facility of multiplexed PDOs (not supported).
     *
     * @type {boolean}
     * @see CiA301
     */
    get groupMessaging() {
        return !!parseInt(this.deviceInfo['GroupMessaging']);
    }

    set groupMessaging(value) {
        this.deviceInfo['GroupMessaging'] = (value) ? 1 : 0;
    }

    /**
     * The number of supported receive PDOs (16-bit unsigned integer).
     *
     * @type {number}
     */
    get nrOfRXPDO() {
        let count = 0;
        for (let index of Object.keys(this._dataObjects)) {
            index = parseInt(index, 16);
            if (index >= 0x1400 && index <= 0x15FF)
                count++;
        }

        return count;
    }

    /**
     * The number of supported transmit PDOs (16-bit unsigned integer).
     *
     * @type {number}
     */
    get nrOfTXPDO() {
        let count = 0;
        for (let index of Object.keys(this._dataObjects)) {
            index = parseInt(index, 16);
            if (index >= 0x1800 && index <= 0x19FF)
                count++;
        }

        return count;
    }

    /**
     * Indicates if LSS functionality is supported.
     *
     * @type {boolean}
     */
    get lssSupported() {
        return !!(this.deviceInfo['LSS_Supported']);
    }

    set lssSupported(value) {
        this.deviceInfo['LSS_Supported'] = (value) ? 1 : 0;
    }

    /**
     * Returns true if the object is an instance of Eds.
     *
     * @param {object} obj - object to test.
     * @returns {boolean} true if obj is Eds.
     * @since 6.0.0
     */
    static isEds(obj) {
        return obj instanceof Eds;
    }

    /**
     * Create a new Eds from a file path.
     *
     * @param {string} path - path to file.
     * @returns {Eds} new Eds object.
     * @since 6.0.0
     */
    static fromFile(path) {
        const eds = new Eds();
        eds.load(path);
        return eds;
    }

    /**
     * Read and parse an EDS file.
     *
     * @param {string} path - path to file.
     */
    load(path) {
        // Parse EDS file
        const file = ini.parse(fs.readFileSync(path, 'utf-8'));

        // Clear existing entries
        this._dataObjects = {};
        this.nameLookup = {};

        // Extract header fields
        this.fileInfo = file['FileInfo'];
        this.deviceInfo = file['DeviceInfo'];
        this.dummyUsage = file['DummyUsage'];
        this.comments = file['Comments'];

        // Construct data objects.
        const entries = Object.entries(file);
        const indexMatch = RegExp('^[0-9A-Fa-f]{4}$');
        const subIndexMatch = RegExp('^([0-9A-Fa-f]{4})sub([0-9A-Fa-f]+)$');

        entries
            .filter(([key]) => {
                return indexMatch.test(key);
            })
            .forEach(([key, data]) => {
                const index = parseInt(key, 16);
                this.addEntry(index, edsToEntry(data));
            });

        entries
            .filter(([key]) => {
                return subIndexMatch.test(key);
            })
            .forEach(([key, data]) => {
                let [index, subIndex] = key.split('sub');
                index = parseInt(index, 16);
                subIndex = parseInt(subIndex, 16);
                this.addSubEntry(index, subIndex, edsToEntry(data));
            });
    }

    /**
     * Write an EDS file.
     *
     * @param {string} path - path to file, defaults to fileName.
     * @param {object} [options] - optional inputs.
     * @param {Date} [options.modificationDate] - file modification date to file.
     * @param {Date} [options.modifiedBy] - file modification date to file.
     */
    save(path, options = {}) {
        if (!path)
            path = this.fileName;

        this.modificationDate = options.modificationDate || new Date();
        this.modifiedBy = options.modifiedBy || '';

        this.deviceInfo['NrOfTXPDO'] = this.nrOfTXPDO;
        this.deviceInfo['NrOfRXPDO'] = this.nrOfRXPDO;

        const fd = fs.openSync(path, 'w');

        // Write header fields
        this._write(fd, ini.encode(this.fileInfo, { section: 'FileInfo' }));
        this._write(fd, ini.encode(this.deviceInfo, { section: 'DeviceInfo' }));
        this._write(fd, ini.encode(this.dummyUsage, { section: 'DummyUsage' }));
        this._write(fd, ini.encode(this.comments, { section: 'Comments' }));

        // Sort data objects
        let mandObjects = {};
        let mandCount = 0;

        let optObjects = {};
        let optCount = 0;

        let mfrObjects = {};
        let mfrCount = 0;

        for (const key of this.keys()) {
            let index = parseInt(key, 16);

            if ([0x1000, 0x1001, 0x1018].includes(index)) {
                mandCount += 1;
                mandObjects[mandCount] = '0x' + key;
            }
            else if (index >= 0x1000 && index < 0x1FFF) {
                optCount += 1;
                optObjects[optCount] = '0x' + key;
            }
            else if (index >= 0x2000 && index < 0x5FFF) {
                mfrCount += 1;
                mfrObjects[mfrCount] = '0x' + key;
            }
            else if (index >= 0x6000 && index < 0xFFFF) {
                optCount += 1;
                optObjects[optCount] = '0x' + key;
            }
        }

        // Write data objects
        mandObjects['SupportedObjects'] = mandCount;
        this._write(fd, ini.encode(mandObjects, { section: 'MandatoryObjects' }));

        this._writeObjects(fd, mandObjects);

        optObjects['SupportedObjects'] = optCount;
        this._write(fd, ini.encode(optObjects, { section: 'OptionalObjects' }));

        this._writeObjects(fd, optObjects);

        mfrObjects['SupportedObjects'] = mfrCount;
        this._write(fd, ini.encode(
            mfrObjects, { section: 'ManufacturerObjects' }));

        this._writeObjects(fd, mfrObjects);

        fs.closeSync(fd);
    }

    /**
     * Returns a new iterator object that iterates the keys for each entry.
     *
     * @returns {Iterable.<string>} Iterable keys.
     * @since 6.0.0
     */
    keys() {
        return Object.keys(this._dataObjects).values();
    }

    /**
     * Returns a new iterator object that iterates DataObjects.
     *
     * @returns {Iterable.<DataObject>} Iterable DataObjects.
     * @since 6.0.0
     */
    values() {
        return Object.values(this._dataObjects).values();
    }

    /**
     * Returns a new iterator object that iterates key/DataObjects pairs.
     *
     * @returns {Iterable.<Array>} Iterable [key, DataObjects].
     * @since 6.0.0
     */
    entries() {
        return Object.entries(this._dataObjects).values();
    }

    /**
     * Reset objects to their default values.
     *
     * @since 6.0.0
     */
    reset() {
        for (const entry of this.values()) {
            if(entry.objectType === ObjectType.VAR)
                entry.value = entry.defaultValue;
        }
    }

    /**
     * Get a data object by name.
     *
     * @param {string} name - name of the data object.
     * @returns {Array<DataObject>} - all entries matching name.
     * @since 6.0.0
     */
    findEntry(name) {
        let result = this.nameLookup[name];
        if (result !== undefined)
            return result;

        return [];
    }

    /**
     * Get a data object by index.
     *
     * @param {number} index - index of the data object.
     * @returns {DataObject | null} - entry matching index.
     */
    getEntry(index) {
        let entry = null;
        if (typeof index === 'string') {
            // Name lookup
            entry = this.findEntry(index);
            if (entry.length > 1)
                throw new EdsError('duplicate entry');

            entry = entry[0];
        }
        else {
            // Index lookup.
            const key = index.toString(16).padStart(4, '0');
            entry = this._dataObjects[key];
        }

        return entry;
    }

    /**
     * Create a new entry.
     *
     * @param {number} index - index of the data object.
     * @param {object} data - data passed to the {@link DataObject} constructor.
     * @returns {DataObject} - the newly created entry.
     * @fires Eds#newEntry
     */
    addEntry(index, data) {
        if(typeof index !== 'number')
            throw new TypeError('index must be a number');

        const key = index.toString(16).padStart(4, '0');
        if (this._dataObjects[key] !== undefined)
            throw new EdsError(`${key} already exists`);

        const entry = new DataObject(key, data);

        /**
         * A DataObject was added to the Eds.
         *
         * @event Eds#newEntry
         * @type {DataObject}
         */
        this.emit('newEntry', entry);

        this._dataObjects[key] = entry;

        if (this.nameLookup[entry.parameterName] === undefined)
            this.nameLookup[entry.parameterName] = [];

        this.nameLookup[entry.parameterName].push(entry);

        return entry;
    }

    /**
     * Delete an entry.
     *
     * @param {number} index - index of the data object.
     * @returns {DataObject} the deleted entry.
     * @fires Eds#removeEntry
     */
    removeEntry(index) {
        const entry = this.getEntry(index);
        if (entry === undefined)
            throw new EdsError(`${index.toString(16)} does not exist`);

        this.nameLookup[entry.parameterName].splice(
            this.nameLookup[entry.parameterName].indexOf(entry), 1);

        if (this.nameLookup[entry.parameterName].length == 0)
            delete this.nameLookup[entry.parameterName];

        delete this._dataObjects[entry.key];

        /**
         * A DataObject was removed from the Eds.
         *
         * @event Eds#removeEntry
         * @type {DataObject}
         */
        this.emit('removeEntry', entry);

        return entry;
    }

    /**
     * Get a sub-entry.
     *
     * @param {number | string} index - index or name of the data object.
     * @param {number} subIndex - subIndex of the data object.
     * @returns {DataObject | null} - the sub-entry or null.
     */
    getSubEntry(index, subIndex) {
        const entry = this.getEntry(index);

        if (entry === undefined)
            throw new EdsError(`${index.toString(16)} does not exist`);

        if (entry.subNumber === undefined) {
            throw new EdsError(
                `${index.toString(16)} does not support sub objects`);
        }

        return entry[subIndex] || null;
    }

    /**
     * Create a new sub-entry.
     *
     * @param {number} index - index of the data object.
     * @param {number} subIndex - subIndex of the data object.
     * @param {object} data - data passed to the {@link DataObject} constructor.
     * @returns {DataObject} - the newly created sub-entry.
     */
    addSubEntry(index, subIndex, data) {
        const entry = this.getEntry(index);
        if (entry === undefined)
            throw new EdsError(`${index.toString(16)} does not exist`);

        if (entry.subNumber === undefined) {
            throw new EdsError(
                `${index.toString(16)} does not support sub objects`);
        }

        // Add the new entry
        return entry.addSubObject(subIndex, data);
    }

    /**
     * Delete a sub-entry.
     *
     * @param {number} index - index of the data object.
     * @param {number} subIndex - subIndex of the data object.
     */
    removeSubEntry(index, subIndex) {
        const entry = this.getEntry(index);
        if (subIndex < 1)
            throw new EdsError('subIndex must be >= 1');

        if (entry === undefined)
            throw new EdsError(`${index.toString(16)} does not exist`);

        if (entry.subNumber === undefined) {
            throw new EdsError(
                `${index.toString(16)} does not support sub objects`);
        }

        if (entry[subIndex] === undefined)
            return;

        // Delete the entry
        entry.removeSubObject(subIndex);
    }

    /**
     * Get object 0x1001 - Error register.
     *
     * @returns {number} error register value.
     * @since 6.0.0
     */
    getErrorRegister() {
        const obj1001 = this.getEntry(0x1001);
        if (obj1001)
            return obj1001.value;

        return null;
    }

    /**
     * Set object 0x1001 - Error register.
     * - bit 0 - Generic error.
     * - bit 1 - Current.
     * - bit 2 - Voltage.
     * - bit 3 - Temperature.
     * - bit 4 - Communication error.
     * - bit 5 - Device profile specific.
     * - bit 6 - Reserved (always 0).
     * - bit 7 - Manufacturer specific.
     *
     * @param {number | object} flags - error flags.
     * @param {boolean} flags.generic - generic error.
     * @param {boolean} flags.current - current error.
     * @param {boolean} flags.voltage - voltage error.
     * @param {boolean} flags.temperature - temperature error.
     * @param {boolean} flags.communication - communication error.
     * @param {boolean} flags.device - device profile specific error.
     * @param {boolean} flags.manufacturer - manufacturer specific error.
     * @since 6.0.0
     */
    setErrorRegister(flags) {
        let obj1001 = this.getEntry(0x1001);
        if (obj1001 === undefined) {
            obj1001 = this.addEntry(0x1001, {
                parameterName: 'Error register',
                objectType: ObjectType.VAR,
                dataType: DataType.UNSIGNED8,
                accessType: AccessType.READ_ONLY,
            });
        }

        if (typeof flags !== 'object') {
            obj1001.value = flags;
        }
        else {
            let value = obj1001.value;
            if (flags.generic !== undefined) {
                if (flags.generic)
                    value |= (1 << 0);
                else
                    value &= ~(1 << 0);
            }

            if (flags.current !== undefined) {
                if (flags.current)
                    value |= (1 << 1);
                else
                    value &= ~(1 << 1);
            }

            if (flags.voltage !== undefined) {
                if (flags.voltage)
                    value |= (1 << 2);
                else
                    value &= ~(1 << 2);
            }

            if (flags.temperature !== undefined) {
                if (flags.temperature)
                    value |= (1 << 3);
                else
                    value &= ~(1 << 3);
            }

            if (flags.communication !== undefined) {
                if (flags.communication)
                    value |= (1 << 4);
                else
                    value &= ~(1 << 4);
            }

            if (flags.device !== undefined) {
                if (flags.device)
                    value |= (1 << 5);
                else
                    value &= ~(1 << 5);
            }

            if (flags.manufacturer !== undefined) {
                if (flags.manufacturer)
                    value |= (1 << 7);
                else
                    value &= ~(1 << 7);
            }

            obj1001.value = value;
        }
    }

    /**
     * Get object 0x1002 - Manufacturer status register.
     *
     * @returns {number} status register value.
     * @since 6.0.0
     */
    getStatusRegister() {
        const obj1002 = this.getEntry(0x1002);
        if (obj1002)
            return obj1002.value;

        return null;
    }

    /**
     * Set object 0x1002 - Manufacturer status register.
     *
     * @param {number} status - status register.
     * @param {object} [options] - DataObject creation options.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setStatusRegister(status, options = {}) {
        let obj1002 = this.getEntry(0x1002);
        if (obj1002 === undefined) {
            obj1002 = this.addEntry(0x1002, {
                parameterName: 'Manufacturer status register',
                objectType: ObjectType.VAR,
                dataType: DataType.UNSIGNED32,
                accessType: AccessType.READ_ONLY,
            });
        }

        obj1002.value = status;
        if (options.saveDefault)
            obj1002.defaultValue = obj1002.value;
    }

    /**
     * Get object 0x1003 - Pre-defined error field.
     *
     * @returns {Array<object>} [{ code, info } ... ]
     * @since 6.0.0
     */
    getErrorHistory() {
        const history = [];

        const obj1003 = this.getEntry(0x1003);
        if (obj1003) {
            const maxSubIndex = obj1003[0].value;
            for (let i = 1; i <= maxSubIndex; ++i) {
                const subObj = obj1003.at(i);
                const code = subObj.raw.readUInt16LE(0);
                const info = subObj.raw.readUInt16LE(2);

                if (code)
                    history.push({ code, info });
            }
        }

        return history;

    }

    /**
     * Push an entry to object 0x1003 - Pre-defined error field.
     * - bit 0..15 - Error code.
     * - bit 16..31 - Additional info.
     *
     * @param {number} code - error code.
     * @param {Buffer | number} info - error info (2 bytes).
     * @since 6.0.0
     */
    pushErrorHistory(code, info) {
        const obj1003 = this.getEntry(0x1003);
        if (!obj1003)
            throw new EdsError();

        const maxSubIndex = obj1003[0].value;
        if (maxSubIndex > 1) {
            // Shift buffers
            for (let i = maxSubIndex; i > 1; --i)
                obj1003.at(i).raw = obj1003.at(i - 1).raw;

        }

        // Write new value to sub-index 1
        const raw = Buffer.alloc(4);
        raw.writeUInt16LE(code, 0);
        if (info) {
            if (typeof info === 'number') {
                raw.writeUInt16LE(info, 2);
            }
            else {
                if (!Buffer.isBuffer(info))
                    info = Buffer.from(info);

                info.copy(raw, 2);
            }
        }

        obj1003.at(1).raw = raw;
    }

    /**
     * Configures the length of 0x1003 - Pre-defined error field.
     *
     * @param {number} length - how many historical error events should be kept.
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @since 6.0.0
     */
    setErrorHistoryLength(length, options = {}) {
        if (length === undefined || length < 0)
            throw new EdsError('error field size must >= 0');

        let obj1003 = this.getEntry(0x1003);
        if (obj1003 === undefined) {
            obj1003 = this.addEntry(0x1003, {
                parameterName: 'Pre-defined error field',
                objectType: ObjectType.ARRAY,
            });
        }

        while (length < obj1003.subNumber - 1) {
            // Remove extra entries
            this.removeSubEntry(0x1003, obj1003.subNumber - 1);
        }

        while (length > obj1003.subNumber - 1) {
            // Add new entries
            const index = obj1003.subNumber;
            this.addSubEntry(0x1003, index, {
                parameterName: `Standard error field ${index}`,
                dataType: DataType.UNSIGNED32,
                accessType: options.accessType || AccessType.READ_WRITE,
            });
        }
    }

    /**
     * Get object 0x1005 - COB-ID SYNC.
     *
     * @returns {number} Sync COB-ID.
     * @since 6.0.0
     */
    getSyncCobId() {
        const obj1005 = this.getEntry(0x1005);
        if (obj1005)
            return obj1005.raw.readUInt16LE() & 0x7FF;

        return null;
    }

    /**
     * Set object 0x1005 - COB-ID SYNC.
     *
     * @param {number} cobId - Sync COB-ID (typically 0x80).
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setSyncCobId(cobId, options = {}) {
        if (!cobId)
            throw new EdsError('COB-ID SYNC may not be 0');

        let obj1005 = this.getEntry(0x1005);
        if (!obj1005) {
            obj1005 = this.addEntry(0x1005, {
                dataType: DataType.UNSIGNED32,
                parameterName: 'COB-ID SYNC',
                accessType: options.accessType || AccessType.READ_WRITE,
            });
        }

        const raw = Buffer.from(obj1005.raw);
        raw.writeUInt16LE(cobId & 0x7FF);

        obj1005.raw = raw;
        if (options.saveDefault)
            obj1005.defaultValue = obj1005.value;
    }

    /**
     * Get object 0x1005 [bit 30] - Sync generation enable.
     *
     * @returns {boolean} Sync generation enable.
     * @since 6.0.0
     */
    getSyncGenerationEnable() {
        const obj1005 = this.getEntry(0x1005);
        if (obj1005 && (obj1005.raw[3] & (1 << 6)))
            return true;

        return false;
    }

    /**
     * Set object 0x1005 [bit 30] - Sync generation enable.
     *
     * @param {boolean} enable - Sync generation enable.
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setSyncGenerationEnable(enable, options = {}) {
        let obj1005 = this.getEntry(0x1005);
        if (!obj1005) {
            obj1005 = this.addEntry(0x1005, {
                dataType: DataType.UNSIGNED32,
                parameterName: 'COB-ID SYNC',
                accessType: options.accessType || AccessType.READ_WRITE,
            });
        }

        const raw = Buffer.from(obj1005.raw);
        if (enable)
            raw[3] |= (1 << 6);
        else
            raw[3] &= ~(1 << 6);

        obj1005.raw = raw;
        if (options.saveDefault)
            obj1005.defaultValue = obj1005.value;
    }

    /**
     * Get object 0x1006 - Communication cycle period.
     *
     * @returns {number} Sync interval in μs.
     * @since 6.0.0
     */
    getSyncCyclePeriod() {
        const obj1006 = this.getEntry(0x1006);
        if (obj1006)
            return obj1006.value;

        return null;
    }

    /**
     * Set object 0x1006 - Communication cycle period.
     *
     * @param {number} cyclePeriod - communication cycle period.
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setSyncCyclePeriod(cyclePeriod, options = {}) {
        if (!cyclePeriod)
            throw new EdsError('communication cycle period may not be 0');

        let obj1006 = this.getEntry(0x1006);
        if (!obj1006) {
            obj1006 = this.addEntry(0x1006, {
                dataType: DataType.UNSIGNED32,
                parameterName: 'Communication cycle period',
                accessType: options.accessType || AccessType.READ_WRITE,
            });
        }

        obj1006.value = cyclePeriod;
        if (options.saveDefault)
            obj1006.defaultValue = cyclePeriod;
    }

    /**
     * Get object 0x1008 - Manufacturer device name.
     *
     * @returns {string} device name.
     * @since 6.0.0
     */
    getDeviceName() {
        const obj1008 = this.getEntry(0x1008);
        if (obj1008)
            return obj1008.value;

        return '';
    }

    /**
     * Set object 0x1008 - Manufacturer device name.
     *
     * @param {string} name - device name.
     * @param {object} [options] - DataObject creation options.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setDeviceName(name, options = {}) {
        let obj1008 = this.getEntry(0x1008);
        if (obj1008 === undefined) {
            obj1008 = this.addEntry(0x1008, {
                parameterName: 'Manufacturer device name',
                objectType: ObjectType.VAR,
                dataType: DataType.VISIBLE_STRING,
                accessType: AccessType.CONSTANT,
            });
        }

        obj1008.value = name;
        if (options.saveDefault)
            obj1008.defaultValue = name;
    }

    /**
     * Get object 0x1009 - Manufacturer hardware version.
     *
     * @returns {string} hardware version.
     * @since 6.0.0
     */
    getHardwareVersion() {
        const obj1009 = this.getEntry(0x1009);
        if (obj1009)
            return obj1009.value;

        return '';
    }

    /**
     * Set object 0x1009 - Manufacturer hardware version.
     *
     * @param {string} version - device hardware version.
     * @param {object} [options] - DataObject creation options.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setHardwareVersion(version, options = {}) {
        let obj1009 = this.getEntry(0x1009);
        if (obj1009 === undefined) {
            obj1009 = this.addEntry(0x1009, {
                parameterName: 'Manufacturer hardware version',
                objectType: ObjectType.VAR,
                dataType: DataType.VISIBLE_STRING,
                accessType: AccessType.CONSTANT,
            });
        }

        obj1009.value = version;
        if (options.saveDefault)
            obj1009.defaultValue = version;
    }

    /**
     * Get object 0x100A - Manufacturer software version.
     *
     * @returns {string} software version.
     * @since 6.0.0
     */
    getSoftwareVersion() {
        const obj100A = this.getEntry(0x100A);
        if (obj100A)
            return obj100A.value;

        return '';
    }

    /**
     * Set object 0x100A - Manufacturer software version.
     *
     * @param {string} version - device software version.
     * @param {object} [options] - DataObject creation options.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setSoftwareVersion(version, options = {}) {
        let obj100A = this.getEntry(0x100A);
        if (obj100A === undefined) {
            obj100A = this.addEntry(0x100A, {
                parameterName: 'Manufacturer software version',
                objectType: ObjectType.VAR,
                dataType: DataType.VISIBLE_STRING,
                accessType: AccessType.CONSTANT,
            });
        }

        obj100A.value = version;
        if (options.saveDefault)
            obj100A.defaultValue = version;
    }

    /**
     * Get object 0x1012 - COB-ID TIME.
     *
     * @returns {number} Time COB-ID.
     * @since 6.0.0
     */
    getTimeCobId() {
        const obj1012 = this.getEntry(0x1012);
        if (obj1012)
            return obj1012.raw.readUInt16LE() & 0x7FF;

        return null;
    }

    /**
     * Set object 0x1012 - COB-ID TIME.
     *
     * @param {number} cobId - Time COB-ID (typically 0x100).
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setTimeCobId(cobId, options = {}) {
        if (!cobId)
            throw new EdsError('COB-ID TIME may not be 0');

        let obj1012 = this.getEntry(0x1012);
        if (!obj1012) {
            obj1012 = this.addEntry(0x1012, {
                dataType: DataType.UNSIGNED32,
                parameterName: 'COB-ID TIME',
                accessType: options.accessType || AccessType.READ_WRITE,
            });
        }

        const raw = Buffer.from(obj1012.raw);
        raw.writeUInt16LE(cobId & 0x7FF);

        obj1012.raw = raw;
        if (options.saveDefault)
            obj1012.defaultValue = obj1012.value;
    }

    /**
     * Get object 0x1012 [bit 30] - Time producer enable.
     *
     * @returns {boolean} Time producer enable.
     * @since 6.0.0
     */
    getTimeProducerEnable() {
        const obj1012 = this.getEntry(0x1012);
        if (obj1012 && (obj1012.raw[3] & (1 << 6)))
            return true;

        return false;
    }

    /**
     * Set object 0x1012 [bit 30] - Time producer enable.
     *
     * @param {boolean} enable - Time producer enable.
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setTimeProducerEnable(enable, options = {}) {
        let obj1012 = this.getEntry(0x1012);
        if (!obj1012) {
            obj1012 = this.addEntry(0x1012, {
                dataType: DataType.UNSIGNED32,
                parameterName: 'COB-ID TIME',
                accessType: options.accessType || AccessType.READ_WRITE,
            });
        }

        const raw = Buffer.from(obj1012.raw);
        if (enable)
            raw[3] |= (1 << 6);
        else
            raw[3] &= ~(1 << 6);

        obj1012.raw = raw;
        if (options.saveDefault)
            obj1012.defaultValue = obj1012.value;
    }

    /**
     * Get object 0x1012 [bit 31] - Time consumer enable.
     *
     * @returns {boolean} Time consumer enable.
     * @since 6.0.0
     */
    getTimeConsumerEnable() {
        const obj1012 = this.getEntry(0x1012);
        if (obj1012 && (obj1012.raw[3] & (1 << 7)))
            return true;

        return false;
    }

    /**
     * Set object 0x1012 [bit 31] - Time consumer enable.
     *
     * @param {boolean} enable - Time consumer enable.
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setTimeConsumerEnable(enable, options = {}) {
        let obj1012 = this.getEntry(0x1012);
        if (!obj1012) {
            obj1012 = this.addEntry(0x1012, {
                dataType: DataType.UNSIGNED32,
                parameterName: 'COB-ID TIME',
                accessType: options.accessType || AccessType.READ_WRITE,
            });
        }

        const raw = Buffer.from(obj1012.raw);
        if (enable)
            raw[3] |= (1 << 7);
        else
            raw[3] &= ~(1 << 7);

        obj1012.raw = raw;
        if (options.saveDefault)
            obj1012.defaultValue = obj1012.value;
    }

    /**
     * Get object 0x1014 - COB-ID EMCY.
     *
     * @returns {number} Emcy COB-ID.
     * @since 6.0.0
     */
    getEmcyCobId() {
        const obj1014 = this.getEntry(0x1014);
        if (obj1014)
            return obj1014.raw.readUInt16LE() & 0x7FF;

        return null;
    }

    /**
     * Set object 0x1014 - COB-ID EMCY.
     *
     * @param {number} cobId - Emcy COB-ID.
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setEmcyCobId(cobId, options = {}) {
        let obj1014 = this.getEntry(0x1014);
        if (!obj1014) {
            obj1014 = this.addEntry(0x1014, {
                dataType: DataType.UNSIGNED32,
                parameterName: 'COB-ID EMCY',
                accessType: options.accessType || AccessType.READ_WRITE,
            });
        }

        const raw = Buffer.from(obj1014.raw);
        raw.writeUInt16LE(cobId & 0x7FF);

        obj1014.raw = raw;
        if (options.saveDefault)
            obj1014.defaultValue = obj1014.value;
    }

    /**
     * Get object 0x1014 [bit 31] - EMCY valid.
     *
     * @returns {boolean} Emcy valid.
     * @since 6.0.0
     */
    getEmcyValid() {
        const obj1014 = this.getEntry(0x1014);
        if (obj1014 && !(obj1014.raw[3] & (1 << 7)))
            return true;

        return false;
    }

    /**
     * Set object 0x1014 [bit 31] - EMCY valid.
     *
     * @param {number} valid - Emcy valid.
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setEmcyValid(valid, options = {}) {
        let obj1014 = this.getEntry(0x1014);
        if (!obj1014) {
            obj1014 = this.addEntry(0x1014, {
                dataType: DataType.UNSIGNED32,
                parameterName: 'COB-ID EMCY',
                accessType: options.accessType || AccessType.READ_WRITE,
            });
        }

        const raw = Buffer.from(obj1014.raw);
        if (valid)
            raw[3] |= (1 << 7);
        else
            raw[3] &= ~(1 << 7);

        obj1014.raw = raw;
        if (options.saveDefault)
            obj1014.defaultValue = obj1014.value;
    }

    /**
     * Get object 0x1015 - Inhibit time EMCY.
     *
     * @returns {number} Emcy inhibit time in 100 μs.
     * @since 6.0.0
     */
    getEmcyInhibitTime() {
        const obj1015 = this.getEntry(0x1015);
        if (obj1015)
            return obj1015.value;

        return null;
    }

    /**
     * Set object 0x1015 - Inhibit time EMCY.
     *
     * @param {number} inhibitTime - inhibit time in multiples of 100 μs.
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setEmcyInhibitTime(inhibitTime, options = {}) {
        let obj1015 = this.getEntry(0x1015);
        if (!obj1015) {
            obj1015 = this.addEntry(0x1015, {
                dataType: DataType.UNSIGNED16,
                parameterName: 'Inhibit time EMCY',
                accessType: options.accessType || AccessType.READ_WRITE,
            });
        }

        obj1015.value = inhibitTime;
        if (options.saveDefault)
            obj1015.defaultValue = inhibitTime;
    }

    /**
     * Get object 0x1016 - Consumer heartbeat time.
     *
     * @returns {Array<object>} [{ deviceId, heartbeatTime } ... ]
     * @since 6.0.0
     */
    getHeartbeatConsumers() {
        const consumers = [];

        const obj1016 = this.getEntry(0x1016);
        if (obj1016) {
            const maxSubIndex = obj1016[0].value;
            for (let i = 1; i <= maxSubIndex; ++i) {
                const subObj = obj1016.at(i);
                if (!subObj)
                    continue;

                const heartbeatTime = subObj.raw.readUInt16LE(0);
                const deviceId = subObj.raw.readUInt8(2);

                if (deviceId > 0 && deviceId <= 127)
                    consumers.push({ deviceId, heartbeatTime });
            }
        }

        return consumers;
    }

    /**
     * Add an entry to object 0x1016 - Consumer heartbeat time.
     * - bit 0..15 - Heartbeat time in ms.
     * - bit 16..23 - Node-ID of producer.
     * - bit 24..31 - Reserved (0x00);
     *
     * @param {number} deviceId - device identifier [1-127].
     * @param {number} timeout - milliseconds before a timeout is reported.
     * @param {object} [options] - DataObject creation options.
     * @param {number} [options.subIndex] - index to store the entry.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    addHeartbeatConsumer(deviceId, timeout, options = {}) {
        if (deviceId < 1 || deviceId > 0x7F)
            throw RangeError('deviceId must be in range [1-127]');

        if (timeout < 0 || timeout > 0xffff)
            throw RangeError('timeout must be in range [0-65535]');

        let obj1016 = this.getEntry(0x1016);
        if (obj1016 === undefined) {
            obj1016 = this.addEntry(0x1016, {
                objectType: ObjectType.ARRAY,
                parameterName: 'Consumer heartbeat time',
            });
        }

        for (let i = 1; i <= obj1016[0].value; ++i) {
            const subObj = obj1016.at(i);
            if (subObj && subObj.raw.readUInt8(2) === deviceId) {
                deviceId = '0x' + deviceId.toString(16);
                throw new EdsError(`consumer for ${deviceId} already exists`);
            }
        }

        let subIndex = options.subIndex;
        if (!subIndex) {
            // Find first empty index
            for (let i = 1; i <= 255; ++i) {
                if (obj1016[i] === undefined) {
                    subIndex = i;
                    break;
                }
            }
        }

        if (!subIndex)
            throw new EdsError('NMT consumer entry full');

        // Install sub entry
        const subObj = this.addSubEntry(0x1016, subIndex, {
            parameterName: `Device 0x${deviceId.toString(16)}`,
            dataType: DataType.UNSIGNED32,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        const raw = Buffer.alloc(4);
        raw.writeUInt16LE(timeout, 0);
        raw.writeUInt8(deviceId, 2);

        subObj.raw = raw;
        if (options.saveDefault)
            subObj.defaultValue = subObj.value;
    }

    /**
     * Remove an entry from object 0x1016 - Consumer heartbeat time.
     *
     * @param {number} deviceId - id of the entry to remove.
     * @since 6.0.0
     */
    removeHeartbeatConsumer(deviceId) {
        const obj1016 = this.getEntry(0x1016);
        if (obj1016 !== undefined) {
            const maxSubIndex = obj1016[0].value;
            for (let i = 1; i <= maxSubIndex; ++i) {
                const subObj = obj1016.at(i);
                if (subObj === undefined)
                    continue;

                if (subObj.raw.readUInt8(2) === deviceId) {
                    obj1016.removeSubObject(i);
                    break;
                }
            }
        }
    }

    /**
     * Get object 0x1017 - Producer heartbeat time.
     *
     * @returns {number} heartbeat time in ms.
     * @since 6.0.0
     */
    getHeartbeatProducerTime() {
        const obj1017 = this.getEntry(0x1017);
        if (obj1017)
            return obj1017.value;

        return null;
    }

    /**
     * Set object 0x1017 - Producer heartbeat time.
     *
     * A value of zero disables the heartbeat.
     *
     * @param {number} producerTime - Producer heartbeat time in ms.
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setHeartbeatProducerTime(producerTime, options = {}) {
        let obj1017 = this.getEntry(0x1017);
        if (!obj1017) {
            obj1017 = this.addEntry(0x1017, {
                dataType: DataType.UNSIGNED32,
                parameterName: 'Producer heartbeat time',
                accessType: options.accessType || AccessType.READ_WRITE,
            });
        }

        obj1017.value = producerTime;
        if (options.saveDefault)
            obj1017.defaultValue = producerTime;
    }

    /**
     * Get object 0x1018 - Identity object.
     *
     * @returns {object | null} identity.
     * @since 6.0.0
     */
    getIdentity() {
        const obj1018 = this.getEntry(0x1018);
        if (obj1018) {
            return {
                vendorId: obj1018[1].value,
                productCode: obj1018[2].value,
                revisionNumber: obj1018[3].value,
                serialNumber: obj1018[4].value,
            };
        }

        return null;
    }

    /**
     * Set object 0x1018 - Identity object.
     * - sub-index 1 - Vendor id.
     * - sub-index 2 - Product code.
     * - sub-index 3 - Revision number.
     * - sub-index 4 - Serial number.
     *
     * @param {object} identity - device identity.
     * @param {number} identity.vendorId - vendor id.
     * @param {number} identity.productCode - product code.
     * @param {number} identity.revisionNumber - revision number.
     * @param {number} identity.serialNumber - serial number.
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setIdentity(identity, options = {}) {
        let obj1018 = this.getEntry(0x1018);
        if (!obj1018) {
            obj1018 = this.addEntry(0x1018, {
                parameterName: 'Identity object',
                objectType: ObjectType.RECORD,
            });

            obj1018.addSubObject(1, {
                parameterName: 'Vendor-ID',
                dataType: DataType.UNSIGNED32,
                accessType: options.accessType || AccessType.READ_ONLY,
            });

            obj1018.addSubObject(2, {
                parameterName: 'Product code',
                objectType: ObjectType.VAR,
                dataType: DataType.UNSIGNED32,
                accessType: options.accessType || AccessType.READ_ONLY,
            });

            obj1018.addSubObject(3, {
                parameterName: 'Revision number',
                objectType: ObjectType.VAR,
                dataType: DataType.UNSIGNED32,
                accessType: options.accessType || AccessType.READ_ONLY,
            });

            obj1018.addSubObject(4, {
                parameterName: 'Serial number',
                objectType: ObjectType.VAR,
                dataType: DataType.UNSIGNED32,
                accessType: options.accessType || AccessType.READ_ONLY,
            });
        }

        if (identity.vendorId !== undefined) {
            obj1018[1].value = identity.vendorId;
            if (options.saveDefault)
                obj1018[1].defaultValue = identity.vendorId;
        }

        if (identity.productCode !== undefined) {
            obj1018[2].value = identity.productCode;
            if (options.saveDefault)
                obj1018[2].defaultValue = identity.productCode;
        }

        if (identity.revisionNumber !== undefined) {
            obj1018[3].value = identity.revisionNumber;
            if (options.saveDefault)
                obj1018[3].defaultValue = identity.revisionNumber;
        }

        if (identity.serialNumber !== undefined) {
            obj1018[4].value = identity.serialNumber;
            if (options.saveDefault)
                obj1018[4].defaultValue = identity.serialNumber;
        }
    }

    /**
     * Get object 0x1019 - Synchronous counter overflow value.
     *
     * @returns {number} Sync counter overflow value.
     * @since 6.0.0
     */
    getSyncOverflow() {
        const obj1019 = this.getEntry(0x1019);
        if (obj1019)
            return obj1019.value;

        return null;
    }

    /**
     * Set object 0x1019 - Synchronous counter overflow value.
     *
     * @param {number} overflow - Sync overflow value.
     * @param {object} [options] - DataObject creation options.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    setSyncOverflow(overflow, options = {}) {
        overflow = overflow & 0xff;

        let obj1019 = this.getEntry(0x1019);
        if (!obj1019) {
            obj1019 = this.addEntry(0x1019, {
                dataType: DataType.UNSIGNED8,
                parameterName: 'Synchronous counter overflow value',
                accessType: options.accessType || AccessType.READ_WRITE,
                defaultValue: overflow,
            });
        }

        obj1019.value = overflow;
        if (options.saveDefault)
            obj1019.defaultValue = overflow;
    }

    /**
     * Get object 0x1028 - Emergency consumer object.
     *
     * @returns {Array<number>} Emcy consumer COB-IDs.
     * @since 6.0.0
     */
    getEmcyConsumers() {
        const consumers = [];

        const obj1028 = this.getEntry(0x1028);
        if (obj1028) {
            const maxSubIndex = obj1028[0].value;
            for (let i = 1; i <= maxSubIndex; ++i) {
                const subEntry = obj1028.at(i);
                if (!subEntry)
                    continue;

                if (!(subEntry.value >> 31))
                    consumers.push(subEntry.value & 0x7ff);
            }
        }

        return consumers;
    }

    /**
     * Add an entry to object 0x1028 - Emergency consumer object.
     * - bit 0..11 - CAN-ID.
     * - bit 16..23 - Reserved (0x00).
     * - bit 31 - 0 = valid, 1 = invalid.
     *
     * @param {number} cobId - COB-ID to add.
     * @param {object} [options] - DataObject creation options.
     * @param {number} [options.subIndex] - index to store the entry.
     * @param {string} [options.parameterName] - DataObject name.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    addEmcyConsumer(cobId, options = {}) {
        if (cobId > 0x7FF)
            throw RangeError('CAN extended frames not supported');

        let obj1028 = this.getEntry(0x1028);
        if (!obj1028) {
            obj1028 = this.addEntry(0x1028, {
                objectType: ObjectType.ARRAY,
                parameterName: options.parameterName || 'Emergency consumer object',
            });
        }

        for (let i = 1; i <= obj1028[0].value; ++i) {
            const subObj = this.getSubEntry(0x1028, i);
            if (subObj && subObj.raw.readUInt16LE() === cobId) {
                cobId = '0x' + cobId.toString(16);
                throw new EdsError(`EMCY consumer ${cobId} already exists`);
            }
        }

        let subIndex = options.subIndex;
        if (!subIndex) {
            // Find first empty index
            for (let i = 1; i <= 255; ++i) {
                if (obj1028[i] === undefined) {
                    subIndex = i;
                    break;
                }
            }
        }

        if (!subIndex)
            throw new EdsError('entry full');

        const subObj = this.addSubEntry(0x1028, subIndex, {
            parameterName: `Emergency consumer ${subIndex}`,
            dataType: DataType.UNSIGNED32,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        subObj.value = cobId;
        if (options.saveDefault)
            subObj.defaultValue = cobId;
    }

    /**
     * Remove an entry from object 0x1028 - Emergency consumer object.
     *
     * @param {number} cobId - COB-ID of the entry to remove.
     * @since 6.0.0
     */
    removeEmcyConsumer(cobId) {
        const obj1028 = this.getEntry(0x1028);
        if (obj1028 !== undefined) {
            for (let i = 1; i <= obj1028._subObjects[0].value; ++i) {
                const subObject = obj1028._subObjects[i];
                if (subObject === undefined)
                    continue;

                const value = subObject.value;
                if (value >> 31)
                    continue; // Invalid

                if ((value & 0x7FF) === cobId) {
                    obj1028.removeSubObject(i);
                    break;
                }
            }
        }
    }

    /**
     * Get SDO server parameters.
     *
     * @returns {Array<object>} [{ deviceId, cobIdTx, cobIdRx } ... ]
     * @since 6.0.0
     */
    getSdoServerParameters() {
        const parameters = [];

        for (let [index, entry] of this.entries()) {
            index = parseInt(index, 16);
            if (index < 0x1200 || index > 0x127F)
                continue;

            const result = this._parseSdoParameter(entry);
            if(result) {
                parameters.push({
                    cobIdRx: result[0],
                    cobIdTx: result[1],
                    deviceId: result[2],
                });
            }
        }

        return parameters;
    }

    /**
     * Add an SDO server parameter object.
     *
     * Object 0x1200..0x127F - SDO server parameter.
     *
     * Sub-index 1/2:
     * - bit 0..10 - CAN base frame.
     * - bit 11..28 - CAN extended frame.
     * - bit 29 - Frame type (base or extended).
     * - bit 30 - Dynamically allocated.
     * - bit 31 - SDO exists / is valid.
     *
     * Sub-index 3 (optional):
     * - bit 0..7 - Node-ID of the SDO client.
     *
     * @param {number} deviceId - device identifier [1-127].
     * @param {number} cobIdTx - COB-ID for outgoing messages (to client).
     * @param {number} cobIdRx - COB-ID for incoming messages (from client).
     * @param {object} [options] - DataObject creation options.
     * @param {string} [options.index] - DataObject index [0x1200-0x127F].
     * @param {string} [options.parameterName] - DataObject name.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    addSdoServerParameter(
        deviceId, cobIdTx = 0x580, cobIdRx = 0x600, options = {}) {

        if (deviceId < 0 || deviceId > 0x7F)
            throw RangeError('deviceId must be in range [0-127]');

        let index = options.index;
        if (index) {
            if (this.getEntry(options.index))
                throw new EdsError(`index ${options.index} already in use`);
        }
        else {
            index = 0x1200;
            for (; index <= 0x127F; ++index) {
                if (this.getEntry(index) === undefined)
                    break;
            }
        }

        const obj = this.addEntry(index, {
            objectType: ObjectType.RECORD,
            parameterName: options.parameterName || 'SDO server parameter',
        });

        const subObj1 = obj.addSubObject(1, {
            parameterName: 'COB-ID client to server',
            dataType: DataType.UNSIGNED32,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        const subObj2 = obj.addSubObject(2, {
            parameterName: 'COB-ID server to client',
            dataType: DataType.UNSIGNED32,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        const subObj3 = obj.addSubObject(3, {
            parameterName: 'Node-ID of the SDO client',
            dataType: DataType.UNSIGNED8,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        subObj1.value = cobIdRx;
        subObj2.value = cobIdTx;
        subObj3.value = deviceId;

        if (options.saveDefault) {
            subObj1.defaultValue = cobIdRx;
            subObj2.defaultValue = cobIdTx;
            subObj3.defaultValue = deviceId;
        }

        /**
         * A SDO server parameter object was added.
         *
         * @event Eds#newSdoClient
         * @type {object}
         */
        this.emit('newSdoClient', { deviceId, cobIdRx, cobIdTx });
    }

    /**
     * Remove an SDO server parameter object.
     *
     * @param {number} deviceId - device identifier [1-127].
     * @since 6.0.0
     */
    removeSdoServerParameter(deviceId) {
        for (let [index, entry] of this.entries()) {
            index = parseInt(index, 16);
            if (index < 0x1200 || index > 0x127F)
                continue;

            const result = this._parseSdoParameter(entry);
            if(result && result[2] === deviceId) {
                this.removeEntry(index);

                /**
                 * A SDO server parameter object was removed.
                 *
                 * @event Eds#removeSdoClient
                 * @type {object}
                 */
                this.emit('removeSdoClient', {
                    cobIdRx: result[0],
                    cobIdTx: result[1],
                    deviceId: result[2],
                });

                break;
            }
        }
    }

    /**
     * Get SDO client parameters.
     *
     * @returns {Array<object>} [{ deviceId, cobIdTx, cobIdRx } ... ]
     * @since 6.0.0
     */
    getSdoClientParameters() {
        const parameters = [];

        for (let [index, entry] of this.entries()) {
            index = parseInt(index, 16);
            if (index < 0x1280 || index > 0x12FF)
                continue;

            const result = this._parseSdoParameter(entry);
            if(result) {
                parameters.push({
                    cobIdTx: result[0],
                    cobIdRx: result[1],
                    deviceId: result[2],
                });
            }
        }

        return parameters;
    }

    /**
     * Add an SDO client parameter object.
     *
     * Object 0x1280..0x12FF - SDO client parameter.
     *
     * Sub-index 1/2:
     * - bit 0..10 - CAN base frame.
     * - bit 11..28 - CAN extended frame.
     * - bit 29 - Frame type (base or extended).
     * - bit 30 - Dynamically allocated.
     * - bit 31 - SDO exists / is valid.
     *
     * Sub-index 3:
     * - bit 0..7 - Node-ID of the SDO server.
     *
     * @param {number} deviceId - device identifier [1-127].
     * @param {number} cobIdTx - COB-ID for outgoing messages (to server).
     * @param {number} cobIdRx - COB-ID for incoming messages (from server).
     * @param {object} [options] - DataObject creation options.
     * @param {string} [options.index] - DataObject index [0x1200-0x127F].
     * @param {string} [options.parameterName] - DataObject name.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    addSdoClientParameter(
        deviceId, cobIdTx = 0x600, cobIdRx = 0x580, options = {}) {

        if (!deviceId || deviceId < 1 || deviceId > 0x7F)
            throw new RangeError('deviceId must be in range [1-127]');

        let index = options.index;
        if (index) {
            if (this.getEntry(options.index))
                throw new EdsError(`index ${options.index} already in use`);
        }
        else {
            index = 0x1280;
            for (; index <= 0x12FF; ++index) {
                if (this.getEntry(index) === undefined)
                    break;
            }
        }

        const obj = this.addEntry(index, {
            objectType: ObjectType.RECORD,
            parameterName: options.parameterName || 'SDO client parameter',
        });

        const subObj1 = obj.addSubObject(1, {
            parameterName: 'COB-ID client to server',
            dataType: DataType.UNSIGNED32,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        const subObj2 = obj.addSubObject(2, {
            parameterName: 'COB-ID server to client',
            dataType: DataType.UNSIGNED32,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        const subObj3 = obj.addSubObject(3, {
            parameterName: 'Node-ID of the SDO server',
            dataType: DataType.UNSIGNED8,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        subObj1.value = cobIdTx;
        subObj2.value = cobIdRx;
        subObj3.value = deviceId;

        if (options.saveDefault) {
            subObj1.defaultValue = cobIdTx;
            subObj2.defaultValue = cobIdRx;
            subObj3.defaultValue = deviceId;
        }

        /**
         * An SDO client parameter object was added.
         *
         * @event Eds#newSdoServer
         * @type {object}
         */
        this.emit('newSdoServer', { deviceId, cobIdRx, cobIdTx });
    }

    /**
     * Remove an SDO client parameter object.
     *
     * @param {number} deviceId - device identifier [1-127].
     * @since 6.0.0
     */
    removeSdoClientParameter(deviceId) {
        for (let [index, entry] of this.entries()) {
            index = parseInt(index, 16);
            if (index < 0x1280 || index > 0x12FF)
                continue;

            const result = this._parseSdoParameter(entry);
            if (result && result[2] === deviceId) {
                this.removeEntry(index);

                /**
                 * An SDO client parameter object was removed.
                 *
                 * @event Eds#removeSdoServer
                 * @type {object}
                 */
                this.emit('removeSdoServer', {
                    cobIdTx: result[0],
                    cobIdRx: result[1],
                    deviceId: result[2],
                });

                break;
            }
        }
    }

    /**
     * Get RPDO communication/mapping parameters.
     *
     * @returns {Array<object>} mapped RPDOs.
     * @since 6.0.0
     */
    getReceivePdos() {
        const rpdo = [];

        for (let index of this.keys()) {
            index = parseInt(index, 16);
            if (index < 0x1400 || index > 0x15FF)
                continue;

            const pdo = this._parsePdo(index);
            if (!pdo)
                continue;

            delete pdo.syncStart; // Not used by RPDOs

            rpdo.push(pdo);
        }

        return rpdo;
    }

    /**
     * Create a RPDO communication/mapping parameter object.
     *
     * Object 0x1400..0x15FF - RPDO communication parameter
     *
     * Sub-index 1 (mandatory):
     * - bit 0..10 - CAN base frame.
     * - bit 11..28 - CAN extended frame.
     * - bit 29 - Frame type.
     * - bit 30 - RTR allowed.
     * - bit 31 - RPDO valid.
     *
     * Sub-index 2 (mandatory):
     * - bit 0..7 - Transmission type.
     *
     * Sub-index 3 (optional):
     * - bit 0..15 - Inhibit time.
     *
     * Object 0x1600..0x17FF - RPDO mapping parameter
     * - bit 0..7 - Bit length.
     * - bit 8..15 - Sub-index.
     * - bit 16..31 - Index.
     *
     * Inhibit time and synchronous RPDOs are not yet supported. All entries
     * are treated as event-driven with an inhibit time of 0.
     *
     * @param {object} pdo - PDO data.
     * @param {number} pdo.cobId - COB-ID used by the RPDO.
     * @param {number} pdo.transmissionType - transmission type.
     * @param {number} pdo.inhibitTime - minimum time between updates.
     * @param {Array<DataObject>} pdo.dataObjects - objects to map.
     * @param {object} options - optional arguments.
     * @param {number} [options.index] - DataObject index [0x1400-0x15ff].
     * @param {Array<string>} [options.parameterName] - DataObject names.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @param {boolean} [options.saveDefault] - save value as default.
     * @since 6.0.0
     */
    addReceivePdo(pdo, options = {}) {
        for (let [index, entry] of this.entries()) {
            index = parseInt(index, 16);
            if (index < 0x1400 || index > 0x15FF)
                continue;

            const subObj = entry.at(1);
            if (subObj && subObj.value === pdo.cobId) {
                const cobId = '0x' + pdo.cobId.toString(16);
                throw new EdsError(`RPDO ${cobId} already exists`);
            }
        }

        let index = options.index;
        if (index) {
            if (this.getEntry(options.index))
                throw new EdsError(`index ${options.index} already in use`);
        }
        else {
            index = 0x1400;
            for (; index <= 0x15FF; ++index) {
                if (this.getEntry(index) === undefined)
                    break;
            }
        }

        if (index < 0x1400 || index > 0x15FF)
            throw new RangeError('index must be in range [0x1400-0x15FF]');

        let commName = 'RPDO communication parameter';
        let mapName = 'RPDO mapping parameter';
        if (options.parameterName) {
            if (Array.isArray(options.parameterName)) {
                commName = options.parameterName[0] || commName;
                mapName = options.parameterName[1] || mapName;
            }
            else {
                commName = options.parameterName || commName;
            }
        }

        const commObj = this.addEntry(index, {
            objectType: ObjectType.RECORD,
            parameterName: commName,
        });

        const commSub1 = commObj.addSubObject(1, {
            parameterName: 'COB-ID used by RPDO',
            dataType: DataType.UNSIGNED32,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        commSub1.value = pdo.cobId;
        if (options.saveDefault)
            commSub1.defaultValue = commSub1.value;

        const commSub2 = commObj.addSubObject(2, {
            parameterName: 'transmission type',
            dataType: DataType.UNSIGNED8,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        commSub2.value = pdo.transmissionType || 254;
        if (options.saveDefault)
            commSub2.defaultValue = commSub2.value;

        const commSub3 = commObj.addSubObject(3, {
            parameterName: 'inhibit time',
            dataType: DataType.UNSIGNED16,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        commSub3.value = pdo.inhibitTime || 0;
        if (options.saveDefault)
            commSub3.defaultValue = commSub3.value;

        commObj.addSubObject(4, {
            // Not used
            parameterName: 'compatibility entry',
            dataType: DataType.UNSIGNED8,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        commObj.addSubObject(5, {
            // Not used
            parameterName: 'event timer',
            dataType: DataType.UNSIGNED16,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        commObj.addSubObject(6, {
            // Not used
            parameterName: 'SYNC start value',
            dataType: DataType.UNSIGNED8,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        const mapObj = this.addEntry(index + 0x200, {
            objectType: ObjectType.RECORD,
            parameterName: mapName,
        });

        for (let i = 0; i < pdo.dataObjects.length; ++i) {
            const entry = pdo.dataObjects[i];
            const value = (entry.index << 16)
                | (entry.subIndex << 8)
                | (entry.size << 3);

            const mapSub = mapObj.addSubObject(i + 1, {
                parameterName: `Mapped object ${i + 1}`,
                dataType: DataType.UNSIGNED32,
                accessType: options.accessType || AccessType.READ_WRITE,
                defaultValue: value,
            });

            mapSub.value = value;
            if (options.saveDefault)
                mapSub.defaultValue = value;
        }

        /**
         * A new receive PDO was mapped.
         *
         * @event Eds#newRpdo
         * @type {object}
         * @since 6.0.0
         */
        this.emit('newRpdo', this._parsePdo(index));

        // Update deviceInfo
        this.deviceInfo['NrOfRXPDO'] = this.nrOfRXPDO;
    }

    /**
     * Remove an RPDO communication/mapping parameter object.
     *
     * @param {number} cobId - COB-ID used by the RPDO.
     * @returns {object} removed RPDO.
     * @since 6.0.0
     */
    removeReceivePdo(cobId) {
        for (let index of this.keys()) {
            index = parseInt(index, 16);
            if (index < 0x1400 || index > 0x15FF)
                continue;

            const pdo = this._parsePdo(index);
            if (pdo.cobId === cobId) {
                this.removeEntry(index);
                this.removeEntry(index + 0x200);

                // Update deviceInfo
                this.deviceInfo['NrOfRXPDO'] = this.nrOfRXPDO;

                /**
                 * A transmit PDO was removed.
                 *
                 * @event Eds#newTpdo
                 * @type {object}
                 * @since 6.0.0
                 */
                this.emit('removeTpdo', pdo);

                return pdo;
            }
        }

        return null;
    }

    /**
     * Get TPDO communication/mapping parameters.
     *
     * @returns {Array<object>} mapped TPDOs.
     * @since 6.0.0
     */
    getTransmitPdos() {
        const tpdo = [];

        for (let index of this.keys()) {
            index = parseInt(index, 16);
            if (index < 0x1800 || index > 0x19FF)
                continue;

            const pdo = this._parsePdo(index);
            if (!pdo)
                continue;

            tpdo.push(pdo);
        }

        return tpdo;
    }

    /**
     * Create a TPDO communication/mapping parameter object.
     *
     * Object 0x1800..0x19FF - TPDO communication parameter
     *
     * Sub-index 1 (mandatory):
     * - bit 0..10 - CAN base frame.
     * - bit 11..28 - CAN extended frame.
     * - bit 29 - Frame type.
     * - bit 30 - RTR allowed.
     * - bit 31 - TPDO valid.
     *
     * Sub-index 2 (mandatory):
     * - bit 0..7 - Transmission type.
     *
     * Sub-index 3 (optional):
     * - bit 0..15 - Inhibit time.
     *
     * Sub-index 5 (optional):
     * - bit 0..15 - Event timer value.
     *
     * Sub-index 6 (optional):
     * - bit 0..7 - SYNC start value.
     *
     * Object 0x2000..0x21FF - TPDO mapping parameter
     * - bit 0..7 - Bit length.
     * - bit 8..15 - Sub-index.
     * - bit 16..31 - Index.
     *
     * @param {object} pdo - object data.
     * @param {number} pdo.cobId - COB-ID used by the TPDO.
     * @param {number} pdo.transmissionType - transmission type.
     * @param {number} pdo.inhibitTime - minimum time between writes.
     * @param {number} pdo.eventTime - how often to send timer based PDOs.
     * @param {number} pdo.syncStart - initial counter value for sync PDOs.
     * @param {Array<DataObject>} pdo.dataObjects - objects to map.
     * @param {object} options - optional arguments.
     * @param {number} [options.index] - DataObject index [0x1800-0x19ff].
     * @param {Array<string>} [options.parameterName] - DataObject names.
     * @param {AccessType} [options.accessType] - DataObject access type.
     * @since 6.0.0
     */
    addTransmitPdo(pdo, options = {}) {
        for (let [index, entry] of this.entries()) {
            index = parseInt(index, 16);
            if (index < 0x1800 || index > 0x19FF)
                continue;

            const subObj = entry.at(1);
            if (subObj && subObj.value === pdo.cobId) {
                const cobId = '0x' + pdo.cobId.toString(16);
                throw new EdsError(`TPDO ${cobId} already exists`);
            }
        }

        let index = options.index;
        if (index) {
            if (this.getEntry(options.index))
                throw new EdsError(`index ${options.index} already in use`);
        }
        else {
            index = 0x1800;
            for (; index <= 0x19FF; ++index) {
                if (this.getEntry(index) === undefined)
                    break;
            }
        }

        if (index < 0x1800 || index > 0x19FF)
            throw new RangeError('index must be in range [0x1800-0x19FF]');

        let commName = 'TPDO communication parameter';
        let mapName = 'TPDO mapping parameter';
        if (options.parameterName) {
            if (Array.isArray(options.parameterName)) {
                commName = options.parameterName[0] || commName;
                mapName = options.parameterName[1] || mapName;
            }
            else {
                commName = options.parameterName || commName;
            }
        }

        const commEntry = this.addEntry(index, {
            objectType: ObjectType.RECORD,
            parameterName: commName,
        });

        const commSub1 = commEntry.addSubObject(1, {
            parameterName: 'COB-ID used by TPDO',
            dataType: DataType.UNSIGNED32,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        commSub1.value = pdo.cobId;
        if (options.saveDefault)
            commSub1.defaultValue = commSub1.value;

        const commSub2 = commEntry.addSubObject(2, {
            parameterName: 'transmission type',
            dataType: DataType.UNSIGNED8,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        commSub2.value = pdo.transmissionType || 254;
        if (options.saveDefault)
            commSub2.defaultValue = commSub2.value;

        const commSub3 = commEntry.addSubObject(3, {
            parameterName: 'inhibit time',
            dataType: DataType.UNSIGNED16,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        commSub3.value = pdo.inhibitTime || 0;
        if (options.saveDefault)
            commSub3.defaultValue = commSub3.value;

        commEntry.addSubObject(4, {
            parameterName: 'compatibility entry',
            dataType: DataType.UNSIGNED8,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        const commSub5 = commEntry.addSubObject(5, {
            parameterName: 'event timer',
            dataType: DataType.UNSIGNED16,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        commSub5.value = pdo.eventTime || 0;
        if (options.saveDefault)
            commSub5.defaultValue = commSub5.value;

        const commSub6 = commEntry.addSubObject(6, {
            parameterName: 'SYNC start value',
            dataType: DataType.UNSIGNED8,
            accessType: options.accessType || AccessType.READ_WRITE,
        });

        commSub6.value = pdo.syncStart || 0;
        if (options.saveDefault)
            commSub6.defaultValue = commSub6.value;

        const mapEntry = this.addEntry(index + 0x200, {
            objectType: ObjectType.RECORD,
            parameterName: mapName,
        });

        for (let i = 0; i < pdo.dataObjects.length; ++i) {
            const entry = pdo.dataObjects[i];
            const value = (entry.index << 16)
                | (entry.subIndex << 8)
                | (entry.size << 3);

            const mapSub = mapEntry.addSubObject(i + 1, {
                parameterName: `Mapped object ${i + 1}`,
                dataType: DataType.UNSIGNED32,
                accessType: options.accessType || AccessType.READ_WRITE,
                defaultValue: value,
            });

            mapSub.value = value;
            if (options.saveDefault)
                mapSub.defaultValue = value;
        }

        // Update deviceInfo
        this.deviceInfo['NrOfTXPDO'] = this.nrOfTXPDO;

        /**
         * A new transmit PDO was mapped.
         *
         * @event Eds#newTpdo
         * @type {object}
         * @since 6.0.0
         */
        this.emit('newTpdo', this._parsePdo(index));
    }

    /**
     * Remove a TPDO communication/mapping parameter object.
     *
     * @param {number} cobId - COB-ID used by the TPDO.
     * @returns {object} removed TPDO.
     * @since 6.0.0
     */
    removeTransmitPdo(cobId) {
        for (let index of this.keys()) {
            index = parseInt(index, 16);
            if (index < 0x1800 || index > 0x19FF)
                continue;

            const pdo = this._parsePdo(index);
            if (pdo.cobId === cobId) {
                this.removeEntry(index);
                this.removeEntry(index + 0x200);

                // Update deviceInfo
                this.deviceInfo['NrOfTXPDO'] = this.nrOfTXPDO;

                /**
                 * A transmit PDO was removed.
                 *
                 * @event Eds#newTpdo
                 * @type {object}
                 * @since 6.0.0
                 */
                this.emit('removeTpdo', pdo);

                return pdo;
            }
        }

        return null;
    }

    /**
     * Parse a pair of PDO communication/mapping parameters.
     *
     * @param {number} index - PDO communication parameter index.
     * @returns {object} parsed PDO data.
     * @private
     */
    _parsePdo(index) {
        const commEntry = this.getEntry(index);
        if (!commEntry) {
            index = '0x' + index.toString(16);
            throw new EdsError(`missing communication parameter (${index})`);
        }

        const mapEntry = this.getEntry(index + 0x200);
        if (!mapEntry) {
            index = '0x' + (index + 0x200).toString(16);
            throw new EdsError(`missing mapping parameter (${index})`);
        }

        /* sub-index 1 (mandatory):
         *   bit 0..10      11-bit CAN base frame.
         *   bit 11..28     29-bit CAN extended frame.
         *   bit 29         Frame type.
         *   bit 30         RTR allowed.
         *   bit 31         PDO valid.
         */
        if (commEntry[1] === undefined)
            throw new EdsError('missing PDO COB-ID');

        let cobId = commEntry[1].value;
        if (!cobId || ((cobId >> 31) & 0x1) == 0x1)
            return;

        if (((cobId >> 29) & 0x1) == 0x1)
            throw new EdsError('CAN extended frames are not supported');

        cobId &= 0x7FF;

        /* sub-index 2 (mandatory):
         *   bit 0..7       Transmission type.
         */
        if (commEntry[2] === undefined)
            throw new EdsError('missing PDO transmission type');

        const transmissionType = commEntry[2].value;

        /* sub-index 3 (optional):
         *   bit 0..15      Inhibit time.
         */
        const inhibitTime = (commEntry[3] !== undefined)
            ? commEntry[3].value : 0;

        /* sub-index 5 (optional):
         *   bit 0..15      Event timer value.
         */
        const eventTime = (commEntry[5] !== undefined)
            ? commEntry[5].value : 0;

        /* sub-index 6 (optional):
         *   bit 0..7       SYNC start value.
         */
        const syncStart = (commEntry[6] !== undefined)
            ? commEntry[6].value : 0;

        let pdo = {
            cobId,
            transmissionType,
            inhibitTime,
            eventTime,
            syncStart,
            dataObjects: [],
            dataSize: 0,
        };

        if (mapEntry[0].value == 0xFE)
            throw new EdsError('SAM-MPDO not supported');

        if (mapEntry[0].value == 0xFF)
            throw new EdsError('DAM-MPDO not supported');

        if (mapEntry[0].value > 0x40) {
            throw new EdsError('invalid PDO mapping value '
                + `(${mapEntry[0].value})`);
        }

        for (let i = 1; i <= mapEntry[0].value; ++i) {
            if (mapEntry[i].raw.length == 0)
                continue;

            /* sub-index 1+:
             *   bit 0..7       Bit length.
             *   bit 8..15      Sub-index.
             *   bit 16..31     Index.
             */
            const dataLength = mapEntry[i].raw.readUInt8(0);
            const dataSubIndex = mapEntry[i].raw.readUInt8(1);
            const dataIndex = mapEntry[i].raw.readUInt16LE(2);

            let obj = this.getEntry(dataIndex);
            if(obj) {
                if (dataSubIndex)
                    obj = obj[dataSubIndex];

                pdo.dataObjects.push(obj);
                pdo.dataSize += dataLength / 8;
            }
        }

        return pdo;
    }

    /**
     * Parse an SDO client/server parameter object.
     *
     * @param {DataObject} entry - entry to parse.
     * @returns {null | Array<number>} parsed data.
     * @since 6.0.0
     * @private
     */
    _parseSdoParameter(entry) {
        let result = [];

        const subObj1 = entry[1];
        if(!subObj1)
            return null;

        const subObj2 = entry[2];
        if(!subObj2)
            return null;

        const cobIdRx = subObj1.value;
        if (!cobIdRx || ((cobIdRx >> 29) & 0x1) == 0x1)
            throw new EdsError('CAN extended frames are not supported');

        result[0] = cobIdRx & 0x7FF;

        const cobIdTx = subObj2.value;
        if (!cobIdTx || ((cobIdTx >> 29) & 0x1) == 0x1)
            throw new EdsError('CAN extended frames are not supported');

        result[1] = cobIdTx & 0x7FF;

        const subObj3 = entry[3];
        if(subObj3)
            result[2] = subObj3.value;
        else
            result[2] = 0;

        return result;
    }

    /**
     * Helper method to write strings to an EDS file.
     *
     * @param {number} fd - file descriptor to write.
     * @param {string} data - string to write.
     * @private
     */
    _write(fd, data) {
        const nullMatch = new RegExp('=null', 'g');
        data = data.replace(nullMatch, '=');
        if (data.length > 0)
            fs.writeSync(fd, data + EOL);
    }


    /**
     * Helper method to write objects to an EDS file.
     *
     * @param {number} fd - file descriptor to write.
     * @param {object} objects - objects to write.
     * @private
     */
    _writeObjects(fd, objects) {
        for (const [key, value] of Object.entries(objects)) {
            if (key == 'SupportedObjects')
                continue;

            const index = parseInt(value, 16);
            const dataObject = this._dataObjects[index.toString(16)];

            // Write top level object
            const section = index.toString(16);
            this._write(fd, ini.encode(entryToEds(dataObject), {
                section: section
            }));

            // Write sub-objects
            for (let i = 0; i < dataObject.subNumber; i++) {
                if (dataObject[i]) {
                    const subSection = section + 'sub' + i;
                    const subObject = dataObject[i];
                    this._write(fd, ini.encode(entryToEds(subObject), {
                        section: subSection
                    }));
                }
            }
        }
    }
}

module.exports = exports = { EdsError, DataObject, Eds };
