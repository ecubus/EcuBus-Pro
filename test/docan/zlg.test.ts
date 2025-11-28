import { ZLG_CAN } from '../../src/main/docan/zlg'
import { equal, deepEqual } from 'assert'
import { describe, it, beforeAll, afterAll, test } from 'vitest'
import * as path from 'path'
import {
  addrToId,
  CAN_ADDR_FORMAT,
  CAN_ADDR_TYPE,
  CAN_ID_TYPE,
  CanAddr,
  swapAddr
} from '../../src/main/share/can'
import { CanTp } from 'src/main/docan/cantp'

const dllPath = path.join(__dirname, '../../resources/lib')
ZLG_CAN.loadDllPath(dllPath)

describe('zlg device availability test', () => {
  test('should include USBCANFD-400U devices', () => {
    const devices = ZLG_CAN.getValidDevices()
    const usbcanfd400u = devices.filter((d) => d.label.includes('USBCANFD_400U'))
    // USBCANFD-400U has 4 channels × 2 device indexes = 8 devices
    equal(
      usbcanfd400u.length,
      8,
      'USBCANFD-400U should have 8 device entries (4 channels × 2 indexes)'
    )
  })

  test('should include USBCAN2 (USBCAN-II) devices', () => {
    const devices = ZLG_CAN.getValidDevices()
    const usbcan2 = devices.filter((d) => d.label.includes('USBCAN2'))
    // USBCAN2 has 2 channels × 2 device indexes = 4 devices
    equal(usbcan2.length, 4, 'USBCAN2 should have 4 device entries (2 channels × 2 indexes)')
  })

  test('should include USBCAN-2E-U devices', () => {
    const devices = ZLG_CAN.getValidDevices()
    const usbcan2eu = devices.filter((d) => d.label.includes('USBCAN_2E_U'))
    // USBCAN-2E-U has 2 channels × 2 device indexes = 4 devices
    equal(usbcan2eu.length, 4, 'USBCAN-2E-U should have 4 device entries (2 channels × 2 indexes)')
  })
})

describe('zlg test', () => {
  let client!: ZLG_CAN
  beforeAll(() => {
    client = new ZLG_CAN({
      handle: '41_0_0',
      name: 'test',
      vendor: 'zlg',
      id: 'zlg',
      canfd: false,
      bitrate: {
        freq: 250000,
        preScaler: 1,
        timeSeg1: 68,
        timeSeg2: 11,
        sjw: 11
      },
      bitratefd: {
        freq: 1000000,
        preScaler: 1,
        timeSeg1: 20,
        timeSeg2: 19,
        sjw: 19
      }
    })
  })
  test('write multi frame', async () => {
    // await client.writeBase(3, {
    //     idType: CAN_ID_TYPE.STANDARD,
    //     brs: false,
    //     canfd: false,
    //     remote: false
    // }, Buffer.alloc(8, 0x5a))
    const list = []
    for (let i = 0; i < 19; i++) {
      list.push(
        client.writeBase(
          3,
          {
            idType: CAN_ID_TYPE.STANDARD,
            brs: false,
            canfd: false,
            remote: false
          },
          Buffer.alloc(8, i)
        )
      )
    }
    const r = await Promise.all(list)
  })
  afterAll(() => {
    // client.close()
  })
})
