import { LinCable } from '../../src/main/dolin/ecubus'
import { equal, deepEqual } from 'assert'
import { describe, it, beforeAll, afterAll, test, expect } from 'vitest'
import * as path from 'path'
import { LinChecksumType, LinDirection, LinMode } from 'src/main/share/lin'

test('lincable get device', async () => {
  const v = await LinCable.getValidDevices()
  console.log(v)
  equal(v.length, 1)
})

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
describe.skip('lincable lin master', () => {
  let client!: LinCable
  beforeAll(async () => {
    client = new LinCable({
      device: {
        handle: 'COM8',
        label: 'lin1',
        id: 'lin1'
      },
      id: 'lin1',
      vendor: 'peak',
      name: 'lin1',
      baudRate: 19200,
      mode: LinMode.MASTER
    })
    await delay(2000)
  })
  test.skip('write frame', async () => {
    const t1 = Date.now()
    const w1 = await client.write({
      frameId: 0x2,
      data: Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
      direction: LinDirection.SEND,
      checksumType: LinChecksumType.CLASSIC
    })
    await client.write({
      frameId: 0x3,
      data: Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
      direction: LinDirection.SEND,
      checksumType: LinChecksumType.CLASSIC
    })
    const t2 = Date.now()
    console.log(`write frame time: ${t2 - t1}ms`)
  })
  test('read frame', async () => {
    const t1 = Date.now()

    const w1 = await client.write({
      frameId: 8,
      data: Buffer.from([0x01, 0x02, 0x03, 0x04, 0x5]),
      direction: LinDirection.RECV,
      checksumType: LinChecksumType.CLASSIC
    })
    const t2 = Date.now()
    console.log(`read frame time: ${t2 - t1}ms`)
    expect(client.read(8)?.data).deep.equal(Buffer.from([0x11, 0x22, 0x33, 0x44, 0x55]))
  })
  test.skip('write frames', async () => {
    const w1 = client.write({
      frameId: 0x2,
      data: Buffer.from([0x01, 0x11, 0x03, 0x04]),
      direction: LinDirection.SEND,
      checksumType: LinChecksumType.CLASSIC
    })
    const w2 = client.write({
      frameId: 0x3,
      data: Buffer.from([0x01, 0x11, 0x03, 0x04]),
      direction: LinDirection.SEND,
      checksumType: LinChecksumType.CLASSIC
    })
    await Promise.all([w1, w2])
    console.log(client.read(3))
  })
  afterAll(() => {
    client.close()
  })
})

describe('lincable lin slave', () => {
  let client!: LinCable
  beforeAll(async () => {
    client = new LinCable({
      device: {
        handle: 'COM12',
        label: 'lin1',
        id: 'lin1'
      },
      id: 'lin1',
      vendor: 'peak',
      name: 'lin1',
      baudRate: 19200,
      mode: LinMode.SLAVE
    })
    await delay(2000)
  })
  test('read frame', async () => {
    console.log('read frame')
    client.setEntry(
      3,
      4,
      LinDirection.SEND,
      LinChecksumType.ENHANCED,
      Buffer.from([0x01, 0x02, 0x03, 0x04]),
      0
    )

    // await delay(3000)
  })

  afterAll(() => {
    // client.close()
  })
})
