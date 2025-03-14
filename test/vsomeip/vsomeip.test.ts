import { test, expect } from 'vitest'
import path from 'path'
import { VSomeIP_Client, loadDllPath } from './../../src/main/vsomeip/index'

const dllPath = path.join(__dirname, '../../resources/lib')
loadDllPath(dllPath)

test('client', () => {
  const client = new VSomeIP_Client()

  expect(client).toBeDefined()
})
