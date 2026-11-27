import crypto from 'crypto'
import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'

export const PROTOCOL_SCHEME = 'ecubuspro'
export const PROTOCOL_REGEXP = new RegExp(`^${PROTOCOL_SCHEME}://`, 'i')

const INSTANCES_DIR_NAME = 'instances'
const SESSIONS_DIR_NAME = 'sessions'
const FRESH_EMPTY_RECORD_GRACE_MS = 2000

export interface InstanceRecord {
  pid: number
  slot: number
  pipePath: string
  startedAt: number
}

export interface ProtocolForwardRequest {
  type: 'protocol-url'
  url: string
  state?: string
  matchStateOnly: boolean
}

export interface ProtocolForwardResponse {
  handled: boolean
}

export type ProtocolUrlHandler = (request: ProtocolForwardRequest) => boolean | Promise<boolean>

export interface InstanceSession {
  record: InstanceRecord
  sessionDataPath?: string
  server: net.Server
  dispose: () => void
}

export function extractProtocolUrl(argv: readonly string[]): string | undefined {
  for (let i = 1; i < argv.length; i++) {
    const raw = argv[i]?.trim()
    if (!raw) continue
    const unquoted = raw.replace(/^["']|["']$/g, '')
    if (PROTOCOL_REGEXP.test(unquoted)) {
      return unquoted
    }
  }
  return undefined
}

export function extractAuthState(protocolUrl: string): string | undefined {
  try {
    const parsed = new URL(protocolUrl)
    return parsed.searchParams.get('state') || undefined
  } catch {
    return undefined
  }
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false
  }
  try {
    process.kill(pid, 0)
    return true
  } catch (err: any) {
    return err?.code === 'EPERM'
  }
}

export function getInstancesDir(baseDir: string): string {
  return path.join(baseDir, INSTANCES_DIR_NAME)
}

export function getRecordPath(baseDir: string, slot: number): string {
  return path.join(getInstancesDir(baseDir), `slot-${slot}.json`)
}

export function getPipePath(baseDir: string, slot: number): string {
  const hash = crypto.createHash('sha256').update(path.resolve(baseDir)).digest('hex').slice(0, 12)
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\ecubuspro-inst-${hash}-${slot}`
  }
  return path.join(os.tmpdir(), `ecubuspro-inst-${hash}-${slot}.sock`)
}

export function getSessionDataPath(baseDir: string, slot: number): string | undefined {
  if (slot <= 0) {
    return undefined
  }
  return path.join(baseDir, SESSIONS_DIR_NAME, `inst-${slot}`)
}

function safeUnlink(filePath: string): void {
  try {
    fs.unlinkSync(filePath)
  } catch {
    // Ignore missing or already-removed files
  }
}

function cleanupStaleSocket(pipePath: string): void {
  if (process.platform !== 'win32') {
    safeUnlink(pipePath)
  }
}

function readRecordFile(recordPath: string): {
  status: 'valid' | 'fresh-empty' | 'invalid'
  record?: InstanceRecord
} {
  try {
    const raw = fs.readFileSync(recordPath, 'utf-8').trim()
    if (!raw) {
      const stat = fs.statSync(recordPath)
      if (Date.now() - stat.mtimeMs < FRESH_EMPTY_RECORD_GRACE_MS) {
        return { status: 'fresh-empty' }
      }
      return { status: 'invalid' }
    }
    const parsed = JSON.parse(raw) as Partial<InstanceRecord>
    if (
      typeof parsed.pid === 'number' &&
      typeof parsed.slot === 'number' &&
      typeof parsed.pipePath === 'string' &&
      typeof parsed.startedAt === 'number'
    ) {
      return {
        status: 'valid',
        record: parsed as InstanceRecord
      }
    }
    return { status: 'invalid' }
  } catch {
    return { status: 'invalid' }
  }
}

function tryWriteExclusiveRecord(recordPath: string, record: InstanceRecord): boolean {
  let fd: number | undefined
  try {
    fd = fs.openSync(recordPath, 'wx')
    fs.writeFileSync(fd, JSON.stringify(record), 'utf-8')
    return true
  } catch (err: any) {
    if (err?.code === 'EEXIST') {
      return false
    }
    throw err
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd)
      } catch {
        // Ignore close error
      }
    }
  }
}

export function acquireInstanceSlot(
  baseDir: string,
  options?: {
    maxSlots?: number
    pid?: number
    isAlive?: (pid: number) => boolean
  }
): InstanceRecord {
  const maxSlots = options?.maxSlots ?? 64
  const pid = options?.pid ?? process.pid
  const checkAlive = options?.isAlive ?? isProcessAlive
  const instancesDir = getInstancesDir(baseDir)
  fs.mkdirSync(instancesDir, { recursive: true })

  for (let slot = 0; slot < maxSlots; slot++) {
    const recordPath = getRecordPath(baseDir, slot)
    const pipePath = getPipePath(baseDir, slot)
    const record: InstanceRecord = {
      pid,
      slot,
      pipePath,
      startedAt: Date.now()
    }

    if (tryWriteExclusiveRecord(recordPath, record)) {
      return record
    }

    const existing = readRecordFile(recordPath)
    if (existing.status === 'fresh-empty') {
      continue
    }
    if (existing.status === 'valid' && existing.record && checkAlive(existing.record.pid)) {
      continue
    }

    // Stale or corrupt lockfile from an exited/crashed instance
    safeUnlink(recordPath)
    cleanupStaleSocket(existing.record?.pipePath || pipePath)

    if (tryWriteExclusiveRecord(recordPath, record)) {
      return record
    }
  }

  // Fallback if all bounded slots are occupied
  const fallbackSlot = pid
  const fallbackRecord: InstanceRecord = {
    pid,
    slot: fallbackSlot,
    pipePath: getPipePath(baseDir, fallbackSlot),
    startedAt: Date.now()
  }
  const fallbackPath = getRecordPath(baseDir, fallbackSlot)
  try {
    fs.writeFileSync(fallbackPath, JSON.stringify(fallbackRecord), 'utf-8')
  } catch {
    // Best-effort registration
  }
  return fallbackRecord
}

export function releaseInstanceSlot(baseDir: string, record: InstanceRecord): void {
  const recordPath = getRecordPath(baseDir, record.slot)
  const existing = readRecordFile(recordPath)
  if (existing.status === 'valid' && existing.record && existing.record.pid !== record.pid) {
    return
  }
  safeUnlink(recordPath)
  cleanupStaleSocket(record.pipePath)
}

export function listLiveInstances(
  baseDir: string,
  options?: {
    excludePid?: number
    isAlive?: (pid: number) => boolean
  }
): InstanceRecord[] {
  const instancesDir = getInstancesDir(baseDir)
  const checkAlive = options?.isAlive ?? isProcessAlive
  let entries: string[]
  try {
    entries = fs.readdirSync(instancesDir)
  } catch {
    return []
  }

  const live: InstanceRecord[] = []
  for (const entry of entries) {
    if (!/^slot-\d+\.json$/.test(entry)) continue
    const recordPath = path.join(instancesDir, entry)
    const existing = readRecordFile(recordPath)
    if (existing.status === 'fresh-empty') {
      continue
    }
    if (existing.status !== 'valid' || !existing.record) {
      safeUnlink(recordPath)
      continue
    }
    if (!checkAlive(existing.record.pid)) {
      safeUnlink(recordPath)
      cleanupStaleSocket(existing.record.pipePath)
      continue
    }
    if (options?.excludePid !== undefined && existing.record.pid === options.excludePid) {
      continue
    }
    live.push(existing.record)
  }

  // Prefer the most recently started instance when falling back without a matching state
  live.sort((a, b) => b.startedAt - a.startedAt || a.slot - b.slot)
  return live
}

export function startInstanceIpcServer(
  record: InstanceRecord,
  onProtocolUrl: ProtocolUrlHandler
): net.Server {
  cleanupStaleSocket(record.pipePath)

  const server = net.createServer((socket) => {
    let buffer = ''
    let handledRequest = false

    const handleLine = async (line: string) => {
      if (handledRequest) return
      handledRequest = true
      let response: ProtocolForwardResponse = { handled: false }
      try {
        const req = JSON.parse(line) as ProtocolForwardRequest
        if (req && req.type === 'protocol-url' && typeof req.url === 'string') {
          const handled = await onProtocolUrl(req)
          response = { handled: Boolean(handled) }
        }
      } catch {
        response = { handled: false }
      }
      try {
        if (!socket.destroyed) {
          socket.end(JSON.stringify(response) + '\n')
        }
      } catch {
        // Ignore socket write error
      }
    }

    socket.on('data', (chunk) => {
      if (handledRequest) return
      buffer += chunk.toString('utf-8')
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        void handleLine(line)
      }
    })

    socket.on('end', () => {
      if (!handledRequest && buffer.trim()) {
        void handleLine(buffer.trim())
      }
    })

    socket.on('error', () => {
      // Ignore client disconnect errors
    })
  })

  server.on('error', () => {
    // Best-effort IPC server; never crash app startup if pipe bind fails
  })

  server.listen(record.pipePath)
  server.unref()
  return server
}

function sendProtocolRequest(
  pipePath: string,
  request: ProtocolForwardRequest,
  timeoutMs = 1500
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        socket.destroy()
      } catch {
        // Ignore
      }
      resolve(value)
    }

    const socket = net.createConnection(pipePath)
    const timer = setTimeout(() => finish(false), timeoutMs)
    let buffer = ''

    socket.on('connect', () => {
      try {
        socket.write(JSON.stringify(request) + '\n')
      } catch {
        finish(false)
      }
    })

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf-8')
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        try {
          const parsed = JSON.parse(line) as Partial<ProtocolForwardResponse>
          finish(Boolean(parsed.handled))
        } catch {
          finish(false)
        }
      }
    })

    socket.on('end', () => {
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim()) as Partial<ProtocolForwardResponse>
          finish(Boolean(parsed.handled))
          return
        } catch {
          // fall through
        }
      }
      finish(false)
    })

    socket.on('error', () => finish(false))
  })
}

export async function forwardProtocolUrl(
  baseDir: string,
  protocolUrl: string,
  options?: {
    excludePid?: number
    matchStateOnly?: boolean
    timeoutMs?: number
    isAlive?: (pid: number) => boolean
  }
): Promise<boolean> {
  const instances = listLiveInstances(baseDir, {
    excludePid: options?.excludePid,
    isAlive: options?.isAlive
  })
  if (instances.length === 0) {
    return false
  }

  const state = extractAuthState(protocolUrl)
  const timeoutMs = options?.timeoutMs ?? 1500

  // Pass 1: route specifically to the instance that initiated this OAuth state
  if (state) {
    const targetedResults = await Promise.all(
      instances.map((inst) =>
        sendProtocolRequest(
          inst.pipePath,
          {
            type: 'protocol-url',
            url: protocolUrl,
            state,
            matchStateOnly: true
          },
          timeoutMs
        )
      )
    )
    if (targetedResults.some(Boolean)) {
      return true
    }
  }

  if (options?.matchStateOnly) {
    return false
  }

  // Pass 2: fallback sequentially so at most one running instance handles it
  for (const inst of instances) {
    const handled = await sendProtocolRequest(
      inst.pipePath,
      {
        type: 'protocol-url',
        url: protocolUrl,
        state,
        matchStateOnly: false
      },
      timeoutMs
    )
    if (handled) {
      return true
    }
  }

  return false
}

export function createInstanceSession(
  baseDir: string,
  onProtocolUrl: ProtocolUrlHandler,
  options?: {
    maxSlots?: number
    pid?: number
    isAlive?: (pid: number) => boolean
  }
): InstanceSession {
  const record = acquireInstanceSlot(baseDir, options)
  const sessionDataPath = getSessionDataPath(baseDir, record.slot)
  const server = startInstanceIpcServer(record, onProtocolUrl)
  let disposed = false

  const dispose = () => {
    if (disposed) return
    disposed = true
    try {
      server.close()
    } catch {
      // Ignore close error
    }
    releaseInstanceSlot(baseDir, record)
  }

  return {
    record,
    sessionDataPath,
    server,
    dispose
  }
}
