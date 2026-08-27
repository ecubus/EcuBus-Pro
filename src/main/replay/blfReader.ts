import { ReplayCanFrame, ReplayFrame, ReplayLinFrame, ReplayReader } from '.'
import fs from 'fs'
import zlib from 'zlib'
import { Transform, TransformCallback } from 'stream'
import { CAN_ID_TYPE } from '../share/can'
import { LinChecksumType } from '../share/lin'

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
const CAN_MESSAGE2 = 86
const CAN_FD_MESSAGE = 100
const CAN_FD_MESSAGE_64 = 101

// LIN Object Types (per Vector binlog_objects.h)
const LIN_MESSAGE = 11
const LIN_CRC_ERROR = 12
const LIN_DLC_INFO = 13
const LIN_RCV_ERROR = 14
const LIN_SND_ERROR = 15
const LIN_MESSAGE2 = 57

const ZLIB_DEFLATE = 2

const CAN_MSG_EXT = 0x80000000
const REMOTE_FLAG = 0x80
const DIR_FLAG = 0x1
const EDL_FLAG = 0x1
const BRS_FLAG = 0x2
const TIME_TEN_MICS = 0x00000001
const TIME_ONE_NANS = 0x00000002

// CAN_FD_MESSAGE_64 fd_flags bits (different from CAN_FD_MESSAGE)
const FD64_REMOTE = 0x0010
const FD64_FD = 0x1000
const FD64_BRS = 0x2000

// CAN_FD_MESSAGE_64 fixed header size (before data): <BBBBLLLLLLLHBBL> = 40 bytes
const CAN_FD_MSG_64_HEADER_SIZE = 40

const MAX_OBJECT_SIZE = 64 * 1024 * 1024
const MAX_UNCOMPRESSED_SIZE = 64 * 1024 * 1024

function blfPadSize(len: number): number {
  // Vector BLF stores padding bytes equal to the remainder, not the amount needed to align to 4.
  const mod = len % 4
  return mod === 0 ? 0 : mod
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
  const isBrs = (fdFlags & FD64_BRS) !== 0
  const isRemote = (fdFlags & FD64_REMOTE) !== 0
  const dir = direction ? 'OUT' : 'IN'

  const dataLen = Math.min(validBytes, 64, payload.length - CAN_FD_MSG_64_HEADER_SIZE)
  const data =
    dataLen > 0
      ? payload.subarray(CAN_FD_MSG_64_HEADER_SIZE, CAN_FD_MSG_64_HEADER_SIZE + dataLen)
      : Buffer.alloc(0)

  return {
    channel,
    ts: timestampUs,
    id,
    dir: dir as 'IN' | 'OUT',
    msgType: {
      idType: isExtended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
      brs: isBrs,
      canfd: isFd,
      remote: isRemote
    },
    data: Buffer.from(data)
  }
}

/**
 * Parse a LIN_MESSAGE (type 11) object payload into a ReplayLinFrame.
 * Layout per VBLLINMessage:
 *   channel(H:2) + id(B:1) + dlc(B:1) + data[8](8) + FSMId(B:1) + FSMState(B:1) +
 *   headerTime(B:1) + fullTime(B:1) + CRC(H:2) + dir(B:1) + reserved(B:1) = 20 bytes
 */
function parseLinMessage(payload: Buffer, timestampUs: number): ReplayLinFrame | null {
  if (payload.length < 20) return null
  const channel = payload.readUInt16LE(0)
  const frameId = payload.readUInt8(2) & 0x3f
  const dlc = payload.readUInt8(3)
  const dataLen = Math.min(dlc, 8)
  const data = Buffer.from(payload.subarray(4, 4 + dataLen))
  // offset 16: CRC (WORD LE)
  const checksum = payload.readUInt16LE(16) & 0xff
  // offset 18: dir
  const dir = (payload.readUInt8(18) & 0x1) !== 0 ? 'Tx' : 'Rx'

  return {
    ts: timestampUs,
    channel: 100 + channel,
    frameId,
    dir,
    data,
    dlc,
    checksumType: LinChecksumType.ENHANCED,
    checksum
  }
}

/**
 * Parse a LIN_MESSAGE2 (type 57) object payload into a ReplayLinFrame.
 * Nested structure (after VBLObjectHeader):
 *   VBLLINDatabyteTimestampEvent (112 bytes):
 *     VBLLINMessageDescriptor (40):
 *       VBLLINSynchFieldEvent (32):
 *         VBLLINBusEvent (16): SOF(Q:8) + baudrate(D:4) + channel(H:2) + reserved(2)
 *         synchBreakLen(Q:8) + synchDelLen(Q:8)
 *       supplierID(H:2) + messageID(H:2) + NAD(B:1) + ID(B:1) + DLC(B:1) + checksumModel(B:1)
 *     databyteTimestamps[9](Q*9:72)
 *   data[8](8) + CRC(H:2) + dir(B:1) + ...
 */
function parseLinMessage2(payload: Buffer, timestampUs: number): ReplayLinFrame | null {
  if (payload.length < 123) return null
  const channel = payload.readUInt16LE(12)
  const frameId = payload.readUInt8(37) & 0x3f
  const dlc = payload.readUInt8(38)
  const checksumModel = payload.readUInt8(39)
  const dataLen = Math.min(dlc, 8)
  const data = Buffer.from(payload.subarray(112, 112 + dataLen))
  const checksum = payload.readUInt16LE(120) & 0xff
  const dir = (payload.readUInt8(122) & 0x1) !== 0 ? 'Tx' : 'Rx'

  return {
    ts: timestampUs,
    channel: 100 + channel,
    frameId,
    dir,
    data,
    dlc,
    checksumType: checksumModel === 0 ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED,
    checksum
  }
}

/**
 * Parse a LIN error (type 13 DLC_INFO / type 14 RCV_ERROR) payload into a ReplayLinFrame.
 */
function parseLinError(payload: Buffer, timestampUs: number): ReplayLinFrame | null {
  if (payload.length < 4) return null
  const channel = payload.readUInt16LE(0)
  const frameId = payload.readUInt8(2) & 0x3f

  return {
    ts: timestampUs,
    channel: 100 + channel,
    frameId,
    dir: 'Rx',
    data: Buffer.alloc(0),
    dlc: 0,
    checksumType: LinChecksumType.ENHANCED,
    isError: true,
    errorType: 'BLF_LIN_ERROR'
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
    const headerVersion = data.readUInt16LE(offset + 6)
    const objSize = data.readUInt32LE(offset + 8)
    const objType = data.readUInt32LE(offset + 12)

    if (objSize < OBJ_HEADER_BASE_SIZE || objSize > MAX_OBJECT_SIZE) {
      offset += 4
      continue
    }

    if (offset + objSize > data.length) {
      break
    }

    // V1 header is always present when headerVersion >= 1,
    // even if headerSize only reports the base size (16)
    let timestampUs = 0
    let actualHeaderEnd = OBJ_HEADER_BASE_SIZE
    if (
      headerVersion >= 1 &&
      offset + OBJ_HEADER_BASE_SIZE + OBJ_HEADER_V1_SIZE <= offset + objSize
    ) {
      const tsFlags = data.readUInt32LE(offset + OBJ_HEADER_BASE_SIZE)
      const tsRaw = data.readBigUInt64LE(offset + OBJ_HEADER_BASE_SIZE + 8)
      if (tsFlags === TIME_ONE_NANS) {
        timestampUs = Number(tsRaw / 1000n)
      } else {
        // TIME_TEN_MICS or default: 10μs units
        timestampUs = Number(tsRaw) * 10
      }
      actualHeaderEnd = OBJ_HEADER_BASE_SIZE + OBJ_HEADER_V1_SIZE
    }

    const payloadOffset = offset + actualHeaderEnd
    const payloadSize = objSize - actualHeaderEnd
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

  private async applyTimeBackpressure(ts: number): Promise<void> {
    if (this.speedFactor <= 0) return
    if (this.firstFrameTs < 0) {
      this.firstFrameTs = ts
      this.startTime = Date.now()
      return
    }
    const frameOffsetUs = ts - this.firstFrameTs
    const expectedElapsedMs = frameOffsetUs / 1000 / this.speedFactor
    const actualElapsedMs = Date.now() - this.startTime
    const delayMs = expectedElapsedMs - actualElapsedMs
    if (delayMs > 1) {
      await sleep(delayMs)
    }
  }

  private async pushFrame(result: ReplayFrame): Promise<void> {
    const ts = result.type === 'can' ? result.frame.ts : result.frame.ts
    await this.applyTimeBackpressure(ts)
    this.push(result)
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
      // Parse measurementStartTime SYSTEMTIME at offset 0x28
      if (this.buffer.length >= 0x38) {
        const year = this.buffer.readUInt16LE(0x28)
        const month = this.buffer.readUInt16LE(0x2a)
        const day = this.buffer.readUInt16LE(0x2e)
        const hour = this.buffer.readUInt16LE(0x30)
        const minute = this.buffer.readUInt16LE(0x32)
        const second = this.buffer.readUInt16LE(0x34)
        const ms = this.buffer.readUInt16LE(0x36)
        this.measurementStartTimeMs = Date.UTC(year, month - 1, day, hour, minute, second, ms)
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
    const headerVersion = objData.readUInt16LE(6)

    let timestampUs = 0
    let payloadStart = OBJ_HEADER_BASE_SIZE

    if (headerVersion >= 1 && objData.length >= OBJ_HEADER_BASE_SIZE + OBJ_HEADER_V1_SIZE) {
      const tsFlags = objData.readUInt32LE(OBJ_HEADER_BASE_SIZE)
      const tsRaw = objData.readBigUInt64LE(OBJ_HEADER_BASE_SIZE + 8)
      if (tsFlags === TIME_ONE_NANS) {
        timestampUs = Number(tsRaw / 1000n)
      } else {
        timestampUs = Number(tsRaw) * 10
      }
      payloadStart = OBJ_HEADER_BASE_SIZE + OBJ_HEADER_V1_SIZE
    }

    const payload = objData.subarray(payloadStart)
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

  private parseFrame(objType: number, payload: Buffer, timestampUs: number): ReplayFrame | null {
    switch (objType) {
      case CAN_MESSAGE:
      case CAN_MESSAGE2: {
        const frame = parseCanMessage(payload, timestampUs)
        return frame ? { type: 'can', frame } : null
      }
      case CAN_FD_MESSAGE: {
        const frame = parseCanFdMessage(payload, timestampUs)
        return frame ? { type: 'can', frame } : null
      }
      case CAN_FD_MESSAGE_64: {
        const frame = parseCanFdMessage64(payload, timestampUs)
        return frame ? { type: 'can', frame } : null
      }
      case CAN_ERROR_EXT: {
        const frame = parseCanErrorExt(payload, timestampUs)
        return frame ? { type: 'can', frame } : null
      }
      case LIN_MESSAGE:
      case LIN_SND_ERROR:
      case LIN_CRC_ERROR: {
        const frame = parseLinMessage(payload, timestampUs)
        if (frame && (objType === LIN_SND_ERROR || objType === LIN_CRC_ERROR)) {
          frame.isError = true
          frame.errorType = objType === LIN_SND_ERROR ? 'SndError' : 'CRCError'
        }
        return frame ? { type: 'lin', frame } : null
      }
      case LIN_MESSAGE2: {
        const frame = parseLinMessage2(payload, timestampUs)
        return frame ? { type: 'lin', frame } : null
      }
      case LIN_DLC_INFO:
      case LIN_RCV_ERROR: {
        const frame = parseLinError(payload, timestampUs)
        return frame ? { type: 'lin', frame } : null
      }
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
  private frameIterator: AsyncIterator<ReplayFrame> | null = null
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

  async readFrame(): Promise<ReplayFrame | null> {
    if (this._closed || !this.frameIterator) return null

    try {
      const result = await this.frameIterator.next()
      if (result.done) {
        if (this.transform) {
          this.transform.bytesRead = this.fileSize
        }
        return null
      }
      return result.value as ReplayFrame
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
