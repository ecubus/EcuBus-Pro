/*
  Offline data provider worker
  - Parses CSV lines into OsEvent
  - Builds TimelineChart rows/states per core/type/id
  - Responds to messages: loadCsv, getRowIds, getData
*/

import { OsEvent, TaskType, TaskStatus, IsrStatus, parseInfo, RunableStatus } from 'nodeCan/osEvent'
import { TimelineChart } from './timeline/time-graph-model'

let isRuntime = false
function toNumberSafe(v: any): number {
  if (v === undefined || v === null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function trimQuotes(s: string): string {
  if (s == null) return ''
  return s.replace(/^\s*"/, '').replace(/"\s*$/, '').trim()
}

function convertTsToUs(rawTs: number, cpuFreq: number): number {
  return Math.floor(rawTs / cpuFreq)
}

function makeRowId(coreId: number, id: number, type: number): number {
  return Number(coreId) * 1000000 + Number(id) * 1000 + Number(type)
}

class OfflineDataProvider {
  events: OsEvent[] = []
  rowids: number[] = []
  private absoluteStartNumber: number = 0
  private absoluteStart: bigint = BigInt(0)
  private totalLength: bigint = BigInt(0)
  perActor: Map<number, OsEvent[]> = new Map()
  private actorNames: Map<number, string> = new Map()
  currentTaskByCore: Map<number, { type: TaskType; id: number } | null> = new Map()
  private coreConfigs: Array<{
    id: number
    name: string
    buttons: Array<{ name: string; color: string; id: string; numberId: number }>
  }> = []
  private triggerConfig: {
    enabled: boolean
    type: TaskType | null
    coreId: number | null
    id: number | null
    status: number | null
  } = {
    enabled: false,
    type: null,
    coreId: null,
    id: null,
    status: null
  }

  constructor() {}

  /**
   * 更新每个core当前正在运行的任务
   */
  private updateCurrentTask(e: OsEvent) {
    if (e.type === TaskType.TASK) {
      if (e.status === TaskStatus.START) {
        // 任务开始，记录到当前core
        this.currentTaskByCore.set(e.coreId, { type: e.type, id: e.id })
      } else if (e.status === TaskStatus.TERMINATE) {
        // 任务结束，清除当前core的任务（如果匹配）
        const current = this.currentTaskByCore.get(e.coreId)
        if (current && current.type === e.type && current.id === e.id) {
          this.currentTaskByCore.set(e.coreId, null)
        }
      }
    }
  }

  public buildIndexes() {
    this.perActor.clear()
    this.actorNames.clear()
    this.currentTaskByCore.clear()
    this.buildRowIds()
    if (this.events.length === 0) {
      this.absoluteStart = BigInt(0)
      this.totalLength = BigInt(0)
      return
    }
    let minTs = this.events[0].ts
    let maxTs = this.events[0].ts
    for (const e of this.events) {
      // 更新每个core当前运行的任务
      this.updateCurrentTask(e)
      const rid = makeRowId(e.coreId, e.id, e.type)
      if (e.type === TaskType.TASK || e.type == TaskType.ISR) {
        if (e.ts < minTs) minTs = e.ts
        if (e.ts > maxTs) maxTs = e.ts

        if (!this.perActor.has(rid)) this.perActor.set(rid, [])
        this.perActor.get(rid)!.push(e)
        if (!this.actorNames.has(rid)) {
          this.actorNames.set(rid, `${TaskType[e.type]}_${e.id}`)
        }
      } else if (e.type === TaskType.RUNABLE) {
        const currentTask = this.currentTaskByCore.get(e.coreId)
        if (currentTask) {
          const lrid = makeRowId(e.coreId, currentTask.id, currentTask.type)
          const lastEvent = this.perActor.get(lrid)!.at(-1)!
          if (!lastEvent.children) {
            lastEvent.children = {}
          }
          if (!lastEvent.children[rid]) {
            lastEvent.children[rid] = []
          }
          lastEvent.children[rid].push(e)
        }
      }
    }

    this.absoluteStart = BigInt(minTs)
    this.totalLength = BigInt(maxTs) - this.absoluteStart
  }

  public appendEvents(newEvents: OsEvent[], cpuFreq: number) {
    if (newEvents.length === 0) return

    // In runtime mode, set absoluteStart to the first event's timestamp if it's the first batch
    if (isRuntime && this.events.length === 0 && newEvents.length > 0) {
      const firstTs = Math.floor(newEvents[0].ts / cpuFreq)
      this.absoluteStartNumber = firstTs
    }

    //handle ts
    for (const e of newEvents) {
      e.ts = Math.floor(e.ts / cpuFreq)
      // If runtime mode, subtract absoluteStart as offset
      if (isRuntime) {
        e.ts = e.ts - this.absoluteStartNumber
      }

      // 更新每个core当前运行的任务
      this.updateCurrentTask(e)
      this.events.push(e)

      // 检查新事件是否有触发，找到后立即发送消息
      if (this.triggerConfig.enabled) {
        if (this.checkTrigger(e)) {
          // 计算绝对时间

          // 立即发送触发时间消息
          respond({
            type: 'triggerTime',
            payload: { triggerTime: e.ts }
          })
        }
      }

      const rid = makeRowId(e.coreId, e.id, e.type)
      if (e.type === TaskType.TASK || e.type === TaskType.ISR) {
        if (!this.perActor.has(rid)) {
          this.perActor.set(rid, [])
          this.actorNames.set(rid, `${TaskType[e.type]}_${e.id}`)
        }
        this.perActor.get(rid)!.push(e)
      } else if (e.type === TaskType.RUNABLE) {
        const currentTask = this.currentTaskByCore.get(e.coreId)
        if (currentTask) {
          const lrid = makeRowId(e.coreId, currentTask.id, currentTask.type)
          const lastEvent = this.perActor.get(lrid)!.at(-1)!
          if (!lastEvent.children) {
            lastEvent.children = {}
          }
          if (!lastEvent.children[rid]) {
            lastEvent.children[rid] = []
          }
          lastEvent.children[rid].push(e)
        }
      }
    }

    // Limit to 100,000 events, remove oldest from front if exceeded
    const MAX_EVENTS = 100000
    if (this.events.length > MAX_EVENTS) {
      const removeCount = this.events.length - MAX_EVENTS
      const removedEvents = this.events.splice(0, removeCount)

      // Remove deleted events from perActor maps
      // Since timestamps are always increasing, removed events are at the front of each array
      const removedEventSet = new Set(removedEvents)
      for (const [rid, evts] of this.perActor.entries()) {
        // Find the first event that is not in removedEventSet
        let startIdx = evts.length // Default to length if all events are removed
        for (let i = 0; i < evts.length; i++) {
          if (!removedEventSet.has(evts[i])) {
            startIdx = i
            break
          }
        }
        // If all events are removed, delete the entry
        if (startIdx >= evts.length) {
          this.perActor.delete(rid)
        } else {
          // Keep all events from startIdx onwards
          this.perActor.set(rid, evts.slice(startIdx))
        }
      }
    } else {
      // Update totalLength: last event has the max timestamp since timestamps are always increasing
      const maxTs = newEvents[newEvents.length - 1].ts
      this.totalLength = BigInt(maxTs) - this.absoluteStart
    }
  }

  setCoreConfigs(
    coreConfigs: Array<{
      id: number
      name: string
      buttons: Array<{ name: string; color: string; id: string; numberId: number }>
    }>
  ) {
    this.coreConfigs = coreConfigs
  }

  buildRowIds() {
    // If coreConfigs is provided, use it to determine the order

    const orderedRowIds: number[] = []
    // Collect rowIds in the order of coreConfigs
    for (const core of this.coreConfigs) {
      for (const button of core.buttons) {
        orderedRowIds.push(button.numberId)
      }
    }
    this.rowids = orderedRowIds
  }

  getTotalLength(): bigint {
    return this.totalLength
  }

  getAbsoluteStart(): bigint {
    return this.absoluteStart
  }

  /**
   * Binary search to find the first event index where ts >= targetTs
   * Since ts is always increasing, we can use binary search
   */
  private binarySearchFirst(evts: OsEvent[], targetTs: number): number {
    let left = 0
    let right = evts.length - 1
    let result = evts.length

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      if (evts[mid].ts >= targetTs) {
        result = mid
        right = mid - 1
      } else {
        left = mid + 1
      }
    }

    return result
  }

  /**
   * Binary search to find the last event index where ts <= targetTs
   * Since ts is always increasing, we can use binary search
   */
  private binarySearchLast(evts: OsEvent[], targetTs: number): number {
    let left = 0
    let right = evts.length - 1
    let result = -1

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      if (evts[mid].ts <= targetTs) {
        result = mid
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    return result
  }

  setTriggerConfig(config: {
    enabled: boolean
    type: TaskType | null
    coreId: number | null
    id: number | null
    status: number | null
  }) {
    this.triggerConfig = config
  }

  checkTrigger(event: OsEvent): boolean {
    if (!this.triggerConfig.enabled) return false
    if (
      this.triggerConfig.type === null ||
      this.triggerConfig.coreId === null ||
      this.triggerConfig.id === null ||
      this.triggerConfig.status === null
    ) {
      return false
    }
    return (
      event.type === this.triggerConfig.type &&
      event.coreId === this.triggerConfig.coreId &&
      event.id === this.triggerConfig.id &&
      event.status === this.triggerConfig.status
    )
  }

  getData(opts: { range?: TimelineChart.TimeGraphRange; resolution?: number }): {
    rows: TimelineChart.TimeGraphRowModel[]
    range: TimelineChart.TimeGraphRange
    resolution: number
  } {
    const range =
      opts.range || ({ start: BigInt(0), end: this.totalLength } as TimelineChart.TimeGraphRange)
    const resolution = opts.resolution ?? Math.max(1, Number(this.totalLength) / 1000)

    // Convert range to absolute timestamps for binary search
    // In runtime mode, absoluteStart is the offset from absoluteStartNumber,
    // and events.ts are also offsets, so this calculation is correct
    const rangeStartTs = Number(this.absoluteStart + range.start)
    const rangeEndTs = Number(this.absoluteStart + range.end)

    const rows: TimelineChart.TimeGraphRowModel[] = []
    for (const rowId of this.rowids) {
      const evts = this.perActor.get(rowId)
      if (!evts || evts.length === 0) {
        // Create empty row for rowId that has no events, similar to reference implementation
        const name = this.actorNames.get(rowId) || `${rowId}`
        rows.push({
          id: rowId,
          name,
          range: {
            start: BigInt(0),
            end: BigInt(0)
          },
          data: { type: 'OFFLINE', hasStates: false },
          states: [],
          annotations: [],
          prevPossibleState: BigInt(0),
          nextPossibleState: this.totalLength
        })
        continue
      }
      const firstTs = evts[0].ts
      const lastTs = evts[evts.length - 1].ts
      const name = this.actorNames.get(rowId) || `${rowId}`

      // Use binary search to find the range of events to process
      const startIdx = this.binarySearchFirst(evts, rangeStartTs)
      const endIdx = this.binarySearchLast(evts, rangeEndTs)

      // If no events in range, skip this row
      if (startIdx >= evts.length || endIdx < 0 || startIdx > endIdx) {
        rows.push({
          id: rowId,
          name,
          range: {
            start: BigInt(0),
            end: BigInt(lastTs - firstTs)
          },
          data: { type: 'OFFLINE', hasStates: false },
          states: [],
          annotations: [],
          prevPossibleState: BigInt(0),
          nextPossibleState: BigInt(lastTs) - this.absoluteStart
        })
        continue
      }

      const states: TimelineChart.TimeGraphState[] = []
      let prevPossibleState = BigInt(0)
      let nextPossibleState = BigInt(lastTs) - this.absoluteStart

      // Only iterate through events in the range (need to check one before startIdx for states that span the range)
      const processStartIdx = Math.max(0, startIdx - 1)
      const processEndIdx = Math.min(evts.length - 1, endIdx + 1)

      for (let i = processStartIdx; i < processEndIdx; i++) {
        const cur = evts[i]
        const next = evts[i + 1]

        // For TASK: only create state when status is START and next event exists
        if (cur.type === TaskType.TASK) {
          if (cur.status == TaskStatus.TERMINATE || !next) {
            continue
          }
        }
        // For ISR: only create state when status is START and next event is STOP
        else if (cur.type === TaskType.ISR) {
          if (cur.status !== IsrStatus.START || !next || next.status !== IsrStatus.STOP) continue
        }
        // For other types, skip (or keep original logic if needed)
        else {
          continue
        }

        // Calculate state start/end relative to absoluteStart
        // In runtime mode, both cur.ts and this.absoluteStart are offsets from absoluteStartNumber,
        // so the subtraction gives the correct relative position
        const start = BigInt(cur.ts) - this.absoluteStart
        const end = BigInt(next.ts) - this.absoluteStart

        // Filter by visible range and simple coarse resolution
        if (!(end > range.start && start < range.end)) continue
        if (Number(end - start) * (1 / resolution) <= 1) continue

        const durationUs = Number(end - start)
        let durationLabel: string | undefined = undefined

        if (cur.type === TaskType.TASK && cur.status != TaskStatus.START) {
          durationLabel = undefined
        } else {
          durationLabel =
            durationUs >= 1000 ? `${(durationUs / 1000).toFixed(1)}ms` : `${durationUs}us`
        }

        states.push({
          id: `${cur.coreId}_${cur.id}_${cur.type}_${cur.ts}`,
          label: durationLabel,
          range: { start, end },
          data: { cur, next, style: {} }
        } as unknown as TimelineChart.TimeGraphState)

        if (cur.children) {
          for (const children of Object.values(cur.children)) {
            for (let i = 0; i < children.length; i++) {
              const curChild = children[i]
              const nextChild = children[i + 1]
              if (!nextChild) {
                continue
              }
              const start = BigInt(curChild.ts) - this.absoluteStart
              const end = BigInt(nextChild.ts) - this.absoluteStart
              states.push({
                id: `${curChild.coreId}_${curChild.id}_${curChild.type}_${curChild.ts}`,
                range: { start, end },
                data: { cur: curChild, next: nextChild, style: {} }
              } as unknown as TimelineChart.TimeGraphState)
            }
          }
        }

        if (i === 0) prevPossibleState = start
        if (i === evts.length - 1) nextPossibleState = end
      }

      rows.push({
        id: rowId,
        name,
        range: {
          start: BigInt(0),
          end: BigInt(lastTs - firstTs)
        },
        data: { type: 'OFFLINE', hasStates: states.length > 0 },
        states,
        annotations: [],
        prevPossibleState,
        nextPossibleState
      })
    }

    return { rows, range, resolution }
  }
}

const provider = new OfflineDataProvider()

type InMsg =
  | {
      type: 'loadCsv'
      payload: {
        file: File
        database: string
        cpuFreq: number
        coreConfigs: Array<{
          id: number
          name: string
          buttons: Array<{ name: string; color: string; id: string; numberId: number }>
        }>
      }
    }
  | {
      type: 'getRowIds'
      payload: {
        coreConfigs: Array<{
          id: number
          name: string
          buttons: Array<{ name: string; color: string; id: string; numberId: number }>
        }>
      }
    }
  | {
      type: 'getData'
      payload: { range?: TimelineChart.TimeGraphRange; resolution?: number }
    }
  | {
      type: 'findState'
      payload: {
        direction: 'left' | 'right'
        rowId: number
        cursor?: bigint
      }
    }
  | {
      type: 'updateEvents'
      payload: {
        cpuFreq: number
        events: OsEvent[]
      }
    }
  | {
      type: 'setTriggerConfig'
      payload: {
        enabled: boolean
        type: TaskType | null
        coreId: number | null
        id: number | null
        status: number | null
      }
    }

type OutMsg =
  | {
      type: 'loaded'
      payload: {
        rowIds: number[]
        start: bigint
        totalLength: bigint
        events: {
          message: {
            ts: number
            data: OsEvent
          }
        }[]
      }
    }
  | { type: 'rowIds'; payload: { rowIds: number[] } }
  | {
      type: 'data'
      payload: {
        rows: TimelineChart.TimeGraphRowModel[]
        range: TimelineChart.TimeGraphRange
        resolution: number
      }
    }
  | { type: 'error'; payload: { message: string } }
  | {
      type: 'triggerTime'
      payload: { triggerTime: number }
    }
  | {
      type: 'foundState'
      payload: { id?: string; start?: bigint; event?: OsEvent }
    }
  | {
      type: 'updated'
      payload: {
        start: bigint
        totalLength: bigint
      }
    }

function respond(msg: OutMsg) {
  // @ts-ignore – worker global
  postMessage(msg)
}

async function parseCsvStream(
  stream: ReadableStream<Uint8Array>,
  cpuFreq: number
): Promise<OsEvent[]> {
  const decoder = new TextDecoder()
  const reader = stream.getReader()
  const { value, done } = await reader.read()
  if (done || !value) return []
  let buffer = decoder.decode(value, { stream: true })

  const events: OsEvent[] = []

  const flushLines = (chunk: string, final = false) => {
    const parts = chunk.split(/\r?\n/)
    const lines = final ? parts : parts.slice(0, -1)
    buffer = final ? '' : parts[parts.length - 1]
    for (const line of lines) {
      // headerless: parse all lines as data
      if (!line.trim()) continue
      const cols = line.split(',')
      if (cols.length < 4) continue
      const ts = toNumberSafe(trimQuotes(cols[0]))
      const type = toNumberSafe(trimQuotes(cols[1])) as TaskType
      const id = toNumberSafe(trimQuotes(cols[2]))
      const status = toNumberSafe(trimQuotes(cols[3]))
      const coreId = toNumberSafe(trimQuotes(cols[4]))
      const evt: OsEvent = {
        type,
        id,
        status,
        coreId,
        ts: convertTsToUs(ts, cpuFreq),
        comment: ''
      }
      events.push(evt)
    }
  }

  flushLines(buffer)
  let readerDone = false
  while (!readerDone) {
    const res = await reader.read()
    readerDone = !!res.done
    if (readerDone) break
    buffer += decoder.decode(res.value, { stream: true })
    flushLines(buffer)
  }
  if (buffer.length) flushLines(buffer, true)
  return events
}

// @ts-ignore – worker global
self.onmessage = async (e: MessageEvent<InMsg>) => {
  try {
    const msg = e.data
    if (msg.type === 'loadCsv') {
      isRuntime = false
      const { file, cpuFreq, coreConfigs, database } = msg.payload
      let events: OsEvent[] = []
      if (file && typeof file.stream === 'function') {
        events = await parseCsvStream(file.stream(), cpuFreq)

        // build into provider
        provider.events = events

        // Set coreConfigs to ensure rowIds order matches graph buttons
        if (coreConfigs) {
          provider.setCoreConfigs(coreConfigs)
        }
        provider.buildIndexes()
      } else {
        throw new Error('loadCsv requires text, file, or filePath')
      }

      respond({
        type: 'loaded',
        payload: {
          rowIds: provider.rowids,
          totalLength: provider.getTotalLength(),
          start: provider.getAbsoluteStart(),
          events: events.map((event, index) => ({
            message: {
              ts: event.ts,
              data: {
                ...event,
                ts: event.ts * cpuFreq,
                database: database,
                index: index
              }
            }
          }))
        }
      })
      return
    }
    if (msg.type === 'getRowIds') {
      //reset
      isRuntime = true

      provider.events = []
      provider.setCoreConfigs(msg.payload.coreConfigs)
      provider.buildIndexes()
      respond({ type: 'rowIds', payload: { rowIds: provider.rowids } })
      return
    }
    if (msg.type === 'getData') {
      const { rows, range, resolution } = provider.getData(msg.payload)
      respond({ type: 'data', payload: { rows, range, resolution } })
      return
    }
    if (msg.type === 'findState') {
      const { direction, rowId, cursor } = msg.payload
      const evts = provider.perActor.get(rowId) as OsEvent[] | undefined
      if (!evts || evts.length === 0) {
        respond({ type: 'foundState', payload: {} })
        return
      }
      const absoluteStart = provider.getAbsoluteStart()
      // Build START markers only (TASK START, ISR START)
      const starts: { id: string; start: bigint; event: OsEvent }[] = []
      for (let i = 0; i < evts.length; i++) {
        const cur = evts[i]
        if (cur.type === TaskType.TASK) {
          if (cur.status !== TaskStatus.START) continue
        } else if (cur.type === TaskType.ISR) {
          if (cur.status !== IsrStatus.START) continue
        } else {
          continue
        }
        const start = BigInt(cur.ts) - absoluteStart
        const id = `${cur.coreId}_${cur.id}_${cur.type}_${cur.ts}`
        starts.push({ id, start, event: cur })
      }
      if (starts.length === 0) {
        respond({ type: 'foundState', payload: {} })
        return
      }
      const curPos =
        cursor !== undefined
          ? cursor
          : direction === 'left'
            ? starts[starts.length - 1].start
            : starts[0].start
      let found: { id: string; start: bigint; event: OsEvent } | undefined
      if (direction === 'left') {
        for (let i = starts.length - 1; i >= 0; i--) {
          const s = starts[i]
          if (s.start < curPos) {
            found = s
            break
          }
        }
        // if none strictly less, fall back to first start
        if (!found) found = starts[0]
      } else {
        for (let i = 0; i < starts.length; i++) {
          const s = starts[i]
          if (s.start > curPos) {
            found = s
            break
          }
        }
        // if none greater, fall back to last start
        if (!found) found = starts[starts.length - 1]
      }
      if (found) {
        // Find next event after found event
        let nextEvent: OsEvent | undefined
        const foundIndex = evts.findIndex(
          (e) =>
            e.ts === found.event.ts &&
            e.coreId === found.event.coreId &&
            e.id === found.event.id &&
            e.type === found.event.type
        )
        if (foundIndex >= 0 && foundIndex < evts.length - 1) {
          nextEvent = evts[foundIndex + 1]
        }
        respond({
          type: 'foundState',
          payload: {
            id: found.id,
            start: found.start,
            event: found.event,
            nextEvent: nextEvent
          } as any
        })
      } else {
        respond({ type: 'foundState', payload: {} })
      }
      return
    }
    if (msg.type === 'updateEvents') {
      const { events, cpuFreq } = msg.payload
      provider.appendEvents(events, cpuFreq)
      // respond({
      //   type: 'updated',
      //   payload: {
      //     totalLength: provider.getTotalLength(),
      //     start: provider.getAbsoluteStart()
      //   }
      // })
      return
    }
    if (msg.type === 'setTriggerConfig') {
      provider.setTriggerConfig(msg.payload)
      return
    }
  } catch (err: any) {
    console.error('onmessage error', err)
    respond({ type: 'error', payload: { message: err?.message || String(err) } })
  }
}
