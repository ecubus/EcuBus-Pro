import os from 'os'
import { EntityAddr, EthAddr, EthBaseInfo, EthDevice, TesterAddr, VinInfo } from '../share/doip'
import net from 'net'
import dgram from 'dgram'
import EventEmitter from 'events'
import { random } from 'lodash'
import { DoipLOG, UdsLOG } from '../log'
import { TesterInfo } from '../share/tester'
import { findService } from '../docan/uds'

export function getEthDevices() {
  const ifaces = os.networkInterfaces()
  const ethDevices: EthDevice[] = []
  if (!ifaces) return ethDevices
  for (const [name, iface] of Object.entries(ifaces)) {
    //just ethernet devices
    if (iface) {
      for (const eth of iface) {
        if (eth.family === 'IPv4') {
          ethDevices.push({
            label: name,
            id: eth.mac,
            handle: eth.address,
            detail: eth
          })
          break
        }
      }
    }
  }
  return ethDevices
}

export enum PayloadType {
  DoIP_HeaderNegativeAcknowledge = 0, //udp, tcp
  DoIP_VehicleIdentificationRequest = 0x0001, //udp(13400)
  DoIP_VehicleIdentificationRequestWithEID = 0x0002, //udp(13400)
  DoIP_VehicleIdentificationRequestWithVIN = 0x0003, //udp(13400)
  DoIP_VehicleAnnouncementResponse = 0x0004, //udp
  DoIP_RouteActivationRequest = 0x0005, //tcp
  DoIP_RouteActivationResponse = 0x0006, //tcp
  DoIP_AliveRequest = 0x0007, //tcp
  DoIP_AliveResponse = 0x0008, //tcp
  DoIP_EntityStateRequest = 0x4001, //udp(13400)
  DoIP_EntityStateResponse = 0x4002, //udp
  DoIP_PowerModeInfoRequest = 0x4003, //udp(13400)
  DoIP_PowerModeInfoResponse = 0x4004, //udp
  DoIP_DiagnosticMessage = 0x8001, //tcp
  DoIP_DiagnosticMessagePositiveAcknowledge = 0x8002, //tcp
  DoIP_DiagnosticMessageNegativeAcknowledge = 0x8003 //tcp
}

export enum DOIP_ERROR_ID {
  DOIP_HEADER_ERR,
  DOIP_VIN_NO_RESP,
  DOIP_UDP_SEND_ERR,
  DOIP_PARAM_ERR,
  DOIP_ROUTE_ACTIVE_ERR,
  DOIP_DIAG_NACK_ERR,
  DOIP_TCP_ERROR,
  DOIP_DIAG_TIMEOUT,
  DOIP_TIMEOUT_UPPER_READ,
  DOIP_ENTITY_EXIST,
  DOIP_CLOSE
}

const doipErrorMap: Record<DOIP_ERROR_ID, string> = {
  [DOIP_ERROR_ID.DOIP_HEADER_ERR]: 'header format error',
  [DOIP_ERROR_ID.DOIP_VIN_NO_RESP]: 'vin request without response',
  [DOIP_ERROR_ID.DOIP_UDP_SEND_ERR]: 'udp send error',
  [DOIP_ERROR_ID.DOIP_PARAM_ERR]: 'param error',
  [DOIP_ERROR_ID.DOIP_ROUTE_ACTIVE_ERR]: 'router active error',
  [DOIP_ERROR_ID.DOIP_DIAG_NACK_ERR]: 'diagnostic negative ack',
  [DOIP_ERROR_ID.DOIP_TCP_ERROR]: 'tcp error',
  [DOIP_ERROR_ID.DOIP_DIAG_TIMEOUT]: 'diagnostic message timeout',
  [DOIP_ERROR_ID.DOIP_ENTITY_EXIST]: 'entity already exist',
  [DOIP_ERROR_ID.DOIP_CLOSE]: 'self close',
  [DOIP_ERROR_ID.DOIP_TIMEOUT_UPPER_READ]: 'upper layer read timeout'
}

export class DoipError extends Error {
  errorId: DOIP_ERROR_ID
  data?: Buffer
  constructor(errorId: DOIP_ERROR_ID, data?: Buffer, extMsg?: string) {
    super(doipErrorMap[errorId] + (extMsg ? `, ${extMsg}` : ''))
    this.errorId = errorId
    this.data = data
  }
}

export enum NackCode {
  DoIP_IncorrectPatternFormatCode = 0,
  DoIP_InvalidPayloadTypeFormatCode = 1,
  DoIP_MessageTooLarge = 2,
  DoIP_OutOfMemory = 3,
  DoIP_InvalidPayloadLength = 4
}

export enum RouteCode {
  DoIP_UnknownSa = 0,
  DoIP_NoSocket = 1,
  DoIp_SaDiff = 2,
  DoIP_SaUsed = 3,
  DoIP_MissAuth = 4,
  DoIP_RejectConfirm = 5,
  DoIP_UnsupportedActiveType = 6,
  DoIP_OK = 0x10,
  DoIP_AcceptedNeedConfirm = 0x11
}

function getTsUs() {
  const hrtime = process.hrtime()
  const seconds = hrtime[0]
  const nanoseconds = hrtime[1]
  return seconds * 1000000 + Math.floor(nanoseconds / 1000)
}

interface GenericHeaderAction {
  payloadType: PayloadType
  value?: NackCode
  payloadLength: number
  data: Buffer
}

interface tcpData {
  state:
    | 'init'
    | 'sa-check'
    | 'register-pending-confirm'
    | 'register-pending-auth'
    | 'register-active'
  inactiveTimer: NodeJS.Timeout
  generalTimer: NodeJS.Timeout
  aliveTimer?: {
    socket: net.Socket
    timer: NodeJS.Timeout
  }
  authInfo?: any
  confirmInfo?: any
  socket: net.Socket
  testerAddr?: number

  recvState: 'header' | 'payload'
  pendingBuffer: Buffer
  payloadLen: number
  lastAction?: GenericHeaderAction
  ulog?: UdsLOG
}

interface udpData {
  recvState: 'header' | 'payload'
  pendingBuffer: Buffer
  payloadLen: number
  lastAction?: GenericHeaderAction
  remoteIp: string
  remotePort: number
  localPort?: number
}

export interface clientTcp {
  addr: EthAddr
  recvState: 'header' | 'payload'
  socket: net.Socket
  state: 'init' | 'active'
  pendingBuffer: Buffer
  lastAction?: GenericHeaderAction
  payloadLen: number
  oemSpec?: Buffer
  pendingPromise?: {
    resolve: (val: { ts: number; data: Buffer }) => void
    reject: (err: DoipError) => void
  }
  timeout?: NodeJS.Timeout
}

export class DOIP {
  version = 2
  initTimeout = 2000
  aliveTimeout = 500
  generalTimeout = 5 * 60 * 1000
  inverseVersion = 0xfd
  maxProcessSize = 4000
  private udp4Server?: dgram.Socket
  private server?: net.Server
  log: DoipLOG
  udsLog: UdsLOG
  minLne = 8
  event = new EventEmitter()
  ethAddr?: EntityAddr
  startTs: number
  connectTable: tcpData[] = []
  selfSentUdpInfo: string[] = []
  tcpClientMap: Map<string, clientTcp> = new Map()
  eth: EthDevice
  entityMap: Map<string, EntityAddr> = new Map() //ip->entity

  /* version| inverseVersion| payloadType(2)| len(4)| content */
  constructor(
    public base: EthBaseInfo,
    private tester: TesterInfo
  ) {
    this.eth = base.device

    if (this.tester.doipVersion == 3) {
      this.version = 3
      this.inverseVersion = 0xfc
    }

    //create tcp server bind to eth port 13400
    this.startTs = getTsUs()
    this.log = new DoipLOG(base.vendor, this.eth.label, this.event, this.startTs)
    this.udsLog = new UdsLOG(`Tester ${base.name}`)

    const udp4Server = dgram.createSocket('udp4')

    udp4Server.on('error', (err) => {
      this.udsLog.systemMsg(
        `udp server error : ${err.toString()}`,
        getTsUs() - this.startTs,
        'error'
      )
      this.udp4Server?.close()
      this.udp4Server = undefined
    })
    udp4Server.bind(13400, this.eth.handle)

    udp4Server.on('message', (msg, rinfo) => {
      //ignore self register entity
      const inputInfo = `${rinfo.address}:${rinfo.port}`
      const selfInfo = [...this.selfSentUdpInfo]

      if (this.ethAddr) {
        selfInfo.push(`${this.eth.handle}:${this.ethAddr?.udpLocalPort}`)
      }
      const index = selfInfo.findIndex((item) => item == inputInfo)
      if (index == -1) {
        this.log.ipBase('udp', 'IN', udp4Server.address(), rinfo, msg)
      }
      //remove self sent udp info

      if (index >= 0) {
        this.selfSentUdpInfo.splice(index, 1)
      }

      //tester handle
      this.parseDataUdp(
        udp4Server,
        {
          recvState: 'header',
          pendingBuffer: Buffer.alloc(0),
          remoteIp: rinfo.address,
          remotePort: rinfo.port,
          payloadLen: 0,
          localPort: 13400
        },
        msg
      )
    })
    this.udp4Server = udp4Server
  }
  async registerEntity(announce = true, uLog?: UdsLOG) {
    return new Promise<void>((resolve, reject) => {
      if (this.ethAddr != undefined) {
        reject(new DoipError(DOIP_ERROR_ID.DOIP_ENTITY_EXIST))
        return
      }
      const entity = this.tester.address[0]?.ethAddr?.entity
      if (!entity) {
        reject(new DoipError(DOIP_ERROR_ID.DOIP_PARAM_ERR, undefined, 'eth addr not found'))
        return
      }
      this.ethAddr = entity
      this.ethAddr.ip = this.eth.handle
      this.server = net.createServer()
      this.server.on('error', (err) => {
        reject(new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, err.toString()))
        this.udsLog.systemMsg(
          `tcp main server : ${err.toString()}`,
          getTsUs() - this.startTs,
          'error'
        )
        this.server?.close()
      })

      this.server.on('connection', (socket) => {
        const item: tcpData = {
          socket: socket,
          state: 'init',
          recvState: 'header',
          pendingBuffer: Buffer.alloc(0),
          ulog: uLog,
          inactiveTimer: setTimeout(() => {
            //find in connectTable, remove it
            const index = this.connectTable.findIndex((item) => item.socket == socket)
            if (index >= 0) {
              const item = this.connectTable[index]
              if (item.state == 'init') {
                this.connectTable.splice(index, 1)
                uLog?.systemMsg(
                  'Terminate TCP connection without route active request',
                  getTsUs() - this.startTs,
                  'warn'
                )
                socket.destroy()
              }
            }
          }, this.initTimeout),
          generalTimer: setTimeout(() => {
            //find in connectTable, remove it
            const index = this.connectTable.findIndex((item) => item.socket == socket)
            if (index >= 0) {
              if (this.connectTable[index].state != 'init') {
                this.connectTable.splice(index, 1)
                socket.end()
              }
            }
          }, this.generalTimeout),
          payloadLen: 0
        }
        this.connectTable.push(item)
        //a new client
        uLog?.systemMsg(
          `new tcp client connected, waiting route active`,
          getTsUs() - this.startTs,
          'info'
        )
        socket.on('data', (val) => {
          item.generalTimer.refresh()
          this.parseData(socket, item, val)
        })
        // socket.on('end', () => {
        //     reject(new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, 'tcp server close'))
        //     uLog?.systemMsg(`tcp server end`, getTsUs() - this.startTs, 'error')
        //     //TODO:
        //     // this.event.emit(`server-${item.testerAddr}-${entity.logicalAddr}`,new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, 'tcp server close'))
        //     this.closeSocket(socket)
        // })
        socket.on('error', (err) => {
          reject(new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, err.toString()))
          uLog?.systemMsg(`tcp server : ${err.toString()}`, getTsUs() - this.startTs, 'warn')
          //TODO:
          // this.event.emit(`server-${item.testerAddr}-${entity.logicalAddr}`,new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, 'tcp server close'))
          this.closeSocket(socket)
        })
        socket.on('close', () => {
          uLog?.systemMsg(`tcp client close`, getTsUs() - this.startTs, 'warn')
          this.closeSocket(socket)
        })
      })
      this.server.listen(13400, this.eth.handle)

      //announce entity
      const data = this.getVehicleAnnouncementResponse(entity)
      let i = 0
      const socket = dgram.createSocket('udp4')
      socket.bind(0, this.eth.handle, () => {
        entity.udpLocalPort = socket.address().port
        socket.setBroadcast(true)
        const send = () => {
          socket.send(data, 13400, '255.255.255.255', (err) => {
            if (err) {
              socket.close()
              this.udsLog.systemMsg(
                `udp server send error : ${err.toString()}`,
                getTsUs() - this.startTs,
                'error'
              )
            } else {
              this.log.ipBase(
                'udp',
                'OUT',
                socket.address(),
                {
                  address: '255.255.255.255',
                  port: 13400
                },
                data
              )

              i++
              if (i < 3) {
                setTimeout(() => {
                  setTimeout(send, random(500))
                }, 500)
              } else {
                socket.close()
                resolve()
              }
            }
          })
        }
        if (announce) {
          setTimeout(send, random(500))
        } else {
          resolve()
        }
      })
    })
  }
  closeSocket(socket: net.Socket, err?: string) {
    const index = this.connectTable.findIndex((item) => item.socket == socket)
    if (index >= 0) {
      const item = this.connectTable[index]
      clearTimeout(item.inactiveTimer)
      clearTimeout(item.generalTimer)
      // 清理 aliveTimer
      if (item.aliveTimer) {
        clearTimeout(item.aliveTimer.timer)
        item.aliveTimer = undefined
      }
      socket.destroy(err ? new Error(err) : undefined)
      this.connectTable.splice(index, 1)
    }
  }
  closeClientTcp(client: clientTcp) {
    // 清理 timeout
    if (client.timeout) {
      clearTimeout(client.timeout)
      client.timeout = undefined
    }
    // 清理 pendingPromise
    if (client.pendingPromise) {
      client.pendingPromise.reject(
        new DoipError(DOIP_ERROR_ID.DOIP_CLOSE, undefined, 'client closed')
      )
      client.pendingPromise = undefined
    }
    client.socket.resetAndDestroy()
    const key = `${client.addr.tester.testerLogicalAddr}`
    this.tcpClientMap.delete(key)
  }
  async createClient(addr: EthAddr): Promise<clientTcp> {
    const key = `${addr.tester.testerLogicalAddr}`
    if (this.tcpClientMap.has(key)) {
      return this.tcpClientMap.get(key)!
    }
    const allowRequest = addr.entityNotFoundBehavior || 'no'
    let ip: string | undefined

    if (addr.virReqType == 'omit') {
      this.udsLog.systemMsg('omit vin find, connect special ip', getTsUs() - this.startTs, 'info')
      ip = addr.virReqAddr
    } else {
      //find in entityMap,
      for (const ee of this.entityMap.values()) {
        for (const xe of this.tester.address) {
          if (addr.entity.logicalAddr == xe.ethAddr?.entity?.logicalAddr) {
            ip = ee.ip

            break
          }
        }
        if (ip) {
          break
        }
      }
      if (ip == undefined || allowRequest.startsWith('force')) {
        if (allowRequest == 'no') {
          throw new DoipError(DOIP_ERROR_ID.DOIP_PARAM_ERR, undefined, 'entity ip not found')
        } else if (allowRequest.toLocaleLowerCase().endsWith('normal')) {
          const v = await this.sendVehicleIdentificationRequest(addr)
          for (const e of v) {
            if (e.logicalAddr == addr.entity.logicalAddr) {
              ip = e.ip
              break
            }
          }
        } else if (allowRequest.toLocaleLowerCase().endsWith('withvin')) {
          const v = await this.sendVehicleIdentificationRequestWithVIN(addr)
          for (const e of v) {
            if (e.logicalAddr == addr.entity.logicalAddr) {
              ip = e.ip
              break
            }
          }
        } else if (allowRequest.toLocaleLowerCase().endsWith('witheid')) {
          const v = await this.sendVehicleIdentificationRequestWithEID(addr)
          for (const e of v) {
            if (e.logicalAddr == addr.entity.logicalAddr) {
              ip = e.ip
              break
            }
          }
        }
      }
    }
    return new Promise<clientTcp>((resolve, reject) => {
      if (ip == undefined) {
        reject(new DoipError(DOIP_ERROR_ID.DOIP_PARAM_ERR, undefined, 'entity ip not found'))
        return
      }

      // 创建TCP连接，使用指定的本地端口
      const connectOptions: net.NetConnectOpts = {
        host: ip,
        port: 13400
      }

      if (addr.tcpClientPort) {
        connectOptions.localPort = addr.tcpClientPort
        connectOptions.localAddress = this.eth.handle
      }

      const socket = net.createConnection(connectOptions)
      const item: clientTcp = {
        addr: addr,
        socket,
        recvState: 'header',
        state: 'init',
        pendingBuffer: Buffer.alloc(0),
        payloadLen: 0
      }
      item.addr.virReqAddr = ip
      const timeout = setTimeout(() => {
        reject(new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, 'tcp connect timeout'))
        socket.destroy()
        this.udsLog.systemMsg(`client tcp connect timeout`, getTsUs() - this.startTs, 'error')
      }, 2000)

      socket.on('connect', () => {
        clearTimeout(timeout)
        // 设置socket选项
        socket.setNoDelay(true)
        socket.setKeepAlive(true, 0)
        this.tcpClientMap.set(key, item)
        setTimeout(() => {
          this.routeActiveRequest(item)
            .then((val) => {
              resolve(item)
            })
            .catch((err) => {
              reject(err)
            })
        }, addr.tester.routeActiveTime)
        // resolve(item)
      })
      socket.on('error', (err: any) => {
        clearTimeout(timeout)
        let errorMsg = err.toString()
        if (err.code === 'EADDRINUSE' && addr.tcpClientPort) {
          errorMsg = `TCP client port ${addr.tcpClientPort} is already in use. Please try a different port or ensure no other process is using this port.`
        }
        reject(new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, errorMsg))
        socket.destroy()
        const client = this.tcpClientMap.get(key)
        if (client) {
          this.closeClientTcp(client)
        }
        this.udsLog.systemMsg(
          `client tcp connect error: ${errorMsg}`,
          getTsUs() - this.startTs,
          'error'
        )
        //TODO:
        // this.event.emit(`client-${addr.tester.testerLogicalAddr}-${addr.entity.logicalAddr}`, 'error')
      })
      socket.on('end', () => {
        const msg = `Server (${item.addr.entity.logicalAddr}) close the connection`
        reject(new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, msg))
        socket.destroy()
        const client = this.tcpClientMap.get(key)
        if (client) {
          this.closeClientTcp(client)
        }

        if (item.pendingPromise) {
          item.pendingPromise.reject(new DoipError(DOIP_ERROR_ID.DOIP_CLOSE, undefined, msg))
        } else {
          this.udsLog.systemMsg(msg, getTsUs() - this.startTs, 'error')
        }
        //TODO:
        // this.event.emit(`client-${addr.tester.testerLogicalAddr}-${addr.entity.logicalAddr}`, 'error')
      })
      socket.on('data', (val) => {
        this.parseDataClient(socket, item, val)
      })
    })
  }
  async routeActiveRequest(client: clientTcp, activeType = 0, oemSpec?: Buffer) {
    return new Promise<{ ts: number; data: Buffer }>((resolve, reject) => {
      const data = Buffer.alloc(7 + (oemSpec ? 4 : 0))
      data.writeUInt16BE(client.addr.tester.testerLogicalAddr, 0)
      data.writeUint8(activeType & 0xff, 2)
      if (oemSpec) {
        oemSpec.copy(data, 7, 0, 4)
      }
      client.pendingPromise = { resolve, reject }
      const allData = this.buildMessage(PayloadType.DoIP_RouteActivationRequest, data)
      client.socket.write(allData, (err) => {
        if (err) {
          reject(new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, err.toString()))
        } else {
          this.log.ipBase(
            'tcp',
            'OUT',
            { address: client.socket.localAddress, port: client.socket.localPort },
            {
              address: client.socket.remoteAddress,
              port: client.socket.remotePort
            },
            allData
          )
        }
      })
      client.timeout = setTimeout(() => {
        reject(new DoipError(DOIP_ERROR_ID.DOIP_DIAG_TIMEOUT, undefined))
      }, 2000)
    })
  }
  async writeTpReq(item: clientTcp, data: Buffer, ta?: number) {
    return new Promise<{ ts: number; data: Buffer }>((resolve, reject) => {
      if (item.socket.closed) {
        reject(new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, 'tcp closed'))
        return
      }
      if (item.state != 'active') {
        reject(new DoipError(DOIP_ERROR_ID.DOIP_PARAM_ERR, undefined, 'client not active'))
        return
      }
      item.pendingPromise = { resolve, reject }
      const buffer = Buffer.alloc(4 + data.length)
      buffer.writeUInt16BE(item.addr.tester.testerLogicalAddr, 0)
      if (ta != undefined) {
        buffer.writeUInt16BE(ta, 2)
      } else {
        buffer.writeUInt16BE(item.addr.entity.logicalAddr, 2)
      }
      data.copy(buffer, 4)
      const val = this.buildMessage(PayloadType.DoIP_DiagnosticMessage, buffer)

      item.socket.write(val, (err) => {
        if (err) {
          reject(new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, err.toString()))
          item.pendingPromise = undefined
        } else {
          const ts = this.log.ipBase(
            'tcp',
            'OUT',
            { address: item.socket.localAddress, port: item.socket.localPort },
            {
              address: item.socket.remoteAddress,
              port: item.socket.remotePort
            },
            val
          )
          if (this.tester) {
            const service = findService(this.tester, data, true)
            if (service) {
              this.udsLog.sent(this.tester.id, service, ts, data)
            }
          }
          this.event.emit(
            `client-${item.addr.tester.testerLogicalAddr}-${item.addr.entity.logicalAddr}`,
            {
              data,
              ts
            }
          )
          item.timeout = setTimeout(() => {
            reject(new DoipError(DOIP_ERROR_ID.DOIP_DIAG_TIMEOUT, undefined))
            item.pendingPromise = undefined
          }, 2000)
        }
      })
    })
  }
  async writeTpResp(testerAddr: TesterAddr, data: Buffer) {
    return new Promise<{ ts: number; data: Buffer }>((resolve, reject) => {
      if (this.ethAddr == undefined) {
        reject(new DoipError(DOIP_ERROR_ID.DOIP_PARAM_ERR, undefined, 'entity not exist'))
        return
      }

      const sitem = this.connectTable.find(
        (item) => item.testerAddr == testerAddr.testerLogicalAddr && item.state == 'register-active'
      )
      if (sitem) {
        const buffer = Buffer.alloc(4 + data.length)
        buffer.writeUInt16BE(this.ethAddr.logicalAddr, 0)
        buffer.writeUInt16BE(testerAddr.testerLogicalAddr, 2)

        data.copy(buffer, 4)
        const val = this.buildMessage(PayloadType.DoIP_DiagnosticMessage, buffer)

        sitem.socket.write(val, (err) => {
          if (err) {
            reject(new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, undefined, err.toString()))
          } else {
            const ts = this.log.ipBase(
              'tcp',
              'OUT',
              { address: sitem.socket.localAddress, port: sitem.socket.localPort },
              {
                address: sitem.socket.remoteAddress,
                port: sitem.socket.remotePort
              },
              val
            )
            if (this.tester) {
              const service = findService(this.tester, data, false)
              if (service) {
                this.udsLog.recv(this.tester.id, service, ts, data)
              }
            }
            this.event.emit(`server-${testerAddr}-${this.ethAddr?.logicalAddr}`, {
              ts: ts,
              data: data
            })
            resolve({ ts: getTsUs() - this.startTs, data: val })
          }
        })
      } else {
        throw new Error('client not exist')
      }
    })
  }
  async sendVehicleIdentificationRequest(addr: EthAddr) {
    const data = Buffer.alloc(0)
    const resp = await this.udsSend(
      addr,
      this.buildMessage(PayloadType.DoIP_VehicleIdentificationRequest, data),
      'null'
    )
    return resp
  }
  async sendVehicleIdentificationRequestWithEID(addr: EthAddr) {
    const eid = addr.entity.eid.split('-').join('')
    const data = Buffer.alloc(6)
    data.write(eid.slice(0, 12), 'hex')

    const resp = await this.udsSend(
      addr,
      this.buildMessage(PayloadType.DoIP_VehicleIdentificationRequestWithEID, data),
      'eid'
    )
    return resp
  }
  async sendVehicleIdentificationRequestWithVIN(addr: EthAddr) {
    const vin = addr.entity.vin
    const data = Buffer.alloc(17)
    data.write(vin.slice(0, 17), 'ascii')
    const resp = await this.udsSend(
      addr,
      this.buildMessage(PayloadType.DoIP_VehicleIdentificationRequestWithVIN, data),
      'vin'
    )
    return resp
  }
  async udsSend(addr: EthAddr, data: Buffer, reqType: 'null' | 'vin' | 'eid') {
    return new Promise<EntityAddr[]>((resolve, reject) => {
      const socket = dgram.createSocket('udp4')
      const timeout = setTimeout(() => {
        socket.close()
        const list = []
        for (const e of this.entityMap.values()) {
          if (e.localPort == udpData.localPort) {
            if (reqType == 'vin') {
              const a = Buffer.alloc(17)
              a.write(e.vin.slice(0, 17), 'ascii')
              const b = Buffer.alloc(17)
              b.write(addr.entity.vin.slice(0, 17), 'ascii')
              if (a.compare(b) == 0) {
                list.push(e)
              }
            } else {
              list.push(e)
            }
            break
          }
        }
        resolve(list)
      }, 2000)
      const udpData: udpData = {
        recvState: 'header',
        pendingBuffer: Buffer.alloc(0),
        payloadLen: 0,
        remoteIp: addr.virReqAddr,
        remotePort: 13400
      }
      socket.on('message', (msg, rinfo) => {
        udpData.remoteIp = rinfo.address
        // this.log.ipBase('udp', 'IN', rinfo.address, socket.address().port, rinfo.port, msg)
        const inputInfo = `${rinfo.address}:${rinfo.port}`
        const selfInfo = `${this.eth.handle}:${this.ethAddr?.udpLocalPort}`

        if (inputInfo != selfInfo) {
          this.log.ipBase('udp', 'IN', socket.address(), rinfo, msg)
        }

        //handle entity
        this.parseDataUdp(socket, udpData, msg)
        if (reqType == 'eid') {
          for (const e of this.entityMap.values()) {
            if (e.localPort == udpData.localPort) {
              const a = Buffer.alloc(6)
              a.write(e.eid.split('-').join(''), 'hex')
              const b = Buffer.alloc(6)
              b.write(addr.entity.eid.split('-').join(''), 'hex')
              if (a.compare(b) == 0) {
                clearTimeout(timeout)
                socket.close()
                resolve([e])
                break
              }
            }
          }
        }
      })
      socket.bind(addr.udpClientPort || 0, this.eth.handle, () => {
        udpData.localPort = socket.address().port
        // if (this.ethAddr) {
        //     this.ethAddr.udpLocalPort = udpData.localPort
        // }
        this.selfSentUdpInfo.push(`${socket.address().address}:${socket.address().port}`)
        if (addr.virReqType == 'broadcast') {
          socket.setBroadcast(true)
          socket.send(data, 13400, '255.255.255.255', (err) => {
            if (err) {
              reject(new DoipError(DOIP_ERROR_ID.DOIP_UDP_SEND_ERR, data, err.toString()))
            } else {
              this.log.ipBase(
                'udp',
                'OUT',
                socket.address(),
                {
                  address: '255.255.255.255',
                  port: 13400
                },
                data
              )
            }
          })
        } else if (addr.virReqType == 'unicast') {
          socket.send(data, 13400, addr.virReqAddr, (err) => {
            if (err) {
              reject(new DoipError(DOIP_ERROR_ID.DOIP_UDP_SEND_ERR, data, err.toString()))
            } else {
              this.log.ipBase(
                'udp',
                'OUT',
                socket.address(),
                {
                  address: addr.virReqAddr,
                  port: 13400
                },
                data
              )
            }
          })
        } else if (addr.virReqType == 'omit') {
          reject(new DoipError(DOIP_ERROR_ID.DOIP_PARAM_ERR, undefined, 'omit ignore'))
          clearTimeout(timeout)
          socket.close()
        } else {
          clearTimeout(timeout)
          reject(
            new DoipError(
              DOIP_ERROR_ID.DOIP_PARAM_ERR,
              undefined,
              `unknown virReqType:${addr.virReqType}`
            )
          )
          socket.close()
        }
      })
    })
  }
  //parse tcp server data
  parseData(socket: net.Socket, item: tcpData, data: Buffer) {
    if (item.recvState == 'header' && item.pendingBuffer.length + data.length < this.minLne) {
      item.pendingBuffer = Buffer.concat([item.pendingBuffer, data])
      return
    }
    if (item.recvState == 'payload' && item.pendingBuffer.length + data.length < item.payloadLen) {
      item.pendingBuffer = Buffer.concat([item.pendingBuffer, data])
      return
    }

    const inputInfo = `${socket.remoteAddress}:${socket.remotePort}`
    const serveInfos = []
    for (const item of this.tcpClientMap.values()) {
      serveInfos.push(`${item.socket.localAddress}:${item.socket.localPort}`)
    }
    const sendLog = serveInfos.indexOf(inputInfo) == -1
    let buffer = Buffer.concat([item.pendingBuffer, data])
    if (item.recvState == 'header') {
      //header
      const action = this.headerHandler(buffer, true)
      //doip-045||doip-041
      if (
        action.value != undefined &&
        (action.value == NackCode.DoIP_IncorrectPatternFormatCode ||
          action.value == NackCode.DoIP_InvalidPayloadLength)
      ) {
        if (sendLog) {
          this.log.ipBase(
            'tcp',
            'IN',
            { address: socket.localAddress, port: socket.localPort },
            {
              address: socket.remoteAddress,
              port: socket.remotePort
            },
            buffer
          )
        }

        const val = this.getHeaderNegativeAcknowledge(action.value)
        socket.write(val, (err) => {
          this.log.ipBase(
            'tcp',
            'OUT',
            { address: socket.localAddress, port: socket.localPort },
            {
              address: socket.remoteAddress,
              port: socket.remotePort
            },
            val
          )
          this.closeSocket(socket)
        })

        return
      } else {
        item.lastAction = action
      }
      item.recvState = 'payload'
      item.payloadLen = action.payloadLength
      item.pendingBuffer = buffer.subarray(this.minLne)

      if (action.payloadLength == 0 || item.pendingBuffer.length >= item.payloadLen) {
        this.parseData(socket, item, Buffer.alloc(0))
      }
    } else {
      //payload
      if (buffer.length >= item.payloadLen) {
        let sentData: Buffer | undefined
        item.pendingBuffer = buffer.subarray(item.payloadLen)
        buffer = buffer.subarray(0, item.payloadLen)

        const inputInfo = `${socket.remoteAddress}:${socket.remotePort}`
        const serveInfos = []
        for (const item of this.tcpClientMap.values()) {
          serveInfos.push(`${item.socket.localAddress}:${item.socket.localPort}`)
        }

        let testerAddr: number | undefined = undefined
        let logicalAddr: number | undefined = undefined
        //has enough data
        if (item.lastAction == undefined || item.lastAction.value != undefined) {
          const code = item.lastAction?.value || NackCode.DoIP_InvalidPayloadTypeFormatCode
          const reply = this.getHeaderNegativeAcknowledge(code)
          sentData = reply
          // socket.write(reply, () => {
          //     item.generalTimer.refresh()
          // })
        } else {
          if (sendLog) {
            this.log.ipBase(
              'tcp',
              'IN',
              { address: socket.localAddress, port: socket.localPort },
              {
                address: socket.remoteAddress,
                port: socket.remotePort
              },
              Buffer.concat([item.lastAction.data, buffer])
            )
          }
          if (item.lastAction.payloadType == PayloadType.DoIP_RouteActivationRequest) {
            const sa = buffer.readUInt16BE(0)
            if (item.state == 'init') {
              item.testerAddr = sa
              clearTimeout(item.inactiveTimer)

              //if sa in connectTable, do alive check
              const sitem = this.connectTable.find(
                (item) => item.testerAddr == sa && item.state != 'init'
              )
              if (sitem) {
                item.state = 'sa-check'

                this.aliveCheck(socket, item.testerAddr)
              } else {
                item.state = 'register-active'
                sentData = this.getRouteActiveResponse(sa, RouteCode.DoIP_OK)
              }
            } else {
              if (item.testerAddr != sa) {
                const val = this.getRouteActiveResponse(sa, RouteCode.DoIp_SaDiff)
                socket.write(val, (err) => {
                  this.log.ipBase(
                    'tcp',
                    'OUT',
                    { address: socket.localAddress, port: socket.localPort },
                    {
                      address: socket.remoteAddress,
                      port: socket.remotePort
                    },
                    val
                  )
                  this.closeSocket(socket)
                })
              } else {
                sentData = this.getRouteActiveResponse(item.testerAddr, RouteCode.DoIP_OK)
              }
            }
          } else {
            if (item.state != 'register-active') {
              /*Incoming DoIP messages, except the DoIP routing activation message or messages required
for authentication or confirmation, shall not be processed nor be routed before the connection
is in the state "Registered [Routing Active]".*/
            } else {
              //normal
              if (item.lastAction.payloadType == PayloadType.DoIP_AliveResponse) {
                if (item.aliveTimer) {
                  //alive response received
                  clearTimeout(item.aliveTimer.timer)

                  const sitem = this.connectTable.find((qq) => qq.socket == item.aliveTimer?.socket)

                  if (sitem && sitem.testerAddr != undefined) {
                    const val = this.getRouteActiveResponse(sitem.testerAddr, RouteCode.DoIP_SaUsed)
                    sitem.socket.write(val, (err) => {
                      this.log.ipBase(
                        'tcp',
                        'OUT',
                        { address: socket.localAddress, port: socket.localPort },
                        {
                          address: socket.remoteAddress,
                          port: socket.remotePort
                        },
                        val
                      )
                      this.closeSocket(sitem.socket, 'sa used')
                    })
                  }
                  item.aliveTimer = undefined
                }
              } else if (item.lastAction.payloadType == PayloadType.DoIP_DiagnosticMessage) {
                const sa = buffer.readUInt16BE(0)
                const ta = buffer.readUInt16BE(2)
                const repl = Buffer.alloc(5)
                repl.writeUInt16BE(ta, 0)
                repl.writeUInt16BE(sa, 2)
                const taList = this.tester.address.map((x) => x.ethAddr?.entity?.logicalAddr)
                // buffer.subarray(4).copy(repl, 5)
                if (!taList.includes(ta)) {
                  //Unknown target address
                  repl.writeUInt8(3, 4)
                  sentData = this.buildMessage(
                    PayloadType.DoIP_DiagnosticMessageNegativeAcknowledge,
                    repl
                  )
                } else if (sa != item.testerAddr) {
                  repl.writeUInt8(2, 4)
                  sentData = this.buildMessage(
                    PayloadType.DoIP_DiagnosticMessageNegativeAcknowledge,
                    repl
                  )
                } else {
                  sentData = this.buildMessage(
                    PayloadType.DoIP_DiagnosticMessagePositiveAcknowledge,
                    repl
                  )
                  testerAddr = sa
                  logicalAddr = ta
                }
              } else {
                //unknown payload type

                sentData = this.getHeaderNegativeAcknowledge(
                  NackCode.DoIP_InvalidPayloadTypeFormatCode
                )
              }
            }
          }

          // this.event.emit('tcpData', socket, item.lastAction.payloadType, buffer.subarray(0, item.payloadLen))
        }
        if (sentData) {
          socket.write(sentData, (err) => {
            const ts = this.log.ipBase(
              'tcp',
              'OUT',
              { address: socket.localAddress, port: socket.localPort },
              {
                address: socket.remoteAddress,
                port: socket.remotePort
              },
              sentData
            )
            if (testerAddr != undefined && logicalAddr != undefined) {
              //is self?
              let isSelf = false
              this.tcpClientMap.forEach((client) => {
                if (
                  client.socket.localAddress == socket.remoteAddress &&
                  client.socket.localPort == socket.remotePort
                ) {
                  isSelf = true
                }
              })
              if (!isSelf) {
                if (this.tester) {
                  const service = findService(this.tester, buffer.subarray(4), true)
                  if (service) {
                    this.udsLog.sent(this.tester.id, service, ts, buffer.subarray(4))
                  }
                }
                this.event.emit(`client-${testerAddr}-${logicalAddr}`, {
                  ts: getTsUs() - this.startTs,
                  data: buffer.subarray(4)
                })
              }
            }
          })
          item.generalTimer.refresh()
        }
        item.recvState = 'header'

        if (item.pendingBuffer.length >= this.minLne) {
          this.parseData(socket, item, Buffer.alloc(0))
        }
      }
    }
  }
  parseDataClient(socket: net.Socket, item: clientTcp, data: Buffer) {
    const key = `${item.addr.tester.testerLogicalAddr}_${item.addr.entity.logicalAddr}`
    if (item.recvState == 'header' && item.pendingBuffer.length + data.length < this.minLne) {
      item.pendingBuffer = Buffer.concat([item.pendingBuffer, data])
      return
    }
    if (item.recvState == 'payload' && item.pendingBuffer.length + data.length < item.payloadLen) {
      item.pendingBuffer = Buffer.concat([item.pendingBuffer, data])
      return
    }
    let buffer = Buffer.concat([item.pendingBuffer, data])
    const inputInfo = `${socket.remoteAddress}:${socket.remotePort}`
    const selfInfo = `${this.ethAddr ? this.eth.handle : ''}:13400`
    const sendLog = inputInfo != selfInfo
    if (item.recvState == 'header') {
      //header
      const action = this.headerHandler(buffer, true)
      //doip-045||doip-041
      if (
        action.value != undefined &&
        (action.value == NackCode.DoIP_IncorrectPatternFormatCode ||
          action.value == NackCode.DoIP_InvalidPayloadLength)
      ) {
        if (sendLog) {
          this.log.ipBase(
            'tcp',
            'IN',
            { address: socket.localAddress, port: socket.localPort },
            {
              address: socket.remoteAddress,
              port: socket.remotePort
            },
            buffer
          )
        }
        socket.destroy()
        if (item.pendingPromise) {
          item.pendingPromise.reject(new DoipError(DOIP_ERROR_ID.DOIP_HEADER_ERR))
        }
        this.tcpClientMap.delete(key)
        return
      } else {
        item.lastAction = action
      }
      item.recvState = 'payload'
      item.payloadLen = action.payloadLength
      item.pendingBuffer = buffer.subarray(this.minLne)

      if (action.payloadLength == 0 || item.pendingBuffer.length >= item.payloadLen) {
        this.parseDataClient(socket, item, Buffer.alloc(0))
      }
    } else {
      //payload
      if (buffer.length >= item.payloadLen) {
        //has enough data

        item.pendingBuffer = buffer.subarray(item.payloadLen)
        buffer = buffer.subarray(0, item.payloadLen)

        if (item.lastAction == undefined || item.lastAction.value != undefined) {
          //do nothing
        } else {
          if (sendLog) {
            this.log.ipBase(
              'tcp',
              'IN',
              { address: socket.localAddress, port: socket.localPort },
              {
                address: socket.remoteAddress,
                port: socket.remotePort
              },
              Buffer.concat([item.lastAction.data, buffer])
            )
          }
          if (item.lastAction.payloadType == PayloadType.DoIP_HeaderNegativeAcknowledge) {
            item.pendingPromise?.reject(
              new DoipError(
                DOIP_ERROR_ID.DOIP_ROUTE_ACTIVE_ERR,
                Buffer.from([buffer[0]]),
                `client tcp receive header NACK ${buffer[0]}`
              )
            )

            item.socket.destroy()
            this.tcpClientMap.delete(key)
          } else if (item.lastAction.payloadType == PayloadType.DoIP_RouteActivationResponse) {
            if (item.addr.tester.testerLogicalAddr != buffer.readUInt16BE(0)) {
              item.pendingPromise?.reject(
                new DoipError(
                  DOIP_ERROR_ID.DOIP_ROUTE_ACTIVE_ERR,
                  undefined,
                  `client tcp receive route active response sa diff`
                )
              )

              item.socket.destroy()
              this.tcpClientMap.delete(key)
            } else {
              // item.addr.entity.logicalAddr = buffer.readUInt16BE(2)
              if (buffer.length > 5) {
                item.oemSpec = buffer.subarray(5)
              }
              if (buffer[4] == 0x10) {
                item.state = 'active'
                item.pendingPromise?.resolve({
                  ts: getTsUs() - this.startTs,
                  data: buffer.subarray(5)
                })
              } else {
                item.pendingPromise?.reject(
                  new DoipError(DOIP_ERROR_ID.DOIP_ROUTE_ACTIVE_ERR, Buffer.from([buffer[4]]))
                )
              }
            }
          } else if (item.lastAction.payloadType == PayloadType.DoIP_AliveRequest) {
            //
            clearTimeout(item.timeout)
            const buffer = Buffer.alloc(2)
            buffer.writeUInt16BE(item.addr.tester.testerLogicalAddr, 0)
            const val = this.buildMessage(PayloadType.DoIP_AliveResponse, buffer)
            this.log.ipBase(
              'tcp',
              'OUT',
              { address: socket.localAddress, port: socket.localPort },
              {
                address: socket.remoteAddress,
                port: socket.remotePort
              },
              val
            )
            socket.write(val)
          } else if (
            item.lastAction.payloadType == PayloadType.DoIP_DiagnosticMessageNegativeAcknowledge
          ) {
            const sa = buffer.readUInt16BE(0)
            const ta = buffer.readUInt16BE(2)
            clearTimeout(item.timeout)
            if (sa != item.addr.entity.logicalAddr || ta != item.addr.tester.testerLogicalAddr) {
              item.pendingPromise?.reject(
                new DoipError(
                  DOIP_ERROR_ID.DOIP_DIAG_NACK_ERR,
                  buffer,
                  `client tcp receive diag sa or ta diff`
                )
              )
            } else {
              item.pendingPromise?.reject(
                new DoipError(
                  DOIP_ERROR_ID.DOIP_DIAG_NACK_ERR,
                  buffer,
                  `client tcp receive diag negative ack ${buffer[0]}`
                )
              )
            }
          } else if (
            item.lastAction.payloadType == PayloadType.DoIP_DiagnosticMessagePositiveAcknowledge
          ) {
            const sa = buffer.readUInt16BE(0)
            const ta = buffer.readUInt16BE(2)
            clearTimeout(item.timeout)
            if (ta != item.addr.tester.testerLogicalAddr) {
              item.pendingPromise?.reject(
                new DoipError(
                  DOIP_ERROR_ID.DOIP_DIAG_NACK_ERR,
                  buffer,
                  `client tcp receive diag ta diff`
                )
              )
            } else {
              item.pendingPromise?.resolve({
                ts: getTsUs() - this.startTs,
                data: buffer.subarray(4)
              })
            }
          } else if (item.lastAction.payloadType == PayloadType.DoIP_DiagnosticMessage) {
            const sa = buffer.readUInt16BE(0)
            const ta = buffer.readUInt16BE(2)
            const ts = getTsUs() - this.startTs
            const inputInfo = `${socket.remoteAddress}:${socket.remotePort}`
            const selfInfo = `${this.ethAddr ? this.eth.handle : ''}:13400`
            if (inputInfo != selfInfo && this.tester) {
              const service = findService(this.tester, buffer.subarray(4), false)
              if (service) {
                this.udsLog.recv(this.tester.id, service, ts, buffer.subarray(4))
              }
            }

            if (ta != item.addr.tester.testerLogicalAddr) {
              item.pendingPromise?.reject(
                new DoipError(
                  DOIP_ERROR_ID.DOIP_DIAG_NACK_ERR,
                  buffer,
                  `client tcp receive diag ta diff`
                )
              )
            } else {
              if (this.event.listenerCount(`server-${ta}-${sa}`) > 0) {
                item.pendingPromise?.resolve({ ts: ts, data: buffer.subarray(4) })
                this.event.emit(`server-${ta}-${sa}`, {
                  ts: ts,
                  data: buffer.subarray(4)
                })
              } else {
                item.pendingPromise?.reject(
                  new DoipError(
                    DOIP_ERROR_ID.DOIP_DIAG_NACK_ERR,
                    buffer,
                    `client tcp receive diag sa diff`
                  )
                )
              }
            }
          } else {
            //unknown payload type, client do nothing
          }

          // this.event.emit('tcpData', socket, item.lastAction.payloadType, buffer.subarray(0, item.payloadLen))
        }
        item.recvState = 'header'

        if (item.pendingBuffer.length >= this.minLne) {
          this.parseDataClient(socket, item, Buffer.alloc(0))
        }
      }
    }
  }

  parseDataUdp(socket: dgram.Socket, item: udpData, data: Buffer) {
    if (item.recvState == 'header' && item.pendingBuffer.length + data.length < this.minLne) {
      item.pendingBuffer = Buffer.concat([item.pendingBuffer, data])
      return
    }
    if (item.recvState == 'payload' && item.pendingBuffer.length + data.length < item.payloadLen) {
      item.pendingBuffer = Buffer.concat([item.pendingBuffer, data])
      return
    }
    const buffer = Buffer.concat([item.pendingBuffer, data])
    if (item.recvState == 'header') {
      //header
      const action = this.headerHandler(buffer, false)
      //doip-045||doip-041
      if (
        action.value != undefined &&
        (action.value == NackCode.DoIP_IncorrectPatternFormatCode ||
          action.value == NackCode.DoIP_InvalidPayloadLength)
      ) {
        return
      } else {
        item.lastAction = action
      }
      item.recvState = 'payload'
      item.payloadLen = action.payloadLength
      item.pendingBuffer = buffer.subarray(this.minLne)

      if (action.payloadLength == 0 || item.pendingBuffer.length >= item.payloadLen) {
        this.parseDataUdp(socket, item, Buffer.alloc(0))
      }
      //continue parse
    } else {
      //payload

      if (buffer.length >= item.payloadLen) {
        // if(item.lastAction?.payloadType==PayloadType.DoIP_RouteActivationRequest){
        //     clearTimeout(item.inactiveTimer)
        // }
        let sentData: Buffer | undefined

        //has enough data
        if (item.lastAction == undefined || item.lastAction.value != undefined) {
          const code = item.lastAction?.value || NackCode.DoIP_InvalidPayloadTypeFormatCode
          sentData = this.getHeaderNegativeAcknowledge(code)
        } else {
          //udp
          if (
            item.lastAction.payloadType == PayloadType.DoIP_VehicleIdentificationRequest ||
            item.lastAction.payloadType == PayloadType.DoIP_VehicleIdentificationRequestWithEID ||
            item.lastAction.payloadType == PayloadType.DoIP_VehicleIdentificationRequestWithVIN
          ) {
            const entity = this.vehicleIdentificationHandle(item.lastAction.payloadType, buffer)

            if (entity && this.ethAddr) {
              //0: no more active
              sentData = this.getVehicleAnnouncementResponse(this.ethAddr)
            }
          } else if (item.lastAction.payloadType == PayloadType.DoIP_EntityStateRequest) {
            const buffer = Buffer.alloc(7)
            buffer[0] = 0 //NT
            buffer[1] = 255 //MCTS
            buffer[2] = this.connectTable.length //NCTS
            buffer.writeUInt32BE(this.maxProcessSize, 3) //max size
            sentData = this.buildMessage(PayloadType.DoIP_EntityStateResponse, buffer)
          } else if (item.lastAction.payloadType == PayloadType.DoIP_PowerModeInfoRequest) {
            //2 mean not supported
            sentData = this.buildMessage(PayloadType.DoIP_PowerModeInfoResponse, Buffer.from([2]))
          } else if (item.lastAction.payloadType == PayloadType.DoIP_VehicleAnnouncementResponse) {
            const vin = this.vehicleIdentificationConvert(buffer)
            const entityAddr: EntityAddr = {
              ...vin,
              ip: item.remoteIp,
              localPort: item.localPort
            }
            this.entityMap.set(`${item.remoteIp}-${item.remotePort}`, entityAddr)
          } else if (item.lastAction.payloadType == PayloadType.DoIP_EntityStateResponse) {
            //find entity by ip
            const entity = this.entityMap.get(`${item.remoteIp}-${item.remotePort}`)
            if (entity) {
              entity.nodeType = buffer[0] == 0 ? 'gateway' : 'node'
              entity.mcts = buffer[1]
              entity.ncts = buffer[2]
              entity.mds = buffer.readUInt32BE(3)
            }
          } else if (item.lastAction.payloadType == PayloadType.DoIP_PowerModeInfoResponse) {
            const entity = this.entityMap.get(`${item.remoteIp}-${item.remotePort}`)
            if (entity) {
              entity.powerMode = buffer[0]
            }
          } else {
            //unknown payload type
            //unknown payload type
            sentData = this.getHeaderNegativeAcknowledge(NackCode.DoIP_InvalidPayloadTypeFormatCode)
          }
          if (sentData) {
            socket.send(sentData, item.remotePort, item.remoteIp, (err) => {
              if (err) {
                this.udsLog.systemMsg(
                  `udp server send error:${err.toString()}`,
                  getTsUs() - this.startTs,
                  'error'
                )
              } else {
                this.log.ipBase(
                  'udp',
                  'OUT',
                  socket.address(),
                  {
                    address: item.remoteIp,
                    port: item.remotePort
                  },
                  sentData as Buffer
                )
              }
            })
          }

          // this.event.emit('tcpData', socket, item.lastAction.payloadType, buffer.subarray(0, item.payloadLen))
        }
        item.recvState = 'header'
        item.pendingBuffer = buffer.subarray(item.payloadLen)
        if (item.pendingBuffer.length >= this.minLne) {
          this.parseDataUdp(socket, item, Buffer.alloc(0))
        }
      }
    }
  }
  async writeUdpResponse(socket: dgram.Socket, data: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      socket.send(data, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve(getTsUs() - this.startTs)
        }
      })
    })
  }
  async tcpConnect(host: string, port: number = 13400): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(port, host, () => {
        resolve(socket)
      })
      socket.on('error', (err) => {
        reject(err)
      })
    })
  }
  close() {
    // 关闭UDP服务器
    if (this.udp4Server) {
      this.udp4Server.close()
      this.udp4Server = undefined
    }

    // 关闭TCP服务器
    if (this.server) {
      this.server.close()
      this.server = undefined
    }

    // 清理 connectTable 中的所有连接
    this.connectTable.forEach((item) => {
      clearTimeout(item.inactiveTimer)
      clearTimeout(item.generalTimer)
      if (item.aliveTimer) {
        clearTimeout(item.aliveTimer.timer)
      }
      item.socket.destroy()
    })
    this.connectTable.splice(0, this.connectTable.length)

    // 关闭所有 TCP 客户端连接
    this.tcpClientMap.forEach((item) => {
      this.closeClientTcp(item)
    })
    this.tcpClientMap.clear()

    // 清理其他资源
    this.entityMap.clear()
    this.selfSentUdpInfo.length = 0
  }
  buildMessage(payloadType: PayloadType, data: Buffer): Buffer {
    const len = data.length
    const buf = Buffer.alloc(8 + len)
    buf.writeUInt8(this.version, 0)
    buf.writeUInt8(this.inverseVersion, 1)
    buf.writeUInt16BE(payloadType, 2)
    buf.writeUInt32BE(len, 4)
    data.copy(buf, 8)
    return buf
  }
  headerHandler(data: Buffer, isTcp = true): GenericHeaderAction {
    const action: GenericHeaderAction = {
      payloadType: data.readUInt16BE(2),
      payloadLength: 0,
      data: data
    }
    //Check Generic DoIP synchronization pattern
    if (((data[1] ^ 0xff) & 0xff) != data[0]) {
      //Return Error, Protocol Version not correct
      action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
      action.value = NackCode.DoIP_IncorrectPatternFormatCode
      action.payloadLength = 0
      throw action
    }
    const payloadLength = data.readUint32BE(4)
    action.payloadLength = payloadLength
    const inputPayloadType = data.readUInt16BE(2) as PayloadType
    //Check if the payload type is valid
    const valid = Object.values(PayloadType).includes(inputPayloadType)
    if (!valid) {
      //Return Error, Invalid Payload Type
      action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
      action.value = NackCode.DoIP_InvalidPayloadTypeFormatCode
      return action
    }
    const tcpType = [
      PayloadType.DoIP_RouteActivationRequest,
      PayloadType.DoIP_RouteActivationResponse,
      PayloadType.DoIP_DiagnosticMessage,
      PayloadType.DoIP_DiagnosticMessagePositiveAcknowledge,
      PayloadType.DoIP_DiagnosticMessageNegativeAcknowledge,
      PayloadType.DoIP_AliveRequest,
      PayloadType.DoIP_AliveResponse
    ]
    if (isTcp) {
      if (!tcpType.includes(inputPayloadType)) {
        return action
      }
    } else {
      if (tcpType.includes(inputPayloadType)) {
        return action
      }
    }
    if (payloadLength > this.maxProcessSize) {
      action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
      action.value = NackCode.DoIP_MessageTooLarge
      return action
    }
    //check if the payload length is valid
    switch (inputPayloadType) {
      case PayloadType.DoIP_HeaderNegativeAcknowledge:
        if (payloadLength != 1) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_VehicleIdentificationRequest:
        if (payloadLength != 0) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_VehicleIdentificationRequestWithEID:
        if (payloadLength != 6) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_VehicleIdentificationRequestWithVIN:
        if (payloadLength != 17) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_VehicleAnnouncementResponse:
        if (payloadLength != 32 && payloadLength != 33) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_RouteActivationRequest:
        if (payloadLength != 7 && payloadLength != 11) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_RouteActivationResponse:
        if (payloadLength != 9 && payloadLength != 13) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_DiagnosticMessage:
        if (payloadLength <= 4) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_DiagnosticMessagePositiveAcknowledge:
        if (payloadLength < 5) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_DiagnosticMessageNegativeAcknowledge:
        if (payloadLength < 5) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_AliveRequest:
        if (payloadLength != 0) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_AliveResponse:
        if (payloadLength != 2) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_PowerModeInfoRequest:
        if (payloadLength != 0) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_PowerModeInfoResponse:
        if (payloadLength != 1) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_EntityStateRequest:
        if (payloadLength != 0) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      case PayloadType.DoIP_EntityStateResponse:
        if (payloadLength != 3 && payloadLength != 4) {
          action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
          action.value = NackCode.DoIP_InvalidPayloadLength
          return action
        }
        break
      default:
        action.payloadType = PayloadType.DoIP_HeaderNegativeAcknowledge
        action.value = NackCode.DoIP_InvalidPayloadTypeFormatCode
    }
    return action
  }
  getId(addr: EthAddr, mode: 'client' | 'server') {
    return `${mode}-${addr.tester.testerLogicalAddr}-${addr.entity.logicalAddr}`
  }
  vehicleIdentificationHandle(payloadType: PayloadType, data: Buffer) {
    let reply = false
    if (this.ethAddr == undefined) {
      return false
    }
    if (payloadType == PayloadType.DoIP_VehicleIdentificationRequest) {
      reply = true
    } else if (payloadType == PayloadType.DoIP_VehicleIdentificationRequestWithEID) {
      const eid = data.toString('hex')
      //find entity by eid
      const a = Buffer.alloc(6)
      a.write(this.ethAddr.eid.split('-').join(''), 'hex')
      const b = Buffer.alloc(6)
      b.write(eid, 'hex')
      if (a.compare(b) == 0) {
        reply = true
      }
    } else if (payloadType == PayloadType.DoIP_VehicleIdentificationRequestWithVIN) {
      const vin = data
      const q = Buffer.from(this.ethAddr.vin.slice(0, 17), 'ascii')
      if (Buffer.compare(vin, q) == 0) {
        reply = true
      }
    }
    return reply
  }
  vehicleIdentificationConvert(data: Buffer): EntityAddr {
    const vin = data.toString('ascii', 0, 17)
    const logicalAddr = data.readUInt16BE(17)
    let eid = data.toString('hex', 19, 6)
    for (let i = 2; i < eid.length; i += 3) {
      eid = eid.slice(i - 2, i) + '-' + eid
    }
    eid = eid.slice(0, -1)
    let gid = data.toString('hex', 25, 6)
    for (let i = 2; i < gid.length; i += 3) {
      gid = gid.slice(i - 2, i) + '-' + gid
    }
    gid = gid.slice(0, -1)

    const furtherAction = data.readUInt8(31)
    let syncStatus
    if (data.length > 32) {
      syncStatus = data.readUInt8(32)
    }
    return { vin, logicalAddr, eid, gid, furtherAction, syncStatus }
  }
  getHeaderNegativeAcknowledge(code: NackCode): Buffer {
    const data = Buffer.alloc(1)
    data.writeUInt8(code & 0xff, 0)
    return this.buildMessage(PayloadType.DoIP_HeaderNegativeAcknowledge, data)
  }

  getVehicleAnnouncementResponse(ethAddr: EntityAddr): Buffer {
    const dataLen = ethAddr.sendSync ? 33 : 32
    const data = Buffer.alloc(dataLen)
    //vin
    data.write(ethAddr.vin, 0, 17, 'ascii')
    //logical address
    const naddr = Number(ethAddr.logicalAddr) & 0xffff
    data.writeUInt16BE(naddr, 17)
    //eid
    const eid = ethAddr.eid.split('-').join('')
    data.write(eid, 19, 6, 'hex')
    //gid
    const gid = ethAddr.gid.split('-').join('')
    data.write(gid, 25, 6, 'hex')
    //further action
    if (ethAddr.furtherAction != undefined) {
      data.writeUInt8(ethAddr.furtherAction & 0xff, 31)
    }
    if (ethAddr.sendSync) {
      data.writeUInt8((ethAddr.syncStatus || 0) & 0xff, 32)
    }
    return this.buildMessage(PayloadType.DoIP_VehicleAnnouncementResponse, data)
  }

  getRouteActiveResponse(sa: number, code: RouteCode, oem?: number) {
    const dataLen = oem == undefined ? 9 : 13
    const data = Buffer.alloc(dataLen, 0)
    //logical address
    const naddr = sa & 0xffff
    data.writeUInt16BE(naddr, 0)
    const eaddr = this.ethAddr!.logicalAddr & 0xffff
    data.writeUInt16BE(eaddr, 2)
    data.writeUInt8(code & 0xff, 4)
    if (oem != undefined) {
      data.writeUInt32BE(oem & 0xffffffff, 9)
    }
    return this.buildMessage(PayloadType.DoIP_RouteActivationResponse, data)
  }
  aliveCheck(startSocket: net.Socket, sa?: number) {
    const doCheck = (ta: number) => {
      const item = this.connectTable.find((item) => item.testerAddr == ta && item.state != 'init')
      if (item && !item.socket.closed) {
        const val = this.getAliveCheckRequest()
        this.log.ipBase(
          'tcp',
          'OUT',
          { address: item.socket.localAddress, port: item.socket.localPort },
          {
            address: item.socket.remoteAddress,
            port: item.socket.remotePort
          },
          val
        )
        item.socket.write(this.getAliveCheckRequest())
        item.aliveTimer = {
          socket: startSocket,
          timer: setTimeout(() => {
            this.closeSocket(item.socket, 'alive check timeout')
            const startItem = this.connectTable.find((item) => item.socket == startSocket)
            if (startItem && startItem.state == 'sa-check') {
              startItem.state = 'register-active'
            }
          }, this.aliveTimeout)
        }
      }
    }
    if (sa != undefined) {
      doCheck(sa)
    } else {
      for (const item of this.connectTable) {
        if (item.socket != startSocket && item.testerAddr != undefined) {
          doCheck(item.testerAddr)
        }
      }
    }
  }

  getAliveCheckRequest() {
    const data = Buffer.alloc(0)
    return this.buildMessage(PayloadType.DoIP_AliveRequest, data)
  }
}

export class DOIP_SOCKET {
  client?: clientTcp
  recvTimer: NodeJS.Timeout | undefined = undefined
  abortController = new AbortController()
  recvBuffer: ({ data: Buffer; ts: number } | DoipError)[] = []
  cb: any
  closed = false
  ta: number
  cbSpec: any
  eventId: string
  pendingRecv: {
    resolve: (value: { data: Buffer; ts: number }) => void
    reject: (reason: DoipError) => void
  } | null = null
  constructor(
    private doip: DOIP,
    private addr: EthAddr,
    private mode: 'client' | 'server'
  ) {
    this.mode = mode
    this.cb = this.recvHandle.bind(this)
    this.ta =
      this.addr.entity.nodeType == 'gateway'
        ? this.addr.entity.nodeAddr!
        : this.addr.entity.logicalAddr
    if (mode == 'client') {
      this.eventId = `server-${this.addr.tester.testerLogicalAddr}-${this.ta}`
    } else {
      this.eventId = `client-${this.addr.tester.testerLogicalAddr}-${this.addr.entity.logicalAddr}`
    }
    this.doip.event.on(this.eventId, this.cb)
  }
  static async create(doip: DOIP, addr: EthAddr, mode: 'client' | 'server') {
    const socket = new DOIP_SOCKET(doip, addr, mode)
    if (mode == 'client') {
      await socket.connect()
    }
    return socket
  }
  clear() {
    this.recvBuffer = []
  }
  recvHandle(val: { data: Buffer; ts: number } | DoipError) {
    if (this.pendingRecv) {
      if (this.recvTimer) {
        clearTimeout(this.recvTimer)
        this.recvTimer = undefined
      }
      if (val instanceof DoipError) {
        this.pendingRecv.reject(val)
      } else {
        this.pendingRecv.resolve(val)
      }
      this.pendingRecv = null
    } else {
      this.recvBuffer.push(val)
    }
  }
  async connect() {
    this.client = await this.doip.createClient(this.addr)
  }
  async write(data: Buffer): Promise<number> {
    if (this.mode == 'client') {
      if (this.client) {
        const r = await this.doip.writeTpReq(this.client, data, this.ta)
        return r.ts
      } else {
        throw new DoipError(DOIP_ERROR_ID.DOIP_TCP_ERROR, data, 'client not connect')
      }
    } else {
      const r = await this.doip.writeTpResp(this.addr.tester, data)
      return r.ts
    }
  }
  async read(timeout: number): Promise<{ data: Buffer; ts: number }> {
    return new Promise((resolve, reject) => {
      if (this.closed) {
        reject(new DoipError(DOIP_ERROR_ID.DOIP_CLOSE))
        return
      }
      this.abortController.signal.onabort = () => {
        reject(new DoipError(DOIP_ERROR_ID.DOIP_CLOSE))
        this.pendingRecv = null
        clearTimeout(this.recvTimer)
      }
      const val = this.recvBuffer.shift()
      if (val) {
        if (val instanceof DoipError) {
          reject(val)
        } else {
          resolve(val)
        }
      } else {
        this.pendingRecv = { resolve, reject }
        this.recvTimer = setTimeout(() => {
          if (this.pendingRecv) {
            reject(new DoipError(DOIP_ERROR_ID.DOIP_TIMEOUT_UPPER_READ))
            this.pendingRecv = null
          }
        }, timeout)
      }
    })
  }
  close() {
    //handle pending
    if (this.pendingRecv) {
      this.pendingRecv.reject(new DoipError(DOIP_ERROR_ID.DOIP_CLOSE))
      this.pendingRecv = null
    }

    // 清理 recvTimer
    if (this.recvTimer) {
      clearTimeout(this.recvTimer)
      this.recvTimer = undefined
    }

    // 清理接收缓冲区
    this.recvBuffer.length = 0

    // 如果是客户端模式，清理客户端连接
    if (this.client) {
      this.doip.closeClientTcp(this.client)
      this.client = undefined
    }

    this.doip.event.off(this.eventId, this.cb)
    this.abortController.abort()
    this.closed = true
  }
}

