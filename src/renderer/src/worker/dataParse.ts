import { writeMessageData } from '../database/dbc/calc'
import { writeMessageData as writeLinMessageData } from '../database/ldf/calc'

import { CanMessage } from 'nodeCan/can'
import { LinMsg } from 'nodeCan/lin'
import { ServiceItem } from 'nodeCan/uds'
import { DataSet } from 'src/preload/data'
import { OsEvent, TaskStatus, taskStatusRecord, TaskType, taskTypeRecord } from 'nodeCan/osEvent'
import OsStatistics from './osStatistics'
// Database reference
let database: DataSet['database']

const osStatistics: Map<string, OsStatistics> = new Map()
function parseLinData(raw: any) {
  const findDb = (db?: string) => {
    if (!db) return null
    return database.lin[db]
  }

  const result: Record<string, any> = {}
  const list: any[] = []

  for (const sraw of raw) {
    const msg: LinMsg = sraw.message.data
    const db = findDb(msg.database)

    if (db) {
      if (!msg.name) {
        for (const frame of Object.values(db.frames)) {
          if (frame.id === msg.frameId) {
            msg.name = frame.name
            break
          }
        }
      }
      if (msg.name) {
        //find frame by frameId
        const frame = db.frames[msg.name]
        // Process signals if available
        if (frame && frame.signals) {
          msg.children = []
          writeLinMessageData(frame, msg.data, db)
          for (const signal of frame.signals) {
            // Find signal definition
            const signalDef = db.signals[signal.name]
            if (!signalDef) continue

            // Create signal key
            const signalKey = `lin.${db.name}.signals.${signal.name}`

            // Initialize array if needed
            if (!result[signalKey]) {
              result[signalKey] = []
            }

            //转为秒
            const ts = parseFloat(((msg.ts || 0) / 1000000).toFixed(6))
            const value = signalDef.physValue
            result[signalKey].push([
              ts,
              {
                value: value,
                rawValue: signalDef.value
              }
            ])
            msg.children.push({
              name: signalDef.signalName,
              data: `${signalDef.physValueEnum ? signalDef.physValueEnum : signalDef.physValue}  ${
                signalDef.value
              }`
            })
          }
        }
      }
    }
    list.push(sraw)
  }
  result['linBase'] = list
  return result
}

function parseCanData(raw: any) {
  const result: Record<string, any> = {}
  const findDb = (db?: string) => {
    if (!db) return null
    return database.can[db]
  }
  const list: any[] = []

  for (const sraw of raw) {
    const msg: CanMessage = sraw.message.data
    const db = findDb(msg.database)
    if (db) {
      const frame = db.messages[msg.id]
      if (frame) {
        msg.name = frame.name
        msg.children = []
        writeMessageData(frame, msg.data, db)
        for (const signal of Object.values(frame.signals)) {
          const signalKey = `can.${db.name}.signals.${signal.name}`
          if (!result[signalKey]) {
            result[signalKey] = []
          }
          const ts = parseFloat(((msg.ts || 0) / 1000000).toFixed(6))
          const value = signal.physValue
          result[signalKey].push([
            ts,
            {
              value: value,
              rawValue: signal.value
            }
          ])
          msg.children.push({
            name: signal.name,
            data: `${signal.physValueEnum ? signal.physValueEnum : signal.physValue}  ${
              signal.value
            }`
          })
        }
      }
    }

    list.push(sraw)
  }
  result['canBase'] = list
  return result
}

function parseORTIData(raw: any) {
  const result: Record<string, any> = {}
  const findDb = (db?: string) => {
    if (!db) return null
    return database.orti[db]
  }
  const list: any[] = []

  for (const rawEvent of raw) {
    const osEvent: OsEvent = rawEvent.message.data
    const ts = rawEvent.message.ts
    const db = findDb(osEvent.database)

    const eventData = {
      name: '',
      ts: ts,
      data: `Index:${osEvent.index} Time:${osEvent.ts} Core:${osEvent.coreId} ${getStatusDescription(osEvent.type, osEvent.status)}`,
      id: getID(osEvent.type, osEvent.id, osEvent.coreId)
    }
    if (db) {
      const timestampInSeconds = parseFloat(((ts || 0) / 1000000).toFixed(6))

      let name
      if (osEvent.type == TaskType.TASK || osEvent.type == TaskType.ISR) {
        // Find matching configuration for this event
        const config = db.coreConfigs.find(
          (item) =>
            item.coreId === osEvent.coreId && item.type === osEvent.type && item.id === osEvent.id
        )
        name = config?.name
      } else if (osEvent.type == TaskType.RESOURCE) {
        const config = db.resourceConfigs.find(
          (item) => item.coreId === osEvent.coreId && item.id === osEvent.id
        )
        name = config?.name
      } else if (osEvent.type == TaskType.SERVICE) {
        const config = db.serviceConfigs.find((item) => item.id === osEvent.id)
        name = config?.name
      } else if (osEvent.type == TaskType.HOOK) {
        const config = db.hostConfigs.find((item) => item.id === osEvent.id)
        name = config?.name
      }
      eventData.name = name || ''

      const osStat = osStatistics.get(db.id)
      if (osStat) {
        const pr = osStat.processEvent(osEvent)
        for (const item of pr) {
          if (item.error) {
            list.push({
              message: {
                method: 'osError',
                error: item.error,
                ts: ts
              }
            })
            continue
          }
          if (!result[item.id]) {
            result[item.id] = []
          }
          result[item.id].push([
            timestampInSeconds,
            {
              value: item.value.value,
              rawValue: item.value.rawValue
            }
          ])
        }
      }
    }

    list.push({
      message: {
        method: 'osEvent',
        data: eventData
      }
    })
  }

  result['osEvent'] = list

  return result
}

function getID(type: TaskType, id: number, coreId: number): string {
  return `${taskTypeRecord[type]}.${id}_${coreId}`
}
// Helper function to get status description for different event types
function getStatusDescription(type: TaskType, status: number): string {
  switch (type) {
    case TaskType.TASK:
      return `Status:${taskStatusRecord[status as TaskStatus] || `Unknown(${status})`}`
    case TaskType.ISR:
      return `Status:${status === 0 ? 'Start' : 'Stop'}`
    case TaskType.SPINLOCK:
      return `Status:${status === 0 ? 'Locked' : 'Unlocked'}`
    case TaskType.RESOURCE:
      return `Status:${status === 0 ? 'Start' : 'Stop'}`
    case TaskType.HOOK:
      return `Param:${status}`
    case TaskType.SERVICE:
      return `Param:${status}`
    default:
      return `Status:${status}`
  }
}
// Initialize database reference
function initDataBase(db: DataSet['database']) {
  database = db
}

function parseUdsData(raw: any, method: string) {
  const result: Record<string, any> = {}
  const findDb = (db?: string) => {
    if (!db) return null
    return database.can[db]
  }
  const list: any[] = []

  for (const sraw of raw) {
    const msg = sraw.message.data as {
      service: ServiceItem
      ts: number
      recvData?: Uint8Array
      msg?: string
    }

    const params = method == 'udsSent' ? msg.service.params : msg.service.respParams

    ;(msg as any).children = []

    for (const param of params) {
      ;(msg as any).children.push({
        name: param.name,
        data: param.phyValue
      })
    }

    list.push(sraw)
  }

  result[method] = list
  return result
}
function parseSetVar(data: any) {
  const result: Record<string, any> = {}
  for (const item of data) {
    const val = item.message.data
    const ts = (item.message.ts || 0) / 1000000
    if (Array.isArray(val)) {
      for (const sval of val) {
        if (!result[sval.id]) {
          result[sval.id] = []
        }
        result[sval.id].push([
          ts,
          {
            value: sval.value,
            rawValue: sval.value
          }
        ])
      }
    }
  }
  return result
}

// Export functions for both testing and worker usage
export { parseLinData, initDataBase, parseCanData }

// Check if we're in a worker context
declare const self: Worker
const isWorker = typeof self !== 'undefined'
function collectTransferables(obj: any, list: ArrayBuffer[] = []) {
  if (obj instanceof ArrayBuffer) {
    list.push(obj)
  } else if (ArrayBuffer.isView(obj)) {
    // 处理TypedArray (Uint8Array, Float32Array等) 和 DataView
    list.push(obj.buffer as any)
  } else if (Array.isArray(obj)) {
    // 处理数组
    obj.forEach((item) => collectTransferables(item, list))
  } else if (obj && typeof obj === 'object') {
    // 处理对象，但排除已处理的类型
    if (!(obj instanceof ArrayBuffer) && !ArrayBuffer.isView(obj)) {
      Object.values(obj).forEach((value) => collectTransferables(value, list))
    }
  }
  return list
}
// Only set up worker message handler if we're in a worker context
if (isWorker) {
  self.onmessage = (event) => {
    const { method, data } = event.data

    switch (method) {
      case 'initDataBase': {
        initDataBase(data)
        //clear osStatistics
        osStatistics.clear()
        //create osStatistics
        for (const key of Object.keys(database.orti)) {
          const s = new OsStatistics(key, database.orti[key].cpuFreq, database.orti[key])
          for (const item of database.orti[key].coreConfigs) {
            if (item.type == TaskType.TASK) {
              if (item.isIdle || item.name.toLowerCase().includes('idle')) {
                s.markIdleTask(item.id, item.coreId)
              }
            }
          }
          osStatistics.set(key, s)
        }
        break
      }
      case 'canBase': {
        const result = parseCanData(data)
        if (result) {
          self.postMessage(result)
        }
        break
      }
      case 'udsSent':
      case 'udsRecv': {
        const result = parseUdsData(data, method)
        if (result) {
          self.postMessage(result)
        }
        break
      }
      case 'linBase': {
        const result = parseLinData(data)
        if (result) {
          self.postMessage(result)
        }
        break
      }
      case 'setVar': {
        const result = parseSetVar(data)
        if (result) {
          self.postMessage(result)
        }
        break
      }
      case 'osEvent': {
        const result = parseORTIData(data)
        if (result) {
          self.postMessage(result)
        }
        break
      }
      default: {
        const transferables = collectTransferables(data)
        self.postMessage(
          {
            [method]: data
          },
          transferables
        )
        break
      }
    }
  }
}
