import { ipcMain } from 'electron'
import {
  applySimulateRpcListen,
  configureSimulateRpc,
  getSimulateRpcStatus,
  type SimulateRpcStatus
} from 'src/cli/rpc/lifecycle'
import { store } from './store'

export const DEFAULT_RPC_HOST = '127.0.0.1'
export const DEFAULT_RPC_PORT = 17320

export type RpcHostStatus = SimulateRpcStatus

interface GeneralRpcSettings {
  rpcEnabled?: boolean
  rpcHost?: string
  rpcPort?: number
}

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

export function getRpcHostStatus(): RpcHostStatus {
  return getSimulateRpcStatus()
}

export async function applyRpcSettings(raw?: GeneralRpcSettings): Promise<RpcHostStatus> {
  const settings = readSettings(raw)
  return applySimulateRpcListen(settings)
}

function registerIpc() {
  if (ipcRegistered) {
    return
  }
  ipcRegistered = true
  ipcMain.handle('ipc-rpc-apply', async () => applyRpcSettings())
  ipcMain.handle('ipc-rpc-status', async () => getRpcHostStatus())
}

/** Register IPC and bind settings. Does not listen until a project simulate device is open. */
export async function startRpcHost(): Promise<RpcHostStatus> {
  registerIpc()
  configureSimulateRpc(readSettings())
  return getRpcHostStatus()
}
