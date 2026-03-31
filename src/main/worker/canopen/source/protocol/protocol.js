/**
 * @file Base class for protocol modules.
 * @author Wilkins White
 * @copyright 2024 Daxbot
 */

const EventEmitter = require('events');
const { Eds } = require('../eds');

/**
 * A base class extended by the protocol modules.
 *
 * @param {Eds} eds - Eds object.
 * @interface
 * @since 6.0.0
 */
class Protocol extends EventEmitter {
    constructor(eds) {
        super();

        if(!Eds.isEds(eds))
            throw new TypeError('not an Eds');

        this.eds = eds;
        this.started = false;
        this.callbacks = {};
    }

    /**
     * Start the module.
     *
     * @fires Protocol#start
     * @abstract
     */
    start() {
        this.started = true;

        /**
         * The module has been started.
         *
         * @event Protocol#start
         * @since 6.0.0
         */
        this.emit('start');
    }

    /**
     * Stop the module.
     *
     * @fires Protocol#stop
     * @abstract
     */
    stop() {
        this.started = false;

        /**
         * The module has been stopped.
         *
         * @event Protocol#stop
         * @since 6.0.0
         */
        this.emit('stop');
    }

    /**
     * Call when a new CAN message is received.
     *
     * @param {object} message - CAN frame.
     * @param {number} message.id - CAN message identifier.
     * @param {Buffer} message.data - CAN message data;
     * @abstract
     */
    receive(message) {
        (message);
    }

    /**
     * Emit a CAN message.
     *
     * @param {number} id - CAN message identifier.
     * @param {Buffer} data - CAN message data;
     * @fires Protocol#message
     */
    send(id, data) {
        if(data === undefined)
            data = Buffer.alloc(0);

        /**
         * A CAN message is ready to send.
         *
         * @event Protocol#message
         * @type {object}
         * @property {number} id - CAN message identifier.
         * @property {Buffer} data - CAN message data.
         * @since 6.0.0
         */
        this.emit('message', { id, data });
    }

    /**
     * Add a listener to the Eds.
     *
     * @param {string} eventName - the name of the event.
     * @param {Function} listener - the callback function.
     */
    addEdsCallback(eventName, listener) {
        if(this.callbacks[eventName])
            throw new Error(eventName + ' already exists');

        this.callbacks[eventName] = listener;
        this.eds.addListener(eventName, listener);
    }

    /**
     * Remove a listener from the Eds.
     *
     * @param {string} eventName - the name of the event.
     */
    removeEdsCallback(eventName) {
        this.eds.removeListener(eventName, this.callbacks[eventName]);
        delete this.callbacks[eventName];
    }

    /**
     * Add an 'update' listener to a DataObject.
     *
     * @param {DataObject} entry - event emitter.
     * @param {Function} listener - event listener.
     * @param {string} [key] - event key.
     */
    addUpdateCallback(entry, listener, key='') {
        if(!key)
            key = entry.key;

        if(this.callbacks[key])
            throw new Error(key + ' already exists');

        this.callbacks[key] = listener;
        entry.addListener('update', listener);
    }

    /**
     * Remove an 'update' listener from a DataObject.
     *
     * @param {DataObject} entry - event emitter.
     * @param {string} [key] - event key.
     */
    removeUpdateCallback(entry, key='') {
        if(!key)
            key = entry.key;

        entry.removeListener('update', this.callbacks[key]);
        delete this.callbacks[key];
    }
}

module.exports = exports = Protocol;