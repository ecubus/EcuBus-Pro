export const RPC_PARSE_ERROR = -32700
export const RPC_INVALID_REQUEST = -32600
export const RPC_METHOD_NOT_FOUND = -32601
export const RPC_INVALID_PARAMS = -32602
export const RPC_INTERNAL_ERROR = -32603

/** Application: CAN / MCAL driver error */
export const RPC_CAN_ERROR = -32000
/** Application: controller / device not found or not open */
export const RPC_NOT_FOUND = -32001
/** Application: controller is not in the required mode */
export const RPC_NOT_STARTED = -32002
/** Application: hardware object (HTH/HRH) not found */
export const RPC_HOH_NOT_FOUND = -32003
/** Application: timeout */
export const RPC_TIMEOUT = -32004
/** Application: already initialized / busy */
export const RPC_ALREADY = -32005

export class RpcError extends Error {
  code: number
  data?: unknown

  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.data = data
  }
}

export function isRpcError(err: unknown): err is RpcError {
  return err instanceof RpcError
}
