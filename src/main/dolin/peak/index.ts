import { getPID, LIN_ERROR_ID, LIN_SCH_TYPE, LinBaseInfo, LinChecksumType, LinDevice, LinDirection, LinError, LinMode, LinMsg } from '../../share/lin'
import LIN from '../build/Release/peakLin.node'
import { v4 } from 'uuid'
import { queue, QueueObject } from 'async'
import { LinLOG } from 'src/main/log'
import EventEmitter from 'events'
import LinBase, { LinWriteOpt, QueueItem } from '../base'
import { getTsUs } from 'src/main/share/can'
import { LDF } from 'src/renderer/src/database/ldfParse'



function err2Str(result: number): string {
    const buffer = Buffer.alloc(256)
    LIN.LIN_GetErrorText(result, 9, buffer)
    return buffer.toString()
}

function buf2str(buf: Buffer) {
    const nullCharIndex = buf.indexOf(0) // 0 是 '\0' 的 ASCII 码
    if (nullCharIndex === -1) {
        return buf.toString('utf8')
    }
    return buf.toString('utf8', 0, nullCharIndex)
}


export class PeakLin extends LinBase {
    queue = queue((task: QueueItem, cb) => {
        if (task.discard) {
            cb()
        } else {
            this._write(task.data).then(task.resolve).catch(task.reject).finally(cb)
        }
    }, 1)
    private client: number
    private lastFrame: Map<number, LinMsg> = new Map()
    event = new EventEmitter()
    pendingPromise?: {
        resolve: (msg: LinMsg) => void
        reject: (error: LinError) => void
        sendMsg: LinMsg
    }
    static loadDllPath(dllPath: string) {
        if (process.platform == 'win32') {
            LIN.LoadDll(dllPath)
        }
    }
    static getLibVersion() {
        if (process.platform == 'win32') {
            const v = new LIN.TLINVersion()
            const result = LIN.LIN_GetVersion(v)
            if (result == 0) {
                return `${v.Major}.${v.Minor}.${v.Revision}.${v.Build}`
            } else {
                throw new Error(err2Str(result))
            }
        } else {
            return 'only support windows'
        }
    }
    startTs: number
    offsetTs = 0
    offsetInit = false
    log: LinLOG
    db?: LDF
    constructor(public info: LinBaseInfo) {
        super(info)
        this.client = this.registerClient()
        this.connectClient(this.client, info.device)
        this.initHardware(info.device, this.client, info.mode == LinMode.MASTER, info.baudRate)
        LIN.LIN_RegisterFrameId(this.client, info.device.handle, 0, 0x3F)
        LIN.CreateTSFN(this.client, this.info.id, this.callback.bind(this))
        this.log = new LinLOG('PEAK', info.name, this.event)
        this.startTs = getTsUs()

        if (info.database) {
            this.db = global.database.lin[info.database]
        }
        for (let i = 0; i <= 0x3f; i++) {
            const checksum = (i == 0x3c || i == 0x3d) ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED
            this.setEntry(i, 8, LinDirection.RECV_AUTO_LEN, checksum, Buffer.alloc(8), 0);

        }
        // this.getEntrys()
        // this.wakeup()
    }
    setEntry(frameId: number, length: number, dir: LinDirection, checksumType: LinChecksumType, initData: Buffer, flag: number) {
        const entry = new LIN.TLINFrameEntry()
        entry.FrameId = frameId
        entry.Length = length
        entry.Direction = dir == LinDirection.SEND ? 1 : (dir == LinDirection.RECV ? 2 : 3)
        entry.ChecksumType = checksumType == LinChecksumType.CLASSIC ? 1 : 2
        entry.Flags = flag
        const ia = LIN.ByteArray.frompointer(entry.InitialData)
        for (let i = 0; i < length; i++) {
            ia.setitem(i, initData[i])
        }
        const result = LIN.LIN_SetFrameEntry(this.client, this.info.device.handle, entry)
        if (result != 0) {
            throw new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, undefined, err2Str(result))
        }
    }
    async callback() {

        const recvMsg = new LIN.TLINRcvMsg()
        const ret = LIN.LIN_Read(this.client, recvMsg)
        if (ret == 0) {

            let ts = recvMsg.TimeStamp
            if (!this.offsetInit) {
                this.offsetTs = ts - (getTsUs() - this.startTs)
                this.offsetInit = true
            }
            ts -= this.offsetTs

            if (recvMsg.Type == 0) {
                //mstStandard
                const a = new LIN.ByteArray.frompointer(recvMsg.Data)
                const data = Buffer.alloc(recvMsg.Length)
                for (let i = 0; i < recvMsg.Length; i++) {
                    data[i] = a.getitem(i)
                }



                const msg: LinMsg = {
                    frameId: recvMsg.FrameId & 0x3f,
                    data: data,
                    direction: recvMsg.Direction == 1 ? LinDirection.SEND : (recvMsg.Direction == 2 ? LinDirection.RECV : LinDirection.RECV_AUTO_LEN),
                    checksumType: recvMsg.ChecksumType == 1 ? LinChecksumType.CLASSIC : LinChecksumType.ENHANCED,
                    checksum: recvMsg.Checksum,

                }

                if (recvMsg.ErrorFlags == 0) {
                    this.lastFrame.set(msg.frameId, msg)
                }
                const error: string[] = []
                const handle = () => {

                    if (recvMsg.ErrorFlags & 1) {
                        error.push('Error on Synchronization field')
                    }
                    if (recvMsg.ErrorFlags & 2) {
                        error.push('Wrong parity Bit 0')
                    }
                    if (recvMsg.ErrorFlags & 4) {
                        error.push('Wrong parity Bit 1')
                    }
                    if (recvMsg.ErrorFlags & 8) {
                        error.push('Slave not responding error')
                    }
                    if (recvMsg.ErrorFlags & 16) {
                        error.push('A timeout was reached')
                    }
                    if (recvMsg.ErrorFlags & 32) {
                        error.push('Wrong checksum')
                    }
                    if (recvMsg.ErrorFlags & 64) {
                        error.push('Bus shorted to ground')
                    }
                    if (recvMsg.ErrorFlags & 128) {
                        error.push('Bus shorted to Vbat')
                    }
                    if (recvMsg.ErrorFlags & 256) {
                        error.push('A slot time (delay) was too smallt')
                    }
                    if (recvMsg.ErrorFlags & 512) {
                        error.push(' Response was received from other station')
                    }
                }
                let isEvent = false;
                if (this.pendingPromise && this.pendingPromise.sendMsg.frameId == (msg.frameId & 0x3f)) {
                    this.pendingPromise.sendMsg.data = msg.data
                    this.pendingPromise.sendMsg.ts = ts
                    if (recvMsg.ErrorFlags != 0) {
                        handle()
                        this.log.error(ts, error.join(', '), this.pendingPromise.sendMsg)
                        this.pendingPromise.reject(new LinError(LIN_ERROR_ID.LIN_BUS_ERROR, this.pendingPromise.sendMsg, error.join(', ')))
                    } else {

                        this.log.linBase(this.pendingPromise.sendMsg)
                        this.event.emit(`${msg.frameId}`, this.pendingPromise.sendMsg)
                        this.pendingPromise.resolve(this.pendingPromise.sendMsg)
                    }
                    this.pendingPromise = undefined
                } else {
                    //slave
                    msg.ts = ts
                    if (this.db) {
                        // Find matching frame or event frame
                        let frameName: string | undefined;

                        let publish: string | undefined;

                        // Check regular frames
                        for (const fname in this.db.frames) {
                            if (this.db.frames[fname].id === msg.frameId) {
                                frameName = fname;
                                publish = this.db.frames[fname].publishedBy;
                                break;
                            }
                        }

                        // Check event triggered frames
                        if (!frameName) {

                            for (const ename in this.db.eventTriggeredFrames) {
                                const eventFrame = this.db.eventTriggeredFrames[ename];
                                if (eventFrame.frameId === msg.frameId) {
                                    frameName = ename;
                                    isEvent = true;
                                    break;
                                }
                            }
                        }

                        // Enrich message with database info if frame found
                        if (frameName) {
                            msg.name = frameName;
                            msg.workNode = publish;
                            msg.isEvent = isEvent;
                        }
                    }
                    if (recvMsg.ErrorFlags != 0) {
                        handle()
                        this.log.error(ts, error.join(', '), msg)
                    } else {
                        if (isEvent && this.db) {
                            const pid = msg.data[0] & 0x3f
                            for (const fname in this.db.frames) {
                                if (this.db.frames[fname].id === pid) {
                                    msg.workNode = this.db.frames[fname].publishedBy;
                                    break;
                                }
                            }
                        }
                        this.log.linBase(msg)
                        this.event.emit(`${msg.frameId}`, msg)
                    }
                }

            } else if (recvMsg.Type == 1) {
                this.log.sendEvent('busSleep', ts)
            } else if (recvMsg.Type == 2) {
                this.log.sendEvent('busWakeUp', ts)
            } else {
                this.log.error(ts, 'internal error')
            }
            //让出时间片
            await new Promise((resolve) => {
                setImmediate(() => {
                    resolve(null)
                })
            })
            await this.callback()

        }
    }
    close() {

        LIN.FreeTSFN(this.info.id)
        LIN.LIN_ResetHardwareConfig(this.client, this.info.device.handle)

        LIN.LIN_DisconnectClient(this.client, this.info.device.handle)

        LIN.LIN_RemoveClient(this.client)


    }
    async _write(m: LinMsg): Promise<number> {

        return new Promise<number>((resolve, reject) => {

            let result = 0
            const msg = new LIN.TLINMsg()
            msg.FrameId = getPID(m.frameId)
            msg.Length = Math.min(m.data.length, 8)
            msg.Direction = m.direction == LinDirection.SEND ? 1 : (m.direction == LinDirection.RECV ? 2 : 3)
            msg.ChecksumType = m.checksumType == LinChecksumType.CLASSIC ? 1 : 2
            if (this.info.mode == LinMode.MASTER) {
                if (this.pendingPromise != undefined) {
                    reject(new LinError(LIN_ERROR_ID.LIN_BUS_BUSY, m))
                    return
                }
                if (m.direction == LinDirection.SEND) {
                    const a = LIN.ByteArray.frompointer(msg.Data)
                    for (let i = 0; i < msg.Length; i++) {
                        // msg.Data.setitem(i,data[i])  
                        a.setitem(i, m.data[i])
                    }
                    result = LIN.LIN_CalculateChecksum(msg)
                    if (result != 0) {
                        reject(new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, m, err2Str(result)))
                        return
                    }
                    if (m.isEvent) {
                        if (!this.checkEventFramePID(m.data[0])) {
                            //just change the length to 1 so the checksum will be incorrect
                            msg.Length = 1
                        }
                    }
                }
                result = LIN.LIN_Write(this.client, this.info.device.handle, msg)

                if (result != 0) {
                    reject(new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, m, err2Str(result)))
                    return
                }

                this.pendingPromise = {
                    resolve: (msg) => resolve(msg.ts || 0),
                    reject,
                    sendMsg: m
                }


            } else {
                //set entry

                const entry = new LIN.TLINFrameEntry()
                entry.FrameId = m.frameId
                entry.Direction = m.direction == LinDirection.SEND ? 1 : (m.direction == LinDirection.RECV ? 2 : 3)
                entry.ChecksumType = m.checksumType == LinChecksumType.CLASSIC ? 1 : 2
                entry.Length = m.data.length
                entry.Flags = LIN.FRAME_FLAG_RESPONSE_ENABLE | LIN.FRAME_FLAG_IGNORE_INIT_DATA
                result = LIN.LIN_SetFrameEntry(this.info.device.handle, entry)
                if (result != 0) {
                    reject(new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, m, err2Str(result)))
                    return
                }
                //update entry
                const a = new LIN.ByteArray(m.data.length)
                for (let i = 0; i < m.data.length; i++) {
                    a.setitem(i, m.data[i])
                }
                result = LIN.LIN_UpdateByteArray(this.client, this.info.device.handle, m.frameId, 0, m.data.length, a.cast())
                if (result != 0) {
                    reject(new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, m, err2Str(result)))
                    return
                } else {
                    resolve(0)
                }
            }
        })







    }

    read(frameId: number) {
        return this.lastFrame.get(frameId)
    }
    wakeup() {

        const result = LIN.LIN_XmtWakeUp(this.client, this.info.device.handle)
        if (result != 0) {
            throw new LinError(LIN_ERROR_ID.LIN_INTERNAL_ERROR, undefined, err2Str(result))
        }

    }
    getStatus() {
        const status = new LIN.TLINHardwareStatus()
        LIN.LIN_GetStatus(this.info.device.handle, status)
        return {
            master: status.Mode == 2,
            status: status.Status,
        }
    }

    static getValidDevices(): LinDevice[] {
        const devices: LinDevice[] = []
        if (process.platform == 'win32') {
            const dd = new LIN.HLINHW_JS(100);
            const count = new LIN.INT_JS()
            const result = LIN.LIN_GetAvailableHardware(dd.cast(), 100, count.cast())

            if (result == 0) {
                for (let i = 0; i < count.value(); i++) {
                    const handle = dd.getitem(i)
                    const labelBuffer = Buffer.alloc(256)
                    LIN.LIN_GetHardwareParam(handle, LIN.hwpName, labelBuffer)
                    devices.push({
                        label: `${buf2str(labelBuffer)} (${handle})`,
                        id: handle.toString(),
                        handle
                    })
                }
                return devices
            } else {
                throw new Error(err2Str(result))
            }
        } else {
            return devices
        }
    }
    private registerClient() {
        const clientName = v4()
        const client = new LIN.HLINCLIENT_JS()
        const result = LIN.LIN_RegisterClient(clientName, 0, client.cast())
        if (result != 0) {
            throw new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, undefined, err2Str(result))
        }
        return client.value()

    }


    private connectClient(client: number, device: LinDevice) {
        const result = LIN.LIN_ConnectClient(client, device.handle)
        if (result != 0) {
            throw new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, undefined, err2Str(result))
        }
    }
    private initHardware(device: LinDevice, client: number, master: boolean, baud: number) {
        const result = LIN.LIN_InitializeHardware(client, device.handle, master ? 2 : 1, baud)
        if (result != 0) {
            throw new LinError(LIN_ERROR_ID.LIN_PARAM_ERROR, undefined, err2Str(result))
        }
    }
}