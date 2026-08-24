export const PEAK_WRITE_RETRY_MAX = 100
export const PEAK_WRITE_RETRY_DELAY_MS = 1

export function delayMs(ms: number) {
  const end = process.hrtime.bigint() + BigInt(ms * 1_000_000)
  while (process.hrtime.bigint() < end) {
    // busy wait for short native write retries
  }
}

export type PeakStatusConstants = {
  PCANTP_STATUS_QUEUE_TX_FULL: number
  PCANTP_STATUS_LOCK_TIMEOUT: number
  PCANTP_STATUS_NO_MESSAGE: number
}

export type PeakMsgFlagConstants = {
  PCANTP_MSGFLAG_LOOPBACK: number
}

export type PeakNetStatusConstants = {
  PCANTP_NETSTATUS_OK: number
  PCANTP_NETSTATUS_TIMEOUT_A: number
  PCANTP_NETSTATUS_TIMEOUT_Bs: number
  PCANTP_NETSTATUS_TIMEOUT_Cr: number
  PCANTP_NETSTATUS_WRONG_SN: number
  PCANTP_NETSTATUS_INVALID_FS: number
  PCANTP_NETSTATUS_BUFFER_OVFLW: number
}

export function isTransientPeakWriteStatus(status: number, peak: PeakStatusConstants): boolean {
  return status == peak.PCANTP_STATUS_QUEUE_TX_FULL || status == peak.PCANTP_STATUS_LOCK_TIMEOUT
}

export function isPeakReadEmpty(status: number, peak: PeakStatusConstants): boolean {
  return status == peak.PCANTP_STATUS_NO_MESSAGE
}

/** Peak may OR LOOPBACK with ISOTP_FRAME / QOVERRUN bits — never compare with ==. */
export function isPeakLoopback(flags: number, peak: PeakMsgFlagConstants): boolean {
  return (flags & peak.PCANTP_MSGFLAG_LOOPBACK) != 0
}

/**
 * Multi-frame TX: Peak delivers an INDICATION_TX first, then a final confirmation without the
 * indication flag (see PCANTP_PARAMETER_MSG_PENDING). Only resolve when there is no TX indication,
 * or GetMsgProgress reports COMPLETED on the indication.
 */
export function shouldResolveTpWriteOnLoopback(
  hasIndicationTx: boolean,
  progressCompleted: boolean
): boolean {
  if (hasIndicationTx) {
    return progressCompleted
  }
  return true
}

/**
 * Per Peak docs, the complete ISO-TP RX payload is the message WITHOUT INDICATION_RX.
 * Pending indication messages must not be emitted as finished reads.
 */
export function shouldEmitTpRead(hasIndicationRx: boolean): boolean {
  return !hasIndicationRx
}

export type PeakTpNetError =
  | 'TP_TIMEOUT_A'
  | 'TP_TIMEOUT_BS'
  | 'TP_TIMEOUT_CR'
  | 'TP_WRONG_SN'
  | 'TP_INVALID_FS'
  | 'TP_BUFFER_OVERFLOW'
  | 'TP_BUS_ERROR'
  | null

export function mapPeakNetStatusToTpError(
  netstatus: number,
  peak: PeakNetStatusConstants
): PeakTpNetError {
  if (netstatus == peak.PCANTP_NETSTATUS_OK) {
    return null
  }
  if (netstatus == peak.PCANTP_NETSTATUS_TIMEOUT_A) {
    return 'TP_TIMEOUT_A'
  }
  if (netstatus == peak.PCANTP_NETSTATUS_TIMEOUT_Bs) {
    return 'TP_TIMEOUT_BS'
  }
  if (netstatus == peak.PCANTP_NETSTATUS_TIMEOUT_Cr) {
    return 'TP_TIMEOUT_CR'
  }
  if (netstatus == peak.PCANTP_NETSTATUS_WRONG_SN) {
    return 'TP_WRONG_SN'
  }
  if (netstatus == peak.PCANTP_NETSTATUS_INVALID_FS) {
    return 'TP_INVALID_FS'
  }
  if (netstatus == peak.PCANTP_NETSTATUS_BUFFER_OVFLW) {
    return 'TP_BUFFER_OVERFLOW'
  }
  return 'TP_BUS_ERROR'
}

export function writePeakMessageWithRetry(
  write: () => number,
  peak: PeakStatusConstants,
  maxRetries = PEAK_WRITE_RETRY_MAX,
  delay = PEAK_WRITE_RETRY_DELAY_MS
): number {
  let res = write()
  let attempt = 0
  while (isTransientPeakWriteStatus(res, peak) && attempt < maxRetries) {
    delayMs(delay)
    res = write()
    attempt++
  }
  return res
}
