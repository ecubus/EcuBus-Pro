import { ReplayCanFrame, ReplayReader } from '.'
import fs from 'fs'
import zlib from 'zlib'
import { Transform, TransformCallback } from 'stream'
import { CAN_ID_TYPE } from '../share/can'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---- BLF Constants ----
const FILE_HEADER_SIZE = 144
const OBJ_HEADER_BASE_SIZE = 16
const OBJ_HEADER_V1_SIZE = 16
const LOG_CONTAINER_HEADER_SIZE = 16

const CAN_MESSAGE = 1
const LOG_CONTAINER = 10
const CAN_ERROR_EXT = 73
const CAN_FD_MESSAGE = 100

const ZLIB_DEFLATE = 2

const CAN_MSG_EXT = 0x80000000
const REMOTE_FLAG = 0x80
const DIR_FLAG = 0x1
const EDL_FLAG = 0x1
const BRS_FLAG = 0x2
const TIME_ONE_NANS = 0x00000002

const MAX_OBJECT_SIZE = 64 * 1024 * 1024
const MAX_UNCOMPRESSED_SIZE = 64 * 1024 * 1024

function blfPadSize(len: number): number {
  const mod = len % 4
  return mod === 0 ? 0 : 4 - mod
}

/**
 * Parse a CAN_MESSAGE (type 1) object payload into a ReplayCanFrame.
 */
function parseCanMessage(payload: Buffer, timestampUs: number): ReplayCanFrame | null {
  if (payload.length < 8) return null
  const channel = payload.readUInt16LE(0)
  const flags = payload.readUInt8(2)
  const dlc = payload.readUInt8(3)
  const arbId = payload.readUInt32LE(4)

  const isExtended = (arbId & CAN_MSG_EXT) !== 0
  const id = arbId & ~CAN_MSG_EXT
  const isRemote = (flags & REMOTE_FLAG) !== 0
  const dir = (flags & DIR_FLAG) !== 0 ? 'OUT' : 'IN'
  const dataLen = Math.min(dlc, 8, payload.length - 8)
  const data = payload.subarray(8, 8 + dataLen)

  return {
    channel,
    ts: timestampUs,
    id,
    dir: dir as 'IN' | 'OUT',
    msgType: {
      idType: isExtended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
      brs: false,
      canfd: false,
      remote: isRemote
    },
    data: Buffer.from(data)
  }
}

/**
 * Parse a CAN_FD_MESSAGE (type 100) object payload into a ReplayCanFrame.
 */
function parseCanFdMessage(payload: Buffer, timestampUs: number): ReplayCanFrame | null {
  if (payload.length < 24) return null
  const channel = payload.readUInt16LE(0)
  const flags = payload.readUInt8(2)
  const arbId = payload.readUInt32LE(4)
  const fdFlags = payload.readUInt8(13)
  const validBytes = payload.readUInt8(14)

  const isExtended = (arbId & CAN_MSG_EXT) !== 0
  const id = arbId & ~CAN_MSG_EXT
  const isRemote = (flags & REMOTE_FLAG) !== 0
  const dir = (flags & DIR_FLAG) !== 0 ? 'OUT' : 'IN'
  const isBrs = (fdFlags & BRS_FLAG) !== 0

  const dataOffset = 20
  const dataLen = Math.min(validBytes, 64, payload.length - dataOffset)
  const data = dataLen > 0 ? payload.subarray(dataOffset, dataOffset + dataLen) : Buffer.alloc(0)

  return {
    channel,
    ts: timestampUs,
    id,
    dir: dir as 'IN' | 'OUT',
    msgType: {
      idType: isExtended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
      brs: isBrs,
      canfd: true,
      remote: isRemote
    },
    data: Buffer.from(data)
  }
}

/**
 * Parse a CAN_ERROR_EXT (type 73) object payload into a ReplayCanFrame.
 */
function parseCanErrorExt(payload: Buffer, timestampUs: number): ReplayCanFrame | null {
  if (payload.length < 4) return null
  const channel = payload.readUInt16LE(0)

  return {
    channel,
    ts: timestampUs,
    id: 0,
    dir: 'IN',
    msgType: {
      idType: CAN_ID_TYPE.STANDARD,
      brs: false,
      canfd: false,
      remote: false
    },
    data: Buffer.alloc(0),
    isError: true
  }
}

/**
 * Extract inner LOBJ objects from (decompressed) container data.
 * Handles cross-container reassembly via the carryover buffer.
 */
function* extractInnerObjects(
  data: Buffer
): Generator<{ objType: number; timestampUs: number; payload: Buffer }> {
  let offset = 0

  while (offset + OBJ_HEADER_BASE_SIZE <= data.length) {
    const sig = data.toString('ascii', offset, offset + 4)
    if (sig !== 'LOBJ') {
      offset++
      continue
    }

    const headerSize = data.readUInt16LE(offset + 4)
    const objSize = data.readUInt32LE(offset + 8)
    const objType = data.readUInt32LE(offset + 12)

    if (objSize < headerSize || objSize > MAX_OBJECT_SIZE) {
      offset += 4
      continue
    }

    if (offset + objSize > data.length) {
      break
    }

    let timestampUs = 0
    if (headerSize >= OBJ_HEADER_BASE_SIZE + OBJ_HEADER_V1_SIZE) {
      const tsFlags = data.readUInt32LE(offset + OBJ_HEADER_BASE_SIZE)
      const tsRaw = data.readBigUInt64LE(offset + OBJ_HEADER_BASE_SIZE + 8)
      if (tsFlags === TIME_ONE_NANS) {
        timestampUs = Number(tsRaw / 1000n)
      } else {
        // Default: assume 10μs units
        timestampUs = Number(tsRaw) * 10
      }
    }

    const payloadOffset = offset + headerSize
    const payloadSize = objSize - headerSize
    const payload = data.subarray(payloadOffset, payloadOffset + payloadSize)

    yield { objType, timestampUs, payload }

    const padded = objSize + blfPadSize(objSize)
    offset += padded
  }
}

/**
 * Transform stream: binary BLF file chunks -> ReplayCanFrame objects.
 * Handles LOG_CONTAINER decompression and cross-chunk/cross-container reassembly.
 */
export class BlfTransform extends Transform {
  private buffer = Buffer.alloc(0)
  private innerBuffer = Buffer.alloc(0)
  private speedFactor: number
  private startTime = 0
  private firstFrameTs = -1
  /** File-level bytes consumed (for progress tracking) */
  bytesRead = 0
  private headerParsed = false

  constructor(speedFactor: number = 1.0) {
    super({
      readableObjectMode: true,
      writableObjectMode: false
    })
    this.speedFactor = speedFactor
    this.startTime = Date.now()
  }

  setSpeedFactor(factor: number): void {
    if (this.firstFrameTs >= 0 && this.speedFactor > 0) {
      const now = Date.now()
      const elapsedReal = now - this.startTime
      const elapsedFileTime = elapsedReal * this.speedFactor
      if (factor > 0) {
        this.startTime = now - elapsedFileTime / factor
      }
    }
    this.speedFactor = factor
  }

  addPausedDuration(ms: number): void {
    this.startTime += ms
  }

  private async applyTimeBackpressure(frame: ReplayCanFrame): Promise<void> {
    if (this.speedFactor <= 0) return
    if (this.firstFrameTs < 0) {
      this.firstFrameTs = frame.ts
      this.startTime = Date.now()
      return
    }
    const frameOffsetUs = frame.ts - this.firstFrameTs
    const expectedElapsedMs = frameOffsetUs / 1000 / this.speedFactor
    const actualElapsedMs = Date.now() - this.startTime
    const delayMs = expectedElapsedMs - actualElapsedMs
    if (delayMs > 1) {
      await sleep(delayMs)
    }
  }

  private async pushFrame(frame: ReplayCanFrame): Promise<void> {
    await this.applyTimeBackpressure(frame)
    this.push(frame)
  }

  _transform(chunk: Buffer, _encoding: string, callback: TransformCallback): void {
    this.processChunk(chunk)
      .then(() => callback())
      .catch((err) => callback(err))
  }

  _flush(callback: TransformCallback): void {
    this.processChunk(Buffer.alloc(0))
      .then(() => callback())
      .catch((err) => callback(err))
  }

  private async processChunk(chunk: Buffer): Promise<void> {
    this.buffer = Buffer.concat([this.buffer, chunk])

    if (!this.headerParsed) {
      if (this.buffer.length < FILE_HEADER_SIZE) return
      const sig = this.buffer.toString('ascii', 0, 4)
      if (sig !== 'LOGG') {
        throw new Error('Not a valid BLF file: missing LOGG signature')
      }
      this.buffer = this.buffer.subarray(FILE_HEADER_SIZE)
      this.bytesRead = FILE_HEADER_SIZE
      this.headerParsed = true
    }

    while (this.buffer.length >= OBJ_HEADER_BASE_SIZE) {
      const sig = this.buffer.toString('ascii', 0, 4)
      if (sig !== 'LOBJ') {
        this.buffer = this.buffer.subarray(1)
        this.bytesRead++
        continue
      }

      const objSize = this.buffer.readUInt32LE(8)
      if (objSize < OBJ_HEADER_BASE_SIZE || objSize > MAX_OBJECT_SIZE) {
        this.buffer = this.buffer.subarray(4)
        this.bytesRead += 4
        continue
      }

      const padded = objSize + blfPadSize(objSize)
      if (this.buffer.length < padded) break

      const objType = this.buffer.readUInt32LE(12)
      const objData = this.buffer.subarray(0, objSize)
      this.buffer = this.buffer.subarray(padded)
      this.bytesRead += padded

      if (objType === LOG_CONTAINER) {
        await this.processContainer(objData)
      } else {
        await this.processTopLevelObject(objType, objData)
      }
    }
  }

  private async processContainer(objData: Buffer): Promise<void> {
    const headerSize = objData.readUInt16LE(4)
    if (headerSize < OBJ_HEADER_BASE_SIZE) return

    const containerHeaderOffset = headerSize
    if (objData.length < containerHeaderOffset + LOG_CONTAINER_HEADER_SIZE) return

    const compressionMethod = objData.readUInt16LE(containerHeaderOffset)
    const uncompressedSize = objData.readUInt32LE(containerHeaderOffset + 8)

    if (uncompressedSize > MAX_UNCOMPRESSED_SIZE) return

    const payloadOffset = containerHeaderOffset + LOG_CONTAINER_HEADER_SIZE
    const compressedPayload = objData.subarray(payloadOffset)

    let decompressed: Buffer
    if (compressionMethod === ZLIB_DEFLATE) {
      try {
        decompressed = zlib.inflateSync(compressedPayload)
      } catch {
        return
      }
    } else {
      decompressed = compressedPayload
    }

    // Prepend any leftover inner buffer from previous container
    const combined =
      this.innerBuffer.length > 0 ? Buffer.concat([this.innerBuffer, decompressed]) : decompressed
    this.innerBuffer = Buffer.alloc(0)

    await this.processInnerObjects(combined)
  }

  private async processTopLevelObject(objType: number, objData: Buffer): Promise<void> {
    const headerSize = objData.readUInt16LE(4)
    if (headerSize < OBJ_HEADER_BASE_SIZE + OBJ_HEADER_V1_SIZE) return

    let timestampUs = 0
    const tsFlags = objData.readUInt32LE(OBJ_HEADER_BASE_SIZE)
    const tsRaw = objData.readBigUInt64LE(OBJ_HEADER_BASE_SIZE + 8)
    if (tsFlags === TIME_ONE_NANS) {
      timestampUs = Number(tsRaw / 1000n)
    } else {
      timestampUs = Number(tsRaw) * 10
    }

    const payload = objData.subarray(headerSize)
    const frame = this.parseFrame(objType, payload, timestampUs)
    if (frame) {
      await this.pushFrame(frame)
    }
  }

  private async processInnerObjects(data: Buffer): Promise<void> {
    let lastConsumed = 0
    let offset = 0

    for (const obj of extractInnerObjects(data)) {
      const frame = this.parseFrame(obj.objType, obj.payload, obj.timestampUs)
      if (frame) {
        await this.pushFrame(frame)
      }
      // Track how far we consumed
      offset = data.indexOf('LOBJ', offset + 1)
      lastConsumed = offset >= 0 ? offset : data.length
    }

    // Save unconsumed tail for cross-container reassembly
    // Re-scan to find the actual end position
    let consumed = 0
    let pos = 0
    while (pos + OBJ_HEADER_BASE_SIZE <= data.length) {
      const sig = data.toString('ascii', pos, pos + 4)
      if (sig !== 'LOBJ') {
        pos++
        continue
      }
      const objSize = data.readUInt32LE(pos + 8)
      if (objSize < OBJ_HEADER_BASE_SIZE || objSize > MAX_OBJECT_SIZE) {
        pos += 4
        continue
      }
      if (pos + objSize > data.length) {
        break
      }
      const padded = objSize + blfPadSize(objSize)
      pos += padded
      consumed = pos
    }

    if (consumed < data.length) {
      this.innerBuffer = Buffer.from(data.subarray(consumed))
    }
  }

  private parseFrame(objType: number, payload: Buffer, timestampUs: number): ReplayCanFrame | null {
    switch (objType) {
      case CAN_MESSAGE:
        return parseCanMessage(payload, timestampUs)
      case CAN_FD_MESSAGE:
        return parseCanFdMessage(payload, timestampUs)
      case CAN_ERROR_EXT:
        return parseCanErrorExt(payload, timestampUs)
      default:
        return null
    }
  }
}

/**
 * BLF File Reader - stream-based with time-based backpressure.
 */
export class BlfReader implements ReplayReader {
  private filePath: string
  private fileSize = 0
  private _closed = false
  private readStream: fs.ReadStream | null = null
  private transform: BlfTransform | null = null
  private frameIterator: AsyncIterator<ReplayCanFrame> | null = null
  private _paused = false
  private pauseStartTime = 0

  constructor(filePath: string, speedFactor: number = 1.0) {
    this.filePath = filePath
    this.transform = new BlfTransform(speedFactor)
  }

  init(): { total: number } {
    const stats = fs.statSync(this.filePath)
    this.fileSize = stats.size

    this.readStream = fs.createReadStream(this.filePath, {
      highWaterMark: 64 * 1024
    })
    this.readStream.pipe(this.transform!, { end: true })
    this.frameIterator = this.transform![Symbol.asyncIterator]()
    return { total: this.fileSize }
  }

  setSpeedFactor(factor: number): void {
    this.transform?.setSpeedFactor(factor)
  }

  pause(): void {
    if (!this._paused) {
      this._paused = true
      this.pauseStartTime = Date.now()
      this.transform?.pause()
    }
  }

  resume(): void {
    if (this._paused) {
      this._paused = false
      this.transform?.addPausedDuration(Date.now() - this.pauseStartTime)
      this.transform?.resume()
    }
  }

  async readFrame(): Promise<ReplayCanFrame | null> {
    if (this._closed || !this.frameIterator) return null

    try {
      const result = await this.frameIterator.next()
      if (result.done) {
        if (this.transform) {
          this.transform.bytesRead = this.fileSize
        }
        return null
      }
      return result.value as ReplayCanFrame
    } catch {
      return null
    }
  }

  getProgress(): { current: number; total: number; percent: number } {
    const total = this.fileSize
    const current = this.transform?.bytesRead ?? 0
    const percent = total > 0 ? (current / total) * 100 : 0
    return {
      current,
      total,
      percent: Math.min(100, percent)
    }
  }

  close(): void {
    this._closed = true
    this.readStream?.destroy()
    this.transform?.destroy()
    this.readStream = null
    this.transform = null
    this.frameIterator = null
  }
}
