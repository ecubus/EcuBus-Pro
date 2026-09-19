import type { GraphBindSignalValue, GraphBindVariableValue, GraphNode } from './data'

export type PanelBinding =
  | { kind: 'signal'; node: GraphNode<GraphBindSignalValue> }
  | { kind: 'variable'; node: GraphNode<GraphBindVariableValue> }

export type PanelControlType =
  | 'text'
  | 'display'
  | 'number'
  | 'input'
  | 'path'
  | 'checkbox'
  | 'radio'
  | 'button'
  | 'startStop'
  | 'switch'
  | 'led'
  | 'slider'
  | 'select'
  | 'progress'
  | 'gauge'
  | 'html'
  | 'image'
  | 'group'
  | 'tabs'

export type PanelLabelPosition = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'hidden'

export interface PanelControl {
  id: string
  type: PanelControlType
  label: string
  labelPosition?: PanelLabelPosition
  x: number
  y: number
  width: number
  height: number
  locked: boolean
  fontSize: number
  color: string
  unit: string
  min: number
  max: number
  step: number
  initialValue: number
  pressValue: number
  releaseValue: number
  toggle: boolean
  buttonShape?: 'rectangle' | 'rounded' | 'circle'
  buttonVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  buttonPlain?: boolean
  buttonAction?: 'write' | 'openFile' | 'openPanel' | 'start' | 'stop'
  actionPath?: string
  actionPanelId?: string
  pathMode?: 'file' | 'directory' | 'save'
  initialText?: string
  editorMode?: 'text' | 'hex' | 'both'
  ledShape?: 'ellipse' | 'rectangle' | 'up' | 'down' | 'left' | 'right'
  ledOnColor?: string
  ledOffColor?: string
  ledFrame?: boolean
  ledKeepAspect?: boolean
  numberFormat?: 'decimal' | 'hex' | 'binary'
  numberDecimals?: number
  numberShowUnit?: boolean
  numberShowRange?: boolean
  numberValueType?: 'raw' | 'physical'
  alarmMode?: 'none' | 'limits'
  alarmLower?: number
  alarmUpper?: number
  alarmLowerColor?: string
  alarmUpperColor?: string
  readOnly: boolean
  options: { label: string; value: number }[]
  binding?: PanelBinding
  imageSrc?: string
  imageFit?: 'contain' | 'cover' | 'fill'
  htmlContent?: string
  scriptContent?: string
  parentId?: string
  tabId?: string
  tabs?: { id: string; label: string }[]
  defaultTabId?: string
  progressDirection?: 'right' | 'left' | 'up' | 'down'
  progressText?: 'value' | 'percent' | 'hidden'
  progressValuePosition?: 'hidden' | 'left' | 'top' | 'right' | 'bottom'
  progressDecimals?: number
  progressShowLimits?: boolean
  progressOrigin?: number
}

export interface PanelDocument {
  schemaVersion: 2
  width: number
  height: number
  controls: PanelControl[]
}
