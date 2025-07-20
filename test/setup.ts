import { createLogger, format, Logger, transports } from 'winston'

global.sysLog = createLogger({
  transports: [new transports.Console()],
  format: format.combine(format.colorize(), format.simple())
})
