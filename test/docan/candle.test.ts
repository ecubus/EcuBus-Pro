import { Candle_CAN } from '../../src/main/docan/candle'
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

test('Candle scan device', () => {
  const devices = Candle_CAN.getValidDevices()
  console.log(devices)
})

//fw info

test('Candle fw info', () => {
  const v = Candle_CAN.getLibVersion()
  if (v) {
    console.log(v)
  }
})
describe('candel test', () => {
  let client!: Candle_CAN
  beforeAll(async () => {
    client = new Candle_CAN({
      name: 'Candle Device 0',
      id: 'Candle_0',
      handle: 1,
      vendor: 'candle',
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
      },
      canbleRes: true
    })

    ///print cap
    console.log(client.target.bt_const.tseg1_min)
    console.log(client.target.bt_const.tseg1_max)
    console.log(client.target.bt_const.tseg2_min)
    console.log(client.target.bt_const.tseg2_max)
    console.log(client.target.bt_const.sjw_max)
    console.log(client.target.bt_const.brp_min)
    console.log(client.target.bt_const.brp_max)
    console.log(client.target.bt_const.brp_inc)
    console.log('xxxx')
    console.log(client.target.data_bt_const.tseg1_min)
    console.log(client.target.data_bt_const.tseg1_max)
    console.log(client.target.data_bt_const.tseg2_min)
    console.log(client.target.data_bt_const.tseg2_max)
    console.log(client.target.data_bt_const.sjw_max)
    console.log(client.target.data_bt_const.brp_min)
    console.log(client.target.data_bt_const.brp_max)
    console.log(client.target.data_bt_const.brp_inc)
  })

  test('write multi frame', async () => {
    const list = []
    for (let i = 0; i < 2; i++) {
      list.push(
        client.writeBase(
          i + 1,
          {
            idType: CAN_ID_TYPE.STANDARD,
            brs: false,
            canfd: false, //false true
            remote: false
          },
          Buffer.alloc(8, 5 * i)
        )
      )
    }
    const r = await Promise.all(list)

    console.log(r)
  })
  test.skip('write frame can-fd', async () => {
    await client.writeBase(
      31,
      {
        idType: CAN_ID_TYPE.EXTENDED,
        brs: true,
        canfd: true, //false true
        remote: false
      },
      Buffer.alloc(11, 31)
    )
    await client.writeBase(
      31,
      {
        idType: CAN_ID_TYPE.STANDARD,
        brs: true,
        canfd: true, //false true
        remote: false
      },
      Buffer.alloc(33, 31)
    )
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
        brs: false,
        canfd: true, //false true
        remote: false
      },
      5000 * 1000
    )
    console.log(r1)
    const r2 = await client.readBase(
      0x7e1,
      {
        idType: CAN_ID_TYPE.EXTENDED,
        brs: false,
        canfd: true, //false true
        remote: false
      },
      5000 * 1000
    )
    console.log(r2)
  })

  afterAll(() => {
    client.close()
  })
})
