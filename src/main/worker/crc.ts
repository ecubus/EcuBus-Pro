/* eslint-disable prefer-const */
/* eslint-disable no-var */
import CrcUtil from './crcUtil'

/**
 * Built-in CRC algorithm names
 */
export type CRCName =
  | 'CRC8'
  | 'CRC8_SAE_J1850'
  | 'CRC8_SAE_J1850_ZERO'
  | 'CRC8_8H2F'
  | 'CRC8_CDMA2000'
  | 'CRC8_DARC'
  | 'CRC8_DVB_S2'
  | 'CRC8_EBU'
  | 'CRC8_ICODE'
  | 'CRC8_ITU'
  | 'CRC8_MAXIM'
  | 'CRC8_ROHC'
  | 'CRC8_WCDMA'
  | 'CRC16_CCIT_ZERO'
  | 'CRC16_ARC'
  | 'CRC16_AUG_CCITT'
  | 'CRC16_BUYPASS'
  | 'CRC16_CCITT_FALSE'
  | 'CRC16_CDMA2000'
  | 'CRC16_DDS_110'
  | 'CRC16_DECT_R'
  | 'CRC16_DECT_X'
  | 'CRC16_DNP'
  | 'CRC16_EN_13757'
  | 'CRC16_GENIBUS'
  | 'CRC16_MAXIM'
  | 'CRC16_MCRF4XX'
  | 'CRC16_RIELLO'
  | 'CRC16_T10_DIF'
  | 'CRC16_TELEDISK'
  | 'CRC16_TMS37157'
  | 'CRC16_USB'
  | 'CRC16_A'
  | 'CRC16_KERMIT'
  | 'CRC16_MODBUS'
  | 'CRC16_X_25'
  | 'CRC16_XMODEM'
  | 'CRC32'
  | 'CRC32_BZIP2'
  | 'CRC32_C'
  | 'CRC32_D'
  | 'CRC32_MPEG2'
  | 'CRC32_POSIX'
  | 'CRC32_Q'
  | 'CRC32_JAMCRC'
  | 'CRC32_XFER'

/**
 * CRC (Cyclic Redundancy Check) class for computing various CRC algorithms.
 *
 * This class provides a comprehensive implementation of CRC calculation algorithms
 * commonly used in automotive diagnostics, communication protocols, and data integrity
 * verification. It supports 8-bit, 16-bit, and 32-bit CRC calculations with configurable
 * parameters including polynomial, initial value, final XOR value, and reflection settings.
 *
 * The class includes a comprehensive set of predefined CRC algorithms and allows
 * custom CRC configurations for specific use cases.
 *
 * @category Util
 *
 * @example
 * ```typescript
 * // Using predefined CRC algorithms
 * const crc16Modbus = CRC.default('CRC16_MODBUS')
 * if (crc16Modbus) {
 *   const data = Buffer.from([0x01, 0x02, 0x03, 0x04])
 *   const crcValue = crc16Modbus.compute(data)
 *   console.log(`CRC16-MODBUS: 0x${crcValue.toString(16).padStart(4, '0')}`)
 * }
 *
 * // Creating custom CRC configuration (like in bootloader.ts)
 * const customCrc = new CRC('self', 16, 0x3d65, 0, 0xffff, true, true)
 * const fileContent = await fs.readFile('firmware.bin')
 * const crcResult = customCrc.compute(fileContent)
 *
 * // Computing CRC for different data types
 * const crc32 = CRC.default('CRC32')
 * if (crc32) {
 *   // From number array
 *   const arrayData = [0x48, 0x65, 0x6c, 0x6c, 0x6f] // "Hello"
 *   const crcFromArray = crc32.compute(arrayData)
 *
 *   // From Buffer
 *   const bufferData = Buffer.from('Hello', 'utf8')
 *   const crcFromBuffer = crc32.compute(bufferData)
 *
 *   // Get CRC as Buffer (useful for network protocols)
 *   const crcBuffer = crc32.computeBuffer(bufferData)
 * }
 * ```
 */
export class CRC {
  private _width!: number
  private _name!: string
  private _polynomial!: number
  private _initialVal!: number
  private _finalXorVal!: number
  private _inputReflected!: boolean
  private _resultReflected!: boolean
  private static _list: CRC[]

  private _crcTable!: number[]
  private _castMask!: number
  private _msbMask!: number

  public get width(): number {
    return this._width
  }
  public set width(v: number) {
    this._width = v
    switch (v) {
      case 8:
        this._castMask = 0xff
        break
      case 16:
        this._castMask = 0xffff
        break
      case 32:
        this._castMask = 0xffffffff
        break
      default:
        throw 'Invalid CRC width'
    }
    this._msbMask = 0x01 << (v - 1)
  }

  public get name(): string {
    return this._name
  }
  public set name(v: string) {
    this._name = v
  }

  public get polynomial(): number {
    return this._polynomial
  }
  public set polynomial(v: number) {
    this._polynomial = v
  }

  public get initial(): number {
    return this._initialVal
  }
  public set initial(v: number) {
    this._initialVal = v
  }

  public get finalXor(): number {
    return this._finalXorVal
  }
  public set finalXor(v: number) {
    this._finalXorVal = v
  }

  public get inputReflected(): boolean {
    return this._inputReflected
  }
  public set inputReflected(v: boolean) {
    this._inputReflected = v
  }

  public get resultReflected(): boolean {
    return this._resultReflected
  }
  public set resultReflected(v: boolean) {
    this._resultReflected = v
  }

  /**
   * Creates an instance of the CRC (Cyclic Redundancy Check) class.
   *
   * @param name - The name of the CRC algorithm.
   * @param width - The width of the CRC in bits.
   * @param polynomial - The polynomial used for the CRC calculation.
   * @param initial - The initial value for the CRC calculation.
   * @param finalXor - The value to XOR with the final CRC value.
   * @param inputReflected - Whether the input bytes should be reflected.
   * @param resultReflected - Whether the result should be reflected.
   */
  constructor(
    name: string,
    width: number,
    polynomial: number,
    initial: number,
    finalXor: number,
    inputReflected: boolean,
    resultReflected: boolean
  ) {
    this.width = width
    this.name = name
    this.polynomial = polynomial
    this.initial = initial
    this.finalXor = finalXor
    this.inputReflected = inputReflected
    this.resultReflected = resultReflected
  }
  /**
   * Get built-in CRC by name
   *
   * Available built-in CRCs:
   * | Name                | Width | Polynomial | Initial    | Final XOR  | Input Reflected | Result Reflected |
   * |--------------------|-------|------------|------------|------------|-----------------|------------------|
   * | CRC8               | 8     | 0x07       | 0x00       | 0x00       | false           | false            |
   * | CRC8_SAE_J1850     | 8     | 0x1d       | 0xff       | 0xff       | false           | false            |
   * | CRC8_SAE_J1850_ZERO| 8     | 0x1d       | 0x00       | 0x00       | false           | false            |
   * | CRC8_8H2F          | 8     | 0x2f       | 0xff       | 0xff       | false           | false            |
   * | CRC8_CDMA2000      | 8     | 0x9b       | 0xff       | 0x00       | false           | false            |
   * | CRC8_DARC          | 8     | 0x39       | 0x00       | 0x00       | true            | true             |
   * | CRC8_DVB_S2        | 8     | 0xd5       | 0x00       | 0x00       | false           | false            |
   * | CRC8_EBU           | 8     | 0x1d       | 0xff       | 0x00       | true            | true             |
   * | CRC8_ICODE         | 8     | 0x1d       | 0xfd       | 0x00       | false           | false            |
   * | CRC8_ITU           | 8     | 0x07       | 0x00       | 0x55       | false           | false            |
   * | CRC8_MAXIM         | 8     | 0x31       | 0x00       | 0x00       | true            | true             |
   * | CRC8_ROHC          | 8     | 0x07       | 0xff       | 0x00       | true            | true             |
   * | CRC8_WCDMA         | 8     | 0x9b       | 0x00       | 0x00       | true            | true             |
   * | CRC16_CCIT_ZERO    | 16    | 0x1021     | 0x0000     | 0x0000     | false           | false            |
   * | CRC16_ARC          | 16    | 0x8005     | 0x0000     | 0x0000     | true            | true             |
   * | CRC16_AUG_CCITT    | 16    | 0x1021     | 0x1d0f     | 0x0000     | false           | false            |
   * | CRC16_BUYPASS      | 16    | 0x8005     | 0x0000     | 0x0000     | false           | false            |
   * | CRC16_CCITT_FALSE  | 16    | 0x1021     | 0xffff     | 0x0000     | false           | false            |
   * | CRC16_CDMA2000     | 16    | 0xc867     | 0xffff     | 0x0000     | false           | false            |
   * | CRC16_DDS_110      | 16    | 0x8005     | 0x800d     | 0x0000     | false           | false            |
   * | CRC16_DECT_R       | 16    | 0x0589     | 0x0000     | 0x0001     | false           | false            |
   * | CRC16_DECT_X       | 16    | 0x0589     | 0x0000     | 0x0000     | false           | false            |
   * | CRC16_DNP          | 16    | 0x3d65     | 0x0000     | 0xffff     | true            | true             |
   * | CRC16_EN_13757     | 16    | 0x3d65     | 0x0000     | 0xffff     | false           | false            |
   * | CRC16_GENIBUS      | 16    | 0x1021     | 0xffff     | 0xffff     | false           | false            |
   * | CRC16_MAXIM        | 16    | 0x8005     | 0x0000     | 0xffff     | true            | true             |
   * | CRC16_MCRF4XX      | 16    | 0x1021     | 0xffff     | 0x0000     | true            | true             |
   * | CRC16_RIELLO       | 16    | 0x1021     | 0xb2aa     | 0x0000     | true            | true             |
   * | CRC16_T10_DIF      | 16    | 0x8bb7     | 0x0000     | 0x0000     | false           | false            |
   * | CRC16_TELEDISK     | 16    | 0xa097     | 0x0000     | 0x0000     | false           | false            |
   * | CRC16_TMS37157     | 16    | 0x1021     | 0x89ec     | 0x0000     | true            | true             |
   * | CRC16_USB          | 16    | 0x8005     | 0xffff     | 0xffff     | true            | true             |
   * | CRC16_A            | 16    | 0x1021     | 0xc6c6     | 0x0000     | true            | true             |
   * | CRC16_KERMIT       | 16    | 0x1021     | 0x0000     | 0x0000     | true            | true             |
   * | CRC16_MODBUS       | 16    | 0x8005     | 0xffff     | 0x0000     | true            | true             |
   * | CRC16_X_25         | 16    | 0x1021     | 0xffff     | 0xffff     | true            | true             |
   * | CRC16_XMODEM       | 16    | 0x1021     | 0x0000     | 0x0000     | false           | false            |
   * | CRC32              | 32    | 0x04c11db7 | 0xffffffff | 0xffffffff | true            | true             |
   * | CRC32_BZIP2        | 32    | 0x04c11db7 | 0xffffffff | 0xffffffff | false           | false            |
   * | CRC32_C            | 32    | 0x1edc6f41 | 0xffffffff | 0xffffffff | true            | true             |
   * | CRC32_D            | 32    | 0xa833982b | 0xffffffff | 0xffffffff | true            | true             |
   * | CRC32_MPEG2        | 32    | 0x04c11db7 | 0xffffffff | 0x00000000 | false           | false            |
   * | CRC32_POSIX        | 32    | 0x04c11db7 | 0x00000000 | 0xffffffff | false           | false            |
   * | CRC32_Q            | 32    | 0x814141ab | 0x00000000 | 0x00000000 | false           | false            |
   * | CRC32_JAMCRC       | 32    | 0x04c11db7 | 0xffffffff | 0x00000000 | true            | true             |
   * | CRC32_XFER         | 32    | 0x000000af | 0x00000000 | 0x00000000 | false           | false            |
   *
   * @param name - The name of the CRC algorithm to retrieve
   * @returns The CRC instance if found, undefined otherwise
   */
  public static buildInCrc(name: CRCName) {
    return this.defaults.find((o: CRC): boolean => o.name === name)
  }
  /**
   * Returns a list of default CRC configurations.
   *
   * The list includes various CRC algorithms with their respective parameters:
   * - Name: The name of the CRC algorithm.
   * - Width: The width of the CRC (number of bits).
   * - Polynomial: The polynomial used for the CRC calculation.
   * - Initial Value: The initial value for the CRC calculation.
   * - Final XOR Value: The value to XOR with the final CRC value.
   * - Reflect Input: Whether to reflect the input bytes.
   * - Reflect Output: Whether to reflect the output CRC value.
   *
   * @returns {CRC[]} An array of CRC configurations.
   */
  public static get defaults(): CRC[] {
    if (!this._list) {
      this._list = [
        new CRC('CRC8', 8, 0x07, 0x00, 0x00, false, false),
        new CRC('CRC8_SAE_J1850', 8, 0x1d, 0xff, 0xff, false, false),
        new CRC('CRC8_SAE_J1850_ZERO', 8, 0x1d, 0x00, 0x00, false, false),
        new CRC('CRC8_8H2F', 8, 0x2f, 0xff, 0xff, false, false),
        new CRC('CRC8_CDMA2000', 8, 0x9b, 0xff, 0x00, false, false),
        new CRC('CRC8_DARC', 8, 0x39, 0x00, 0x00, true, true),
        new CRC('CRC8_DVB_S2', 8, 0xd5, 0x00, 0x00, false, false),
        new CRC('CRC8_EBU', 8, 0x1d, 0xff, 0x00, true, true),
        new CRC('CRC8_ICODE', 8, 0x1d, 0xfd, 0x00, false, false),
        new CRC('CRC8_ITU', 8, 0x07, 0x00, 0x55, false, false),
        new CRC('CRC8_MAXIM', 8, 0x31, 0x00, 0x00, true, true),
        new CRC('CRC8_ROHC', 8, 0x07, 0xff, 0x00, true, true),
        new CRC('CRC8_WCDMA', 8, 0x9b, 0x00, 0x00, true, true),
        new CRC('CRC16_CCIT_ZERO', 16, 0x1021, 0x0000, 0x0000, false, false),
        new CRC('CRC16_ARC', 16, 0x8005, 0x0000, 0x0000, true, true),
        new CRC('CRC16_AUG_CCITT', 16, 0x1021, 0x1d0f, 0x0000, false, false),
        new CRC('CRC16_BUYPASS', 16, 0x8005, 0x0000, 0x0000, false, false),
        new CRC('CRC16_CCITT_FALSE', 16, 0x1021, 0xffff, 0x0000, false, false),
        new CRC('CRC16_CDMA2000', 16, 0xc867, 0xffff, 0x0000, false, false),
        new CRC('CRC16_DDS_110', 16, 0x8005, 0x800d, 0x0000, false, false),
        new CRC('CRC16_DECT_R', 16, 0x0589, 0x0000, 0x0001, false, false),
        new CRC('CRC16_DECT_X', 16, 0x0589, 0x0000, 0x0000, false, false),
        new CRC('CRC16_DNP', 16, 0x3d65, 0x0000, 0xffff, true, true),
        new CRC('CRC16_EN_13757', 16, 0x3d65, 0x0000, 0xffff, false, false),
        new CRC('CRC16_GENIBUS', 16, 0x1021, 0xffff, 0xffff, false, false),
        new CRC('CRC16_MAXIM', 16, 0x8005, 0x0000, 0xffff, true, true),
        new CRC('CRC16_MCRF4XX', 16, 0x1021, 0xffff, 0x0000, true, true),
        new CRC('CRC16_RIELLO', 16, 0x1021, 0xb2aa, 0x0000, true, true),
        new CRC('CRC16_T10_DIF', 16, 0x8bb7, 0x0000, 0x0000, false, false),
        new CRC('CRC16_TELEDISK', 16, 0xa097, 0x0000, 0x0000, false, false),
        new CRC('CRC16_TMS37157', 16, 0x1021, 0x89ec, 0x0000, true, true),
        new CRC('CRC16_USB', 16, 0x8005, 0xffff, 0xffff, true, true),
        new CRC('CRC16_A', 16, 0x1021, 0xc6c6, 0x0000, true, true),
        new CRC('CRC16_KERMIT', 16, 0x1021, 0x0000, 0x0000, true, true),
        new CRC('CRC16_MODBUS', 16, 0x8005, 0xffff, 0x0000, true, true),
        new CRC('CRC16_X_25', 16, 0x1021, 0xffff, 0xffff, true, true),
        new CRC('CRC16_XMODEM', 16, 0x1021, 0x0000, 0x0000, false, false),
        new CRC('CRC32', 32, 0x04c11db7, 0xffffffff, 0xffffffff, true, true),
        new CRC('CRC32_BZIP2', 32, 0x04c11db7, 0xffffffff, 0xffffffff, false, false),
        new CRC('CRC32_C', 32, 0x1edc6f41, 0xffffffff, 0xffffffff, true, true),
        new CRC('CRC32_D', 32, 0xa833982b, 0xffffffff, 0xffffffff, true, true),
        new CRC('CRC32_MPEG2', 32, 0x04c11db7, 0xffffffff, 0x00000000, false, false),
        new CRC('CRC32_POSIX', 32, 0x04c11db7, 0x00000000, 0xffffffff, false, false),
        new CRC('CRC32_Q', 32, 0x814141ab, 0x00000000, 0x00000000, false, false),
        new CRC('CRC32_JAMCRC', 32, 0x04c11db7, 0xffffffff, 0x00000000, true, true),
        new CRC('CRC32_XFER', 32, 0x000000af, 0x00000000, 0x00000000, false, false)
      ]
    }
    return this._list
  }

  /**
   * Generates the CRC table used for calculating the CRC checksum.
   *
   * This method initializes the `_crcTable` array with 256 entries, each representing
   * a precomputed CRC value for a given byte. The table is generated based on the
   * polynomial and width specified by the instance's `_polynomial` and `_width` properties.
   *
   * The algorithm iterates over each possible byte value (0-255) and calculates the
   * corresponding CRC value by shifting and XORing with the polynomial. The result is
   * stored in the `_crcTable` array.
   *
   * @remarks
   * This method assumes that the instance has the following properties defined:
   * - `_width`: The width of the CRC (number of bits).
   * - `_castMask`: A mask used to cast the CRC value to the correct width.
   * - `_msbMask`: A mask representing the most significant bit of the CRC.
   * - `_polynomial`: The polynomial used for CRC calculation.
   *
   * @example
   * ```typescript
   * const crcInstance = new CrcClass();
   * crcInstance._width = 32;
   * crcInstance._castMask = 0xFFFFFFFF;
   * crcInstance._msbMask = 0x80000000;
   * crcInstance._polynomial = 0x04C11DB7;
   * crcInstance.makeCrcTable();
   * console.log(crcInstance._crcTable);
   * ```
   */
  private makeCrcTable() {
    this._crcTable = new Array(256)

    for (var divident = 0; divident < 256; divident++) {
      var currByte = (divident << (this._width - 8)) & this._castMask
      for (var bit = 0; bit < 8; bit++) {
        if ((currByte & this._msbMask) != 0) {
          currByte = ((currByte << 1) ^ this._polynomial) & this._castMask
        } else {
          currByte = (currByte << 1) & this._castMask
        }
      }
      // Ensure unsigned result
      this._crcTable[divident] = (currByte & this._castMask) >>> 0
    }
  }

  private makeCrcTableReversed() {
    this._crcTable = new Array(256)

    for (var divident = 0; divident < 256; divident++) {
      var reflectedDivident = CrcUtil.Reflect8(divident)

      var currByte = (reflectedDivident << (this._width - 8)) & this._castMask

      for (var bit = 0; bit < 8; bit++) {
        if ((currByte & this._msbMask) != 0) {
          currByte = ((currByte << 1) ^ this._polynomial) & this._castMask
        } else {
          currByte = (currByte << 1) & this._castMask
        }
      }

      currByte = CrcUtil.ReflectGeneric(currByte, this.width)

      // Ensure unsigned result
      this._crcTable[divident] = (currByte & this._castMask) >>> 0
    }
  }

  /**
   * Computes the CRC (Cyclic Redundancy Check) value for the given input bytes.
   *
   * @param {number[] | Buffer} bytes - The input data as an array of numbers or a Buffer.
   * @returns {number} - The computed CRC value.
   */
  public compute(bytes: number[] | Buffer) {
    if (!this._crcTable) this.makeCrcTable()
    var crc = this._initialVal
    for (var i = 0; i < bytes.length; i++) {
      var curByte = bytes[i] & 0xff

      if (this.inputReflected) {
        curByte = CrcUtil.Reflect8(curByte)
      }

      /* update the MSB of crc value with next input byte */
      crc = (crc ^ (curByte << (this._width - 8))) & this._castMask
      /* this MSB byte value is the index into the lookup table */
      var pos = (crc >>> (this.width - 8)) & 0xff
      /* shift out this index */
      crc = (crc << 8) & this._castMask
      /* XOR-in remainder from lookup table using the calculated index */
      crc = (crc ^ this._crcTable[pos]) & this._castMask
    }

    if (this.resultReflected) {
      crc = CrcUtil.ReflectGeneric(crc, this.width)
    }
    // Use unsigned right shift to ensure positive result
    return ((crc ^ this._finalXorVal) & this._castMask) >>> 0
  }

  public computeBuffer(bytes: number[] | Buffer) {
    let val = this.compute(bytes)
    if (this.width === 8) {
      return Buffer.from([val])
    } else if (this.width === 16) {
      let b = Buffer.alloc(2)
      // Ensure val is treated as unsigned 16-bit
      b.writeUInt16BE(val & 0xffff, 0)
      return b
    } else if (this.width === 32) {
      let b = Buffer.alloc(4)
      // Ensure val is treated as unsigned 32-bit
      b.writeUInt32BE(val >>> 0, 0)
      return b
    } else {
      throw new Error('Unsupported length')
    }
  }

  public get table() {
    return this._crcTable
  }
}
