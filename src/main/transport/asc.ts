import { getTsUs } from '../share/can'
import winston, { format } from 'winston'
import {
  ASC_END,
  ASC_EOL,
  formatAscHeader,
  formatCanError,
  formatCanMessage,
  formatLinError,
  formatLinEvent,
  formatLinMessage
} from '../share/asc'

export { formatAscArbitrationId, formatCanMessage, isExtendedCanId } from '../share/asc'

/**
 * Wall-clock time (ms since epoch) of `global.startTs`, the origin of logged frame timestamps.
 */
export function getMeasurementStartMs(): number {
  if (typeof global.startTs !== 'number') {
    return Date.now()
  }
  return Date.now() - (getTsUs() - global.startTs) / 1000
}

function ascFormat(method: string[]): winston.Logform.Format {
  return format((info: any, opts: any) => {
    if (typeof info.message === 'string') {
      return info
    }
    const method = info.message.method
    if (opts.method.indexOf(method) == -1) {
      return false
    }

    const channel = global.deviceIndexMap.get(info.message.deviceId) ?? 1
    const data = info.message.data
    const seconds = data.ts / 1000_000

    let messageLine = ''

    switch (method) {
      case 'canBase':
        messageLine = formatCanMessage(data, channel, seconds)
        break
      case 'linBase':
        messageLine = formatLinMessage(data, channel, seconds)
        break
      case 'linError':
        messageLine = formatLinError(data.msg, data.data, channel, seconds)
        break
      case 'linEvent':
        messageLine = formatLinEvent(data.msg, channel, seconds)
        break
      case 'canError':
        messageLine = formatCanError(channel, seconds)
        break
    }
    if (!messageLine) {
      return false
    }

    info[Symbol.for('message')] = messageLine
    return info
  })({
    method: method
  })
}

class FileTransport extends winston.transports.File {
  devices: string[]
  isinit = false
  closed = false

  constructor(opts: winston.transports.FileTransportOptions, devices: string[]) {
    super(opts)
    this.devices = devices
  }

  log(info: any, callback: any) {
    if (this.closed) {
      callback()
      return
    }
    if (super.log) {
      if (this.isinit == false) {
        const header = formatAscHeader(new Date(getMeasurementStartMs()))
        super.log({ level: 'info', [Symbol.for('message')]: header }, () => {})
        this.isinit = true
      }

      super.log(info, callback)
    }
  }

  public close(): void {
    if (this.isinit && super.log) {
      super.log({ level: 'info', [Symbol.for('message')]: ASC_END }, () => {})
    }
    if (super.close) {
      super.close()
    }
    this.closed = true
  }
}

export default (filePath: string, devices: string[], method: string[]) => {
  return new FileTransport(
    {
      format: ascFormat(method),
      filename: filePath,
      eol: ASC_EOL,
      options: {
        flags: 'w'
      },
      level: 'debug'
    },
    devices
  )
}
