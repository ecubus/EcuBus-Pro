import { SerialPort } from 'serialport'
import type { ORTIFile } from 'src/renderer/src/database/ortiParse'
import { Worker } from 'worker_threads'
import { OsEvent } from '../share/osEvent'
import { OsTraceLOG } from '../log'
import { getTsUs } from '../share/can'
import path from 'path'
import workerPath from './worker?modulePath'
import { OsTraceParser } from './parser'
import fs from 'fs'

export default class TraceItem {
  private serialPort?: SerialPort
  private worker?: Worker
  private parser?: OsTraceParser
  private log!: OsTraceLOG
  private systemTs: number = 0
  private offsetTs?: number
  private cnt = 0
  private closeFlag = false
  constructor(
    public orti: ORTIFile,
    projectPath: string
  ) {
    this.orti = orti
    if (this.orti.connector) {
      if (this.orti.connector.type === 'SerialPort') {
        // Create parser for serial port data
        this.parser = new OsTraceParser(this.orti, {
          onEvent: (osEvent, realTs) => {
            const ts = getTsUs() - this.systemTs
            if (this.offsetTs == undefined) {
              this.offsetTs = realTs - ts
            }
            this.cnt++
            // For serial port, emit immediately (no queue)
            this.log.osEvent(realTs - this.offsetTs, osEvent)
          },
          onError: (error) => {
            const ts = getTsUs() - this.systemTs
            this.log.error(ts, error)
          },
          getEventLength: () => {
            return 0
          }
        })

        this.serialPort = new SerialPort({
          path: this.orti.connector.device,
          baudRate: parseInt(this.orti.connector.options.baudRate),
          dataBits: parseInt(this.orti.connector.options.dataBits) as any,
          parity: this.orti.connector.options.parity as 'none' | 'even' | 'odd',
          stopBits: parseInt(this.orti.connector.options.stopBits) as any,
          autoOpen: true
        })
        this.serialPort.on('data', (data: Buffer) => {
          this.parser!.parseBinaryData(data)
        })
      } else if (
        this.orti.connector.type === 'BinaryFile' ||
        this.orti.connector.type === 'CSVFile'
      ) {
        let filePath = this.orti.connector.options.file
        if (!path.isAbsolute(filePath)) {
          filePath = path.join(projectPath, filePath)
        }
        if (!fs.existsSync(filePath)) {
          global.sysLog.error(`file ${filePath} not found`)
          return
        }

        // Create worker to handle file processing
        this.worker = new Worker(workerPath, {
          workerData: {
            orti: this.orti,
            filePath: filePath
          }
        })

        // Handle messages from worker
        this.worker.on('message', (message: any) => {
          if (this.closeFlag) {
            return
          }
          switch (message.type) {
            case 'event': {
              // Directly log the event received from worker
              const event = message.data
              for (const item of event) {
                this.log.osEvent(item.realTs, item.osEvent)
                this.cnt++
              }

              break
            }
            case 'error': {
              const ts = getTsUs() - this.systemTs
              this.log.error(ts, message.data)
              break
            }
            case 'end':
              // File reading completed
              break
          }
        })

        this.worker.on('error', (error) => {
          const ts = getTsUs() - this.systemTs
          this.log.error(ts, `Worker error: ${error.message}`)
        })

        this.worker.on('exit', (code) => {
          if (code !== 0) {
            const ts = getTsUs() - this.systemTs
            this.log.error(ts, `Worker exited with code ${code}`)
          }
        })
      }
    }
    let logFile = this.orti.recordFile?.name
    if (this.orti.recordFile?.enable && logFile) {
      if (!path.isAbsolute(logFile)) {
        logFile = path.join(projectPath, logFile)
      }
      logFile = path.resolve(logFile)
    }
    this.log = new OsTraceLOG(this.orti.name, logFile)
    this.systemTs = getTsUs()
  }

  async close() {
    this.log.close()
    this.closeFlag = true
    this.parser?.close()
    const p = new Promise<void>((resolve) => {
      if (this.serialPort) {
        this.serialPort.close(() => {
          resolve()
        })
      }

      if (this.worker) {
        this.worker.postMessage({ type: 'close' })
        this.worker.terminate().then(() => {
          resolve()
        })
      }
    })
    await p
  }
}
