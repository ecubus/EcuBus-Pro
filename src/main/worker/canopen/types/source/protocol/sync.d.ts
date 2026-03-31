/// <reference types="node" />
declare const Sync_base: {
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
export class Sync extends Sync_base implements Protocol {
  syncCounter: number
  syncTimer: NodeJS.Timeout
  _overflow: number
  _cobId: number
  _generate: boolean
  /**
   * Set object 0x1005 [bit 30] - Sync generation enable.
   *
   * @type {boolean}
   * @deprecated Use {@link Eds#setSyncGenerationEnable} instead.
   */
  set generate(enable: boolean)
  /**
   * Get object 0x1005 [bit 30] - Sync generation enable.
   *
   * @type {boolean}
   * @deprecated Use {@link Eds#getSyncGenerationEnable} instead.
   */
  get generate(): boolean
  /**
   * Set object 0x1005 - COB-ID SYNC.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setSyncCobId} instead.
   */
  set cobId(cobId: number)
  /**
   * Get object 0x1005 - COB-ID SYNC.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getSyncCobId} instead.
   */
  get cobId(): number
  /**
   * Set object 0x1006 - Communication cycle period.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setSyncCyclePeriod} instead.
   */
  set cyclePeriod(period: number)
  /**
   * Get object 0x1006 - Communication cycle period.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getSyncCyclePeriod} instead.
   */
  get cyclePeriod(): number
  /**
   * Set object 0x1019 - Synchronous counter overflow value.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setSyncOverflow} instead.
   */
  set overflow(overflow: number)
  /**
   * Get object 0x1019 - Synchronous counter overflow value.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getSyncOverflow} instead.
   */
  get overflow(): number
  /**
   * Service: SYNC write.
   *
   * @param {number | null} counter - sync counter;
   * @fires Protocol#message
   */
  write(counter?: number | null): void
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
   * Called when 0x1005 (COB-ID SYNC) is updated.
   *
   * @param {DataObject} entry - updated DataObject.
   * @private
   */
  private _parse1005
  /**
   * Called when 0x1005 (COB-ID SYNC) is removed.
   *
   * @private
   */
  private _clear1005
  /**
   * Called when 0x1006 (Communication cycle period) is updated.
   *
   * @param {DataObject} entry - updated DataObject.
   * @private
   */
  private _parse1006
  /**
   * Called when 0x1006 (Communication cycle period) is removed.
   *
   * @private
   */
  private _clear1006
  /**
   * Called when 0x1019 (Synchronous counter overflow value) is updated.
   *
   * @param {DataObject} entry - updated DataObject.
   * @private
   */
  private _parse1019
  /**
   * Called when 0x1019 (Synchronous counter overflow value) is removed.
   *
   * @private
   */
  private _clear1019
}
export {}
