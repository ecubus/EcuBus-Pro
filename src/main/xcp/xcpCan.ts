/**
 * XCP-on-CAN transport binding.
 *
 * Implements {@link XcpTransport} on top of the existing CAN hardware layer
 * ({@link CAN_SOCKET} / {@link CanBase}). The raw XCP packet is carried directly
 * in the CAN frame data field: command messages use the TX identifier, responses
 * are received on the RX identifier.
 *
 * @module xcpCan
 * @category XCP
 */

import { CAN_SOCKET, CanBase } from '../docan/base'
import { CAN_ID_TYPE, CanMsgType, getDlcByLen, getLenByDlc } from '../share/can'
import { XcpTransport } from './xcpMaster'

/**
 * XCP-on-CAN addressing configuration.
 * @category XCP
 */
export interface XcpCanAddr {
  /** Optional connection name (for logging / identification). */
  name?: string
  /** CAN identifier the master sends commands (CMD/STIM) on. */
  canIdCmd: number
  /** CAN identifier the slave sends responses (RES/DAQ) on. */
  canIdResp: number
  /** Standard (11-bit) or extended (29-bit) identifiers. */
  extended?: boolean
  /** Use CAN-FD frames. */
  canfd?: boolean
  /** Use bit-rate switching (CAN-FD only). */
  brs?: boolean
  /** Pad every command frame to a fixed length. */
  padding?: boolean
  /** Padding byte value (default 0x00). */
  paddingValue?: number
  /**
   * Fixed frame length when {@link XcpCanAddr.padding} is enabled
   * (classic CAN default 8).
   */
  dlc?: number
}

function toMsgType(addr: XcpCanAddr): CanMsgType {
  return {
    idType: addr.extended ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
    brs: !!addr.brs,
    canfd: !!addr.canfd,
    remote: false
  }
}

/**
 * XCP transport over a single CAN channel.
 * @category XCP
 */
export class XcpCanTransport implements XcpTransport {
  private readonly txSocket: CAN_SOCKET
  private readonly rxSocket: CAN_SOCKET
  private readonly addr: XcpCanAddr
  private closed = false

  constructor(base: CanBase, addr: XcpCanAddr) {
    this.addr = addr
    const msgType = toMsgType(addr)
    this.txSocket = new CAN_SOCKET(base, addr.canIdCmd, msgType, { name: addr.name })
    this.rxSocket = new CAN_SOCKET(base, addr.canIdResp, msgType, { name: addr.name })
  }

  private frame(packet: Buffer): Buffer {
    if (!this.addr.padding) return packet
    const target = this.addr.canfd
      ? getLenByDlc(getDlcByLen(Math.max(packet.length, 1), true), true)
      : Math.max(this.addr.dlc ?? 8, packet.length)
    if (packet.length >= target) return packet
    const pad = Buffer.alloc(target - packet.length, this.addr.paddingValue ?? 0)
    return Buffer.concat([packet, pad])
  }

  async request(request: Buffer, timeout = 1000): Promise<Buffer> {
    if (this.closed) throw new Error('XCP CAN transport is closed')
    // Drop any stale frames buffered on the response id before issuing a request.
    this.rxSocket.recvBuffer = []
    await this.txSocket.write(this.frame(request))
    const { data } = await this.rxSocket.read(timeout)
    return data
  }

  async send(request: Buffer): Promise<void> {
    if (this.closed) throw new Error('XCP CAN transport is closed')
    await this.txSocket.write(this.frame(request))
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.txSocket.close()
    this.rxSocket.close()
  }
}
