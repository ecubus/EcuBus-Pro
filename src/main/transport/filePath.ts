import path from 'path'
import { LogFileNameContext, resolveLogFileName } from '../share/logFile'

export function resolveLogFilePath(
  configuredPath: string,
  format: string,
  context: LogFileNameContext,
  now: Date = new Date()
): string {
  const parsedPath = path.parse(configuredPath)
  const fileName = resolveLogFileName(parsedPath.name, context, now)

  return path.format({
    dir: parsedPath.dir,
    name: fileName,
    ext: parsedPath.ext || `.${format}`
  })
}
