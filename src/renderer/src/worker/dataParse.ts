import { writeMessageData } from '../database/dbc/calc'
import { writeMessageData as writeLinMessageData } from '../database/ldf/calc'

import { CanMessage } from 'nodeCan/can'
import { LinMsg } from 'nodeCan/lin'
import { ServiceItem } from 'nodeCan/uds'
import { SomeipMessage, SomeipMessageTypeMap } from 'nodeCan/someip'
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
          msg.signals = {}
          writeLinMessageData(frame, msg.data, db)
          for (const signal of frame.signals) {
            // Find signal definition
            const signalDef = db.signals[signal.name]
            if (!signalDef) continue

            // Create signal key
            const signalKey = `lin.${db.name}.${frame.name}.signals.${signal.name}`

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
            msg.signals[signal.name] = signalDef
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
      const frame = Object.values(db.messages).find((item) => item.id === msg.id)
      if (frame) {
        msg.name = frame.name
        msg.signals = {}
        writeMessageData(frame, msg.data, db)
        for (const signal of Object.values(frame.signals)) {
          const signalKey = `can.${db.name}.${frame.name}.signals.${signal.name}`
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
          msg.signals[signal.name] = signal
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
      id: getID(osEvent.type, osEvent.id, osEvent.coreId),
      raw: osEvent
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
      } else if (osEvent.type == TaskType.RUNABLE) {
        name = 'Runable'
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
      },
      label: db?.name,
      instance: db?.name
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
    const ts = parseFloat(((item.message.ts || 0) / 1000000).toFixed(6))
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

function parsePluginEvent(data: any) {
  const result: Record<string, any> = {}
  for (const item of data) {
    const val = item.message
    result[`${val.method}.${val.id}.${val.event}`] = val.data
  }
  return result
}

function parsePluginError(data: any) {
  const result: Record<string, any> = {}
  for (const item of data) {
    const val = item.message
    result[`${val.method}.${val.id}`] = {
      msg: val.msg,
      data: val.data
    }
  }
  return result
}

function getSomeipReturnCodeDesc(code: number) {
  const map: Record<number, string> = {
    0x00: 'E_OK',
    0x01: 'E_NOT_OK',
    0x02: 'E_UNKNOWN_SERVICE',
    0x03: 'E_UNKNOWN_METHOD',
    0x04: 'E_NOT_READY',
    0x05: 'E_NOT_REACHABLE',
    0x06: 'E_TIMEOUT',
    0x07: 'E_WRONG_PROTOCOL_VERSION',
    0x08: 'E_WRONG_INTERFACE_VERSION',
    0x09: 'E_MALFORMED_MESSAGE',
    0x0a: 'E_WRONG_MESSAGE_TYPE'
  }
  return map[code] || 'UNKNOWN'
}

function parseIPv4FromBuffer(data: Uint8Array, offset: number) {
  if (offset + 4 > data.length) return '0.0.0.0'
  return `${data[offset]}.${data[offset + 1]}.${data[offset + 2]}.${data[offset + 3]}`
}

function toUint8Array(input: any): Uint8Array {
  if (!input) return new Uint8Array()
  if (input instanceof Uint8Array) return input
  if (ArrayBuffer.isView(input))
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (Array.isArray(input)) return new Uint8Array(input)
  if (typeof input === 'object' && input.type === 'Buffer' && Array.isArray(input.data)) {
    return new Uint8Array(input.data)
  }
  return new Uint8Array()
}

type ParsedSomeipMessage = Omit<SomeipMessage, 'payload'> & { payload: Uint8Array }
type DetailNode = { name: string; data: string; children?: DetailNode[] }

function decodeSomeipFromRaw(
  raw: { header?: any; data?: any; ts?: number } | undefined
): ParsedSomeipMessage {
  const header = toUint8Array(raw?.header)
  const data = toUint8Array(raw?.data)
  const ts = raw?.ts || 0
  const protocolMap: Record<number, string> = {
    0: 'local',
    1: 'udp',
    2: 'tcp',
    3: 'unknown'
  }
  const msg: ParsedSomeipMessage = {
    sending: false,
    service: 0,
    instance: 0,
    method: 0,
    client: 0,
    session: 0,
    protocolVersion: 0,
    interfaceVersion: 0,
    messageType: 255 as any,
    returnCode: 0,
    payload: new Uint8Array(),
    ts
  }
  if (data.length >= 16) {
    msg.service = (data[0] << 8) | data[1]
    msg.method = (data[2] << 8) | data[3]
    msg.client = (data[8] << 8) | data[9]
    msg.session = (data[10] << 8) | data[11]
    msg.protocolVersion = data[12]
    msg.interfaceVersion = data[13]
    msg.messageType = data[14] as any
    msg.returnCode = data[15]
    msg.payload = data.subarray(16)
  } else {
    msg.payload = data
  }
  if (header.length >= 10) {
    msg.ip = parseIPv4FromBuffer(header, 0)
    msg.port = (header[4] << 8) | header[5]
    msg.protocol = protocolMap[header[6]] || 'unknown'
    msg.sending = header[7] === 1
    msg.instance = (header[8] << 8) | header[9]
  }
  return msg
}

function parseSdOption(optionType: number, data: Uint8Array) {
  if (data.length < 1) return []
  const children: DetailNode[] = []
  const l4ProtocolMap: Record<number, string> = {
    0x06: 'TCP',
    0x11: 'UDP'
  }

  if (optionType === 0x04 || optionType === 0x14 || optionType === 0x24 || optionType === 0x26) {
    if (optionType === 0x04 || optionType === 0x14) {
      if (data.length >= 9) {
        children.push({ name: 'Reserved', data: `0x${data[0].toString(16).padStart(2, '0')}` })
        children.push({ name: 'IPv4 Address', data: parseIPv4FromBuffer(data, 1) })
        children.push({ name: 'Reserved 2', data: `0x${data[5].toString(16).padStart(2, '0')}` })
        const protocol = l4ProtocolMap[data[6]] || `0x${data[6].toString(16).padStart(2, '0')}`
        children.push({ name: 'Protocol', data: protocol })
        const port = (data[7] << 8) | data[8]
        children.push({ name: 'Port', data: `${port}` })
      }
    } else {
      children.push({
        name: 'Detail',
        data: `IPv6 option payload (${data.length} bytes)`
      })
    }
  } else {
    children.push({
      name: 'Raw Data',
      data: Array.from(data)
        .map((v) => v.toString(16).padStart(2, '0'))
        .join(' ')
    })
  }
  return children
}

function parseSdPayload(payload: Uint8Array) {
  const children: DetailNode[] = []
  if (payload.length < 12) {
    children.push({ name: 'Service Discovery', data: 'Malformed SD payload (too short)' })
    return children
  }

  const flags = payload[0]
  const rebootFlag = (flags & 0x80) !== 0
  const unicastFlag = (flags & 0x40) !== 0
  const explicitInitialDataControlFlag = (flags & 0x20) !== 0

  const reserved = `0x${payload[1].toString(16).padStart(2, '0')}${payload[2].toString(16).padStart(2, '0')}${payload[3].toString(16).padStart(2, '0')}`

  const entriesLength = (payload[4] << 24) | (payload[5] << 16) | (payload[6] << 8) | payload[7]
  const entriesStart = 8
  const entriesEnd = entriesStart + entriesLength
  if (entriesEnd > payload.length) {
    children.push({ name: 'Entries', data: 'Malformed entries length' })
    return children
  }

  const entriesChildren: DetailNode[] = []
  const entryTypeMap: Record<number, string> = {
    0x00: 'Find Service',
    0x01: 'Offer Service',
    0x06: 'Subscribe Eventgroup',
    0x07: 'Subscribe Eventgroup ACK'
  }
  for (let i = entriesStart; i + 15 < entriesEnd; i += 16) {
    const type = payload[i]
    const index1 = payload[i + 1]
    const index2 = payload[i + 2]
    const numOpt = payload[i + 3]
    const numOpt1 = (numOpt & 0xf0) >> 4
    const numOpt2 = numOpt & 0x0f
    const serviceId = (payload[i + 4] << 8) | payload[i + 5]
    const instanceId = (payload[i + 6] << 8) | payload[i + 7]
    const majorVersion = payload[i + 8]
    const ttl = (payload[i + 9] << 16) | (payload[i + 10] << 8) | payload[i + 11]
    const tailRaw =
      (payload[i + 12] << 24) | (payload[i + 13] << 16) | (payload[i + 14] << 8) | payload[i + 15]

    const entryLabel = entryTypeMap[type] || `Unknown(0x${type.toString(16).padStart(2, '0')})`
    const baseSummary = `${entryLabel} S:0x${serviceId
      .toString(16)
      .padStart(4, '0')} I:0x${instanceId
      .toString(16)
      .padStart(
        4,
        '0'
      )} Maj:${majorVersion} TTL:${ttl} Opt:[${index1}+${numOpt1}, ${index2}+${numOpt2}]`
    if (type === 0x00 || type === 0x01) {
      entriesChildren.push({
        name: `Entry ${Math.floor((i - entriesStart) / 16)}`,
        data: `${entryLabel}`,
        children: [
          {
            name: 'Service/Instance',
            data: `S:0x${serviceId.toString(16).padStart(4, '0')} I:0x${instanceId.toString(16).padStart(4, '0')}`
          },
          { name: 'Version/TTL', data: `Maj:${majorVersion} Min:${tailRaw >>> 0} TTL:${ttl}` },
          { name: 'OptionRefs', data: `[${index1}+${numOpt1}, ${index2}+${numOpt2}]` }
        ]
      })
    } else if (type === 0x06 || type === 0x07) {
      const counter = (tailRaw >>> 16) & 0x0f
      const eventgroup = tailRaw & 0xffff
      entriesChildren.push({
        name: `Entry ${Math.floor((i - entriesStart) / 16)}`,
        data: `${entryLabel}`,
        children: [
          {
            name: 'Service/Instance',
            data: `S:0x${serviceId.toString(16).padStart(4, '0')} I:0x${instanceId.toString(16).padStart(4, '0')}`
          },
          { name: 'Version/TTL', data: `Maj:${majorVersion} TTL:${ttl}` },
          {
            name: 'Eventgroup',
            data: `Cnt:${counter} EG:0x${eventgroup.toString(16).padStart(4, '0')}`
          },
          { name: 'OptionRefs', data: `[${index1}+${numOpt1}, ${index2}+${numOpt2}]` }
        ]
      })
    } else {
      entriesChildren.push({
        name: `Entry ${Math.floor((i - entriesStart) / 16)}`,
        data: `${entryLabel}`,
        children: [
          {
            name: 'Service/Instance',
            data: `S:0x${serviceId.toString(16).padStart(4, '0')} I:0x${instanceId.toString(16).padStart(4, '0')}`
          },
          { name: 'Version/TTL', data: `Maj:${majorVersion} TTL:${ttl}` },
          { name: 'Tail', data: `0x${(tailRaw >>> 0).toString(16).padStart(8, '0')}` },
          { name: 'OptionRefs', data: `[${index1}+${numOpt1}, ${index2}+${numOpt2}]` }
        ]
      })
    }
  }
  children.push({
    name: 'SD',
    data: `Flags:0x${flags.toString(16).padStart(2, '0')} Reboot:${rebootFlag} Unicast:${unicastFlag} EIDC:${explicitInitialDataControlFlag} Reserved:${reserved}`
  })
  children.push({
    name: 'Entries',
    data: `${entriesChildren.length} item(s)`,
    children: entriesChildren
  })

  const optionsLenPos = entriesEnd
  if (optionsLenPos + 4 > payload.length) {
    children.push({ name: 'Length of Options Array', data: 'Malformed options length' })
    return children
  }
  const optionsLength =
    (payload[optionsLenPos] << 24) |
    (payload[optionsLenPos + 1] << 16) |
    (payload[optionsLenPos + 2] << 8) |
    payload[optionsLenPos + 3]
  const optionsStart = optionsLenPos + 4
  const optionsEnd = optionsStart + optionsLength
  if (optionsEnd > payload.length) {
    children.push({ name: 'Options Array', data: 'Malformed options length' })
    return children
  }

  const optionTypeMap: Record<number, string> = {
    0x01: 'Configuration Option',
    0x02: 'Load Balancing Option',
    0x04: 'IPv4 Endpoint Option',
    0x06: 'IPv4 Multicast Option',
    0x14: 'IPv4 SD Endpoint Option',
    0x24: 'IPv6 Endpoint Option',
    0x26: 'IPv6 Multicast Option'
  }
  let offset = optionsStart
  let optionIndex = 0
  const optionChildrenList: DetailNode[] = []
  while (offset + 4 <= optionsEnd) {
    const length = (payload[offset] << 8) | payload[offset + 1]
    if (length < 2) {
      children.push({ name: `Option ${optionIndex}`, data: 'Malformed option length' })
      break
    }
    const optionTotal = length + 2
    if (offset + optionTotal > optionsEnd) {
      children.push({ name: `Option ${optionIndex}`, data: 'Option exceeds options array length' })
      break
    }
    const type = payload[offset + 2]
    const reserved = payload[offset + 3]
    const dataStart = offset + 4
    const dataEnd = offset + optionTotal
    const optionData = payload.subarray(dataStart, dataEnd)
    const typeText = optionTypeMap[type] || `Unknown(0x${type.toString(16).padStart(2, '0')})`

    const optionSummary = `${typeText} Len:${length} Res:0x${reserved.toString(16).padStart(2, '0')}`
    const optionChildren = parseSdOption(type, optionData)
    optionChildrenList.push({
      name: `Option ${optionIndex}`,
      data: optionSummary,
      children: optionChildren.length ? optionChildren : undefined
    })
    optionIndex++
    offset += optionTotal
  }
  children.push({
    name: 'Options',
    data: `${optionChildrenList.length} item(s)`,
    children: optionChildrenList
  })

  return children
}

function parseSomeipData(raw: any) {
  const result: Record<string, any> = {}
  const list: any[] = []
  for (const sraw of raw) {
    const source = sraw.message.data as
      | (SomeipMessage & {
          children?: { name: string; data: string }[]
          summary?: string
          sd?: boolean
        })
      | { header?: any; data?: any; ts?: number }

    const msg = (
      (source as any).service === undefined
        ? decodeSomeipFromRaw(source as any)
        : {
            ...(source as any),
            payload: toUint8Array((source as any).payload)
          }
    ) as ParsedSomeipMessage & {
      children?: DetailNode[]
      summary?: string
      sd?: boolean
    }
    const children: DetailNode[] = []
    children.push({
      name: 'SOME/IP Header',
      data: `Service:0x${msg.service.toString(16).padStart(4, '0')} Method/Event:0x${msg.method.toString(16).padStart(4, '0')}`
    })
    children.push({
      name: 'Message Type',
      data: `0x${msg.messageType.toString(16).padStart(2, '0')} (${SomeipMessageTypeMap[msg.messageType] || 'Unknown'})`
    })
    children.push({
      name: 'Return Code',
      data: `0x${msg.returnCode.toString(16).padStart(2, '0')} (${getSomeipReturnCodeDesc(msg.returnCode)})`
    })
    children.push({
      name: 'Version',
      data: `Protocol:${msg.protocolVersion} Interface:${msg.interfaceVersion}`
    })
    children.push({
      name: 'Request ID',
      data: `Client:0x${msg.client.toString(16).padStart(4, '0')} Session:0x${msg.session.toString(16).padStart(4, '0')}`
    })
    if (msg.ip) {
      children.push({
        name: 'Endpoint',
        data: `${msg.ip}:${msg.port ?? 0} (${msg.protocol || 'unknown'})`
      })
    }
    children.push({
      name: 'Payload Length',
      data: `${msg.payload.length}`
    })

    const isSd = msg.service === 0xffff && msg.method === 0x8100
    if (isSd) {
      msg.sd = true
      children.push({
        name: 'SOME/IP Service Discovery',
        data: 'Protocol'
      })
      children.push(...parseSdPayload(new Uint8Array(msg.payload)))
    }
    msg.children = children
    msg.summary = isSd
      ? 'SOME/IP-SD'
      : `${SomeipMessageTypeMap[msg.messageType] || 'Unknown'} Service 0x${msg.service
          .toString(16)
          .padStart(4, '0')}`
    sraw.message.data = msg
    list.push(sraw)
  }
  result['someipBase'] = list
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
let port: MessagePort
function dataHandle(method: string, data: any) {
  switch (method) {
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
    case 'pluginEvent': {
      const result = parsePluginEvent(data)
      if (result) {
        self.postMessage(result)
      }
      break
    }
    case 'pluginError': {
      const result = parsePluginError(data)
      if (result) {
        self.postMessage(result)
      }
      break
    }
    case 'someipBase': {
      const result = parseSomeipData(data)
      if (result) {
        self.postMessage(result)
      }
      break
    }
    default: {
      // const transferables = collectTransferables(data)
      self.postMessage({
        [method]: data
      })
      break
    }
  }
}
// Only set up worker message handler if we're in a worker context
if (isWorker) {
  self.onmessage = (event) => {
    const { method, data } = event.data

    switch (method) {
      case 'onmessage': {
        port = data
        port.onmessage = (event: MessageEvent<any[]>) => {
          const data = event.data
          const groups: { method: string; data: any[] }[] = [] // 存储所有分组，每个元素是 {method, data} 对象
          let currentGroup: { method: string; data: any[] } | null = null
          data.forEach((item: any) => {
            const method = item.message.method

            // 如果是新的method或者当前组的method不同，创建新组
            if (!currentGroup || currentGroup.method !== method) {
              if (currentGroup) {
                groups.push(currentGroup)
              }
              currentGroup = {
                method: method,
                data: []
              }
            }

            currentGroup.data.push(item)
          })

          // 添加最后一组
          if (currentGroup) {
            groups.push(currentGroup)
          }

          // 按顺序发送每个组的数据
          groups.forEach((group) => {
            // window.logBus.emit(group.method, undefined, group.data)
            dataHandle(group.method, group.data)
          })
        }
        break
      }
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
      default: {
        // const transferables = collectTransferables(data)
        self.postMessage({
          [method]: data
        })
        break
      }
    }
  }
}
