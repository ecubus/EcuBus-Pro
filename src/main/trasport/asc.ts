import winston, { format } from 'winston'
import Transport from 'winston-transport'

// LogData interface matching the one from trace.vue

// Extended winston info interface
interface AscLogInfo {
  message: {
    method: string
    data: any
  }
}

// DLC calculation helper function
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

function ascFormat(devices: string[]): winston.Logform.Format {
  let isHeaderWritten = false
  let startTime = 0

  return format((info: AscLogInfo, opts: any) => {
    console.log(info.message)
    if (opts.devices.indexOf(info.device) == -1) {
      return false
    }
    // Write ASC header only once
    if (!isHeaderWritten) {
      const now = new Date()
      const dateStr = now.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        year: 'numeric'
      })

      info.message =
        `date ${dateStr}\n` +
        'base hex  timestamps absolute\n' +
        'internal events logged\n' +
        `Begin Triggerblock ${dateStr}\n` +
        '0.000000 Start of measurement\n'

      isHeaderWritten = true
      startTime = (info.timestamp as number) || Date.now() / 1000
      return info
    }

    // Process log data to ASC format
    const logData = info.logData
    if (!logData) {
      return false // Skip if no log data
    }

    const timestamp = parseFloat(logData.ts) || 0
    const relativeTime = timestamp - startTime

    // Format channel number
    const channel =
      logData.channel && Number.isInteger(parseInt(logData.channel))
        ? parseInt(logData.channel) + 1
        : 1

    // Format ID
    let id = ''
    if (logData.id) {
      id = logData.id.replace('0x', '').toUpperCase()
      if (logData.msgType && logData.msgType.includes('EXT')) {
        id += 'x' // Extended frame marker
      }
    }

    // Format data
    let data = ''
    if (logData.data) {
      data = logData.data.replace(/\s+/g, ' ').trim()
    }

    // Build message line
    let messageLine = ''

    if (logData.method === 'canBase') {
      // CAN message
      const dlc = logData.dlc ? logData.dlc.toString(16) : '0'
      const dir = logData.dir === 'Tx' ? 'Tx' : 'Rx'

      if (logData.msgType && logData.msgType.includes('CANFD')) {
        // CANFD message
        const brs = logData.msgType.includes('BRS') ? '1' : '0'
        const esi = '0' // Assume ESI is always 0
        const dataLength = logData.len || 0

        messageLine = `CANFD ${channel}  ${dir} ${id}                                 ${brs} ${esi} ${dlc} ${dataLength} ${data} 0 0 1000 0 0 0 0 0`
      } else {
        // Normal CAN message
        const dtype = logData.data ? `d ${dlc}` : `r ${dlc}`
        messageLine = `${channel}  ${id.padEnd(15)} ${dir.padEnd(4)} ${dtype} ${data}`
      }
    } else if (logData.method === 'canError') {
      messageLine = `${channel}  ErrorFrame`
    } else if (logData.method === 'linBase') {
      // LIN message (treated as CAN format)
      const dlc = logData.dlc ? logData.dlc.toString(16) : '0'
      const dir = logData.dir === 'Tx' ? 'Tx' : 'Rx'
      messageLine = `${channel}  ${id.padEnd(15)} ${dir.padEnd(4)} d ${dlc} ${data}`
    } else if (
      logData.method === 'udsSent' ||
      logData.method === 'udsRecv' ||
      logData.method === 'udsNegRecv'
    ) {
      // UDS message (treated as CAN format)
      const dlc = logData.len ? len2dlc(logData.len).toString(16) : '0'
      const dir = logData.method === 'udsSent' ? 'Tx' : 'Rx'
      messageLine = `${channel}  ${id.padEnd(15)} ${dir.padEnd(4)} d ${dlc} ${data}`
    }

    if (messageLine) {
      info.message = `${relativeTime.toFixed(6)} ${messageLine}`
      return info
    }

    return false // Skip if no valid message line
  })({
    devices: devices
  })
}

export default (filePath: string, devices: string[]) => {
  return new winston.transports.File({
    format: ascFormat(devices),
    filename: filePath
  })
}
