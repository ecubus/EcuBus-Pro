import type { CanInterAction } from 'src/main/share/can'
import type { Param, UdsDevice } from 'src/main/share/uds'
import type { TesterInfo } from 'src/main/share/tester'
import type { LDF } from 'src/renderer/src/database/ldfParse'
import type { DBC } from 'src/renderer/src/database/dbc/dbcVisitor'
import type { SomeipInfo, SomeipMessageType } from 'nodeCan/someip'
import type { ORTIFile } from 'src/renderer/src/database/ortiParse'

import type { YAXisOption, XAXisOption, LineSeriesOption, GaugeSeriesOption } from 'echarts'

export interface CanInter {
  type: 'can'
  id: string
  name: string
  devices: string[]
  action: CanInterAction[]
}

export interface VarValueNumber {
  type: 'number'
  value?: number
  initValue?: number
  min?: number
  max?: number
  unit?: string
  enum?: { name: string; value: number }[]
}
export interface VarValueString {
  type: 'string'
  value?: string
  initValue?: string
}

export interface VarValueArray {
  type: 'array'
  value?: number[]
  initValue?: number[]
}

export interface VarItem {
  type: 'user' | 'system'
  id: string
  name: string
  desc?: string
  value?: VarValueNumber | VarValueString | VarValueArray
  parentId?: string
}

export interface LinInter {
  id: string
  name: string
  devices: string[]
  type: 'lin'
  action: any[]
}

export interface PwmInter {
  id: string
  name: string
  devices: string[]
  type: 'pwm'
  action: any[]
}

export interface SomeipAction {
  uuid: string
  trigger: {
    type: 'manual' | 'periodic'
    period?: number
    onKey?: string
  }
  reliable?: boolean
  name: string
  database?: string
  serviceId: string
  instanceId: string
  methodId: string
  protocolVersion?: number
  interfaceVersion?: number
  channel: string
  messageType: SomeipMessageType
  params: Param[]
  respParams: Param[]
  major?: number
  minor?: number
}

export interface SomeipInter {
  id: string
  name: string
  devices: string[]
  type: 'someip'
  action: SomeipAction[]
}

export type Inter = CanInter | LinInter | PwmInter | SomeipInter
export interface NodeItem {
  disabled?: boolean
  id: string
  name: string
  channel: string[]
  script?: string
  workNode?: string
  isTest?: boolean
  reportPath?: string
}

export type GraphBindSignalValue = {
  dbName: string
  dbKey: string
  signalName: string
  frameId: number
  startBit: number
  bitLength: number
  stringRange?: { name: string; value: number }[]
}

export type GraphBindFrameValue = {
  frameInfo: any
  dbName: string
  dbKey: string
}
export type GraphBindVariableValue = {
  variableId: string
  variableType: 'user' | 'system'
  variableName: string
  variableFullName: string
  variableValueType?: 'number' | 'string' | 'array'
  stringRange?: { name: string; value: number }[]
}

export type GraphNode<T, S = any> = {
  enable: boolean
  id: string
  name: string
  color: string
  graph?: {
    id: string
  }
  disZoom?: boolean
  yAxis?: YAXisOption
  xAxis?: XAXisOption
  tooltip?: {
    show: boolean
  }
  series?: S
  type: 'signal' | 'variable' | 'frame'
  bindValue: T
}

export type PanelItem = {
  id: string
  name: string
  rule: any[]
  options: Object
}

export type LogItem = {
  disabled?: boolean
  id: string
  name: string
  type: 'file'
  format: string
  path: string
  channel: string[]
  method: string[]
  compression?: number
}

export type TraceItem = {
  id: string
  name: string
  filter?: string[]
  filterDevice?: string[]
  filterId?: string[]
}

/**
 * Supported replay file formats
 */
export type ReplayFileFormat = 'blf' | 'asc' | 'csv' | 'trc' | 'log' | 'mf4'

/**
 * Replay mode - online with hardware or offline simulation
 */
export type ReplayMode = 'online' | 'offline'

/**
 * Replay item configuration for replaying BLF, ASC, and other log files
 */
/**
 * Channel mapping from log file channel to device channels
 */
export type ReplayChannelMap = {
  /** Channel number/index in the log file */
  logChannel: number
  /** Device IDs to replay to (supports multiple targets) */
  deviceIds: string[]
}

export type ReplayItem = {
  id: string
  name: string
  disabled?: boolean
  /** File path to the replay file */
  filePath: string
  /** File format (auto-detected if not specified) */
  format?: ReplayFileFormat
  /** Target channels to replay to */
  channel: string[]
  /**
   * Channel mapping from log file to connected devices
   * Maps log file channel numbers to device IDs
   */
  channelMap?: ReplayChannelMap[]
  /**
   * Replay mode
   * - 'online': Replay to actual hardware devices (real-time transmission)
   * - 'offline': Simulation mode for analysis without hardware
   */
  mode: ReplayMode
  /**
   * Speed factor for replay
   * 1.0 = original speed, 2.0 = 2x speed, 0.5 = half speed, 0 = as fast as possible
   */
  speedFactor?: number
  /**
   * Number of times to repeat the replay
   * undefined/1 = play once, 0 = infinite loop
   */
  repeatCount?: number
}

export interface DataSet {
  devices: Record<string, UdsDevice>
  tester: Record<string, TesterInfo>
  subFunction: Record<string, { name: string; subFunction: string }[]>
  nodes: Record<string, NodeItem>
  ia: Record<string, Inter>
  database: {
    lin: Record<string, LDF>
    can: Record<string, DBC>
    orti: Record<string, ORTIFile>
  }
  graphs: Record<string, GraphNode<GraphBindSignalValue | GraphBindVariableValue, LineSeriesOption>>
  guages: Record<
    string,
    GraphNode<GraphBindSignalValue | GraphBindVariableValue, GaugeSeriesOption>
  >
  datas: Record<string, GraphNode<GraphBindSignalValue | GraphBindVariableValue>>
  vars: Record<string, VarItem>
  panels: Record<string, PanelItem>
  logs: Record<string, LogItem>
  traces: Record<string, TraceItem>
  replays: Record<string, ReplayItem>
  pluginData: Record<string, any>
}
