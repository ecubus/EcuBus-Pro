/**
 * 定时任务信息
 */
export interface TimerTask {
  /** 任务ID */
  taskId: number
  /** 触发时间 */
  triggerTime: number
  /** 用户数据 */
  userData?: any
}

/**
 * 精确定时器类
 * 提供微秒级精度的定时功能
 */
export class PrecisionTimer {
  private timerName: string
  private callback: (task: TimerTask) => void
  private isCreated: boolean = false

  constructor(name: string, callback: (task: TimerTask) => void) {
    this.timerName = name
    this.callback = callback
  }

  /**
   * 创建定时器
   */
  async create(): Promise<void> {
    if (this.isCreated) {
      throw new Error('Timer already created')
    }

    // 动态导入原生模块
    const precisionTimer = await this.loadPrecisionTimerModule()

    precisionTimer.createPrecisionTimer(this.timerName, this.callback)
    this.isCreated = true
  }

  /**
   * 添加定时任务
   * @param delayMicrosec 延迟时间（微秒）
   * @param intervalMicrosec 间隔时间（微秒，0表示单次执行）
   * @param userData 用户数据
   * @returns 任务ID
   */
  async addTask(
    delayMicrosec: number,
    intervalMicrosec: number = 0,
    userData?: any
  ): Promise<number> {
    if (!this.isCreated) {
      throw new Error('Timer not created')
    }

    const precisionTimer = await this.loadPrecisionTimerModule()
    return precisionTimer.addTimerTask(this.timerName, delayMicrosec, intervalMicrosec, userData)
  }

  /**
   * 取消定时任务
   * @param taskId 任务ID
   * @returns 是否成功取消
   */
  async cancelTask(taskId: number): Promise<boolean> {
    if (!this.isCreated) {
      throw new Error('Timer not created')
    }

    const precisionTimer = await this.loadPrecisionTimerModule()
    return precisionTimer.cancelTimerTask(this.timerName, taskId)
  }

  /**
   * 销毁定时器
   */
  async destroy(): Promise<void> {
    if (!this.isCreated) {
      return
    }

    const precisionTimer = await this.loadPrecisionTimerModule()
    precisionTimer.destroyPrecisionTimer(this.timerName)
    this.isCreated = false
  }

  /**
   * 获取当前高精度时间戳
   * @returns 时间戳（微秒）
   */
  static async getCurrentTimestamp(): Promise<number> {
    const precisionTimer = await PrecisionTimer.loadPrecisionTimerModuleStatic()
    return precisionTimer.getCurrentTimestamp()
  }

  private async loadPrecisionTimerModule(): Promise<any> {
    return PrecisionTimer.loadPrecisionTimerModuleStatic()
  }

  private static async loadPrecisionTimerModuleStatic(): Promise<any> {
    try {
      // 在实际使用时，这里应该导入编译后的原生模块
      // return require('./precision_timer.node');
      throw new Error(
        'Precision timer native module not available. Please compile the C++ module first.'
      )
    } catch (error) {
      throw new Error(`Failed to load precision timer module: ${error}`)
    }
  }
}

// 导出所有接口和类
export default {
  PrecisionTimer
}
