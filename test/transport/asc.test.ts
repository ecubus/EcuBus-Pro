import EventEmitter from 'events'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDeviceTransport, CanLOG, removeDeviceTransport } from '../../src/main/log'
import { CAN_ID_TYPE, type CanMessage } from '../../src/main/share/can'
import { AscReader } from '../../src/main/replay/ascReader'
import ascTransport, {
  formatAscArbitrationId,
  formatCanMessage,
  isExtendedCanId
} from '../../src/main/transport/asc'

function createCanMessage(overrides: Partial<CanMessage> & Pick<CanMessage, 'id'>): CanMessage {
  return {
    data: Buffer.from([0x03, 0x22, 0x56, 0x78, 0xcc, 0xcc, 0xcc, 0xcc]),
    dir: 'IN',
    ts: 1_000_000,
    msgType: {
      idType: CAN_ID_TYPE.STANDARD,
      canfd: false,
      brs: false,
      remote: false
    },
    ...overrides,
    msgType: {
      idType: CAN_ID_TYPE.STANDARD,
      canfd: false,
      brs: false,
      remote: false,
      ...overrides.msgType
    }
  }
}

describe('ASC extended ID formatting', () => {
  it('appends x for explicit extended frames, including 11-bit values', () => {
    const msg = createCanMessage({
      id: 0x123,
      msgType: { idType: CAN_ID_TYPE.EXTENDED, canfd: false, brs: false, remote: false }
    })
    expect(isExtendedCanId(msg)).toBe(true)
    expect(formatAscArbitrationId(msg)).toBe('123x')
  })

  it('appends x when a 29-bit ID cannot fit in an 11-bit identifier', () => {
    // Hardware/logger may omit idType; Vector ASC still requires the trailing x.
    const msg = createCanMessage({
      id: 0x18daf110,
      msgType: { idType: CAN_ID_TYPE.STANDARD, canfd: false, brs: false, remote: false }
    })
    expect(isExtendedCanId(msg)).toBe(true)
    expect(formatAscArbitrationId(msg)).toBe('18DAF110x')
  })

  it('does not append x for standard 11-bit IDs', () => {
    const msg = createCanMessage({ id: 0x7ff })
    expect(isExtendedCanId(msg)).toBe(false)
    expect(formatAscArbitrationId(msg)).toBe('7FF')
  })

  it('writes classic CAN extended frames in Vector ASC form', () => {
    const msg = createCanMessage({
      id: 0x18daf110,
      msgType: { idType: CAN_ID_TYPE.EXTENDED, canfd: false, brs: false, remote: false }
    })
    const line = formatCanMessage(msg, 1, 4.87687)
    expect(line).toMatch(/1\s+18DAF110x\s+Rx\s+d 8 03 22 56 78 CC CC CC CC/)
    expect(line).not.toMatch(/18DAF110[^x]/)
  })

  it('writes CAN FD extended frames with a trailing x on the ID', () => {
    const msg = createCanMessage({
      id: 0x10001,
      data: Buffer.from([0x01]),
      msgType: { idType: CAN_ID_TYPE.EXTENDED, canfd: true, brs: false, remote: false }
    })
    const line = formatCanMessage(msg, 2, 0.100995)
    expect(line).toMatch(/^0\.100995 CANFD\s+2 Rx\s+10001x\s/)
  })
})

describe('ASC file logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('records extended frames with trailing x and round-trips through AscReader', async () => {
    vi.spyOn(console, 'table').mockImplementation(() => {})

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecubus-asc-ext-'))
    const configuredPath = path.join(tempDir, 'device-log.asc')
    const originalDataSet = global.dataSet
    const originalDeviceIndexMap = new Map(global.deviceIndexMap)
    global.dataSet = {
      devices: {
        'device-a': {}
      }
    } as any
    global.deviceIndexMap.set('device-a', 1)

    const transport = ascTransport(configuredPath, ['device-a'], ['canBase'])
    const closed = new Promise<void>((resolve) => transport.once('closed', resolve))
    const transportId = addDeviceTransport(() => transport)
    const log = new CanLOG('TEST', 'A', 'device-a', new EventEmitter())

    try {
      log.canBase(
        createCanMessage({
          id: 0x18daf110,
          ts: 4_876_870,
          msgType: { idType: CAN_ID_TYPE.EXTENDED, canfd: false, brs: false, remote: false }
        })
      )
      log.canBase(
        createCanMessage({
          id: 0x123,
          ts: 5_000_000,
          data: Buffer.from([0x00, 0x00]),
          msgType: { idType: CAN_ID_TYPE.STANDARD, canfd: false, brs: false, remote: false }
        })
      )
      await new Promise((resolve) => setImmediate(resolve))

      log.close()
      removeDeviceTransport(transportId)
      await closed

      const [generatedFile] = await fs.readdir(tempDir)
      expect(generatedFile).toBeTruthy()
      const filePath = path.join(tempDir, generatedFile)
      const content = await fs.readFile(filePath, 'utf8')

      expect(content).toMatch(/18DAF110x/)
      expect(content).toMatch(/\b123\s+Rx/)
      expect(content).not.toMatch(/\b18DAF110\s/)

      const reader = new AscReader(filePath, 0)
      reader.init()
      const frames = []
      let frame = await reader.readFrame()
      while (frame) {
        frames.push(frame)
        frame = await reader.readFrame()
      }
      reader.close()

      expect(frames.map((item) => [item.id, item.msgType.idType])).toEqual([
        [0x18daf110, CAN_ID_TYPE.EXTENDED],
        [0x123, CAN_ID_TYPE.STANDARD]
      ])
    } finally {
      log.close()
      removeDeviceTransport(transportId)
      global.dataSet = originalDataSet
      global.deviceIndexMap.clear()
      originalDeviceIndexMap.forEach((channel, deviceId) => {
        global.deviceIndexMap.set(deviceId, channel)
      })
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})
