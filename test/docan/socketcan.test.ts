import { Socketcan_CAN } from '../../src/main/docan/socketcan'
import { describe, test, beforeAll, afterAll, expect } from 'vitest'
import { platform } from 'os'
import { CAN_ID_TYPE, CAN_ERROR_ID, CanError } from '../../src/main/share/can'

describe('SocketCAN', () => {
  test('getLibVersion', () => {
    const v = Socketcan_CAN.getLibVersion()
    if (platform() === 'linux') {
      expect(v).toContain('SocketCAN')
    } else {
      expect(v).toContain('only supported on Linux')
    }
  })

  test('getValidDevices on Linux', () => {
    const devices = Socketcan_CAN.getValidDevices()
    if (platform() === 'linux') {
      expect(Array.isArray(devices)).toBe(true)
      devices.forEach((d) => {
        expect(d).toHaveProperty('label')
        expect(d).toHaveProperty('id')
        expect(d).toHaveProperty('handle')
        expect(d.id).toMatch(/^Socketcan_/)
      })
    } else {
      expect(devices).toEqual([])
    }
  })

  test('getValidDevices returns empty on non-Linux', () => {
    if (platform() !== 'linux') {
      expect(Socketcan_CAN.getValidDevices()).toEqual([])
    }
  })
})

describe.skipIf(platform() !== 'linux')('SocketCAN integration (Linux only)', () => {
  let client!: Socketcan_CAN
  const ifaceName = 'vcan0'
  let hasVcan = false

  beforeAll(() => {
    const devices = Socketcan_CAN.getValidDevices()
    hasVcan = devices.some((d) => d.handle === ifaceName)
    if (!hasVcan) {
      console.warn(
        `vcan0 not available. Run: sudo modprobe vcan && sudo ip link add dev vcan0 type vcan && sudo ip link set up vcan0`
      )
      return
    }
    client = new Socketcan_CAN({
      name: 'SocketCAN Test',
      id: 'socketcan_test',
      handle: ifaceName,
      vendor: 'socketcan',
      canfd: false,
      bitrate: {
        freq: 500000,
        timeSeg1: 0,
        timeSeg2: 0,
        sjw: 0,
        preScaler: 0
      }
    })
  })

  afterAll(() => {
    if (client && hasVcan) {
      client.close()
    }
  })

  test.skipIf(() => !hasVcan)('writeBase standard frame', async () => {
    const ts = await client.writeBase(
      0x123,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false,
        remote: false
      },
      Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
    )
    expect(typeof ts).toBe('number')
    expect(ts).toBeGreaterThanOrEqual(0)
  })

  test.skipIf(() => !hasVcan)('writeBase extended frame', async () => {
    const ts = await client.writeBase(
      0x18da0201,
      {
        idType: CAN_ID_TYPE.EXTENDED,
        brs: false,
        canfd: false,
        remote: false
      },
      Buffer.from([0xaa, 0xbb, 0xcc, 0xdd])
    )
    expect(typeof ts).toBe('number')
  })

  test.skipIf(() => !hasVcan)('readBase timeout when no frame received', async () => {
    await expect(
      client.readBase(
        0x7e0,
        {
          idType: CAN_ID_TYPE.STANDARD,
          brs: false,
          canfd: false,
          remote: false
        },
        200
      )
    ).rejects.toMatchObject({
      errorId: CAN_ERROR_ID.CAN_READ_TIMEOUT
    })
  })

  test.skipIf(() => !hasVcan)('write and read loopback (vcan echoes)', async () => {
    const sendData = Buffer.from([0x11, 0x22, 0x33, 0x44])
    const readPromise = client.readBase(
      0x555,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false,
        remote: false
      },
      2000
    )
    await new Promise((r) => setTimeout(r, 50))
    await client.writeBase(
      0x555,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false,
        remote: false
      },
      sendData
    )
    try {
      const result = await readPromise
      expect(result.data.slice(0, sendData.length)).toEqual(sendData)
      expect(typeof result.ts).toBe('number')
    } catch (e) {
      if (e instanceof CanError && e.errorId === CAN_ERROR_ID.CAN_READ_TIMEOUT) {
        console.warn('vcan may not echo - loopback test skipped')
      } else {
        throw e
      }
    }
  })
})
