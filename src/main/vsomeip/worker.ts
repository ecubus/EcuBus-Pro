// main/worker.ts

import { SomeipMessage, SomeipMessageType } from '../share/someip'
import client from './client'

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
      instance?.app.request_service(
        Number(data.service),
        Number(data.instance),
        data.major ? Number(data.major) : 0,
        data.minor ? Number(data.minor) : 0
      )
      break
    }
    case 'sendRequest': {
      instance?.sendMessage(data.msg)
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
