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
      default:
        return 0
    }
  }

  // Helper function to determine if event should start a block
  const shouldStartBlock = (event: OsEvent): boolean => {
    switch (event.type) {
      case TaskType.TASK:
        return event.event.status === 1 // START
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

  // Process events in chronological order
  events.forEach((event, index) => {
    const entityId = getEntityId(event)
    const coreId = getCoreId(event)
    const key = createKey(coreId, event.type, entityId)
    const timestamp = event.ts / 1000000 // Convert to seconds

    if (shouldStartBlock(event)) {
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
    } else if (shouldEndBlock(event)) {
      // End the active block for this entity
      if (activeBlocks.has(key)) {
        const activeBlock = activeBlocks.get(key)!
        activeBlock.block.end = timestamp
        activeBlocks.delete(key)
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
  //sort blocks by start time
  blocks.sort((a, b) => a.start - b.start)
  return blocks
}
