/* eslint-disable no-var */
import type { Logger } from 'winston'
import type { EventEmitter } from 'events'
import { LDF } from 'src/renderer/src/database/ldfParse'
import { DBC } from 'src/renderer/src/database/dbc/dbcVisitor'
import { VarItem } from 'src/preload/data'
import { BrowserWindow } from 'electron'
import { IntervalHistogram } from 'node:perf_hooks'
import type { DataSet } from 'src/preload/data'
import type { NodeClass } from './nodeItem'
type VarUpdateItem = {
  name: string
  value: number | string | number[]
  id: string
  uuid?: string
}
type VarEvent = {
  update: [VarUpdateItem | VarUpdateItem[]]
}

declare global {
  var sysLog: Logger
  var scriptLog: Logger
  var keyEvent: EventEmitter | undefined
  var varEvent: EventEmitter<VarEvent> | undefined
  var dataSet: DataSet
  var startTs: number
  var vars: Record<string, VarItem>
  var mainWindow: BrowserWindow
  var plugins: Record<string, NodeClass>
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
