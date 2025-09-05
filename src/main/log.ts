/* eslint-disable no-var */
import { transport, createLogger, format, Logger } from 'winston'
import type { Format } from 'logform'
import Transport from 'winston-transport'
import { CAN_ERROR_ID, CanAddr, CanMessage, CanMsgType, getTsUs } from './share/can'
import EventEmitter from 'events'
import { Sequence, ServiceItem } from './share/uds'
import { PayloadType } from './doip'
import { LinMsg } from './share/lin'
import { TestEvent } from 'node:test/reporters'
import { setVar as setVarMain, setVarByKey, getVar as getVarMain } from './var'
import { VarItem } from 'src/preload/data'
import { v4 } from 'uuid'
import { SomeipMessageType } from './share/someip/index'
import { SomeipMessage } from './vsomeip/client'

const isDev = process.env.NODE_ENV !== 'production'

type LogFunc = (...args: any[]) => Transport

export function createLogs(logs: LogFunc[], formats: Format[]) {
  global.sysLog = createLogger({
    transports: logs.map((t) => t()),
    format: format.combine(format.json(), format.label({ label: 'System' }), ...formats)
  })
  global.scriptLog = createLogger({
    transports: logs.map((t) => t()),
    format: format.combine(format.json(), format.label({ label: 'Script' }), ...formats)
  })

  for (const l of logs) {
    addTransport(l)
  }
  for (const f of formats) {
    addFormat(f)
  }
}

class Base extends Transport {
  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts)
    //
    // Consume any custom options here. e.g.:
    // - Connection information for databases
    // - Authentication information for APIs (e.g. loggly, papertrail,
    //   logentries, etc.).
    //
  }

  log(info: any, callback: () => void) {
    if (process.env.VITEST) {
      console.table(info.message)
    }
    // Perform the writing to the remote service
    callback()
  }
}
const instanceFormat = format((info, opts: any) => {
  info.instance = opts.instance
  return info
})

export class CanLOG {
  vendor: string
  log: Logger

  deviceId: string
  constructor(
    vendor: string,
    instance: string,
    deviceId: string,
    private event: EventEmitter
  ) {
    this.deviceId = deviceId
    this.vendor = vendor
    const et1 = externalTransport.map((t) => t.t())
    this.log = createLogger({
      transports: [new Base(), ...et1],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),
        format.label({ label: `Can-${vendor}` }),
        ...externalFormat
      )
    })

    //check device id
    const combinedLogs = this.log.transports.filter((transport) => {
      return (transport as any).devices && (transport as any).devices.indexOf(this.deviceId) == -1
    })

    for (const log of combinedLogs) {
      this.log.remove(log)
    }
    const et2 = externalTransport.map((t) => t.t())
  }
  close() {
    this.log.close()

    this.event.removeAllListeners()
  }
  canBase(data: CanMessage) {
    this.log.debug({
      method: 'canBase',
      deviceId: this.deviceId,
      data
    })
    this.event.emit('can-frame', data)
  }

  setOption(cmd: string, val: any) {
    this.log.info({
      method: 'setOption',
      deviceId: this.deviceId,
      data: { cmd, val }
    })
  }
  error(ts: number, msg?: string) {
    this.log.error({
      method: 'canError',
      deviceId: this.deviceId,
      data: {
        ts: ts,
        msg: msg
      }
    })
  }
}

const externalTransport: { id: string; t: () => Transport }[] = []

export function addTransport(t: () => Transport): string {
  const id = v4()
  externalTransport.push({ id, t })
  return id
}

export function removeTransport(id: string) {
  const index = externalTransport.findIndex((t) => t.id == id)
  if (index != -1) {
    externalTransport.splice(index, 1)
  }
}

const externalFormat: Format[] = []
export function addFormat(f: Format) {
  externalFormat.push(f)
}
export function clearFormat() {
  externalFormat.splice(0, externalFormat.length)
}

export class UdsLOG {
  log: Logger
  methodPrefix: string = ''
  startTime = Date.now()
  constructor(name: string, instance?: string) {
    const et = externalTransport.map((t) => t.t())
    const formatList = [format.json(), format.label({ label: name })]
    if (instance) {
      formatList.push(instanceFormat({ instance: instance }))
    }
    this.log = createLogger({
      transports: [new Base(), ...et],
      format: format.combine(...formatList, ...externalFormat)
    })
  }
  addTransport(t: Transport) {
    this.log.add(t)
  }
  removeTransport(t: Transport) {
    this.log.remove(t)
  }
  sent(testerid: string, service: ServiceItem, ts: number, recvData?: Buffer, msg?: string) {
    this.log.info({
      method: this.methodPrefix + 'udsSent',
      id: testerid,
      data: {
        service,
        ts,
        recvData,
        msg
      }
    })
  }
  recv(testerid: string, service: ServiceItem, ts: number, recvData?: Buffer, msg?: string) {
    this.log.info({
      method: this.methodPrefix + 'udsRecv',
      id: testerid,
      data: {
        service,
        ts,
        recvData,
        msg
      }
    })
  }
  warning(
    testerid: string,
    service: ServiceItem,
    sequence: Sequence,
    seqIndex: number,
    index: number,
    ts: number,
    recvData?: Buffer,
    msg?: string
  ) {
    this.log.warn({
      method: this.methodPrefix + 'udsWarning',
      id: testerid,
      data: {
        service,
        sequence,
        index,
        seqIndex,
        ts,
        recvData,
        msg
      }
    })
  }
  addMethodPrefix(prefix: string) {
    this.methodPrefix = prefix
  }
  scriptMsg(msg: string, ts: number, level: 'info' | 'warn' | 'error' = 'info') {
    this.log[level]({
      method: this.methodPrefix + 'udsScript',
      data: {
        msg,
        ts
      }
    })
  }
  systemMsg(msg: string, ts: number, level: 'info' | 'warn' | 'error' = 'info') {
    this.log[level]({
      method: this.methodPrefix + 'udsSystem',
      data: {
        msg,
        ts
      }
    })
  }
  error(testerid: string, msg: string, ts: number, recvData?: Buffer) {
    this.log.error({
      method: this.methodPrefix + 'udsError',
      id: testerid,
      data: {
        msg,
        ts,
        recvData
      }
    })
  }
  udsIndex(
    testerid: string,
    index: number,
    serviceName: string,
    action: 'start' | 'finished' | 'progress',
    percent?: number
  ) {
    const l = action == 'start' ? 'debug' : 'info'
    this.log[l]({
      method: this.methodPrefix + 'udsIndex',
      id: testerid,
      data: {
        serviceName,
        index,
        action,
        percent
      }
    })
  }
  close() {
    this.log.close()
  }
  testInfo(id: string | undefined, event: TestEvent, msg?: string) {
    this.log.info({
      method: 'testInfo',
      id,
      data: event,
      msg
    })
  }
}

export class DoipLOG {
  vendor: string
  log: Logger

  deviceId: string

  constructor(
    vendor: string,
    instance: string,
    deviceId: string,
    private event: EventEmitter,
    private ts: number
  ) {
    this.vendor = vendor
    this.deviceId = deviceId
    const et1 = externalTransport.map((t) => t.t())
    this.log = createLogger({
      transports: [new Base(), ...et1],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),
        format.label({ label: `IP-${vendor}` }),
        ...externalFormat
      )
    })
    //check device id
    const combinedLogs = this.log.transports.filter((transport) => {
      return (transport as any).devices && (transport as any).devices.indexOf(this.deviceId) == -1
    })
    for (const log of combinedLogs) {
      this.log.remove(log)
    }
    const et2 = externalTransport.map((t) => t.t())
  }
  close() {
    this.log.close()
    this.event.removeAllListeners()
  }
  ipBase(
    type: 'tcp' | 'udp',
    dir: 'OUT' | 'IN',
    local: { address?: string; port?: number },
    remote: { address?: string; port?: number },
    data: Buffer
  ) {
    const ts = getTsUs() - this.ts
    if (data.length < 2) {
      this.error(ts, `error data lenght, data: ${data.toString('hex')}`)
      return ts
    }

    const payloadType = data.readUint16BE(2)
    let name = ''
    switch (payloadType) {
      case PayloadType.DoIP_HeaderNegativeAcknowledge:
        name = 'Generic DoIP header negative acknowledge'
        break
      case PayloadType.DoIP_VehicleIdentificationRequest:
        name = 'Vehicle identification request message'
        break
      case PayloadType.DoIP_VehicleIdentificationRequestWithVIN:
        name = 'Vehicle identification request message with VIN'
        break
      case PayloadType.DoIP_VehicleIdentificationRequestWithEID:
        name = 'Vehicle identification request message with EID'
        break
      case PayloadType.DoIP_VehicleAnnouncementResponse:
        name = 'Vehicle announcement message/vehicle identification response message'
        break
      case PayloadType.DoIP_RouteActivationRequest:
        name = 'Routing activation request'
        break
      case PayloadType.DoIP_RouteActivationResponse:
        name = 'Routing activation response'
        break
      case PayloadType.DoIP_AliveRequest:
        name = 'Alive check request'
        break
      case PayloadType.DoIP_AliveResponse:
        name = 'Alive check response'
        break
      case PayloadType.DoIP_EntityStateRequest:
        name = 'DoIP entity status request'
        break
      case PayloadType.DoIP_EntityStateResponse:
        name = 'DoIP entity status response'
        break
      case PayloadType.DoIP_PowerModeInfoRequest:
        name = 'Diagnostic power mode information request'
        break
      case PayloadType.DoIP_PowerModeInfoResponse:
        name = 'Diagnostic power mode information response'
        break
      case PayloadType.DoIP_DiagnosticMessage:
        name = 'Diagnostic message'
        break
      case PayloadType.DoIP_DiagnosticMessagePositiveAcknowledge:
        name = 'Diagnostic message positive acknowledgement'
        break
      case PayloadType.DoIP_DiagnosticMessageNegativeAcknowledge:
        name = 'Diagnostic message negative acknowledgement'
        break
    }

    const val = {
      dir,
      type,
      local: `${local.address}:${local.port}`,
      remote: `${remote.address}:${remote.port}`,
      data,
      ts: ts,
      name: name
    }

    this.log.info({
      method: 'ipBase',
      deviceId: this.deviceId,
      data: val
    })
    // this.event.emit('ip-frame', val)
    return ts
  }
  error(ts: number, msg?: string) {
    this.log.error({
      method: 'ipError',
      deviceId: this.deviceId,
      data: {
        ts: ts,
        msg: msg
      }
    })
  }
}

export class LinLOG {
  vendor: string
  log: Logger
  deviceId: string

  constructor(
    vendor: string,
    instance: string,
    deviceId: string,
    private event: EventEmitter
  ) {
    this.vendor = vendor
    this.deviceId = deviceId
    const et1 = externalTransport.map((t) => t.t())
    this.log = createLogger({
      transports: [new Base(), ...et1],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),
        format.label({ label: `Lin-${vendor}` }),
        ...externalFormat
      )
    })
    //check device id
    const combinedLogs = this.log.transports.filter((transport) => {
      return (transport as any).devices && (transport as any).devices.indexOf(this.deviceId) == -1
    })

    for (const log of combinedLogs) {
      this.log.remove(log)
    }
  }
  close() {
    this.log.close()

    this.event.removeAllListeners()
  }
  linBase(data: LinMsg) {
    this.log.debug({
      method: 'linBase',
      data,
      deviceId: this.deviceId
    })
    this.event.emit('lin-frame', data)
  }
  sendEvent(msg: string, ts: number) {
    this.log.info({
      method: 'linEvent',
      data: {
        msg,
        ts
      },
      deviceId: this.deviceId
    })
  }
  error(ts: number, msg?: string, data?: LinMsg) {
    this.log.error({
      method: 'linError',
      data: {
        ts,
        msg,
        data
      },
      deviceId: this.deviceId
    })
  }
}

export class VarLOG {
  log: Logger
  id?: string
  constructor(id?: string) {
    this.id = id

    const et1 = externalTransport.map((t) => t.t())
    this.log = createLogger({
      transports: [new Base(), ...et1],
      format: format.combine(format.json(), ...externalFormat)
    })
    //check device id
    const combinedLogs = this.log.transports.filter((transport) => {
      return Array.isArray((transport as any).devices)
    })

    for (const log of combinedLogs) {
      this.log.remove(log)
    }
  }
  setVarByKey(key: string, value: number | string | number[], ts: number) {
    const { found, target } = setVarByKey(key, value)
    if (found && target) {
      this.log.info({
        method: 'setVar',
        data: [{ name: target.name, value, id: target.id, uuid: this.id }],
        ts
      })
      globalThis.varEvent?.emit('update', {
        name: target.name,
        value,
        id: target.id,
        uuid: this.id
      })
    }
  }
  setVarByKeyBatch(data: { key: string; value: number | string | number[] }[], ts: number) {
    const founds: { index: number; var: VarItem }[] = []
    for (const [index, item] of data.entries()) {
      const found = setVarByKey(item.key, item.value)
      if (found) {
        founds.push({
          index,
          var: found.target
        })
      }
    }
    if (founds.length > 0) {
      this.log.info({
        method: 'setVar',
        data: founds.map((f) => ({
          index: f.index,
          name: f.var.name,
          value: data[f.index].value,
          id: f.var.id,
          uuid: this.id
        })),
        ts
      })
      globalThis.varEvent?.emit(
        'update',
        founds.map((f) => ({
          name: f.var.name,
          value: data[f.index].value,
          id: f.var.id,
          uuid: this.id
        }))
      )
    }
  }
  setVar(name: string, value: number | string | number[], ts: number) {
    const { found, target } = setVarMain(name, value)
    if (found && target) {
      this.log.info({
        method: 'setVar',
        data: [{ name: target.name, value, id: target.id, uuid: this.id }],
        ts
      })
      globalThis.varEvent?.emit('update', {
        name: target.name,
        value,
        id: target.id,
        uuid: this.id
      })
    }
  }
  getVar(name: string): number | string | number[] {
    return getVarMain(name)
  }
  close() {
    this.log.close()
  }
}

export class SomeipLOG {
  vendor: string
  log: Logger

  deviceId: string

  constructor(
    vendor: string,
    instance: string,
    deviceId: string,
    private event: EventEmitter
  ) {
    this.vendor = vendor
    this.deviceId = deviceId
    const et1 = externalTransport.map((t) => t.t())
    this.log = createLogger({
      transports: [new Base(), ...et1],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),
        format.label({ label: `${vendor}` }),
        ...externalFormat
      )
    })
    //check device id
    const combinedLogs = this.log.transports.filter((transport) => {
      return (transport as any).devices && (transport as any).devices.indexOf(this.deviceId) == -1
    })
    for (const log of combinedLogs) {
      this.log.remove(log)
    }
  }
  close() {
    this.log.close()

    this.event.removeAllListeners()
  }
  someipBase(header: Buffer, data: Buffer, ts: number) {
    try {
      const headerInfo = {
        ip: '',
        port: 0,
        protocol: 'unknown',
        sending: false,
        instance: 0
      }
      const dataInfo: {
        serviceId: number
        methodId: number
        clientId: number
        sessionId: number
        protocolVersion: number
        interfaceVersion: number
        messageType: SomeipMessageType
        returnCode: number
        payload: Buffer
      } = {
        serviceId: 0,
        methodId: 0,
        clientId: 0,
        sessionId: 0,
        protocolVersion: 0,
        interfaceVersion: 0,
        messageType: SomeipMessageType.UNKNOWN,
        returnCode: 0,
        payload: Buffer.from([])
      }
      dataInfo.serviceId = data.readUint16BE(0)
      dataInfo.methodId = data.readUint16BE(2)
      dataInfo.clientId = data.readUint16BE(8)
      dataInfo.sessionId = data.readUint16BE(10)
      dataInfo.protocolVersion = data.readUint8(12)
      dataInfo.interfaceVersion = data.readUint8(13)
      dataInfo.messageType = data.readUint8(14)
      dataInfo.returnCode = data.readUint8(15)
      dataInfo.payload = data.subarray(16)

      const protocolMap: Record<number, string> = {
        0: 'local',
        1: 'udp',
        2: 'tcp',
        3: 'unknown'
      }
      headerInfo.ip = header.readUint32BE(0).toString(16)
      headerInfo.port = header.readUint16BE(4)
      headerInfo.protocol = protocolMap[header.readUint8(6)] || 'unknown'
      headerInfo.sending = header.readUint8(7) == 1
      headerInfo.instance = header.readUint16BE(8)

      this.log.info({
        method: 'someipBase',
        deviceId: this.deviceId,
        data: {
          header: headerInfo,
          data: dataInfo,
          ts: ts
        }
      })
    } catch (e) {
      this.log.error({
        method: 'someipError',
        deviceId: this.deviceId,
        data: {
          ts: ts,
          error: e
        }
      })
    }

    // this.event.emit('someip-frame', {
    //   header:headerInfo,
    //   data:dataInfo,
    //   ts:ts
    // })
  }
  someipMessage(message: SomeipMessage, ts: number) {
    this.log.info({
      method: 'someipBase',
      deviceId: this.deviceId,
      data: {
        header: {
          sending: false
        },
        data: {
          serviceId: message.service,
          methodId: message.method,
          clientId: message.client,
          sessionId: message.session,
          protocolVersion: message.protocolVersion,
          interfaceVersion: message.interfaceVersion,
          messageType: message.messageType,
          returnCode: message.returnCode,
          payload: Buffer.from(message.payload || [])
        },
        ts: ts
      }
    })
  }
  error(ts: number, msg?: string) {
    this.log.error({
      method: 'someipError',
      deviceId: this.deviceId,
      data: {
        ts: ts,
        msg: msg
      }
    })
  }
}
