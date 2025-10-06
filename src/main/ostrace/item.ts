import { SerialPort } from 'serialport'
import type { ORTIFile } from 'src/renderer/src/database/ortiParse'
import fs from 'fs'
import { CRC } from './../worker/crc'
import { OsEvent } from '../share/osEvent'
import { OsTraceLOG } from '../log'
import { getTsUs } from '../share/can'
import path from 'path'
/*
|1 byte frame header (0x5A)|4byte index (MSB) |4byte timestamp (MSB) |1 byte type|2byte type id(MSB)|2byte type status(MSB)|1byte coreID|1byte CRC8|
*/
const FRAME_HEADER = 0x5a
const FRAME_HEADER_SIZE = 1
const DATA_LENGTH = 15
const FRAME_LENGTH = FRAME_HEADER_SIZE + DATA_LENGTH
const crc8 = CRC.default('CRC8')!

export default class TraceItem {
  private serialPort?: SerialPort
  private file?: fs.ReadStream
  private leftBuffer: Buffer = Buffer.alloc(0)
  private leftCsvBuffer: string = ''
  private index?: number
  private lastTimestamp?: number
  private tsOverflow = 0
  private log: OsTraceLOG
  private systemTs: number = 0
  private offsetTs?: number
  private eventQueue: Array<{ osEvent: OsEvent; realTs: number }> = []
  private timer?: NodeJS.Timeout

  constructor(
    public orti: ORTIFile,
    projectPath: string
  ) {
    this.orti = orti
    if (this.orti.connector) {
      if (this.orti.connector.type === 'SerialPort') {
        this.serialPort = new SerialPort({
          path: this.orti.connector.device,
          baudRate: parseInt(this.orti.connector.options.baudRate),
          dataBits: parseInt(this.orti.connector.options.dataBits) as any,
          parity: this.orti.connector.options.parity as 'none' | 'even' | 'odd',
          stopBits: parseInt(this.orti.connector.options.stopBits) as any,
          autoOpen: true
        })
        this.serialPort.on('data', this.dataCallback)
      } else if (this.orti.connector.type === 'BinaryFile') {
        if (!path.isAbsolute(this.orti.connector.options.file)) {
          this.orti.connector.options.file = path.join(
            projectPath,
            this.orti.connector.options.file
          )
        }
        //read file by stream
        this.file = fs.createReadStream(this.orti.connector.options.file)
        this.file.on('data', (chunk: any) => {
          this.dataCallback(chunk)
        })
      } else if (this.orti.connector.type === 'CSVFile') {
        if (!path.isAbsolute(this.orti.connector.options.file)) {
          this.orti.connector.options.file = path.join(
            projectPath,
            this.orti.connector.options.file
          )
        }
        this.file = fs.createReadStream(this.orti.connector.options.file, 'utf-8')
        this.file.on('data', (chunk: any) => {
          this.csvCallback(chunk as string)
        })
      }
    }
    let logFile = this.orti.recordFile?.name
    if (this.orti.recordFile?.enable && logFile) {
      if (!path.isAbsolute(logFile)) {
        logFile = path.join(projectPath, logFile)
      }
      logFile = path.resolve(logFile)
    }
    this.log = new OsTraceLOG(this.orti.name, logFile)
    this.systemTs = getTsUs()

    // Start 50ms timer to check queue only for file sources
    if (this.file) {
      this.timer = setInterval(() => {
        this.processQueue()
      }, 50)
    }
  }
  getRealTs(ts: number) {
    return ts + this.tsOverflow * 0x1_0000_0000
  }

  processQueue() {
    const currentTs = getTsUs() - this.systemTs

    // Process events whose time has arrived (realTs - offsetTs <= currentTs)
    while (this.eventQueue.length > 0) {
      const first = this.eventQueue[0]
      const eventTs = first.realTs - (this.offsetTs || 0)

      if (eventTs <= currentTs) {
        // Time has arrived, emit the event
        this.eventQueue.shift()
        this.log.osEvent(eventTs, first.osEvent)
      } else {
        // Event time hasn't arrived yet, wait
        break
      }
    }
  }

  dataCallback = (data: Buffer) => {
    const ts = getTsUs() - this.systemTs
    // Append new data to leftover buffer
    this.leftBuffer = Buffer.concat([this.leftBuffer, data])

    // Process frames - always search for frame header
    while (this.leftBuffer.length > 0) {
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
      const timestamp32 = block.readUInt32BE(4) / this.orti.cpuFreq
      const type = block.readUInt8(8)
      const typeId = block.readUInt16BE(9)
      const typeStatus = block.readUInt16BE(11)
      const coreID = block.readUInt8(13)
      const receivedCRC = block.readUInt8(14)

      // Calculate CRC on first 14 bytes
      const calculatedCRC = crc8.compute(block.subarray(0, 14))

      // Check CRC
      if (calculatedCRC !== receivedCRC) {
        console.error(
          `CRC mismatch! Expected: ${calculatedCRC}, Received: ${receivedCRC}, Index: ${currentIndex32}`
        )
        this.log.error(
          ts,
          `CRC mismatch! Expected: ${calculatedCRC}, Received: ${receivedCRC}, Index: ${currentIndex32}`
        )
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
          this.log.error(
            ts,
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
      const osEvent: OsEvent = {
        index: currentIndex32,
        database: this.orti.id,
        type: type,
        id: typeId,
        status: typeStatus,
        coreId: coreID,
        ts: realTs,
        comment: ''
      }
      if (this.offsetTs == undefined) {
        this.offsetTs = realTs - ts
      }

      // For file sources, add to queue; for serial port, emit immediately
      if (this.file) {
        this.eventQueue.push({ osEvent, realTs })
      } else {
        this.log.osEvent(realTs - this.offsetTs, osEvent)
      }

      // After processing a valid frame, loop continues and will search for next frame header
    }
  }
  csvCallback = (data: string) => {
    const ts = getTsUs() - this.systemTs

    // Prepend any leftover data from previous chunk
    data = this.leftCsvBuffer + data

    // Split by newlines
    const lines = data.split('\n')

    // Keep the last line if it's incomplete (no trailing newline)
    this.leftCsvBuffer = data.endsWith('\n') ? '' : lines.pop() || ''

    // Process complete lines
    for (const line of lines) {
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
      if (this.offsetTs == undefined) {
        this.offsetTs = osEvent.ts - ts
      }

      this.index++

      // For file sources, add to queue; otherwise emit immediately
      if (this.file) {
        this.eventQueue.push({ osEvent, realTs: osEvent.ts })
      } else {
        this.log.osEvent(osEvent.ts - this.offsetTs, osEvent)
      }
    }
  }
  async close() {
    return new Promise<void>((resolve) => {
      // Clear the timer (only exists for file sources)
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = undefined
      }

      if (this.serialPort) {
        this.serialPort.close(() => {
          resolve()
        })
      }
      if (this.file) {
        this.file.close((err) => {
          if (err) {
            console.error(err)
          }
          resolve()
        })
      }
      this.log.close()
      resolve()
    })
  }
}
