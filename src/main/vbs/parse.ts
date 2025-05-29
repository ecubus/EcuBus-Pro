import fsP from 'fs/promises'
import fs from 'fs'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
import antlr4 from 'antlr4'
import parse from './g4/parseIdl'

// 时间周期类型定义
export interface PeriodConfig {
  sec: number
  nanosec: number
}

// 支持字符串和结构化格式的时间周期
export type Period = PeriodConfig | string

// VBS XML 配置类型定义
export interface NetworkConfig {
  master: {
    address: string
    netmask: string
  }
  backup?: {
    address: string
    netmask: string
  }
}

export interface DiscoveryConfig {
  announce: {
    times: number
    period: Period
  }
  heartbeat: {
    per_samples: number
    period: Period
  }
  liveliness: {
    lease_duration: Period
    period: Period
  }
}

export interface DurabilityQos {
  kind: string
}

export interface ReliabilityQos {
  kind: string
}

export interface OwnershipQos {
  kind: string
}

export interface OwnershipStrengthQos {
  value: number
}

export interface DeadlineQos {
  period: Period
}

export interface LifespanQos {
  period: Period
}

export interface LivelinessQos {
  kind: string
  lease_duration: Period
}

export interface HistoryQos {
  kind: string
  depth?: number
  max_samples?: number
  max_instances?: number
  max_samples_per_instance?: number
}

export interface E2EPolicy {
  enable: boolean
  e2e_p04_min_data_length: number
  e2e_p04_max_data_length: number
  e2e_p04_max_delta_counter: number
}

export interface StaticPeer {
  object_id: number
  qos: string
}

export interface WriterQos {
  key: string
  durability?: DurabilityQos
  reliability?: ReliabilityQos
  ownership?: OwnershipQos
  ownership_strength?: OwnershipStrengthQos
  deadline?: DeadlineQos
  lifespan?: LifespanQos
  liveliness?: LivelinessQos
  history?: HistoryQos
  e2e_policy?: E2EPolicy
}

export interface ReaderQos {
  key: string
  durability?: DurabilityQos
  reliability?: ReliabilityQos
  ownership?: OwnershipQos
  deadline?: DeadlineQos
  liveliness?: LivelinessQos
  history?: HistoryQos
  e2e_policy?: E2EPolicy
}

export interface QosConfig {
  writer?: WriterQos | WriterQos[]
  reader?: ReaderQos | ReaderQos[]
}

export interface WriterConfig {
  key: string
  topic: string
  type: string
  qos?: string
  object_id?: number
  max_remote_peers?: number
  net_redundancy?: boolean
  enabled?: boolean
  static_peers?: StaticPeer | StaticPeer[]
}

export interface ReaderConfig {
  key: string
  topic: string
  type: string
  qos?: string
  object_id?: number
  max_remote_peers?: number
  net_redundancy?: boolean
  enabled?: boolean
  static_peers?: StaticPeer | StaticPeer[]
}

export interface ParticipantConfig {
  name: string
  domain_id: number
  discovery?: string
  max_remote_participants?: number
  preferred_remote_participant?: string
  local_rx_buffer?: number
  udp_rx_buffer?: number
  check_crc?: boolean
  writer?: WriterConfig | WriterConfig[]
  reader?: ReaderConfig | ReaderConfig[]
  writers?: WriterConfig | WriterConfig[]
  readers?: ReaderConfig | ReaderConfig[]
}

export interface VBSXml {
  idl: string | string[]
  network?: NetworkConfig
  discovery?: DiscoveryConfig
  qos?: QosConfig
  participant: ParticipantConfig | ParticipantConfig[]
}

export async function parseXml(filePath: string): Promise<VBSXml> {
  if (fs.existsSync(filePath)) {
    const content = await fsP.readFile(filePath, 'utf-8')
    const parser = new XMLParser()
    const vbs = parser.parse(content).dds
    if (vbs) {
      return vbs as VBSXml
    } else {
      throw new Error(`dds root doesn't exist`)
    }
  } else {
    throw new Error(`${filePath} doesn't exits`)
  }
}

export async function parseIdl(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = await fsP.readFile(filePath, 'utf-8')
    return parse(content)
  } else {
    throw new Error(`${filePath} doesn't exits`)
  }
}
