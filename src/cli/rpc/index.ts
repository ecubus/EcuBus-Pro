import { parseProject } from '../project'
import { CanRpcServiceOptions, setNativeCanApi } from './canService'
import { startRpcServer, RpcListenOptions, RpcServerHandle } from './server'
import * as docan from 'src/main/docan/can'

setNativeCanApi(docan)

export interface RpcMainOptions {
  project?: string
  host?: string
  port?: number
  stdio?: boolean
  socket?: string
  exitOnDisconnect?: boolean
  autoInit?: boolean
}

export { startRpcServer }
export type { RpcServerHandle, RpcListenOptions }

export async function rpcMain(options: RpcMainOptions): Promise<RpcServerHandle> {
  const serviceOptions: CanRpcServiceOptions = {}
  if (options.project) {
    const parsed = await parseProject(options.project)
    serviceOptions.projectDevices = parsed.data.devices
    if (typeof sysLog !== 'undefined') {
      sysLog.info(`rpc loaded project ${parsed.projectName}`)
    }
  }

  const handle = await startRpcServer({
    host: options.host,
    port: options.port,
    stdio: options.stdio,
    socket: options.socket,
    exitOnDisconnect: options.exitOnDisconnect,
    serviceOptions
  })

  if (options.autoInit) {
    await handle.service.canInit({})
    if (typeof sysLog !== 'undefined') {
      sysLog.info('rpc auto-init completed')
    }
  }

  if (options.stdio) {
    if (typeof sysLog !== 'undefined') {
      sysLog.info('json-rpc listening on stdio')
    }
  } else if (options.socket) {
    if (typeof sysLog !== 'undefined') {
      sysLog.info(`json-rpc listening on unix:${options.socket}`)
    }
  } else if (typeof sysLog !== 'undefined') {
    sysLog.info(`json-rpc listening on tcp://${handle.host}:${handle.port}`)
  }

  const shutdown = async () => {
    await handle.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return handle
}

export default rpcMain
