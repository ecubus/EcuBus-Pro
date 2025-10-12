import { OsEvent, TaskType, TaskStatus, IsrStatus, ResourceStatus } from 'nodeCan/osEvent'

// Task internal state (用于事件处理)
interface TaskState {
  id: number
  coreId: number
  currentStatus: TaskStatus
  activeCount: number

  startCount: number

  lastActiveTime?: number
  lastStartTime?: number

  activationIntervalSum: number
  activationIntervalCount: number
  activationIntervalMin: number
  activationIntervalMax: number

  startIntervalSum: number
  startIntervalCount: number
  startIntervalMin: number
  startIntervalMax: number

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
}

interface VarResult {
  id: string
  value: {
    value: number | string
    rawValue: number
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

  // 每个核心的执行时间统计
  private coreExecutionTime: Map<number, number> = new Map()

  private idleTaskIds: Set<string> = new Set()

  // Track currently running task on each core (to handle ISR interruptions)
  private runningTaskOnCore: Map<number, string> = new Map()

  constructor(
    private id: string,
    private cpuFreq: number
  ) {
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
    this.coreExecutionTime.clear()
    this.idleTaskIds.clear()
    this.runningTaskOnCore.clear()
  }

  private initTaskState(id: number, coreId: number, status: TaskStatus): TaskState {
    return {
      id,
      coreId,
      currentStatus: status,
      activeCount: 0,

      startCount: 0,
      activationIntervalSum: 0,
      activationIntervalCount: 0,
      activationIntervalMin: Number.MAX_VALUE,
      activationIntervalMax: 0,
      startIntervalSum: 0,
      startIntervalCount: 0,
      startIntervalMin: Number.MAX_VALUE,
      startIntervalMax: 0,

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
      callIntervalMax: 0
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
      result.push(...this.updateCoreLoad(event.coreId))
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

  private addCoreExecutionTime(coreId: number, execTime: number): void {
    const current = this.coreExecutionTime.get(coreId) || 0
    this.coreExecutionTime.set(coreId, current + execTime)
  }

  private processTaskEvent(event: OsEvent): VarResult[] {
    const key = this.getKey(event.type, event.id, event.coreId)
    const status = event.status as TaskStatus

    if (!this.tasks.has(key)) {
      this.tasks.set(key, this.initTaskState(event.id, event.coreId, status))
    }

    const task = this.tasks.get(key)!
    task.currentStatus = status

    switch (status) {
      case TaskStatus.ACTIVE:
        task.activeCount++
        task.isInExecution = true
        task.hasStartedInCurrentCycle = false
        task.currentExecutionAccumulated = 0

        if (task.lastActiveTime !== undefined) {
          const interval = event.ts - task.lastActiveTime
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
        }
        task.lastActiveTime = event.ts
        break

      case TaskStatus.START:
        // Track start count and intervals (for first start after becoming ready)
        if (!task.hasStartedInCurrentCycle) {
          task.startCount++

          // Calculate delay from when task became ready (ACTIVE or PREEMPT)
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

          // Calculate start interval (time between successive first-starts)
          if (task.lastStartTime !== undefined) {
            const interval = event.ts - task.lastStartTime
            const stats = this.updateRunningStats(
              task.startIntervalSum,
              task.startIntervalCount,
              task.startIntervalMin,
              task.startIntervalMax,
              interval
            )
            task.startIntervalSum = stats.sum
            task.startIntervalCount = stats.count
            task.startIntervalMin = stats.min
            task.startIntervalMax = stats.max
          }
          task.lastStartTime = event.ts

          task.hasStartedInCurrentCycle = true
        }

        task.currentExecutionStartTime = event.ts
        // Track this task as running on this core
        this.runningTaskOnCore.set(event.coreId, key)
        break

      case TaskStatus.PREEMPT:
        if (task.currentExecutionStartTime !== undefined) {
          const partialExecTime = event.ts - task.currentExecutionStartTime
          task.currentExecutionAccumulated += partialExecTime

          // 累加到对应核心的执行时间（不包括空闲任务）
          if (!this.idleTaskIds.has(key)) {
            this.addCoreExecutionTime(event.coreId, partialExecTime)
          }

          task.currentExecutionStartTime = undefined
        }

        // Task is no longer running on this core
        if (this.runningTaskOnCore.get(event.coreId) === key) {
          this.runningTaskOnCore.delete(event.coreId)
        }
        break

      case TaskStatus.WAIT:
        if (task.currentExecutionStartTime !== undefined) {
          const partialExecTime = event.ts - task.currentExecutionStartTime
          task.currentExecutionAccumulated += partialExecTime

          // 累加到对应核心的执行时间（不包括空闲任务）
          if (!this.idleTaskIds.has(key)) {
            this.addCoreExecutionTime(event.coreId, partialExecTime)
          }

          task.currentExecutionStartTime = undefined
        }

        // Task is no longer running on this core
        if (this.runningTaskOnCore.get(event.coreId) === key) {
          this.runningTaskOnCore.delete(event.coreId)
        }
        break

      case TaskStatus.RELEASE:
        // Waiting → Ready, 不需要特殊处理
        break

      case TaskStatus.TERMINATE:
        if (task.currentExecutionStartTime !== undefined) {
          const partialExecTime = event.ts - task.currentExecutionStartTime
          task.currentExecutionAccumulated += partialExecTime

          // 累加到对应核心的执行时间（不包括空闲任务）
          if (!this.idleTaskIds.has(key)) {
            this.addCoreExecutionTime(event.coreId, partialExecTime)
          }

          task.currentExecutionStartTime = undefined
        }

        task.isInExecution = false

        // 记录本次执行时间统计（不包括被中断的时间）
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

        // Task is no longer running on this core
        if (this.runningTaskOnCore.get(event.coreId) === key) {
          this.runningTaskOnCore.delete(event.coreId)
        }
        break
    }

    // 立即更新统计结果
    const result = this.updateTaskStatistics(key, task)

    return result
  }

  private updateTaskStatistics(key: string, task: TaskState): VarResult[] {
    const result: VarResult[] = []

    const avgActivationInterval =
      task.activationIntervalCount > 0
        ? task.activationIntervalSum / task.activationIntervalCount
        : 0
    const avgStartInterval =
      task.startIntervalCount > 0 ? task.startIntervalSum / task.startIntervalCount : 0

    const avgJitter =
      avgActivationInterval > 0
        ? (Math.abs(avgStartInterval - avgActivationInterval) / avgActivationInterval) * 100
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

    const startStats = this.formatTimeStats(
      task.startIntervalSum,
      task.startIntervalCount,
      task.startIntervalMin,
      task.startIntervalMax
    )

    result.push({
      id: `OsTrace.${key}.StartIntervalMin`,
      value: { value: startStats.min / this.cpuFreq, rawValue: startStats.min }
    })
    result.push({
      id: `OsTrace.${key}.StartIntervalMax`,
      value: { value: startStats.max / this.cpuFreq, rawValue: startStats.max }
    })
    result.push({
      id: `OsTrace.${key}.StartIntervalAvg`,
      value: { value: startStats.avg / this.cpuFreq, rawValue: startStats.avg }
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
    result.push({
      id: `OsTrace.${key}.Jitter`,
      value: { value: Number(avgJitter.toFixed(2)), rawValue: avgJitter }
    })

    return result
  }

  private processIsrEvent(event: OsEvent): VarResult[] {
    const key = this.getKey(event.type, event.id, event.coreId)
    const status = event.status as IsrStatus

    if (!this.isrs.has(key)) {
      this.isrs.set(key, this.initIsrState(event.id, event.coreId, status))
    }

    const isr = this.isrs.get(key)!
    isr.currentStatus = status

    if (status === IsrStatus.START) {
      // Pause the currently running task on this core (if any)
      const runningTaskKey = this.runningTaskOnCore.get(event.coreId)
      if (runningTaskKey) {
        const runningTask = this.tasks.get(runningTaskKey)
        if (runningTask && runningTask.currentExecutionStartTime !== undefined) {
          // Save the partial execution time accumulated so far
          const partialExecTime = event.ts - runningTask.currentExecutionStartTime
          runningTask.currentExecutionAccumulated += partialExecTime

          // Add to core execution time (不包括空闲任务)
          if (!this.idleTaskIds.has(runningTaskKey)) {
            this.addCoreExecutionTime(event.coreId, partialExecTime)
          }

          // Clear the start time to indicate task is paused
          runningTask.currentExecutionStartTime = undefined
        }
      }

      isr.executionStartTime = event.ts
      isr.runCount++

      // Calculate call interval
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
      if (isr.executionStartTime !== undefined) {
        const execTime = event.ts - isr.executionStartTime
        const stats = this.updateRunningStats(
          isr.executionTimeSum,
          isr.executionTimeCount,
          isr.executionTimeMin,
          isr.executionTimeMax,
          execTime
        )
        isr.executionTimeSum = stats.sum
        isr.executionTimeCount = stats.count
        isr.executionTimeMin = stats.min
        isr.executionTimeMax = stats.max

        // ISR的执行时间也计入核心负载
        this.addCoreExecutionTime(event.coreId, execTime)

        isr.executionStartTime = undefined
      }

      // Don't automatically resume task execution time tracking after ISR
      // Task will resume timing only when it gets a START event again
      // This is because ISR may trigger scheduler and a different task may run
    }

    // 立即更新统计结果
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
      id: `OsTrace.Resource.${key}.Status`,
      value: { value: ResourceStatus[resource.currentStatus], rawValue: resource.currentStatus }
    })
    result.push({
      id: `OsTrace.Resource.${key}.AcquireCount`,
      value: { value: resource.acquireCount, rawValue: resource.acquireCount }
    })
    result.push({
      id: `OsTrace.Resource.${key}.ReleaseCount`,
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
      id: `OsTrace.Service.${key}.Count`,
      value: { value: service.count, rawValue: service.count }
    })
    result.push({
      id: `OsTrace.Service.${key}.LastStatus`,
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

    // Return hook status data
    result.push({
      id: `OsTrace.Hook.${key}.Count`,
      value: { value: hook.count, rawValue: hook.count }
    })
    result.push({
      id: `OsTrace.Hook.${key}.LastStatus`,
      value: { value: hook.lastStatus, rawValue: hook.lastStatus }
    })

    return result
  }

  private updateCoreLoad(coreId: number): VarResult[] {
    const result: VarResult[] = []
    const totalTime = this.endTime && this.startTime ? this.endTime - this.startTime : 0

    if (totalTime <= 0) return result

    // 更新每个核心的负载统计（不包括空闲任务的执行时间）
    const execTime = this.coreExecutionTime.get(coreId) || 0
    const loadPercent = (execTime / totalTime) * 100

    result.push({
      id: `OsTrace.${this.id}.Core${coreId}.LoadPercent`,
      value: { value: loadPercent, rawValue: loadPercent }
    })
    result.push({
      id: `OsTrace.${this.id}.Core${coreId}.ExecutionTime`,
      value: { value: execTime / this.cpuFreq / 1000, rawValue: execTime }
    })
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
