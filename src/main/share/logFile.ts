import dayjs from 'dayjs'

export const LOG_FILE_FIELD_CODES = {
  localTime: '{LocalTime}',
  loggerName: '{LoggerName}',
  projectName: '{ProjectName}'
} as const

export interface LogFileNameContext {
  loggerName: string
  projectName: string
}

const INVALID_FILE_NAME_CHARACTERS = /[<>:"/\\|?*]/g

export function isValidLogFileNameRule(rule: string): boolean {
  return rule.trim().length > 0 && !/[<>:"/\\|?*]/.test(rule)
}

function sanitizeFileName(value: string): string {
  return value.replace(INVALID_FILE_NAME_CHARACTERS, '_').trim()
}

export function resolveLogFileName(
  rule: string,
  context: LogFileNameContext,
  now: Date = new Date()
): string {
  const normalizedRule = rule.trim() || LOG_FILE_FIELD_CODES.localTime
  const hasLocalTime = normalizedRule.includes(LOG_FILE_FIELD_CODES.localTime)
  const localTime = dayjs(now).format('YYYY-MM-DD_HH-mm-ss')

  let fileName = normalizedRule
    .replaceAll(LOG_FILE_FIELD_CODES.localTime, localTime)
    .replaceAll(LOG_FILE_FIELD_CODES.loggerName, context.loggerName)
    .replaceAll(LOG_FILE_FIELD_CODES.projectName, context.projectName)

  if (!hasLocalTime) {
    fileName += `_${dayjs(now).format('YYYYMMDDHHmmss')}`
  }

  return sanitizeFileName(fileName) || localTime
}
