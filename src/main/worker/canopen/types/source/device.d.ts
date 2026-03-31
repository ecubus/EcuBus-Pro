declare const _exports: typeof Device
export = _exports

/** Payload for {@link Device} `"message"` events (emitted frames). */
type DeviceMessage = {
  id: number
  data: Buffer
}

/** Event map: only {@link DeviceMessage `message`}. */
type DeviceEventMap = {
  message: [message: DeviceMessage]
}

/**
 * A CANopen device.
 *
 * This class represents a single addressable device (or node) on the bus.
 *
 * @param {object} args - arguments.
 * @param {Eds} args.eds - the device's electronic data sheet.
 * @param {number} [args.id] - device identifier [1-127].
 * @param {boolean} [args.loopback] - enable loopback mode.
 * @param {boolean} [args.enableLss] - enable layer setting services.
 */
declare class Device extends EventEmitter<DeviceEventMap> {
  constructor(args?: { eds?: Eds | string; id?: number; loopback?: boolean; enableLss?: boolean })
  _stateListener: ((state: NmtState) => void) | null
  _resetListener: ((resetEds: boolean) => void) | null
  eds: Eds
  protocol: {
    emcy: Emcy
    lss: Lss
    nmt: Nmt
    pdo: Pdo
    sdoClient: SdoClient
    sdoServer: SdoServer
    sync: Sync
    time: Time
  }
  set id(value: number)
  /**
   * The device id.
   *
   * @type {number}
   */
  get id(): number
  /**
   * Accessor for version 5 Eds DataObjects. Do not use.
   *
   * @type {object}
   * @deprecated Use {@link Eds#entries} instead.
   */
  get dataObjects(): any
  _id: number
  /**
   * The Nmt state.
   *
   * @type {NmtState}
   */
  get state(): NmtState
  /**
   * The Emcy module.
   *
   * @type {Emcy}
   */
  get emcy(): Emcy
  /**
   * The Lss module.
   *
   * @type {Lss}
   */
  get lss(): Lss
  /**
   * The Nmt module.
   *
   * @type {Nmt}
   */
  get nmt(): Nmt
  /**
   * The Pdo module.
   *
   * @type {Pdo}
   */
  get pdo(): Pdo
  /**
   * The Sdo (client) module.
   *
   * @type {SdoClient}
   */
  get sdo(): SdoClient
  /**
   * The Sdo (server) module.
   *
   * @type {SdoServer}
   */
  get sdoServer(): SdoServer
  /**
   * The Sync module.
   *
   * @type {Sync}
   */
  get sync(): Sync
  /**
   * The Time module.
   *
   * @type {Time}
   */
  get time(): Time
  /**
   * Manufacturer hardware version (Object 0x)
   */
  /**
   * Call with each incoming CAN message.
   *
   * @param {object} message - CAN frame.
   * @param {number} message.id - CAN message identifier.
   * @param {Buffer} message.data - CAN message data;
   * @param {number} message.len - CAN message length in bytes.
   */
  receive(message: { id: number; data: Buffer; len: number }): void
  /**
   * Initialize the device and audit the object dictionary.
   *
   * @since 6.0.0
   */
  start(): void
  /**
   * Cleanup timers and shutdown the device.
   *
   * @since 6.0.0
   */
  stop(): void
  /**
   * Map a remote node's EDS file on to this Device.
   *
   * This method provides an easy way to set up communication with another
   * device. Most EDS transmit/producer entries will be mapped to their local
   * receive/consumer analogues. Note that this method will heavily modify
   * the Device's internal EDS file.
   *
   * This may be called multiple times to map more than one EDS.
   *
   * @param {object} args - method arguments.
   * @param {number} args.id - the remote node's CAN identifier.
   * @param {Eds | string} args.eds - the server's EDS.
   * @param {number} [args.dataStart] - start index for SDO entries.
   * @param {boolean} [args.skipEmcy] - Skip EMCY producer -> consumer.
   * @param {boolean} [args.skipNmt] - Skip NMT producer -> consumer.
   * @param {boolean} [args.skipPdo] - Skip PDO transmit -> receive.
   * @param {boolean} [args.skipSdo] - Skip SDO server -> client.
   * @since 6.0.0
   */
  mapRemoteNode(args?: {
    id: number
    eds: Eds | string
    dataStart?: number
    skipEmcy?: boolean
    skipNmt?: boolean
    skipPdo?: boolean
    skipSdo?: boolean
  }): void
  /**
   * Get the value of an EDS entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @returns {number | bigint | string | Date} entry value.
   */
  getValue(index: number | string): number | bigint | string | Date
  /**
   * Get the value of an EDS sub-entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @param {number} subIndex - sub-object index.
   * @returns {number | bigint | string | Date} entry value.
   */
  getValueArray(index: number | string, subIndex: number): number | bigint | string | Date
  /**
   * Get the raw value of an EDS entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @returns {Buffer} entry data.
   */
  getRaw(index: number | string): Buffer
  /**
   * Get the raw value of an EDS sub-entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @param {number} subIndex - sub-object index.
   * @returns {Buffer} entry data.
   */
  getRawArray(index: number | string, subIndex: number): Buffer
  /**
   * Get the scale factor of an EDS entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @returns {number | bigint | string | Date} entry value.
   */
  getScale(index: number | string): number | bigint | string | Date
  /**
   * Get the scale factor of an EDS sub-entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @param {number} subIndex - sub-object index.
   * @returns {number | bigint | string | Date} entry value.
   */
  getScaleArray(index: number | string, subIndex: number): number | bigint | string | Date
  /**
   * Set the value of an EDS entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @param {number | bigint | string | Date} value - value to set.
   */
  setValue(index: number | string, value: number | bigint | string | Date): void
  /**
   * Set the value of an EDS sub-entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @param {number} subIndex - array sub-index to set;
   * @param {number | bigint | string | Date} value - value to set.
   */
  setValueArray(
    index: number | string,
    subIndex: number,
    value: number | bigint | string | Date
  ): void
  /**
   * Set the raw value of an EDS entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @param {Buffer} raw - raw Buffer to set.
   */
  setRaw(index: number | string, raw: Buffer): void
  /**
   * Set the raw value of an EDS sub-entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @param {number} subIndex - sub-object index.
   * @param {Buffer} raw - raw Buffer to set.
   */
  setRawArray(index: number | string, subIndex: number, raw: Buffer): void
  /**
   * Set the scale factor of an EDS entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @param {number} scaleFactor - value to set.
   * @since 6.0.0
   */
  setScale(index: number | string, scaleFactor: number): void
  /**
   * Set the scale factor of an EDS sub-entry.
   *
   * @param {number | string} index - index or name of the entry.
   * @param {number} subIndex - array sub-index to set;
   * @param {number} scaleFactor - value to set.
   * @since 6.0.0
   */
  setScaleArray(index: number | string, subIndex: number, scaleFactor: number): void
  /**
   * Reset the Device.
   *
   * @param {boolean} [resetEds] - if true, then perform an Eds reset.
   * @listens Nmt#reset
   * @private
   */
  private _reset
  /**
   * Called on Nmt#changeState
   *
   * @param {NmtState} state - new nmt state.
   * @listens Nmt#changeState
   * @private
   */
  private _changeState
}
import EventEmitter = require('node:events')
import { Emcy } from './protocol/emcy'
import { Lss } from './protocol/lss'
import { Nmt, NmtState } from './protocol/nmt'
import { Pdo } from './protocol/pdo'
import { SdoClient } from './protocol/sdo_client'
import { SdoServer } from './protocol/sdo_server'
import { Sync } from './protocol/sync'
import { Time } from './protocol/time'
import { Eds } from './eds'
