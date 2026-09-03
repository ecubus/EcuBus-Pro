import { CanBaseInfo, CandleCapability } from '../../share/can'
import { VkgsUsbTransport } from './transport'
import { encodeVkgsFrame, VkgsDecoder, VkgsUsbFrame, VkgsWireDecoder } from './wire'

export const VKGS_USB_VID = 0x1d50
export const VKGS_USB_PID = 0x606f

const FEATURE_HW_TIMESTAMP = 1 << 4
const FEATURE_FD = 1 << 8
const FEATURE_BT_CONST_EXT = 1 << 10
const FEATURE_TERMINATION = 1 << 11
const FEATURE_BERR_REPORTING = 1 << 12

const MODE_LISTEN_ONLY = 1 << 0
const MODE_HW_TIMESTAMP = 1 << 4
const MODE_FD = 1 << 8
const MODE_BERR_REPORTING = 1 << 12

const REQUEST = {
  hostFormat: 0,
  bitTiming: 1,
  mode: 2,
  btConst: 4,
  dataBitTiming: 10,
  btConstExt: 11,
  fallbackSetTermination: 12,
  fallbackGetTermination: 13,
  deviceInfo: 33,
  termination: 37
} as const

const FALLBACK_CAPABILITY: CandleCapability = {
  feature: FEATURE_FD | FEATURE_BT_CONST_EXT,
  fclk_can: 80_000_000,
  tseg1_min: 2,
  tseg1_max: 256,
  tseg2_min: 1,
  tseg2_max: 128,
  sjw_max: 128,
  brp_min: 1,
  brp_max: 512,
  brp_inc: 1
}

export interface VkgsUsbDeviceInfo {
  swVersion: number
  hwVersion: number
  uid: number[]
  uuid: number[]
}

export interface VkgsUsbCapabilities {
  nominal: CandleCapability
  data?: CandleCapability
  fdSupported: boolean
  terminationSupported: boolean
}

function sleep(milliseconds: number) {
  if (milliseconds <= 0) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

function readCapabilityFields(buffer: Buffer, offset: number, feature: number, clock: number) {
  if (buffer.length < offset + 32) throw new Error('VKGS USB capability response is too short')
  return {
    feature,
    fclk_can: clock || 80_000_000,
    tseg1_min: buffer.readUInt32LE(offset),
    tseg1_max: buffer.readUInt32LE(offset + 4),
    tseg2_min: buffer.readUInt32LE(offset + 8),
    tseg2_max: buffer.readUInt32LE(offset + 12),
    sjw_max: buffer.readUInt32LE(offset + 16),
    brp_min: buffer.readUInt32LE(offset + 20),
    brp_max: buffer.readUInt32LE(offset + 24),
    brp_inc: buffer.readUInt32LE(offset + 28)
  }
}

export class VkgsUsbApi {
  readonly channel: number
  readonly transport: VkgsUsbTransport
  private capabilities?: VkgsUsbCapabilities
  timestampsEnabled = false
  fdMode = false

  constructor(transport: VkgsUsbTransport, channel: number) {
    this.transport = transport
    this.channel = channel
    if (transport.interfaceNumber !== channel) {
      throw new Error(
        `VKGS USB interface mismatch: selected channel ${channel}, opened ${transport.interfaceNumber}`
      )
    }
  }

  private setControl(request: number, payload: Buffer) {
    this.transport.controlOut(request, this.channel, this.channel, payload)
    sleep(5)
  }

  private getControl(request: number, payloadLength: number): Buffer {
    return this.transport.controlIn(request, 0, this.channel, payloadLength)
  }

  readCapabilities(): VkgsUsbCapabilities {
    if (this.capabilities) return this.capabilities
    const response = this.getControl(REQUEST.btConst, 40)
    const feature = response.readUInt32LE(0)
    const clock = response.readUInt32LE(4)
    const nominal = readCapabilityFields(response, 8, feature, clock)
    let data: CandleCapability | undefined
    if (feature & FEATURE_FD && feature & FEATURE_BT_CONST_EXT) {
      const extended = this.getControl(REQUEST.btConstExt, 72)
      data = readCapabilityFields(extended, 40, extended.readUInt32LE(0), extended.readUInt32LE(4))
    }
    this.capabilities = {
      nominal,
      data,
      fdSupported: !!(feature & FEATURE_FD),
      terminationSupported: !!(feature & FEATURE_TERMINATION)
    }
    return this.capabilities
  }

  readDeviceInfo(): VkgsUsbDeviceInfo {
    const response = this.getControl(REQUEST.deviceInfo, 40)
    return {
      swVersion: response.readUInt32LE(0),
      hwVersion: response.readUInt32LE(4),
      uid: Array.from({ length: 4 }, (_, index) => response.readUInt32LE(8 + index * 4)),
      uuid: Array.from({ length: 4 }, (_, index) => response.readUInt32LE(24 + index * 4))
    }
  }

  getTermination(): boolean {
    try {
      return this.getControl(REQUEST.termination, 4).readUInt32LE(0) !== 0
    } catch {
      return this.getControl(REQUEST.fallbackGetTermination, 4).readUInt32LE(0) !== 0
    }
  }

  setTermination(enabled: boolean) {
    const payload = Buffer.alloc(4)
    payload.writeUInt32LE(enabled ? 1 : 0)
    try {
      this.setControl(REQUEST.termination, payload)
    } catch {
      this.setControl(REQUEST.fallbackSetTermination, payload)
    }
  }

  private setBitTiming(info: CanBaseInfo, dataPhase: boolean) {
    const timing = dataPhase ? info.bitratefd : info.bitrate
    if (!timing) throw new Error('VKGS USB CAN FD data timing is not configured')
    if (Math.min(timing.preScaler, timing.timeSeg1, timing.timeSeg2, timing.sjw) < 1) {
      throw new Error('VKGS USB timing values must be at least 1')
    }
    const payload = Buffer.alloc(20)
    payload.writeUInt32LE(0, 0)
    payload.writeUInt32LE(timing.timeSeg1 - 1, 4)
    payload.writeUInt32LE(timing.timeSeg2 - 1, 8)
    payload.writeUInt32LE(timing.sjw - 1, 12)
    payload.writeUInt32LE(timing.preScaler - 1, 16)
    this.setControl(dataPhase ? REQUEST.dataBitTiming : REQUEST.bitTiming, payload)
  }

  private setMode(mode: number, flags: number) {
    const payload = Buffer.alloc(8)
    payload.writeUInt32LE(mode, 0)
    payload.writeUInt32LE(flags, 4)
    this.setControl(REQUEST.mode, payload)
    sleep(150)
  }

  private setHostFormat() {
    const hostFormat = Buffer.alloc(4)
    hostFormat.writeUInt32LE(0x0000beef)
    this.setControl(REQUEST.hostFormat, hostFormat)
  }

  configure(info: CanBaseInfo, termination: boolean): VkgsWireDecoder {
    const capabilities = this.readCapabilities()
    const configuredClock = Number(info.bitrate.clock) * 1_000_000
    if (!Number.isFinite(configuredClock) || configuredClock !== capabilities.nominal.fclk_can) {
      throw new Error(
        `VKGS USB clock mismatch: configured ${configuredClock || 0} Hz, device reports ${capabilities.nominal.fclk_can} Hz`
      )
    }
    if (info.canfd && !capabilities.fdSupported) {
      throw new Error('CAN FD is enabled, but the selected VKGS USB device does not support it')
    }

    this.setMode(0, 0)
    this.setHostFormat()
    this.setBitTiming(info, false)
    if (info.canfd) this.setBitTiming(info, true)
    try {
      this.setTermination(termination)
    } catch (error) {
      if (termination || capabilities.terminationSupported) throw error
    }

    let flags = info.silent ? MODE_LISTEN_ONLY : 0
    if (info.canfd) flags |= MODE_FD
    if (capabilities.nominal.feature & FEATURE_BERR_REPORTING) flags |= MODE_BERR_REPORTING
    if (capabilities.nominal.feature & FEATURE_HW_TIMESTAMP) {
      flags |= MODE_HW_TIMESTAMP
      this.timestampsEnabled = true
    }
    this.fdMode = info.canfd
    this.setMode(1, flags)
    return new VkgsDecoder(this.timestampsEnabled, this.channel)
  }

  stop() {
    this.setMode(0, 0)
    this.setHostFormat()
  }

  encodeFrame(frame: VkgsUsbFrame): Buffer {
    return encodeVkgsFrame(this.channel, frame, this.fdMode)
  }

  static fallbackCapabilities(): VkgsUsbCapabilities {
    return {
      nominal: { ...FALLBACK_CAPABILITY },
      data: { ...FALLBACK_CAPABILITY },
      fdSupported: true,
      terminationSupported: false
    }
  }
}
