import precisionTimer from './build/Release/precision_timer.node'

/**
 * Timer task information interface
 *
 * @category Util
 */
export interface TimerTask {
  /** Task ID */
  taskId: number
  /** Trigger time in microseconds */
  triggerTime: number
}

/**
 * High-precision timer class providing microsecond-level timing functionality.
 * This class wraps native precision timer functionality for accurate task scheduling.
 *
 * @category Util
 *
 * @example
 * 1. *Basic single-shot timer*
 *     ```ts
 *     const timer = new PrecisionTimer('my-timer')
 *     timer.create()
 *
 *     // Add a task that runs once after 1000000 microseconds (1 second)
 *     const taskId = timer.addTask(1000000, 0, () => {
 *       console.log('Timer fired after 1 second!')
 *     })
 *     ```
 *
 * 2. *Recurring timer*
 *     ```ts
 *     // Add a task that runs every 500000 microseconds (500ms)
 *     const taskId = timer.addTask(500000, 500000, () => {
 *       console.log('This runs every 500ms')
 *     })
 *
 *     // Later, cancel the recurring task
 *     timer.cancelTask(taskId)
 *     ```
 *
 * 3. *High-precision timing measurement*
 *     ```ts
 *     // Get current high-precision timestamp
 *     const startTime = PrecisionTimer.getCurrentTimestamp()
 *
 *     // Add a task with microsecond precision (100 microseconds delay)
 *     timer.addTask(100, 0, () => {
 *       const endTime = PrecisionTimer.getCurrentTimestamp()
 *       console.log(`Elapsed: ${endTime - startTime} microseconds`)
 *     })
 *     ```
 */
export class PrecisionTimer {
  private timerName: string

  private isCreated: boolean = false
  private timerMap: Map<number, () => void> = new Map()

  /**
   * Creates a new PrecisionTimer instance
   * @param name - Unique name identifier for this timer instance
   */
  constructor(name: string) {
    this.timerName = name
  }

  /**
   * Internal callback handler for timer tasks
   * @param task - Timer task information containing taskId and triggerTime
   * @internal
   */
  callCallback(task: TimerTask) {
    const callback = this.timerMap.get(task.taskId)
    if (callback) {
      callback()
    }
  }

  /**
   * Creates and initializes the precision timer.
   * Must be called before adding any tasks.
   *
   * @throws {Error} If timer creation fails
   */
  create() {
    if (this.isCreated) {
      return
    }

    precisionTimer.createPrecisionTimer(this.timerName, this.callCallback.bind(this))
    this.isCreated = true
  }

  /**
   * Adds a new timer task with microsecond precision.
   *
   * @param delayMicrosec - Initial delay before first execution in microseconds
   * @param intervalMicrosec - Interval between recurring executions in microseconds (0 for single execution)
   * @param callback - Function to execute when timer fires
   * @returns Task ID that can be used to cancel the task
   * @throws {Error} If timer is not created
   *
   * @example
   * ```ts
   * // Single execution after 1 second
   * const taskId = timer.addTask(1000000, 0, () => console.log('Done!'))
   *
   * // Recurring execution every 500ms
   * const intervalId = timer.addTask(500000, 500000, () => console.log('Tick'))
   * ```
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
   * Cancels a previously scheduled timer task.
   *
   * @param taskId - The task ID returned by addTask()
   * @returns True if task was successfully cancelled, false if task was not found
   * @throws {Error} If timer is not created
   */
  cancelTask(taskId: number): boolean {
    if (!this.isCreated) {
      throw new Error('Timer not created')
    }

    return precisionTimer.cancelTimerTask(this.timerName, taskId)
  }

  /**
   * Destroys the timer and cancels all pending tasks.
   * After calling this method, the timer cannot be used until create() is called again.
   *
   * @note
   * must call this method before the process exits,
   *
   * @example
   * ```ts
   * Util.End(()=>{
   *   timer.destroy()
   * })
   * ```
   *
   */
  destroy(): void {
    if (!this.isCreated) {
      return
    }

    precisionTimer.destroyPrecisionTimer(this.timerName)
    this.isCreated = false
  }
}

/**
 * Default export containing all timer-related classes and interfaces
 *
 * @category Util
 */
export default {
  PrecisionTimer
}
