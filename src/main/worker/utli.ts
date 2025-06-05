/**
 * Parser/writer for the "Intel hex" format.
 */

/*
 * A regexp that matches lines in a .hex file.
 *
 * One hexadecimal character is matched by "[0-9A-Fa-f]".
 * Two hex characters are matched by "[0-9A-Fa-f]{2}"
 * Eight or more hex characters are matched by "[0-9A-Fa-f]{8,}"
 * A capture group of two hex characters is "([0-9A-Fa-f]{2})"
 *
 * Record mark         :
 * 8 or more hex chars  ([0-9A-Fa-f]{8,})
 * Checksum                              ([0-9A-Fa-f]{2})
 * Optional newline                                      (?:\r\n|\r|\n|)
 */
const hexLineRegexp = /:([0-9A-Fa-f]{8,})([0-9A-Fa-f]{2})(?:\r\n|\r|\n|)/g

// Takes a Buffer as input,
// Returns an integer in the 0-255 range.
function checksum(bytes: Buffer): number {
  return -bytes.reduce((sum: number, v: number) => sum + v, 0) & 0xff
}

// Takes two Buffers as input,
// Returns an integer in the 0-255 range.
function checksumTwo(array1: Buffer, array2: Buffer): number {
  const partial1 = array1.reduce((sum: number, v: number) => sum + v, 0)
  const partial2 = array2.reduce((sum: number, v: number) => sum + v, 0)
  return -(partial1 + partial2) & 0xff
}

// Trivial utility. Converts a number to hex and pads with zeroes up to 2 characters.
function hexpad(number: number): string {
  return number.toString(16).toUpperCase().padStart(2, '0')
}

// Polyfill as per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger
Number.isInteger =
  Number.isInteger ||
  function (value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value
  }

/**
 * @category Util
 * @example
 * import {HexMemoryMap} from 'ECB';
 *
 * let memMap1 = new HexMemoryMap();
 * let memMap2 = new HexMemoryMap([[0, new Buffer(1,2,3,4)]]);
 * let memMap3 = new HexMemoryMap({0: new Buffer(1,2,3,4)});
 * let memMap4 = new HexMemoryMap({0xCF0: new Buffer(1,2,3,4)});
 *
 * const block = HexMemoryMap.fromHex(hexText);
 */
export class HexMemoryMap {
  private _blocks: Map<number, Buffer>

  /**
   * @param {Iterable} blocks The initial value for the memory blocks inside this
   * <tt>HexMemoryMap</tt>. All keys must be numeric, and all values must be instances of
   * <tt>Buffer</tt>. Optionally it can also be a plain <tt>Object</tt> with
   * only numeric keys.
   */
  constructor(blocks?: Iterable<[number, Buffer]> | { [key: string]: Buffer } | null) {
    this._blocks = new Map()

    if (blocks && Symbol.iterator in blocks) {
      for (const tuple of blocks as Iterable<[number, Buffer]>) {
        if (!Array.isArray(tuple) || tuple.length !== 2) {
          throw new Error(
            'First parameter to HexMemoryMap constructor must be an iterable of [addr, bytes] or undefined'
          )
        }
        this.set(tuple[0], tuple[1])
      }
    } else if (typeof blocks === 'object') {
      // Try iterating through the object's keys
      if (blocks) {
        const addrs = Object.keys(blocks)
        for (const addr of addrs) {
          this.set(parseInt(addr), blocks[addr])
        }
      }
    } else if (blocks !== undefined && blocks !== null) {
      throw new Error(
        'First parameter to HexMemoryMap constructor must be an iterable of [addr, bytes] or undefined'
      )
    }
  }

  set(addr: number, value: Buffer): Map<number, Buffer> {
    if (!Number.isInteger(addr)) {
      throw new Error('Address passed to HexMemoryMap is not an integer')
    }
    if (addr < 0) {
      throw new Error('Address passed to HexMemoryMap is negative')
    }
    if (!(value instanceof Buffer)) {
      throw new Error('Bytes passed to HexMemoryMap are not an Buffer')
    }
    return this._blocks.set(addr, value)
  }
  // Delegate the following to the 'this._blocks' Map:
  get(addr: number): Buffer | undefined {
    return this._blocks.get(addr)
  }
  clear(): void {
    return this._blocks.clear()
  }
  delete(addr: number): boolean {
    return this._blocks.delete(addr)
  }
  entries(): IterableIterator<[number, Buffer]> {
    return this._blocks.entries()
  }
  forEach(
    callback: (value: Buffer, key: number, map: Map<number, Buffer>) => void,
    thisArg?: any
  ): void {
    return this._blocks.forEach(callback, thisArg)
  }
  has(addr: number): boolean {
    return this._blocks.has(addr)
  }
  keys(): IterableIterator<number> {
    return this._blocks.keys()
  }
  values(): IterableIterator<Buffer> {
    return this._blocks.values()
  }
  get size(): number {
    return this._blocks.size
  }
  [Symbol.iterator](): IterableIterator<[number, Buffer]> {
    return this._blocks[Symbol.iterator]()
  }

  /**
   * Parses a string containing data formatted in "Intel HEX" format, and
   * returns an instance of {@linkcode HexMemoryMap}.
   *<br/>
   * The insertion order of keys in the {@linkcode HexMemoryMap} is guaranteed to be strictly
   * ascending. In other words, when iterating through the {@linkcode HexMemoryMap}, the addresses
   * will be ordered in ascending order.
   *<br/>
   * The parser has an opinionated behaviour, and will throw a descriptive error if it
   * encounters some malformed input. Check the project's
   * {@link https://github.com/NordicSemiconductor/ECB#Features|README file} for details.
   *<br/>
   * If <tt>maxBlockSize</tt> is given, any contiguous data block larger than that will
   * be split in several blocks.
   *
   * @param {String} hexText The contents of a .hex file.
   * @param {Number} [maxBlockSize=Infinity] Maximum size of the returned <tt>Buffer</tt>s.
   *
   * @return {HexMemoryMap}
   *
   * @example
   * import {HexMemoryMap} from 'ECB';
   *
   * let intelHexString =
   *     ":100000000102030405060708090A0B0C0D0E0F1068\n" +
   *     ":00000001FF";
   *
   * let memMap = HexMemoryMap.fromHex(intelHexString);
   *
   * for (let [address, dataBlock] of memMap) {
   *     console.log('Data block at ', address, ', bytes: ', dataBlock);
   * }
   */
  static fromHex(hexText: string, maxBlockSize = Infinity) {
    const blocks = new HexMemoryMap()

    let lastCharacterParsed = 0
    let matchResult
    let recordCount = 0

    // Upper Linear Base Address, the 16 most significant bits (2 bytes) of
    // the current 32-bit (4-byte) address
    // In practice this is a offset that is summed to the "load offset" of the
    // data records
    let ulba = 0

    hexLineRegexp.lastIndex = 0 // Reset the regexp, if not it would skip content when called twice

    while ((matchResult = hexLineRegexp.exec(hexText)) !== null) {
      recordCount++

      // By default, a regexp loop ignores gaps between matches, but
      // we want to be aware of them.
      if (lastCharacterParsed !== matchResult.index) {
        throw new Error(
          'Malformed hex file: Could not parse between characters ' +
            lastCharacterParsed +
            ' and ' +
            matchResult.index +
            ' ("' +
            hexText
              .substring(lastCharacterParsed, Math.min(matchResult.index, lastCharacterParsed + 16))
              .trim() +
            '")'
        )
      }
      lastCharacterParsed = hexLineRegexp.lastIndex

      // Give pretty names to the match's capture groups
      const [, recordStr, recordChecksum] = matchResult

      // String to Buffer - https://stackoverflow.com/questions/43131242/how-to-convert-a-hexademical-string-of-data-to-an-arraybuffer-in-javascript
      const recordBytes = Buffer.from(
        recordStr.match(/[\da-f]{2}/gi)?.map((h) => parseInt(h, 16)) || []
      )

      const recordLength = recordBytes[0]
      if (recordLength + 4 !== recordBytes.length) {
        throw new Error(
          'Mismatched record length at record ' +
            recordCount +
            ' (' +
            matchResult[0].trim() +
            '), expected ' +
            recordLength +
            ' data bytes but actual length is ' +
            (recordBytes.length - 4)
        )
      }

      const cs = checksum(recordBytes)
      if (parseInt(recordChecksum, 16) !== cs) {
        throw new Error(
          'Checksum failed at record ' +
            recordCount +
            ' (' +
            matchResult[0].trim() +
            '), should be ' +
            cs.toString(16)
        )
      }

      const offset = (recordBytes[1] << 8) + recordBytes[2]
      const recordType = recordBytes[3]
      const data = recordBytes.subarray(4)

      if (recordType === 0) {
        // Data record, contains data
        // Create a new block, at (upper linear base address + offset)
        if (blocks.has(ulba + offset)) {
          throw new Error(
            'Duplicated data at record ' + recordCount + ' (' + matchResult[0].trim() + ')'
          )
        }
        if (offset + data.length > 0x10000) {
          throw new Error(
            'Data at record ' +
              recordCount +
              ' (' +
              matchResult[0].trim() +
              ') wraps over 0xFFFF. This would trigger ambiguous behaviour. Please restructure your data so that for every record the data offset plus the data length do not exceed 0xFFFF.'
          )
        }

        blocks.set(ulba + offset, data)
      } else {
        // All non-data records must have a data offset of zero
        if (offset !== 0) {
          throw new Error(
            'Record ' +
              recordCount +
              ' (' +
              matchResult[0].trim() +
              ') must have 0000 as data offset.'
          )
        }

        switch (recordType) {
          case 1: // EOF
            if (lastCharacterParsed !== hexText.length) {
              // This record should be at the very end of the string
              throw new Error('There is data after an EOF record at record ' + recordCount)
            }

            return blocks.join(maxBlockSize)

          case 2: // Extended Segment Address Record
            // Sets the 16 most significant bits of the 20-bit Segment Base
            // Address for the subsequent data.
            ulba = ((data[0] << 8) + data[1]) << 4
            break

          case 3: // Start Segment Address Record
            // Do nothing. Record type 3 only applies to 16-bit Intel CPUs,
            // where it should reset the program counter (CS+IP CPU registers)
            break

          case 4: // Extended Linear Address Record
            // Sets the 16 most significant (upper) bits of the 32-bit Linear Address
            // for the subsequent data
            ulba = ((data[0] << 8) + data[1]) << 16
            break

          case 5: // Start Linear Address Record
            // Do nothing. Record type 5 only applies to 32-bit Intel CPUs,
            // where it should reset the program counter (EIP CPU register)
            // It might have meaning for other CPU architectures
            // (see http://infocenter.arm.com/help/index.jsp?topic=/com.arm.doc.faqs/ka9903.html )
            // but will be ignored nonetheless.
            break
          default:
            throw new Error(
              'Invalid record type 0x' +
                hexpad(recordType) +
                ' at record ' +
                recordCount +
                ' (should be between 0x00 and 0x05)'
            )
        }
      }
    }

    if (recordCount) {
      throw new Error('No EOF record at end of file')
    } else {
      throw new Error('Malformed .hex file, could not parse any registers')
    }
  }

  /**
   * Returns a <strong>new</strong> instance of {@linkcode HexMemoryMap}, containing
   * the same data, but concatenating together those memory blocks that are adjacent.
   *<br/>
   * The insertion order of keys in the {@linkcode HexMemoryMap} is guaranteed to be strictly
   * ascending. In other words, when iterating through the {@linkcode HexMemoryMap}, the addresses
   * will be ordered in ascending order.
   *<br/>
   * If <tt>maxBlockSize</tt> is given, blocks will be concatenated together only
   * until the joined block reaches this size in bytes. This means that the output
   * {@linkcode HexMemoryMap} might have more entries than the input one.
   *<br/>
   * If there is any overlap between blocks, an error will be thrown.
   *<br/>
   * The returned {@linkcode HexMemoryMap} will use newly allocated memory.
   *
   * @param {Number} [maxBlockSize=Infinity] Maximum size of the <tt>Buffer</tt>s in the
   * returned {@linkcode HexMemoryMap}.
   *
   * @return {HexMemoryMap}
   */
  join(maxBlockSize = Infinity) {
    // First pass, create a Map of address→length of contiguous blocks
    const sortedKeys = Array.from(this.keys()).sort((a, b) => a - b)
    const blockSizes = new Map()
    let lastBlockAddr = -1
    let lastBlockEndAddr = -1

    for (let i = 0, l = sortedKeys.length; i < l; i++) {
      const blockAddr = sortedKeys[i]
      const blockLength = this.get(sortedKeys[i])!.length

      if (lastBlockEndAddr === blockAddr && lastBlockEndAddr - lastBlockAddr < maxBlockSize) {
        // Grow when the previous end address equals the current,
        // and we don't go over the maximum block size.
        blockSizes.set(lastBlockAddr, blockSizes.get(lastBlockAddr) + blockLength)
        lastBlockEndAddr += blockLength
      } else if (lastBlockEndAddr <= blockAddr) {
        // Else mark a new block.
        blockSizes.set(blockAddr, blockLength)
        lastBlockAddr = blockAddr
        lastBlockEndAddr = blockAddr + blockLength
      } else {
        throw new Error('Overlapping data around address 0x' + blockAddr.toString(16))
      }
    }

    // Second pass: allocate memory for the contiguous blocks and copy data around.
    const mergedBlocks = new HexMemoryMap()
    let mergingBlock
    let mergingBlockAddr = -1
    for (let i = 0, l = sortedKeys.length; i < l; i++) {
      const blockAddr = sortedKeys[i]
      if (blockSizes.has(blockAddr)) {
        mergingBlock = Buffer.alloc(blockSizes.get(blockAddr))
        mergedBlocks.set(blockAddr, mergingBlock)
        mergingBlockAddr = blockAddr
      }
      mergingBlock!.set(this.get(blockAddr)!, blockAddr - mergingBlockAddr)
    }

    return mergedBlocks
  }

  /**
   * Given a {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map|<tt>Map</tt>}
   * of {@linkcode HexMemoryMap}s, indexed by a alphanumeric ID,
   * returns a <tt>Map</tt> of address to tuples (<tt>Arrays</tt>s of length 2) of the form
   * <tt>(id, Buffer)</tt>s.
   *<br/>
   * The scenario for using this is having several {@linkcode HexMemoryMap}s, from several calls to
   * {@link module:ECB~hexToArrays|hexToArrays}, each having a different identifier.
   * This function locates where those memory block sets overlap, and returns a <tt>Map</tt>
   * containing addresses as keys, and arrays as values. Each array will contain 1 or more
   * <tt>(id, Buffer)</tt> tuples: the identifier of the memory block set that has
   * data in that region, and the data itself. When memory block sets overlap, there will
   * be more than one tuple.
   *<br/>
   * The <tt>Buffer</tt>s in the output are
   * {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/subarray|subarrays}
   * of the input data; new memory is <strong>not</strong> allocated for them.
   *<br/>
   * The insertion order of keys in the output <tt>Map</tt> is guaranteed to be strictly
   * ascending. In other words, when iterating through the <tt>Map</tt>, the addresses
   * will be ordered in ascending order.
   *<br/>
   * When two blocks overlap, the corresponding array of tuples will have the tuples ordered
   * in the insertion order of the input <tt>Map</tt> of block sets.
   *<br/>
   *
   * @param {Map.HexMemoryMap} HexMemoryMaps The input memory block sets
   *
   * @example
   * import {HexMemoryMap} from 'ECB';
   *
   * let memMap1 = HexMemoryMap.fromHex( hexdata1 );
   * let memMap2 = HexMemoryMap.fromHex( hexdata2 );
   * let memMap3 = HexMemoryMap.fromHex( hexdata3 );
   *
   * let maps = new Map([
   *  ['file A', blocks1],
   *  ['file B', blocks2],
   *  ['file C', blocks3]
   * ]);
   *
   * let overlappings = HexMemoryMap.overlapHexMemoryMaps(maps);
   *
   * for (let [address, tuples] of overlappings) {
   *     // if 'tuples' has length > 1, there is an overlap starting at 'address'
   *
   *     for (let [address, tuples] of overlappings) {
   *         let [id, bytes] = tuple;
   *         // 'id' in this example is either 'file A', 'file B' or 'file C'
   *     }
   * }
   * @return {Map.Array<mixed,Buffer>} The map of possibly overlapping memory blocks
   */
  static overlapHexMemoryMaps(HexMemoryMaps: Map<string, HexMemoryMap>) {
    // First pass: create a list of addresses where any block starts or ends.
    const cuts = new Set<number>()
    for (const [, blocks] of HexMemoryMaps) {
      for (const [address, block] of blocks) {
        cuts.add(address)
        cuts.add(address + block.length)
      }
    }

    const orderedCuts = Array.from(cuts.values()).sort((a, b) => a - b)
    const overlaps = new Map()

    // Second pass: iterate through the cuts, get slices of every intersecting blockset
    for (let i = 0, l = orderedCuts.length - 1; i < l; i++) {
      const cut = orderedCuts[i]
      const nextCut = orderedCuts[i + 1]
      const tuples = []

      for (const [setId, blocks] of HexMemoryMaps) {
        // Find the block with the highest address that is equal or lower to
        // the current cut (if any)
        const blockAddr = Array.from(blocks.keys()).reduce((acc, val) => {
          if (val > cut) {
            return acc
          }
          return Math.max(acc, val)
        }, -1)

        if (blockAddr !== -1) {
          const block = blocks.get(blockAddr)!
          const subBlockStart = cut - blockAddr
          const subBlockEnd = nextCut - blockAddr

          if (subBlockStart < block.length) {
            tuples.push([setId, block.subarray(subBlockStart, subBlockEnd)])
          }
        }
      }

      if (tuples.length) {
        overlaps.set(cut, tuples)
      }
    }

    return overlaps
  }

  /**
   * Given the output of the {@linkcode HexMemoryMap.overlapHexMemoryMaps|overlapHexMemoryMaps}
   * (a <tt>Map</tt> of address to an <tt>Array</tt> of <tt>(id, Buffer)</tt> tuples),
   * returns a {@linkcode HexMemoryMap}. This discards the IDs in the process.
   *<br/>
   * The output <tt>Map</tt> contains as many entries as the input one (using the same addresses
   * as keys), but the value for each entry will be the <tt>Buffer</tt> of the <b>last</b>
   * tuple for each address in the input data.
   *<br/>
   * The scenario is wanting to join together several parsed .hex files, not worrying about
   * their overlaps.
   *<br/>
   *
   * @param {Map.Array<mixed,Buffer>} overlaps The (possibly overlapping) input memory blocks
   * @return {HexMemoryMap} The flattened memory blocks
   */
  static flattenOverlaps(overlaps: Map<number, [string, Buffer][]>) {
    return new HexMemoryMap(
      Array.from(overlaps.entries()).map(([address, tuples]) => {
        return [address, tuples[tuples.length - 1][1]] as [number, Buffer]
      })
    )
  }

  /**
   * Returns a new instance of {@linkcode HexMemoryMap}, where:
   *
   * <ul>
   *  <li>Each key (the start address of each <tt>Buffer</tt>) is a multiple of
   *    <tt>pageSize</tt></li>
   *  <li>The size of each <tt>Buffer</tt> is exactly <tt>pageSize</tt></li>
   *  <li>Bytes from the input map to bytes in the output</li>
   *  <li>Bytes not in the input are replaced by a padding value</li>
   * </ul>
   *<br/>
   * The scenario is wanting to prepare pages of bytes for a write operation, where the write
   * operation affects a whole page/sector at once.
   *<br/>
   * The insertion order of keys in the output {@linkcode HexMemoryMap} is guaranteed
   * to be strictly ascending. In other words, when iterating through the
   * {@linkcode HexMemoryMap}, the addresses will be ordered in ascending order.
   *<br/>
   * The <tt>Buffer</tt>s in the output will be newly allocated.
   *<br/>
   *
   * @param {Number} [pageSize=1024] The size of the output pages, in bytes
   * @param {Number} [pad=0xFF] The byte value to use for padding
   * @return {HexMemoryMap}
   */
  paginate(pageSize = 1024, pad = 0xff) {
    if (pageSize <= 0) {
      throw new Error('Page size must be greater than zero')
    }
    const outPages = new HexMemoryMap()
    let page

    const sortedKeys = Array.from(this.keys()).sort((a, b) => a - b)

    for (let i = 0, l = sortedKeys.length; i < l; i++) {
      const blockAddr = sortedKeys[i]
      const block = this.get(blockAddr)!
      const blockLength = block.length
      const blockEnd = blockAddr + blockLength

      for (
        let pageAddr = blockAddr - (blockAddr % pageSize);
        pageAddr < blockEnd;
        pageAddr += pageSize
      ) {
        page = outPages.get(pageAddr)
        if (!page) {
          page = Buffer.alloc(pageSize)
          page.fill(pad)
          outPages.set(pageAddr, page)
        }

        const offset = pageAddr - blockAddr
        let subBlock
        if (offset <= 0) {
          // First page which intersects the block
          subBlock = block.subarray(0, Math.min(pageSize + offset, blockLength))
          page.set(subBlock, -offset)
        } else {
          // Any other page which intersects the block
          subBlock = block.subarray(offset, offset + Math.min(pageSize, blockLength - offset))
          page.set(subBlock, 0)
        }
      }
    }

    return outPages
  }

  /**
   * Locates the <tt>Buffer</tt> which contains the given offset,
   * and returns the four bytes held at that offset, as a 32-bit unsigned integer.
   *
   *<br/>
   * Behaviour is similar to {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32|DataView.prototype.getUint32},
   * except that this operates over a {@linkcode HexMemoryMap} instead of
   * over an <tt>ArrayBuffer</tt>, and that this may return <tt>undefined</tt> if
   * the address is not <em>entirely</em> contained within one of the <tt>Buffer</tt>s.
   *<br/>
   *
   * @param {Number} offset The memory offset to read the data
   * @param {Boolean} [littleEndian=false] Whether to fetch the 4 bytes as a little- or big-endian integer
   * @return {Number|undefined} An unsigned 32-bit integer number
   */
  getUint32(offset: number, littleEndian: boolean) {
    const keys = Array.from(this.keys())

    for (let i = 0, l = keys.length; i < l; i++) {
      const blockAddr = keys[i]
      const block = this.get(blockAddr)!
      const blockLength = block.length
      const blockEnd = blockAddr + blockLength

      if (blockAddr <= offset && offset + 4 <= blockEnd) {
        return new DataView(block.buffer, offset - blockAddr, 4).getUint32(0, littleEndian)
      }
    }
    return
  }

  /**
   * Returns a <tt>String</tt> of text representing a .hex file.
   * <br/>
   * The writer has an opinionated behaviour. Check the project's
   * {@link https://github.com/NordicSemiconductor/ECB#Features|README file} for details.
   *
   * @param {Number} [lineSize=16] Maximum number of bytes to be encoded in each data record.
   * Must have a value between 1 and 255, as per the specification.
   *
   * @return {String} String of text with the .hex representation of the input binary data
   *
   * @example
   * import {HexMemoryMap} from 'ECB';
   *
   * let memMap = new HexMemoryMap();
   * let bytes = new Buffer(....);
   * memMap.set(0x0FF80000, bytes); // The block with 'bytes' will start at offset 0x0FF80000
   *
   * let string = memMap.asHexString();
   */
  asHexString(lineSize = 16) {
    let lowAddress = 0 // 16 least significant bits of the current addr
    let highAddress = -1 << 16 // 16 most significant bits of the current addr
    const records = []
    if (lineSize <= 0) {
      throw new Error('Size of record must be greater than zero')
    } else if (lineSize > 255) {
      throw new Error('Size of record must be less than 256')
    }

    // Placeholders
    const offsetRecord = Buffer.alloc(6)
    const recordHeader = Buffer.alloc(4)

    const sortedKeys = Array.from(this.keys()).sort((a, b) => a - b)
    for (let i = 0, l = sortedKeys.length; i < l; i++) {
      const blockAddr = sortedKeys[i]
      const block = this.get(blockAddr)

      // Sanity checks
      if (!(block instanceof Buffer)) {
        throw new Error('Block at offset ' + blockAddr + ' is not an Buffer')
      }
      if (blockAddr < 0) {
        throw new Error('Block at offset ' + blockAddr + ' has a negative thus invalid address')
      }
      const blockSize = block.length
      if (!blockSize) {
        continue
      } // Skip zero-length blocks

      if (blockAddr > highAddress + 0xffff) {
        // Insert a new 0x04 record to jump to a new 64KiB block

        // Round up the least significant 16 bits - no bitmasks because they trigger
        // base-2 negative numbers, whereas subtracting the modulo maintains precision
        highAddress = blockAddr - (blockAddr % 0x10000)
        lowAddress = 0

        offsetRecord[0] = 2 // Length
        offsetRecord[1] = 0 // Load offset, high byte
        offsetRecord[2] = 0 // Load offset, low byte
        offsetRecord[3] = 4 // Record type
        offsetRecord[4] = highAddress >> 24 // new address offset, high byte
        offsetRecord[5] = highAddress >> 16 // new address offset, low byte

        records.push(
          ':' +
            Array.prototype.map.call(offsetRecord, hexpad).join('') +
            hexpad(checksum(offsetRecord))
        )
      }

      if (blockAddr < highAddress + lowAddress) {
        throw new Error(
          'Block starting at 0x' + blockAddr.toString(16) + ' overlaps with a previous block.'
        )
      }

      lowAddress = blockAddr % 0x10000
      let blockOffset = 0
      const blockEnd = blockAddr + blockSize
      if (blockEnd > 0xffffffff) {
        throw new Error('Data cannot be over 0xFFFFFFFF')
      }

      // Loop for every 64KiB memory segment that spans this block
      while (highAddress + lowAddress < blockEnd) {
        if (lowAddress > 0xffff) {
          // Insert a new 0x04 record to jump to a new 64KiB block
          highAddress += 1 << 16 // Increase by one
          lowAddress = 0

          offsetRecord[0] = 2 // Length
          offsetRecord[1] = 0 // Load offset, high byte
          offsetRecord[2] = 0 // Load offset, low byte
          offsetRecord[3] = 4 // Record type
          offsetRecord[4] = highAddress >> 24 // new address offset, high byte
          offsetRecord[5] = highAddress >> 16 // new address offset, low byte

          records.push(
            ':' +
              Array.prototype.map.call(offsetRecord, hexpad).join('') +
              hexpad(checksum(offsetRecord))
          )
        }

        let recordSize = -1
        // Loop for every record for that spans the current 64KiB memory segment
        while (lowAddress < 0x10000 && recordSize) {
          recordSize = Math.min(
            lineSize, // Normal case
            blockEnd - highAddress - lowAddress, // End of block
            0x10000 - lowAddress // End of low addresses
          )

          if (recordSize) {
            recordHeader[0] = recordSize // Length
            recordHeader[1] = lowAddress >> 8 // Load offset, high byte
            recordHeader[2] = lowAddress // Load offset, low byte
            recordHeader[3] = 0 // Record type

            const subBlock = block.subarray(blockOffset, blockOffset + recordSize) // Data bytes for this record

            records.push(
              ':' +
                Array.prototype.map.call(recordHeader, hexpad).join('') +
                Array.prototype.map.call(subBlock, hexpad).join('') +
                hexpad(checksumTwo(recordHeader, subBlock))
            )

            blockOffset += recordSize
            lowAddress += recordSize
          }
        }
      }
    }

    records.push(':00000001FF') // EOF record

    return records.join('\n')
  }

  /**
   * Performs a deep copy of the current {@linkcode HexMemoryMap}, returning a new one
   * with exactly the same contents, but allocating new memory for each of its
   * <tt>Buffer</tt>s.
   *
   * @return {HexMemoryMap}
   */
  clone() {
    const cloned = new HexMemoryMap()

    for (const [addr, value] of this) {
      cloned.set(addr, Buffer.from(value))
    }

    return cloned
  }

  /**
   * Given one <tt>Buffer</tt>, looks through its contents and returns a new
   * {@linkcode HexMemoryMap}, stripping away those regions where there are only
   * padding bytes.
   * <br/>
   * The start of the input <tt>Buffer</tt> is assumed to be offset zero for the output.
   * <br/>
   * The use case here is dumping memory from a working device and try to see the
   * "interesting" memory regions it has. This assumes that there is a constant,
   * predefined padding byte value being used in the "non-interesting" regions.
   * In other words: this will work as long as the dump comes from a flash memory
   * which has been previously erased (thus <tt>0xFF</tt>s for padding), or from a
   * previously blanked HDD (thus <tt>0x00</tt>s for padding).
   * <br/>
   * This method uses <tt>subarray</tt> on the input data, and thus does not allocate memory
   * for the <tt>Buffer</tt>s.
   *
   * @param {Buffer} bytes The input data
   * @param {Number} [padByte=0xFF] The value of the byte assumed to be used as padding
   * @param {Number} [minPadLength=64] The minimum number of consecutive pad bytes to
   * be considered actual padding
   *
   * @return {HexMemoryMap}
   */
  static fromPaddedBuffer(bytes: Buffer, padByte = 0xff, minPadLength = 64) {
    if (!(bytes instanceof Buffer)) {
      throw new Error('Bytes passed to fromPaddedBuffer are not an Buffer')
    }

    // The algorithm used is naïve and checks every byte.
    // An obvious optimization would be to implement Boyer-Moore
    // (see https://en.wikipedia.org/wiki/Boyer%E2%80%93Moore_string_search_algorithm )
    // or otherwise start skipping up to minPadLength bytes when going through a non-pad
    // byte.
    // Anyway, we could expect a lot of cases where there is a majority of pad bytes,
    // and the algorithm should check most of them anyway, so the perf gain is questionable.

    const memMap = new HexMemoryMap()
    let consecutivePads = 0
    let lastNonPad = -1
    let firstNonPad = 0
    let skippingBytes = false
    const l = bytes.length

    for (let addr = 0; addr < l; addr++) {
      const byte = bytes[addr]

      if (byte === padByte) {
        consecutivePads++
        if (consecutivePads >= minPadLength) {
          // Edge case: ignore writing a zero-length block when skipping
          // bytes at the beginning of the input
          if (lastNonPad !== -1) {
            /// Add the previous block to the result memMap
            memMap.set(firstNonPad, bytes.subarray(firstNonPad, lastNonPad + 1))
          }

          skippingBytes = true
        }
      } else {
        if (skippingBytes) {
          skippingBytes = false
          firstNonPad = addr
        }
        lastNonPad = addr
        consecutivePads = 0
      }
    }

    // At EOF, add the last block if not skipping bytes already (and input not empty)
    if (!skippingBytes && lastNonPad !== -1) {
      memMap.set(firstNonPad, bytes.subarray(firstNonPad, l))
    }

    return memMap
  }

  /**
   * Returns a new instance of {@linkcode HexMemoryMap}, containing only data between
   * the addresses <tt>address</tt> and <tt>address + length</tt>.
   * Behaviour is similar to {@linkcode https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/slice|Array.prototype.slice},
   * in that the return value is a portion of the current {@linkcode HexMemoryMap}.
   *
   * <br/>
   * The returned {@linkcode HexMemoryMap} might be empty.
   *
   * <br/>
   * Internally, this uses <tt>subarray</tt>, so new memory is not allocated.
   *
   * @param {Number} address The start address of the slice
   * @param {Number} length The length of memory map to slice out
   * @return {HexMemoryMap}
   */
  slice(address: number, length = Infinity) {
    if (length < 0) {
      throw new Error('Length of the slice cannot be negative')
    }

    const sliced = new HexMemoryMap()

    for (const [blockAddr, block] of this) {
      const blockLength = block.length

      if (blockAddr + blockLength >= address && blockAddr < address + length) {
        const sliceStart = Math.max(address, blockAddr)
        const sliceEnd = Math.min(address + length, blockAddr + blockLength)
        const sliceLength = sliceEnd - sliceStart
        const relativeSliceStart = sliceStart - blockAddr

        if (sliceLength > 0) {
          sliced.set(
            sliceStart,
            block.subarray(relativeSliceStart, relativeSliceStart + sliceLength)
          )
        }
      }
    }
    return sliced
  }

  /**
   * Returns a new instance of {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32|Buffer}, containing only data between
   * the addresses <tt>address</tt> and <tt>address + length</tt>. Any byte without a value
   * in the input {@linkcode HexMemoryMap} will have a value of <tt>padByte</tt>.
   *
   * <br/>
   * This method allocates new memory.
   *
   * @param {Number} address The start address of the slice
   * @param {Number} length The length of memory map to slice out
   * @param {Number} [padByte=0xFF] The value of the byte assumed to be used as padding
   * @return {Buffer}
   */
  slicePad(address: number, length: number, padByte = 0xff) {
    if (length < 0) {
      throw new Error('Length of the slice cannot be negative')
    }

    const out = Buffer.alloc(length, padByte)

    for (const [blockAddr, block] of this) {
      const blockLength = block.length

      if (blockAddr + blockLength >= address && blockAddr < address + length) {
        const sliceStart = Math.max(address, blockAddr)
        const sliceEnd = Math.min(address + length, blockAddr + blockLength)
        const sliceLength = sliceEnd - sliceStart
        const relativeSliceStart = sliceStart - blockAddr

        if (sliceLength > 0) {
          out.set(
            block.subarray(relativeSliceStart, relativeSliceStart + sliceLength),
            sliceStart - address
          )
        }
      }
    }
    return out
  }

  /**
   * Checks whether the current memory map contains the one given as a parameter.
   *
   * <br/>
   * "Contains" means that all the offsets that have a byte value in the given
   * memory map have a value in the current memory map, and that the byte values
   * are the same.
   *
   * <br/>
   * An empty memory map is always contained in any other memory map.
   *
   * <br/>
   * Returns boolean <tt>true</tt> if the memory map is contained, <tt>false</tt>
   * otherwise.
   *
   * @param {HexMemoryMap} memMap The memory map to check
   * @return {Boolean}
   */
  contains(memMap: HexMemoryMap) {
    for (const [blockAddr, block] of memMap) {
      const blockLength = block.length

      const slice = this.slice(blockAddr, blockLength).join().get(blockAddr)

      if (!slice || slice.length !== blockLength) {
        return false
      }

      for (const i in block) {
        if (block[i] !== slice[i]) {
          return false
        }
      }
    }
    return true
  }
}

/**
 * @category Util
 * @example
 * import {S19MemoryMap} from 'ECB';
 *
 * let memMap1 = new S19MemoryMap();
 * let memMap2 = new S19MemoryMap([[0, new Buffer(1,2,3,4)]]);
 * let memMap3 = new S19MemoryMap({0: new Buffer(1,2,3,4)});
 * let memMap4 = new S19MemoryMap({0xCF0: new Buffer(1,2,3,4)});
 *
 * const block = S19MemoryMap.fromS19(s19Text);
 */
export class S19MemoryMap {
  private _blocks: Map<number, Buffer>

  /**
   * @param {Iterable} blocks The initial value for the memory blocks inside this
   * <tt>S19MemoryMap</tt>. All keys must be numeric, and all values must be instances of
   * <tt>Buffer</tt>. Optionally it can also be a plain <tt>Object</tt> with
   * only numeric keys.
   */
  constructor(blocks?: Iterable<[number, Buffer]> | { [key: string]: Buffer } | null) {
    this._blocks = new Map()

    if (blocks && Symbol.iterator in blocks) {
      for (const tuple of blocks as Iterable<[number, Buffer]>) {
        if (!Array.isArray(tuple) || tuple.length !== 2) {
          throw new Error(
            'First parameter to S19MemoryMap constructor must be an iterable of [addr, bytes] or undefined'
          )
        }
        this.set(tuple[0], tuple[1])
      }
    } else if (typeof blocks === 'object') {
      // Try iterating through the object's keys
      if (blocks) {
        const addrs = Object.keys(blocks)
        for (const addr of addrs) {
          this.set(parseInt(addr), blocks[addr])
        }
      }
    } else if (blocks !== undefined && blocks !== null) {
      throw new Error(
        'First parameter to S19MemoryMap constructor must be an iterable of [addr, bytes] or undefined'
      )
    }
  }

  set(addr: number, value: Buffer): Map<number, Buffer> {
    if (!Number.isInteger(addr)) {
      throw new Error('Address passed to S19MemoryMap is not an integer')
    }
    if (addr < 0) {
      throw new Error('Address passed to S19MemoryMap is negative')
    }
    if (!(value instanceof Buffer)) {
      throw new Error('Bytes passed to S19MemoryMap are not an Buffer')
    }
    return this._blocks.set(addr, value)
  }

  // Delegate the following to the 'this._blocks' Map:
  get(addr: number): Buffer | undefined {
    return this._blocks.get(addr)
  }
  clear(): void {
    return this._blocks.clear()
  }
  delete(addr: number): boolean {
    return this._blocks.delete(addr)
  }
  entries(): IterableIterator<[number, Buffer]> {
    return this._blocks.entries()
  }
  forEach(
    callback: (value: Buffer, key: number, map: Map<number, Buffer>) => void,
    thisArg?: any
  ): void {
    return this._blocks.forEach(callback, thisArg)
  }
  has(addr: number): boolean {
    return this._blocks.has(addr)
  }
  keys(): IterableIterator<number> {
    return this._blocks.keys()
  }
  values(): IterableIterator<Buffer> {
    return this._blocks.values()
  }
  get size(): number {
    return this._blocks.size
  }
  [Symbol.iterator](): IterableIterator<[number, Buffer]> {
    return this._blocks[Symbol.iterator]()
  }

  /**
   * Parses a string containing data formatted in "Motorola S-record" format, and
   * returns an instance of {@linkcode S19MemoryMap}.
   *<br/>
   * Supports S0 (header), S1 (16-bit data), S2 (24-bit data), S3 (32-bit data), S5/S6 (count), S7/S8/S9 (end) records.
   *<br/>
   * The insertion order of keys in the {@linkcode S19MemoryMap} is guaranteed to be strictly
   * ascending. In other words, when iterating through the {@linkcode S19MemoryMap}, the addresses
   * will be ordered in ascending order.
   *<br/>
   * The parser has an opinionated behaviour, and will throw a descriptive error if it
   * encounters some malformed input.
   *<br/>
   * If <tt>maxBlockSize</tt> is given, any contiguous data block larger than that will
   * be split in several blocks.
   *
   * @param {String} s19Text The contents of a .s19 file.
   * @param {Number} [maxBlockSize=Infinity] Maximum size of the returned <tt>Buffer</tt>s.
   *
   * @return {S19MemoryMap}
   *
   * @example
   * import {S19MemoryMap} from 'ECB';
   *
   * let srecordString =
   *     "S00F000068656C6C6F202020202000003C\n" +
   *     "S11F00007C0802A6900100049421FFF07C6C1B787C8C23784E800020E8010010C\n" +
   *     "S5030001FB\n" +
   *     "S9030000FC";
   *
   * let memMap = S19MemoryMap.fromS19(srecordString);
   *
   * for (let [address, dataBlock] of memMap) {
   *     console.log('Data block at ', address, ', bytes: ', dataBlock);
   * }
   */
  static fromS19(s19Text: string, maxBlockSize = Infinity) {
    const blocks = new S19MemoryMap()
    const lines = s19Text.split(/\r?\n/)
    let recordCount = 0
    let startAddress = 0

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      recordCount++

      if (!trimmedLine.startsWith('S')) {
        throw new Error(`Line ${recordCount} does not start with 'S': "${trimmedLine}"`)
      }

      if (trimmedLine.length < 4) {
        throw new Error(`Line ${recordCount} is too short: "${trimmedLine}"`)
      }

      const recordType = parseInt(trimmedLine[1])
      const lengthStr = trimmedLine.substr(2, 2)
      const length = parseInt(lengthStr, 16)

      if (isNaN(length)) {
        throw new Error(`Invalid length field in line ${recordCount}: "${lengthStr}"`)
      }

      const expectedLineLength = 4 + length * 2
      if (trimmedLine.length !== expectedLineLength) {
        throw new Error(
          `Line ${recordCount} has incorrect length. Expected ${expectedLineLength}, got ${trimmedLine.length}: "${trimmedLine}"`
        )
      }

      // Extract the data part (without S, type, and length)
      const dataStr = trimmedLine.substr(4)

      // Verify checksum
      let calculatedChecksum = length
      for (let i = 0; i < dataStr.length - 2; i += 2) {
        calculatedChecksum += parseInt(dataStr.substr(i, 2), 16)
      }
      calculatedChecksum = ~calculatedChecksum & 0xff

      const providedChecksum = parseInt(dataStr.substr(dataStr.length - 2), 16)
      if (calculatedChecksum !== providedChecksum) {
        throw new Error(
          `Checksum mismatch in line ${recordCount}. Expected ${calculatedChecksum.toString(16).toUpperCase().padStart(2, '0')}, got ${providedChecksum.toString(16).toUpperCase().padStart(2, '0')}`
        )
      }

      switch (recordType) {
        case 0: // S0 - Header record
          // Skip header record
          break

        case 1: // S1 - Data record with 16-bit address
          {
            const addressStr = dataStr.substr(0, 4)
            const address = parseInt(addressStr, 16)
            const dataBytes = dataStr.substr(4, dataStr.length - 6) // Exclude checksum

            if (dataBytes.length % 2 !== 0) {
              throw new Error(`Invalid data bytes length in line ${recordCount}: "${dataBytes}"`)
            }

            const buffer = Buffer.from(
              dataBytes.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || []
            )

            if (buffer.length > 0) {
              blocks.set(address, buffer)
            }
          }
          break

        case 2: // S2 - Data record with 24-bit address
          {
            const addressStr = dataStr.substr(0, 6)
            const address = parseInt(addressStr, 16)
            const dataBytes = dataStr.substr(6, dataStr.length - 8) // Exclude checksum

            if (dataBytes.length % 2 !== 0) {
              throw new Error(`Invalid data bytes length in line ${recordCount}: "${dataBytes}"`)
            }

            const buffer = Buffer.from(
              dataBytes.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || []
            )

            if (buffer.length > 0) {
              blocks.set(address, buffer)
            }
          }
          break

        case 3: // S3 - Data record with 32-bit address
          {
            const addressStr = dataStr.substr(0, 8)
            const address = parseInt(addressStr, 16)
            const dataBytes = dataStr.substr(8, dataStr.length - 10) // Exclude checksum

            if (dataBytes.length % 2 !== 0) {
              throw new Error(`Invalid data bytes length in line ${recordCount}: "${dataBytes}"`)
            }

            const buffer = Buffer.from(
              dataBytes.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || []
            )

            if (buffer.length > 0) {
              blocks.set(address, buffer)
            }
          }
          break

        case 5: // S5 - Count record (optional, skip)
          break

        case 6: // S6 - Count record (optional, skip)
          break

        case 7: // S7 - End record with 32-bit start address
          {
            const addressStr = dataStr.substr(0, 8)
            startAddress = parseInt(addressStr, 16)
          }
          break

        case 8: // S8 - End record with 24-bit start address
          {
            const addressStr = dataStr.substr(0, 6)
            startAddress = parseInt(addressStr, 16)
          }
          break

        case 9: // S9 - End record with 16-bit start address
          {
            const addressStr = dataStr.substr(0, 4)
            startAddress = parseInt(addressStr, 16)
          }
          break

        default:
          throw new Error(`Unsupported record type S${recordType} in line ${recordCount}`)
      }
    }

    return blocks.join(maxBlockSize)
  }

  /**
   * Returns a <strong>new</strong> instance of {@linkcode S19MemoryMap}, containing
   * the same data, but concatenating together those memory blocks that are adjacent.
   *<br/>
   * The insertion order of keys in the {@linkcode S19MemoryMap} is guaranteed to be strictly
   * ascending. In other words, when iterating through the {@linkcode S19MemoryMap}, the addresses
   * will be ordered in ascending order.
   *<br/>
   * If <tt>maxBlockSize</tt> is given, blocks will be concatenated together only
   * until the joined block reaches this size in bytes. This means that the output
   * {@linkcode S19MemoryMap} might have more entries than the input one.
   *<br/>
   * If there is any overlap between blocks, an error will be thrown.
   *<br/>
   * The returned {@linkcode S19MemoryMap} will use newly allocated memory.
   *
   * @param {Number} [maxBlockSize=Infinity] Maximum size of the <tt>Buffer</tt>s in the
   * returned {@linkcode S19MemoryMap}.
   *
   * @return {S19MemoryMap}
   */
  join(maxBlockSize = Infinity) {
    // First pass, create a Map of address→length of contiguous blocks
    const sortedKeys = Array.from(this.keys()).sort((a, b) => a - b)
    const blockSizes = new Map()
    let lastBlockAddr = -1
    let lastBlockEndAddr = -1

    for (let i = 0, l = sortedKeys.length; i < l; i++) {
      const blockAddr = sortedKeys[i]
      const blockLength = this.get(sortedKeys[i])!.length

      if (lastBlockEndAddr === blockAddr && lastBlockEndAddr - lastBlockAddr < maxBlockSize) {
        // Grow when the previous end address equals the current,
        // and we don't go over the maximum block size.
        blockSizes.set(lastBlockAddr, blockSizes.get(lastBlockAddr) + blockLength)
        lastBlockEndAddr += blockLength
      } else if (lastBlockEndAddr <= blockAddr) {
        // Else mark a new block.
        blockSizes.set(blockAddr, blockLength)
        lastBlockAddr = blockAddr
        lastBlockEndAddr = blockAddr + blockLength
      } else {
        throw new Error('Overlapping data around address 0x' + blockAddr.toString(16))
      }
    }

    // Second pass: allocate memory for the contiguous blocks and copy data around.
    const mergedBlocks = new S19MemoryMap()
    let mergingBlock
    let mergingBlockAddr = -1
    for (let i = 0, l = sortedKeys.length; i < l; i++) {
      const blockAddr = sortedKeys[i]
      if (blockSizes.has(blockAddr)) {
        mergingBlock = Buffer.alloc(blockSizes.get(blockAddr))
        mergedBlocks.set(blockAddr, mergingBlock)
        mergingBlockAddr = blockAddr
      }
      mergingBlock!.set(this.get(blockAddr)!, blockAddr - mergingBlockAddr)
    }

    return mergedBlocks
  }

  /**
   * Given a {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map|<tt>Map</tt>}
   * of {@linkcode S19MemoryMap}s, indexed by a alphanumeric ID,
   * returns a <tt>Map</tt> of address to tuples (<tt>Arrays</tt>s of length 2) of the form
   * <tt>(id, Buffer)</tt>s.
   *<br/>
   * The scenario for using this is having several {@linkcode S19MemoryMap}s, from several calls to
   * {@link module:ECB~s19ToArrays|s19ToArrays}, each having a different identifier.
   * This function locates where those memory block sets overlap, and returns a <tt>Map</tt>
   * containing addresses as keys, and arrays as values. Each array will contain 1 or more
   * <tt>(id, Buffer)</tt> tuples: the identifier of the memory block set that has
   * data in that region, and the data itself. When memory block sets overlap, there will
   * be more than one tuple.
   *<br/>
   * The <tt>Buffer</tt>s in the output are
   * {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/subarray|subarrays}
   * of the input data; new memory is <strong>not</strong> allocated for them.
   *<br/>
   * The insertion order of keys in the output <tt>Map</tt> is guaranteed to be strictly
   * ascending. In other words, when iterating through the <tt>Map</tt>, the addresses
   * will be ordered in ascending order.
   *<br/>
   * When two blocks overlap, the corresponding array of tuples will have the tuples ordered
   * in the insertion order of the input <tt>Map</tt> of block sets.
   *<br/>
   *
   * @param {Map.S19MemoryMap} S19MemoryMaps The input memory block sets
   *
   * @return {Map.Array<mixed,Buffer>} The map of possibly overlapping memory blocks
   */
  static overlapS19MemoryMaps(S19MemoryMaps: Map<string, S19MemoryMap>) {
    // First pass: create a list of addresses where any block starts or ends.
    const cuts = new Set<number>()
    for (const [, blocks] of S19MemoryMaps) {
      for (const [address, block] of blocks) {
        cuts.add(address)
        cuts.add(address + block.length)
      }
    }

    const orderedCuts = Array.from(cuts.values()).sort((a, b) => a - b)
    const overlaps = new Map()

    // Second pass: iterate through the cuts, get slices of every intersecting blockset
    for (let i = 0, l = orderedCuts.length - 1; i < l; i++) {
      const cut = orderedCuts[i]
      const nextCut = orderedCuts[i + 1]
      const tuples = []

      for (const [setId, blocks] of S19MemoryMaps) {
        // Find the block with the highest address that is equal or lower to
        // the current cut (if any)
        const blockAddr = Array.from(blocks.keys()).reduce((acc, val) => {
          if (val > cut) {
            return acc
          }
          return Math.max(acc, val)
        }, -1)

        if (blockAddr !== -1) {
          const block = blocks.get(blockAddr)!
          const subBlockStart = cut - blockAddr
          const subBlockEnd = nextCut - blockAddr

          if (subBlockStart < block.length) {
            tuples.push([setId, block.subarray(subBlockStart, subBlockEnd)])
          }
        }
      }

      if (tuples.length) {
        overlaps.set(cut, tuples)
      }
    }

    return overlaps
  }

  /**
   * Given the output of the {@linkcode S19MemoryMap.overlapS19MemoryMaps|overlapS19MemoryMaps}
   * (a <tt>Map</tt> of address to an <tt>Array</tt> of <tt>(id, Buffer)</tt> tuples),
   * returns a {@linkcode S19MemoryMap}. This discards the IDs in the process.
   *<br/>
   * The output <tt>Map</tt> contains as many entries as the input one (using the same addresses
   * as keys), but the value for each entry will be the <tt>Buffer</tt> of the <b>last</b>
   * tuple for each address in the input data.
   *<br/>
   * The scenario is wanting to join together several parsed .s19 files, not worrying about
   * their overlaps.
   *<br/>
   *
   * @param {Map.Array<mixed,Buffer>} overlaps The (possibly overlapping) input memory blocks
   * @return {S19MemoryMap} The flattened memory blocks
   */
  static flattenOverlaps(overlaps: Map<number, [string, Buffer][]>) {
    return new S19MemoryMap(
      Array.from(overlaps.entries()).map(([address, tuples]) => {
        return [address, tuples[tuples.length - 1][1]] as [number, Buffer]
      })
    )
  }

  /**
   * Returns a new instance of {@linkcode S19MemoryMap}, where:
   *
   * <ul>
   *  <li>Each key (the start address of each <tt>Buffer</tt>) is a multiple of
   *    <tt>pageSize</tt></li>
   *  <li>The size of each <tt>Buffer</tt> is exactly <tt>pageSize</tt></li>
   *  <li>Bytes from the input map to bytes in the output</li>
   *  <li>Bytes not in the input are replaced by a padding value</li>
   * </ul>
   *<br/>
   * The scenario is wanting to prepare pages of bytes for a write operation, where the write
   * operation affects a whole page/sector at once.
   *<br/>
   * The insertion order of keys in the output {@linkcode S19MemoryMap} is guaranteed
   * to be strictly ascending. In other words, when iterating through the
   * {@linkcode S19MemoryMap}, the addresses will be ordered in ascending order.
   *<br/>
   * The <tt>Buffer</tt>s in the output will be newly allocated.
   *<br/>
   *
   * @param {Number} [pageSize=1024] The size of the output pages, in bytes
   * @param {Number} [pad=0xFF] The byte value to use for padding
   * @return {S19MemoryMap}
   */
  paginate(pageSize = 1024, pad = 0xff) {
    if (pageSize <= 0) {
      throw new Error('Page size must be greater than zero')
    }
    const outPages = new S19MemoryMap()
    let page

    const sortedKeys = Array.from(this.keys()).sort((a, b) => a - b)

    for (let i = 0, l = sortedKeys.length; i < l; i++) {
      const blockAddr = sortedKeys[i]
      const block = this.get(blockAddr)!
      const blockLength = block.length
      const blockEnd = blockAddr + blockLength

      for (
        let pageAddr = blockAddr - (blockAddr % pageSize);
        pageAddr < blockEnd;
        pageAddr += pageSize
      ) {
        page = outPages.get(pageAddr)
        if (!page) {
          page = Buffer.alloc(pageSize)
          page.fill(pad)
          outPages.set(pageAddr, page)
        }

        const offset = pageAddr - blockAddr
        let subBlock
        if (offset <= 0) {
          // First page which intersects the block
          subBlock = block.subarray(0, Math.min(pageSize + offset, blockLength))
          page.set(subBlock, -offset)
        } else {
          // Any other page which intersects the block
          subBlock = block.subarray(offset, offset + Math.min(pageSize, blockLength - offset))
          page.set(subBlock, 0)
        }
      }
    }

    return outPages
  }

  /**
   * Locates the <tt>Buffer</tt> which contains the given offset,
   * and returns the four bytes held at that offset, as a 32-bit unsigned integer.
   *
   *<br/>
   * Behaviour is similar to {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32|DataView.prototype.getUint32},
   * except that this operates over a {@linkcode S19MemoryMap} instead of
   * over an <tt>ArrayBuffer</tt>, and that this may return <tt>undefined</tt> if
   * the address is not <em>entirely</em> contained within one of the <tt>Buffer</tt>s.
   *<br/>
   *
   * @param {Number} offset The memory offset to read the data
   * @param {Boolean} [littleEndian=false] Whether to fetch the 4 bytes as a little- or big-endian integer
   * @return {Number|undefined} An unsigned 32-bit integer number
   */
  getUint32(offset: number, littleEndian: boolean) {
    const keys = Array.from(this.keys())

    for (let i = 0, l = keys.length; i < l; i++) {
      const blockAddr = keys[i]
      const block = this.get(blockAddr)!
      const blockLength = block.length
      const blockEnd = blockAddr + blockLength

      if (blockAddr <= offset && offset + 4 <= blockEnd) {
        return new DataView(block.buffer, offset - blockAddr, 4).getUint32(0, littleEndian)
      }
    }
    return
  }

  /**
   * Returns a <tt>String</tt> of text representing a .s19 file.
   * <br/>
   * The writer has an opinionated behaviour. Automatically chooses between S1 (16-bit), S2 (24-bit), and S3 (32-bit)
   * records based on the maximum address. Uses S2 if any address exceeds 0xFFFF, S3 if any address exceeds 0xFFFFFF.
   *
   * @param {Number} [lineSize=16] Maximum number of bytes to be encoded in each data record.
   * Must have a value between 1 and 255, as per the specification.
   *
   * @return {String} String of text with the .s19 representation of the input binary data
   *
   * @example
   * import {S19MemoryMap} from 'ECB';
   *
   * let memMap = new S19MemoryMap();
   * let bytes = new Buffer(....);
   * memMap.set(0x0FF80000, bytes); // The block with 'bytes' will start at offset 0x0FF80000
   *
   * let string = memMap.asS19String();
   */
  asS19String(lineSize = 16) {
    if (lineSize <= 0) {
      throw new Error('Size of record must be greater than zero')
    } else if (lineSize > 255) {
      throw new Error('Size of record must be less than 256')
    }

    const records = []

    // Header record (S0)
    const headerData = 'ECB S19 export'
    const headerBuffer = Buffer.from(headerData)
    let headerRecord = 'S0'
    headerRecord += (2 + headerBuffer.length + 1).toString(16).toUpperCase().padStart(2, '0') // Length
    headerRecord += '0000' // Address (always 0000 for S0)
    headerRecord += Array.from(headerBuffer)
      .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('')

    // Calculate checksum for header
    let headerChecksum = 2 + headerBuffer.length + 1 + 0 + 0 // length + addr_high + addr_low
    for (const byte of headerBuffer) {
      headerChecksum += byte
    }
    headerChecksum = ~headerChecksum & 0xff
    headerRecord += headerChecksum.toString(16).toUpperCase().padStart(2, '0')
    records.push(headerRecord)

    // Data records (S1, S2, or S3)
    let totalDataRecords = 0
    const sortedKeys = Array.from(this.keys()).sort((a, b) => a - b)

    // Determine which record type to use based on maximum address
    const maxAddress =
      sortedKeys.length > 0
        ? Math.max(...sortedKeys.map((addr) => addr + (this.get(addr)?.length || 0)))
        : 0
    let recordType: 'S1' | 'S2' | 'S3' = 'S1'
    let addressBytes = 2
    if (maxAddress > 0xffffff) {
      recordType = 'S3'
      addressBytes = 4
    } else if (maxAddress > 0xffff) {
      recordType = 'S2'
      addressBytes = 3
    }

    for (const blockAddr of sortedKeys) {
      const block = this.get(blockAddr)
      if (!block || block.length === 0) continue

      let currentAddr = blockAddr
      for (let offset = 0; offset < block.length; offset += lineSize) {
        const dataLength = Math.min(lineSize, block.length - offset)
        const dataBytes = block.subarray(offset, offset + dataLength)

        let record = recordType
        const recordLength = addressBytes + 1 + dataLength // addr + checksum(1) + data
        record += recordLength.toString(16).toUpperCase().padStart(2, '0')
        record += currentAddr
          .toString(16)
          .toUpperCase()
          .padStart(addressBytes * 2, '0')
        record += Array.from(dataBytes)
          .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
          .join('')

        // Calculate checksum
        let checksum = recordLength
        if (recordType === 'S3') {
          checksum += (currentAddr >> 24) & 0xff // Address byte 3
          checksum += (currentAddr >> 16) & 0xff // Address byte 2
        } else if (recordType === 'S2') {
          checksum += (currentAddr >> 16) & 0xff // Address byte 2
        }
        checksum += (currentAddr >> 8) & 0xff // Address byte 1
        checksum += currentAddr & 0xff // Address byte 0
        for (const byte of dataBytes) {
          checksum += byte
        }
        checksum = ~checksum & 0xff
        record += checksum.toString(16).toUpperCase().padStart(2, '0')

        records.push(record)
        currentAddr += dataLength
        totalDataRecords++
      }
    }

    // Count record (S5) - optional but good practice
    if (totalDataRecords <= 0xffff) {
      let countRecord = 'S5'
      countRecord += '03' // Length (always 3 for S5: 2 bytes count + 1 byte checksum)
      countRecord += totalDataRecords.toString(16).toUpperCase().padStart(4, '0')

      let countChecksum = 3 + ((totalDataRecords >> 8) & 0xff) + (totalDataRecords & 0xff)
      countChecksum = ~countChecksum & 0xff
      countRecord += countChecksum.toString(16).toUpperCase().padStart(2, '0')
      records.push(countRecord)
    }

    // End record (S7 for S3, S8 for S2, S9 for S1)
    let endRecord = recordType === 'S3' ? 'S7' : recordType === 'S2' ? 'S8' : 'S9'
    const endAddressBytes = addressBytes
    const endRecordLength = endAddressBytes + 1 // address + checksum
    endRecord += endRecordLength.toString(16).toUpperCase().padStart(2, '0')
    endRecord += '0000'.padStart(endAddressBytes * 2, '0') // Start address (typically 0000)

    let endChecksum = endRecordLength
    for (let i = 0; i < endAddressBytes; i++) {
      endChecksum += 0 // All address bytes are 0
    }
    endChecksum = ~endChecksum & 0xff
    endRecord += endChecksum.toString(16).toUpperCase().padStart(2, '0')
    records.push(endRecord)

    return records.join('\n')
  }

  /**
   * Performs a deep copy of the current {@linkcode S19MemoryMap}, returning a new one
   * with exactly the same contents, but allocating new memory for each of its
   * <tt>Buffer</tt>s.
   *
   * @return {S19MemoryMap}
   */
  clone() {
    const cloned = new S19MemoryMap()

    for (const [addr, value] of this) {
      cloned.set(addr, Buffer.from(value))
    }

    return cloned
  }

  /**
   * Given one <tt>Buffer</tt>, looks through its contents and returns a new
   * {@linkcode S19MemoryMap}, stripping away those regions where there are only
   * padding bytes.
   * <br/>
   * The start of the input <tt>Buffer</tt> is assumed to be offset zero for the output.
   * <br/>
   * The use case here is dumping memory from a working device and try to see the
   * "interesting" memory regions it has. This assumes that there is a constant,
   * predefined padding byte value being used in the "non-interesting" regions.
   * In other words: this will work as long as the dump comes from a flash memory
   * which has been previously erased (thus <tt>0xFF</tt>s for padding), or from a
   * previously blanked HDD (thus <tt>0x00</tt>s for padding).
   * <br/>
   * This method uses <tt>subarray</tt> on the input data, and thus does not allocate memory
   * for the <tt>Buffer</tt>s.
   *
   * @param {Buffer} bytes The input data
   * @param {Number} [padByte=0xFF] The value of the byte assumed to be used as padding
   * @param {Number} [minPadLength=64] The minimum number of consecutive pad bytes to
   * be considered actual padding
   *
   * @return {S19MemoryMap}
   */
  static fromPaddedBuffer(bytes: Buffer, padByte = 0xff, minPadLength = 64) {
    if (!(bytes instanceof Buffer)) {
      throw new Error('Bytes passed to fromPaddedBuffer are not an Buffer')
    }

    const memMap = new S19MemoryMap()
    let consecutivePads = 0
    let lastNonPad = -1
    let firstNonPad = 0
    let skippingBytes = false
    const l = bytes.length

    for (let addr = 0; addr < l; addr++) {
      const byte = bytes[addr]

      if (byte === padByte) {
        consecutivePads++
        if (consecutivePads >= minPadLength) {
          // Edge case: ignore writing a zero-length block when skipping
          // bytes at the beginning of the input
          if (lastNonPad !== -1) {
            /// Add the previous block to the result memMap
            memMap.set(firstNonPad, bytes.subarray(firstNonPad, lastNonPad + 1))
          }

          skippingBytes = true
        }
      } else {
        if (skippingBytes) {
          skippingBytes = false
          firstNonPad = addr
        }
        lastNonPad = addr
        consecutivePads = 0
      }
    }

    // At EOF, add the last block if not skipping bytes already (and input not empty)
    if (!skippingBytes && lastNonPad !== -1) {
      memMap.set(firstNonPad, bytes.subarray(firstNonPad, l))
    }

    return memMap
  }

  /**
   * Returns a new instance of {@linkcode S19MemoryMap}, containing only data between
   * the addresses <tt>address</tt> and <tt>address + length</tt>.
   * Behaviour is similar to {@linkcode https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/slice|Array.prototype.slice},
   * in that the return value is a portion of the current {@linkcode S19MemoryMap}.
   *
   * <br/>
   * The returned {@linkcode S19MemoryMap} might be empty.
   *
   * <br/>
   * Internally, this uses <tt>subarray</tt>, so new memory is not allocated.
   *
   * @param {Number} address The start address of the slice
   * @param {Number} length The length of memory map to slice out
   * @return {S19MemoryMap}
   */
  slice(address: number, length = Infinity) {
    if (length < 0) {
      throw new Error('Length of the slice cannot be negative')
    }

    const sliced = new S19MemoryMap()

    for (const [blockAddr, block] of this) {
      const blockLength = block.length

      if (blockAddr + blockLength >= address && blockAddr < address + length) {
        const sliceStart = Math.max(address, blockAddr)
        const sliceEnd = Math.min(address + length, blockAddr + blockLength)
        const sliceLength = sliceEnd - sliceStart
        const relativeSliceStart = sliceStart - blockAddr

        if (sliceLength > 0) {
          sliced.set(
            sliceStart,
            block.subarray(relativeSliceStart, relativeSliceStart + sliceLength)
          )
        }
      }
    }
    return sliced
  }

  /**
   * Returns a new instance of {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32|Buffer}, containing only data between
   * the addresses <tt>address</tt> and <tt>address + length</tt>. Any byte without a value
   * in the input {@linkcode S19MemoryMap} will have a value of <tt>padByte</tt>.
   *
   * <br/>
   * This method allocates new memory.
   *
   * @param {Number} address The start address of the slice
   * @param {Number} length The length of memory map to slice out
   * @param {Number} [padByte=0xFF] The value of the byte assumed to be used as padding
   * @return {Buffer}
   */
  slicePad(address: number, length: number, padByte = 0xff) {
    if (length < 0) {
      throw new Error('Length of the slice cannot be negative')
    }

    const out = Buffer.alloc(length, padByte)

    for (const [blockAddr, block] of this) {
      const blockLength = block.length

      if (blockAddr + blockLength >= address && blockAddr < address + length) {
        const sliceStart = Math.max(address, blockAddr)
        const sliceEnd = Math.min(address + length, blockAddr + blockLength)
        const sliceLength = sliceEnd - sliceStart
        const relativeSliceStart = sliceStart - blockAddr

        if (sliceLength > 0) {
          out.set(
            block.subarray(relativeSliceStart, relativeSliceStart + sliceLength),
            sliceStart - address
          )
        }
      }
    }
    return out
  }

  /**
   * Checks whether the current memory map contains the one given as a parameter.
   *
   * <br/>
   * "Contains" means that all the offsets that have a byte value in the given
   * memory map have a value in the current memory map, and that the byte values
   * are the same.
   *
   * <br/>
   * An empty memory map is always contained in any other memory map.
   *
   * <br/>
   * Returns boolean <tt>true</tt> if the memory map is contained, <tt>false</tt>
   * otherwise.
   *
   * @param {S19MemoryMap} memMap The memory map to check
   * @return {Boolean}
   */
  contains(memMap: S19MemoryMap) {
    for (const [blockAddr, block] of memMap) {
      const blockLength = block.length

      const slice = this.slice(blockAddr, blockLength).join().get(blockAddr)

      if (!slice || slice.length !== blockLength) {
        return false
      }

      for (const i in block) {
        if (block[i] !== slice[i]) {
          return false
        }
      }
    }
    return true
  }
}
