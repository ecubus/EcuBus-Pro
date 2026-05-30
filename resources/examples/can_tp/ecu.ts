/**
 * Simulated ECU — receives CAN-TP requests and replies with a positive response.
 *
 * Uses Util.OnCan + output() to implement ISO 15765-2 without CanTpCreateConnection.
 *
 * RX = 0x7E0  (Tester → ECU)
 * TX = 0x7E8  (ECU → Tester)
 *
 * Response rule: first byte = service_id + 0x40, remaining bytes echoed back.
 */
import { output, CAN_ID_TYPE } from 'ECB'
import type { CanMessage } from 'ECB'

const RX_ID = 0x7e0
const TX_ID = 0x7e8

let rxState: { totalLen: number; buf: number[]; expectedSN: number } | null = null
let txState: { data: number[]; offset: number; sn: number } | null = null

function sendRaw(bytes: number[]) {
  const padded = [...bytes, ...Array(Math.max(0, 8 - bytes.length)).fill(0x00)].slice(0, 8)
  output({
    id: TX_ID,
    data: Buffer.from(padded),
    msgType: { idType: CAN_ID_TYPE.STANDARD, brs: false, canfd: false, remote: false }
  } as CanMessage)
}

function respond(payload: number[]) {
  const resp = [payload[0] + 0x40, ...payload.slice(1)]
  const preview = resp
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
  console.log(`[ECU] TX ${resp.length}B: ${preview}${resp.length > 8 ? ' ...' : ''}`)

  if (resp.length <= 7) {
    sendRaw([resp.length, ...resp])
  } else {
    txState = { data: resp, offset: 6, sn: 1 }
    sendRaw([0x10 | ((resp.length >> 8) & 0x0f), resp.length & 0xff, ...resp.slice(0, 6)])
  }
}

Util.OnCan(RX_ID, (msg) => {
  const d = Array.from(msg.data)
  if (!d.length) return
  const frameType = (d[0] >> 4) & 0x0f

  if (frameType === 0) {
    // Single Frame
    const len = d[0] & 0x0f
    if (len < 1 || len > d.length - 1) return
    rxState = null
    respond(d.slice(1, 1 + len))
  } else if (frameType === 1) {
    // First Frame — send FC immediately
    const totalLen = ((d[0] & 0x0f) << 8) | d[1]
    if (totalLen < 8) return
    rxState = { totalLen, buf: [...d.slice(2)], expectedSN: 1 }
    sendRaw([0x30, 0x00, 0x00]) // FC: ContinueToSend, BS=0, STmin=0
  } else if (frameType === 2) {
    // Consecutive Frame
    if (!rxState) return
    const sn = d[0] & 0x0f
    if (sn !== rxState.expectedSN % 16) {
      rxState = null
      return
    }
    rxState.expectedSN++
    rxState.buf.push(...d.slice(1))
    if (rxState.buf.length >= rxState.totalLen) {
      const payload = rxState.buf.slice(0, rxState.totalLen)
      rxState = null
      const preview = payload
        .slice(0, 8)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')
      console.log(`[ECU] RX ${payload.length}B: ${preview}${payload.length > 8 ? ' ...' : ''}`)
      respond(payload)
    }
  } else if (frameType === 3) {
    // Flow Control (tester acking ECU's FF)
    if (!txState || (d[0] & 0x0f) !== 0) return
    while (txState.offset < txState.data.length) {
      const chunk = txState.data.slice(txState.offset, txState.offset + 7)
      sendRaw([0x20 | (txState.sn & 0x0f), ...chunk])
      txState.sn++
      txState.offset += 7
    }
    txState = null
  }
})

Util.Init(() => {
  console.log('[ECU] Ready  RX=0x7E0  TX=0x7E8')
})
