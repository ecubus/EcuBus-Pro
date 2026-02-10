import { ReplayCanFrame, ReplayReader } from '.'
import fs from 'fs'
import { Transform, TransformCallback } from 'stream'
import { CAN_ID_TYPE } from '../share/can'

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

  private parseLine(line: string): ReplayCanFrame | null {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('date') || trimmed.startsWith('base')) {
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

    const canFdMatch = trimmed.match(
      /^\s*([\d.]+)\s+CANFD\s+(\d+)\s+(Rx|Tx)\s+([0-9A-Fa-fx]+)\s+.*?\s+([01])\s+([01])\s+([0-9a-f])\s+(\d+)\s+((?:[0-9A-Fa-f]{2}\s*)*)/i
    )
    if (canFdMatch) {
      return this.parseCanFdLine(canFdMatch)
    }

    const canMatch = trimmed.match(
      /^\s*([\d.]+)\s+(\d+)\s+([0-9A-Fa-fx]+)\s+(Rx|Tx)\s+([dr])\s+([0-9a-f])\s*((?:[0-9A-Fa-f]{2}\s*)*)/i
    )
    if (canMatch) {
      return this.parseCanLine(canMatch)
    }

    if (trimmed.includes('ErrorFrame')) {
      const errorMatch = trimmed.match(/^\s*([\d.]+)\s+(\d+)\s+ErrorFrame/i)
      if (errorMatch) {
        return {
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

    try {
      const result = await this.frameIterator.next()
      if (result.done) {
        // Ensure progress reaches 100% once stream ends
        if (this.transform) {
          this.transform.bytesRead = this.fileSize
        }
        return null
      }
      return result.value as ReplayCanFrame
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
