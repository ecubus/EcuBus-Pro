import { SerialPort } from 'serialport'
import type { ORTIFile } from 'src/renderer/src/database/ortiParse'
import fs from 'fs'
import { CRC } from './../worker/crc'
import { OsEvent } from '../share/osEvent'
import { OsTraceLOG } from '../log'
import { getTsUs } from '../share/can'
import path from 'path'
/*
|4byte index (MSB) |4byte timestamp (MSB) |1 byte type|2byte type id(MSB)|2byte type status(MSB)|1byte coreID|1byte CRC8|
*/
const DATA_LENGTH = 15
const crc8 = CRC.default('CRC8')!

export default class TraceItem {
  private serialPort?: SerialPort
  private file?: fs.ReadStream
  private leftBuffer: Buffer = Buffer.alloc(0)
  private index?: number
  private lastTimestamp?: number
  private tsOverflow = 0
  private log: OsTraceLOG
  private systemTs: number = 0
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
  }
  getRealTs(ts: number) {
    return ts + this.tsOverflow * 0x1_0000_0000
  }
  dataCallback = (data: Buffer) => {
    const ts = getTsUs() - this.systemTs
    // Append new data to leftover buffer
    this.leftBuffer = Buffer.concat([this.leftBuffer, data])

    // Process complete blocks
    while (this.leftBuffer.length >= DATA_LENGTH) {
      // Extract one block
      const block = this.leftBuffer.subarray(0, DATA_LENGTH)
      this.leftBuffer = this.leftBuffer.subarray(DATA_LENGTH)

      // Parse the block
      const currentIndex32 = block.readUInt32BE(0)
      const timestamp32 = block.readUInt32BE(4)
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

      this.log.osEvent(ts, osEvent)
    }
  }
  async close() {
    return new Promise<void>((resolve) => {
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
