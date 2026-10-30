import { CAN_ID_TYPE, CanMessage } from './can'
import { getCheckSum, LinChecksumType, LinDirection, LinMsg } from './lin'

/** ASC files use CR+LF line endings. */
export const ASC_EOL = '\r\n'
export const ASC_END = 'End TriggerBlock'

/** SocketCAN / BLF extended-frame flag in a 32-bit CAN ID */
const CAN_EFF_FLAG = 0x80000000
/** 29-bit CAN identifier mask */
const CAN_EFF_MASK = 0x1fffffff

/** Nominal LIN header length in bit times: break 13 + delimiter 1 + sync 10 + PID 10. */
const LIN_HEADER_BITS = 34
/** Nominal LIN timing for ASC fields the log does not record. */
const LIN_NOMINAL_BAUD = 19200
const LIN_BIT_NS = Math.round(1e9 / LIN_NOMINAL_BAUD)
const LIN_BREAK_BITS = 13

/** Upper nibble of RcvError StateReason: the error reason. */
const LIN_RCV_REASON = { timeout: 0, invalidByte: 1, framing: 2, unknown: 6 }
/** Lower nibble of RcvError StateReason: waiting for the checksum field. Must not be 0. */
const LIN_RCV_STATE = 0x0c

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function canLen2Dlc(len: number): number {
  if (len <= 8) return len
  if (len <= 12) return 9
  if (len <= 16) return 10
  if (len <= 20) return 11
  if (len <= 24) return 12
  if (len <= 32) return 13
  if (len <= 48) return 14
  return 15
}

export function canDlc2Len(dlc: number, canfd: boolean): number {
  if (dlc <= 8) return dlc
  if (!canfd) return 8
  return [12, 16, 20, 24, 32, 48, 64][Math.min(dlc, 15) - 9]
}

/**
 * Whether a CAN frame should be logged as an extended identifier in ASC.
 *
 * ASC marks 29-bit IDs with a trailing `x`
 * (e.g. `54C5638x`). An 11-bit standard ID cannot exceed 0x7FF, so IDs above
 * that range are treated as extended even if `idType` was not set correctly.
 */
export function isExtendedCanId(msg: CanMessage): boolean {
  const idType = msg.msgType?.idType
  if (idType === CAN_ID_TYPE.EXTENDED) {
    return true
  }
  const rawId = Number(msg.id) || 0
  if ((rawId & CAN_EFF_FLAG) !== 0) {
    return true
  }
  return (rawId & CAN_EFF_MASK) > 0x7ff
}

/**
 * Format a CAN arbitration ID for ASC numeric logging.
 *
 * @returns hex ID, with a trailing `x` for extended frames
 */
export function formatAscArbitrationId(msg: CanMessage): string {
  const canId = (Number(msg.id) || 0) & CAN_EFF_MASK
  const hex = canId.toString(16).toUpperCase()
  return isExtendedCanId(msg) ? `${hex}x` : hex
}

/** Format a local time as `Mon Jul 14 09:29:58.492 2008`. */
export function formatAscDate(dt: Date): string {
  const hour = dt.getHours().toString().padStart(2, '0')
  const minute = dt.getMinutes().toString().padStart(2, '0')
  const second = dt.getSeconds().toString().padStart(2, '0')
  const msec = dt.getMilliseconds().toString().padStart(3, '0')
  return `${WEEKDAYS[dt.getDay()]} ${MONTHS[dt.getMonth()]} ${dt.getDate()} ${hour}:${minute}:${second}.${msec} ${dt.getFullYear()}`
}

/** Header lines up to and including `Begin Triggerblock`, without a trailing newline. */
export function formatAscHeader(start: Date): string {
  const dateStr = formatAscDate(start)
  return [
    `date ${dateStr}`,
    'base hex timestamps absolute',
    'internal events logged',
    `Begin Triggerblock ${dateStr}`
  ].join(ASC_EOL)
}

function hexBytes(data: ArrayLike<number>, upper: boolean): string {
  return Array.from(data)
    .map((byte) => {
      const hex = byte.toString(16).padStart(2, '0')
      return upper ? hex.toUpperCase() : hex
    })
    .join(' ')
}

export function formatCanMessage(msg: CanMessage, channel: number, timestamp: number): string {
  const dir = msg.dir === 'OUT' ? 'Tx' : 'Rx'
  const arbId = formatAscArbitrationId(msg)

  if (msg.msgType.canfd) {
    return formatCanFdMessage(msg, channel, timestamp, dir, arbId)
  } else {
    return formatClassicCanMessage(msg, channel, timestamp, dir, arbId)
  }
}

function formatClassicCanMessage(
  msg: CanMessage,
  channel: number,
  timestamp: number,
  dir: string,
  arbId: string
): string {
  // ASC numeric ID field is 15 characters (14 + trailing `x` for extended)
  const idField = arbId.padEnd(15)
  const prefix = `${timestamp.toFixed(6)} ${channel}  ${idField} ${dir.padEnd(4)}`

  if (msg.msgType.remote) {
    const dlc = msg.dlc ?? msg.data.length
    return `${prefix} r ${dlc.toString(16)}`
  }
  const data = msg.data.subarray(0, 8)
  const dlc = msg.dlc ?? data.length
  return `${prefix} d ${dlc.toString(16)} ${hexBytes(data, true)}`
}

function formatCanFdMessage(
  msg: CanMessage,
  channel: number,
  timestamp: number,
  dir: string,
  arbId: string
): string {
  const remote = msg.msgType.remote
  const dlc = msg.dlc ?? canLen2Dlc(msg.data.length)
  const dataLength = remote ? 0 : canDlc2Len(dlc, true)
  // DLC and DataLength must agree; pad a short payload with zeros.
  const data = Buffer.alloc(dataLength)
  if (!remote) {
    Buffer.from(msg.data).copy(data, 0, 0, dataLength)
  }

  // Bit 4: remote frame (classic CAN only), bit 12: FDF
  let flags = remote ? 1 << 4 : 1 << 12
  if (msg.msgType.brs) flags |= 1 << 13
  if (msg.msgType.esi) flags |= 1 << 14

  const brs = msg.msgType.brs ? '1' : '0'
  const esi = msg.msgType.esi ? '1' : '0'
  const dataField = dataLength > 0 ? ` ${hexBytes(data, true)}` : ''

  // <Time> CANFD <Channel> <Dir> <ID> <SymbolicName> <BRS> <ESI> <DLC> <DataLength> <D1>...<D64>
  // <MessageDuration> <MessageLength> <Flags> <CRC> <BitTimingConfArb> <BitTimingConfData>
  // <BitTimingConfExtArb> <BitTimingConfExtData>
  return `${timestamp.toFixed(6)} CANFD ${channel.toString().padStart(3)} ${dir} ${arbId.padStart(8)} ${''.padEnd(32)} ${brs} ${esi} ${dlc.toString(16)} ${dataLength}${dataField} ${'0'.padStart(8)} ${'0'.padStart(4)} ${flags.toString(16).padStart(8)} ${'0'.padStart(8)} ${'0'.padStart(8)} ${'0'.padStart(8)} ${'0'.padStart(8)} ${'0'.padStart(8)}`
}

export function formatCanError(channel: number, timestamp: number): string {
  return `${timestamp.toFixed(6)} ${channel}  ErrorFrame`
}

function linChannel(channel: number): string {
  return channel === 1 ? 'Li' : `L${channel}`
}

function linBitsToSeconds(bits: number): number {
  return bits / LIN_NOMINAL_BAUD
}

function linBusTiming(sof: number): string {
  return `SOF = ${sof.toFixed(6)} BR = ${LIN_NOMINAL_BAUD} break = ${LIN_BREAK_BITS * LIN_BIT_NS} ${LIN_BIT_NS}`
}

function linTimes(dlc: number): string {
  return `header time = ${LIN_HEADER_BITS}, full time = ${LIN_HEADER_BITS + 10 * (dlc + 1)}`
}

export function formatLinMessage(msg: LinMsg, channel: number, timestamp: number): string {
  const dir = msg.direction === LinDirection.SEND ? 'Tx' : 'Rx'
  const idHex = msg.frameId.toString(16).toLowerCase()
  const dlc = msg.data.length
  const csm = msg.checksumType === LinChecksumType.ENHANCED ? 'enhanced' : 'classic'
  const checksum = getCheckSum(msg.data, msg.checksumType, msg.frameId)
    .toString(16)
    .padStart(2, '0')
  return `${timestamp.toFixed(6)} ${linChannel(channel)} ${idHex.padStart(2)} ${dir} ${dlc} ${hexBytes(msg.data, false).padEnd(24)} checksum = ${checksum} ${linTimes(dlc)} CSM = ${csm}`
}

export function formatLinError(
  errorStr: string,
  msg: LinMsg | undefined,
  channel: number,
  timestamp: number
): string {
  const ch = linChannel(channel)
  const id = (msg?.frameId ?? 0).toString(16).toLowerCase()
  const dir = msg?.direction === LinDirection.SEND ? 'Tx' : 'Rx'
  const dlc = msg?.data?.length || 0
  const tsStr = timestamp.toFixed(6)
  const lower = errorStr.toLowerCase()

  if (lower.includes('checksum error')) {
    const checksum = (msg?.checksum ?? 0).toString(16)
    return `${tsStr} ${ch} ${id} CSErr ${dir} ${dlc} ${hexBytes(msg?.data || [], false)} checksum = ${checksum} ${linTimes(dlc)}`
  }

  if (lower.includes('no response')) {
    return `${tsStr} ${ch} ${id} TransmErr`
  }

  if (lower.includes('sync')) {
    // The measured sync field intervals are not available.
    const sof = Math.max(timestamp - linBitsToSeconds(LIN_HEADER_BITS), 0)
    return `${tsStr} ${ch} SyncError 0 0 0 0 ${linBusTiming(sof)}`
  }

  let description = errorStr
  let reason = LIN_RCV_REASON.unknown
  if (lower.includes('parity')) {
    description = 'parity error in identifier'
    reason = LIN_RCV_REASON.invalidByte
  } else if (lower.includes('format') || lower.includes('framing')) {
    description = 'framing error'
    reason = LIN_RCV_REASON.framing
  } else if (lower.includes('timeout') || lower.includes('no answer')) {
    reason = LIN_RCV_REASON.timeout
  }

  const stateReason = ((reason << 4) | LIN_RCV_STATE).toString(16).padStart(2, '0')
  const sof = Math.max(timestamp - linBitsToSeconds(LIN_HEADER_BITS + 10 * (dlc + 1)), 0)
  const eoh = sof + linBitsToSeconds(LIN_HEADER_BITS)
  const halfBitNs = Math.round(LIN_BIT_NS / 2)
  const csm = msg?.checksumType === LinChecksumType.CLASSIC ? 'classic' : 'enhanced'
  const idDlc = msg ? `${id} ${dlc} ` : ''
  // EOH and the fields after it are required.
  return `${tsStr} ${ch} ${idDlc}RcvError: ${description} StateReason = ${stateReason} ShortError = 0 DlcTimeout = 0 HasDatabytes = 0 ${linBusTiming(sof)} EOH = ${eoh.toFixed(6)} RBR = ${LIN_NOMINAL_BAUD} RSO = ${halfBitNs} HBR = ${LIN_NOMINAL_BAUD} HSO = ${halfBitNs} CSM = ${csm}`
}

/**
 * Only fixed description texts are valid here. The drivers do not report the
 * cause, so the texts are fixed.
 *
 * @returns an empty string for events that have no ASC representation
 */
export function formatLinEvent(event: string, channel: number, timestamp: number): string {
  const prefix = `${timestamp.toFixed(6)} ${linChannel(channel)} SleepModeEvent 0`
  if (event === 'busSleep') return `${prefix} entering sleep mode due to sleep mode frame`
  if (event === 'busWakeUp') return `${prefix} waking up due to internal wakeup frame`
  return ''
}
