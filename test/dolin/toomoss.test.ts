import { ToomossLin } from '../../src/main/dolin/toomoss'
import { equal, deepEqual } from 'assert'
import { describe, it, beforeAll, afterAll, test } from 'vitest'
import * as path from 'path'
import { LinChecksumType, LinDirection, LinMode } from 'src/main/share/lin'

const dllPath = path.join(__dirname, '../../resources/lib')
ToomossLin.loadDllPath(dllPath)

test('toomoss lin get device', () => {
  const v = ToomossLin.getValidDevices()
  equal(v.length, 4)
})

describe('toomoss lin master', () => {
  let client!: ToomossLin
  beforeAll(async () => {
    client = new ToomossLin({
      device: {
        handle: 1,
        label: 'lin1',
        id: 'lin1'
      },
      id: 'lin1',
      vendor: 'peak',
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
    await Promise.all([w1, w2])
  })
  afterAll(() => {
    client.close()
  })
})
