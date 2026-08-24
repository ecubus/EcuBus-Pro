import { describe, expect, it } from 'vitest'
import {
  isPeakReadEmpty,
  isTransientPeakWriteStatus,
  shouldEmitTpRead,
  shouldResolveTpWriteOnLoopback,
  writePeakMessageWithRetry
} from '../../src/main/docan/peak/helpers'

const peakStatus = {
  PCANTP_STATUS_QUEUE_TX_FULL: 0x20,
  PCANTP_STATUS_LOCK_TIMEOUT: 0x21,
  PCANTP_STATUS_NO_MESSAGE: 0x08
}

describe('peak helpers', () => {
  it('detects transient write statuses', () => {
    expect(isTransientPeakWriteStatus(peakStatus.PCANTP_STATUS_QUEUE_TX_FULL, peakStatus)).toBe(
      true
    )
    expect(isTransientPeakWriteStatus(peakStatus.PCANTP_STATUS_LOCK_TIMEOUT, peakStatus)).toBe(true)
    expect(isTransientPeakWriteStatus(0, peakStatus)).toBe(false)
  })

  it('detects empty read queue', () => {
    expect(isPeakReadEmpty(peakStatus.PCANTP_STATUS_NO_MESSAGE, peakStatus)).toBe(true)
    expect(isPeakReadEmpty(0, peakStatus)).toBe(false)
  })

  it('resolves tp writes only after multi-frame completion', () => {
    expect(shouldResolveTpWriteOnLoopback(true, false)).toBe(false)
    expect(shouldResolveTpWriteOnLoopback(true, true)).toBe(true)
    expect(shouldResolveTpWriteOnLoopback(false, false)).toBe(true)
  })

  it('emits tp reads only after multi-frame completion', () => {
    expect(shouldEmitTpRead(true, false)).toBe(false)
    expect(shouldEmitTpRead(true, true)).toBe(true)
    expect(shouldEmitTpRead(false, false)).toBe(true)
  })

  it('retries transient write failures before returning', () => {
    let attempts = 0
    const res = writePeakMessageWithRetry(
      () => {
        attempts++
        return attempts < 3 ? peakStatus.PCANTP_STATUS_QUEUE_TX_FULL : 0
      },
      peakStatus,
      10,
      0
    )

    expect(res).toBe(0)
    expect(attempts).toBe(3)
  })
})
