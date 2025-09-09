import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrecisionTimer, TimerTask } from '../src/main/timer/timer'
import { getTsUs } from '../src/main/share/can'
describe('PrecisionTimer', () => {
  const timer = new PrecisionTimer('test-timer')

  beforeEach(() => {
    timer.create()
  })

  afterEach(async () => {
    // Ensure timer is properly cleaned up after each test
    timer.destroy()
  })

  describe('Timer Accuracy Tests', async () => {
    it('should execute single task with accurate timing', async () => {
      timer.create()

      const startTime = getTsUs()
      const delayMicroseconds = 50000 // 50ms
      const tolerance = 5000 // 5ms tolerance

      const p = new Promise((resolve) => {
        const taskId = timer.addTask(delayMicroseconds, 0, () => {
          resolve(taskId)
        })
      })

      const taskId = await p
      const actualDelay = getTsUs() - startTime

      expect(taskId).toBeGreaterThan(0)

      console.log(actualDelay, delayMicroseconds)
      expect(Math.abs(actualDelay - delayMicroseconds)).toBeLessThan(tolerance)
    })

    // it('should execute recurring tasks with accurate intervals', async () => {
    //   timer.create()

    //   const startTime = getTsUs()
    //   const delayMicroseconds = 20000 // 20ms initial delay
    //   const intervalMicroseconds = 30000 // 30ms interval
    //   const tolerance = 5000 // 5ms tolerance
    //   const expectedExecutions = 3

    //   const taskId = timer.addTask(delayMicroseconds, intervalMicroseconds)

    //   // Wait for multiple executions
    //   await new Promise((resolve) => setTimeout(resolve, 150))

    //   // Cancel the task to stop further executions
    //   const cancelled = timer.cancelTask(taskId)
    //   expect(cancelled).toBe(true)

    //   // Should have at least 3 executions
    //   expect(executedTasks.length).toBeGreaterThanOrEqual(expectedExecutions)

    //   // Check that all executions are for the same task
    //   executedTasks.forEach((task) => {
    //     expect(task.taskId).toBe(taskId)
    //   })

    //   // Check interval accuracy (compare consecutive executions)
    //   for (let i = 1; i < Math.min(executedTasks.length, expectedExecutions); i++) {
    //     const actualInterval = executionTimes[i] - executionTimes[i - 1]
    //     console.log(actualInterval, intervalMicroseconds)
    //     expect(Math.abs(actualInterval - intervalMicroseconds)).toBeLessThan(tolerance)
    //   }
    // })
    // it('should execute recurring tasks with accurate intervals high performance', async () => {
    //   timer.create()

    //   const delayMicroseconds = 20000 // 20ms initial delay
    //   const intervalMicroseconds = 3000 // 1ms interval
    //   const tolerance = 1000 // 1ms tolerance
    //   const expectedExecutions = 10

    //   const taskId = timer.addTask(delayMicroseconds, intervalMicroseconds)

    //   // Wait for multiple executions
    //   await new Promise((resolve) => setTimeout(resolve, 1000))

    //   // Cancel the task to stop further executions
    //   const cancelled = timer.cancelTask(taskId)
    //   expect(cancelled).toBe(true)

    //   // Check that all executions are for the same task
    //   executedTasks.forEach((task) => {
    //     expect(task.taskId).toBe(taskId)
    //   })

    //   // Check interval accuracy (compare consecutive executions)
    //   for (let i = 1; i < Math.min(executedTasks.length, expectedExecutions); i++) {
    //     const actualInterval = executionTimes[i] - executionTimes[i - 1]
    //     console.log(actualInterval, intervalMicroseconds)
    //     expect(Math.abs(actualInterval - intervalMicroseconds)).toBeLessThan(tolerance)
    //   }
    // })

    // it('should handle multiple concurrent tasks with different timings', async () => {
    //   timer.create()

    //   const task1Delay = 30000 // 30ms
    //   const task2Delay = 2000 // 2ms
    //   const task3Delay = 70000 // 70ms
    //   const tolerance = 5000 // 5ms tolerance

    //   const startTime = getTsUs()

    //   const taskId1 = timer.addTask(task1Delay, 0)
    //   const taskId2 = timer.addTask(task2Delay, 0)
    //   const taskId3 = timer.addTask(task3Delay, 0)

    //   // Wait for all tasks to complete
    //   await new Promise((resolve) => setTimeout(resolve, 120))

    //   expect(executedTasks).toHaveLength(3)

    //   // Tasks should be executed in order of their trigger times, not insertion order
    //   // Expected execution order: task2 (20ms), task1 (30ms), task3 (70ms)

    //   // Find each task by its taskId in the executed tasks
    //   const task1Result = executedTasks.find((task) => task.taskId === taskId1)
    //   const task2Result = executedTasks.find((task) => task.taskId === taskId2)
    //   const task3Result = executedTasks.find((task) => task.taskId === taskId3)

    //   expect(task1Result).toBeDefined()
    //   expect(task2Result).toBeDefined()
    //   expect(task3Result).toBeDefined()

    //   // Find the execution times for each task
    //   const task1Index = executedTasks.findIndex((task) => task.taskId === taskId1)
    //   const task2Index = executedTasks.findIndex((task) => task.taskId === taskId2)
    //   const task3Index = executedTasks.findIndex((task) => task.taskId === taskId3)

    //   const task1ActualDelay = executionTimes[task1Index] - startTime
    //   const task2ActualDelay = executionTimes[task2Index] - startTime
    //   const task3ActualDelay = executionTimes[task3Index] - startTime

    //   console.log('Task1 (30ms):', task1ActualDelay, 'Expected:', task1Delay)
    //   console.log('Task2 (20ms):', task2ActualDelay, 'Expected:', task2Delay)
    //   console.log('Task3 (70ms):', task3ActualDelay, 'Expected:', task3Delay)

    //   // Verify timing accuracy for each task
    //   expect(Math.abs(task1ActualDelay - task1Delay)).toBeLessThan(tolerance)
    //   expect(Math.abs(task2ActualDelay - task2Delay)).toBeLessThan(tolerance)
    //   expect(Math.abs(task3ActualDelay - task3Delay)).toBeLessThan(tolerance)

    //   // Verify execution order: task2 should execute before task1, task1 before task3
    //   expect(task2Index).toBeLessThan(task1Index)
    //   expect(task1Index).toBeLessThan(task3Index)
    // })
  })

  // describe('Resource Management Tests', () => {
  //   it('should properly create and destroy timer', () => {
  //     expect(() => timer.create()).not.toThrow()
  //     expect(() => timer.destroy()).not.toThrow()

  //     // Should be able to create again after destroy
  //     expect(() => timer.create()).not.toThrow()
  //     expect(() => timer.destroy()).not.toThrow()
  //   })

  //   it('should handle multiple destroy calls gracefully', () => {
  //     timer.create()
  //     expect(() => timer.destroy()).not.toThrow()
  //     expect(() => timer.destroy()).not.toThrow() // Should not throw on second destroy
  //     expect(() => timer.destroy()).not.toThrow() // Should not throw on third destroy
  //   })

  //   it('should clean up all tasks when destroyed', async () => {
  //     timer.create()

  //     // Add multiple tasks
  //     timer.addTask(100000, 50000) // Recurring task
  //     timer.addTask(200000, 0) // Single task

  //     // Destroy timer before tasks complete
  //     timer.destroy()

  //     // Wait to see if any tasks execute (they shouldn't)
  //     await new Promise((resolve) => setTimeout(resolve, 250))

  //     expect(executedTasks).toHaveLength(0)
  //   })
  // })

  //   describe('Dynamic Task Management Tests', () => {
  //     it('should handle adding tasks while other tasks are running', async () => {
  //       timer.create()

  //       // Add initial recurring task
  //       const initialTaskId = timer.addTask(20000, 40000, { id: 'initial', type: 'recurring' })

  //       // Wait for first execution
  //       await new Promise(resolve => setTimeout(resolve, 30))

  //       // Add new task while initial task is running
  //       const newTaskId = timer.addTask(30000, 0, { id: 'new', type: 'single' })

  //       // Wait for both tasks to execute
  //       await new Promise(resolve => setTimeout(resolve, 80))

  //       // Cancel recurring task
  //       timer.cancelTask(initialTaskId)

  //       // Wait a bit more
  //       await new Promise(resolve => setTimeout(resolve, 50))

  //       // Should have executions from both tasks
  //       const initialTaskExecutions = executedTasks.filter(task => task.userData.id === 'initial')
  //       const newTaskExecutions = executedTasks.filter(task => task.userData.id === 'new')

  //       expect(initialTaskExecutions.length).toBeGreaterThanOrEqual(1)
  //       expect(newTaskExecutions).toHaveLength(1)

  //       // New task should not interfere with initial task's timing
  //       expect(initialTaskExecutions[0].taskId).toBe(initialTaskId)
  //       expect(newTaskExecutions[0].taskId).toBe(newTaskId)
  //     })

  //     it('should handle rapid task additions', async () => {
  //       timer.create()

  //       const taskIds: number[] = []
  //       const numTasks = 10
  //       const baseDelay = 50000 // 50ms

  //       // Add multiple tasks rapidly
  //       for (let i = 0; i < numTasks; i++) {
  //         const taskId = timer.addTask(baseDelay + i * 10000, 0, { index: i })
  //         taskIds.push(taskId)
  //       }

  //       // Wait for all tasks to complete
  //       await new Promise(resolve => setTimeout(resolve, 200))

  //       expect(executedTasks).toHaveLength(numTasks)

  //       // All tasks should have executed
  //       for (let i = 0; i < numTasks; i++) {
  //         const taskExecution = executedTasks.find(task => task.userData.index === i)
  //         expect(taskExecution).toBeDefined()
  //         expect(taskIds).toContain(taskExecution!.taskId)
  //       }
  //     })
  //   })

  //   describe('Task Cancellation Tests', () => {
  //     it('should successfully cancel single execution tasks', async () => {
  //       timer.create()

  //       const taskId = timer.addTask(100000, 0, { id: 'to-cancel' }) // 100ms delay

  //       // Cancel task before it executes
  //       const cancelled = timer.cancelTask(taskId)
  //       expect(cancelled).toBe(true)

  //       // Wait longer than the original delay
  //       await new Promise(resolve => setTimeout(resolve, 150))

  //       expect(executedTasks).toHaveLength(0)
  //     })

  //     it('should successfully cancel recurring tasks', async () => {
  //       timer.create()

  //       const taskId = timer.addTask(30000, 40000, { id: 'recurring-to-cancel' })

  //       // Wait for first execution
  //       await new Promise(resolve => setTimeout(resolve, 50))
  //       expect(executedTasks.length).toBeGreaterThanOrEqual(1)

  //       const executionsBeforeCancel = executedTasks.length

  //       // Cancel the task
  //       const cancelled = timer.cancelTask(taskId)
  //       expect(cancelled).toBe(true)

  //       // Wait for what would be the next interval
  //       await new Promise(resolve => setTimeout(resolve, 60))

  //       // Should not have any new executions
  //       expect(executedTasks).toHaveLength(executionsBeforeCancel)
  //     })

  //     it('should handle cancelling non-existent tasks', () => {
  //       timer.create()

  //       const cancelled = timer.cancelTask(99999) // Non-existent task ID
  //       expect(cancelled).toBe(false)
  //     })
  //   })

  //   describe('Error Handling Tests', () => {
  //     it('should throw error when creating timer twice', () => {
  //       timer.create()
  //       expect(() => timer.create()).toThrow('Timer already created')
  //     })

  //     it('should throw error when adding task to non-created timer', () => {
  //       expect(() => timer.addTask(1000, 0)).toThrow('Timer not created')
  //     })

  //     it('should throw error when cancelling task on non-created timer', () => {
  //       expect(() => timer.cancelTask(1)).toThrow('Timer not created')
  //     })

  //     it('should handle operations on destroyed timer', () => {
  //       timer.create()
  //       timer.destroy()

  //       expect(() => timer.addTask(1000, 0)).toThrow('Timer not created')
  //       expect(() => timer.cancelTask(1)).toThrow('Timer not created')
  //     })
  //   })

  //   describe('Utility Functions Tests', () => {
  //     it('should provide current timestamp', () => {
  //       const timestamp1 = PrecisionTimer.getCurrentTimestamp()
  //       expect(typeof timestamp1).toBe('number')
  //       expect(timestamp1).toBeGreaterThan(0)

  //       // Wait a bit and get another timestamp
  //       setTimeout(() => {
  //         const timestamp2 = PrecisionTimer.getCurrentTimestamp()
  //         expect(timestamp2).toBeGreaterThan(timestamp1)
  //       }, 1)
  //     })
  //   })

  //   describe('Edge Cases Tests', () => {
  //     it('should handle very short delays', async () => {
  //       timer.create()

  //       const shortDelay = 1000 // 1ms
  //       const tolerance = 2000 // 2ms tolerance for very short delays

  //       const startTime = PrecisionTimer.getCurrentTimestamp()
  //       timer.addTask(shortDelay, 0, { test: 'short-delay' })

  //       await new Promise(resolve => setTimeout(resolve, 20))

  //       expect(executedTasks).toHaveLength(1)
  //       const actualDelay = executionTimes[0] - startTime
  //       expect(Math.abs(actualDelay - shortDelay)).toBeLessThan(tolerance)
  //     })

  //     it('should handle zero delay tasks', async () => {
  //       timer.create()

  //       const startTime = PrecisionTimer.getCurrentTimestamp()
  //       timer.addTask(0, 0, { test: 'zero-delay' })

  //       await new Promise(resolve => setTimeout(resolve, 20))

  //       expect(executedTasks).toHaveLength(1)
  //       const actualDelay = executionTimes[0] - startTime
  //       expect(actualDelay).toBeLessThan(5000) // Should execute very quickly
  //     })

  //     it('should handle tasks with user data of different types', async () => {
  //       timer.create()

  //       const testData = [
  //         { type: 'string', value: 'test string' },
  //         { type: 'number', value: 42 },
  //         { type: 'object', value: { nested: { prop: 'value' } } },
  //         { type: 'array', value: [1, 2, 3, 'test'] },
  //         { type: 'null', value: null },
  //         { type: 'undefined', value: undefined }
  //       ]

  //       testData.forEach((data, index) => {
  //         timer.addTask(10000 + index * 5000, 0, data.value)
  //       })

  //       await new Promise(resolve => setTimeout(resolve, 100))

  //       expect(executedTasks).toHaveLength(testData.length)

  //       executedTasks.forEach((task, index) => {
  //         expect(task.userData).toEqual(testData[index].value)
  //       })
  //     })
  //   })
})
