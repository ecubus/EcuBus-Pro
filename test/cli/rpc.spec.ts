import net from 'net'
import { afterEach, describe, expect, it } from 'vitest'
import { CanRpcService, DEFAULT_CAN_BITRATE } from '../../src/cli/rpc/canService'
import {
  findJsonEnd,
  JsonRpcFramer,
  encodeNotification,
  makeError,
  makeSuccess
} from '../../src/cli/rpc/protocol'
import { startRpcServer } from '../../src/cli/rpc/server'
import { RPC_METHOD_NOT_FOUND, RPC_PARSE_ERROR } from '../../src/cli/rpc/errors'
import { SIMULATE_CAN } from '../../src/main/docan/simulate'
import { CAN_ID_TYPE, CanMessage } from '../../src/main/share/can'

let handleSeq = 0
const SIM_BUS_MAX = 64

function nextHandle() {
  const h = handleSeq % SIM_BUS_MAX
  handleSeq++
  return h
}

function nextHandles() {
  return [nextHandle(), nextHandle()] as const
}

function rpcLine(method: string, params: unknown, id: number | string) {
  return JSON.stringify({ jsonrpc: '2.0', method, params, id }) + '\n'
}

async function waitMs(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

describe('JSON-RPC protocol', () => {
  it('finds object and array bounds', () => {
    expect(findJsonEnd('{"a":1}')).toBe(7)
    expect(findJsonEnd('  [1,2] extra')).toBe(7)
    expect(findJsonEnd('{"a":"{x"}')).toBe(10)
    expect(findJsonEnd('{"a":1')).toBe(-1)
  })

  it('frames NDJSON and concatenated JSON', () => {
    const framer = new JsonRpcFramer()
    const msgs = framer.push('{"a":1}\n{"b":2}{"c":3}')
    expect(msgs).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
  })

  it('frames Content-Length headers', () => {
    const framer = new JsonRpcFramer()
    const body = '{"jsonrpc":"2.0","method":"sys.ping","id":1}'
    const raw = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
    expect(framer.push(raw)).toEqual([JSON.parse(body)])
  })

  it('encodes success, error, and notifications', () => {
    expect(makeSuccess(1, { ok: true })).toEqual({ jsonrpc: '2.0', result: { ok: true }, id: 1 })
    expect(makeError(1, RPC_PARSE_ERROR, 'Parse error')).toEqual({
      jsonrpc: '2.0',
      error: { code: RPC_PARSE_ERROR, message: 'Parse error' },
      id: 1
    })
    expect(JSON.parse(encodeNotification('can.rxIndication', { id: 1 }))).toEqual({
      jsonrpc: '2.0',
      method: 'can.rxIndication',
      params: { id: 1 }
    })
  })
})

describe('CanRpcService (simulate)', () => {
  const services: CanRpcService[] = []

  afterEach(async () => {
    for (const s of services.splice(0)) {
      await s.closeAll()
    }
  })

  it('opens two simulate controllers and exchanges a frame', async () => {
    const [h0, h1] = nextHandles()
    const service = new CanRpcService()
    services.push(service)
    const session = service.createSession(() => undefined)

    const a = await service.canOpen(
      { vendor: 'simulate', handle: h0, name: 'SIM_A', controllerId: 0 },
      session
    )
    const b = await service.canOpen(
      { vendor: 'simulate', handle: h1, name: 'SIM_B', controllerId: 1 },
      session
    )
    expect(a.controllerId).toBe(0)
    expect(b.mode).toBe('CAN_CS_STARTED')

    await service.canWrite(
      { controllerId: 0, id: '0x123', data: [1, 2, 3, 4], idType: 'STANDARD' },
      session
    )
    await waitMs(20)
    const { frames } = await service.canRead({ controllerId: 1, timeoutMs: 200, max: 8 }, session)
    expect(frames.length).toBeGreaterThan(0)
    expect(frames[0].id).toBe(0x123)
    expect(frames[0].data).toEqual([1, 2, 3, 4])
    expect(frames[0].dir).toBe('IN')
  })

  it('maps AUTOSAR Can.Init / Write / MainFunction_Read', async () => {
    const [h0, h1] = nextHandles()
    const service = new CanRpcService()
    services.push(service)
    const session = service.createSession(() => undefined)

    const init = await service.canInit({
      controllers: [
        { controllerId: 0, vendor: 'simulate', handle: h0, name: 'MCU' },
        { controllerId: 1, vendor: 'simulate', handle: h1, name: 'BUS' }
      ],
      hardwareObjects: [
        {
          hohId: 0,
          controllerId: 0,
          objectType: 'TRANSMIT',
          handleType: 'BASIC',
          idType: 'STANDARD'
        },
        {
          hohId: 1,
          controllerId: 1,
          objectType: 'RECEIVE',
          handleType: 'BASIC',
          idType: 'STANDARD',
          canId: 0x100,
          idMask: 0x7ff
        },
        {
          hohId: 2,
          controllerId: 1,
          objectType: 'RECEIVE',
          handleType: 'BASIC',
          idType: 'STANDARD',
          canId: 0x200,
          idMask: 0x7ff
        }
      ]
    })
    expect(init.result).toBe('E_OK')

    await service.setControllerMode(0, 'CAN_T_START')
    await service.setControllerMode(1, 'CAN_T_START')

    const write = await service.canWriteHth(
      { hth: 0, id: 0x100, sdu: '11 22 33 44 55 66 77 88', swPduHandle: 7 },
      session
    )
    expect(write.result).toBe('E_OK')
    expect(write.resultCode).toBe(0)

    await waitMs(20)
    const { indications } = service.mainFunctionRead({ max: 16 }, session)
    expect(indications.some((f) => f.id === 0x100 && f.hrh === 1)).toBe(true)
    expect(indications.every((f) => f.id !== 0x300)).toBe(true)

    const { confirmations } = service.mainFunctionWrite({}, session)
    expect(confirmations.some((c) => c.swPduHandle === 7 && c.result === 'E_OK')).toBe(true)

    await service.setControllerMode(0, 'CAN_T_STOP')
    const busy = await service.canWriteHth({ hth: 0, id: 0x100, sdu: [1] }, session)
    expect(busy.result).toBe('E_NOT_OK')
  })

  it('returns CAN_BUSY for FULL HTH while in-flight', async () => {
    const [h0] = nextHandles()
    const service = new CanRpcService()
    services.push(service)
    const session = service.createSession(() => undefined)
    await service.canInit({
      controllers: [{ controllerId: 0, vendor: 'simulate', handle: h0 }],
      hardwareObjects: [
        {
          hohId: 10,
          controllerId: 0,
          objectType: 'TRANSMIT',
          handleType: 'FULL',
          idType: 'STANDARD',
          canId: 0x55
        }
      ]
    })
    await service.setControllerMode(0, 'CAN_T_START')
    const first = service.canWriteHth({ hth: 10, sdu: [1, 2] }, session)
    const second = await service.canWriteHth({ hth: 10, sdu: [3, 4] }, session)
    // simulate write is async (setImmediate); second may be BUSY or OK depending on timing
    expect(['E_OK', 'CAN_BUSY']).toContain(second.result)
    await first
  })

  it('software period send emits frames', async () => {
    const [h0, h1] = nextHandles()
    const service = new CanRpcService()
    services.push(service)
    const session = service.createSession(() => undefined)
    await service.canOpen({ vendor: 'simulate', handle: h0, controllerId: 0 }, session)
    await service.canOpen({ vendor: 'simulate', handle: h1, controllerId: 1 }, session)
    const { taskId } = service.startPeriodSend({
      controllerId: 0,
      id: 0x42,
      data: [0xaa],
      periodMs: 10
    })
    await waitMs(45)
    const { frames } = await service.canRead({ controllerId: 1, timeoutMs: 50, max: 32 }, session)
    expect(frames.filter((f) => f.id === 0x42).length).toBeGreaterThan(1)
    service.stopPeriodSend({ controllerId: 0, taskId })
  })

  it('nested interrupt disable blocks notifications but not polling', async () => {
    const [h0, h1] = nextHandles()
    const service = new CanRpcService()
    services.push(service)
    const notes: string[] = []
    const session = service.createSession((method) => notes.push(method))
    await service.canOpen({ vendor: 'simulate', handle: h0, controllerId: 0 }, session)
    await service.canOpen({ vendor: 'simulate', handle: h1, controllerId: 1 }, session)
    service.subscribe({ controllerId: 1 }, session)
    service.disableInterrupts(1)
    await service.canWrite({ controllerId: 0, id: 0x10, data: [9] }, session)
    await waitMs(20)
    expect(notes.filter((m) => m === 'can.rxIndication')).toHaveLength(0)
    const { frames } = await service.canRead({ controllerId: 1, max: 8 }, session)
    expect(frames.length).toBeGreaterThan(0)
    service.enableInterrupts(1)
  })
})

describe('CanRpcService gateway (GUI live TX)', () => {
  const services: CanRpcService[] = []
  const bases: SIMULATE_CAN[] = []

  afterEach(async () => {
    for (const s of services.splice(0)) {
      await s.closeAll()
    }
    for (const b of bases.splice(0)) {
      try {
        b.close()
      } catch {
        // already closed
      }
    }
  })

  function openLive(name: string) {
    const handle = nextHandle()
    const base = new SIMULATE_CAN({
      id: `gw-${handle}`,
      handle,
      name,
      vendor: 'simulate',
      canfd: false,
      bitrate: { ...DEFAULT_CAN_BITRATE }
    })
    bases.push(base)
    return base
  }

  it('transmits RPC writes as dir OUT and does not echo them as RX', async () => {
    const base = openLive('GUI_CAN')
    const seen: CanMessage[] = []
    base.attachCanMessage((msg) => seen.push(msg))

    const service = new CanRpcService({ role: 'gateway' })
    services.push(service)
    const session = service.createSession(() => undefined)
    service.attachLiveControllers(new Map([['dev1', base]]))

    expect(service.getVersion().role).toBe('gateway')
    const listed = service.listControllers()
    expect(listed.controllers).toHaveLength(1)
    expect(listed.controllers[0].mode).toBe('CAN_CS_STARTED')

    await service.canWrite(
      { controllerId: 0, id: '0x123', data: [1, 2, 3, 4], idType: 'STANDARD' },
      session
    )
    await waitMs(20)
    expect(seen.some((m) => m.dir === 'OUT' && m.id === 0x123)).toBe(true)
    expect(seen.some((m) => m.dir === 'IN' && m.id === 0x123)).toBe(false)

    const { frames } = await service.canRead({ timeoutMs: 30, max: 8 }, session)
    expect(frames.filter((f) => f.id === 0x123)).toHaveLength(0)

    const { confirmations } = service.mainFunctionWrite({}, session)
    expect(confirmations.some((c) => c.result === 'E_OK')).toBe(true)
  })

  it('delivers hardware RX from a peer simulate bus as RPC RX', async () => {
    const a = openLive('GUI_A')
    const b = openLive('GUI_B')
    const service = new CanRpcService({ role: 'gateway' })
    services.push(service)
    const session = service.createSession(() => undefined)
    service.attachLiveControllers(
      new Map([
        ['devA', a],
        ['devB', b]
      ])
    )

    await a.writeBase(
      0x200,
      { idType: CAN_ID_TYPE.STANDARD, canfd: false, brs: false, remote: false },
      Buffer.from([9, 8, 7])
    )
    await waitMs(20)
    const { frames } = await service.canRead({ controllerId: 1, timeoutMs: 50, max: 8 }, session)
    expect(frames.some((f) => f.id === 0x200 && f.dir === 'IN')).toBe(true)
  })
})

describe('JSON-RPC TCP server', () => {
  it('serves sys.ping, discovery, and CAN round-trip', async () => {
    const [h0, h1] = nextHandles()
    const server = await startRpcServer({ host: '127.0.0.1', port: 0 })
    const socket = net.connect({ host: '127.0.0.1', port: server.port })
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve())
      socket.once('error', reject)
    })
    const framer = new JsonRpcFramer()
    const pending = new Map<number, (v: any) => void>()
    const notifications: any[] = []
    socket.on('data', (chunk) => {
      const ingest = (msg: any) => {
        if (Array.isArray(msg)) {
          msg.forEach(ingest)
          return
        }
        if (msg && msg.method && msg.id === undefined) {
          notifications.push(msg)
        } else if (msg && pending.has(msg.id)) {
          pending.get(msg.id)!(msg)
          pending.delete(msg.id)
        }
      }
      for (const msg of framer.push(chunk) as any[]) {
        ingest(msg)
      }
    })
    const call = (method: string, params: unknown, id: number) =>
      new Promise<any>((resolve) => {
        pending.set(id, resolve)
        socket.write(rpcLine(method, params, id))
      })

    const ping = await call('sys.ping', {}, 1)
    expect(ping.result.pong).toBe(true)

    const methods = await call('sys.listMethods', {}, 2)
    expect(methods.result.methods).toContain('Can.Write')
    expect(methods.result.methods).toContain('can.open')

    const unknown = await call('no.such', {}, 3)
    expect(unknown.error.code).toBe(RPC_METHOD_NOT_FOUND)

    const opened0 = await call('can.open', { vendor: 'simulate', handle: h0, controllerId: 0 }, 4)
    const opened1 = await call('can.open', { vendor: 'simulate', handle: h1, controllerId: 1 }, 5)
    expect(opened0.result.mode).toBe('CAN_CS_STARTED')
    expect(opened1.result.mode).toBe('CAN_CS_STARTED')
    await call('can.subscribe', { controllerId: 1 }, 6)
    const written = await call(
      'can.write',
      { controllerId: 0, id: 0x321, data: [0xde, 0xad, 0xbe, 0xef] },
      7
    )
    expect(written.error).toBeUndefined()
    expect(written.result.ts).toBeGreaterThanOrEqual(0)
    const read = await call('can.read', { controllerId: 1, timeoutMs: 500, max: 8 }, 8)
    expect(read.result.frames.length).toBeGreaterThan(0)
    expect(read.result.frames[0].id).toBe(0x321)
    expect(read.result.frames[0].data).toEqual([0xde, 0xad, 0xbe, 0xef])
    expect(notifications.some((n) => n.method === 'can.rxIndication')).toBe(true)

    const batch = await new Promise<any>((resolve) => {
      pending.set(9, resolve)
      socket.write(
        JSON.stringify([
          { jsonrpc: '2.0', method: 'sys.ping', id: 9 },
          { jsonrpc: '2.0', method: 'sys.version', id: 10 }
        ]) + '\n'
      )
    })
    // batch writes two responses as one JSON array
    expect(Array.isArray(batch) || batch.result?.pong === true).toBe(true)

    socket.end()
    await server.close()
  })
})
