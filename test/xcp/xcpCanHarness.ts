/**
 * Shared XCP-on-CAN test slave and session assertions.
 *
 * Used by both the in-process `simulate` backend tests and the SocketCAN tests
 * so the command/response vectors stay identical across transports.
 */
import { expect, it } from 'vitest'
import { CAN_SOCKET, CanBase } from 'src/main/docan/base'
import { CAN_ID_TYPE, CanMsgType } from 'src/main/share/can'
import { XcpMaster } from 'src/main/xcp/xcpMaster'

export const XCP_CMD_ID = 0x7e0
export const XCP_RESP_ID = 0x7e1

export const xcpCanMsgType: CanMsgType = {
  idType: CAN_ID_TYPE.STANDARD,
  brs: false,
  canfd: false,
  remote: false
}

/**
 * Minimal simulated XCP slave: reads command frames on CMD_ID and writes canned
 * responses on RESP_ID.
 */
export function startXcpSlave(base: CanBase): () => void {
  const reqSock = new CAN_SOCKET(base, XCP_CMD_ID, xcpCanMsgType)
  const respSock = new CAN_SOCKET(base, XCP_RESP_ID, xcpCanMsgType)
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

export function defineXcpCanSessionTests(getMaster: () => XcpMaster) {
  it('CONNECT negotiates slave properties over CAN', async () => {
    const res = await getMaster().connect()
    expect(res.maxCto).toBe(255)
    expect(res.maxDto).toBe(1500)
    expect(res.resource.pgm).toBe(true)
    expect(getMaster().slaveProperties.byteOrder).toBe(0) // INTEL
  })

  it('GET_STATUS round-trips over CAN', async () => {
    const status = await getMaster().getStatus()
    expect(status.resourceProtectionStatus.pgm).toBe(true)
    expect(status.sessionConfigurationId).toBe(0)
  })

  it('SHORT_UPLOAD returns slave memory over CAN', async () => {
    const data = await getMaster().shortUpload(4, 0x1000, 0)
    expect(Array.from(data)).toEqual([1, 2, 3, 4])
  })

  it('SET_MTA acknowledges over CAN', async () => {
    await expect(getMaster().setMta(0x12345678, 0)).resolves.toBeInstanceOf(Buffer)
  })

  it('DISCONNECT completes over CAN', async () => {
    await expect(getMaster().disconnect()).resolves.toBeInstanceOf(Buffer)
    expect(getMaster().connected).toBe(false)
  })
}
