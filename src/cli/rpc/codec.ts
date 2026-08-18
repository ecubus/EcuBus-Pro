import { CAN_ID_TYPE, CanMessage, CanMsgType, getDlcByLen } from 'src/main/share/can'
import { RPC_INVALID_PARAMS, RpcError } from './errors'
import type { CanIdTypeName, RpcCanFrame } from './types'

export function asObject(params: unknown, method: string): Record<string, unknown> {
  if (params == null) {
    return {}
  }
  if (typeof params === 'object' && !Array.isArray(params)) {
    return params as Record<string, unknown>
  }
  throw new RpcError(
    RPC_INVALID_PARAMS,
    `Invalid params for ${method}: expected a named object (JSON-RPC by-name)`
  )
}

export function hasKey(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined
}

export function reqNumber(obj: Record<string, unknown>, key: string, method: string): number {
  const v = obj[key]
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v
  }
  if (typeof v === 'string' && v.length > 0) {
    return parseCanId(v)
  }
  throw new RpcError(RPC_INVALID_PARAMS, `Invalid params for ${method}: "${key}" must be a number`)
}

export function optNumber(obj: Record<string, unknown>, key: string): number | undefined {
  if (!hasKey(obj, key)) {
    return undefined
  }
  const v = obj[key]
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v
  }
  if (typeof v === 'string' && v.length > 0) {
    return parseCanId(v)
  }
  throw new RpcError(RPC_INVALID_PARAMS, `Invalid params: "${key}" must be a number`)
}

export function reqString(obj: Record<string, unknown>, key: string, method: string): string {
  const v = obj[key]
  if (typeof v === 'string' && v.length > 0) {
    return v
  }
  throw new RpcError(RPC_INVALID_PARAMS, `Invalid params for ${method}: "${key}" must be a string`)
}

export function optString(obj: Record<string, unknown>, key: string): string | undefined {
  if (!hasKey(obj, key)) {
    return undefined
  }
  const v = obj[key]
  if (typeof v === 'string') {
    return v
  }
  throw new RpcError(RPC_INVALID_PARAMS, `Invalid params: "${key}" must be a string`)
}

export function optBool(obj: Record<string, unknown>, key: string): boolean | undefined {
  if (!hasKey(obj, key)) {
    return undefined
  }
  const v = obj[key]
  if (typeof v === 'boolean') {
    return v
  }
  throw new RpcError(RPC_INVALID_PARAMS, `Invalid params: "${key}" must be a boolean`)
}

export function parseCanId(input: unknown): number {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input >>> 0
  }
  if (typeof input === 'string') {
    const s = input.trim()
    if (/^0x[0-9a-f]+$/i.test(s)) {
      return parseInt(s, 16) >>> 0
    }
    if (/^[0-9]+$/.test(s)) {
      return parseInt(s, 10) >>> 0
    }
  }
  throw new RpcError(RPC_INVALID_PARAMS, `Invalid CAN id: ${String(input)}`)
}

export function parseCanData(input: unknown): Buffer {
  if (input == null) {
    return Buffer.alloc(0)
  }
  if (Buffer.isBuffer(input)) {
    return input
  }
  if (typeof input === 'string') {
    const hex = input.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '')
    if (hex.length === 0) {
      return Buffer.alloc(0)
    }
    if (hex.length % 2 !== 0) {
      throw new RpcError(RPC_INVALID_PARAMS, 'Invalid CAN data hex string (odd length)')
    }
    return Buffer.from(hex, 'hex')
  }
  if (Array.isArray(input)) {
    const bytes = input.map((v) => {
      const n = typeof v === 'string' ? parseCanId(v) : Number(v)
      if (!Number.isFinite(n) || n < 0 || n > 255) {
        throw new RpcError(RPC_INVALID_PARAMS, 'Invalid CAN data byte')
      }
      return n
    })
    return Buffer.from(bytes)
  }
  if (typeof input === 'object' && (input as { type?: string }).type === 'Buffer') {
    const data = (input as { data?: unknown }).data
    if (Array.isArray(data)) {
      return parseCanData(data)
    }
  }
  throw new RpcError(RPC_INVALID_PARAMS, 'Invalid CAN data: expected hex string or byte array')
}

export function parseIdType(input: unknown, fallback: CanIdTypeName = 'STANDARD'): CAN_ID_TYPE {
  if (input == null) {
    return fallback === 'EXTENDED' ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD
  }
  if (input === CAN_ID_TYPE.EXTENDED || input === 'EXTENDED' || input === 'extended' || input === 1) {
    return CAN_ID_TYPE.EXTENDED
  }
  if (input === CAN_ID_TYPE.STANDARD || input === 'STANDARD' || input === 'standard' || input === 0) {
    return CAN_ID_TYPE.STANDARD
  }
  throw new RpcError(RPC_INVALID_PARAMS, `Invalid idType: ${String(input)}`)
}

export function toIdTypeName(idType: CAN_ID_TYPE | string): CanIdTypeName {
  return idType === CAN_ID_TYPE.EXTENDED || idType === 'EXTENDED' ? 'EXTENDED' : 'STANDARD'
}

export function encodeDataHex(data: Buffer): string {
  return data.toString('hex')
}

export function encodeFrame(
  msg: CanMessage,
  extra: { controllerId: number; hrh?: number; hth?: number; swPduHandle?: number }
): RpcCanFrame {
  const data = Buffer.isBuffer(msg.data) ? msg.data : Buffer.from(msg.data || [])
  const canfd = !!msg.msgType.canfd
  return {
    controllerId: extra.controllerId,
    hrh: extra.hrh,
    hth: extra.hth,
    swPduHandle: extra.swPduHandle,
    id: msg.id,
    idHex: '0x' + msg.id.toString(16),
    data: Array.from(data),
    dataHex: encodeDataHex(data),
    dlc: getDlcByLen(data.length, canfd),
    length: data.length,
    ts: msg.ts ?? 0,
    idType: toIdTypeName(msg.msgType.idType),
    canfd,
    brs: !!msg.msgType.brs,
    remote: !!msg.msgType.remote,
    dir: msg.dir,
    name: msg.name,
    device: msg.device
  }
}

export function toMsgType(obj: Record<string, unknown>, defaults?: Partial<CanMsgType>): CanMsgType {
  return {
    idType: parseIdType(obj.idType, toIdTypeName(defaults?.idType ?? CAN_ID_TYPE.STANDARD)),
    brs: optBool(obj, 'brs') ?? defaults?.brs ?? false,
    canfd: optBool(obj, 'canfd') ?? defaults?.canfd ?? false,
    remote: optBool(obj, 'remote') ?? defaults?.remote ?? false
  }
}
