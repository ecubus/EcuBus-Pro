import path from 'path'
import { describe, expect, it } from 'vitest'
import { isValidLogFileNameRule, resolveLogFileName } from '../../src/main/share/logFile'
import { resolveLogFilePath } from '../../src/main/transport/filePath'

const TEST_TIME = new Date(2026, 7, 1, 1, 57, 46)
const TEST_CONTEXT = {
  loggerName: 'CAN Logger',
  projectName: 'Issue 417'
}

describe('log file naming', () => {
  it('expands field codes in a custom naming rule', () => {
    expect(
      resolveLogFileName('{ProjectName}_{LoggerName}_{LocalTime}', TEST_CONTEXT, TEST_TIME)
    ).toBe('Issue 417_CAN Logger_2026-08-01_01-57-46')
  })

  it('keeps the legacy automatic timestamp when LocalTime is absent', () => {
    expect(resolveLogFileName('capture', TEST_CONTEXT, TEST_TIME)).toBe('capture_20260801015746')
  })

  it('rejects path separators in a file name rule', () => {
    expect(isValidLogFileNameRule('capture/{LocalTime}')).toBe(false)
    expect(isValidLogFileNameRule('capture_{LocalTime}')).toBe(true)
  })

  it('preserves the configured directory and extension', () => {
    expect(
      resolveLogFilePath(path.join('logs', 'capture.asc'), 'asc', TEST_CONTEXT, TEST_TIME)
    ).toBe(path.join('logs', 'capture_20260801015746.asc'))
  })

  it('uses the selected format when the configured path has no extension', () => {
    expect(resolveLogFilePath('{LocalTime}', 'blf', TEST_CONTEXT, TEST_TIME)).toBe(
      '2026-08-01_01-57-46.blf'
    )
  })
})
