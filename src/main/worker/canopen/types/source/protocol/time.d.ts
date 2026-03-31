/// <reference types="node" />
declare const Time_base: {
  new (eds: any): {
    eds: any
    started: boolean
    callbacks: {}
    start(): void
    stop(): void
    /**
     * Set object 0x1012 [bit 30] - Time producer enable.
     *
     * @type {boolean}
     * @deprecated Use {@link Eds#setTimeProducerEnable} instead.
     */
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
export class Time extends Time_base implements Protocol {
  _consume: boolean
  _produce: boolean
  _cobId: number
  /**
   * Set object 0x1012 [bit 30] - Time producer enable.
   *
   * @type {boolean}
   * @deprecated Use {@link Eds#setTimeProducerEnable} instead.
   */
  set produce(enable: boolean)
  /**
   * Get object 0x1012 [bit 30] - Time producer enable.
   *
   * @type {boolean}
   * @deprecated Use {@link Eds#getTimeProducerEnable} instead.
   */
  get produce(): boolean
  /**
   * Set object 0x1012 [bit 31] - Time consumer enable.
   *
   * @type {boolean}
   * @deprecated Use {@link Eds#setTimeConsumerEnable} instead.
   */
  set consume(enable: boolean)
  /**
   * Get object 0x1012 [bit 31] - Time consumer enable.
   *
   * @type {boolean}
   * @deprecated Use {@link Eds#getTimeConsumerEnable} instead.
   */
  get consume(): boolean
  /**
   * Set object 0x1012 - COB-ID TIME.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setTimeCobId} instead.
   */
  set cobId(cobId: number)
  /**
   * Get object 0x1012 - COB-ID TIME.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getTimeCobId} instead.
   */
  get cobId(): number
  /**
   * Service: TIME write.
   *
   * @param {Date} date - date to write.
   * @fires Protocol#message
   */
  write(date: Date): void
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
   * Called when 0x1012 (COB-ID TIME) is updated.
   *
   * @param {DataObject} data - updated DataObject.
   * @private
   */
  private _parse1012
  /**
   * Called when 0x1012 (COB-ID TIME) is removed.
   *
   * @private
   */
  private _clear1012
}
export {}
