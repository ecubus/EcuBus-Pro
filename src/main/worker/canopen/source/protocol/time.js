/**
 * @file Implements the CANopen Time Stamp (TIME) protocol.
 * @author Wilkins White
 * @copyright 2024 Daxbot
 */

const Protocol = require('./protocol');
const { Eds, EdsError } = require('../eds');
const { DataType } = require('../types');
const rawToType = require('../functions/raw_to_type');
const typeToRaw = require('../functions/type_to_raw');
const { deprecate } = require('util');

/**
 * CANopen TIME protocol handler.
 *
 * The time stamp (TIME) protocol follows a producer-consumer structure that
 * provides a simple network clock. There should be at most one time stamp
 * producer on the network.
 *
 * @param {Eds} eds - Eds object.
 * @see CiA301 "Time stamp object (TIME)" (§7.2.6)
 * @implements {Protocol}
 */
class Time extends Protocol {
    constructor(eds) {
        super(eds);
        this._consume = false;
        this._produce = false;
        this._cobId = null;
    }

    /**
     * Get object 0x1012 [bit 30] - Time producer enable.
     *
     * @type {boolean}
     * @deprecated Use {@link Eds#getTimeProducerEnable} instead.
     */
    get produce() {
        return this.eds.getTimeProducerEnable();
    }

    /**
     * Set object 0x1012 [bit 30] - Time producer enable.
     *
     * @type {boolean}
     * @deprecated Use {@link Eds#setTimeProducerEnable} instead.
     */
    set produce(enable) {
        this.eds.setTimeProducerEnable(enable);
    }

    /**
     * Get object 0x1012 [bit 31] - Time consumer enable.
     *
     * @type {boolean}
     * @deprecated Use {@link Eds#getTimeConsumerEnable} instead.
     */
    get consume() {
        return this.eds.getTimeConsumerEnable();
    }

    /**
     * Set object 0x1012 [bit 31] - Time consumer enable.
     *
     * @type {boolean}
     * @deprecated Use {@link Eds#setTimeConsumerEnable} instead.
     */
    set consume(enable) {
        this.eds.setTimeConsumerEnable(enable);
    }

    /**
     * Get object 0x1012 - COB-ID TIME.
     *
     * @type {number}
     * @deprecated Use {@link Eds#getTimeCobId} instead.
     */
    get cobId() {
        return this.eds.getTimeCobId();
    }

    /**
     * Set object 0x1012 - COB-ID TIME.
     *
     * @type {number}
     * @deprecated Use {@link Eds#setTimeCobId} instead.
     */
    set cobId(cobId) {
        this.eds.setTimeCobId(cobId);
    }

    /**
     * Service: TIME write.
     *
     * @param {Date} date - date to write.
     * @fires Protocol#message
     */
    write(date) {
        if (!this._produce)
            throw new EdsError('TIME production is disabled');

        if(!this._cobId)
            throw new EdsError('COB-ID TIME may not be 0');

        if(!date)
            date = new Date();

        this.send(this._cobId, typeToRaw(date, DataType.TIME_OF_DAY));
    }

    /**
     * Start the module.
     *
     * @override
     */
    start() {
        if(!this.started) {
            const obj1012 = this.eds.getEntry(0x1012);
            if(obj1012)
                this._addEntry(obj1012);

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

            const obj1012 = this.eds.getEntry(0x1012);
            if(obj1012)
                this._removeEntry(obj1012);

            super.stop();
        }
    }

    /**
     * Call when a new CAN message is received.
     *
     * @param {object} message - CAN frame.
     * @param {number} message.id - CAN message identifier.
     * @param {Buffer} message.data - CAN message data;
     * @fires Time#time
     * @override
     */
    receive({ id, data }) {
        if (this._consume && this._cobId === id) {
            const date = rawToType(data, DataType.TIME_OF_DAY);

            /**
             * A Time object was received.
             *
             * @event Time#time
             * @type {Date}
             */
            this.emit('time', date);
        }
    }

    /**
     * Listens for new Eds entries.
     *
     * @param {DataObject} entry - new entry.
     * @private
     */
    _addEntry(entry) {
        if(entry.index === 0x1012) {
            this.addUpdateCallback(entry, (obj) => this._parse1012(obj));
            this._parse1012(entry);
        }
    }

    /**
     * Listens for removed Eds entries.
     *
     * @param {DataObject} entry - removed entry.
     * @private
     */
    _removeEntry(entry) {
        if(entry.index === 0x1012) {
            this.removeUpdateCallback(entry);
            this._clear1012();
        }
    }

    /**
     * Called when 0x1012 (COB-ID TIME) is updated.
     *
     * @param {DataObject} data - updated DataObject.
     * @private
     */
    _parse1012(data) {
        const value = data.value;
        const consume = (value >> 31) & 0x1;
        const produce = (value >> 30) & 0x1;
        const rtr = (value >> 29) & 0x1;
        const cobId = value & 0x7FF;

        if(rtr != 0x1) {
            this._consume = !!consume;
            this._produce = !!produce;
            this._cobId = cobId;
        }
        else {
            this._clear1012();
        }
    }

    /**
     * Called when 0x1012 (COB-ID TIME) is removed.
     *
     * @private
     */
    _clear1012() {
        this._consume = false;
        this._produce = false;
        this._cobId = null;
    }
}


module.exports = exports = { Time };
