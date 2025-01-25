import path from "path";
import fs from 'fs';
import { CanAddr, CanBase, CanMessage, CanNode, swapAddr } from "../share/can";
import { TesterInfo } from "../share/tester";
import UdsTester from "../workerClient";
import { CAN_TP, TpError } from "./cantp";
import { UdsLOG } from "../log";
import { applyBuffer, getRxPdu, getTxPdu, ServiceItem } from "../share/uds";
import { findService } from "./uds";
import { cloneDeep } from "lodash";
import type { Signal } from "src/renderer/src/database/dbc/dbcVisitor";
import { updateSignalPhys, updateSignalRaw } from "src/renderer/src/database/dbc/calc";




export class NodeItem {
  private pool?: UdsTester
  private cantp: CAN_TP[] = []
  tester?: TesterInfo
  log?:UdsLOG
  constructor(
    public nodeItem: CanNode,
    private canBaseMap: Map<string, CanBase>,
    private projectPath: string,
    private projectName: string,
    testers: Record<string, TesterInfo>

  ) {

    if (nodeItem.script) {
      const outDir = path.join(this.projectPath, '.ScriptBuild')
      const scriptNameNoExt = path.basename(nodeItem.script, '.ts')
      const jsPath = path.join(outDir, scriptNameNoExt + '.js')
      if (fs.existsSync(jsPath)) {
        this.tester = cloneDeep(nodeItem.attachTester ? testers[nodeItem.attachTester] : undefined)
        this.log = new UdsLOG(`${nodeItem.name} ${path.basename(nodeItem.script)}`, this.tester?.id)
        this.pool = new UdsTester({
          PROJECT_ROOT: this.projectPath,
          PROJECT_NAME: this.projectName,
          MODE: 'node',
          NAME: nodeItem.name,
        }, jsPath, this.log, this.tester)
        this.pool.registerHandler('output', this.sendFrame.bind(this))
        this.pool.registerHandler('sendDiag', this.sendDiag.bind(this))
        this.pool.registerHandler('setSignal', this.setSignal.bind(this))
        //find tester
        for (const c of nodeItem.channel) {
          const baseItem = this.canBaseMap.get(c)
          if (baseItem) {
            baseItem.attachCanMessage(this.cb.bind(this))
          }
        }
        //cantp
        if (this.tester && this.tester.address.length > 0) {
          for (const c of nodeItem.channel) {
            const baseItem = this.canBaseMap.get(c)
            if (baseItem) {
              const tp = new CAN_TP(baseItem)
              for (const addr of this.tester.address) {
                if (addr.type == 'can' && addr.canAddr) {
                  const idT = tp.getReadId(addr.canAddr)
                  tp.event.on(idT, (data) => {
                    if (data instanceof TpError) {
                      //TODO:
                    } else {

                      if (data.addr.uuid != this.nodeItem.id && this.tester) {
                        const item = findService(this.tester, data.data, true)
                        if (item) {
                          try {
                            applyBuffer(item, data.data, true)
                            this.pool?.triggerSend(item, data.ts).catch(e => {
                            
                              this.log?.scriptMsg(e.toString(), data.ts,'error');
                            })
                          } catch (e:any) {
                            
                            this.log?.scriptMsg(e.toString(), data.ts,'error');
                          }
                        }

                      }
                    }
                  })
                  const idR = tp.getReadId(swapAddr(addr.canAddr))
                  tp.event.on(idR, (data) => {
                    if (data instanceof TpError) {
                      //TODO:
                    } else {

                      if (data.addr.uuid != this.nodeItem.id && this.tester) {
                        const item = findService(this.tester, data.data, false)
                        if (item) {
                          try {
                            applyBuffer(item, data.data, false)
                            this.pool?.triggerRecv(item, data.ts).catch(e => {
                            
                              this.log?.scriptMsg(e.toString(), data.ts,'error');
                            })
                          } catch (e:any) {
                         
                            this.log?.scriptMsg(e.toString(), data.ts,'error');
                          }
                        }
                      }
                    }
                  })
                }
              }
              this.cantp.push(tp)
            }
          }
        }
      }
    }

  }
  setSignal(pool: UdsTester, data: {
    signal: string,
    value: number|string|number[]
}) {

    if(Array.isArray(data.value)){
      throw new Error('can not set array value')
    }
    const s=data.signal.split('.')
    // 验证数据库是否存在
    const db=Object.values(global.database.can).find(db=>db.name==s[0])
    if(!db){
      throw new Error(`CAN database ${s[0]} not found`)
    }
    const signalName=s[1]
    
    let ss:Signal|undefined
    for(const msg of Object.values(db.messages)){
      for(const signal of Object.values(msg.signals)){
        if(signal.name==signalName){
          ss=signal
          break
        }
      }
      if(ss){
        break
      }
    }
    if (!ss) {
        throw new Error(`Signal ${signalName} not found`)
    }
    ss.physValue=data.value
    if(typeof data.value==='string'&&(ss.values||ss.valueTable)){
      const value:{
        label: string;
        value: number;
    }[]=ss.values?ss.values:db.valueTables[ss.valueTable!].values
      if(value){
        const v=value.find(v=>v.label===data.value)
        if(v){
          ss.physValue=v.value
        }
      }
    }
    updateSignalPhys(ss)
    
}
  async sendFrame(pool: UdsTester, frame: CanMessage): Promise<number> {
    frame.msgType.uuid = this.nodeItem.id
    if (this.nodeItem.channel.length == 1) {
      const baseItem = this.canBaseMap.get(this.nodeItem.channel[0])
      if (baseItem) {
        return await baseItem.writeBase(frame.id, frame.msgType, frame.data)
      }
    }
    for (const c of this.nodeItem.channel) {
      const baseItem = this.canBaseMap.get(c)
      if (baseItem && baseItem.info.name == frame.device) {
        return await baseItem.writeBase(frame.id, frame.msgType, frame.data)
      }
    }
    throw new Error(`device ${frame.device} not found`)

  }
  async sendDiag(pool: UdsTester, data: {
    device?: string
    address?: string
    service: ServiceItem
    isReq: boolean
  }): Promise<number> {
    if (this.tester) {
      if (this.tester.address.length == 0) {
        throw new Error(`address not found in ${this.tester.name}`)
      }
      let buf


      if (data.isReq) {
        buf = getTxPdu(data.service)
      } else {
        buf = getRxPdu(data.service)
      }
      if (this.nodeItem.channel.length == 0) {
        throw new Error(`channel not found`)
      } else if (this.nodeItem.channel.length == 1 || data.device == undefined) {

        if ((this.tester.address.length == 1 || data.address == undefined) && (this.tester.address[0].canAddr)) {
          const raddr = data.isReq ? this.tester.address[0].canAddr : swapAddr(this.tester.address[0].canAddr)
          raddr.uuid = this.nodeItem.id
          const ts = await this.cantp[0].writeTp(raddr, buf)
          
          return ts
        } else {
          //find address
          const addr = this.tester.address.find((a) => a.canAddr?.name == data.address)
          if (addr && addr.canAddr) {
            const raddr = data.isReq ? addr.canAddr : swapAddr(addr.canAddr)
            raddr.uuid = this.nodeItem.id
            const ts = await this.cantp[0].writeTp(raddr, buf)
           
            return ts
          }
        }
      } else {
        //find device
        let index = -1
        for (let i = 0; i < this.nodeItem.channel.length; i++) {
          if (this.canBaseMap.get(this.nodeItem.channel[i])?.info.name == data.device) {
            index = i
            break
          }
        }
        if (index >= 0) {

          if ((this.tester.address.length == 1 || data.address == undefined) && this.tester.address[0].canAddr) {
            const raddr = data.isReq ? this.tester.address[0].canAddr : swapAddr(this.tester.address[0].canAddr)
            raddr.uuid = this.nodeItem.id

            const ts = await this.cantp[index].writeTp(raddr, buf)
           
            return ts
          } else {
            //find address
            const addr = this.tester.address.find((a) => a.canAddr?.name == data.address)
            if (addr && addr.canAddr) {
              const raddr = data.isReq ? addr.canAddr : swapAddr(addr.canAddr)
              raddr.uuid = this.nodeItem.id
              const ts = await this.cantp[index].writeTp(raddr, buf)
              // if (data.isReq) {
              //   await this.pool?.triggerSend(data.service, ts)
              // } else {
              //   await this.pool?.triggerRecv(data.service, ts)
              // }
              return ts
            }
          }
        }

      }


    } else {
      throw new Error(`Does't found attached tester`)
    }
    return 0;
  }
  close() {
    for (const c of this.nodeItem.channel) {
      const baseItem = this.canBaseMap.get(c)
      if (baseItem) {
        baseItem.detachCanMessage(this.cb.bind(this))
      }
    }
    this.pool?.stop()
    this.cantp.forEach(tp => {
      tp.close(false)
    })

  }
  async start() {


    this.pool?.updateTs(0)
    await this.pool?.start(this.projectPath)

  }
  cb(frame: CanMessage) {
    if (frame.msgType.uuid != this.nodeItem.id) {
      this.pool?.triggerCanFrame(frame)
    }

  }
}