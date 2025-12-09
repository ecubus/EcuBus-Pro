import { ScriptExecutor } from './scriptExecutor'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import Store from 'electron-store'
import fs from 'fs'

const store = new Store()

function bufferReviver(key: string, value: any) {
  if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data)
  }
  return value
}

interface PythonSettings {
  pythonPath?: string
  enableVenv?: boolean
  venvPath?: string
}

export class PythonProcessExecutor extends ScriptExecutor {
  private pythonProcess?: ChildProcess
  private stdoutBuffer = ''

  constructor(scriptPath: string, env: any) {
    super(scriptPath, env)
  }

  private getPythonSettings(): PythonSettings {
    const settings = store.get('python.settings') as PythonSettings | undefined
    return {
      pythonPath: 'python',
      enableVenv: false,
      venvPath: 'venv',
      ...settings
    }
  }

  private resolvePythonExecutable(settings: PythonSettings): string {
    // 如果启用了 venv，尝试使用 venv 中的 Python
    if (settings.enableVenv && settings.venvPath) {
      const projectRoot = this.env.PROJECT_ROOT
      const venvPath = path.isAbsolute(settings.venvPath)
        ? settings.venvPath
        : path.join(projectRoot, settings.venvPath)

      // 根据不同操作系统构造 Python 可执行文件路径
      const pythonExecName = process.platform === 'win32' ? 'python.exe' : 'python'
      const venvPythonPath = path.join(
        venvPath,
        process.platform === 'win32' ? 'Scripts' : 'bin',
        pythonExecName
      )

      // 检查 venv Python 是否存在
      if (fs.existsSync(venvPythonPath)) {
        return venvPythonPath
      }
    }

    // 使用配置中的 pythonPath 或环境变量或默认值
    return settings.pythonPath || process.env.PYTHON_PATH || 'python'
  }

  init() {
    const settings = this.getPythonSettings()
    const pythonExec = this.resolvePythonExecutable(settings)

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
            // opt ignore if the line is not a valid JSON
            if (!trimmedLine.startsWith('{')) {
              this.eventHandler?.onLog(trimmedLine, 'info')
            } else {
              const msg = JSON.parse(trimmedLine, bufferReviver)
              this.eventHandler?.onMessage(msg)
            }
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
