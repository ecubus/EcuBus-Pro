import type { CanInterAction } from 'src/main/share/can'
import type { UdsDevice } from 'src/main/share/uds'
import type { TesterInfo } from 'src/main/share/tester'
import type { LDF } from 'src/renderer/src/database/ldfParse'
import type { DBC } from 'src/renderer/src/database/dbc/dbcVisitor'

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
  enum?: { name: string; value: string }[]
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

export type Inter = CanInter | LinInter | PwmInter
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

export interface DataSet {
  devices: Record<string, UdsDevice>
  tester: Record<string, TesterInfo>
  subFunction: Record<string, { name: string; subFunction: string }[]>
  nodes: Record<string, NodeItem>
  ia: Record<string, Inter>
  database: {
    lin: Record<string, LDF>
    can: Record<string, DBC>
  }
  graphs: Record<string, GraphNode<GraphBindSignalValue | GraphBindVariableValue, LineSeriesOption>>
  guages: Record<
    string,
    GraphNode<GraphBindSignalValue | GraphBindVariableValue, GaugeSeriesOption>
  >
  datas: Record<string, GraphNode<GraphBindSignalValue | GraphBindVariableValue>>
  vars: Record<string, VarItem>
  panels: Record<string, PanelItem>
}

