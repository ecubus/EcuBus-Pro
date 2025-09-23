import { TaskType, OsEvent } from './osEvent'

interface VisibleBlock {
  type: TaskType
  name: string
  start: number
  end?: number
  coreId: number
  status: number
}

export default function os2block(events: OsEvent[]): VisibleBlock[] {
  const blocks: VisibleBlock[] = []

  // Track active blocks for each core and entity
  const activeBlocks = new Map<
    string,
    {
      block: VisibleBlock
      startIndex: number
    }
  >()

  // Track what is currently running on each core (for ISR preemption handling)
  const coreRunningState = new Map<
    number,
    {
      type: TaskType.TASK | TaskType.ISR
      entityId: number
      key: string
    }
  >()

  // Track interrupted contexts for each core (stack-like structure for nested interrupts)
  const interruptedStack = new Map<
    number,
    Array<{
      type: TaskType.TASK | TaskType.ISR
      entityId: number
      key: string
    }>
  >()

  // Track active resource and spinlock blocks per task/ISR
  const taskIsrResourceSpinlocks = new Map<
    string, // key = coreId-taskType-entityId
    Array<{
      type: TaskType.RESOURCE | TaskType.SPINLOCK
      entityId: number
      key: string
      block: VisibleBlock
    }>
  >()

  // Helper function to create a unique key for tracking active blocks
  const createKey = (coreId: number, type: TaskType, entityId: number): string => {
    return `${coreId}-${type}-${entityId}`
  }

  // Helper function to get entity ID from event
  const getEntityId = (event: OsEvent): number => {
    switch (event.type) {
      case TaskType.TASK:
        return event.event.taskId
      case TaskType.ISR:
        return event.event.isrId
      case TaskType.SPINLOCK:
        return event.event.spinlockId
      case TaskType.RESOURCE:
        return event.event.resourceId
      case TaskType.HOOK:
        return event.event.hookType
      case TaskType.SERVICE:
        return event.event.serviceId
      case TaskType.LINE:
        return 0 // LIN blocks don't have entity IDs
      default:
        return 0
    }
  }

  // Helper function to get entity name
  const getEntityName = (event: OsEvent): string => {
    const entityId = getEntityId(event)
    switch (event.type) {
      case TaskType.TASK:
        return `Task_${entityId}`
      case TaskType.ISR:
        return `ISR_${entityId}`
      case TaskType.SPINLOCK:
        return `Spinlock_${entityId}`
      case TaskType.RESOURCE:
        return `Resource_${entityId}`
      case TaskType.HOOK:
        return `Hook_${entityId}`
      case TaskType.SERVICE:
        return `Service_${entityId}`
      case TaskType.LINE:
        return `${event.event.from}:${event.event.to}`
      default:
        return `Unknown_${entityId}`
    }
  }

  // Helper function to get core ID from event
  const getCoreId = (event: OsEvent): number => {
    switch (event.type) {
      case TaskType.TASK:
        return event.event.coreId
      case TaskType.ISR:
        return event.event.coreId
      case TaskType.SPINLOCK:
        return event.event.coreId
      case TaskType.RESOURCE:
        return event.event.coreId
      case TaskType.HOOK:
        return event.event.coreId
      case TaskType.SERVICE:
        return event.event.coreId
      case TaskType.LINE:
        return event.event.coreId
      default:
        return 0
    }
  }

  // Helper function to get status from event
  const getStatus = (event: OsEvent): number => {
    switch (event.type) {
      case TaskType.TASK:
        return event.event.status
      case TaskType.ISR:
        return event.event.status
      case TaskType.SPINLOCK:
        return event.event.status
      case TaskType.RESOURCE:
        return event.event.status
      case TaskType.LINE:
        return 0 // LIN blocks don't have status
      default:
        return 0
    }
  }

  // Helper function to determine if event should start a block
  const shouldStartBlock = (event: OsEvent): boolean => {
    switch (event.type) {
      case TaskType.TASK:
        return true // All TASK status changes should create blocks
      case TaskType.ISR:
        return event.event.status === 0 // START
      case TaskType.SPINLOCK:
        return event.event.status === 0 // LOCKED
      case TaskType.RESOURCE:
        return event.event.status === 0 // START
      case TaskType.HOOK:
      case TaskType.SERVICE:
        return true // These are typically point events that create instant blocks
      default:
        return false
    }
  }

  // Helper function to determine if event should end a block
  const shouldEndBlock = (event: OsEvent): boolean => {
    switch (event.type) {
      case TaskType.TASK:
        return false // TASK blocks will be ended by the next TASK event, not by specific status
      case TaskType.ISR:
        return event.event.status === 1 // STOP
      case TaskType.SPINLOCK:
        return event.event.status === 1 // UNLOCKED
      case TaskType.RESOURCE:
        return event.event.status === 1 // STOP
      default:
        return false
    }
  }

  // Helper function to interrupt resource and spinlock blocks for a specific task/ISR
  const interruptResourceSpinlocks = (ownerKey: string, timestamp: number): void => {
    const resourceSpinlocks = taskIsrResourceSpinlocks.get(ownerKey)
    if (resourceSpinlocks) {
      resourceSpinlocks.forEach((item) => {
        // End the current resource/spinlock block
        item.block.end = timestamp
      })
    }
  }

  // Helper function to resume resource and spinlock blocks for a specific task/ISR
  const resumeResourceSpinlocks = (ownerKey: string, timestamp: number): void => {
    const resourceSpinlocks = taskIsrResourceSpinlocks.get(ownerKey)
    if (resourceSpinlocks) {
      resourceSpinlocks.forEach((item) => {
        // Create a new block to resume the resource/spinlock
        const resumeBlock: VisibleBlock = {
          type: item.type,
          name: item.block.name,
          start: timestamp,
          coreId: item.block.coreId,
          status: item.block.status
        }
        blocks.push(resumeBlock)

        // Update the active block reference
        activeBlocks.set(item.key, {
          block: resumeBlock,
          startIndex: blocks.length - 1
        })

        // Update the item reference
        item.block = resumeBlock
      })
    }
  }

  // Helper function to create LIN block for context switching
  const createLinBlock = (from: string, to: string, coreId: number, timestamp: number): void => {
    const linBlock: VisibleBlock = {
      type: TaskType.LINE,
      name: `${from}:${to}`,
      start: timestamp,
      end: undefined, // LIN blocks have undefined end time as per requirements
      coreId: coreId,
      status: 0
    }
    blocks.push(linBlock)
  }

  // Process events in chronological order
  events.forEach((event, index) => {
    const entityId = getEntityId(event)
    const coreId = getCoreId(event)
    const key = createKey(coreId, event.type, entityId)
    const timestamp = event.ts / 1000000 // Convert to seconds

    // Handle ISR preemption logic
    if (event.type === TaskType.ISR) {
      if (event.event.status === 0) {
        // ISR START
        // ISR is starting - interrupt whatever is currently running on this core
        const currentRunning = coreRunningState.get(coreId)
        if (currentRunning) {
          // Create LIN block for the transition from current running context to ISR
          // For tasks, only create LIN block if the task is active (status = 0)
          let shouldCreateLinBlock = true
          if (currentRunning.type === TaskType.TASK) {
            const currentTaskBlock = activeBlocks.get(currentRunning.key)
            shouldCreateLinBlock = !!(currentTaskBlock && currentTaskBlock.block.status === 1) // TaskStatus.ACTIVE
          }

          if (shouldCreateLinBlock) {
            const fromName =
              currentRunning.type === TaskType.TASK
                ? `Task_${currentRunning.entityId}`
                : `ISR_${currentRunning.entityId}`
            const toName = `ISR_${entityId}`
            createLinBlock(fromName, toName, coreId, timestamp)
          }

          // End the current block (TASK or ISR being interrupted)
          const currentBlock = activeBlocks.get(currentRunning.key)
          if (currentBlock) {
            currentBlock.block.end = timestamp
            // Don't delete from activeBlocks yet - we'll resume it later
          }

          // Push the interrupted context onto the stack
          if (!interruptedStack.has(coreId)) {
            interruptedStack.set(coreId, [])
          }
          interruptedStack.get(coreId)!.push(currentRunning)
        }

        // Interrupt any active resource and spinlock blocks owned by the interrupted task/ISR
        if (currentRunning) {
          interruptResourceSpinlocks(currentRunning.key, timestamp)
        }

        // Start ISR block
        const newBlock: VisibleBlock = {
          type: event.type,
          name: getEntityName(event),
          start: timestamp,
          coreId: coreId,
          status: getStatus(event)
        }
        blocks.push(newBlock)
        activeBlocks.set(key, {
          block: newBlock,
          startIndex: blocks.length - 1
        })

        // Update core running state
        coreRunningState.set(coreId, {
          type: TaskType.ISR,
          entityId: entityId,
          key: key
        })
      } else if (event.event.status === 1) {
        // ISR STOP
        // End ISR block
        if (activeBlocks.has(key)) {
          const activeBlock = activeBlocks.get(key)!
          activeBlock.block.end = timestamp
          activeBlocks.delete(key)
        }

        // Resume the most recently interrupted context from the stack
        const stack = interruptedStack.get(coreId)
        if (stack && stack.length > 0) {
          // Pop the most recently interrupted context
          const interruptedContext = stack.pop()!

          // Create LIN block for the transition from ISR back to the interrupted context
          // For tasks, only create LIN block if the task will be active (status = 0)
          let shouldCreateLinBlock = true
          if (interruptedContext.type === TaskType.TASK) {
            const interruptedTaskBlock = activeBlocks.get(interruptedContext.key)
            shouldCreateLinBlock = !!(
              interruptedTaskBlock && interruptedTaskBlock.block.status === 1
            ) // TaskStatus.ACTIVE
          }

          if (shouldCreateLinBlock) {
            const fromName = `ISR_${entityId}`
            const toName =
              interruptedContext.type === TaskType.TASK
                ? `Task_${interruptedContext.entityId}`
                : `ISR_${interruptedContext.entityId}`
            createLinBlock(fromName, toName, coreId, timestamp)
          }

          // Resume the interrupted context by creating a new block
          const interruptedBlock = activeBlocks.get(interruptedContext.key)
          if (interruptedBlock) {
            const resumeBlock: VisibleBlock = {
              type: interruptedContext.type,
              name: interruptedBlock.block.name,
              start: timestamp,
              coreId: coreId,
              status: interruptedBlock.block.status
            }
            blocks.push(resumeBlock)

            // Update the active block reference
            activeBlocks.set(interruptedContext.key, {
              block: resumeBlock,
              startIndex: blocks.length - 1
            })

            // Update core running state
            coreRunningState.set(coreId, interruptedContext)
          }

          // Resume any interrupted resource and spinlock blocks owned by the resumed task/ISR
          resumeResourceSpinlocks(interruptedContext.key, timestamp)

          // Clean up empty stack
          if (stack.length === 0) {
            interruptedStack.delete(coreId)
          }
        } else {
          // No interrupted context, core is now idle
          coreRunningState.delete(coreId)
        }
      }
    } else if (shouldStartBlock(event)) {
      // Handle TASK and other events
      if (event.type === TaskType.TASK) {
        // Check if there's an ISR running on this core
        const currentRunning = coreRunningState.get(coreId)
        if (currentRunning && currentRunning.type === TaskType.ISR) {
          // Can't start TASK while ISR is running - this shouldn't happen in normal OS behavior
          // But if it does, we'll just queue the TASK event
          return
        }

        // Create LIN block for task switching (from previous task to new task)
        // Only create LIN block if both the current and new tasks are active (status = 0)
        if (
          currentRunning &&
          currentRunning.type === TaskType.TASK &&
          currentRunning.entityId !== entityId
        ) {
          const currentTaskBlock = activeBlocks.get(currentRunning.key)
          const isCurrentTaskActive = currentTaskBlock && currentTaskBlock.block.status === 1 // TaskStatus.ACTIVE
          const isNewTaskActive = getStatus(event) === 0 // TaskStatus.ACTIVE

          if (isCurrentTaskActive && isNewTaskActive) {
            const fromName = `Task_${currentRunning.entityId}`
            const toName = `Task_${entityId}`
            createLinBlock(fromName, toName, coreId, timestamp)
          }
        }
      }

      // End any existing active block for this entity
      if (activeBlocks.has(key)) {
        const activeBlock = activeBlocks.get(key)!
        activeBlock.block.end = timestamp
        activeBlocks.delete(key)
      }

      // Start a new block
      const newBlock: VisibleBlock = {
        type: event.type,
        name: getEntityName(event),
        start: timestamp,
        coreId: coreId,
        status: getStatus(event)
      }

      blocks.push(newBlock)
      activeBlocks.set(key, {
        block: newBlock,
        startIndex: blocks.length - 1
      })

      // Update core running state for TASK events
      if (event.type === TaskType.TASK) {
        coreRunningState.set(coreId, {
          type: TaskType.TASK,
          entityId: entityId,
          key: key
        })
      }

      // Track resource and spinlock blocks - associate them with the currently running task/ISR
      if (event.type === TaskType.RESOURCE || event.type === TaskType.SPINLOCK) {
        const currentRunning = coreRunningState.get(coreId)
        if (currentRunning) {
          // Associate this resource/spinlock with the currently running task/ISR
          if (!taskIsrResourceSpinlocks.has(currentRunning.key)) {
            taskIsrResourceSpinlocks.set(currentRunning.key, [])
          }
          taskIsrResourceSpinlocks.get(currentRunning.key)!.push({
            type: event.type,
            entityId: entityId,
            key: key,
            block: newBlock
          })
        }
      }
    } else if (shouldEndBlock(event)) {
      // End the active block for this entity
      if (activeBlocks.has(key)) {
        const activeBlock = activeBlocks.get(key)!
        activeBlock.block.end = timestamp
        activeBlocks.delete(key)

        // Update core running state
        if (event.type === TaskType.TASK) {
          coreRunningState.delete(coreId)
        }

        // Remove resource and spinlock blocks from tracking when they end
        if (event.type === TaskType.RESOURCE || event.type === TaskType.SPINLOCK) {
          // Find which task/ISR owns this resource/spinlock and remove it
          for (const [ownerKey, resourceSpinlocks] of taskIsrResourceSpinlocks.entries()) {
            const index = resourceSpinlocks.findIndex((item) => item.key === key)
            if (index !== -1) {
              resourceSpinlocks.splice(index, 1)
              // Clean up empty array
              if (resourceSpinlocks.length === 0) {
                taskIsrResourceSpinlocks.delete(ownerKey)
              }
              break
            }
          }
        }
      }
    } else if (event.type === TaskType.HOOK || event.type === TaskType.SERVICE) {
      // For HOOK and SERVICE events, create instant blocks (very short duration)
      const instantBlock: VisibleBlock = {
        type: event.type,
        name: getEntityName(event),
        start: timestamp,
        end: timestamp + 0.000001, // 1 microsecond duration for visibility
        coreId: coreId,
        status: getStatus(event)
      }
      blocks.push(instantBlock)
    }
  })

  // Close any remaining active blocks (set end to undefined, will be handled by rendering)
  activeBlocks.forEach(({ block }) => {
    // Leave end as undefined - the rendering code will use current time
    block.end = undefined
  })
  //sort blocks by start time, prioritize TASK and ISR when start times are equal
  blocks.sort((a, b) => {
    // First sort by start time
    if (a.start !== b.start) {
      return a.start - b.start
    }

    // If start times are equal, prioritize TASK and ISR types
    // TaskType.TASK = 0, TaskType.ISR = 1, others are higher values
    // Lower type values should come first when start times are equal
    return a.type - b.type
  })
  return blocks
}
