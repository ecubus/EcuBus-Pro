/// <reference types="node" />
/**
 * NMT internal states.
 *
 * @enum {number}
 * @see CiA301 "NMT states" (§7.3.2.2)
 */
export type NmtState = number
export namespace NmtState {
  /** The CANopen device's parameters are set to their power-on values. */
  let INITIALIZING: number
  /**
   * Communication via SDOs is possible, but PDO communication is not
   * allowed. PDO configuration may be performed by the application.
   */
  let PRE_OPERATIONAL: number
  /**
   * All communication objects are active. Access to certain aspects of the
   * application may be limited.
   */
  let OPERATIONAL: number
  /** No communication except for node guarding and heartbeat. */
  let STOPPED: number
}
declare const Nmt_base: {
  new (eds: any): {
    eds: any
    started: boolean
    callbacks: {}
    start(): void
    stop(): void
    receive(message: { id: number; data: Buffer }): void
    send(id: number, data: Buffer): void
    addEdsCallback(eventName: string, listener: Function): void
    removeEdsCallback(eventName: string): void
    addUpdateCallback(entry: DataObject, listener: Function, key?: string): void
    removeUpdateCallback(entry: DataObject, key?: string): void
    addListener<E extends string | symbol>(
      eventName: string | symbol,
      listener: (...args: any[]) => void
    ): any
    emit<E_1 extends string | symbol>(eventName: string | symbol, ...args: any[]): boolean
    eventNames(): (string | symbol)[]
    getMaxListeners(): number
    listenerCount<E_2 extends string | symbol>(
      eventName: string | symbol,
      listener?: (...args: any[]) => void
    ): number
    listeners<E_3 extends string | symbol>(eventName: string | symbol): ((...args: any[]) => void)[]
    off<E_4 extends string | symbol>(
      eventName: string | symbol,
      listener: (...args: any[]) => void
    ): any
    on<E_5 extends string | symbol>(
      eventName: string | symbol,
      listener: (...args: any[]) => void
    ): any
    once<E_6 extends string | symbol>(
      eventName: string | symbol,
      listener: (...args: any[]) => void
    ): any
    prependListener<E_7 extends string | symbol>(
      eventName: string | symbol,
      listener: (...args: any[]) => void
    ): any
    prependOnceListener<E_8 extends string | symbol>(
      eventName: string | symbol,
      listener: (...args: any[]) => void
    ): any
    rawListeners<E_9 extends string | symbol>(
      eventName: string | symbol
    ): ((...args: any[]) => void)[]
    removeAllListeners<E_10 extends string | symbol>(eventName?: string | symbol): any
    removeListener<E_11 extends string | symbol>(
      eventName: string | symbol,
      listener: (...args: any[]) => void
    ): any
    setMaxListeners(n: number): any
    [EventEmitter.captureRejectionSymbol]?(
      error: Error,
      event: string | symbol,
      ...args: any[]
    ): void
  }
  EventEmitter: typeof import('node:events')
  addAbortListener(signal: AbortSignal, resource: (event: Event) => void): Disposable
  getEventListeners(
    emitter: import('node:events')<any>,
    name: string | symbol
  ): ((...args: any[]) => void)[]
  getEventListeners(emitter: EventTarget, name: string): ((...args: any[]) => void)[]
  getMaxListeners(emitter: import('node:events')<any> | EventTarget): number
  listenerCount(emitter: import('node:events')<any>, eventName: string | symbol): number
  listenerCount(emitter: EventTarget, eventName: string): number
  on(
    emitter: import('node:events')<any>,
    eventName: string | symbol,
    options?: import('node:events').OnOptions
  ): NodeJS.AsyncIterator<any[], undefined, any>
  on(
    emitter: EventTarget,
    eventName: string,
    options?: import('node:events').OnOptions
  ): NodeJS.AsyncIterator<any[], undefined, any>
  once(
    emitter: import('node:events')<any>,
    eventName: string | symbol,
    options?: import('node:events').OnceOptions
  ): Promise<any[]>
  once(
    emitter: EventTarget,
    eventName: string,
    options?: import('node:events').OnceOptions
  ): Promise<any[]>
  setMaxListeners(
    n: number,
    ...eventTargets: readonly (import('node:events')<any> | EventTarget)[]
  ): void
  readonly captureRejectionSymbol: typeof import('node:events').captureRejectionSymbol
  captureRejections: boolean
  defaultMaxListeners: number
  readonly errorMonitor: typeof import('node:events').errorMonitor
  EventEmitterAsyncResource: typeof import('node:events').EventEmitterAsyncResource
}
/**
 * CANopen NMT protocol handler.
 *
 * The network management (NMT) protocol follows a producer-consumer structure
 * where NMT objects are used to initialze, start, monitor, reset, or stop
 * nodes. All CANopen devices are considered NMT consumers with one device
 * fulfilling the role of NMT producer.
 *
 * This class implements the NMT node control services and tracks the device's
 * current NMT consumer state.
 *
 * @param {Eds} eds - Eds object.
 * @see CiA301 "Network management" (§7.2.8)
 * @implements {Protocol}
 */
export class Nmt extends Nmt_base implements Protocol {
  deviceId: number | null
  consumers: { [deviceId: number]: { state: NmtState; timer: NodeJS.Timeout | null; last: number } }
  heartbeatTimer: NodeJS.Timeout | null
  _state: number
  /**
   * Device NMT state.
   *
   * @type {NmtState}
   */
  get state(): number
  /**
   * Consumer heartbeat timers (deprecated).
   *
   * @type {Array}
   * @deprecated
   */
  get timers(): any[]
  /**
   * Set object 0x1017 - Producer heartbeat time.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setHeartbeatProducerTime} instead.
   */
  set producerTime(value: number)
  /**
   * Get object 0x1017 - Producer heartbeat time.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getHeartbeatProducerTime} instead.
   */
  get producerTime(): number
  /**
   * Set the Nmt state.
   *
   * @param {NmtState} state - new state.
   * @fires Nmt#changeState
   */
  setState(state: NmtState): void
  /**
   * Get the consumer heartbeat time for a device.
   *
   * @param {number} deviceId - device COB-ID to get.
   * @returns {number | null} the consumer heartbeat time or null.
   * @since 5.1.0
   */
  getConsumerTime(deviceId: number): number | null
  /**
   * Get a device's NMT state.
   *
   * @param {object} args - arguments.
   * @param {number} args.deviceId - CAN identifier (defaults to this device).
   * @param {number} args.timeout - How long to wait for a new heartbeat (ms).
   * @returns {Promise<NmtState | null>} The node NMT state or null.
   * @since 6.0.0
   */
  getNodeState(args: { deviceId?: number; timeout?: number }): Promise<NmtState | null>
  getNodeState(deviceId?: number, timeout?: number): Promise<NmtState | null>
  /**
   * Service: start remote node.
   *
   * Change the state of NMT consumer(s) to NMT state operational.
   *
   * @param {number} [nodeId] - id of node or 0 for broadcast.
   * @see CiA301 "Service start remote node" (§7.2.8.2.1.2)
   */
  startNode(nodeId?: number): void
  /**
   * Service: stop remote node.
   *
   * Change the state of NMT consumer(s) to NMT state stopped.
   *
   * @param {number} [nodeId] - id of node or 0 for broadcast.
   * @see CiA301 "Service stop remote node" (§7.2.8.2.1.3)
   */
  stopNode(nodeId?: number): void
  /**
   * Service: enter pre-operational.
   *
   * Change the state of NMT consumer(s) to NMT state pre-operational.
   *
   * @param {number} [nodeId] - id of node or 0 for broadcast.
   * @see CiA301 "Service enter pre-operational" (§7.2.8.2.1.4)
   */
  enterPreOperational(nodeId?: number): void
  /**
   * Service: reset node.
   *
   * Reset the application of NMT consumer(s).
   *
   * @param {number} [nodeId] - id of node or 0 for broadcast.
   * @fires Protocol#message
   * @see CiA301 "Service reset node" (§7.2.8.2.1.5)
   */
  resetNode(nodeId?: number): void
  /**
   * Service: reset communication.
   *
   * Reset communication of NMT consumer(s).
   *
   * @param {number} [nodeId] - id of node or 0 for broadcast.
   * @fires Protocol#message
   * @see CiA301 "Service reset communication" (§7.2.8.2.1.6)
   */
  resetCommunication(nodeId?: number): void
  /**
   * Listens for new Eds entries.
   *
   * @param {DataObject} entry - new entry.
   * @listens Eds#newEntry
   * @private
   */
  private _addEntry
  /**
   * Listens for removed Eds entries.
   *
   * @param {DataObject} entry - removed entry.
   * @listens Eds#newEntry
   * @private
   */
  private _removeEntry
  /**
   * Called when 0x1016 (Consumer heartbeat time) is updated.
   *
   * @param {DataObject} entry - updated DataObject.
   * @listens DataObject#update
   * @private
   */
  private _parse1016
  /**
   * Called when 0x1016 (Consumer heartbeat time) is removed.
   *
   * @private
   */
  private _clear1016
  /**
   * Called when 0x1017 (Producer heartbeat time) is updated.
   *
   * @param {DataObject} entry - updated DataObject.
   * @listens DataObject#update
   * @private
   */
  private _parse1017
  /**
   * Called when 0x1017 (Producer heartbeat time) is removed.
   *
   * @private
   */
  private _clear1017
  /**
   * Serve an NMT command object.
   *
   * @param {number} nodeId - id of node or 0 for broadcast.
   * @param {NmtCommand} command - NMT command to serve.
   * @fires Protocol#message
   * @private
   */
  private _sendNmt
  /**
   * Serve a Heartbeat object.
   *
   * @fires Protocol#message
   * @private
   */
  private _sendHeartbeat
  /**
   * Parse an NMT command.
   *
   * @param {NmtCommand} command - NMT command to handle.
   * @fires Nmt#changeState
   * @fires Nmt#reset
   * @private
   */
  private _handleNmt
  /**
   * Emit the reset event.
   *
   * @param {boolean} resetNode - true if a full reset was requested.
   * @fires Nmt#reset
   * @private
   */
  private _emitReset
  /**
   * Get an entry from 0x1016 (Consumer heartbeat time).
   *
   * @param {number} deviceId - device COB-ID of the entry to get.
   * @returns {DataObject | null} the matching entry or null.
   * @deprecated Use {@link Nmt#getConsumerTime} instead.
   * @function
   */
  getConsumer: (deviceId: number) => DataObject | null
  /**
   * Add an entry to 0x1016 (Consumer heartbeat time).
   *
   * @param {number} deviceId - device COB-ID to add.
   * @param {number} timeout - milliseconds before a timeout is reported.
   * @param {number} [subIndex] - sub-index to store the entry, optional.
   * @deprecated Use {@link Eds#addHeartbeatConsumer} instead.
   * @function
   */
  addConsumer: (deviceId: number, timeout: number, subIndex?: number) => void
  /**
   * Remove an entry from 0x1016 (Consumer heartbeat time).
   *
   * @param {number} deviceId - device COB-ID of the entry to remove.
   * @deprecated Use {@link Eds#removeHeartbeatConsumer} instead.
   * @function
   */
  removeConsumer: (deviceId: number) => void
}
export {}
