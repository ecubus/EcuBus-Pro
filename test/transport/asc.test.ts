import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { CAN_ID_TYPE, type CanMessage } from '../../src/main/share/can'
import { AscReader } from '../../src/main/replay/ascReader'
import {
  formatAscArbitrationId,
  formatCanMessage,
  isExtendedCanId
} from '../../src/main/transport/asc'

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
