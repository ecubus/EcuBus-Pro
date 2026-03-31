/// <reference types="node" />
/**
 * CANopen emergency error code classes.
 *
 * @enum {number}
 * @see CiA301 "Emergency object (EMCY)" (§7.2.7)
 */
export type EmcyType = number
export namespace EmcyType {
  /** Error reset or no error. */
  let ERROR_RESET: number
  /** Generic error. */
  let GENERIC_ERROR: number
  /** Current error. */
  let CURRENT_GENERAL: number
  /** Current error, CANopen device input side. */
  let CURRENT_INPUT: number
  /** Current error inside the CANopen device. */
  let CURRENT_INTERNAL: number
  /** Current error, CANopen device output side. */
  let CURRENT_OUTPUT: number
  /** Voltage error. */
  let VOLTAGE_GENERAL: number
  /** Voltage error, mains. */
  let VOLTAGE_MAINS: number
  /** Voltage error inside the CANopen device. */
  let VOLTAGE_INTERNAL: number
  /** Voltage error, CANopen device output side. */
  let VOLTAGE_OUTPUT: number
  /** Temperature error. */
  let TEMPERATURE_GENERAL: number
  /** Temperature error, ambient. */
  let TEMPERATURE_AMBIENT: number
  /** Temperature error, CANopen device. */
  let TEMPERATURE_DEVICE: number
  /** CANopen device hardware error. */
  let HARDWARE: number
  /** CANopen device software error. */
  let SOFTWARE_GENERAL: number
  /** Internal software error. */
  let SOFTWARE_INTERNAL: number
  /** User software error. */
  let SOFTWARE_USER: number
  /** Data set error. */
  let SOFTWARE_DATA: number
  /** Additional modules error. */
  let MODULES: number
  /** Monitoring error. */
  let MONITORING: number
  /** Monitoring error, communication. */
  let COMMUNICATION: number
  /** Monitoring error, protocol. */
  let PROTOCOL: number
  /** External error. */
  let EXTERNAL: number
  /** Additional functions error. */
  let ADDITIONAL_FUNCTIONS: number
  /** CANopen device specific error. */
  let DEVICE_SPECIFIC: number
}
/**
 * CANopen emergency error codes.
 *
 * @enum {number}
 * @see CiA301 "Emergency object (EMCY)" (§7.2.7)
 */
export type EmcyCode = number
export namespace EmcyCode {
  /** CAN overrun (objects lost). */
  let CAN_OVERRUN: number
  /** CAN in error passive mode. */
  let BUS_PASSIVE: number
  /** Life guard or heartbeat error. */
  let HEARTBEAT: number
  /** CAN recovered from bus off. */
  let BUS_OFF_RECOVERED: number
  /** CAN-ID collision. */
  let CAN_ID_COLLISION: number
  /** PDO not processed due to length error. */
  let PDO_LENGTH: number
  /** PDO length exceeded. */
  let PDO_LENGTH_EXCEEDED: number
  /** DAM MPDO not processed, destination object not available. */
  let DAM_MPDO: number
  /** Unexpected SYNC data length. */
  let SYNC_LENGTH: number
  /** RPDO timed out. */
  let RPDO_TIMEOUT: number
  /** Unexpected TIME data length. */
  let TIME_LENGTH: number
}
/**
 * Structure for storing and parsing CANopen emergency objects.
 *
 * @param {object} args - arguments.
 * @param {EmcyCode} args.code - error code.
 * @param {number} args.register - error register (Object 0x1001).
 * @param {Buffer} args.info - error info.
 */
export class EmcyMessage {
  /**
   * Returns true if the object is an instance of EmcyMessage.
   *
   * @param {object} obj - object to test.
   * @returns {boolean} true if obj is an EmcyMessage.
   */
  static isMessage(obj: object): boolean
  constructor(args: { code: EmcyCode; register?: number; info?: Buffer })
  constructor(code: EmcyCode, register?: number, info?: Buffer)
  code: number
  register: number
  info: Buffer
  /**
   * Convert to a string.
   *
   * @returns {string} string representation.
   */
  toString(): string
  /**
   * Convert to a Buffer.
   *
   * @returns {Buffer} encoded data.
   */
  toBuffer(): Buffer
}
declare const Emcy_base: {
  new (eds: any): {
    /** Generic error. */
    eds: any
    started: boolean
    callbacks: {}
    start(): void
    stop(): void
    receive(message: { id: number; data: Buffer }): void
    /** Internal software error. */
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
 * CANopen EMCY protocol handler.
 *
 * The emergency (EMCY) protocol follows a producer-consumer structure where
 * emergency objects are used to indicate CANopen device errors. An emergency
 * object should be transmitted only once per error event.
 *
 * This class implements the EMCY write service for producing emergency objects.
 *
 * @param {Eds} eds - Eds object.
 * @see CiA301 "Emergency object" (§7.2.7)
 * @implements {Protocol}
 */
export class Emcy extends Emcy_base implements Protocol {
  sendQueue: EmcyMessage[]
  sendTimer: NodeJS.Timeout | null
  consumers: number[]
  _valid: boolean
  _cobId: number
  /**
   * Set object 0x1001 - Error register.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setErrorRegister} instead.
   */
  set register(flags: number)
  /**
   * Get object 0x1001 - Error register.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getErrorRegister} instead.
   */
  get register(): number
  /**
   * Set object 0x1014 [bit 31] - EMCY valid.
   *
   * @type {boolean}
   * @deprecated Use {@link Eds#setEmcyValid} instead.
   */
  set valid(valid: boolean)
  /**
   * Get object 0x1014 [bit 31] - EMCY valid.
   *
   * @type {boolean}
   * @deprecated Use {@link Eds#getEmcyValid} instead.
   */
  get valid(): boolean
  /**
   * Set object 0x1014 - COB-ID EMCY.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setEmcyCobId} instead.
   */
  set cobId(value: number)
  /**
   * Get object 0x1014 - COB-ID EMCY.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getEmcyCobId} instead.
   */
  get cobId(): number
  /**
   * Set object 0x1015 - Inhibit time EMCY.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setEmcyInhibitTime} instead.
   */
  set inhibitTime(value: number)
  /**
   * Get object 0x1015 - Inhibit time EMCY.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getEmcyInhibitTime} instead.
   */
  get inhibitTime(): number
  /**
   * Service: EMCY write.
   *
   * @param {object} args - arguments.
   * @param {number} args.code - error code.
   * @param {Buffer} [args.info] - error info.
   */
  write(
    ...args: {
      code: number
      info?: Buffer
    }
  ): void
  /**
   * Listens for new Eds entries.
   *
   * @param {DataObject} entry - new entry.
   * @private
   */
  private _addEntry
  /**
   * Listens for removed Eds entries.
   *
   * @param {DataObject} entry - removed entry.
   * @private
   */
  private _removeEntry
  /**
   * Called when 0x1014 (COB-ID EMCY) is updated.
   *
   * @param {DataObject} entry - updated DataObject.
   * @listens DataObject#update
   * @private
   */
  private _parse1014
  /**
   * Called when 0x1014 (COB-ID EMCY) is removed.
   *
   * @private
   */
  private _clear1014
  /**
   * Called when 0x1015 (Inhibit time EMCY) is updated.
   *
   * @param {DataObject} entry - updated DataObject.
   * @listens DataObject#update
   * @private
   */
  private _parse1015
  /**
   * Called when 0x1015 (Inhibit time EMCY) is removed.
   *
   * @private
   */
  private _clear1015
  /**
   * Called when 0x1028 (Emergency consumer object) is updated.
   *
   * @listens DataObject#update
   * @private
   */
  private _parse1028
  /**
   * Called when 0x1028 (Emergency consumer object) is removed.
   *
   * @private
   */
  private _clear1028
}
export {}
