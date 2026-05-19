import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ReplayCanFrame, ReplayFrame, ReplayLinFrame } from '../../src/main/replay/index'
import path from 'path'
import { AscReader } from 'src/main/replay/ascReader'
import { BlfReader } from 'src/main/replay/blfReader'

/** Helper: read all CAN frames from a reader */
async function readAllCanFrames(reader: {
  readFrame(): Promise<ReplayFrame | null>
}): Promise<ReplayCanFrame[]> {
  const frames: ReplayCanFrame[] = []
  let result: ReplayFrame | null
  while ((result = await reader.readFrame()) !== null) {
    if (result.type === 'can') {
      frames.push(result.frame)
    }
  }
  return frames
}

/** Helper: read all frames separated by type */
async function readAllFrames(reader: {
  readFrame(): Promise<ReplayFrame | null>
}): Promise<{ can: ReplayCanFrame[]; lin: ReplayLinFrame[] }> {
  const can: ReplayCanFrame[] = []
  const lin: ReplayLinFrame[] = []
  let result: ReplayFrame | null
  while ((result = await reader.readFrame()) !== null) {
    if (result.type === 'can') can.push(result.frame)
    else if (result.type === 'lin') lin.push(result.frame)
  }
  return { can, lin }
}

describe('Replay', () => {
  const blfFilePath = path.resolve(__dirname, './Logging.blf')

  describe('AscReader', () => {
    const ascFilePath = path.resolve(__dirname, './EngineDiagData.asc')

    it('should initialize and read total objects', async () => {
      const reader = new AscReader(ascFilePath, 0) // speedFactor 0 = as fast as possible
      const result = reader.init()

      expect(result.total).toBeGreaterThan(0)
      console.log(`Total objects in ASC file: ${result.total}`)

      reader.close()
    })

    it('should read CAN frames from ASC file', async () => {
      const reader = new AscReader(ascFilePath, 10) // 0 = as fast as possible (no time-based delay)
      reader.init()

      const frames = await readAllCanFrames(reader)

      expect(frames.length).toBeGreaterThan(0)
      console.log(`Read ${frames.length} CAN frames from ASC file`)

      // Verify frame structure
      const firstFrame = frames[0]
      expect(firstFrame).toHaveProperty('channel')
      expect(firstFrame).toHaveProperty('ts')
      expect(firstFrame).toHaveProperty('id')
      expect(firstFrame).toHaveProperty('dir')
      expect(firstFrame).toHaveProperty('msgType')
      expect(firstFrame).toHaveProperty('data')
      expect(firstFrame.data).toBeInstanceOf(Buffer)

      console.log('First frame:', {
        channel: firstFrame.channel,
        ts: firstFrame.ts,
        id: `0x${firstFrame.id.toString(16)}`,
        dir: firstFrame.dir,
        msgType: firstFrame.msgType,
        data: firstFrame.data.toString('hex')
      })

      reader.close()
    })

    it('should have increasing timestamps', async () => {
      const reader = new AscReader(ascFilePath, 0)
      await reader.init()

      let lastTs = -1
      let count = 0
      let result: ReplayFrame | null

      while ((result = await reader.readFrame()) !== null) {
        const ts = result.type === 'can' ? result.frame.ts : result.frame.ts
        expect(ts).toBeGreaterThanOrEqual(lastTs)
        lastTs = ts
        count++
      }

      console.log(`Verified ${count} frames have increasing timestamps`)
      reader.close()
    })

    it('should report progress correctly', async () => {
      const reader = new AscReader(ascFilePath, 0)
      const { total } = await reader.init()

      let result: ReplayFrame | null
      let lastProgress = 0

      while ((result = await reader.readFrame()) !== null) {
        const progress = reader.getProgress()
        expect(progress.current).toBeLessThanOrEqual(progress.total)
        expect(progress.percent).toBeGreaterThanOrEqual(lastProgress)
        lastProgress = progress.percent
      }

      const finalProgress = reader.getProgress()
      // ASC reader counts total lines including headers, so final progress may not be exactly 100%
      expect(finalProgress.percent).toBeGreaterThan(90)
      console.log(
        `Final progress: ${finalProgress.current}/${finalProgress.total} (${finalProgress.percent.toFixed(2)}%)`
      )

      reader.close()
    })

    it('should parse ASC format correctly', async () => {
      const reader = new AscReader(ascFilePath, 0)
      await reader.init()

      const frames = await readAllCanFrames(reader)

      // Total frames in ASC file: 37 (lines 4-40)
      expect(frames.length).toBe(36)

      // Count frames by ID
      const id200Frames = frames.filter((f) => f.id === 0x200)
      const id400Frames = frames.filter((f) => f.id === 0x400)
      expect(id200Frames.length).toBe(27)
      expect(id400Frames.length).toBe(9)

      // All frames should be on channel 2
      expect(frames.every((f) => f.channel === 2)).toBe(true)

      // All frames should have 8 bytes data
      expect(frames.every((f) => f.data.length === 8)).toBe(true)

      // All frames in ASC file are Tx direction
      expect(frames.every((f) => f.dir === 'OUT')).toBe(true)

      // Validate first frame: 0.789091 2 200 Tx d 8 02 10 81 00 00 00 00 00
      const firstFrame = frames[0]
      expect(firstFrame.ts).toBeCloseTo(0.789091 * 1000000, -2) // ts in microseconds
      expect(firstFrame.id).toBe(0x200)
      expect(firstFrame.data.toString('hex')).toBe('0210810000000000')

      // Validate second frame: 0.790603 2 400 Tx d 8 02 50 81 00 00 00 00 00
      const secondFrame = frames[1]
      expect(secondFrame.ts).toBeCloseTo(0.790603 * 1000000, -2)
      expect(secondFrame.id).toBe(0x400)
      expect(secondFrame.data.toString('hex')).toBe('0250810000000000')

      // Validate last frame: 20.790127 2 200 Tx d 8 02 3E 01 00 00 00 00 00
      const lastFrame = frames[frames.length - 1]
      expect(lastFrame.ts).toBeCloseTo(20.790127 * 1000000, -2)
      expect(lastFrame.id).toBe(0x200)
      expect(lastFrame.data.toString('hex')).toBe('023e010000000000')

      // Validate TesterPresent frames (02 3E 01 pattern) - should be many
      const testerPresentFrames = frames.filter(
        (f) => f.data.toString('hex') === '023e010000000000'
      )
      expect(testerPresentFrames.length).toBe(18)

      // Timestamps should be within expected range (0.789091s to 17.790127s in microseconds)
      expect(frames[0].ts).toBeGreaterThanOrEqual(789091)
      expect(frames[frames.length - 1].ts).toBeLessThanOrEqual(20790127 + 1000)

      console.log(`Total frames: ${frames.length}`)
      console.log(`ID 0x200 frames: ${id200Frames.length}, ID 0x400 frames: ${id400Frames.length}`)
      console.log(`TesterPresent frames: ${testerPresentFrames.length}`)

      reader.close()
    })
  })

  describe('BlfReader', () => {
    it('should initialize and read total objects', async () => {
      const reader = new BlfReader(blfFilePath, 0)
      const result = reader.init()

      expect(result.total).toBeGreaterThan(0)
      console.log(`Total objects in BLF file: ${result.total}`)

      reader.close()
    })

    it('should read CAN frames from BLF file', async () => {
      const reader = new BlfReader(blfFilePath, 0)
      reader.init()

      const frames = await readAllCanFrames(reader)

      expect(frames.length).toBeGreaterThan(0)
      console.log(`Read ${frames.length} CAN frames from BLF file`)

      // Verify frame structure
      const firstFrame = frames[0]
      expect(firstFrame).toHaveProperty('channel')
      expect(firstFrame).toHaveProperty('ts')
      expect(firstFrame).toHaveProperty('id')
      expect(firstFrame).toHaveProperty('dir')
      expect(firstFrame).toHaveProperty('msgType')
      expect(firstFrame).toHaveProperty('data')
      expect(firstFrame.data).toBeInstanceOf(Buffer)

      console.log('First frame:', {
        channel: firstFrame.channel,
        ts: firstFrame.ts,
        id: `0x${firstFrame.id.toString(16)}`,
        dir: firstFrame.dir,
        msgType: firstFrame.msgType,
        data: firstFrame.data.toString('hex')
      })

      reader.close()
    })

    it('should have increasing timestamps', async () => {
      const reader = new BlfReader(blfFilePath, 0)
      await reader.init()

      let lastTs = -1
      let result: ReplayFrame | null
      let count = 0

      while ((result = await reader.readFrame()) !== null) {
        const ts = result.type === 'can' ? result.frame.ts : result.frame.ts
        expect(ts).toBeGreaterThanOrEqual(lastTs)
        lastTs = ts
        count++
      }

      expect(count).toBeGreaterThan(0)
      console.log(`Verified ${count} frames have increasing timestamps`)
      reader.close()
    })

    it('should report progress correctly', async () => {
      const reader = new BlfReader(blfFilePath, 0)
      await reader.init()

      let result: ReplayFrame | null

      while ((result = await reader.readFrame()) !== null) {
        const progress = reader.getProgress()
        expect(progress.current).toBeLessThanOrEqual(progress.total)
      }

      const finalProgress = reader.getProgress()
      expect(finalProgress.percent).toBeGreaterThan(90)
      console.log(
        `Final progress: ${finalProgress.current}/${finalProgress.total} (${finalProgress.percent.toFixed(2)}%)`
      )

      reader.close()
    })
  })

  describe('BlfReader - LIN frames', () => {
    const linBlfPath = path.resolve(__dirname, './LINSystem_1.blf')

    it('should read LIN frames from BLF file', async () => {
      const reader = new BlfReader(linBlfPath, 0)
      reader.init()

      const { can, lin } = await readAllFrames(reader)

      expect(lin.length).toBeGreaterThan(0)
      console.log(`Read ${lin.length} LIN frames, ${can.length} CAN frames from LIN BLF file`)

      reader.close()
    })

    it('should parse LIN frame structure correctly', async () => {
      const reader = new BlfReader(linBlfPath, 0)
      reader.init()

      const { lin } = await readAllFrames(reader)
      expect(lin.length).toBeGreaterThan(0)

      const firstFrame = lin[0]
      expect(firstFrame).toHaveProperty('channel')
      expect(firstFrame).toHaveProperty('ts')
      expect(firstFrame).toHaveProperty('frameId')
      expect(firstFrame).toHaveProperty('dir')
      expect(firstFrame).toHaveProperty('data')
      expect(firstFrame).toHaveProperty('dlc')
      expect(firstFrame).toHaveProperty('checksumType')
      expect(firstFrame.data).toBeInstanceOf(Buffer)

      // LIN Frame ID should be 0-63
      expect(firstFrame.frameId).toBeGreaterThanOrEqual(0)
      expect(firstFrame.frameId).toBeLessThanOrEqual(63)

      // LIN channels use offset 100+
      expect(firstFrame.channel).toBeGreaterThanOrEqual(101)

      // Direction should be Tx or Rx
      expect(['Tx', 'Rx']).toContain(firstFrame.dir)

      console.log('First LIN frame:', {
        channel: firstFrame.channel,
        ts: firstFrame.ts,
        frameId: `0x${firstFrame.frameId.toString(16)}`,
        dir: firstFrame.dir,
        dlc: firstFrame.dlc,
        data: firstFrame.data.toString('hex'),
        checksumType: firstFrame.checksumType
      })

      reader.close()
    })

    it('should have increasing timestamps for LIN frames', async () => {
      const reader = new BlfReader(linBlfPath, 0)
      reader.init()

      const { lin } = await readAllFrames(reader)

      let lastTs = -1
      for (const frame of lin) {
        expect(frame.ts).toBeGreaterThanOrEqual(lastTs)
        lastTs = frame.ts
      }

      console.log(`Verified ${lin.length} LIN frames have increasing timestamps`)
      reader.close()
    })

    it('should parse all LIN frame IDs within valid range', async () => {
      const reader = new BlfReader(linBlfPath, 0)
      reader.init()

      const { lin } = await readAllFrames(reader)

      const idSet = new Set(lin.map((f) => f.frameId))
      for (const id of idSet) {
        expect(id).toBeGreaterThanOrEqual(0)
        expect(id).toBeLessThanOrEqual(63)
      }

      console.log(
        `Unique LIN Frame IDs: ${[...idSet].map((id) => `0x${id.toString(16)}`).join(', ')}`
      )
      reader.close()
    })
  })

  describe('AscReader - LIN frames', () => {
    const linAscPath = path.resolve(__dirname, './LinTest.asc')

    it('should parse LIN frames from ASC file', async () => {
      const reader = new AscReader(linAscPath, 0)
      reader.init()

      const canFrames: ReplayCanFrame[] = []
      const linFrames: import('../../src/main/replay/index').ReplayLinFrame[] = []
      let result: ReplayFrame | null

      while ((result = await reader.readFrame()) !== null) {
        if (result.type === 'can') canFrames.push(result.frame)
        else if (result.type === 'lin') linFrames.push(result.frame)
      }

      // Should have 1 CAN frame and 5 LIN frames (4 normal + 1 error)
      expect(canFrames.length).toBe(1)
      expect(linFrames.length).toBe(5)

      // First LIN frame: 0.001234 Li 3c Tx 8 ...
      const f0 = linFrames[0]
      expect(f0.frameId).toBe(0x3c)
      expect(f0.dir).toBe('Tx')
      expect(f0.dlc).toBe(8)
      expect(f0.data.toString('hex')).toBe('0102030405060708')
      expect(f0.checksum).toBe(0xab)
      expect(f0.checksumType).toBe('ENHANCED')
      expect(f0.channel).toBe(101) // Li -> 101

      // Second LIN frame: standard checksum
      const f1 = linFrames[1]
      expect(f1.frameId).toBe(0x3d)
      expect(f1.dir).toBe('Rx')
      expect(f1.checksumType).toBe('CLASSIC')
      expect(f1.checksum).toBe(0x12)

      // Third: 4-byte frame
      const f2 = linFrames[2]
      expect(f2.frameId).toBe(0x10)
      expect(f2.dlc).toBe(4)
      expect(f2.data.toString('hex')).toBe('deadbeef')

      // Fourth: error frame (0.005s)
      const f3 = linFrames[3]
      expect(f3.isError).toBe(true)
      expect(f3.errorType).toBe('CSErr')
      expect(f3.frameId).toBe(0x3c)

      // Fifth: L2 channel frame (0.006s)
      const f4 = linFrames[4]
      expect(f4.channel).toBe(102)
      expect(f4.frameId).toBe(0x20)

      // CAN frame should still be parsed
      expect(canFrames[0].id).toBe(0x200)

      reader.close()
    })

    it('should parse LIN channel L2 correctly', async () => {
      const reader = new AscReader(linAscPath, 0)
      reader.init()

      const linFrames: import('../../src/main/replay/index').ReplayLinFrame[] = []
      let result: ReplayFrame | null
      while ((result = await reader.readFrame()) !== null) {
        if (result.type === 'lin') linFrames.push(result.frame)
      }

      // Last LIN frame uses L2 channel
      const lastLin = linFrames[linFrames.length - 1]
      expect(lastLin.channel).toBe(102) // L2 -> 102
      expect(lastLin.frameId).toBe(0x20)

      reader.close()
    })
  })
})
