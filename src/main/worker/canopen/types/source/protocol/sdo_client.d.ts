/// <reference types="node" />
declare const SdoClient_base: {
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
 * CANopen SDO protocol handler (Client).
 *
 * The service data object (SDO) protocol uses a client-server structure where
 * a client can initiate the transfer of data from the server's object
 * dictionary. An SDO is transfered as a sequence of segments with basic
 * error checking.
 *
 * @param {Eds} eds - Eds object.
 * @see CiA301 'Service data object (SDO)' (§7.2.4)
 * @implements {Protocol}
 */
export class SdoClient extends SdoClient_base implements Protocol {
  sdoServers: Array<{ deviceId: number; cobIdTx: number; cobIdRx: number; queue: any }>
  transfers: { [cobId: number]: SdoTransfer }
  _blockSize: number
  /**
   * Number of segments per block when serving block transfers.
   *
   * @type {number}
   */
  get blockSize(): number
  /**
   * Set the number of segments per block when serving block transfers.
   *
   * @param {number} value - block size [1-127].
   * @since 6.0.0
   */
  setBlockSize(value: number): void
  /**
   * Service: SDO upload
   *
   * Read data from an SDO server.
   *
   * @param {object} args - arguments to destructure.
   * @param {number} args.deviceId - SDO server.
   * @param {number} args.index - data index to upload.
   * @param {number} args.subIndex - data subIndex to upload.
   * @param {DataType} [args.dataType] - expected data type.
   * @param {number} [args.timeout] - time before transfer is aborted.
   * @param {boolean} [args.blockTransfer] - use block transfer protocol.
   * @param {number} [args.blockInterval] - minimum time between data blocks.
   * @param {number} [args.cobIdRx] -  COB-ID server -> client.
   * @returns {Promise<Buffer | number | bigint | string | Date>} resolves when the upload is complete.
   * @fires Protocol#message
   */
  upload(args: {
    deviceId: number
    index: number
    subIndex: number
    dataType?: DataType
    timeout?: number
    blockTransfer?: boolean
    blockInterval?: number
    cobIdRx?: number
  }): Promise<Buffer | number | bigint | string | Date>
  /**
   * Service: SDO download.
   *
   * Write data to an SDO server.
   *
   * @param {object} args - arguments to destructure.
   * @param {number} args.deviceId - SDO server.
   * @param {object} args.data - data to download.
   * @param {number} args.index - index or name to download to.
   * @param {number} args.subIndex - data subIndex to download to.
   * @param {DataType} [args.dataType] - type of data to download.
   * @param {number} [args.timeout] - time before transfer is aborted.
   * @param {boolean} [args.blockTransfer] - use block transfer protocol.
   * @param {number} [args.blockInterval] - minimum time between data blocks.
   * @param {number} [args.cobIdRx] -  COB-ID server -> client.
   * @fires Protocol#message
   */
  download(args: {
    deviceId: number
    data: Buffer | DataObject | number | bigint | string | Date
    index: number
    subIndex: number
    dataType?: DataType
    timeout?: number
    blockTransfer?: boolean
    blockInterval?: number
    cobIdRx?: number
  }): Promise<void>
  /**
   * Returns the first SDO server matching deviceId.
   *
   * @param {object} args - SDO client parameters.
   * @param {number} args.deviceId - device identifier.
   * @param {number} args.cobIdRx - COB-ID server -> client.
   * @returns {object | null} server object if found.
   */
  _getServer({ deviceId, cobIdRx }: { deviceId: number; cobIdRx: number }): object | null
  /**
   * Add an SDO server.
   *
   * @param {object} args - SDO client parameters.
   * @param {number} args.deviceId - device identifier.
   * @param {number} args.cobIdTx - COB-ID client -> server.
   * @param {number} args.cobIdRx - COB-ID server -> client.
   * @private
   */
  private _addServer
  /**
   * Remove an SDO server.
   *
   * @param {object} args - SDO client parameters.
   * @param {number} args.deviceId - device identifier.
   * @param {number} args.cobIdRx - COB-ID server -> client.
   * @private
   */
  private _removeServer
  /**
   * Start an SDO upload.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @fires Protocol#message
   * @private
   */
  private _uploadStart
  /**
   * Handle ServerCommand.UPLOAD_INITIATE.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _uploadInitiate
  /**
   * Handle ServerCommand.UPLOAD_SEGMENT.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _uploadSegment
  /**
   * Start an SDO download.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @fires Protocol#message
   * @private
   */
  private _downloadStart
  /**
   * Handle ServerCommand.DOWNLOAD_INITIATE.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @fires Protocol#message
   * @private
   */
  private _downloadInitiate
  /**
   * Handle ServerCommand.DOWNLOAD_SEGMENT.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _downloadSegment
  /**
   * Start an SDO block download.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @fires Protocol#message
   * @private
   */
  private _blockDownloadStart
  /**
   * Download a data block.
   *
   * Sub-blocks are scheduled on the event loop to avoid blocking during
   * large transfers.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @fires Protocol#message
   * @private
   */
  private _blockDownloadProcess
  /**
   * Initiate an SDO block download.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _blockDownloadInitiate
  /**
   * Confirm the previous block and send the next one.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _blockDownloadConfirm
  /**
   * Confirm the previous block and send the next one.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @fires Protocol#message
   * @private
   */
  private _blockDownloadEnd
  /**
   * Start an SDO block upload.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @fires Protocol#message
   * @private
   */
  private _blockUploadStart
  /**
   * Handle ServerCommand.BLOCK_UPLOAD.
   *
   * @param {SdoTransfer} transfer - SDO context.
   * @param {Buffer} data - message data.
   * @fires Protocol#message
   * @private
   */
  private _blockUpload
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
import { DataType } from '../types'
import { DataObject } from '../eds'
import { SdoTransfer } from './sdo'
export {}
