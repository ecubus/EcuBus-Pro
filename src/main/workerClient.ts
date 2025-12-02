import { assign, cloneDeep } from 'lodash'
import { ServiceItem } from './share/uds'
import { Worker } from 'worker_threads'
import { UdsLOG } from './log'
import { TesterInfo } from './share/tester'
import { CanMessage, formatError } from './share/can'
import { VinInfo } from './share/doip'
import { LinMsg } from './share/lin'
import reportPath from '../../resources/lib/js/report.js?asset&asarUnpack'
import { pathToFileURL } from 'node:url'
import { TestEvent } from 'node:test/reporters'
import { UdsAddress } from './share/uds'
import { SomeipMessage } from 'nodeCan/someip'
import { error } from 'electron-log'
import fs from 'fs'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

type HandlerMap = {
  output: (data: any) => Promise<number>
  sendDiag: (data: {
    device?: string
    address?: string
    service: ServiceItem
    isReq: boolean
    testerName: string
  }) => Promise<number>
  setSignal: (data: { signal: string; value: number | number[] }) => void
  varApi: (
    data:
      | { method: 'setVar'; name: string; value: number | number[] | string }
      | { method: 'setVars'; vars: Array<{ name: string; value: number | number[] | string }> }
  ) => void
  runUdsSeq: (data: { name: string; device?: string }) => void
  stopUdsSeq: (data: { name: string; device?: string }) => void
  linApi: (data: linApiStartSch | linApiStopSch) => void
  pwmApi: (data: pwmApiSetDuty) => void
  canApi: (data: any) => void
  pluginEvent: (data: { name: string; data: any }) => void
}
export type pwmApiSetDuty = {
  method: 'setDuty'
  device?: string
  duty: number
}
export type linApiStartSch = {
  method: 'startSch'
  device?: string
  schName: string
  activeCtrl?: boolean[]
  slot?: number
}

export type linApiPowerCtrl = {
  method: 'powerCtrl'
  device?: string
  power: boolean
}
export type linApiStopSch = {
  method: 'stopSch'
  device?: string
}
type EventHandlerMap = {
  [K in keyof HandlerMap]: HandlerMap[K]
}

export interface TestData {
  event: boolean
  eventData: TestEvent
  data: {
    label: string
    message: {
      method: string
    }
  }
}

export default class UdsTester {
  worker?: Worker
  pythonProcess?: ChildProcess
  isPython = false
  selfStop = false
  log: UdsLOG
  testEvents: TestEvent[] = []
  getInfoPromise?: { resolve: (v: any[]) => void; reject: (e: any) => void }
  serviceMap: Record<string, ServiceItem> = {}
  ts = 0
  private cb: any
  private varCb: any
  methods: string[] = []
  eventHandlerMap: Partial<EventHandlerMap> = {}

  private pendingRequests = new Map<
    number,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  >()
  private reqId = 0
  private pythonStdoutBuffer = ''

  constructor(
    private id: string,
    private env: {
      PROJECT_ROOT: string
      PROJECT_NAME: string
      MODE: 'node' | 'sequence' | 'test'
      NAME: string
      ONLY?: string
    },
    private jsFilePath: string,
    log: UdsLOG,
    private testers?: Record<string, TesterInfo>,
    private testOptions?: {
      testOnly?: boolean
      id?: string
    },
    options?: {
      scriptType?: 'js' | 'python' // 脚本类型，默认为 'js'
      pythonPath?: string // Python 可执行文件路径
    }
  ) {
    if (testers) {
      this.buildServiceMap(testers)
    }
    this.log = log

    // 检查脚本类型
    const scriptType = options?.scriptType || (jsFilePath.endsWith('.py') ? 'python' : 'js')
    this.isPython = scriptType === 'python'

    if (!fs.existsSync(jsFilePath)) {
      throw new Error(`script file not found`)
    }

    if (this.isPython) {
      this.initPythonProcess(options?.pythonPath)
    } else {
      this.initWorkerThread()
    }

    this.cb = this.keyHandle.bind(this)
    globalThis.keyEvent?.on('keydown', this.cb)
    this.varCb = this.varHandle.bind(this)
    globalThis.varEvent?.on('update', this.varCb)
  }

  private initWorkerThread() {
    const execArgv = ['--enable-source-maps']
    if (this.env.MODE == 'test') {
      execArgv.push(`--test-reporter=${pathToFileURL(reportPath).toString()}`)
      if (this.testOptions?.testOnly) {
        execArgv.push('--test-only')
        this.env.ONLY = 'true'
      } else {
        this.env.ONLY = 'false'
      }
    }
    this.worker = new Worker(this.jsFilePath, {
      workerData: this.env,
      stdout: true,
      stderr: true,
      env: this.env,
      execArgv: execArgv
    })

    this.worker.on('message', (msg: any) => {
      if (msg && msg.type === 'rpc_response') {
        const p = this.pendingRequests.get(msg.id)
        if (p) {
          this.pendingRequests.delete(msg.id)
          if (msg.error) {
            const error = new Error(msg.error.message)
            error.stack = msg.error.stack
            p.reject(error)
          } else {
            p.resolve(msg.result)
          }
        }
      } else if (msg && msg.type === 'event') {
        this.eventHandler(
          msg.payload,
          () => {},
          () => {}
        )
      }
    })

    this.worker.on('error', (error) => {
      if (!this.selfStop) {
        this.log.systemMsg(`worker terminated by error: ${formatError(error)}`, this.ts, 'error')
      }
      if (this.getInfoPromise) {
        this.getInfoPromise.reject(new Error('worker terminated'))
      }
      this.stop(true)
    })

    this.worker.on('exit', (code) => {
      if (code !== 0 && !this.selfStop) {
        this.log.systemMsg(`worker terminated with code ${code}`, this.ts, 'error')
        this.stop(true)
      }
    })

    this.worker.stdout.on('data', (data: any) => {
      if (!this.selfStop) {
        if (this.env.MODE == 'test') {
          const testStartRegex = /^<<< TEST START .+>>>$/
          const testEndRegex = /^<<< TEST END .+>>>$/
          const str = data.toString().trim()
          if (testStartRegex.test(str) || testEndRegex.test(str)) {
            return
          }
        }
        this.log.scriptMsg(data.toString().replace(/\n$/, ''), this.ts)
      }
    })

    this.worker.stderr.on('data', (data: any) => {
      if (!this.selfStop) {
        if (this.env.MODE == 'test') {
          const testStartRegex = /^<<< TEST START .+>>>$/
          const testEndRegex = /^<<< TEST END .+>>>$/
          const str = data.toString().trim()
          if (testStartRegex.test(str) || testEndRegex.test(str)) {
            return
          }
          if (str.includes('Util.Init function failed')) {
            this.stop(true)
          }
        }
        this.log.systemMsg(data.toString().replace(/\n$/, ''), this.ts, 'error')
      }
    })
  }

  private initPythonProcess(pythonPath?: string) {
    const pythonExec = pythonPath || process.env.PYTHON_PATH || 'python'
    const scriptPath = this.jsFilePath

    const pythonLibPath = path.join(this.env.PROJECT_ROOT, 'python')
    const envPythonPath = process.env.PYTHONPATH
      ? `${process.env.PYTHONPATH}${path.delimiter}${pythonLibPath}`
      : pythonLibPath

    // 启动 Python 进程，使用 stdio 进行 JSON-RPC 通信
    this.pythonProcess = spawn(pythonExec, ['-u', scriptPath], {
      cwd: path.dirname(scriptPath),
      env: {
        ...process.env,
        ...this.env,
        PYTHONPATH: envPythonPath
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // 处理 stdout - JSON-RPC 消息（每行一个 JSON）
    if (this.pythonProcess.stdout) {
      this.pythonProcess.stdout.on('data', (data: Buffer) => {
        if (!this.selfStop) {
          this.pythonStdoutBuffer += data.toString()
          const lines = this.pythonStdoutBuffer.split('\n')
          // 保留最后一个不完整的行
          this.pythonStdoutBuffer = lines.pop() || ''

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine) continue

            // 尝试解析 JSON-RPC 消息
            try {
              const msg = JSON.parse(trimmedLine, bufferReviver)
              this.handlePythonMessage(msg)
            } catch (e) {
              // 如果不是 JSON，作为普通日志输出
              if (this.env.MODE == 'test') {
                const testStartRegex = /^<<< TEST START .+>>>$/
                const testEndRegex = /^<<< TEST END .+>>>$/
                if (testStartRegex.test(trimmedLine) || testEndRegex.test(trimmedLine)) {
                  continue
                }
              }
              this.log.scriptMsg(trimmedLine, this.ts)
            }
          }
        }
      })
    }

    // 处理 stderr - 日志输出
    if (this.pythonProcess.stderr) {
      this.pythonProcess.stderr.on('data', (data: Buffer) => {
        if (!this.selfStop) {
          const str = data.toString().trim()
          if (this.env.MODE == 'test') {
            const testStartRegex = /^<<< TEST START .+>>>$/
            const testEndRegex = /^<<< TEST END .+>>>$/
            if (testStartRegex.test(str) || testEndRegex.test(str)) {
              return
            }
            if (str.includes('Util.Init function failed')) {
              this.stop(true)
            }
          }
          this.log.systemMsg(str, this.ts, 'error')
        }
      })
    }

    // 处理进程错误
    this.pythonProcess.on('error', (error) => {
      if (!this.selfStop) {
        this.log.systemMsg(`Python process error: ${formatError(error)}`, this.ts, 'error')
      }
      if (this.getInfoPromise) {
        this.getInfoPromise.reject(new Error('Python process failed to start'))
      }
      this.stop(true)
    })

    // 处理进程退出
    this.pythonProcess.on('exit', (code, signal) => {
      if (code !== 0 && !this.selfStop) {
        this.log.systemMsg(
          `Python process terminated with code ${code}${signal ? `, signal ${signal}` : ''}`,
          this.ts,
          'error'
        )
        this.stop(true)
      }
    })

    // 发送初始化消息
    this.sendPythonInit()
  }

  private handlePythonMessage(msg: any) {
    if (msg && msg.type === 'rpc_response') {
      const p = this.pendingRequests.get(msg.id)
      if (p) {
        this.pendingRequests.delete(msg.id)
        if (msg.error) {
          const error = new Error(msg.error.message)
          error.stack = msg.error.stack
          p.reject(error)
        } else {
          p.resolve(msg.result)
        }
      }
    } else if (msg && msg.type === 'event') {
      this.eventHandler(
        msg.payload,
        () => {},
        () => {}
      )
    }
  }

  private sendPythonInit() {
    // 发送初始化消息给 Python 脚本
    this.sendPythonMessage({
      type: 'init',
      env: this.env
    })
  }

  private sendPythonMessage(msg: any) {
    if (this.pythonProcess && this.pythonProcess.stdin && !this.pythonProcess.stdin.destroyed) {
      // JSON-RPC over stdio: 每行一个 JSON 消息，不能包含换行符
      const jsonStr = JSON.stringify(msg)
      if (jsonStr.includes('\n')) {
        this.log.systemMsg(
          'Warning: JSON message contains newline, which is not allowed',
          this.ts,
          'error'
        )
        return
      }
      this.pythonProcess.stdin.write(jsonStr + '\n')
    }
  }
  buildServiceMap(testers?: Record<string, TesterInfo>) {
    if (testers) {
      for (const tester of Object.values(testers)) {
        for (const [_name, serviceList] of Object.entries(tester.allServiceList)) {
          for (const service of serviceList) {
            this.serviceMap[`${tester.name}.${service.name}`] = service
          }
        }
      }
    }
  }
  async getTestInfo() {
    return new Promise<TestEvent[]>((resolve, reject) => {
      if (this.env.MODE != 'test') {
        reject(new Error('not in test mode'))
        return
      }
      for (const testEvent of this.testEvents) {
        if (testEvent.type == 'test:pass' && testEvent.data.name == '____ecubus_pro_test___') {
          resolve(this.testEvents)
          return
        }
      }
      this.getInfoPromise = { resolve, reject }
    })
  }
  updateTs(ts: number) {
    this.ts = ts
  }
  keyHandle(key: string) {
    if (!this.selfStop) {
      this.workerEmit('__keyDown', key).catch((e: any) => {
        this.log.systemMsg(e.toString(), this.ts, 'error')
      })
    }
  }
  varHandle(data: { name: string; value: number | string | number[]; id: string; uuid: string }) {
    if (!this.selfStop && data.uuid != this.id) {
      this.workerEmit('__varUpdate', data).catch((e: any) => {
        this.log.systemMsg(e.toString(), this.ts, 'error')
      })
    }
  }
  async setTxPending(msg: CanMessage) {
    return await this.exec('__setTxPending', [msg])
  }
  private async workerEmit(method: string, data: any): Promise<any> {
    if (this.selfStop) {
      // check selfStop instead of terminated
      return Promise.resolve(new Error('worker terminated'))
    }
    return this.exec('__on', [method, data])
  }
  eventHandler(payload: any, resolve: any, reject: any) {
    const id = payload.id
    const event = payload.event
    const data = payload.data

    if (event == 'set' && this.testers) {
      const service = data.service as ServiceItem
      const isReq = data.isRequest as boolean
      const name = data.testerName as string
      if (this.serviceMap[`${name}.${service.name}`]) {
        if (isReq) {
          service.params = service.params.map((p: any) => {
            p.value = Buffer.from(p.value)
            return p
          })
        } else {
          service.respParams = service.respParams.map((p: any) => {
            p.value = Buffer.from(p.value)
            return p
          })
        }
        assign(this.serviceMap[`${name}.${service.name}`], service)
      }
      this.exec('__eventDone', [id]).catch(reject)
    } else if (event == 'test' && this.env.MODE == 'test') {
      const testEvent = data as TestEvent

      // Process source map for test failures to get correct TypeScript line numbers

      if (!this.testOptions?.testOnly) {
        // Add the missing third parameter (message) to fix the linter error
        this.log.testInfo(this.testOptions?.id, testEvent)
      }
      this.testEvents.push(testEvent)
      if (this.getInfoPromise) {
        if (testEvent.type == 'test:pass' && testEvent.data.name == '____ecubus_pro_test___') {
          this.getInfoPromise.resolve(this.testEvents)
          this.getInfoPromise = undefined
        }
      }
    } else if (event == 'log') {
      this.log.systemMsg(data.data, this.ts, 'info')
    } else {
      const eventKey = event as keyof EventHandlerMap
      const handler = this.eventHandlerMap[eventKey]
      if (handler) {
        // 调用handler并处理结果
        try {
          const result = handler(data)
          if (result instanceof Promise) {
            result
              .then((r) => {
                if (id !== undefined) {
                  this.exec('__eventDone', [
                    id,
                    {
                      data: r
                    }
                  ]).catch(reject)
                }
              })
              .catch((e) => {
                if (id !== undefined) {
                  this.exec('__eventDone', [
                    id,
                    {
                      err: e.toString()
                    }
                  ]).catch(reject)
                }
              })
          } else {
            if (id !== undefined) {
              this.exec('__eventDone', [
                id,
                {
                  data: result
                }
              ]).catch(reject)
            }
          }
        } catch (e) {
          if (id !== undefined) {
            this.exec('__eventDone', [
              id,
              {
                err: e instanceof Error ? e.toString() : 'Unknown error'
              }
            ]).catch(reject)
          }
        }
      } else {
        if (id !== undefined) {
          this.exec('__eventDone', [
            id,
            {
              err: `API ${event} can't be used in this ${this.env.MODE} mode, or application is not started`
            }
          ]).catch(reject)
        }
      }
    }
  }
  registerHandler<T extends keyof HandlerMap>(id: T, handler: HandlerMap[T]): void {
    this.eventHandlerMap[id] = handler
  }

  clearHandlers() {
    this.eventHandlerMap = {}
  }
  // async triggerPreSend(serviceName: string) {
  //   if (this.tester) {
  //     await this.workerEmit(`${this.tester.name}.${serviceName}.preSend`, `${this.tester.name}.${serviceName}`)
  //   }
  // }
  async triggerSend(testerName: string, service: ServiceItem, addr: UdsAddress, ts: number) {
    this.updateTs(ts)
    if (this.testers) {
      try {
        await this.workerEmit(`${testerName}.${service.name}.send`, { service, addr })
      } catch (e: any) {
        throw formatError(e)
      }
    }
  }
  async triggerRecv(testerName: string, service: ServiceItem, ts: number, addr?: UdsAddress) {
    this.updateTs(ts)
    if (this.testers) {
      try {
        await this.workerEmit(`${testerName}.${service.name}.recv`, { service, addr })
      } catch (e: any) {
        throw formatError(e)
      }
    }
  }
  async triggerCanFrame(msg: CanMessage) {
    try {
      const r = await this.workerEmit('__canMsg', msg)
      return r
    } catch (e: any) {
      throw formatError(e)
    }
  }
  async triggerSomeipFrame(msg: SomeipMessage) {
    try {
      const r = await this.workerEmit('__someipMsg', msg)
      return r
    } catch (e: any) {
      throw formatError(e)
    }
  }
  async triggerLinFrame(msg: LinMsg) {
    try {
      const r = await this.workerEmit('__linMsg', msg)
      return r
    } catch (e: any) {
      throw formatError(e)
    }
  }
  async start(projectPath: string, testerName?: string, testControl?: Record<number, boolean>) {
    await this.exec('__start', [
      cloneDeep(global.dataSet),
      this.serviceMap,
      testerName,
      testControl
    ])
    await this.workerEmit('__varFc', null)
    this.methods = await this.exec('methods', [])
  }
  async stopEmit() {
    if (this.selfStop) {
      return
    }
    await this.workerEmit('__end', [])
  }

  async exec(method: string, param: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.selfStop) {
        reject(new Error('worker terminated'))
        return
      }
      const id = this.reqId++
      this.pendingRequests.set(id, { resolve, reject })

      const message = {
        type: 'rpc',
        id,
        method,
        params: param
      }

      if (this.isPython) {
        this.sendPythonMessage(message)
      } else {
        this.worker!.postMessage(message)
      }
    })
  }
  async stop(error = false) {
    if (this.selfStop) {
      return // 避免重复调用
    }

    this.selfStop = true

    globalThis.keyEvent?.off('keydown', this.cb)
    globalThis.varEvent?.off('update', this.varCb)
    if (this.getInfoPromise) {
      this.getInfoPromise.reject(new Error('worker terminated'))
    }
    const pList = []
    if (!error) {
      // 尝试优雅地结束worker
      pList.push(this.workerEmit('__end', []))
    }
    pList.push(new Promise((resolve) => setTimeout(resolve, 1000)))

    // 任意一个promise完成就结束
    try {
      await Promise.any(pList)
    } catch (e) {
      null
    }

    if (this.isPython) {
      // 关闭 Python 进程
      if (this.pythonProcess) {
        if (this.pythonProcess.stdin && !this.pythonProcess.stdin.destroyed) {
          this.pythonProcess.stdin.end()
        }
        if (!this.pythonProcess.killed) {
          this.pythonProcess.kill()
        }
        this.pythonProcess = undefined
      }
    } else {
      // 终止 Worker Thread
      try {
        await this.worker!.terminate()
      } catch (e) {
        null
      }
    }
  }

  // 检查worker是否健康
  isHealthy(): boolean {
    if (this.selfStop) return false
    if (this.isPython) {
      return !!this.pythonProcess && !this.pythonProcess.killed
    } else {
      return !!this.worker
    }
  }

  // 获取worker状态信息
  getWorkerStatus(): { healthy: boolean; selfStop: boolean; hasPool: boolean; hasWorker: boolean } {
    return {
      healthy: this.isHealthy(),
      selfStop: this.selfStop,
      hasPool: false, // Removed pool concept
      hasWorker: this.isPython ? !!this.pythonProcess : !!this.worker
    }
  }
}

function bufferReviver(key: string, value: any) {
  if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data)
  }
  return value
}
