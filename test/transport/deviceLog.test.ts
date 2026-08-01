import EventEmitter from 'events'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import Transport from 'winston-transport'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDeviceTransport, CanLOG, removeDeviceTransport } from '../../src/main/log'
import { CAN_ID_TYPE, type CanMessage } from '../../src/main/share/can'
import { BlfReader } from '../../src/main/replay/blfReader'
import blfTransport from '../../src/main/transport/blf'

class CaptureTransport extends Transport {
  devices: string[]
  messages: any[] = []
  closeCount = 0

  constructor(devices: string[]) {
    super({ level: 'debug' })
    this.devices = devices
  }

  log(info: any, callback: () => void) {
    this.messages.push(info.message)
    callback()
  }

  close() {
    this.closeCount++
  }
}

function createCanMessage(id: number): CanMessage {
  return {
    id,
    data: Buffer.from([id]),
    dir: 'IN',
    msgType: {
      idType: CAN_ID_TYPE.STANDARD,
      canfd: false,
      brs: false,
      remote: false
    },
    ts: id
  }
}

describe('device file logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses one transport for all selected devices and closes it once', async () => {
    vi.spyOn(console, 'table').mockImplementation(() => {})

    const transport = new CaptureTransport(['device-a', 'device-b'])
    const factory = vi.fn(() => transport)
    const transportId = addDeviceTransport(factory)
    const logs = [
      new CanLOG('TEST', 'A', 'device-a', new EventEmitter()),
      new CanLOG('TEST', 'B', 'device-b', new EventEmitter()),
      new CanLOG('TEST', 'C', 'device-c', new EventEmitter())
    ]

    try {
      logs[0].canBase(createCanMessage(0x11))
      logs[1].canBase(createCanMessage(0x22))
      logs[2].canBase(createCanMessage(0x33))

      await vi.waitFor(() => expect(transport.messages).toHaveLength(2))

      expect(factory).toHaveBeenCalledTimes(1)
      expect(transport.messages.map((message) => message.deviceId)).toEqual([
        'device-a',
        'device-b'
      ])

      logs.forEach((log) => log.close())
      expect(transport.closeCount).toBe(0)

      removeDeviceTransport(transportId)
      expect(transport.closeCount).toBe(1)
    } finally {
      logs.forEach((log) => log.close())
      removeDeviceTransport(transportId)
    }
  })

  it('writes frames from two devices into one BLF file', async () => {
    vi.spyOn(console, 'table').mockImplementation(() => {})

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecubus-device-log-'))
    const configuredPath = path.join(tempDir, 'device-log.blf')
    const originalDataSet = global.dataSet
    const originalDeviceIndexMap = new Map(global.deviceIndexMap)
    global.dataSet = {
      devices: {
        'device-a': {},
        'device-b': {}
      }
    } as any
    global.deviceIndexMap.set('device-a', 1)
    global.deviceIndexMap.set('device-b', 2)

    const transport = blfTransport(configuredPath, ['device-a', 'device-b'], ['canBase'], 0)
    const closed = new Promise<void>((resolve) => transport.once('closed', resolve))
    const transportId = addDeviceTransport(() => transport)
    const logs = [
      new CanLOG('TEST', 'A', 'device-a', new EventEmitter()),
      new CanLOG('TEST', 'B', 'device-b', new EventEmitter())
    ]

    try {
      logs[0].canBase(createCanMessage(0x11))
      logs[1].canBase(createCanMessage(0x22))
      await new Promise((resolve) => setImmediate(resolve))

      logs.forEach((log) => log.close())
      removeDeviceTransport(transportId)
      await closed

      const [generatedFile] = await fs.readdir(tempDir)
      expect(generatedFile).toBeTruthy()
      const filePath = path.join(tempDir, generatedFile)
      const reader = new BlfReader(filePath, 0)
      reader.init()
      const frames = []
      let frame = await reader.readFrame()
      while (frame) {
        frames.push(frame)
        frame = await reader.readFrame()
      }
      reader.close()

      expect(frames.map((item) => [item.channel, item.id])).toEqual([
        [1, 0x11],
        [2, 0x22]
      ])
    } finally {
      logs.forEach((log) => log.close())
      removeDeviceTransport(transportId)
      global.dataSet = originalDataSet
      global.deviceIndexMap.clear()
      originalDeviceIndexMap.forEach((channel, deviceId) => {
        global.deviceIndexMap.set(deviceId, channel)
      })
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('writes all frames from two devices across compressed BLF containers', async () => {
    vi.spyOn(console, 'table').mockImplementation(() => {})

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecubus-device-log-large-'))
    const configuredPath = path.join(tempDir, 'device-log-large.blf')
    const originalDataSet = global.dataSet
    const originalDeviceIndexMap = new Map(global.deviceIndexMap)
    global.dataSet = {
      devices: {
        'device-a': {},
        'device-b': {}
      }
    } as any
    global.deviceIndexMap.set('device-a', 1)
    global.deviceIndexMap.set('device-b', 2)

    const transport = blfTransport(configuredPath, ['device-a', 'device-b'], ['canBase'], -1)
    const closed = new Promise<void>((resolve) => transport.once('closed', resolve))
    const transportId = addDeviceTransport(() => transport)
    const logs = [
      new CanLOG('TEST', 'A', 'device-a', new EventEmitter()),
      new CanLOG('TEST', 'B', 'device-b', new EventEmitter())
    ]

    try {
      let randomState = 0x12345678
      for (let index = 0; index < 2500; index++) {
        for (let deviceIndex = 0; deviceIndex < logs.length; deviceIndex++) {
          randomState = (randomState * 1664525 + 1013904223) >>> 0
          const message = createCanMessage(deviceIndex === 0 ? 0x111 : 0x222)
          message.data = Buffer.alloc(8)
          message.data.writeUInt32LE(randomState, 0)
          message.data.writeUInt32LE(index, 4)
          message.ts = index * 100_000 + deviceIndex
          logs[deviceIndex].canBase(message)
        }
      }
      await new Promise((resolve) => setImmediate(resolve))

      logs.forEach((log) => log.close())
      removeDeviceTransport(transportId)
      await closed

      const [generatedFile] = await fs.readdir(tempDir)
      expect(generatedFile).toBeTruthy()
      const filePath = path.join(tempDir, generatedFile)
      const fileData = await fs.readFile(filePath)
      const containerRemainders = []
      let containerOffset = fileData.readUInt32LE(4)
      while (containerOffset < fileData.length) {
        expect(fileData.toString('ascii', containerOffset, containerOffset + 4)).toBe('LOBJ')
        const objectSize = fileData.readUInt32LE(containerOffset + 8)
        const objectType = fileData.readUInt32LE(containerOffset + 12)
        const paddingSize = objectSize % 4
        expect(objectType).toBe(10)
        containerRemainders.push(paddingSize)
        containerOffset += objectSize + paddingSize
      }
      expect(containerOffset).toBe(fileData.length)
      expect(containerRemainders.length).toBeGreaterThan(1)
      expect(containerRemainders.some((remainder) => remainder === 1 || remainder === 3)).toBe(true)

      const reader = new BlfReader(filePath, 0)
      reader.init()
      const channelCounts = new Map<number, number>()
      let frameCount = 0
      let frame = await reader.readFrame()
      while (frame) {
        frameCount++
        channelCounts.set(frame.channel, (channelCounts.get(frame.channel) ?? 0) + 1)
        frame = await reader.readFrame()
      }
      reader.close()

      expect(frameCount).toBe(5000)
      expect(channelCounts).toEqual(
        new Map([
          [1, 2500],
          [2, 2500]
        ])
      )
    } finally {
      logs.forEach((log) => log.close())
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
