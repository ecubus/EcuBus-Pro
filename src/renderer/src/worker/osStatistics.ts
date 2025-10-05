import { OsEvent, TaskType, TaskStatus, IsrStatus, ResourceStatus } from 'nodeCan/osEvent'

// Resource statistics result
interface ResourceStatistics {
  id: number
  coreId: number
  key: string
  currentStatus: string
  acquireCount: number
  releaseCount: number
}

// Service statistics result
interface ServiceStatistics {
  id: number
  coreId: number
  key: string
  isActive: boolean
  enterCount: number
  exitCount: number
}

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
  isActive: boolean
  enterCount: number
  exitCount: number
}

export default class OsStatistics {
  // 内部状态（用于事件处理）
  private tasks: Map<string, TaskState> = new Map()
  private isrs: Map<string, IsrState> = new Map()
  private resources: Map<string, ResourceState> = new Map()
  private services: Map<string, ServiceState> = new Map()

  // 实时更新的统计结果（直接可查询）

  private resourceStats: Map<string, ResourceStatistics> = new Map()
  private serviceStats: Map<string, ServiceStatistics> = new Map()

  private errorHookCount = 0
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

    this.resourceStats.clear()
    this.serviceStats.clear()
    this.errorHookCount = 0
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
    const result: { id: string; value: any }[] = []
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
        this.processResourceEvent(event)
        break
      case TaskType.SERVICE:
        this.processServiceEvent(event)
        break
      case TaskType.HOOK:
        this.processHookEvent(event)
        break
    }
    if (needUpdateLoad) {
      // 更新所有核心负载
      result.push(...this.updateCoreLoad(event.coreId))
    }
    return result
  }

  private getKey(type: TaskType, id: number, coreId: number): string {
    return `${this.id}.${type}_${id}_${coreId}`
  }

  private addCoreExecutionTime(coreId: number, execTime: number): void {
    const current = this.coreExecutionTime.get(coreId) || 0
    this.coreExecutionTime.set(coreId, current + execTime)
  }

  private processTaskEvent(event: OsEvent) {
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

          // 累加到对应核心的执行时间（包括空闲任务）
          this.addCoreExecutionTime(event.coreId, partialExecTime)

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

          this.addCoreExecutionTime(event.coreId, partialExecTime)

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

          this.addCoreExecutionTime(event.coreId, partialExecTime)

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

  private updateTaskStatistics(key: string, task: TaskState): { id: string; value: any }[] {
    const result: { id: string; value: any }[] = []

    const avgActivationInterval =
      task.activationIntervalCount > 0
        ? task.activationIntervalSum / task.activationIntervalCount
        : 0
    const avgStartInterval =
      task.startIntervalCount > 0 ? task.startIntervalSum / task.startIntervalCount : 0

    const avgJitter =
      avgActivationInterval > 0
        ? ((avgStartInterval - avgActivationInterval) / avgActivationInterval) * 100
        : 0

    const delayStats = this.formatTimeStats(
      task.delayTimeSum,
      task.delayTimeCount,
      task.delayTimeMin,
      task.delayTimeMax
    )

    result.push({ id: `OsTrace.${key}.DelayTimeMin`, value: delayStats.min / this.cpuFreq })
    result.push({ id: `OsTrace.${key}.DelayTimeMax`, value: delayStats.max / this.cpuFreq })
    result.push({ id: `OsTrace.${key}.DelayTimeAvg`, value: delayStats.avg / this.cpuFreq })

    const activationStats = this.formatTimeStats(
      task.activationIntervalSum,
      task.activationIntervalCount,
      task.activationIntervalMin,
      task.activationIntervalMax
    )

    result.push({
      id: `OsTrace.${key}.ActivationIntervalMin`,
      value: activationStats.min / this.cpuFreq
    })
    result.push({
      id: `OsTrace.${key}.ActivationIntervalMax`,
      value: activationStats.max / this.cpuFreq
    })
    result.push({
      id: `OsTrace.${key}.ActivationIntervalAvg`,
      value: activationStats.avg / this.cpuFreq
    })

    const startStats = this.formatTimeStats(
      task.startIntervalSum,
      task.startIntervalCount,
      task.startIntervalMin,
      task.startIntervalMax
    )

    result.push({ id: `OsTrace.${key}.StartIntervalMin`, value: startStats.min / this.cpuFreq })
    result.push({ id: `OsTrace.${key}.StartIntervalMax`, value: startStats.max / this.cpuFreq })
    result.push({ id: `OsTrace.${key}.StartIntervalAvg`, value: startStats.avg / this.cpuFreq })

    // 任务执行时间统计（不包括被中断的时间）
    const executionStats = this.formatTimeStats(
      task.executionTimeSum,
      task.executionTimeCount,
      task.executionTimeMin,
      task.executionTimeMax
    )

    result.push({
      id: `OsTrace.${key}.ExecutionTimeMin`,
      value: executionStats.min / this.cpuFreq
    })
    result.push({
      id: `OsTrace.${key}.ExecutionTimeMax`,
      value: executionStats.max / this.cpuFreq
    })
    result.push({
      id: `OsTrace.${key}.ExecutionTimeAvg`,
      value: executionStats.avg / this.cpuFreq
    })

    result.push({ id: `OsTrace.${key}.Status`, value: TaskStatus[task.currentStatus] })
    result.push({ id: `OsTrace.${key}.ActiveCount`, value: task.activeCount })

    result.push({ id: `OsTrace.${key}.StartCount`, value: task.startCount })
    //Task实际运行次数与被激活次数的百分比Running\ Active
    const runningRate = task.activeCount > 0 ? (task.startCount / task.activeCount) * 100 : 0

    result.push({ id: `OsTrace.${key}.RunningRate`, value: runningRate.toFixed(2) + '%' })
    result.push({ id: `OsTrace.${key}.Jitter`, value: avgJitter.toFixed(2) + '%' })

    return result
  }

  private processIsrEvent(event: OsEvent) {
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

          // Add to core execution time (only task execution time, not ISR)
          this.addCoreExecutionTime(event.coreId, partialExecTime)

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

  private updateIsrStatistics(key: string, isr: IsrState): { id: string; value: any }[] {
    const result: { id: string; value: any }[] = []
    const execStats = this.formatTimeStats(
      isr.executionTimeSum,
      isr.executionTimeCount,
      isr.executionTimeMin,
      isr.executionTimeMax
    )
    result.push({ id: `OsTrace.${key}.ExecutionTimeMin`, value: execStats.min / this.cpuFreq })
    result.push({ id: `OsTrace.${key}.ExecutionTimeMax`, value: execStats.max / this.cpuFreq })
    result.push({ id: `OsTrace.${key}.ExecutionTimeAvg`, value: execStats.avg / this.cpuFreq })

    const callIntervalStats = this.formatTimeStats(
      isr.callIntervalSum,
      isr.callIntervalCount,
      isr.callIntervalMin,
      isr.callIntervalMax
    )
    result.push({
      id: `OsTrace.${key}.CallIntervalMin`,
      value: callIntervalStats.min / this.cpuFreq
    })
    result.push({
      id: `OsTrace.${key}.CallIntervalMax`,
      value: callIntervalStats.max / this.cpuFreq
    })
    result.push({
      id: `OsTrace.${key}.CallIntervalAvg`,
      value: callIntervalStats.avg / this.cpuFreq
    })

    result.push({ id: `OsTrace.${key}.RunCount`, value: isr.runCount })
    result.push({ id: `OsTrace.${key}.Status`, value: IsrStatus[isr.currentStatus] })
    return result
  }

  private processResourceEvent(event: OsEvent): void {
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
    this.updateResourceStatistics(key, resource)
  }

  private updateResourceStatistics(key: string, resource: ResourceState): void {
    this.resourceStats.set(key, {
      id: resource.id,
      coreId: resource.coreId,
      key,
      currentStatus: ResourceStatus[resource.currentStatus],
      acquireCount: resource.acquireCount,
      releaseCount: resource.releaseCount
    })
  }

  private processServiceEvent(event: OsEvent): void {
    const key = this.getKey(event.type, event.id, event.coreId)

    if (!this.services.has(key)) {
      this.services.set(key, {
        id: event.id,
        coreId: event.coreId,
        isActive: false,
        enterCount: 0,
        exitCount: 0
      })
    }

    const service = this.services.get(key)!

    if (event.status === 0) {
      service.isActive = true
      service.enterCount++
    } else {
      service.isActive = false
      service.exitCount++
    }

    // 立即更新统计结果
    this.updateServiceStatistics(key, service)
  }

  private updateServiceStatistics(key: string, service: ServiceState): void {
    this.serviceStats.set(key, {
      id: service.id,
      coreId: service.coreId,
      key,
      isActive: service.isActive,
      enterCount: service.enterCount,
      exitCount: service.exitCount
    })
  }

  private processHookEvent(event: OsEvent): void {
    this.errorHookCount++
  }

  private updateCoreLoad(coreId: number): { id: string; value: any }[] {
    const result: { id: string; value: any }[] = []
    const totalTime = this.endTime && this.startTime ? this.endTime - this.startTime : 0

    if (totalTime <= 0) return result

    // 更新每个核心的负载统计
    const execTime = this.coreExecutionTime.get(coreId) || 0
    const loadPercent = (execTime / totalTime) * 100

    result.push({ id: `OsTrace.${this.id}.Core${coreId}.LoadPercent`, value: loadPercent })
    result.push({
      id: `OsTrace.${this.id}.Core${coreId}.ExecutionTime`,
      value: execTime / this.cpuFreq / 1000
    })
    result.push({
      id: `OsTrace.${this.id}.Core${coreId}.TotalTime`,
      value: totalTime / this.cpuFreq / 1000
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
