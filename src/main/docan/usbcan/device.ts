import { CanBaseInfo, CandleCapability } from '../../share/can'
import { UsbCanTransport } from './transport'
import {
  makeVcanControlPayload,
  stripVcanControlPayload,
  USB_CAN_FEATURE_BERR_REPORTING,
  USB_CAN_FEATURE_BT_CONST_EXT,
  USB_CAN_FEATURE_FD,
  USB_CAN_FEATURE_HW_TIMESTAMP,
  USB_CAN_FEATURE_TERMINATION,
  USB_CAN_MODE_BERR_REPORTING,
  USB_CAN_MODE_FD,
  USB_CAN_MODE_HW_TIMESTAMP,
  USB_CAN_MODE_LISTEN_ONLY,
  UsbCanProtocol,
  VcanDecoder,
  VkgsDecoder,
  WireDecoder
} from './wire'

export const USB_CAN_VID = 0x1d50
export const VCAN_USB_PID = 0x6080
export const VKGS_USB_PID = 0x606f

export interface UsbCanDeviceInfo {
  swVersion: number
  hwVersion: number
  uid: number[]
  uuid: number[]
}

export interface UsbCanCapabilities {
  nominal: CandleCapability
  data?: CandleCapability
}

const REQUEST = {
  vcan_usb: {
    mode: 1,
    btConst: 16,
    btConstExt: 17,
    bitTiming: 24,
    dataBitTiming: 25,
    deviceInfo: 33,
    termination: 37
  },
  vkgs_usb: {
    hostFormat: 0,
    bitTiming: 1,
    mode: 2,
    btConst: 4,
    deviceConfig: 5,
    dataBitTiming: 10,
    btConstExt: 11,
    fallbackSetTermination: 12,
    fallbackGetTermination: 13,
    deviceInfo: 33,
    termination: 37
  }
} as const

const FALLBACK_CAPABILITY: CandleCapability = {
  feature: USB_CAN_FEATURE_FD | USB_CAN_FEATURE_BT_CONST_EXT,
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

function sleep(milliseconds: number) {
  if (milliseconds <= 0) return
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

function readCapabilityFields(buffer: Buffer, offset: number, feature: number, clock: number) {
  if (buffer.length < offset + 32) throw new Error('USB CAN capability response is too short')
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

export class UsbCanProtocolDevice {
  readonly channel: number
  readonly protocol: UsbCanProtocol
  readonly transport: UsbCanTransport
  private capabilities?: UsbCanCapabilities
  timestampsEnabled = false
  fdMode = false

  constructor(protocol: UsbCanProtocol, transport: UsbCanTransport, channel: number) {
    this.protocol = protocol
    this.transport = transport
    this.channel = channel
    if (transport.interfaceNumber !== channel) {
      throw new Error(
        `USB interface mismatch: selected channel ${channel}, opened ${transport.interfaceNumber}`
      )
    }
  }

  private setControl(request: number, payload: Buffer) {
    if (this.protocol === 'vcan_usb') {
      this.transport.controlOut(
        request,
        0,
        this.channel,
        makeVcanControlPayload(this.channel, request, payload)
      )
    } else {
      this.transport.controlOut(request, this.channel, this.channel, payload)
      sleep(5)
    }
  }

  private getControl(request: number, payloadLength: number): Buffer {
    if (this.protocol === 'vcan_usb') {
      const response = this.transport.controlIn(request | 0x80, 0, this.channel, payloadLength + 8)
      return stripVcanControlPayload(this.channel, request, response)
    }
    return this.transport.controlIn(request, 0, this.channel, payloadLength)
  }

  readCapabilities(): UsbCanCapabilities {
    if (this.capabilities) return this.capabilities
    const request = REQUEST[this.protocol]
    const response = this.getControl(request.btConst, 40)
    const feature = response.readUInt32LE(0)
    const clock = response.readUInt32LE(4)
    const nominal = readCapabilityFields(response, 8, feature, clock)
    let data: CandleCapability | undefined
    if (feature & USB_CAN_FEATURE_FD && feature & USB_CAN_FEATURE_BT_CONST_EXT) {
      const extended = this.getControl(request.btConstExt, 72)
      const extendedFeature = extended.readUInt32LE(0)
      const extendedClock = extended.readUInt32LE(4)
      data = readCapabilityFields(extended, 40, extendedFeature, extendedClock)
    }
    this.capabilities = { nominal, data }
    return this.capabilities
  }

  readDeviceInfo(): UsbCanDeviceInfo {
    const response = this.getControl(REQUEST[this.protocol].deviceInfo, 40)
    return {
      swVersion: response.readUInt32LE(0),
      hwVersion: response.readUInt32LE(4),
      uid: Array.from({ length: 4 }, (_, index) => response.readUInt32LE(8 + index * 4)),
      uuid: Array.from({ length: 4 }, (_, index) => response.readUInt32LE(24 + index * 4))
    }
  }

  getTermination(): boolean {
    try {
      return this.getControl(REQUEST[this.protocol].termination, 4).readUInt32LE(0) !== 0
    } catch (error) {
      if (this.protocol !== 'vkgs_usb') throw error
      return this.getControl(REQUEST.vkgs_usb.fallbackGetTermination, 4).readUInt32LE(0) !== 0
    }
  }

  setTermination(enabled: boolean) {
    const payload = Buffer.alloc(4)
    payload.writeUInt32LE(enabled ? 1 : 0)
    try {
      this.setControl(REQUEST[this.protocol].termination, payload)
    } catch (error) {
      if (this.protocol !== 'vkgs_usb') throw error
      this.setControl(REQUEST.vkgs_usb.fallbackSetTermination, payload)
    }
  }

  private setBitTiming(info: CanBaseInfo, dataPhase: boolean) {
    const timing = dataPhase ? info.bitratefd : info.bitrate
    if (!timing) throw new Error('CAN FD data timing is not configured')
    if (Math.min(timing.preScaler, timing.timeSeg1, timing.timeSeg2, timing.sjw) < 1) {
      throw new Error('CAN timing values must be at least 1')
    }
    const payload = Buffer.alloc(20)
    payload.writeUInt32LE(0, 0)
    payload.writeUInt32LE(timing.timeSeg1 - 1, 4)
    payload.writeUInt32LE(timing.timeSeg2 - 1, 8)
    payload.writeUInt32LE(timing.sjw - 1, 12)
    payload.writeUInt32LE(timing.preScaler - 1, 16)
    const request = dataPhase
      ? REQUEST[this.protocol].dataBitTiming
      : REQUEST[this.protocol].bitTiming
    this.setControl(request, payload)
  }

  private setMode(mode: number, flags: number) {
    const payload = Buffer.alloc(8)
    payload.writeUInt32LE(mode, 0)
    payload.writeUInt32LE(flags, 4)
    this.setControl(REQUEST[this.protocol].mode, payload)
    if (this.protocol === 'vkgs_usb') sleep(150)
  }

  configure(info: CanBaseInfo, termination: boolean): WireDecoder {
    const capabilities = this.readCapabilities()
    const configuredClock = Number(info.bitrate.clock) * 1_000_000
    if (!Number.isFinite(configuredClock) || configuredClock !== capabilities.nominal.fclk_can) {
      throw new Error(
        `CAN clock mismatch: configured ${configuredClock || 0} Hz, device reports ${capabilities.nominal.fclk_can} Hz`
      )
    }
    if (info.canfd && !(capabilities.nominal.feature & USB_CAN_FEATURE_FD)) {
      throw new Error('CAN FD is enabled, but the selected USB CAN device does not support CAN FD')
    }

    this.setMode(0, 0)
    if (this.protocol === 'vkgs_usb') {
      const hostFormat = Buffer.alloc(4)
      hostFormat.writeUInt32LE(0x0000beef)
      this.setControl(REQUEST.vkgs_usb.hostFormat, hostFormat)
    }
    this.setBitTiming(info, false)
    if (info.canfd) this.setBitTiming(info, true)
    try {
      this.setTermination(termination)
    } catch (error) {
      if (termination || capabilities.nominal.feature & USB_CAN_FEATURE_TERMINATION) {
        throw error
      }
    }

    let flags = info.silent ? USB_CAN_MODE_LISTEN_ONLY : 0
    if (info.canfd) flags |= USB_CAN_MODE_FD
    if (capabilities.nominal.feature & USB_CAN_FEATURE_BERR_REPORTING) {
      flags |= USB_CAN_MODE_BERR_REPORTING
    }
    if (
      this.protocol === 'vkgs_usb' &&
      capabilities.nominal.feature & USB_CAN_FEATURE_HW_TIMESTAMP
    ) {
      flags |= USB_CAN_MODE_HW_TIMESTAMP
      this.timestampsEnabled = true
    }
    this.fdMode = info.canfd
    this.setMode(1, flags)
    return this.protocol === 'vcan_usb'
      ? new VcanDecoder(this.channel)
      : new VkgsDecoder(this.timestampsEnabled, this.channel)
  }

  stop() {
    this.setMode(0, 0)
    if (this.protocol === 'vkgs_usb') {
      const hostFormat = Buffer.alloc(4)
      hostFormat.writeUInt32LE(0x0000beef)
      this.setControl(REQUEST.vkgs_usb.hostFormat, hostFormat)
    }
  }

  static fallbackCapabilities(): UsbCanCapabilities {
    return {
      nominal: { ...FALLBACK_CAPABILITY },
      data: { ...FALLBACK_CAPABILITY }
    }
  }
}
