import { CanBaseInfo, CandleCapability } from '../../share/can'
import NativeVkgsUsb from './build/Release/vkgs_usb.node'

export interface NativeUsbInterface {
  path: string
  label: string
  interfaceNumber: number
  endpointIn: number
  endpointOut: number
  busy: boolean
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
  listenOnlySupported: boolean
  terminationSupported: boolean
}

export interface VkgsUsbAppliedTiming {
  requestedBitrate: number
  actualBitrate: number
  samplePointPermille: number
  prescaler: number
  tseg1: number
  tseg2: number
  sjw: number
  wirePrescaler: number
  wireTseg1: number
  wireTseg2: number
  wireSjw: number
}

export interface VkgsUsbAppliedConfig {
  nominal: VkgsUsbAppliedTiming
  data?: VkgsUsbAppliedTiming
  hardwareTimestamps: boolean
}

export interface VkgsUsbFrame {
  kind: 'frame'
  id: number
  data: Buffer
  fd: boolean
  brs: boolean
  extended: boolean
  remote: boolean
  timestampUs: number
  overflow: boolean
  esi: boolean
  error: boolean
}

export interface VkgsUsbStateEvent {
  kind: 'state'
  state: number
  rxErrorCount: number
  txErrorCount: number
  timestampUs: number
}

export interface VkgsUsbBusErrorEvent {
  kind: 'bus-error'
  errorFlag: number
  errorCode: number
  rxErrorCount: number
  txErrorCount: number
  errorLoggingCount: number
}

export type VkgsUsbRxRecord = VkgsUsbFrame | VkgsUsbStateEvent | VkgsUsbBusErrorEvent

export interface NativeTransportError {
  operation: string
  code: number
  message: string
  fatal: boolean
}

interface NativeTxResult {
  token: number
  ok: boolean
  error?: string
}

interface NativeOpenResult {
  handle: number
  interfaceNumber: number
}

interface NativeTiming {
  clockHz: number
  bitrateHz: number
  prescaler: number
  tseg1: number
  tseg2: number
  sjw: number
}

interface NativeConfig {
  nominal: NativeTiming
  data?: NativeTiming
  fd: boolean
  listenOnly: boolean
  termination: boolean
}

interface NativeFrame {
  id: number
  data: Buffer
  fd: boolean
  brs: boolean
  extended: boolean
  remote: boolean
}

interface NativeApi {
  listDevices(): NativeUsbInterface[]
  fallbackCapabilities(): VkgsUsbCapabilities
  open(
    path: string,
    onReceive: (records: VkgsUsbRxRecord[]) => void,
    onError: (error: NativeTransportError) => void,
    onTransmit: (result: NativeTxResult) => void
  ): NativeOpenResult
  startRx(handle: number): void
  readCapabilities(handle: number): VkgsUsbCapabilities
  readDeviceInfo(handle: number): VkgsUsbDeviceInfo
  getTermination(handle: number): boolean
  configure(handle: number, config: NativeConfig): VkgsUsbAppliedConfig
  stop(handle: number): void
  writeFrame(
    handle: number,
    frame: NativeFrame,
    token: number,
    delayBeforeMs: number,
    delayAfterMs: number
  ): Buffer | null
  close(handle: number): void
}

const native = NativeVkgsUsb as NativeApi

function toNativeTiming(timing: CanBaseInfo['bitrate']): NativeTiming {
  return {
    clockHz: Number(timing.clock) * 1_000_000,
    bitrateHz: timing.freq,
    prescaler: timing.preScaler,
    tseg1: timing.timeSeg1,
    tseg2: timing.timeSeg2,
    sjw: timing.sjw
  }
}

export class VkgsUsbNative {
  readonly handle: number
  readonly interfaceNumber: number
  private closed = false

  private constructor(result: NativeOpenResult) {
    this.handle = result.handle
    this.interfaceNumber = result.interfaceNumber
  }

  static listDevices(): NativeUsbInterface[] {
    return native.listDevices()
  }

  static fallbackCapabilities(): VkgsUsbCapabilities {
    return native.fallbackCapabilities()
  }

  static open(
    path: string,
    onReceive: (records: VkgsUsbRxRecord[]) => void,
    onError: (error: NativeTransportError) => void,
    onTransmit: (result: NativeTxResult) => void
  ): VkgsUsbNative {
    return new VkgsUsbNative(native.open(path, onReceive, onError, onTransmit))
  }

  startReceive() {
    this.assertOpen()
    native.startRx(this.handle)
  }

  readCapabilities(): VkgsUsbCapabilities {
    this.assertOpen()
    return native.readCapabilities(this.handle)
  }

  readDeviceInfo(): VkgsUsbDeviceInfo {
    this.assertOpen()
    return native.readDeviceInfo(this.handle)
  }

  getTermination(): boolean {
    this.assertOpen()
    return native.getTermination(this.handle)
  }

  configure(info: CanBaseInfo, termination: boolean): VkgsUsbAppliedConfig {
    this.assertOpen()
    const config: NativeConfig = {
      nominal: toNativeTiming(info.bitrate),
      fd: !!info.canfd,
      listenOnly: !!info.silent,
      termination
    }
    if (info.canfd) {
      if (!info.bitratefd) throw new Error('VKGS USB CAN FD data timing is required')
      config.data = toNativeTiming(info.bitratefd)
    }
    return native.configure(this.handle, config)
  }

  stop() {
    this.assertOpen()
    native.stop(this.handle)
  }

  writeFrame(
    frame: Omit<VkgsUsbFrame, 'kind' | 'timestampUs' | 'overflow' | 'esi' | 'error'>,
    token: number,
    delayBeforeMs = 0,
    delayAfterMs = 0
  ): Buffer | undefined {
    this.assertOpen()
    return native.writeFrame(this.handle, frame, token, delayBeforeMs, delayAfterMs) ?? undefined
  }

  close() {
    if (this.closed) return
    this.closed = true
    native.close(this.handle)
  }

  private assertOpen() {
    if (this.closed) throw new Error('VKGS USB native driver is closed')
  }
}
