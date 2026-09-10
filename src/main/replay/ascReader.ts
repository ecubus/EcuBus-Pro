import { ReplayCanFrame, ReplayFrame, ReplayLinFrame, ReplayReader } from '.'
import fs from 'fs'
import { Transform, TransformCallback } from 'stream'
import { CAN_ID_TYPE } from '../share/can'
import { LinChecksumType } from '../share/lin'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  /**
   * Apply time backpressure, then push frame.
   */
  private async pushFrame(result: ReplayFrame): Promise<void> {
    const ts = result.type === 'can' ? result.frame.ts : result.frame.ts
    await this.applyTimeBackpressure(ts)
    this.push(result)
  }

  _transform(chunk: Buffer, _encoding: string, callback: TransformCallback): void {
    const run = async (): Promise<void> => {
      this.lineBuffer += chunk.toString('utf8')
      const lines = this.lineBuffer.split('\n')
      this.lineBuffer = lines.pop() ?? ''

      for (const line of lines) {
        // Approximate bytes consumed for this line (+ newline) for progress tracking
        this.bytesRead += Buffer.byteLength(line, 'utf8') + 1
        const result = this.parseLine(line)
        if (result) {
          await this.pushFrame(result)
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
        const result = this.parseLine(trimmed)
        if (result) {
          await this.pushFrame(result)
        }
      }
      callback()
    }
    run().catch((err) => callback(err))
  }

  private parseLine(line: string): ReplayFrame | null {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('base')) {
      return null
    }
    if (trimmed.startsWith('date')) {
      // Parse: "date Mon Jan 01 12:00:00.000 2024" or similar
      const dateStr = trimmed.substring(5).trim()
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        this.measurementStartTimeMs = d.getTime()
      }
      return null
    }
    if (
      trimmed.startsWith('internal') ||
      trimmed.startsWith('Begin') ||
      trimmed.startsWith('End')
    ) {
      return null
    }

    this.lineCount++

    // Try LIN message match first (channel is "Li" or "L<n>")
    const linMatch = trimmed.match(
      /^\s*([\d.]+)\s+(Li|L\d+)\s+([0-9a-f]{1,2})\s+(Tx|Rx)\s+(\d+)\s+((?:[0-9a-f]{2}\s*)*)\s*checksum\s*=\s*([0-9a-f]{2})\s*(?:CSM\s*=\s*(enhanced|standard))?/i
    )
    if (linMatch) {
      return { type: 'lin', frame: this.parseLinLine(linMatch) }
    }

    // Try LIN error match
    const linErrorMatch = trimmed.match(
      /^\s*([\d.]+)\s+(Li|L\d+)\s+([0-9a-f]{1,2})\s+(CSErr|TransmErr|SyncError|RcvError)/i
    )
    if (linErrorMatch) {
      return { type: 'lin', frame: this.parseLinErrorLine(linErrorMatch) }
    }

    const canFdMatch = trimmed.match(
      /^\s*([\d.]+)\s+CANFD\s+(\d+)\s+(Rx|Tx)\s+([0-9A-Fa-fx]+)\s+.*?\s+([01])\s+([01])\s+([0-9a-f])\s+(\d+)\s+((?:[0-9A-Fa-f]{2}\s*)*)/i
    )
    if (canFdMatch) {
      return { type: 'can', frame: this.parseCanFdLine(canFdMatch) }
    }

    const canMatch = trimmed.match(
      /^\s*([\d.]+)\s+(\d+)\s+([0-9A-Fa-fx]+)\s+(Rx|Tx)\s+([dr])\s+([0-9a-f])\s*((?:[0-9A-Fa-f]{2}\s*)*)/i
    )
    if (canMatch) {
      return { type: 'can', frame: this.parseCanLine(canMatch) }
    }

    if (trimmed.includes('ErrorFrame')) {
      const errorMatch = trimmed.match(/^\s*([\d.]+)\s+(\d+)\s+ErrorFrame/i)
      if (errorMatch) {
        return {
          type: 'can',
          frame: {
            channel: parseInt(errorMatch[2]),
            ts: Math.round(parseFloat(errorMatch[1]) * 1_000_000),
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
      }
    }

    return null
  }

  private parseCanLine(match: RegExpMatchArray): ReplayCanFrame {
    const timestamp = parseFloat(match[1])
    const channel = parseInt(match[2])
    const idStr = match[3]
    const dir = match[4].toUpperCase()
    const frameType = match[5].toLowerCase()
    const dataStr = match[7]?.trim() || ''

    const isExtended = idStr.toLowerCase().endsWith('x')
    const id = parseInt(idStr.replace(/x$/i, ''), 16)
    const isRemote = frameType === 'r'

    let data = Buffer.alloc(0)
    if (!isRemote && dataStr) {
      const bytes = dataStr.split(/\s+/).filter((b) => b.length > 0)
      data = Buffer.from(bytes.map((b) => parseInt(b, 16)))
    }

    return {
      channel,
      ts: Math.round(timestamp * 1_000_000),
      id,
      dir: dir === 'TX' ? 'OUT' : 'IN',
      msgType: {
        idType: isExtended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false,
        remote: isRemote
      },
      data
    }
  }

  private parseCanFdLine(match: RegExpMatchArray): ReplayCanFrame {
    const timestamp = parseFloat(match[1])
    const channel = parseInt(match[2])
    const dir = match[3].toUpperCase()
    const idStr = match[4]
    const brs = match[5] === '1'
    const dataStr = match[9]?.trim() || ''

    const isExtended = idStr.toLowerCase().endsWith('x')
    const id = parseInt(idStr.replace(/x$/i, ''), 16)

    let data = Buffer.alloc(0)
    if (dataStr) {
      const bytes = dataStr.split(/\s+/).filter((b) => b.length > 0)
      data = Buffer.from(bytes.map((b) => parseInt(b, 16)))
    }

    return {
      channel,
      ts: Math.round(timestamp * 1_000_000),
      id,
      dir: dir === 'TX' ? 'OUT' : 'IN',
      msgType: {
        idType: isExtended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
        brs,
        canfd: true,
        remote: false
      },
      data
    }
  }

  /** Parse LIN channel string (Li -> 101, L2 -> 102, etc.) */
  private parseLinChannel(channelStr: string): number {
    if (channelStr.toLowerCase() === 'li') return 101
    const num = parseInt(channelStr.substring(1))
    return 100 + (isNaN(num) ? 1 : num)
  }

  private parseLinLine(match: RegExpMatchArray): ReplayLinFrame {
    const timestamp = parseFloat(match[1])
    const channelStr = match[2]
    const frameId = parseInt(match[3], 16)
    const dir = match[4] as 'Tx' | 'Rx'
    const dlc = parseInt(match[5])
    const dataStr = match[6]?.trim() || ''
    const checksum = parseInt(match[7], 16)
    const csmStr = match[8]?.toLowerCase()

    let data = Buffer.alloc(0)
    if (dataStr) {
      const bytes = dataStr.split(/\s+/).filter((b) => b.length > 0)
      data = Buffer.from(bytes.map((b) => parseInt(b, 16)))
    }

    const checksumType = csmStr === 'standard' ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED

    return {
      ts: Math.round(timestamp * 1_000_000),
      channel: this.parseLinChannel(channelStr),
      frameId,
      dir,
      data,
      dlc,
      checksumType,
      checksum
    }
  }

  private parseLinErrorLine(match: RegExpMatchArray): ReplayLinFrame {
    const timestamp = parseFloat(match[1])
    const channelStr = match[2]
    const frameId = parseInt(match[3], 16)
    const errorType = match[4]

    return {
      ts: Math.round(timestamp * 1_000_000),
      channel: this.parseLinChannel(channelStr),
      frameId,
      dir: 'Rx',
      data: Buffer.alloc(0),
      dlc: 0,
      checksumType: LinChecksumType.ENHANCED,
      isError: true,
      errorType
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
  private frameIterator: AsyncIterator<ReplayFrame> | null = null

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

  async readFrame(): Promise<ReplayFrame | null> {
    if (this._closed || !this.frameIterator) {
      return null
    }

    try {
      const result = await this.frameIterator.next()
      if (result.done) {
        // Ensure progress reaches 100% once stream ends
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
