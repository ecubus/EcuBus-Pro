import {
  RPC_INVALID_REQUEST,
  RPC_PARSE_ERROR,
  RpcError
} from './errors'
import type { JsonRpcNotification, JsonRpcRequest, JsonRpcResponse } from './types'

const MAX_FRAME = 1024 * 1024

function isWhitespace(n: number) {
  return n === 0x20 || n === 0x09 || n === 0x0a || n === 0x0d
}

/**
 * Return the end index (exclusive) of a complete JSON value starting at `start`,
 * or -1 if the value is incomplete.
 */
export function findJsonEnd(text: string, start = 0): number {
  let i = start
  while (i < text.length && isWhitespace(text.charCodeAt(i))) {
    i++
  }
  if (i >= text.length) {
    return -1
  }
  const first = text[i]
  if (first !== '{' && first !== '[') {
    // primitives: number / string / true / false / null — used rarely; scan to whitespace/end
    if (first === '"') {
      i++
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2
          continue
        }
        if (text[i] === '"') {
          return i + 1
        }
        i++
      }
      return -1
    }
    while (i < text.length && !isWhitespace(text.charCodeAt(i))) {
      i++
    }
    return i
  }

  const stack: string[] = [first]
  i++
  let inString = false
  while (i < text.length) {
    const ch = text[i]
    if (inString) {
      if (ch === '\\') {
        i += 2
        continue
      }
      if (ch === '"') {
        inString = false
      }
      i++
      continue
    }
    if (ch === '"') {
      inString = true
      i++
      continue
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch)
    } else if (ch === '}' || ch === ']') {
      const open = stack.pop()
      if ((ch === '}' && open !== '{') || (ch === ']' && open !== '[')) {
        throw new RpcError(RPC_PARSE_ERROR, 'Parse error: mismatched JSON brackets')
      }
      if (stack.length === 0) {
        return i + 1
      }
    }
    i++
  }
  return -1
}

export function encodeResponse(resp: JsonRpcResponse): string {
  return JSON.stringify(resp)
}

export function encodeNotification(method: string, params?: unknown): string {
  const msg: JsonRpcNotification = { jsonrpc: '2.0', method }
  if (params !== undefined) {
    msg.params = params
  }
  return JSON.stringify(msg)
}

export function makeSuccess(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', result, id }
}

export function makeError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  const error: JsonRpcResponse = {
    jsonrpc: '2.0',
    error: { code, message },
    id
  }
  if (data !== undefined && 'error' in error) {
    error.error.data = data
  }
  return error
}

export function isNotification(req: JsonRpcRequest): boolean {
  return req.id === undefined
}

export function validateRequest(raw: unknown): JsonRpcRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RpcError(RPC_INVALID_REQUEST, 'Invalid Request')
  }
  const req = raw as JsonRpcRequest
  if (req.jsonrpc !== undefined && req.jsonrpc !== '2.0') {
    throw new RpcError(RPC_INVALID_REQUEST, 'Invalid Request: jsonrpc must be "2.0"')
  }
  if (typeof req.method !== 'string' || req.method.length === 0) {
    throw new RpcError(RPC_INVALID_REQUEST, 'Invalid Request: method must be a string')
  }
  if (
    req.id !== undefined &&
    req.id !== null &&
    typeof req.id !== 'string' &&
    typeof req.id !== 'number'
  ) {
    throw new RpcError(RPC_INVALID_REQUEST, 'Invalid Request: id must be string, number, or null')
  }
  return req
}

/**
 * Streaming framer for JSON-RPC over TCP / stdio.
 * Accepts NDJSON, concatenated JSON, and LSP-style Content-Length frames.
 */
export class JsonRpcFramer {
  private buf = Buffer.alloc(0)
  private readonly maxSize: number

  constructor(maxSize = MAX_FRAME) {
    this.maxSize = maxSize
  }

  reset() {
    this.buf = Buffer.alloc(0)
  }

  push(chunk: Buffer | string): unknown[] {
    const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8')
    this.buf = Buffer.concat([this.buf, next])
    if (this.buf.length > this.maxSize) {
      this.reset()
      throw new RpcError(RPC_PARSE_ERROR, `Parse error: frame exceeds ${this.maxSize} bytes`)
    }
    const messages: unknown[] = []
    while (true) {
      const msg = this.tryRead()
      if (msg === undefined) {
        break
      }
      messages.push(msg)
    }
    return messages
  }

  private tryRead(): unknown | undefined {
    let i = 0
    while (i < this.buf.length && isWhitespace(this.buf[i])) {
      i++
    }
    if (i >= this.buf.length) {
      this.buf = Buffer.alloc(0)
      return undefined
    }

    const head = this.buf.slice(i).toString('utf8')
    if (/^content-length\s*:/i.test(head)) {
      return this.tryReadContentLength(i)
    }

    const end = findJsonEnd(head, 0)
    if (end < 0) {
      return undefined
    }
    const jsonText = head.slice(0, end)
    this.buf = this.buf.slice(i + Buffer.byteLength(jsonText, 'utf8'))
    try {
      return JSON.parse(jsonText)
    } catch {
      throw new RpcError(RPC_PARSE_ERROR, 'Parse error')
    }
  }

  private tryReadContentLength(start: number): unknown | undefined {
    const text = this.buf.slice(start).toString('utf8')
    const headerEnd = text.search(/\r\n\r\n|\n\n/)
    if (headerEnd < 0) {
      return undefined
    }
    const sepLen = text.startsWith('\r\n\r\n', headerEnd) ? 4 : 2
    const headers = text.slice(0, headerEnd)
    const match = headers.match(/content-length\s*:\s*(\d+)/i)
    if (!match) {
      throw new RpcError(RPC_PARSE_ERROR, 'Parse error: missing Content-Length')
    }
    const length = Number(match[1])
    const bodyStart = start + Buffer.byteLength(text.slice(0, headerEnd + sepLen), 'utf8')
    if (this.buf.length < bodyStart + length) {
      return undefined
    }
    const body = this.buf.slice(bodyStart, bodyStart + length).toString('utf8')
    this.buf = this.buf.slice(bodyStart + length)
    try {
      return JSON.parse(body)
    } catch {
      throw new RpcError(RPC_PARSE_ERROR, 'Parse error')
    }
  }
}
