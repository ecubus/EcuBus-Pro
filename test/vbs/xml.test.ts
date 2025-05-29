import { parseXml, parseIdl } from '../../src/renderer/src/database/vbsParse'
import { test, expect } from 'vitest'
import path from 'path'

test('parse xml', async () => {
  const xml = await parseXml(path.join(__dirname, 'test.xml'))

  expect(xml).toBeDefined()
})
test('parse xml', async () => {
  const xml = await parseXml(path.join(__dirname, 'dds_cfg.xml'))

  expect(xml).toBeDefined()
  expect(Array.isArray(xml.idl)).toBe(true)
  console.log(xml.idl)
  expect(xml.idl.length).toBe(2)
})
