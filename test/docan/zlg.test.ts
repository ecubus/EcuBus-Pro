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

