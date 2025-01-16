import {
  UdsDevice,
  Project,
  Sequence,
  Param,
  param2raw,
  ServiceItem,
  getTxPdu,
  getRxPdu,
  UdsAddress,
  getUdsAddrName,
  getUdsDeviceName,
  applyBuffer
} from '../share/uds'
import { CanAddr, CanBase, CanBaseInfo, CanNode, getTsUs } from '../share/can'
// #v-ifdef IGNORE_NODE!='1'
import { PEAK_TP } from './peak'
import { KVASER_CAN } from './kvaser'
import { ZLG_CAN } from './zlg'
// #v-endif
import path from 'path'
import Handlebars from 'handlebars'
import fsP from 'fs/promises'
import fs from 'fs'
import udsHeaderStr from '../share/uds.d.ts.html?raw'
import crcStr from '../share/crc.d.ts.html?raw'
import cryptoExtStr from '../share/cryptoExt.d.ts.html?raw'
import zlibStr from '../share/node/zlib.d.ts.html?raw'
import assertStr from '../share/node/assert.d.ts.html?raw'
import async_hooksStr from '../share/node/async_hooks.d.ts.html?raw'
import bufferStr from '../share/node/buffer.d.ts.html?raw'
import child_processStr from '../share/node/child_process.d.ts.html?raw'
import clusterStr from '../share/node/cluster.d.ts.html?raw'
import consoleStr from '../share/node/console.d.ts.html?raw'
import constantsStr from '../share/node/constants.d.ts.html?raw'
import cryptoStr from '../share/node/crypto.d.ts.html?raw'
import dgramStr from '../share/node/dgram.d.ts.html?raw'
import diagnostics_channelStr from '../share/node/diagnostics_channel.d.ts.html?raw'
import dnsStr from '../share/node/dns.d.ts.html?raw'
import domainStr from '../share/node/domain.d.ts.html?raw'
import domEventsStr from '../share/node/dom-events.d.ts.html?raw'
import eventsStr from '../share/node/events.d.ts.html?raw'
import fsStr from '../share/node/fs.d.ts.html?raw'
import globalsStr from '../share/node/globals.d.ts.html?raw'
import globals_globalStr from '../share/node/globals.global.d.ts.html?raw'
import httpStr from '../share/node/http.d.ts.html?raw'
import http2Str from '../share/node/http2.d.ts.html?raw'
import httpsStr from '../share/node/https.d.ts.html?raw'
import indexStr from '../share/node/index.d.ts.html?raw'
import inspectorStr from '../share/node/inspector.d.ts.html?raw'
import moduleStr from '../share/node/module.d.ts.html?raw'
import netStr from '../share/node/net.d.ts.html?raw'
import osStr from '../share/node/os.d.ts.html?raw'
import pathStr from '../share/node/path.d.ts.html?raw'
import perf_hooksStr from '../share/node/perf_hooks.d.ts.html?raw'
import processStr from '../share/node/process.d.ts.html?raw'
import punycodeStr from '../share/node/punycode.d.ts.html?raw'
import querystringStr from '../share/node/querystring.d.ts.html?raw'
import readlineStr from '../share/node/readline.d.ts.html?raw'
import replStr from '../share/node/repl.d.ts.html?raw'
import streamStr from '../share/node/stream.d.ts.html?raw'
import string_decoderStr from '../share/node/string_decoder.d.ts.html?raw'
import testStr from '../share/node/test.d.ts.html?raw'
import timersStr from '../share/node/timers.d.ts.html?raw'
import tlsStr from '../share/node/tls.d.ts.html?raw'
import trace_eventsStr from '../share/node/trace_events.d.ts.html?raw'
import ttyStr from '../share/node/tty.d.ts.html?raw'
import urlStr from '../share/node/url.d.ts.html?raw'
import utilStr from '../share/node/util.d.ts.html?raw'
import v8Str from '../share/node/v8.d.ts.html?raw'
import vmStr from '../share/node/vm.d.ts.html?raw'
import wasiStr from '../share/node/wasi.d.ts.html?raw'
import worker_threadsStr from '../share/node/worker_threads.d.ts.html?raw'
//subfolder
import fsPromiseStr from '../share/node/fs/promises.d.ts.html?raw'
import assertSubStr from '../share/node/assert/strict.d.ts.html?raw'
import dnsSubStr from '../share/node/dns/promises.d.ts.html?raw'
import readLimeStr from '../share/node/readline/promises.d.ts.html?raw'
import streamSubStr1 from '../share/node/stream/consumers.d.ts.html?raw'
import streamSubStr2 from '../share/node/stream/promises.d.ts.html?raw'
import streamSubStr3 from '../share/node/stream/web.d.ts.html?raw'
import timerSubStr from '../share/node/timers/promises.d.ts.html?raw'

import { cloneDeep, get } from 'lodash'
import UdsTester from '../workerClient'
import { execFile as execCb } from 'child_process'
import util from 'util'
import { TesterInfo } from '../share/tester'
import { CAN_TP, CAN_TP_SOCKET, CanTp, TpError } from './cantp'

import { SIMULATE_CAN } from './simulate'
import { ServiceId, SupportServiceId, serviceDetail } from '../share/service'
import { UdsLOG } from '../log'
import tsconfig from './ts.json'
import json5 from 'json5'
import { v4 } from 'uuid'
import { glob } from 'glob'
import { DOIP, DOIP_SOCKET } from '../doip'
import LinBase from '../dolin/base'
import { LIN_TP, LIN_TP_SOCKET } from '../dolin/lintp'
import { LinMode } from '../share/lin'
import { LDF } from 'src/renderer/src/database/ldfParse'
import { DataSet } from 'src/preload/data'
const NRCMsg: Record<number, string> = {
  0x10: 'General Reject',
  0x11: 'Service Not Supported',
  0x12: 'Subfunction Not Supported',
  0x13: 'Incorrect Message Length Or Invalid Format',
  0x14: 'Response Too Long',
  0x21: 'Busy Repeat Request',
  0x22: 'Conditions Not Correct',
  0x24: 'Request Sequence Error',
  0x25: 'No Response From Subnet Component',
  0x26: 'Failure Prevents Execution Of Requested Action',
  0x31: 'Request Out Of Range',
  0x33: 'Security Access Denied',
  0x35: 'Invalid Key',
  0x36: 'Exceed Number Of Attempts',
  0x37: 'Required Time Delay Not Expired',
  0x70: 'Upload Download Not Accepted',
  0x71: 'Transfer Data Suspended',
  0x72: 'General Programming Failure',
  0x73: 'Wrong Block Sequence Counter',
  0x78: 'Request Correctly Received-Response Pending',
  0x7E: 'Subfunction Not Supported In Active Session',
  0x7F: 'Service Not Supported In Active Session',
  0x81: 'Rpm Too High',
  0x82: 'Rpm Too Low',
  0x83: 'Engine Is Running',
  0x84: 'Engine Is Not Running',
  0x85: 'Engine Run Time Too Low',
  0x86: 'Temperature Too High',
  0x87: 'Temperature Too Low',
  0x88: 'Vehicle Speed Too High',
  0x89: 'Vehicle Speed Too Low',
  0x8A: 'Throttle/Pedal Position Too High',
  0x8B: 'Throttle/Pedal Position Too Low',
  0x8C: 'Transmission Range Not In Neutral',
  0x8D: 'Transmission Range Not In Gear',
  0x8F: 'Brake Switch(es) Not Closed',
  0x90: 'Shifter Lever Not In Park',
  0x91: 'Torque Converter Clutch Locked',
  0x92: 'Voltage Too High',
  0x93: 'Voltage Too Low',
}


const exec = util.promisify(execCb)
// const spawn = util.promisify(spwn)

interface ProjectConfig {
  projectPath: string
  projectName: string
}
export function updateUdsDts(data:DataSet) {
  const nameString: string[] = []
  const jobs: { name: string; param: string[] }[] = []
  for (const tester of Object.values(data.tester)) {
    nameString.push(`${tester.name}.*`)
    for (const items of Object.values(tester.allServiceList)) {
      for (const item of items) {
        if (item.serviceId != 'Job') {
          nameString.push(`${tester.name}.${item.name}`)
        } else {
          const param = item.params.map((item) => {
            let ty = 'number'
            if (item.type == 'ASCII' || item.type == 'UNICODE') {
              ty = 'string'
            }
            return `${item.name}:${ty}`
          })
          jobs.push({ name: `${tester.name}.${item.name}`, param: param })
        }
      }
    }
  }
  //const Signals
  const signals:string[]=[]
  for(const ldf of Object.values(data.database.lin)){
    for(const sig of Object.values(ldf.signals)){
      signals.push(`${ldf.name}.${sig.signalName}`)
    }
  }
  //lib

  const libTmpl = Handlebars.compile(udsHeaderStr)
  const libResult = libTmpl({
    testers: Object.values(data.tester).map((item) => item.name),
    services: [...new Set(nameString)],
    jobs: jobs,
    signals:signals
  })
  return libResult
}
export class UDSTesterMain {
  activeId = ''
  startTime = 0
  closeBase = true
  lastActiveTs = 0
  tester: TesterInfo

  project: ProjectConfig
  runningCanBase?: CanBase
  runningDoip?:DOIP
  runningLinBase?: LinBase
  services: Record<string, ServiceItem> = {}
  constructor(project: ProjectConfig, tester: TesterInfo, private device: UdsDevice) {
    this.project = project
    this.tester = cloneDeep(tester)
    for (const s of Object.values(this.tester.allServiceList)) {
      for (const item of s) {
        this.services[item.id] = item
      }
    }
  }
  ac: AbortController = new AbortController()
  pool?: UdsTester

  cancel() {

    this.ac.abort()
  }
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.lastActiveTs += ms * 1000
        resolve()
      }, ms)
    })
  }
  private async execJob(method: string, params: any[]): Promise<ServiceItem[]> {
    if (this.pool) {
      return await this.pool.exec(this.tester.name, method, params)
    } else {
      return []
    }
  }
  setCanBase(base?: CanBase) {
    this.runningCanBase = base
    this.closeBase = false
  }
  setDoip(doip?:DOIP){
    this.runningDoip=doip
    this.closeBase=false
  }
  setLinBase(base?: LinBase) {
    this.runningLinBase = base
    this.closeBase = false
  }
  async runSequence(seqIndex: number, cycle?: number) {
    this.ac = new AbortController()
    const targetDevice = this.device
    if (targetDevice) {
      const log = new UdsLOG(`${this.tester.name} Seq#${seqIndex}`, this.tester.id)
      if (this.tester.script) {

        let scriptPath
        if (path.isAbsolute(this.tester.script) === false) {
          scriptPath = path.join(this.project.projectPath, this.tester.script)
        } else {
          scriptPath = this.tester.script
        }
        if (scriptPath.endsWith('.ts') === false) {
          throw new Error('script file should be a typescript file')
        }


        const outDir = path.join(this.project.projectPath, '.ScriptBuild')

        //change ts to outdir/*js
        const scriptNameNoExt = path.basename(scriptPath, '.ts')
        const jsPath = path.join(outDir, scriptNameNoExt + '.js')

        this.pool = new UdsTester({
          PROJECT_ROOT: this.project.projectPath,
          PROJECT_NAME: this.project.projectName,
          MODE: 'sequence',
          NAME: this.tester.name,
        }, jsPath, log, this.tester)
        this.pool?.updateTs(0)
        try {
          await this.pool.start(this.project.projectPath)
        } catch (e: any) {
          log.error(e.message, 0)
          log.close()
          throw e
        }
      }
      let cycleCount = 1
      if (cycle && Number(cycle) > 1) {
        cycleCount = Number(cycle)
      }

      if (targetDevice.type == 'can' && targetDevice.canDevice) {

        try {
          if (this.runningCanBase) {
            await this.runCanSequenceWithBase(this.runningCanBase, seqIndex, log, cycleCount)
          } else {
            // await this.runCanSequence(targetDevice.canDevice, seqIndex, log, cycleCount)
            throw new Error('can base not found')
          }
        } catch (e: any) {
          if (this.ac.signal.aborted) {
            null
          } else {
            log.error(e.message, this.lastActiveTs, undefined)
            log.close()
            throw e
          }
        }
      }else if (targetDevice.type == 'eth' && targetDevice.ethDevice) {

        try {
          if (this.runningDoip) {
            await this.runEthSequenceWithBase(this.runningDoip, seqIndex, log, cycleCount)
          } else {
            // await this.runCanSequence(targetDevice.canDevice, seqIndex, log, cycleCount)
            throw new Error('eth base not found')
          }
        } catch (e: any) {
          if (this.ac.signal.aborted) {
            null
          } else {
            log.error(e.message, this.lastActiveTs, undefined)
            log.close()
            throw e
          }
        }
      }else if (targetDevice.type == 'lin' && targetDevice.linDevice) {
        
        try {
          if (this.runningLinBase) {
            await this.runLinSequenceWithBase(this.runningLinBase, seqIndex, log, cycleCount)
          } else {
            // await this.runCanSequence(targetDevice.canDevice, seqIndex, log, cycleCount)
            throw new Error('lin base not found')
          }
        } catch (e: any) {
          if (this.ac.signal.aborted) {
            null
          } else {
            log.error(e.message, this.lastActiveTs, undefined)
            log.close()
            throw e
          }
        }
      }
      log.close()
    } else {
      throw new Error('target device not found')
    }
  }
  private async runCanSequenceWithBase(base: CanBase, seqIndex: number, log: UdsLOG, cycleCount: number) {
    const tp = new CAN_TP(base)
    await this.runCanTp({
      createSocket:async (addr:UdsAddress)=>{
        if(addr.canAddr==undefined){
          throw new Error('address not found')
        }
        return new CAN_TP_SOCKET(tp,addr.canAddr)
      },
      close:(base:boolean)=>{
      
          tp.close(base)
        
      }
    }, seqIndex, log, cycleCount).finally(() => {
      tp.close(this.closeBase)
    })
  }
  private async runEthSequenceWithBase(base: DOIP, seqIndex: number, log: UdsLOG, cycleCount: number) {
 
    await this.runCanTp({
      createSocket:async (addr:UdsAddress)=>{
        if(addr.ethAddr==undefined){
          throw new Error('address not found')
        }
        if(this.ac.signal.aborted){
          throw new Error('aborted')
        }
        return await DOIP_SOCKET.create(base,addr.ethAddr,'client')
      },
      close:(base:boolean)=>{
        null
      }
    }, seqIndex, log, cycleCount)
  }
  private async runLinSequenceWithBase(base: LinBase, seqIndex: number, log: UdsLOG, cycleCount: number) {
    const tp = new LIN_TP(base)
    await this.runCanTp({
      createSocket:async (addr:UdsAddress)=>{
        if(addr.linAddr==undefined){
          throw new Error('address not found')
        }
        if(this.ac.signal.aborted){
          throw new Error('aborted')
        }
     
        return new LIN_TP_SOCKET(tp,addr.linAddr,LinMode.MASTER)
      },
      close:(base:boolean)=>{
        tp.close(base)
      }
    }, seqIndex, log, cycleCount)
  }
  // private async runCanSequence(device: CanBaseInfo, seqIndex: number, log: UdsLOG, cycleCount: number) {
  //   if (device.vendor == 'peak') {
  //     const peak = new PEAK_TP(device)
  //     const peakTp = new CAN_TP(peak)
  //     await this.runCanTp(peakTp, seqIndex, log, cycleCount).finally(() => {

  //       peakTp.close(this.closeBase)
  //     })
  //   } else if (device.vendor == 'kvaser') {
  //     const kvaser = new KVASER_CAN(device)
  //     const kvaserTp = new CAN_TP(kvaser)
  //     await this.runCanTp(kvaserTp, seqIndex, log, cycleCount).finally(() => {

  //       kvaserTp.close(this.closeBase)
  //     })
  //   } else if (device.vendor == 'zlg') {
  //     const zlg = new ZLG_CAN(device)
  //     const canTp = new CAN_TP(zlg)
  //     await this.runCanTp(canTp, seqIndex, log, cycleCount).finally(() => {

  //       canTp.close(this.closeBase)
  //     })
  //   } else if (device.vendor == 'simulate') {
  //     const simulate = new SIMULATE_CAN(device)
  //     const canTp = new CAN_TP(simulate)
  //     await this.runCanTp(canTp, seqIndex, log, cycleCount).finally(() => {
  //       canTp.close(this.closeBase)
  //     })
  //   } else {
  //     throw new Error(`vendor(${device.vendor}) not support`)
  //   }
  // }
  private buildObj() {
    const obj: Record<string, any> = {}

    for (const seq of this.tester.seqList) {
      for (const service of seq.services) {
        const targetService = this.services[service.serviceId]
        if (targetService && targetService.serviceId === 'Job') {
          obj[`${seq.name}:${targetService.name}`] = targetService
        }
      }
    }

    obj['ProPath'] = this.project.projectPath
    obj['ProName'] = this.project.projectName
    return obj
  }
  private async runCanTp(canTp: {
    createSocket:(addr:UdsAddress)=>Promise<{
      write:(data:Buffer)=>Promise<number>
      read:(timeout:number)=>Promise<{ts:number,data:Buffer}>
      close:()=>void
    }>
    close:(base:boolean)=>void

  }, seqIndex: number, log: UdsLOG, cycleCount: number) {

    const values = this.buildObj()
    const targetSeq = this.tester.seqList[seqIndex]
    for (let i = 0; i < cycleCount; i++) {
      if (this.ac.signal.aborted) {
        break
      }
      if (i > 0) {
        log.systemMsg(`====== Running cycle #${i}, delay 1000ms ======`, this.lastActiveTs)
        await this.delay(1000)
      }
      for (const [serviceIndex, service] of targetSeq.services.entries()) {
        if (this.ac.signal.aborted) {
          break
        }

        const addrItem = this.tester.address[service.addressIndex]
        if (addrItem == undefined) {
          throw new Error('address not found')
        }
        const targetService = this.services[service.serviceId]
        this.ac.signal.onabort = () => {
          // log.systemMsg('aborted',this.lastActiveTs)
          canTp.close(this.closeBase)
        }
        if (service.enable && addrItem && targetService) {

          const baseRun = async (seqName: string, s: ServiceItem, fromJob = false) => {
            if(this.ac.signal.aborted){
              throw new Error('aborted')
            }
            // await this.pool?.triggerPreSend(s.name)
            const txBuffer = getTxPdu(s)
            if (txBuffer.length == 0) {
              // throw new Error(`serivce ${s.name} tx length is 0`)
              await this.delay(service.delay)
              return true
            }
            const socket = await canTp.createSocket(addrItem)
            this.activeId = s.id
            const sentTs = await socket.write(txBuffer)
            this.lastActiveTs = sentTs

            // log.sent(s, sentTs)
            await this.pool?.triggerSend(s, this.lastActiveTs)


            const hasSub = serviceDetail[s.serviceId].hasSubFunction
            if (hasSub) {
              if (txBuffer.length < 2) {
                throw new Error(`service ${s.name} tx length ${txBuffer.length} is invalid`)
              }
              
              const subFunction = s.params[0].value[0]
              
              if ((subFunction & 0x80) == 0x80) {
                await this.delay(service.delay)
                socket.close()
                return true
              }
            }
            do {
              let rxData = undefined
              let timeout=this.tester.udsTime.pTime
              try {
                const curUs = getTsUs()
                if(this.ac.signal.aborted){
                  throw new Error('aborted')
                }
                rxData = await socket.read(this.tester.udsTime.pTime).catch((e) => {
                  this.lastActiveTs += (getTsUs() - curUs)
                  throw e
                })

                this.lastActiveTs = rxData.ts
                //node handle the response
                const cs=cloneDeep(s)
                // log.recv(s,rxData.ts, rxData.data)
                applyBuffer(cs, rxData.data, false)
                await this.pool?.triggerRecv(cs, this.lastActiveTs)
                
                const rxBuffer = getRxPdu(s)


                if (rxData.data.length == 0) {
                  throw new Error('rxBuffer length is 0')
                }
                if (rxData.data[0] == 0x7f) {
                  if (rxData.data.length >= 3) {
                    if (rxData.data[1] != Number(s.serviceId)) {
                      throw new Error(`negative response with wrong service id, expect ${s.serviceId}, got ${rxData.data[1]}`)
                    }
                    if (rxData.data[2] == 0x78) {
                      timeout=this.tester.udsTime.pExtTime
                      continue
                    }
                    const nrcMsg = NRCMsg[rxData.data[2]]
                    if (nrcMsg) {
                      throw new Error(`negative response: ${nrcMsg}`)
                    } else {
                      throw new Error(`negative response: NRC:${rxData.data[2].toString(16)}`)
                    }
                  } else {
                    throw new Error(`negative response, received length ${rxData.data.length} is invalid`)
                  }
                }
                //compare
                const minLen = Math.min(rxBuffer.length, rxData.data.length)
                const ret = Buffer.compare(rxBuffer.subarray(0,minLen),rxData.data.subarray(0,minLen))  
                
                if (ret != 0) {
                  if (service.checkResp) {
                    throw new Error(
                      `response not match, expect ${rxBuffer.toString(
                        'hex'
                      )}, got ${rxData.data.toString('hex')}`
                    )
                  }
                }
                socket.close()
                break
              } catch (e: any) {

                service.retryNum--
                if (service.retryNum < 0) {
                  if (service.failBehavior == 'stop') {
                    socket.close()
                    throw e
                  } else {
                    log.warning(s, targetSeq, seqIndex, serviceIndex, this.lastActiveTs, rxData?.data, `Failed and continue: ${e.message}`)
                    socket.close()
                    return true
                  }
                } else {
                  log.warning(s, targetSeq, seqIndex, serviceIndex, this.lastActiveTs, rxData?.data, `Failed and retry #${service.retryNum}: ${e.message}`)
                  socket.close()
                  return false
                }

              }

              // eslint-disable-next-line no-constant-condition
            } while (true)

            return true
          }
          log.udsIndex(serviceIndex,targetService.name, 'start')
          if (targetService.serviceId === 'Job') {
            if (this.pool) {
              const params: (string | number)[] = []
              for (const p of targetService.params) {
                if (p.type == 'ASCII' || p.type == 'UNICODE') {
                  let str = p.phyValue as string
                  str = str.replace(/\$\{(\w+)\}/g, (match, p1) => {
                    // p1 是括号中匹配的内容，即'xx'。返回实际值或原始匹配（如果找不到）
                    return get(values, p1) || match
                  })
                  if (typeof str == 'object') {
                    str = JSON.stringify(str)
                  }
                  params.push(str)
                } else {
                  params.push(Number(p.phyValue))
                }
              }

              const services = await this.execJob(targetService.name, params)
              if (services) {
                let percent = 0
                const step = (100 / services.length)
                for (const ser of services) {

                  // eslint-disable-next-line no-constant-condition
                  while (true) {
                    const r = await baseRun(targetSeq.name, ser, true)
                    await this.delay(service.delay)
                    if (r) {
                      break
                    }
                  }
                  percent += step
                  log.udsIndex(serviceIndex,ser.name,'progress', percent)
                }

              }
              log.udsIndex(serviceIndex, targetService.name,'finished')
            } else {
              throw new Error('the pool has been terminated')
            }
          } else {
            // eslint-disable-next-line no-constant-condition
            while (true) {
              
              const r = await baseRun(targetSeq.name, targetService)

              if (r) {
                break
              }
              await this.delay(service.delay)
            }
            log.udsIndex(serviceIndex,targetService.name,'finished')

          }
          await this.delay(service.delay)
        }
      }
    }
  }
}


export function findService(tester: TesterInfo, data: Buffer, isReq: boolean): ServiceItem | undefined {
  let sid = data[0]
  let isNeg=false
  if (!isReq) {
    if(sid==0x7f){
      isNeg=true
      sid = data[1]
    }else{
      sid -= 0x40
    }
  }
  const serviceId = `0x${sid.toString(16)}` as ServiceId
  const service = serviceDetail[serviceId]
  if (service&&isNeg==false) {
    let matchLen = 0
    if(isReq){
      for (const p of service.defaultParams) {
        if(p.param.deletable==false){
          matchLen += p.param.bitLen
        }
      }
    }else{
      for (const p of service.defaultRespParams) {
        if(p.param.deletable==false){
          matchLen += p.param.bitLen
        }
      }
    }
    matchLen = Math.ceil(matchLen / 8)
    if (matchLen == 0 && tester.allServiceList[serviceId] && tester.allServiceList[serviceId][0]) {
      return tester.allServiceList[serviceId][0]
    }

    if (matchLen > 0 && tester.allServiceList[serviceId]) {
      for (const item of tester.allServiceList[serviceId]) {
        const b = isReq ? getTxPdu(item) : getRxPdu(item)



        if (Buffer.compare(data.subarray(0, matchLen + 1), b.subarray(0, matchLen + 1)) == 0) {
          return item
        }
      }
    }
  }
  if (SupportServiceId.includes(serviceId)) {

    if (isReq) {
      return {
        id: v4(),
        name: serviceId,
        serviceId: serviceId,
        params: [{
          id: v4(),
          name: 'param0',
          type: 'ARRAY',
          value: data,
          phyValue: data,
          bitLen: data.length * 8
        }],
        respParams: []
      }
    } else {
      return {
        id: v4(),
        name: serviceId,
        serviceId: serviceId,
        params: [],
        respParams: [{
          id: v4(),
          name: 'param0',
          type: 'ARRAY',
          value: data,
          phyValue: data,
          bitLen: data.length * 8
        }]
      }

    }
  }
  return undefined

}

const preDefineTypes: Record<string, string> = {
  'node_modules/@types/node/zlib.d.ts': zlibStr,
  'node_modules/@types/node/assert.d.ts': assertStr,
  'node_modules/@types/node/async_hooks.d.ts': async_hooksStr,
  'node_modules/@types/node/buffer.d.ts': bufferStr,
  'node_modules/@types/node/child_process.d.ts': child_processStr,
  'node_modules/@types/node/cluster.d.ts': clusterStr,
  'node_modules/@types/node/console.d.ts': consoleStr,
  'node_modules/@types/node/constants.d.ts': constantsStr,
  'node_modules/@types/node/crypto.d.ts': cryptoStr,
  'node_modules/@types/node/dgram.d.ts': dgramStr,
  'node_modules/@types/node/diagnostics_channel.d.ts': diagnostics_channelStr,
  'node_modules/@types/node/dns.d.ts': dnsStr,
  'node_modules/@types/node/domain.d.ts': domainStr,
  'node_modules/@types/node/dom-events.d.ts': domEventsStr,
  'node_modules/@types/node/events.d.ts': eventsStr,
  'node_modules/@types/node/fs.d.ts': fsStr,
  'node_modules/@types/node/globals.d.ts': globalsStr,
  'node_modules/@types/node/globals.global.d.ts': globals_globalStr,
  'node_modules/@types/node/http.d.ts': httpStr,
  'node_modules/@types/node/http2.d.ts': http2Str,
  'node_modules/@types/node/https.d.ts': httpsStr,
  'node_modules/@types/node/index.d.ts': indexStr,
  'node_modules/@types/node/inspector.d.ts': inspectorStr,
  'node_modules/@types/node/module.d.ts': moduleStr,
  'node_modules/@types/node/net.d.ts': netStr,
  'node_modules/@types/node/os.d.ts': osStr,
  'node_modules/@types/node/path.d.ts': pathStr,
  'node_modules/@types/node/perf_hooks.d.ts': perf_hooksStr,
  'node_modules/@types/node/process.d.ts': processStr,
  'node_modules/@types/node/punycode.d.ts': punycodeStr,
  'node_modules/@types/node/querystring.d.ts': querystringStr,
  'node_modules/@types/node/readline.d.ts': readlineStr,
  'node_modules/@types/node/repl.d.ts': replStr,
  'node_modules/@types/node/stream.d.ts': streamStr,
  'node_modules/@types/node/string_decoder.d.ts': string_decoderStr,
  'node_modules/@types/node/test.d.ts': testStr,
  'node_modules/@types/node/timers.d.ts': timersStr,
  'node_modules/@types/node/tls.d.ts': tlsStr,
  'node_modules/@types/node/trace_events.d.ts': trace_eventsStr,
  'node_modules/@types/node/tty.d.ts': ttyStr,
  'node_modules/@types/node/url.d.ts': urlStr,
  'node_modules/@types/node/util.d.ts': utilStr,
  'node_modules/@types/node/v8.d.ts': v8Str,
  'node_modules/@types/node/vm.d.ts': vmStr,
  'node_modules/@types/node/wasi.d.ts': wasiStr,
  'node_modules/@types/node/worker_threads.d.ts': worker_threadsStr,
  'node_modules/@types/node/fs/promises.d.ts': fsPromiseStr,
  'node_modules/@types/node/assert/strict.d.ts': assertSubStr,
  'node_modules/@types/node/dns/promises.d.ts': dnsSubStr,
  'node_modules/@types/node/readline/promises.d.ts': readLimeStr,
  'node_modules/@types/node/stream/consumers.d.ts': streamSubStr1,
  'node_modules/@types/node/stream/promises.d.ts': streamSubStr2,
  'node_modules/@types/node/stream/web.d.ts': streamSubStr3,
  'node_modules/@types/node/timers/promises.d.ts': timerSubStr,
}

// export function getAllTypes(tester: TesterInfo, vendor = 'YT') {
//   const allTypes: Record<string, string> = {}
//   for (const [p, c] of Object.entries(preDefineTypes)) {
//     allTypes[p] = c
//   }
//   allTypes['node_modules/@types/' + vendor + '/index.d.ts'] = `
//     export as namespace ${vendor};
// import { UDSClass} from './uds'
// declare global {
//     var UDS: UDSClass
// }
// export * from './uds'
// export * from './crc'
// export * from './cryptoExt'
//     `
//   allTypes['node_modules/@types/' + vendor + '/uds.d.ts'] = updateUdsDts(tester)
//   allTypes['node_modules/@types/' + vendor + '/crc.d.ts'] = crcStr
//   allTypes['node_modules/@types/' + vendor + '/cryptoExt.d.ts'] = cryptoExtStr

//   return allTypes
// }


export async function getBuildStatus(projectPath: string, projectName: string, script: string) {
  if (path.isAbsolute(script) === false) {
    script = path.join(projectPath, script)
  }
  const outputDir = path.join(projectPath, '.ScriptBuild')
  const outFile = path.join(outputDir, path.basename(script, '.ts') + '.js')
  if (fs.existsSync(outFile) === false) {
    //never build
    return 'info'
  }
  const scriptStat = await fsP.stat(script)
  const outStat = await fsP.stat(outFile)
  if (scriptStat.mtime.toString() != outStat.mtime.toString()) {
    //need rebuild
    return 'warning'
  }
  //compare time 
  //no need rebuild
  return 'success'
}

export async function deleteNode(projectPath: string, projectName: string, node: CanNode) {
  //delete script file from tsconfig.json files
  const tsconfigFile = path.join(projectPath, 'tsconfig.json')
  if (fs.existsSync(tsconfigFile)) {
    const contnet = await fsP.readFile(tsconfigFile, 'utf-8')
    const tsconfig = json5.parse(contnet)
    tsconfig.files = tsconfig.files || []
    if (node.script) {
      if (path.isAbsolute(node.script) === false) {
        const index = (tsconfig.files as string[]).indexOf(node.script)
        if (index != -1) {
          (tsconfig.files as string[]).splice(index, 1)
        }
      } else {
        const relativePath = path.relative(projectPath, node.script);
        const index = (tsconfig.files as string[]).indexOf(relativePath)
        if (index != -1) {
          (tsconfig.files as string[]).splice(index, 1)
        }
      }
    }
    await fsP.writeFile(tsconfigFile, JSON.stringify(tsconfig, null, 4))
  }
}
export async function deleteTester(projectPath: string, projectName: string, node: TesterInfo) {
  //delete script file from tsconfig.json files
  const tsconfigFile = path.join(projectPath, 'tsconfig.json')
  if (fs.existsSync(tsconfigFile)) {
    const contnet = await fsP.readFile(tsconfigFile, 'utf-8')
    const tsconfig = json5.parse(contnet)
    tsconfig.files = tsconfig.files || []
    if (node.script) {
      if (path.isAbsolute(node.script) === false) {
        const index = (tsconfig.files as string[]).indexOf(node.script)
        if (index != -1) {
          (tsconfig.files as string[]).splice(index, 1)
        }
      } else {
        const relativePath = path.relative(projectPath, node.script);
        const index = (tsconfig.files as string[]).indexOf(relativePath)
        if (index != -1) {
          (tsconfig.files as string[]).splice(index, 1)
        }
      }
    }
    await fsP.writeFile(tsconfigFile, JSON.stringify(tsconfig, null, 4))
  }
}
export async function createProject(projectPath: string, projectName: string, data:DataSet,vendor = 'YT') {
  //create node_modules
  const nodeModulesPath = path.join(projectPath, 'node_modules')
  if (!fs.existsSync(nodeModulesPath)) {
    await fsP.mkdir(nodeModulesPath)
  }
  //create types
  const typesPath = path.join(nodeModulesPath, '@types')
  if (!fs.existsSync(typesPath)) {
    await fsP.mkdir(typesPath)
  }
  //create node
  const nodePath = path.join(typesPath, 'node')
  if (!fs.existsSync(nodePath)) {
    await fsP.mkdir(nodePath)
    //fs
    const fsPath = path.join(nodePath, 'fs')
    if (!fs.existsSync(fsPath)) {
      await fsP.mkdir(fsPath)
    }
    //assert
    const assertPath = path.join(nodePath, 'assert')
    if (!fs.existsSync(assertPath)) {
      await fsP.mkdir(assertPath)
    }
    //dns
    const dnsPath = path.join(nodePath, 'dns')
    if (!fs.existsSync(dnsPath)) {
      await fsP.mkdir(dnsPath)
    }
    //readline
    const readlinePath = path.join(nodePath, 'readline')
    if (!fs.existsSync(readlinePath)) {
      await fsP.mkdir(readlinePath)
    }
    //stream
    const streamPath = path.join(nodePath, 'stream')
    if (!fs.existsSync(streamPath)) {
      await fsP.mkdir(streamPath)
    }
    //timers
    const timersPath = path.join(nodePath, 'timers')
    if (!fs.existsSync(timersPath)) {
      await fsP.mkdir(timersPath)
    }
    //preDefineTypes
    for (const [p, c] of Object.entries(preDefineTypes)) {
      await fsP.writeFile(path.join(projectPath, p), c, 'utf-8',)
    }
  }
  //create vendor
  const vendorPath = path.join(typesPath, vendor)
  if (!fs.existsSync(vendorPath)) {
    await fsP.mkdir(vendorPath)
  }
  // await fsP.mkdir(vendorPath)
  await fsP.writeFile(path.join(vendorPath, 'index.d.ts'), `
    export as namespace ${vendor};
import { UtilClass} from './uds'
declare global {
    var Util: UtilClass
}
export * from './uds'
export * from './crc'
export * from './cryptoExt'
    `)
  await fsP.writeFile(path.join(vendorPath, 'uds.d.ts'), updateUdsDts(data))
  await fsP.writeFile(path.join(vendorPath, 'crc.d.ts'), crcStr)
  await fsP.writeFile(path.join(vendorPath, 'cryptoExt.d.ts'), cryptoExtStr)
  //create tsconfig.json
  const tsconfigFile = path.join(projectPath, 'tsconfig.json')
  if (!fs.existsSync(tsconfigFile)) {
    (tsconfig as any).files = []
    for (const tester of Object.values(data.tester)) {
      if (tester.script) {
        if (path.isAbsolute(tester.script) === false) {
          ((tsconfig as any).files as string[]).push(tester.script)
        } else {
          const relativePath = path.relative(projectPath, tester.script);
          ((tsconfig as any).files as string[]).push(relativePath)
        }

      }
    }
    for (const node of Object.values(data.nodes)) {
      if (node.script) {
        if (path.isAbsolute(node.script) === false) {
          ((tsconfig as any).files as string[]).push(node.script)
        } else {
          const relativePath = path.relative(projectPath, node.script);
          ((tsconfig as any).files as string[]).push(relativePath)
        }
      }
    }
    await fsP.writeFile(tsconfigFile, JSON.stringify(tsconfig, null, 4))
  } else {

    const contnet = await fsP.readFile(tsconfigFile, 'utf-8')
    const tsconfig = json5.parse(contnet)
    tsconfig.files = tsconfig.files || []
    for (const tester of Object.values(data.tester)) {
      if (tester.script) {

        if (path.isAbsolute(tester.script) === false) {
          if ((tsconfig.files as string[]).indexOf(tester.script) == -1) {

            (tsconfig.files as string[]).push(tester.script)
          }
        } else {
          const relativePath = path.relative(projectPath, tester.script);
          if ((tsconfig.files as string[]).indexOf(relativePath) == -1) {
            (tsconfig.files as string[]).push(relativePath)
          }

        }
      }
    }
    for (const node of Object.values(data.nodes)) {
      if (node.script) {
        if (path.isAbsolute(node.script) === false) {
          if ((tsconfig.files as string[]).indexOf(node.script) == -1) {

            (tsconfig.files as string[]).push(node.script)
          }
        } else {
          const relativePath = path.relative(projectPath, node.script);
          if ((tsconfig.files as string[]).indexOf(relativePath) == -1) {
            (tsconfig.files as string[]).push(relativePath)
          }

        }
      }
    }
    await fsP.writeFile(tsconfigFile, JSON.stringify(tsconfig, null, 4))
  }
  //code-workspace
  if (!fs.existsSync(path.join(projectPath, projectName + '.code-workspace'))) {
    await fsP.writeFile(path.join(projectPath, projectName + '.code-workspace'), JSON.stringify({
      folders: [
        {
          path: '.'
        }
      ],
      "extensions": {
        "recommendations": [
          "ms-vscode.vscode-typescript-next"
        ]
      }
    }, null, 4))
  }


}

export async function refreshProject(projectPath: string, projectName: string, data: DataSet, vendor = 'YT') {
  //create node_modules
  const nodeModulesPath = path.join(projectPath, 'node_modules')
  if (!fs.existsSync(nodeModulesPath)) {
    await fsP.mkdir(nodeModulesPath)
  }
  //create types
  const typesPath = path.join(nodeModulesPath, '@types')
  if (!fs.existsSync(typesPath)) {
    await fsP.mkdir(typesPath)
  }

  //create vendor
  const vendorPath = path.join(typesPath, vendor)
  if (!fs.existsSync(vendorPath)) {
    await fsP.mkdir(vendorPath)
  }
  await fsP.writeFile(path.join(vendorPath, 'uds.d.ts'), updateUdsDts(data))
}

export async function compileTsc(projectPath: string, projectName: string, data: DataSet, entry: string, esbuildPath: string, libPath: string, vendor = 'YT') {

  await createProject(projectPath, projectName,data)
  if (entry) {
    let script = entry
    if (path.isAbsolute(script) === false) {
      script = path.join(projectPath, script)
    }
    if (fs.existsSync(script) === false) {
      return [{
        code: -1, message: 'script file not exist', file: entry, start: 0, line: 0
      }]
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tt=require('ts-morph')
    const project = new tt.Project({
      tsConfigFilePath: path.join(projectPath, 'tsconfig.json'),
    });
    // await project.emit()
    //get errors
    const diagnostics = project.getPreEmitDiagnostics()
    const errors = []
    for (const item of diagnostics) {

      let relativePath = ''
      const file = item.getSourceFile()?.getFilePath()
      if (file) {
        relativePath = path.relative(projectPath, file)
      }
      const msg = item.getMessageText()
      let msgStr = ''
      if (typeof msg === 'string') {
        msgStr = msg
      } else {
        msgStr = msg.getMessageText()
      }


      errors.push(
        {
          code: item.getCode(),
          message: msgStr,
          file: relativePath,
          start: item.getStart(),
          line: item.getLineNumber()
        }
      )

    }
    if (errors.length > 0) {
      return errors
    }

    //esbuild transform

    const outputDir = path.join(projectPath, '.ScriptBuild')


    try {

      await compileTscEntry(script, outputDir, esbuildPath, libPath, vendor)
    } catch (e: any) {
      return [{ code: -1, message: e.message, file: entry, start: 0, line: 0 }]
    }
  }
  return []

}


async function compileTscEntry(
  entry: string,
  outputDir: string,
  esbuildPath: string,
  libPath: string,
  vendor = 'YT'
) {
  //delete last build 
  const latBuildFile = path.join(outputDir, path.basename(entry).replace('.ts', '.js'))
  await fsP.rm(latBuildFile, { force: true, recursive: true })
  const v = await exec(
    esbuildPath,
    [
      entry,
      '--sourcemap',
      '--bundle',
      '--platform=node',
      '--format=cjs',
      `--alias:${vendor}=${libPath}`,
      `--alias:@serialport/bindings-cpp=${libPath}/bindings-cpp`,
      `--outdir=${outputDir}`,
      `--inject:${path.join(libPath, 'uds.js')}`,
    ],
  )
  if (v.stderr) {
    if (!v.stderr.includes('Done')) {
      throw new Error(v.stderr)
    }
  }
  if (fs.existsSync(latBuildFile) === false) {
    throw new Error('build failed, file not exist')
  }
  //copy *.node to outputDir
  //glob libPath/*.node
  const nodeFiles = await glob( '*.node',{
    cwd: libPath
  })
  for (const nodeFile of nodeFiles) {
    const src = path.join(libPath, nodeFile)
    const dest = path.join(outputDir, nodeFile)
    if(!fs.existsSync(dest)){
      await fsP.copyFile(src, dest)
    }
  }



  //modify the output file time equal to the input file
  const stats = await fsP.stat(entry)
  await fsP.utimes(latBuildFile, stats.atime, stats.mtime)
  return
}
async function generateFileTree(projectPath: string, dirPath: string): Promise<{ content: string, path: string }[]> {
  const stats = await fsP.stat(dirPath);
  if (!stats.isDirectory()) {
    return []
  }

  const list: { content: string, path: string }[] = [];
  const entries = await fsP.readdir(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const entryStats = await fsP.stat(fullPath);

    if (entryStats.isDirectory()) {
      //exclude node_modules

      const v = await generateFileTree(projectPath, fullPath)
      list.push(...v)

    } else if (entryStats.isFile() && entry.endsWith('.d.ts')) {
      //path start from node_modules
      const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');
      list.push({ content: await fsP.readFile(fullPath, 'utf-8'), path: relativePath });
    }

  }

  return list;
}


export async function compilePackage(projectPath: string) {
  const packagePath = path.join(projectPath, 'package.json')
  const nodeModulesPath = path.join(projectPath, 'node_modules')
  const list: { content: string, path: string }[] = []
  if (fs.existsSync(packagePath) && fs.existsSync(nodeModulesPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    const dependencies = packageJson.dependencies
    const devDependencies = packageJson.devDependencies
    if (dependencies) {
      for (const key of Object.keys(dependencies)) {
        const nodeModulePath = path.join(nodeModulesPath, key)
        const v = await generateFileTree(projectPath, nodeModulePath)
        list.push(...v)
      }
    }
    if (devDependencies) {
      for (const key of Object.keys(devDependencies)) {
        const nodeModulePath = path.join(nodeModulesPath, key)
        const v = await generateFileTree(projectPath, nodeModulePath)
        list.push(...v)
      }
    }
    const typesPath = path.join(nodeModulesPath, '@types')
    if (fs.existsSync(typesPath)) {
      const v = await generateFileTree(projectPath, typesPath)
      list.push(...v)
    }
  }

  return list
}

