import { TOOMOSS_CAN } from '../../src/main/docan/toomoss'
import { equal, deepEqual } from 'assert'
import { describe, it, beforeAll, afterAll, test } from 'vitest'
import * as path from 'path'
import {
  addrToId,
  CAN_ADDR_FORMAT,
  CAN_ADDR_TYPE,
  CAN_ERROR_ID,
  CAN_ID_TYPE,
  CanAddr,
  getTsUs,
  swapAddr
} from '../../src/main/share/can'
import { CanTp } from 'src/main/docan/cantp'

const dllPath = path.join(__dirname, '../../resources/lib')
TOOMOSS_CAN.loadDllPath(dllPath)

test('toomoss scan device', () => {
  const devices = TOOMOSS_CAN.getValidDevices()
  console.log(devices)
})

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
describe.skip('toomoss test bus error can', () => {
  let client!: TOOMOSS_CAN
  let client2!: TOOMOSS_CAN
  beforeAll(() => {
    client = new TOOMOSS_CAN({
      handle: '1417675180:0',
      name: 'test',
      id: 'toomoss',
      vendor: 'toomoss',
      canfd: false,
      bitrate: {
        freq: 250000,
        preScaler: 2,
        timeSeg1: 68,
        timeSeg2: 11,
        sjw: 11,
        clock: '40M'
      },
      bitratefd: {
        freq: 1000000,
        preScaler: 1,
        timeSeg1: 20,
        timeSeg2: 19,
        sjw: 19
      },
      database: ''
    })
    client2 = new TOOMOSS_CAN({
      handle: '1417675180:1',
      name: 'test2',
      id: 'toomoss',
      vendor: 'toomoss',
      canfd: false,
      bitrate: {
        freq: 500000,
        preScaler: 1,
        timeSeg1: 68,
        timeSeg2: 11,
        sjw: 11,
        clock: '40M'
      },
      bitratefd: {
        freq: 1000000,
        preScaler: 1,
        timeSeg1: 20,
        timeSeg2: 19,
        sjw: 19
      },
      database: ''
    })
  })
  test('write frame', async () => {
    const list = []
    for (let i = 0; i < 1; i++) {
      list.push(
        client.writeBase(
          3 + i,
          {
            idType: CAN_ID_TYPE.STANDARD,
            brs: false,
            canfd: false,
            remote: false
          },
          Buffer.alloc(8, 0x33)
        )
      )
    }
    try {
      await Promise.all(list)
      equal(true, false)
    } catch (err: any) {
      console.log(err)
      equal(err.errorId, CAN_ERROR_ID.CAN_INTERNAL_ERROR)
    }
    //reopen client2 with correct bitrate
    client2.close()
    client2 = new TOOMOSS_CAN({
      handle: '1417675180:1',
      name: 'test2',
      id: 'toomoss',
      vendor: 'toomoss',
      canfd: false,
      bitrate: {
        freq: 250000,
        preScaler: 2,
        timeSeg1: 68,
        timeSeg2: 11,
        sjw: 11,
        clock: '40M'
      },
      bitratefd: {
        freq: 1000000,
        preScaler: 1,
        timeSeg1: 20,
        timeSeg2: 19,
        sjw: 19
      },
      database: ''
    })
    //write frame again
    await client.writeBase(
      4,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: true,
        remote: false
      },
      Buffer.alloc(8, 0x33)
    )
  })

  afterAll(async () => {
    client.close()
    client2.close()
  })
})

describe('toomoss test bus error canfd', () => {
  let client!: TOOMOSS_CAN
  let client2!: TOOMOSS_CAN
  beforeAll(() => {
    client = new TOOMOSS_CAN({
      handle: '1417675180:0',
      name: 'test',
      id: 'toomoss',
      vendor: 'toomoss',
      canfd: true,
      bitrate: {
        freq: 250000,
        preScaler: 2,
        timeSeg1: 68,
        timeSeg2: 11,
        sjw: 11,
        clock: '40M'
      },
      bitratefd: {
        freq: 1000000,
        preScaler: 1,
        timeSeg1: 20,
        timeSeg2: 19,
        sjw: 19
      },
      database: ''
    })
    client2 = new TOOMOSS_CAN({
      handle: '1417675180:1',
      name: 'test2',
      id: 'toomoss',
      vendor: 'toomoss',
      canfd: true,
      bitrate: {
        freq: 500000,
        preScaler: 1,
        timeSeg1: 68,
        timeSeg2: 11,
        sjw: 11,
        clock: '40M'
      },
      bitratefd: {
        freq: 1000000,
        preScaler: 1,
        timeSeg1: 20,
        timeSeg2: 19,
        sjw: 19
      },
      database: ''
    })
  })
  test('write frame', async () => {
    const list = []
    for (let i = 0; i < 1; i++) {
      list.push(
        client.writeBase(
          3 + i,
          {
            idType: CAN_ID_TYPE.STANDARD,
            brs: false,
            canfd: true,
            remote: false
          },
          Buffer.alloc(64, 0x33)
        )
      )
    }

    try {
      await Promise.all(list)
      equal(true, false)
    } catch (err: any) {
      console.log(err)
      equal(err.errorId, CAN_ERROR_ID.CAN_INTERNAL_ERROR)
    }
    //reopen client2 with correct bitrate
    client2.close()
    client2 = new TOOMOSS_CAN({
      handle: '1417675180:1',
      name: 'test2',
      id: 'toomoss',
      vendor: 'toomoss',
      canfd: true,
      bitrate: {
        freq: 250000,
        preScaler: 2,
        timeSeg1: 68,
        timeSeg2: 11,
        sjw: 11,
        clock: '40M'
      },
      bitratefd: {
        freq: 1000000,
        preScaler: 1,
        timeSeg1: 20,
        timeSeg2: 19,
        sjw: 19
      },
      database: ''
    })
    // //write frame again
    const t1 = await client.writeBase(
      4,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: true,
        remote: false
      },
      Buffer.alloc(64, 0x33)
    )
    console.log('timestamp1', t1)
    const t2 = await client.writeBase(
      4,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: true,
        remote: false
      },
      Buffer.alloc(64, 0x33)
    )
    console.log('timestamp2', t2)
  })
  afterAll(async () => {
    client.close()
    client2.close()
    // await delay(1000)
  })
})

describe('toomoss multi send canfd', () => {
  let client!: TOOMOSS_CAN
  let client2!: TOOMOSS_CAN
  beforeAll(() => {
    client = new TOOMOSS_CAN({
      handle: '1417675180:0',
      name: 'test',
      id: 'toomoss',
      vendor: 'toomoss',
      canfd: true,
      bitrate: {
        freq: 250000,
        preScaler: 2,
        timeSeg1: 68,
        timeSeg2: 11,
        sjw: 11,
        clock: '40M'
      },
      bitratefd: {
        freq: 1000000,
        preScaler: 1,
        timeSeg1: 29,
        timeSeg2: 10,
        sjw: 2
      },
      database: '',
      toomossRes: true
    })
    client2 = new TOOMOSS_CAN({
      handle: '1417675180:1',
      name: 'test2',
      id: 'toomoss',
      vendor: 'toomoss',
      canfd: true,

      bitrate: {
        freq: 250000,
        preScaler: 2,
        timeSeg1: 68,
        timeSeg2: 11,
        sjw: 11,
        clock: '40M'
      },
      bitratefd: {
        freq: 1000000,
        preScaler: 1,
        timeSeg1: 29,
        timeSeg2: 10,
        sjw: 2
      },
      database: '',
      toomossRes: true
    })
  })
  test.skip('write multi frame #1', async () => {
    for (let i = 0; i < 50; i++) {
      const t1 = getTsUs()
      await client.writeBase(
        3 + i,
        {
          idType: CAN_ID_TYPE.STANDARD,
          brs: false,
          canfd: true,
          remote: false
        },
        Buffer.alloc(64, 0x33)
      )
      const t2 = getTsUs()
      console.log('offset', i, t2 - t1)
    }
  })
  test('write multi frame #2', async () => {
    const list = []
    for (let i = 0; i < 20; i++) {
      list.push(
        client.writeBase(
          3 + i,
          {
            idType: CAN_ID_TYPE.STANDARD,
            brs: false,
            canfd: true,
            remote: false
          },
          Buffer.alloc(64, 0x33)
        )
      )
    }

    await Promise.all(list)
  })
  afterAll(async () => {
    console.log('close client')
    client.close()
    client2.close()

    // await delay(1000)
  })
})
