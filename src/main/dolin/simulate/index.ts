import {
  LIN_ERROR_ID,
  LinBaseInfo,
  LinChecksumType,
  LinDevice,
  LinDirection,
  LinError,
  LinMode,
  LinMsg
} from '../../share/lin'
import { queue, QueueObject } from 'async'
import { LinLOG } from '../../log'
import EventEmitter from 'events'
import LinBase, { QueueItem } from '../base'
import { getTsUs } from '../../share/can'
import { cloneDeep } from 'lodash'

const vBusCount = 32

const vBusEvent: EventEmitter[] = []
for (let i = 0; i < vBusCount; i++) {
  vBusEvent.push(new EventEmitter())
}

const busInitStatus = new Array(vBusCount).fill(false)

/**
 * Entry table: stores configured LIN frame entries (like a real LIN slave response table)
 */
interface LinEntry {
  frameId: number
  length: number
  dir: LinDirection
  checksumType: LinChecksumType
  data: Buffer
  flag: number
}

export class SIMULATE_LIN extends LinBase {
  queue: QueueObject<QueueItem>
  event: EventEmitter
  info: LinBaseInfo
  log: LinLOG
  startTs: number
  private handle: number
  private boundOnBusFrame: (...args: any[]) => void = () => {}
  private entries = new Map<number, LinEntry>()
  private closed = false

  constructor(info: LinBaseInfo) {
    super(info)

    const handle = Number(info.device.handle)
    if (handle < 0 || handle >= vBusCount || isNaN(handle)) {
      throw new Error(`Invalid LIN bus handle: ${info.device.handle}`)
    }

    if (busInitStatus[handle]) {
      throw new Error('LIN BUS ALREADY INIT')
    }
    busInitStatus[handle] = true

    this.info = info
    this.handle = handle
    this.event = vBusEvent[handle]
    this.log = new LinLOG('SIMULATE', info.name, this.info.device.id, this.event)
    this.startTs = getTsUs()

    this.queue = queue((task: QueueItem, cb) => {
      if (task.discard) {
        cb()
      } else {
        this._write(task.data).then(task.resolve).catch(task.reject).finally(cb)
      }
    }, 1)

    // Listen for frames from other nodes on same bus
    this.boundOnBusFrame = this.onBusFrame.bind(this)
    this.event.on('lin-bus', this.boundOnBusFrame)
  }

  private onBusFrame(msg: LinMsg, senderHandle: number) {
    if (senderHandle === this.handle) return
    const clone = cloneDeep(msg)
    clone.direction = LinDirection.RECV
    clone.ts = getTsUs() - this.startTs
    this.log.linBase(clone)
    this.event.emit('lin-frame', clone)
  }

  static override getValidDevices(): LinDevice[] {
    return Array.from({ length: vBusCount }, (_, i) => ({
      handle: i,
      id: `SimulateLin-${i}`,
      label: `SimulateLin-${i}`,
      busy: false
    }))
  }

  static getLibVersion(): string {
    return '1.0.0'
  }

  setEntry(
    frameId: number,
    length: number,
    dir: LinDirection,
    checksumType: LinChecksumType,
    initData: Buffer,
    flag: number
  ): void {
    this.entries.set(frameId, {
      frameId,
      length,
      dir,
      checksumType,
      data: Buffer.from(initData),
      flag
    })
  }

  async _write(msg: LinMsg): Promise<number> {
    if (this.closed) {
      throw new LinError(LIN_ERROR_ID.LIN_BUS_CLOSED, msg)
    }

    const ts = getTsUs() - this.startTs
    const outMsg: LinMsg = {
      ...msg,
      direction: LinDirection.SEND,
      ts
    }

    // Log the sent frame
    this.log.linBase(outMsg)
    this.event.emit('lin-frame', cloneDeep(outMsg))

    // Broadcast to other nodes on the same virtual bus
    for (let i = 0; i < vBusCount; i++) {
      if (busInitStatus[i] && i !== this.handle) {
        vBusEvent[i].emit('lin-bus', cloneDeep(outMsg), this.handle)
      }
    }

    return ts
  }

  close(): void {
    this.closed = true
    this.event.off('lin-bus', this.boundOnBusFrame)
    this.queue.kill()
    this.log.close()
    busInitStatus[this.handle] = false
  }
}
