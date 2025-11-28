import { KvaserLin } from '../../src/main/dolin/kvaser'
import { equal, deepEqual } from 'assert'
import { describe, it, beforeAll, afterAll, test } from 'vitest'
import * as path from 'path'
import { LinChecksumType, LinDirection, LinMode } from 'src/main/share/lin'

const dllPath = path.join(__dirname, '../../resources/lib')
KvaserLin.loadDllPath(dllPath)

test('kvaser lin get device', () => {
  const v = KvaserLin.getValidDevices()
  console.log(v)
  // equal(v.length, 4)
})
test('kvaser lin get version', () => {
  const v = KvaserLin.getLibVersion()
  equal(v, '8.45.724')
})
describe('toomoss lin master', () => {
  let client!: KvaserLin
  beforeAll(async () => {
    client = new KvaserLin({
      device: {
        handle: 0,
        label: 'lin1',
        id: 'lin1'
      },
      id: 'lin1',
      vendor: 'kvaser',
      name: 'lin1',
      baudRate: 19200,
      mode: LinMode.MASTER
    })
  })

  test('write frames', async () => {
    const w1 = await client.write({
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
    const w3 = client.write({
      frameId: 0x4,
      data: Buffer.from([0x01, 0x11, 0x03, 0x04]),
      direction: LinDirection.RECV,
      checksumType: LinChecksumType.CLASSIC
    })
    await Promise.all([w1, w2])
    try {
      await w3
    } catch (e) {
      console.log(e)
    }
  })
  afterAll(() => {
    client.close()
  })
})
