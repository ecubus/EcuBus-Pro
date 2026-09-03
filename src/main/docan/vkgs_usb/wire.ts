export interface VkgsUsbFrame {
  id: number
  data: Buffer
  fd: boolean
  brs: boolean
  extended: boolean
  remote: boolean
  timestampUs: number
}

export interface VkgsUsbStateEvent {
  kind: 'state'
  state: number
  rxErrorCount: number
  txErrorCount: number
  timestampUs: number
}

export interface VkgsUsbBusErrorEvent {
  kind: 'bus-error'
  errorCode: number
  rxErrorCount: number
  txErrorCount: number
}

export type VkgsUsbEvent = VkgsUsbStateEvent | VkgsUsbBusErrorEvent

export interface VkgsDecodeResult {
  frames: VkgsUsbFrame[]
  events: VkgsUsbEvent[]
  tail: Buffer
}

export interface VkgsWireDecoder {
  push(transfer: Buffer): VkgsDecodeResult
  reset(): void
}

const FLAG_FD = 1 << 1
const FLAG_BRS = 1 << 2

const CAN_EFF_FLAG = 0x80000000
const CAN_RTR_FLAG = 0x40000000
const CAN_ID_MASK = 0x1fffffff

const VKGS_ECHO_RX = 0xffffffff
const VKGS_ECHO_LOAD = 0xa3c95e3d
const VKGS_ECHO_STATE = 0xa4c95e3d
const VKGS_ECHO_BERR = 0xa6c95e3d
const VKGS_HEADER_SIZE = 12
const VKGS_STATE_SIZE = 28
const VKGS_BERR_SIZE = 16
const VKGS_LOAD_SIZE = 28

const FD_DLC_LENGTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24, 32, 48, 64]

export function lengthToVkgsDlc(length: number, fd: boolean): number {
  const maximum = fd ? 64 : 8
  if (!Number.isInteger(length) || length < 0 || length > maximum) {
    throw new RangeError(`CAN payload length must be 0..${maximum}`)
  }
  if (!fd) return length
  const dlc = FD_DLC_LENGTHS.findIndex((candidate) => candidate >= length)
  if (dlc < 0) throw new RangeError('CAN FD payload exceeds 64 bytes')
  return dlc
}

export function vkgsDlcToLength(dlc: number, fd: boolean): number {
  const normalized = dlc & 0x0f
  return fd ? FD_DLC_LENGTHS[normalized] : Math.min(normalized, 8)
}

export function normalizeVkgsData(data: Buffer, fd: boolean): Buffer {
  const wireLength = vkgsDlcToLength(lengthToVkgsDlc(data.length, fd), fd)
  if (wireLength === data.length) return Buffer.from(data)
  return Buffer.concat([data, Buffer.alloc(wireLength - data.length)])
}

function readTimestamp(buffer: Buffer, offset: number): number {
  const timestamp = buffer.readBigUInt64LE(offset)
  if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) return 0
  return Number(timestamp)
}

export function encodeVkgsFrame(channel: number, frame: VkgsUsbFrame, fdMode: boolean): Buffer {
  const data = normalizeVkgsData(frame.data, frame.fd)
  const width = fdMode || frame.fd ? 64 : 8
  const packet = Buffer.alloc(VKGS_HEADER_SIZE + width)
  let canId = frame.id & CAN_ID_MASK
  if (frame.extended) canId = (canId | CAN_EFF_FLAG) >>> 0
  if (frame.remote) canId = (canId | CAN_RTR_FLAG) >>> 0
  let flags = frame.fd ? FLAG_FD : 0
  if (frame.brs) flags |= FLAG_BRS
  packet.writeUInt32LE(0, 0)
  packet.writeUInt32LE(canId, 4)
  packet.writeUInt8(lengthToVkgsDlc(data.length, frame.fd), 8)
  packet.writeUInt8(channel, 9)
  packet.writeUInt8(flags, 10)
  data.copy(packet, VKGS_HEADER_SIZE)
  return packet
}

export class VkgsDecoder implements VkgsWireDecoder {
  private tail = Buffer.alloc(0)

  constructor(
    private readonly timestampsEnabled: boolean,
    private readonly expectedChannel?: number
  ) {}

  reset() {
    this.tail = Buffer.alloc(0)
  }

  push(transfer: Buffer): VkgsDecodeResult {
    const buffer = this.tail.length ? Buffer.concat([this.tail, transfer]) : transfer
    this.tail = Buffer.alloc(0)
    const frames: VkgsUsbFrame[] = []
    const events: VkgsUsbEvent[] = []
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
        const length = vkgsDlcToLength(buffer.readUInt8(offset + 8), fd)
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
