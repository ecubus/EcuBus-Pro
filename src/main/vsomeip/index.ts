import type { SomeipInfo, ServiceConfig } from 'nodeCan/someip'
import { UdsDevice } from 'nodeCan/uds'
import path, { resolve } from 'path'
import fs from 'fs'
import fsP from 'fs/promises'
import { spawn, exec, ChildProcess } from 'child_process'
import routingmanager from '../../../resources/lib/routingmanagerd.exe?asset&asarUnpack'
import os from 'os'
import { fork } from 'child_process'

import type { VsomeipCallbackData } from './client'
import { SomeipLOG } from '../log'
import EventEmitter from 'events'
import { getTsUs } from '../share/can'

// Global routing manager process reference
let routingManagerProcess: ChildProcess | null = null
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
  if (routingManagerProcess) {
    routingManagerProcess?.kill('SIGKILL')
    routingManagerProcess = null
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

  vsomeipConfig.services = config.services

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
    private info: SomeipInfo
  ) {
    this.worker = fork(resolve(__dirname, 'vsomeip.js'))
    this.log = new SomeipLOG('Vsomeip', name, this.info.id, this.event)
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
          }
        }
        break
      }
      case 'message':
        console.log('Message received:', callbackData.data, ts)
        this.log.someipMessage(callbackData.data, ts)
        break
      case 'availability': {
        // 这里 callbackData.data 自动是 VsomeipAvailabilityInfo
        console.log('Availability changed:', callbackData.data)
        this.event.emit('availability', callbackData.data)
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
        console.log('trace:', data, ts)

        this.log.someipBase(Buffer.from(data.header), Buffer.from(data.data), ts)
        break
      }
      default:
        console.log('Unknown callback:', callbackData)
        break
    }
  }
  sendRequest(service: number, instance: number, method: number, payload: Buffer) {
    return this.send('sendRequest', { service, instance, method, payload })
  }
  private getKey16(service: number, instance: number) {
    return instance.toString(16).padStart(4, '0') + '.' + service.toString(16).padStart(4, '0')
  }
  async requestService(service: number, instance: number, timeout: number = 1000) {
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
        this.send('requestService', { service, instance })
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
          method: method,
          data: data
        })
      }
    })
  }
  offerService(services: ServiceConfig[]) {
    return this.send('offerServices', { services })
  }
  releaseService(services: ServiceConfig[]) {
    return this.send('releaseServices', { services })
  }
}
