import { afterEach, expect, it, vi } from 'vitest'
import { TOOMOSS_CAN } from '../../src/main/docan/toomoss'
import sdk from '../../src/main/docan/build/Release/toomoss.node'
import { CAN_ID_TYPE } from '../../src/main/share/can'

vi.mock('node:process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:process')>()),
  arch: 'arm64',
  platform: 'darwin'
}))

vi.mock('../../src/main/docan/build/Release/toomoss.node', () => ({
  default: {
    I32Array: class {
      getitem(i: number) {
        return 10 + i
      }
    },
    HARDWARE_INFO: class {},
    USB_ScanDevice: vi.fn(),
    USB_OpenDevice: vi.fn(),
    USB_CloseDevice: vi.fn(),
    DEV_GetHardwareInfo: vi.fn(),
    DEV_ResetTimestamp: vi.fn(),
    CAN_INIT_CONFIG: class {},
    CANFD_INIT_CONFIG: class {},
    CAN_Init: vi.fn(),
    CANFD_Init: vi.fn(),
    CAN_ResetStartTime: vi.fn(),
    CANFD_ResetStartTime: vi.fn(),
    CAN_StartGetMsg: vi.fn(),
    CANFD_StartGetMsg: vi.fn(),
    CAN_ClearMsg: vi.fn(),
    CANFD_ClearMsg: vi.fn(),
    CAN_Stop: vi.fn(),
    CANFD_Stop: vi.fn(),
    CreateTSFN: vi.fn(),
    FreeTSFN: vi.fn(),
    SendCANMsg: vi.fn()
  }
}))

const originalHandles = global.toomossDeviceHandles
afterEach(() => {
  global.toomossDeviceHandles = originalHandles
  vi.resetAllMocks()
})

it('uses the reported CAN channels and FD capability without closing active devices', () => {
  global.toomossDeviceHandles = new Map([[10, { refCount: 1, channels: new Set([0]) }]])
  sdk.USB_ScanDevice.mockReturnValue(3)
  sdk.USB_OpenDevice.mockImplementation((handle: number) => handle === 11)
  sdk.DEV_GetHardwareInfo.mockImplementation((handle: number, hardware: Record<string, number>) => {
    hardware.CANChannelNum = handle === 10 ? 1 : 3
    hardware.HaveCANFD = handle === 10 ? 0 : 1
    return 1
  })

  const devices = TOOMOSS_CAN.getValidDevices()
  expect(devices.map((device) => [device.handle, device.extra?.toomoss?.fdSupported])).toEqual([
    ['10:0', false],
    ['11:0', true],
    ['11:1', true],
    ['11:2', true]
  ])
  expect(sdk.USB_OpenDevice.mock.calls).toEqual([[11], [12]])
  expect(sdk.USB_CloseDevice.mock.calls).toEqual([[11]])
})

it('keeps legacy two-channel handles when firmware has no hardware information', () => {
  sdk.USB_ScanDevice.mockReturnValue(1)
  sdk.USB_OpenDevice.mockReturnValue(1)
  sdk.DEV_GetHardwareInfo.mockReturnValue(0)
  expect(TOOMOSS_CAN.getValidDevices()).toEqual([
    { label: 'TOOMOSS_USB_0_INDEX_0', id: 'TOOMOSS_USB_0_INDEX_0', handle: '10:0' },
    { label: 'TOOMOSS_USB_0_INDEX_1', id: 'TOOMOSS_USB_0_INDEX_1', handle: '10:1' }
  ])
  expect(sdk.USB_CloseDevice.mock.calls).toEqual([[10]])
})

it.each([false, true])('opens a channel and exchanges a frame with CAN FD = %s', async (canfd) => {
  sdk.USB_ScanDevice.mockReturnValue(1)
  sdk.USB_OpenDevice.mockReturnValue(1)
  const init = canfd ? sdk.CANFD_Init : sdk.CAN_Init
  const start = canfd ? sdk.CANFD_StartGetMsg : sdk.CAN_StartGetMsg
  init.mockReturnValue(0)
  start.mockReturnValue(0)
  const bitrate = { freq: 500000, clock: '40M', preScaler: 2, timeSeg1: 31, timeSeg2: 8, sjw: 1 }
  const channel = new TOOMOSS_CAN({
    id: 'adapter',
    handle: '10:0',
    name: 'adapter',
    vendor: 'toomoss',
    canfd,
    bitrate,
    bitratefd: canfd
      ? { ...bitrate, freq: 2000000, preScaler: 1, timeSeg1: 15, timeSeg2: 4 }
      : undefined
  })
  try {
    expect(init).toHaveBeenCalledWith(10, 0, expect.anything())
    const [, , , , receive, , , , transmit] = sdk.CreateTSFN.mock.calls[0]
    const msgType = { idType: CAN_ID_TYPE.STANDARD, remote: false, brs: canfd, canfd }
    const data = Buffer.alloc(canfd ? 64 : 8, 0xa5)
    const write = channel.writeBase(0x321, msgType, data)
    expect(sdk.SendCANMsg).toHaveBeenCalledWith(
      10,
      0,
      canfd,
      'adapter',
      0,
      expect.objectContaining({
        Data: data,
        DLC: data.length,
        Flags: canfd ? 5 : 0
      })
    )
    transmit({ id: 0, result: 1, timestamp: 42 })
    await expect(write).resolves.toEqual(expect.any(Number))
    const read = channel.readBase(0x321, msgType, 100)
    receive({ ID: 0x321, Data: data, Flags: canfd ? 5 : 0, TimeStampHigh: 0, TimeStamp: 43 })
    await expect(read).resolves.toMatchObject({ data })
    const failedWrite = channel.writeBase(0x321, msgType, data)
    transmit({ id: 1, result: -2, timestamp: 0 })
    await expect(failedWrite).rejects.toThrow('Send failed')
  } finally {
    channel.close()
  }
  expect(global.toomossDeviceHandles?.size).toBe(0)
})
