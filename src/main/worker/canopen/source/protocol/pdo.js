/**
 * @file Implements the CANopen Process Data Object (PDO) protocol.
 * @author Wilkins White
 * @copyright 2024 Daxbot
 */

const Protocol = require('./protocol');
const { DataObject, Eds, EdsError } = require('../eds');
const { deprecate } = require('util');

/**
 * CANopen PDO protocol handler.
 *
 * The process data object (PDO) protocol follows a producer-consumer structure
 * where one device broadcasts data that can be consumed by any device on the
 * network. Unlike the SDO protocol, PDO transfers are performed with no
 * protocol overhead.
 *
 * @param {Eds} eds - Eds object.
 * @see CiA301 "Process data objects (PDO)" (§7.2.2)
 * @implements {Protocol}
 */
class Pdo extends Protocol {
    constructor(eds) {
        super(eds);

        this.receiveMap = {};
        this.transmitMap = {};
        this.eventTimers = {};
        this.events = [];
        this.syncTpdo = {};
        this.syncCobId = null;
        this.updateFlags = {};
    }

    /**
     * Service: PDO write
     *
     * @param {number} cobId - mapped TPDO to send.
     * @fires Protocol#message
     */
    write(cobId) {
        const pdo = this.transmitMap[cobId];
        if (!pdo)
            throw new EdsError(`TPDO 0x${cobId.toString(16)} not mapped.`);

        const data = Buffer.alloc(pdo.dataSize);
        let dataOffset = 0;

        for (const obj of pdo.dataObjects) {
            obj.raw.copy(data, dataOffset);
            dataOffset += obj.raw.length;
        }

        this.send(cobId, data);
    }

    /**
     * Start the module.
     *
     * @override
     */
    start() {
        if(!this.started) {
            const obj1005 = this.eds.getEntry(0x1005);
            if(obj1005)
                this._addEntry(obj1005);

            this.addEdsCallback('newEntry', (obj) => this._addEntry(obj));
            this.addEdsCallback('removeEntry', (obj) => this._removeEntry(obj));

            this.receiveMap = {};
            for (const pdo of this.eds.getReceivePdos())
                this._addRpdo(pdo);

            this.addEdsCallback('newRpdo', (pdo) => this._addRpdo(pdo));
            this.addEdsCallback('removeRpdo', (pdo) => this._removeRpdo(pdo));

            this.transmitMap = {};
            for (const pdo of this.eds.getTransmitPdos())
                this._addTpdo(pdo);

            this.addEdsCallback('newTpdo', (pdo) => this._addTpdo(pdo));
            this.addEdsCallback('removeTpdo', (pdo) => this._removeTpdo(pdo));

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
            this.removeEdsCallback('newEntry');
            this.removeEdsCallback('removeEntry');

            const obj1005 = this.eds.getEntry(0x1005);
            if(obj1005)
                this._removeEntry(obj1005);

            this.removeEdsCallback('newRpdo');
            this.removeEdsCallback('removeRpdo');

            for (const pdo of this.eds.getReceivePdos())
                this._removeRpdo(pdo);

            this.removeEdsCallback('newTpdo');
            this.removeEdsCallback('removeTpdo');

            for (const pdo of this.eds.getTransmitPdos())
                this._removeTpdo(pdo);

            super.stop();
        }
    }

    /**
     * Call when a new CAN message is received.
     *
     * @param {object} message - CAN frame.
     * @param {number} message.id - CAN message identifier.
     * @param {Buffer} message.data - CAN message data;
     * @fires Pdo#pdo
     * @override
     */
    receive({ id, data }) {
        if ((id & 0x7FF) === this.syncCobId) {
            const counter = data[1];
            for (const pdo of Object.values(this.syncTpdo)) {
                if (pdo.started) {
                    if (pdo.transmissionType == 0) {
                        // Acyclic - send only if data changed
                        this.write(pdo.cobId, true);
                    }
                    else if (++pdo.counter >= pdo.transmissionType) {
                        // Cyclic - send every 'n' sync objects
                        this.write(pdo.cobId);
                        pdo.counter = 0;
                    }
                }
                else if (counter >= pdo.syncStart) {
                    pdo.started = true;
                    pdo.counter = 0;
                }
            }
            return;
        }

        const pdo = this.receiveMap[id];
        if(pdo) {
            let dataOffset = 0;

            let updated = false;
            for (const obj of pdo.dataObjects) {
                const size = obj.size;
                if (data.length < dataOffset + size)
                    continue;

                const lastValue = obj.value;
                data.copy(obj.raw, 0, dataOffset, dataOffset + size);
                dataOffset += obj.raw.length;

                if (!updated && lastValue !== obj.value)
                    updated = true;
            }

            if (updated)
                this._emitPdo(pdo);
        }
    }

    /**
     * Listens for new Eds entries.
     *
     * @param {DataObject} entry - new entry.
     * @private
     */
    _addEntry(entry) {
        if(entry.index === 0x1005) {
            this.addUpdateCallback(entry, (obj) => this._parse1005(obj));
            this._parse1005(entry);
        }
    }

    /**
     * Listens for removed Eds entries.
     *
     * @param {DataObject} entry - removed entry.
     * @private
     */
    _removeEntry(entry) {
        if(entry.index === 0x1005) {
            this.removeUpdateCallback(entry);
            this._clear1005();
        }
    }

    /**
     * Called when 0x1005 (COB-ID SYNC) is updated.
     *
     * @param {DataObject} entry - updated DataObject.
     * @private
     */
    _parse1005(entry) {
        const value = entry.value;
        const rtr = (value >> 29) & 0x1;
        const cobId = value & 0x7FF;

        if(rtr != 0x1)
            this.syncCobId = cobId;
        else
            this._clear1005();
    }

    /**
     * Called when 0x1005 (COB-ID SYNC) is removed.
     *
     * @private
     */
    _clear1005() {
        this.syncCobId = null;
    }

    /**
     * Add an RPDO.
     *
     * @param {object} pdo - PDO data.
     * @private
     */
    _addRpdo(pdo) {
        this.receiveMap[pdo.cobId] = pdo;
    }

    /**
     * Remove an RPDO.
     *
     * @param {object} pdo - PDO data.
     * @private
     */
    _removeRpdo(pdo) {
        delete this.receiveMap[pdo.cobId];
    }

    /**
     * Add a TPDO.
     *
     * @param {object} pdo - PDO data.
     * @private
     */
    _addTpdo(pdo) {
        this.transmitMap[pdo.cobId] = pdo;

        if (pdo.transmissionType < 0xF1) {
            // Sent on SYNC
            if (!pdo.syncStart) {
                pdo.started = true;
                pdo.counter = 0;
            }

            this.syncTpdo[pdo.cobId] = pdo;
        }
        else if (pdo.transmissionType == 0xFE) {
            if (pdo.eventTime > 0) {
                // Send on a timer
                const timer = setInterval(
                    () => this.write(pdo.cobId), pdo.eventTime);

                this.eventTimers[pdo.cobId] = timer;
            }
            else if (pdo.inhibitTime > 0) {
                // Send on update, but no faster than the inhibit time
                this.updateFlags[pdo.cobId] = false;
                this.eventTimers[pdo.cobId] = setInterval(() => {
                    if(this.updateFlags[pdo.cobId]) {
                        this.updateFlags[pdo.cobId] = false;
                        this.write(pdo.cobId);
                    }
                }, pdo.inhibitTime);

                for (const obj of pdo.dataObjects) {
                    const key = pdo.cobId.toString(16) + ':' + obj.key;
                    const callback = () => {
                        this.updateFlags[pdo.cobId] = true;
                    };

                    this.addUpdateCallback(obj, callback, key);
                }
            }
            else {
                // Send immediately on value change
                for (const obj of pdo.dataObjects) {
                    const key = pdo.cobId.toString(16) + ':' + obj.key;
                    const callback = () => {
                        this.write(pdo.cobId);
                    };

                    this.addUpdateCallback(obj, callback, key);
                }
            }
        }
    }

    /**
     * Remove a TPDO.
     *
     * @param {object} pdo - PDO data.
     * @private
     */
    _removeTpdo(pdo) {
        if (pdo.transmissionType < 0xF1) {
            delete this.syncTpdo[pdo.cobId];
        }
        else if (pdo.transmissionType == 0xFE) {
            if (pdo.eventTime > 0) {
                clearInterval(this.eventTimers[pdo.cobId]);
                delete this.eventTimers[pdo.cobId];
            }
            else if (pdo.inhibitTime > 0) {
                clearInterval(this.eventTimers[pdo.cobId]);
                delete this.eventTimers[pdo.cobId];
                delete this.updateFlags[pdo.cobId];

                for (const obj of pdo.dataObjects) {
                    const key = pdo.cobId.toString(16) + ':' + obj.key;
                    this.removeUpdateCallback(obj, key);
                }
            }
            else {
                for (const obj of pdo.dataObjects) {
                    const key = pdo.cobId.toString(16) + ':' + obj.key;
                    this.removeUpdateCallback(obj, key);
                }
            }
        }

        delete this.transmitMap[pdo.cobId];
    }

    /**
     * Emit a PDO object.
     *
     * @param {object} pdo - object to emit.
     * @fires Pdo#pdo
     * @private
     */
    _emitPdo(pdo) {
        /**
         * New Pdo data is available.
         *
         * @event Pdo#pdo
         * @type {object}
         * @property {number} cobId - object identifier.
         * @property {number} transmissionType - transmission type.
         * @property {number} inhibitTime - minimum time between updates.
         * @property {Array<DataObject>} dataObjects - mapped objects.
         */
        this.emit('pdo', pdo);
    }
}


module.exports = exports = { Pdo };
