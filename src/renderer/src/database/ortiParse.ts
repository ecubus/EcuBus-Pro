// OSEK ORTI (OSEK Run Time Interface) TypeScript Interfaces and Parser
// 基于实际 ORTI 文件格式重新设计，使用 Chevrotain 解析器

import { ORTILexer } from './orti/lexer'
import { ortiParser } from './orti/parser'
import { ortiVisitor } from './orti/visitor'
import { i18next } from '@r/i18n'

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
    RUNNINGTASK: ORTIEnum
    RUNNINGTASKPRIORITY: CType
    RUNNINGISR2: ORTIEnum
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
  id: string
  name: string
  // connector
  connector?: {
    type: string
    device: string
    options: Record<string, string>
  }
  recordFile?: {
    enable: boolean
    name: string
  }
  cpuFreq: number
  coreConfigs: {
    coreId: number
    isIdle?: boolean
    id: number
    type: number
    name: string
    color: string
    activeInterval?: number
  }[]
  resourceConfigs: {
    coreId: number
    id: number
    name: string
  }[]
  serviceConfigs: {
    id: number
    name: string
  }[]
  hostConfigs: {
    id: number
    name: string
  }[]
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
          context: i18next.t('database.ortiParse.errors.lexicalAnalysis')
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
          context: i18next.t('database.ortiParse.errors.syntaxAnalysis')
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

    //parse coreConfigs
    if (ortiFile.tasks) {
      for (const task of ortiFile.tasks) {
        const randomColor = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)})`
        //like IS_TCBCore0[10].taskState, Os_TCBCore_0[10], xxxxcore_0[10]zzz, or core0[5]
        const string = task.state.toLowerCase().trim()
        // Extract coreid: match "core_123" or "core123" format
        const coreIdRegex = /core_?(\d+)/
        // Extract taskid: match number inside brackets [123]
        const taskIdRegex = /\[(\d+)\]/

        const coreMatch = string.match(coreIdRegex)
        const taskMatch = string.match(taskIdRegex)

        const coreId = coreMatch ? parseInt(coreMatch[1]) : 0
        const taskId = taskMatch ? parseInt(taskMatch[1]) : 0

        ortiFile.coreConfigs.push({
          id: taskId,
          name: task.name,
          coreId: coreId,
          type: 0,
          color: randomColor
        })
      }
    }
    if (ortiFile.isrs) {
      for (const isr of ortiFile.isrs) {
        const string = isr.state.toLowerCase().trim()
        const coreIdRegex = /core_?(\d+)/
        const taskIdRegex = /\[(\d+)\]/
        const coreMatch = string.match(coreIdRegex)
        const taskIdMatch = string.match(taskIdRegex)

        const coreId = coreMatch ? parseInt(coreMatch[1]) : 0
        const taskId = taskIdMatch ? parseInt(taskIdMatch[1]) : 0

        const randomColor = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)})`
        ortiFile.coreConfigs.push({
          id: taskId,
          name: isr.name,
          coreId: coreId,
          type: 1,
          color: randomColor
        })
      }
    }
    //parse resourceConfigs
    if (ortiFile.resources) {
      for (const resource of ortiFile.resources) {
        const string = resource.state.toLowerCase().trim()
        const coreIdRegex = /core_?(\d+)/
        const taskIdRegex = /\[(\d+)\]/
        const coreMatch = string.match(coreIdRegex)
        const taskIdMatch = string.match(taskIdRegex)

        const coreId = coreMatch ? parseInt(coreMatch[1]) : 0
        const taskId = taskIdMatch ? parseInt(taskIdMatch[1]) : 0

        ortiFile.resourceConfigs.push({
          id: taskId,
          name: resource.name,
          coreId: coreId
        })
      }
    }

    //parse serviceConfigs
    const defaultServiceConfigs = [
      {
        id: 0,
        name: 'GetApplicationID Start'
      },
      {
        id: 1,
        name: 'GetApplicationID Return'
      },
      {
        id: 2,
        name: 'GetISRID Start'
      },
      {
        id: 3,
        name: 'GetISRID Return'
      },
      {
        id: 4,
        name: 'CallTrustedFunction Start'
      },
      {
        id: 5,
        name: 'CallTrustedFunction Return'
      },
      {
        id: 6,
        name: 'CheckISRMemoryAccess Start'
      },
      {
        id: 7,
        name: 'CheckISRMemoryAccess Return'
      },
      {
        id: 8,
        name: 'CheckTaskMemoryAccess Start'
      },
      {
        id: 9,
        name: 'CheckTaskMemoryAccess Return'
      },
      {
        id: 10,
        name: 'CheckObjectAccess Start'
      },
      {
        id: 11,
        name: 'CheckObjectAccess Return'
      },
      {
        id: 12,
        name: 'CheckObjectOwnership Start'
      },
      {
        id: 13,
        name: 'CheckObjectOwnership Return'
      },
      {
        id: 14,
        name: 'StartScheduleTableRel Start'
      },
      {
        id: 15,
        name: 'StartScheduleTableRel Return'
      },
      {
        id: 16,
        name: 'StartScheduleTableAbs Start'
      },
      {
        id: 17,
        name: 'StartScheduleTableAbs Return'
      },
      {
        id: 18,
        name: 'StopScheduleTable Start'
      },
      {
        id: 19,
        name: 'StopScheduleTable Return'
      },
      {
        id: 20,
        name: 'NextScheduleTable Start'
      },
      {
        id: 21,
        name: 'NextScheduleTable Return'
      },
      {
        id: 22,
        name: 'StartScheduleTableSynchron Start'
      },
      {
        id: 23,
        name: 'StartScheduleTableSynchron Return'
      },
      {
        id: 24,
        name: 'SyncScheduleTable Start'
      },
      {
        id: 25,
        name: 'SyncScheduleTable Return'
      },
      {
        id: 26,
        name: 'SetScheduleTableAsync Start'
      },
      {
        id: 27,
        name: 'SetScheduleTableAsync Return'
      },
      {
        id: 28,
        name: 'GetScheduleTableStatus Start'
      },
      {
        id: 29,
        name: 'GetScheduleTableStatus Return'
      },
      {
        id: 30,
        name: 'IncrementCounter Start'
      },
      {
        id: 31,
        name: 'IncrementCounter Return'
      },
      {
        id: 32,
        name: 'GetCounterValue Start'
      },
      {
        id: 33,
        name: 'GetCounterValue Return'
      },
      {
        id: 34,
        name: 'GetElapsedValue Start'
      },
      {
        id: 35,
        name: 'GetElapsedValue Return'
      },
      {
        id: 36,
        name: 'TerminateApplication Start'
      },
      {
        id: 37,
        name: 'TerminateApplication Return'
      },
      {
        id: 38,
        name: 'AllowAccess Start'
      },
      {
        id: 39,
        name: 'AllowAccess Return'
      },
      {
        id: 40,
        name: 'GetApplicationState Start'
      },
      {
        id: 41,
        name: 'GetApplicationState Return'
      },
      {
        id: 42,
        name: 'GetNumberOfActivatedCores Start'
      },
      {
        id: 43,
        name: 'GetNumberOfActivatedCores Return'
      },
      {
        id: 44,
        name: 'GetCoreID Start'
      },
      {
        id: 45,
        name: 'GetCoreID Return'
      },
      {
        id: 46,
        name: 'StartCore Start'
      },
      {
        id: 47,
        name: 'StartCore Return'
      },
      {
        id: 48,
        name: 'StartNonAutosarCore Start'
      },
      {
        id: 49,
        name: 'StartNonAutosarCore Return'
      },
      {
        id: 50,
        name: 'GetSpinlock Start'
      },
      {
        id: 51,
        name: 'GetSpinlock Return'
      },
      {
        id: 52,
        name: 'ReleaseSpinlock Start'
      },
      {
        id: 53,
        name: 'ReleaseSpinlock Return'
      },
      {
        id: 54,
        name: 'TryToGetSpinlock Start'
      },
      {
        id: 55,
        name: 'TryToGetSpinlock Return'
      },
      {
        id: 56,
        name: 'ShutdownAllCores Start'
      },
      {
        id: 57,
        name: 'ShutdownAllCores Return'
      },
      {
        id: 58,
        name: 'ControlIdle Start'
      },
      {
        id: 59,
        name: 'ControlIdle Return'
      },
      {
        id: 60,
        name: 'IocSend Start'
      },
      {
        id: 61,
        name: 'IocSend Return'
      },
      {
        id: 62,
        name: 'IocWrite Start'
      },
      {
        id: 63,
        name: 'IocWrite Return'
      },
      {
        id: 64,
        name: 'IocSendGroup Start'
      },
      {
        id: 65,
        name: 'IocSendGroup Return'
      },
      {
        id: 66,
        name: 'IocWriteGroup Start'
      },
      {
        id: 67,
        name: 'IocWriteGroup Return'
      },
      {
        id: 68,
        name: 'IocReceive Start'
      },
      {
        id: 69,
        name: 'IocReceive Return'
      },
      {
        id: 70,
        name: 'IocRead Start'
      },
      {
        id: 71,
        name: 'IocRead Return'
      },
      {
        id: 72,
        name: 'IocReceiveGroup Start'
      },
      {
        id: 73,
        name: 'IocReceiveGroup Return'
      },
      {
        id: 74,
        name: 'IocReadGroup Start'
      },
      {
        id: 75,
        name: 'IocReadGroup Return'
      },
      {
        id: 76,
        name: 'IocEmptyQueue Start'
      },
      {
        id: 77,
        name: 'IocEmptyQueue Return'
      },
      {
        id: 78,
        name: 'GetCurrentApplicationID Start'
      },
      {
        id: 79,
        name: 'GetCurrentApplicationID Return'
      },
      {
        id: 80,
        name: 'ReadPeripheral8 Start'
      },
      {
        id: 81,
        name: 'ReadPeripheral8 Return'
      },
      {
        id: 82,
        name: 'ReadPeripheral16 Start'
      },
      {
        id: 83,
        name: 'ReadPeripheral16 Return'
      },
      {
        id: 84,
        name: 'ReadPeripheral32 Start'
      },
      {
        id: 85,
        name: 'ReadPeripheral32 Return'
      },
      {
        id: 86,
        name: 'WritePeripheral8 Start'
      },
      {
        id: 87,
        name: 'WritePeripheral8 Return'
      },
      {
        id: 88,
        name: 'WritePeripheral16 Start'
      },
      {
        id: 89,
        name: 'WritePeripheral16 Return'
      },
      {
        id: 90,
        name: 'WritePeripheral32 Start'
      },
      {
        id: 91,
        name: 'WritePeripheral32 Return'
      },
      {
        id: 92,
        name: 'ModifyPeripheral8 Start'
      },
      {
        id: 93,
        name: 'ModifyPeripheral8 Return'
      },
      {
        id: 94,
        name: 'ModifyPeripheral32 Start'
      },
      {
        id: 95,
        name: 'ModifyPeripheral32 Return'
      },
      {
        id: 96,
        name: 'DisableInterruptSource Start'
      },
      {
        id: 97,
        name: 'DisableInterruptSource Return'
      },
      {
        id: 98,
        name: 'EnableInterruptSource Start'
      },
      {
        id: 99,
        name: 'EnableInterruptSource Return'
      },
      {
        id: 100,
        name: 'ClearPendingInterrupt Start'
      },
      {
        id: 101,
        name: 'ClearPendingInterrupt Return'
      },
      {
        id: 102,
        name: 'ActivateTaskAsyn Start'
      },
      {
        id: 103,
        name: 'ActivateTaskAsyn Return'
      },
      {
        id: 104,
        name: 'SetEventAsyn Start'
      },
      {
        id: 105,
        name: 'SetEventAsyn Return'
      },
      {
        id: 106,
        name: 'ModifyPeripheral16 Start'
      },
      {
        id: 107,
        name: 'ModifyPeripheral16 Return'
      },
      {
        id: 108,
        name: 'WaitAllEvents Start'
      },
      {
        id: 109,
        name: 'WaitAllEvents Return'
      },
      {
        id: 110,
        name: 'IocCallBackNotify Start'
      },
      {
        id: 111,
        name: 'IocCallBackNotify Return'
      },
      {
        id: 112,
        name: 'ActivateTask Start'
      },
      {
        id: 113,
        name: 'ActivateTask Return'
      },
      {
        id: 114,
        name: 'TerminateTask Start'
      },
      {
        id: 115,
        name: 'TerminateTask Return'
      },
      {
        id: 116,
        name: 'ChainTask Start'
      },
      {
        id: 117,
        name: 'ChainTask Return'
      },
      {
        id: 118,
        name: 'Schedule Start'
      },
      {
        id: 119,
        name: 'Schedule Return'
      },
      {
        id: 120,
        name: 'GetTaskID Start'
      },
      {
        id: 121,
        name: 'GetTaskID Return'
      },
      {
        id: 122,
        name: 'GetTaskState Start'
      },
      {
        id: 123,
        name: 'GetTaskState Return'
      },
      {
        id: 124,
        name: 'EnableAllInterrupts Start'
      },
      {
        id: 125,
        name: 'EnableAllInterrupts Return'
      },
      {
        id: 126,
        name: 'DisableAllInterrupts Start'
      },
      {
        id: 127,
        name: 'DisableAllInterrupts Return'
      },
      {
        id: 128,
        name: 'ResumeAllInterrupts Start'
      },
      {
        id: 129,
        name: 'ResumeAllInterrupts Return'
      },
      {
        id: 130,
        name: 'SuspendAllInterrupts Start'
      },
      {
        id: 131,
        name: 'SuspendAllInterrupts Return'
      },
      {
        id: 132,
        name: 'ResumeOSInterrupts Start'
      },
      {
        id: 133,
        name: 'ResumeOSInterrupts Return'
      },
      {
        id: 134,
        name: 'SuspendOSInterrupts Start'
      },
      {
        id: 135,
        name: 'SuspendOSInterrupts Return'
      },
      {
        id: 136,
        name: 'GetResource Start'
      },
      {
        id: 137,
        name: 'GetResource Return'
      },
      {
        id: 138,
        name: 'ReleaseResource Start'
      },
      {
        id: 139,
        name: 'ReleaseResource Return'
      },
      {
        id: 140,
        name: 'SetEvent Start'
      },
      {
        id: 141,
        name: 'SetEvent Return'
      },
      {
        id: 142,
        name: 'ClearEvent Start'
      },
      {
        id: 143,
        name: 'ClearEvent Return'
      },
      {
        id: 144,
        name: 'GetEvent Start'
      },
      {
        id: 145,
        name: 'GetEvent Return'
      },
      {
        id: 146,
        name: 'WaitEvent Start'
      },
      {
        id: 147,
        name: 'WaitEvent Return'
      },
      {
        id: 148,
        name: 'GetAlarmBase Start'
      },
      {
        id: 149,
        name: 'GetAlarmBase Return'
      },
      {
        id: 150,
        name: 'GetAlarm Start'
      },
      {
        id: 151,
        name: 'GetAlarm Return'
      },
      {
        id: 152,
        name: 'SetRelAlarm Start'
      },
      {
        id: 153,
        name: 'SetRelAlarm Return'
      },
      {
        id: 154,
        name: 'SetAbsAlarm Start'
      },
      {
        id: 155,
        name: 'SetAbsAlarm Return'
      },
      {
        id: 156,
        name: 'CancelAlarm Start'
      },
      {
        id: 157,
        name: 'CancelAlarm Return'
      },
      {
        id: 158,
        name: 'GetActiveApplicationMode Start'
      },
      {
        id: 159,
        name: 'GetActiveApplicationMode Return'
      },
      {
        id: 160,
        name: 'StartOS Start'
      },
      {
        id: 161,
        name: 'StartOS Return'
      },
      {
        id: 162,
        name: 'ShutdownOS Start'
      },
      {
        id: 163,
        name: 'ShutdownOS Return'
      }
    ]
    ortiFile.serviceConfigs = defaultServiceConfigs
    //parse hookconfigs
    const defaultHookConfigs = [
      {
        id: 0,
        name: 'ErrorHook Start'
      },
      {
        id: 1,
        name: 'ErrorHook Return'
      },
      {
        id: 2,
        name: 'PostTaskHook Start'
      },
      {
        id: 3,
        name: 'PostTaskHook Return'
      },
      {
        id: 4,
        name: 'PreTaskHook Start'
      },
      {
        id: 5,
        name: 'PreTaskHook Return'
      },
      {
        id: 6,
        name: 'ProtectionHook Start'
      },
      {
        id: 7,
        name: 'ProtectionHook Return'
      },
      {
        id: 8,
        name: 'StartupHook Start'
      },
      {
        id: 9,
        name: 'StartupHook Return'
      },
      {
        id: 10,
        name: 'ShutdownHook Start'
      },
      {
        id: 11,
        name: 'ShutdownHook Return'
      }
    ]
    ortiFile.hostConfigs = defaultHookConfigs

    return result
  } catch (error) {
    result.errors.push({
      message:
        error instanceof Error
          ? error.message
          : i18next.t('database.ortiParse.errors.unknownParsingError'),
      context: i18next.t('database.ortiParse.errors.parserException')
    })
    return result
  }
}
