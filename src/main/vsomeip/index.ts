import vsomeip from './build/Release/vsomeip.node'
import routingmanager from '../../../resources/lib/routingmanagerd.exe?asset&asarUnpack'
import { spawn, exec, ChildProcess } from 'child_process'
import path from 'path'
import { ServiceConfig } from './share/service-config'
import { EventEmitter } from 'events'
import os from 'os'
import fs from 'fs'
import RpcServer from '../rpc'

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

// Unified callback data structure
export type VsomeipCallbackData =
  | { type: 'state'; data: number }
  | { type: 'message'; data: VsomeipMessage }
  | { type: 'availability'; data: VsomeipAvailabilityInfo }
  | { type: 'subscription'; data: VsomeipSubscriptionInfo }
  | { type: 'subscription_status'; data: VsomeipSubscriptionStatusInfo }
  | { type: 'watchdog'; data: undefined }

export type VsomeipCallback = (callbackData: VsomeipCallbackData) => void

// Event types for the EventEmitter - automatically derived from VsomeipCallbackData
export type VsomeipEventMap = {
  [K in VsomeipCallbackData['type']]: K extends 'watchdog'
    ? () => void
    : (data: Extract<VsomeipCallbackData, { type: K }>['data']) => void
}

// Global routing manager process reference
let routingManagerProcess: ChildProcess | null = null
let isStoppingRouter = false // Flag to distinguish active stopping from passive exit

//

export function loadDllPath(dllPath: string) {
  if (process.platform == 'win32') {
    vsomeip.LoadDll(dllPath)
  }
}

export function startRouterCounter(configFilePath: string, quiet: boolean = true): Promise<void> {
  return new Promise((resolve, reject) => {
    RpcServer.registerHandler('POST', '/someip', (req, res) => {
      console.log('someip rpc request', req)
      res.end()
    })
    // Check if routing manager is already running
    if (routingManagerProcess) {
      resolve()
      return
    }

    // Reset stopping flag
    isStoppingRouter = false

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
      if (!isStoppingRouter) {
        // Passive exit - process crashed or was killed externally
        sysLog.error(`routing manager exited unexpectedly with code: ${code}, signal: ${signal}`)
      }
      routingManagerProcess = null
      isStoppingRouter = false
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

export function stopRouterCounter(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!routingManagerProcess) {
      resolve()
      return
    }

    // Set stopping flag
    isStoppingRouter = true

    // Try graceful shutdown first
    routingManagerProcess.once('exit', (code, signal) => {
      routingManagerProcess = null
      isStoppingRouter = false
      //manull delete vsomeip.lck file in temp
      const lockFile = path.join(os.tmpdir(), 'vsomeip.lck')
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile)
      }
      resolve()
    })

    // Send SIGTERM for graceful shutdown
    routingManagerProcess.kill('SIGTERM')

    // Force kill after 3s if still running (increased timeout for Windows)
    setTimeout(() => {
      if (routingManagerProcess && !routingManagerProcess.killed) {
        routingManagerProcess.kill('SIGKILL')
      }
    }, 1000)
  })
}

export function isRouterCounterRunning(): boolean {
  return routingManagerProcess !== null && !routingManagerProcess.killed
}

export class VSomeIP_Client {
  private rtm: any
  app: any
  sendc: any
  private cb: any = null
  private cbId: string | undefined
  private event = new EventEmitter()
  constructor(name: string, configFilePath: string) {
    this.rtm = vsomeip.runtime.get()
    this.app = this.rtm.create_application(name, configFilePath)
    this.cb = new vsomeip.VsomeipCallbackWrapper(this.app)
    this.sendc = new vsomeip.Send(this.rtm, this.app)

    this.cbId = vsomeip.RegisterCallback('state', name, this.callback.bind(this))
  }
  callback(callbackData: VsomeipCallbackData) {
    // console.log('vSomeIP callback:', callbackData)/

    switch (callbackData.type) {
      case 'state':
        // 这里 callbackData.data 自动是 number
        console.log('State changed:', callbackData.data)
        this.event.emit('state', callbackData.data)
        break
      case 'message':
        // 这里 callbackData.data 自动是 VsomeipMessage
        console.log('Message received:', callbackData.data)
        this.event.emit('message', callbackData.data)
        break
      case 'availability':
        // 这里 callbackData.data 自动是 VsomeipAvailabilityInfo
        console.log('Availability changed:', callbackData.data)
        this.event.emit('availability', callbackData.data)
        break
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
    }
  }
  sendRequest(service: number, instance: number, method: number, payload: Buffer) {
    this.sendc.sendMessage(service, instance, method, payload)
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
  }
}
