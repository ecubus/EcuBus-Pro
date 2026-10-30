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
const CAN_ERROR = 2
const LOG_CONTAINER = 10
const CAN_ERROR_EXT = 73
const CAN_MESSAGE2 = 86
const CAN_FD_MESSAGE = 100
const CAN_FD_MESSAGE_64 = 101
const CAN_FD_ERROR_64 = 104

const NO_COMPRESSION = 0
const ZLIB_DEFLATE = 2

const CAN_MSG_EXT = 0x80000000
const REMOTE_FLAG = 0x80
const DIR_FLAG = 0x1
const EDL_FLAG = 0x1
const BRS_FLAG = 0x2
const ESI_FLAG = 0x4
const TIME_ONE_NANS = 0x00000002

// CAN_FD_MESSAGE_64 fd_flags bits (different from CAN_FD_MESSAGE)
const FD64_REMOTE = 0x0010
const FD64_FD = 0x1000
const FD64_BRS = 0x2000
const FD64_ESI = 0x4000

// CAN_FD_MESSAGE_64 fixed header size (before data): <BBBBLLLLLLLHBBL> = 40 bytes
const CAN_FD_MSG_64_HEADER_SIZE = 40

const MAX_OBJECT_SIZE = 64 * 1024 * 1024
const MAX_UNCOMPRESSED_SIZE = 64 * 1024 * 1024

/**
 * Padding after an object is not specified. Existing files use `objSize % 4` bytes,
 * so the next `LOBJ` is searched within this many bytes after the object end.
 */
const MAX_OBJECT_PADDING = 7

/**
 * Locate the next object signature at `offset` or within the padding after it.
 * @returns the signature offset, or -1 when more data is needed to decide
 * @throws when no signature follows the padding
 */
function findObjectStart(data: Buffer, offset: number): number {
  for (let pos = offset; pos <= offset + MAX_OBJECT_PADDING; pos++) {
    if (pos + 4 > data.length) return -1
    if (data.toString('ascii', pos, pos + 4) === 'LOBJ') return pos
  }
  throw new Error(`Corrupted BLF: no object signature at offset ${offset}`)
}

function isZeroPadding(data: Buffer): boolean {
  return data.length <= MAX_OBJECT_PADDING && data.every((b) => b === 0)
}

/**
 * Read the object header at `offset`.
 * The payload starts at `mHeaderSize`, which covers VBLObjectHeader (32 bytes) and
 * VBLObjectHeader2 (40 bytes). Both keep the timestamp at the same offset.
 */
function readObjectHeader(
  data: Buffer,
  offset: number
): { objSize: number; objType: number; timestampUs: number; payloadOffset: number } {
  const headerSize = data.readUInt16LE(offset + 4)
  const headerVersion = data.readUInt16LE(offset + 6)
  const objSize = data.readUInt32LE(offset + 8)
  const objType = data.readUInt32LE(offset + 12)

  const fullHeader = OBJ_HEADER_BASE_SIZE + OBJ_HEADER_V1_SIZE
  // Some writers report only the base size although a V1 header follows
  const payloadStart =
    headerSize >= fullHeader ? headerSize : headerVersion >= 1 ? fullHeader : OBJ_HEADER_BASE_SIZE
  if (payloadStart > objSize) {
    throw new Error(`Corrupted BLF: object header larger than object at offset ${offset}`)
  }

  let timestampUs = 0
  if (payloadStart >= fullHeader) {
    const tsFlags = data.readUInt32LE(offset + OBJ_HEADER_BASE_SIZE)
    const tsRaw = data.readBigUInt64LE(offset + OBJ_HEADER_BASE_SIZE + 8)
    if (tsFlags === TIME_ONE_NANS) {
      timestampUs = Number(tsRaw / 1000n)
    } else {
      // TIME_TEN_MICS or default: 10μs units
      timestampUs = Number(tsRaw) * 10
    }
  }
  return { objSize, objType, timestampUs, payloadOffset: offset + payloadStart }
}

/**
 * Parse a CAN_MESSAGE (type 1) or CAN_MESSAGE2 (type 86) object payload.
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
  const dataLen = isRemote ? 0 : Math.min(dlc, 8, payload.length - 8)
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
    dlc,
    data: Buffer.from(data)
  }
}

/**
 * Parse a CAN_FD_MESSAGE (type 100) object payload into a ReplayCanFrame.
 */
function parseCanFdMessage(payload: Buffer, timestampUs: number): ReplayCanFrame | null {
  if (payload.length < 20) return null
  const channel = payload.readUInt16LE(0)
  const flags = payload.readUInt8(2)
  const dlc = payload.readUInt8(3)
  const arbId = payload.readUInt32LE(4)
  const fdFlags = payload.readUInt8(13)
  const validBytes = payload.readUInt8(14)

  const isExtended = (arbId & CAN_MSG_EXT) !== 0
  const id = arbId & ~CAN_MSG_EXT
  const isRemote = (flags & REMOTE_FLAG) !== 0
  const dir = (flags & DIR_FLAG) !== 0 ? 'OUT' : 'IN'
  const isFd = (fdFlags & EDL_FLAG) !== 0

  const dataOffset = 20
  const dataLen = isRemote ? 0 : Math.min(validBytes, 64, payload.length - dataOffset)
  const data = payload.subarray(dataOffset, dataOffset + dataLen)

  return {
    channel,
    ts: timestampUs,
    id,
    dir: dir as 'IN' | 'OUT',
    msgType: {
      idType: isExtended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
      brs: isFd && (fdFlags & BRS_FLAG) !== 0,
      canfd: isFd,
      remote: isRemote,
      esi: isFd && (fdFlags & ESI_FLAG) !== 0
    },
    dlc,
    data: Buffer.from(data)
  }
}

/**
 * Parse CAN_ERROR (type 2), CAN_ERROR_EXT (type 73) and CAN_FD_ERROR_64 (type 104)
 * into an error event. Type 104 stores the channel in one byte.
 */
function parseCanError(
  objType: number,
  payload: Buffer,
  timestampUs: number
): ReplayCanFrame | null {
  if (payload.length < 2) return null
  const channel = objType === CAN_FD_ERROR_64 ? payload.readUInt8(0) : payload.readUInt16LE(0)

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
 * Parse a CAN_FD_MESSAGE_64 (type 101) object payload into a ReplayCanFrame.
 * Layout: channel(B) + dlc(B) + validBytes(B) + txCount(B) + arbId(L) +
 *   frameLengthNs(L) + fdFlags(L) + btrCfgArb(L) + btrCfgData(L) +
 *   timeOffsetBrsNs(L) + timeOffsetCrcDelNs(L) + bitCount(H) + direction(b) +
 *   extDataOffset(b) + crc(l) = 40 bytes, then data[validBytes]
 */
function parseCanFdMessage64(payload: Buffer, timestampUs: number): ReplayCanFrame | null {
  if (payload.length < CAN_FD_MSG_64_HEADER_SIZE) return null

  const channel = payload.readUInt8(0)
  const dlc = payload.readUInt8(1)
  const validBytes = payload.readUInt8(2)
  const arbId = payload.readUInt32LE(4)
  const fdFlags = payload.readUInt32LE(12)
  const direction = payload.readInt8(34)

  const isExtended = (arbId & CAN_MSG_EXT) !== 0
  const id = arbId & ~CAN_MSG_EXT
  const isFd = (fdFlags & FD64_FD) !== 0
  const isRemote = (fdFlags & FD64_REMOTE) !== 0
  const dir = direction ? 'OUT' : 'IN'

  const dataLen = isRemote
    ? 0
    : Math.min(validBytes, 64, payload.length - CAN_FD_MSG_64_HEADER_SIZE)
  const data = payload.subarray(CAN_FD_MSG_64_HEADER_SIZE, CAN_FD_MSG_64_HEADER_SIZE + dataLen)

  return {
    channel,
    ts: timestampUs,
    id,
    dir: dir as 'IN' | 'OUT',
    msgType: {
      idType: isExtended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
      brs: isFd && (fdFlags & FD64_BRS) !== 0,
      canfd: isFd,
      remote: isRemote,
      esi: isFd && (fdFlags & FD64_ESI) !== 0
    },
    dlc,
    data: Buffer.from(data)
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
  /** Bytes after the file header consumed by complete objects */
  private consumed = 0
  private headerParsed = false
  /** Measurement start time from file header (ms since epoch, UTC) */
  measurementStartTimeMs = 0

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
    this.processChunk(Buffer.alloc(0), true)
      .then(() => callback())
      .catch((err) => callback(err))
  }

  private async processChunk(chunk: Buffer, final = false): Promise<void> {
    this.buffer = Buffer.concat([this.buffer, chunk])

    if (!this.headerParsed) {
      if (this.buffer.length < FILE_HEADER_SIZE) {
        if (final) throw new Error('Not a valid BLF file: truncated file header')
        return
      }
      const sig = this.buffer.toString('ascii', 0, 4)
      if (sig !== 'LOGG') {
        throw new Error('Not a valid BLF file: missing LOGG signature')
      }
      // Parse measurementStartTime SYSTEMTIME at offset 0x28
      const year = this.buffer.readUInt16LE(0x28)
      const month = this.buffer.readUInt16LE(0x2a)
      const day = this.buffer.readUInt16LE(0x2e)
      const hour = this.buffer.readUInt16LE(0x30)
      const minute = this.buffer.readUInt16LE(0x32)
      const second = this.buffer.readUInt16LE(0x34)
      const ms = this.buffer.readUInt16LE(0x36)
      this.measurementStartTimeMs = new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second,
        ms
      ).getTime()
      this.buffer = this.buffer.subarray(FILE_HEADER_SIZE)
      this.bytesRead = FILE_HEADER_SIZE
      this.headerParsed = true
    }

    let offset = 0
    while (offset < this.buffer.length) {
      const start = findObjectStart(this.buffer, offset)
      if (start < 0 || start + OBJ_HEADER_BASE_SIZE > this.buffer.length) break

      const objSize = this.buffer.readUInt32LE(start + 8)
      if (objSize < OBJ_HEADER_BASE_SIZE || objSize > MAX_OBJECT_SIZE) {
        throw new Error(`Corrupted BLF: invalid object size ${objSize}`)
      }
      if (start + objSize > this.buffer.length) break

      const objType = this.buffer.readUInt32LE(start + 12)
      const objData = this.buffer.subarray(start, start + objSize)
      offset = start + objSize
      this.bytesRead = FILE_HEADER_SIZE + this.consumed + offset

      if (objType === LOG_CONTAINER) {
        await this.processContainer(objData)
      } else {
        await this.processObject(objData, 0)
      }
    }
    this.consumed += offset
    this.buffer = this.buffer.subarray(offset)

    if (final) {
      if (!isZeroPadding(this.buffer)) {
        throw new Error('Corrupted BLF: file ends inside an object')
      }
      if (!isZeroPadding(this.innerBuffer)) {
        throw new Error('Corrupted BLF: last container ends inside an object')
      }
    }
  }

  private async processContainer(objData: Buffer): Promise<void> {
    const headerSize = objData.readUInt16LE(4)
    if (headerSize < OBJ_HEADER_BASE_SIZE) {
      throw new Error(`Corrupted BLF: invalid container header size ${headerSize}`)
    }

    const containerHeaderOffset = headerSize
    if (objData.length < containerHeaderOffset + LOG_CONTAINER_HEADER_SIZE) {
      throw new Error('Corrupted BLF: truncated container header')
    }

    const compressionMethod = objData.readUInt16LE(containerHeaderOffset)
    const uncompressedSize = objData.readUInt32LE(containerHeaderOffset + 8)

    if (uncompressedSize > MAX_UNCOMPRESSED_SIZE) {
      throw new Error(`BLF container too large: ${uncompressedSize} bytes`)
    }

    const payloadOffset = containerHeaderOffset + LOG_CONTAINER_HEADER_SIZE
    const compressedPayload = objData.subarray(payloadOffset)

    let decompressed: Buffer
    if (compressionMethod === ZLIB_DEFLATE) {
      try {
        decompressed = zlib.inflateSync(compressedPayload)
      } catch (err: any) {
        throw new Error(`Corrupted BLF: container decompression failed: ${err.message}`)
      }
    } else if (compressionMethod === NO_COMPRESSION) {
      decompressed = compressedPayload
    } else {
      throw new Error(`Unsupported BLF compression method ${compressionMethod}`)
    }

    // Prepend any leftover inner buffer from previous container
    const combined =
      this.innerBuffer.length > 0 ? Buffer.concat([this.innerBuffer, decompressed]) : decompressed
    this.innerBuffer = Buffer.alloc(0)

    await this.processInnerObjects(combined)
  }

  private async processObject(data: Buffer, offset: number): Promise<void> {
    const header = readObjectHeader(data, offset)
    const payload = data.subarray(header.payloadOffset, offset + header.objSize)
    const frame = this.parseFrame(header.objType, payload, header.timestampUs)
    if (frame) {
      await this.pushFrame(frame)
    }
  }

  /** Parse objects inside container data, keeping an incomplete tail for the next container. */
  private async processInnerObjects(data: Buffer): Promise<void> {
    let offset = 0
    while (offset < data.length) {
      const start = findObjectStart(data, offset)
      if (start < 0 || start + OBJ_HEADER_BASE_SIZE > data.length) break

      const objSize = data.readUInt32LE(start + 8)
      if (objSize < OBJ_HEADER_BASE_SIZE || objSize > MAX_OBJECT_SIZE) {
        throw new Error(`Corrupted BLF: invalid object size ${objSize}`)
      }
      if (start + objSize > data.length) break

      await this.processObject(data, start)
      offset = start + objSize
    }

    if (offset < data.length) {
      this.innerBuffer = Buffer.from(data.subarray(offset))
    }
  }

  private parseFrame(objType: number, payload: Buffer, timestampUs: number): ReplayCanFrame | null {
    switch (objType) {
      case CAN_MESSAGE:
      case CAN_MESSAGE2:
        return parseCanMessage(payload, timestampUs)
      case CAN_FD_MESSAGE:
        return parseCanFdMessage(payload, timestampUs)
      case CAN_FD_MESSAGE_64:
        return parseCanFdMessage64(payload, timestampUs)
      case CAN_ERROR:
      case CAN_ERROR_EXT:
      case CAN_FD_ERROR_64:
        return parseCanError(objType, payload, timestampUs)
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

  get measurementStartTimeMs(): number {
    return this.transform?.measurementStartTimeMs ?? 0
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

    let result: IteratorResult<ReplayCanFrame>
    try {
      result = await this.frameIterator.next()
    } catch (err) {
      // Closing the reader destroys the stream while a read is pending
      if (this._closed) return null
      throw err
    }
    if (result.done) {
      if (this.transform) {
        this.transform.bytesRead = this.fileSize
      }
      return null
    }
    return result.value as ReplayCanFrame
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
