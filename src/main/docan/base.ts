import EventEmitter from 'events'
import {
  addrToStr,
  CAN_ERROR_ID,
  CanAddr,
  CanBaseInfo,
  CanBitrate,
  CanDevice,
  CanError,
  CanMessage,
  CanMsgType,
  CAN_ID_TYPE
} from '../share/can'
import { CanLOG } from '../log'
import { cloneDeep } from 'lodash'
import { TesterInfo } from 'nodeCan/tester'

export abstract class CanBase {
  enableTesterPresent: Record<
    string,
    {
      enable: boolean
      addr: CanAddr
      tester: TesterInfo
      timeout: number
      timer?: NodeJS.Timeout
      action: () => Promise<void>
    }
  > = {}

  // Bus loading statistics
  private busLoadingStats = {
    startTime: 0,
    totalBits: 0,
    currentBits: 0,
    minLoading: 100,
    maxLoading: 0,
    avgLoading: 0,
    lastUpdate: 0,
    updateInterval: 1000 // Update stats every second
  }

  abstract info: CanBaseInfo
  abstract log: CanLOG
  abstract close(): void
  // abstract log: CanLOG
  abstract readBase(
    id: number,
    msgType: CanMsgType,
    timeout: number
  ): Promise<{ data: Buffer; ts: number }>
  abstract writeBase(
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    extra?: { database?: string; name?: string }
  ): Promise<number>
  abstract getReadBaseId(id: number, msgType: CanMsgType): string
  abstract setOption(cmd: string, val: any): any

  abstract event: EventEmitter
  static getValidDevices(): CanDevice[] {
    throw new Error('Method not implemented.')
  }
  static getLibVersion(): string {
    throw new Error('Method not implemented.')
  }
  static getDefaultBitrate(canfd: boolean): CanBitrate[] {
    return []
  }
  attachCanMessage(cb: (msg: CanMessage) => void) {
    this.event.on('can-frame', cb)
  }
  detachCanMessage(cb: (msg: CanMessage) => void) {
    this.event.off('can-frame', cb)
  }
  protected _close() {
    Object.values(this.enableTesterPresent).forEach((e) => {
      clearTimeout(e.timer)
    })
  }
  protected _setOption(cmd: string, val: any): any {
    if (cmd == 'testerPresent') {
      const id = addrToStr(val.addr)
      const present = this.enableTesterPresent[id]
      clearTimeout(present?.timer)
      const cval = cloneDeep(val)
      cval.enable = true
      this.enableTesterPresent[id] = cval
    } else if (cmd == 'startTesterPresent') {
      const id = addrToStr(val)
      const present = this.enableTesterPresent[id]
      if (present && present.enable && present.timer == undefined) {
        this.log.setOption(cmd, present.tester)
        present.timer = setTimeout(() => {
          present.timer = undefined
          present.action().finally(() => {
            this._setOption('startTesterPresent', val)
          })
        }, present.timeout)
      }
    } else if (cmd == 'stopTesterPresent') {
      const id = addrToStr(val)
      const present = this.enableTesterPresent[id]
      if (present) {
        clearTimeout(present.timer)
        present.timer = undefined
      }
    } else if (cmd == 'disableTesterPresent') {
      const id = addrToStr(val)
      const present = this.enableTesterPresent[id]
      if (present) {
        present.enable = false
        clearTimeout(present.timer)
      }
    } else if (cmd == 'enableTesterPresent') {
      const id = addrToStr(val)
      const present = this.enableTesterPresent[id]
      if (present) {
        present.enable = true
        present.action().finally(() => {
          this._setOption('startTesterPresent', val)
        })
      }
    } else if (cmd == 'getTesterPresent') {
      if (val) {
        const id = addrToStr(val)
        return this.enableTesterPresent[id]
      } else {
        return this.enableTesterPresent
      }
    }
  }
  updateBusLoadingWithFrame(msg: CanMessage) {
    // Calculate message bits
    const startBit = 1
    const crcDelimiter = 1
    const ackSlot = 1
    const ackDelimiter = 1
    const eof = 7
    const interFrameSpace = 3

    // Calculate arbitration field bits (always at arbitration rate)
    let arbitrationBits = 0
    if (msg.msgType.idType === CAN_ID_TYPE.STANDARD) {
      arbitrationBits = 11 // Standard ID
    } else {
      arbitrationBits = 29 // Extended ID
    }
    arbitrationBits += 1 // IDE bit
    arbitrationBits += 1 // RTR bit

    // Calculate control field bits (always at arbitration rate)
    let controlBits = 6 // DLC field (4 bits) + reserved bits (2 bits)
    if (msg.msgType.canfd) {
      controlBits += 2 // FDF and BRS bits
    }

    // Calculate data field bits (at data rate for CAN-FD)
    const dataBits = msg.data.length * 8

    // Calculate CRC field bits (at data rate for CAN-FD)
    let crcBits = 15 // Standard CAN CRC
    if (msg.msgType.canfd) {
      crcBits = 21 // CAN-FD CRC
    }

    // Calculate stuff bits (approximation)
    // Standard CAN: 1 stuff bit per 5 identical bits
    // CAN-FD: 1 stuff bit per 4 identical bits
    const stuffRatio = msg.msgType.canfd ? 4 : 5

    // Calculate total bits for arbitration phase (at arbitration rate)
    const arbitrationPhaseBits =
      startBit +
      arbitrationBits +
      controlBits +
      crcDelimiter +
      ackSlot +
      ackDelimiter +
      eof +
      interFrameSpace
    const arbitrationStuffBits = Math.floor(arbitrationPhaseBits / stuffRatio)
    const totalArbitrationBits = arbitrationPhaseBits + arbitrationStuffBits

    // Calculate total bits for data phase (at data rate for CAN-FD)
    let totalDataBits = 0
    if (msg.msgType.canfd) {
      const dataPhaseBits = dataBits + crcBits
      const dataStuffBits = Math.floor(dataPhaseBits / stuffRatio)
      totalDataBits = dataPhaseBits + dataStuffBits
    } else {
      const dataPhaseBits = dataBits + crcBits
      const dataStuffBits = Math.floor(dataPhaseBits / stuffRatio)
      totalDataBits = dataPhaseBits + dataStuffBits
    }

    // Update bus loading statistics
    const now = Date.now()
    if (this.busLoadingStats.startTime === 0) {
      this.busLoadingStats.startTime = now
    }

    // For CAN-FD, we need to account for different bitrates
    if (msg.msgType.canfd) {
      // Add arbitration phase bits at arbitration rate
      this.busLoadingStats.totalBits += totalArbitrationBits
      this.busLoadingStats.currentBits += totalArbitrationBits

      // Add data phase bits at data rate
      const dataRateMultiplier = this.info.bitrate.freq / this.info.bitrate.freq // Assuming same rate for now, adjust if needed
      this.busLoadingStats.totalBits += totalDataBits * dataRateMultiplier
      this.busLoadingStats.currentBits += totalDataBits * dataRateMultiplier
    } else {
      // For standard CAN, all bits are at the same rate
      const totalBits = totalArbitrationBits + totalDataBits
      this.busLoadingStats.totalBits += totalBits
      this.busLoadingStats.currentBits += totalBits
    }

    // Update statistics every second
    if (now - this.busLoadingStats.lastUpdate >= this.busLoadingStats.updateInterval) {
      const elapsedTime = (now - this.busLoadingStats.startTime) / 1000 // Convert to seconds
      const bitrate = this.info.bitrate.freq // Get the current bitrate
      const currentLoading = (this.busLoadingStats.currentBits / (bitrate * elapsedTime)) * 100

      // Update min/max
      this.busLoadingStats.minLoading = Math.min(this.busLoadingStats.minLoading, currentLoading)
      this.busLoadingStats.maxLoading = Math.max(this.busLoadingStats.maxLoading, currentLoading)

      // Update average
      this.busLoadingStats.avgLoading =
        (this.busLoadingStats.totalBits / (bitrate * elapsedTime)) * 100

      // Reset current bits for next interval
      this.busLoadingStats.currentBits = 0
      this.busLoadingStats.lastUpdate = now
    }
  }

  getBusLoading() {
    const now = Date.now()
    if (this.busLoadingStats.startTime === 0) {
      return {
        current: 0,
        average: 0,
        min: 0,
        max: 0
      }
    }

    const elapsedTime = (now - this.busLoadingStats.startTime) / 1000
    const bitrate = this.info.bitrate.freq

    // Calculate current loading
    const currentLoading = (this.busLoadingStats.currentBits / (bitrate * elapsedTime)) * 100

    return {
      current: Number(currentLoading.toFixed(2)),
      average: Number(this.busLoadingStats.avgLoading.toFixed(2)),
      min: Number(this.busLoadingStats.minLoading.toFixed(2)),
      max: Number(this.busLoadingStats.maxLoading.toFixed(2))
    }
  }
}

export class CAN_SOCKET {
  inst: CanBase
  msgType: CanMsgType
  closed = false
  id: number
  recvId: string
  tsOffset: number | null = null
  recvBuffer: ({ data: Buffer; ts: number } | CanError)[] = []
  recvTimer: NodeJS.Timeout | null = null
  cb: any
  pendingRecv: {
    resolve: (value: { data: Buffer; ts: number }) => void
    reject: (reason: CanError) => void
  } | null = null
  constructor(
    inst: CanBase,
    id: number,
    msgType: CanMsgType,
    private extra?: { database?: string; name?: string }
  ) {
    this.inst = inst
    this.msgType = msgType
    this.id = id
    this.recvId = this.inst.getReadBaseId(id, msgType)
    this.cb = this.recvHandle.bind(this)
    this.inst.event.on(this.recvId, this.cb)
  }
  getSystemTs() {
    const hrTime = process.hrtime()
    return hrTime[0] * 1000000 + Math.floor(hrTime[1] / 1000)
  }
  recvHandle(val: { data: Buffer; ts: number } | CanError) {
    // if(!(val instanceof CanError)){
    //   const ts=val.ts
    //   const systemTs=this.getSystemTs()
    //   if(this.tsOffset==null){
    //     this.tsOffset=systemTs-ts
    //   }else{
    //     //average
    //     this.tsOffset=Math.floor((this.tsOffset+(systemTs-ts))/2)
    //   }
    // }
    if (this.pendingRecv) {
      if (this.recvTimer) {
        clearTimeout(this.recvTimer)
        this.recvTimer = null
      }
      if (val instanceof CanError) {
        this.pendingRecv.reject(val)
      } else {
        this.pendingRecv.resolve(val)
      }
      this.pendingRecv = null
    } else {
      this.recvBuffer.push(val)
    }
  }
  error(id: CAN_ERROR_ID) {
    return new CanError(id, this.msgType)
  }
  async read(timeout: number): Promise<{ data: Buffer; ts: number }> {
    return new Promise((resolve, reject) => {
      if (this.closed) {
        reject(this.error(CAN_ERROR_ID.CAN_BUS_CLOSED))
        return
      }
      const val = this.recvBuffer.shift()
      if (val) {
        if (val instanceof CanError) {
          reject(val)
        } else {
          resolve(val)
        }
      } else {
        this.pendingRecv = { resolve, reject }
        this.recvTimer = setTimeout(() => {
          if (this.pendingRecv) {
            reject(this.error(CAN_ERROR_ID.CAN_READ_TIMEOUT))
            this.pendingRecv = null
          }
        }, timeout)
      }
    })
  }
  async write(data: Buffer): Promise<number> {
    if (this.closed) {
      throw this.error(CAN_ERROR_ID.CAN_BUS_CLOSED)
    }
    if (this.msgType.canfd) {
      if (this.inst.info.canfd == false) {
        throw this.error(CAN_ERROR_ID.CAN_PARAM_ERROR)
      }
    }
    const ts = await this.inst.writeBase(this.id, this.msgType, data, this.extra)
    // const systemTs=this.getSystemTs()
    // if(this.tsOffset==null){
    //   this.tsOffset=systemTs-ts
    // }else{
    //   //average
    //   this.tsOffset=Math.floor((this.tsOffset+(systemTs-ts))/2)
    // }
    return ts
  }
  close() {
    if (this.pendingRecv) {
      this.pendingRecv.reject(this.error(CAN_ERROR_ID.CAN_BUS_CLOSED))
      this.pendingRecv = null
    }
    this.inst.event.off(this.recvId, this.cb)
    this.closed = true
  }
}
