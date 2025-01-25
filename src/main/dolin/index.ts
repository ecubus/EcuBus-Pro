import { applyBuffer, getRxPdu, getTxPdu, ServiceItem, UdsDevice } from "../share/uds";
import { PeakLin } from "./peak";
import dllLib from '../../../resources/lib/zlgcan.dll?asset&asarUnpack'
import path from "path";
import { getFrameData, getPID, LinBaseInfo, LinChecksumType, LinDevice, LinDirection, LinMode, LinMsg, LinNode } from "../share/lin";
import { Frame, LDF } from "src/renderer/src/database/ldfParse";
import EventEmitter from "events";
import { cloneDeep, isEqual } from "lodash";
import LinBase from "./base";
import { TesterInfo } from "../share/tester";
import { UdsLOG } from "../log";
import UdsTester from "../workerClient";
import fs from 'fs'
import { LIN_TP, TpError } from "./lintp";
import { findService } from "../docan/uds";


const libPath = path.dirname(dllLib)
PeakLin.loadDllPath(libPath)




export function openLinDevice(device: LinBaseInfo) {
    let linBase: LinBase | undefined



    // #v-ifdef IGNORE_NODE!='1'
    if (device.vendor == 'peak') {
        linBase = new PeakLin(device)
    }

    return linBase
}


export function getLinVersion(vendor: string) {
    // #v-ifdef IGNORE_NODE!='1'
    vendor = vendor.toUpperCase()
    if (vendor === 'PEAK') {
        return PeakLin.getLibVersion()
    }
    else
    // #v-endif
    {
        return 'unknown'
    }

}

export function getLinDevices(vendor: string) {
    vendor = vendor.toUpperCase()
    // #v-ifdef IGNORE_NODE!='1'
    if (vendor === 'PEAK') {
        return PeakLin.getValidDevices()
    }
    else
    // #v-endif
    {
        return []
    }
}


export class NodeLinItem {
    private pool?: UdsTester
    tester?: TesterInfo
    private lintp: LIN_TP[] = []
    log?: UdsLOG
    db?: LDF
    constructor(
        public nodeItem: LinNode,
        private linBaseMap: Map<string, LinBase>,
        private projectPath: string,
        private projectName: string,
        testers: Record<string, TesterInfo>
    ) {

        const device = linBaseMap.get(nodeItem.channel[0])
        if (device) {
            if (nodeItem.workNode) {
                this.db = device.setupEntry(nodeItem.workNode)
                if (this.db) {
                    device.registerNode(this.db, nodeItem.workNode)
                }
            }
        }

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
                    const baseItem = this.linBaseMap.get(c)
                    if (baseItem) {
                        baseItem.attachLinMessage(this.cb.bind(this))
                    }
                }
                //lintp
                if (this.tester && this.tester.address.length > 0) {
                    for (const c of nodeItem.channel) {
                        const baseItem = this.linBaseMap.get(c)
                        if (baseItem) {
                            const tp = new LIN_TP(baseItem)
                            for (const addr of this.tester.address) {
                                if (addr.type == 'lin' && addr.linAddr) {
                                    const idT = tp.getReadId(LinMode.MASTER, addr.linAddr)
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

                                                            this.log?.scriptMsg(e.toString(), data.ts, 'error');
                                                        })
                                                    } catch (e: any) {

                                                        this.log?.scriptMsg(e.toString(), data.ts, 'error');
                                                    }
                                                }

                                            }
                                        }
                                    })
                                    const idR = tp.getReadId(LinMode.SLAVE, addr.linAddr)
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

                                                            this.log?.scriptMsg(e.toString(), data.ts, 'error');
                                                        })
                                                    } catch (e: any) {

                                                        this.log?.scriptMsg(e.toString(), data.ts, 'error');
                                                    }
                                                }
                                            }
                                        }
                                    })
                                }
                            }
                            this.lintp.push(tp)
                        }
                    }
                }
            }
        }
        //     const db = global.database.lin[nodeItem.database]
        //     if (db) {

        //         this.db = db
        //         // db.event.on('signal', this.cb)
        //     }
        // }
    }
    close() {
        for (const c of this.nodeItem.channel) {
            const baseItem = this.linBaseMap.get(c)
            if (baseItem) {
                baseItem.detachLinMessage(this.cb.bind(this))
            }
        }
        this.pool?.stop()
        this.lintp.forEach(tp => {
            tp.close(false)
        })

    }
    async start() {


        this.pool?.updateTs(0)
        await this.pool?.start(this.projectPath)

    }
    cb(frame: LinMsg) {
        if (frame.uuid != this.nodeItem.id) {
            this.pool?.triggerLinFrame(frame)
        }

    }
    async sendFrame(pool: UdsTester, frame: LinMsg): Promise<number> {
        frame.uuid = this.nodeItem.id
        frame.data = Buffer.from(frame.data)
        if (this.nodeItem.channel.length == 1) {
            const baseItem = this.linBaseMap.get(this.nodeItem.channel[0])
            if (baseItem) {
                baseItem.setEntry(frame.frameId, frame.data.length, frame.direction, frame.checksumType, frame.data, frame.isEvent ? 2 : 1)
                return await baseItem.write(frame)
            }
        }
        for (const c of this.nodeItem.channel) {
            const baseItem = this.linBaseMap.get(c)
            if (baseItem && baseItem.info.name == frame.device) {
                return await baseItem.write(frame)
            }
        }
        throw new Error(`device ${frame.device} not found`)

    }
    setSignal(pool: UdsTester, data: {
        signal: string,
        value: number|number[]|string
    }) {

        const s=data.signal.split('.')
        // 验证数据库是否存在
        if (!this.db||s[0]!=this.db.name) {
            throw new Error(`LIN database ${s[0]} not found`)
        }
        
        const signalName=s[1]
        
        const signal = this.db.signals[signalName]
        if (!signal) {
            throw new Error(`Signal ${signalName} not found`)
        }
        // 更新信号值
        updateSignalVal(this.db, signalName, data.value)
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

                if ((this.tester.address.length == 1 || data.address == undefined) && (this.tester.address[0].linAddr)) {
                    const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
                    const raddr = this.tester.address[0].linAddr

                    const ts = await this.lintp[0].writeTp(mode, raddr, buf, this.nodeItem.id)

                    return ts
                } else {
                    //find address
                    const addr = this.tester.address.find((a) => a.linAddr?.name == data.address)
                    if (addr && addr.linAddr) {
                        const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
                        const raddr = addr.linAddr

                        const ts = await this.lintp[0].writeTp(mode, raddr, buf, this.nodeItem.id)

                        return ts
                    }
                }
            } else {
                //find device
                let index = -1
                for (let i = 0; i < this.nodeItem.channel.length; i++) {
                    if (this.linBaseMap.get(this.nodeItem.channel[i])?.info.name == data.device) {
                        index = i
                        break
                    }
                }
                if (index >= 0) {

                    if ((this.tester.address.length == 1 || data.address == undefined) && this.tester.address[0].linAddr) {
                        const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
                        const raddr = this.tester.address[0].linAddr


                        const ts = await this.lintp[index].writeTp(mode, raddr, buf, this.nodeItem.id)

                        return ts
                    } else {
                        //find address
                        const addr = this.tester.address.find((a) => a.linAddr?.name == data.address)
                        if (addr && addr.linAddr) {
                            const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
                            const raddr = addr.linAddr

                            const ts = await this.lintp[index].writeTp(mode, raddr, buf, this.nodeItem.id)

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
}


export function updateSignalVal(db: LDF, signalName: string, value: number | number[] | string) {
    const signal = db.signals[signalName]
    if (signal) {
        //compare value
        const lastValue = signal.value != undefined ? signal.value : signal.initValue
        if (!isEqual(lastValue, value)) {
            signal.update = true
        }
        if(typeof value==='string'){
            //find in encode
            //TODO:
        }else{
            signal.value = value
        }
        
    }
}
