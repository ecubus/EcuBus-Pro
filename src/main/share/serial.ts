export interface SerialDevice {
  label: string
  id: string
  handle: string // port path, e.g. 'COM3' or '/dev/ttyUSB0'
}

export interface SerialBaseInfo {
  id: string
  name: string
  vendor: 'serial'
  device: SerialDevice
  baudRate: number
  dataBits: 5 | 6 | 7 | 8
  stopBits: 1 | 1.5 | 2
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space'
}

export interface SerialAddr {
  name: string
  // ISO-TP timing parameters (ms)
  nAs: number // sender side N_As
  nAr: number // receiver side N_Ar
  nBs: number // sender waits for FC timeout
  nBr: number // receiver before sending FC
  nCs: number // sender separation time min
  nCr: number // receiver consecutive frame timeout
  stMin: number // STmin to send in FC
  bs: number // BlockSize to send in FC
  maxWTF: number // max wait flow control frames
  padding: boolean
  paddingValue: number
  maxFrameSize: number // max bytes per serial frame (default 7, like CAN)
}
