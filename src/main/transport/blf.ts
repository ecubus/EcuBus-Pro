import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import dayjs from 'dayjs'
import Transport from 'winston-transport'
import { CanMessage } from 'nodeCan/can'

// ---- BLF constants ----
const FILE_HEADER_SIZE = 144
const OBJ_HEADER_BASE_SIZE = 16
const OBJ_HEADER_V1_SIZE = 16
const LOG_CONTAINER_HEADER_SIZE = 16
const MAX_CONTAINER_SIZE_DEFAULT = 128 * 1024
const APPLICATION_ID = 5

const CAN_MESSAGE = 1
const LOG_CONTAINER = 10
const CAN_ERROR_EXT = 73
const CAN_MESSAGE2 = 86
const GLOBAL_MARKER = 96
const CAN_FD_MESSAGE = 100

const NO_COMPRESSION = 0
const ZLIB_DEFLATE = 2

const CAN_MSG_EXT = 0x80000000
const REMOTE_FLAG = 0x80
const DIR = 0x1
const EDL = 0x1
const BRS = 0x2
const ESI = 0x4
const TIME_ONE_NANS = 0x00000002

// DLC helpers
function len2dlc(len: number): number {
  if (len <= 8) return len
  if (len <= 12) return 9
  if (len <= 16) return 10
  if (len <= 20) return 11
  if (len <= 24) return 12
  if (len <= 32) return 13
  if (len <= 48) return 14
  return 15
}

type SystemTimeParts = [number, number, number, number, number, number, number, number]
const EMPTY_SYSTEM_TIME: SystemTimeParts = [0, 0, 0, 0, 0, 0, 0, 0]

function toSystemTimeParts(tsNs?: bigint): SystemTimeParts {
  if (!tsNs) {
    return EMPTY_SYSTEM_TIME
  }
  const ms = Number(tsNs / 1_000_000n)
  const dt = new Date(ms)
  return [
    dt.getUTCFullYear(),
    dt.getUTCMonth() + 1,
    dt.getUTCDay(),
    dt.getUTCDate(),
    dt.getUTCHours(),
    dt.getUTCMinutes(),
    dt.getUTCSeconds(),
    dt.getUTCMilliseconds()
  ]
}

function writeSystemTime(buf: Buffer, offset: number, tsNs?: bigint) {
  const parts = toSystemTimeParts(tsNs)
  for (let i = 0; i < 8; i += 1) {
    buf.writeUInt16LE(parts[i], offset + i * 2)
  }
}

function padData(len: number): number {
  const mod = len % 4
  return mod === 0 ? 0 : mod
}

function clampLen(len: number, max: number): number {
  return Math.max(0, Math.min(len, max))
}

class BlfWriter {
  private fd: number
  private bufferParts: Buffer[] = []
  private bufferSize = 0
  private objectCount = 0
  private uncompressedSize: bigint = BigInt(FILE_HEADER_SIZE)
  private startTimeNs?: bigint
  private stopTimeNs?: bigint
  private firstMsgTsUs?: number
  private closed = false
  private maxContainerSize: number
  private compressionLevel: number
  private position = 0

  constructor(filePath: string, opts?: { compressionLevel?: number; maxContainerSize?: number }) {
    this.compressionLevel = opts?.compressionLevel ?? -1
    this.maxContainerSize = opts?.maxContainerSize ?? MAX_CONTAINER_SIZE_DEFAULT
    this.fd = fs.openSync(filePath, 'w')

    const header = this.buildHeader(
      BigInt(FILE_HEADER_SIZE),
      this.uncompressedSize,
      this.objectCount,
      undefined,
      undefined
    )
    fs.writeSync(this.fd, header, 0, header.length, 0)
    this.position = header.length
  }

  private buildHeader(
    fileSize: bigint,
    uncompressedSize: bigint,
    objectCount: number,
    startTimeNs?: bigint,
    stopTimeNs?: bigint
  ): Buffer {
    const header = Buffer.alloc(FILE_HEADER_SIZE)
    header.write('LOGG', 0, 'ascii')
    header.writeUInt32LE(FILE_HEADER_SIZE, 4) // header size
    header.writeUInt8(APPLICATION_ID, 8) // application id
    header.writeUInt8(0, 9) // app major
    header.writeUInt8(0, 10) // app minor
    header.writeUInt8(0, 11) // app build
    header.writeUInt8(2, 12) // bin log major
    header.writeUInt8(6, 13) // bin log minor
    header.writeUInt8(8, 14) // bin log build
    header.writeUInt8(1, 15) // bin log patch

    header.writeBigUInt64LE(fileSize, 16)
    header.writeBigUInt64LE(uncompressedSize, 24)
    header.writeUInt32LE(objectCount, 32)
    header.writeUInt32LE(0, 36) // count of objects read (unused)

    writeSystemTime(header, 40, startTimeNs)
    writeSystemTime(header, 56, stopTimeNs)

    // Remaining bytes stay zero padded
    return header
  }

  private ensureStartTimes(msgTsUs?: number) {
    if (!this.startTimeNs) {
      this.startTimeNs = BigInt(Date.now()) * 1_000_000n
      this.stopTimeNs = this.startTimeNs
      this.firstMsgTsUs = msgTsUs ?? 0
    } else if (this.firstMsgTsUs === undefined) {
      this.firstMsgTsUs = msgTsUs ?? 0
    }
  }

  private computeTimestampNs(msgTsUs?: number): bigint {
    this.ensureStartTimes(msgTsUs)
    const baseUs = this.firstMsgTsUs ?? 0
    const offsetUs = msgTsUs !== undefined ? Math.max(0, Math.trunc(msgTsUs - baseUs)) : 0
    const tsNs = (this.startTimeNs ?? 0n) + BigInt(offsetUs) * 1000n
    this.stopTimeNs = tsNs
    const delta = tsNs - (this.startTimeNs ?? 0n)
    return delta >= 0n ? delta : 0n
  }

  private addObject(objType: number, data: Buffer, timestampNs: bigint) {
    if (this.closed) return

    const headerSize = OBJ_HEADER_BASE_SIZE + OBJ_HEADER_V1_SIZE
    const objSize = headerSize + data.length

    const baseHeader = Buffer.alloc(OBJ_HEADER_BASE_SIZE)
    baseHeader.write('LOBJ', 0, 'ascii')
    baseHeader.writeUInt16LE(headerSize, 4)
    baseHeader.writeUInt16LE(1, 6) // header version
    baseHeader.writeUInt32LE(objSize, 8)
    baseHeader.writeUInt32LE(objType, 12)

    const objHeader = Buffer.alloc(OBJ_HEADER_V1_SIZE)
    objHeader.writeUInt32LE(TIME_ONE_NANS, 0)
    objHeader.writeUInt16LE(0, 4) // client index
    objHeader.writeUInt16LE(0, 6) // object version
    objHeader.writeBigUInt64LE(timestampNs >= 0n ? timestampNs : 0n, 8)

    const paddingSize = padData(data.length)

    this.bufferParts.push(baseHeader, objHeader, data)
    if (paddingSize) {
      this.bufferParts.push(Buffer.alloc(paddingSize))
    }
    this.bufferSize += objSize + paddingSize
    this.objectCount += 1

    if (this.bufferSize >= this.maxContainerSize) {
      this.flush()
    }
  }

  writeCanMessage(msg: CanMessage, channel: number, tsUs?: number) {
    const arbId = msg.msgType.idType === 'EXTENDED' ? msg.id | CAN_MSG_EXT : msg.id
    const flags = (msg.msgType.remote ? REMOTE_FLAG : 0) | (msg.dir === 'OUT' ? DIR : 0)
    const timestampNs = this.computeTimestampNs(tsUs)
    const dataBuf = Buffer.from(msg.data)

    if (msg.msgType.canfd) {
      const fdFlags = EDL | (msg.msgType.brs ? BRS : 0) // ESI flag default 0

      const data = Buffer.alloc(2 + 1 + 1 + 4 + 4 + 1 + 1 + 1 + 5 + 64)
      let offset = 0
      data.writeUInt16LE(channel, offset)
      offset += 2
      data.writeUInt8(flags, offset)
      offset += 1
      data.writeUInt8(len2dlc(msg.data.length), offset)
      offset += 1
      data.writeUInt32LE(arbId >>> 0, offset)
      offset += 4
      data.writeUInt32LE(0, offset) // frame length
      offset += 4
      data.writeUInt8(0, offset) // bit count (unused)
      offset += 1
      data.writeUInt8(fdFlags, offset)
      offset += 1
      data.writeUInt8(clampLen(msg.data.length, 64), offset)
      offset += 1
      offset += 5 // padding

      const copyLen = clampLen(dataBuf.length, 64)
      dataBuf.copy(data, offset, 0, copyLen)

      this.addObject(CAN_FD_MESSAGE, data, timestampNs)
    } else {
      const data = Buffer.alloc(2 + 1 + 1 + 4 + 8)
      let offset = 0
      data.writeUInt16LE(channel, offset)
      offset += 2
      data.writeUInt8(flags, offset)
      offset += 1
      data.writeUInt8(clampLen(msg.data.length, 8), offset)
      offset += 1
      data.writeUInt32LE(arbId >>> 0, offset)
      offset += 4

      const copyLen = clampLen(dataBuf.length, 8)
      dataBuf.copy(data, offset, 0, copyLen)

      this.addObject(CAN_MESSAGE, data, timestampNs)
    }
  }

  writeError(channel: number, tsUs?: number) {
    const timestampNs = this.computeTimestampNs(tsUs)
    const data = Buffer.alloc(2 + 2 + 4 + 1 + 1 + 1 + 1 + 4 + 2 + 2 + 8)
    let offset = 0
    data.writeUInt16LE(channel, offset) // channel
    offset += 2
    data.writeUInt16LE(0, offset) // length
    offset += 2
    data.writeUInt32LE(0, offset) // flags
    offset += 4
    data.writeUInt8(0, offset) // ecc
    offset += 1
    data.writeUInt8(0, offset) // position
    offset += 1
    data.writeUInt8(0, offset) // dlc
    offset += 1
    data.writeUInt8(0, offset) // frame length
    offset += 1
    data.writeUInt32LE(0, offset) // arbitration id
    offset += 4
    data.writeUInt16LE(0, offset) // ext flags
    offset += 2
    offset += 2 // padding
    // data field (8 bytes) left zeroed

    this.addObject(CAN_ERROR_EXT, data, timestampNs)
  }

  flush() {
    if (this.closed) return
    const buffer = Buffer.concat(this.bufferParts)
    if (buffer.length === 0) {
      return
    }

    const uncompressed = buffer.subarray(0, this.maxContainerSize)
    const tail = buffer.subarray(this.maxContainerSize)
    this.bufferParts = tail.length ? [tail] : []
    this.bufferSize = tail.length

    let method = ZLIB_DEFLATE
    let payload: Buffer
    if (this.compressionLevel === 0) {
      method = NO_COMPRESSION
      payload = uncompressed
    } else {
      payload = zlib.deflateSync(uncompressed, { level: this.compressionLevel })
    }

    const objSize = OBJ_HEADER_BASE_SIZE + LOG_CONTAINER_HEADER_SIZE + payload.length

    const baseHeader = Buffer.alloc(OBJ_HEADER_BASE_SIZE)
    baseHeader.write('LOBJ', 0, 'ascii')
    baseHeader.writeUInt16LE(OBJ_HEADER_BASE_SIZE, 4)
    baseHeader.writeUInt16LE(1, 6)
    baseHeader.writeUInt32LE(objSize, 8)
    baseHeader.writeUInt32LE(LOG_CONTAINER, 12)

    const containerHeader = Buffer.alloc(LOG_CONTAINER_HEADER_SIZE)
    containerHeader.writeUInt16LE(method, 0)
    containerHeader.writeUInt32LE(uncompressed.length, 8)

    const padding = padData(objSize)

    fs.writeSync(this.fd, baseHeader, 0, baseHeader.length, this.position)
    this.position += baseHeader.length
    fs.writeSync(this.fd, containerHeader, 0, containerHeader.length, this.position)
    this.position += containerHeader.length
    fs.writeSync(this.fd, payload, 0, payload.length, this.position)
    this.position += payload.length
    if (padding) {
      const padBuf = Buffer.alloc(padding)
      fs.writeSync(this.fd, padBuf, 0, padding, this.position)
      this.position += padding
    }

    this.uncompressedSize += BigInt(
      OBJ_HEADER_BASE_SIZE + LOG_CONTAINER_HEADER_SIZE + uncompressed.length
    )
  }

  stop() {
    if (this.closed) return
    this.flush()

    if (!this.startTimeNs) {
      const now = BigInt(Date.now()) * 1_000_000n
      this.startTimeNs = now
      this.stopTimeNs = now
    }

    const stats = fs.fstatSync(this.fd)
    const fileSize = BigInt(stats.size)

    const header = this.buildHeader(
      fileSize,
      this.uncompressedSize,
      this.objectCount,
      this.startTimeNs,
      this.stopTimeNs
    )
    fs.writeSync(this.fd, header, 0, header.length, 0)

    fs.closeSync(this.fd)
    this.closed = true
  }
}

class BlfTransport extends Transport {
  private writer: BlfWriter
  private methods: string[]
  devices: string[]
  private channelOrder: string[]
  closed = false

  constructor(
    filePath: string,
    devices: string[],
    methods: string[],
    channelOrder: string[],
    compressionLevel?: number
  ) {
    super({
      level: 'debug'
    })
    this.writer = new BlfWriter(filePath, { compressionLevel })
    this.devices = devices
    this.methods = methods
    this.channelOrder = channelOrder
  }

  private resolveChannel(deviceId?: string): number {
    if (!deviceId) {
      return 1
    }
    const index = this.channelOrder.indexOf(deviceId)
    return index === -1 ? 1 : index + 1
  }

  log(info: any, callback: () => void) {
    if (this.closed) {
      callback()
      return
    }
    const payload = typeof info.message === 'object' ? info.message : undefined

    if (!payload) {
      callback()
      return
    }
    const { method, data, deviceId } = payload

    if (this.methods.indexOf(method) === -1) {
      callback()
      return
    }

    const channel = this.resolveChannel(deviceId)
    try {
      if (method === 'canBase') {
        this.writer.writeCanMessage(data as CanMessage, channel, (data as any)?.ts)
      } else if (method === 'canError') {
        const ts = typeof data?.ts === 'number' ? data.ts : undefined
        this.writer.writeError(channel, ts)
      }
    } catch (err) {
      console.error('BLF transport error', err)
    }
    callback()
  }

  close(): void {
    if (this.closed) return
    this.writer.stop()
    this.closed = true
    if (typeof super.close === 'function') {
      super.close()
    }
  }
}

export default (
  filePath: string,
  devices: string[],
  method: string[],
  compressionLevel?: number
) => {
  const timestamp = dayjs().format('YYYYMMDDHHmmss')
  const parsedPath = path.parse(filePath)
  const fileWithSuffix = path.format({
    dir: parsedPath.dir,
    name: `${parsedPath.name}_${timestamp}`,
    ext: parsedPath.ext
  })

  const channelOrder = Object.keys((global as any).dataSet?.devices || {})
  return new BlfTransport(fileWithSuffix, devices, method, channelOrder, compressionLevel)
}
