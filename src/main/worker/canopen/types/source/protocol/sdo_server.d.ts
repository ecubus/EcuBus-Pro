/// <reference types="node" />
declare const SdoServer_base: {
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
 * CANopen SDO protocol handler (Server).
 *
 * The service data object (SDO) protocol uses a client-server structure where
 * a client can initiate the transfer of data from the server's object
 * dictionary. An SDO is transfered as a sequence of segments with basic
 * error checking.
 *
 * @param {Eds} eds - parent device.
 * @see CiA301 'Service data object (SDO)' (§7.2.4)
 * @implements {Protocol}
 */
export class SdoServer extends SdoServer_base implements Protocol {
  transfers: { [cobId: number]: SdoTransfer }
  _blockSize: number
  _blockInterval: number | null
  /**
   * Number of segments per block when serving block transfers.
   *
   * @type {number}
   */
  get blockSize(): number
  /**
   * Time delay between each segment during a block transfer.
   *
   * @type {number}
   * @since 6.2.0
   */
  get blockInterval(): number
  /**
   * Set the number of segments per block when serving block transfers.
   *
   * @param {number} value - block size [1-127].
   * @since 6.0.0
   */
  setBlockSize(value: number): void
  /**
   * Set the time delay between each segment during a block transfer.
   *
   * @param {number} value - block interval in milliseconds.
   * @since 6.2.0
   */
  setBlockInterval(value: number): void
  /**
   * Add an SDO client.
   *
   * @param {object} args - SDO client parameters.
   * @param {number} args.cobIdTx - COB-ID server -> client.
   * @param {number} args.cobIdRx - COB-ID client -> server.
   * @private
   */
  private _addClient
  /**
   * Remove an SDO client.
   *
   * @param {object} args - SDO client parameters.
   * @param {number} args.cobIdRx - COB-ID client -> server.
   * @private
   */
  private _removeClient
  /**
   * Handle ClientCommand.DOWNLOAD_INITIATE.
   *
   * @param {SdoTransfer} client - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _downloadInitiate
  /**
   * Handle ClientCommand.UPLOAD_INITIATE.
   *
   * @param {SdoTransfer} client - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _uploadInitiate
  /**
   * Handle ClientCommand.UPLOAD_SEGMENT.
   *
   * @param {SdoTransfer} client - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _uploadSegment
  /**
   * Handle ClientCommand.DOWNLOAD_SEGMENT.
   *
   * @param {SdoTransfer} client - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _downloadSegment
  /**
   * Download a data block.
   *
   * Sub-blocks are scheduled on the event loop to avoid blocking during
   * large transfers.
   *
   * @param {SdoTransfer} client - SDO context.
   * @fires Protocol#message
   * @private
   */
  private _blockUploadProcess
  /**
   * Handle ClientCommand.BLOCK_UPLOAD.
   *
   * @param {SdoTransfer} client - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _blockUploadInitiate
  /**
   * Handle ClientCommand.BLOCK_UPLOAD.
   *
   * @param {SdoTransfer} client - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _blockUploadConfirm
  /**
   * Handle ClientCommand.BLOCK_UPLOAD.
   *
   * @param {SdoTransfer} client - SDO context.
   * @fires Protocol#message
   * @private
   */
  private _blockUploadEnd
  /**
   * Handle ClientCommand.BLOCK_DOWNLOAD.
   *
   * @param {SdoTransfer} client - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _blockDownload
  /**
   * Abort a transfer.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @param {SdoCode} code - SDO abort code.
   * @fires Protocol#message
   * @private
   */
  private _abortTransfer
}
import { DataObject } from '../eds'
import { SdoTransfer } from './sdo'
export {}
