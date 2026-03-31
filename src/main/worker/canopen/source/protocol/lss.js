/**
 * @file Implements the CANopen Layer Setting Services (LSS) protocol.
 * @author Wilkins White
 * @copyright 2024 Daxbot
 */

const Protocol = require('./protocol');
const { Eds } = require('../eds');
const { deprecate } = require('util');

/**
 * Check an Lss address against the device address.
 *
 * @param {object} identity - identity object.
 * @param {number} identity.vendorId - vendor id.
 * @param {number} identity.productCode - product code.
 * @param {number} identity.revisionNumber - revision number.
 * @param {number} identity.serialNumber - serial number.
 * @param {Array} address - Lss address.
 * @param {number} address.0 - device vendor id.
 * @param {number} address.1 - device product code.
 * @param {number} address.2 - device revision number.
 * @param {number} address.3 - device serial number.
 * @returns {boolean} true if the address matches.
 * @private
 */
function checkLssAddress(identity, address) {
    return address[0] === identity.vendorId
        && address[1] === identity.productCode
        && address[2] === identity.revisionNumber
        && address[3] === identity.serialNumber;
}

/**
 * Mask and compare two unsigned integers.
 *
 * @param {number} a - first number.
 * @param {number} b - second number.
 * @param {number} mask - bit mask.
 * @returns {boolean} true if the masked values are equal.
 * @private
 */
function maskCompare(a, b, mask) {
    a = (a & mask) >>> 0;
    b = (b & mask) >>> 0;

    return a === b;
}

/**
 * CANopen LSS command specifiers.
 *
 * @enum {number}
 * @see CiA305 "LSS Protocol Descriptions" (§3.8.2)
 * @private
 */
const LssCommand = {
    SWITCH_MODE_GLOBAL: 4,
    CONFIGURE_NODE_ID: 17,
    CONFIGURE_BIT_TIMING: 19,
    ACTIVATE_BIT_TIMING: 21,
    STORE_CONFIGURATION: 23,
    SWITCH_MODE_VENDOR_ID: 64,
    SWITCH_MODE_PRODUCT_CODE: 65,
    SWITCH_MODE_REVISION_NUMBER: 66,
    SWITCH_MODE_SERIAL_NUMBER: 67,
    FASTSCAN: 81,
    INQUIRE_VENDOR_ID: 90,
    INQUIRE_PRODUCT_CODE: 91,
    INQUIRE_REVISION_NUMBER: 92,
    INQUIRE_SERIAL_NUMBER: 93,
};

/**
 * CANopen LSS modes.
 *
 * @enum {number}
 * @see CiA305 "Switch Mode Global" (§3.9.1)
 */
const LssMode = {
    /** Only the switch mode service is available. */
    OPERATION: 0,

    /** All LSS services are available. */
    CONFIGURATION: 1,
};

/**
 * Errors generated during LSS services.
 *
 * @param {object} args - arguments.
 * @param {string} args.message - error message.
 * @param {number} args.code - error code.
 * @param {number} args.info - error info code.
 */
class LssError extends Error {
    constructor(...args) {
        if(typeof args[0] === 'object') {
            args = args[0];
        }
        else {
            args = {
                message: args[0],
                code: args[1],
                info: args[2],
            };
        }

        super(args.message);
        this.code = args.code;
        this.info = args.info;

        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * CANopen LSS protocol handler.
 *
 * @param {Eds} eds - Eds object.
 * @see CiA305 "Layer Settings Services and Protocol (LSS)"
 * @implements {Protocol}
 */
class Lss extends Protocol {
    constructor(eds) {
        super(eds);

        this._mode = LssMode.OPERATION;
        this.pending = {};
        this.select = [];
        this.scanState = 0;
        this.identity = {
            vendorId: null,
            productCode: null,
            revisionNumber: null,
            serialNumber: null,
        };
    }

    /**
     * Device LSS Mode.
     *
     * @type {LssMode}
     */
    get mode() {
        return this._mode;
    }

    /**
     * Vendor id.
     *
     * @type {number}
     * @deprecated Use {@link Eds#getIdentity} instead.
     */
    get vendorId() {
        return this.eds.getSubEntry(0x1018, 1).value;
    }

    /**
     * Vendor id.
     *
     * @type {number}
     * @deprecated Use {@link Eds#setIdentity} instead.
     */
    set vendorId(value) {
        this.eds.getSubEntry(0x1018, 1).value = value;
    }

    /**
     * Product code.
     *
     * @type {number}
     * @deprecated Use {@link Eds#getIdentity} instead.
     */
    get productCode() {
        return this.eds.getSubEntry(0x1018, 2).value;
    }

    /**
     * Product code.
     *
     * @type {number}
     * @deprecated Use {@link Eds#setIdentity} instead.
     */
    set productCode(value) {
        this.eds.getSubEntry(0x1018, 2).value = value;
    }

    /**
     * Revision number.
     *
     * @type {number}
     * @deprecated Use {@link Eds#getIdentity} instead.
     */
    get revisionNumber() {
        return this.eds.getSubEntry(0x1018, 3).value;
    }

    /**
     * Revision number.
     *
     * @type {number}
     * @deprecated Use {@link Eds#setIdentity} instead.
     */
    set revisionNumber(value) {
        this.eds.getSubEntry(0x1018, 3).value = value;
    }

    /**
     * Serial number.
     *
     * @type {number}
     * @deprecated Use {@link Eds#getIdentity} instead.
     */
    get serialNumber() {
        return this.eds.getSubEntry(0x1018, 4).value;
    }

    /**
     * Serial number.
     *
     * @type {number}
     * @deprecated Use {@link Eds#setIdentity} instead.
     */
    set serialNumber(value) {
        this.eds.getSubEntry(0x1018, 4).value = value;
    }

    /**
     * Set the LSS mode.
     *
     * @param {LssMode} mode - new mode.
     * @fires Lss#changeMode
     */
    setMode(mode) {
        if(mode !== this._mode) {
            this._mode = mode;

            /**
             * The LSS mode changed.
             *
             * @event Lss#changeMode
             * @type {LssMode}
             */
            this.emit('changeMode', mode);
        }
    }

    /**
     * LSS Fastscan protocol.
     *
     * Identifies exactly one LSS consumer device and switches it to
     * configuration mode.
     *
     * @param {object} [args] - arguments.
     * @param {number} [args.vendorId] - vendor-id hint.
     * @param {number} [args.productCode] - product-code hint.
     * @param {number} [args.revisionNumber] - revision-number hint.
     * @param {number} [args.serialNumber] - serial-number hint.
     * @param {number} [args.timeout] - how long to wait for nodes to respond.
     * @returns {Promise<null | object>} resolves to the discovered device's id (or null).
     * @see https://www.can-cia.org/fileadmin/resources/documents/proceedings/2008_pfeiffer.pdf
     */
    async fastscan(args={}) {
        let vendorId = args.vendorId;
        let productCode = args.productCode;
        let revisionNumber = args.revisionNumber;
        let serialNumber = args.serialNumber;
        let timeout = args.timeout || 20;
        let timeoutFlag = false;

        // Initiate fastscan
        await new Promise((resolve) => {
            const timer = setTimeout(() => {
                timeoutFlag = true;
                resolve();
            }, timeout);

            this.pending[0x4f] = { resolve, timer };

            this._sendLssRequest(
                LssCommand.FASTSCAN, Buffer.from([0, 0, 0, 0, 0x80]));
        });

        if (timeoutFlag)
            return null; // No devices

        // Find vendor-id
        if (vendorId === undefined) {
            vendorId = 0;
            for (let i = 31; i >= 0; --i) {
                await new Promise((resolve) => {
                    const timer = setTimeout(() => {
                        const bit = (1 << i) >>> 0;
                        vendorId = (vendorId | bit) >>> 0;
                        resolve();
                    }, timeout);

                    const data = Buffer.alloc(7);
                    data.writeUInt32LE(vendorId);
                    data[4] = i; // Bit checked
                    data[5] = 0; // LSS sub
                    data[6] = 0; // LSS next

                    this.pending[0x4f] = { resolve, timer };
                    this._sendLssRequest(LssCommand.FASTSCAN, data);
                });
            }
        }

        // Verify vendor-id
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new LssError('unverified vendorId', 255, 0));
            }, timeout);

            const data = Buffer.alloc(7);
            data.writeUInt32LE(vendorId);
            data[4] = 0; // Bit checked
            data[5] = 0; // LSS sub
            data[6] = 1; // LSS next

            this.pending[0x4f] = { resolve, timer };
            this._sendLssRequest(LssCommand.FASTSCAN, data);
        });

        // Find product-code
        if (productCode === undefined) {
            productCode = 0;
            for (let i = 31; i >= 0; --i) {
                await new Promise((resolve) => {
                    const timer = setTimeout(() => {
                        const bit = (1 << i) >>> 0;
                        productCode = (productCode | bit) >>> 0;
                        resolve();
                    }, timeout);

                    const data = Buffer.alloc(7);
                    data.writeUInt32LE(productCode);
                    data[4] = i; // Bit checked
                    data[5] = 1; // LSS sub
                    data[6] = 1; // LSS next

                    this.pending[0x4f] = { resolve, timer };
                    this._sendLssRequest(LssCommand.FASTSCAN, data);
                });
            }
        }

        // Verify product-code
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new LssError('unverified productCode', 255, 0));
            }, timeout);

            const data = Buffer.alloc(7);
            data.writeUInt32LE(productCode);
            data[4] = 0; // Bit checked
            data[5] = 1; // LSS sub
            data[6] = 2; // LSS next

            this.pending[0x4f] = { resolve, timer };
            this._sendLssRequest(LssCommand.FASTSCAN, data);
        });

        // Find revision-number
        if (revisionNumber === undefined) {
            revisionNumber = 0;
            for (let i = 31; i >= 0; --i) {
                await new Promise((resolve) => {
                    const timer = setTimeout(() => {
                        const bit = (1 << i) >>> 0;
                        revisionNumber = (revisionNumber | bit) >>> 0;
                        resolve();
                    }, timeout);

                    const data = Buffer.alloc(7);
                    data.writeUInt32LE(revisionNumber);
                    data[4] = i; // Bit checked
                    data[5] = 2; // LSS sub
                    data[6] = 2; // LSS next

                    this.pending[0x4f] = { resolve, timer };
                    this._sendLssRequest(LssCommand.FASTSCAN, data);
                });
            }
        }

        // Verify revision-number
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new LssError('unverified revisionNumber', 255, 0));
            }, timeout);

            const data = Buffer.alloc(7);
            data.writeUInt32LE(revisionNumber);
            data[4] = 0; // Bit checked
            data[5] = 2; // LSS sub
            data[6] = 3; // LSS next

            this.pending[0x4f] = { resolve, timer };
            this._sendLssRequest(LssCommand.FASTSCAN, data);
        });

        // Find serial-number
        if (serialNumber === undefined) {
            serialNumber = 0;
            for (let i = 31; i >= 0; --i) {
                await new Promise((resolve) => {
                    const timer = setTimeout(() => {
                        const bit = (1 << i) >>> 0;
                        serialNumber = (serialNumber | bit) >>> 0;
                        resolve();
                    }, timeout);

                    const data = Buffer.alloc(7);
                    data.writeUInt32LE(serialNumber);
                    data[4] = i; // Bit checked
                    data[5] = 3; // LSS sub
                    data[6] = 3; // LSS next

                    this.pending[0x4f] = { resolve, timer };
                    this._sendLssRequest(LssCommand.FASTSCAN, data);
                });
            }
        }

        // Verify serial-number
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new LssError('unverified serialNumber', 255, 0));
            }, timeout);

            const data = Buffer.alloc(7);
            data.writeUInt32LE(serialNumber);
            data[4] = 0; // Bit checked
            data[5] = 3; // LSS sub
            data[6] = 0; // LSS next

            this.pending[0x4f] = { resolve, timer };
            this._sendLssRequest(LssCommand.FASTSCAN, data);
        });

        return { vendorId, productCode, revisionNumber, serialNumber };
    }

    /**
     * Service: switch mode global.
     *
     * @param {LssMode} mode - LSS mode to switch to.
     * @see CiA305 "Switch Mode Global" (§3.9.1)
     */
    switchModeGlobal(mode) {
        if (mode === undefined)
            throw ReferenceError('mode not defined');

        this._sendLssRequest(
            LssCommand.SWITCH_MODE_GLOBAL, Buffer.from([mode]));
    }

    /**
     * Service: switch mode selective.
     *
     * @param {object} args - arguments.
     * @param {number} args.vendorId - LSS consumer vendor-id.
     * @param {number} args.productCode - LSS consumer product-code.
     * @param {number} args.revisionNumber - LSS consumer revision-number.
     * @param {number} args.serialNumber - LSS consumer serial-number.
     * @param {number} [args.timeout] - time until promise is rejected.
     * @returns {Promise<LssMode>} - the actual mode of the LSS consumer.
     * @see CiA305 "Switch Mode Selective" (§3.9.2)
     */
    switchModeSelective(...args) {
        if(typeof args[0] === 'object') {
            args = args[0];
        }
        else {
            args = {
                vendorId: args[0],
                productCode: args[1],
                revisionNumber: args[2],
                serialNumber: args[3],
                timeout: args[4],
            };
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new LssError('timeout'));
            }, args.timeout);

            this.pending[68] = { resolve, timer };

            const data = Buffer.alloc(4);

            // Send vendor-id
            data.writeUInt32LE(args.vendorId);
            this._sendLssRequest(LssCommand.SWITCH_MODE_VENDOR_ID, data);

            // Send product-code
            data.writeUInt32LE(args.productCode);
            this._sendLssRequest(LssCommand.SWITCH_MODE_PRODUCT_CODE, data);

            // Send revision-number
            data.writeUInt32LE(args.revisionNumber);
            this._sendLssRequest(LssCommand.SWITCH_MODE_REVISION_NUMBER, data);

            // Send serial-number
            data.writeUInt32LE(args.serialNumber);
            this._sendLssRequest(LssCommand.SWITCH_MODE_SERIAL_NUMBER, data);
        });
    }

    /**
     * Service: configure node-id.
     *
     * @param {number} nodeId - new node-id
     * @param {number} timeout - time until promise is rejected.
     * @returns {Promise} resolves when the service is finished.
     * @see CiA305 "Configure Node-ID Protocol" (§3.10.1)
     */
    async configureNodeId(nodeId, timeout = 20) {
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new LssError('timeout'));
            }, timeout);

            this.pending[LssCommand.CONFIGURE_NODE_ID] = {
                resolve,
                timer
            };

            this._sendLssRequest(
                LssCommand.CONFIGURE_NODE_ID, Buffer.from([nodeId]));
        });

        let message = '';
        switch (result[0]) {
            case 0:
                return; // Success
            case 1:
                message = 'Node-ID out of range';
                break;
            case 255:
                message = 'Implementation specific error';
                break;
            default:
                message = 'Unsupported error code';
                break;
        }

        throw new LssError(message, result[0], result[1]);
    }

    /**
     * Service: configure bit timing parameters.
     *
     * @param {number} tableSelect - which bit timing parameters table to use.
     * @param {number} tableIndex - the entry in the selected table to use.
     * @param {number} timeout - time until promise is rejected.
     * @returns {Promise} resolves when the service is finished.
     * @see CiA305 "Configure Bit Timing Parameters Protocol" (§3.10.2)
     */
    async configureBitTiming(tableSelect, tableIndex, timeout = 20) {
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new LssError('timeout'));
            }, timeout);

            this.pending[LssCommand.CONFIGURE_BIT_TIMING] = {
                resolve,
                timer
            };

            this._sendLssRequest(
                LssCommand.CONFIGURE_BIT_TIMING,
                Buffer.from([tableSelect, tableIndex]));
        });

        let message = '';
        switch (result[0]) {
            case 0:
                return; // Success
            case 1:
                message = 'Bit timing not supported';
                break;
            case 255:
                message = 'Implementation specific error';
                break;
            default:
                message = 'Unsupported error code';
                break;
        }

        throw new LssError(message, result[0], result[1]);
    }

    /**
     * Service: activate bit timing parameters.
     *
     * @param {number} delay - switch delay in ms.
     * @see CiA305 "Activate Bit Timing Parameters Protocol" (§3.10.3)
     */
    activateBitTiming(delay) {
        const switchDelay = Buffer.alloc(2);
        switchDelay.writeUInt16LE(delay);
        this._sendLssRequest(LssCommand.ACTIVATE_BIT_TIMING, switchDelay);
    }

    /**
     * Service: store configuration.
     *
     * @param {number} timeout - time until promise is rejected.
     * @returns {Promise} resolves when the service is finished.
     * @see CiA305 "Store Configuration Protocol" (§3.10.4)
     */
    async storeConfiguration(timeout = 20) {
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new LssError('timeout'));
            }, timeout);

            this.pending[LssCommand.STORE_CONFIGURATION] = {
                resolve,
                timer
            };

            this._sendLssRequest(LssCommand.STORE_CONFIGURATION);
        });

        let message = '';
        switch (result[0]) {
            case 0:
                return; // Success
            case 1:
                message = 'Store configuration not supported';
                break;
            case 2:
                message = 'Storage media access error';
                break;
            case 255:
                message = 'Implementation specific error';
                break;
            default:
                message = 'Unsupported error code';
                break;
        }

        throw new LssError(message, result[0], result[1]);
    }

    /**
     * Service: inquire identity vendor-id.
     *
     * @param {number} timeout - time until promise is rejected.
     * @returns {Promise<number>} - LSS consumer vendor-id.
     * @see CiA305 "Inquire Identity Vendor-ID Protocol" (§3.11.1.1)
     */
    async inquireVendorId(timeout = 20) {
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new LssError('timeout')), timeout);

            this.pending[LssCommand.INQUIRE_VENDOR_ID] = {
                resolve,
                timer
            };

            this._sendLssRequest(LssCommand.INQUIRE_VENDOR_ID);
        });

        return result.readUInt32LE();
    }

    /**
     * Service: inquire identity product-code.
     *
     * @param {number} timeout - time until promise is rejected.
     * @returns {Promise<number>} - LSS consumer product-code.
     * @see CiA305 "Inquire Identity Product-Code Protocol" (§3.11.1.2)
     */
    async inquireProductCode(timeout = 20) {
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new LssError('timeout')), timeout);

            this.pending[LssCommand.INQUIRE_PRODUCT_CODE] = {
                resolve,
                timer
            };

            this._sendLssRequest(LssCommand.INQUIRE_PRODUCT_CODE);
        });

        return result.readUInt32LE();
    }

    /**
     * Service: inquire identity revision-number.
     *
     * @param {number} timeout - time until promise is rejected.
     * @returns {Promise<number>} - LSS consumer revision-number.
     * @see CiA305 "Inquire Identity Revision-Number Protocol" (§3.11.1.3)
     */
    async inquireRevisionNumber(timeout = 20) {
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new LssError('timeout')), timeout);

            this.pending[LssCommand.INQUIRE_REVISION_NUMBER] = {
                resolve,
                timer
            };

            this._sendLssRequest(LssCommand.INQUIRE_REVISION_NUMBER);
        });

        return result.readUInt32LE();
    }

    /**
     * Service: inquire identity serial-number.
     *
     * @param {number} timeout - time until promise is rejected.
     * @returns {Promise<number>} - LSS consumer serial-number.
     * @see CiA305 "Inquire Identity Serial-Number Protocol" (§3.11.1.4)
     */
    async inquireSerialNumber(timeout = 20) {
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new LssError('timeout')), timeout);

            this.pending[LssCommand.INQUIRE_SERIAL_NUMBER] = {
                resolve,
                timer
            };

            this._sendLssRequest(LssCommand.INQUIRE_SERIAL_NUMBER);
        });

        return result.readUInt32LE();
    }

    /**
     * Start the module.
     *
     * @override
     */
    start() {
        if(!this.started) {
            const obj1018 = this.eds.getEntry(0x1018);
            if(obj1018)
                this._addEntry(obj1018);

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

            const obj1018 = this.eds.getEntry(0x1018);
            if(obj1018)
                this._removeEntry(obj1018);

            super.stop();
        }
    }

    /**
     * Call when a new CAN message is received.
     *
     * @param {object} message - CAN frame.
     * @param {number} message.id - CAN message identifier.
     * @param {Buffer} message.data - CAN message data;
     * @fires Lss#changeMode
     * @fires Lss#changeDeviceId
     * @override
     */
    receive({ id, data }) {
        if (id === 0x7e4) {
            const cs = data[0];
            if (this.pending[cs] !== undefined) {
                clearTimeout(this.pending[cs].timer);
                this.pending[cs].resolve(data.slice(1));
            }
        }
        else if (id === 0x7e5) {
            const cs = data[0];

            if (cs === LssCommand.FASTSCAN) {
                // Fastscan is only available for unconfigured nodes.
                const bitCheck = data[5];
                const lssSub = data[6];
                const lssNext = data[7];

                if (bitCheck === 0x80) {
                    // Reset state
                    this.scanState = 0;
                    this._sendLssResponse(0x4f);
                }
                else if (this.scanState === lssSub) {
                    if (bitCheck > 0x1f || lssSub > 3 || lssNext > 3)
                        return; // Invalid request

                    const value = data.readUInt32LE(1);
                    const mask = (0xffffffff << bitCheck) >>> 0;
                    let match = false;

                    switch (lssSub) {
                        case 0:
                            // Test vendor id
                            match = maskCompare(
                                this.identity.vendorId, value, mask);
                            break;

                        case 1:
                            // Test product code
                            match = maskCompare(
                                this.identity.productCode, value, mask);
                            break;

                        case 2:
                            // Test revision number
                            match = maskCompare(
                                this.identity.revisionNumber, value, mask);
                            break;

                        case 3:
                            match = maskCompare(
                                this.identity.serialNumber, value, mask);
                            break;
                    }

                    if (match) {
                        this.scanState = lssNext;
                        if (bitCheck === 0 && lssNext < lssSub)
                            this.setMode(LssMode.CONFIGURATION);

                        this._sendLssResponse(0x4f);
                    }
                }
                return;
            }

            // Switch mode commands
            switch (cs) {
                case LssCommand.SWITCH_MODE_GLOBAL:
                    this.setMode(data[1]);
                    this.select = [];
                    return;

                case LssCommand.SWITCH_MODE_VENDOR_ID:
                    this.select[0] = data.readUInt32LE(1);
                    return;

                case LssCommand.SWITCH_MODE_PRODUCT_CODE:
                    this.select[1] = data.readUInt32LE(1);
                    return;

                case LssCommand.SWITCH_MODE_REVISION_NUMBER:
                    this.select[2] = data.readUInt32LE(1);
                    return;

                case LssCommand.SWITCH_MODE_SERIAL_NUMBER:
                    this.select[3] = data.readUInt32LE(1);
                    if (checkLssAddress(this.identity, this.select))
                        this.setMode(LssMode.CONFIGURATION);
                    return;
            }

            // Configuration commands
            if (this.mode !== LssMode.CONFIGURATION)
                return;

            switch (cs) {
                case LssCommand.CONFIGURE_NODE_ID:
                    try {
                        /**
                         * LssCommand.CONFIGURE_NODE_ID was received.
                         *
                         * @event Lss#changeDeviceId
                         * @type {number}
                         */
                        this.emit('changeDeviceId', data[1]);
                        this._sendLssResponse(cs, 0);
                    }
                    catch {
                        // Error: Node-ID out of range
                        this._sendLssResponse(cs, 1);
                    }
                    return;

                case LssCommand.CONFIGURE_BIT_TIMING:
                    // Error: Bit timing not supported
                    this._sendLssResponse(cs, 1);
                    return;

                case LssCommand.STORE_CONFIGURATION:
                    // Error: Store configuration not supported
                    this._sendLssResponse(cs, 1);
                    return;

                case LssCommand.INQUIRE_VENDOR_ID:
                    this._sendLssResponse(cs, this.identity.vendorId);
                    return;

                case LssCommand.INQUIRE_PRODUCT_CODE:
                    this._sendLssResponse(cs, this.identity.productCode);
                    return;

                case LssCommand.INQUIRE_REVISION_NUMBER:
                    this._sendLssResponse(cs, this.identity.revisionNumber);
                    return;

                case LssCommand.INQUIRE_SERIAL_NUMBER:
                    this._sendLssResponse(cs, this.identity.serialNumber);
                    return;
            }
        }
    }

    /**
     * Listens for new Eds entries.
     *
     * @param {DataObject} entry - new entry.
     * @private
     */
    _addEntry(entry) {
        if(entry.index === 0x1018) {
            this.addUpdateCallback(entry, (obj) => this._parse1018(obj));
            this._parse1018(entry);
        }
    }

    /**
     * Listens for removed Eds entries.
     *
     * @param {DataObject} entry - removed entry.
     * @private
     */
    _removeEntry(entry) {
        if(entry.index === 0x1018) {
            this.removeUpdateCallback(entry);
            this._clear1018();
        }
    }

    /**
     * Called when 0x1018 (Identity object) is updated.
     *
     * @param {DataObject} entry - updated DataObject.
     * @listens DataObject#update
     * @private
     */
    _parse1018(entry) {
        if(!entry)
            return;

        const subIndex = entry.subIndex;
        if(subIndex === null) {
            const maxSubIndex = entry[0].value;
            for(let i = 1; i <= maxSubIndex; ++i)
                this._parse1018(entry.at(i));
        }
        else {
            switch(subIndex) {
                case 1:
                    this.identity.vendorId = entry.value;
                    break;
                case 2:
                    this.identity.productCode = entry.value;
                    break;
                case 3:
                    this.identity.revisionNumber = entry.value;
                    break;
                case 4:
                    this.identity.serialNumber = entry.value;
                    break;
            }
        }
    }

    /**
     * Called when 0x1018 (Identity object) is removed.
     *
     * @private
     */
    _clear1018() {
        this.identity = {
            vendorId: null,
            productCode: null,
            revisionNumber: null,
            serialNumber: null,
        };
    }

    /**
     * Send an LSS request object.
     *
     * @param {LssCommand} command - LSS command specifier.
     * @param {Buffer} data - command data.
     * @private
     */
    _sendLssRequest(command, data) {
        const sendBuffer = Buffer.alloc(8);
        sendBuffer[0] = command;

        if (data !== undefined)
            data.copy(sendBuffer, 1);

        this.send(0x7e5, sendBuffer);
    }

    /**
     * Send an LSS response object.
     *
     * @param {LssCommand} command - LSS command specifier.
     * @param {number} code - response code.
     * @param {number} info - response info.
     * @private
     */
    _sendLssResponse(command, code, info = 0) {
        const sendBuffer = Buffer.alloc(8);
        sendBuffer[0] = command;
        sendBuffer[1] = code;
        sendBuffer[2] = info;

        this.send(0x7e4, sendBuffer);
    }
}


module.exports = exports = { LssMode, LssError, Lss };
