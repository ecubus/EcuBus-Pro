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

/**
 * TLS configuration for DoIP v3
 * @category DOIP
 */
export interface TlsConfig {
  /** Enable TLS for TCP connection (DoIP v3) */
  enabled: boolean
  /** Path to CA certificate file for verifying peer */
  ca?: string
  /** Path to client/server certificate file */
  cert?: string
  /** Path to private key file */
  key?: string
  /** Skip certificate verification (for testing only) */
  rejectUnauthorized?: boolean
  /** TLS port, default is 3496 for DoIP v3 */
  port?: number
  enableKeyLog?: boolean
  keyLogPath?: string
}

/**
 * @category DOIP
 */
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
  /** TLS configuration for DoIP v3 */
  tls?: TlsConfig
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
