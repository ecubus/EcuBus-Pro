import precisionTimer from './build/Release/precision_timer.node'

/**
 * 定时任务信息
 */
export interface TimerTask {
  /** 任务ID */
  taskId: number
  /** 触发时间 */
  triggerTime: number
}

/**
 * 精确定时器类
 * 提供微秒级精度的定时功能
 */
export class PrecisionTimer {
  private timerName: string

  private isCreated: boolean = false
  private timerMap: Map<number, () => void> = new Map()

  constructor(name: string) {
    this.timerName = name
  }
  callCallback(task: TimerTask) {
    const callback = this.timerMap.get(task.taskId)
    if (callback) {
      callback()
    }
  }

  /**
   * 创建定时器
   */
  create() {
    if (this.isCreated) {
      return
    }

    precisionTimer.createPrecisionTimer(this.timerName, this.callCallback.bind(this))
    this.isCreated = true
  }

  /**
   * 添加定时任务
   * @param delayMicrosec 延迟时间（微秒）
   * @param intervalMicrosec 间隔时间（微秒，0表示单次执行）
   * @param userData 用户数据
   * @returns 任务ID
   */
  addTask(delayMicrosec: number, intervalMicrosec: number = 0, callback: () => void): number {
    if (!this.isCreated) {
      throw new Error('Timer not created')
    }

    const id = precisionTimer.addTimerTask(this.timerName, delayMicrosec, intervalMicrosec)

    this.timerMap.set(id, callback)

    return id
  }

  /**
   * 取消定时任务
   * @param taskId 任务ID
   * @returns 是否成功取消
   */
  cancelTask(taskId: number): boolean {
    if (!this.isCreated) {
      throw new Error('Timer not created')
    }

    return precisionTimer.cancelTimerTask(this.timerName, taskId)
  }

  /**
   * 销毁定时器
   */
  destroy(): void {
    if (!this.isCreated) {
      return
    }

    precisionTimer.destroyPrecisionTimer(this.timerName)
    this.isCreated = false
  }

  /**
   * 获取当前高精度时间戳
   * @returns 时间戳（微秒）
   */
  static getCurrentTimestamp(): number {
    return precisionTimer.getCurrentTimestamp()
  }
}

// 导出所有接口和类
export default {
  PrecisionTimer
}
