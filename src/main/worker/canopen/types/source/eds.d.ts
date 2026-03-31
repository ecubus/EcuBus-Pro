/**
 * Errors generated due to an improper EDS configuration.
 *
 * @param {string} message - error message.
 */
export class EdsError extends Error {
  constructor(message: string)
}
/**
 * A CANopen Data Object.
 *
 * DataObjects should not be created directly, use {@link Eds#addEntry} or
 * {@link Eds#addSubEntry} instead.
 *
 * @param {string} key - object index key (e.g., 1018sub3)
 * @param {object} data - creation parameters.
 * @param {string} data.parameterName - name of the data object.
 * @param {ObjectType} data.objectType - object type.
 * @param {DataType} data.dataType - data type.
 * @param {AccessType} data.accessType - access restrictions.
 * @param {number} data.lowLimit - minimum value.
 * @param {number} data.highLimit - maximum value.
 * @param {boolean} data.pdoMapping - enable PDO mapping.
 * @param {boolean} data.compactSubObj - use the compact sub-object format.
 * @param {number | string | Date} data.defaultValue - default value.
 * @param {number} data.scaleFactor - optional multiplier for numeric types.
 * @fires DataObject#update
 * @see CiA306 "Object descriptions" (§4.6.3)
 */
export class DataObject extends EventEmitter<any> {
  /**
   * Returns true if the object is an instance of DataObject;
   *
   * @param {*} obj - object to test.
   * @returns {boolean} true if obj is DataObject.
   * @since 6.0.0
   */
  static isDataObject(obj: any): boolean
  constructor(
    key: string,
    data: {
      parameterName: string
      objectType?: ObjectType
      dataType?: DataType
      accessType?: AccessType
      lowLimit?: number
      highLimit?: number
      pdoMapping?: boolean
      compactSubObj?: boolean
      defaultValue?: number | string | Date
      scaleFactor?: number
    }
  )
  parent: DataObject | null
  key: string
  parameterName: string
  objectType: number
  accessType: string
  pdoMapping: boolean
  lowLimit: number | undefined
  highLimit: number | undefined
  defaultValue: number | string | Date | undefined
  scaleFactor: number | undefined
  compactSubObj: boolean | undefined
  objFlags: number | undefined
  _raw: Buffer
  _subObjects: DataObject[]
  dataType: number
  /**
   * The Eds index.
   *
   * @type {number}
   */
  get index(): number
  /**
   * The Eds subIndex.
   *
   * @type {number | null}
   */
  get subIndex(): number
  /**
   * The object type as a string.
   *
   * @type {string}
   */
  get objectTypeString(): string
  /**
   * The data type as a string.
   *
   * @type {string}
   */
  get dataTypeString(): string
  /**
   * Size of the raw data in bytes including sub-entries.
   *
   * @type {number}
   */
  get size(): number
  set raw(raw: Buffer)
  /**
   * The raw data Buffer.
   *
   * @type {Buffer}
   */
  get raw(): Buffer
  set value(value: string | number | bigint | Date)
  /**
   * The cooked value.
   *
   * @type {number | bigint | string | Date}
   * @see {@link Eds.typeToRaw}
   */
  get value(): string | number | bigint | Date
  /**
   * Primitive value conversion.
   *
   * @returns {number | bigint | string | Date} DataObject value.
   * @since 6.0.0
   */
  valueOf(): number | bigint | string | Date
  /**
   * Get a sub-entry.
   *
   * @param {number} index - sub-entry index to get.
   * @returns {DataObject} new DataObject.
   * @since 6.0.0
   */
  at(index: number): DataObject
  /**
   * Create or add a new sub-entry.
   *
   * @param {number} subIndex - sub-entry index to add.
   * @param {DataObject | object} data - An existing {@link DataObject} or
   * the data to create one.
   * @returns {DataObject} new DataObject.
   * @see {@link Eds#addSubEntry}
   * @private
   */
  private addSubObject
  subNumber: number
  /**
   * Remove a sub-entry and return it.
   *
   * @param {number} subIndex - sub-entry index to remove.
   * @returns {DataObject} removed DataObject.
   * @see {@link Eds#removeSubEntry}
   * @private
   */
  private removeSubObject
  /**
   * Emit the update event.
   *
   * @param {DataObject} [obj] - updated object.
   * @fires DataObject#update
   * @private
   */
  private _emitUpdate
}
/**
 * A CANopen Electronic Data Sheet.
 *
 * This class provides methods for loading and saving CANopen EDS v4.0 files.
 *
 * @param {object} info - file info.
 * @param {string} info.fileName - file name.
 * @param {string} info.fileVersion - file version.
 * @param {string} info.fileRevision - file revision.
 * @param {string} info.description - What the file is for.
 * @param {Date} info.creationDate - When the file was created.
 * @param {string} info.createdBy - Who created the file.
 * @param {string} info.vendorName - The device vendor name.
 * @param {number} info.vendorNumber - the device vendor number.
 * @param {string} info.productName - the device product name.
 * @param {number} info.productNumber - the device product number.
 * @param {number} info.revisionNumber - the device revision number.
 * @param {string} info.orderCode - the device order code.
 * @param {Array<number>} info.baudRates - supported buadrates
 * @param {boolean} info.lssSupported - true if LSS is supported.
 * @see CiA306 "Electronic data sheet specification for CANopen"
 */
export class Eds extends EventEmitter<any> {
  /**
   * Returns true if the object is an instance of Eds.
   *
   * @param {object} obj - object to test.
   * @returns {boolean} true if obj is Eds.
   * @since 6.0.0
   */
  static isEds(obj: object): boolean
  /**
   * Create a new Eds from a file path.
   *
   * @param {string} path - path to file.
   * @returns {Eds} new Eds object.
   * @since 6.0.0
   */
  static fromFile(path: string): Eds
  constructor(info?: {
    fileName?: string
    fileVersion?: string
    fileRevision?: string
    description?: string
    creationDate?: Date
    createdBy?: string
    vendorName?: string
    vendorNumber?: number
    productName?: string
    productNumber?: number
    revisionNumber?: number
    orderCode?: string
    baudRates?: Array<number>
    lssSupported?: boolean
  })
  fileInfo: {
    EDSVersion: string
  }
  deviceInfo: {
    SimpleBootUpMaster: number
    SimpleBootUpSlave: number
    Granularity: number
    DynamicChannelsSupported: number
    CompactPDO: number
    GroupMessaging: number
  }
  dummyUsage: {}
  _dataObjects: { [key: string]: DataObject }
  comments: string[]
  nameLookup: { [name: string]: DataObject[] }
  set fileName(value: string)
  /**
   * File name.
   *
   * @type {string}
   */
  get fileName(): string
  set fileVersion(value: number)
  /**
   * File version (8-bit unsigned integer).
   *
   * @type {number}
   */
  get fileVersion(): number
  set fileRevision(value: number)
  /**
   * File revision (8-bit unsigned integer).
   *
   * @type {number}
   */
  get fileRevision(): number
  set description(value: string)
  /**
   * File description.
   *
   * @type {string}
   */
  get description(): string
  set creationDate(value: Date)
  /**
   * File creation time.
   *
   * @type {Date}
   */
  get creationDate(): Date
  set createdBy(value: string)
  /**
   * Name or description of the file creator (max 245 characters).
   *
   * @type {string}
   */
  get createdBy(): string
  set vendorName(value: string)
  /**
   * Vendor name (max 244 characters).
   *
   * @type {string}
   */
  get vendorName(): string
  set vendorNumber(value: number)
  /**
   * Unique vendor ID (32-bit unsigned integer).
   *
   * @type {number}
   */
  get vendorNumber(): number
  set productName(value: string)
  /**
   * Product name (max 243 characters).
   *
   * @type {string}
   */
  get productName(): string
  set productNumber(value: number)
  /**
   * Product code (32-bit unsigned integer).
   *
   * @type {number}
   */
  get productNumber(): number
  set revisionNumber(value: number)
  /**
   * Revision number (32-bit unsigned integer).
   *
   * @type {number}
   */
  get revisionNumber(): number
  set orderCode(value: string)
  /**
   * Product order code (max 245 characters).
   *
   * @type {string}
   */
  get orderCode(): string
  set baudRates(rates: number[])
  /**
   * Supported baud rates.
   *
   * @type {Array<number>}
   */
  get baudRates(): number[]
  set lssSupported(value: boolean)
  /**
   * Indicates if LSS functionality is supported.
   *
   * @type {boolean}
   */
  get lssSupported(): boolean
  /**
   * Constructs and returns the Eds DataObjects keyed by decimal string. This
   * is provided to support old tools. For new code use the new Eds iterator
   * methods (keyed by hex string) instead.
   *
   * @type {object}
   * @deprecated Use {@link Eds#entries} instead.
   */
  get dataObjects(): any
  set modificationDate(value: Date)
  /**
   * Time of the last modification.
   *
   * @type {Date}
   */
  get modificationDate(): Date
  set modifiedBy(value: string)
  /**
   * Name or description of the last modifier (max 244 characters).
   *
   * @type {string}
   */
  get modifiedBy(): string
  set simpleBootUpMaster(value: boolean)
  /**
   * Indicates simple boot-up master functionality (not supported).
   *
   * @type {boolean}
   */
  get simpleBootUpMaster(): boolean
  set simpleBootUpSlave(value: boolean)
  /**
   * Indicates simple boot-up slave functionality (not supported).
   *
   * @type {boolean}
   */
  get simpleBootUpSlave(): boolean
  set granularity(value: number)
  /**
   * Provides the granularity allowed for the mapping on this device - most
   * devices support a granularity of 8. (8-bit integer, max 64).
   *
   * @type {number}
   */
  get granularity(): number
  set dynamicChannelsSupported(value: boolean)
  /**
   * Indicates the facility of dynamic variable generation (not supported).
   *
   * @type {boolean}
   * @see CiA302
   */
  get dynamicChannelsSupported(): boolean
  set groupMessaging(value: boolean)
  /**
   * Indicates the facility of multiplexed PDOs (not supported).
   *
   * @type {boolean}
   * @see CiA301
   */
  get groupMessaging(): boolean
  /**
   * The number of supported receive PDOs (16-bit unsigned integer).
   *
   * @type {number}
   */
  get nrOfRXPDO(): number
  /**
   * The number of supported transmit PDOs (16-bit unsigned integer).
   *
   * @type {number}
   */
  get nrOfTXPDO(): number
  /**
   * Read and parse an EDS file.
   *
   * @param {string} path - path to file.
   */
  load(path: string): void
  /**
   * Write an EDS file.
   *
   * @param {string} path - path to file, defaults to fileName.
   * @param {object} [options] - optional inputs.
   * @param {Date} [options.modificationDate] - file modification date to file.
   * @param {Date} [options.modifiedBy] - file modification date to file.
   */
  save(
    path: string,
    options?: {
      modificationDate?: Date
      modifiedBy?: string
    }
  ): void
  /**
   * Returns a new iterator object that iterates the keys for each entry.
   *
   * @returns {Iterable.<string>} Iterable keys.
   * @since 6.0.0
   */
  keys(): Iterable<string>
  /**
   * Returns a new iterator object that iterates DataObjects.
   *
   * @returns {Iterable.<DataObject>} Iterable DataObjects.
   * @since 6.0.0
   */
  values(): Iterable<DataObject>
  /**
   * Returns a new iterator object that iterates key/DataObjects pairs.
   *
   * @returns {Iterable.<[string, DataObject]>} Iterable [key, DataObject].
   * @since 6.0.0
   */
  entries(): Iterable<[string, DataObject]>
  /**
   * Reset objects to their default values.
   *
   * @since 6.0.0
   */
  reset(): void
  /**
   * Get a data object by name.
   *
   * @param {string} name - name of the data object.
   * @returns {Array<DataObject>} - all entries matching name.
   * @since 6.0.0
   */
  findEntry(name: string): Array<DataObject>
  /**
   * Get a data object by index.
   *
   * @param {number} index - index of the data object.
   * @returns {DataObject | null} - entry matching index.
   */
  getEntry(index: number): DataObject | null
  /**
   * Create a new entry.
   *
   * @param {number} index - index of the data object.
   * @param {object} data - data passed to the {@link DataObject} constructor.
   * @returns {DataObject} - the newly created entry.
   * @fires Eds#newEntry
   */
  addEntry(index: number, data: object): DataObject
  /**
   * Delete an entry.
   *
   * @param {number} index - index of the data object.
   * @returns {DataObject} the deleted entry.
   * @fires Eds#removeEntry
   */
  removeEntry(index: number): DataObject
  /**
   * Get a sub-entry.
   *
   * @param {number | string} index - index or name of the data object.
   * @param {number} subIndex - subIndex of the data object.
   * @returns {DataObject | null} - the sub-entry or null.
   */
  getSubEntry(index: number | string, subIndex: number): DataObject | null
  /**
   * Create a new sub-entry.
   *
   * @param {number} index - index of the data object.
   * @param {number} subIndex - subIndex of the data object.
   * @param {object} data - data passed to the {@link DataObject} constructor.
   * @returns {DataObject} - the newly created sub-entry.
   */
  addSubEntry(index: number, subIndex: number, data: object): DataObject
  /**
   * Delete a sub-entry.
   *
   * @param {number} index - index of the data object.
   * @param {number} subIndex - subIndex of the data object.
   */
  removeSubEntry(index: number, subIndex: number): void
  /**
   * Get object 0x1001 - Error register.
   *
   * @returns {number} error register value.
   * @since 6.0.0
   */
  getErrorRegister(): number
  /**
   * Set object 0x1001 - Error register.
   * - bit 0 - Generic error.
   * - bit 1 - Current.
   * - bit 2 - Voltage.
   * - bit 3 - Temperature.
   * - bit 4 - Communication error.
   * - bit 5 - Device profile specific.
   * - bit 6 - Reserved (always 0).
   * - bit 7 - Manufacturer specific.
   *
   * @param {number | object} flags - error flags.
   * @param {boolean} flags.generic - generic error.
   * @param {boolean} flags.current - current error.
   * @param {boolean} flags.voltage - voltage error.
   * @param {boolean} flags.temperature - temperature error.
   * @param {boolean} flags.communication - communication error.
   * @param {boolean} flags.device - device profile specific error.
   * @param {boolean} flags.manufacturer - manufacturer specific error.
   * @since 6.0.0
   */
  setErrorRegister(
    flags:
      | number
      | {
          generic?: boolean
          current?: boolean
          voltage?: boolean
          temperature?: boolean
          communication?: boolean
          device?: boolean
          manufacturer?: boolean
        }
  ): void
  /**
   * Get object 0x1002 - Manufacturer status register.
   *
   * @returns {number} status register value.
   * @since 6.0.0
   */
  getStatusRegister(): number
  /**
   * Set object 0x1002 - Manufacturer status register.
   *
   * @param {number} status - status register.
   * @param {object} [options] - DataObject creation options.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setStatusRegister(
    status: number,
    options?: {
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1003 - Pre-defined error field.
   *
   * @returns {Array<object>} [{ code, info } ... ]
   * @since 6.0.0
   */
  getErrorHistory(): Array<{ code: number; info: number }>
  /**
   * Push an entry to object 0x1003 - Pre-defined error field.
   * - bit 0..15 - Error code.
   * - bit 16..31 - Additional info.
   *
   * @param {number} code - error code.
   * @param {Buffer | number} info - error info (2 bytes).
   * @since 6.0.0
   */
  pushErrorHistory(code: number, info: Buffer | number): void
  /**
   * Configures the length of 0x1003 - Pre-defined error field.
   *
   * @param {number} length - how many historical error events should be kept.
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @since 6.0.0
   */
  setErrorHistoryLength(
    length: number,
    options?: {
      accessType?: AccessType
    }
  ): void
  /**
   * Get object 0x1005 - COB-ID SYNC.
   *
   * @returns {number} Sync COB-ID.
   * @since 6.0.0
   */
  getSyncCobId(): number
  /**
   * Set object 0x1005 - COB-ID SYNC.
   *
   * @param {number} cobId - Sync COB-ID (typically 0x80).
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setSyncCobId(
    cobId: number,
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1005 [bit 30] - Sync generation enable.
   *
   * @returns {boolean} Sync generation enable.
   * @since 6.0.0
   */
  getSyncGenerationEnable(): boolean
  /**
   * Set object 0x1005 [bit 30] - Sync generation enable.
   *
   * @param {boolean} enable - Sync generation enable.
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setSyncGenerationEnable(
    enable: boolean,
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1006 - Communication cycle period.
   *
   * @returns {number} Sync interval in μs.
   * @since 6.0.0
   */
  getSyncCyclePeriod(): number
  /**
   * Set object 0x1006 - Communication cycle period.
   *
   * @param {number} cyclePeriod - communication cycle period.
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setSyncCyclePeriod(
    cyclePeriod: number,
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1008 - Manufacturer device name.
   *
   * @returns {string} device name.
   * @since 6.0.0
   */
  getDeviceName(): string
  /**
   * Set object 0x1008 - Manufacturer device name.
   *
   * @param {string} name - device name.
   * @param {object} [options] - DataObject creation options.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setDeviceName(
    name: string,
    options?: {
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1009 - Manufacturer hardware version.
   *
   * @returns {string} hardware version.
   * @since 6.0.0
   */
  getHardwareVersion(): string
  /**
   * Set object 0x1009 - Manufacturer hardware version.
   *
   * @param {string} version - device hardware version.
   * @param {object} [options] - DataObject creation options.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setHardwareVersion(
    version: string,
    options?: {
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x100A - Manufacturer software version.
   *
   * @returns {string} software version.
   * @since 6.0.0
   */
  getSoftwareVersion(): string
  /**
   * Set object 0x100A - Manufacturer software version.
   *
   * @param {string} version - device software version.
   * @param {object} [options] - DataObject creation options.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setSoftwareVersion(
    version: string,
    options?: {
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1012 - COB-ID TIME.
   *
   * @returns {number} Time COB-ID.
   * @since 6.0.0
   */
  getTimeCobId(): number
  /**
   * Set object 0x1012 - COB-ID TIME.
   *
   * @param {number} cobId - Time COB-ID (typically 0x100).
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setTimeCobId(
    cobId: number,
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1012 [bit 30] - Time producer enable.
   *
   * @returns {boolean} Time producer enable.
   * @since 6.0.0
   */
  getTimeProducerEnable(): boolean
  /**
   * Set object 0x1012 [bit 30] - Time producer enable.
   *
   * @param {boolean} enable - Time producer enable.
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setTimeProducerEnable(
    enable: boolean,
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1012 [bit 31] - Time consumer enable.
   *
   * @returns {boolean} Time consumer enable.
   * @since 6.0.0
   */
  getTimeConsumerEnable(): boolean
  /**
   * Set object 0x1012 [bit 31] - Time consumer enable.
   *
   * @param {boolean} enable - Time consumer enable.
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setTimeConsumerEnable(
    enable: boolean,
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1014 - COB-ID EMCY.
   *
   * @returns {number} Emcy COB-ID.
   * @since 6.0.0
   */
  getEmcyCobId(): number
  /**
   * Set object 0x1014 - COB-ID EMCY.
   *
   * @param {number} cobId - Emcy COB-ID.
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setEmcyCobId(
    cobId: number,
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1014 [bit 31] - EMCY valid.
   *
   * @returns {boolean} Emcy valid.
   * @since 6.0.0
   */
  getEmcyValid(): boolean
  /**
   * Set object 0x1014 [bit 31] - EMCY valid.
   *
   * @param {number} valid - Emcy valid.
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setEmcyValid(
    valid: number,
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1015 - Inhibit time EMCY.
   *
   * @returns {number} Emcy inhibit time in 100 μs.
   * @since 6.0.0
   */
  getEmcyInhibitTime(): number
  /**
   * Set object 0x1015 - Inhibit time EMCY.
   *
   * @param {number} inhibitTime - inhibit time in multiples of 100 μs.
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setEmcyInhibitTime(
    inhibitTime: number,
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1016 - Consumer heartbeat time.
   *
   * @returns {Array<object>} [{ deviceId, heartbeatTime } ... ]
   * @since 6.0.0
   */
  getHeartbeatConsumers(): Array<{ deviceId: number; heartbeatTime: number }>
  /**
   * Add an entry to object 0x1016 - Consumer heartbeat time.
   * - bit 0..15 - Heartbeat time in ms.
   * - bit 16..23 - Node-ID of producer.
   * - bit 24..31 - Reserved (0x00);
   *
   * @param {number} deviceId - device identifier [1-127].
   * @param {number} timeout - milliseconds before a timeout is reported.
   * @param {object} [options] - DataObject creation options.
   * @param {number} [options.subIndex] - index to store the entry.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  addHeartbeatConsumer(
    deviceId: number,
    timeout: number,
    options?: {
      subIndex?: number
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Remove an entry from object 0x1016 - Consumer heartbeat time.
   *
   * @param {number} deviceId - id of the entry to remove.
   * @since 6.0.0
   */
  removeHeartbeatConsumer(deviceId: number): void
  /**
   * Get object 0x1017 - Producer heartbeat time.
   *
   * @returns {number} heartbeat time in ms.
   * @since 6.0.0
   */
  getHeartbeatProducerTime(): number
  /**
   * Set object 0x1017 - Producer heartbeat time.
   *
   * A value of zero disables the heartbeat.
   *
   * @param {number} producerTime - Producer heartbeat time in ms.
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setHeartbeatProducerTime(
    producerTime: number,
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1018 - Identity object.
   *
   * @returns {object | null} identity.
   * @since 6.0.0
   */
  getIdentity(): {
    vendorId: number
    productCode: number
    revisionNumber: number
    serialNumber: number
  } | null
  /**
   * Set object 0x1018 - Identity object.
   * - sub-index 1 - Vendor id.
   * - sub-index 2 - Product code.
   * - sub-index 3 - Revision number.
   * - sub-index 4 - Serial number.
   *
   * @param {object} identity - device identity.
   * @param {number} identity.vendorId - vendor id.
   * @param {number} identity.productCode - product code.
   * @param {number} identity.revisionNumber - revision number.
   * @param {number} identity.serialNumber - serial number.
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setIdentity(
    identity: {
      vendorId: number
      productCode: number
      revisionNumber: number
      serialNumber: number
    },
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1019 - Synchronous counter overflow value.
   *
   * @returns {number} Sync counter overflow value.
   * @since 6.0.0
   */
  getSyncOverflow(): number
  /**
   * Set object 0x1019 - Synchronous counter overflow value.
   *
   * @param {number} overflow - Sync overflow value.
   * @param {object} [options] - DataObject creation options.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  setSyncOverflow(
    overflow: number,
    options?: {
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Get object 0x1028 - Emergency consumer object.
   *
   * @returns {Array<number>} Emcy consumer COB-IDs.
   * @since 6.0.0
   */
  getEmcyConsumers(): Array<number>
  /**
   * Add an entry to object 0x1028 - Emergency consumer object.
   * - bit 0..11 - CAN-ID.
   * - bit 16..23 - Reserved (0x00).
   * - bit 31 - 0 = valid, 1 = invalid.
   *
   * @param {number} cobId - COB-ID to add.
   * @param {object} [options] - DataObject creation options.
   * @param {number} [options.subIndex] - index to store the entry.
   * @param {string} [options.parameterName] - DataObject name.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  addEmcyConsumer(
    cobId: number,
    options?: {
      subIndex?: number
      parameterName?: string
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Remove an entry from object 0x1028 - Emergency consumer object.
   *
   * @param {number} cobId - COB-ID of the entry to remove.
   * @since 6.0.0
   */
  removeEmcyConsumer(cobId: number): void
  /**
   * Get SDO server parameters.
   *
   * @returns {Array<object>} [{ deviceId, cobIdTx, cobIdRx } ... ]
   * @since 6.0.0
   */
  getSdoServerParameters(): Array<{ deviceId: number; cobIdTx: number; cobIdRx: number }>
  /**
   * Add an SDO server parameter object.
   *
   * Object 0x1200..0x127F - SDO server parameter.
   *
   * Sub-index 1/2:
   * - bit 0..10 - CAN base frame.
   * - bit 11..28 - CAN extended frame.
   * - bit 29 - Frame type (base or extended).
   * - bit 30 - Dynamically allocated.
   * - bit 31 - SDO exists / is valid.
   *
   * Sub-index 3 (optional):
   * - bit 0..7 - Node-ID of the SDO client.
   *
   * @param {number} deviceId - device identifier [1-127].
   * @param {number} cobIdTx - COB-ID for outgoing messages (to client).
   * @param {number} cobIdRx - COB-ID for incoming messages (from client).
   * @param {object} [options] - DataObject creation options.
   * @param {string} [options.index] - DataObject index [0x1200-0x127F].
   * @param {string} [options.parameterName] - DataObject name.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  addSdoServerParameter(
    deviceId: number,
    cobIdTx?: number,
    cobIdRx?: number,
    options?: {
      index?: string
      parameterName?: string
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Remove an SDO server parameter object.
   *
   * @param {number} deviceId - device identifier [1-127].
   * @since 6.0.0
   */
  removeSdoServerParameter(deviceId: number): void
  /**
   * Get SDO client parameters.
   *
   * @returns {Array<object>} [{ deviceId, cobIdTx, cobIdRx } ... ]
   * @since 6.0.0
   */
  getSdoClientParameters(): Array<{ deviceId: number; cobIdTx: number; cobIdRx: number }>
  /**
   * Add an SDO client parameter object.
   *
   * Object 0x1280..0x12FF - SDO client parameter.
   *
   * Sub-index 1/2:
   * - bit 0..10 - CAN base frame.
   * - bit 11..28 - CAN extended frame.
   * - bit 29 - Frame type (base or extended).
   * - bit 30 - Dynamically allocated.
   * - bit 31 - SDO exists / is valid.
   *
   * Sub-index 3:
   * - bit 0..7 - Node-ID of the SDO server.
   *
   * @param {number} deviceId - device identifier [1-127].
   * @param {number} cobIdTx - COB-ID for outgoing messages (to server).
   * @param {number} cobIdRx - COB-ID for incoming messages (from server).
   * @param {object} [options] - DataObject creation options.
   * @param {string} [options.index] - DataObject index [0x1200-0x127F].
   * @param {string} [options.parameterName] - DataObject name.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  addSdoClientParameter(
    deviceId: number,
    cobIdTx?: number,
    cobIdRx?: number,
    options?: {
      index?: string
      parameterName?: string
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Remove an SDO client parameter object.
   *
   * @param {number} deviceId - device identifier [1-127].
   * @since 6.0.0
   */
  removeSdoClientParameter(deviceId: number): void
  /**
   * Get RPDO communication/mapping parameters.
   *
   * @returns {Array<object>} mapped RPDOs.
   * @since 6.0.0
   */
  getReceivePdos(): Array<{
    cobId: number
    transmissionType: number
    inhibitTime: number
    eventTime: number
    dataObjects: Array<DataObject>
    dataSize: number
  }>
  /**
   * Create a RPDO communication/mapping parameter object.
   *
   * Object 0x1400..0x15FF - RPDO communication parameter
   *
   * Sub-index 1 (mandatory):
   * - bit 0..10 - CAN base frame.
   * - bit 11..28 - CAN extended frame.
   * - bit 29 - Frame type.
   * - bit 30 - RTR allowed.
   * - bit 31 - RPDO valid.
   *
   * Sub-index 2 (mandatory):
   * - bit 0..7 - Transmission type.
   *
   * Sub-index 3 (optional):
   * - bit 0..15 - Inhibit time.
   *
   * Object 0x1600..0x17FF - RPDO mapping parameter
   * - bit 0..7 - Bit length.
   * - bit 8..15 - Sub-index.
   * - bit 16..31 - Index.
   *
   * Inhibit time and synchronous RPDOs are not yet supported. All entries
   * are treated as event-driven with an inhibit time of 0.
   *
   * @param {object} pdo - PDO data.
   * @param {number} pdo.cobId - COB-ID used by the RPDO.
   * @param {number} pdo.transmissionType - transmission type.
   * @param {number} pdo.inhibitTime - minimum time between updates.
   * @param {Array<DataObject>} pdo.dataObjects - objects to map.
   * @param {object} options - optional arguments.
   * @param {number} [options.index] - DataObject index [0x1400-0x15ff].
   * @param {Array<string>} [options.parameterName] - DataObject names.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @param {boolean} [options.saveDefault] - save value as default.
   * @since 6.0.0
   */
  addReceivePdo(
    pdo: {
      cobId: number
      transmissionType?: number
      inhibitTime?: number
      dataObjects: Array<DataObject>
    },
    options?: {
      index?: number
      parameterName?: Array<string>
      accessType?: AccessType
      saveDefault?: boolean
    }
  ): void
  /**
   * Remove an RPDO communication/mapping parameter object.
   *
   * @param {number} cobId - COB-ID used by the RPDO.
   * @returns {object} removed RPDO.
   * @since 6.0.0
   */
  removeReceivePdo(cobId: number): {
    cobId: number
    transmissionType: number
    inhibitTime: number
    eventTime: number
    dataObjects: Array<DataObject>
    dataSize: number
  } | null
  /**
   * Get TPDO communication/mapping parameters.
   *
   * @returns {Array<object>} mapped TPDOs.
   * @since 6.0.0
   */
  getTransmitPdos(): Array<{
    cobId: number
    transmissionType: number
    inhibitTime: number
    eventTime: number
    syncStart: number
    dataObjects: Array<DataObject>
    dataSize: number
  }>
  /**
   * Create a TPDO communication/mapping parameter object.
   *
   * Object 0x1800..0x19FF - TPDO communication parameter
   *
   * Sub-index 1 (mandatory):
   * - bit 0..10 - CAN base frame.
   * - bit 11..28 - CAN extended frame.
   * - bit 29 - Frame type.
   * - bit 30 - RTR allowed.
   * - bit 31 - TPDO valid.
   *
   * Sub-index 2 (mandatory):
   * - bit 0..7 - Transmission type.
   *
   * Sub-index 3 (optional):
   * - bit 0..15 - Inhibit time.
   *
   * Sub-index 5 (optional):
   * - bit 0..15 - Event timer value.
   *
   * Sub-index 6 (optional):
   * - bit 0..7 - SYNC start value.
   *
   * Object 0x2000..0x21FF - TPDO mapping parameter
   * - bit 0..7 - Bit length.
   * - bit 8..15 - Sub-index.
   * - bit 16..31 - Index.
   *
   * @param {object} pdo - object data.
   * @param {number} pdo.cobId - COB-ID used by the TPDO.
   * @param {number} pdo.transmissionType - transmission type.
   * @param {number} pdo.inhibitTime - minimum time between writes.
   * @param {number} pdo.eventTime - how often to send timer based PDOs.
   * @param {number} pdo.syncStart - initial counter value for sync PDOs.
   * @param {Array<DataObject>} pdo.dataObjects - objects to map.
   * @param {object} options - optional arguments.
   * @param {number} [options.index] - DataObject index [0x1800-0x19ff].
   * @param {Array<string>} [options.parameterName] - DataObject names.
   * @param {AccessType} [options.accessType] - DataObject access type.
   * @since 6.0.0
   */
  addTransmitPdo(
    pdo: {
      cobId: number
      transmissionType?: number
      inhibitTime?: number
      eventTime?: number
      syncStart?: number
      dataObjects: Array<DataObject>
    },
    options?: {
      index?: number
      parameterName?: Array<string>
      accessType?: AccessType
    }
  ): void
  /**
   * Remove a TPDO communication/mapping parameter object.
   *
   * @param {number} cobId - COB-ID used by the TPDO.
   * @returns {object} removed TPDO.
   * @since 6.0.0
   */
  removeTransmitPdo(cobId: number): {
    cobId: number
    transmissionType: number
    inhibitTime: number
    eventTime: number
    syncStart: number
    dataObjects: Array<DataObject>
    dataSize: number
  } | null
  /**
   * Parse a pair of PDO communication/mapping parameters.
   *
   * @param {number} index - PDO communication parameter index.
   * @returns {object} parsed PDO data.
   * @private
   */
  private _parsePdo: (index: number) =>
    | {
        cobId: number
        transmissionType: number
        inhibitTime: number
        eventTime: number
        syncStart: number
        dataObjects: Array<DataObject>
        dataSize: number
      }
    | undefined
  /**
   * Parse an SDO client/server parameter object.
   *
   * @param {DataObject} entry - entry to parse.
   * @returns {null | Array<number>} parsed data.
   * @since 6.0.0
   * @private
   */
  private _parseSdoParameter
  /**
   * Helper method to write strings to an EDS file.
   *
   * @param {number} fd - file descriptor to write.
   * @param {string} data - string to write.
   * @private
   */
  private _write
  /**
   * Helper method to write objects to an EDS file.
   *
   * @param {number} fd - file descriptor to write.
   * @param {object} objects - objects to write.
   * @private
   */
  private _writeObjects;
  [Symbol.iterator](): Iterator<DataObject>
}
import EventEmitter = require('node:events')
import { AccessType, ObjectType, DataType } from './types'
