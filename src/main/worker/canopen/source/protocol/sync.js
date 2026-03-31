/**
 * @file Implements the CANopen Synchronization (SYNC) protocol.
 * @author Wilkins White
 * @copyright 2024 Daxbot
 */

const Protocol = require('./protocol');
const { Eds, EdsError } = require('../eds');
const { deprecate } = require('util');

/**
 * CANopen SYNC protocol handler.
 *
 * The synchronization (SYNC) protocol follows a producer-consumer structure
 * that provides a basic network synchronization mechanism. There should be
 * at most one sync producer on the network at a time.
 *
 * @param {Eds} eds - Eds object.
 * @see CiA301 "Synchronization object (SYNC)" (§7.2.5)
 * @implements {Protocol}
 */
class Sync extends Protocol {
    constructor(eds) {
        super(eds);

        this.syncCounter = 0;
        this.syncTimer = null;
        this._overflow = 0;
        this._cobId = null;
        this._generate = false;
    }

    /**
     * Get object 0x1005 [bit 30] - Sync generation enable.
     *
     * @type {boolean}
     * @deprecated Use {@link Eds#getSyncGenerationEnable} instead.
     */
    get generate() {
        return this.eds.getSyncGenerationEnable();
    }

    /**
     * Set object 0x1005 [bit 30] - Sync generation enable.
     *
     * @type {boolean}
     * @deprecated Use {@link Eds#setSyncGenerationEnable} instead.
     */
    set generate(enable) {
        this.eds.setSyncGenerationEnable(enable);
    }

    /**
     * Get object 0x1005 - COB-ID SYNC.
     *
     * @type {number}
     * @deprecated Use {@link Eds#getSyncCobId} instead.
     */
    get cobId() {
        return this.eds.getSyncCobId();
    }

    /**
     * Set object 0x1005 - COB-ID SYNC.
     *
     * @type {number}
     * @deprecated Use {@link Eds#setSyncCobId} instead.
     */
    set cobId(cobId) {
        this.eds.setSyncCobId(cobId);
    }

    /**
     * Get object 0x1006 - Communication cycle period.
     *
     * @type {number}
     * @deprecated Use {@link Eds#getSyncCyclePeriod} instead.
     */
    get cyclePeriod() {
        return this.eds.getSyncCyclePeriod();
    }

    /**
     * Set object 0x1006 - Communication cycle period.
     *
     * @type {number}
     * @deprecated Use {@link Eds#setSyncCyclePeriod} instead.
     */
    set cyclePeriod(period) {
        this.eds.setSyncCyclePeriod(period);
    }

    /**
     * Get object 0x1019 - Synchronous counter overflow value.
     *
     * @type {number}
     * @deprecated Use {@link Eds#getSyncOverflow} instead.
     */
    get overflow() {
        return this.eds.getSyncOverflow();
    }

    /**
     * Set object 0x1019 - Synchronous counter overflow value.
     *
     * @type {number}
     * @deprecated Use {@link Eds#setSyncOverflow} instead.
     */
    set overflow(overflow) {
        this.eds.setSyncOverflow(overflow);
    }

    /**
     * Service: SYNC write.
     *
     * @param {number | null} counter - sync counter;
     * @fires Protocol#message
     */
    write(counter = null) {
        if(!this._generate)
            throw new EdsError('SYNC generation is disabled');

        if (!this._cobId)
            throw new EdsError('COB-ID SYNC may not be 0');

        if(counter !== null)
            this.send(this._cobId, Buffer.from([counter]));
        else
            this.send(this._cobId);
    }

    /**
     * Start the module;
     *
     * @override
     */
    start() {
        if(!this.started) {
            const obj1005 = this.eds.getEntry(0x1005);
            if(obj1005)
                this._addEntry(obj1005);

            const obj1006 = this.eds.getEntry(0x1006);
            if(obj1006)
                this._addEntry(obj1006);

            const obj1019 = this.eds.getEntry(0x1019);
            if(obj1019)
                this._addEntry(obj1019);

            this.addEdsCallback('newEntry', (obj) => this._addEntry(obj));
            this.addEdsCallback('removeEntry', (obj) => this._removeEntry(obj));

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

            const obj1006 = this.eds.getEntry(0x1006);
            if(obj1006)
                this._removeEntry(obj1006);

            const obj1019 = this.eds.getEntry(0x1019);
            if(obj1019)
                this._removeEntry(obj1019);

            super.stop();
        }
    }

    /**
     * Call when a new CAN message is received.
     *
     * @param {object} message - CAN frame.
     * @param {number} message.id - CAN message identifier.
     * @param {Buffer} message.data - CAN message data;
     * @fires Sync#sync
     * @override
     */
    receive({ id, data }) {
        if (this._cobId === id) {
            if (data)
                data = data[0];

            /**
             * A Sync object was received.
             *
             * @event Sync#sync
             * @type {number}
             */
            this.emit('sync', data);
        }
    }

    /**
     * Listens for new Eds entries.
     *
     * @param {DataObject} entry - new entry.
     * @listens Eds#newEntry
     * @private
     */
    _addEntry(entry) {
        switch(entry.index) {
            case 0x1005:
                this.addUpdateCallback(entry, (obj) => this._parse1005(obj));
                this._parse1005(entry);
                break;
            case 0x1006:
                this.addUpdateCallback(entry, (obj) => this._parse1006(obj));
                this._parse1006(entry);
                break;
            case 0x1019:
                this.addUpdateCallback(entry, (obj) => this._parse1019(obj));
                this._parse1019(entry);
                break;
        }
    }

    /**
     * Listens for removed Eds entries.
     *
     * @param {DataObject} entry - removed entry.
     * @listens Eds#newEntry
     * @private
     */
    _removeEntry(entry) {
        switch(entry.index) {
            case 0x1005:
                this.removeUpdateCallback(entry);
                this._clear1005();
                break;
            case 0x1006:
                this.removeUpdateCallback(entry);
                this._clear1006();
                break;
            case 0x1019:
                this.removeUpdateCallback(entry);
                this._clear1019();
                break;
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
        const gen = (value >> 30) & 0x1;
        const rtr = (value >> 29) & 0x1;
        const cobId = value & 0x7FF;

        if(rtr != 0x1) {
            this._generate = !!gen;
            this._cobId = cobId;
        }
        else {
            this._clear1005();
        }
    }

    /**
     * Called when 0x1005 (COB-ID SYNC) is removed.
     *
     * @private
     */
    _clear1005() {
        this._generate = false;
        this._cobId = null;
    }

    /**
     * Called when 0x1006 (Communication cycle period) is updated.
     *
     * @param {DataObject} entry - updated DataObject.
     * @private
     */
    _parse1006(entry) {
        // Clear the old timer
        this._clear1006();

        const cyclePeriod = entry.value;
        if(cyclePeriod > 0) {
            this.syncTimer = setInterval(() => {
                if(!this._generate || !this._cobId)
                    return;

                if(this._overflow > 0) {
                    this.syncCounter += 1;
                    if (this.syncCounter > this._overflow)
                        this.syncCounter = 1;

                    this.send(this._cobId, Buffer.from([this.syncCounter]));
                }
                else {
                    this.send(this._cobId, Buffer.alloc(0));
                }
            }, cyclePeriod / 1000);
        }
    }

    /**
     * Called when 0x1006 (Communication cycle period) is removed.
     *
     * @private
     */
    _clear1006() {
        clearInterval(this.syncTimer);
        this.syncTimer = null;
    }

    /**
     * Called when 0x1019 (Synchronous counter overflow value) is updated.
     *
     * @param {DataObject} entry - updated DataObject.
     * @private
     */
    _parse1019(entry) {
        this._overflow = entry.value;
    }

    /**
     * Called when 0x1019 (Synchronous counter overflow value) is removed.
     *
     * @private
     */
    _clear1019() {
        this._overflow = 0;
    }
}



module.exports = exports = { Sync };
