import path from 'path'
// import type { Signal } from 'src/renderer/src/database/dbc/dbcVisitor'
import { updateSignalPhys, updateSignalRaw } from 'src/renderer/src/database/dbc/calc'
import type { LDF } from 'src/renderer/src/database/ldfParse'
import { isEqual } from 'lodash'
import { CanSignal } from 'nodeCan/can'

export function updateLinSignalVal(db: LDF, signalName: string, value: number | number[] | string) {
  const signal = db.signals[signalName]
  if (signal) {
    //compare value
    const lastValue = signal.value != undefined ? signal.value : signal.initValue
    if (!isEqual(lastValue, value)) {
      signal.update = true
    }
    if (typeof value === 'string') {
      //find in encode
      //TODO:
    } else {
      signal.value = value
    }
  }
}

export function getJsPath(tsPath: string, projectPath: string) {
  const outDir = path.join(projectPath, '.ScriptBuild')
  const scriptNameNoExt = path.basename(tsPath, '.ts')
  const jsPath = path.join(outDir, scriptNameNoExt + '.js')
  return jsPath
}

export function setSignal(data: { signal: string; value: number | number[] | string }) {
  const s = data.signal.split('.')
  // 验证数据库是否存在
  const db = Object.values(global.dataSet.database.can).find((db) => db.name == s[0])
  if (db) {
    const signalName = s[1]
    let ss: CanSignal | undefined
    for (const msg of Object.values(db.messages)) {
      for (const signal of Object.values(msg.signals)) {
        if (signal.name == signalName) {
          ss = signal
          break
        }
      }
      if (ss) {
        break
      }
    }
    if (!ss) {
      throw new Error(`Signal ${signalName} not found`)
    }
    if (typeof data.value === 'string') {
      ss.physValue = data.value
      updateSignalPhys(ss, db)
    } else {
      if (Array.isArray(data.value)) {
        throw new Error('Can not set array value')
      }
      ss.value = data.value
      updateSignalRaw(ss)
    }
  } else {
    const linDb = Object.values(global.dataSet.database.lin).find((db) => db.name == s[0])
    if (linDb) {
      const signalName = s[1]

      const signal = linDb.signals[signalName]
      if (!signal) {
        throw new Error(`Signal ${signalName} not found`)
      }
      // 更新信号值
      updateLinSignalVal(linDb, signalName, data.value)
    }
  }
}
