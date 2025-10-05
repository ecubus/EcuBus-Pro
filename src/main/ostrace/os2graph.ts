import { TaskType, OsEvent, VisibleBlock } from '../share/osEvent'

export default function os2block(
  events: OsEvent[],
  coreFreq: number,
  maxts?: number
): { blocks: VisibleBlock[]; minTs: number; maxTs: number } {
  const blocks: VisibleBlock[] = []
  let minTs = 0
  let maxTs = 0
  //coreFreq is in MHz
  coreFreq = coreFreq * 1000000

  maxts = maxts || 0x100000000 // 2^32 for 32-bit timestamp overflow
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

  // Helper function to get entity ID from event (simplified)
  const getEntityId = (event: OsEvent): number => {
    return event.id
  }

  // Helper function to get core ID from event (simplified)
  const getCoreId = (event: OsEvent): number => {
    return event.coreId
  }

  // Helper function to get status from event (simplified)
  const getStatus = (event: OsEvent): number => {
    return event.status
  }

  // Helper function to determine if event should start a block
  const shouldStartBlock = (event: OsEvent): boolean => {
    switch (event.type) {
      case TaskType.TASK:
        return true // All TASK status changes should create blocks
      case TaskType.ISR:
        return event.status === 0 // START
      case TaskType.SPINLOCK:
        return event.status === 0 // LOCKED
      case TaskType.RESOURCE:
        return event.status === 0 // START
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
        return event.status === 5 || event.status === 4 // TERMINATE or PREEMPT
      case TaskType.ISR:
        return event.status === 1 // STOP
      case TaskType.SPINLOCK:
        return event.status === 1 // UNLOCKED
      case TaskType.RESOURCE:
        return event.status === 1 // STOP
      default:
        return false
    }
  }

  // Helper function to create LIN block for context switching
  // const createLinBlock = (from: string, to: string, coreId: number, timestamp: number): void => {
  //   const linBlock: VisibleBlock = {
  //     type: TaskType.LINE,
  //     id: 0,
  //     start: timestamp,
  //     end: undefined, // LIN blocks have undefined end time as per requirements
  //     coreId: coreId,
  //     status: `${from}:${to}`
  //   }
  //   blocks.push(linBlock)
  // }
  let lastRawTs = 0
  let overflowTime = 0

  // Process events in chronological order
  events.forEach((event, index) => {
    const entityId = getEntityId(event)
    const coreId = getCoreId(event)
    const key = createKey(coreId, event.type, entityId)

    // Check for overflow by comparing raw timestamps
    if (event.ts < lastRawTs) {
      overflowTime++
    }
    lastRawTs = event.ts

    // Calculate adjusted timestamp with overflow compensation
    const ts = event.ts + overflowTime * maxts
    const timestamp = ts / coreFreq // Convert to seconds
    if (timestamp < minTs) {
      minTs = timestamp
    }
    if (timestamp > maxTs) {
      maxTs = timestamp
    }

    if (event.type === TaskType.ISR) {
      //start
      if (event.status === 0) {
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
          block.block.endStatus = event.status
          blocks.push(block.block)
          activeBlocks.delete(key)
        }
      }
    } else if (event.type === TaskType.TASK) {
      //active
      if (event.status === 0) {
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
          block.block.endStatus = event.status
          blocks.push(block.block)
          activeBlocks.delete(key)
        }
        if (event.status == 1 || event.status == 4) {
          activeBlocks.set(key, {
            block: {
              start: timestamp,
              end: undefined,
              coreId: coreId,
              status: event.status,
              type: TaskType.TASK,
              id: entityId
            },
            startIndex: index
          })
        }
      }
    } else if (event.type === TaskType.SPINLOCK) {
      if (event.status === 0) {
        activeBlocks.set(key, {
          block: {
            start: timestamp,
            end: undefined,
            coreId: coreId,
            status: 0,
            type: TaskType.SPINLOCK,
            id: entityId
          },
          startIndex: index
        })
      } else {
        const block = activeBlocks.get(key)
        if (block) {
          block.block.end = timestamp
          block.block.endStatus = event.status
          blocks.push(block.block)
          activeBlocks.delete(key)
        }
      }
    } else if (event.type === TaskType.RESOURCE) {
      if (event.status === 0) {
        activeBlocks.set(key, {
          block: {
            start: timestamp,
            end: undefined,
            coreId: coreId,
            status: 0,
            type: TaskType.RESOURCE,
            id: entityId
          },
          startIndex: index
        })
      } else {
        const block = activeBlocks.get(key)
        if (block) {
          block.block.end = timestamp
          block.block.endStatus = event.status
          blocks.push(block.block)
          activeBlocks.delete(key)
        }
      }
    } else {
      blocks.push({
        type: event.type,
        id: entityId,
        start: timestamp,
        end: undefined,
        coreId: coreId,
        status: getStatus(event)
      })
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
  return {
    blocks,
    minTs,
    maxTs
  }
}
