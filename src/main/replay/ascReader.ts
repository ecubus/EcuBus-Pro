import { ReplayCanFrame, ReplayReader } from '.'
import fs from 'fs'
import { Transform, TransformCallback } from 'stream'
import { CAN_ID_TYPE } from '../share/can'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** CAN FD `<Flags>` bits */
const FLAG_REMOTE = 1 << 4
const FLAG_FDF = 1 << 12

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  mär: 2,
  mrz: 2,
  apr: 3,
  may: 4,
  mai: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  okt: 9,
  nov: 10,
  dec: 11,
  dez: 11
}

/**
 * Parse the `date` header as local time, e.g. `Wed Apr 16 09:21:13.159 am 2014`
 * or `Die Dez 21 11:29:01 2004`.
 * @returns ms since epoch, or undefined if the text is not recognized
 */
export function parseAscDate(text: string): number | undefined {
  const m = text.match(
    /^\S+\s+(\S+)\s+(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:\s+(am|pm))?\s+(\d{4})$/i
  )
  if (!m) return undefined
  const month = MONTHS[m[1].toLowerCase().slice(0, 3)]
  if (month === undefined) return undefined
  let hour = parseInt(m[3])
  const ampm = m[7]?.toLowerCase()
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  const ms = m[6] ? parseInt(m[6].padEnd(3, '0')) : 0
  return new Date(
    parseInt(m[8]),
    month,
    parseInt(m[2]),
    hour,
    parseInt(m[4]),
    parseInt(m[5]),
    ms
  ).getTime()
}

function isDir(text: string | undefined): boolean {
  return text === 'Rx' || text === 'Tx'
}

/** Whether `<BRS> <ESI> <DLC> <DataLength>` starts at `i` */
function isFdFieldStart(tokens: string[], i: number): boolean {
  return (
    /^[01]$/.test(tokens[i] ?? '') &&
    /^[01]$/.test(tokens[i + 1] ?? '') &&
    /^[0-9a-f]{1,2}$/i.test(tokens[i + 2] ?? '') &&
    /^\d+$/.test(tokens[i + 3] ?? '')
  )
}

function errorFrame(channel: number, ts: number, dir: 'IN' | 'OUT'): ReplayCanFrame {
  return {
    channel,
    ts,
    id: 0,
    dir,
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
 * Transform stream: Buffer (file chunks) -> ReplayCanFrame (objectMode).
 * Applies time-based backpressure and tracks progress by bytes *parsed per line*,
 * so progress follows actual replay instead of raw file read speed.
 */
export class AscTransform extends Transform {
  private lineBuffer = ''
  private lineCount = 0
  private speedFactor: number
  private startTime = 0
  private firstFrameTs = -1
  /** Bytes of input consumed (for progress) */
  bytesRead = 0
  /** Measurement start time from file header (ms since epoch, UTC) */
  measurementStartTimeMs = 0
  /** Number base from the `base hex|dec` header */
  private base = 16
  /** `timestamps relative`: each timestamp is relative to the preceding event */
  private relative = false
  private lastTs = 0

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

  /** Add paused duration to startTime so applyTimeBackpressure elapsed time does not include pause. */
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

  /**
   * Apply time backpressure, then push frame.
   */
  private async pushFrame(frame: ReplayCanFrame): Promise<void> {
    await this.applyTimeBackpressure(frame)
    this.push(frame)
  }

  _transform(chunk: Buffer, _encoding: string, callback: TransformCallback): void {
    const run = async (): Promise<void> => {
      this.lineBuffer += chunk.toString('utf8')
      const lines = this.lineBuffer.split('\n')
      this.lineBuffer = lines.pop() ?? ''

      for (const line of lines) {
        // Approximate bytes consumed for this line (+ newline) for progress tracking
        this.bytesRead += Buffer.byteLength(line, 'utf8') + 1
        const frame = this.parseLine(line)
        if (frame) {
          await this.pushFrame(frame)
        }
      }
      callback()
    }
    run().catch((err) => callback(err))
  }

  _flush(callback: TransformCallback): void {
    const run = async (): Promise<void> => {
      const lineText = this.lineBuffer
      const trimmed = lineText.trim()
      if (trimmed) {
        // Count remaining buffered line bytes towards progress
        this.bytesRead += Buffer.byteLength(lineText, 'utf8')
        const frame = this.parseLine(trimmed)
        if (frame) {
          await this.pushFrame(frame)
        }
      }
      callback()
    }
    run().catch((err) => callback(err))
  }

  private toTimestampUs(seconds: number): number {
    const us = Math.round(seconds * 1_000_000)
    if (!this.relative) return us
    this.lastTs += us
    return this.lastTs
  }

  private parseLine(line: string): ReplayCanFrame | null {
    const trimmed = line.trim()
    if (!trimmed) {
      return null
    }
    const tokens = trimmed.split(/\s+/)
    if (tokens[0] === 'date') {
      const ms = parseAscDate(trimmed.substring(5).trim())
      if (ms !== undefined) {
        this.measurementStartTimeMs = ms
      }
      return null
    }
    if (tokens[0] === 'base') {
      this.base = tokens[1] === 'dec' ? 10 : 16
      this.relative = tokens[3] === 'relative'
      return null
    }
    if (!/^\d+(\.\d+)?$/.test(tokens[0])) {
      return null
    }

    this.lineCount++
    const ts = this.toTimestampUs(parseFloat(tokens[0]))

    if (tokens[1] === 'CANFD') {
      return this.parseCanFdLine(tokens, ts, trimmed)
    }
    if (!/^\d+$/.test(tokens[1] ?? '')) {
      return null
    }
    const channel = parseInt(tokens[1])
    if (tokens[2] === 'ErrorFrame') {
      return errorFrame(channel, ts, 'IN')
    }
    if (isDir(tokens[3]) && /^[dr]$/i.test(tokens[4] ?? '')) {
      return this.parseCanLine(tokens, channel, ts, trimmed)
    }
    return null
  }

  private parseId(text: string): { id: number; extended: boolean } | null {
    const extended = /x$/i.test(text)
    const digits = extended ? text.slice(0, -1) : text
    const valid = this.base === 16 ? /^[0-9a-f]+$/i : /^\d+$/
    if (!valid.test(digits)) return null
    return { id: parseInt(digits, this.base), extended }
  }

  private parseNumber(text: string | undefined, line: string): number {
    const valid = this.base === 16 ? /^[0-9a-f]{1,2}$/i : /^\d{1,3}$/
    if (text === undefined || !valid.test(text)) {
      throw new Error(`Invalid ASC line: ${line}`)
    }
    return parseInt(text, this.base)
  }

  private parseData(tokens: string[], start: number, count: number, line: string): Buffer {
    const data = Buffer.alloc(count)
    for (let i = 0; i < count; i++) {
      const value = this.parseNumber(tokens[start + i], line)
      if (value > 0xff) throw new Error(`Invalid ASC line: ${line}`)
      data[i] = value
    }
    return data
  }

  /** `<Time> <Channel> <ID> <Dir> d <DLC> <D0>...` or `<Time> <Channel> <ID> <Dir> r [<DLC>]` */
  private parseCanLine(
    tokens: string[],
    channel: number,
    ts: number,
    line: string
  ): ReplayCanFrame | null {
    const arbId = this.parseId(tokens[2])
    if (!arbId) return null
    const remote = tokens[4].toLowerCase() === 'r'

    let dlc = 0
    let data: Buffer = Buffer.alloc(0)
    if (remote) {
      // Remote frames written before v8.5 carry no DLC
      if (tokens[5] !== undefined && tokens[5] !== 'Length') {
        dlc = this.parseNumber(tokens[5], line)
      }
    } else {
      dlc = this.parseNumber(tokens[5], line)
      data = this.parseData(tokens, 6, Math.min(dlc, 8), line)
    }

    return {
      channel,
      ts,
      id: arbId.id,
      dir: tokens[3].toUpperCase() === 'TX' ? 'OUT' : 'IN',
      msgType: {
        idType: arbId.extended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false,
        remote
      },
      dlc,
      data
    }
  }

  /**
   * Current: `<Time> CANFD <Ch> <Dir> <ID> [<SymbolicName>] <BRS> <ESI> <DLC> <DataLength> <D1>...
   * <MessageDuration> <MessageLength> <Flags> ...`
   * Legacy (spec 3.2 example): `<Time> CANFD <Ch> <ID> <Dir> <BRS> <ESI> d|r <DLC> [<DataLength> <D1>...]`
   */
  private parseCanFdLine(tokens: string[], ts: number, line: string): ReplayCanFrame | null {
    if (!/^\d+$/.test(tokens[2] ?? '')) return null
    const channel = parseInt(tokens[2])
    if (isDir(tokens[3]) && tokens[4] === 'ErrorFrame') {
      return errorFrame(channel, ts, tokens[3].toUpperCase() === 'TX' ? 'OUT' : 'IN')
    }

    let dirText: string
    let idText: string
    let brs: boolean
    let esi: boolean
    let dlc: number
    let remote = false
    let canfd = true
    let data: Buffer = Buffer.alloc(0)

    if (isDir(tokens[3])) {
      dirText = tokens[3]
      idText = tokens[4]
      // Skip the optional symbolic name
      let i = 5
      if (!isFdFieldStart(tokens, i)) i++
      if (!isFdFieldStart(tokens, i)) return null
      brs = tokens[i] === '1'
      esi = tokens[i + 1] === '1'
      dlc = this.parseNumber(tokens[i + 2], line)
      const dataLength = parseInt(tokens[i + 3], 10)
      if (dataLength > 64) throw new Error(`Invalid ASC line: ${line}`)
      data = this.parseData(tokens, i + 4, dataLength, line)
      const flagsText = tokens[i + 4 + dataLength + 2]
      if (flagsText !== undefined && /^[0-9a-f]+$/i.test(flagsText)) {
        const flags = parseInt(flagsText, 16)
        canfd = (flags & FLAG_FDF) !== 0
        remote = (flags & FLAG_REMOTE) !== 0
      }
    } else if (isDir(tokens[4])) {
      idText = tokens[3]
      dirText = tokens[4]
      brs = tokens[5] === '1'
      esi = tokens[6] === '1'
      remote = tokens[7]?.toLowerCase() === 'r'
      dlc = this.parseNumber(tokens[8], line)
      if (!remote) {
        const dataLength = parseInt(tokens[9], 10)
        if (!(dataLength <= 64)) throw new Error(`Invalid ASC line: ${line}`)
        data = this.parseData(tokens, 10, dataLength, line)
      }
    } else {
      return null
    }

    const arbId = this.parseId(idText)
    if (!arbId) return null

    return {
      channel,
      ts,
      id: arbId.id,
      dir: dirText.toUpperCase() === 'TX' ? 'OUT' : 'IN',
      msgType: {
        idType: arbId.extended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
        brs: canfd && brs,
        canfd,
        remote,
        esi: canfd && esi
      },
      dlc,
      data: remote ? Buffer.alloc(0) : data
    }
  }
}

/**
 * ASC File Reader - stream-based with time-based backpressure in Transform and downstream backpressure.
 */
export class AscReader implements ReplayReader {
  private filePath: string
  private fileSize = 0
  private _closed = false
  private readStream: fs.ReadStream | null = null
  private transform: AscTransform | null = null
  private frameIterator: AsyncIterator<ReplayCanFrame> | null = null

  private _paused = false
  private pauseStartTime = 0

  constructor(filePath: string, speedFactor: number = 1.0) {
    this.filePath = filePath
    this.initStream(speedFactor)
  }

  get measurementStartTimeMs(): number {
    return this.transform?.measurementStartTimeMs ?? 0
  }

  private initStream(speedFactor: number): void {
    this.transform = new AscTransform(speedFactor)
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
    if (this._closed || !this.frameIterator) {
      return null
    }

    let result: IteratorResult<ReplayCanFrame>
    try {
      result = await this.frameIterator.next()
    } catch (err) {
      // Closing the reader destroys the stream while a read is pending
      if (this._closed) return null
      throw err
    }
    if (result.done) {
      // Ensure progress reaches 100% once stream ends
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
