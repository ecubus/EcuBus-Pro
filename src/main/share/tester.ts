import { HardwareType, Sequence, ServiceItem, UdsAddress, UdsInfo, ServiceId } from './uds'
import { EntityAddr } from './doip'

/**
 * @category UDS
 */
export interface TesterInfo {
  script?: string
  id: string
  name: string
  type: HardwareType
  udsTime: UdsInfo
  targetDeviceId?: string
  seqList: Sequence[]
  address: UdsAddress[]
  simulateBy?: string
  allServiceList: Partial<Record<ServiceId, ServiceItem[]>>
  //speical for doip
  doipVersion?: number
  // code generate
  enableCodeGen?: boolean
  generateConfigs?: {
    tempaltePath: string
    generatePath: string
  }[]
}
