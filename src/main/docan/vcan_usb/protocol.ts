import { CanBaseInfo, CandleCapability } from '../../share/can'
import { VcanUsbTransport } from './transport'
import {
  encodeVcanFrame,
  makeVcanControlPayload,
  stripVcanControlPayload,
  VcanDecoder,
  VcanUsbFrame,
  VcanWireDecoder
} from './wire'

export const VCAN_USB_VID = 0x1d50
export const VCAN_USB_PID = 0x6080

const FEATURE_FD = 1 << 8
const FEATURE_BT_CONST_EXT = 1 << 10
const FEATURE_TERMINATION = 1 << 11
const FEATURE_BERR_REPORTING = 1 << 12

const MODE_LISTEN_ONLY = 1 << 0
const MODE_FD = 1 << 8
const MODE_BERR_REPORTING = 1 << 12

const REQUEST = {
  mode: 1,
  btConst: 16,
  btConstExt: 17,
  bitTiming: 24,
  dataBitTiming: 25,
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

export interface VcanUsbDeviceInfo {
  swVersion: number
  hwVersion: number
  uid: number[]
  uuid: number[]
}

export interface VcanUsbCapabilities {
  nominal: CandleCapability
  data?: CandleCapability
  fdSupported: boolean
  terminationSupported: boolean
}

function readCapabilityFields(buffer: Buffer, offset: number, feature: number, clock: number) {
  if (buffer.length < offset + 32) throw new Error('VCAN USB capability response is too short')
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

export class VcanUsbApi {
  readonly channel: number
  readonly transport: VcanUsbTransport
  private capabilities?: VcanUsbCapabilities
  fdMode = false

  constructor(transport: VcanUsbTransport, channel: number) {
    this.transport = transport
    this.channel = channel
    if (transport.interfaceNumber !== channel) {
      throw new Error(
        `VCAN USB interface mismatch: selected channel ${channel}, opened ${transport.interfaceNumber}`
      )
    }
  }

  private setControl(request: number, payload: Buffer) {
    this.transport.controlOut(
      request,
      0,
      this.channel,
      makeVcanControlPayload(this.channel, request, payload)
    )
  }

  private getControl(request: number, payloadLength: number): Buffer {
    const response = this.transport.controlIn(request | 0x80, 0, this.channel, payloadLength + 8)
    return stripVcanControlPayload(this.channel, request, response)
  }

  readCapabilities(): VcanUsbCapabilities {
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

  readDeviceInfo(): VcanUsbDeviceInfo {
    const response = this.getControl(REQUEST.deviceInfo, 40)
    return {
      swVersion: response.readUInt32LE(0),
      hwVersion: response.readUInt32LE(4),
      uid: Array.from({ length: 4 }, (_, index) => response.readUInt32LE(8 + index * 4)),
      uuid: Array.from({ length: 4 }, (_, index) => response.readUInt32LE(24 + index * 4))
    }
  }

  getTermination(): boolean {
    return this.getControl(REQUEST.termination, 4).readUInt32LE(0) !== 0
  }

  setTermination(enabled: boolean) {
    const payload = Buffer.alloc(4)
    payload.writeUInt32LE(enabled ? 1 : 0)
    this.setControl(REQUEST.termination, payload)
  }

  private setBitTiming(info: CanBaseInfo, dataPhase: boolean) {
    const timing = dataPhase ? info.bitratefd : info.bitrate
    if (!timing) throw new Error('VCAN USB CAN FD data timing is not configured')
    if (Math.min(timing.preScaler, timing.timeSeg1, timing.timeSeg2, timing.sjw) < 1) {
      throw new Error('VCAN USB timing values must be at least 1')
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
  }

  configure(info: CanBaseInfo, termination: boolean): VcanWireDecoder {
    const capabilities = this.readCapabilities()
    const configuredClock = Number(info.bitrate.clock) * 1_000_000
    if (!Number.isFinite(configuredClock) || configuredClock !== capabilities.nominal.fclk_can) {
      throw new Error(
        `VCAN USB clock mismatch: configured ${configuredClock || 0} Hz, device reports ${capabilities.nominal.fclk_can} Hz`
      )
    }
    if (info.canfd && !capabilities.fdSupported) {
      throw new Error('CAN FD is enabled, but the selected VCAN USB device does not support it')
    }

    this.setMode(0, 0)
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
    this.fdMode = info.canfd
    this.setMode(1, flags)
    return new VcanDecoder(this.channel)
  }

  stop() {
    this.setMode(0, 0)
  }

  encodeFrame(frame: VcanUsbFrame): Buffer {
    return encodeVcanFrame(this.channel, frame)
  }

  static fallbackCapabilities(): VcanUsbCapabilities {
    return {
      nominal: { ...FALLBACK_CAPABILITY },
      data: { ...FALLBACK_CAPABILITY },
      fdSupported: true,
      terminationSupported: false
    }
  }
}
