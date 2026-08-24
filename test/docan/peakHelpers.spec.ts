import { describe, expect, it } from 'vitest'
import {
  isPeakLoopback,
  isPeakReadEmpty,
  isTransientPeakWriteStatus,
  mapPeakNetStatusToTpError,
  shouldEmitTpRead,
  shouldResolveTpWriteOnLoopback,
  writePeakMessageWithRetry
} from '../../src/main/docan/peak/helpers'

const peakStatus = {
  PCANTP_STATUS_QUEUE_TX_FULL: 0x20,
  PCANTP_STATUS_LOCK_TIMEOUT: 0x21,
  PCANTP_STATUS_NO_MESSAGE: 0x08
}

const peakFlags = {
  PCANTP_MSGFLAG_LOOPBACK: 1
}

const peakNet = {
  PCANTP_NETSTATUS_OK: 0x00,
  PCANTP_NETSTATUS_TIMEOUT_A: 0x01,
  PCANTP_NETSTATUS_TIMEOUT_Bs: 0x02,
  PCANTP_NETSTATUS_TIMEOUT_Cr: 0x03,
  PCANTP_NETSTATUS_WRONG_SN: 0x04,
  PCANTP_NETSTATUS_INVALID_FS: 0x05,
  PCANTP_NETSTATUS_BUFFER_OVFLW: 0x08
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

  it('detects loopback when OR-ed with other msg flags', () => {
    expect(isPeakLoopback(peakFlags.PCANTP_MSGFLAG_LOOPBACK, peakFlags)).toBe(true)
    // LOOPBACK | ISOTP_FRAME
    expect(isPeakLoopback(peakFlags.PCANTP_MSGFLAG_LOOPBACK | 2, peakFlags)).toBe(true)
    expect(isPeakLoopback(0, peakFlags)).toBe(false)
    expect(isPeakLoopback(2, peakFlags)).toBe(false)
  })

  it('resolves tp writes only after multi-frame completion', () => {
    expect(shouldResolveTpWriteOnLoopback(true, false)).toBe(false)
    expect(shouldResolveTpWriteOnLoopback(true, true)).toBe(true)
    expect(shouldResolveTpWriteOnLoopback(false, false)).toBe(true)
  })

  it('emits tp reads only for non-indication (complete) messages', () => {
    expect(shouldEmitTpRead(true)).toBe(false)
    expect(shouldEmitTpRead(false)).toBe(true)
  })

  it('maps Peak network status to TP errors', () => {
    expect(mapPeakNetStatusToTpError(peakNet.PCANTP_NETSTATUS_OK, peakNet)).toBeNull()
    expect(mapPeakNetStatusToTpError(peakNet.PCANTP_NETSTATUS_TIMEOUT_Bs, peakNet)).toBe(
      'TP_TIMEOUT_BS'
    )
    expect(mapPeakNetStatusToTpError(peakNet.PCANTP_NETSTATUS_TIMEOUT_Cr, peakNet)).toBe(
      'TP_TIMEOUT_CR'
    )
    expect(mapPeakNetStatusToTpError(peakNet.PCANTP_NETSTATUS_WRONG_SN, peakNet)).toBe(
      'TP_WRONG_SN'
    )
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
