import type { CanBitrate, CanVendor, CAN_ID_TYPE } from 'src/main/share/can'

export type CanIdTypeName = 'STANDARD' | 'EXTENDED'
export type CanObjectType = 'TRANSMIT' | 'RECEIVE'
export type CanHandleType = 'BASIC' | 'FULL'
export type CanControllerMode = 'CAN_CS_UNINIT' | 'CAN_CS_STARTED' | 'CAN_CS_STOPPED' | 'CAN_CS_SLEEP'
export type CanErrorState =
  | 'CAN_ERRORSTATE_ACTIVE'
  | 'CAN_ERRORSTATE_PASSIVE'
  | 'CAN_ERRORSTATE_BUSOFF'
export type CanStdReturn = 'E_OK' | 'E_NOT_OK' | 'CAN_BUSY'
export type CanModeTransition = 'CAN_T_START' | 'CAN_T_STOP' | 'CAN_T_SLEEP' | 'CAN_T_WAKEUP'

export const CAN_STD_RETURN_CODE: Record<CanStdReturn, number> = {
  E_OK: 0,
  E_NOT_OK: 1,
  CAN_BUSY: 2
}

export interface RpcBitrate extends Partial<CanBitrate> {
  freq?: number
}

export interface RpcHardwareObjectConfig {
  hohId: number
  controllerId: number
  objectType: CanObjectType
  handleType?: CanHandleType
  idType?: CanIdTypeName
  canId?: number | string
  idMask?: number | string
  canfd?: boolean
  brs?: boolean
  remote?: boolean
  dlc?: number
}

export interface RpcControllerConfig {
  controllerId?: number
  vendor?: CanVendor | string
  handle?: unknown
  name?: string
  deviceId?: string
  deviceName?: string
  canfd?: boolean
  silent?: boolean
  bitrate?: RpcBitrate | number
  bitratefd?: RpcBitrate | number
  database?: string
}

export interface RpcCanInitConfig {
  controllers?: RpcControllerConfig[]
  hardwareObjects?: RpcHardwareObjectConfig[]
  rxQueueSize?: number
  baudRateConfigs?: Record<string, { bitrate: RpcBitrate | number; bitratefd?: RpcBitrate | number }>
}

export interface RpcCanFrame {
  controllerId: number
  hrh?: number
  hth?: number
  swPduHandle?: number
  id: number
  idHex: string
  data: number[]
  dataHex: string
  dlc: number
  length: number
  ts: number
  idType: CanIdTypeName
  canfd: boolean
  brs: boolean
  remote: boolean
  dir: 'IN' | 'OUT'
  name?: string
  device?: string
}

export interface RpcTxConfirmation {
  controllerId: number
  hth: number
  swPduHandle?: number
  ts?: number
  result: CanStdReturn
  resultCode: number
}

export interface RpcModeIndication {
  controllerId: number
  mode: CanControllerMode
}

export interface RpcControllerEvent {
  controllerId: number
  ts: number
  message?: string
}

export interface RpcMethodParam {
  name: string
  type: string
  required?: boolean
  summary?: string
}

export interface RpcMethodDescriptor {
  name: string
  summary: string
  params: RpcMethodParam[]
  autosar?: string
}

export interface JsonRpcRequest {
  jsonrpc?: string
  method?: unknown
  params?: unknown
  id?: string | number | null
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0'
  result: unknown
  id: string | number | null
}

export interface JsonRpcFailure {
  jsonrpc: '2.0'
  error: {
    code: number
    message: string
    data?: unknown
  }
  id: string | number | null
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

export type CanIdType = CAN_ID_TYPE
