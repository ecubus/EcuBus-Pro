/// <reference types="node" />
declare const Pdo_base: {
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
 * CANopen PDO protocol handler.
 *
 * The process data object (PDO) protocol follows a producer-consumer structure
 * where one device broadcasts data that can be consumed by any device on the
 * network. Unlike the SDO protocol, PDO transfers are performed with no
 * protocol overhead.
 *
 * @param {Eds} eds - Eds object.
 * @see CiA301 "Process data objects (PDO)" (§7.2.2)
 * @implements {Protocol}
 */
export class Pdo extends Pdo_base implements Protocol {
  receiveMap: { [cobId: number]: object }
  transmitMap: { [cobId: number]: object }
  eventTimers: { [cobId: number]: NodeJS.Timeout }
  events: Array<{ entry: DataObject; cobId: number }>
  syncTpdo: { [cobId: number]: object }
  syncCobId: number | null
  updateFlags: { [cobId: number]: boolean }
  /**
   * Service: PDO write
   *
   * @param {number} cobId - mapped TPDO to send.
   * @fires Protocol#message
   */
  write(cobId: number): void
  addListener(eventName: 'pdo', listener: (pdo: PdoEventData) => void): this
  on(eventName: 'pdo', listener: (pdo: PdoEventData) => void): this
  once(eventName: 'pdo', listener: (pdo: PdoEventData) => void): this
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
   * Add an RPDO.
   *
   * @param {object} pdo - PDO data.
   * @private
   */
  private _addRpdo
  /**
   * Remove an RPDO.
   *
   * @param {object} pdo - PDO data.
   * @private
   */
  private _removeRpdo
  /**
   * Add a TPDO.
   *
   * @param {object} pdo - PDO data.
   * @private
   */
  private _addTpdo
  /**
   * Remove a TPDO.
   *
   * @param {object} pdo - PDO data.
   * @private
   */
  private _removeTpdo
  /**
   * Emit a PDO object.
   *
   * @param {object} pdo - object to emit.
   * @fires Pdo#pdo
   * @private
   */
  private _emitPdo
}
import { DataObject } from '../eds'
export type PdoEventData = {
  cobId: number
  transmissionType: number
  inhibitTime: number
  dataObjects: DataObject[]
}
export {}
