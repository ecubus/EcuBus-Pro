import net from 'net'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applySimulateRpcListen,
  DEFAULT_SIMULATE_RPC_HOST,
  DEFAULT_SIMULATE_RPC_PORT,
  getSimulateRpcStatus,
  setProjectSimulateCount
} from '../../src/cli/rpc/lifecycle'

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

async function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    const done = (ok: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

describe('simulate JSON-RPC lifecycle', () => {
  afterEach(async () => {
    await setProjectSimulateCount(0)
    await applySimulateRpcListen({
      host: DEFAULT_SIMULATE_RPC_HOST,
      port: DEFAULT_SIMULATE_RPC_PORT,
      enabled: true
    })
  })

  it('serializes stop and start so the last request owns the port', async () => {
    const port = await freePort()
    await applySimulateRpcListen({ host: '127.0.0.1', port, enabled: true })
    await setProjectSimulateCount(1)
    expect(getSimulateRpcStatus().listening).toBe(true)
    expect(await canConnect(port)).toBe(true)

    await Promise.all([
      setProjectSimulateCount(0),
      setProjectSimulateCount(1),
      setProjectSimulateCount(0),
      setProjectSimulateCount(1)
    ])

    const status = getSimulateRpcStatus()
    expect(status.listening).toBe(true)
    expect(status.error).toBeUndefined()
    expect(status.projectSimulateCount).toBe(1)
    expect(await canConnect(port)).toBe(true)

    const stopped = setProjectSimulateCount(0)
    const restarted = await setProjectSimulateCount(1)
    await stopped
    expect(restarted.listening).toBe(true)
    expect(restarted.error).toBeUndefined()
    expect(await canConnect(port)).toBe(true)

    await setProjectSimulateCount(0)
    expect(getSimulateRpcStatus().listening).toBe(false)
    expect(await canConnect(port)).toBe(false)
  })
})
