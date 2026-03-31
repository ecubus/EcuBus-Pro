declare const _exports: typeof Protocol
export = _exports
/**
 * A base class extended by the protocol modules.
 *
 * @param {Eds} eds - Eds object.
 * @interface
 * @since 6.0.0
 */
declare class Protocol extends EventEmitter<any> {
  constructor(eds: Eds)
  eds: Eds
  started: boolean
  callbacks: {}
  /**
   * Start the module.
   *
   * @fires Protocol#start
   * @abstract
   */
  start(): void
  /**
   * Stop the module.
   *
   * @fires Protocol#stop
   * @abstract
   */
  stop(): void
  /**
   * Call when a new CAN message is received.
   *
   * @param {object} message - CAN frame.
   * @param {number} message.id - CAN message identifier.
   * @param {Buffer} message.data - CAN message data;
   * @abstract
   */
  receive(message: { id: number; data: Buffer }): void
  /**
   * Emit a CAN message.
   *
   * @param {number} id - CAN message identifier.
   * @param {Buffer} data - CAN message data;
   * @fires Protocol#message
   */
  send(id: number, data: Buffer): void
  /**
   * Add a listener to the Eds.
   *
   * @param {string} eventName - the name of the event.
   * @param {Function} listener - the callback function.
   */
  addEdsCallback(eventName: string, listener: Function): void
  /**
   * Remove a listener from the Eds.
   *
   * @param {string} eventName - the name of the event.
   */
  removeEdsCallback(eventName: string): void
  /**
   * Add an 'update' listener to a DataObject.
   *
   * @param {DataObject} entry - event emitter.
   * @param {Function} listener - event listener.
   * @param {string} [key] - event key.
   */
  addUpdateCallback(entry: DataObject, listener: Function, key?: string): void
  /**
   * Remove an 'update' listener from a DataObject.
   *
   * @param {DataObject} entry - event emitter.
   * @param {string} [key] - event key.
   */
  removeUpdateCallback(entry: DataObject, key?: string): void
}
import EventEmitter = require('node:events')
import { DataObject, Eds } from '../eds'
