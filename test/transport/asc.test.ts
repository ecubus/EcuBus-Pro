import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import winston from 'winston'
import { describe, expect, it, vi } from 'vitest'
import { CAN_ID_TYPE, type CanMessage } from '../../src/main/share/can'
import { LinChecksumType, LinDirection } from '../../src/main/share/lin'
import { AscReader } from '../../src/main/replay/ascReader'
import ascTransport, {
  formatAscArbitrationId,
  formatCanMessage,
  isExtendedCanId
} from '../../src/main/transport/asc'
import {
  canLen2Dlc,
  formatAscHeader,
  formatLinError,
  formatLinEvent,
  formatLinMessage
} from '../../src/main/share/asc'

function createCanMessage(overrides: Partial<CanMessage> & Pick<CanMessage, 'id'>): CanMessage {
  return {
    data: Buffer.from([0x03, 0x22, 0x56, 0x78, 0xcc, 0xcc, 0xcc, 0xcc]),
    dir: 'IN',
    ts: 1_000_000,
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
    // Hardware/logger may omit idType; ASC still requires the trailing x.
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

  it('writes classic CAN extended frames in ASC form', () => {
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

describe('ASC reader round-trip', () => {
  it('parses trailing x as an extended frame and keeps standard IDs standard', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecubus-asc-ext-'))
    const filePath = path.join(tempDir, 'device-log.asc')

    try {
      const extended = createCanMessage({
        id: 0x18daf110,
        msgType: { idType: CAN_ID_TYPE.EXTENDED, canfd: false, brs: false, remote: false }
      })
      const standard = createCanMessage({
        id: 0x123,
        data: Buffer.from([0x00, 0x00]),
        msgType: { idType: CAN_ID_TYPE.STANDARD, canfd: false, brs: false, remote: false }
      })

      const content = [
        'date Tue Aug 25 03:55:52.711 2026',
        'base hex timestamps absolute',
        'internal events logged',
        'Begin Triggerblock Tue Aug 25 03:55:52.711 2026',
        formatCanMessage(extended, 1, 4.87687),
        formatCanMessage(standard, 1, 5.0),
        'End TriggerBlock',
        ''
      ].join('\n')

      await fs.writeFile(filePath, content, 'utf8')

      const reader = new AscReader(filePath, 0)
      reader.init()
      const frames = []
      let frame = await reader.readFrame()
      while (frame) {
        frames.push(frame)
        frame = await reader.readFrame()
      }
      reader.close()

      expect(content).toMatch(/18DAF110x/)
      expect(content).not.toMatch(/\b18DAF110\s/)
      expect(frames.map((item) => [item.id, item.msgType.idType])).toEqual([
        [0x18daf110, CAN_ID_TYPE.EXTENDED],
        [0x123, CAN_ID_TYPE.STANDARD]
      ])
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})

describe('ASC writer fields', () => {
  it('writes the remote frame DLC (A1)', () => {
    const msg = createCanMessage({
      id: 0x200,
      data: Buffer.alloc(0),
      dlc: 8,
      msgType: { idType: CAN_ID_TYPE.STANDARD, canfd: false, brs: false, remote: true }
    })
    expect(formatCanMessage(msg, 1, 2.501)).toMatch(/200\s+Rx\s+r 8$/)
  })

  it('writes ESI and pads CAN FD data to the DLC length (A2)', () => {
    const msg = createCanMessage({
      id: 0x123,
      data: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      msgType: { idType: CAN_ID_TYPE.STANDARD, canfd: true, brs: true, remote: false, esi: true }
    })
    const tokens = formatCanMessage(msg, 1, 0.2).split(/\s+/)
    // <Time> CANFD <Ch> <Dir> <ID> <BRS> <ESI> <DLC> <DataLength> <D1>...
    expect(tokens.slice(5, 9)).toEqual(['1', '1', '9', '12'])
    expect(tokens.slice(9, 21).join('')).toBe('0102030405060708090A0000')
    expect(parseInt(tokens[23], 16)).toBe((1 << 12) | (1 << 13) | (1 << 14))
  })

  it('writes LIN checksum model and nominal bit times (A3, A5)', () => {
    const line = formatLinMessage(
      {
        frameId: 0x2d,
        data: Buffer.from([1, 2]),
        direction: LinDirection.RECV,
        checksumType: LinChecksumType.CLASSIC
      },
      1,
      3.1128
    )
    expect(line).toMatch(/^3\.112800 Li 2d Rx 2 01 02\s+checksum = [0-9a-f]{2} /)
    expect(line).toContain('header time = 34, full time = 64')
    expect(line).toMatch(/CSM = classic$/)
  })

  it('writes receive errors with all required fields (A4, A6)', () => {
    const msg = {
      frameId: 0x33,
      data: Buffer.alloc(8),
      direction: LinDirection.RECV,
      checksumType: LinChecksumType.ENHANCED
    }
    const framing = formatLinError('framing error', msg, 1, 0.5)
    expect(framing).toMatch(/^0\.500000 Li 33 8 RcvError: framing error StateReason = 2c /)
    expect(framing).toMatch(
      / HasDatabytes = 0 SOF = 0\.49\d+ BR = 19200 break = 677079 52083 EOH = /
    )
    expect(framing).toMatch(/ RBR = 19200 RSO = 26042 HBR = 19200 HSO = 26042 CSM = enhanced$/)

    expect(formatLinError('parity of id is not valid', msg, 1, 0.5)).toContain('StateReason = 1c')
    expect(formatLinError('no answer', msg, 1, 0.5)).toContain('StateReason = 0c')
    expect(formatLinError('message error', undefined, 2, 0.5)).toMatch(
      /^0\.500000 L2 RcvError: message error StateReason = 6c /
    )
  })

  it('never writes a zero LIN hardware state', () => {
    const line = formatLinError('A timeout was reached', undefined, 1, 0)
    expect(line).toMatch(/StateReason = [0-9a-f][1-9a-f] /)
    expect(line).toContain('SOF = 0.000000')
  })

  it('writes sync failures as SyncError', () => {
    expect(formatLinError('sync error', undefined, 2, 0.5)).toMatch(
      /^0\.500000 L2 SyncError 0 0 0 0 SOF = 0\.49\d+ BR = 19200 break = 677079 52083$/
    )
    expect(formatLinError('Error on Synchronization field', undefined, 1, 0.5)).toContain(
      ' SyncError '
    )
  })

  it('writes LIN sleep and wake-up events (A7)', () => {
    expect(formatLinEvent('busSleep', 1, 0.7772)).toBe(
      '0.777200 Li SleepModeEvent 0 entering sleep mode due to sleep mode frame'
    )
    expect(formatLinEvent('busWakeUp', 1, 1)).toBe(
      '1.000000 Li SleepModeEvent 0 waking up due to internal wakeup frame'
    )
  })

  it('writes the file with CR+LF line endings (A8)', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecubus-asc-eol-'))
    const filePath = path.join(tempDir, 'eol.asc')
    global.deviceIndexMap = new Map([['dev', 1]])
    const transport = ascTransport(filePath, ['dev'], ['canBase'])
    const logger = winston.createLogger({ transports: [transport] })
    try {
      logger.debug({
        method: 'canBase',
        deviceId: 'dev',
        data: createCanMessage({ id: 0x123, ts: 1500 })
      })
      await vi.waitFor(async () => {
        expect(await fs.readFile(filePath, 'utf8')).toMatch(/123/)
      })
      transport.close()
      await vi.waitFor(async () => {
        expect(await fs.readFile(filePath, 'utf8')).toMatch(/End TriggerBlock/)
      })
      const content = await fs.readFile(filePath, 'utf8')
      expect(content.split('\r\n').slice(0, 5)).toEqual([
        expect.stringMatching(/^date \w{3} \w{3} \d+ \d\d:\d\d:\d\d\.\d{3} \d{4}$/),
        'base hex timestamps absolute',
        'internal events logged',
        expect.stringMatching(/^Begin Triggerblock /),
        expect.stringMatching(/^0\.001500 1\s+123\s+Rx\s+d 8 /)
      ])
      expect(content.replace(/\r\n/g, '')).not.toContain('\n')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})

describe('ASC write-read round trip', () => {
  it('keeps time, channel, ID, DLC, frame type and data', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecubus-asc-rt-'))
    const filePath = path.join(tempDir, 'rt.asc')
    const std = (over: Partial<CanMessage['msgType']>) => ({
      idType: CAN_ID_TYPE.STANDARD,
      canfd: false,
      brs: false,
      remote: false,
      ...over
    })
    const messages: [CanMessage, number][] = [
      [createCanMessage({ id: 0x100, data: Buffer.alloc(0), ts: 1 }), 1],
      [
        createCanMessage({
          id: 0x101,
          data: Buffer.alloc(0),
          dlc: 4,
          ts: 2,
          msgType: std({ remote: true })
        }),
        2
      ],
      [createCanMessage({ id: 0x102, data: Buffer.alloc(8, 0xaa), dlc: 15, ts: 3 }), 1],
      [
        createCanMessage({
          id: 0x18daf110,
          data: Buffer.alloc(64, 0x55),
          ts: 4,
          msgType: std({ idType: CAN_ID_TYPE.EXTENDED, canfd: true, brs: true, esi: true })
        }),
        3
      ],
      [
        createCanMessage({
          id: 0x103,
          data: Buffer.from([1, 2, 3]),
          ts: 5,
          msgType: std({ canfd: true })
        }),
        1
      ]
    ]
    try {
      const content = [
        formatAscHeader(new Date(2026, 9, 29, 8, 0, 0, 123)),
        ...messages.map(([msg, ch]) => formatCanMessage(msg, ch, msg.ts! / 1_000_000)),
        'End TriggerBlock',
        ''
      ].join('\r\n')
      await fs.writeFile(filePath, content, 'utf8')

      const reader = new AscReader(filePath, 0)
      reader.init()
      const frames = []
      let frame = await reader.readFrame()
      while (frame) {
        frames.push(frame)
        frame = await reader.readFrame()
      }
      expect(reader.measurementStartTimeMs).toBe(new Date(2026, 9, 29, 8, 0, 0, 123).getTime())
      reader.close()

      expect(frames).toHaveLength(messages.length)
      frames.forEach((f, i) => {
        const [msg, ch] = messages[i]
        expect(f.ts).toBe(msg.ts)
        expect(f.channel).toBe(ch)
        expect(f.id).toBe(msg.id)
        expect(f.msgType.idType).toBe(msg.msgType.idType)
        expect(f.msgType.remote).toBe(msg.msgType.remote)
        expect(f.msgType.canfd).toBe(msg.msgType.canfd)
        expect(f.msgType.brs).toBe(msg.msgType.brs)
        expect(!!f.msgType.esi).toBe(!!msg.msgType.esi)
        expect(f.dlc).toBe(msg.dlc ?? canLen2Dlc(msg.data.length))
        expect(f.data.toString('hex')).toBe(msg.data.toString('hex'))
      })
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})
