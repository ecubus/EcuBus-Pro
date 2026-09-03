import NativeVcanUsb from './../build/Release/vcan_usb.node'

export interface NativeUsbInterface {
  path: string
  label: string
  interfaceNumber: number
  endpointIn: number
  endpointOut: number
  busy: boolean
}

interface NativeOpenResult {
  handle: number
  interfaceNumber: number
}

export interface NativeTransportError {
  operation: string
  code: number
  message: string
}

interface NativeTxResult {
  token: number
  ok: boolean
  error?: string
}

interface NativeApi {
  listDevices(): NativeUsbInterface[]
  open(
    path: string,
    onReceive: (data: Buffer) => void,
    onError: (error: NativeTransportError) => void,
    onTransmit: (result: NativeTxResult) => void
  ): NativeOpenResult
  startRx(handle: number): void
  control(
    handle: number,
    requestType: number,
    request: number,
    value: number,
    index: number,
    dataOrLength: Buffer | number
  ): Buffer | undefined
  write(
    handle: number,
    data: Buffer,
    token: number,
    delayBeforeMs?: number,
    delayAfterMs?: number
  ): boolean
  close(handle: number): void
}

const native = NativeVcanUsb as NativeApi

export class VcanUsbTransport {
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

  static open(
    path: string,
    onReceive: (data: Buffer) => void,
    onError: (error: NativeTransportError) => void,
    onTransmit: (result: NativeTxResult) => void
  ): VcanUsbTransport {
    const result = native.open(path, onReceive, onError, onTransmit)
    return new VcanUsbTransport(result)
  }

  startReceive() {
    this.assertOpen()
    native.startRx(this.handle)
  }

  controlIn(request: number, value: number, index: number, length: number): Buffer {
    this.assertOpen()
    const result = native.control(this.handle, 0xc1, request, value, index, length)
    if (!Buffer.isBuffer(result)) throw new Error('VCAN USB control read returned no data')
    return result
  }

  controlOut(request: number, value: number, index: number, data: Buffer) {
    this.assertOpen()
    native.control(this.handle, 0x41, request, value, index, data)
  }

  write(data: Buffer, token: number, delayBeforeMs = 0, delayAfterMs = 0): boolean {
    this.assertOpen()
    return native.write(this.handle, data, token, delayBeforeMs, delayAfterMs)
  }

  close() {
    if (this.closed) return
    this.closed = true
    native.close(this.handle)
  }

  private assertOpen() {
    if (this.closed) throw new Error('VCAN USB transport is closed')
  }
}
