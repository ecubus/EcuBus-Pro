/**
 * XCP-on-CAN end-to-end integration test.
 *
 * Drives {@link XcpMaster} through the real {@link XcpCanTransport} over the
 * `simulate` CAN backend (functional on Linux). A tiny simulated XCP slave on
 * the peer node answers the master's commands, proving the full send/receive
 * path — command framing, CAN transmission, response reception and parsing —
 * works together, not just the isolated codec.
 */
import { describe, beforeAll, afterAll } from 'vitest'
import { SIMULATE_CAN } from 'src/main/docan/simulate'
import { CanBase } from 'src/main/docan/base'
import { XcpCanTransport } from 'src/main/xcp/xcpCan'
import { XcpMaster } from 'src/main/xcp/xcpMaster'
import { XCP_CMD_ID, XCP_RESP_ID, startXcpSlave, defineXcpCanSessionTests } from './xcpCanHarness'

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

describe('XCP-on-CAN over the simulate backend (end-to-end)', () => {
  let masterBase: CanBase
  let slaveBase: CanBase
  let stopSlave: () => void
  let master: XcpMaster

  beforeAll(() => {
    masterBase = makeBase(0)
    slaveBase = makeBase(1)
    stopSlave = startXcpSlave(slaveBase)
    const transport = new XcpCanTransport(masterBase, {
      name: 'ecu',
      canIdCmd: XCP_CMD_ID,
      canIdResp: XCP_RESP_ID,
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

  defineXcpCanSessionTests(() => master)
})
