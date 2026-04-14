import { UdsDevice } from 'nodeCan/uds'
import path, { resolve } from 'path'
import fs from 'fs'
import fsP from 'fs/promises'
import { spawn, exec, ChildProcess } from 'child_process'
import os from 'os'
import { fork } from 'child_process'

import type { VsomeipCallbackData } from './client'
import { SomeipLOG } from '../log'
import EventEmitter from 'events'
import { getTsUs } from '../share/can'
import {
  SomeipMessage,
  SomeipInfo,
  ServiceConfig,
  ServiceEvent,
  ServiceEventgroup,
  SomeipMessageType,
  VsomeipAvailabilityInfo
} from '../share/someip'

function mapEventForVsomeipJson(e: ServiceEvent): Record<string, unknown> {
  const isField = e.is_field === true || e.is_field === 'true'
  const isReliable = !(e.is_reliable === false || e.is_reliable === 'false')
  return {
    event: e.event,
    is_field: isField ? 'true' : 'false',
    is_reliable: isReliable ? 'true' : 'false'
  }
}

function mapEventgroupForVsomeipJson(g: ServiceEventgroup): Record<string, unknown> {
  const row: Record<string, unknown> = {
    eventgroup: g.eventgroup,
    events: g.events ?? []
  }
  if (g.multicast) row.multicast = g.multicast
  if (g.threshold !== undefined) row.threshold = g.threshold
  return row
}

/** Shape service entry for vSomeIP JSON (string booleans on events). */
function mapServiceForVsomeipJson(s: ServiceConfig): Record<string, unknown> {
  const o: Record<string, unknown> = {
    service: s.service,
    instance: s.instance
  }
  if (s.protocol) o.protocol = s.protocol
  if (s.unicast) o.unicast = s.unicast
  if (s.reliable) o.reliable = { ...s.reliable }
  if (s.unreliable !== undefined) o.unreliable = s.unreliable
  if (s.events?.length) o.events = s.events.map(mapEventForVsomeipJson)
  if (s.eventgroups?.length) o.eventgroups = s.eventgroups.map(mapEventgroupForVsomeipJson)
  if (s['debounce-times']) o['debounce-times'] = s['debounce-times']
  if (s['someip-tp']) o['someip-tp'] = s['someip-tp']
  return o
}

// Global routing manager process reference
let routingManagerProcess: ChildProcess | null = null
let routerLog: SomeipLOG | null = null

export function startRouterCounter(configFilePath: string, quiet: boolean = true): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    // Check if routing manager is already running
    if (routingManagerProcess) {
      resolvePromise()
      return
    }
    const lockFile = path.join(os.tmpdir(), 'vsomeip.lck')
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile)
    }

    // Validate config file path
    if (!configFilePath || !path.isAbsolute(configFilePath)) {
      reject(new Error('Config file path must be absolute'))
      return
    }

    // Spawn routing manager process
    routingManagerProcess = fork(resolve(__dirname, 'vsomeip.js'))
    routerLog = new SomeipLOG('Vsomeip', 'routingmanagerd', 'router', new EventEmitter())

    let resolved = false

    // Handle process events
    routingManagerProcess.on('message', (msg: any) => {
      if (msg.id === 0 && msg.data === 'initRouter') {
        resolved = true
        resolvePromise()
      }
      const event = msg.event
      if (event) {
        const ts = getTsUs() - global.startTs
        if (event.type === 'trace') {
          const data = JSON.parse(event.data)
          routerLog?.someipBase(Buffer.from(data.header), Buffer.from(data.data), ts)
        }
      }
    })

    routingManagerProcess.on('error', (error) => {
      sysLog.error(`start routing manager failed: ${error}`)
      routingManagerProcess = null
      if (routerLog) {
        routerLog.close()
        routerLog = null
      }
      if (!resolved) reject(error)
    })

    routingManagerProcess.on('exit', (code, signal) => {
      if (routingManagerProcess) {
        // Passive exit - process crashed or was killed externally
        sysLog.error(`routing manager exited unexpectedly with code: ${code}, signal: ${signal}`)
        routingManagerProcess = null
      }
      if (routerLog) {
        routerLog.close()
        routerLog = null
      }
      if (!resolved) reject(new Error(`Routing manager exited with code ${code}`))
    })

    routingManagerProcess.send({
      id: 0,
      method: 'initRouter',
      data: {
        configFilePath
      }
    })
  })
}

export function stopRouterCounter() {
  if (routingManagerProcess) {
    routingManagerProcess?.kill('SIGKILL')
    routingManagerProcess = null
  }
  if (routerLog) {
    routerLog.close()
    routerLog = null
  }
}

export function isRouterCounterRunning(): boolean {
  return routingManagerProcess !== null && !routingManagerProcess.killed
}

export async function generateConfigFile(
  config: SomeipInfo,
  projectPath: string,
  devices: Record<string, UdsDevice>
) {
  // Extract device information to get network settings
  let unicast: string | undefined

  let serviceUnicast: string | undefined

  const device = devices[config.device]
  if (device && device.type === 'eth' && device.ethDevice?.device?.detail) {
    const detail = device.ethDevice.device.detail
    if (detail.address) {
      unicast = detail.address
      serviceUnicast = detail.address
    }
  }

  // Build the vsomeip configuration object
  const vsomeipConfig: any = {}

  // Only add network settings if they exist
  if (unicast) {
    vsomeipConfig.unicast = unicast
  }

  // vsomeipConfig['local-clients-keepalive'] = {
  //   enable: 'true'
  // }

  const logPath = path.join(projectPath, '.ScriptBuild', config.name + '.log')
  vsomeipConfig.logging = {
    level: 'info',
    dlt: 'false',
    file: {
      enable: 'true',
      path: logPath
    }
  }
  vsomeipConfig['shutdown_timeout'] = 0

  vsomeipConfig.tracing = {
    enable: 'true',
    sd_enable: 'true'
  }

  // Add minimal required logging configuration
  // vsomeipConfig.logging = {
  //   level: 'info',
  //   console: 'true',
  //   file: {
  //     enable: 'true',
  //     path: '/var/log/vsomeip.log'
  //   },
  //   dlt: 'true'
  // }

  // Add applications
  vsomeipConfig.applications = [
    {
      name: config.name,
      id: config.application.id
    }
  ]

  vsomeipConfig.services = (config.services || []).map(mapServiceForVsomeipJson)

  // Add routing
  vsomeipConfig.routing = 'routingmanagerd'

  vsomeipConfig['service-discovery'] = config.serviceDiscovery

  // Write the configuration to file
  const filePath = path.join(projectPath, '.ScriptBuild', config.name + '.json')
  // Ensure directory exists
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    await fsP.mkdir(dir, { recursive: true })
  }

  const configJson = JSON.stringify(vsomeipConfig, null, 4)
  await fsP.writeFile(filePath, configJson, 'utf8')

  return filePath
}

export const VsomeipState: Record<number, { level: string; msg: string }> = {
  0: { level: 'info', msg: 'ST_REGISTERED' },
  1: { level: 'error', msg: 'ST_DEREGISTERED' },
  2: { level: 'warning', msg: 'ST_REGISTERING' },
  3: { level: 'warning', msg: 'ST_ASSIGNING' },
  4: { level: 'warning', msg: 'ST_ASSIGNED' }
}

export class VSomeIP_Client {
  private worker: ChildProcess
  private id = 0
  private state: number = Infinity
  private log: SomeipLOG

  private event = new EventEmitter()
  serviceValid: Map<string, boolean> = new Map()
  private requestServiceMap: Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason?: any) => void; timeout: NodeJS.Timeout }
  > = new Map()
  private promiseMap = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason?: any) => void }
  >()
  constructor(
    private name: string,
    private configFilePath: string,
    public info: SomeipInfo
  ) {
    this.worker = fork(resolve(__dirname, 'vsomeip.js'))
    this.log = new SomeipLOG(
      'Vsomeip',
      name,
      this.info.id,
      this.event,
      Number(this.info.application.id)
    )
    this.worker.on('message', (message: any) => {
      const id = message.id
      if (id !== undefined) {
        const resolve = this.promiseMap.get(id)?.resolve
        const reject = this.promiseMap.get(id)?.reject
        if (resolve) {
          resolve(message.data)
        }
      }
      const event = message.event
      if (event) {
        this.callback(event)
      }
    })
  }
  attachSomeipMessage(cb: (msg: SomeipMessage) => void) {
    this.event.on('someip-frame', cb)
  }
  detachSomeipMessage(cb: (msg: SomeipMessage) => void) {
    this.event.off('someip-frame', cb)
  }
  attachSomeipServiceValid(cb: (info: VsomeipAvailabilityInfo) => void) {
    this.event.on('someip-service-valid', cb)
  }
  detachSomeipServiceValid(cb: (info: VsomeipAvailabilityInfo) => void) {
    this.event.off('someip-service-valid', cb)
  }
  init() {
    return this.send('init', {
      name: this.name,
      configFilePath: this.configFilePath,
      info: this.info
    })
  }
  callback(callbackData: VsomeipCallbackData) {
    const ts = getTsUs() - global.startTs
    switch (callbackData.type) {
      case 'state': {
        if (this.state != callbackData.data) {
          this.state = callbackData.data
          const stateStr = VsomeipState[callbackData.data] || `Unknown state: ${callbackData.data}`
          sysLog.log(stateStr.level, `${this.name} - ${stateStr.msg}`)
          if (callbackData.data == 0) {
            this.offerService(this.info.services)
            void this.offerConfiguredEvents()
          }
        }
        break
      }
      case 'message':
        this.log.someipMessage(callbackData.data, false, ts)
        break
      case 'availability': {
        if (callbackData.data.instance != 0xffff && callbackData.data.service != 0xffff) {
          // 这里 callbackData.data 自动是 VsomeipAvailabilityInfo
          this.log.someipServiceValid(callbackData.data, ts)
          this.event.emit('someip-service-valid', callbackData.data)
          const key = this.getKey16(callbackData.data.service, callbackData.data.instance)
          const pending = this.requestServiceMap.get(key)
          if (pending) {
            clearTimeout(pending.timeout)
            if (callbackData.data.available) {
              pending.resolve(true)
            } else {
              pending.reject('Service is not available')
            }
            this.requestServiceMap.delete(key)
          }
          this.serviceValid.set(key, callbackData.data.available)
        }
        break
      }
      case 'subscription':
        // 这里 callbackData.data 自动是 VsomeipSubscriptionInfo
        this.event.emit('subscription', callbackData.data)
        break
      case 'subscription_status':
        // 这里 callbackData.data 自动是 VsomeipSubscriptionStatusInfo
        console.log('Subscription status:', callbackData.data)
        this.event.emit('subscription_status', callbackData.data)
        break
      case 'watchdog':
        // 这里 callbackData.data 自动是 undefined
        console.log('Watchdog triggered')
        this.event.emit('watchdog')
        break
      case 'trace': {
        const data = JSON.parse(callbackData.data)

        this.log.someipBase(Buffer.from(data.header), Buffer.from(data.data), ts)
        break
      }
      default:
        console.log('Unknown callback:', callbackData)
        break
    }
  }
  async sendRequest(msg: SomeipMessage) {
    await this.send('sendRequest', { msg })
    const ts = getTsUs() - global.startTs

    return ts
  }

  /**
   * Fire an offered event/field via vSomeIP `application::notify` (not raw NOTIFICATION send).
   */
  notifyEvent(
    service: number,
    instance: number,
    event: number,
    payload: Buffer | Uint8Array,
    force: boolean = false
  ) {
    const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
    return this.send('notifyEvent', {
      service,
      instance,
      event,
      payload: buf,
      force
    })
  }
  startPeriodicMessage(
    taskId: string,
    msg: SomeipMessage,
    periodMs: number,
    asNotify: boolean = false,
    force: boolean = false
  ) {
    const payload = Buffer.isBuffer(msg.payload) ? msg.payload : Buffer.from(msg.payload as any)
    return this.send('startPeriodicMessage', {
      taskId,
      msg: { ...msg, payload: payload },
      payload,
      periodMs: Number(periodMs),
      asNotify,
      force
    })
  }
  updatePeriodicMessage(
    taskId: string,
    msg: SomeipMessage,
    asNotify: boolean = false,
    force: boolean = false
  ) {
    const payload = Buffer.isBuffer(msg.payload) ? msg.payload : Buffer.from(msg.payload as any)
    return this.send('updatePeriodicMessage', {
      taskId,
      msg: { ...msg, payload: payload },
      payload,
      asNotify,
      force
    })
  }
  stopPeriodicMessage(taskId: string) {
    return this.send('stopPeriodicMessage', { taskId })
  }
  async sendRequestAndWaitResponse(msg: SomeipMessage, timeout: number) {
    return new Promise<SomeipMessage>((resolve, reject) => {
      const waitTimeout = Number(timeout)
      let expectClient: number | null = null
      let expectSession: number | null = null
      const responseTypes = [
        SomeipMessageType.RESPONSE,
        SomeipMessageType.ERROR,
        SomeipMessageType.RESPONSE_ACK,
        SomeipMessageType.ERROR_ACK
      ]
      const timer = setTimeout(() => {
        this.event.off('someip-frame', onSomeipFrame)
        reject(new Error('SomeIP request response timeout'))
      }, waitTimeout)
      const onSomeipFrame = (incoming: SomeipMessage) => {
        const raw = incoming as any
        const incomingService = Number(raw.service)
        const incomingInstance = Number(raw.instance)
        const incomingMethod = Number(raw.method)
        const incomingType = Number(raw.messageType)
        const incomingClient = Number(raw.client)
        const incomingSession = Number(raw.session)
        const sending = raw.sending === true

        const tripletMatch =
          incomingService === Number(msg.service) &&
          incomingInstance === Number(msg.instance) &&
          incomingMethod === Number(msg.method)

        // Capture Client ID + Session ID from our outbound REQUEST (stack-assigned)
        if (
          expectClient === null &&
          sending &&
          tripletMatch &&
          incomingType === SomeipMessageType.REQUEST
        ) {
          expectClient = incomingClient
          expectSession = incomingSession
          return
        }

        if (!sending && tripletMatch && responseTypes.includes(incomingType)) {
          if (expectClient !== null && expectSession !== null) {
            if (incomingClient === expectClient && incomingSession === expectSession) {
              clearTimeout(timer)
              this.event.off('someip-frame', onSomeipFrame)
              resolve(incoming)
            }
            return
          }
          // Fallback: no captured REQUEST seen (some stacks may not echo); match triplet only
          clearTimeout(timer)
          this.event.off('someip-frame', onSomeipFrame)
          resolve(incoming)
        }
      }
      this.event.on('someip-frame', onSomeipFrame)
      this.sendRequest(msg).catch((err) => {
        clearTimeout(timer)
        this.event.off('someip-frame', onSomeipFrame)
        reject(err)
      })
    })
  }
  private getKey16(service: number, instance: number) {
    return instance.toString(16).padStart(4, '0') + '.' + service.toString(16).padStart(4, '0')
  }
  async requestService(
    service: number,
    instance: number,
    major: number = 0,
    minor: number = 0,
    timeout: number = 1000
  ) {
    return new Promise((resolve, reject) => {
      if (this.state != 0) {
        reject('SomeIP is not registered')
      }
      const key = this.getKey16(service, instance)
      if (!this.serviceValid.get(key)) {
        this.requestServiceMap.set(key, {
          resolve,
          reject,
          timeout: setTimeout(() => {
            this.requestServiceMap.delete(key)
            reject('Request service timeout')
          }, timeout)
        })
        this.send('requestService', { service, instance, major, minor })
      } else {
        resolve(true)
      }
    })
  }
  async stop() {
    this.worker.kill()
  }
  private send(method: string, data: any) {
    return new Promise((resolve, reject) => {
      const id = this.id++
      this.promiseMap.set(id, { resolve, reject })
      if (this.worker.killed) {
        reject('vsomeip is not running')
      } else {
        this.worker.send({
          id,
          method: method,
          data: data
        })
      }
    })
  }
  offerService(services: ServiceConfig[]) {
    return this.send('offerServices', { services })
  }
  private async offerConfiguredEvents() {
    for (const serviceCfg of this.info.services || []) {
      const events = serviceCfg.events || []
      const eventgroups = serviceCfg.eventgroups || []
      if (events.length === 0 || eventgroups.length === 0) {
        continue
      }
      const service = Number(serviceCfg.service)
      const instance = Number(serviceCfg.instance)
      for (const eventCfg of events) {
        const event = Number(eventCfg.event)
        const matchedGroups = eventgroups
          .filter((g) => (g.events || []).some((e) => Number(e) === event))
          .map((g) => Number(g.eventgroup))
        if (matchedGroups.length === 0) {
          continue
        }
        const isField = eventCfg.is_field === true || eventCfg.is_field === 'true'
        const eventType = isField ? 2 : 0 // vsomeip event_type_e: ET_FIELD=2, ET_EVENT=0
        try {
          await this.offerEvent(service, instance, event, matchedGroups, eventType)
        } catch (e) {
          sysLog.error(
            `offerEvent failed for ${serviceCfg.service}.${serviceCfg.instance}.${eventCfg.event}: ${e}`
          )
        }
      }
    }
  }
  offerEvent(
    service: number,
    instance: number,
    event: number,
    eventgroup: number | number[],
    eventType: number = 0
  ) {
    const eventgroups = Array.isArray(eventgroup) ? eventgroup : [eventgroup]
    if (eventgroups.length === 0) {
      throw new Error('offerEvent requires at least one eventgroup')
    }
    return this.send('offerEvent', {
      service,
      instance,
      event,
      eventgroups,
      eventType
    })
  }
  stopOfferEvent(service: number, instance: number, event: number) {
    return this.send('stopOfferEvent', { service, instance, event })
  }
  releaseService(services: ServiceConfig[]) {
    return this.send('releaseServices', { services })
  }
  /**
   * Subscribe to an event (client): request_service → request_event (single group) → subscribe.
   * @param eventType vSomeIP event_type_e (default 2 = ET_FIELD, matches BMW sample)
   */
  async subscribeToEvent(
    service: number,
    instance: number,
    eventgroup: number,
    event: number,
    major: number = 0,
    timeout: number = 1000,
    eventType: number = 2
  ) {
    await this.requestService(service, instance, major, 0, timeout)
    await this.send('requestEvent', {
      service,
      instance,
      event,
      eventgroup,
      eventType
    })
    return this.send('subscribe', { service, instance, eventgroup, major, event })
  }
  /**
   * Unsubscribe from an event or event group, then release_event when event id is known.
   */
  async unsubscribeFromEvent(
    service: number,
    instance: number,
    eventgroup: number,
    event?: number,
    major: number = 0,
    timeout: number = 1000
  ) {
    await this.requestService(service, instance, major, 0, timeout)
    await this.send('unsubscribe', {
      service,
      instance,
      eventgroup,
      event: event !== undefined ? event : undefined
    })
    if (event !== undefined && Number.isFinite(event)) {
      await this.send('releaseEvent', { service, instance, event })
    }
  }
}
