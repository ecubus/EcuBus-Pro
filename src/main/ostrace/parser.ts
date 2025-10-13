import { CRC } from '../worker/crc'
import type { OsEvent } from '../share/osEvent'
import type { ORTIFile } from 'src/renderer/src/database/ortiParse'
import { Transform, TransformCallback } from 'stream'

/*
|1 byte frame header (0x5A)|4byte index (MSB) |4byte timestamp (MSB) |1 byte type|2byte type id(MSB)|2byte type status(MSB)|1byte coreID|1byte CRC8|
*/
const FRAME_HEADER = 0x5a
const FRAME_HEADER_SIZE = 1
const DATA_LENGTH = 15
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
  private index?: number
  private lastTimestamp?: number
  private tsOverflow = 0
  private closeFlag = false
  private flushFlag = false

  constructor(
    private orti: ORTIFile,
    private callbacks: ParseCallbacks
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

  async parseBinaryData(data: Buffer) {
    // Append new data to leftover buffer
    this.leftBuffer = Buffer.concat([this.leftBuffer, data])

    // Process frames - always search for frame header
    while (this.leftBuffer.length > 0 && !this.closeFlag) {
      // Search for frame header from the beginning of buffer
      const headerIndex = this.leftBuffer.indexOf(FRAME_HEADER)

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

      // Extract one frame (skip header byte, get data)
      const block = this.leftBuffer.subarray(FRAME_HEADER_SIZE, FRAME_LENGTH)

      // Parse the block
      const currentIndex32 = block.readUInt32BE(0)
      const rawTimestamp32 = block.readUInt32BE(4)
      const timestamp32 = rawTimestamp32 / this.orti.cpuFreq
      const type = block.readUInt8(8)
      const typeId = block.readUInt16BE(9)
      const typeStatus = block.readUInt16BE(11)
      const coreID = block.readUInt8(13)
      const receivedCRC = block.readUInt8(14)

      // Calculate CRC on first 14 bytes
      const calculatedCRC = crc8.compute(block.subarray(0, 14))

      // Check CRC
      if (calculatedCRC !== receivedCRC) {
        this.callbacks.onError(
          `CRC mismatch! Expected: ${calculatedCRC}, Received: ${receivedCRC}, Index: ${currentIndex32}`
        )

        // Skip this entire frame and search for next frame header
        this.leftBuffer = this.leftBuffer.subarray(1)
        continue
      }

      // Valid frame found - remove the entire frame from buffer
      this.leftBuffer = this.leftBuffer.subarray(FRAME_LENGTH)

      // Check index continuity
      if (this.index == undefined) {
        this.index = currentIndex32
      } else {
        const expectedIndex32 = ((this.index + 1) & 0xffff_ffff) >>> 0
        if (currentIndex32 !== expectedIndex32) {
          this.callbacks.onError(
            `Index mismatch! Expected: ${expectedIndex32}, Received: ${currentIndex32}`
          )
        }
        this.index = currentIndex32
      }

      if (this.lastTimestamp != undefined && timestamp32 < this.lastTimestamp) {
        this.tsOverflow++
      }
      this.lastTimestamp = timestamp32

      // Convert to OsEvent using unified structure
      const realTs = this.getRealTs(timestamp32)
      const rawTs = this.getRealTs(rawTimestamp32)
      const osEvent: OsEvent = {
        index: currentIndex32,
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

      if (this.callbacks.getEventLength() >= EVENT_LENGTH_WATERMARK) {
        await this.delay(50)
      }
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

      const [timestamp, type, id, status] = line.split(',')

      // Validate data before parsing
      if (!timestamp || !type || !id || !status) continue
      if (this.index == undefined) {
        this.index = 0
      }
      const osEvent: OsEvent = {
        index: this.index,
        database: this.orti.id,
        type: parseInt(type),
        id: parseInt(id),
        status: parseInt(status),
        coreId: 0,
        ts: parseInt(timestamp),
        comment: ''
      }
      const realTs = osEvent.ts / this.orti.cpuFreq

      this.index++

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

  constructor(orti: ORTIFile, callbacks: ParseCallbacks) {
    super({ objectMode: true })
    this.parser = new OsTraceParser(orti, callbacks)
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
}

// CSV data parser stream
export class CsvParserStream extends Transform {
  private parser: OsTraceParser

  constructor(orti: ORTIFile, callbacks: ParseCallbacks) {
    super({ objectMode: true, encoding: 'utf-8' })
    this.parser = new OsTraceParser(orti, callbacks)
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
