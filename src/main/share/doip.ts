import { NetworkInterfaceInfo } from 'os'

export interface EthDevice {
  label: string
  id: string
  handle: string
  detail?: NetworkInterfaceInfo
}

export interface EthBaseInfo {
  name: string
  device: EthDevice
  vendor: string
  id: string
}

export interface EthAddr {
  name: string
  entity: EntityAddr
  tester: TesterAddr
  virReqType: 'unicast' | 'omit' | 'broadcast' | 'multicast'
  virReqAddr: string
  entityNotFoundBehavior?:
    | 'no'
    | 'normal'
    | 'withVin'
    | 'withEid'
    | 'forceNormal'
    | 'forceWithVin'
    | 'forceWithEid'
  taType: 'physical' | 'functional'
  udpClientPort?: number
  tcpClientPort?: number
}

export interface TesterAddr {
  routeActiveTime: number
  createConnectDelay: number
  testerLogicalAddr: number
}

export interface VinInfo {
  vin: string
  logicalAddr: number
  eid: string
  gid: string
}

/**
 * @category DOIP
 */
export interface EntityAddr extends VinInfo {
  nodeType?: 'node' | 'gateway'
  nodeAddr?: number
  ta?: string
  ip?: string
  mcts?: number
  ncts?: number
  mds?: number
  powerMode?: number
  localPort?: number
  sendSync?: boolean
  udpLocalPort?: number
  furtherAction?: number
  syncStatus?: number
}
