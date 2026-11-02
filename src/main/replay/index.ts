import path from 'path'
import { CAN_ID_TYPE, CanMessage, getTsUs } from '../share/can'
import { ReplayLOG } from '../log'
import type {
  ReplayItem,
  ReplayFileFormat,
  ReplayChannelMap,
  ReplayLogChannelScan
} from 'src/preload/data'
import { AscReader } from './ascReader'
import { BlfReader } from './blfReader'
import { DOIP } from '../doip'
import { CanBase } from '../docan/base'
import LinBase from '../dolin/base'
import { EthBaseInfo } from '../share/doip'
import { PwmBase } from '../pwm'
import { VSomeIP_Client } from '../vsomeip'
import i18next from 'i18next'

/**
 * Parsed CAN frame from replay file
 * Extends CanMessage with required ts and additional channel/isError fields
 */
export type ReplayCanFrame = Omit<CanMessage, 'ts'> & {
  /** Timestamp in microseconds (required for replay) */
  ts: number
  /** Channel number from log file */
  channel: number
  /** Is error frame */
  isError?: boolean
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Reader interface for replay files
 */
export interface ReplayReader {
  init(): { total: number }
  /**
   * Read next frame with time-based backpressure
   * The reader will delay based on frame timestamps to simulate real-time playback
   */
  readFrame(): Promise<ReplayCanFrame | null>
  getProgress(): { current: number; total: number; percent: number }
  /** Set playback speed factor (1.0 = normal, 2.0 = 2x, 0 = as fast as possible) */
  setSpeedFactor(factor: number): void
  /** Pause the reader - readFrame() will block until resumed */
  pause(): void
  /** Resume the reader */
  resume(): void
  close(): void
  /** Measurement start time in ms since epoch (UTC), if available from file header */
  measurementStartTimeMs?: number
}

/**
 * Replay state
 */
export type ReplayState = 'idle' | 'running' | 'paused' | 'stopped' | 'completed'

/**
 * Main Replay class - orchestrates file reading
 * Time-based backpressure is handled internally by the readers
 */
export class Replay {
  private config: ReplayItem
  private reader: ReplayReader | null = null
  private log: ReplayLOG
  private state: ReplayState = 'idle'
  private currentRepeat: number = 0
  private speedFactor: number = 1.0
  private runningPromise: Promise<void> | null = null
  private lastProgressPercent: number | null = null
  private channelIdMap: Map<number, ReplayChannelMap | undefined> = new Map()
  private tsOffset: number = 0
  private measurementStartTimeMs: number = 0
  /** Log channels that already produced an unmapped-channel warning. */
  private warnedMissingChannels: Set<number> = new Set()
  private droppedUnmappedFrames = 0
  private dropSummaryEmitted = false
  /** Cache: `${databaseId}|${frameId}|${idType}` -> { database, name } or null (not found) */
  private frameDbInfoCache: Map<string, { database: string; name: string } | null> = new Map()
  constructor(
    config: ReplayItem,
    private projectInfo: { path: string; name: string },
    private canBaseMap: Map<string, CanBase>,
    private linBaseMap: Map<string, LinBase>,
    private doips: DOIP[],
    private ethBaseMap: Map<string, EthBaseInfo>,
    private pwmBaseMap: Map<string, PwmBase>,
    private someipMap: Map<string, VSomeIP_Client>
  ) {
    this.config = config
    this.speedFactor = config.speedFactor ?? 1.0
    this.log = new ReplayLOG(config.id)
    if (!path.isAbsolute(this.config.filePath)) {
      this.config.filePath = path.join(this.projectInfo.path, this.config.filePath)
    }
  }

  private createReader(): ReplayReader {
    switch (this.config.format) {
      case 'asc':
        return new AscReader(this.config.filePath, this.speedFactor)
      case 'blf':
        return new BlfReader(this.config.filePath, this.speedFactor)
      default:
        throw new Error(`Reader not implemented for format: ${this.config.format}`)
    }
  }

  private findChannelMap(logChannel: number): ReplayChannelMap | undefined {
    if (this.channelIdMap.has(logChannel)) {
      return this.channelIdMap.get(logChannel)
    }
    const channelMap = this.config.channelMap?.find((m) => m.logChannel === logChannel)
    // Cache misses too. A log on the wrong channel can be hundreds of thousands of frames.
    this.channelIdMap.set(logChannel, channelMap)
    return channelMap
  }

  private mappedChannelList(): string {
    const mapped = [...new Set((this.config.channelMap ?? []).map((item) => item.logChannel))].sort(
      (a, b) => a - b
    )
    if (mapped.length === 0) {
      return i18next.t('uds.network.replayConfig.messages.noMappedChannels')
    }
    return mapped.join(', ')
  }

  private emitReplayWarning(msg: string): void {
    this.log.warn(msg)
    global.sysLog.warn(msg)
  }

  /**
   * Frames with no channelMap row are ignored. Warn once per missing channel so a
   * long log does not flood the system log, and count the drops for the summary.
   */
  private noteUnmappedFrame(logChannel: number): void {
    this.droppedUnmappedFrames++
    if (this.warnedMissingChannels.has(logChannel)) return
    this.warnedMissingChannels.add(logChannel)
    this.emitReplayWarning(
      i18next.t('uds.network.replayConfig.messages.unmappedChannel', {
        name: this.config.name,
        channel: logChannel,
        mapped: this.mappedChannelList()
      })
    )
  }

  private finishDropReport(): void {
    if (this.dropSummaryEmitted) return
    this.dropSummaryEmitted = true
    if (this.droppedUnmappedFrames === 0) return
    const channels = [...this.warnedMissingChannels].sort((a, b) => a - b).join(', ')
    this.emitReplayWarning(
      i18next.t('uds.network.replayConfig.messages.droppedFrames', {
        name: this.config.name,
        count: this.droppedUnmappedFrames,
        channels
      })
    )
  }

  /**
   * Get database info for a frame by CAN id. Uses cache to avoid repeated lookups.
   * Returns undefined if base has no database or frame id not found in database.
   */
  private getFrameDbInfo(
    databaseId: string,
    frame: ReplayCanFrame
  ): { database: string; name: string } | undefined {
    const cacheKey = `${databaseId}|${frame.id}|${frame.msgType.idType}`
    const cached = this.frameDbInfoCache.get(cacheKey)
    if (cached !== undefined) {
      return cached ?? undefined
    }
    const db = global.dataSet?.database?.can?.[databaseId]
    if (!db) {
      this.frameDbInfoCache.set(cacheKey, null)
      return undefined
    }
    const isExtended = frame.msgType.idType === CAN_ID_TYPE.EXTENDED
    const msg = db.messages.find((m) => m.id === frame.id && m.is_extended_frame === isExtended)
    const result = msg ? { database: databaseId, name: msg.name } : null
    this.frameDbInfoCache.set(cacheKey, result)
    return result ?? undefined
  }

  /**
   * Start replay
   */
  start() {
    if (this.state === 'running') {
      return
    }

    try {
      this.reader = this.createReader()
      this.reader.init()
      this.channelIdMap.clear()
      this.warnedMissingChannels.clear()
      this.droppedUnmappedFrames = 0
      this.dropSummaryEmitted = false

      this.state = 'running'
      this.currentRepeat = 0
      this.tsOffset = getTsUs() - global.startTs
      // Run the replay loop
      this.runningPromise = this.runLoop()
      this.log.start(this.config.filePath, this.config.format)
    } catch (error: any) {
      global.sysLog.error(
        i18next.t('uds.network.replayConfig.messages.startFailed', { msg: error.message })
      )
      this.stop(error.message)
      throw error
    }
  }

  /**
   * Main replay loop - reads frames with time-based backpressure from reader
   */
  private async runLoop(): Promise<void> {
    while (this.state === 'running' && this.reader) {
      try {
        // Reader handles time-based backpressure internally
        const frame = await this.reader.readFrame()

        if (frame === null) {
          // End of file
          await this.handleStreamEnd()
          if (this.state !== 'running') {
            break
          }
          continue
        }
        this.processReplayFrame(frame)
      } catch (error: any) {
        this.log.error(error.message)
        this.stop()
        break
      }
    }
  }

  private processReplayFrame(frame: ReplayCanFrame): void {
    // Lazily capture measurement start time after header is parsed
    if (this.measurementStartTimeMs === 0 && this.reader?.measurementStartTimeMs) {
      this.measurementStartTimeMs = this.reader.measurementStartTimeMs
    }
    if (this.reader) {
      const progress = this.reader.getProgress()
      const intPercent = Math.floor(progress.percent)
      if (this.lastProgressPercent === null || intPercent !== this.lastProgressPercent) {
        this.lastProgressPercent = intPercent
        this.log.progress(progress.current, progress.total, intPercent, this.currentRepeat)
      }
    }
    const channelMap = this.findChannelMap(frame.channel)
    if (!channelMap) {
      this.noteUnmappedFrame(frame.channel)
      return
    }
    for (const deviceId of channelMap.deviceIds) {
      const base = this.canBaseMap.get(deviceId)
      if (base && frame.isError) {
        if (this.config.mode == 'offline') {
          base.log.error(frame.ts + this.tsOffset, 'error frame')
        }
      } else if (base) {
        if (base.info.database) {
          const dbInfo = this.getFrameDbInfo(base.info.database, frame)
          if (dbInfo) {
            frame.database = dbInfo.database
            frame.name = dbInfo.name
          }
        }
        if (this.config.mode == 'offline') {
          // Attach original recording time (enabled by default, can be disabled via config)
          if (this.config.useOriginalTime !== false && this.measurementStartTimeMs > 0) {
            frame.originalTs = frame.ts
            const d = new Date(this.measurementStartTimeMs + frame.ts / 1000)
            const y = d.getUTCFullYear()
            const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
            const day = String(d.getUTCDate()).padStart(2, '0')
            const h = String(d.getUTCHours()).padStart(2, '0')
            const mi = String(d.getUTCMinutes()).padStart(2, '0')
            const s = String(d.getUTCSeconds()).padStart(2, '0')
            const ms = String(d.getUTCMilliseconds()).padStart(3, '0')
            frame.absTimeStr = `${y}-${mo}-${day} ${h}:${mi}:${s}.${ms}`
          }
          frame.ts += this.tsOffset
          base.log.canBase(frame)
        }
      }
    }
  }

  private async handleStreamEnd(): Promise<void> {
    if (this.state !== 'running') return

    const repeatCount = this.config.repeatCount ?? 1
    this.currentRepeat++

    if (repeatCount === 0 || this.currentRepeat < repeatCount) {
      // Repeat: close current reader and create new one
      this.reader?.close()
      this.reader = this.createReader()
      this.reader.init()
      this.tsOffset = getTsUs() - global.startTs
    } else {
      // Completed
      this.finishDropReport()
      this.state = 'completed'
      this.log.stop('completed')
      this.cleanup()
    }
  }

  /**
   * Stop replay
   */
  stop(reason?: string): void {
    if (this.state === 'stopped' || this.state === 'idle') {
      return
    }

    this.finishDropReport()
    this.state = 'stopped'
    this.log.stop(reason || 'user stopped')
    this.cleanup()
  }

  /**
   * Pause replay - reader will block on next readFrame()
   */
  pause(): void {
    if (this.state !== 'running') return

    this.state = 'paused'
    this.log.pause()
    this.reader?.pause()
  }

  /**
   * Resume replay
   */
  resume(): void {
    if (this.state !== 'paused') return

    this.state = 'running'
    this.log.resume()
    this.reader?.resume()
  }

  /**
   * Set speed factor - affects reader's time-based backpressure
   */
  setSpeedFactor(factor: number): void {
    this.speedFactor = factor
    this.reader?.setSpeedFactor(factor)
  }

  getState(): ReplayState {
    return this.state
  }

  getProgress(): { current: number; total: number; percent: number; repeat: number } {
    const progress = this.reader?.getProgress() || { current: 0, total: 0, percent: 0 }
    return { ...progress, repeat: this.currentRepeat }
  }

  private cleanup(): void {
    if (this.reader) {
      this.reader.close()
      this.reader = null
    }
  }

  close(): void {
    this.stop('closed')
    this.log.close()
  }
}

export default Replay

/** Frames inspected when suggesting channel-map rows from a log file. */
export const REPLAY_CHANNEL_SCAN_LIMIT = 4096

/**
 * Collect distinct CAN log channels from the start of a replay file.
 * Stops after `limit` frames so picking a large BLF does not read the whole log.
 */
export async function scanReplayLogChannels(
  filePath: string,
  format: 'asc' | 'blf',
  limit = REPLAY_CHANNEL_SCAN_LIMIT
): Promise<ReplayLogChannelScan> {
  const reader: ReplayReader =
    format === 'asc' ? new AscReader(filePath, 0) : new BlfReader(filePath, 0)
  const channels = new Set<number>()
  let scanned = 0
  let truncated = false
  try {
    reader.init()
    let frame: ReplayCanFrame | null
    while (scanned < limit && (frame = await reader.readFrame()) !== null) {
      channels.add(frame.channel)
      scanned++
    }
    if (scanned >= limit) {
      const extra = await reader.readFrame()
      if (extra) {
        channels.add(extra.channel)
        scanned++
        truncated = true
      }
    }
  } finally {
    reader.close()
  }
  return {
    channels: [...channels].sort((a, b) => a - b),
    truncated,
    scanned
  }
}
