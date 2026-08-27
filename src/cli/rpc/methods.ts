import { RPC_METHOD_CATALOG } from './catalog'
import { CanRpcService, parseControllerArg, RpcSession } from './canService'
import { asObject, reqString } from './codec'
import { RPC_INVALID_PARAMS, RPC_METHOD_NOT_FOUND, RpcError } from './errors'

export type RpcHandler = (
  params: unknown,
  session: RpcSession,
  service: CanRpcService
) => Promise<unknown> | unknown

const handlers = new Map<string, RpcHandler>()

function register(name: string, handler: RpcHandler) {
  handlers.set(name, handler)
  const lower = name.toLowerCase()
  if (lower === name || !handlers.has(lower)) {
    handlers.set(lower, handler)
  }
}

register('sys.ping', () => ({ pong: true, ts: Date.now() }))
register('sys.version', (_p, _s, service) => service.getVersion())
register('sys.listMethods', () => ({
  methods: RPC_METHOD_CATALOG.map((m) => m.name)
}))
register('rpc.discover', () => ({
  openrpc: '1.2.6',
  info: { title: 'EcuBus-Pro JSON-RPC', version: '1.0.0' },
  methods: RPC_METHOD_CATALOG
}))
register('sys.shutdown', (_p, _s, service) => {
  setTimeout(() => {
    void service.shutdown()
  }, 10)
  return { shutdown: true }
})

register('hw.listVendors', (_p, _s, service) => service.listVendors())
register('hw.listDevices', async (params, _s, service) => {
  const obj = asObject(params, 'hw.listDevices')
  return service.listDevices(reqString(obj, 'vendor', 'hw.listDevices'))
})
register('hw.getVersion', (params, _s, service) => {
  const obj = asObject(params, 'hw.getVersion')
  return service.getHwVersion(reqString(obj, 'vendor', 'hw.getVersion'))
})

register('can.open', (params, session, service) => service.canOpen(params, session))
register('can.close', (params, _s, service) => service.canClose(params))
register('can.list', (_p, _s, service) => service.listControllers())
register('can.write', (params, session, service) => service.canWrite(params, session))
register('can.writeMany', (params, session, service) => service.canWriteMany(params, session))
register('can.read', (params, session, service) => service.canRead(params, session))
register('can.readPoll', (params, session, service) => {
  const obj = asObject(params, 'can.readPoll')
  return service.canRead({ ...obj, timeoutMs: 0 }, session)
})
register('can.subscribe', (params, session, service) => service.subscribe(params, session))
register('can.unsubscribe', (params, session, service) => service.unsubscribe(params, session))
register('can.getState', (params, _s, service) => service.getState(params))
register('can.getBusLoading', (params, _s, service) => service.getBusLoading(params))
register('can.setMode', (params, _s, service) => service.setMode(params))
register('can.reset', (params, _s, service) => service.reset(params))
register('can.startPeriodSend', (params, _s, service) => service.startPeriodSend(params))
register('can.stopPeriodSend', (params, _s, service) => service.stopPeriodSend(params))
register('can.changePeriodData', (params, _s, service) => service.changePeriodData(params))

register('Can.Init', (params, _s, service) => service.canInit(params))
register('Can.DeInit', (_p, _s, service) => service.canDeInit())
register('Can.GetVersionInfo', (_p, _s, service) => service.getAutosarVersionInfo())
register('Can.SetControllerMode', (params, _s, service) => {
  const obj = asObject(params, 'Can.SetControllerMode')
  const controller = parseControllerArg(params, 'Can.SetControllerMode')
  const transition = String(obj.transition ?? obj.mode ?? obj.Transition ?? '')
  if (!transition) {
    throw new RpcError(RPC_INVALID_PARAMS, `Can.SetControllerMode requires "transition"`)
  }
  return service.setControllerMode(controller, service.resolveTransition(transition))
})
register('Can.GetControllerMode', (params, _s, service) => {
  return service.getControllerMode(parseControllerArg(params, 'Can.GetControllerMode'))
})
register('Can.DisableControllerInterrupts', (params, _s, service) => {
  return service.disableInterrupts(parseControllerArg(params, 'Can.DisableControllerInterrupts'))
})
register('Can.EnableControllerInterrupts', (params, _s, service) => {
  return service.enableInterrupts(parseControllerArg(params, 'Can.EnableControllerInterrupts'))
})
register('Can.Write', (params, session, service) => service.canWriteHth(params, session))
register('Can.GetControllerErrorState', (params, _s, service) => {
  return service.getErrorState(parseControllerArg(params, 'Can.GetControllerErrorState'))
})
register('Can.GetControllerTxErrorCounter', (params, _s, service) => {
  return service.getTxErrorCounter(parseControllerArg(params, 'Can.GetControllerTxErrorCounter'))
})
register('Can.GetControllerRxErrorCounter', (params, _s, service) => {
  return service.getRxErrorCounter(parseControllerArg(params, 'Can.GetControllerRxErrorCounter'))
})
register('Can.SetBaudrate', (params, _s, service) => service.setBaudrate(params))
register('Can.CheckWakeup', (params, _s, service) => {
  return service.checkWakeup(parseControllerArg(params, 'Can.CheckWakeup'))
})
register('Can.MainFunction_Write', (params, session, service) =>
  service.mainFunctionWrite(params, session)
)
register('Can.MainFunction_Read', (params, session, service) =>
  service.mainFunctionRead(params, session)
)
register('Can.MainFunction_BusOff', (_p, session, service) => service.mainFunctionBusOff(session))
register('Can.MainFunction_Wakeup', (_p, session, service) => service.mainFunctionWakeup(session))
register('Can.MainFunction_Mode', (_p, session, service) => service.mainFunctionMode(session))

export function getRpcHandler(method: string): RpcHandler | undefined {
  return handlers.get(method) || handlers.get(method.toLowerCase())
}

export function listRegisteredMethods(): string[] {
  return [...new Set(RPC_METHOD_CATALOG.map((m) => m.name))]
}

export async function dispatchRpc(
  method: string,
  params: unknown,
  session: RpcSession,
  service: CanRpcService
): Promise<unknown> {
  const handler = getRpcHandler(method)
  if (!handler) {
    throw new RpcError(RPC_METHOD_NOT_FOUND, `Method not found: ${method}`)
  }
  return handler(params, session, service)
}
