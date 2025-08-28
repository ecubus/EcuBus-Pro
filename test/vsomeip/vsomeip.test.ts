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
  beforeAll(async () => {
    await startRouterCounter(path.join(__dirname, 'helloworld-local.json'))
    await delay(1000)
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
      if (data.instance != 0xffff && data.service != 0xffff) {
        console.log('client availability', data)
        if (data.available) {
          client.sendRequest(0x1111, 0x2222, 0x1111, Buffer.from('hello'))
        }
      }
    })
    client.on('message', (data) => {
      console.log('client message', data)
      console.log(data.payload?.toString())
    })

    server.on('state', (data) => {
      console.log('server state', data)
      if (data == 0) {
        console.log('offer service')
        server.app.offer_service(0x1111, 0x2222)
      }
    })
    server.on('message', (data) => {
      console.log('server message', data)
      server.sendResponse(data, Buffer.from('world'))
    })

    client.start()
    server.start()
  })
  test('hello world', async () => {
    await delay(3000)
  })
  afterAll(() => {
    stopRouterCounter()
    client.stop()
    server.stop()
  })
})
