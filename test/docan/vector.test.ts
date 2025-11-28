import { VECTOR_CAN } from '../../src/main/docan/vector'
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
VECTOR_CAN.loadDllPath(dllPath)
console.log(VECTOR_CAN.getLibVersion())
console.log(VECTOR_CAN.getValidDevices())
// test('vector devices', () => {
//   const devices = VECTOR_CAN.getValidDevices()
//   console.log(devices)
// })

describe('vector test', () => {
  let client!: VECTOR_CAN
  beforeAll(() => {
    client = new VECTOR_CAN({
      handle: '3:3',
      name: 'test',
      id: 'VECTOR_3_#CAN',
      vendor: 'vector',
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
  })

  test.skip('write multi frame', async () => {
    const list = []
    for (let i = 0; i < 10; i++) {
      list.push(
        client.writeBase(
          3,
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
  test('read frame', async () => {
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
    // const r1 = await client.readBase(
    //   0x0,
    //   {
    //     idType: CAN_ID_TYPE.STANDARD,
    //     brs: true,
    //     canfd: true, //false true
    //     remote: false
    //   },
    //   5000 * 1000
    // )
    // console.log(r1)
  })
  test('write frame can-fd', async () => {
    await client.writeBase(
      3,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: true, //false true
        remote: false
      },
      Buffer.alloc(63, 1)
    )

    await client.writeBase(
      3,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: true, //false true
        remote: false
      },
      Buffer.alloc(33, 1)
    )
  })
  test.skip('write error frame can', async () => {
    try {
      await client.writeBase(
        3,
        {
          idType: CAN_ID_TYPE.STANDARD,
          brs: false,
          canfd: false, //false true
          remote: false
        },
        Buffer.alloc(8, 1)
      )
    } catch (e) {
      console.log(e)
    }

    try {
      await client.writeBase(
        3,
        {
          idType: CAN_ID_TYPE.STANDARD,
          brs: false,
          canfd: false, //false true
          remote: false
        },
        Buffer.alloc(8, 1)
      )
    } catch (e) {
      // console.log(e)
    }
  })
  afterAll(() => {
    console.log('close')
    client.close()
  })
})
