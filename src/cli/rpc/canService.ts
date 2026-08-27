import { v4 as uuidv4 } from 'uuid'
import { CanBase } from 'src/main/docan/base'
import { SIMULATE_CAN } from 'src/main/docan/simulate'
import {
  CAN_ERROR_ID,
  CAN_ID_TYPE,
  CanBaseInfo,
  CanBitrate,
  CanError,
  CanMessage,
  CanMsgType,
  CanVendor,
  getTsUs
} from 'src/main/share/can'
import { UdsDevice } from 'src/main/share/uds'
import pkg from '../../../package.json'
import {
  asObject,
  encodeFrame,
  hasKey,
  optBool,
  optNumber,
  optString,
  parseCanData,
  parseCanId,
  parseIdType,
  reqNumber,
  reqString,
  toIdTypeName,
  toMsgType
} from './codec'
import {
  RPC_ALREADY,
  RPC_CAN_ERROR,
  RPC_INTERNAL_ERROR,
  RPC_INVALID_PARAMS,
  RPC_NOT_FOUND,
  RPC_NOT_STARTED,
  RpcError
} from './errors'
import type {
  CanControllerMode,
  CanErrorState,
  CanHandleType,
  CanIdTypeName,
  CanModeTransition,
  CanObjectType,
  CanStdReturn,
  RpcCanFrame,
  RpcCanInitConfig,
  RpcControllerConfig,
  RpcControllerEvent,
  RpcHardwareObjectConfig,
  RpcModeIndication,
  RpcTxConfirmation
} from './types'
import { CAN_STD_RETURN_CODE } from './types'

export const DEFAULT_CAN_BITRATE: CanBitrate = {
  freq: 500000,
  timeSeg1: 13,
  timeSeg2: 2,
  sjw: 1,
  preScaler: 10,
  clock: '80'
}

export const DEFAULT_CANFD_BITRATE: CanBitrate = {
  freq: 2000000,
  timeSeg1: 7,
  timeSeg2: 2,
  sjw: 1,
  preScaler: 4,
  clock: '80'
}

const VENDORS: CanVendor[] = [
  'peak',
  'simulate',
  'zlg',
  'kvaser',
  'toomoss',
  'vector',
  'slcan',
  'ecubus',
  'candle'
]

function loadNativeCan(): typeof import('src/main/docan/can') {
  if (!nativeCan) {
    throw new RpcError(
      RPC_INTERNAL_ERROR,
      `vendor requires native CAN modules; use vendor "simulate" or start via ecb_cli rpc`
    )
  }
  return nativeCan
}

let nativeCan: typeof import('src/main/docan/can') | undefined

/** Register Peak/Kvaser/… helpers. Called by the CLI entry so unit tests can stay simulate-only. */
export function setNativeCanApi(api: typeof import('src/main/docan/can')) {
  nativeCan = api
}

function openRpcCanDevice(info: CanBaseInfo): CanBase | undefined {
  if (info.vendor === 'simulate') {
    return new SIMULATE_CAN(info)
  }
  return loadNativeCan().openCanDevice(info)
}

function listRpcCanDevices(vendor: string) {
  if (vendor.toLowerCase() === 'simulate') {
    return SIMULATE_CAN.getValidDevices()
  }
  return loadNativeCan().getCanDevices(vendor)
}

function getRpcCanVersion(vendor: string) {
  if (vendor.toLowerCase() === 'simulate') {
    return SIMULATE_CAN.getLibVersion()
  }
  return loadNativeCan().getCanVersion(vendor)
}

export interface RpcSession {
  id: string
  notify: (method: string, params: unknown) => void
  subscribed: Set<number | '*'>
  rxQueue: RpcCanFrame[]
  txQueue: RpcTxConfirmation[]
  busOffQueue: RpcControllerEvent[]
  wakeupQueue: RpcControllerEvent[]
  modeQueue: RpcModeIndication[]
}

interface HardwareObject {
  hohId: number
  controllerId: number
  objectType: CanObjectType
  handleType: CanHandleType
  idType: CanIdTypeName
  canId?: number
  idMask: number
  canfd?: boolean
  brs?: boolean
  remote?: boolean
  dlc?: number
  inFlight: number
}

interface PeriodTask {
  taskId: string
  controllerId: number
  timer?: NodeJS.Timeout
  durationTimer?: NodeJS.Timeout
  hardware: boolean
  message: CanMessage
  periodMs: number
}

interface ControllerState {
  controllerId: number
  info: CanBaseInfo
  base?: CanBase
  /** true when this service opened the adapter (CLI). false when attached to a live GUI device. */
  owned: boolean
  deviceKey?: string
  mode: CanControllerMode
  errorState: CanErrorState
  txErrorCounter: number
  rxErrorCounter: number
  interruptDisable: number
  rxOverrun: number
  wakeupPending: boolean
  frameCb: (msg: CanMessage) => void
  closeCb: (errMsg?: string) => void
}

/** `adapter`: CLI owns hardware. `gateway`: GUI owns devices; both roles transmit with writeBase (TX). */
export type CanRpcRole = 'adapter' | 'gateway'

export interface CanRpcServiceOptions {
  projectDevices?: Record<string, UdsDevice>
  rxQueueSize?: number
  onShutdown?: () => Promise<void> | void
  role?: CanRpcRole
}

function stdResult(result: CanStdReturn, extra?: Record<string, unknown>) {
  return { result, resultCode: CAN_STD_RETURN_CODE[result], ...extra }
}

function normalizeBitrate(input: unknown, fd: boolean): CanBitrate {
  const fallback = fd ? DEFAULT_CANFD_BITRATE : DEFAULT_CAN_BITRATE
  if (input == null) {
    return { ...fallback }
  }
  if (typeof input === 'number' && Number.isFinite(input)) {
    return { ...fallback, freq: input }
  }
  if (typeof input === 'object') {
    const o = input as Record<string, unknown>
    const freq = typeof o.freq === 'number' ? o.freq : fallback.freq
    return {
      freq,
      timeSeg1: typeof o.timeSeg1 === 'number' ? o.timeSeg1 : fallback.timeSeg1,
      timeSeg2: typeof o.timeSeg2 === 'number' ? o.timeSeg2 : fallback.timeSeg2,
      sjw: typeof o.sjw === 'number' ? o.sjw : fallback.sjw,
      preScaler: typeof o.preScaler === 'number' ? o.preScaler : fallback.preScaler,
      clock: typeof o.clock === 'string' ? o.clock : fallback.clock,
      zlgSpec: typeof o.zlgSpec === 'string' ? o.zlgSpec : undefined
    }
  }
  throw new RpcError(RPC_INVALID_PARAMS, 'Invalid bitrate')
}

function normalizeVendor(vendor: string): CanVendor {
  const v = vendor.toLowerCase() as CanVendor
  if (!VENDORS.includes(v)) {
    throw new RpcError(RPC_INVALID_PARAMS, `Unsupported vendor "${vendor}"`)
  }
  return v
}

function canErrorToRpc(err: unknown): RpcError {
  if (err instanceof RpcError) {
    return err
  }
  if (err instanceof CanError) {
    const code =
      err.errorId === CAN_ERROR_ID.CAN_PARAM_ERROR
        ? RPC_INVALID_PARAMS
        : err.errorId === CAN_ERROR_ID.CAN_BUS_CLOSED
          ? RPC_NOT_FOUND
          : RPC_CAN_ERROR
    return new RpcError(code, err.message, { errorId: err.errorId })
  }
  const message = err instanceof Error ? err.message : String(err)
  return new RpcError(RPC_INTERNAL_ERROR, message)
}

function defaultMask(idType: CanIdTypeName): number {
  return idType === 'EXTENDED' ? 0x1fffffff : 0x7ff
}

function frameMatchesHoh(hoh: HardwareObject, msg: CanMessage): boolean {
  if (hoh.objectType !== 'RECEIVE') {
    return false
  }
  if (toIdTypeName(msg.msgType.idType) !== hoh.idType) {
    return false
  }
  if (hoh.canfd != null && !!msg.msgType.canfd !== hoh.canfd) {
    return false
  }
  if (hoh.remote != null && !!msg.msgType.remote !== hoh.remote) {
    return false
  }
  const canId = hoh.canId ?? 0
  return (msg.id & hoh.idMask) === (canId & hoh.idMask)
}

export class CanRpcService {
  readonly sessions = new Set<RpcSession>()
  readonly role: CanRpcRole
  private controllers = new Map<number, ControllerState>()
  private hohs = new Map<number, HardwareObject>()
  private periodTasks = new Map<string, PeriodTask>()
  private initialized = false
  private nextControllerId = 0
  private rxQueueSize: number
  private liveMap?: Map<string, CanBase>
  private baudRateConfigs = new Map<string, { bitrate: CanBitrate; bitratefd?: CanBitrate }>()
  private pendingTx = new Map<
    string,
    { session: RpcSession; hth: number; swPduHandle?: number; controllerId: number }
  >()

  constructor(private options: CanRpcServiceOptions = {}) {
    this.role = options.role ?? 'adapter'
    this.rxQueueSize = options.rxQueueSize ?? 4096
    if (!global.startTs) {
      global.startTs = getTsUs()
    }
  }

  private isGateway() {
    return this.role === 'gateway'
  }

  createSession(notify: RpcSession['notify']): RpcSession {
    const session: RpcSession = {
      id: uuidv4(),
      notify,
      subscribed: new Set(),
      rxQueue: [],
      txQueue: [],
      busOffQueue: [],
      wakeupQueue: [],
      modeQueue: []
    }
    this.sessions.add(session)
    return session
  }

  dropSession(session: RpcSession) {
    this.sessions.delete(session)
    session.subscribed.clear()
    session.rxQueue.length = 0
    session.txQueue.length = 0
    session.busOffQueue.length = 0
    session.wakeupQueue.length = 0
    session.modeQueue.length = 0
  }

  getVersion() {
    return {
      version: pkg.version,
      jsonrpc: '2.0',
      api: 'mcal-can',
      apiVersion: '1.0.0',
      platform: process.platform,
      role: this.role
    }
  }

  /**
   * Bind already-open GUI CAN devices. RPC writes use writeBase (trace Tx).
   * Does not open or close hardware.
   */
  attachLiveControllers(map: Map<string, CanBase>) {
    this.liveMap = map
    this.unbindLiveControllers()
    this.bindLiveMap(map)
  }

  /** Unbind GUI devices without closing them. */
  detachLiveControllers() {
    this.unbindLiveControllers()
  }

  private unbindLiveControllers() {
    const ids = [...this.controllers.keys()]
    for (const id of ids) {
      const ctrl = this.controllers.get(id)
      if (!ctrl || ctrl.owned) {
        continue
      }
      this.clearControllerPeriod(id)
      if (ctrl.base) {
        ctrl.base.detachCanMessage(ctrl.frameCb)
        ctrl.base.event.off('close', ctrl.closeCb)
        ctrl.base = undefined
      }
      for (const [hohId, hoh] of [...this.hohs.entries()]) {
        if (hoh.controllerId === id) {
          this.hohs.delete(hohId)
        }
      }
      this.controllers.delete(id)
      ctrl.mode = 'CAN_CS_UNINIT'
    }
    if (this.controllers.size === 0) {
      this.initialized = false
    }
  }

  getAutosarVersionInfo() {
    const [major, minor, patch] = String(pkg.version)
      .split('.')
      .map((n) => Number(n) || 0)
    return {
      vendorId: 0xecb,
      moduleId: 80,
      swMajorVersion: major,
      swMinorVersion: minor,
      swPatchVersion: patch,
      version: pkg.version
    }
  }

  listVendors() {
    const list = (pkg as { ecubusPro?: { vendor?: Record<string, string[]> } }).ecubusPro?.vendor?.[
      process.platform
    ]
    if (Array.isArray(list) && list.length > 0) {
      return { vendors: list }
    }
    return { vendors: VENDORS }
  }

  async listDevices(vendor: string) {
    const devices = await Promise.resolve(listRpcCanDevices(vendor))
    return { vendor: normalizeVendor(vendor), devices }
  }

  getHwVersion(vendor: string) {
    return { vendor: normalizeVendor(vendor), version: getRpcCanVersion(vendor) }
  }

  async canOpen(params: unknown, _session: RpcSession) {
    const obj = asObject(params, 'can.open')
    const cfg: RpcControllerConfig = {
      controllerId: optNumber(obj, 'controllerId'),
      vendor: optString(obj, 'vendor'),
      handle: obj.handle,
      name: optString(obj, 'name'),
      deviceId: optString(obj, 'deviceId'),
      deviceName: optString(obj, 'deviceName'),
      canfd: optBool(obj, 'canfd'),
      silent: optBool(obj, 'silent'),
      bitrate: obj.bitrate as RpcControllerConfig['bitrate'],
      bitratefd: obj.bitratefd as RpcControllerConfig['bitratefd'],
      database: optString(obj, 'database')
    }
    const controller = await this.openController(cfg)
    this.ensureDefaultHoh(controller.controllerId)
    await this.applyMode(controller, 'CAN_CS_STARTED')
    return {
      controllerId: controller.controllerId,
      name: controller.info.name,
      vendor: controller.info.vendor,
      handle: controller.info.handle,
      mode: controller.mode
    }
  }

  async canClose(params: unknown) {
    const obj = asObject(params, 'can.close')
    const controllerId = optNumber(obj, 'controllerId')
    if (controllerId == null) {
      await this.closeAll()
      this.initialized = false
      return { closed: 'all' }
    }
    await this.closeController(controllerId)
    if (this.controllers.size === 0) {
      this.initialized = false
    }
    return { closed: controllerId }
  }

  listControllers() {
    return {
      initialized: this.initialized,
      controllers: [...this.controllers.values()].map((c) => this.controllerPublic(c)),
      hardwareObjects: [...this.hohs.values()].map((h) => ({
        hohId: h.hohId,
        controllerId: h.controllerId,
        objectType: h.objectType,
        handleType: h.handleType,
        idType: h.idType,
        canId: h.canId,
        idMask: h.idMask,
        canfd: h.canfd,
        brs: h.brs
      }))
    }
  }

  async canWrite(params: unknown, session: RpcSession) {
    const obj = asObject(params, 'can.write')
    const controllerId = reqNumber(obj, 'controllerId', 'can.write')
    const ctrl = this.requireController(controllerId)
    this.requireStarted(ctrl)
    const id = parseCanId(obj.id)
    const data = parseCanData(obj.data ?? obj.sdu)
    const msgType = toMsgType(obj, {
      canfd: ctrl.info.canfd,
      brs: false,
      remote: false,
      idType: CAN_ID_TYPE.STANDARD
    })
    if (!hasKey(obj, 'idType') && id > 0x7ff) {
      msgType.idType = CAN_ID_TYPE.EXTENDED
    }
    const name = optString(obj, 'name')
    const ts = await this.transmit(ctrl, id, msgType, data, session, undefined, undefined, name)
    return { ts, id, length: data.length }
  }

  async canWriteMany(params: unknown, session: RpcSession) {
    const obj = asObject(params, 'can.writeMany')
    const frames = obj.frames
    if (!Array.isArray(frames)) {
      throw new RpcError(RPC_INVALID_PARAMS, 'can.writeMany requires params.frames[]')
    }
    const results = []
    for (const frame of frames) {
      results.push(await this.canWrite(frame, session))
    }
    return { results }
  }

  async canRead(params: unknown, session: RpcSession) {
    const obj = asObject(params, 'can.read')
    const controllerId = optNumber(obj, 'controllerId')
    const timeoutMs = optNumber(obj, 'timeoutMs') ?? 0
    const max = optNumber(obj, 'max') ?? 64
    const take = () => this.drainQueue(session.rxQueue, max, controllerId)
    const first = take()
    if (first.length > 0 || timeoutMs <= 0) {
      return { frames: first }
    }
    const frames = await new Promise<RpcCanFrame[]>((resolve) => {
      const timer = setTimeout(() => {
        cleanup()
        resolve(take())
      }, timeoutMs)
      const onLen = session.rxQueue.length
      const poll = setInterval(() => {
        if (session.rxQueue.length > onLen) {
          cleanup()
          resolve(take())
        }
      }, 5)
      const cleanup = () => {
        clearTimeout(timer)
        clearInterval(poll)
      }
    })
    return { frames }
  }

  subscribe(params: unknown, session: RpcSession) {
    const obj = asObject(params, 'can.subscribe')
    const controllerId = optNumber(obj, 'controllerId')
    if (controllerId == null) {
      session.subscribed.add('*')
      return { subscribed: 'all' }
    }
    this.requireController(controllerId)
    session.subscribed.add(controllerId)
    return { subscribed: controllerId }
  }

  unsubscribe(params: unknown, session: RpcSession) {
    const obj = asObject(params, 'can.unsubscribe')
    const controllerId = optNumber(obj, 'controllerId')
    if (controllerId == null) {
      session.subscribed.clear()
      return { subscribed: 'none' }
    }
    session.subscribed.delete(controllerId)
    return { unsubscribed: controllerId }
  }

  getState(params: unknown) {
    const obj = asObject(params, 'can.getState')
    const controllerId = reqNumber(obj, 'controllerId', 'can.getState')
    const ctrl = this.requireController(controllerId)
    return {
      ...this.controllerPublic(ctrl),
      busLoading: ctrl.base?.getBusLoading(1000)
    }
  }

  getBusLoading(params: unknown) {
    const obj = asObject(params, 'can.getBusLoading')
    const controllerId = reqNumber(obj, 'controllerId', 'can.getBusLoading')
    const ctrl = this.requireController(controllerId)
    const timeDiff = optNumber(obj, 'timeDiffMs') ?? 1000
    return ctrl.base?.getBusLoading(timeDiff) ?? null
  }

  async setMode(params: unknown) {
    const obj = asObject(params, 'can.setMode')
    const controllerId = reqNumber(obj, 'controllerId', 'can.setMode')
    const modeRaw = reqString(obj, 'mode', 'can.setMode')
    const transition = this.resolveTransition(modeRaw)
    return this.setControllerMode(controllerId, transition)
  }

  resolveTransition(mode: string): CanModeTransition {
    return this.modeToTransition(mode)
  }

  async reset(params: unknown) {
    const obj = asObject(params, 'can.reset')
    const controllerId = reqNumber(obj, 'controllerId', 'can.reset')
    const ctrl = this.requireController(controllerId)
    if (ctrl.owned) {
      await this.reopen(ctrl)
    }
    ctrl.errorState = 'CAN_ERRORSTATE_ACTIVE'
    ctrl.txErrorCounter = 0
    ctrl.rxErrorCounter = 0
    await this.applyMode(ctrl, 'CAN_CS_STARTED')
    return { controllerId, mode: ctrl.mode, errorState: ctrl.errorState }
  }

  startPeriodSend(params: unknown) {
    const obj = asObject(params, 'can.startPeriodSend')
    const controllerId = reqNumber(obj, 'controllerId', 'can.startPeriodSend')
    const ctrl = this.requireController(controllerId)
    this.requireStarted(ctrl)
    const id = parseCanId(obj.id)
    const data = parseCanData(obj.data ?? obj.sdu)
    const periodMs = reqNumber(obj, 'periodMs', 'can.startPeriodSend')
    const durationMs = optNumber(obj, 'durationMs')
    const msgType = toMsgType(obj, {
      canfd: ctrl.info.canfd,
      brs: false,
      remote: false,
      idType: CAN_ID_TYPE.STANDARD
    })
    const message: CanMessage = {
      id,
      data,
      dir: 'OUT',
      msgType,
      device: ctrl.info.name,
      name: optString(obj, 'name')
    }
    const taskId = this.createPeriodTask(ctrl, message, periodMs, durationMs)
    return { taskId, periodMs }
  }

  stopPeriodSend(params: unknown) {
    const obj = asObject(params, 'can.stopPeriodSend')
    const controllerId = reqNumber(obj, 'controllerId', 'can.stopPeriodSend')
    const taskId = reqString(obj, 'taskId', 'can.stopPeriodSend')
    this.requireController(controllerId)
    this.clearPeriodTask(taskId)
    return { stopped: taskId }
  }

  changePeriodData(params: unknown) {
    const obj = asObject(params, 'can.changePeriodData')
    const controllerId = reqNumber(obj, 'controllerId', 'can.changePeriodData')
    const taskId = reqString(obj, 'taskId', 'can.changePeriodData')
    const data = parseCanData(obj.data ?? obj.sdu)
    this.requireController(controllerId)
    const task = this.periodTasks.get(taskId)
    if (!task || task.controllerId !== controllerId) {
      throw new RpcError(RPC_NOT_FOUND, `period task ${taskId} not found`)
    }
    task.message.data = data
    const ctrl = this.controllers.get(controllerId)
    if (task.hardware && ctrl?.base?.changePeriodData) {
      ctrl.base.changePeriodData(taskId, data)
    }
    return { taskId, length: data.length }
  }

  async canInit(params: unknown) {
    const obj = asObject(params, 'Can.Init')
    if (this.isGateway()) {
      if (this.controllers.size === 0 && this.liveMap && this.liveMap.size > 0) {
        this.bindLiveMap(this.liveMap)
      }
      if (this.controllers.size === 0) {
        throw new RpcError(
          RPC_NOT_STARTED,
          'EcuBus runtime is not started; start the project in the GUI first'
        )
      }
      const config = (hasKey(obj, 'config') ? obj.config : obj) as RpcCanInitConfig
      if (config && typeof config === 'object' && config.hardwareObjects?.length) {
        for (const h of config.hardwareObjects) {
          if (!this.hohs.has(h.hohId)) {
            this.addHoh(h)
          }
        }
      }
      this.initialized = true
      return stdResult('E_OK', this.listControllers())
    }
    if (this.initialized && this.controllers.size > 0) {
      return stdResult('E_OK', this.listControllers())
    }
    const config = (hasKey(obj, 'config') ? obj.config : obj) as RpcCanInitConfig
    if (config && typeof config !== 'object') {
      throw new RpcError(RPC_INVALID_PARAMS, 'Can.Init config must be an object')
    }
    const cfg = config || {}
    if (cfg.rxQueueSize && cfg.rxQueueSize > 0) {
      this.rxQueueSize = cfg.rxQueueSize
    }
    if (cfg.baudRateConfigs) {
      for (const [id, br] of Object.entries(cfg.baudRateConfigs)) {
        this.baudRateConfigs.set(String(id), {
          bitrate: normalizeBitrate(br.bitrate, false),
          bitratefd: br.bitratefd != null ? normalizeBitrate(br.bitratefd, true) : undefined
        })
      }
    }

    const controllers = cfg.controllers?.length ? cfg.controllers : this.controllersFromProject()
    if (!controllers.length) {
      throw new RpcError(
        RPC_INVALID_PARAMS,
        'Can.Init requires config.controllers[] or a CLI project with CAN devices'
      )
    }
    for (const c of controllers) {
      await this.openController(c)
    }
    if (cfg.hardwareObjects?.length) {
      for (const h of cfg.hardwareObjects) {
        this.addHoh(h)
      }
    } else {
      for (const id of this.controllers.keys()) {
        this.ensureDefaultHoh(id)
      }
    }
    this.initialized = true
    return stdResult('E_OK', this.listControllers())
  }

  async canDeInit() {
    await this.closeAll()
    this.initialized = false
    this.hohs.clear()
    this.baudRateConfigs.clear()
    return stdResult('E_OK')
  }

  async setControllerMode(controllerId: number, transition: CanModeTransition) {
    const ctrl = this.requireController(controllerId)
    const next = this.transitionToMode(ctrl.mode, transition)
    await this.applyMode(ctrl, next)
    return stdResult('E_OK', { controller: controllerId, mode: ctrl.mode })
  }

  getControllerMode(controllerId: number) {
    const ctrl = this.requireController(controllerId)
    return stdResult('E_OK', { controller: controllerId, mode: ctrl.mode })
  }

  disableInterrupts(controllerId: number) {
    const ctrl = this.requireController(controllerId)
    ctrl.interruptDisable++
    return stdResult('E_OK', { controller: controllerId, interruptDisable: ctrl.interruptDisable })
  }

  enableInterrupts(controllerId: number) {
    const ctrl = this.requireController(controllerId)
    if (ctrl.interruptDisable > 0) {
      ctrl.interruptDisable--
    }
    return stdResult('E_OK', { controller: controllerId, interruptDisable: ctrl.interruptDisable })
  }

  async canWriteHth(params: unknown, session: RpcSession) {
    const obj = asObject(params, 'Can.Write')
    const hth = reqNumber(obj, 'hth', 'Can.Write')
    const hoh = this.hohs.get(hth)
    if (!hoh || hoh.objectType !== 'TRANSMIT') {
      return stdResult('E_NOT_OK', { reason: 'invalid HTH' })
    }
    const ctrl = this.controllers.get(hoh.controllerId)
    if (!ctrl || ctrl.mode !== 'CAN_CS_STARTED' || !ctrl.base) {
      return stdResult('E_NOT_OK', { reason: 'controller not started' })
    }
    const maxPending = hoh.handleType === 'FULL' ? 1 : 8
    if (hoh.inFlight >= maxPending) {
      return stdResult('CAN_BUSY')
    }
    const id =
      hasKey(obj, 'id') || hasKey(obj, 'canId') ? parseCanId(obj.id ?? obj.canId) : hoh.canId
    if (id == null) {
      return stdResult('E_NOT_OK', { reason: 'CAN id missing for BASIC HTH' })
    }
    const data = parseCanData(obj.sdu ?? obj.data)
    const length = optNumber(obj, 'length') ?? optNumber(obj, 'sduLength')
    const payload = length != null ? data.subarray(0, length) : data
    if (hoh.dlc != null && payload.length > hoh.dlc) {
      return stdResult('E_NOT_OK', { reason: 'SDU longer than configured DLC' })
    }
    const msgType: CanMsgType = {
      idType: parseIdType(obj.idType, hoh.idType),
      canfd: optBool(obj, 'canfd') ?? hoh.canfd ?? ctrl.info.canfd,
      brs: optBool(obj, 'brs') ?? hoh.brs ?? false,
      remote: optBool(obj, 'remote') ?? hoh.remote ?? false
    }
    const swPduHandle = optNumber(obj, 'swPduHandle') ?? optNumber(obj, 'swPduHandleId')
    hoh.inFlight++
    try {
      const ts = await this.transmit(ctrl, id, msgType, payload, session, hth, swPduHandle)
      return stdResult('E_OK', { ts, hth, swPduHandle, id })
    } catch (err) {
      this.pushTx(session, {
        controllerId: ctrl.controllerId,
        hth,
        swPduHandle,
        result: 'E_NOT_OK',
        resultCode: CAN_STD_RETURN_CODE.E_NOT_OK
      })
      const rpc = canErrorToRpc(err)
      return stdResult('E_NOT_OK', { reason: rpc.message, data: rpc.data })
    } finally {
      hoh.inFlight = Math.max(0, hoh.inFlight - 1)
    }
  }

  getErrorState(controllerId: number) {
    const ctrl = this.requireController(controllerId)
    return stdResult('E_OK', { controller: controllerId, errorState: ctrl.errorState })
  }

  getTxErrorCounter(controllerId: number) {
    const ctrl = this.requireController(controllerId)
    return stdResult('E_OK', { controller: controllerId, count: ctrl.txErrorCounter })
  }

  getRxErrorCounter(controllerId: number) {
    const ctrl = this.requireController(controllerId)
    return stdResult('E_OK', { controller: controllerId, count: ctrl.rxErrorCounter })
  }

  async setBaudrate(params: unknown) {
    const obj = asObject(params, 'Can.SetBaudrate')
    const controllerId = reqNumber(obj, 'controller', 'Can.SetBaudrate')
    const ctrl = this.requireController(controllerId)
    if (!ctrl.owned) {
      return stdResult('E_NOT_OK', { reason: 'cannot change baudrate of a live EcuBus device' })
    }
    if (ctrl.mode === 'CAN_CS_STARTED') {
      return stdResult('E_NOT_OK', { reason: 'controller must be STOPPED to change baudrate' })
    }
    const baudId = obj.baudRateConfigID ?? obj.baudRateConfigId
    let bitrate = ctrl.info.bitrate
    let bitratefd = ctrl.info.bitratefd
    if (baudId != null && this.baudRateConfigs.has(String(baudId))) {
      const found = this.baudRateConfigs.get(String(baudId))!
      bitrate = found.bitrate
      bitratefd = found.bitratefd
    } else if (hasKey(obj, 'bitrate')) {
      bitrate = normalizeBitrate(obj.bitrate, false)
      bitratefd = hasKey(obj, 'bitratefd') ? normalizeBitrate(obj.bitratefd, true) : bitratefd
    } else if (baudId != null) {
      return stdResult('E_NOT_OK', { reason: `unknown baudRateConfigID ${String(baudId)}` })
    }
    ctrl.info = { ...ctrl.info, bitrate, bitratefd }
    await this.reopen(ctrl)
    return stdResult('E_OK', { controller: controllerId, bitrate, bitratefd })
  }

  checkWakeup(controllerId: number) {
    const ctrl = this.requireController(controllerId)
    if (ctrl.wakeupPending) {
      ctrl.wakeupPending = false
      return stdResult('E_OK')
    }
    return stdResult('E_NOT_OK')
  }

  mainFunctionRead(params: unknown, session: RpcSession) {
    const obj = asObject(params, 'Can.MainFunction_Read')
    const max = optNumber(obj, 'max') ?? 64
    return { indications: this.drainQueue(session.rxQueue, max) }
  }

  mainFunctionWrite(params: unknown, session: RpcSession) {
    const obj = asObject(params, 'Can.MainFunction_Write')
    const max = optNumber(obj, 'max') ?? 64
    return { confirmations: session.txQueue.splice(0, max) }
  }

  mainFunctionBusOff(session: RpcSession) {
    return { events: session.busOffQueue.splice(0, session.busOffQueue.length) }
  }

  mainFunctionWakeup(session: RpcSession) {
    return { events: session.wakeupQueue.splice(0, session.wakeupQueue.length) }
  }

  mainFunctionMode(session: RpcSession) {
    return { indications: session.modeQueue.splice(0, session.modeQueue.length) }
  }

  async closeAll() {
    const ids = [...this.controllers.keys()]
    for (const id of ids) {
      await this.closeController(id)
    }
  }

  async shutdown() {
    await this.closeAll()
    this.initialized = false
    if (this.options.onShutdown) {
      await this.options.onShutdown()
    }
  }

  private controllerPublic(c: ControllerState) {
    return {
      controllerId: c.controllerId,
      name: c.info.name,
      vendor: c.info.vendor,
      handle: c.info.handle,
      canfd: c.info.canfd,
      silent: !!c.info.silent,
      bitrate: c.info.bitrate,
      bitratefd: c.info.bitratefd,
      mode: c.mode,
      errorState: c.errorState,
      interruptDisable: c.interruptDisable,
      rxOverrun: c.rxOverrun,
      txErrorCounter: c.txErrorCounter,
      rxErrorCounter: c.rxErrorCounter
    }
  }

  private requireController(controllerId: number) {
    const ctrl = this.controllers.get(controllerId)
    if (!ctrl) {
      throw new RpcError(RPC_NOT_FOUND, `controller ${controllerId} not found`)
    }
    return ctrl
  }

  private requireStarted(ctrl: ControllerState) {
    if (ctrl.mode !== 'CAN_CS_STARTED' || !ctrl.base) {
      throw new RpcError(RPC_NOT_STARTED, `controller ${ctrl.controllerId} is ${ctrl.mode}`)
    }
  }

  private controllersFromProject(): RpcControllerConfig[] {
    const devices = this.options.projectDevices
    if (!devices) {
      return []
    }
    const list: RpcControllerConfig[] = []
    let index = 0
    for (const [id, device] of Object.entries(devices)) {
      if (device.type === 'can' && device.canDevice) {
        list.push({
          controllerId: index,
          vendor: device.canDevice.vendor,
          handle: device.canDevice.handle,
          name: device.canDevice.name,
          deviceId: id,
          canfd: device.canDevice.canfd,
          silent: device.canDevice.silent,
          bitrate: device.canDevice.bitrate,
          bitratefd: device.canDevice.bitratefd,
          database: device.canDevice.database
        })
        index++
      }
    }
    return list
  }

  private resolveFromProject(cfg: RpcControllerConfig): Partial<CanBaseInfo> | undefined {
    const devices = this.options.projectDevices
    if (!devices) {
      return undefined
    }
    for (const [id, device] of Object.entries(devices)) {
      if (device.type !== 'can' || !device.canDevice) {
        continue
      }
      if (cfg.deviceId && id === cfg.deviceId) {
        return device.canDevice
      }
      if (cfg.deviceName && device.canDevice.name === cfg.deviceName) {
        return device.canDevice
      }
    }
    return undefined
  }

  private async openController(cfg: RpcControllerConfig): Promise<ControllerState> {
    if (this.isGateway()) {
      const existing = this.matchLiveController(cfg)
      if (existing) {
        this.ensureDefaultHoh(existing.controllerId)
        if (existing.mode !== 'CAN_CS_STARTED') {
          await this.applyMode(existing, 'CAN_CS_STARTED')
        }
        return existing
      }
      throw new RpcError(
        RPC_NOT_FOUND,
        'No matching live EcuBus CAN device; start the project in the GUI first'
      )
    }
    const fromProject = this.resolveFromProject(cfg)
    const vendor = normalizeVendor(String(cfg.vendor || fromProject?.vendor || ''))
    const handle = cfg.handle ?? fromProject?.handle
    if (handle == null) {
      throw new RpcError(RPC_INVALID_PARAMS, 'controller handle is required')
    }
    const controllerId = cfg.controllerId != null ? cfg.controllerId : this.allocControllerId()
    if (this.controllers.has(controllerId)) {
      throw new RpcError(RPC_ALREADY, `controller ${controllerId} already open`)
    }
    const canfd = cfg.canfd ?? fromProject?.canfd ?? false
    const info: CanBaseInfo = {
      id: fromProject?.id || uuidv4(),
      handle,
      name: cfg.name || fromProject?.name || `${vendor}-${handle}`,
      vendor,
      canfd,
      silent: cfg.silent ?? fromProject?.silent,
      bitrate: normalizeBitrate(cfg.bitrate ?? fromProject?.bitrate, false),
      bitratefd: canfd
        ? normalizeBitrate(cfg.bitratefd ?? fromProject?.bitratefd, true)
        : undefined,
      database: cfg.database ?? fromProject?.database
    }
    const ctrl: ControllerState = {
      controllerId,
      info,
      owned: true,
      mode: 'CAN_CS_STOPPED',
      errorState: 'CAN_ERRORSTATE_ACTIVE',
      txErrorCounter: 0,
      rxErrorCounter: 0,
      interruptDisable: 0,
      rxOverrun: 0,
      wakeupPending: false,
      frameCb: (msg) => this.onFrame(controllerId, msg),
      closeCb: (errMsg) => this.onClose(controllerId, errMsg)
    }
    this.controllers.set(controllerId, ctrl)
    await this.attachHardware(ctrl)
    if (typeof sysLog !== 'undefined') {
      sysLog.info(`rpc can open ${info.vendor}-${info.handle} as controller ${controllerId}`)
    }
    return ctrl
  }

  private matchLiveController(cfg: RpcControllerConfig): ControllerState | undefined {
    for (const ctrl of this.controllers.values()) {
      if (cfg.controllerId != null && ctrl.controllerId === cfg.controllerId) {
        return ctrl
      }
      if (cfg.deviceId && ctrl.deviceKey === cfg.deviceId) {
        return ctrl
      }
      if (cfg.name && ctrl.info.name === cfg.name) {
        return ctrl
      }
      if (cfg.deviceName && ctrl.info.name === cfg.deviceName) {
        return ctrl
      }
      if (
        cfg.handle != null &&
        String(ctrl.info.handle) === String(cfg.handle) &&
        (!cfg.vendor || normalizeVendor(String(cfg.vendor)) === ctrl.info.vendor)
      ) {
        return ctrl
      }
    }
    return undefined
  }

  private bindLiveMap(map: Map<string, CanBase>) {
    this.liveMap = map
    this.nextControllerId = 0
    for (const [key, base] of map) {
      const controllerId = this.allocControllerId()
      const ctrl: ControllerState = {
        controllerId,
        info: { ...base.info },
        base,
        owned: false,
        deviceKey: key,
        mode: 'CAN_CS_STARTED',
        errorState: 'CAN_ERRORSTATE_ACTIVE',
        txErrorCounter: 0,
        rxErrorCounter: 0,
        interruptDisable: 0,
        rxOverrun: 0,
        wakeupPending: false,
        frameCb: (msg) => this.onFrame(controllerId, msg),
        closeCb: (errMsg) => this.onClose(controllerId, errMsg)
      }
      this.controllers.set(controllerId, ctrl)
      base.attachCanMessage(ctrl.frameCb)
      base.event.on('close', ctrl.closeCb)
      this.ensureDefaultHoh(controllerId)
    }
    this.initialized = this.controllers.size > 0
    if (typeof sysLog !== 'undefined') {
      sysLog.info(`rpc gateway attached ${this.controllers.size} live CAN device(s)`)
    }
  }

  private allocControllerId() {
    while (this.controllers.has(this.nextControllerId)) {
      this.nextControllerId++
    }
    return this.nextControllerId++
  }

  private async attachHardware(ctrl: ControllerState) {
    try {
      const base = openRpcCanDevice(ctrl.info)
      if (!base) {
        throw new RpcError(
          RPC_NOT_FOUND,
          `failed to open ${ctrl.info.vendor} handle ${ctrl.info.handle}`
        )
      }
      ctrl.base = base
      base.attachCanMessage(ctrl.frameCb)
      base.event.on('close', ctrl.closeCb)
    } catch (err) {
      this.controllers.delete(ctrl.controllerId)
      throw canErrorToRpc(err)
    }
  }

  private async reopen(ctrl: ControllerState) {
    await this.detachHardware(ctrl)
    await this.attachHardware(ctrl)
  }

  private async detachHardware(ctrl: ControllerState) {
    this.clearControllerPeriod(ctrl.controllerId)
    if (ctrl.base) {
      ctrl.base.detachCanMessage(ctrl.frameCb)
      ctrl.base.event.off('close', ctrl.closeCb)
      if (ctrl.owned) {
        try {
          await Promise.resolve(ctrl.base.close())
        } catch {
          // ignore close errors
        }
      }
      ctrl.base = undefined
    }
  }

  private async closeController(controllerId: number) {
    const ctrl = this.controllers.get(controllerId)
    if (!ctrl) {
      return
    }
    await this.detachHardware(ctrl)
    for (const [hohId, hoh] of [...this.hohs.entries()]) {
      if (hoh.controllerId === controllerId) {
        this.hohs.delete(hohId)
      }
    }
    this.controllers.delete(controllerId)
    ctrl.mode = 'CAN_CS_UNINIT'
  }

  private ensureDefaultHoh(controllerId: number) {
    const hasTx = [...this.hohs.values()].some(
      (h) => h.controllerId === controllerId && h.objectType === 'TRANSMIT'
    )
    const hasRx = [...this.hohs.values()].some(
      (h) => h.controllerId === controllerId && h.objectType === 'RECEIVE'
    )
    if (!hasTx) {
      this.addHoh({
        hohId: this.allocHohId(controllerId * 2),
        controllerId,
        objectType: 'TRANSMIT',
        handleType: 'BASIC',
        idType: 'STANDARD'
      })
    }
    if (!hasRx) {
      this.addHoh({
        hohId: this.allocHohId(controllerId * 2 + 1),
        controllerId,
        objectType: 'RECEIVE',
        handleType: 'BASIC',
        idType: 'STANDARD',
        canId: 0,
        idMask: 0
      })
      this.addHoh({
        hohId: this.allocHohId(controllerId * 2 + 1000),
        controllerId,
        objectType: 'RECEIVE',
        handleType: 'BASIC',
        idType: 'EXTENDED',
        canId: 0,
        idMask: 0
      })
    }
  }

  private allocHohId(preferred: number) {
    if (!this.hohs.has(preferred)) {
      return preferred
    }
    let id = 0
    while (this.hohs.has(id)) {
      id++
    }
    return id
  }

  private addHoh(cfg: RpcHardwareObjectConfig) {
    if (this.hohs.has(cfg.hohId)) {
      throw new RpcError(RPC_ALREADY, `hardware object ${cfg.hohId} already exists`)
    }
    if (!this.controllers.has(cfg.controllerId)) {
      throw new RpcError(
        RPC_NOT_FOUND,
        `controller ${cfg.controllerId} not found for Hoh ${cfg.hohId}`
      )
    }
    const idType = cfg.idType ?? 'STANDARD'
    const hoh: HardwareObject = {
      hohId: cfg.hohId,
      controllerId: cfg.controllerId,
      objectType: cfg.objectType,
      handleType: cfg.handleType ?? 'BASIC',
      idType,
      canId: cfg.canId != null ? parseCanId(cfg.canId) : undefined,
      idMask: cfg.idMask != null ? parseCanId(cfg.idMask) : defaultMask(idType),
      canfd: cfg.canfd,
      brs: cfg.brs,
      remote: cfg.remote,
      dlc: cfg.dlc,
      inFlight: 0
    }
    if (hoh.objectType === 'TRANSMIT' && hoh.handleType === 'FULL' && hoh.canId == null) {
      throw new RpcError(RPC_INVALID_PARAMS, `FULL transmit Hoh ${cfg.hohId} requires canId`)
    }
    this.hohs.set(hoh.hohId, hoh)
  }

  private matchRxHoh(controllerId: number, msg: CanMessage): number | undefined {
    for (const hoh of this.hohs.values()) {
      if (hoh.controllerId === controllerId && frameMatchesHoh(hoh, msg)) {
        return hoh.hohId
      }
    }
    return undefined
  }

  private async transmit(
    ctrl: ControllerState,
    id: number,
    msgType: CanMsgType,
    data: Buffer,
    session: RpcSession,
    hth?: number,
    swPduHandle?: number,
    name?: string
  ) {
    if (!ctrl.base) {
      throw new RpcError(RPC_NOT_STARTED, `controller ${ctrl.controllerId} has no hardware`)
    }
    const key = uuidv4()
    this.pendingTx.set(key, {
      session,
      hth: hth ?? -1,
      swPduHandle,
      controllerId: ctrl.controllerId
    })
    try {
      const ts = await ctrl.base.writeBase(id, msgType, data, { name })
      this.pushTx(session, {
        controllerId: ctrl.controllerId,
        hth: hth ?? -1,
        swPduHandle,
        ts,
        result: 'E_OK',
        resultCode: CAN_STD_RETURN_CODE.E_OK
      })
      this.notifyIf(session, ctrl, 'can.txConfirmation', {
        controllerId: ctrl.controllerId,
        hth,
        swPduHandle,
        ts,
        result: 'E_OK',
        resultCode: CAN_STD_RETURN_CODE.E_OK
      })
      return ts
    } catch (err) {
      throw canErrorToRpc(err)
    } finally {
      this.pendingTx.delete(key)
    }
  }

  private onFrame(controllerId: number, msg: CanMessage) {
    const ctrl = this.controllers.get(controllerId)
    if (!ctrl) {
      return
    }
    if (ctrl.mode === 'CAN_CS_SLEEP' && msg.dir === 'IN') {
      ctrl.wakeupPending = true
      const event: RpcControllerEvent = { controllerId, ts: msg.ts ?? getTsUs(), message: 'wakeup' }
      this.broadcast((session) => {
        this.pushBounded(session.wakeupQueue, event)
        this.notifyIf(session, ctrl, 'can.controllerWakeup', event)
      })
      return
    }
    if (ctrl.mode !== 'CAN_CS_STARTED') {
      return
    }
    if (msg.dir === 'OUT') {
      return
    }
    const hrh = this.matchRxHoh(controllerId, msg)
    if (hrh == null && this.hasReceiveHoh(controllerId)) {
      return
    }
    const frame = encodeFrame(msg, { controllerId, hrh })
    this.broadcast((session) => {
      if (session.rxQueue.length >= this.rxQueueSize) {
        session.rxQueue.shift()
        ctrl.rxOverrun++
      }
      session.rxQueue.push(frame)
      this.notifyIf(session, ctrl, 'can.rxIndication', frame)
    })
  }

  private hasReceiveHoh(controllerId: number) {
    return [...this.hohs.values()].some(
      (h) => h.controllerId === controllerId && h.objectType === 'RECEIVE'
    )
  }

  private onClose(controllerId: number, errMsg?: string) {
    const ctrl = this.controllers.get(controllerId)
    if (!ctrl) {
      return
    }
    if (errMsg) {
      ctrl.errorState = /bus.?off/i.test(errMsg)
        ? 'CAN_ERRORSTATE_BUSOFF'
        : 'CAN_ERRORSTATE_PASSIVE'
      const event: RpcControllerEvent = { controllerId, ts: getTsUs(), message: errMsg }
      if (ctrl.errorState === 'CAN_ERRORSTATE_BUSOFF') {
        this.broadcast((session) => {
          this.pushBounded(session.busOffQueue, event)
          this.notifyIf(session, ctrl, 'can.controllerBusOff', event)
        })
      }
      this.broadcast((session) => {
        this.notifyIf(session, ctrl, 'can.error', {
          controllerId,
          message: errMsg,
          errorState: ctrl.errorState
        })
      })
    }
  }

  private notifyIf(session: RpcSession, ctrl: ControllerState, method: string, params: unknown) {
    if (ctrl.interruptDisable > 0) {
      return
    }
    if (!session.subscribed.has('*') && !session.subscribed.has(ctrl.controllerId)) {
      return
    }
    session.notify(method, params)
  }

  private broadcast(fn: (session: RpcSession) => void) {
    for (const session of this.sessions) {
      fn(session)
    }
  }

  private pushTx(session: RpcSession, conf: RpcTxConfirmation) {
    this.pushBounded(session.txQueue, conf)
  }

  private pushBounded<T>(queue: T[], item: T) {
    if (queue.length >= this.rxQueueSize) {
      queue.shift()
    }
    queue.push(item)
  }

  private drainQueue(queue: RpcCanFrame[], max: number, controllerId?: number) {
    if (controllerId == null) {
      return queue.splice(0, max)
    }
    const out: RpcCanFrame[] = []
    const rest: RpcCanFrame[] = []
    for (const frame of queue) {
      if (out.length < max && frame.controllerId === controllerId) {
        out.push(frame)
      } else {
        rest.push(frame)
      }
    }
    queue.splice(0, queue.length, ...rest)
    return out
  }

  private modeToTransition(mode: string): CanModeTransition {
    const m = mode.toUpperCase()
    if (m === 'CAN_CS_STARTED' || m === 'STARTED' || m === 'CAN_T_START' || m === 'CS_STARTED') {
      return 'CAN_T_START'
    }
    if (m === 'CAN_CS_STOPPED' || m === 'STOPPED' || m === 'CAN_T_STOP' || m === 'CS_STOPPED') {
      return 'CAN_T_STOP'
    }
    if (m === 'CAN_CS_SLEEP' || m === 'SLEEP' || m === 'CAN_T_SLEEP' || m === 'CS_SLEEP') {
      return 'CAN_T_SLEEP'
    }
    if (m === 'CAN_T_WAKEUP' || m === 'WAKEUP') {
      return 'CAN_T_WAKEUP'
    }
    throw new RpcError(RPC_INVALID_PARAMS, `unknown mode/transition "${mode}"`)
  }

  private transitionToMode(
    current: CanControllerMode,
    transition: CanModeTransition
  ): CanControllerMode {
    if (transition === 'CAN_T_START') {
      return 'CAN_CS_STARTED'
    }
    if (transition === 'CAN_T_STOP') {
      return 'CAN_CS_STOPPED'
    }
    if (transition === 'CAN_T_SLEEP') {
      return 'CAN_CS_SLEEP'
    }
    if (transition === 'CAN_T_WAKEUP') {
      return current === 'CAN_CS_SLEEP' ? 'CAN_CS_STOPPED' : current
    }
    return current
  }

  private async applyMode(ctrl: ControllerState, next: CanControllerMode) {
    if (ctrl.mode === next) {
      this.queueMode(ctrl)
      return
    }
    if (next === 'CAN_CS_UNINIT') {
      await this.closeController(ctrl.controllerId)
      return
    }
    ctrl.mode = next
    this.queueMode(ctrl)
  }

  private queueMode(ctrl: ControllerState) {
    const indication: RpcModeIndication = { controllerId: ctrl.controllerId, mode: ctrl.mode }
    this.broadcast((session) => {
      this.pushBounded(session.modeQueue, indication)
      this.notifyIf(session, ctrl, 'can.controllerModeIndication', indication)
    })
  }

  private createPeriodTask(
    ctrl: ControllerState,
    message: CanMessage,
    periodMs: number,
    durationMs?: number
  ) {
    if (!ctrl.base) {
      throw new RpcError(RPC_NOT_STARTED, `controller ${ctrl.controllerId} has no hardware`)
    }
    if (ctrl.base.startPeriodSend) {
      const taskId = ctrl.base.startPeriodSend(message, periodMs, durationMs)
      this.periodTasks.set(taskId, {
        taskId,
        controllerId: ctrl.controllerId,
        hardware: true,
        message,
        periodMs
      })
      return taskId
    }
    const taskId = uuidv4()
    const timer = setInterval(() => {
      const current = this.controllers.get(ctrl.controllerId)
      if (!current || current.mode !== 'CAN_CS_STARTED' || !current.base) {
        return
      }
      current.base
        .writeBase(message.id, message.msgType, message.data, { name: message.name })
        .catch((err) => {
          if (typeof sysLog !== 'undefined') {
            sysLog.warn(`period send ${taskId} failed: ${err instanceof Error ? err.message : err}`)
          }
        })
    }, periodMs)
    const task: PeriodTask = {
      taskId,
      controllerId: ctrl.controllerId,
      timer,
      hardware: false,
      message,
      periodMs
    }
    if (durationMs && durationMs > 0) {
      task.durationTimer = setTimeout(() => this.clearPeriodTask(taskId), durationMs)
    }
    this.periodTasks.set(taskId, task)
    return taskId
  }

  private clearPeriodTask(taskId: string) {
    const task = this.periodTasks.get(taskId)
    if (!task) {
      throw new RpcError(RPC_NOT_FOUND, `period task ${taskId} not found`)
    }
    if (task.timer) {
      clearInterval(task.timer)
    }
    if (task.durationTimer) {
      clearTimeout(task.durationTimer)
    }
    const ctrl = this.controllers.get(task.controllerId)
    if (task.hardware && ctrl?.base?.stopPeriodSend) {
      ctrl.base.stopPeriodSend(taskId)
    }
    this.periodTasks.delete(taskId)
  }

  private clearControllerPeriod(controllerId: number) {
    for (const [id, task] of [...this.periodTasks.entries()]) {
      if (task.controllerId === controllerId) {
        try {
          this.clearPeriodTask(id)
        } catch {
          this.periodTasks.delete(id)
        }
      }
    }
  }
}

export function parseControllerArg(params: unknown, method: string): number {
  const obj = asObject(params, method)
  if (hasKey(obj, 'controller')) {
    return reqNumber(obj, 'controller', method)
  }
  return reqNumber(obj, 'controllerId', method)
}
