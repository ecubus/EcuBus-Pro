import { assign, cloneDeep } from 'lodash'
import { Sequence, ServiceItem } from './share/uds'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import workerpool, { Pool } from 'workerpool'
import { PluginLOG } from './log'
import { formatError } from 'nodeCan/can'

export default class PluginClient {
  pool: Pool
  worker: any
  selfStop = false
  log: PluginLOG

  constructor(
    private id: string,
    private env: {
      PROJECT_ROOT: string
      PROJECT_NAME: string
    },
    private jsFilePath: string
  ) {
    this.log = new PluginLOG(id)
    const execArgv = ['--enable-source-maps']

    this.pool = workerpool.pool(jsFilePath, {
      minWorkers: 1,
      maxWorkers: 1,
      workerType: 'thread',
      emitStdStreams: false,
      workerTerminateTimeout: 0,
      workerThreadOpts: {
        stderr: true,
        stdout: true,
        env: this.env,
        execArgv: execArgv,
        workerData: global.dataSet
      },

      onTerminateWorker: (v: any) => {
        if (!this.selfStop) {
          global.sysLog.error('worker terminated unexpectedly')
        }
      }
    })
    const d = (this.pool as any)._getWorker()
    this.worker = d
    d.worker.globalOn = (payload: any) => {
      this.eventHandler(payload)
    }

    d.worker.stdout.on('data', (data: any) => {
      if (!this.selfStop) {
        global.scriptLog.info(data.toString())
      }
    })

    d.worker.stderr.on('data', (data: any) => {
      if (!this.selfStop) {
        global.sysLog.error(data.toString())
      }
    })
  }

  eventHandler(payload: any) {
    const event = payload.event
    const data = payload.data
    this.log.pluginEvent(event, data)
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
                this.eventHandler(payload)
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
