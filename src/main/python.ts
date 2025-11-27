import path from 'path'
import { PythonShell, Options, PythonShellError } from 'python-shell'
import fs from 'fs'

export interface PythonOptions {
  restartable: boolean
  retryTimers: number
}
export class Python {
  pythonShell!: PythonShell
  id = 0
  needLen = 8
  state = 0
  prefix = 0x5acdbae5
  pendBuf: Buffer = Buffer.alloc(0)
  retry = 0
  lastErr?: Error | PythonShellError
  closed = false
  opt: PythonOptions
  options: Options = {
    mode: 'binary',
    pythonPath: process.env.PYTHON_PATH,
    pythonOptions: ['-u'] // get print results in real-time
  }
  fileName: string
  pending_cmds: Map<number, { resolve: (value: string) => void; reject: (reason?: any) => void }>
  constructor(fileName: string, filePath?: string, opt?: PythonOptions) {
    this.pending_cmds = new Map()
    this.opt = {
      restartable: opt?.restartable || false,
      retryTimers: opt?.retryTimers || 3
    }
    this.fileName = fileName
    let ff = fileName
    if (filePath) {
      this.options.scriptPath = filePath
      ff = path.join(filePath, fileName)
    }
    if (!fs.existsSync(ff)) {
      throw new Error('file not found:' + ff)
    }
    this.initPython()
  }
  initPython() {
    this.pythonShell = new PythonShell(this.fileName, this.options)
    this.pythonShell.stdout.on('data', (data) => this.handleMessage(data))
    this.pythonShell.on('pythonError', (err) => {
      this.lastErr = err
      for (const pend of this.pending_cmds.values()) {
        pend.reject(err)
      }
      this.pending_cmds.clear()
      this.pythonShell.kill()
      if (this.opt.restartable && this.retry < this.opt.retryTimers) {
        this.retry++
        //restart
        this.initPython()
      } else {
        this.closed = true
      }
    })
    this.closed = false
  }
  handleMessage(data: Buffer) {
    if (!this.closed) {
      this.pendBuf = Buffer.concat([this.pendBuf, data])

      while (this.pendBuf.length >= this.needLen) {
        if (this.state === 0) {
          // 寻找前缀
          const prefixBytes = Buffer.from([
            this.prefix >>> 24,
            (this.prefix >>> 16) & 0xff,
            (this.prefix >>> 8) & 0xff,
            this.prefix & 0xff
          ])
          const prefixIndex = this.pendBuf.indexOf(prefixBytes)

          if (prefixIndex === -1) {
            if (this.pendBuf.length > 3) {
              // 保留最后3个字节，等待更多数据
              this.pendBuf = this.pendBuf.slice(-3)
            }
            break
          }

          if (prefixIndex > 0) {
            // 移除前缀之前的数据
            this.pendBuf = this.pendBuf.slice(prefixIndex)
          }

          // 确认是否有足够的数据读取长度
          if (this.pendBuf.length < 8) {
            break // 不够读取长度，等待更多数据
          }

          // 读取消息长度
          this.needLen = this.pendBuf.readUInt32BE(4)
          this.state = 1
        }

        if (this.pendBuf.length >= this.needLen + 8) {
          const jsonString = this.pendBuf.toString('utf8', 8, 8 + this.needLen)
          try {
            const { event, id, data } = JSON.parse(jsonString)
            this.handleEvent(event, id, data)
          } catch (error) {
            console.error('JSON parse error:', error)
          }

          // 准备处理下一条消息
          this.pendBuf = this.pendBuf.slice(8 + this.needLen)
          this.needLen = 8 // 重置需要的长度，包括下一个消息的前缀和长度
          this.state = 0
        } else {
          // 不够读取完整的消息，退出循环
          break
        }
      }
    }
  }
  handleEvent(event: string, id: number, data: any) {
    if (event === 'print') {
      console.log(data)
    } else {
      const handler = this.pending_cmds.get(id)
      if (handler) {
        this.pending_cmds.delete(id)
        switch (event) {
          case 'cmd_error':
            handler.reject(data)
            break
          case 'cmd_ok':
            handler.resolve(data)
            break
          default:
            console.error('Unknown event:', event)
        }
      } else {
        console.error('No handler for:', id, this.pending_cmds)
      }
    }
  }
  postMessage(event: string, id: number, data: string) {
    const str = JSON.stringify({ event, id, data })
    //len to 4byte
    const len = Buffer.alloc(8)
    len.writeUInt32BE(this.prefix)
    len.writeUInt32BE(str.length, 4)
    //combine len and str and send
    const buf = Buffer.concat([len, Buffer.from(str)])
    this.pythonShell.send(buf)
  }
  async send(event: string, data: any) {
    if (!this.closed) {
      return new Promise<string>((resolve, reject) => {
        const cmd_id = this.id++
        this.pending_cmds.set(cmd_id, { resolve, reject })
        this.postMessage(event, cmd_id, JSON.stringify(data))
      })
    } else {
      throw this.lastErr || new Error('python shell closed')
    }
  }

  kill() {
    this.pythonShell.kill()
  }
  async end() {
    return new Promise((resolve, reject) => {
      this.pythonShell.end((err, code, signal) => {
        resolve({ err, code, signal })
      })
    })
  }

  pureSend(data: string) {
    this.pythonShell.send(data)
  }
}
