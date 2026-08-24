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

export function isTransientPeakWriteStatus(status: number, peak: PeakStatusConstants): boolean {
  return status == peak.PCANTP_STATUS_QUEUE_TX_FULL || status == peak.PCANTP_STATUS_LOCK_TIMEOUT
}

export function isPeakReadEmpty(status: number, peak: PeakStatusConstants): boolean {
  return status == peak.PCANTP_STATUS_NO_MESSAGE
}

export function shouldResolveTpWriteOnLoopback(
  hasIndicationTx: boolean,
  progressCompleted: boolean
): boolean {
  if (hasIndicationTx) {
    return progressCompleted
  }
  return true
}

export function shouldEmitTpRead(hasIndicationRx: boolean, progressCompleted: boolean): boolean {
  if (hasIndicationRx) {
    return progressCompleted
  }
  return true
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
