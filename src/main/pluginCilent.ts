// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import workerpool, { Pool } from 'workerpool'
import { PluginLOG } from './log'
import path from 'path'

export default class PluginClient {
  pool: Pool
  worker: any
  selfStop = false
  log: PluginLOG

  constructor(
    private id: string,
    jsFilePath: string
  ) {
    this.log = new PluginLOG(this.id)
    const execArgv = ['--enable-source-maps']
    const pluginPath = path.dirname(jsFilePath)
    this.pool = workerpool.pool(jsFilePath, {
      minWorkers: 1,
      maxWorkers: 1,
      workerType: 'thread',
      emitStdStreams: false,
      workerTerminateTimeout: 1000,
      workerThreadOpts: {
        stderr: false,
        stdout: false,
        execArgv: execArgv,
        workerData: {
          pluginPath: pluginPath
        }
      }
    })
    const d = (this.pool as any)._getWorker()
    this.worker = d
    d.worker.globalOn = (payload: any) => {
      this.eventHandler(payload)
    }
  }

  eventHandler(payload: any) {
    const event = payload.event
    const data = payload.data
    this.log.pluginEvent(event, data)
  }

  async exec(method: string, ...params: any[]): Promise<any> {
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
            .exec(method, ...params, {
              on: (payload: any) => {
                this.eventHandler(payload)
              }
            })
            .then((value: any) => {
              resolve(value)
            })
            .catch((e: any) => {
              reject(e)
            })
        })
        .catch((e: any) => {
          reject(e)
        })
    })
  }

  async close(): Promise<void> {
    this.log.close()
    this.selfStop = true

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
}
