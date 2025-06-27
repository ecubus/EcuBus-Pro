import { SerialPort } from 'serialport'
import {
  CanAddr,
  CanBaseInfo,
  CanDevice,
  CanError,
  CAN_ERROR_ID,
  CanMessage,
  CanMsgType,
  CAN_ID_TYPE,
  getTsUs,
  getDlcByLen
} from '../../share/can'
import { EventEmitter } from 'events'
import { queue, QueueObject } from 'async'
import { v4 } from 'uuid'
import { TpError, CanTp, TP_ERROR_ID } from '../cantp'
import { CanLOG } from '../../log'
import { CanBase } from '../base'

// SLCAN Protocol Constants
const SLCAN_MTU = 40
const SLCAN_STD_ID_LEN = 3
const SLCAN_EXT_ID_LEN = 8

// SLCAN Bitrate Commands
const SLCAN_BITRATE_COMMANDS: Record<number, string> = {
  10000: 'S0',
  20000: 'S1',
  50000: 'S2',
  100000: 'S3',
  125000: 'S4',
  250000: 'S5',
  500000: 'S6',
  750000: 'S7',
  800000: 'S8',
  83333: 'S9',
  1000000: 'S8'
}

// SLCAN CANFD Bitrate Commands
const SLCAN_CANFD_BITRATE_COMMANDS: Record<number, string> = {
  2000000: 'Y2',
  5000000: 'Y5'
}

// Write operation interface
interface WriteOperation {
  id: number
  msgType: CanMsgType
  data: Buffer
  extra?: { database?: string; name?: string }
  resolve: (value: number) => void
  reject: (reason: CanError) => void
}

export class SLCAN_CAN extends CanBase {
  id: string
  info: CanBaseInfo
  log: CanLOG
  event = new EventEmitter()
  private serialPort: SerialPort

  private readAbort = new AbortController()

  private rejectBaseMap = new Map<
    number,
    {
      reject: (reason: CanError) => void
      msgType: CanMsgType
    }
  >()
  private cnt = 0
  private startTime = getTsUs()
  private tsOffset: number | undefined
  private closed = false
  private rxBuffer = Buffer.alloc(0)
  private msgQueue: string[] = []

  // Write queue to serialize write operations
  private writeQueue: QueueObject<WriteOperation>
  private isWriting = false

  constructor(baseInfo: CanBaseInfo) {
    super()
    this.info = baseInfo

    // Detect CANFD support from device name
    if (this.info.name.includes('CANable 2.0')) {
      this.info.canfd = true
    } else {
      this.info.canfd = false
    }

    this.id = this.info.id
    this.log = new CanLOG('SLCAN', this.info.name, this.event)
    this.attachCanMessage(this.busloadCb)

    // Initialize write queue
    this.writeQueue = queue(async (operation: WriteOperation) => {
      await this.processWriteOperation(operation)
    }, 1) // Concurrency of 1 ensures serialized writes

    // Create and open serial port directly
    this.serialPort = new SerialPort({
      path: this.info.handle,
      baudRate: 1000000,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: true
    })

    // Set up event handlers

    // Set CAN bitrate
    const bitrateCmd = SLCAN_BITRATE_COMMANDS[this.info.bitrate.freq]
    if (bitrateCmd) {
      this.serialPort.write(bitrateCmd + '\r')
    } else {
      // Throw error for unsupported bitrate
      throw new CanError(
        CAN_ERROR_ID.CAN_PARAM_ERROR,
        { idType: CAN_ID_TYPE.STANDARD, canfd: false, brs: false, remote: false },
        undefined,
        `Unsupported CAN bitrate: ${this.info.bitrate.freq} Hz`
      )
    }

    // Set CANFD bitrate if supported
    if (this.info.canfd && this.info.bitratefd) {
      const canfdBitrateCmd = SLCAN_CANFD_BITRATE_COMMANDS[this.info.bitratefd.freq]
      if (canfdBitrateCmd) {
        this.serialPort.write(canfdBitrateCmd + '\r')
      } else {
        // Throw error for unsupported CANFD bitrate
        throw new CanError(
          CAN_ERROR_ID.CAN_PARAM_ERROR,
          { idType: CAN_ID_TYPE.STANDARD, canfd: true, brs: false, remote: false },
          undefined,
          `Unsupported CANFD bitrate: ${this.info.bitratefd.freq} Hz`
        )
      }
    }

    // Open CAN port
    this.serialPort.write('O\r')

    // Start reading
    this.startReading()

    this.serialPort.on('error', (err) => {
      if (!this.close) {
        this.log.error(getTsUs(), `Serial port error: ${err.message}`)
        this.close(true, err.message)
      }
    })

    this.serialPort.on('close', () => {
      if (!this.close) {
        this.log.error(getTsUs(), 'Serial port closed')
        this.close(true, 'Serial port closed')
      }
    })
  }

  static getValidDevices(): Promise<CanDevice[]> {
    return new Promise((r, j) => {
      const devices: CanDevice[] = []

      // Get available serial ports
      SerialPort.list()
        .then((ports) => {
          ports.forEach((port, index) => {
            // Check if this is a CANable device based on vendor and product IDs
            let isCanable = false
            let supportsCanFd = false

            if (
              parseInt(port.vendorId ?? '0', 16) === 0xad50 &&
              parseInt(port.productId ?? '0', 16) === 0x60c4
            ) {
              // CANable 1.0 or similar ST USB CDC device
              isCanable = true
              supportsCanFd = false
            } else if (
              parseInt(port.vendorId ?? '0', 16) === 0x16d0 &&
              parseInt(port.productId ?? '0', 16) === 0x117e
            ) {
              // CANable 2.0
              isCanable = true
              supportsCanFd = true
            }

            if (isCanable) {
              devices.push({
                label: `${port.path} (CANable${supportsCanFd ? ' 2.0' : ' 1.0'})`,
                id: port.path,
                handle: port.path,
                busy: false,
                serialNumber: port.serialNumber
              })
            }
          })
          r(devices)
        })
        .catch((err) => {
          j(err)
        })
    })
  }

  static getLibVersion(): string {
    return 'SLCAN v0.9'
  }
  private startReading(): void {
    if (!this.serialPort) return

    this.serialPort.on('data', (data: Buffer) => {
      this.rxBuffer = Buffer.concat([this.rxBuffer, data])
      this.processRxBuffer()
    })
  }

  private processRxBuffer(): void {
    while (this.rxBuffer.length > 0) {
      const crIndex = this.rxBuffer.indexOf('\r')
      if (crIndex === -1) break

      const line = this.rxBuffer.subarray(0, crIndex).toString('ascii')
      this.rxBuffer = this.rxBuffer.subarray(crIndex + 1)

      if (line.length > 0) {
        this.parseMessage(line)
      }
    }
  }

  private parseMessage(line: string): void {
    if (line.length < 4) return
    const command = line[0]
    // const data = line.slice(1)

    switch (command) {
      case 'T': // Standard CAN data frame
      case 't': // Standard CAN data frame
      case 'R': // Extended CAN remote frame
      case 'r': // Standard CAN remote frame
      case 'D': // Extended CANFD data frame
      case 'd': // Standard CANFD data frame
      case 'B': // Extended CANFD data frame with BRS
      case 'b': // Standard CANFD data frame with BRS
        this.parseCanMessage(line)
        break
      case 'z': // CANFD data frame (alternative format)
      case 'Z': // Extended CANFD data frame (alternative format)
        this.parseCanFdMessage(line)
        break
      case '7': // Error frame
        this.log.error(getTsUs(), 'CAN error frame received')
        break
      case 'A': // Acknowledgement
        // Handle ACK if needed
        break
      default:
        // Unknown command, ignore
        break
    }
  }

  private parseCanMessage(line: string): void {
    const command = line[0]
    const data = line.slice(1)

    // Parse ID
    let idLength = 3 // Standard ID
    let isExtended = false
    let isRemote = false
    let isCanFd = false
    let hasBrs = false

    if (command >= 'A' && command <= 'Z') {
      isExtended = true
      idLength = 8
    }

    if (command === 'r' || command === 'R') {
      isRemote = true
    }

    if (command === 'd' || command === 'D' || command === 'b' || command === 'B') {
      isCanFd = true
      if (command === 'b' || command === 'B') {
        hasBrs = true
      }
    }

    if (data.length < idLength + 1) {
      this.log.error(getTsUs(), `Data too short: ${data.length} expected: ${idLength + 1}`)
      return
    }

    const idHex = data.slice(0, idLength)
    const dlcHex = data.slice(idLength, idLength + 1)
    const dataHex = data.slice(idLength + 1)

    // Validate hex strings
    if (!/^[0-9A-Fa-f]+$/.test(idHex)) {
      this.log.error(getTsUs(), `Invalid ID hex: ${idHex}`)
      return
    }

    if (!/^[0-9A-Fa-f]+$/.test(dlcHex)) {
      this.log.error(getTsUs(), `Invalid DLC hex: ${dlcHex}`)
      return
    }

    if (!/^[0-9A-Fa-f]*$/.test(dataHex)) {
      this.log.error(getTsUs(), `Invalid data hex: ${dataHex}`)
      return
    }

    const canId = parseInt(idHex, 16)
    const dlc = parseInt(dlcHex, 16)

    // Validate parsed values
    if (isNaN(canId)) {
      this.log.error(getTsUs(), `Failed to parse CAN ID: ${idHex}`)
      return
    }

    if (isNaN(dlc)) {
      this.log.error(getTsUs(), `Failed to parse DLC: ${dlcHex}`)
      return
    }

    // Validate DLC range
    if (dlc > 0xf) {
      this.log.error(getTsUs(), `DLC out of range: ${dlc} (max 15)`)
      return
    }

    if (!isCanFd && dlc > 8) {
      this.log.error(getTsUs(), `Standard CAN DLC out of range: ${dlc} (max 8)`)
      return
    }

    // Convert DLC to actual length
    let dataLength = dlc
    if (isCanFd && dlc > 8) {
      switch (dlc) {
        case 0x9:
          dataLength = 12
          break
        case 0xa:
          dataLength = 16
          break
        case 0xb:
          dataLength = 20
          break
        case 0xc:
          dataLength = 24
          break
        case 0xd:
          dataLength = 32
          break
        case 0xe:
          dataLength = 48
          break
        case 0xf:
          dataLength = 64
          break
        default:
          this.log.error(getTsUs(), `Invalid CANFD DLC: ${dlc}`)
          return
      }
    }

    // Validate data length
    if (dataHex.length < dataLength * 2) {
      this.log.error(
        getTsUs(),
        `Data hex too short: ${dataHex.length} expected: ${dataLength * 2} for ${dataLength} bytes`
      )
      return
    }

    // Parse data bytes - each byte is represented by 2 hex characters
    const messageData = Buffer.alloc(dataLength)
    for (let i = 0; i < dataLength && i * 2 < dataHex.length; i++) {
      const byteHex = dataHex.slice(i * 2, i * 2 + 2)
      if (byteHex.length === 2) {
        const byteValue = parseInt(byteHex, 16)
        if (isNaN(byteValue)) {
          this.log.error(getTsUs(), `Failed to parse data byte ${i}: ${byteHex}`)
          return
        }
        messageData[i] = byteValue
      } else {
        this.log.error(getTsUs(), `Incomplete data byte ${i}: ${byteHex}`)
        return
      }
    }

    const ts = getTsUs()
    if (this.tsOffset === undefined) {
      this.tsOffset = ts - (getTsUs() - this.startTime)
    }
    const adjustedTs = ts - this.tsOffset

    const message: CanMessage = {
      dir: 'IN',
      id: canId,
      data: messageData,
      ts: adjustedTs,
      msgType: {
        idType: isExtended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
        canfd: isCanFd,
        brs: hasBrs,
        remote: isRemote
      },
      device: this.info.name,
      database: this.info.database
    }

    this.log.canBase(message)
    this.event.emit(this.getReadBaseId(canId, message.msgType), message)
  }

  private parseCanFdMessage(line: string): void {
    // Alternative CANFD format parsing
    // Implementation similar to parseCanMessage but for 'z'/'Z' format
    this.parseCanMessage(line)
  }

  close(isReset = false, msg?: string) {
    try {
      this.readAbort.abort()

      // Clear write queue
      this.writeQueue.kill()

      for (const [key, value] of this.rejectBaseMap) {
        value.reject(
          new CanError(
            isReset ? CAN_ERROR_ID.CAN_BUS_ERROR : CAN_ERROR_ID.CAN_BUS_CLOSED,
            value.msgType,
            undefined,
            msg
          )
        )
      }
      this.rejectBaseMap.clear()

      if (!isReset) {
        this.closed = true
        this.log.close()

        this.serialPort.write('C\r') // Close CAN port
        this.serialPort.flush()
        this.serialPort.close()

        this._close()
        this.event.emit('close', msg)
      }
    } catch (e) {
      // Ignore errors during close
    }
  }

  setOption(option: string, value: any): any {
    return this._setOption(option, value)
  }

  getReadId(addr: CanAddr): string {
    return `read-${addr.canIdTx}-${addr.canIdRx}-${addr.addrFormat}-${addr.addrType}`
  }

  readBase(
    id: number,
    msgType: CanMsgType,
    timeout: number
  ): Promise<{ data: Buffer; ts: number }> {
    return new Promise<{ data: Buffer; ts: number }>(
      (
        resolve: (value: { data: Buffer; ts: number }) => void,
        reject: (reason: CanError) => void
      ) => {
        const cmdId = this.getReadBaseId(id, msgType)
        const cnt = this.cnt
        this.cnt++
        this.rejectBaseMap.set(cnt, { reject, msgType })

        this.readAbort.signal.addEventListener('abort', () => {
          if (this.rejectBaseMap.has(cnt)) {
            this.rejectBaseMap.delete(cnt)
            reject(new CanError(CAN_ERROR_ID.CAN_BUS_CLOSED, msgType))
          }
          this.event.off(cmdId, readCb)
        })

        const readCb = (val: any) => {
          clearTimeout(timer)
          if (this.rejectBaseMap.has(cnt)) {
            if (val instanceof CanError) {
              reject(val)
            } else {
              resolve({ data: val.data, ts: val.ts })
            }
            this.rejectBaseMap.delete(cnt)
          }
        }
        const timer = setTimeout(() => {
          this.event.off(cmdId, readCb)
          if (this.rejectBaseMap.has(cnt)) {
            this.rejectBaseMap.delete(cnt)
            reject(new CanError(CAN_ERROR_ID.CAN_READ_TIMEOUT, msgType))
          }
        }, timeout)
        this.event.once(cmdId, readCb)
      }
    )
  }

  writeBase(
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    const cmdId = `writeBase-${id}-${this.msgTypeToNumber(msgType)}`

    if (msgType.canfd && data.length > 64) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data)
    }

    if (!msgType.canfd && data.length > 8) {
      throw new CanError(CAN_ERROR_ID.CAN_PARAM_ERROR, msgType, data)
    }

    return this._writeBase(id, msgType, cmdId, data, extra)
  }

  private _writeBase(
    id: number,
    msgType: CanMsgType,
    cmdId: string,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number> {
    return new Promise<number>(
      (resolve: (value: number) => void, reject: (reason: CanError) => void) => {
        // Add write operation to queue for serialized execution
        this.writeQueue.push({
          id,
          msgType,
          data,
          extra,
          resolve,
          reject
        })
      }
    )
  }

  private async processWriteOperation(operation: WriteOperation): Promise<void> {
    const { id, msgType, data, extra, resolve, reject } = operation

    try {
      const slcanMessage = this.formatSlcanMessage(id, msgType, data)

      // Write to serial port
      await new Promise<void>((writeResolve, writeReject) => {
        this.serialPort.write(slcanMessage + '\r', (err) => {
          if (err) {
            writeReject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data, err.message))
          } else {
            writeResolve()
          }
        })
      })

      // Wait for drain to complete
      await new Promise<void>((drainResolve, drainReject) => {
        this.serialPort.drain((err) => {
          if (err) {
            drainReject(new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data, err.message))
          } else {
            drainResolve()
          }
        })
      })

      if (this.info.slcanDelay) {
        await new Promise((resolve) => setTimeout(resolve, this.info.slcanDelay))
      }
      let ts = getTsUs()
      if (this.tsOffset == undefined) {
        this.tsOffset = ts - this.startTime
      }
      // Log and emit the message
      ts = ts - this.tsOffset
      const message: CanMessage = {
        dir: 'OUT',
        id: id,
        data: data,
        ts: ts,
        msgType: msgType
      }
      this.log.canBase(message)
      this.event.emit(this.getReadBaseId(id, message.msgType), message)

      resolve(ts)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      reject(
        error instanceof CanError
          ? error
          : new CanError(CAN_ERROR_ID.CAN_INTERNAL_ERROR, msgType, data, errorMessage)
      )
    }
  }

  private formatSlcanMessage(id: number, msgType: CanMsgType, data: Buffer): string {
    let command = 't' // Standard CAN data frame

    if (msgType.remote) {
      command = msgType.idType === CAN_ID_TYPE.EXTENDED ? 'R' : 'r'
    } else if (msgType.canfd) {
      if (msgType.brs) {
        command = msgType.idType === CAN_ID_TYPE.EXTENDED ? 'B' : 'b'
      } else {
        command = msgType.idType === CAN_ID_TYPE.EXTENDED ? 'D' : 'd'
      }
    } else {
      command = msgType.idType === CAN_ID_TYPE.EXTENDED ? 'T' : 't'
    }

    // Format ID
    const idHex =
      msgType.idType === CAN_ID_TYPE.EXTENDED
        ? id.toString(16).padStart(8, '0')
        : id.toString(16).padStart(3, '0')

    // Format DLC

    if (msgType.canfd && data.length > 8) {
      let maxLen = 64
      if (data.length > 8 && data.length <= 12) {
        maxLen = 12
      } else if (data.length > 12 && data.length <= 16) {
        maxLen = 16
      } else if (data.length > 16 && data.length <= 20) {
        maxLen = 20
      } else if (data.length > 20 && data.length <= 24) {
        maxLen = 24
      } else if (data.length > 24 && data.length <= 32) {
        maxLen = 32
      } else if (data.length > 32 && data.length <= 48) {
        maxLen = 48
      } else if (data.length > 48) {
        maxLen = 64
      } else {
        maxLen = data.length
      }
      data = Buffer.concat([data, Buffer.alloc(maxLen - data.length).fill(0)])
    }
    const dlc = getDlcByLen(data.length, msgType.canfd)

    const dlcHex = dlc.toString(16)

    // Format data
    const dataHex = Array.from(data)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')

    return command + idHex + dlcHex + dataHex
  }

  private msgTypeToNumber(msgType: CanMsgType): number {
    let result = 0
    if (msgType.idType === CAN_ID_TYPE.EXTENDED) {
      result |= 0x80000000
    }
    if (msgType.canfd) {
      result |= 0x40000000
    }
    if (msgType.brs) {
      result |= 0x20000000
    }
    if (msgType.remote) {
      result |= 0x10000000
    }
    return result
  }

  getReadBaseId(id: number, msgType: CanMsgType): string {
    const msgTypeNum = this.msgTypeToNumber(msgType)
    return `readBase-${id}-${msgTypeNum}`
  }
}
