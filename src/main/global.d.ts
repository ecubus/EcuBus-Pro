/* eslint-disable no-var */
import type { Logger } from 'winston'
import type { EventEmitter } from 'events'
import { LDF } from 'src/renderer/src/database/ldfParse'
import { DBC } from 'src/renderer/src/database/dbc/dbcVisitor'
import { VarItem } from 'src/preload/data'
import { BrowserWindow } from 'electron'

type VarEvent = {
  update: [
    {
      name: string
      value: number | string | number[]
      id: string
      uuid?: string
    }
  ]
}

declare global {
  var sysLog: Logger
  var scriptLog: Logger
  var keyEvent: EventEmitter | undefined
  var varEvent: EventEmitter<VarEvent> | undefined
  var database: {
    lin: Record<string, LDF>
    can: Record<string, DBC>
  }
  var vars: Record<string, VarItem>
  var mainWindow: BrowserWindow
  var toomossDeviceHandles:
    | Map<
        number,
        {
          refCount: number // 引用计数
          channels: Set<number> // 当前使用的通道
        }
      >
    | undefined
}
