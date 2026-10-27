export type CddJson = string | number | boolean | null | CddJson[] | { [key: string]: CddJson }

export interface CddDtc {
  id?: string
  raw: number
  dtc: string
  failureType: string | null
  failureTypeText: string | null
  errorText: string
  used: boolean
  properties: Record<string, CddJson>
  source?: 'faultMemory' | 'obdFaultMemory'
  bitLength?: number
}
