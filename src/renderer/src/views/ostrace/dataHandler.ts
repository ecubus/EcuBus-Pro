/*
  Offline data provider worker
  - Parses CSV lines into OsEvent
  - Builds TimelineChart rows/states per core/type/id
  - Responds to messages: loadCsv, getRowIds, getData
*/

import { OsEvent, TaskType, TaskStatus, IsrStatus, parseInfo } from 'nodeCan/osEvent'
import { TimelineChart } from './timeline/time-graph-model'

type CsvRow = Partial<OsEvent>

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

function parseCsv(content: string, cpuFreq: number): OsEvent[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const events: OsEvent[] = []
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw) continue
    const cols = raw.split(',')
    if (cols.length < 4) continue
    const ts = toNumberSafe(trimQuotes(cols[0]))
    const type = toNumberSafe(trimQuotes(cols[1])) as TaskType
    const id = toNumberSafe(trimQuotes(cols[2]))
    const status = toNumberSafe(trimQuotes(cols[3]))
    const evt: OsEvent = {
      type,
      id,
      status,
      coreId: 0,
      ts: convertTsToUs(ts, cpuFreq),
      comment: ''
    }
    events.push(evt)
  }
  return events.sort((a, b) => a.ts - b.ts)
}

function makeRowId(coreId: number, id: number, type: number): number {
  return Number(coreId) * 1000000 + Number(id) * 1000 + Number(type)
}

class OfflineDataProvider {
  private events: OsEvent[] = []
  private absoluteStart: bigint = BigInt(0)
  private totalLength: bigint = BigInt(0)
  private perActor: Map<number, OsEvent[]> = new Map()
  private actorNames: Map<number, string> = new Map()
  private coreConfigs: Array<{
    id: number
    name: string
    buttons: Array<{ name: string; color: string; id: string; numberId: number }>
  }> = []

  constructor() {}

  public buildIndexes() {
    this.perActor.clear()
    this.actorNames.clear()
    if (this.events.length === 0) {
      this.absoluteStart = BigInt(0)
      this.totalLength = BigInt(0)
      return
    }
    let minTs = this.events[0].ts
    let maxTs = this.events[0].ts
    for (const e of this.events) {
      if (e.type === TaskType.TASK || e.type == TaskType.ISR) {
        if (e.ts < minTs) minTs = e.ts
        if (e.ts > maxTs) maxTs = e.ts
        const rid = makeRowId(e.coreId, e.id, e.type)
        if (!this.perActor.has(rid)) this.perActor.set(rid, [])
        this.perActor.get(rid)!.push(e)
        if (!this.actorNames.has(rid)) {
          this.actorNames.set(rid, `${TaskType[e.type]}_${e.id}`)
        }
      }
    }
    // ensure each actor events are sorted
    for (const arr of this.perActor.values()) arr.sort((a, b) => a.ts - b.ts)

    this.absoluteStart = BigInt(minTs)
    this.totalLength = BigInt(maxTs) - this.absoluteStart
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

  getRowIds(): number[] {
    // If coreConfigs is provided, use it to determine the order

    const orderedRowIds: number[] = []
    // Collect rowIds in the order of coreConfigs
    for (const core of this.coreConfigs) {
      for (const button of core.buttons) {
        if (this.perActor.has(button.numberId)) {
          orderedRowIds.push(button.numberId)
        }
      }
    }
    return orderedRowIds
  }

  getTotalLength(): bigint {
    return this.totalLength
  }

  getData(opts: { range?: TimelineChart.TimeGraphRange; resolution?: number; rowIds?: number[] }): {
    rows: TimelineChart.TimeGraphRowModel[]
    range: TimelineChart.TimeGraphRange
    resolution: number
  } {
    const range =
      opts.range || ({ start: BigInt(0), end: this.totalLength } as TimelineChart.TimeGraphRange)
    const resolution = opts.resolution ?? Math.max(1, Number(this.totalLength) / 1000)
    const targetRowIds = (
      opts.rowIds && opts.rowIds.length ? opts.rowIds : this.getRowIds()
    ).filter((id) => this.perActor.has(id))

    const rows: TimelineChart.TimeGraphRowModel[] = []
    for (const rowId of targetRowIds) {
      const evts = this.perActor.get(rowId)!
      if (!evts || evts.length === 0) continue
      const firstTs = evts[0].ts
      const lastTs = evts[evts.length - 1].ts
      const name = this.actorNames.get(rowId) || `${rowId}`

      const states: TimelineChart.TimeGraphState[] = []
      let prevPossibleState = BigInt(0)
      let nextPossibleState = BigInt(lastTs) - this.absoluteStart

      for (let i = 0; i < evts.length; i++) {
        const cur = evts[i]
        const next = evts[i + 1]

        // For TASK: only create state when status is START and next event exists
        if (cur.type === TaskType.TASK) {
          if (cur.status !== TaskStatus.START || !next) continue
        }
        // For ISR: only create state when status is START and next event is STOP
        else if (cur.type === TaskType.ISR) {
          if (cur.status !== IsrStatus.START || !next || next.status !== IsrStatus.STOP) continue
        }
        // For other types, skip (or keep original logic if needed)
        else {
          continue
        }

        const start = BigInt(cur.ts) - this.absoluteStart
        const end = BigInt(next.ts) - this.absoluteStart

        // Filter by visible range and simple coarse resolution
        if (!(end > range.start && start < range.end)) continue
        if (Number(end - start) * (1 / resolution) <= 1) continue

        states.push({
          id: `${cur.coreId}_${cur.id}_${cur.type}_${cur.ts}`,
          label: parseInfo(cur.type, cur.status),
          range: { start, end },
          data: { ...cur, style: {} }
        } as unknown as TimelineChart.TimeGraphState)

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
        cpuFreq: number
        coreConfigs: Array<{
          id: number
          name: string
          buttons: Array<{ name: string; color: string; id: string; numberId: number }>
        }>
      }
    }
  | { type: 'getRowIds' }
  | {
      type: 'getData'
      payload: { range?: TimelineChart.TimeGraphRange; resolution?: number; rowIds?: number[] }
    }

type OutMsg =
  | { type: 'loaded'; payload: { rowIds: number[]; totalLength: bigint } }
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
      const evt: OsEvent = {
        type,
        id,
        status,
        coreId: 0,
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
  return events.sort((a, b) => a.ts - b.ts)
}

function filePathToFileURL(path: string): string {
  // Normalize Windows path to file URL
  if (path.startsWith('file://')) return path
  let p = path.replace(/\\/g, '/')
  if (!p.startsWith('/')) p = '/' + p
  return 'file://' + p
}

// @ts-ignore – worker global
self.onmessage = async (e: MessageEvent<InMsg>) => {
  try {
    const msg = e.data
    if (msg.type === 'loadCsv') {
      const { file, cpuFreq, coreConfigs } = msg.payload
      if (file && typeof file.stream === 'function') {
        console.log('cpuFreq', cpuFreq)
        const events = await parseCsvStream(file.stream(), cpuFreq)

        // build into provider
        ;(provider as any).events = events
        ;(provider as any).buildIndexes()
        // Set coreConfigs to ensure rowIds order matches graph buttons
        if (coreConfigs) {
          provider.setCoreConfigs(coreConfigs)
        }
      } else {
        throw new Error('loadCsv requires text, file, or filePath')
      }
      console.log('xxxxxxxxxxxx')
      respond({
        type: 'loaded',
        payload: { rowIds: provider.getRowIds(), totalLength: provider.getTotalLength() }
      })
      return
    }
    if (msg.type === 'getRowIds') {
      respond({ type: 'rowIds', payload: { rowIds: provider.getRowIds() } })
      return
    }
    if (msg.type === 'getData') {
      const { rows, range, resolution } = provider.getData(msg.payload)
      respond({ type: 'data', payload: { rows, range, resolution } })
      return
    }
  } catch (err: any) {
    respond({ type: 'error', payload: { message: err?.message || String(err) } })
  }
}
