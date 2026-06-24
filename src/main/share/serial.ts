import type { CanVendor } from './can'

/**
 * A physical serial port enumerated from the host OS.
 * @category Serial
 */
export interface SerialDevice {
  /** Human readable label (friendly name, falls back to path) */
  label: string
  /** Unique id (serial port path) */
  id: string
  /** Port path passed to the serialport driver (e.g. 'COM3', '/dev/ttyUSB0') */
  handle: string
  /** Hardware serial number if reported by the OS */
  serialNumber?: string
  busy?: boolean
}

/**
 * Configuration of a serial (UART) hardware device stored in the project.
 * @category Serial
 */
export interface SerialBaseInfo {
  id: string
  device: SerialDevice
  baudRate: number
  dataBits: 5 | 6 | 7 | 8
  stopBits: 1 | 1.5 | 2
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space'
  vendor: CanVendor
  name: string
}

/**
 * A serial frame (raw byte stream) sent (`OUT`) or received (`IN`) on a serial device.
 * @category Serial
 */
export interface SerialMessage {
  /** Direction relative to the host: `OUT` = host -> device, `IN` = device -> host */
  dir: 'OUT' | 'IN'
  /** Raw bytes */
  data: Buffer
  /** Timestamp relative to start, in microseconds */
  ts: number
  /** Device name */
  name: string
  /** Device id this frame belongs to */
  device: string
  /** uuid of the node that produced an `OUT` frame (used to suppress echo) */
  uuid?: string
}
