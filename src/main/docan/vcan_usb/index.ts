import { EventEmitter } from 'events'
import { cloneDeep } from 'lodash'
import {
  CAN_ERROR_ID,
  CAN_ID_TYPE,
  CanBaseInfo,
  CanDevice,
  CanError,
  CanMessage,
  CanMsgType,
  getTsUs
} from '../../share/can'
import { CanLOG } from '../../log'
import { CanBase } from '../base'
import { resolveVcanUsbPath, VcanUsbPathCandidate } from './devicePath'
import {
  formatVcanUsbSerialNumber,
  getVcanUsbIdentity,
  isVcanUsbIdentitySelector,
  makeVcanUsbIdentitySelector,
  VcanUsbIdentity
} from './identity'
import {
  NativeTransportError,
  VcanUsbAppliedTiming,
  VcanUsbCapabilities,
  VcanUsbDeviceInfo,
  VcanUsbFrame,
  VcanUsbNative,
  VcanUsbRxRecord
} from './native'

interface PendingTransmit {
  resolve: (timestamp: number) => void
  reject: (error: CanError) => void
  id: number
  msgType: CanMsgType
  data: Buffer
  extra?: { database?: string; name?: string }
}

interface PendingRead {
  reject: (error: CanError) => void
  msgType: CanMsgType
  eventName: string
  listener: (message: CanMessage | CanError) => void
  timer: NodeJS.Timeout
}

const STATE_NAMES = [
  'error-active',
  'error-warning',
  'error-passive',
  'bus-off',
  'stopped',
  'sleeping'
]

const ERROR_NAMES = ['none', 'stuff', 'form', 'ack', 'bit1', 'bit0', 'crc', 'no-change']
const identityByPhysicalPath = new Map<string, VcanUsbIdentity>()

function splitHandle(handle: unknown): { path: string; channel: number } {
  const value = String(handle)
  const separator = value.lastIndexOf('|')
  if (separator <= 0) throw new Error('invalid VCAN USB handle')
  const channel = Number(value.slice(separator + 1))
  if (!Number.isInteger(channel) || channel < 0 || channel > 0x0f) {
    throw new Error(`invalid VCAN USB channel in handle: ${value}`)
  }
  return { path: value.slice(0, separator), channel }
}

function formatVersion(version: number) {
  return `${(version >>> 24) & 0xff}.${(version >>> 16) & 0xff}.${
    (version >>> 8) & 0xff
  }.${version & 0xff}`
}

function physicalPath(path: string) {
  const separator = path.lastIndexOf('/')
  return separator > 0 ? path.slice(0, separator) : path
}

function rememberIdentity(path: string, deviceInfo: VcanUsbDeviceInfo) {
  const identity = getVcanUsbIdentity(deviceInfo)
  if (identity) identityByPhysicalPath.set(physicalPath(path), identity)
  return identity
}

function probeIdentity(path: string, channel: number): VcanUsbIdentity | undefined {
  let native: VcanUsbNative | undefined
  try {
    native = VcanUsbNative.open(
      path,
      () => {},
      () => {},
      () => {}
    )
    if (native.interfaceNumber !== channel) return undefined
    return rememberIdentity(path, native.readDeviceInfo())
  } catch {
    return undefined
  } finally {
    native?.close()
  }
}

function listIdentityCandidates(): VcanUsbPathCandidate[] {
  const probed = new Set<string>()
  return VcanUsbNative.listDevices().map((item) => {
    const key = physicalPath(item.path)
    let identity = identityByPhysicalPath.get(key)
    if (!identity && !item.busy && !probed.has(key)) {
      probed.add(key)
      identity = probeIdentity(item.path, item.interfaceNumber)
    }
    return {
      path: item.path,
      interfaceNumber: item.interfaceNumber,
      identitySelector: identity ? makeVcanUsbIdentitySelector(identity) : undefined
    }
  })
}

function formatTiming(name: string, timing: VcanUsbAppliedTiming) {
  const samplePoint = (timing.samplePointPermille / 10).toFixed(1)
  return `${name} requested ${timing.requestedBitrate}, calculated ${timing.actualBitrate} bit/s (BRP ${timing.prescaler}, TSEG1 ${timing.tseg1}, TSEG2 ${timing.tseg2}, SJW ${timing.sjw}, sample ${samplePoint}%; USB zero-based fields ${timing.wirePrescaler}/${timing.wireTseg1}/${timing.wireTseg2}/${timing.wireSjw})`
}

function makeExtra(capabilities: VcanUsbCapabilities, termination?: boolean) {
  return {
    candle: {
      cap: capabilities.nominal,
      dataCap: capabilities.data,
      fdSupported: capabilities.fdSupported,
      Res: capabilities.terminationSupported || termination !== undefined,
      // The HPMicro MCAN/board combination is stable at 1M/2M BRS with 20 TQ.
      // This is only an auto-selection preference; explicitly saved timing is preserved.
      preferredDataTimeQuanta: 20
    }
  }
}

function getVcanUsbDevices(): CanDevice[] {
  const interfaces = VcanUsbNative.listDevices()
  const probedIdentities = new Set<string>()
  for (const item of interfaces) {
    const key = physicalPath(item.path)
    if (item.busy || probedIdentities.has(key)) continue
    probedIdentities.add(key)
    if (!probeIdentity(item.path, item.interfaceNumber)) {
      identityByPhysicalPath.delete(key)
      sysLog.warn(
        `vcan_usb hardware identity is unavailable on channel ${item.interfaceNumber}; falling back to the transient USB path`
      )
    }
  }

  return interfaces.map((item, index) => {
    let capabilities = VcanUsbNative.fallbackCapabilities()
    const physicalDevicePath = physicalPath(item.path)
    let identity = identityByPhysicalPath.get(physicalDevicePath)
    let termination: boolean | undefined
    let busy = item.busy

    if (!busy) {
      let native: VcanUsbNative | undefined
      try {
        native = VcanUsbNative.open(
          item.path,
          () => {},
          () => {},
          () => {}
        )
        capabilities = native.readCapabilities()
        identity = identityByPhysicalPath.get(physicalDevicePath)
        try {
          termination = native.getTermination()
        } catch (error) {
          sysLog.warn(
            `vcan_usb termination query is unavailable on channel ${item.interfaceNumber}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      } catch (error) {
        busy = true
        sysLog.warn(
          `vcan_usb probe failed for channel ${item.interfaceNumber}: ${error instanceof Error ? error.message : String(error)}`
        )
      } finally {
        native?.close()
      }
    }

    const identitySelector = identity ? makeVcanUsbIdentitySelector(identity) : undefined

    return {
      label: `${item.label} CH${item.interfaceNumber}`,
      id: identity
        ? `vcan_usb-${identity.kind}-${identity.value}-ch${item.interfaceNumber}`
        : `vcan_usb-${index}-ch${item.interfaceNumber}`,
      handle: `${identitySelector ?? item.path}|${item.interfaceNumber}`,
      serialNumber: identity ? formatVcanUsbSerialNumber(identity) : undefined,
      busy,
      extra: makeExtra(capabilities, termination)
    }
  })
}

export class VCAN_USB_CAN extends CanBase {
  readonly event = new EventEmitter()
  readonly info: CanBaseInfo
  readonly log: CanLOG
  closed = false

  private readonly native: VcanUsbNative
  private readonly startTime = getTsUs()
  private timestampOffset?: number
  private nextToken = 1
  private nextRead = 1
  private lastState = -1
  private fatalTransportError = false
  private readonly pendingTransmits = new Map<number, PendingTransmit>()
  private readonly pendingReads = new Map<number, PendingRead>()

  constructor(info: CanBaseInfo) {
    super()
    this.info = cloneDeep(info)
    const { path: storedPath, channel } = splitHandle(info.handle)
    const identitySelected = isVcanUsbIdentitySelector(storedPath)
    const path = resolveVcanUsbPath(storedPath, channel, listIdentityCandidates)
    this.info.handle = `${identitySelected ? storedPath : path}|${channel}`
    this.native = VcanUsbNative.open(
      path,
      (records) => this.receive(records),
      (error) => this.transportError(error),
      (result) => this.transmitComplete(result)
    )
    try {
      if (this.native.interfaceNumber !== channel) {
        throw new Error(
          `VCAN USB interface mismatch: selected channel ${channel}, opened ${this.native.interfaceNumber}`
        )
      }
      this.log = new CanLOG('VCAN_USB', info.name, info.id, this.event)
    } catch (error) {
      this.native.close()
      throw error
    }
    try {
      const capabilities = this.native.readCapabilities()
      this.validateTiming(info, capabilities)
      try {
        const deviceInfo = this.native.readDeviceInfo()
        const identity = rememberIdentity(path, deviceInfo)
        if (
          identitySelected &&
          (!identity ||
            makeVcanUsbIdentitySelector(identity).toLowerCase() !== storedPath.toLowerCase())
        ) {
          throw new Error(
            `VCAN USB hardware identity changed while opening ${storedPath}; refusing to configure a different adapter.`
          )
        }
        sysLog.info(
          `vcan_usb ${info.name}: SW ${formatVersion(deviceInfo.swVersion)}, HW ${formatVersion(deviceInfo.hwVersion)}, ${identity ? formatVcanUsbSerialNumber(identity) : 'identity unavailable'}, channel ${channel}`
        )
      } catch (error) {
        if (identitySelected) throw error
        sysLog.warn(
          `vcan_usb ${info.name}: device-info query unavailable: ${error instanceof Error ? error.message : String(error)}`
        )
      }
      // Arm bulk IN before the first configuration write so startup state/error
      // events cannot race receiver registration.
      this.native.startReceive()
      const applied = this.native.configure(info, !!info.candleRes)
      const timing = [formatTiming('nominal', applied.nominal)]
      if (applied.data) timing.push(formatTiming('data', applied.data))
      sysLog.info(`vcan_usb ${info.name}: timing validated and sent: ${timing.join('; ')}`)
      this.attachCanMessage(this.busloadCb)
    } catch (error) {
      try {
        this.native.stop()
      } catch {
        // Preserve the original configuration/open error.
      }
      this.native.close()
      this.log.close()
      throw error
    }
  }

  private validateTiming(info: CanBaseInfo, capabilities: VcanUsbCapabilities) {
    const validate = (
      name: string,
      timing: CanBaseInfo['bitrate'],
      cap: typeof capabilities.nominal
    ) => {
      const timingValues = [
        timing.freq,
        timing.preScaler,
        timing.timeSeg1,
        timing.timeSeg2,
        timing.sjw
      ]
      if (timingValues.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
        throw new Error(`${name} timing values must be positive integers`)
      }
      const clockMHz = Number(timing.clock)
      if (!Number.isFinite(clockMHz) || clockMHz <= 0) {
        throw new Error(`${name} clock must be a positive number`)
      }
      const clock = clockMHz * 1_000_000
      const calculated = Math.floor(
        clock / (timing.preScaler * (1 + timing.timeSeg1 + timing.timeSeg2))
      )
      if (clock !== cap.fclk_can) {
        throw new Error(`${name} clock must be ${cap.fclk_can / 1_000_000} MHz`)
      }
      if (Math.abs(calculated - timing.freq) / timing.freq > 0.01) {
        throw new Error(`${name} timing calculates ${calculated} Hz, expected ${timing.freq} Hz`)
      }
      if (timing.timeSeg1 < cap.tseg1_min || timing.timeSeg1 > cap.tseg1_max) {
        throw new Error(`${name} timeSeg1 is outside ${cap.tseg1_min}..${cap.tseg1_max}`)
      }
      if (timing.timeSeg2 < cap.tseg2_min || timing.timeSeg2 > cap.tseg2_max) {
        throw new Error(`${name} timeSeg2 is outside ${cap.tseg2_min}..${cap.tseg2_max}`)
      }
      if (timing.sjw < 1 || timing.sjw > cap.sjw_max) {
        throw new Error(`${name} sjw is outside 1..${cap.sjw_max}`)
      }
      if (timing.sjw > timing.timeSeg2) {
        throw new Error(`${name} sjw must not exceed timeSeg2`)
      }
      if (timing.preScaler < cap.brp_min || timing.preScaler > cap.brp_max) {
        throw new Error(`${name} prescaler is outside ${cap.brp_min}..${cap.brp_max}`)
      }
      if ((timing.preScaler - cap.brp_min) % Math.max(1, cap.brp_inc) !== 0) {
        throw new Error(`${name} prescaler does not match the device increment ${cap.brp_inc}`)
      }
    }

    validate('CAN', info.bitrate, capabilities.nominal)
    if (info.canfd) {
      if (!info.bitratefd) throw new Error('CAN FD data timing is required')
      validate('CAN FD', info.bitratefd, capabilities.data || capabilities.nominal)
    }
  }

  private receive(records: VcanUsbRxRecord[]) {
    if (this.closed) return
    for (const record of records) {
      if (record.kind === 'frame') this.handleFrame(record)
      else this.handleWireEvent(record)
    }
  }

  private relativeTimestamp(deviceTimestampUs: number) {
    const hostTimestamp = getTsUs() - this.startTime
    if (!Number.isSafeInteger(deviceTimestampUs) || deviceTimestampUs <= 0) return hostTimestamp
    if (this.timestampOffset === undefined) {
      this.timestampOffset = deviceTimestampUs - hostTimestamp
    }
    const timestamp = deviceTimestampUs - this.timestampOffset
    if (timestamp >= 0) return timestamp
    // Recover defensively if a firmware timestamp epoch changes unexpectedly.
    this.timestampOffset = deviceTimestampUs - hostTimestamp
    return hostTimestamp
  }

  private handleFrame(frame: VcanUsbFrame) {
    const timestamp = this.relativeTimestamp(frame.timestampUs)
    if (frame.overflow) {
      this.log.error(
        timestamp,
        `CAN receive overflow reported with frame 0x${frame.id.toString(16)}`
      )
    }
    const msgType: CanMsgType = {
      idType: frame.extended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
      canfd: frame.fd,
      brs: frame.brs,
      remote: frame.remote
    }
    const message: CanMessage = {
      device: this.info.name,
      dir: 'IN',
      id: frame.id,
      data: frame.remote ? Buffer.alloc(0) : frame.data,
      ts: timestamp,
      msgType,
      database: this.info.database
    }
    this.log.canBase(message)
    this.event.emit(this.getReadBaseId(frame.id, msgType), message)
  }

  private handleWireEvent(event: Exclude<VcanUsbRxRecord, VcanUsbFrame>) {
    if (event.kind === 'state') {
      const timestamp = this.relativeTimestamp(event.timestampUs)
      if (event.state === this.lastState) return
      this.lastState = event.state
      if (event.state !== 0) {
        this.log.error(
          timestamp,
          `CAN state ${STATE_NAMES[event.state] || event.state}, RX_ERR_CNT:${event.rxErrorCount} TX_ERR_CNT:${event.txErrorCount}`
        )
      }
      return
    }
    if (event.errorCode !== 0) {
      this.log.error(
        getTsUs() - this.startTime,
        `CAN bus error ${ERROR_NAMES[event.errorCode] || event.errorCode}, flags:0x${event.errorFlag.toString(16)}, RX_ERR_CNT:${event.rxErrorCount} TX_ERR_CNT:${event.txErrorCount}, LOG_CNT:${event.errorLoggingCount}`
      )
    }
  }

  private transmitComplete(result: { token: number; ok: boolean; error?: string }) {
    const pending = this.pendingTransmits.get(result.token)
    if (!pending) return
    this.pendingTransmits.delete(result.token)
    if (!result.ok) {
      pending.reject(
        new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, pending.msgType, pending.data, result.error)
      )
      return
    }
    const timestamp = getTsUs() - this.startTime
    const message: CanMessage = {
      device: this.info.name,
      dir: 'OUT',
      id: pending.id,
      data: pending.data,
      ts: timestamp,
      msgType: pending.msgType,
      database: pending.extra?.database,
      name: pending.extra?.name
    }
    this.log.canBase(message)
    pending.resolve(timestamp)
  }

  private transportError(error: NativeTransportError) {
    if (this.closed) return
    if (!error.fatal) {
      this.log.error(getTsUs() - this.startTime, error.message)
      return
    }
    this.fatalTransportError = true
    this.log.error(getTsUs() - this.startTime, error.message)
    this.rejectAll(CAN_ERROR_ID.CAN_INTERNAL_ERROR, error)
    setImmediate(() => this.close())
  }

  private rejectAll(errorId: CAN_ERROR_ID, cause?: unknown) {
    for (const pending of this.pendingTransmits.values()) {
      pending.reject(
        new CanError(
          errorId,
          pending.msgType,
          pending.data,
          cause instanceof Error ? cause.message : cause === undefined ? undefined : String(cause)
        )
      )
    }
    this.pendingTransmits.clear()
    for (const pending of this.pendingReads.values()) {
      clearTimeout(pending.timer)
      this.event.off(pending.eventName, pending.listener)
      pending.reject(new CanError(errorId, pending.msgType))
    }
    this.pendingReads.clear()
  }

  setOption(cmd: string, value: unknown): unknown {
    return this._setOption(cmd, value)
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.rejectAll(CAN_ERROR_ID.CAN_BUS_CLOSED)
    if (!this.fatalTransportError) {
      try {
        this.native.stop()
      } catch (error) {
        sysLog.warn(
          `vcan_usb stop failed: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
    this.native.close()
    this.detachCanMessage(this.busloadCb)
    this.log.close()
    this._close()
  }

  private validateMessage(id: number, msgType: CanMsgType): string | undefined {
    if (msgType.idType !== CAN_ID_TYPE.STANDARD && msgType.idType !== CAN_ID_TYPE.EXTENDED) {
      return 'CAN ID type is invalid'
    }
    const maximumId = msgType.idType === CAN_ID_TYPE.EXTENDED ? 0x1fffffff : 0x7ff
    if (!Number.isInteger(id) || id < 0 || id > maximumId) {
      return `CAN identifier must be an integer in 0..0x${maximumId.toString(16)}`
    }
    if (msgType.canfd && !this.info.canfd) {
      return 'CAN FD frame requested while the channel is configured for classic CAN'
    }
    if (msgType.canfd && msgType.remote) return 'CAN FD does not support remote frames'
    return undefined
  }

  writeBase(
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    if (this.closed) {
      return Promise.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, msgType, data))
    }
    const parameterError = this.validateMessage(id, msgType)
    if (parameterError) {
      return Promise.reject(
        new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data, parameterError)
      )
    }
    if (this.info.silent) {
      return Promise.reject(new CanError(CAN_ERROR_ID.CAN_DRIVER_SILENT, msgType, data))
    }

    const effectiveMsgType: CanMsgType = {
      ...msgType,
      // EcuBus can retain a disabled BRS checkbox after switching a send item
      // from CAN FD to classic CAN. The VCAN firmware applies BRS only to FD,
      // so normalize the value at the driver boundary.
      brs: msgType.canfd && msgType.brs
    }

    const token = this.nextTransmitToken()
    let normalized: Buffer | undefined
    try {
      normalized = this.native.writeFrame(
        {
          id,
          data,
          fd: effectiveMsgType.canfd,
          brs: effectiveMsgType.brs,
          extended: effectiveMsgType.idType === CAN_ID_TYPE.EXTENDED,
          remote: effectiveMsgType.remote
        },
        token
      )
    } catch (error) {
      return Promise.reject(
        new CanError(
          CAN_ERROR_ID.CAN_PARAM_ERROR,
          effectiveMsgType,
          data,
          error instanceof Error ? error.message : String(error)
        )
      )
    }
    if (!normalized) {
      return Promise.reject(
        new CanError(
          CAN_ERROR_ID.CAN_INTERNAL_ERROR,
          effectiveMsgType,
          data,
          'VCAN USB transmit queue is full'
        )
      )
    }
    return new Promise<number>((resolve, reject) => {
      this.pendingTransmits.set(token, {
        resolve,
        reject,
        id,
        msgType: effectiveMsgType,
        data: normalized,
        extra
      })
    })
  }

  private nextTransmitToken() {
    while (this.pendingTransmits.has(this.nextToken)) {
      this.nextToken = this.nextToken === 0xffffffff ? 1 : this.nextToken + 1
    }
    const token = this.nextToken
    this.nextToken = this.nextToken === 0xffffffff ? 1 : this.nextToken + 1
    return token
  }

  readBase(
    id: number,
    msgType: CanMsgType,
    timeout: number
  ): Promise<{ data: Buffer; ts: number }> {
    if (this.closed) {
      return Promise.reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, msgType))
    }
    const parameterError = this.validateMessage(id, msgType)
    if (parameterError || !Number.isFinite(timeout) || timeout < 0) {
      return Promise.reject(
        new CanError(
          CAN_ERROR_ID.CAN_PARAM_ERROR,
          msgType,
          undefined,
          parameterError || 'CAN read timeout must be a non-negative finite number'
        )
      )
    }
    const eventName = this.getReadBaseId(id, msgType)
    const readId = this.nextRead++
    return new Promise((resolve, reject) => {
      const listener = (value: CanMessage | CanError) => {
        const pending = this.pendingReads.get(readId)
        if (!pending) return
        clearTimeout(pending.timer)
        this.pendingReads.delete(readId)
        if (value instanceof CanError) reject(value)
        else resolve({ data: value.data, ts: value.ts! })
      }
      const timer = setTimeout(() => {
        const pending = this.pendingReads.get(readId)
        if (!pending) return
        this.pendingReads.delete(readId)
        this.event.off(eventName, listener)
        reject(new CanError(CAN_ERROR_ID.CAN_READ_TIMEOUT, msgType))
      }, timeout)
      this.pendingReads.set(readId, { reject, msgType, eventName, listener, timer })
      this.event.once(eventName, listener)
    })
  }

  getReadBaseId(id: number, msgType: CanMsgType): string {
    return `${id}-${msgType.canfd ? msgType.brs : false}-${msgType.remote}-${msgType.canfd}-${msgType.idType}`
  }

  static override getValidDevices(): CanDevice[] {
    return getVcanUsbDevices()
  }

  static override getLibVersion(): string {
    return '1.0.0 (libusb)'
  }
}
