import net from 'net'
import { deepEqual, equal, ok, rejects } from 'node:assert/strict'
import { afterEach, describe, it } from 'vitest'
import { CAN_TP } from '../../src/main/docan/cantp'
import { RENODE_CAN } from '../../src/main/docan/renode'
import {
  CAN_ADDR_FORMAT,
  CAN_ADDR_TYPE,
  CAN_ERROR_ID,
  CAN_ID_TYPE,
  CanAddr,
  CanError,
  CanMessage,
  CanMsgType
} from '../../src/main/share/can'

const CMD_CHECK_VERSION = 0
const CMD_GET_MACHINE = 3
const CMD_CAN_BUS = 9
const TYPE_REQUEST = 0
const TYPE_EVENT = 1
const TYPE_SUCCESS = 2
const TYPE_ERROR = 4
const MACHINE_ID = 7
const INSTANCE_ID = 4

const classic: CanMsgType = {
  idType: CAN_ID_TYPE.STANDARD,
  brs: false,
  remote: false,
  canfd: false
}

interface Frame {
  id: number
  payload: Buffer
}

class Peer {
  private buf = Buffer.alloc(0)
  private queue: Frame[] = []
  private waiters: Array<(frame: Frame) => void> = []

  constructor(private socket: net.Socket) {
    socket.on('error', () => undefined)
    socket.on('data', (chunk: Buffer) => {
      this.buf = Buffer.concat([this.buf, chunk])
      while (this.buf.length >= 6) {
        const id = this.buf.readUInt16LE(0)
        const size = this.buf.readUInt32LE(2)
        if (this.buf.length < 6 + size) return
        const payload = Buffer.from(this.buf.subarray(6, 6 + size))
        this.buf = this.buf.subarray(6 + size)
        const frame = { id, payload }
        const waiter = this.waiters.shift()
        if (waiter) waiter(frame)
        else this.queue.push(frame)
      }
    })
  }

  next(): Promise<Frame> {
    const queued = this.queue.shift()
    if (queued) return Promise.resolve(queued)
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  send(id: number, payload: Buffer) {
    const frame = Buffer.alloc(6 + payload.length)
    frame.writeUInt16LE(id, 0)
    frame.writeUInt32LE(payload.length, 2)
    payload.copy(frame, 6)
    this.socket.write(frame)
  }
}

function command(value: number, type: number, extra?: Buffer): Buffer {
  const head = Buffer.alloc(3)
  head.writeUInt16LE(value, 0)
  head.writeUInt8(type, 2)
  return extra ? Buffer.concat([head, extra]) : head
}

function i32(value: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeInt32LE(value, 0)
  return buf
}

function headerOf(payload: Buffer) {
  return {
    command: payload.readUInt16LE(0),
    type: payload.readUInt8(2),
    body: payload.subarray(3)
  }
}

function canEvent(canId: number, data: Buffer): Buffer {
  const body = Buffer.alloc(20 + data.length)
  body.writeInt32LE(0, 0)
  body.writeBigUInt64LE(0n, 4)
  body.writeInt32LE(data.length, 12)
  body.writeUInt32LE(canId, 16)
  data.copy(body, 20)
  return command(CMD_CAN_BUS, TYPE_EVENT, body)
}

async function handshake(peer: Peer, expectedMachine = 'machine-0') {
  const versionFrame = await peer.next()
  const version = headerOf(versionFrame.payload)
  equal(version.command, CMD_CHECK_VERSION)
  equal(version.type, TYPE_REQUEST)
  equal(version.body.readUInt32LE(0), 0)
  equal(versionFrame.id & 0x8000, 0x8000)
  peer.send(versionFrame.id, command(CMD_CHECK_VERSION, TYPE_SUCCESS))

  const machineFrame = await peer.next()
  const machine = headerOf(machineFrame.payload)
  equal(machine.command, CMD_GET_MACHINE)
  const nameLen = machine.body.readUInt32LE(0)
  equal(machine.body.subarray(4, 4 + nameLen).toString('utf8'), expectedMachine)
  peer.send(machineFrame.id, command(CMD_GET_MACHINE, TYPE_SUCCESS, i32(MACHINE_ID)))

  const canFrame = await peer.next()
  const can = headerOf(canFrame.payload)
  equal(can.command, CMD_CAN_BUS)
  equal(can.body.readInt32LE(0), -1)
  equal(can.body.readInt32LE(4), MACHINE_ID)
  const busLen = can.body.readUInt32LE(8)
  equal(can.body.subarray(12, 12 + busLen).toString('utf8'), 'sysbus.can_external')
  peer.send(canFrame.id, command(CMD_CAN_BUS, TYPE_SUCCESS, i32(INSTANCE_ID)))

  const registeredFrame = await peer.next()
  const registered = headerOf(registeredFrame.payload)
  equal(registered.command, CMD_CAN_BUS)
  equal(registered.body.readInt32LE(0), INSTANCE_ID)
  equal(registered.body.readInt8(4), 2)
  equal(registered.body.readInt32LE(5), 0)
  peer.send(registeredFrame.id, command(CMD_CAN_BUS, TYPE_SUCCESS))
}

describe('renode external control', () => {
  let server: net.Server | undefined
  let device: RENODE_CAN | undefined
  const sockets = new Set<net.Socket>()

  async function startServer() {
    server = net.createServer((socket) => {
      sockets.add(socket)
      socket.on('error', () => undefined)
      socket.on('close', () => sockets.delete(socket))
    })
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const connected = new Promise<net.Socket>((resolve) => server?.once('connection', resolve))
    return { port, connected }
  }

  afterEach(async () => {
    device?.close()
    device = undefined
    for (const socket of sockets) {
      socket.destroy()
    }
    sockets.clear()
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()))
      server = undefined
    }
  })

  it('fails when Renode is not listening', async () => {
    server = net.createServer()
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    await new Promise<void>((resolve) => server?.close(() => resolve()))
    server = undefined
    device = new RENODE_CAN({
      id: 'renode-test',
      name: 'RENODE_0',
      handle: 'renode',
      vendor: 'renode',
      canfd: false,
      bitrate: { freq: 500000, timeSeg1: 1, timeSeg2: 1, sjw: 1, preScaler: 1 },
      renodeHost: '127.0.0.1',
      renodePort: port
    })
    const closed = new Promise<string>((resolve) => {
      device?.event.once('close', (message: string) => resolve(message))
    })
    await rejects(device.ready, (err: unknown) => {
      equal(err instanceof Error, true)
      return (err as Error).message.includes(`127.0.0.1:${port}`)
    })
    equal((await closed).includes(`127.0.0.1:${port}`), true)
  })

  it('settles ready immediately when closed during connect', async () => {
    const { port } = await startServer()
    device = new RENODE_CAN({
      id: 'renode-test',
      name: 'RENODE_0',
      handle: 'renode',
      vendor: 'renode',
      canfd: false,
      bitrate: { freq: 500000, timeSeg1: 1, timeSeg2: 1, sjw: 1, preScaler: 1 },
      renodeHost: '127.0.0.1',
      renodePort: port
    })
    const started = Date.now()
    device.close()
    await rejects(device.ready)
    ok(Date.now() - started < 1000)
  })

  it('handshakes with instanceId, orders TX before early RX, pads CAN-FD, and validates params', async () => {
    const { port, connected } = await startServer()
    device = new RENODE_CAN({
      id: 'renode-test',
      name: 'RENODE_0',
      handle: 'renode',
      vendor: 'renode',
      canfd: true,
      bitrate: { freq: 500000, timeSeg1: 1, timeSeg2: 1, sjw: 1, preScaler: 1 },
      renodeHost: '127.0.0.1',
      renodePort: port,
      renodeMachine: 'machine-0',
      renodeBus: 'sysbus.can_external'
    })
    const peer = new Peer(await connected)
    await handshake(peer, 'machine-0')
    await device.ready

    const logged: CanMessage[] = []
    device.attachCanMessage((msg) => logged.push(msg))

    const rxType: CanMsgType = { ...classic, idType: CAN_ID_TYPE.EXTENDED }
    const rxPromise = device.readBase(0x18ff50e5, rxType, 2000)
    const txPromise = device.writeBase(0x123, classic, Buffer.from([1, 2, 3]))

    const sent = await peer.next()
    equal(sent.id & 0x8000, 0x8000)
    const sentHeader = headerOf(sent.payload)
    equal(sentHeader.command, CMD_CAN_BUS)
    equal(sentHeader.type, TYPE_REQUEST)
    equal(sentHeader.body.readInt32LE(0), INSTANCE_ID)
    equal(sentHeader.body.readInt8(4), 0)
    equal(sentHeader.body.readInt32LE(5), 3)
    equal(sentHeader.body.readUInt32LE(9), 0x123)
    deepEqual([...sentHeader.body.subarray(13, 16)], [1, 2, 3])

    peer.send(1, canEvent(0x18ff50e5, Buffer.from([9, 8])))
    const ack = await peer.next()
    equal(ack.id, 1)
    const ackHeader = headerOf(ack.payload)
    equal(ackHeader.command, CMD_CAN_BUS)
    equal(ackHeader.type, TYPE_SUCCESS)
    peer.send(sent.id, command(CMD_CAN_BUS, TYPE_SUCCESS))

    const rx = await rxPromise
    deepEqual([...rx.data], [9, 8])
    const txTs = await txPromise
    equal(typeof txTs, 'number')
    ok(rx.ts >= txTs)
    equal(logged[0]?.dir, 'OUT')
    equal(logged[1]?.dir, 'IN')

    // Non-standard CAN-FD length (10 bytes) is padded to 12 bytes.
    const fd = Buffer.alloc(10, 0xab)
    const fdPromise = device.writeBase(0x42, { ...classic, canfd: true, brs: true }, fd)
    const fdFrame = await peer.next()
    const fdHeader = headerOf(fdFrame.payload)
    equal(fdHeader.body.readInt32LE(5), 12)
    equal(fdHeader.body.readUInt32LE(9), 0x42)
    deepEqual([...fdHeader.body.subarray(13, 25)], [...fd, 0, 0])
    peer.send(fdFrame.id, command(CMD_CAN_BUS, TYPE_SUCCESS))
    await fdPromise

    // Malformed CAN event receives TYPE_ERROR.
    peer.send(2, command(CMD_CAN_BUS, TYPE_EVENT, Buffer.alloc(4)))
    const errAck = await peer.next()
    equal(errAck.id, 2)
    const errHeader = headerOf(errAck.payload)
    equal(errHeader.command, CMD_CAN_BUS)
    equal(errHeader.type, TYPE_ERROR)

    // Validation checks: RTR and invalid IDs (NaN / out-of-range).
    await rejects(
      device.writeBase(1, { ...classic, remote: true }, Buffer.alloc(0)),
      (err: unknown) => err instanceof CanError && err.errorId === CAN_ERROR_ID.CAN_PARAM_ERROR
    )
    await rejects(
      device.writeBase(Number.NaN, classic, Buffer.from([1])),
      (err: unknown) => err instanceof CanError && err.errorId === CAN_ERROR_ID.CAN_PARAM_ERROR
    )
    await rejects(
      device.writeBase(0x800, classic, Buffer.from([1])),
      (err: unknown) => err instanceof CanError && err.errorId === CAN_ERROR_ID.CAN_PARAM_ERROR
    )
  })

  it('routes CAN-FD/BRS, <=0x7FF extended frames, and CAN_TP flow control arriving before FF ack', async () => {
    const { port, connected } = await startServer()
    device = new RENODE_CAN({
      id: 'renode-test',
      name: 'RENODE_0',
      handle: 'renode',
      vendor: 'renode',
      canfd: true,
      bitrate: { freq: 500000, timeSeg1: 1, timeSeg2: 1, sjw: 1, preScaler: 1 },
      renodeHost: '127.0.0.1',
      renodePort: port
    })
    const peer = new Peer(await connected)
    await handshake(peer)
    await device.ready

    // Low extended ID (<= 0x7FF) and CAN-FD+BRS <= 8-byte frames still match listeners.
    const lowExt = device.readBase(0x100, { ...classic, idType: CAN_ID_TYPE.EXTENDED }, 2000)
    peer.send(10, canEvent(0x100, Buffer.from([0xaa, 0xbb])))
    await peer.next()
    deepEqual([...(await lowExt).data], [0xaa, 0xbb])

    const fdBrs = device.readBase(0x7e8, { ...classic, canfd: true, brs: true }, 2000)
    peer.send(11, canEvent(0x7e8, Buffer.from([0x02, 0x50, 0x01])))
    await peer.next()
    deepEqual([...(await fdBrs).data], [0x02, 0x50, 0x01])

    // CAN_TP multi-frame TX over CAN-FD+BRS where ECU sends 8-byte FC before FF TYPE_SUCCESS.
    const tp = new CAN_TP(device)
    const addr: CanAddr = {
      name: 'fd-uds',
      addrFormat: CAN_ADDR_FORMAT.NORMAL,
      addrType: CAN_ADDR_TYPE.PHYSICAL,
      idType: CAN_ID_TYPE.STANDARD,
      canfd: true,
      brs: true,
      remote: false,
      SA: '0x00',
      TA: '0x01',
      AE: '0x00',
      canIdTx: '0x7e0',
      canIdRx: '0x7e8',
      nAs: 1000,
      nAr: 1000,
      nBs: 1000,
      nCr: 1000,
      stMin: 0,
      bs: 0,
      maxWTF: 0,
      dlc: 8,
      padding: true,
      paddingValue: '0x00'
    }

    const writePromise = tp.writeTp(addr, Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
    const ff = await peer.next()
    const ffHeader = headerOf(ff.payload)
    equal(ffHeader.body.readUInt32LE(9), 0x7e0)
    // Deliver 8-byte Flow Control BEFORE acknowledging the First Frame.
    peer.send(12, canEvent(0x7e8, Buffer.from([0x30, 0x00, 0x00, 0, 0, 0, 0, 0])))
    const fcAck = await peer.next()
    equal(fcAck.id, 12)
    peer.send(ff.id, command(CMD_CAN_BUS, TYPE_SUCCESS))

    // Consecutive frame follows immediately after FC is accepted.
    const cf = await peer.next()
    const cfHeader = headerOf(cf.payload)
    equal(cfHeader.body.readUInt32LE(9), 0x7e0)
    equal(cfHeader.body[13], 0x21)
    peer.send(cf.id, command(CMD_CAN_BUS, TYPE_SUCCESS))
    await writePromise
    tp.close(false)
  })

  it('rejects CAN-FD writes when disabled, resets startTs, and aborts pending reads cleanly', async () => {
    const { port, connected } = await startServer()
    device = new RENODE_CAN({
      id: 'renode-test',
      name: 'RENODE_0',
      handle: 'renode',
      vendor: 'renode',
      canfd: false,
      bitrate: { freq: 500000, timeSeg1: 1, timeSeg2: 1, sjw: 1, preScaler: 1 },
      renodeHost: '127.0.0.1',
      renodePort: port
    })
    const peer = new Peer(await connected)
    await handshake(peer)
    await device.ready

    await rejects(
      device.writeBase(0x100, { ...classic, canfd: true }, Buffer.from([1, 2, 3])),
      (err: unknown) => err instanceof CanError && err.errorId === CAN_ERROR_ID.CAN_PARAM_ERROR
    )

    await new Promise((resolve) => setTimeout(resolve, 25))
    device.resetStartTs()
    const rxPromise = device.readBase(0x200, classic, 2000)
    peer.send(20, canEvent(0x200, Buffer.from([0x55])))
    await peer.next()
    const rx = await rxPromise
    ok(rx.ts < 20_000)

    const pendingRead = device.readBase(0x201, classic, 60_000)
    device.close()
    await rejects(
      pendingRead,
      (err: unknown) =>
        err instanceof CanError &&
        err.errorId === CAN_ERROR_ID.CAN_BUS_CLOSED &&
        err.message.includes('closed')
    )
  })
})
