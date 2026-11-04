import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AscReader, parseAscDate } from '../../src/main/replay/ascReader'
import type { ReplayCanFrame } from '../../src/main/replay/index'
import { CAN_ID_TYPE } from '../../src/main/share/can'

let tempDir = ''
let fileIndex = 0

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecubus-asc-reader-'))
})

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true })
})

async function readAsc(lines: string[], header = 'base hex timestamps absolute') {
  const filePath = path.join(tempDir, `log-${fileIndex++}.asc`)
  const content = [
    'date Wed Apr 16 09:21:13.159 am 2014',
    header,
    'internal events logged',
    '// version 12.0.0',
    'Begin Triggerblock Wed Apr 16 09:21:13.159 am 2014',
    ...lines,
    'End TriggerBlock',
    ''
  ].join('\r\n')
  await fs.writeFile(filePath, content, 'utf8')
  const reader = new AscReader(filePath, 0)
  reader.init()
  const frames: ReplayCanFrame[] = []
  let startMs = 0
  try {
    let frame = await reader.readFrame()
    while (frame) {
      frames.push(frame)
      frame = await reader.readFrame()
    }
    startMs = reader.measurementStartTimeMs
  } finally {
    reader.close()
  }
  return { frames, startMs }
}

describe('ASC reader classic CAN', () => {
  it('keeps trailing Length/BitCount/ID fields out of the data (R1)', async () => {
    const { frames } = await readAsc([
      '0.003040 1 123 Tx    d 2 00 00  Length = 768000 BitCount = 67 ID = 291',
      '4.876870 1 54C5638x  Tx d 8 00 00 00 00 00 00 00 00 Length = 1704000 BitCount = 145 ID = 88888888x'
    ])
    expect(frames).toHaveLength(2)
    expect(frames[0]).toMatchObject({ channel: 1, id: 0x123, dir: 'OUT', dlc: 2, ts: 3040 })
    expect(frames[0].data.toString('hex')).toBe('0000')
    expect(frames[1].id).toBe(0x54c5638)
    expect(frames[1].msgType.idType).toBe(CAN_ID_TYPE.EXTENDED)
    expect(frames[1].data.toString('hex')).toBe('0000000000000000')
  })

  it('reads remote frames with and without DLC (R4)', async () => {
    const { frames } = await readAsc([
      '2.5010 1 200 Tx r',
      '2.5011 1 201 Tx r Length = 1704000 BitCount = 145 ID = 513',
      '2.5012 1 202 Tx r 8 Length = 1704000 BitCount = 145 ID = 514'
    ])
    expect(frames.map((f) => [f.id, f.msgType.remote, f.dlc, f.data.length])).toEqual([
      [0x200, true, 0, 0],
      [0x201, true, 0, 0],
      [0x202, true, 8, 0]
    ])
  })

  it('keeps a classic DLC above 8 with 8 data bytes', async () => {
    const { frames } = await readAsc(['1.000000 1 100 Rx d f 01 02 03 04 05 06 07 08'])
    expect(frames[0].dlc).toBe(15)
    expect(frames[0].data.toString('hex')).toBe('0102030405060708')
  })

  it('reads classic error frames as error events (R6)', async () => {
    const { frames } = await readAsc([
      '1.592186 1 ErrorFrame ECC: 10100010',
      '1.592187 2 ErrorFrame Flags = 0xe CodeExt = 0x20a2 Code = 0x82 ID = 0 DLC = 0'
    ])
    expect(frames.map((f) => [f.channel, f.isError])).toEqual([
      [1, true],
      [2, true]
    ])
  })

  it('ignores status, statistic and comment lines', async () => {
    const { frames } = await readAsc([
      '0.0000 Start der Messung',
      '0.0006 CAN 1 Status:chip status error active',
      '1.0100 1 Statistic: D 0 R 0 XD 0 XR 0 E 0 O 0 B 0.0%',
      '2.0000 log trigger event',
      '1.593770 Comment: 105 testComment',
      '2.5009 1 64 Tx d 8 00 01 02 03 04 05 06 07'
    ])
    expect(frames).toHaveLength(1)
    expect(frames[0].id).toBe(0x64)
  })

  it('reports a data line with missing bytes as an error (R9)', async () => {
    await expect(readAsc(['1.000000 1 100 Rx d 8 01 02 03'])).rejects.toThrow(/Invalid ASC line/)
  })
})

describe('ASC reader CAN FD', () => {
  it('reads example lines with flags, ESI and DLC (R2, R7)', async () => {
    const { frames } = await readAsc([
      '0.151061 CANFD 1 Tx 2 0 0 2 2 02 03 150000 78 301040 10151 46500250 460a0250 20011736 20010205',
      '0.105537 CANFD 2 Rx 10001x 0 0 1 1 01 174015 91 301000 bfd9 46500250 460a0250 20011736 20010205',
      '0.200000 CANFD 1 Rx 123 1 1 9 12 01 02 03 04 05 06 07 08 09 0a 0b 0c 0 0 7000 0 0 0 0 0'
    ])
    expect(frames[0]).toMatchObject({ channel: 1, id: 2, dir: 'OUT', dlc: 2 })
    expect(frames[0].msgType).toMatchObject({ canfd: true, brs: false, esi: false, remote: false })
    expect(frames[0].data.toString('hex')).toBe('0203')
    expect(frames[1].msgType.idType).toBe(CAN_ID_TYPE.EXTENDED)
    expect(frames[1].data.toString('hex')).toBe('01')
    expect(frames[2].dlc).toBe(9)
    expect(frames[2].msgType).toMatchObject({ canfd: true, brs: true, esi: true })
    expect(frames[2].data.toString('hex')).toBe('0102030405060708090a0b0c')
  })

  it('reads classic CAN and remote frames on an FD channel from the flags', async () => {
    const { frames } = await readAsc([
      '0.105364 CANFD 1 Tx 1 0 0 1 1 01 112000 59 200040 39b5 46500250 460a0250 20011736 20010205',
      '0.300981 CANFD 1 Tx 50005x 0 0 5 0 140000 73 200050 7a60 46500250 460a0250 20011736 20010205'
    ])
    expect(frames[0].msgType).toMatchObject({ canfd: false, remote: false })
    expect(frames[0].data.toString('hex')).toBe('01')
    expect(frames[1].msgType).toMatchObject({ canfd: false, remote: true })
    expect(frames[1].dlc).toBe(5)
    expect(frames[1].data.length).toBe(0)
  })

  it('reads a line with a symbolic name', async () => {
    const { frames } = await readAsc([
      '0.151061 CANFD 1 Tx 2 EngineData 1 0 2 2 02 03 150000 78 303040 0 0 0 0 0'
    ])
    expect(frames[0].msgType.brs).toBe(true)
    expect(frames[0].data.toString('hex')).toBe('0203')
  })

  it('reads the legacy layout with the ID before the direction (R3)', async () => {
    const { frames } = await readAsc([
      '0.010460 CANFD 1 101 Tx 1 0 d 8 8 F1 F1 F1 F1 F1 F1 F1 F1 Length = 209000 BitCount = 128 ID = 257',
      '0.010235 CANFD 1 100 Tx 1 0 r 8 Length = 138000 BitCount = 256'
    ])
    expect(frames[0]).toMatchObject({ id: 0x101, dir: 'OUT', dlc: 8 })
    expect(frames[0].data.toString('hex')).toBe('f1f1f1f1f1f1f1f1')
    expect(frames[1].msgType.remote).toBe(true)
    expect(frames[1].data.length).toBe(0)
  })

  it('reads CAN FD error frames as error events (R6)', async () => {
    const { frames } = await readAsc([
      '0.051203 CANFD 1 Rx ErrorFrame Stuff Error fffe 82 20a2 Arb. 5 0 0 0 0 0 11984 10 0 46500250 460a0250 20011736 20010205'
    ])
    expect(frames).toHaveLength(1)
    expect(frames[0]).toMatchObject({ channel: 1, isError: true })
  })
})

describe('ASC reader header', () => {
  it('reads decimal values (R5)', async () => {
    const { frames } = await readAsc(
      ['1.000000 1 291 Rx d 2 255 16', '1.000001 1 1000x Rx d 1 7'],
      'base dec timestamps absolute'
    )
    expect(frames[0].id).toBe(291)
    expect(frames[0].data.toString('hex')).toBe('ff10')
    expect(frames[1]).toMatchObject({ id: 1000 })
    expect(frames[1].msgType.idType).toBe(CAN_ID_TYPE.EXTENDED)
  })

  it('accumulates relative timestamps across all events (R5)', async () => {
    const { frames } = await readAsc(
      [
        '0.500000 1 100 Rx d 1 01',
        '0.250000 CAN 1 Status:chip status error active',
        '0.125000 1 100 Rx d 1 02'
      ],
      'base hex timestamps relative'
    )
    expect(frames.map((f) => f.ts)).toEqual([500000, 875000])
  })

  it('parses am/pm and German header dates (R8)', () => {
    expect(parseAscDate('Wed Apr 16 09:21:13.159 pm 2014')).toBe(
      new Date(2014, 3, 16, 21, 21, 13, 159).getTime()
    )
    expect(parseAscDate('Mon Mar 7 12:21:51 am 2005')).toBe(
      new Date(2005, 2, 7, 0, 21, 51).getTime()
    )
    expect(parseAscDate('Die Dez 21 11:29:01 2004')).toBe(
      new Date(2004, 11, 21, 11, 29, 1).getTime()
    )
    expect(parseAscDate('Tue Aug 25 03:55:52.711 2026')).toBe(
      new Date(2026, 7, 25, 3, 55, 52, 711).getTime()
    )
  })

  it('takes the measurement start from the header', async () => {
    const { startMs } = await readAsc(['1.000000 1 100 Rx d 1 01'])
    expect(startMs).toBe(new Date(2014, 3, 16, 9, 21, 13, 159).getTime())
  })
})
