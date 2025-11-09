import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import path from 'path'
import fs from 'fs'
// import os2block from '../../src/main/ostrace/os2graph'
import { parseORTI } from '../../src/renderer/src/database/ortiParse'

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

it.skip('parse ORTI file4', () => {
  const orti = parseORTI(fs.readFileSync(path.resolve(__dirname, './RTAOS.rta'), 'utf-8'))
  expect(orti).toBeDefined()
  expect(orti.errors).toBeDefined()
  console.log(orti.errors[0])
  expect(orti.errors.length).toBe(0)
  // console.log(orti.data)
  fs.writeFileSync(path.resolve(__dirname, './RTAOS.rta.json'), JSON.stringify(orti.data, null, 2))
})
