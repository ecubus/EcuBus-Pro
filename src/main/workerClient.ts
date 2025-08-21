import { assign, cloneDeep } from 'lodash'
import { Sequence, ServiceItem } from './share/uds'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import workerpool, { Pool } from 'workerpool'
import { UdsLOG } from './log'
import { TesterInfo } from './share/tester'
import { CanMessage, formatError } from './share/can'
import { VinInfo } from './share/doip'
import { LinMsg } from './share/lin'
import reportPath from '../../resources/lib/js/report.js?asset&asarUnpack'
import { pathToFileURL } from 'node:url'
import { TestEvent } from 'node:test/reporters'
import { UdsAddress } from './share/uds'

type HandlerMap = {
  output: (pool: UdsTester, data: any) => Promise<number>
  sendDiag: (
    pool: UdsTester,
    data: {
      device?: string
      address?: string
      service: ServiceItem
      isReq: boolean
      testerName: string
    }
  ) => Promise<number>
  setSignal: (
    pool: UdsTester,
    data: {
      signal: string
      value: number | number[]
    }
  ) => void
  varApi: (
    pool: UdsTester,
    data: {
      method: 'getVar' | 'setVar'
      name: string
      value: number | number[] | string
    }
  ) => void
  runUdsSeq: (
    pool: UdsTester,
    data: {
      name: string
      device?: string
    }
  ) => void
  stopUdsSeq: (
    pool: UdsTester,
    data: {
      name: string
      device?: string
    }
  ) => void
  canApi: (pool: UdsTester, data: ApiGetFrameFromDB) => Promise<any>
  linApi: (pool: UdsTester, data: linApiStartSch | linApiStopSch) => void
  pwmApi: (pool: UdsTester, data: pwmApiSetDuty) => void
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
export type ApiGetFrameFromDB = {
  method: 'getFrameFromDB'
  dbName: string
  frameName: string
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
  pool: Pool
  worker: any
  selfStop = false
  log: UdsLOG
  testEvents: TestEvent[] = []
  getInfoPromise?: { resolve: (v: any[]) => void; reject: (e: any) => void }
  serviceMap: Record<string, ServiceItem> = {}
  ts = 0
  private cb: any
  private varCb: any
  eventHandlerMap: Partial<EventHandlerMap> = {}
  constructor(
    private id: string,
    private env: {
      PROJECT_ROOT: string
      PROJECT_NAME: string
      MODE: 'node' | 'sequence' | 'test'
      NAME: string
      ONLY?: boolean
    },
    private jsFilePath: string,
    log: UdsLOG,
    private testers?: Record<string, TesterInfo>,
    private testOptions?: {
      testOnly?: boolean
      id?: string
    }
  ) {
    if (testers) {
      for (const tester of Object.values(testers)) {
        for (const [_name, serviceList] of Object.entries(tester.allServiceList)) {
          for (const service of serviceList) {
            this.serviceMap[`${tester.name}.${service.name}`] = service
          }
        }
      }
    }
    this.log = log
    const execArgv = ['--enable-source-maps']
    if (this.env.MODE == 'test') {
      execArgv.push(`--test-reporter=${pathToFileURL(reportPath).toString()}`)
      if (this.testOptions?.testOnly) {
        execArgv.push('--test-only')
        this.env.ONLY = true
      }
    }
    this.pool = workerpool.pool(jsFilePath, {
      minWorkers: 1,
      maxWorkers: 1,
      workerType: 'thread',
      emitStdStreams: false,
      workerTerminateTimeout: 5000, // 增加到10秒，给worker更多时间完成操作
      workerThreadOpts: {
        stderr: true,
        stdout: true,
        env: this.env,
        execArgv: execArgv
      },

      onTerminateWorker: (v: any) => {
        if (!this.selfStop) {
          this.log.systemMsg('worker terminated unexpectedly', this.ts, 'error')
        }
        if (this.getInfoPromise) {
          this.getInfoPromise.reject(new Error('worker terminated'))
        }
        // 避免在已经停止的情况下重复调用stop

        this.stop(true)
      }
    })
    const d = (this.pool as any)._getWorker()
    this.worker = d
    d.worker.globalOn = (payload: any) => {
      this.eventHandler(
        payload,
        () => {},
        () => {}
      )
    }

    d.worker.stdout.on('data', (data: any) => {
      if (!this.selfStop) {
        if (this.env.MODE == 'test') {
          const testStartRegex = /^<<< TEST START .+>>>$/
          const testEndRegex = /^<<< TEST END .+>>>$/
          const str = data.toString().trim()
          if (testStartRegex.test(str) || testEndRegex.test(str)) {
            return
          }
        }
        this.log.scriptMsg(data.toString(), this.ts)
      }
    })

    d.worker.stderr.on('data', (data: any) => {
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
        this.log.systemMsg(data.toString(), this.ts, 'error')
      }
    })

    this.cb = this.keyHandle.bind(this)
    globalThis.keyEvent?.on('keydown', this.cb)
    this.varCb = this.varHandle.bind(this)
    globalThis.varEvent?.on('update', this.varCb)
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
  private async workerEmit(method: string, data: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.pool
        .exec('__on', [method, data], {
          on: (payload: any) => {
            this.eventHandler(payload, resolve, reject)
          }
        })
        .then(resolve)
        .catch(reject)
    })
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
      this.worker.exec('__eventDone', [id]).catch(reject)
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
    } else {
      const eventKey = event as keyof EventHandlerMap
      const handler = this.eventHandlerMap[eventKey]
      if (handler) {
        // 调用handler并处理结果
        try {
          const result = handler(this, data)
          if (result instanceof Promise) {
            result
              .then((r) => {
                this.worker
                  .exec('__eventDone', [
                    id,
                    {
                      data: r
                    }
                  ])
                  .catch(reject)
              })
              .catch((e) => {
                this.worker
                  .exec('__eventDone', [
                    id,
                    {
                      err: e.toString()
                    }
                  ])
                  .catch(reject)
              })
          } else {
            this.worker
              .exec('__eventDone', [
                id,
                {
                  data: result
                }
              ])
              .catch(reject)
          }
        } catch (e) {
          this.worker
            .exec('__eventDone', [
              id,
              {
                err: e instanceof Error ? e.toString() : 'Unknown error'
              }
            ])
            .catch(reject)
        }
      } else {
        this.worker
          .exec('__eventDone', [
            id,
            {
              err: 'no handler found'
            }
          ])
          .catch(reject)
      }
    }
  }
  registerHandler<T extends keyof HandlerMap>(id: T, handler: HandlerMap[T]): void {
    this.eventHandlerMap[id] = handler
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
  async triggerLinFrame(msg: LinMsg) {
    try {
      const r = await this.workerEmit('__linMsg', msg)
      return r
    } catch (e: any) {
      throw formatError(e)
    }
  }
  async start(projectPath: string, testerName?: string, testControl?: Record<number, boolean>) {
    await this.pool.exec('__start', [this.serviceMap, testerName, testControl])
    await this.workerEmit('__varFc', null)
  }

  async exec(name: string, method: string, param: any[]): Promise<ServiceItem[]> {
    return new Promise((resolve, reject) => {
      const pendingProcess = Object.values(this.worker.processing)
      const promiseList = []
      if (pendingProcess.length > 0) {
        // reject(new Error(`function ${method} not finished, async function need call with await`))
        // return
        promiseList.push(...pendingProcess.map((p: any) => p.resolver))
      }
      Promise.all(promiseList)
        .then(() => {
          this.pool
            .exec(`${name}.${method}`, param, {
              on: (payload: any) => {
                this.eventHandler(payload, resolve, reject)
              }
            })
            .then((value: any) => {
              resolve(value)
            })
            .catch((e: any) => {
              reject(formatError(e))
            })
        })
        .catch((e: any) => {
          reject(formatError(e))
        })
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

    try {
      this.worker?.worker?.terminate()
    } catch (e) {
      null
    }

    try {
      await this.pool.terminate(true)
    } catch (e) {
      null
    }
  }

  // 检查worker是否健康
  isHealthy(): boolean {
    return !this.selfStop && this.pool && this.worker
  }

  // 获取worker状态信息
  getWorkerStatus(): { healthy: boolean; selfStop: boolean; hasPool: boolean; hasWorker: boolean } {
    return {
      healthy: this.isHealthy(),
      selfStop: this.selfStop,
      hasPool: !!this.pool,
      hasWorker: !!this.worker
    }
  }
}
