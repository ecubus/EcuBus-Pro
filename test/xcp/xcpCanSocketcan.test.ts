/**
 * XCP-on-CAN over SocketCAN.
 *
 * Two independent CAN nodes share one bus (a real vcan/can interface when the
 * kernel provides AF_CAN, otherwise an in-process bus that still exchanges
 * packed `struct can_frame` buffers). This matches SocketCAN's isolation model
 * (separate sockets, no self-echo) rather than the global simulate bus.
 */
import { describe, beforeAll, afterAll } from 'vitest'
import { XcpCanTransport } from 'src/main/xcp/xcpCan'
import { XcpMaster } from 'src/main/xcp/xcpMaster'
import {
  createSocketcanTestBus,
  SocketcanTestBus,
  SocketcanTestCan,
  socketcanTestInfo,
  probeLinuxSocketcan
} from '../helpers/socketcanCan'
import { XCP_CMD_ID, XCP_RESP_ID, startXcpSlave, defineXcpCanSessionTests } from './xcpCanHarness'

describe('XCP-on-CAN over SocketCAN (end-to-end)', () => {
  let bus: SocketcanTestBus
  let masterBase: SocketcanTestCan
  let slaveBase: SocketcanTestCan
  let stopSlave: () => void
  let master: XcpMaster

  beforeAll(async () => {
    const probe = probeLinuxSocketcan()
    bus = await createSocketcanTestBus()
    console.log(
      `SocketCAN XCP tests using ${bus.kind} bus on ${bus.iface}` +
        (probe.ok ? '' : ` (kernel: ${probe.reason})`)
    )
    masterBase = new SocketcanTestCan(socketcanTestInfo('xcp-socketcan-master', bus.iface), bus)
    slaveBase = new SocketcanTestCan(socketcanTestInfo('xcp-socketcan-slave', bus.iface), bus)
    await masterBase.open()
    await slaveBase.open()
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
