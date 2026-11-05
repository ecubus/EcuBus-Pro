import EventEmitter from 'events'
import { describe, expect, it } from 'vitest'
import {
  addrToId,
  CAN_ADDR_FORMAT,
  CAN_ADDR_TYPE,
  CAN_ID_TYPE,
  CanAddr,
  CanMessage,
  CanMsgType,
  swapAddr
} from 'src/main/share/can'
import { CAN_TP, CAN_TP_SOCKET } from 'src/main/docan/cantp'

// Normal Fixed tester: request 18DA00FA, response 18DAFA00
const testerAddr: CanAddr = {
  idType: CAN_ID_TYPE.EXTENDED,
  addrFormat: CAN_ADDR_FORMAT.FIXED_NORMAL,
  addrType: CAN_ADDR_TYPE.PHYSICAL,
  SA: '0xFA',
  TA: '0x00',
  AE: '',
  canIdTx: '0',
  canIdRx: '0',
  name: 'tester',
  canfd: false,
  brs: false,
  remote: false,
  nAs: 1000,
  nAr: 1000,
  nBs: 1000,
  nCr: 160,
  stMin: 0,
  bs: 0,
  maxWTF: 0,
  dlc: 8,
  padding: true,
  paddingValue: '0x00'
}

/**
 * CAN base whose TX confirmations are released manually, so tests can deliver
 * received frames before the confirmation of a flow control frame.
 */
class ManualConfirmCan {
  event = new EventEmitter()
  info = { canfd: false, name: 'manual' }
  autoConfirm = true
  sent: Buffer[] = []
  private pending: ((ts: number) => void)[] = []
  getReadBaseId(id: number, msgType: CanMsgType) {
    return `readBase-${id}-${msgType.idType}`
  }
  setOption() {
    return undefined
  }
  close() {
    return undefined
  }
  writeBase(_id: number, _msgType: CanMsgType, data: Buffer) {
    this.sent.push(data)
    return new Promise<number>((resolve) => {
      if (this.autoConfirm) {
        setImmediate(() => resolve(Date.now()))
      } else {
        this.pending.push(resolve)
      }
    })
  }
  confirmAll() {
    this.pending.forEach((resolve) => resolve(Date.now()))
    this.pending = []
  }
  fcSent() {
    return this.sent.filter((d) => (d[0] & 0xf0) == 0x30).length
  }
  rx(data: Buffer) {
    const id = addrToId(swapAddr(testerAddr))
    const msg: CanMessage = {
      id,
      data,
      ts: Date.now(),
      dir: 'IN',
      device: 'manual',
      msgType: { idType: CAN_ID_TYPE.EXTENDED, brs: false, canfd: false, remote: false }
    }
    this.event.emit(this.getReadBaseId(id, msg.msgType), msg)
  }
}

function segment(payload: Buffer) {
  const ff = Buffer.alloc(8)
  ff[0] = 0x10 | ((payload.length >> 8) & 0xf)
  ff[1] = payload.length & 0xff
  payload.copy(ff, 2, 0, 6)
  const cfs: Buffer[] = []
  let sn = 1
  for (let off = 6; off < payload.length; off += 7) {
    const cf = Buffer.alloc(8)
    cf[0] = 0x20 | sn
    payload.copy(cf, 1, off, off + 7)
    cfs.push(cf)
    sn = (sn + 1) & 0xf
  }
  return { ff, cfs }
}

const payload = Buffer.concat([
  Buffer.from([0x62, 0xa1, 0xad]),
  Buffer.from(Array.from({ length: 288 }, (_, i) => i & 0xff))
])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function setup(nCr = testerAddr.nCr) {
  const base = new ManualConfirmCan()
  const tp = new CAN_TP(base as any)
  const socket = new CAN_TP_SOCKET(tp, { ...testerAddr, nCr })
  const dispose = () => {
    socket.close()
    tp.close(false)
  }
  return { base, socket, dispose }
}

async function waitFc(base: ManualConfirmCan, count = 1) {
  while (base.fcSent() < count) {
    await sleep(0)
  }
}

describe('CAN_TP segmented reception', () => {
  it('accepts consecutive frames received before the FC TX confirmation', async () => {
    const { base, socket, dispose } = setup()
    base.autoConfirm = false
    const { ff, cfs } = segment(payload)
    const read = socket.read(1000)
    base.rx(ff)
    await waitFc(base)
    base.rx(cfs[0])
    base.confirmAll()
    cfs.slice(1).forEach((cf) => base.rx(cf))
    expect((await read).data).toEqual(payload)
    dispose()
  })

  it('accepts a whole response that completes before the FC TX confirmation', async () => {
    const { base, socket, dispose } = setup()
    base.autoConfirm = false
    const { ff, cfs } = segment(payload)
    const read = socket.read(1000)
    base.rx(ff)
    await waitFc(base)
    cfs.forEach((cf) => base.rx(cf))
    base.confirmAll()
    expect((await read).data).toEqual(payload)
    await sleep(testerAddr.nCr + 20)
    expect(socket.recvBuffer).toHaveLength(0)
    dispose()
  })

  it('restarts reception when a new FF arrives during a stalled reception', async () => {
    const { base, socket, dispose } = setup(1000)
    const { ff, cfs } = segment(payload)
    base.rx(ff)
    await waitFc(base)
    base.rx(cfs[0])
    await expect(socket.read(20)).rejects.toThrow('upper layer read timeout')

    socket.clear()
    const read = socket.read(500).then(
      (v) => v.data,
      (e: Error) => e
    )
    base.rx(ff)
    await sleep(20)
    expect(base.fcSent(), 'a FC must be sent for the new FF').toBe(2)
    cfs.forEach((cf) => base.rx(cf))
    expect(await read).toEqual(payload)
    dispose()
  })

  it('terminates reception and delivers an SF received in the middle of it', async () => {
    const { base, socket, dispose } = setup(1000)
    const { ff, cfs } = segment(payload)
    base.rx(ff)
    await waitFc(base)
    await sleep(0)
    base.rx(cfs[0])
    base.rx(Buffer.from([0x02, 0x7e, 0x00, 0, 0, 0, 0, 0]))
    cfs.slice(1).forEach((cf) => base.rx(cf))
    expect((await socket.read(100)).data).toEqual(Buffer.from([0x7e, 0x00]))
    await expect(socket.read(20)).rejects.toThrow('upper layer read timeout')
    dispose()
  })

  it('still reports N_Cr timeout when consecutive frames stop', async () => {
    const { base, socket, dispose } = setup()
    const { ff, cfs } = segment(payload)
    const read = socket.read(1000)
    base.rx(ff)
    await waitFc(base)
    await sleep(0)
    cfs.slice(0, 3).forEach((cf) => base.rx(cf))
    await expect(read).rejects.toThrow('N_TIMEOUT_CR timeout')
    dispose()
  })
})
