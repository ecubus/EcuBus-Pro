import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseExcelFromFile } from './../../src/renderer/src/views/ostrace/table2event'
import path from 'path'
import os2block from '../../src/renderer/src/views/ostrace/os2graph'
describe('parse', () => {
  it('should parse Excel file', async () => {
    const eventList = await parseExcelFromFile(path.resolve(__dirname, './demo.xlsx'))
    expect(eventList).toBeDefined()
    // console.log(eventList)
    const blocks = os2block(eventList)
    expect(blocks).toBeDefined()
    console.log(blocks)
  })
})
