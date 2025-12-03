import { ScriptExecutor } from './scriptExecutor'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

function bufferReviver(key: string, value: any) {
  if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data)
  }
  return value
}

export class PythonProcessExecutor extends ScriptExecutor {
  private pythonProcess?: ChildProcess
  private stdoutBuffer = ''
  private pythonPath?: string

  constructor(scriptPath: string, env: any, pythonPath?: string) {
    super(scriptPath, env)
    this.pythonPath = pythonPath
  }

  init() {
    const pythonExec = this.pythonPath || process.env.PYTHON_PATH || 'python'

    const pythonLibPath = path.join(this.env.PROJECT_ROOT, 'python')
    const envPythonPath = process.env.PYTHONPATH
      ? `${process.env.PYTHONPATH}${path.delimiter}${pythonLibPath}`
      : pythonLibPath

    this.pythonProcess = spawn(pythonExec, ['-u', this.scriptPath], {
      cwd: path.dirname(this.scriptPath),
      env: {
        ...process.env,
        ...this.env,
        PYTHONPATH: envPythonPath
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    if (this.pythonProcess.stdout) {
      this.pythonProcess.stdout.on('data', (data: Buffer) => {
        this.stdoutBuffer += data.toString()
        const lines = this.stdoutBuffer.split('\n')
        this.stdoutBuffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue

          try {
            const msg = JSON.parse(trimmedLine, bufferReviver)
            this.eventHandler?.onMessage(msg)
          } catch (e) {
            this.eventHandler?.onLog(trimmedLine, 'info')
          }
        }
      })
    }

    if (this.pythonProcess.stderr) {
      this.pythonProcess.stderr.on('data', (data: Buffer) => {
        this.eventHandler?.onLog(data.toString(), 'error')
      })
    }

    this.pythonProcess.on('error', (error) => this.eventHandler?.onError(error))
    this.pythonProcess.on('exit', (code) => this.eventHandler?.onExit(code || 0))

    // Send init message
    this.postMessage({
      type: 'init',
      env: this.env
    })
  }

  postMessage(msg: any) {
    if (this.pythonProcess && this.pythonProcess.stdin && !this.pythonProcess.stdin.destroyed) {
      const jsonStr = JSON.stringify(msg)
      if (jsonStr.includes('\n')) {
        this.eventHandler?.onLog(
          'Warning: JSON message contains newline, which is not allowed',
          'error'
        )
        return
      }
      this.pythonProcess.stdin.write(jsonStr + '\n')
    }
  }

  async terminate() {
    if (this.pythonProcess) {
      if (this.pythonProcess.stdin && !this.pythonProcess.stdin.destroyed) {
        this.pythonProcess.stdin.end()
      }
      if (!this.pythonProcess.killed) {
        this.pythonProcess.kill()
      }
      this.pythonProcess = undefined
    }
  }

  isHealthy() {
    return !!this.pythonProcess && !this.pythonProcess.killed
  }
}
