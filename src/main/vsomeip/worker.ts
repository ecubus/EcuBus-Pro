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
    case 'notifyEvent': {
      const pl = data.payload
      const buf = Buffer.isBuffer(pl) ? pl : Buffer.from((pl as any)?.data ?? pl ?? [])
      // SWIG: 4 args (…, buf) or 5 args (…, buf, force); char*+length come from one Buffer via vsomeip.i typemap
      instance?.sendc.notify_event(
        Number(data.service),
        Number(data.instance),
        Number(data.event),
        buf,
        Boolean(data.force)
      )
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
      // SWIG N-API exposes C++ method names (snake_case), not camelCase
      instance?.sendc.request_event_one_group(
        Number(data.service),
        Number(data.instance),
        Number(data.event),
        Number(data.eventgroup),
        Number(data.eventType ?? 2)
      )
      break
    }
    case 'releaseEvent': {
      instance?.sendc.release_event_simple(
        Number(data.service),
        Number(data.instance),
        Number(data.event)
      )
      break
    }
    case 'offerEvent': {
      const eventgroups = Array.isArray(data.eventgroups)
        ? data.eventgroups.map((v: unknown) => Number(v))
        : data.eventgroup !== undefined && data.eventgroup !== null
          ? [Number(data.eventgroup)]
          : []
      if (eventgroups.length === 0) {
        throw new Error('offerEvent requires eventgroup or eventgroups')
      }
      // SWIG expects std::set<eventgroup_t>*; use Send helper (same pattern as request_event_one_group)
      instance?.sendc.offer_event_with_groups(
        Number(data.service),
        Number(data.instance),
        Number(data.event),
        eventgroups.join(','),
        Number(data.eventType ?? 0)
      )
      break
    }
    case 'stopOfferEvent': {
      instance?.app.stop_offer_event(
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
