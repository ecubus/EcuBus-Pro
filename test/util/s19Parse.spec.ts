import { describe, it, expect } from 'vitest'
import { S19MemoryMap } from '../../src/main/worker/utli'
import path from 'path'
import fs from 'fs'

describe('S19MemoryMap', () => {
  describe('fromS19', () => {
    it('hello.s19 checksum error', () => {
      const hexString = fs.readFileSync(path.resolve(__dirname, './hello.s19'), 'utf-8')
      try {
        const memMap = S19MemoryMap.fromS19(hexString)
        expect(true).eq(false)
      } catch {
        expect(true).eq(true)
      }
    })
    it('lab9.s19 checksum error', () => {
      const hexString = fs.readFileSync(path.resolve(__dirname, './lab9.s19'), 'utf-8')
      try {
        const memMap = S19MemoryMap.fromS19(hexString)
        expect(true).eq(false)
      } catch {
        expect(true).eq(true)
      }
    })
    it('lab10.s19 checksum error', () => {
      const hexString = fs.readFileSync(path.resolve(__dirname, './lab10.s19'), 'utf-8')
      try {
        const memMap = S19MemoryMap.fromS19(hexString)
        expect(true).eq(false)
      } catch {
        expect(true).eq(true)
      }
    })
    it('lab11.s19 multi section', () => {
      const hexString = fs.readFileSync(path.resolve(__dirname, './lab11.s19'), 'utf-8')

      const memMap = S19MemoryMap.fromS19(hexString)
      expect(memMap.get(0xc000)).toBeDefined()
      expect(memMap.get(0xd000)).toBeDefined()
      expect(memMap.get(0xc000)?.length).eq(23)
      expect(memMap.get(0xd000)?.length).eq(42)
    })
    it('lab12.s19', () => {
      const hexString = fs.readFileSync(path.resolve(__dirname, './lab12.s19'), 'utf-8')

      const memMap = S19MemoryMap.fromS19(hexString)
      expect(memMap.get(0x8000)).toBeDefined()
    })
    it('ok1', () => {
      const hexString = fs.readFileSync(path.resolve(__dirname, './CMSIS-DAP_OpenSDA.s19'), 'utf-8')
      const memMap = S19MemoryMap.fromS19(hexString)
      expect(memMap.get(0x8000)).toBeDefined()
    })
  })
})
