import { CRC } from '../worker/crc'
import type { OsEvent } from '../share/osEvent'
import type { ORTIFile } from 'src/renderer/src/database/ortiParse'
import { Transform, TransformCallback } from 'stream'

/*
|4 byte frame header (0x5A5B5C5D)|1byte index |4byte timestamp (LSB) |1 byte type|2byte type id(LSB)|2byte type status(LSB)|1byte coreID|1byte CRC8/Reserved|
*/
const FRAME_HEADER = Buffer.from([0x5a, 0x5b, 0x5c, 0x5d])
const FRAME_HEADER_SIZE = 4
const DATA_LENGTH = 12
const FRAME_LENGTH = FRAME_HEADER_SIZE + DATA_LENGTH
const crc8 = CRC.buildInCrc('CRC8')!
const EVENT_LENGTH_WATERMARK = 2000

export interface ParseCallbacks {
  onEvent: (osEvent: OsEvent, realTs: number) => void
  onError: (error: string) => void
  getEventLength: () => number
}

export class OsTraceParser {
  private leftBuffer: Buffer = Buffer.alloc(0)
  private leftCsvBuffer: string = ''
  private indexByCore: Map<number, number> = new Map()
  private lastRawTimestampByCore: Map<number, number> = new Map()
  private tsOverflow = 0
  private closeFlag = false
  private flushFlag = false

  constructor(
    private orti: ORTIFile,
    private callbacks: ParseCallbacks,
    private checkCRC = false
  ) {}

  getRealTs(ts: number) {
    return ts + this.tsOverflow * 0x1_0000_0000
  }

  async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }
  close() {
    this.closeFlag = true
  }
  flush() {
    this.flushFlag = true
  }

  // Synchronous core function for parsing binary data
  // Returns: { processedEvents, hasMore } - hasMore indicates if there's more data to process
  parseBinaryDataSync(data: Buffer, maxFrames: number): boolean {
    // Append new data to leftover buffer
    this.leftBuffer = Buffer.concat([this.leftBuffer, data])

    // Process frames - always search for frame header
    // Limit processing to maxFrames to avoid blocking
    while (this.leftBuffer.length > 0 && !this.closeFlag) {
      // Need at least 4 bytes to search for frame header
      if (this.leftBuffer.length < FRAME_HEADER_SIZE) {
        break
      }

      // Search for 4-byte frame header from the beginning of buffer
      let headerIndex = -1
      for (let i = 0; i <= this.leftBuffer.length - FRAME_HEADER_SIZE; i++) {
        if (
          this.leftBuffer[i] === FRAME_HEADER[0] &&
          this.leftBuffer[i + 1] === FRAME_HEADER[1] &&
          this.leftBuffer[i + 2] === FRAME_HEADER[2] &&
          this.leftBuffer[i + 3] === FRAME_HEADER[3]
        ) {
          headerIndex = i
          break
        }
      }

      // If no frame header found, discard all data and wait for more
      if (headerIndex === -1) {
        this.leftBuffer = Buffer.alloc(0)
        break
      }

      // Skip bytes before frame header
      if (headerIndex > 0) {
        this.leftBuffer = this.leftBuffer.subarray(headerIndex)
        continue
      }

      // Now headerIndex is 0, frame header is at the beginning
      // Check if we have enough data for a complete frame
      if (this.leftBuffer.length < FRAME_LENGTH) {
        break
      }

      // Extract one frame (skip header bytes, get data)
      const block = this.leftBuffer.subarray(FRAME_HEADER_SIZE, FRAME_LENGTH)

      // Parse the block

      const rawTimestamp32 = block.readUInt32LE(0)
      const typeId = block.readUInt16LE(4)
      const typeStatus = block.readUInt16LE(6)
      const currentIndex = block.readUInt8(8)
      const type = block.readUInt8(9)
      const coreID = block.readUInt8(10)
      const receivedCRC = block.readUInt8(11)

      // Validate frame based on checkCRC flag
      let isValidFrame = true
      if (this.checkCRC) {
        // Calculate CRC on first 11 bytes (index + timestamp + type + typeId + typeStatus + coreID)
        const calculatedCRC = crc8.compute(block.subarray(0, 11))
        if (calculatedCRC !== receivedCRC) {
          this.callbacks.onError(
            `CRC mismatch! Expected: ${calculatedCRC}, Received: ${receivedCRC}, Index: ${currentIndex}`
          )
          isValidFrame = false
        }
      } else {
        // When CRC is disabled, the last byte is reserved but still present in the frame
        // Validate by checking if type is in valid range (0-5)
        if (type > 5) {
          this.callbacks.onError(`Invalid type value: ${type}, Index: ${currentIndex}`)
          isValidFrame = false
        }
      }

      if (!isValidFrame) {
        // Skip this entire frame and search for next frame header
        this.leftBuffer = this.leftBuffer.subarray(1)
        continue
      }

      // Valid frame found - remove the entire frame from buffer
      this.leftBuffer = this.leftBuffer.subarray(FRAME_LENGTH)

      // Check index continuity per core
      const coreIndex = this.indexByCore.get(coreID)
      if (coreIndex == undefined) {
        this.indexByCore.set(coreID, currentIndex)
      } else {
        const expectedIndex = (coreIndex + 1) & 0xff
        if (currentIndex != expectedIndex) {
          this.callbacks.onError(
            `Index mismatch on core ${coreID}! Expected: ${expectedIndex}, Received: ${currentIndex}, Block: ${block.toString('hex')}`
          )
        }
        this.indexByCore.set(coreID, currentIndex)
      }

      // Detect timestamp overflow using raw timestamp (not divided by frequency) per core
      const coreLastRawTimestamp = this.lastRawTimestampByCore.get(coreID)
      if (coreLastRawTimestamp != undefined && rawTimestamp32 < coreLastRawTimestamp) {
        this.tsOverflow++
      }
      this.lastRawTimestampByCore.set(coreID, rawTimestamp32)

      // Convert to OsEvent using unified structure - use raw timestamp with overflow
      const rawTs = this.getRealTs(rawTimestamp32)
      const realTs = rawTs / this.orti.cpuFreq
      const osEvent: OsEvent = {
        index: currentIndex,
        database: this.orti.id,
        type: type,
        id: typeId,
        status: typeStatus,
        coreId: coreID,
        ts: rawTs,
        comment: ''
      }

      // Notify via callback
      this.callbacks.onEvent(osEvent, realTs)

      if (this.callbacks.getEventLength() >= maxFrames) {
        break
      }
    }

    // Check if there's potentially more data to process
    const hasMore = this.leftBuffer.length >= FRAME_LENGTH

    return hasMore
  }

  // Async wrapper for stream usage
  async parseBinaryData(data: Buffer) {
    // First call with new data
    let result = this.parseBinaryDataSync(data, EVENT_LENGTH_WATERMARK)

    // Continue processing if there's more data in buffer
    while (result && !this.closeFlag) {
      // Check if we need to yield to prevent blocking

      await this.delay(50)

      // Process more frames from the leftBuffer (pass empty buffer since data is already in leftBuffer)
      result = this.parseBinaryDataSync(Buffer.alloc(0), EVENT_LENGTH_WATERMARK)
    }
  }

  async parseCsvData(data: string) {
    // Prepend any leftover data from previous chunk
    data = this.leftCsvBuffer + data

    // Split by newlines
    const lines = data.split('\n')

    // Keep the last line if it's incomplete (no trailing newline)
    this.leftCsvBuffer = data.endsWith('\n') ? '' : lines.pop() || ''

    // Process complete lines
    for (const line of lines) {
      if (this.closeFlag) {
        break
      }
      if (!line.trim()) continue // Skip empty lines

      const [timestamp, type, id, status, coreIDU] = line.split(',')

      // Validate data before parsing
      if (!timestamp || !type || !id || !status) continue
      const coreID = parseInt(coreIDU || '0')
      const coreIndex = this.indexByCore.get(coreID)
      const currentIndex = coreIndex == undefined ? 0 : (coreIndex + 1) & 0xff
      this.indexByCore.set(coreID, currentIndex)
      const osEvent: OsEvent = {
        index: currentIndex,
        database: this.orti.id,
        type: parseInt(type),
        id: parseInt(id),
        status: parseInt(status),
        coreId: coreID,
        ts: parseInt(timestamp),
        comment: ''
      }
      const realTs = osEvent.ts / this.orti.cpuFreq

      // Notify via callback
      this.callbacks.onEvent(osEvent, realTs)

      if (this.callbacks.getEventLength() >= EVENT_LENGTH_WATERMARK) {
        await this.delay(50)
      }
    }
  }
}

// Binary data parser stream
export class BinaryParserStream extends Transform {
  private parser: OsTraceParser

  constructor(orti: ORTIFile, callbacks: ParseCallbacks, checkCRC = false) {
    super({ objectMode: true })
    this.parser = new OsTraceParser(orti, callbacks, checkCRC)
  }

  _transform(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
    this.parser
      .parseBinaryData(chunk)
      .then(() => {
        callback()
      })
      .catch((error) => {
        callback(error as Error)
      })
  }
  _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    this.parser.close()
    callback(error)
  }
  _flush(callback: TransformCallback): void {
    this.parser.flush()
    callback()
  }
}

// CSV data parser stream
export class CsvParserStream extends Transform {
  private parser: OsTraceParser

  constructor(orti: ORTIFile, callbacks: ParseCallbacks, checkCRC = false) {
    super({ objectMode: true, encoding: 'utf-8' })
    this.parser = new OsTraceParser(orti, callbacks, checkCRC)
  }

  _transform(chunk: string, encoding: string, callback: (error?: Error | null) => void) {
    this.parser
      .parseCsvData(chunk)
      .then(() => {
        callback()
      })
      .catch((error) => {
        callback(error as Error)
      })
  }
  //abort
  _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    this.parser.close()
    callback(error)
  }
  _flush(callback: TransformCallback): void {
    this.parser.flush()
    callback()
  }
}
