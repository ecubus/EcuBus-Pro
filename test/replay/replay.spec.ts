import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ReplayCanFrame } from '../../src/main/replay/index'
import path from 'path'
import { AscReader } from 'src/main/replay/ascReader'

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

      const frames: ReplayCanFrame[] = []
      let frame: ReplayCanFrame | null

      // Read all frames
      while ((frame = await reader.readFrame()) !== null) {
        frames.push(frame)
      }

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
      let frame: ReplayCanFrame | null
      let count = 0

      while ((frame = await reader.readFrame()) !== null) {
        // Timestamps should be non-decreasing
        expect(frame.ts).toBeGreaterThanOrEqual(lastTs)
        lastTs = frame.ts
        count++
      }

      console.log(`Verified ${count} frames have increasing timestamps`)
      reader.close()
    })

    it('should report progress correctly', async () => {
      const reader = new AscReader(ascFilePath, 0)
      const { total } = await reader.init()

      let frame: ReplayCanFrame | null
      let lastProgress = 0

      while ((frame = await reader.readFrame()) !== null) {
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

      const frames: ReplayCanFrame[] = []
      let frame: ReplayCanFrame | null

      while ((frame = await reader.readFrame()) !== null) {
        frames.push(frame)
      }

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
})
