// main/worker.ts

import { SomeipMessageType } from '../share/someip'
import client, { SomeipMessage } from './client'

let instance: client | null = null
process.on('message', (message: any) => {
  const id = message.id
  const method = message.method
  const data = message.data
  const response: {
    id: number
    data: any
  } = {
    id,
    data: undefined
  }

  switch (method) {
    case 'init': {
      response.data = 'init'
      instance = new client(data.name, data.configFilePath, (val) => {
        process.send!({
          event: val
        })
      })
      instance.init()
      instance.start()

      break
    }
    case 'stop': {
      instance?.stop()
      instance = null
      break
    }
    case 'requestService': {
      instance?.app.request_service(Number(data.service), Number(data.instance))
      break
    }
    case 'sendRequest': {
      const msg: SomeipMessage = {
        service: Number(data.service),
        instance: Number(data.instance),
        method: Number(data.method),
        client: 0,
        session: 0,
        payload: Buffer.from(data.payload),
        messageType: SomeipMessageType.REQUEST,
        returnCode: 0,
        protocolVersion: 0,
        interfaceVersion: 0
      }
      instance?.sendMessage(msg)
      break
    }
    case 'offerServices': {
      for (const e of data.services) {
        instance?.app.offer_service(Number(e.service), Number(e.instance))
      }
      break
    }
    case 'stopOfferServices': {
      for (const e of data.services) {
        instance?.app.stop_offer_service(Number(e.service), Number(e.instance))
      }
      break
    }
    case 'releaseServices': {
      for (const e of data.services) {
        instance?.app.release_service(Number(e.service), Number(e.instance))
      }
      break
    }
  }
  process.send!(response)
})
