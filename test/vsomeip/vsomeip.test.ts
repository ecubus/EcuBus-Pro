import { test, expect, beforeAll, afterAll, describe } from 'vitest'
import path from 'path'
import {
  VSomeIP_Client,
  loadDllPath,
  startRouterCounter,
  stopRouterCounter
} from './../../src/main/vsomeip/index'

const dllPath = path.join(__dirname, '../../resources/lib')
loadDllPath(dllPath)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('hello world', async () => {
  let client: VSomeIP_Client
  let server: VSomeIP_Client
  beforeAll(() => {
    startRouterCounter(path.join(__dirname, 'helloworld-local.json'))
    client = new VSomeIP_Client('hello_world_client', path.join(__dirname, 'helloworld-local.json'))
    server = new VSomeIP_Client(
      'hello_world_service',
      path.join(__dirname, 'helloworld-local.json')
    )
    client.init()
    server.init()
    client.on('state', (data) => {
      console.log('client state', data)
      client.app.request_service(0x1111, 0x2222)
    })
    client.on('availability', (data) => {
      console.log('client availability', data)
    })

    client.start()
    server.start()
  })
  test('hello world', async () => {
    await delay(2000)
    client.stop()
    server.stop()
  })
  afterAll(() => {
    stopRouterCounter()
  })
})
