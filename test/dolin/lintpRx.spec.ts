import EventEmitter from 'events'
import { describe, expect, it } from 'vitest'
import { LIN_TP, LIN_TP_SOCKET } from 'src/main/dolin/lintp'
import { LIN_ADDR_TYPE, LIN_SCH_TYPE, LinAddr, LinMode } from 'src/main/share/lin'

const addr: LinAddr = {
  name: 'slave',
  addrType: LIN_ADDR_TYPE.PHYSICAL,
  nad: 0x12,
  stMin: 0,
  nAs: 1000,
  nCr: 120,
  schType: LIN_SCH_TYPE.DIAG_ONLY
}

/** LIN base with a schedule already running, so readTp does not start one itself. */
class StubLin {
  event = new EventEmitter()
  info = {}
  sch = { activeSchName: 'diag', activeIndex: 0 }
  setPendingDiagRead() {
    return undefined
  }
  clearPendingDiagRead() {
    return undefined
  }
  slaveResp(data: number[]) {
    this.event.emit(`${0x3d}`, { frameId: 0x3d, data: Buffer.from(data), ts: Date.now() })
  }
}

const payload = Array.from({ length: 40 }, (_, i) => i)
function segment() {
  const frames: number[][] = [[addr.nad, 0x10, payload.length, ...payload.slice(0, 5)]]
  let sn = 1
  for (let off = 5; off < payload.length; off += 6) {
    const chunk = payload.slice(off, off + 6)
    frames.push([addr.nad, 0x20 | sn, ...chunk, ...Array(6 - chunk.length).fill(0xff)])
    sn = (sn + 1) & 0xf
  }
  return frames
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ISO 14229-2:2013 P2_client ends at the start of the response (SF or FF indication); the rest
// of a segmented LIN response is supervised by the transport layer N_Cr timer.
describe('UDS client P2 on LIN_TP_SOCKET', () => {
  const P2 = 30

  function setup() {
    const base = new StubLin()
    const tp = new LIN_TP(base as any)
    const socket = new LIN_TP_SOCKET(tp, addr, LinMode.MASTER, {
      timeoutUntilResponseStart: true
    })
    return { base, socket, dispose: () => socket.close() }
  }

  it('stops P2 at the FF: a slave response longer than P2 completes', async () => {
    const { base, socket, dispose } = setup()
    const read = socket.read(P2)
    const t0 = Date.now()
    for (const f of segment()) {
      base.slaveResp(f)
      await sleep(10)
    }
    expect(Date.now() - t0).toBeGreaterThan(P2)
    expect([...(await read).data]).toEqual(payload)
    dispose()
  })

  it('after the FF, a stalled response ends with N_TIMEOUT_CR', async () => {
    const { base, socket, dispose } = setup()
    const read = socket.read(P2)
    const frames = segment()
    base.slaveResp(frames[0])
    base.slaveResp(frames[1])
    await expect(read).rejects.toThrow('N_TIMEOUT_CR timeout')
    dispose()
  })

  it('still expires P2 when no response starts', async () => {
    const { socket, dispose } = setup()
    await expect(socket.read(P2)).rejects.toThrow('upper layer read timeout')
    dispose()
  })
})
