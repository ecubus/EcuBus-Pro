import { parentPort, workerData } from 'worker_threads'
import fs from 'fs'
import { pipeline } from 'stream/promises'
import type { OsEvent } from '../share/osEvent'
import type { ORTIFile } from 'src/renderer/src/database/ortiParse'
import { getTsUs } from '../share/can'
import { BinaryParserStream, CsvParserStream } from './parser'

interface WorkerData {
  orti: ORTIFile
  filePath: string
}

class OsTraceWorker {
  private orti: ORTIFile
  private filePath: string
  private eventQueue: Array<{ osEvent: OsEvent; realTs: number }> = []
  private timer?: NodeJS.Timeout
  private systemTs: number = 0
  private offsetTs?: number
  private pipelineAbortController?: AbortController

  constructor(data: WorkerData) {
    this.orti = data.orti
    this.filePath = data.filePath
    this.systemTs = getTsUs()

    // Start 50ms timer to process queue
    this.timer = setInterval(() => {
      this.processQueue()
    }, 50)

    // Start pipeline
    this.startPipeline()
  }

  private async startPipeline() {
    try {
      this.pipelineAbortController = new AbortController()
      const { signal } = this.pipelineAbortController

      if (this.orti.connector?.type === 'BinaryFile') {
        const readStream = fs.createReadStream(this.filePath, {
          highWaterMark: 16384
        })

        const parserStream = new BinaryParserStream(this.orti, {
          onEvent: (osEvent, realTs) => {
            this.handleEvent(osEvent, realTs)
          },
          onError: (error) => {
            parentPort?.postMessage({ type: 'error', data: error })
          },
          getEventLength: () => {
            return this.eventQueue.length
          }
        })

        await pipeline(readStream, parserStream, { signal })
      } else if (this.orti.connector?.type === 'CSVFile') {
        const readStream = fs.createReadStream(this.filePath, {
          encoding: 'utf-8',
          highWaterMark: 16384
        })

        const parserStream = new CsvParserStream(this.orti, {
          onEvent: (osEvent, realTs) => {
            this.handleEvent(osEvent, realTs)
          },
          onError: (error) => {
            parentPort?.postMessage({ type: 'error', data: error })
          },
          getEventLength: () => {
            return this.eventQueue.length
          }
        })

        await pipeline(readStream, parserStream, { signal })
      }

      // Pipeline completed successfully
      parentPort?.postMessage({ type: 'end' })
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        parentPort?.postMessage({ type: 'error', data: error.message })
      }
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
  }

  handleEvent(osEvent: OsEvent, realTs: number) {
    if (this.offsetTs == undefined) {
      const ts = getTsUs() - this.systemTs
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
    if (this.pipelineAbortController) {
      this.pipelineAbortController.abort()
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
