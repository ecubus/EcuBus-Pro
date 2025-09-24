import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseExcelFromFile } from './../../src/renderer/src/views/ostrace/table2event'
import path from 'path'
import fs from 'fs'
import os2block from '../../src/renderer/src/views/ostrace/os2graph'
import { parseORTI } from '../../src/renderer/src/views/ostrace/ortiParse'
describe('parse', () => {
  it('should parse Excel file', async () => {
    const eventList = await parseExcelFromFile(path.resolve(__dirname, './demo.xlsx'))
    expect(eventList).toBeDefined()
    // console.log(eventList)
    const blocks = os2block(eventList)
    expect(blocks).toBeDefined()
    // console.log(blocks)
  })
})

it('parse ORTI file', () => {
  const orti = parseORTI(fs.readFileSync(path.resolve(__dirname, './Os_Trace.orti'), 'utf-8'))
  expect(orti).toBeDefined()
  console.log(orti.errors[0])
})
