import { CanMessage } from 'nodeCan/can'
import winston, { format } from 'winston'
import Transport from 'winston-transport'

// LogData interface matching the one from trace.vue

// Extended winston info interface
interface AscLogInfo {
  message: {
    method: string
    data: any
    deviceId?: string
  }
}

// DLC calculation helper functions
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

function dlc2len(dlc: number): number {
  if (dlc <= 8) return dlc
  switch (dlc) {
    case 9:
      return 12
    case 10:
      return 16
    case 11:
      return 20
    case 12:
      return 24
    case 13:
      return 32
    case 14:
      return 48
    case 15:
      return 64
    default:
      return dlc
  }
}

function ascFormat(method: string[], channel: string[], initTs: number): winston.Logform.Format {
  return format((info: any, opts: any) => {
    if (typeof info.message === 'string') {
      return info
    }
    const method = info.message.method
    if (opts.method.indexOf(method) == -1) {
      return false
    }
    let channel = 1
    if (info.message.deviceId) {
      const index = opts.channel.indexOf(info.message.deviceId)
      if (index != -1) {
        channel = index + 1
      }
    }
    // Format channel number (Many interfaces start channel numbering at 0 which is invalid, so add 1)

    let messageLine = ''
    switch (method) {
      case 'canBase': {
        const logData = info.message.data
        const msg = logData as CanMessage
        const relativeTime = logData.ts / 1000_000 // Convert to seconds
        messageLine = formatCanMessage(msg, channel, relativeTime)
        break
      }
      case 'canError': {
        const relativeTime = info.message.data.ts / 1000_000 // Convert to seconds
        messageLine = `${relativeTime.toFixed(6)} ${channel}  ErrorFrame`
        break
      }
      default:
        return false
    }

    info[Symbol.for('message')] = messageLine
    return info
  })({
    method: method,
    channel: channel
  })
}

function formatCanMessage(msg: CanMessage, channel: number, timestamp: number): string {
  const dir = msg.dir === 'OUT' ? 'Tx' : 'Rx'

  // Format arbitration ID with extended ID handling
  let arbId = msg.id.toString(16).toUpperCase()
  if (msg.msgType.idType === 'EXTENDED') {
    arbId += 'x'
  }

  if (msg.msgType.canfd) {
    // CAN FD format
    return formatCanFdMessage(msg, channel, timestamp, dir, arbId)
  } else {
    // Classic CAN format
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
  if (msg.msgType.remote) {
    // Remote frame
    const dlc = msg.data.length
    return `${timestamp.toFixed(6)} ${channel}  ${arbId.padEnd(15)} ${dir.padEnd(4)} r ${dlc.toString(16)}`
  } else {
    // Data frame
    const dlc = msg.data.length
    const dataHex = Array.from(msg.data)
      .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
      .join(' ')
    return `${timestamp.toFixed(6)} ${channel}  ${arbId.padEnd(15)} ${dir.padEnd(4)} d ${dlc.toString(16)} ${dataHex}`
  }
}

function formatCanFdMessage(
  msg: CanMessage,
  channel: number,
  timestamp: number,
  dir: string,
  arbId: string
): string {
  const brs = msg.msgType.brs ? '1' : '0'
  const esi = '0' // Error State Indicator - would need to be tracked separately
  const dlc = len2dlc(msg.data.length)
  const dataLength = msg.data.length
  const dataHex = Array.from(msg.data)
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')

  // CAN FD format flags
  let flags = 0
  flags |= 1 << 12 // CAN FD flag
  if (msg.msgType.brs) {
    flags |= 1 << 13 // BRS flag
  }
  // ESI would be flags |= 1 << 14 if available

  const symbolicName = '' // Would need message name from DBC
  const messageDuration = '0'
  const messageLength = '0'
  const crc = '0'
  const bitTimingConfArb = '0'
  const bitTimingConfData = '0'
  const bitTimingConfExtArb = '0'
  const bitTimingConfExtData = '0'

  return `${timestamp.toFixed(6)} CANFD ${channel.toString().padStart(3)} ${dir.padEnd(4)} ${arbId.padStart(8)}  ${symbolicName.padStart(32)} ${brs} ${esi} ${dlc.toString(16)} ${dataLength.toString().padStart(2)} ${dataHex} ${messageDuration.padStart(8)} ${messageLength.padStart(4)} ${flags.toString(16).toUpperCase().padStart(8)} ${crc.padStart(8)} ${bitTimingConfArb.padStart(8)} ${bitTimingConfData.padStart(8)} ${bitTimingConfExtArb.padStart(8)} ${bitTimingConfExtData.padStart(8)}`
}

class FileTransport extends winston.transports.File {
  devices: string[]
  isinit = false
  initTs: number

  constructor(opts: winston.transports.FileTransportOptions, devices: string[], initTs: number) {
    super(opts)
    this.devices = devices
    this.initTs = initTs
  }

  private formatHeaderDateTime(dt: Date): string {
    // Format according to ASC specification: "Mon Jul 14 09:29:58.492 2008"
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ]

    const weekday = weekdays[dt.getDay()]
    const month = months[dt.getMonth()]
    const day = dt.getDate().toString().padStart(2, ' ')
    const hour = dt.getHours().toString().padStart(2, '0')
    const minute = dt.getMinutes().toString().padStart(2, '0')
    const second = dt.getSeconds().toString().padStart(2, '0')
    const msec = Math.floor(dt.getMilliseconds()) // Only 3 digits for milliseconds
    const year = dt.getFullYear()

    return `${weekday} ${month} ${day} ${hour}:${minute}:${second}.${msec.toString().padStart(3, '0')} ${year}`
  }
  log(info: any, callback: any) {
    if (super.log) {
      if (this.isinit == false) {
        // Write initial header
        const now = new Date(this.initTs)
        const dateStr = this.formatHeaderDateTime(now)

        const header =
          `date ${dateStr}\n` +
          'base hex  timestamps absolute\n' +
          'internal events logged\n' +
          `Begin TriggerBlock ${dateStr}\n`
        super.log({ level: 'info', [Symbol.for('message')]: header }, () => {})
        this.isinit = true
      }

      super.log(info, callback)
    }
  }

  public close(): void {
    // Write end trigger block
    if (this.isinit && this.log) {
      this.log({ level: 'info', [Symbol.for('message')]: 'End TriggerBlock\n' }, () => {})
    }
    if (super.close) {
      super.close()
    }
  }
}

export default (filePath: string, devices: string[], method: string[]) => {
  const now = new Date()
  const keys = Object.keys(global.device)

  return new FileTransport(
    {
      format: ascFormat(method, keys, now.getTime()),
      filename: filePath,
      level: 'debug'
    },
    devices,
    now.getTime()
  )
}
