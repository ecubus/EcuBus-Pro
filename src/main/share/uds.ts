// import { Param, param2raw, ServiceItem } from '../views/Uds/service'
import { v4 } from 'uuid'
import { CAN_ADDR_FORMAT, CAN_ID_TYPE, CanAddr, CanBaseInfo, CanVendor } from './can'
import { EthBaseInfo, EthAddr, EntityAddr } from './doip'
import { LinAddr, LinBaseInfo } from './lin'
import { SomeipInfo } from './someip'

export type DataType = 'NUM' | 'ARRAY' | 'ASCII' | 'UNICODE' | 'FLOAT' | 'DOUBLE' | 'FILE'
export type HardwareType = 'can' | 'lin' | 'eth' | 'pwm' | 'someip'
//serviceDetail所有的key作为serviceId

/**
 * @category UDS
 */
export interface ServiceItem {
  id: string
  name: string
  serviceId: ServiceId
  subfunc?: string
  suppress?: boolean
  autoSubfunc?: boolean
  desc?: string
  params: Param[]
  respParams: Param[]
  isNegativeResponse?: boolean
  nrc?: number
  generateConfigs?: Record<string, string>
}
// 使用泛型简化定义

export interface Param {
  id: string
  name: string
  longName?: string
  desc?: string
  type: DataType
  value: Buffer
  phyValue: any
  bitLen: number
  bitPos?: number
  meta?: {
    type: string
  }
  deletable?: boolean
  editable?: boolean
}
/**
 * @category UDS
 */
export type ServiceId =
  | '0x10'
  | '0x11'
  | '0x27'
  | '0x28'
  | '0x29'
  | '0x3E'
  | '0x83'
  | '0x84'
  | '0x85'
  | '0x22'
  | '0x23'
  | '0x24'
  | '0x2A'
  | '0x2C'
  | '0x2E'
  | '0x3D'
  | '0x14'
  | '0x87'
  | '0x19'
  | '0x2F'
  | '0x31'
  | '0x34'
  | '0x35'
  | '0x36'
  | '0x37'
  | '0x38'
  | 'Job'

export type ServiceDetailItem = {
  name: string
  hasSubFunction: boolean
  fixedParam?: boolean
  desc?: string
  buildInScript?: string
  defaultParams: {
    param: Param
    enum?: { name: string; value: string }[]
  }[]
  defaultRespParams: {
    param: Param
    enum?: { name: string; value: string }[]
  }[]
}
export type ServiceDetial = Record<ServiceId, ServiceDetailItem>
export function splitStr2(str: string) {
  const result: string[] = []
  for (let i = 0; i < str.length; i += 2) {
    result.push(str.substring(i, i + 2))
  }
  return result.join(' ')
}

export function checkServiceId(serviceId: ServiceId | undefined, need: ('job' | 'uds')[]) {
  if (!serviceId) return false

  if (need.includes('job')) {
    if (!serviceId.startsWith('0x')) {
      return true
    }
  }
  if (need.includes('uds')) {
    if (serviceId.startsWith('0x')) {
      return true
    }
  }
  return false
}

export function param2str(param: Param): string {
  return param.phyValue.toString()
}
export function param2raw(param: Param): Buffer {
  return Buffer.from(param.value)
}
const maxSIze = 65536
function reallocBuffer(buffer: Buffer, len: number) {
  const newBuffer = Buffer.alloc(len)
  buffer.copy(newBuffer, 0, 0, buffer.length)
  return newBuffer
}
export function getParamBuffer(params: Param[]) {
  let allLen = 0
  let buffer = Buffer.alloc(maxSIze)
  for (const p of params) {
    const t = param2raw(p)
    const len = Math.ceil(p.bitLen / 8)
    if (allLen + len > maxSIze) {
      buffer = reallocBuffer(buffer, (allLen + len) * 2)
    }
    t.copy(buffer, allLen)
    allLen += len
  }

  return buffer.subarray(0, allLen)
}

export function getTxPdu(service: ServiceItem) {
  return Buffer.concat([Buffer.from([Number(service.serviceId)]), getParamBuffer(service.params)])
}

export function getRxPdu(service: ServiceItem) {
  const buffer = Buffer.alloc(maxSIze)

  if (service.isNegativeResponse) {
    buffer[0] = 0x7f
    buffer[1] = Number(service.serviceId)
    buffer[2] = service.nrc || 0x00
    return buffer.subarray(0, 3)
  }
  return Buffer.concat([
    Buffer.from([Number(service.serviceId) + 0x40]),
    getParamBuffer(service.respParams)
  ])
}
export function applyBuffer(service: ServiceItem, data: Buffer, isReq: boolean) {
  if (!data || data.length === 0) {
    return
  }
  if (data[0] == 0x7f) {
    if (!isReq) {
      //Negative response
      if (data[1] != Number(service.serviceId)) {
        throw new Error(
          `serviceId not match, expect ${service.serviceId} but got 0x${data[1].toString(16)}`
        )
      }
      service.isNegativeResponse = true
      service.nrc = data[2]
    }
    return
  }
  let sid = data[0]
  if (!isReq) {
    sid -= 0x40
  }

  if (sid != Number(service.serviceId)) {
    throw new Error(
      `serviceId not match, expect ${service.serviceId} but got 0x${sid.toString(16)}`
    )
  }
  const params = isReq ? service.params : service.respParams
  /* remove left param */
  if (params.length > 0) {
    const lastParam = params[params.length - 1]
    if (lastParam.name == '__left') {
      params.pop()
    }
  }
  let len = 1
  for (const param of params) {
    const paramLen = Math.ceil(param.bitLen / 8)
    if (len < data.length) {
      const subData = data.subarray(len, len + paramLen)
      //如果 subData 的长度小于paramLen，就跳过
      if (subData.length < paramLen) {
        return
      }
      paramSetValRaw(param, subData)
    }
    len += paramLen
  }
  //append left to last param
  if (len < data.length) {
    const param: Param = {
      id: v4(),
      name: '__left',
      type: 'ARRAY',
      value: Buffer.alloc(0),
      phyValue: '',
      bitLen: (data.length - len) * 8
    }
    paramSetValRaw(param, data.subarray(len))
    params.push(param)
  }
}
export function getTxPduStr(service: ServiceItem) {
  const str: string[] = [
    Buffer.from([Number(service.serviceId)])
      .toString('hex')
      .toUpperCase()
  ]

  for (let i = 0; i < service.params.length; i++) {
    const pa = service.params[i]
    const s = param2raw(pa)
      .toString('hex')
      .toUpperCase()
      .padStart(pa.bitLen / 4, '0')

    str.push(splitStr2(s))
  }
  return str
}
export function getRxPduStr(service: ServiceItem) {
  const str: string[] = [
    Buffer.from([Number(service.serviceId) + 0x40])
      .toString('hex')
      .toUpperCase()
  ]
  if (service.suppress) {
    return ['SUPPRESS']
  }
  for (let i = 0; i < service.respParams.length; i++) {
    const pa = service.respParams[i]
    const s = param2raw(pa)
      .toString('hex')
      .toUpperCase()
      .padStart(pa.bitLen / 4, '0')
    str.push(splitStr2(s))
  }
  /* convert to hex */
  return str
}
export function param2len(param: Param): number {
  return Math.ceil(param.bitLen / 8)
}

export function paramSetVal(param: Param, str: string | number) {
  switch (param.type) {
    case 'NUM':
      {
        const v = Number(str)
        if (Number.isNaN(v)) {
          throw new Error('value should be a number')
        }
        const byte = Math.floor(param.bitLen / 8)
        const pow = Math.pow(2, byte * 8)
        if (v >= 0 && v < pow) {
          param.phyValue = v
          //v to hex string, 空格隔开
          param.value = Buffer.alloc(byte)
          //bit-endian
          for (let i = 0; i < byte; i++) {
            param.value.writeUInt8((v >> (8 * i)) & 0xff, byte - i - 1)
          }
        } else {
          throw new Error(`value should be in [0,${pow - 1}]`)
        }
      }
      break
    case 'ARRAY':
      {
        const byte = Math.floor(param.bitLen / 8)

        if (!str) {
          param.phyValue = ''
          param.value = Buffer.alloc(0)
          break
        }

        //regex check hex string like '00 F4 33 5a' 中间必须要有空格，每个最大2个字符串
        if (!/^[0-9a-fA-F]{2}( [0-9a-fA-F]{2})*$/.test(str.toString())) {
          throw new Error('value should be a 00 F4 33 5a')
        }

        const s = str.toString().split(' ')
        if (s.length > byte) {
          throw new Error(`value length ${s.length} should less than ${byte}`)
        }
        for (let i = 0; i < s.length; i++) {
          const v = Number('0x' + s[i])
          if (Number.isNaN(v)) {
            throw new Error('value should be a 00 F4 33 5a')
          }
          if (v < 0 && v >= 256) {
            throw new Error(`value[${i}] should be in [0,255]`)
          }
        }
        param.phyValue = str.toString()
        param.value = Buffer.from(s.map((item) => parseInt(item, 16)))
      }
      break
    case 'FILE':
    case 'ASCII': {
      const byte = Math.floor(param.bitLen / 8)
      if (str.toString().length > byte) {
        throw new Error(`value length ${str.toString().length} should less than ${byte}`)
      }
      param.phyValue = str.toString()
      //hex string 空格隔开
      param.value = Buffer.from(str.toString(), 'ascii')

      break
    }
    case 'UNICODE': {
      const byte = Math.floor(param.bitLen / 8)
      const tb = Buffer.from(str.toString(), 'utf-8')
      if (tb.length > byte) {
        throw new Error(`value length ${tb.length} should less than ${byte}`)
      }
      param.phyValue = str.toString()
      //hex string 空格隔开
      param.value = tb
      // console.log(param.value)
      break
    }
    case 'FLOAT':
      {
        const v = Number(str)
        if (Number.isNaN(v)) {
          throw new Error('value should be a number')
        }
        if (v === Infinity || v === -Infinity) {
          throw new Error('value should not be Infinity')
        }
        const b = Buffer.alloc(4).fill(0)
        b.writeFloatBE(v, 0)
        param.phyValue = v
        //v to hex string, 空格隔开
        param.value = b
      }
      break
    case 'DOUBLE': {
      const v = Number(str)
      if (Number.isNaN(v)) {
        throw new Error('value should be a number')
      }
      if (v === Infinity || v === -Infinity) {
        throw new Error('value should not be Infinity')
      }
      const d = Buffer.alloc(8).fill(0)
      d.writeDoubleBE(v, 0)
      param.phyValue = v
      //v to hex string, 空格隔开
      param.value = d
      break
    }
    default:
      break
  }
}

export function paramSetValRaw(param: Param, val: Buffer) {
  const byte = Math.ceil(param.bitLen / 8)
  if (val.length > byte) {
    throw new Error(`value length ${val.length} should less than ${byte}`)
  }

  switch (param.type) {
    case 'NUM': {
      let v = 0
      for (let i = 0; i < byte; i++) {
        v = (v << 8) | val.readUInt8(i)
      }
      param.phyValue = v
      param.value = val
      break
    }

    case 'ARRAY': {
      param.phyValue = splitStr2(val.toString('hex').padStart(byte * 2, '0'))
      param.value = val
      break
    }

    case 'ASCII': {
      param.phyValue = val.toString('ascii')
      param.value = val
      break
    }
    case 'UNICODE': {
      param.phyValue = val.toString('utf-8')
      param.value = val
      break
    }
    case 'FLOAT': {
      param.phyValue = val.readFloatBE(0)
      param.value = val
      break
    }
    case 'DOUBLE': {
      param.phyValue = val.readDoubleBE(0)
      param.value = val
      break
    }
    default:
      break
  }
  param.value = val
}

export function paramSetSize(param: Param, bitSize: number) {
  const byte = Math.ceil(bitSize / 8)
  const lastByte = Math.ceil(param.bitLen / 8)
  const minLen = Math.min(byte, lastByte)
  param.bitLen = bitSize
  const newValue = Buffer.alloc(byte).fill(0)
  //copy value to new buffer
  param.value.copy(newValue, 0, 0, minLen)
  param.value = newValue
}
export interface SequenceItem {
  enable: boolean
  checkResp: boolean
  retryNum: number
  addressIndex: number
  failBehavior: 'stop' | 'continue'
  serviceId: string
  delay: number
}

export interface Sequence {
  name: string
  services: SequenceItem[]
}

export interface Project {
  device: string
  scriptFileName: string
}

export interface SubFunction {
  name: string
  subFunction: string
}
export interface UdsInfo {
  pTime: number
  pExtTime: number
  s3Time: number
  testerPresentEnable: boolean
  testerPresentSpecialService?: string
  testerPresentAddrIndex?: number
}

/**
 * @category UDS
 */
export interface UdsAddress {
  type: HardwareType
  canAddr?: CanAddr
  ethAddr?: EthAddr
  linAddr?: LinAddr
}

export function getUdsAddrName(item?: UdsAddress) {
  if (item) {
    if (item.type == 'can') {
      return item.canAddr?.name || ''
    } else if (item.type == 'eth') {
      return item.ethAddr?.name || ''
    } else if (item.type == 'lin') {
      return item.linAddr?.name || ''
    }
  }
  return ''
}
export function getUdsDeviceName(item: UdsDevice) {
  if (item.type == 'can') {
    return item.canDevice?.name || ''
  }
  return ''
}

export interface PwmDevice {
  label: string
  id: string
  handle: any
  serialNumber?: string
  busy?: boolean
}

export interface PwmBaseInfo {
  id: string
  device: PwmDevice
  freq: number
  initDuty: number
  polarity: boolean
  resetStatus: boolean
  vendor: CanVendor
  name: string
  database?: string
}

export interface UdsDevice {
  type: HardwareType
  canDevice?: CanBaseInfo
  ethDevice?: EthBaseInfo
  linDevice?: LinBaseInfo
  pwmDevice?: PwmBaseInfo
  someipDevice?: SomeipInfo
}
