/// <reference types="node" />
/**
 * CANopen LSS modes.
 *
 * @enum {number}
 * @see CiA305 "Switch Mode Global" (§3.9.1)
 */
export type LssMode = number
export namespace LssMode {
  /** Only the switch mode service is available. */
  let OPERATION: number
  /** All LSS services are available. */
  let CONFIGURATION: number
}
/**
 * Errors generated during LSS services.
 *
 * @param {object} args - arguments.
 * @param {string} args.message - error message.
 * @param {number} args.code - error code.
 * @param {number} args.info - error info code.
 */
export class LssError extends Error {
  constructor(args: { message: string; code?: number; info?: number })
  constructor(message: string, code?: number, info?: number)
  code: number
  info: number
}
declare const Lss_base: {
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
 * CANopen LSS protocol handler.
 *
 * @param {Eds} eds - Eds object.
 * @see CiA305 "Layer Settings Services and Protocol (LSS)"
 * @implements {Protocol}
 */
export class Lss extends Lss_base implements Protocol {
  _mode: number
  pending: { [key: string]: { resolve: Function; reject: Function; timer: NodeJS.Timeout } }
  select: number[]
  scanState: number
  identity: {
    vendorId: number
    productCode: number
    revisionNumber: number
    serialNumber: number
  }
  /**
   * Device LSS Mode.
   *
   * @type {LssMode}
   */
  get mode(): number
  /**
   * Vendor id.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setIdentity} instead.
   */
  set vendorId(value: number)
  /**
   * Vendor id.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getIdentity} instead.
   */
  get vendorId(): number
  /**
   * Product code.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setIdentity} instead.
   */
  set productCode(value: number)
  /**
   * Product code.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getIdentity} instead.
   */
  get productCode(): number
  /**
   * Revision number.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setIdentity} instead.
   */
  set revisionNumber(value: number)
  /**
   * Revision number.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getIdentity} instead.
   */
  get revisionNumber(): number
  /**
   * Serial number.
   *
   * @type {number}
   * @deprecated Use {@link Eds#setIdentity} instead.
   */
  set serialNumber(value: number)
  /**
   * Serial number.
   *
   * @type {number}
   * @deprecated Use {@link Eds#getIdentity} instead.
   */
  get serialNumber(): number
  /**
   * Set the LSS mode.
   *
   * @param {LssMode} mode - new mode.
   * @fires Lss#changeMode
   */
  setMode(mode: LssMode): void
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
  fastscan(args?: {
    vendorId?: number
    productCode?: number
    revisionNumber?: number
    serialNumber?: number
    timeout?: number
  }): Promise<null | object>
  /**
   * Service: switch mode global.
   *
   * @param {LssMode} mode - LSS mode to switch to.
   * @see CiA305 "Switch Mode Global" (§3.9.1)
   */
  switchModeGlobal(mode: LssMode): void
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
  switchModeSelective(args: {
    vendorId: number
    productCode: number
    revisionNumber: number
    serialNumber: number
    timeout?: number
  }): Promise<LssMode>
  /**
   * Service: configure node-id.
   *
   * @param {number} nodeId - new node-id
   * @param {number} timeout - time until promise is rejected.
   * @returns {Promise} resolves when the service is finished.
   * @see CiA305 "Configure Node-ID Protocol" (§3.10.1)
   */
  configureNodeId(nodeId: number, timeout?: number): Promise<any>
  /**
   * Service: configure bit timing parameters.
   *
   * @param {number} tableSelect - which bit timing parameters table to use.
   * @param {number} tableIndex - the entry in the selected table to use.
   * @param {number} timeout - time until promise is rejected.
   * @returns {Promise} resolves when the service is finished.
   * @see CiA305 "Configure Bit Timing Parameters Protocol" (§3.10.2)
   */
  configureBitTiming(tableSelect: number, tableIndex: number, timeout?: number): Promise<any>
  /**
   * Service: activate bit timing parameters.
   *
   * @param {number} delay - switch delay in ms.
   * @see CiA305 "Activate Bit Timing Parameters Protocol" (§3.10.3)
   */
  activateBitTiming(delay: number): void
  /**
   * Service: store configuration.
   *
   * @param {number} timeout - time until promise is rejected.
   * @returns {Promise} resolves when the service is finished.
   * @see CiA305 "Store Configuration Protocol" (§3.10.4)
   */
  storeConfiguration(timeout?: number): Promise<any>
  /**
   * Service: inquire identity vendor-id.
   *
   * @param {number} timeout - time until promise is rejected.
   * @returns {Promise<number>} - LSS consumer vendor-id.
   * @see CiA305 "Inquire Identity Vendor-ID Protocol" (§3.11.1.1)
   */
  inquireVendorId(timeout?: number): Promise<number>
  /**
   * Service: inquire identity product-code.
   *
   * @param {number} timeout - time until promise is rejected.
   * @returns {Promise<number>} - LSS consumer product-code.
   * @see CiA305 "Inquire Identity Product-Code Protocol" (§3.11.1.2)
   */
  inquireProductCode(timeout?: number): Promise<number>
  /**
   * Service: inquire identity revision-number.
   *
   * @param {number} timeout - time until promise is rejected.
   * @returns {Promise<number>} - LSS consumer revision-number.
   * @see CiA305 "Inquire Identity Revision-Number Protocol" (§3.11.1.3)
   */
  inquireRevisionNumber(timeout?: number): Promise<number>
  /**
   * Service: inquire identity serial-number.
   *
   * @param {number} timeout - time until promise is rejected.
   * @returns {Promise<number>} - LSS consumer serial-number.
   * @see CiA305 "Inquire Identity Serial-Number Protocol" (§3.11.1.4)
   */
  inquireSerialNumber(timeout?: number): Promise<number>
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
   * Called when 0x1018 (Identity object) is updated.
   *
   * @param {DataObject} entry - updated DataObject.
   * @listens DataObject#update
   * @private
   */
  private _parse1018
  /**
   * Called when 0x1018 (Identity object) is removed.
   *
   * @private
   */
  private _clear1018
  /**
   * Send an LSS request object.
   *
   * @param {LssCommand} command - LSS command specifier.
   * @param {Buffer} data - command data.
   * @private
   */
  private _sendLssRequest
  /**
   * Send an LSS response object.
   *
   * @param {LssCommand} command - LSS command specifier.
   * @param {number} code - response code.
   * @param {number} info - response info.
   * @private
   */
  private _sendLssResponse
}
export {}
