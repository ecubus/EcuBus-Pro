/* eslint-disable no-var */
import { BrowserWindow } from 'electron'
import { transport, createLogger, format, Logger } from 'winston'
import Transport from 'winston-transport'
import log from 'electron-log/main';
import { CAN_ERROR_ID, CanAddr, CanMessage, CanMsgType, getTsUs } from './share/can'
import EventEmitter from 'events'
import { Sequence, ServiceItem } from './share/uds'
import { PayloadType } from './doip';

declare global {
    var sysLog: Logger
    var scriptLog: Logger
}


const isDev=process.env.NODE_ENV !== 'production'



class ElectronLog extends Transport {
    win: BrowserWindow
    constructor(win: BrowserWindow, opts?: Transport.TransportStreamOptions) {
        super(opts)
        this.win = win
    }

    log(info: any, callback: () => void) {
        let send=true
      
        if(info.level=='debug'&&!isDev){
            send=false
        }
        let ipcc='ipc-log-main'
        if (info.message?.method){
            ipcc=`ipc-log-${info.message.method}`
        }
        if(send){
            this.win.webContents.send(ipcc, info)
        }
        if (info.level == 'error') {
            log.error(info)
        }
        


      
        
        callback()
    }
}


export function createLogs(win: BrowserWindow) {
    const logTransport = new ElectronLog(win)
    globalThis.sysLog = createLogger({
        transports: [logTransport],
        format: format.combine(
            format.json(),
            format.label({ label: 'System' }
            )
        ),
    })
    globalThis.scriptLog = createLogger({
        transports: [logTransport],
        format: format.combine(
            format.json(),
            format.label({ label: 'Script' }
            )
        ),
    })
    addTransport(()=>{
        return new ElectronLog(win)
    })
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
const instanceFormat = format((info, opts) => {
  info.instance = opts.instance
  return info
})

export class CanLOG {
  vendor: string
  log: Logger
  logTp: Logger
  constructor(vendor: string, instance: string, private event: EventEmitter) {
    this.vendor = vendor
    const et1 = externalTransport.map((t) => t())
    this.log = createLogger({
      transports: [new Base(), ...et1],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),

        format.label({ label: `Can-${vendor}` })
      ),

    })
    const et2 = externalTransport.map((t) => t())
    this.logTp = createLogger({
      transports: [new Base(), ...et2],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),
        format.label({ label: `CanTp-${vendor}` })
      ),
    })
  }
  close() {
    this.log.close()
    this.logTp.close()
    this.event.removeAllListeners()

  }
  canBase(data: CanMessage) {
    this.log.info({
      method: 'canBase',
      data
    })
    this.event.emit('can-frame', data)
  }
  canTp(data: { dir: 'OUT' | 'IN'; data: Buffer; ts: number; addr: CanAddr }) {
    this.logTp.info(
      {
        method: 'canTp',
        data
      }
    )
  }
  error(ts: number, msg?: string) {
    this.log.error(
      {
        method: 'canError',
        data: {
          ts: ts,
          msg: msg
        }
      }
    )
  }
}

const externalTransport: (() => Transport)[] = []

export function addTransport(t: () => Transport) {
  externalTransport.push(t)
}


export function clearTransport() {
  externalTransport.splice(0, externalTransport.length)
}
export class UdsLOG {
  log: Logger
  startTime = Date.now()
  constructor(name: string, private id?: string) {
    const et = externalTransport.map((t) => t())
    this.log = createLogger({
      transports: [new Base(), ...et],
      format: format.combine(
        format.json(),

        format.label({ label: name })
      ),
    })
  }
  sent(service: ServiceItem, ts: number,recvData?: Buffer, msg?: string) {
    this.log.info({
      method: 'udsSent',
      id: this.id,
      data: {
        service,
        ts,
        recvData,
        msg
      }
    })
  }
  recv(service: ServiceItem, ts: number, recvData?: Buffer, msg?: string) {
    this.log.info({
      method: 'udsRecv',
      id: this.id,
      data: {
        service,
        ts,
        recvData,
        msg
      }
    })
  }
  warning(service: ServiceItem, sequence: Sequence, seqIndex: number, index: number, ts: number, recvData?: Buffer, msg?: string) {
    this.log.warn({
      method: 'udsWarning',
      id: this.id,
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
  scriptMsg(msg: string, ts: number, level: 'info' | 'warn' | 'error' = 'info') {
    this.log[level]({
      method: 'udsScript',
      data: {
        msg,
        ts,
      }
    })
  }
  systemMsg(msg: string, ts: number, level: 'info' | 'warn' | 'error' = 'info') {
    this.log[level]({
      method: 'udsSystem',
      data: {
        msg,
        ts,
      }
    })
  }
  error(msg: string, ts: number, recvData?: Buffer) {
    this.log.error({
      method: 'udsError',
      id: this.id,
      data: {
        msg,
        ts,
        recvData
      }
    })
  }
  udsIndex(index: number, action: 'start' | 'finished' | 'progress', percent?: number) {
    this.log.info({
      method: 'udsIndex',
      id: this.id,
      data: {
        index,
        action,
        percent
      }
    })

  }
  close() {
    this.log.close()
  }

}


export class DoipLOG {
  vendor: string
  log: Logger
  logTp: Logger

  constructor(vendor: string, instance: string, private event: EventEmitter,private ts:number) {
    this.vendor = vendor
    const et1 = externalTransport.map((t) => t())
    this.log = createLogger({
      transports: [new Base(), ...et1],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),

        format.label({ label: `IP-${vendor}` })
      ),

    })
    const et2 = externalTransport.map((t) => t())
    this.logTp = createLogger({
      transports: [new Base(), ...et2],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),
        format.label({ label: `CanTp-${vendor}` })
      ),
    })
  }
  close() {
    this.log.close()
    this.logTp.close()
    this.event.removeAllListeners()

  }
  ipBase(type:'tcp'|'udp',dir:'OUT'|'IN',local:{address?:string,port?:number},remote:{address?:string,port?:number},data:Buffer) {
    const payloadType = data.readUint16BE(2)
    let name=''
    switch(payloadType){
      case PayloadType.DoIP_HeaderNegativeAcknowledge:
        name='Generic DoIP header negative acknowledge'
        break
      case PayloadType.DoIP_VehicleIdentificationRequest:
        name='Vehicle identification request message'
        break
      case PayloadType.DoIP_VehicleIdentificationRequestWithVIN:
        name='Vehicle identification request message with VIN'
        break
      case PayloadType.DoIP_VehicleIdentificationRequestWithEID:
        name='Vehicle identification request message with EID'
        break
      case PayloadType.DoIP_VehicleAnnouncementResponse:
        name='Vehicle announcement message/vehicle identification response message'
        break
      case PayloadType.DoIP_RouteActivationRequest:
        name='Routing activation request'
        break
      case PayloadType.DoIP_RouteActivationResponse:
        name='Routing activation response'
        break
      case PayloadType.DoIP_AliveRequest:
        name='Alive check request'
        break
      case PayloadType.DoIP_AliveResponse:
        name='Alive check response'
        break
      case PayloadType.DoIP_EntityStateRequest:
        name='DoIP entity status request'
        break
      case PayloadType.DoIP_EntityStateResponse:
        name='DoIP entity status response'
        break
      case PayloadType.DoIP_PowerModeInfoRequest:
        name='Diagnostic power mode information request'
        break
      case PayloadType.DoIP_PowerModeInfoResponse:
        name='Diagnostic power mode information response'
        break
      case PayloadType.DoIP_DiagnosticMessage:
        name='Diagnostic message'
        break
      case PayloadType.DoIP_DiagnosticMessagePositiveAcknowledge:
        name='Diagnostic message positive acknowledgement'
        break
      case PayloadType.DoIP_DiagnosticMessageNegativeAcknowledge:
        name='Diagnostic message negative acknowledgement'
        break



    }
    const ts=getTsUs()-this.ts
    const val={
      dir,
      type,
      local:`${local.address}:${local.port}`,
      remote:`${remote.address}:${remote.port}`,
      data,
      ts:ts,
      name:name,
    }
    this.log.info({
      method: 'ipBase',
      data:val
    })
    // this.event.emit('ip-frame', val)
    return ts
  }
  // doipTp(data: { dir: 'OUT' | 'IN'; data: Buffer; ts: number; addr: CanAddr }) {
  //   this.logTp.info(
  //     {
  //       method: 'canTp',
  //       data
  //     }
  //   )
  // }
  error(ts: number, msg?: string) {
    this.log.error(
      {
        method: 'ipError',
        data: {
          ts: ts,
          msg: msg
        }
      }
    )
  }
}