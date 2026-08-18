import net from 'net'
import fs from 'fs'
import { CanRpcService, CanRpcServiceOptions, RpcSession } from './canService'
import {
  RPC_INTERNAL_ERROR,
  RPC_INVALID_REQUEST,
  RPC_PARSE_ERROR,
  RpcError,
  isRpcError
} from './errors'
import { dispatchRpc } from './methods'
import {
  JsonRpcFramer,
  encodeNotification,
  encodeResponse,
  isNotification,
  makeError,
  makeSuccess,
  validateRequest
} from './protocol'
import type { JsonRpcRequest, JsonRpcResponse } from './types'

export interface RpcListenOptions {
  host?: string
  port?: number
  stdio?: boolean
  socket?: string
  exitOnDisconnect?: boolean
  serviceOptions?: CanRpcServiceOptions
}

export interface RpcServerHandle {
  host: string
  port: number
  socket?: string
  service: CanRpcService
  close: () => Promise<void>
}

async function handleMessage(
  raw: unknown,
  session: RpcSession,
  service: CanRpcService
): Promise<JsonRpcResponse | JsonRpcResponse[] | undefined> {
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return makeError(null, RPC_INVALID_REQUEST, 'Invalid Request: empty batch')
    }
    const responses: JsonRpcResponse[] = []
    for (const item of raw) {
      const resp = await handleSingle(item, session, service)
      if (resp) {
        responses.push(resp)
      }
    }
    return responses.length > 0 ? responses : undefined
  }
  return handleSingle(raw, session, service)
}

async function handleSingle(
  raw: unknown,
  session: RpcSession,
  service: CanRpcService
): Promise<JsonRpcResponse | undefined> {
  let req: JsonRpcRequest
  try {
    req = validateRequest(raw)
  } catch (err) {
    const rpc = isRpcError(err)
      ? err
      : new RpcError(RPC_INVALID_REQUEST, 'Invalid Request')
    return makeError(null, rpc.code, rpc.message, rpc.data)
  }
  const id = req.id === undefined ? undefined : (req.id as string | number | null)
  try {
    const result = await dispatchRpc(String(req.method), req.params, session, service)
    if (isNotification(req) || id === undefined) {
      return undefined
    }
    return makeSuccess(id, result)
  } catch (err) {
    if (isNotification(req) || id === undefined) {
      return undefined
    }
    if (isRpcError(err)) {
      return makeError(id, err.code, err.message, err.data)
    }
    const message = err instanceof Error ? err.message : String(err)
    return makeError(id, RPC_INTERNAL_ERROR, message)
  }
}

function writeFrame(socket: { write: (data: string) => void }, payload: unknown) {
  socket.write(JSON.stringify(payload) + '\n')
}

function attachConnection(
  socket: net.Socket,
  service: CanRpcService,
  onEmpty?: () => void,
  connections?: Set<net.Socket>
) {
  const framer = new JsonRpcFramer()
  const session = service.createSession((method, params) => {
    if (!socket.destroyed) {
      socket.write(encodeNotification(method, params) + '\n')
    }
  })
  connections?.add(socket)
  socket.setKeepAlive(true, 10000)
  socket.setNoDelay(true)

  const onData = async (chunk: Buffer) => {
    let messages: unknown[]
    try {
      messages = framer.push(chunk)
    } catch (err) {
      const rpc = isRpcError(err)
        ? err
        : new RpcError(RPC_PARSE_ERROR, 'Parse error')
      writeFrame(socket, makeError(null, rpc.code, rpc.message, rpc.data))
      framer.reset()
      return
    }
    for (const raw of messages) {
      const resp = await handleMessage(raw, session, service)
      if (resp !== undefined && !socket.destroyed) {
        writeFrame(socket, resp)
      }
    }
  }

  socket.on('data', (chunk) => {
    onData(chunk).catch((err) => {
      if (!socket.destroyed) {
        writeFrame(
          socket,
          makeError(null, RPC_INTERNAL_ERROR, err instanceof Error ? err.message : String(err))
        )
      }
    })
  })

  const cleanup = () => {
    service.dropSession(session)
    connections?.delete(socket)
    if (connections && connections.size === 0) {
      onEmpty?.()
    }
  }
  socket.on('close', cleanup)
  socket.on('error', cleanup)
}

export async function startRpcServer(options: RpcListenOptions = {}): Promise<RpcServerHandle> {
  const connections = new Set<net.Socket>()
  let server: net.Server | undefined
  let closed = false

  const service = new CanRpcService({
    ...options.serviceOptions,
    onShutdown: async () => {
      await options.serviceOptions?.onShutdown?.()
      await close()
    }
  })

  const close = async () => {
    if (closed) {
      return
    }
    closed = true
    await service.closeAll()
    for (const socket of connections) {
      socket.destroy()
    }
    connections.clear()
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => resolve())
      })
    }
  }

  const onEmpty = () => {
    if (options.exitOnDisconnect) {
      close().then(() => process.exit(0))
    }
  }

  if (options.stdio) {
    const stdin = process.stdin
    const stdout = process.stdout
    const framer = new JsonRpcFramer()
    const session = service.createSession((method, params) => {
      stdout.write(encodeNotification(method, params) + '\n')
    })
    stdin.on('data', (chunk) => {
      const run = async () => {
        let messages: unknown[]
        try {
          messages = framer.push(chunk)
        } catch (err) {
          const rpc = isRpcError(err)
            ? err
            : new RpcError(RPC_PARSE_ERROR, 'Parse error')
          stdout.write(encodeResponse(makeError(null, rpc.code, rpc.message, rpc.data)) + '\n')
          framer.reset()
          return
        }
        for (const raw of messages) {
          const resp = await handleMessage(raw, session, service)
          if (resp !== undefined) {
            stdout.write(JSON.stringify(resp) + '\n')
          }
        }
      }
      run().catch((err) => {
        stdout.write(
          encodeResponse(
            makeError(null, RPC_INTERNAL_ERROR, err instanceof Error ? err.message : String(err))
          ) + '\n'
        )
      })
    })
    stdin.on('end', () => {
      service.dropSession(session)
      close().then(() => {
        if (options.exitOnDisconnect !== false) {
          process.exit(0)
        }
      })
    })
    stdin.resume()
    return {
      host: 'stdio',
      port: 0,
      service,
      close
    }
  }

  if (options.socket) {
    try {
      if (fs.existsSync(options.socket)) {
        fs.unlinkSync(options.socket)
      }
    } catch {
      // ignore
    }
    server = net.createServer((socket) => attachConnection(socket, service, onEmpty, connections))
    await new Promise<void>((resolve, reject) => {
      server!.listen(options.socket, () => resolve())
      server!.on('error', reject)
    })
    return {
      host: 'unix',
      port: 0,
      socket: options.socket,
      service,
      close
    }
  }

  const host = options.host || '127.0.0.1'
  const port = options.port ?? 17320
  server = net.createServer((socket) => attachConnection(socket, service, onEmpty, connections))
  await new Promise<void>((resolve, reject) => {
    server!.listen(port, host, () => resolve())
    server!.on('error', reject)
  })
  const addr = server.address()
  const boundPort = typeof addr === 'object' && addr ? addr.port : port
  const boundHost = typeof addr === 'object' && addr ? addr.address : host
  return {
    host: boundHost,
    port: boundPort,
    service,
    close
  }
}
