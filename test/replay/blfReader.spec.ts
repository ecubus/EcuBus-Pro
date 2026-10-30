import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import zlib from 'zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BlfReader } from '../../src/main/replay/blfReader'
import type { ReplayCanFrame } from '../../src/main/replay/index'
import { CAN_ID_TYPE, getTsUs, type CanMessage } from '../../src/main/share/can'
import blfTransport from '../../src/main/transport/blf'

let tempDir = ''
let fileIndex = 0

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecubus-blf-reader-'))
})

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true })
})

function fileHeader(): Buffer {
  const header = Buffer.alloc(144)
  header.write('LOGG', 0, 'ascii')
  header.writeUInt32LE(144, 4)
  return header
}

/** Object with a VBLObjectHeader (version 1) or VBLObjectHeader2 (version 2) */
function object(type: number, payload: Buffer, tsNs: bigint, version = 1): Buffer {
  const headerSize = version === 2 ? 40 : 32
  const obj = Buffer.alloc(headerSize + payload.length)
  obj.write('LOBJ', 0, 'ascii')
  obj.writeUInt16LE(headerSize, 4)
  obj.writeUInt16LE(version, 6)
  obj.writeUInt32LE(obj.length, 8)
  obj.writeUInt32LE(type, 12)
  obj.writeUInt32LE(2, 16) // ONE_NANS
  obj.writeBigUInt64LE(tsNs, 24)
  payload.copy(obj, headerSize)
  return obj
}

function container(inner: Buffer, compress = false, padding = 0): Buffer {
  const payload = compress ? zlib.deflateSync(inner) : inner
  const obj = Buffer.alloc(32 + payload.length + padding)
  obj.write('LOBJ', 0, 'ascii')
  obj.writeUInt16LE(16, 4)
  obj.writeUInt16LE(1, 6)
  obj.writeUInt32LE(32 + payload.length, 8)
  obj.writeUInt32LE(10, 12)
  obj.writeUInt16LE(compress ? 2 : 0, 16)
  obj.writeUInt32LE(inner.length, 24)
  payload.copy(obj, 32)
  return obj
}

function canFdPayload(opts: {
  channel: number
  id: number
  dlc: number
  fdFlags: number
  flags?: number
  data: number[]
}): Buffer {
  const p = Buffer.alloc(84)
  p.writeUInt16LE(opts.channel, 0)
  p.writeUInt8(opts.flags ?? 0, 2)
  p.writeUInt8(opts.dlc, 3)
  p.writeUInt32LE(opts.id, 4)
  p.writeUInt8(opts.fdFlags, 13)
  p.writeUInt8(opts.data.length, 14)
  Buffer.from(opts.data).copy(p, 20)
  return p
}

function canMessage2Payload(
  channel: number,
  id: number,
  flags: number,
  dlc: number,
  data: number[]
) {
  const p = Buffer.alloc(24)
  p.writeUInt16LE(channel, 0)
  p.writeUInt8(flags, 2)
  p.writeUInt8(dlc, 3)
  p.writeUInt32LE(id, 4)
  Buffer.from(data).copy(p, 8)
  return p
}

async function readFrames(filePath: string): Promise<ReplayCanFrame[]> {
  const reader = new BlfReader(filePath, 0)
  reader.init()
  const frames: ReplayCanFrame[] = []
  try {
    let frame = await reader.readFrame()
    while (frame) {
      frames.push(frame)
      frame = await reader.readFrame()
    }
  } finally {
    reader.close()
  }
  return frames
}

async function readBlf(...parts: Buffer[]): Promise<ReplayCanFrame[]> {
  const filePath = path.join(tempDir, `log-${fileIndex++}.blf`)
  await fs.writeFile(filePath, Buffer.concat([fileHeader(), ...parts]))
  return readFrames(filePath)
}

describe('BLF reader objects', () => {
  it('reads EDL, BRS and ESI of CAN_FD_MESSAGE (B1, B2)', async () => {
    const frames = await readBlf(
      container(
        Buffer.concat([
          object(
            100,
            canFdPayload({ channel: 1, id: 0x123, dlc: 9, fdFlags: 0x7, data: Array(12).fill(1) }),
            1000n
          ),
          object(
            100,
            canFdPayload({ channel: 2, id: 0x124, dlc: 2, fdFlags: 0, data: [1, 2] }),
            2000n
          )
        ])
      )
    )
    expect(frames[0]).toMatchObject({ channel: 1, id: 0x123, dlc: 9, ts: 1 })
    expect(frames[0].msgType).toMatchObject({ canfd: true, brs: true, esi: true })
    expect(frames[0].data.length).toBe(12)
    expect(frames[1].msgType).toMatchObject({ canfd: false, brs: false, esi: false })
  })

  it('reads remote frames without data and keeps the DLC (B3)', async () => {
    const frames = await readBlf(
      container(object(86, canMessage2Payload(1, 0x200, 0x80, 8, [1, 2, 3, 4, 5, 6, 7, 8]), 0n))
    )
    expect(frames[0].msgType.remote).toBe(true)
    expect(frames[0].dlc).toBe(8)
    expect(frames[0].data.length).toBe(0)
  })

  it('reads objects with VBLObjectHeader2 (B4)', async () => {
    const frames = await readBlf(
      container(object(86, canMessage2Payload(3, 0x321, 0x1, 2, [0xaa, 0xbb]), 5_000_000n, 2))
    )
    expect(frames[0]).toMatchObject({ channel: 3, id: 0x321, dir: 'OUT', ts: 5000 })
    expect(frames[0].data.toString('hex')).toBe('aabb')
  })

  it('finds the next object with or without padding (B5)', async () => {
    const odd = object(86, canMessage2Payload(1, 0x1, 0, 1, [1]), 0n).subarray(0, 41)
    odd.writeUInt32LE(41, 8)
    const next = object(86, canMessage2Payload(1, 0x2, 0, 1, [2]), 0n)
    const frames = await readBlf(
      container(Buffer.concat([odd, next])),
      container(Buffer.concat([odd, Buffer.alloc(1), next]), true)
    )
    expect(frames.map((f) => f.id)).toEqual([1, 2, 1, 2])
  })

  it('reads CAN_ERROR, CAN_ERROR_EXT and CAN_FD_ERROR_64 (B6)', async () => {
    const fdError = Buffer.alloc(104)
    fdError.writeUInt8(4, 0)
    const frames = await readBlf(
      container(
        Buffer.concat([
          object(2, Buffer.from([2, 0, 0, 0]), 0n),
          object(73, Buffer.concat([Buffer.from([3, 0]), Buffer.alloc(30)]), 0n),
          object(104, fdError, 0n)
        ])
      )
    )
    expect(frames.map((f) => [f.channel, f.isError])).toEqual([
      [2, true],
      [3, true],
      [4, true]
    ])
  })

  it('reads ESI and remote flags of CAN_FD_MESSAGE_64', async () => {
    const p = Buffer.alloc(40 + 8)
    p.writeUInt8(1, 0)
    p.writeUInt8(8, 1)
    p.writeUInt8(8, 2)
    p.writeUInt32LE(0x80000100, 4)
    p.writeUInt32LE(0x1000 | 0x4000, 12)
    const remote = Buffer.alloc(40)
    remote.writeUInt8(1, 0)
    remote.writeUInt8(4, 1)
    remote.writeUInt32LE(0x10, 12)
    const frames = await readBlf(
      container(Buffer.concat([object(101, p, 0n), object(101, remote, 0n)]))
    )
    expect(frames[0].msgType).toMatchObject({
      idType: CAN_ID_TYPE.EXTENDED,
      canfd: true,
      esi: true,
      brs: false
    })
    expect(frames[1].msgType).toMatchObject({ canfd: false, remote: true })
    expect(frames[1].dlc).toBe(4)
    expect(frames[1].data.length).toBe(0)
  })
})

describe('BLF reader errors (B7, B8)', () => {
  it('reports a container that fails to decompress', async () => {
    const bad = container(Buffer.alloc(64), true)
    bad.fill(0xff, 32)
    await expect(readBlf(bad)).rejects.toThrow(/decompression failed/)
  })

  it('reports a file that ends inside an object', async () => {
    const full = container(object(86, canMessage2Payload(1, 1, 0, 1, [1]), 0n))
    await expect(readBlf(full.subarray(0, full.length - 10))).rejects.toThrow(/ends inside/)
  })

  it('reports an unsupported compression method', async () => {
    const obj = container(Buffer.alloc(8))
    obj.writeUInt16LE(7, 16)
    await expect(readBlf(obj)).rejects.toThrow(/compression method/)
  })

  it('reports garbage between objects', async () => {
    const one = object(86, canMessage2Payload(1, 1, 0, 1, [1]), 0n)
    await expect(
      readBlf(container(Buffer.concat([one, Buffer.alloc(12, 0x11), one])))
    ).rejects.toThrow(/no object signature/)
  })
})

describe('BLF writer', () => {
  function msg(
    over: Omit<Partial<CanMessage>, 'msgType'> & { msgType?: Partial<CanMessage['msgType']> }
  ): CanMessage {
    return {
      id: 0x100,
      dir: 'OUT',
      data: Buffer.from([1, 2]),
      ts: 0,
      ...over,
      msgType: {
        idType: CAN_ID_TYPE.STANDARD,
        canfd: false,
        brs: false,
        remote: false,
        ...over.msgType
      }
    }
  }

  async function writeBlf(entries: { method: string; data: any; deviceId?: string }[]) {
    const filePath = path.join(tempDir, `written-${fileIndex++}.blf`)
    global.deviceIndexMap = new Map([
      ['dev1', 1],
      ['dev2', 2]
    ])
    const transport = blfTransport(filePath, [], ['canBase', 'canError'], 0)
    for (const entry of entries) {
      transport.log({ message: { deviceId: 'dev1', ...entry } }, () => {})
    }
    await new Promise<void>((resolve) => transport.close(resolve))
    return filePath
  }

  it('round-trips classic, remote, DLC>8, CAN FD with ESI and error frames (W1-W3)', async () => {
    const written = [
      msg({ id: 0x100, ts: 10 }),
      msg({ id: 0x101, data: Buffer.alloc(0), dlc: 6, ts: 20, msgType: { remote: true } }),
      msg({ id: 0x102, data: Buffer.alloc(8, 0xaa), dlc: 15, ts: 30 }),
      msg({
        id: 0x18daf110,
        data: Buffer.alloc(10, 0x55),
        ts: 40,
        msgType: { idType: CAN_ID_TYPE.EXTENDED, canfd: true, brs: true, esi: true }
      })
    ]
    const filePath = await writeBlf([
      ...written.map((data) => ({ method: 'canBase', data })),
      { method: 'canError', data: { ts: 50 }, deviceId: 'dev2' }
    ])
    const frames = await readFrames(filePath)
    expect(frames).toHaveLength(5)
    expect(frames.slice(0, 4).map((f) => [f.id, f.ts, f.dlc, f.data.toString('hex')])).toEqual([
      [0x100, 10, 2, '0102'],
      [0x101, 20, 6, ''],
      [0x102, 30, 15, 'aaaaaaaaaaaaaaaa'],
      [0x18daf110, 40, 9, '55555555555555555555' + '0000']
    ])
    expect(frames[1].msgType.remote).toBe(true)
    expect(frames[3].msgType).toMatchObject({
      idType: CAN_ID_TYPE.EXTENDED,
      canfd: true,
      brs: true,
      esi: true
    })
    expect(frames[4]).toMatchObject({ channel: 2, ts: 50, isError: true })

    const raw = await fs.readFile(filePath)
    const types: number[] = []
    const sizes: number[] = []
    let pos = raw.indexOf('LOBJ', 144 + 4)
    while (pos >= 0) {
      types.push(raw.readUInt32LE(pos + 12))
      sizes.push(raw.readUInt32LE(pos + 8))
      pos = raw.indexOf('LOBJ', pos + 4)
    }
    expect(types).toEqual([86, 86, 86, 100, 73])
    // VBLCANMessage2 = 32 + 24, VBLCANErrorFrameExt = 32 + 32
    expect(sizes[0]).toBe(56)
    expect(sizes[4]).toBe(64)
  })

  it('writes the measurement start of the frame time base (W4)', async () => {
    const previous = global.startTs
    global.startTs = getTsUs() - 5_000_000
    try {
      const expected = Date.now() - 5000
      const filePath = await writeBlf([{ method: 'canBase', data: msg({ ts: 1_000_000 }) }])
      const raw = await fs.readFile(filePath)
      const start = new Date(
        raw.readUInt16LE(40),
        raw.readUInt16LE(42) - 1,
        raw.readUInt16LE(46),
        raw.readUInt16LE(48),
        raw.readUInt16LE(50),
        raw.readUInt16LE(52),
        raw.readUInt16LE(54)
      ).getTime()
      expect(Math.abs(start - expected)).toBeLessThan(1000)
    } finally {
      global.startTs = previous
    }
  })
})
