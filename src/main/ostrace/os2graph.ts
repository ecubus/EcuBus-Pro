import { TaskType, OsEvent } from '../share/osEvent'

interface VisibleBlock {
  type: TaskType
  id: number
  start: number
  end?: number
  coreId: number
  status: number | string
}

export default function os2block(events: OsEvent[], coreFreq: number): VisibleBlock[] {
  const blocks: VisibleBlock[] = []

  // Track active blocks for each core and entity
  const activeBlocks = new Map<
    string,
    {
      block: VisibleBlock
      startIndex: number
    }
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
        return event.event.status === 5 || event.event.status === 4 // TERMINATE or PREEMPT
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

  // Helper function to create LIN block for context switching
  const createLinBlock = (from: string, to: string, coreId: number, timestamp: number): void => {
    const linBlock: VisibleBlock = {
      type: TaskType.LINE,
      id: 0,
      start: timestamp,
      end: undefined, // LIN blocks have undefined end time as per requirements
      coreId: coreId,
      status: `${from}:${to}`
    }
    blocks.push(linBlock)
  }

  // Process events in chronological order
  events.forEach((event, index) => {
    const entityId = getEntityId(event)
    const coreId = getCoreId(event)
    const key = createKey(coreId, event.type, entityId)
    const timestamp = event.ts / coreFreq // Convert to seconds

    if (event.type === TaskType.ISR) {
      //start
      if (event.event.status === 0) {
        activeBlocks.set(key, {
          block: {
            start: timestamp,
            end: undefined,
            coreId: coreId,
            status: 0,
            type: TaskType.ISR,
            id: entityId
          },
          startIndex: index
        })
      } else {
        const block = activeBlocks.get(key)
        if (block) {
          block.block.end = timestamp
          blocks.push(block.block)
          activeBlocks.delete(key)
        }
      }
    } else if (event.type === TaskType.TASK) {
      //active
      if (event.event.status === 0) {
        activeBlocks.set(key, {
          block: {
            start: timestamp,
            end: undefined,
            coreId: coreId,
            status: 0,
            type: TaskType.TASK,
            id: entityId
          },
          startIndex: index
        })
      } else {
        const block = activeBlocks.get(key)
        if (block) {
          block.block.end = timestamp
          blocks.push(block.block)
          activeBlocks.delete(key)
        }
        if (event.event.status == 1 || event.event.status == 4) {
          activeBlocks.set(key, {
            block: {
              start: timestamp,
              end: undefined,
              coreId: coreId,
              status: event.event.status,
              type: TaskType.TASK,
              id: entityId
            },
            startIndex: index
          })
        }
      }
    }
  })

  // Close any remaining active blocks (set end to undefined, will be handled by rendering)
  activeBlocks.forEach(({ block }) => {
    // Leave end as undefined - the rendering code will use current time
    block.end = undefined
    blocks.push(block)
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
