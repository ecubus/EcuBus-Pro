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
  // it('should parse comprehensive test events', () => {
  //   const blocks = os2block(comprehensiveTestEvents)
  //   expect(blocks).toBeDefined()
  //   // console.log(blocks)
  // })
})

it('parse ORTI file1', () => {
  const orti = parseORTI(fs.readFileSync(path.resolve(__dirname, './Os_Trace.orti'), 'utf-8'))
  expect(orti).toBeDefined()
  console.log(orti.errors[0])
  expect(orti.errors.length).toBe(0)
  // // console.log(orti.data)
  // fs.writeFileSync(path.resolve(__dirname, './Os_Trace.orti.json'), JSON.stringify(orti.data, null, 2))
})
it('parse ORTI file2', () => {
  const orti = parseORTI(fs.readFileSync(path.resolve(__dirname, './sample.orti'), 'utf-8'))
  expect(orti).toBeDefined()
  expect(orti.errors).toBeDefined()
  console.log(orti.errors[0])
  expect(orti.errors.length).toBe(0)
  // console.log(orti.data)
  fs.writeFileSync(
    path.resolve(__dirname, './sample.orti.json'),
    JSON.stringify(orti.data, null, 2)
  )
})

it('parse ORTI file3', () => {
  const orti = parseORTI(
    fs.readFileSync(path.resolve(__dirname, './Os_Trace_比赛demo.orti'), 'utf-8')
  )
  expect(orti).toBeDefined()
  expect(orti.errors).toBeDefined()
  console.log(orti.errors[0])
  expect(orti.errors.length).toBe(0)
  // console.log(orti.data)
  fs.writeFileSync(
    path.resolve(__dirname, './Os_Trace_比赛demo.orti.json'),
    JSON.stringify(orti.data, null, 2)
  )
})
