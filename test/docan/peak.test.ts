import { PEAK_TP } from '../../src/main/docan/peak'
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
PEAK_TP.loadDllPath(dllPath)

describe('peak test', () => {
  let client!: PEAK_TP
  beforeAll(() => {
    client = new PEAK_TP({
      handle: 81,
      name: 'test',
      id: 'peak',
      vendor: 'peak',
      canfd: false,
      bitrate: {
        preScaler: 80,
        timeSeg1: 2,
        timeSeg2: 1,
        sjw: 1,
        freq: 250000,
        clock: '80'
      },
      bitratefd: {
        preScaler: 8,
        timeSeg1: 3,
        timeSeg2: 1,
        sjw: 1,
        freq: 2000000
      }
    })
  })
  test('write multi frame', async () => {
    const list = []
    for (let i = 0; i < 400; i++) {
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
    console.log(r)
  })
  afterAll(() => {
    client.close()
  })
})
