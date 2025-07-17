import vsomeip from './build/Release/vsomeip.node'
import routingmanager from '../../../resources/lib/routingmanagerd.exe?asset&asarUnpack'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

// vSomeIP Callback Management System TypeScript Interface

export interface VsomeipMessage {
  service: number
  instance: number
  method: number
  client: number
  session: number
  payload?: Buffer
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

// Global routing manager process reference
let routingManagerProcess: ChildProcess | null = null
let isStoppingRouter = false // Flag to distinguish active stopping from passive exit

//

export function loadDllPath(dllPath: string) {
  if (process.platform == 'win32') {
    vsomeip.LoadDll(dllPath)
  }
}

export function startRouterCounter(configFilePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
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
    routingManagerProcess = spawn(routingmanager, ['-q', '-c', configFilePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    })

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

    // Handle stdout
    routingManagerProcess.stdout?.on('data', (data) => {
      sysLog.info(`routing manager stdout: ${data.toString().trim()}`)
    })

    // Handle stderr
    routingManagerProcess.stderr?.on('data', (data) => {
      sysLog.error(`routing manager stderr: ${data.toString().trim()}`)
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
      resolve()
    })

    // Send SIGTERM for graceful shutdown
    routingManagerProcess.kill('SIGTERM')

    // Force kill after 1s if still running
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
  private app: any
  private cb: any = null
  private cbId: string | undefined
  constructor(name: string, configFilePath: string) {
    this.rtm = vsomeip.runtime.get()
    this.app = this.rtm.create_application(name, configFilePath)
    this.cb = new vsomeip.VsomeipCallbackWrapper(this.app)

    this.cbId = vsomeip.RegisterCallback('state', name, this.callback.bind(this))
  }
  callback(callbackData: VsomeipCallbackData) {
    console.log('vSomeIP callback:', callbackData)

    switch (callbackData.type) {
      case 'state':
        // 这里 callbackData.data 自动是 number
        console.log('State changed:', callbackData.data)
        break
      case 'message':
        // 这里 callbackData.data 自动是 VsomeipMessage
        console.log('Message received:', callbackData.data)
        break
      case 'availability':
        // 这里 callbackData.data 自动是 VsomeipAvailabilityInfo
        console.log('Availability changed:', callbackData.data)
        break
      case 'subscription':
        // 这里 callbackData.data 自动是 VsomeipSubscriptionInfo
        console.log('Subscription changed:', callbackData.data)
        break
      case 'subscription_status':
        // 这里 callbackData.data 自动是 VsomeipSubscriptionStatusInfo
        console.log('Subscription status:', callbackData.data)
        break
      case 'watchdog':
        // 这里 callbackData.data 自动是 undefined
        console.log('Watchdog triggered')
        break
    }
  }
  init() {
    const result = this.app.init()
    if (result) {
      this.cb.registerStateHandler(this.cbId)
      // this.app.register_state_handler(this.onStateChange)

      this.cb.start()
    } else {
      throw new Error('Failed to initialize application')
    }
  }
  stop() {
    this.app.clear_all_handler()

    // First stop the callback wrapper to ensure proper thread cleanup
    if (this.cb) {
      this.cb.stop()
    }
    vsomeip.UnregisterCallback(this.cbId)
  }
}
