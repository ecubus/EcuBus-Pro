import { EcuBusCan } from '../../src/main/docan/ecubus'
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
  const devices = EcuBusCan.getValidDevices()
  console.log(devices)
})

//fw info

test('Candle fw info', () => {
  const v = EcuBusCan.getLibVersion()
  if (v) {
    console.log(v)
  }
})
describe('ecubus test', () => {
  let client!: EcuBusCan
  beforeAll(async () => {
    client = new EcuBusCan({
      name: 'Candle Device 0',
      id: 'Candle_0',
      handle: 0,
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
      candleRes: true
    })

    ///print cap
    // console.log(client.target.bt_const.tseg1_min)
    // console.log(client.target.bt_const.tseg1_max)
    // console.log(client.target.bt_const.tseg2_min)
    // console.log(client.target.bt_const.tseg2_max)
    // console.log(client.target.bt_const.sjw_max)
    // console.log(client.target.bt_const.brp_min)
    // console.log(client.target.bt_const.brp_max)
    // console.log(client.target.bt_const.brp_inc)
    // console.log('xxxx')
    // console.log(client.target.data_bt_const.tseg1_min)
    // console.log(client.target.data_bt_const.tseg1_max)
    // console.log(client.target.data_bt_const.tseg2_min)
    // console.log(client.target.data_bt_const.tseg2_max)
    // console.log(client.target.data_bt_const.sjw_max)
    // console.log(client.target.data_bt_const.brp_min)
    // console.log(client.target.data_bt_const.brp_max)
    // console.log(client.target.data_bt_const.brp_inc)
  })
  test('write single frame', async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    return
    for (let i = 0; i < 2; i++) {
      const t = await client.writeBase(
        0x55,
        {
          idType: CAN_ID_TYPE.STANDARD,
          brs: false,
          canfd: false, //false true
          remote: false
        },
        Buffer.alloc(8, 5)
      )
      console.log(t)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    console.log('write single frame success')
  })
  test.skip('write single frame canfd', async () => {
    // await new Promise(resolve => setTimeout(resolve, 1000))
    for (let i = 0; i < 5; i++) {
      const t = await client.writeBase(
        0x55,
        {
          idType: CAN_ID_TYPE.STANDARD,
          brs: true,
          canfd: true, //false true
          remote: false
        },
        Buffer.alloc(11, 5)
      )
      console.log(t)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    console.log('write single frame success')
  })
  test.skip('write multi frame', async () => {
    const list = []
    for (let i = 10; i > 0; i--) {
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
    await new Promise((resolve) => setTimeout(resolve, 2000))
    console.log(r)
  })
  test.skip('write multi frame', async () => {
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
    console.log('close success')
  })
})
