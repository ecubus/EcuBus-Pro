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
  CAN_ID_TYPE,
  getTsUs
} from '../share/can'
import { CanLOG } from '../log'
import { cloneDeep } from 'lodash'
import { TesterInfo } from 'nodeCan/tester'
import { NodeClass } from '../nodeItem'

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
  txPendingNode?: NodeClass
  // Bus loading statistics
  private busLoadingStats = {
    startTime: 0,
    totalBits: 0,
    lastBits: 0,
    minLoading: 100,
    maxLoading: 0,
    avgLoading: 0,
    // 帧统计
    sentFrames: 0,
    recvFrames: 0,
    lastSentFrames: 0,
    lastRecvFrames: 0
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
  static getValidDevices(): CanDevice[] | Promise<CanDevice[]> {
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
    this.detachCanMessage(this.busloadCb)
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
  protected busloadCb = this.updateBusLoadingWithFrame.bind(this)
  updateBusLoadingWithFrame(msg: CanMessage) {
    // 统计发送/接收帧
    if (msg.dir === 'OUT') {
      this.busLoadingStats.sentFrames++
    } else if (msg.dir === 'IN') {
      this.busLoadingStats.recvFrames++
    }

    // 计算不同阶段的位数量
    let arbitrationBits = 0 // 仲裁阶段的位数（使用仲裁比特率）
    let dataBits = 0 // 数据阶段的位数（CANFD可能使用数据比特率）

    // 仲裁段位数（SOF + ID + 控制字段起始部分）
    const sof = 1 // 起始帧位

    // ID字段计算
    if (msg.msgType.idType === CAN_ID_TYPE.STANDARD) {
      arbitrationBits += 11 // 标准ID (11位)
    } else {
      arbitrationBits += 29 // 扩展ID (29位)
    }

    // 控制字段计算
    arbitrationBits += 1 // RTR位
    arbitrationBits += 1 // IDE位
    if (msg.msgType.canfd) {
      arbitrationBits += 1 // FDF位
      arbitrationBits += 1 // RES位
    } else {
      arbitrationBits += 1 // r0位
    }

    // DLC字段（在仲裁阶段）
    arbitrationBits += 4 // DLC 4位

    // BRS位和ESI位（CANFD才有）
    if (msg.msgType.canfd) {
      arbitrationBits += 1 // BRS位
      arbitrationBits += 1 // ESI位
    }

    // 数据字段计算（可能使用数据比特率）
    dataBits += msg.data.length * 8

    // CRC字段计算（可能使用数据比特率）
    if (msg.msgType.canfd) {
      // CAN FD: 根据数据长度确定CRC位数
      if (msg.data.length <= 16) {
        dataBits += 17 // CAN FD CRC17
      } else {
        dataBits += 21 // CAN FD CRC21
      }
    } else {
      // 标准CAN: 15位CRC
      dataBits += 15 // 标准CAN CRC15
    }

    // 固定位段计算（使用仲裁比特率）
    let fixedBits = 0
    fixedBits += 1 // CRC界定符
    fixedBits += 1 // ACK槽
    fixedBits += 1 // ACK界定符
    fixedBits += 7 // 帧结束(EOF)
    fixedBits += 3 // 帧间间隔(IFS)

    // 位填充计算
    // 对仲裁段进行位填充（每5个连续相同位插入1个位）
    const arbitrationStuffBits = Math.floor(arbitrationBits / 5)

    // 对数据段进行位填充
    // CAN FD固定位填充：每4个位插入1个
    // 标准CAN：每5个连续相同位插入1个位
    const dataStuffRatio = msg.msgType.canfd ? 4 : 5
    const dataStuffBits = Math.floor(dataBits / dataStuffRatio)

    // 总位数计算（考虑不同的比特率）
    const totalArbitrationBits = sof + arbitrationBits + arbitrationStuffBits
    const totalDataBits = dataBits + dataStuffBits
    const totalFixedBits = fixedBits // 固定位不进行位填充

    if (msg.msgType.canfd && msg.msgType.brs) {
      // CANFD + BRS：仲裁段和固定段使用仲裁比特率，数据段使用数据比特率
      const arbitrationRate = this.info.bitrate.freq // 仲裁比特率

      // 获取数据比特率，如果没有bitratefd，则使用bitrate的4倍
      const dataRate = this.info.bitratefd ? this.info.bitratefd.freq : this.info.bitrate.freq * 4

      // 根据不同比特率换算成"标准比特率时间"
      const arbitrationTime = totalArbitrationBits / arbitrationRate
      const dataTime = totalDataBits / dataRate
      const fixedTime = totalFixedBits / arbitrationRate

      // 总共等效比特数（以仲裁比特率为基准）
      const equivalentBits = (arbitrationTime + dataTime + fixedTime) * arbitrationRate
      this.busLoadingStats.totalBits += equivalentBits
    } else {
      // 标准CAN或没有BRS的CANFD：所有位使用相同的比特率
      const totalBits = totalArbitrationBits + totalDataBits + totalFixedBits
      this.busLoadingStats.totalBits += totalBits
    }
  }

  getBusLoading(timeDiff: number) {
    const now = Date.now()

    // 获取当前时刻的总比特数和帧数
    const currentBits = this.busLoadingStats.totalBits
    const currentSentFrames = this.busLoadingStats.sentFrames
    const currentRecvFrames = this.busLoadingStats.recvFrames

    // 如果是第一次调用，初始化并返回零值
    if (this.busLoadingStats.startTime === 0) {
      this.busLoadingStats.startTime = now
      this.busLoadingStats.lastBits = currentBits
      this.busLoadingStats.lastSentFrames = currentSentFrames
      this.busLoadingStats.lastRecvFrames = currentRecvFrames

      return {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        frameSentFreq: 0,
        frameRecvFreq: 0,
        frameFreq: 0,
        sentCnt: this.busLoadingStats.sentFrames,
        recvCnt: this.busLoadingStats.recvFrames
      }
    }

    // 确保我们有有效的时间差
    if (timeDiff <= 0) {
      return {
        current: this.busLoadingStats.avgLoading,
        average: this.busLoadingStats.avgLoading,
        min: this.busLoadingStats.minLoading,
        max: this.busLoadingStats.maxLoading,
        frameSentFreq: 0,
        frameRecvFreq: 0,
        frameFreq: 0,
        sentCnt: this.busLoadingStats.sentFrames,
        recvCnt: this.busLoadingStats.recvFrames
      }
    }

    // 计算当前总线负载
    const bitsSinceLastCall = currentBits - this.busLoadingStats.lastBits
    const bitrate = this.info.bitrate.freq
    const timeDiffInSeconds = timeDiff / 1000
    const currentLoading = (bitsSinceLastCall / (bitrate * timeDiffInSeconds)) * 100

    // 计算帧频率
    const sentFramesSinceLastCall = currentSentFrames - this.busLoadingStats.lastSentFrames
    const recvFramesSinceLastCall = currentRecvFrames - this.busLoadingStats.lastRecvFrames

    const frameSentFreq = sentFramesSinceLastCall / timeDiffInSeconds
    const frameRecvFreq = recvFramesSinceLastCall / timeDiffInSeconds
    const frameFreq = frameSentFreq + frameRecvFreq

    // 更新最后的值，用于下次计算
    this.busLoadingStats.lastBits = currentBits
    this.busLoadingStats.lastSentFrames = currentSentFrames
    this.busLoadingStats.lastRecvFrames = currentRecvFrames

    // 更新平均负载（使用简单的移动平均）
    const avgWeight = 0.8 // 权重因子，决定新值的影响程度
    this.busLoadingStats.avgLoading =
      this.busLoadingStats.avgLoading * (1 - avgWeight) + currentLoading * avgWeight

    // 更新最大最小值
    this.busLoadingStats.minLoading = Math.max(
      0,
      Math.min(this.busLoadingStats.minLoading, currentLoading)
    )
    this.busLoadingStats.maxLoading = Math.min(
      100,
      Math.max(this.busLoadingStats.maxLoading, currentLoading)
    )

    // 限制返回值在0-100范围内并保留2位小数
    return {
      current: Number(Math.min(100, Math.max(0, currentLoading)).toFixed(2)),
      average: Number(Math.min(100, Math.max(0, this.busLoadingStats.avgLoading)).toFixed(2)),
      min: Number(this.busLoadingStats.minLoading.toFixed(2)),
      max: Number(this.busLoadingStats.maxLoading.toFixed(2)),
      frameSentFreq: Math.floor(frameSentFreq),
      frameRecvFreq: Math.floor(frameRecvFreq),
      frameFreq: Math.floor(frameFreq),
      sentCnt: this.busLoadingStats.sentFrames,
      recvCnt: this.busLoadingStats.recvFrames
    }
  }

  startPeriodSend?(message: CanMessage, period: number, duration?: number): string
  stopPeriodSend?(taskId: string): void
  changePeriodData?(taskId: string, data: Buffer): void
  resetStartTs?(): void
}

export class CAN_SOCKET {
  inst: CanBase
  msgType: CanMsgType
  closed = false
  id: number
  recvId: string
  recvBuffer: ({ data: Buffer; ts: number } | CanError)[] = []
  recvTimer: NodeJS.Timeout | null = null
  cb: any
  startPeriodSend?: (message: CanMessage, period: number, duration?: number) => string
  stopPeriodSend?: (taskId: string) => void
  changePeriodData?: (taskId: string, data: Buffer) => void
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
    this.startPeriodSend = inst.startPeriodSend?.bind(inst)
    this.stopPeriodSend = inst.stopPeriodSend?.bind(inst)
    this.changePeriodData = inst.changePeriodData?.bind(inst)
  }
  getSystemTs() {
    const hrTime = process.hrtime()
    return hrTime[0] * 1000000 + Math.floor(hrTime[1] / 1000)
  }
  recvHandle(val: { data: Buffer; ts: number } | CanError) {
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
    if (this.inst.txPendingNode) {
      const msg: CanMessage = {
        id: this.id,
        data: data,
        msgType: this.msgType,
        dir: 'OUT',
        database: this.extra?.database,
        name: this.extra?.name,
        device: this.inst.info.name
      }
      const cdata = await this.inst.txPendingNode.callTxPending(msg)
      if (cdata) {
        data = cdata
      } else {
        return getTsUs() - global.startTs
      }
    }
    const ts = await this.inst.writeBase(this.id, this.msgType, data, this.extra)

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
