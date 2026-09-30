/**
 * Linux SocketCAN wire format (uapi/linux/can.h).
 *
 * Classic `struct can_frame` is 16 bytes; CAN-FD `struct canfd_frame` is 72.
 * Multi-byte fields use native endianness (little-endian on x86_64 / aarch64).
 */

import { CAN_ID_TYPE, CanMsgType } from '../../src/main/share/can'

export const CAN_EFF_FLAG = 0x80000000
export const CAN_RTR_FLAG = 0x40000000
export const CAN_ERR_FLAG = 0x20000000
export const CAN_SFF_MASK = 0x7ff
export const CAN_EFF_MASK = 0x1fffffff

export const CAN_MAX_DLEN = 8
export const CANFD_MAX_DLEN = 64
export const CAN_MTU = 16
export const CANFD_MTU = 72
export const CANFD_BRS = 0x01
export const CANFD_ESI = 0x02

export interface SocketcanFrame {
  id: number
  msgType: CanMsgType
  data: Buffer
}

export function packCanFrame(id: number, msgType: CanMsgType, data: Buffer): Buffer {
  const mask = msgType.idType === CAN_ID_TYPE.EXTENDED ? CAN_EFF_MASK : CAN_SFF_MASK
  const canId =
    (id & mask) |
    (msgType.idType === CAN_ID_TYPE.EXTENDED ? CAN_EFF_FLAG : 0) |
    (msgType.remote ? CAN_RTR_FLAG : 0)

  if (msgType.canfd) {
    if (data.length > CANFD_MAX_DLEN) {
      throw new Error(`CAN-FD payload too long: ${data.length}`)
    }
    const buf = Buffer.alloc(CANFD_MTU)
    buf.writeUInt32LE(canId >>> 0, 0)
    buf.writeUInt8(data.length, 4)
    buf.writeUInt8(msgType.brs ? CANFD_BRS : 0, 5)
    data.copy(buf, 8)
    return buf
  }

  if (data.length > CAN_MAX_DLEN) {
    throw new Error(`Classic CAN payload too long: ${data.length}`)
  }
  const buf = Buffer.alloc(CAN_MTU)
  buf.writeUInt32LE(canId >>> 0, 0)
  buf.writeUInt8(data.length, 4)
  data.copy(buf, 8)
  return buf
}

export function unpackCanFrame(buf: Buffer): SocketcanFrame {
  if (buf.length !== CAN_MTU && buf.length !== CANFD_MTU) {
    throw new Error(`Invalid SocketCAN frame length: ${buf.length}`)
  }
  const canId = buf.readUInt32LE(0)
  const canfd = buf.length === CANFD_MTU
  const dlc = buf.readUInt8(4)
  const flags = canfd ? buf.readUInt8(5) : 0
  const dataOff = 8
  const max = canfd ? CANFD_MAX_DLEN : CAN_MAX_DLEN
  const len = Math.min(dlc, max)
  return {
    id: canId & CAN_EFF_MASK,
    msgType: {
      idType: canId & CAN_EFF_FLAG ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
      remote: !!(canId & CAN_RTR_FLAG),
      canfd,
      brs: !!(flags & CANFD_BRS)
    },
    data: Buffer.from(buf.subarray(dataOff, dataOff + len))
  }
}
