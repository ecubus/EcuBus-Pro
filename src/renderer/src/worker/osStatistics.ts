import { OsEvent, TaskType, TaskStatus, IsrStatus, ResourceStatus } from 'nodeCan/osEvent'
import type { ORTIFile } from '../database/ortiParse'

// 时间窗口配置 - 记录每个时间点的执行时间片段
interface TimeWindow {
  timestamp: number // 时间戳
  executionTime: number // 该时间点的执行时间
}

// Task internal state (用于事件处理)
interface TaskState {
  id: number
  coreId: number
  currentStatus: TaskStatus
  previousStatus?: TaskStatus // 用于状态转换验证
  activeCount: number
  fakeActiveInterval?: number
  startCount: number

  lastActiveTime?: number
  lastStartTime?: number

  activationIntervalSum: number
  activationIntervalCount: number
  activationIntervalMin: number
  activationIntervalMax: number
  activationIntervalCurrent: number

  // Jitter统计
  jitterMax: number
  jitterMin: number
  currentJitter: number

  delayTimeSum: number
  delayTimeCount: number
  delayTimeMin: number
  delayTimeMax: number

  currentExecutionStartTime?: number
  currentExecutionAccumulated: number
  isInExecution: boolean
  hasStartedInCurrentCycle: boolean

  // 任务执行时间统计（不包括被中断的时间）
  executionTimeSum: number
  executionTimeCount: number
  executionTimeMin: number
  executionTimeMax: number
}

// ISR internal state
interface IsrState {
  id: number
  coreId: number
  currentStatus: IsrStatus
  runCount: number

  executionTimeSum: number
  executionTimeCount: number
  executionTimeMin: number
  executionTimeMax: number

  callIntervalSum: number
  callIntervalCount: number
  callIntervalMin: number
  callIntervalMax: number

  executionStartTime?: number
  lastCallTime?: number
  // Accumulated execution time when ISR is interrupted by another ISR
  currentExecutionAccumulated: number
}

// Resource internal state
interface ResourceState {
  id: number
  coreId: number
  currentStatus: ResourceStatus
  acquireCount: number
  releaseCount: number
}

// Service internal state
interface ServiceState {
  id: number
  coreId: number
  count: number
  lastStatus: number
}

// Hook internal state
interface HookState {
  id: number
  coreId: number
  count: number
  lastStatus: number
  lastTriggerTime?: number
}

interface VarResult {
  id: string
  value: {
    value: number | string
    rawValue: number
  }
  error?: {
    data: string
    name: string
    id: string
    ts: number
  }
}
export default class OsStatistics {
  // 内部状态（用于事件处理）
  private tasks: Map<string, TaskState> = new Map()
  private isrs: Map<string, IsrState> = new Map()
  private resources: Map<string, ResourceState> = new Map()
  private services: Map<string, ServiceState> = new Map()
  private hooks: Map<string, HookState> = new Map()

  private startTime?: number
  private endTime?: number

  // 滑动时间窗口 - 用于负载计算
  private readonly WINDOW_DURATION: number // 窗口时长（CPU cycles）
  private coreTimeWindows: Map<number, TimeWindow[]> = new Map()

  private idleTaskIds: Set<string> = new Set()

  // Track currently running task on each core (to handle ISR interruptions)
  private runningTaskOnCore: Map<number, string> = new Map()
  // Stack to track nested ISRs on each core (for ISR preemption scenarios)
  private runningIsrStackOnCore: Map<number, string[]> = new Map()

  // 合法的状态转换映射（基于ARTI规范）
  // 格式: 当前状态 -> 允许的下一个状态集合
  private readonly VALID_TASK_TRANSITIONS: Map<TaskStatus, Set<TaskStatus>>

  private initValidTransitions(): Map<TaskStatus, Set<TaskStatus>> {
    const transitions = new Map<TaskStatus, Set<TaskStatus>>()

    // Suspended -> Ready (通过 Activate 事件)
    // Ready状态后只能通过Start进入Running
    transitions.set(TaskStatus.ACTIVE, new Set([TaskStatus.START]))

    // Ready -> Running (通过 Start 事件)
    // Running状态后可以被Preempt(抢占)、Wait(等待)或Terminate(终止)
    transitions.set(
      TaskStatus.START,
      new Set([TaskStatus.PREEMPT, TaskStatus.WAIT, TaskStatus.TERMINATE])
    )

    // Running -> Ready (通过 Preempt 事件)
    // 被抢占后回到Ready状态，只能通过Start重新进入Running
    transitions.set(TaskStatus.PREEMPT, new Set([TaskStatus.START]))

    // Running -> Waiting (通过 Wait 事件)
    // Waiting状态后可以Release(释放)回Ready，或被Terminate终止
    transitions.set(TaskStatus.WAIT, new Set([TaskStatus.RELEASE, TaskStatus.TERMINATE]))

    // Waiting -> Ready (通过 Release 事件)
    // Release后回到Ready状态，只能通过Start进入Running
    transitions.set(TaskStatus.RELEASE, new Set([TaskStatus.START]))

    // Running -> Suspended (通过 Terminate 事件)
    // Terminate后回到Suspended状态，只能通过Activate重新激活
    transitions.set(TaskStatus.TERMINATE, new Set([TaskStatus.ACTIVE]))

    return transitions
  }

  constructor(
    private id: string,
    private cpuFreq: number,
    private orti: ORTIFile,
    windowDurationMs: number = 5000
  ) {
    // 将窗口时长转换为CPU cycles
    this.WINDOW_DURATION = windowDurationMs * 1000 * cpuFreq
    this.VALID_TASK_TRANSITIONS = this.initValidTransitions()
    this.reset()
  }

  reset(): void {
    this.tasks.clear()
    this.isrs.clear()
    this.resources.clear()
    this.services.clear()
    this.hooks.clear()

    this.startTime = undefined
    this.endTime = undefined

    this.coreTimeWindows.clear()
    this.idleTaskIds.clear()
    this.runningTaskOnCore.clear()
    this.runningIsrStackOnCore.clear()
  }

  private initTaskState(id: number, coreId: number, status: TaskStatus): TaskState {
    //fake active interval
    const fakeActiveInterval = this.orti.coreConfigs.find(
      (c) => c.id === id && c.type === TaskType.TASK && c.coreId === coreId
    )?.activeInterval

    return {
      id,
      coreId,
      currentStatus: status,
      previousStatus: undefined,
      activeCount: 0,
      startCount: 0,

      activationIntervalSum: 0,
      activationIntervalCount: 0,
      activationIntervalMin: Number.MAX_VALUE,
      activationIntervalMax: 0,
      activationIntervalCurrent: 0,
      fakeActiveInterval: Number(fakeActiveInterval) * this.cpuFreq,

      jitterMax: 0,
      jitterMin: 0,
      currentJitter: 0,

      delayTimeSum: 0,
      delayTimeCount: 0,
      delayTimeMin: Number.MAX_VALUE,
      delayTimeMax: 0,
      currentExecutionAccumulated: 0,
      isInExecution: false,
      hasStartedInCurrentCycle: false,

      executionTimeSum: 0,
      executionTimeCount: 0,
      executionTimeMin: Number.MAX_VALUE,
      executionTimeMax: 0
    }
  }

  private initIsrState(id: number, coreId: number, status: IsrStatus): IsrState {
    return {
      id,
      coreId,
      currentStatus: status,
      runCount: 0,
      executionTimeSum: 0,
      executionTimeCount: 0,
      executionTimeMin: Number.MAX_VALUE,
      executionTimeMax: 0,
      callIntervalSum: 0,
      callIntervalCount: 0,
      callIntervalMin: Number.MAX_VALUE,
      callIntervalMax: 0,
      currentExecutionAccumulated: 0
    }
  }

  private updateRunningStats(
    sum: number,
    count: number,
    min: number,
    max: number,
    newValue: number
  ): { sum: number; count: number; min: number; max: number } {
    return {
      sum: sum + newValue,
      count: count + 1,
      min: Math.min(min, newValue),
      max: Math.max(max, newValue)
    }
  }

  /**
   * 验证任务状态转换是否合法
   * @returns 如果状态转换非法，返回错误信息；否则返回 null
   */
  private validateTaskStateTransition(
    currentStatus: TaskStatus,
    newStatus: TaskStatus,
    event: OsEvent
  ): string | null {
    // 状态相同，不是真正的转换，跳过验证
    if (currentStatus === newStatus) {
      return null
    }

    const validNextStates = this.VALID_TASK_TRANSITIONS.get(currentStatus)
    if (!validNextStates) {
      // 未知的当前状态
      return `Unknown current state: ${TaskStatus[currentStatus]}`
    }

    if (!validNextStates.has(newStatus)) {
      // 非法的状态转换
      return `Invalid state transition: ${TaskStatus[currentStatus]} -> ${TaskStatus[newStatus]} at timestamp ${event.ts}`
    }

    return null
  }

  markIdleTask(taskId: number, coreId: number): void {
    const key = this.getKey(TaskType.TASK, taskId, coreId)
    this.idleTaskIds.add(key)
  }

  processEvent(event: OsEvent) {
    // 更新时间范围
    if (!this.startTime || event.ts < this.startTime) {
      this.startTime = event.ts
    }
    if (!this.endTime || event.ts > this.endTime) {
      this.endTime = event.ts
    }

    let needUpdateLoad = false
    const result: VarResult[] = []
    // 处理事件并立即更新统计
    switch (event.type) {
      case TaskType.TASK:
        result.push(...this.processTaskEvent(event))
        needUpdateLoad = true
        break
      case TaskType.ISR:
        result.push(...this.processIsrEvent(event))
        needUpdateLoad = true
        break
      case TaskType.RESOURCE:
        result.push(...this.processResourceEvent(event))
        break
      case TaskType.SERVICE:
        result.push(...this.processServiceEvent(event))
        break
      case TaskType.HOOK:
        result.push(...this.processHookEvent(event))
        break
    }
    if (needUpdateLoad) {
      // 更新所有核心负载
      result.push(...this.updateCoreLoad(event.coreId, event.ts))
    }
    return result
  }

  private getKey(type: TaskType, id: number, coreId: number): string {
    const map: Record<TaskType, string> = {
      [TaskType.TASK]: 'Task',
      [TaskType.ISR]: 'ISR',
      [TaskType.RESOURCE]: 'Resource',
      [TaskType.SERVICE]: 'Service',
      [TaskType.HOOK]: 'Hook',
      [TaskType.SPINLOCK]: 'Spinlock',
      [TaskType.LINE]: 'Line'
    }
    return `${this.id}.${map[type]}.${type}_${id}_${coreId}`
  }

  // 修改：添加执行时间到滑动窗口
  private addCoreExecutionTime(coreId: number, execTime: number, timestamp: number): void {
    // 更新累计执行时间（保留用于其他统计）

    // 添加到时间窗口
    if (!this.coreTimeWindows.has(coreId)) {
      this.coreTimeWindows.set(coreId, [])
    }

    const windows = this.coreTimeWindows.get(coreId)!

    // 创建新窗口记录
    windows.push({
      timestamp: timestamp,
      executionTime: execTime
    })

    // 清理过期窗口（保留窗口时长内的数据）
    const cutoffTime = timestamp - this.WINDOW_DURATION
    while (windows.length > 0 && windows[0].timestamp < cutoffTime) {
      windows.shift()
    }
  }

  // 计算滑动窗口内的负载
  private calculateWindowLoad(coreId: number, currentTime: number): number {
    const windows = this.coreTimeWindows.get(coreId)
    if (!windows || windows.length === 0) {
      return 0
    }

    let totalExecTime = 0
    let earliestTimestamp = currentTime

    for (const window of windows) {
      totalExecTime += window.executionTime
      earliestTimestamp = Math.min(earliestTimestamp, window.timestamp)
    }

    // 计算实际的时间窗口大小
    const actualWindowDuration = currentTime - earliestTimestamp

    // 设置最小窗口阈值为100ms对应的cycles，避免刚开始时窗口过小导致计算异常
    // 但又能快速反映实际负载情况
    const minWindowDuration = 1 * 1000 * this.cpuFreq // 1ms

    // 避免除以0或过小的窗口
    if (actualWindowDuration < minWindowDuration) {
      // 窗口太小时，直接返回0，等待更多数据
      return 0
    }

    const loadPercent = (totalExecTime / actualWindowDuration) * 100

    // 限制在合理范围内（0-100%）
    return Math.min(Math.max(loadPercent, 0), 100)
  }

  // 修复后的processTaskEvent方法中的关键部分
  private processTaskEvent(event: OsEvent): VarResult[] {
    const key = this.getKey(event.type, event.id, event.coreId)
    const status = event.status as TaskStatus
    const result: VarResult[] = []

    // 检查是否是第一次接收到该任务的事件
    const isFirstEvent = !this.tasks.has(key)

    if (isFirstEvent) {
      // 第一次创建时，直接初始化，无需验证
      this.tasks.set(key, this.initTaskState(event.id, event.coreId, status))
    } else {
      // 已存在的任务，需要验证状态转换
      const task = this.tasks.get(key)!

      // 验证状态转换（使用当前状态作为转换起点）
      const transitionError = this.validateTaskStateTransition(task.currentStatus, status, event)
      if (transitionError) {
        result.push({
          id: '',
          value: { value: 0, rawValue: 0 },
          error: {
            data: `${transitionError} [Previous: ${TaskStatus[task.previousStatus || task.currentStatus]}]`,
            name: '',
            id: `Task.${event.id}_${event.coreId}`,
            ts: event.ts
          }
        })
      }

      // 更新状态（保存前一个状态用于调试）
      task.previousStatus = task.currentStatus
      task.currentStatus = status
    }

    const task = this.tasks.get(key)!

    switch (status) {
      case TaskStatus.ACTIVE:
        task.activeCount++
        task.isInExecution = true
        task.hasStartedInCurrentCycle = false
        task.currentExecutionAccumulated = 0

        if (task.lastActiveTime !== undefined) {
          const interval = event.ts - task.lastActiveTime
          task.activationIntervalCurrent = interval
          const stats = this.updateRunningStats(
            task.activationIntervalSum,
            task.activationIntervalCount,
            task.activationIntervalMin,
            task.activationIntervalMax,
            interval
          )
          task.activationIntervalSum = stats.sum
          task.activationIntervalCount = stats.count
          task.activationIntervalMin = stats.min
          task.activationIntervalMax = stats.max

          // 计算当前jitter
          if (task.fakeActiveInterval && task.fakeActiveInterval > 0) {
            const jitter = (interval - task.fakeActiveInterval) / task.fakeActiveInterval
            task.currentJitter = jitter

            // 比较绝对值来更新最大最小jitter
            const absJitter = Math.abs(jitter)
            const absMax = Math.abs(task.jitterMax)
            const absMin = Math.abs(task.jitterMin)

            if (task.activationIntervalCount === 1) {
              // 第一次计算，直接赋值
              task.jitterMax = jitter
              task.jitterMin = jitter
            } else {
              // 比较绝对值
              if (absJitter > absMax) {
                task.jitterMax = jitter
              }
              if (absJitter < absMin || task.jitterMin === 0) {
                task.jitterMin = jitter
              }
            }
          }
        }
        task.lastActiveTime = event.ts
        break

      case TaskStatus.START:
        // 只在第一次START时统计
        if (!task.hasStartedInCurrentCycle) {
          task.startCount++

          // 计算延迟时间（从ACTIVE到START）
          if (task.lastActiveTime !== undefined) {
            const delay = event.ts - task.lastActiveTime
            const stats = this.updateRunningStats(
              task.delayTimeSum,
              task.delayTimeCount,
              task.delayTimeMin,
              task.delayTimeMax,
              delay
            )
            task.delayTimeSum = stats.sum
            task.delayTimeCount = stats.count
            task.delayTimeMin = stats.min
            task.delayTimeMax = stats.max
          }

          task.lastStartTime = event.ts
          task.hasStartedInCurrentCycle = true
        }

        // 关键修复：每次START都重新开始执行时间计时
        // 这样可以正确处理ISR中断后的恢复场景
        task.currentExecutionStartTime = event.ts

        // 记录任务正在此核心上运行
        this.runningTaskOnCore.set(event.coreId, key)
        break

      case TaskStatus.PREEMPT:
        // 任务被抢占，累加已执行时间
        if (task.currentExecutionStartTime !== undefined) {
          const partialExecTime = event.ts - task.currentExecutionStartTime

          if (partialExecTime > 0 && partialExecTime < 1e15) {
            task.currentExecutionAccumulated += partialExecTime

            if (!this.idleTaskIds.has(key)) {
              this.addCoreExecutionTime(event.coreId, partialExecTime, event.ts)
            }
          }

          task.currentExecutionStartTime = undefined
        }

        if (this.runningTaskOnCore.get(event.coreId) === key) {
          this.runningTaskOnCore.delete(event.coreId)
        }
        break

      case TaskStatus.WAIT:
        // 任务等待，累加已执行时间
        if (task.currentExecutionStartTime !== undefined) {
          const partialExecTime = event.ts - task.currentExecutionStartTime

          if (partialExecTime > 0 && partialExecTime < 1e15) {
            task.currentExecutionAccumulated += partialExecTime

            if (!this.idleTaskIds.has(key)) {
              this.addCoreExecutionTime(event.coreId, partialExecTime, event.ts)
            }
          }

          task.currentExecutionStartTime = undefined
        }

        task.isInExecution = false

        if (this.runningTaskOnCore.get(event.coreId) === key) {
          this.runningTaskOnCore.delete(event.coreId)
        }
        break

      case TaskStatus.RELEASE:
        // 从WAIT恢复到就绪状态
        task.isInExecution = true
        break

      case TaskStatus.TERMINATE:
        // 任务终止，累加最后的执行时间
        if (task.currentExecutionStartTime !== undefined) {
          const partialExecTime = event.ts - task.currentExecutionStartTime

          if (partialExecTime > 0 && partialExecTime < 1e15) {
            task.currentExecutionAccumulated += partialExecTime

            if (!this.idleTaskIds.has(key)) {
              this.addCoreExecutionTime(event.coreId, partialExecTime, event.ts)
            }
          }

          task.currentExecutionStartTime = undefined
        }

        task.isInExecution = false

        // 记录本次完整的执行时间统计
        if (task.currentExecutionAccumulated > 0) {
          const stats = this.updateRunningStats(
            task.executionTimeSum,
            task.executionTimeCount,
            task.executionTimeMin,
            task.executionTimeMax,
            task.currentExecutionAccumulated
          )
          task.executionTimeSum = stats.sum
          task.executionTimeCount = stats.count
          task.executionTimeMin = stats.min
          task.executionTimeMax = stats.max
        }

        task.currentExecutionAccumulated = 0
        task.hasStartedInCurrentCycle = false

        if (this.runningTaskOnCore.get(event.coreId) === key) {
          this.runningTaskOnCore.delete(event.coreId)
        }
        break
    }

    // 立即更新统计结果并合并状态转换错误信息
    const statsResult = this.updateTaskStatistics(key, task)
    result.push(...statsResult)

    return result
  }

  private updateTaskStatistics(key: string, task: TaskState): VarResult[] {
    const result: VarResult[] = []

    const avgActivationInterval =
      task.activationIntervalCount > 0
        ? task.activationIntervalSum / task.activationIntervalCount
        : 0

    const delayStats = this.formatTimeStats(
      task.delayTimeSum,
      task.delayTimeCount,
      task.delayTimeMin,
      task.delayTimeMax
    )

    result.push({
      id: `OsTrace.${key}.DelayTimeMin`,
      value: { value: delayStats.min / this.cpuFreq, rawValue: delayStats.min }
    })
    result.push({
      id: `OsTrace.${key}.DelayTimeMax`,
      value: { value: delayStats.max / this.cpuFreq, rawValue: delayStats.max }
    })
    result.push({
      id: `OsTrace.${key}.DelayTimeAvg`,
      value: { value: delayStats.avg / this.cpuFreq, rawValue: delayStats.avg }
    })

    const activationStats = this.formatTimeStats(
      task.activationIntervalSum,
      task.activationIntervalCount,
      task.activationIntervalMin,
      task.activationIntervalMax
    )

    result.push({
      id: `OsTrace.${key}.ActivationIntervalMin`,
      value: { value: activationStats.min / this.cpuFreq, rawValue: activationStats.min }
    })
    result.push({
      id: `OsTrace.${key}.ActivationIntervalMax`,
      value: { value: activationStats.max / this.cpuFreq, rawValue: activationStats.max }
    })
    result.push({
      id: `OsTrace.${key}.ActivationIntervalAvg`,
      value: { value: activationStats.avg / this.cpuFreq, rawValue: activationStats.avg }
    })

    // 任务执行时间统计（不包括被中断的时间）
    const executionStats = this.formatTimeStats(
      task.executionTimeSum,
      task.executionTimeCount,
      task.executionTimeMin,
      task.executionTimeMax
    )

    result.push({
      id: `OsTrace.${key}.ExecutionTimeMin`,
      value: { value: executionStats.min / this.cpuFreq, rawValue: executionStats.min }
    })
    result.push({
      id: `OsTrace.${key}.ExecutionTimeMax`,
      value: { value: executionStats.max / this.cpuFreq, rawValue: executionStats.max }
    })
    result.push({
      id: `OsTrace.${key}.ExecutionTimeAvg`,
      value: { value: executionStats.avg / this.cpuFreq, rawValue: executionStats.avg }
    })

    result.push({
      id: `OsTrace.${key}.Status`,
      value: { value: TaskStatus[task.currentStatus], rawValue: task.currentStatus }
    })
    result.push({
      id: `OsTrace.${key}.ActiveCount`,
      value: { value: task.activeCount, rawValue: task.activeCount }
    })

    result.push({
      id: `OsTrace.${key}.StartCount`,
      value: { value: task.startCount, rawValue: task.startCount }
    })
    //Task实际运行次数与被激活次数的百分比Running\ Active
    const TaskLost =
      task.activeCount > 0 ? ((task.activeCount - task.startCount) / task.activeCount) * 100 : 0

    result.push({
      id: `OsTrace.${key}.TaskLost`,
      value: { value: Number(TaskLost.toFixed(2)), rawValue: TaskLost }
    })

    // Jitter统计：当前interval/理论interval的偏差
    if (task.fakeActiveInterval && task.fakeActiveInterval > 0) {
      result.push({
        id: `OsTrace.${key}.JitterMax`,
        value: { value: Number((task.jitterMax * 100).toFixed(2)), rawValue: task.jitterMax }
      })
      result.push({
        id: `OsTrace.${key}.JitterMin`,
        value: { value: Number((task.jitterMin * 100).toFixed(2)), rawValue: task.jitterMin }
      })
      result.push({
        id: `OsTrace.${key}.Jitter`,
        value: {
          value: Number((task.currentJitter * 100).toFixed(2)),
          rawValue: task.currentJitter
        }
      })
    }

    return result
  }

  // 修复后的processIsrEvent方法
  private processIsrEvent(event: OsEvent): VarResult[] {
    const key = this.getKey(event.type, event.id, event.coreId)
    const status = event.status as IsrStatus

    if (!this.isrs.has(key)) {
      this.isrs.set(key, this.initIsrState(event.id, event.coreId, status))
    }

    const isr = this.isrs.get(key)!
    isr.currentStatus = status

    if (status === IsrStatus.START) {
      // Get or initialize ISR stack for this core
      if (!this.runningIsrStackOnCore.has(event.coreId)) {
        this.runningIsrStackOnCore.set(event.coreId, [])
      }
      const isrStack = this.runningIsrStackOnCore.get(event.coreId)!

      // 检查同一个ISR是否已经在栈中（自己嵌套自己的异常情况）
      const existingIndexInStack = isrStack.indexOf(key)
      if (existingIndexInStack !== -1) {
        // 检测到同一个ISR嵌套自己，这是异常情况，直接跳过这个事件

        return []
      }

      // 正常的嵌套中断场景：检查是否有其他ISR正在运行
      if (isrStack.length > 0) {
        // Pause the currently running ISR (at the top of the stack)
        const runningIsrKey = isrStack[isrStack.length - 1]
        const runningIsr = this.isrs.get(runningIsrKey)
        if (runningIsr && runningIsr.executionStartTime !== undefined) {
          // Save accumulated execution time for the interrupted ISR
          const partialExecTime = event.ts - runningIsr.executionStartTime

          // Prevent abnormal values
          if (partialExecTime > 0 && partialExecTime < 1e15) {
            // Accumulate the partial execution time for the interrupted ISR
            runningIsr.currentExecutionAccumulated += partialExecTime

            // Add to core execution time (ISR time counts toward core load)
            this.addCoreExecutionTime(event.coreId, partialExecTime, event.ts)
          }

          // Clear the ISR's execution start time (indicates ISR is paused)
          runningIsr.executionStartTime = undefined
        }
      } else {
        // No ISR running, so pause the currently running task
        const runningTaskKey = this.runningTaskOnCore.get(event.coreId)
        if (runningTaskKey) {
          const runningTask = this.tasks.get(runningTaskKey)
          if (runningTask && runningTask.currentExecutionStartTime !== undefined) {
            // Save accumulated execution time
            const partialExecTime = event.ts - runningTask.currentExecutionStartTime

            // Prevent abnormal values
            if (partialExecTime > 0 && partialExecTime < 1e15) {
              runningTask.currentExecutionAccumulated += partialExecTime

              // Add to core execution time (excluding idle tasks)
              if (!this.idleTaskIds.has(runningTaskKey)) {
                this.addCoreExecutionTime(event.coreId, partialExecTime, event.ts)
              }
            }

            // Clear task's execution start time (indicates task is paused)
            runningTask.currentExecutionStartTime = undefined
          }
        }
      }

      // Push current ISR to the stack
      isrStack.push(key)

      // Start timing for this ISR (reset accumulated time for new run)
      isr.executionStartTime = event.ts
      isr.currentExecutionAccumulated = 0
      isr.runCount++

      // Calculate ISR call interval
      if (isr.lastCallTime !== undefined) {
        const interval = event.ts - isr.lastCallTime
        const stats = this.updateRunningStats(
          isr.callIntervalSum,
          isr.callIntervalCount,
          isr.callIntervalMin,
          isr.callIntervalMax,
          interval
        )
        isr.callIntervalSum = stats.sum
        isr.callIntervalCount = stats.count
        isr.callIntervalMin = stats.min
        isr.callIntervalMax = stats.max
      }
      isr.lastCallTime = event.ts
    } else if (status === IsrStatus.STOP) {
      // Record the last execution segment for this ISR
      if (isr.executionStartTime !== undefined) {
        const lastSegmentTime = event.ts - isr.executionStartTime

        // Prevent abnormal values
        if (lastSegmentTime > 0 && lastSegmentTime < 1e15) {
          // Add the last segment to the accumulated time
          isr.currentExecutionAccumulated += lastSegmentTime

          // Add this segment to core execution time
          this.addCoreExecutionTime(event.coreId, lastSegmentTime, event.ts)
        }

        isr.executionStartTime = undefined
      }

      if (isr.currentExecutionAccumulated > 0) {
        const stats = this.updateRunningStats(
          isr.executionTimeSum,
          isr.executionTimeCount,
          isr.executionTimeMin,
          isr.executionTimeMax,
          isr.currentExecutionAccumulated
        )
        isr.executionTimeSum = stats.sum
        isr.executionTimeCount = stats.count
        isr.executionTimeMin = stats.min
        isr.executionTimeMax = stats.max

        // Reset accumulated time for next run
        isr.currentExecutionAccumulated = 0
      }

      // Pop this ISR from the stack
      const isrStack = this.runningIsrStackOnCore.get(event.coreId)
      if (isrStack && isrStack.length > 0) {
        const poppedKey = isrStack.pop()

        // Verify we're popping the correct ISR
        if (poppedKey !== key) {
          console.warn(`ISR stack mismatch: expected ${key}, got ${poppedKey}`)
        }

        // Check if there's another ISR below in the stack
        if (isrStack.length > 0) {
          // Resume the previously interrupted ISR
          const resumingIsrKey = isrStack[isrStack.length - 1]
          const resumingIsr = this.isrs.get(resumingIsrKey)
          if (resumingIsr && resumingIsr.executionStartTime === undefined) {
            // Resume timing from this moment
            resumingIsr.executionStartTime = event.ts
          }
        } else {
          // No more ISRs in the stack, resume the interrupted task
          const runningTaskKey = this.runningTaskOnCore.get(event.coreId)
          if (runningTaskKey) {
            const runningTask = this.tasks.get(runningTaskKey)
            // Only resume timing if the task is still in execution state
            if (
              runningTask &&
              runningTask.isInExecution &&
              runningTask.currentExecutionStartTime === undefined
            ) {
              // Resume timing task's execution time from ISR end moment
              runningTask.currentExecutionStartTime = event.ts
            }
          }
        }
      }
    }

    // Immediately update statistics
    return this.updateIsrStatistics(key, isr)
  }

  private updateIsrStatistics(key: string, isr: IsrState): VarResult[] {
    const result: VarResult[] = []
    const execStats = this.formatTimeStats(
      isr.executionTimeSum,
      isr.executionTimeCount,
      isr.executionTimeMin,
      isr.executionTimeMax
    )
    result.push({
      id: `OsTrace.${key}.ExecutionTimeMin`,
      value: { value: execStats.min / this.cpuFreq, rawValue: execStats.min }
    })
    result.push({
      id: `OsTrace.${key}.ExecutionTimeMax`,
      value: { value: execStats.max / this.cpuFreq, rawValue: execStats.max }
    })
    result.push({
      id: `OsTrace.${key}.ExecutionTimeAvg`,
      value: { value: execStats.avg / this.cpuFreq, rawValue: execStats.avg }
    })

    const callIntervalStats = this.formatTimeStats(
      isr.callIntervalSum,
      isr.callIntervalCount,
      isr.callIntervalMin,
      isr.callIntervalMax
    )
    result.push({
      id: `OsTrace.${key}.CallIntervalMin`,
      value: { value: callIntervalStats.min / this.cpuFreq, rawValue: callIntervalStats.min }
    })
    result.push({
      id: `OsTrace.${key}.CallIntervalMax`,
      value: { value: callIntervalStats.max / this.cpuFreq, rawValue: callIntervalStats.max }
    })
    result.push({
      id: `OsTrace.${key}.CallIntervalAvg`,
      value: { value: callIntervalStats.avg / this.cpuFreq, rawValue: callIntervalStats.avg }
    })

    result.push({
      id: `OsTrace.${key}.RunCount`,
      value: { value: isr.runCount, rawValue: isr.runCount }
    })
    result.push({
      id: `OsTrace.${key}.Status`,
      value: { value: IsrStatus[isr.currentStatus], rawValue: isr.currentStatus }
    })
    return result
  }

  private processResourceEvent(event: OsEvent): VarResult[] {
    const key = this.getKey(event.type, event.id, event.coreId)
    const status = event.status as ResourceStatus

    if (!this.resources.has(key)) {
      this.resources.set(key, {
        id: event.id,
        coreId: event.coreId,
        currentStatus: status,
        acquireCount: 0,
        releaseCount: 0
      })
    }

    const resource = this.resources.get(key)!
    resource.currentStatus = status

    if (status === ResourceStatus.START) {
      resource.acquireCount++
    } else if (status === ResourceStatus.STOP) {
      resource.releaseCount++
    }

    // 立即更新统计结果
    return this.updateResourceStatistics(key, resource)
  }

  private updateResourceStatistics(key: string, resource: ResourceState): VarResult[] {
    const result: VarResult[] = []

    // Return current status data
    result.push({
      id: `OsTrace.${key}.Status`,
      value: { value: ResourceStatus[resource.currentStatus], rawValue: resource.currentStatus }
    })
    result.push({
      id: `OsTrace.${key}.AcquireCount`,
      value: { value: resource.acquireCount, rawValue: resource.acquireCount }
    })
    result.push({
      id: `OsTrace.${key}.ReleaseCount`,
      value: { value: resource.releaseCount, rawValue: resource.releaseCount }
    })

    return result
  }

  private processServiceEvent(event: OsEvent): VarResult[] {
    const key = this.getKey(event.type, event.id, event.coreId)

    if (!this.services.has(key)) {
      this.services.set(key, {
        id: event.id,
        coreId: event.coreId,
        count: 0,
        lastStatus: 0
      })
    }

    const service = this.services.get(key)!
    service.count++
    service.lastStatus = event.status

    // 立即更新统计结果
    return this.updateServiceStatistics(key, service)
  }

  private updateServiceStatistics(key: string, service: ServiceState): VarResult[] {
    const result: VarResult[] = []

    // Return current status data
    result.push({
      id: `OsTrace.${key}.Count`,
      value: { value: service.count, rawValue: service.count }
    })
    result.push({
      id: `OsTrace.${key}.LastStatus`,
      value: { value: service.lastStatus, rawValue: service.lastStatus }
    })

    return result
  }

  private processHookEvent(event: OsEvent): VarResult[] {
    const result: VarResult[] = []

    // Track hook details
    const key = this.getKey(event.type, event.id, event.coreId)

    if (!this.hooks.has(key)) {
      this.hooks.set(key, {
        id: event.id,
        coreId: event.coreId,
        count: 0,
        lastStatus: 0
      })
    }

    const hook = this.hooks.get(key)!
    hook.count++
    hook.lastStatus = event.status
    // record last trigger time relative to startTime (ms)
    if (!this.startTime) {
      this.startTime = event.ts
    }
    const delta = event.ts - this.startTime
    hook.lastTriggerTime = delta

    // Return hook status data
    result.push({
      id: `OsTrace.${key}.Count`,
      value: { value: hook.count, rawValue: hook.count }
    })
    result.push({
      id: `OsTrace.${key}.LastStatus`,
      value: { value: hook.lastStatus, rawValue: hook.lastStatus }
    })
    result.push({
      id: `OsTrace.${key}.LastTriggerTime`,
      value: { value: delta / this.cpuFreq, rawValue: delta }
    })

    return result
  }

  // 修改：使用滑动窗口计算负载
  private updateCoreLoad(coreId: number, currentTime: number): VarResult[] {
    const result: VarResult[] = []

    // 使用滑动窗口计算当前负载
    const loadPercent = this.calculateWindowLoad(coreId, currentTime)

    result.push({
      id: `OsTrace.${this.id}.Core${coreId}.LoadPercent`,
      value: { value: Number(loadPercent.toFixed(2)), rawValue: loadPercent }
    })

    // 保留总体统计（可选）
    const totalTime = this.endTime && this.startTime ? this.endTime - this.startTime : 0

    result.push({
      id: `OsTrace.${this.id}.Core${coreId}.TotalTime`,
      value: { value: totalTime / this.cpuFreq / 1000, rawValue: totalTime }
    })

    return result
  }

  private formatTimeStats(sum: number, count: number, min: number, max: number) {
    if (count === 0) {
      return { min: 0, max: 0, avg: 0 }
    }

    const actualMin = min === Number.MAX_VALUE ? 0 : min
    const avg = sum / count

    return { min: actualMin, max, avg }
  }
}
