import { parentPort, workerData } from 'worker_threads'
import fs from 'fs'
import type { OsEvent } from '../share/osEvent'
import type { ORTIFile } from 'src/renderer/src/database/ortiParse'
import { getTsUs } from '../share/can'
import { OsTraceParser } from './parser'

interface WorkerData {
  orti: ORTIFile
  filePath: string
}

class OsTraceWorker {
  private file?: fs.ReadStream
  private orti: ORTIFile
  private filePath: string
  private eventQueue: Array<{ osEvent: OsEvent; realTs: number }> = []
  private timer?: NodeJS.Timeout
  private systemTs: number = 0
  private offsetTs?: number
  private parser: OsTraceParser
  private isPaused: boolean = false
  private readonly MAX_QUEUE_SIZE = 10000 // 最大队列长度
  private readonly MIN_QUEUE_SIZE = 5000 // 恢复读取的阈值

  constructor(data: WorkerData) {
    this.orti = data.orti
    this.filePath = data.filePath
    this.systemTs = getTsUs()

    // Create parser with callbacks
    this.parser = new OsTraceParser(this.orti, {
      onEvent: (osEvent, realTs) => {
        this.handleEvent(osEvent, realTs)
      },
      onError: (error) => {
        parentPort?.postMessage({ type: 'error', data: error })
      },
      onNeedMoreData: () => {
        this.checkResume()
      }
    })

    if (this.orti.connector?.type === 'BinaryFile') {
      this.file = fs.createReadStream(this.filePath, {
        highWaterMark: 16384 // 增大缓冲区，减少读取次数
      })
      this.file.on('data', async (chunk: any) => {
        this.file!.pause()
        await this.parser.parseBinaryData(chunk as Buffer)
        this.checkResume()
      })
      this.file.on('end', () => {
        parentPort?.postMessage({ type: 'end' })
      })
      this.file.on('error', (error) => {
        parentPort?.postMessage({ type: 'error', data: error.message })
      })
    } else if (this.orti.connector?.type === 'CSVFile') {
      this.file = fs.createReadStream(this.filePath, {
        encoding: 'utf-8',
        highWaterMark: 16384 // 增大缓冲区，减少读取次数
      })
      this.file.on('data', async (chunk: any) => {
        this.file!.pause()
        await this.parser.parseCsvData(chunk as string)
        this.checkResume()
      })
      this.file.on('end', () => {
        parentPort?.postMessage({ type: 'end' })
      })
      this.file.on('error', (error) => {
        parentPort?.postMessage({ type: 'error', data: error.message })
      })
    }

    // Start 50ms timer to process queue
    this.timer = setInterval(() => {
      this.processQueue()
    }, 50)
  }

  private checkResume() {
    // 如果队列长度超过最大值，暂停文件读取
    if (this.eventQueue.length > this.MAX_QUEUE_SIZE) {
      if (!this.isPaused) {
        this.isPaused = true
        // 不再 resume，等待队列消费
      }
    }
    // 如果队列长度降到阈值以下，恢复文件读取
    else if (this.eventQueue.length < this.MIN_QUEUE_SIZE && this.isPaused) {
      this.isPaused = false
      this.file?.resume()
    }
    // 正常情况，继续读取
    else if (!this.isPaused) {
      this.file?.resume()
    }
  }

  processQueue() {
    const currentTs = getTsUs() - this.systemTs
    const evnets: Array<{ osEvent: OsEvent; realTs: number }> = []
    // Process events whose time has arrived (realTs - offsetTs <= currentTs)
    while (this.eventQueue.length > 0) {
      const first = this.eventQueue[0]

      if (first.realTs <= currentTs) {
        // Time has arrived, send the event to main thread
        this.eventQueue.shift()
        evnets.push(first)
      } else {
        // Event time hasn't arrived yet, wait
        break
      }
    }
    if (evnets.length > 0) {
      parentPort?.postMessage({
        type: 'event',
        data: evnets
      })
    }

    // 处理完队列后检查是否需要恢复文件读取
    this.checkResume()
  }

  handleEvent(osEvent: OsEvent, realTs: number) {
    const ts = getTsUs() - this.systemTs

    if (this.offsetTs == undefined) {
      this.offsetTs = realTs - ts
    }

    // Add to queue for timed playback
    this.eventQueue.push({ osEvent, realTs: realTs - this.offsetTs! })
  }

  close() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    if (this.file) {
      this.file.close()
    }
  }
}

// Initialize worker
const worker = new OsTraceWorker(workerData as WorkerData)

// Handle messages from main thread
parentPort?.on('message', (message: any) => {
  if (message.type === 'close') {
    worker.close()
    process.exit(0)
  }
})
