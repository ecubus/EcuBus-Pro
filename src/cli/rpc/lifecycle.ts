import { startRpcServer, type RpcServerHandle } from './server'

export const DEFAULT_SIMULATE_RPC_HOST = '127.0.0.1'
export const DEFAULT_SIMULATE_RPC_PORT = 17320

export interface SimulateRpcStatus {
  enabled: boolean
  listening: boolean
  host: string
  port: number
  error?: string
  controllers: number
  projectSimulateCount: number
}

let handle: RpcServerHandle | undefined
let projectSimulateCount = 0
let enabled = true
let host = DEFAULT_SIMULATE_RPC_HOST
let port = DEFAULT_SIMULATE_RPC_PORT
let lastError: string | undefined
let opChain: Promise<void> = Promise.resolve()

/** Run bind/close steps one at a time so stop and start cannot overlap on the port. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = opChain.then(task, task)
  opChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function logInfo(msg: string) {
  if (typeof sysLog !== 'undefined') {
    sysLog.info(msg)
  }
}

function logError(msg: string) {
  if (typeof sysLog !== 'undefined') {
    sysLog.error(msg)
  }
}

export function getSimulateRpcStatus(): SimulateRpcStatus {
  return {
    enabled,
    listening: !!handle,
    host: handle?.host ?? host,
    port: handle?.port ?? port,
    error: lastError,
    controllers: handle?.service.listControllers().controllers.length ?? 0,
    projectSimulateCount
  }
}

export function configureSimulateRpc(opts: { host?: string; port?: number; enabled?: boolean }) {
  if (typeof opts.host === 'string' && opts.host) {
    host = opts.host
  }
  if (typeof opts.port === 'number' && opts.port > 0 && opts.port < 65536) {
    port = opts.port
  }
  if (typeof opts.enabled === 'boolean') {
    enabled = opts.enabled
  }
}

async function stopListening() {
  const current = handle
  handle = undefined
  if (!current) {
    return
  }
  try {
    await current.close()
  } catch {
    // ignore
  }
}

async function ensureListening() {
  if (handle || !enabled) {
    return
  }
  lastError = undefined
  try {
    handle = await startRpcServer({
      host,
      port,
      serviceOptions: {}
    })
    logInfo(`simulate json-rpc listening on tcp://${handle.host}:${handle.port}`)
  } catch (err) {
    handle = undefined
    const message = err instanceof Error ? err.message : String(err)
    lastError = `failed to bind ${host}:${port}: ${message}`
    logError(`simulate json-rpc ${lastError}`)
  }
}

/** Start TCP when the first project simulate device is open; stop when the last one closes. */
export function setProjectSimulateCount(count: number): Promise<SimulateRpcStatus> {
  const next = Math.max(0, count)
  return enqueue(async () => {
    projectSimulateCount = next
    if (projectSimulateCount > 0 && enabled) {
      await ensureListening()
    } else {
      await stopListening()
      lastError = undefined
    }
    return getSimulateRpcStatus()
  })
}

/** Inject an AUTOSAR controller error onto every Can.c controller open on the simulate bus. */
export function injectSimulateControllerError(params: {
  errorState: string
  txErrorCounter?: number
  rxErrorCounter?: number
}) {
  if (!handle) {
    throw new Error('Simulate JSON-RPC is not listening')
  }
  const controllers = handle.service.listControllers().controllers
  if (controllers.length === 0) {
    throw new Error('no Can.c simulate controller is open')
  }
  return controllers.map((controller) =>
    handle!.service.injectControllerError({
      controller: controller.controllerId,
      errorState: params.errorState,
      txErrorCounter: params.txErrorCounter,
      rxErrorCounter: params.rxErrorCounter
    })
  )
}

/** Rebind host/port. Only listens when a project simulate device is open and enabled. */
export function applySimulateRpcListen(opts?: {
  host?: string
  port?: number
  enabled?: boolean
}): Promise<SimulateRpcStatus> {
  return enqueue(async () => {
    if (opts) {
      configureSimulateRpc(opts)
    }
    await stopListening()
    lastError = undefined
    if (projectSimulateCount > 0 && enabled) {
      await ensureListening()
    }
    return getSimulateRpcStatus()
  })
}
