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
import { CAN_TP, CAN_TP_SOCKET, TpError } from 'src/main/docan/cantp'

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

  // ISO 15765-2:2016 9.8.3: FF during reception -> terminate it, N_USData.indication(N_UNEXP_PDU),
  // then process the FF as the start of a new reception
  it('reports N_UNEXP_PDU and restarts reception when a new FF arrives mid-reception', async () => {
    const { base, socket, dispose } = setup(1000)
    const { ff, cfs } = segment(payload)
    base.rx(ff)
    await waitFc(base)
    await sleep(0)
    base.rx(cfs[0])

    const first = socket.read(500).then(
      (v) => v.data,
      (e: Error) => e
    )
    base.rx(ff)
    const result = await first
    expect(result).toBeInstanceOf(TpError)
    expect((result as TpError).message).toContain('N_UNEXP_PDU')
    await sleep(20)
    expect(base.fcSent(), 'a FC must be sent for the new FF').toBe(2)
    cfs.forEach((cf) => base.rx(cf))
    expect((await socket.read(500)).data).toEqual(payload)
    dispose()
  })

  // ISO 15765-2:2016 9.8.3: SF during reception -> terminate it, N_USData.indication(N_UNEXP_PDU),
  // then process the SF as the start of a new reception
  it('reports N_UNEXP_PDU and delivers an SF received mid-reception', async () => {
    const { base, socket, dispose } = setup(1000)
    const { ff, cfs } = segment(payload)
    base.rx(ff)
    await waitFc(base)
    await sleep(0)
    base.rx(cfs[0])
    base.rx(Buffer.from([0x02, 0x7e, 0x00, 0, 0, 0, 0, 0]))
    cfs.slice(1).forEach((cf) => base.rx(cf))
    await expect(socket.read(100)).rejects.toThrow('N_UNEXP_PDU')
    expect((await socket.read(100)).data).toEqual(Buffer.from([0x7e, 0x00]))
    // the remaining CFs belong to no reception and are ignored
    await expect(socket.read(20)).rejects.toThrow('upper layer read timeout')
    dispose()
  })

  // ISO 15765-2:2016 9.6.3: FF_DL < FF_DLmin -> ignore the FF and do not transmit a FC.
  // With normal addressing and CAN_DL 8, FF_DLmin is 8.
  it('ignores an FF whose FF_DL is below FF_DLmin', async () => {
    const { base, socket, dispose } = setup()
    base.rx(Buffer.from([0x10, 0x07, 1, 2, 3, 4, 5, 6]))
    await sleep(20)
    expect(base.fcSent()).toBe(0)
    base.rx(Buffer.from([0x21, 7, 0, 0, 0, 0, 0, 0]))
    await expect(socket.read(20)).rejects.toThrow('upper layer read timeout')

    base.rx(Buffer.from([0x10, 0x08, 1, 2, 3, 4, 5, 6]))
    await waitFc(base)
    await sleep(0)
    base.rx(Buffer.from([0x21, 7, 8, 0, 0, 0, 0, 0]))
    expect((await socket.read(100)).data).toEqual(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]))
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

// ISO 14229-2:2013 P2_client / P2*_client: time from the request confirmation until the start of
// the response, i.e. N_USData.indication of an SF or N_USDataFF.indication of a multi-frame
// response. Reassembly after the FF is supervised by the ISO 15765-2 timers (N_Cr).
describe('UDS client P2 on CAN_TP_SOCKET', () => {
  const P2 = 50

  function setupUds(nCr = testerAddr.nCr) {
    const base = new ManualConfirmCan()
    const tp = new CAN_TP(base as any)
    const socket = new CAN_TP_SOCKET(
      tp,
      { ...testerAddr, nCr },
      { timeoutUntilResponseStart: true }
    )
    const dispose = () => {
      socket.close()
      tp.close(false)
    }
    return { base, socket, dispose }
  }

  async function sendSlowly(base: ManualConfirmCan, frames: Buffer[], gapMs: number) {
    for (const f of frames) {
      base.rx(f)
      await sleep(gapMs)
    }
  }

  it('stops P2 at the FF: a transfer longer than P2 completes under N_Cr', async () => {
    const { base, socket, dispose } = setupUds()
    const { ff, cfs } = segment(payload)
    const read = socket.read(P2)
    await sleep(5)
    base.rx(ff)
    await waitFc(base)
    await sleep(0)
    const t0 = Date.now()
    await sendSlowly(base, cfs, 3)
    expect(Date.now() - t0).toBeGreaterThan(P2)
    expect((await read).data).toEqual(payload)
    dispose()
  })

  it('stops P2 at an FF indicated before the read started', async () => {
    const { base, socket, dispose } = setupUds()
    const { ff, cfs } = segment(payload)
    base.rx(ff)
    await waitFc(base)
    await sleep(0)
    const read = socket.read(P2)
    await sendSlowly(base, cfs, 3)
    expect((await read).data).toEqual(payload)
    dispose()
  })

  it('after the FF, a stalled transfer ends with N_TIMEOUT_CR instead of a P2 timeout', async () => {
    const { base, socket, dispose } = setupUds()
    const { ff, cfs } = segment(payload)
    const t0 = Date.now()
    const read = socket.read(P2)
    base.rx(ff)
    await waitFc(base)
    await sleep(0)
    cfs.slice(0, 2).forEach((cf) => base.rx(cf))
    await expect(read).rejects.toThrow('N_TIMEOUT_CR timeout')
    expect(Date.now() - t0).toBeGreaterThanOrEqual(testerAddr.nCr)
    dispose()
  })

  it('still expires P2 when no response starts', async () => {
    const { socket, dispose } = setupUds()
    const t0 = Date.now()
    await expect(socket.read(P2)).rejects.toThrow('upper layer read timeout')
    expect(Date.now() - t0).toBeLessThan(testerAddr.nCr)
    dispose()
  })

  it('arms P2 again for the next read after a response completed', async () => {
    const { base, socket, dispose } = setupUds()
    base.rx(Buffer.from([0x03, 0x7f, 0x22, 0x78, 0, 0, 0, 0]))
    expect((await socket.read(P2)).data).toEqual(Buffer.from([0x7f, 0x22, 0x78]))
    await expect(socket.read(P2)).rejects.toThrow('upper layer read timeout')
    dispose()
  })

  it('keeps a plain read timeout for sockets without the option', async () => {
    const { base, socket, dispose } = setup()
    const { ff, cfs } = segment(payload)
    const read = socket.read(P2).then(
      () => 'resolved',
      (e: Error) => e.message
    )
    base.rx(ff)
    await waitFc(base)
    await sleep(0)
    await sendSlowly(base, cfs.slice(0, 30), 3)
    expect(await read).toBe('upper layer read timeout')
    dispose()
  })
})
