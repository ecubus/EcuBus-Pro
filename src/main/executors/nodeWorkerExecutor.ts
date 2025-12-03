import { ScriptExecutor } from './scriptExecutor'
import { Worker } from 'worker_threads'
import { pathToFileURL } from 'node:url'
import reportPath from '../../../resources/lib/js/report.js?asset&asarUnpack'

export class NodeWorkerExecutor extends ScriptExecutor {
  private worker?: Worker

  constructor(
    scriptPath: string,
    env: any,
    private testOptions?: { testOnly?: boolean }
  ) {
    super(scriptPath, env)
  }

  init() {
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

    this.worker = new Worker(this.scriptPath, {
      workerData: this.env,
      stdout: true,
      stderr: true,
      env: this.env,
      execArgv: execArgv
    })

    this.worker.on('message', (msg) => this.eventHandler?.onMessage(msg))
    this.worker.on('error', (err) => this.eventHandler?.onError(err))
    this.worker.on('exit', (code) => this.eventHandler?.onExit(code))

    this.worker.stdout.on('data', (data: any) => {
      this.eventHandler?.onLog(data.toString(), 'info')
    })

    this.worker.stderr.on('data', (data: any) => {
      this.eventHandler?.onLog(data.toString(), 'error')
    })
  }

  postMessage(msg: any) {
    this.worker?.postMessage(msg)
  }

  async terminate() {
    await this.worker?.terminate()
    this.worker = undefined
  }

  isHealthy() {
    return !!this.worker
  }
}
