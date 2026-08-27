import { ipcMain } from 'electron'
import { startRpcServer, type RpcServerHandle } from 'src/cli/rpc/server'
import type { CanBase } from 'src/main/docan/base'
import { store } from './store'

export const DEFAULT_RPC_HOST = '127.0.0.1'
export const DEFAULT_RPC_PORT = 17320

export interface RpcHostStatus {
  enabled: boolean
  listening: boolean
  host: string
  port: number
  error?: string
  controllers: number
}

interface GeneralRpcSettings {
  rpcEnabled?: boolean
  rpcHost?: string
  rpcPort?: number
}

let handle: RpcServerHandle | undefined
let liveMap: Map<string, CanBase> | undefined
let lastError: string | undefined
let ipcRegistered = false

function readSettings(raw?: GeneralRpcSettings): {
  enabled: boolean
  host: string
  port: number
} {
  const general = raw ?? ((store.get('general.settings') as GeneralRpcSettings | undefined) || {})
  const port = Number(general.rpcPort)
  return {
    enabled: general.rpcEnabled !== false,
    host:
      typeof general.rpcHost === 'string' && general.rpcHost ? general.rpcHost : DEFAULT_RPC_HOST,
    port: Number.isFinite(port) && port > 0 && port < 65536 ? port : DEFAULT_RPC_PORT
  }
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

export function getRpcHostStatus(): RpcHostStatus {
  const settings = readSettings()
  return {
    enabled: settings.enabled,
    listening: !!handle,
    host: handle?.host ?? settings.host,
    port: handle?.port ?? settings.port,
    error: lastError,
    controllers: handle?.service.listControllers().controllers.length ?? 0
  }
}

export function attachRpcCanDevices(map: Map<string, CanBase>) {
  liveMap = map
  handle?.service.attachLiveControllers(map)
}

export function detachRpcCanDevices() {
  handle?.service.detachLiveControllers()
  liveMap = undefined
}

async function stopRpcServer() {
  const current = handle
  handle = undefined
  if (current) {
    try {
      await current.close()
    } catch {
      // ignore
    }
  }
}

export async function applyRpcSettings(raw?: GeneralRpcSettings): Promise<RpcHostStatus> {
  const settings = readSettings(raw)
  await stopRpcServer()
  lastError = undefined
  if (!settings.enabled) {
    logInfo('json-rpc gateway disabled')
    return getRpcHostStatus()
  }
  try {
    handle = await startRpcServer({
      host: settings.host,
      port: settings.port,
      serviceOptions: {
        role: 'gateway',
        onShutdown: async () => {
          handle = undefined
          lastError = 'stopped by sys.shutdown'
        }
      }
    })
    if (liveMap && liveMap.size > 0) {
      handle.service.attachLiveControllers(liveMap)
    }
    logInfo(`json-rpc gateway listening on tcp://${handle.host}:${handle.port}`)
  } catch (err) {
    handle = undefined
    const message = err instanceof Error ? err.message : String(err)
    lastError = `failed to bind ${settings.host}:${settings.port}: ${message}`
    logError(`json-rpc gateway ${lastError}`)
  }
  return getRpcHostStatus()
}

function registerIpc() {
  if (ipcRegistered) {
    return
  }
  ipcRegistered = true
  ipcMain.handle('ipc-rpc-apply', async () => applyRpcSettings())
  ipcMain.handle('ipc-rpc-status', async () => getRpcHostStatus())
}

/** Start the GUI JSON-RPC gateway from saved settings. Safe to call more than once. */
export async function startRpcHost(): Promise<RpcHostStatus> {
  registerIpc()
  return applyRpcSettings()
}
