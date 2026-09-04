/**
 * SocketCAN tests.
 *
 * 1. Frame codec vs Linux `struct can_frame` / `struct canfd_frame` (always).
 * 2. Two independent sockets on one bus (always; vcan when AF_CAN exists).
 * 3. Kernel AF_CAN smoke test (skipped when this kernel has no CONFIG_CAN).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'child_process'
import { platform } from 'os'
import { CAN_ERROR_ID, CAN_ID_TYPE, CanError } from '../../src/main/share/can'
import {
  CAN_EFF_FLAG,
  CAN_MTU,
  CAN_RTR_FLAG,
  CANFD_BRS,
  CANFD_MTU,
  packCanFrame,
  unpackCanFrame
} from '../helpers/socketcanFrame'
import {
  createSocketcanTestBus,
  probeLinuxSocketcan,
  SocketcanTestBus,
  SocketcanTestCan,
  socketcanTestInfo
} from '../helpers/socketcanCan'

function pyPack(expr: string): Buffer {
  const r = spawnSync('python3', ['-c', expr], { encoding: 'utf8', timeout: 5000 })
  if (r.status !== 0) {
    throw new Error(r.stderr || 'python pack failed')
  }
  return Buffer.from(r.stdout.trim(), 'hex')
}

describe('SocketCAN frame codec (Linux ABI)', () => {
  it('packs a classic standard frame as struct can_frame (16 bytes)', () => {
    const data = Buffer.from([0x01, 0x02, 0x03, 0x04])
    const packed = packCanFrame(
      0x123,
      { idType: CAN_ID_TYPE.STANDARD, brs: false, canfd: false, remote: false },
      data
    )
    expect(packed.length).toBe(CAN_MTU)
    expect(packed.readUInt32LE(0)).toBe(0x123)
    expect(packed.readUInt8(4)).toBe(4)
    expect(packed.subarray(8, 12)).toEqual(data)
  })

  it('matches Python struct.pack of a standard frame', () => {
    const data = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x11, 0x22])
    const packed = packCanFrame(
      0x7e0,
      { idType: CAN_ID_TYPE.STANDARD, brs: false, canfd: false, remote: false },
      data
    )
    const py = pyPack(
      'import struct; print(struct.pack("=IB3x8s", 0x7e0, 8, bytes([0xaa,0xbb,0xcc,0xdd,0xee,0xff,0x11,0x22])).hex())'
    )
    expect(packed).toEqual(py)
  })

  it('sets CAN_EFF_FLAG for extended IDs and matches Python', () => {
    const data = Buffer.from([0x01])
    const packed = packCanFrame(
      0x18da0201,
      { idType: CAN_ID_TYPE.EXTENDED, brs: false, canfd: false, remote: false },
      data
    )
    expect(packed.readUInt32LE(0)).toBe((0x18da0201 | CAN_EFF_FLAG) >>> 0)
    const py = pyPack(
      `import struct; print(struct.pack("=IB3x8s", 0x18da0201 | 0x80000000, 1, bytes([1]).ljust(8, b"\\0")).hex())`
    )
    expect(packed).toEqual(py)
  })

  it('sets CAN_RTR_FLAG for remote frames', () => {
    const packed = packCanFrame(
      0x100,
      { idType: CAN_ID_TYPE.STANDARD, brs: false, canfd: false, remote: true },
      Buffer.alloc(0)
    )
    expect(packed.readUInt32LE(0)).toBe((0x100 | CAN_RTR_FLAG) >>> 0)
  })

  it('packs CAN-FD frames as struct canfd_frame (72 bytes)', () => {
    const data = Buffer.alloc(64, 0x5a)
    const packed = packCanFrame(
      0x42,
      { idType: CAN_ID_TYPE.STANDARD, brs: true, canfd: true, remote: false },
      data
    )
    expect(packed.length).toBe(CANFD_MTU)
    expect(packed.readUInt8(4)).toBe(64)
    expect(packed.readUInt8(5)).toBe(CANFD_BRS)
    expect(packed.subarray(8, 72)).toEqual(data)
  })

  it('round-trips pack/unpack for standard, extended and CAN-FD', () => {
    const cases = [
      {
        id: 0x123,
        msgType: { idType: CAN_ID_TYPE.STANDARD, brs: false, canfd: false, remote: false },
        data: Buffer.from([1, 2, 3])
      },
      {
        id: 0x1abcdeff,
        msgType: { idType: CAN_ID_TYPE.EXTENDED, brs: false, canfd: false, remote: false },
        data: Buffer.from([0xff, 0x00])
      },
      {
        id: 0x55,
        msgType: { idType: CAN_ID_TYPE.STANDARD, brs: true, canfd: true, remote: false },
        data: Buffer.alloc(12, 7)
      }
    ] as const
    for (const c of cases) {
      const parsed = unpackCanFrame(packCanFrame(c.id, c.msgType, c.data))
      expect(parsed.id).toBe(c.id)
      expect(parsed.msgType).toEqual(c.msgType)
      expect(parsed.data).toEqual(c.data)
    }
  })
})

describe('SocketCAN two-socket bus', () => {
  let bus: SocketcanTestBus
  let a: SocketcanTestCan
  let b: SocketcanTestCan

  beforeAll(async () => {
    bus = await createSocketcanTestBus()
    console.log(`SocketCAN I/O tests using ${bus.kind} bus on ${bus.iface}`)
    a = new SocketcanTestCan(socketcanTestInfo('socketcan-a', bus.iface), bus)
    b = new SocketcanTestCan(socketcanTestInfo('socketcan-b', bus.iface), bus)
    await a.open()
    await b.open()
  })

  afterAll(() => {
    a.close()
    b.close()
  })

  it('delivers a standard frame from A to B', async () => {
    const data = Buffer.from([0x11, 0x22, 0x33, 0x44])
    const msgType = {
      idType: CAN_ID_TYPE.STANDARD,
      brs: false,
      canfd: false,
      remote: false
    }
    const pending = b.readBase(0x123, msgType, 1000)
    await a.writeBase(0x123, msgType, data)
    const rx = await pending
    expect(rx.data).toEqual(data)
    expect(typeof rx.ts).toBe('number')
  })

  it('delivers an extended frame from B to A', async () => {
    const data = Buffer.from([0xde, 0xad, 0xbe, 0xef])
    const msgType = {
      idType: CAN_ID_TYPE.EXTENDED,
      brs: false,
      canfd: false,
      remote: false
    }
    const pending = a.readBase(0x18da0201, msgType, 1000)
    await b.writeBase(0x18da0201, msgType, data)
    const rx = await pending
    expect(rx.data).toEqual(data)
  })

  it('fans a frame out to every other socket on the bus', async () => {
    const c = new SocketcanTestCan(socketcanTestInfo('socketcan-c', bus.iface), bus)
    await c.open()
    try {
      const msgType = {
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false,
        remote: false
      }
      const data = Buffer.from([0x99])
      const pb = b.readBase(0x321, msgType, 1000)
      const pc = c.readBase(0x321, msgType, 1000)
      await a.writeBase(0x321, msgType, data)
      expect((await pb).data).toEqual(data)
      expect((await pc).data).toEqual(data)
    } finally {
      c.close()
    }
  })

  it('times out when no matching frame arrives', async () => {
    const msgType = {
      idType: CAN_ID_TYPE.STANDARD,
      brs: false,
      canfd: false,
      remote: false
    }
    await expect(b.readBase(0x7e0, msgType, 50)).rejects.toMatchObject({
      errorId: CAN_ERROR_ID.CAN_READ_TIMEOUT
    })
  })

  it('rejects classic CAN payloads longer than 8 bytes', async () => {
    const msgType = {
      idType: CAN_ID_TYPE.STANDARD,
      brs: false,
      canfd: false,
      remote: false
    }
    await expect(
      Promise.resolve().then(() => a.writeBase(0x1, msgType, Buffer.alloc(9)))
    ).rejects.toBeInstanceOf(CanError)
  })
})

describe.skipIf(platform() !== 'linux' || !probeLinuxSocketcan().ok)(
  'Linux SocketCAN kernel (vcan)',
  () => {
    it('probe reports a usable can/vcan interface', () => {
      const probe = probeLinuxSocketcan()
      expect(probe.ok).toBe(true)
      expect(probe.iface).toMatch(/can/)
    })

    it('two AF_CAN sockets exchange a frame on the kernel bus', async () => {
      const bus = await createSocketcanTestBus()
      expect(bus.kind).toBe('vcan')
      const a = new SocketcanTestCan(socketcanTestInfo('k-a', bus.iface), bus)
      const b = new SocketcanTestCan(socketcanTestInfo('k-b', bus.iface), bus)
      await a.open()
      await b.open()
      try {
        const msgType = {
          idType: CAN_ID_TYPE.STANDARD,
          brs: false,
          canfd: false,
          remote: false
        }
        const data = Buffer.from([0x42, 0x43])
        const pending = b.readBase(0x42, msgType, 1000)
        await a.writeBase(0x42, msgType, data)
        expect((await pending).data).toEqual(data)
      } finally {
        a.close()
        b.close()
      }
    })
  }
)
