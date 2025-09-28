import {
  OsEvent,
  TaskType,
  TaskStatus,
  IsrStatus,
  SpinlockStatus,
  ResourceStatus
} from '../share/osEvent'
import * as ExcelJS from 'exceljs'

/**
 * Convert Excel row data to OsEvent object using fixed column positions
 * @param rowData Array containing row values [ts, type, id, status]
 * @returns OsEvent | null
 */
function rowDataToOsEvent(rowData: any[]): OsEvent | null {
  // Fixed column positions: [时间戳, 标识, ID, 状态]
  const ts = parseTimestamp(rowData[0]) // 第1列：时间戳
  const type = parseTaskType(rowData[1]) // 第2列：运行对象标识
  const objectId = parseInt(rowData[2] || '0') // 第3列：运行对象ID
  const statusOrParam = parseInt(rowData[3] || '0') // 第4列：运行状态

  const comment = '' // No comment column in your format
  const coreId = 0 // Default core ID

  if (type === null || ts === null) {
    return null // Skip invalid rows
  }

  let event: any

  switch (type) {
    case TaskType.TASK:
      event = {
        status: parseTaskStatus(statusOrParam),
        taskId: objectId,
        coreId
      }
      break

    case TaskType.ISR:
      event = {
        status: parseIsrStatus(statusOrParam),
        isrId: objectId,
        coreId
      }
      break

    case TaskType.SPINLOCK:
      event = {
        status: parseSpinlockStatus(statusOrParam),
        spinlockId: objectId,
        coreId
      }
      break

    case TaskType.RESOURCE:
      event = {
        status: parseResourceStatus(statusOrParam),
        resourceId: objectId,
        coreId
      }
      break

    case TaskType.HOOK:
      event = {
        hookParam: statusOrParam,
        hookType: 0, // Default hook type since we only have 4 columns
        coreId
      }
      break

    case TaskType.SERVICE:
      event = {
        serviceParam: statusOrParam,
        serviceId: objectId,
        coreId
      }
      break

    default:
      return null
  }

  return {
    type,
    event,
    ts,
    comment
  } as OsEvent
}

/**
 * Parse task type from string or number (4-bit identifier)parseTaskType
 */
function parseTaskType(value: any): TaskType {
  value = parseInt(value)
  // Handle 4-bit identifier values (0-15)
  switch (value) {
    case 0:
      return TaskType.TASK
    case 1:
      return TaskType.ISR
    case 2:
      return TaskType.SPINLOCK
    case 3:
      return TaskType.RESOURCE
    case 4:
      return TaskType.HOOK
    case 5:
      return TaskType.SERVICE
    default:
      throw new Error(`Invalid task type: ${value}`)
  }
}

/**
 * Parse task status from string
 */
function parseTaskStatus(value: any): TaskStatus {
  value = parseInt(value)
  switch (value) {
    case 0:
      return TaskStatus.ACTIVE
    case 1:
      return TaskStatus.START
    case 2:
      return TaskStatus.WAIT
    case 3:
      return TaskStatus.RELEASE
    case 4:
      return TaskStatus.PREEMPT
    case 5:
      return TaskStatus.TERMINATE
    default:
      throw new Error(`Invalid task status: ${value}`)
  }
}

/**
 * Parse ISR status from string
 */
function parseIsrStatus(value: any): IsrStatus {
  value = parseInt(value)
  switch (value) {
    case 0:
      return IsrStatus.START
    case 1:
      return IsrStatus.STOP
    default:
      throw new Error(`Invalid isr status: ${value}`)
  }
}

/**
 * Parse spinlock status from string
 */
function parseSpinlockStatus(value: any): SpinlockStatus {
  value = parseInt(value)

  switch (value) {
    case 0:
      return SpinlockStatus.LOCKED
    case 1:
      return SpinlockStatus.UNLOCKED
    default:
      throw new Error(`Invalid spinlock status: ${value}`)
  }
}

/**
 * Parse resource status from string
 */
function parseResourceStatus(value: any): ResourceStatus {
  value = parseInt(value)

  switch (value) {
    case 0:
      return ResourceStatus.START
    case 1:
      return ResourceStatus.STOP
    default:
      throw new Error(`Invalid resource status: ${value}`)
  }
}

/**
 * Parse timestamp from various formats
 */
function parseTimestamp(value: any): number {
  value = parseInt(value)
  return value
}

/**
 * Parse Excel file and extract eventList from the first sheet
 * @param filePath Path to the Excel file
 * @returns Promise<OsEvent[]> Array of parsed OS events
 */
export async function parseExcelFromFile(filePath: string): Promise<OsEvent[]> {
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)

    // Get the first worksheet
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      throw new Error('No worksheets found in the Excel file')
    }

    const eventList: OsEvent[] = []

    // Skip header row, parse data rows starting from row 2
    // Fixed column positions: [时间戳, 标识, ID, 状态]
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header row

      // Extract values by column position (1-based indexing)
      const rowData: any[] = []
      rowData[0] = row.getCell(1).value // 第1列：时间戳
      rowData[1] = row.getCell(2).value // 第2列：运行对象标识
      rowData[2] = row.getCell(3).value // 第3列：运行对象ID
      rowData[3] = row.getCell(4).value // 第4列：运行状态

      // Convert row data to OsEvent
      const event = rowDataToOsEvent(rowData)
      if (event) {
        eventList.push(event)
      }
    })

    return eventList
  } catch (error) {
    console.error('Error parsing Excel file:', error)
    throw error
  }
}

/**
 * Async version for parsing Excel data from Uint8Array buffer
 * @param buffer Uint8Array containing Excel file data
 * @returns Promise<OsEvent[]> Array of parsed OS events
 */
export async function parseExcel(buffer: ArrayBuffer): Promise<OsEvent[]> {
  try {
    const workbook = new ExcelJS.Workbook()

    // Load Excel data from buffer using stream approach

    await workbook.xlsx.load(buffer)

    // Get the first worksheet
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      throw new Error('No worksheets found in the Excel buffer')
    }

    const eventList: OsEvent[] = []

    // Skip header row, parse data rows starting from row 2
    // Fixed column positions: [时间戳, 标识, ID, 状态]
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header row

      // Extract values by column position (1-based indexing)
      const rowData: any[] = []
      rowData[0] = row.getCell(1).value // 第1列：时间戳
      rowData[1] = row.getCell(2).value // 第2列：运行对象标识
      rowData[2] = row.getCell(3).value // 第3列：运行对象ID
      rowData[3] = row.getCell(4).value // 第4列：运行状态

      // Convert row data to OsEvent
      const event = rowDataToOsEvent(rowData)
      if (event) {
        eventList.push(event)
      }
    })

    return eventList
  } catch (error) {
    console.error('Error parsing Excel buffer:', error)
    throw error
  }
}
