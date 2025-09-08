/**
 * 高精度定时器使用示例
 * 演示如何使用PrecisionTimer和ReplayTimer
 */

import { PrecisionTimer } from './timer'

/**
 * 示例1: 使用PrecisionTimer创建高精度定时任务
 */
async function precisionTimerExample() {
  console.log('=== Precision Timer Example ===')

  // 创建定时器回调函数
  const timerCallback = (task: any) => {
    console.log(`Timer task executed: ID=${task.taskId}, TriggerTime=${task.triggerTime}`)
  }

  // 创建精确定时器
  const timer = new PrecisionTimer('example_timer', timerCallback)

  try {
    // 初始化定时器
    await timer.create()
    console.log('Precision timer created')

    // 添加单次任务（延迟500微秒）
    const taskId1 = await timer.addTask(500, 0)
    console.log(`Added single task: ID=${taskId1}`)

    // 添加周期性任务（延迟1000微秒，间隔2000微秒）
    const taskId2 = await timer.addTask(1000, 2000)
    console.log(`Added periodic task: ID=${taskId2}`)

    // 等待一段时间观察执行
    await new Promise((resolve) => setTimeout(resolve, 10000))

    // 取消周期性任务
    const cancelled = await timer.cancelTask(taskId2)
    console.log(`Task ${taskId2} cancelled: ${cancelled}`)

    // 销毁定时器
    await timer.destroy()
    console.log('Precision timer destroyed')
  } catch (error) {
    console.error('Precision timer example error:', error)
  }
}
