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
import { VcanUsbApi, VcanUsbCapabilities, VcanUsbDeviceInfo } from './protocol'
import { NativeTransportError, VcanUsbTransport } from './transport'
import { normalizeVcanData, VcanUsbEvent, VcanUsbFrame, VcanWireDecoder } from './wire'

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

const ERROR_NAMES = ['none', 'stuff', 'form', 'ack', 'bit1', 'bit0', 'crc']

function splitHandle(handle: unknown): { path: string; channel: number } {
  const value = String(handle)
  const separator = value.lastIndexOf('|')
  if (separator <= 0) throw new Error('invalid VCAN USB handle')
  const channel = Number(value.slice(separator + 1))
  if (!Number.isInteger(channel) || channel < 0 || channel > 255) {
    throw new Error(`invalid VCAN USB channel in handle: ${value}`)
  }
  return { path: value.slice(0, separator), channel }
}

function formatVersion(version: number) {
  return `${(version >>> 24) & 0xff}.${(version >>> 16) & 0xff}.${
    (version >>> 8) & 0xff
  }.${version & 0xff}`
}

function makeExtra(
  capabilities: VcanUsbCapabilities,
  deviceInfo?: VcanUsbDeviceInfo,
  termination?: boolean
) {
  return {
    usbCan: {
      protocol: 'vcan_usb' as const,
      cap: capabilities.nominal,
      dataCap: capabilities.data,
      fdSupported: capabilities.fdSupported,
      Res: capabilities.terminationSupported || termination !== undefined,
      termination,
      swVersion: deviceInfo?.swVersion,
      hwVersion: deviceInfo?.hwVersion
    }
  }
}

function getVcanUsbDevices(): CanDevice[] {
  const interfaces = VcanUsbTransport.listDevices()
  return interfaces.map((item, index) => {
    let capabilities = VcanUsbApi.fallbackCapabilities()
    let deviceInfo: VcanUsbDeviceInfo | undefined
    let termination: boolean | undefined
    let busy = item.busy

    if (!busy) {
      let transport: VcanUsbTransport | undefined
      try {
        transport = VcanUsbTransport.open(
          item.path,
          () => {},
          () => {},
          () => {}
        )
        const api = new VcanUsbApi(transport, item.interfaceNumber)
        capabilities = api.readCapabilities()
        try {
          deviceInfo = api.readDeviceInfo()
        } catch (error) {
          sysLog.warn(
            `vcan_usb device-info query is unavailable on channel ${item.interfaceNumber}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
        try {
          termination = api.getTermination()
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
        transport?.close()
      }
    }

    return {
      label: `${item.label} CH${item.interfaceNumber}`,
      id: `vcan_usb-${index}-ch${item.interfaceNumber}`,
      handle: `${item.path}|${item.interfaceNumber}`,
      serialNumber: item.path,
      busy,
      extra: makeExtra(capabilities, deviceInfo, termination)
    }
  })
}

export class VCAN_USB_CAN extends CanBase {
  readonly event = new EventEmitter()
  readonly info: CanBaseInfo
  readonly log: CanLOG
  closed = false

  private readonly transport: VcanUsbTransport
  private readonly api: VcanUsbApi
  private readonly decoder: VcanWireDecoder
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
    this.log = new CanLOG('VCAN_USB', info.name, info.id, this.event)
    const { path, channel } = splitHandle(info.handle)
    this.transport = VcanUsbTransport.open(
      path,
      (data) => this.receive(data),
      (error) => this.transportError(error),
      (result) => this.transmitComplete(result)
    )
    this.api = new VcanUsbApi(this.transport, channel)
    try {
      const capabilities = this.api.readCapabilities()
      this.validateTiming(info, capabilities)
      try {
        const deviceInfo = this.api.readDeviceInfo()
        sysLog.info(
          `vcan_usb ${info.name}: SW ${formatVersion(deviceInfo.swVersion)}, HW ${formatVersion(deviceInfo.hwVersion)}, channel ${channel}`
        )
      } catch (error) {
        sysLog.warn(
          `vcan_usb ${info.name}: device-info query unavailable: ${error instanceof Error ? error.message : String(error)}`
        )
      }
      this.decoder = this.api.configure(info, !!info.vcanUsbRes)
      this.transport.startReceive()
      this.attachCanMessage(this.busloadCb)
    } catch (error) {
      try {
        this.api.stop()
      } catch {
        // Preserve the original configuration/open error.
      }
      this.transport.close()
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
      const clock = Number(timing.clock) * 1_000_000
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

  private receive(transfer: Buffer) {
    if (this.closed) return
    try {
      const decoded = this.decoder.push(transfer)
      for (const event of decoded.events) this.handleWireEvent(event)
      for (const frame of decoded.frames) this.handleFrame(frame)
    } catch (error) {
      this.decoder.reset()
      this.log.error(
        getTsUs() - this.startTime,
        `VCAN USB receive framing error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private handleFrame(frame: VcanUsbFrame) {
    let timestamp = getTsUs() - this.startTime
    if (frame.timestampUs > 0) {
      if (this.timestampOffset === undefined) this.timestampOffset = frame.timestampUs - timestamp
      timestamp = frame.timestampUs - this.timestampOffset
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

  private handleWireEvent(event: VcanUsbEvent) {
    if (event.kind === 'state') {
      if (event.state === this.lastState) return
      this.lastState = event.state
      if (event.state !== 0) {
        this.log.error(
          event.timestampUs || getTsUs() - this.startTime,
          `CAN state ${STATE_NAMES[event.state] || event.state}, RX_ERR_CNT:${event.rxErrorCount} TX_ERR_CNT:${event.txErrorCount}`
        )
      }
      return
    }
    if (event.errorCode !== 0) {
      this.log.error(
        getTsUs() - this.startTime,
        `CAN bus error ${ERROR_NAMES[event.errorCode] || event.errorCode}, RX_ERR_CNT:${event.rxErrorCount} TX_ERR_CNT:${event.txErrorCount}`
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
        this.api.stop()
      } catch (error) {
        sysLog.warn(
          `vcan_usb stop failed: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
    this.transport.close()
    this.detachCanMessage(this.busloadCb)
    this.log.close()
    this._close()
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
    const maximumId = msgType.idType === CAN_ID_TYPE.EXTENDED ? 0x1fffffff : 0x7ff
    if (!Number.isInteger(id) || id < 0 || id > maximumId || (msgType.brs && !msgType.canfd)) {
      return Promise.reject(new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data))
    }

    let normalized: Buffer
    try {
      normalized = normalizeVcanData(data, msgType.canfd)
    } catch (error) {
      return Promise.reject(
        new CanError(
          CAN_ERROR_ID.CAN_PARAM_ERROR,
          msgType,
          data,
          error instanceof Error ? error.message : String(error)
        )
      )
    }
    const frame: VcanUsbFrame = {
      id,
      data: normalized,
      fd: msgType.canfd,
      brs: msgType.brs,
      extended: msgType.idType === CAN_ID_TYPE.EXTENDED,
      remote: msgType.remote,
      timestampUs: 0
    }
    const packet = this.api.encodeFrame(frame)

    return new Promise<number>((resolve, reject) => {
      const token = this.nextTransmitToken()
      this.pendingTransmits.set(token, { resolve, reject, id, msgType, data: normalized, extra })
      try {
        if (!this.transport.write(packet, token)) {
          this.pendingTransmits.delete(token)
          reject(
            new CanError(
              CAN_ERROR_ID.CAN_INTERNAL_ERROR,
              msgType,
              normalized,
              'VCAN USB transmit queue is full'
            )
          )
        }
      } catch (error) {
        this.pendingTransmits.delete(token)
        reject(
          new CanError(
            CAN_ERROR_ID.CAN_INTERNAL_ERROR,
            msgType,
            normalized,
            error instanceof Error ? error.message : String(error)
          )
        )
      }
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
