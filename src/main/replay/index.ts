import path from 'path'
import { CAN_ID_TYPE, CanMessage, getTsUs } from '../share/can'
import { LinChecksumType, LinDirection, LinMsg } from '../share/lin'
import { ReplayLOG } from '../log'
import type { ReplayItem, ReplayFileFormat, ReplayChannelMap } from 'src/preload/data'
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
 * Parsed LIN frame from replay file
 */
export type ReplayLinFrame = {
  /** Timestamp in microseconds */
  ts: number
  /** Channel number from log file (LIN channels use offset 100+) */
  channel: number
  /** LIN Frame ID (0-63) */
  frameId: number
  /** Direction */
  dir: 'Tx' | 'Rx'
  /** Frame data */
  data: Buffer
  /** Data length */
  dlc: number
  /** Checksum type */
  checksumType: LinChecksumType
  /** Checksum value */
  checksum?: number
  /** Is error frame */
  isError?: boolean
  /** Error type description */
  errorType?: string
}

/**
 * Discriminated union for replay frames
 */
export type ReplayFrame =
  | { type: 'can'; frame: ReplayCanFrame }
  | { type: 'lin'; frame: ReplayLinFrame }

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
  readFrame(): Promise<ReplayFrame | null>
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
  private channelIdMap: Map<number, ReplayChannelMap> = new Map()
  private tsOffset: number = 0
  private measurementStartTimeMs: number = 0
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
    if (channelMap) {
      this.channelIdMap.set(logChannel, channelMap)
    }
    return channelMap
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
        const result = await this.reader.readFrame()

        if (result === null) {
          // End of file
          await this.handleStreamEnd()
          if (this.state !== 'running') {
            break
          }
          continue
        }
        this.processReplayFrame(result)
      } catch (error: any) {
        this.log.error(error.message)
        this.stop()
        break
      }
    }
  }

  private processReplayFrame(result: ReplayFrame): void {
    // Common progress tracking
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

    if (result.type === 'can') {
      this.processCanFrame(result.frame)
    } else if (result.type === 'lin') {
      this.processLinFrame(result.frame)
    }
  }

  private processCanFrame(frame: ReplayCanFrame): void {
    const channelMap = this.findChannelMap(frame.channel)
    if (channelMap) {
      for (const deviceId of channelMap.deviceIds) {
        const base = this.canBaseMap.get(deviceId)
        if (base) {
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
  }

  private processLinFrame(frame: ReplayLinFrame): void {
    const channelMap = this.findChannelMap(frame.channel)
    if (!channelMap) return

    for (const deviceId of channelMap.deviceIds) {
      const base = this.linBaseMap.get(deviceId)
      if (!base) continue

      const linMsg: LinMsg = {
        frameId: frame.frameId,
        data: frame.data,
        direction: frame.dir === 'Tx' ? LinDirection.SEND : LinDirection.RECV,
        checksumType: frame.checksumType,
        checksum: frame.checksum,
        ts: frame.ts + this.tsOffset
      }

      // Enrich with LDF database info (frame name + signal values)
      if (base.info.database) {
        this.enrichLinMsg(linMsg, base.info.database)
      }

      if (this.config.mode === 'offline') {
        base.log.linBase(linMsg)
      } else {
        // Online mode: send via hardware (only works for Master mode)
        base.write(linMsg).catch((e: any) => this.log.error(e.message))
      }
    }
  }

  /**
   * Enrich a LinMsg with frame name and decoded signal values from LDF database.
   */
  private enrichLinMsg(msg: LinMsg, databaseId: string): void {
    const cacheKey = `lin|${databaseId}|${msg.frameId}`
    let cachedFrame = this.frameDbInfoCache.get(cacheKey)
    if (cachedFrame === undefined) {
      const db = global.dataSet?.database?.lin?.[databaseId]
      if (db && db.frames) {
        const ldfFrame = Object.values(db.frames).find((f: any) => f.id === msg.frameId) as
          | { name: string; id: number; signals: { name: string; offset: number }[] }
          | undefined
        cachedFrame = ldfFrame ? { database: databaseId, name: ldfFrame.name } : null
      } else {
        cachedFrame = null
      }
      this.frameDbInfoCache.set(cacheKey, cachedFrame)
    }
    if (!cachedFrame) return

    msg.name = cachedFrame.name
    msg.database = cachedFrame.database

    // Decode signals
    const db = global.dataSet?.database?.lin?.[databaseId]
    if (!db) return

    const ldfFrame = Object.values(db.frames).find((f: any) => f.id === msg.frameId) as
      | { name: string; signals: { name: string; offset: number }[] }
      | undefined
    if (!ldfFrame || !ldfFrame.signals) return

    // Build reverse map: signalName → encodingTypeName
    const sigToEncoding: Record<string, string> = {}
    if (db.signalRep) {
      for (const [encName, sigNames] of Object.entries(db.signalRep)) {
        for (const sn of sigNames as string[]) {
          sigToEncoding[sn] = encName
        }
      }
    }

    const signals: Record<string, any> = {}
    for (const sigRef of ldfFrame.signals) {
      const sigDef = db.signals[sigRef.name]
      if (!sigDef) continue

      const bitOffset = sigRef.offset
      const bitLength = sigDef.signalSizeBits
      // Read raw value (LIN is always little-endian)
      let rawValue = 0
      let startByte = Math.floor(bitOffset / 8)
      let startBitInByte = bitOffset % 8
      let remaining = bitLength
      let valueIndex = 0
      while (remaining > 0 && startByte < msg.data.length) {
        const bits = Math.min(8 - startBitInByte, remaining)
        const mask = (1 << bits) - 1
        const v = (msg.data[startByte] >> startBitInByte) & mask
        rawValue |= v << valueIndex
        remaining -= bits
        valueIndex += bits
        startByte++
        startBitInByte = 0
      }

      // Apply encoding type for physical value
      let physValue: number | string = rawValue
      let physValueEnum: string | undefined
      const encName = sigToEncoding[sigRef.name]
      if (encName && db.signalEncodeTypes?.[encName]) {
        const enc = db.signalEncodeTypes[encName]
        for (const et of enc.encodingTypes) {
          if (et.type === 'physicalValue' && et.physicalValue) {
            const pv = et.physicalValue
            if (rawValue >= pv.minValue && rawValue <= pv.maxValue) {
              physValue = rawValue * pv.scale + pv.offset
              break
            }
          } else if (et.type === 'logicalValue' && et.logicalValue) {
            if (rawValue === et.logicalValue.signalValue) {
              physValueEnum = et.logicalValue.textInfo || ''
              physValue = physValueEnum || rawValue
              break
            }
          }
        }
      }

      signals[sigRef.name] = {
        signalName: sigRef.name,
        signalSizeBits: bitLength,
        initValue: sigDef.initValue,
        value: rawValue,
        physValue,
        physValueEnum
      }
    }
    msg.signals = signals
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
