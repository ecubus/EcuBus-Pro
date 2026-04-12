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
    case 'initRouter': {
      response.data = 'initRouter'
      instance = new client(
        'routingmanagerd',
        data.configFilePath,
        (val) => {
          process.send!({
            event: val
          })
        },
        { router: true }
      )
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
    case 'requestEvent': {
      instance?.sendc.requestEventOneGroup(
        Number(data.service),
        Number(data.instance),
        Number(data.event),
        Number(data.eventgroup),
        Number(data.eventType ?? 2)
      )
      break
    }
    case 'releaseEvent': {
      instance?.sendc.releaseEventSimple(
        Number(data.service),
        Number(data.instance),
        Number(data.event)
      )
      break
    }
    case 'subscribe': {
      instance?.app.subscribe(
        Number(data.service),
        Number(data.instance),
        Number(data.eventgroup),
        Number(data.major ?? 0),
        Number(data.event)
      )
      break
    }
    case 'unsubscribe': {
      const s = Number(data.service)
      const i = Number(data.instance)
      const eg = Number(data.eventgroup)
      if (data.event !== undefined && data.event !== null && data.event !== '') {
        instance?.app.unsubscribe(s, i, eg, Number(data.event))
      } else {
        instance?.app.unsubscribe(s, i, eg)
      }
      break
    }
  }

  process.send!(response)
})
