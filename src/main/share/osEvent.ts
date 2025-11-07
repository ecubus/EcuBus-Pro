export enum TaskStatus {
  ACTIVE = 0,
  START = 1,
  WAIT = 2,
  RELEASE = 3,
  PREEMPT = 4,
  TERMINATE = 5
}

export interface TaskEvent {
  status: TaskStatus
  taskId: number
  coreId: number
}

export enum IsrStatus {
  START = 0,
  STOP = 1
}

export enum TaskType {
  TASK = 0,
  ISR = 1,
  SPINLOCK = 2,
  RESOURCE = 3,
  HOOK = 4,
  SERVICE = 5,
  LINE = -1
}

export enum SpinlockStatus {
  LOCKED = 0,
  UNLOCKED = 1
}

export enum ResourceStatus {
  START = 0,
  STOP = 1
}

export interface IsrEvent {
  status: IsrStatus
  isrId: number
  coreId: number
}

export interface SpinlockEvent {
  status: SpinlockStatus
  spinlockId: number
  coreId: number
}

export interface ResourceEvent {
  status: ResourceStatus
  resourceId: number
  coreId: number
}

export interface HookEvent {
  hookParam: number
  hookType: number
  coreId: number
}

export interface ServiceEvent {
  serviceParam: number
  serviceId: number
  coreId: number
}

export interface LineEvent {
  from: string
  to: string
  coreId: number
}

export const taskStatusRecord: Record<TaskStatus, string> = {
  [TaskStatus.ACTIVE]: 'Active',
  [TaskStatus.START]: 'Start',
  [TaskStatus.WAIT]: 'Wait',
  [TaskStatus.RELEASE]: 'Release',
  [TaskStatus.PREEMPT]: 'Preempt',
  [TaskStatus.TERMINATE]: 'Terminate'
}

export const taskTypeRecord: Record<TaskType, string> = {
  [TaskType.TASK]: 'Task',
  [TaskType.ISR]: 'ISR',
  [TaskType.SPINLOCK]: 'Spinlock',
  [TaskType.RESOURCE]: 'Resource',
  [TaskType.HOOK]: 'Hook',
  [TaskType.SERVICE]: 'Service',
  [TaskType.LINE]: 'Line'
}
export const isrStatusRecord: Record<IsrStatus, string> = {
  [IsrStatus.START]: 'Start',
  [IsrStatus.STOP]: 'Stop'
}
export function parseInfo(type: TaskType, status: number, br?: string): string {
  let str = ''
  switch (type) {
    case TaskType.TASK:
      str = `Task: ${taskStatusRecord[status as TaskStatus]}`
      break
    case TaskType.ISR:
      str = `ISR: ${isrStatusRecord[status as IsrStatus]}`
      break
    default:
      return ''
  }
  if (br) {
    str += br
  }
  return str
}

// Unified event structure to reduce computational overhead
export interface OsEvent {
  database?: string
  index?: number
  type: TaskType
  id: number
  status: number
  coreId: number
  ts: number
  comment: string
}
