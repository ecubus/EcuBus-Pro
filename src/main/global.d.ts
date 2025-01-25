/* eslint-disable no-var */
import type { Logger} from 'winston'
import type { EventEmitter } from 'events'
import { LDF } from 'src/renderer/src/database/ldfParse'
import { DBC } from 'src/renderer/src/database/dbc/dbcVisitor'
declare global {
    var sysLog: Logger
    var scriptLog: Logger
    var keyEvent: EventEmitter
    var database:{
      lin:Record<string,LDF>
      can:Record<string,DBC>
    }
  }
  