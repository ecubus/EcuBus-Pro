import vsomeip from './build/Release/vsomeip.node'
import routingmanager from '../../../resources/lib/routingmanagerd.exe?asset&asarUnpack'
import { spawn, exec, ChildProcess } from 'child_process'
import path from 'path'
import { ServiceConfig } from '../share/someip/service-config'
import { EventEmitter } from 'events'
import os from 'os'
import fs from 'fs'
import fsP from 'fs/promises'
import { SomeipInfo } from '../share/someip'
import type { DataSet } from '../../preload/data'
import { UdsDevice } from 'nodeCan/uds'
import { SomeipLOG } from '../log'

// Import sysLog from global
declare const sysLog: any

// vSomeIP Callback Management System TypeScript Interface

export interface VsomeipMessage {
  service: number
  instance: number
  method: number
  client: number
  session: number
  payload?: Buffer
  _messageId?: number // Internal message ID for response handling
}

export interface VsomeipAvailabilityInfo {
  service: number
  instance: number
  available: boolean
}

export interface VsomeipSubscriptionInfo {
  client: number
  uid: number
  gid: number
  subscribed: boolean
}

export interface VsomeipSubscriptionStatusInfo {
  service: number
  instance: number
  eventgroup: number
  event: number
  status: number
}

export const VsomeipState: Record<number, { level: string; msg: string }> = {
  0: { level: 'info', msg: 'ST_REGISTERED' },
  1: { level: 'error', msg: 'ST_DEREGISTERED' },
  2: { level: 'warning', msg: 'ST_REGISTERING' },
  3: { level: 'warning', msg: 'ST_ASSIGNING' },
  4: { level: 'warning', msg: 'ST_ASSIGNED' }
}

// Unified callback data structure
export type VsomeipCallbackData =
  | { type: 'state'; data: number }
  | { type: 'message'; data: VsomeipMessage }
  | { type: 'availability'; data: VsomeipAvailabilityInfo }
  | { type: 'subscription'; data: VsomeipSubscriptionInfo }
  | { type: 'subscription_status'; data: VsomeipSubscriptionStatusInfo }
  | { type: 'watchdog'; data: undefined }
  | { type: 'trace'; data: string }

export type VsomeipCallback = (callbackData: VsomeipCallbackData) => void

// Event types for the EventEmitter - automatically derived from VsomeipCallbackData
export type VsomeipEventMap = {
  [K in VsomeipCallbackData['type']]: K extends 'watchdog'
    ? () => void
    : (data: Extract<VsomeipCallbackData, { type: K }>['data']) => void
}

// Global routing manager process reference
let routingManagerProcess: ChildProcess | null = null

//

export function loadDllPath(dllPath: string) {
  if (process.platform == 'win32') {
    vsomeip.LoadDll(dllPath)
  }
}

export function startRouterCounter(configFilePath: string, quiet: boolean = true): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if routing manager is already running
    if (routingManagerProcess) {
      resolve()
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
    routingManagerProcess = spawn(
      routingmanager,
      quiet ? ['-q', '-c', configFilePath] : ['-c', configFilePath],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      }
    )

    // Handle process events
    routingManagerProcess.on('error', (error) => {
      sysLog.error(`start routing manager failed: ${error}`)
      routingManagerProcess = null
      reject(error)
    })

    routingManagerProcess.on('exit', (code, signal) => {
      if (routingManagerProcess) {
        // Passive exit - process crashed or was killed externally
        sysLog.error(`routing manager exited unexpectedly with code: ${code}, signal: ${signal}`)
        routingManagerProcess = null
      }
    })

    // Wait a bit for the process to start
    setTimeout(() => {
      if (routingManagerProcess && !routingManagerProcess.killed) {
        resolve()
      } else {
        reject(new Error('Routing manager failed to start'))
      }
    }, 100)
  })
}

export function stopRouterCounter() {
  routingManagerProcess?.kill('SIGKILL')
  routingManagerProcess = null
}

export function isRouterCounterRunning(): boolean {
  return routingManagerProcess !== null && !routingManagerProcess.killed
}

export class VSomeIP_Client {
  private rtm: any
  app: any
  sendc: any
  log: SomeipLOG
  private state: number = 1
  private cb: any = null
  private cbId: string | undefined
  private event = new EventEmitter()
  static traceRegister: boolean = false
  serviceValid: Map<string, boolean> = new Map()
  private requestServiceMap: Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason?: any) => void; timeout: NodeJS.Timeout }
  > = new Map()
  constructor(
    public name: string,
    configFilePath: string,
    public info: SomeipInfo
  ) {
    this.rtm = vsomeip.runtime.get()
    this.app = this.rtm.create_application(name, configFilePath)
    this.cb = new vsomeip.VsomeipCallbackWrapper(this.rtm, this.app)
    this.sendc = new vsomeip.Send(this.rtm, this.app)
    this.cbId = vsomeip.RegisterCallback(name, name, this.callback.bind(this))
    this.log = new SomeipLOG('Vsomeip', name, this.info.id, this.event)
  }
  callback(callbackData: VsomeipCallbackData) {
    // console.log('vSomeIP callback:', callbackData)/

    switch (callbackData.type) {
      case 'state': {
        this.state = callbackData.data

        this.event.emit('state', callbackData.data)
        break
      }
      case 'message':
        // 这里 callbackData.data 自动是 VsomeipMessage
        console.log('Message received:', callbackData.data)
        this.event.emit('message', callbackData.data)
        break
      case 'availability': {
        // 这里 callbackData.data 自动是 VsomeipAvailabilityInfo
        console.log('Availability changed:', callbackData.data)
        this.event.emit('availability', callbackData.data)
        const key =
          callbackData.data.instance.toString(16) + '.' + callbackData.data.service.toString(16)
        const pending = this.requestServiceMap.get(key)
        if (pending) {
          clearTimeout(pending.timeout)
          if (callbackData.data.available) {
            pending.resolve(true)
          } else {
            pending.reject('Service is not available')
          }
        }
        this.serviceValid.set(key, callbackData.data.available)
        break
      }
      case 'subscription':
        // 这里 callbackData.data 自动是 VsomeipSubscriptionInfo
        console.log('Subscription changed:', callbackData.data)
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
        this.log.someipBase(Buffer.from(data.header), Buffer.from(data.data))
        break
      }
      default:
        console.log('Unknown callback:', callbackData)
        break
    }
  }
  sendRequest(service: number, instance: number, method: number, payload: Buffer) {
    this.sendc.sendMessage(service, instance, method, payload)
  }
  async requestService(service: number, instance: number, timeout: number = 1000) {
    return new Promise((resolve, reject) => {
      if (this.state != 0) {
        reject('SomeIP is not registered')
      }
      const key = instance.toString(16) + '.' + service.toString(16)
      if (!this.serviceValid.get(key)) {
        this.requestServiceMap.set(key, {
          resolve,
          reject,
          timeout: setTimeout(() => {
            this.requestServiceMap.delete(key)
            reject('Request service timeout')
          }, timeout)
        })
        this.app.request_service(service, instance)
      } else {
        resolve(true)
      }
    })
  }

  sendResponse(request: VsomeipMessage, payload: Buffer) {
    // Send a response based on the received request message using message ID
    if (request._messageId !== undefined) {
      this.sendc.sendResponse(request._messageId, payload)
    } else {
      console.warn('Cannot send response: message ID not available')
    }
  }
  init() {
    if (!VSomeIP_Client.traceRegister) {
      this.cb.registerTraceHandler(this.cbId)
      VSomeIP_Client.traceRegister = true
    }
    const result = this.app.init()
    if (!result) {
      throw new Error('Failed to initialize application')
    } else {
      this.cb.registerStateHandler(this.cbId)
      this.cb.registerMessageHandler(0xffff, 0xffff, 0xffff, this.cbId, this.sendc)
      this.cb.registerAvailabilityHandler(0xffff, 0xffff, this.cbId)
    }
  }
  start() {
    this.cb.start()
  }
  on<T extends keyof VsomeipEventMap>(event: T, listener: VsomeipEventMap[T]): this {
    this.event.on(event, listener)
    return this
  }
  once<T extends keyof VsomeipEventMap>(event: T, listener: VsomeipEventMap[T]): this {
    this.event.once(event, listener)
    return this
  }
  off<T extends keyof VsomeipEventMap>(event: T, listener: VsomeipEventMap[T]): this {
    this.event.off(event, listener)
    return this
  }
  removeAllListeners<T extends keyof VsomeipEventMap>(event?: T): this {
    this.event.removeAllListeners(event)
    return this
  }
  stop() {
    this.event.removeAllListeners()
    this.app.clear_all_handler()

    // First stop the callback wrapper to ensure proper thread cleanup
    if (this.cb) {
      this.cb.stop()
    }
    vsomeip.UnregisterCallback(this.cbId)
    this.app.stop()
  }
}

export async function generateConfigFile(
  config: SomeipInfo,
  projectPath: string,
  devices: Record<string, UdsDevice>
) {
  // Extract device information to get network settings
  let unicast: string | undefined
  let netmask: string | undefined
  let serviceUnicast: string | undefined

  const device = devices[config.device]
  if (device && device.type === 'eth' && device.ethDevice?.device?.detail) {
    const detail = device.ethDevice.device.detail
    if (detail.address) {
      unicast = detail.address
      serviceUnicast = detail.address
    }
    if (detail.netmask) {
      netmask = detail.netmask
    }
  }

  // Build the vsomeip configuration object
  const vsomeipConfig: any = {}

  // Only add network settings if they exist
  if (unicast) {
    vsomeipConfig.unicast = unicast
  }
  if (netmask) {
    vsomeipConfig.netmask = netmask
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

  vsomeipConfig.services = config.services

  // Add routing
  vsomeipConfig.routing = 'routingmanagerd'

  vsomeipConfig.serviceDiscovery = config.serviceDiscovery

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
