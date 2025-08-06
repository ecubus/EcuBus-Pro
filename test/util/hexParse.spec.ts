import { describe, it, expect } from 'vitest'
import { HexMemoryMap } from '../../src/main/worker/utli'
import path from 'path'
import fs from 'fs'

describe('HexMemoryMap', () => {
  describe('fromHex', () => {
    it('should parse a simple hex file correctly', () => {
      const hexString = ':100000000102030405060708090A0B0C0D0E0F1068\n' + ':00000001FF'

      const memMap = HexMemoryMap.fromHex(hexString)

      // 检查解析后的数据块
      const data = memMap.get(0)
      expect(data).toBeDefined()
      expect(data instanceof Uint8Array).toBe(true)
      expect(data!.length).toBe(16)
      expect([...data!]).toEqual([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10
      ])
    })
    it('parse a hex file with multiple blocks correctly', () => {
      const hexString = fs.readFileSync(path.resolve(__dirname, './Hello_World.hex'), 'utf-8')
      const memMap = HexMemoryMap.fromHex(hexString)
      expect(memMap.get(33554432)).toBeDefined()
      expect(memMap.get(33556480)).toBeDefined()
      expect(memMap.get(33557504)).toBeDefined()
    })
    it('high address', () => {
      const hexString = fs.readFileSync(path.resolve(__dirname, './high.hex'), 'utf-8')
      const memMap = HexMemoryMap.fromHex(hexString)
    })
  })
})

