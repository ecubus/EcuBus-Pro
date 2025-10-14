import { KVASER_CAN } from '../../src/main/docan/kvaser'
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
KVASER_CAN.loadDllPath(dllPath)

describe('kvaser test', () => {
  let client!: KVASER_CAN
  beforeAll(() => {
    client = new KVASER_CAN({
      handle: 0,
      name: 'test',
      id: 'kvaser',
      vendor: 'kvaser',
      canfd: false,
      bitrate: {
        freq: 250000,
        preScaler: 2,
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
    const list = []
    for (let i = 0; i < 10; i++) {
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
  test('period send', async () => {
    const taskId = client.startPeriodSend(
      {
        id: 0x100,
        msgType: { idType: CAN_ID_TYPE.STANDARD, brs: false, canfd: false, remote: false },
        data: Buffer.alloc(8, 0),
        dir: 'OUT'
      },
      100
    )
    const delay = (ms: number) =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(true)
        }, ms)
      })
    await delay(1000)
    client.changePeriodData(taskId, Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]))
    await delay(1000)

    client.stopPeriodSend(taskId)
  })
  afterAll(() => {
    client.close()
  })
})
