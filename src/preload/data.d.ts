import type { CanInterAction } from 'src/main/share/can'
import type { UdsDevice } from 'src/main/share/uds'
import type { TesterInfo } from 'src/main/share/tester'
import type { LDF } from 'src/renderer/src/database/ldfParse'
import type { DBC } from 'src/renderer/src/database/dbc/dbcVisitor'

import type { YAXisOption, XAXisOption, LineSeriesOption } from 'echarts/types/dist/shared'

export interface CanInter {
  type: 'can'
  id: string
  name: string
  devices: string[]
  action: CanInterAction[]
}

export interface LinInter {
  id: string
  name: string
  devices: string[]
  type: 'lin'
  action: any[]
}
export type Inter = CanInter | LinInter
export interface NodeItem {
  disabled?: boolean
  id: string
  name: string
  channel: string[]
  script?: string
  workNode?: string
}

export type GraphBindSignalValue = {
  dbName: string
  dbKey: string
  signalName: string
  frameId: number
  startBit: number
  bitLength: number
}
export type GraphBindVariableValue = {}

export type GraphBindFrameValue = {
  frameInfo: any
  dbName: string
  dbKey: string
}

export type GraphNode<T> = {
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
  series?: SeriesOption
  type: 'signal' | 'variable' | 'frame'
  bindValue: T
}
export type TestConfig = {
  id: string
  name: string
  script: string
  channel: string[]
  reportPath?: string
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
  graphs: Record<string, GraphNode>
  tests: Record<string, TestConfig>
}
