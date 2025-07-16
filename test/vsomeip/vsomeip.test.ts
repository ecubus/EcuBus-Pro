import { test, expect } from 'vitest'
import path from 'path'
import { VSomeIP_Client, loadDllPath } from './../../src/main/vsomeip/index'

const dllPath = path.join(__dirname, '../../resources/lib')
loadDllPath(dllPath)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
test('hello world', async () => {
  const client = new VSomeIP_Client(
    'hello_world_client',
    path.join(__dirname, 'helloworld-local.json')
  )
  const server = new VSomeIP_Client(
    'hello_world_service',
    path.join(__dirname, 'helloworld-local.json')
  )
  expect(client).toBeDefined()

  server.init()
  client.init()

  await delay(2000)
  console.log('stoping')
  client.stop()
  server.stop()
  console.log('stoped')
  await delay(2000)
})
