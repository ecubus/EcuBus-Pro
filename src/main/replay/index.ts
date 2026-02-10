import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { CAN_ID_TYPE, CanMessage, getTsUs } from '../share/can'
import { ReplayLOG } from '../log'
import type { ReplayItem, ReplayFileFormat, ReplayChannelMap } from 'src/preload/data'
import { AscReader } from './ascReader'
import { DOIP } from '../doip'
import { CanBase } from '../docan/base'
import LinBase from '../dolin/base'
import { EthBaseInfo } from '../share/doip'
import { PwmBase } from '../pwm'
import { VSomeIP_Client } from '../vsomeip'
import i18next from 'i18next'

// ---- BLF Constants (layout matches src/main/transport/blf.ts writer) ----
const FILE_HEADER_SIZE = 144
const OBJ_HEADER_BASE_SIZE = 16
const OBJ_HEADER_V1_SIZE = 16
const LOG_CONTAINER_HEADER_SIZE = 16

const CAN_MESSAGE = 1
const LOG_CONTAINER = 10
const CAN_ERROR_EXT = 73
const CAN_MESSAGE2 = 86
const CAN_FD_MESSAGE = 100

const NO_COMPRESSION = 0
const ZLIB_DEFLATE = 2

const CAN_MSG_EXT = 0x80000000
const REMOTE_FLAG = 0x80
const DIR_FLAG = 0x1
const EDL_FLAG = 0x1
const BRS_FLAG = 0x2
const TIME_ONE_NANS = 0x00000002

/** Object payload padding to 4-byte boundary (same as writer padData) */
function blfPadSize(len: number): number {
  const mod = len % 4
  return mod === 0 ? 0 : 4 - mod
}

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
  private channelIdMap: Map<number, ReplayChannelMap> = new Map()
  private tsOffset: number = 0
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
      default:
        throw new Error(`Reader not implemented for format: ${this.config.format}`)
    }
  }

  private findChannelMap(logChannel: number): ReplayChannelMap | undefined {
    if (this.channelIdMap.has(logChannel)) {
      return this.channelIdMap.get(logChannel)
    }
    const channelMap = this.config.channelMap?.find((m) => m.logChannel === logChannel)
    if (channelMap) {
      this.channelIdMap.set(logChannel, channelMap)
    }
    return channelMap
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
    if (this.reader) {
      const progress = this.reader.getProgress()
      const intPercent = Math.floor(progress.percent)
      if (this.lastProgressPercent === null || intPercent !== this.lastProgressPercent) {
        this.lastProgressPercent = intPercent
        this.log.progress(progress.current, progress.total, intPercent, this.currentRepeat)
      }
    }
    const channelMap = this.findChannelMap(frame.channel)
    if (channelMap) {
      for (const deviceId of channelMap.deviceIds) {
        const base = this.canBaseMap.get(deviceId)
        if (base) {
          if (this.config.mode == 'offline') {
            frame.ts += this.tsOffset
            base.log.canBase(frame)
          }
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
