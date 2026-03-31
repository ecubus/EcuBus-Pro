/**
 * @file Implements the CANopen Service Data Object (SDO) protocol server.
 * @author Wilkins White
 * @copyright 2024 Daxbot
 */

const Protocol = require('./protocol');
const { DataObject, Eds } = require('../eds');
const { AccessType } = require('../types');
const { SdoCode, SdoTransfer, ClientCommand, ServerCommand } = require('./sdo');
const calculateCrc = require('../functions/crc');
const rawToType = require('../functions/raw_to_type');
const { deprecate } = require('util');

/**
 * CANopen SDO protocol handler (Server).
 *
 * The service data object (SDO) protocol uses a client-server structure where
 * a client can initiate the transfer of data from the server's object
 * dictionary. An SDO is transfered as a sequence of segments with basic
 * error checking.
 *
 * @param {Eds} eds - parent device.
 * @see CiA301 'Service data object (SDO)' (§7.2.4)
 * @implements {Protocol}
 */
class SdoServer extends Protocol {
    constructor(eds) {
        super(eds);
        this.transfers = {};
        this._blockSize = 127;
        this._blockInterval = null;
    }

    /**
     * Number of segments per block when serving block transfers.
     *
     * @type {number}
     */
    get blockSize() {
        return this._blockSize;
    }

    /**
     * Time delay between each segment during a block transfer.
     *
     * @type {number}
     * @since 6.2.0
     */
    get blockInterval() {
        return this._blockInterval;
    }

    /**
     * Set the number of segments per block when serving block transfers.
     *
     * @param {number} value - block size [1-127].
     * @since 6.0.0
     */
    setBlockSize(value) {
        if (value < 1 || value > 127)
            throw RangeError('blockSize must be in range [1-127]');

        this._blockSize = value;
    }

    /**
     * Set the time delay between each segment during a block transfer.
     *
     * @param {number} value - block interval in milliseconds.
     * @since 6.2.0
     */
    setBlockInterval(value) {
        if(value < 0)
            throw RangeError('blockInterval must be positive or zero');

        this._blockInterval = value;
    }

    /**
     * Start the module.
     *
     * @override
     */
    start() {
        if(!this.started) {
            this.transfers = {};
            for (const client of this.eds.getSdoServerParameters())
                this._addClient(client);

            this.addEdsCallback('newSdoClient',
                (client) => this._addClient(client));

            this.addEdsCallback('removeSdoClient',
                (client) => this._removeClient(client));

            super.start();
        }
    }

    /**
     * Stop the module.
     *
     * @override
     */
    stop() {
        if(this.started) {
            this.removeEdsCallback('newSdoClient');
            this.removeEdsCallback('removeSdoClient');

            for (const client of this.eds.getSdoServerParameters())
                this._removeClient(client);

            super.stop();
        }
    }

    /**
     * Call when a new CAN message is received.
     *
     * @param {object} message - CAN frame.
     * @param {number} message.id - CAN message identifier.
     * @param {Buffer} message.data - CAN message data;
     * @override
     */
    receive({ id, data }) {
        // Handle transfers as a server (local object dictionary)
        const client = this.transfers[id];
        if (client === undefined)
            return;

        if (client.blockTransfer) {
            // Block transfer in progress
            if ((data[0] & 0x7f) === client.blockSequence + 1) {
                client.data = Buffer.concat([client.data, data.slice(1)]);
                client.blockSequence++;
                if (data[0] & 0x80) {
                    client.blockFinished = true;
                    client.blockTransfer = false;
                }
            }

            if (client.blockSequence > 127) {
                this._abortTransfer(client, SdoCode.BAD_BLOCK_SEQUENCE);
                return;
            }

            client.refresh();

            // Awknowledge block
            if (client.blockFinished
                || client.blockSequence == this.blockSize) {

                const header = (ServerCommand.BLOCK_DOWNLOAD << 5)
                    | (2 << 0); // Block download response

                const sendBuffer = Buffer.alloc(8);
                sendBuffer.writeUInt8(header);
                sendBuffer.writeInt8(client.blockSequence, 1);
                sendBuffer.writeUInt8(this.blockSize, 2);
                client.blockSequence = 0; // Reset sequence
                this.send(client.cobId, sendBuffer);
            }

            return;
        }

        switch (data[0] >> 5) {
            case ClientCommand.DOWNLOAD_SEGMENT:
                this._downloadSegment(client, data);
                break;
            case ClientCommand.DOWNLOAD_INITIATE:
                this._downloadInitiate(client, data);
                break;
            case ClientCommand.UPLOAD_INITIATE:
                this._uploadInitiate(client, data);
                break;
            case ClientCommand.UPLOAD_SEGMENT:
                this._uploadSegment(client, data);
                break;
            case ClientCommand.ABORT:
                client.reject();
                break;
            case ClientCommand.BLOCK_UPLOAD:
                switch (data[0] & 0x3) {
                    case 0:
                        // Initiate upload
                        this._blockUploadInitiate(client, data);
                        break;
                    case 1:
                        // End upload
                        this._blockUploadEnd(client);
                        break;
                    case 2:
                        // Confirm block
                        this._blockUploadConfirm(client, data);
                        break;
                    case 3:
                        // Start upload
                        this._blockUploadProcess(client);
                        break;
                }
                break;
            case ClientCommand.BLOCK_DOWNLOAD:
                this._blockDownload(client, data);
                break;
            default:
                this._abortTransfer(client, SdoCode.BAD_COMMAND);
                break;
        }
    }

    /**
     * Add an SDO client.
     *
     * @param {object} args - SDO client parameters.
     * @param {number} args.cobIdTx - COB-ID server -> client.
     * @param {number} args.cobIdRx - COB-ID client -> server.
     * @private
     */
    _addClient({ cobIdTx, cobIdRx }) {
        this.transfers[cobIdRx] = new SdoTransfer({ cobId: cobIdTx });
    }

    /**
     * Remove an SDO client.
     *
     * @param {object} args - SDO client parameters.
     * @param {number} args.cobIdRx - COB-ID client -> server.
     * @private
     */
    _removeClient({ cobIdRx }) {
        const transfer = this.transfers[cobIdRx];
        if(transfer) {
            if (transfer.active)
                this._abortTransfer(transfer, SdoCode.DEVICE_STATE);

            delete this.transfers[cobIdRx];
        }
    }

    /**
     * Handle ClientCommand.DOWNLOAD_INITIATE.
     *
     * @param {SdoTransfer} client - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _downloadInitiate(client, data) {
        client.index = data.readUInt16LE(1);
        client.subIndex = data.readUInt8(3);

        const sendBuffer = Buffer.alloc(8);
        if (data[0] & 0x02) {
            // Expedited client
            let entry = this.eds.getEntry(client.index);
            if (entry === undefined) {
                this._abortTransfer(client, SdoCode.OBJECT_UNDEFINED);
                return;
            }

            if (entry.subNumber > 0) {
                entry = entry[client.subIndex];
                if (entry === undefined) {
                    this._abortTransfer(client, SdoCode.BAD_SUB_INDEX);
                    return;
                }
            }

            if (entry.accessType == AccessType.CONSTANT
                || entry.accessType == AccessType.READ_ONLY) {
                this._abortTransfer(client, SdoCode.READ_ONLY);
                return;
            }

            const count = (data[0] & 1) ? (4 - ((data[0] >> 2) & 3)) : 4;
            const raw = Buffer.alloc(count);
            data.copy(raw, 0, 4, count + 4);

            const value = rawToType(raw, entry.dataType);
            if (entry.highLimit !== undefined && value > entry.highLimit) {
                this._abortTransfer(client, SdoCode.VALUE_HIGH);
                return;
            }

            if (entry.lowLimit !== undefined && value < entry.lowLimit) {
                this._abortTransfer(client, SdoCode.VALUE_LOW);
                return;
            }

            entry.raw = raw;

            sendBuffer.writeUInt8(ServerCommand.DOWNLOAD_INITIATE << 5);
            sendBuffer.writeUInt16LE(client.index, 1);
            sendBuffer.writeUInt8(client.subIndex, 3);
        }
        else {
            // Segmented client
            client.data = Buffer.alloc(0);
            client.size = 0;
            client.toggle = 0;
            client.start();

            sendBuffer.writeUInt8(ServerCommand.DOWNLOAD_INITIATE << 5);
            sendBuffer.writeUInt16LE(client.index, 1);
            sendBuffer.writeUInt8(client.subIndex, 3);
        }

        this.send(client.cobId, sendBuffer);
    }

    /**
     * Handle ClientCommand.UPLOAD_INITIATE.
     *
     * @param {SdoTransfer} client - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _uploadInitiate(client, data) {
        client.index = data.readUInt16LE(1);
        client.subIndex = data.readUInt8(3);

        let entry = this.eds.getEntry(client.index);
        if (entry === undefined) {
            this._abortTransfer(client, SdoCode.OBJECT_UNDEFINED);
            return;
        }

        if (entry.subNumber > 0) {
            entry = entry[client.subIndex];
            if (entry === undefined) {
                this._abortTransfer(client, SdoCode.BAD_SUB_INDEX);
                return;
            }
        }

        if (entry.accessType == AccessType.WRITE_ONLY) {
            this._abortTransfer(client, SdoCode.WRITE_ONLY);
            return;
        }

        const sendBuffer = Buffer.alloc(8);
        if (entry.size <= 4) {
            // Expedited client
            const header = (ServerCommand.UPLOAD_INITIATE << 5)
                | ((4 - entry.size) << 2)
                | 0x2;

            sendBuffer.writeUInt8(header, 0);
            sendBuffer.writeUInt16LE(client.index, 1);
            sendBuffer.writeUInt8(client.subIndex, 3);

            entry.raw.copy(sendBuffer, 4);

            if (entry.size < 4)
                sendBuffer[0] |= ((4 - entry.size) << 2) | 0x1;
        }
        else {
            // Segmented client
            client.data = Buffer.from(entry.raw);
            client.size = 0;
            client.toggle = 0;
            client.start();

            const header = (ServerCommand.UPLOAD_INITIATE << 5) | 0x1;

            sendBuffer.writeUInt8(header, 0);
            sendBuffer.writeUInt16LE(client.index, 1);
            sendBuffer.writeUInt8(client.subIndex, 3);
            sendBuffer.writeUInt32LE(client.data.length, 4);
        }

        this.send(client.cobId, sendBuffer);
    }

    /**
     * Handle ClientCommand.UPLOAD_SEGMENT.
     *
     * @param {SdoTransfer} client - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _uploadSegment(client, data) {
        if ((data[0] & 0x10) != (client.toggle << 4)) {
            this._abortTransfer(client, SdoCode.TOGGLE_BIT);
            return;
        }

        const sendBuffer = Buffer.alloc(8);
        let count = Math.min(7, (client.data.length - client.size));
        client.data.copy(
            sendBuffer, 1, client.size, client.size + count);

        let header = (client.toggle << 4) | (7 - count) << 1;
        if (client.size == client.data.length) {
            header |= 1;
            client.resolve();
        }

        sendBuffer.writeUInt8(header, 0);
        client.toggle ^= 1;
        client.size += count;
        client.refresh();

        this.send(client.cobId, sendBuffer);
    }

    /**
     * Handle ClientCommand.DOWNLOAD_SEGMENT.
     *
     * @param {SdoTransfer} client - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _downloadSegment(client, data) {
        if ((data[0] & 0x10) != (client.toggle << 4)) {
            this._abortTransfer(client, SdoCode.TOGGLE_BIT);
            return;
        }

        const count = (7 - ((data[0] >> 1) & 0x7));
        const payload = data.slice(1, count + 1);
        const size = client.data.length + count;

        client.data = Buffer.concat([client.data, payload], size);

        if (data[0] & 1) {
            let entry = this.eds.getEntry(client.index);
            if (entry === undefined) {
                this._abortTransfer(client, SdoCode.OBJECT_UNDEFINED);
                return;
            }

            if (entry.subNumber > 0) {
                entry = entry[client.subIndex];
                if (entry === undefined) {
                    this._abortTransfer(client, SdoCode.BAD_SUB_INDEX);
                    return;
                }
            }

            if (entry.accessType == AccessType.CONSTANT
                || entry.accessType == AccessType.READ_ONLY) {
                this._abortTransfer(client, SdoCode.READ_ONLY);
                return;
            }

            const raw = Buffer.alloc(size);
            client.data.copy(raw);

            const value = rawToType(raw, entry.dataType);
            if (entry.highLimit !== undefined && value > entry.highLimit) {
                this._abortTransfer(client, SdoCode.VALUE_HIGH);
                return;
            }

            if (entry.lowLimit !== undefined && value < entry.lowLimit) {
                this._abortTransfer(client, SdoCode.VALUE_LOW);
                return;
            }

            entry.raw = raw;

            client.resolve();
        }

        const sendBuffer = Buffer.alloc(8);
        const header = (ServerCommand.DOWNLOAD_SEGMENT << 5)
            | (client.toggle << 4);

        sendBuffer.writeUInt8(header);
        client.toggle ^= 1;
        client.refresh();

        this.send(client.cobId, sendBuffer);
    }

    /**
     * Download a data block.
     *
     * Sub-blocks are scheduled on the event loop to avoid blocking during
     * large transfers.
     *
     * @param {SdoTransfer} client - SDO context.
     * @fires Protocol#message
     * @private
     */
    _blockUploadProcess(client) {
        if (!client.active) {
            // Transfer was interrupted
            return;
        }

        const sendBuffer = Buffer.alloc(8);
        const offset = 7 * (client.blockSequence
            + (client.blockCount * client.blockSize));

        sendBuffer[0] = ++client.blockSequence;
        if ((offset + 7) >= client.data.length) {
            sendBuffer[0] |= 0x80; // Last block
            client.blockFinished = true;
        }

        client.data.copy(sendBuffer, 1, offset, offset + 7);
        client.refresh();

        // Schedule next call
        if (!client.blockFinished && client.blockSequence < client.blockSize) {
            if(this._blockInterval === 0) {
                // Fire segments as fast as possible
                setImmediate(() => this._blockUploadProcess(client));
            }
            else {
                // If blockInterval is undefined, then default to 1 ms
                setTimeout(() => this._blockUploadProcess(client),
                    this._blockInterval || 1);
            }
        }

        this.send(client.cobId, sendBuffer);
    }

    /**
     * Handle ClientCommand.BLOCK_UPLOAD.
     *
     * @param {SdoTransfer} client - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _blockUploadInitiate(client, data) {
        client.index = data.readUInt16LE(1);
        client.subIndex = data.readUInt8(3);
        client.blockSize = data.readUInt32LE(4);
        client.blockCrc = !!(data[0] & (1 << 2));

        let entry = this.eds.getEntry(client.index);
        if (entry === undefined) {
            this._abortTransfer(client, SdoCode.OBJECT_UNDEFINED);
            return;
        }

        if (entry.subNumber > 0) {
            entry = entry[client.subIndex];
            if (entry === undefined) {
                this._abortTransfer(client, SdoCode.BAD_SUB_INDEX);
                return;
            }
        }

        if (entry.accessType == AccessType.WRITE_ONLY) {
            this._abortTransfer(client, SdoCode.WRITE_ONLY);
            return;
        }

        client.data = Buffer.from(entry.raw);
        client.size = 0;
        client.blockCount = 0;
        client.blockSequence = 0;
        client.blockFinished = false;
        client.start();

        // Confirm transfer
        const header = (ServerCommand.BLOCK_UPLOAD << 5)
            | (1 << 2)      // CRC supported
            | (1 << 1);     // Data size indicated

        const sendBuffer = Buffer.alloc(8);
        sendBuffer.writeUInt8(header);
        sendBuffer.writeUInt16LE(client.index, 1);
        sendBuffer.writeUInt8(client.subIndex, 3);
        sendBuffer.writeUInt32LE(client.data.length, 4);

        this.send(client.cobId, sendBuffer);
    }

    /**
     * Handle ClientCommand.BLOCK_UPLOAD.
     *
     * @param {SdoTransfer} client - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _blockUploadConfirm(client, data) {
        // Check that all sub-blocks were received.
        if (data[1] === client.blockSequence) {
            client.blockCount += 1;
            client.blockSequence = 0;

            if (client.blockFinished) {
                // End block upload
                const sendBuffer = Buffer.alloc(8);

                let header = (ServerCommand.BLOCK_UPLOAD << 5)
                    | (1 << 0); // End block upload

                const emptyBytes = client.data.length % 7;
                if (emptyBytes)
                    header |= (7 - emptyBytes) << 2;

                sendBuffer.writeUInt8(header);

                // Write CRC (if supported)
                if (client.blockCrc) {
                    const crcValue = calculateCrc(client.data);
                    sendBuffer.writeUInt16LE(crcValue, 1);
                }

                client.refresh();

                this.send(client.cobId, sendBuffer);
                return;
            }
        }

        // Update block size for next transfer.
        client.blockSize = data[2];
        if (client.blockSize < 1 || client.blockSize > 127) {
            this._abortTransfer(client, SdoCode.BAD_BLOCK_SIZE);
            return;
        }

        // Upload next block
        this._blockUploadProcess(client);
    }

    /**
     * Handle ClientCommand.BLOCK_UPLOAD.
     *
     * @param {SdoTransfer} client - SDO context.
     * @fires Protocol#message
     * @private
     */
    _blockUploadEnd(client) {
        client.resolve();
    }

    /**
     * Handle ClientCommand.BLOCK_DOWNLOAD.
     *
     * @param {SdoTransfer} client - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _blockDownload(client, data) {
        if (client.blockFinished) {
            // Number of bytes that do not contain segment data
            const count = (data[0] >> 2) & 7;
            if (count) {
                const size = client.data.length - count;
                client.data = client.data.slice(0, size);
            }

            // Check size
            if (client.data.length < client.size) {
                this._abortTransfer(client, SdoCode.DATA_SHORT);
                return;
            }

            if (client.data.length > client.size) {
                this._abortTransfer(client, SdoCode.DATA_LONG);
                return;
            }

            // Check CRC (if supported)
            if (client.blockCrc) {
                const crcValue = data.readUInt16LE(1);
                if (crcValue !== calculateCrc(client.data)) {
                    this._abortTransfer(client, SdoCode.BAD_BLOCK_CRC);
                    return;
                }
            }

            // Get entry
            let entry = this.eds.getEntry(client.index);
            if (entry === undefined) {
                this._abortTransfer(client, SdoCode.OBJECT_UNDEFINED);
                return;
            }

            if (entry.subNumber > 0) {
                entry = entry[client.subIndex];
                if (entry === undefined) {
                    this._abortTransfer(client, SdoCode.BAD_SUB_INDEX);
                    return;
                }
            }

            // Check that the entry has write access
            if (entry.accessType == AccessType.CONSTANT
                || entry.accessType == AccessType.READ_ONLY) {
                this._abortTransfer(client, SdoCode.READ_ONLY);
                return;
            }

            // Check value limits
            const value = rawToType(client.data, entry.dataType);
            if (entry.highLimit !== undefined && value > entry.highLimit) {
                this._abortTransfer(client, SdoCode.VALUE_HIGH);
                return;
            }

            if (entry.lowLimit !== undefined && value < entry.lowLimit) {
                this._abortTransfer(client, SdoCode.VALUE_LOW);
                return;
            }

            // Write new data
            entry.raw = client.data;

            // End transfer
            const header = (ServerCommand.BLOCK_DOWNLOAD << 5)
                | (1 << 0); // End block download

            const sendBuffer = Buffer.alloc(8);
            sendBuffer.writeUInt8(header);

            this.send(client.cobId, sendBuffer);

            client.resolve(); // Resolve the promise
        }
        else {
            // Initiate block transfer
            client.index = data.readUInt16LE(1);
            client.subIndex = data.readUInt8(3);
            client.size = data.readUInt32LE(4);
            client.data = Buffer.alloc(0);
            client.blockTransfer = true;
            client.blockSequence = 0;
            client.blockFinished = false;
            client.blockCrc = !!(data[0] & (1 << 2));

            // Confirm transfer
            const header = (ServerCommand.BLOCK_DOWNLOAD << 5)
                | (1 << 2); // CRC supported

            const sendBuffer = Buffer.alloc(8);
            sendBuffer.writeUInt8(header);
            sendBuffer.writeUInt16LE(client.index, 1);
            sendBuffer.writeUInt8(client.subIndex, 3);
            sendBuffer.writeUInt8(this.blockSize, 4);
            client.start();
            this.send(client.cobId, sendBuffer);
        }
    }

    /**
     * Abort a transfer.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @param {SdoCode} code - SDO abort code.
     * @fires Protocol#message
     * @private
     */
    _abortTransfer(transfer, code) {
        const sendBuffer = Buffer.alloc(8);
        sendBuffer.writeUInt8(0x80);
        sendBuffer.writeUInt16LE(transfer.index, 1);
        sendBuffer.writeUInt8(transfer.subIndex, 3);
        sendBuffer.writeUInt32LE(code, 4);
        this.send(transfer.cobId, sendBuffer);
        transfer.reject(code);
    }
}


module.exports = exports = { SdoServer };
