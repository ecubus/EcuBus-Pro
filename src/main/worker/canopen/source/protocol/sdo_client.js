/**
 * @file Implements the CANopen Service Data Object (SDO) protocol client.
 * @author Wilkins White
 * @copyright 2024 Daxbot
 */

const Protocol = require('./protocol');
const { DataObject, Eds } = require('../eds');
const { DataType } = require('../types');
const { SdoCode, SdoTransfer, ClientCommand, ServerCommand } = require('./sdo');
const calculateCrc = require('../functions/crc');
const rawToType = require('../functions/raw_to_type');
const typeToRaw = require('../functions/type_to_raw');
const { deprecate } = require('util');

/**
 * Queue of pending transfers.
 *
 * @see https://medium.com/@karenmarkosyan/how-to-manage-promises-into-dynamic-queue-with-vanilla-javascript-9d0d1f8d4df5
 * @memberof SdoClient
 * @private
 */
class Queue {
    constructor() {
        this.queue = [];
        this.pending = false;
    }

    /**
     * Add a transfer to the queue.
     *
     * @param {Function} start - start the transfer.
     * @returns {Promise} resolves when the transfer is complete.
     */
    push(start) {
        return new Promise((resolve, reject) => {
            this.queue.push({ start, resolve, reject });
            this.pop();
        });
    }

    /** Run the next transfer in queue. */
    pop() {
        if (this.pending)
            return;

        const transfer = this.queue.shift();
        if (!transfer)
            return;

        this.pending = true;
        transfer.start().then((value) => {
            this.pending = false;
            transfer.resolve(value);
            this.pop();
        })
            .catch((error) => {
                this.pending = false;
                transfer.reject(error);
                this.pop();
            });
    }
}

/**
 * CANopen SDO protocol handler (Client).
 *
 * The service data object (SDO) protocol uses a client-server structure where
 * a client can initiate the transfer of data from the server's object
 * dictionary. An SDO is transfered as a sequence of segments with basic
 * error checking.
 *
 * @param {Eds} eds - Eds object.
 * @see CiA301 'Service data object (SDO)' (§7.2.4)
 * @implements {Protocol}
 */
class SdoClient extends Protocol {
    constructor(eds) {
        super(eds);
        this.sdoServers = [];
        this.transfers = {};
        this._blockSize = 127;
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
     * Service: SDO upload
     *
     * Read data from an SDO server.
     *
     * @param {object} args - arguments to destructure.
     * @param {number} args.deviceId - SDO server.
     * @param {number} args.index - data index to upload.
     * @param {number} args.subIndex - data subIndex to upload.
     * @param {DataType} [args.dataType] - expected data type.
     * @param {number} [args.timeout] - time before transfer is aborted.
     * @param {boolean} [args.blockTransfer] - use block transfer protocol.
     * @param {number} [args.blockInterval] - minimum time between data blocks.
     * @param {number} [args.cobIdRx] -  COB-ID server -> client.
     * @returns {Promise<Buffer | number | bigint | string | Date>} resolves when the upload is complete.
     * @fires Protocol#message
     */
    async upload(args) {
        const deviceId = args.deviceId || args.serverId;
        const index = args.index;
        const subIndex = args.subIndex || null;
        const timeout = args.timeout || 30;
        const dataType = args.dataType || null;
        const blockTransfer = args.blockTransfer || false;
        const blockInterval = args.blockInterval;
        const cobIdRx = args.cobIdRx || null;

        let server = this._getServer({ deviceId, cobIdRx });
        if (!server) {
            // User must call Eds#addSdoClientParameter() first.
            const id = deviceId.toString(16);
            throw new ReferenceError(`SDO server 0x${id} not mapped`);
        }

        if (index === undefined)
            throw ReferenceError('index must be defined');

        const data = await server.queue.push(() => {
            return new Promise((resolve, reject) => {
                const transfer = new SdoTransfer({
                    resolve,
                    reject,
                    index,
                    subIndex,
                    timeout,
                    blockInterval,
                    cobId: server.cobIdTx,
                });

                this.transfers[server.cobIdRx] = transfer;

                const sendBuffer = Buffer.alloc(8);
                sendBuffer.writeUInt16LE(index, 1);
                sendBuffer.writeUInt8(subIndex, 3);

                transfer.addListener('abort',
                    (code) => this._abortTransfer(transfer, code));

                transfer.start();

                if (blockTransfer)
                    this._blockUploadStart(transfer);
                else
                    this._uploadStart(transfer);
            });
        });

        return rawToType(data, dataType);
    }

    /**
     * Service: SDO download.
     *
     * Write data to an SDO server.
     *
     * @param {object} args - arguments to destructure.
     * @param {number} args.deviceId - SDO server.
     * @param {object} args.data - data to download.
     * @param {number} args.index - index or name to download to.
     * @param {number} args.subIndex - data subIndex to download to.
     * @param {DataType} [args.dataType] - type of data to download.
     * @param {number} [args.timeout] - time before transfer is aborted.
     * @param {boolean} [args.blockTransfer] - use block transfer protocol.
     * @param {number} [args.blockInterval] - minimum time between data blocks.
     * @param {number} [args.cobIdRx] -  COB-ID server -> client.
     * @fires Protocol#message
     */
    async download(args) {
        const deviceId = args.deviceId || args.serverId;
        const index = args.index;
        const subIndex = args.subIndex || null;
        const timeout = args.timeout || 30;
        const dataType = args.dataType || null;
        const blockTransfer = args.blockTransfer || false;
        const blockInterval = args.blockInterval;
        const cobIdRx = args.cobIdRx || null;

        let server = this._getServer({ deviceId, cobIdRx });
        if (server === undefined) {
            // User must call Eds#addSdoClientParameter() first.
            const id = deviceId.toString(16);
            throw new ReferenceError(`SDO server 0x${id} not mapped`);
        }

        if (index === undefined)
            throw ReferenceError('index must be defined');

        let data = args.data;
        if (!Buffer.isBuffer(data)) {
            if (DataObject.isDataObject(data)) {
                data = data.raw;
            }
            else {
                if (!dataType)
                    throw ReferenceError('dataType must be defined');

                data = typeToRaw(data, dataType);
                if (data === undefined)
                    throw TypeError(`unknown dataType ${dataType}`);
            }
        }

        await server.queue.push(() => {
            return new Promise((resolve, reject) => {
                const transfer = new SdoTransfer({
                    cobId: server.cobIdTx,
                    resolve,
                    reject,
                    index,
                    subIndex,
                    data,
                    timeout,
                    blockInterval,
                });

                this.transfers[server.cobIdRx] = transfer;

                const sendBuffer = Buffer.alloc(8);
                sendBuffer.writeUInt16LE(index, 1);
                sendBuffer.writeUInt8(subIndex, 3);

                transfer.addListener('abort',
                    (code) => this._abortTransfer(transfer, code));

                transfer.start();

                if (blockTransfer)
                    this._blockDownloadStart(transfer);
                else
                    this._downloadStart(transfer);

            });
        });
    }

    /**
     * Start the module.
     *
     * @override
     */
    start() {
        if(!this.started) {
            this.sdoServers = [];
            for (const server of this.eds.getSdoClientParameters())
                this._addServer(server);

            this.addEdsCallback('newSdoServer',
                (server) => this._addServer(server));

            this.addEdsCallback('removeSdoServer',
                (server) => this._removeServer(server));

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
            this.removeEdsCallback('newSdoServer');
            this.removeEdsCallback('removeSdoServer');

            for (const server of this.eds.getSdoClientParameters())
                this._removeServer(server);

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
        // Handle transfers as a client (remote object dictionary)
        const transfer = this.transfers[id];
        if (transfer === undefined || !transfer.active)
            return;

        if (transfer.blockTransfer) {
            // Block transfer in progress
            if ((data[0] & 0x7f) === transfer.blockSequence + 1) {
                transfer.data = Buffer.concat([transfer.data, data.slice(1)]);
                transfer.blockSequence++;
                if (data[0] & 0x80) {
                    transfer.blockFinished = true;
                    transfer.blockTransfer = false;
                }
            }

            if (transfer.blockSequence > 127) {
                this._abortTransfer(transfer, SdoCode.BAD_BLOCK_SEQUENCE);
                return;
            }

            transfer.refresh();

            // Acknowledge block
            if (transfer.blockFinished
                || transfer.blockSequence == this.blockSize) {

                const header = (ClientCommand.BLOCK_UPLOAD << 5)
                    | (2 << 0); // Block upload response

                const sendBuffer = Buffer.alloc(8);
                sendBuffer.writeUInt8(header);
                sendBuffer.writeInt8(transfer.blockSequence, 1);
                sendBuffer.writeUInt8(this.blockSize, 2);

                transfer.blockSequence = 0; // Reset sequence

                this.send(transfer.cobId, sendBuffer);
            }
            return;
        }

        switch (data[0] >> 5) {
            case ServerCommand.UPLOAD_SEGMENT:
                this._uploadSegment(transfer, data);
                break;
            case ServerCommand.DOWNLOAD_SEGMENT:
                this._downloadSegment(transfer, data);
                break;
            case ServerCommand.UPLOAD_INITIATE:
                this._uploadInitiate(transfer, data);
                break;
            case ServerCommand.DOWNLOAD_INITIATE:
                this._downloadInitiate(transfer);
                break;
            case ServerCommand.ABORT:
                this._abortTransfer(transfer, data.readUInt32LE(4));
                break;
            case ServerCommand.BLOCK_DOWNLOAD:
                switch (data[0] & 0x3) {
                    case 0:
                        // Initiate download
                        this._blockDownloadInitiate(transfer, data);
                        break;
                    case 1:
                        // End download
                        this._blockDownloadEnd(transfer);
                        break;
                    case 2:
                        // Confirm block
                        this._blockDownloadConfirm(transfer, data);
                        break;
                }
                break;
            case ServerCommand.BLOCK_UPLOAD:
                this._blockUpload(transfer, data);
                break;
            default:
                this._abortTransfer(transfer, SdoCode.BAD_COMMAND);
                break;
        }
    }

    /**
     * Returns the first SDO server matching deviceId.
     *
     * @param {object} args - SDO client parameters.
     * @param {number} args.deviceId - device identifier.
     * @param {number} args.cobIdRx - COB-ID server -> client.
     * @returns {object | null} server object if found.
     */
    _getServer({ deviceId, cobIdRx }) {
        for(const server of this.sdoServers) {
            if(server.deviceId === deviceId) {
                if(!cobIdRx || cobIdRx === server.cobIdRx)
                    return server;
            }
        }

        return null;
    }

    /**
     * Add an SDO server.
     *
     * @param {object} args - SDO client parameters.
     * @param {number} args.deviceId - device identifier.
     * @param {number} args.cobIdTx - COB-ID client -> server.
     * @param {number} args.cobIdRx - COB-ID server -> client.
     * @private
     */
    _addServer({ deviceId, cobIdTx, cobIdRx }) {
        this.sdoServers.push({
            deviceId,
            cobIdTx,
            cobIdRx,
            queue: new Queue(),
        });
    }

    /**
     * Remove an SDO server.
     *
     * @param {object} args - SDO client parameters.
     * @param {number} args.deviceId - device identifier.
     * @param {number} args.cobIdRx - COB-ID server -> client.
     * @private
     */
    _removeServer({ deviceId, cobIdRx }) {
        const transfer = this.transfers[cobIdRx];
        if (transfer) {
            if(transfer.active)
                this._abortTransfer(transfer, SdoCode.DEVICE_STATE);

            delete this.transfers[cobIdRx];
        }

        const sdoServers = [];
        for(const server of this.sdoServers) {
            if(server.deviceId === deviceId) {
                if(!cobIdRx || cobIdRx === server.cobIdRx)
                    continue; // Remove server
            }

            sdoServers.push(server);
        }

        this.sdoServers = sdoServers;
    }

    /**
     * Start an SDO upload.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @fires Protocol#message
     * @private
     */
    _uploadStart(transfer) {
        const sendBuffer = Buffer.alloc(8);
        sendBuffer.writeUInt16LE(transfer.index, 1);
        sendBuffer.writeUInt8(transfer.subIndex, 3);
        sendBuffer.writeUInt8(ClientCommand.UPLOAD_INITIATE << 5);
        this.send(transfer.cobId, sendBuffer);
    }

    /**
     * Handle ServerCommand.UPLOAD_INITIATE.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _uploadInitiate(transfer, data) {
        if (data[0] & 0x02) {
            // Expedited transfer
            const size = (data[0] & 1) ? (4 - ((data[0] >> 2) & 3)) : 4;
            transfer.resolve(data.slice(4, 4 + size));
        }
        else {
            // Segmented transfer
            const sendBuffer = Buffer.alloc(8);
            sendBuffer.writeUInt8(ClientCommand.UPLOAD_SEGMENT << 5);

            if (data[0] & 0x1)
                transfer.size = data.readUInt32LE(4);

            transfer.refresh();

            this.send(transfer.cobId, sendBuffer);
        }
    }

    /**
     * Handle ServerCommand.UPLOAD_SEGMENT.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _uploadSegment(transfer, data) {
        if (!transfer.active)
            return;

        if ((data[0] & 0x10) != (transfer.toggle << 4)) {
            this._abortTransfer(transfer, SdoCode.TOGGLE_BIT);
            return;
        }

        const count = (7 - ((data[0] >> 1) & 0x7));
        const payload = data.slice(1, count + 1);
        const size = transfer.data.length + count;
        const buffer = Buffer.concat([transfer.data, payload], size);

        if (data[0] & 1) {
            if (transfer.size != size) {
                this._abortTransfer(transfer, SdoCode.BAD_LENGTH);
                return;
            }

            transfer.resolve(buffer);
        }
        else {
            transfer.toggle ^= 1;
            transfer.data = buffer;
            transfer.refresh();

            const sendBuffer = Buffer.alloc(8);
            const header = (ClientCommand.UPLOAD_SEGMENT << 5)
                | (transfer.toggle << 4);

            sendBuffer.writeUInt8(header);

            this.send(transfer.cobId, sendBuffer);
        }
    }

    /**
     * Start an SDO download.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @fires Protocol#message
     * @private
     */
    _downloadStart(transfer) {
        const sendBuffer = Buffer.alloc(8);
        sendBuffer.writeUInt16LE(transfer.index, 1);
        sendBuffer.writeUInt8(transfer.subIndex, 3);

        const length = transfer.data.length;
        if (length > 4) {
            // Segmented transfer
            const header = (ClientCommand.DOWNLOAD_INITIATE << 5)
                | (1 << 0);             // Data size indicated

            sendBuffer.writeUInt8(header);
            sendBuffer.writeUInt32LE(length, 4);
        }
        else {
            // Expedited transfer
            const header = (ClientCommand.DOWNLOAD_INITIATE << 5)
                | ((4 - length) << 2)   // Number of empty bytes
                | (1 << 1)              // Expedited transfer
                | (1 << 0);             // Data size indicated

            sendBuffer.writeUInt8(header);
            transfer.data.copy(sendBuffer, 4);
        }

        this.send(transfer.cobId, sendBuffer);
    }

    /**
     * Handle ServerCommand.DOWNLOAD_INITIATE.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @fires Protocol#message
     * @private
     */
    _downloadInitiate(transfer) {
        if (transfer.size <= 4) {
            /* Expedited transfer. */
            transfer.resolve();
            return;
        }

        const sendBuffer = Buffer.alloc(8);
        transfer.size = Math.min(7, transfer.data.length);
        transfer.data.copy(sendBuffer, 1, 0, transfer.size);
        transfer.refresh();

        let header = (ClientCommand.DOWNLOAD_SEGMENT << 5)
            | ((7 - transfer.size) << 1);

        if (transfer.data.length == transfer.size)
            header |= 1;

        sendBuffer.writeUInt8(header);

        this.send(transfer.cobId, sendBuffer);
    }

    /**
     * Handle ServerCommand.DOWNLOAD_SEGMENT.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _downloadSegment(transfer, data) {
        if (!transfer.active)
            return;

        if ((data[0] & 0x10) != (transfer.toggle << 4)) {
            this._abortTransfer(transfer, SdoCode.TOGGLE_BIT);
            return;
        }

        if (transfer.size == transfer.data.length) {
            transfer.resolve();
            return;
        }

        const sendBuffer = Buffer.alloc(8);
        const count = Math.min(7, (transfer.data.length - transfer.size));

        transfer.data.copy(
            sendBuffer, 1, transfer.size, transfer.size + count);

        transfer.toggle ^= 1;
        transfer.size += count;
        transfer.refresh();

        let header = (ClientCommand.DOWNLOAD_SEGMENT << 5)
            | (transfer.toggle << 4)
            | ((7 - count) << 1);

        if (transfer.size == transfer.data.length)
            header |= 1;

        sendBuffer.writeUInt8(header);

        this.send(transfer.cobId, sendBuffer);
    }

    /**
     * Start an SDO block download.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @fires Protocol#message
     * @private
     */
    _blockDownloadStart(transfer) {
        const sendBuffer = Buffer.alloc(8);
        sendBuffer.writeUInt16LE(transfer.index, 1);
        sendBuffer.writeUInt8(transfer.subIndex, 3);

        const header = (ClientCommand.BLOCK_DOWNLOAD << 5)
            | (1 << 2)                  // CRC supported
            | (1 << 1);                 // Data size indicated

        sendBuffer.writeUInt8(header);
        sendBuffer.writeUInt32LE(transfer.data.length, 4);

        this.send(transfer.cobId, sendBuffer);
    }

    /**
     * Download a data block.
     *
     * Sub-blocks are scheduled on the event loop to avoid blocking during
     * large transfers.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @fires Protocol#message
     * @private
     */
    _blockDownloadProcess(transfer) {
        if (!transfer.active) {
            // Transfer was interrupted
            return;
        }

        const sendBuffer = Buffer.alloc(8);
        const offset = 7 * (transfer.blockSequence
            + (transfer.blockCount * transfer.blockSize));

        sendBuffer[0] = ++transfer.blockSequence;
        if ((offset + 7) >= transfer.data.length) {
            sendBuffer[0] |= 0x80; // Last block
            transfer.blockFinished = true;
        }

        transfer.data.copy(sendBuffer, 1, offset, offset + 7);
        transfer.refresh();

        // Schedule next call
        if (!transfer.blockFinished
            && transfer.blockSequence < transfer.blockSize) {
            if(transfer.blockInterval === 0) {
                // Fire segments as fast as possible
                setImmediate(() => this._blockDownloadProcess(transfer));
            }
            else {
                // If blockInterval is undefined, then default to 1 ms
                setTimeout(() => this._blockDownloadProcess(transfer),
                    transfer.blockInterval || 1)
            }
        }

        this.send(transfer.cobId, sendBuffer);
    }

    /**
     * Initiate an SDO block download.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _blockDownloadInitiate(transfer, data) {
        transfer.blockCrc = !!(data[0] & (1 << 2));
        transfer.blockSize = data[4];
        transfer.blockCount = 0;
        transfer.blockSequence = 0;
        transfer.blockFinished = false;

        if (transfer.blockSize < 1 || transfer.blockSize > 127) {
            this._abortTransfer(transfer, SdoCode.BAD_BLOCK_SIZE);
            return;
        }

        // Download first block
        this._blockDownloadProcess(transfer);
    }

    /**
     * Confirm the previous block and send the next one.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _blockDownloadConfirm(transfer, data) {
        // Check that all sub-blocks were received.
        if (data[1] === transfer.blockSequence) {
            transfer.blockCount += 1;
            transfer.blockSequence = 0;

            if (transfer.blockFinished) {
                // End block download
                const sendBuffer = Buffer.alloc(8);

                let header = (ClientCommand.BLOCK_DOWNLOAD << 5)
                    | (1 << 0); // End block download

                const emptyBytes = transfer.data.length % 7;
                if (emptyBytes)
                    header |= (7 - emptyBytes) << 2;

                sendBuffer.writeUInt8(header);

                // Write CRC (if supported)
                if (transfer.blockCrc) {
                    const crcValue = calculateCrc(transfer.data);
                    sendBuffer.writeUInt16LE(crcValue, 1);
                }

                transfer.refresh();

                this.send(transfer.cobId, sendBuffer);
                return;
            }
        }

        // Update block size for next transfer.
        transfer.blockSize = data[2];
        if (transfer.blockSize < 1 || transfer.blockSize > 127) {
            this._abortTransfer(transfer, SdoCode.BAD_BLOCK_SIZE);
            return;
        }

        // Download next block
        this._blockDownloadProcess(transfer);
    }

    /**
     * Confirm the previous block and send the next one.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @fires Protocol#message
     * @private
     */
    _blockDownloadEnd(transfer) {
        transfer.resolve();
    }

    /**
     * Start an SDO block upload.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @fires Protocol#message
     * @private
     */
    _blockUploadStart(transfer) {
        const sendBuffer = Buffer.alloc(8);
        sendBuffer.writeUInt16LE(transfer.index, 1);
        sendBuffer.writeUInt8(transfer.subIndex, 3);

        const header = (ClientCommand.BLOCK_UPLOAD << 5)
            | (1 << 2); // CRC supported

        sendBuffer.writeUInt8(header);
        sendBuffer.writeUInt16LE(this.blockSize, 4);

        this.send(transfer.cobId, sendBuffer);
    }

    /**
     * Handle ServerCommand.BLOCK_UPLOAD.
     *
     * @param {SdoTransfer} transfer - SDO context.
     * @param {Buffer} data - message data.
     * @fires Protocol#message
     * @private
     */
    _blockUpload(transfer, data) {
        if (transfer.blockFinished) {
            // Number of bytes that do not contain segment data
            const count = (data[0] >> 2) & 7;
            if (count) {
                const size = transfer.data.length - count;
                transfer.data = transfer.data.slice(0, size);
            }

            // Check size
            if (transfer.data.length < transfer.size) {
                this._abortTransfer(transfer, SdoCode.DATA_SHORT);
                return;
            }

            if (transfer.data.length > transfer.size) {
                this._abortTransfer(transfer, SdoCode.DATA_LONG);
                return;
            }

            // Check CRC (if supported)
            if (transfer.blockCrc) {
                const crcValue = data.readUInt16LE(1);
                if (crcValue !== calculateCrc(transfer.data)) {
                    this._abortTransfer(transfer, SdoCode.BAD_BLOCK_CRC);
                    return;
                }
            }

            // End transfer
            const header = (ClientCommand.BLOCK_UPLOAD << 5)
                | (1 << 0); // End block upload

            const sendBuffer = Buffer.alloc(8);
            sendBuffer.writeUInt8(header);

            this.send(transfer.cobId, sendBuffer);

            transfer.resolve(transfer.data); // Resolve the promise
        }
        else {
            // Initiate block transfer
            transfer.index = data.readUInt16LE(1);
            transfer.subIndex = data.readUInt8(3);
            transfer.size = data.readUInt32LE(4);
            transfer.data = Buffer.alloc(0);
            transfer.blockTransfer = true;
            transfer.blockSequence = 0;
            transfer.blockFinished = false;
            transfer.blockCrc = !!(data[0] & (1 << 2));
            transfer.refresh();

            // Confirm transfer
            const header = (ClientCommand.BLOCK_UPLOAD << 5)
                | (3 << 0); // Start upload

            const sendBuffer = Buffer.alloc(8);
            sendBuffer.writeUInt8(header);

            this.send(transfer.cobId, sendBuffer);
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


module.exports = exports = { SdoClient };
