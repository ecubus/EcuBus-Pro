export type UsbCanProtocol = 'vcan_usb' | 'vkgs_usb'

export interface UsbCanFrame {
  id: number
  data: Buffer
  fd: boolean
  brs: boolean
  extended: boolean
  remote: boolean
  timestampUs: number
}

export interface UsbCanStateEvent {
  kind: 'state'
  state: number
  rxErrorCount: number
  txErrorCount: number
  timestampUs: number
}

export interface UsbCanBusErrorEvent {
  kind: 'bus-error'
  errorCode: number
  rxErrorCount: number
  txErrorCount: number
}

export type UsbCanEvent = UsbCanStateEvent | UsbCanBusErrorEvent

export interface DecodeResult {
  frames: UsbCanFrame[]
  events: UsbCanEvent[]
  tail: Buffer
}

export interface WireDecoder {
  push(transfer: Buffer): DecodeResult
  reset(): void
}

export const USB_CAN_FEATURE_FD = 1 << 8
export const USB_CAN_FEATURE_BT_CONST_EXT = 1 << 10
export const USB_CAN_FEATURE_TERMINATION = 1 << 11
export const USB_CAN_FEATURE_HW_TIMESTAMP = 1 << 4
export const USB_CAN_FEATURE_BERR_REPORTING = 1 << 12

export const USB_CAN_MODE_LISTEN_ONLY = 1 << 0
export const USB_CAN_MODE_HW_TIMESTAMP = 1 << 4
export const USB_CAN_MODE_FD = 1 << 8
export const USB_CAN_MODE_BERR_REPORTING = 1 << 12

const FLAG_FD = 1 << 1
const FLAG_BRS = 1 << 2
const FLAG_EFF = 1 << 4
const FLAG_RTR = 1 << 5

const CAN_EFF_FLAG = 0x80000000
const CAN_RTR_FLAG = 0x40000000
const CAN_ID_MASK = 0x1fffffff

const VCAN_ECHO_TX = 0xa1c95e3d
const VCAN_ECHO_RX = 0xa2c95e3d
const VCAN_ECHO_STATE = 0xa4c95e3d
const VCAN_HEADER_SIZE = 8
const VCAN_FRAME_DATA_OFFSET = 24
const VCAN_OPCODE_SIZE_MASK = 0x0fff
const VCAN_OPCODE_CHANNEL_SHIFT = 12
const VCAN_STATE_REQUEST = 3
const VCAN_BERR_REQUEST = 2

const VKGS_ECHO_RX = 0xffffffff
const VKGS_ECHO_LOAD = 0xa3c95e3d
const VKGS_ECHO_STATE = 0xa4c95e3d
const VKGS_ECHO_BERR = 0xa6c95e3d
const VKGS_HEADER_SIZE = 12
const VKGS_STATE_SIZE = 28
const VKGS_BERR_SIZE = 16
const VKGS_LOAD_SIZE = 28

const FD_DLC_LENGTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24, 32, 48, 64]

export function lengthToDlc(length: number, fd: boolean): number {
  const maximum = fd ? 64 : 8
  if (!Number.isInteger(length) || length < 0 || length > maximum) {
    throw new RangeError(`CAN payload length must be 0..${maximum}`)
  }
  if (!fd) return length
  const dlc = FD_DLC_LENGTHS.findIndex((candidate) => candidate >= length)
  if (dlc < 0) throw new RangeError('CAN FD payload exceeds 64 bytes')
  return dlc
}

export function dlcToLength(dlc: number, fd: boolean): number {
  const normalized = dlc & 0x0f
  return fd ? FD_DLC_LENGTHS[normalized] : Math.min(normalized, 8)
}

export function normalizeCanData(data: Buffer, fd: boolean): Buffer {
  const wireLength = dlcToLength(lengthToDlc(data.length, fd), fd)
  if (wireLength === data.length) return Buffer.from(data)
  return Buffer.concat([data, Buffer.alloc(wireLength - data.length)])
}

function readTimestamp(buffer: Buffer, offset: number): number {
  const timestamp = buffer.readBigUInt64LE(offset)
  if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) return 0
  return Number(timestamp)
}

function vcanOpcode(channel: number, size: number): number {
  return ((channel & 0x0f) << VCAN_OPCODE_CHANNEL_SHIFT) | (size & VCAN_OPCODE_SIZE_MASK)
}

export function makeVcanControlPayload(
  channel: number,
  request: number,
  payload: Buffer = Buffer.alloc(0)
): Buffer {
  const result = Buffer.alloc(VCAN_HEADER_SIZE + payload.length)
  result.writeUInt32LE(0xa5c95e3d, 0)
  result.writeUInt16LE(vcanOpcode(channel, result.length), 4)
  result.writeUInt16LE(request, 6)
  payload.copy(result, VCAN_HEADER_SIZE)
  return result
}

export function stripVcanControlPayload(
  channel: number,
  request: number,
  response: Buffer
): Buffer {
  if (response.length < VCAN_HEADER_SIZE) throw new Error('VCAN control response is too short')
  const opcode = response.readUInt16LE(4)
  if (
    response.readUInt32LE(0) !== 0xa5c95e3d ||
    (opcode & VCAN_OPCODE_SIZE_MASK) !== response.length ||
    ((opcode >> VCAN_OPCODE_CHANNEL_SHIFT) & 0x0f) !== channel ||
    (response.readUInt16LE(6) & 0x7f) !== request
  ) {
    throw new Error('VCAN control response header is invalid')
  }
  return response.subarray(VCAN_HEADER_SIZE)
}

export function encodeVcanFrame(channel: number, frame: UsbCanFrame): Buffer {
  const data = normalizeCanData(frame.data, frame.fd)
  const width = frame.fd ? 64 : 8
  const size = VCAN_FRAME_DATA_OFFSET + width
  const packet = Buffer.alloc(size)
  let flags = frame.fd ? FLAG_FD : 0
  if (frame.brs) flags |= FLAG_BRS
  if (frame.extended) flags |= FLAG_EFF
  if (frame.remote) flags |= FLAG_RTR
  packet.writeUInt32LE(VCAN_ECHO_TX, 0)
  packet.writeUInt16LE(vcanOpcode(channel, size), 4)
  packet.writeUInt16LE(flags, 6)
  packet.writeUInt32LE(frame.id & CAN_ID_MASK, 8)
  packet.writeUInt8(lengthToDlc(data.length, frame.fd), 12)
  data.copy(packet, VCAN_FRAME_DATA_OFFSET)
  return packet
}

export class VcanDecoder implements WireDecoder {
  private tail = Buffer.alloc(0)

  constructor(private readonly expectedChannel?: number) {}

  reset() {
    this.tail = Buffer.alloc(0)
  }

  push(transfer: Buffer): DecodeResult {
    const buffer = this.tail.length ? Buffer.concat([this.tail, transfer]) : transfer
    this.tail = Buffer.alloc(0)
    const frames: UsbCanFrame[] = []
    const events: UsbCanEvent[] = []
    let offset = 0

    while (offset + VCAN_HEADER_SIZE <= buffer.length) {
      const echoId = buffer.readUInt32LE(offset)
      if (echoId === 0) break
      const opcode = buffer.readUInt16LE(offset + 4)
      const flags = buffer.readUInt16LE(offset + 6)
      const frameSize = opcode & VCAN_OPCODE_SIZE_MASK
      if (frameSize < VCAN_HEADER_SIZE || frameSize > 512) {
        this.reset()
        throw new Error(`invalid VCAN bulk frame size: ${frameSize}`)
      }
      const frameChannel = (opcode >> VCAN_OPCODE_CHANNEL_SHIFT) & 0x0f
      if (this.expectedChannel !== undefined && frameChannel !== this.expectedChannel) {
        this.reset()
        throw new Error(
          `VCAN bulk frame channel ${frameChannel} does not match interface ${this.expectedChannel}`
        )
      }
      if (offset + frameSize > buffer.length) {
        this.tail = Buffer.from(buffer.subarray(offset))
        break
      }

      if (echoId === VCAN_ECHO_RX && frameSize >= VCAN_FRAME_DATA_OFFSET) {
        const fd = !!(flags & FLAG_FD)
        const length = dlcToLength(buffer.readUInt8(offset + 12), fd)
        if (VCAN_FRAME_DATA_OFFSET + length > frameSize) {
          this.reset()
          throw new Error('VCAN frame payload exceeds its declared frame size')
        }
        frames.push({
          id: buffer.readUInt32LE(offset + 8) & CAN_ID_MASK,
          data: Buffer.from(
            buffer.subarray(
              offset + VCAN_FRAME_DATA_OFFSET,
              offset + VCAN_FRAME_DATA_OFFSET + length
            )
          ),
          fd,
          brs: !!(flags & FLAG_BRS),
          extended: !!(flags & FLAG_EFF),
          remote: !!(flags & FLAG_RTR),
          timestampUs: readTimestamp(buffer, offset + 16)
        })
      } else if (echoId === VCAN_ECHO_STATE) {
        if (flags === VCAN_STATE_REQUEST && frameSize >= 28) {
          events.push({
            kind: 'state',
            timestampUs: readTimestamp(buffer, offset + 8),
            state: buffer.readUInt32LE(offset + 16),
            rxErrorCount: buffer.readUInt32LE(offset + 20),
            txErrorCount: buffer.readUInt32LE(offset + 24)
          })
        } else if (flags === VCAN_BERR_REQUEST && frameSize >= 16) {
          events.push({
            kind: 'bus-error',
            errorCode: buffer.readUInt8(offset + 9),
            rxErrorCount: buffer.readUInt8(offset + 10),
            txErrorCount: buffer.readUInt8(offset + 11)
          })
        }
      }
      offset += frameSize
    }

    if (!this.tail.length && offset < buffer.length) {
      const remainder = buffer.subarray(offset)
      if (remainder.length < VCAN_HEADER_SIZE && remainder.some((value) => value !== 0)) {
        this.tail = Buffer.from(remainder)
      }
    }
    return { frames, events, tail: Buffer.from(this.tail) }
  }
}

export function encodeVkgsFrame(channel: number, frame: UsbCanFrame, fdMode: boolean): Buffer {
  const data = normalizeCanData(frame.data, frame.fd)
  const width = fdMode || frame.fd ? 64 : 8
  const packet = Buffer.alloc(VKGS_HEADER_SIZE + width)
  let canId = frame.id & CAN_ID_MASK
  if (frame.extended) canId = (canId | CAN_EFF_FLAG) >>> 0
  if (frame.remote) canId = (canId | CAN_RTR_FLAG) >>> 0
  let flags = frame.fd ? FLAG_FD : 0
  if (frame.brs) flags |= FLAG_BRS
  packet.writeUInt32LE(0, 0)
  packet.writeUInt32LE(canId, 4)
  packet.writeUInt8(lengthToDlc(data.length, frame.fd), 8)
  packet.writeUInt8(channel, 9)
  packet.writeUInt8(flags, 10)
  data.copy(packet, VKGS_HEADER_SIZE)
  return packet
}

export class VkgsDecoder implements WireDecoder {
  private tail = Buffer.alloc(0)

  constructor(
    private readonly timestampsEnabled: boolean,
    private readonly expectedChannel?: number
  ) {}

  reset() {
    this.tail = Buffer.alloc(0)
  }

  push(transfer: Buffer): DecodeResult {
    const buffer = this.tail.length ? Buffer.concat([this.tail, transfer]) : transfer
    this.tail = Buffer.alloc(0)
    const frames: UsbCanFrame[] = []
    const events: UsbCanEvent[] = []
    let offset = 0

    while (offset < buffer.length) {
      const remaining = buffer.length - offset
      if (remaining < 4) {
        if (buffer.subarray(offset).some((value) => value !== 0)) {
          this.tail = Buffer.from(buffer.subarray(offset))
        }
        break
      }
      const echoId = buffer.readUInt32LE(offset)
      if (echoId === 0) break
      if (remaining < VKGS_HEADER_SIZE) {
        this.tail = Buffer.from(buffer.subarray(offset))
        break
      }

      let size: number
      if (echoId === VKGS_ECHO_STATE) size = VKGS_STATE_SIZE
      else if (echoId === VKGS_ECHO_BERR) size = VKGS_BERR_SIZE
      else if (echoId === VKGS_ECHO_LOAD) size = VKGS_LOAD_SIZE
      else if (echoId === VKGS_ECHO_RX) {
        const flags = buffer.readUInt8(offset + 10)
        size = VKGS_HEADER_SIZE + (flags & FLAG_FD ? 64 : 8) + (this.timestampsEnabled ? 8 : 0)
      } else {
        this.reset()
        throw new Error(`unknown VKGS bulk frame marker: 0x${echoId.toString(16)}`)
      }

      const frameChannel = buffer.readUInt8(offset + (echoId === VKGS_ECHO_RX ? 9 : 4))
      if (this.expectedChannel !== undefined && frameChannel !== this.expectedChannel) {
        this.reset()
        throw new Error(
          `VKGS bulk frame channel ${frameChannel} does not match interface ${this.expectedChannel}`
        )
      }

      if (offset + size > buffer.length) {
        this.tail = Buffer.from(buffer.subarray(offset))
        break
      }

      if (echoId === VKGS_ECHO_RX) {
        const rawId = buffer.readUInt32LE(offset + 4)
        const flags = buffer.readUInt8(offset + 10)
        const fd = !!(flags & FLAG_FD)
        const length = dlcToLength(buffer.readUInt8(offset + 8), fd)
        frames.push({
          id: rawId & CAN_ID_MASK,
          data: Buffer.from(
            buffer.subarray(offset + VKGS_HEADER_SIZE, offset + VKGS_HEADER_SIZE + length)
          ),
          fd,
          brs: !!(flags & FLAG_BRS),
          extended: !!(rawId & CAN_EFF_FLAG),
          remote: !!(rawId & CAN_RTR_FLAG),
          timestampUs: this.timestampsEnabled ? readTimestamp(buffer, offset + size - 8) : 0
        })
      } else if (echoId === VKGS_ECHO_STATE) {
        events.push({
          kind: 'state',
          timestampUs: readTimestamp(buffer, offset + 8),
          state: buffer.readUInt32LE(offset + 16),
          rxErrorCount: buffer.readUInt32LE(offset + 20),
          txErrorCount: buffer.readUInt32LE(offset + 24)
        })
      } else if (echoId === VKGS_ECHO_BERR) {
        events.push({
          kind: 'bus-error',
          errorCode: buffer.readUInt8(offset + 9),
          rxErrorCount: buffer.readUInt8(offset + 10),
          txErrorCount: buffer.readUInt8(offset + 11)
        })
      }
      offset += size
    }

    return { frames, events, tail: Buffer.from(this.tail) }
  }
}
