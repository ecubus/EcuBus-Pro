// OSEK ORTI (OSEK Run Time Interface) TypeScript Interfaces and Parser
// 基于实际 ORTI 文件格式重新设计，使用 Chevrotain 解析器

import { ORTILexer } from './lexer'
import { ortiParser } from './parser'
import { ortiVisitor } from './visitor'

/**
 * 版本信息
 */
export interface ORTIVersion {
  koil: string // KOIL 版本，如 "2.2"
  osSemantics: {
    type: string // 如 "ORTI"
    version: string // 如 "2.2"
  }
}

/**
 * CTYPE 数据类型定义
 */
export interface CType {
  type: string // 如 "int", "unsigned short", "unsigned char *"
  variableName: string // 变量名
  description: string // 描述信息
  isArray?: boolean // 是否为数组
}

/**
 * 枚举类型定义
 */
export interface ORTIEnum {
  name: string // 枚举类型名，如 "Os_CoreIdType"
  type?: string // 基础类型，如 "unsigned char"
  values: { [key: string]: string | number } // 枚举值映射
  variableName?: string // 关联的变量名
  description: string // 描述信息
  isArray?: boolean // 是否为数组
  totrace?: boolean // 是否为 TOTRACE 类型
}

/**
 * 任务状态枚举
 */
export enum ORTITaskState {
  WAITING = 0,
  READY = 1,
  SUSPENDED = 2,
  RUNNING = 3,
  START = 4
}

/**
 * 任务类型枚举
 */
export enum ORTITaskType {
  BASIC = 'BASIC',
  EXTENDED = 'EXTENDED'
}

/**
 * 调度类型枚举
 */
export enum ORTIScheduleType {
  FULL = 'FULL',
  NON = 'NON'
}

/**
 * OS 实现定义
 */
export interface ORTIImplementation {
  name: string // 实现名称，如 "ISoft_ORTI"

  // OS 部分定义
  os: {
    coreNum: CType
    coreId: ORTIEnum
    runningTask: ORTIEnum
    runningTaskPriority: CType
    runningIsr2: ORTIEnum
    serviceTrace: ORTIEnum
    lastError: ORTIEnum
    currentAppMode: ORTIEnum
  }

  // TASK 部分定义
  task: {
    priority: CType
    state: ORTIEnum
    stack: ORTIEnum
    remainingActivations: CType
    homePriority: CType
    taskType: CType
    schedule: CType
    maxActivations: CType
  }

  // STACK 部分定义
  stack: {
    size: CType
    baseAddress: CType
    stackDirection: CType
    fillPattern: CType
  }

  // ALARM 部分定义
  alarm: {
    alarmTime: CType
    cycleTime: CType
    state: ORTIEnum
    action: CType
    counter: CType
  }

  // RESOURCE 部分定义
  resource: {
    state: ORTIEnum
    locker: ORTIEnum
    priority: CType
  }

  // ISR 部分定义 (vs_ISR)
  isr: {
    priority: CType
    type: CType
    state: ORTIEnum
  }

  // CONFIG 部分定义 (vs_CONFIG)
  config: {
    scalabilityClass: CType
    statusLevel: CType
  }
}

/**
 * 任务实例
 */
export interface ORTITaskInstance {
  name: string
  priority: string // 变量引用，如 "Os_TCBCore0[0].taskRunPrio"
  state: string // 变量引用，如 "Os_TCBCore0[0].taskState"
  stack: string // 栈引用，如 "&taskStack_iSoft_Auto_OsTask_10ms_BSW"
  remainingActivations: string // 变量引用

  // 静态属性
  homePriority: string // 如 "2"
  taskType: ORTITaskType
  schedule: ORTIScheduleType
  maxActivations: string // 如 "1"
}

/**
 * 栈实例
 */
export interface ORTIStackInstance {
  name: string
  size: string // 如 "1024"
  stackDirection: string // 如 "DOWN"
  baseAddress: string // 如 "&Os_iSoft_Auto_OsTask_10ms_BSW_Stack"
  fillPattern: string // 如 "0xCCCCCCCC"
}

/**
 * 资源实例
 */
export interface ORTIResourceInstance {
  name: string
  state: string // 变量引用
  locker: string // 变量引用
  priority: string // 如 "3"
}

/**
 * 报警器实例
 */
export interface ORTIAlarmInstance {
  name: string
  alarmTime: string // 变量引用
  cycleTime: string // 变量引用
  state: string // 变量引用
  action: string // 如 "ActivateTask(iSoft_Auto_OsTask_100ms)"
  counter: string // 如 "SystemTimer_Core_0"
}

/**
 * ISR 实例
 */
export interface ORTIIsrInstance {
  name: string
  priority: string // 如 "199"
  type: string // 如 "CATEGORY_2"
  state: string // 变量引用
}

/**
 * 配置实例
 */
export interface ORTIConfigInstance {
  name: string
  scalabilityClass: string // 如 "SC1"
  statusLevel: string // 如 "STANDARD"
}

/**
 * OS 实例（Information Section）
 */
export interface ORTIosInstance {
  name: string // 如 "ISoft_TC397"
  coreNum: number // 核心数量

  // 多核系统的数组映射
  coreConfigs: Array<{
    coreIndex: number
    coreId: string // 变量引用
    runningTask: string // 变量引用
    runningTaskPriority: string // 变量引用
    runningIsr2: string // 变量引用
    serviceTrace: string // 变量引用
    lastError: string // 变量引用
    currentAppMode: string // 变量引用
  }>
}

/**
 * 解析错误信息
 */
export interface ORTIParseError {
  message: string
  line?: number
  column?: number
  token?: string
  context?: string
}

/**
 * 解析结果
 */
export interface ORTIParseResult {
  success: boolean
  data?: ORTIFile
  errors: ORTIParseError[]
  warnings: string[]
}

/**
 * 完整的 ORTI 文件结构
 */
export interface ORTIFile {
  // 版本段
  version: ORTIVersion

  // 声明段 (Declaration Section)
  implementation: ORTIImplementation

  // 信息段 (Information Section)
  osInstance: ORTIosInstance

  // 对象实例
  tasks: ORTITaskInstance[]
  stacks: ORTIStackInstance[]
  resources: ORTIResourceInstance[]
  alarms: ORTIAlarmInstance[]
  isrs: ORTIIsrInstance[]
  configs: ORTIConfigInstance[]
}

/**
 * 解析 ORTI 文件内容
 * @param input ORTI 文件内容字符串
 * @returns 解析结果
 */
export function parseORTI(input: string): ORTIParseResult {
  const result: ORTIParseResult = {
    success: false,
    errors: [],
    warnings: []
  }

  try {
    // 词法分析
    const lexingResult = ORTILexer.tokenize(input)

    if (lexingResult.errors.length > 0) {
      result.errors.push(
        ...lexingResult.errors.map((error) => ({
          message: error.message,
          line: error.line,
          column: error.column,
          context: 'Lexical Analysis'
        }))
      )
    }

    // 语法分析
    ortiParser.input = lexingResult.tokens
    const cst = ortiParser.ortiFile()

    if (ortiParser.errors.length > 0) {
      result.errors.push(
        ...ortiParser.errors.map((error) => ({
          message: error.message,
          line: error.token?.startLine,
          column: error.token?.startColumn,
          token: error.token?.image,
          context: 'Syntax Analysis'
        }))
      )
    }

    // 如果有严重错误，停止处理
    if (result.errors.length > 0) {
      return result
    }

    // 语义分析和 AST 构建
    const ortiFile = ortiVisitor.visit(cst) as ORTIFile

    result.success = true
    result.data = ortiFile

    return result
  } catch (error) {
    result.errors.push({
      message: error instanceof Error ? error.message : 'Unknown parsing error',
      context: 'Parser Exception'
    })
    return result
  }
}
