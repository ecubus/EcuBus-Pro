/**
 * XCP-on-CAN end-to-end integration test.
 *
 * Drives {@link XcpMaster} through the real {@link XcpCanTransport} over the
 * `simulate` CAN backend (functional on Linux). A tiny simulated XCP slave on
 * the peer node answers the master's commands, proving the full send/receive
 * path — command framing, CAN transmission, response reception and parsing —
 * works together, not just the isolated codec.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SIMULATE_CAN } from 'src/main/docan/simulate'
import { CAN_SOCKET, CanBase } from 'src/main/docan/base'
import { CAN_ID_TYPE, CanMsgType } from 'src/main/share/can'
import { XcpCanTransport } from 'src/main/xcp/xcpCan'
import { XcpMaster } from 'src/main/xcp/xcpMaster'

const CMD_ID = 0x7e0
const RESP_ID = 0x7e1

function makeBase(handle: number): CanBase {
  return new SIMULATE_CAN({
    handle,
    name: 'xcp-sim',
    vendor: 'simulate',
    canfd: false,
    bitrate: { freq: 500000, timeSeg1: 0x0f, timeSeg2: 0x04, sjw: 0x01, preScaler: 0x01 },
    bitratefd: { freq: 500000, timeSeg1: 0x0f, timeSeg2: 0x04, sjw: 0x01, preScaler: 0x01 },
    id: 'xcp-bus'
  } as any) as unknown as CanBase
}

const msgType: CanMsgType = {
  idType: CAN_ID_TYPE.STANDARD,
  brs: false,
  canfd: false,
  remote: false
}

/**
 * Minimal simulated XCP slave: reads command frames on CMD_ID and writes canned
 * responses on RESP_ID. Enough behaviour to exercise a realistic master session.
 */
function startSlave(base: CanBase): () => void {
  const reqSock = new CAN_SOCKET(base, CMD_ID, msgType)
  const respSock = new CAN_SOCKET(base, RESP_ID, msgType)
  let running = true

  const handle = (req: Buffer): Buffer => {
    const pid = req[0]
    switch (pid) {
      case 0xff: // CONNECT -> resources + INTEL byte order, MAX_CTO 255, MAX_DTO 1500
        return Buffer.from([0xff, 0x1d, 0xc0, 0xff, 0xdc, 0x05, 0x01, 0x01])
      case 0xfd: // GET_STATUS
        return Buffer.from([0xff, 0x00, 0x1d, 0xff, 0x00, 0x00])
      case 0xf4: {
        // SHORT_UPLOAD: return `count` incrementing bytes starting at 1
        const count = req[1]
        return Buffer.concat([
          Buffer.from([0xff]),
          Buffer.from(Array.from({ length: count }, (_, i) => i + 1))
        ])
      }
      case 0xf6: // SET_MTA
        return Buffer.from([0xff])
      case 0xfe: // DISCONNECT
        return Buffer.from([0xff])
      default:
        return Buffer.from([0xfe, 0x20]) // ERR_CMD_UNKNOWN
    }
  }

  const loop = async () => {
    while (running) {
      let req: { data: Buffer; ts: number }
      try {
        req = await reqSock.read(3000)
      } catch {
        break
      }
      if (!running) break
      await respSock.write(handle(req.data))
    }
  }
  loop()

  return () => {
    running = false
    reqSock.close()
    respSock.close()
  }
}

describe('XCP-on-CAN over the simulate backend (end-to-end)', () => {
  let masterBase: CanBase
  let slaveBase: CanBase
  let stopSlave: () => void
  let master: XcpMaster

  beforeAll(() => {
    masterBase = makeBase(0)
    slaveBase = makeBase(1)
    stopSlave = startSlave(slaveBase)
    const transport = new XcpCanTransport(masterBase, {
      name: 'ecu',
      canIdCmd: CMD_ID,
      canIdResp: RESP_ID,
      padding: true
    })
    master = new XcpMaster(transport, 3000)
  })

  afterAll(() => {
    master.close()
    stopSlave()
    masterBase.close()
    slaveBase.close()
  })

  it('CONNECT negotiates slave properties over CAN', async () => {
    const res = await master.connect()
    expect(res.maxCto).toBe(255)
    expect(res.maxDto).toBe(1500)
    expect(res.resource.pgm).toBe(true)
    expect(master.slaveProperties.byteOrder).toBe(0) // INTEL
  })

  it('GET_STATUS round-trips over CAN', async () => {
    const status = await master.getStatus()
    expect(status.resourceProtectionStatus.pgm).toBe(true)
    expect(status.sessionConfigurationId).toBe(0)
  })

  it('SHORT_UPLOAD returns slave memory over CAN', async () => {
    const data = await master.shortUpload(4, 0x1000, 0)
    expect(Array.from(data)).toEqual([1, 2, 3, 4])
  })

  it('SET_MTA acknowledges over CAN', async () => {
    await expect(master.setMta(0x12345678, 0)).resolves.toBeInstanceOf(Buffer)
  })

  it('DISCONNECT completes over CAN', async () => {
    await expect(master.disconnect()).resolves.toBeInstanceOf(Buffer)
    expect(master.connected).toBe(false)
  })
})
