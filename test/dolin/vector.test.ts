import { VectorLin } from '../../src/main/dolin/vector'
import { equal, deepEqual } from 'assert'
import { describe, it, beforeAll, afterAll, test } from 'vitest'
import * as path from 'path'
import { LinChecksumType, LinDirection, LinMode } from 'src/main/share/lin'

const dllPath = path.join(__dirname, '../../resources/lib')
VectorLin.loadDllPath(dllPath)

test('vector lin get device', () => {
  const v = VectorLin.getValidDevices()
  // equal(v.length, 4)
  console.log(v)
})

describe('vector lin master', () => {
  let client!: VectorLin
  beforeAll(async () => {
    client = new VectorLin({
      device: {
        handle: '0:0',
        label: 'VN1640A Channel 1#LIN',
        id: 'VECTOR_0_#LIN'
      },
      id: 'lin1',
      vendor: 'vector',
      name: 'lin1',
      baudRate: 19200,
      mode: LinMode.MASTER //SLAVE MASTER
    })
  })

  // test('write frames', async () => {
  //   const w1 = await client.write({
  //     frameId: 0x2,
  //     data: Buffer.from([0x01, 0x11, 0x03, 0x04]),
  //     direction: LinDirection.SEND,
  //     checksumType: LinChecksumType.ENHANCED //CLASSIC ENHANCED
  //   })
  //   const w2 = client.write({
  //     frameId: 0x3,
  //     data: Buffer.from([0x01, 0x11, 0x03, 0x04]),
  //     direction: LinDirection.SEND,
  //     checksumType: LinChecksumType.CLASSIC
  //   })
  //   await Promise.all([w1, w2])
  // })

  test('write frames', async () => {
    const readResult = await client.callback()
  })

  // afterAll(() => {
  //   client.close()
  // })
})
