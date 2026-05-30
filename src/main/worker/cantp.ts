/**
 * CAN-TP (ISO 15765-2) worker API — send and receive multi-frame CAN data via the transport layer.
 *
 * @remarks
 * All functions bridge to the main process via `emitWorkerEventWithReply('canApi', ...)`.
 * Use {@link CanTpCreateConnection} to obtain a handle, then pass that handle to the
 * send / recv helpers. Always call {@link CanTpCloseConnection} when done.
 *
 * @module cantp
 * @category CAN-TP
 *
 * @example
 * ```ts
 * import { CanTpCreateConnection, CanTpSendData, CanTpRecvData, CanTpCloseConnection } from 'ecubus-worker'
 * import { CAN_ADDR_FORMAT, CAN_ADDR_TYPE, CAN_ID_TYPE } from 'ecubus-worker'
 *
 * Util.Init(async () => {
 *   const addr: CanTpAddr = {
 *     name: 'myConn',
 *     idType: CAN_ID_TYPE.STANDARD,
 *     brs: false,
 *     canfd: false,
 *     remote: false,
 *     canIdTx: '0x7E0',
 *     canIdRx: '0x7E8',
 *     addrFormat: CAN_ADDR_FORMAT.NORMAL,
 *     addrType: CAN_ADDR_TYPE.PHYSICAL,
 *     SA: '0xF1',
 *     TA: '0x01',
 *     AE: '0x00',
 *     nAs: 1000, nAr: 1000, nBs: 1000, nCr: 1000,
 *     stMin: 0, bs: 0, maxWTF: 0,
 *     dlc: 8, padding: false, paddingValue: '0x00'
 *   }
 *
 *   const handle = await CanTpCreateConnection(addr)
 *   await CanTpSendData(handle, [0x10, 0x01])
 *   const { data, ts } = await CanTpRecvData(handle, 5000)
 *   console.log('received:', data)
 *   await CanTpCloseConnection(handle)
 * })
 * ```
 */

import { emitWorkerEventWithReply } from './uds'
import type { CanAddr } from '../share/can'

/**
 * CAN-TP addressing configuration passed to {@link CanTpCreateConnection}.
 * Mirrors the main-process `CanAddr` interface — all fields are the same.
 * @category CAN-TP
 */
export type CanTpAddr = CanAddr

/**
 * Create a CAN-TP connection and return an opaque handle string.
 *
 * @param addr - Full addressing configuration (TX/RX IDs, format, timing, etc.)
 * @param device - Optional device name (channel name as configured in the project).
 *   When omitted the first CAN channel attached to this node is used.
 * @returns Opaque handle string to pass to the other CanTp* functions.
 * @throws If no suitable CAN device is found, or if the connection cannot be opened.
 *
 * @category CAN-TP
 *
 * @example
 * ```ts
 * const handle = await CanTpCreateConnection(addr, 'CAN1')
 * ```
 */
export async function CanTpCreateConnection(addr: CanTpAddr, device?: string): Promise<string> {
  const handle = await emitWorkerEventWithReply('canApi', {
    op: 'createConnection',
    addr,
    device
  })
  return handle as string
}

/**
 * Close a CAN-TP connection previously opened with {@link CanTpCreateConnection}.
 *
 * @param handle - Handle returned by {@link CanTpCreateConnection}.
 *
 * @category CAN-TP
 *
 * @example
 * ```ts
 * await CanTpCloseConnection(handle)
 * ```
 */
export async function CanTpCloseConnection(handle: string): Promise<void> {
  await emitWorkerEventWithReply('canApi', { op: 'closeConnection', handle })
}

/**
 * Send data over CAN-TP.
 * Automatically chooses single-frame or multi-frame segmentation based on the data length.
 *
 * @param handle - Handle returned by {@link CanTpCreateConnection}.
 * @param data - Payload bytes (1 – 4095 bytes).
 * @returns Transmission timestamp in microseconds.
 * @throws {@link TpError} on bus error, timeout or protocol violation.
 *
 * @category CAN-TP
 *
 * @example
 * ```ts
 * const ts = await CanTpSendData(handle, [0x10, 0x01])
 * ```
 */
export async function CanTpSendData(handle: string, data: number[] | Buffer): Promise<number> {
  const ts = await emitWorkerEventWithReply('canApi', {
    op: 'sendData',
    handle,
    data: Array.from(data)
  })
  return ts as number
}

/**
 * Receive data over CAN-TP, waiting up to `timeout` milliseconds.
 *
 * @param handle - Handle returned by {@link CanTpCreateConnection}.
 * @param timeout - Maximum wait time in milliseconds (default: 5000).
 * @returns Object with `data` (received bytes as a number array) and `ts` (timestamp in µs).
 * @throws {@link TpError} on timeout, bus error or protocol violation.
 *
 * @category CAN-TP
 *
 * @example
 * ```ts
 * const { data, ts } = await CanTpRecvData(handle, 5000)
 * console.log('received:', data.map(b => b.toString(16)).join(' '))
 * ```
 */
export async function CanTpRecvData(
  handle: string,
  timeout = 5000
): Promise<{ data: number[]; ts: number }> {
  const result = await emitWorkerEventWithReply('canApi', { op: 'recvData', handle, timeout })
  return result as { data: number[]; ts: number }
}
