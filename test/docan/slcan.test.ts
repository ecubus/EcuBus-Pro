import { SLCAN_CAN } from '../../src/main/docan/slcan'
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

test('SLCAN scan device', async () => {
  const devices = await SLCAN_CAN.getValidDevices()
  console.log(devices)
})

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('vector test', () => {
  let client!: SLCAN_CAN
  beforeAll(async () => {
    client = new SLCAN_CAN({
      handle: 'COM4',
      name: 'test',
      id: 'COM4',
      vendor: 'slcan',
      canfd: true,
      bitrate: {
        sjw: 1,
        timeSeg1: 13,
        timeSeg2: 2,
        preScaler: 10,
        freq: 500000,
        clock: '80'
      },
      bitratefd: {
        sjw: 1,
        timeSeg1: 7,
        timeSeg2: 2,
        preScaler: 4,
        freq: 2000000,
        clock: '80'
      }
    })
    //delay
    await delay(1000)
  })

  test('write multi frame', async () => {
    const list = []
    for (let i = 0; i < 10; i++) {
      list.push(
        client.writeBase(
          i + 1,
          {
            idType: CAN_ID_TYPE.STANDARD,
            brs: false,
            canfd: false, //false true
            remote: false
          },
          Buffer.alloc(8, i)
        )
      )
    }
    const r = await Promise.all(list)

    console.log(r)
  })
  test.skip('read frame', async () => {
    const r = await client.readBase(
      0xa2,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false, //false true
        remote: false
      },
      5000 * 1000
    )
    console.log(r)
    const r1 = await client.readBase(
      0x1,
      {
        idType: CAN_ID_TYPE.EXTENDED,
        brs: true,
        canfd: true, //false true
        remote: false
      },
      5000 * 1000
    )
    console.log(r1)
    const r2 = await client.readBase(
      0x7e1,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: true, //false true
        remote: false
      },
      5000 * 1000
    )
    console.log(r2)
  })
  test('write frame can-fd', async () => {
    await client.writeBase(
      31,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: true, //false true
        remote: false
      },
      Buffer.alloc(8, 31)
    )

    await client.writeBase(
      32,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: true, //false true
        remote: false
      },
      Buffer.alloc(8, 32)
    )
    await client.writeBase(
      33,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: true, //false true
        remote: false
      },
      Buffer.alloc(63, 1)
    )
    await client.writeBase(
      34,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: true, //false true
        remote: false
      },
      Buffer.alloc(63, 1)
    )
    await client.writeBase(
      35,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: true, //false true
        remote: false
      },
      Buffer.alloc(63, 1)
    )

    await client.writeBase(
      32,
      {
        idType: CAN_ID_TYPE.EXTENDED,
        brs: true,
        canfd: true, //false true
        remote: false
      },
      Buffer.alloc(33, 1)
    )
  })

  afterAll(() => {
    client.close()
  })
})
