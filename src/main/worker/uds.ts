/**
 * @module Util
 */
import Emittery from 'emittery'
import {
  getRxPdu,
  getTxPdu,
  Param,
  paramSetVal,
  paramSetSize,
  paramSetValRaw,
  Sequence,
  ServiceItem,
  applyBuffer
} from '../share/uds'
export { CAN_ID_TYPE, CAN_ADDR_TYPE, CAN_ADDR_FORMAT } from '../share/can'
export type { ServiceItem }
export type { ServiceId }
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import workerpool, { worker } from 'workerpool'
import { cloneDeep } from 'lodash'
import { v4 } from 'uuid'
import { checkServiceId, ServiceId } from './../share/uds'
import { CanMessage } from '../share/can'
import SecureAccessDll from './secureAccess'
import { EntityAddr, VinInfo } from '../share/doip'
import { LinMsg } from '../share/lin'
export { LinDirection, LinChecksumType, LinMode } from '../share/lin'
export { SecureAccessDll }
export type { CanMessage }
export type { EntityAddr }
export type { LinMsg }
export type { CanMsgType } from '../share/can'
import { dot } from 'node:test/reporters'
import assert from 'node:assert'
/**
 * @category TEST
 */
export { assert }

/**
 * @category TEST
 */
export { test } from 'node:test'

/**
 * @category TEST
 */
export { beforeEach } from 'node:test'

/**
 * @category TEST
 */
export { afterEach } from 'node:test'

/**
 * @category TEST
 */
export { before } from 'node:test'

/**
 * @category TEST
 */
export { after } from 'node:test'

/**
 * @category TEST
 */
import { describe } from 'node:test'

const selfDescribe = process.env.ONLY ? describe.only : describe
export { selfDescribe as describe }

const testerList = ['{{{testerName}}}'] as const
const serviceList = ['{{{serviceName}}}'] as const
const allServicesSend = ['{{{serviceName}}}.send'] as const
const allServicesRecv = ['{{{serviceName}}}.recv'] as const
const allSignal = ['{{{signalName}}}'] as const

interface Jobs {
  string: (data: Buffer) => string
}
/**
 * All services name config in Diagnostic Service.
 * @category UDS
 */
export type ServiceName = (typeof serviceList)[number]
/**
 * All testers name config in Diagnostic Service.
 * @category UDS
 */
export type TesterName = (typeof testerList)[number]
/**
 * All services name(.send) config in Diagnostic Service.
 * @category UDS
 */
export type ServiceNameSend = (typeof allServicesSend)[number]
/**
 * All services name(.recv) config in Diagnostic Service.
 * @category UDS
 */
export type ServiceNameRecv = (typeof allServicesRecv)[number]

/**
 * All signals name config in Diagnostic Service.
 * @category LIN
 * @category CAN
 */
export type SignalName = (typeof allSignal)[number]

/**
 * All variables name config in Diagnostic Service.
 * @category UDS
 */
export type VariableMap = {
  stub: number
}

/**
 * All jobs name config in Diagnostic Service.
 * @category UDS
 */
export type JobName = keyof Jobs
type ServiceNameAll = ServiceNameSend | ServiceNameRecv

type EventMapSend = {
  [key in ServiceNameSend]: DiagRequest
}

type EventMapRecv = {
  [key in ServiceNameRecv]: DiagResponse
}

type EventMap = EventMapSend & EventMapRecv

const emitMap = new Map<number, { resolve: any; reject: any }>()
const serviceMap = new Map<string, ServiceItem>()

let id = 0
/**
 * @category UDS
 */
export type ServiceEvent = {
  send: DiagRequest
  recv: DiagResponse
}
/**
 * @category UDS
 */
class Service {
  service: ServiceItem
  private params: Param[]
  private isRequest: boolean
  testerName: string
  constructor(testerName: string, service: ServiceItem, isRequest: boolean) {
    this.testerName = testerName
    this.service = service
    this.isRequest = isRequest
    if (isRequest) {
      this.params = this.service.params
    } else {
      this.params = this.service.respParams
    }
  }
  valueOf() {
    return this.isRequest
      ? getTxPdu(this.service).toString('hex')
      : getRxPdu(this.service).toString('hex')
  }
  /**
   * Sync service params to tester sequence, after change, the sequence params will be updated.
   *
   * @returns {Promise<void>} A promise that resolves when the event has been emitted.
   *
   * @example
   *
   * ```ts
   * Util.Init(async () => {
   *    const testService0 = DiagRequest.from('Can.testService')
   *    testService.diagSetParameter('key', 0x01)
   *    const testService1 = DiagRequest.from('Can.testService')
   *    console.log(testService0 == testService1) // false
   *    await testService0.syncService()
   *    const testService2 = DiagRequest.from('Can.testService')
   *    console.log(testService0 == testService2) // true
   *
   * })
   * ```
   */
  async changeService() {
    await this.asyncEmit('set', {
      service: this.service,
      isRequest: this.isRequest,
      testerName: this.testerName
    })
    serviceMap.set(this.getServiceName(), this.service)
  }
  /**
   * Subscribe to an event. When the event occurs, the listener function will be invoked.
   *
   * The valid event name should be:
   * - `'send'`: will be happen before the msg is send
   * - `'recv'`: will be happen when the response msg is recv
   *
   * @param event The event to be listened.
   * @param listener the function when event
   *
   * @example
   *
   * ```ts
   * Util.Init(()=>{
   *     const testService = DiagRequest.from('Can.testService')
   *     testService.On('send', ()=>{
   *         console.log('send event happened.')
   *     })
   *
   *     testService.On('recv', ()=>{
   *         console.log('recv event happened.')
   *     })
   * })
   * ```
   */
  On<T extends keyof ServiceEvent>(
    event: T,
    listener: (data: ServiceEvent[T]) => void | Promise<void>
  ) {
    Util.On(`${this.getServiceName()}.${event}` as any, listener)
  }
  /**
   * Subscribe to an event, only once.
   *
   * @param event - The event type.
   * @param listener - The function to subscribe.
   */
  Once<T extends keyof ServiceEvent>(
    event: T,
    listener: (data: ServiceEvent[T]) => void | Promise<void>
  ) {
    Util.OnOnce(`${this.getServiceName()}.${event}` as any, listener)
  }
  /**
   * Unsubscribe from an event.
   * 
   * @param event - The event type.
   * @param listener - The function to unsubscribe.
   * 
   * @example
   * 
   * ```ts
   * Util.Init(() => {
   *     const testService = DiagRequest.from('Can.testService');
   *     testService.On('send', () => {
   *         console.log('send event happened.');
   *     });
   
   *     // The following code will not work
   *     testService.Off('send', () => {
   *         console.log('send event happened.');
   *     });
   * });
   * ```
   * 
   * > **Note**: To unsubscribe from an event, you must provide a non-anonymous function.
   */
  Off<T extends keyof ServiceEvent>(
    event: T,
    listener: (data: ServiceEvent[T]) => void | Promise<void>
  ) {
    Util.Off(`${this.getServiceName()}.${event}` as any, listener)
  }
  private async asyncEmit(event: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      workerpool.workerEmit({
        id: id,
        event: event,
        data: data
      })
      emitMap.set(id, { resolve, reject })
      id++
    })
  }
  /**
   * This function will return the service name
   *
   * @example
   *
   * ```ts
   * Util.Init(()=>{
   *     const testService = DiagRequest.from('Can.testService');
   *     console.log('ServiceName:', testService.getServiceName())
   * })
   * ```
   */
  getServiceName() {
    return `${this.testerName}.${this.service.name}`
  }

  /**
   * This function will return the service describe setting in Service.
   * @returns service describe.
   *
   * @example
   *
   * ```ts
   * Util.Init(()=>{
   *     const testService = DiagRequest.from('Can.testService');
   *     console.log('Desc:', testService.getServiceDesc())
   * })
   * ```
   */
  getServiceDesc() {
    return this.service.desc
  }

  /**
   * This function will return the value of the provided parameter.
   * @param paramName param name
   * @returns param value
   *
   * @example
   *
   * ```ts
   * Util.Init(()=>{
   *     const testService = DiagRequest.from('Can.testService');
   *     console.log('SERVICE-ID Buffer:', testService.diagGetParameter('SERVICE-ID'))
   * })
   * ```
   */
  diagGetParameter(paramName: string): string | number {
    const param = this.params.find((item) => item.name === paramName)
    if (param) {
      return param.phyValue
    } else {
      throw new Error(
        `param ${paramName} not found in ${this.isRequest ? 'DiagRequest' : 'DiagResponse'} ${this.service.name}`
      )
    }
  }

  /**
   * This function will return the `Buffer` of the provided parameter.
   * @param paramName param name
   * @returns `Buffer` value of provided parameter.
   *
   * @example
   *
   * ```ts
   * Util.Init(()=>{
   *     const testService = DiagRequest.from('Can.testService');
   *     console.log('SERVICE-ID:', testService.diagGetParameterRaw('SERVICE-ID'))
   * })
   * ```
   */
  diagGetParameterRaw(paramName: string): Buffer {
    const param = this.params.find((item) => item.name === paramName)
    if (param) {
      return Buffer.from(param.value)
    } else {
      throw new Error(
        `param ${paramName} not found in ${this.isRequest ? 'DiagRequest' : 'DiagResponse'} ${this.service.name}`
      )
    }
  }

  /**
   * This function will return the bit size of the provided parameter.
   * @param paramName param name
   * @returns param bit size
   *
   * @example
   *
   * ```ts
   * Util.Init(()=>{
   *     const testService = DiagRequest.from('Can.testService');
   *     console.log('SERVICE-ID Size:', testService.diagGetParameterSize('SERVICE-ID'))
   * })
   */
  diagGetParameterSize(paramName: string): number {
    const param = this.params.find((item) => item.name === paramName)
    if (param) {
      return param.bitLen
    } else {
      throw new Error(`param ${paramName} not found in DiagRequest ${this.service.name}`)
    }
  }

  /**
   * This function returns the names of all parameters associated with the given diag.
   *
   * @returns {string[]} An array of strings storing the names of all parameters.
   *
   * @example
   *
   * Util.Init(()=>{
   *     const testService = DiagRequest.from('Can.testService');
   *     console.log('parameter names:', testService.diagGetParameterNames())
   * })
   */
  diagGetParameterNames(): string[] {
    return this.params.map((item) => item.name)
  }

  /**
   * This function will change the parameter's bit size.
   * @param paramName parameter name
   * @param bitLen new bit size of the provided parameter.
   *
   * @example
   *
   * > It is only advisable to specify the size of num and array parameters.
   *
   * ```ts
   * Util.Init(()=>{
   *     const testService = DiagRequest.from('Can.testService')
   *
   *     // array parameter
   *     console.log('arrayParam bit size:', testService.diagGetParameterSize('arrayParam'))
   *     testService.diagSetParameterSize('arrayParam', 64)
   *     console.log('arrayParam bit size:', testService.diagGetParameterSize('arrayParam'))
   *
   *     // num parameter
   *     console.log('numParam bit size:', testService.diagGetParameterSize('numParam'))
   *     testService.diagSetParameterSize('numParam', 16)
   *     console.log('numParam bit size:', testService.diagGetParameterSize('numParam'))
   *
   *     console.log('ascii bit size:', testService.diagGetParameterSize('asciiParam'))
   *     testService.diagSetParameterSize('asciiParam', 16)
   *     console.log('ascii bit size:', testService.diagGetParameterSize('asciiParam'))
   * })
   * ```
   *
   */
  diagSetParameterSize(paramName: string, bitLen: number) {
    const param = this.params.find((item) => item.name === paramName)
    if (param) {
      paramSetSize(param, bitLen)
    } else {
      throw new Error(`param ${paramName} not found in DiagRequest ${this.service.name}`)
    }
  }

  /**
   * This function will change the provided parameter's value.
   * @param paramName parameter's name need to be changed.
   * @param value new value of the provided parameter.
   *
   * @example
   *
   * > Add relative param in Service.
   *
   * 1. **array parameter**
   *
   *     ```ts
   *     Util.Init(()=>{
   *         // add param arrayParam in Service.
   *         const testService = DiagRequest.from('Can.testService')
   *
   *         console.log('arrayParam:', testService.diagGetParameter('arrayParam'))
   *         testService.diagSetParameter('arrayParam', '12 34 56 78')
   *         console.log('arrayParam:', testService.diagGetParameter('arrayParam'))
   *     })
   *     ```
   *
   * 2. **num parameter**
   *
   *     ```ts
   *     Util.Init(()=>{
   *         // add param arrayParam in Service.
   *         const testService = DiagRequest.from('Can.testService')
   *
   *         // 8 bit number
   *         console.log('8 bits num:', testService.diagGetParameter('numParam'))
   *         testService.diagSetParameter('numParam', '12')
   *         console.log('set parameter with str:', testService.diagGetParameter('numParam'))
   *         testService.diagSetParameter('numParam', 99)
   *         console.log('set parameter with number:', testService.diagGetParameter('numParam'))
   *
   *         // 16 bit number
   *         console.log('8 bits num:', testService.diagGetParameterRaw('numParam'))
   *         testService.diagSetParameterSize('numParam', 16)
   *         console.log('change size to 16 bits:', testService.diagGetParameterRaw('numParam'))
   *         testService.diagSetParameter('numParam', '257')
   *         console.log('set parameter with str', testService.diagGetParameterRaw('numParam'))
   *         testService.diagSetParameter('numParam', 65534)
   *         console.log('set parameter with number', testService.diagGetParameterRaw('numParam'))
   *     })
   *     ```
   * 3. **ascii parameter**
   *
   *     > The ascii parameter formats the input value into a string. It is advisable to avoid using numbers as input.
   *
   *     ```ts
   *     Util.Init(()=>{
   *         // add param arrayParam in Service.
   *         const testService = DiagRequest.from('Can.testService')
   *
   *         // 8 bit number
   *         console.log('8 bits num:', testService.diagGetParameterRaw('asciiParam'))
   *         testService.diagSetParameter('asciiParam', 'A')
   *         console.log('set parameter with str:', testService.diagGetParameterRaw('asciiParam'))
   *
   *         // 16 bit number
   *         console.log('8 bits num:', testService.diagGetParameterRaw('asciiParam'))
   *         await testService.diagSetParameterSize('asciiParam', 16)
   *         console.log('change size to 16 bits:', testService.diagGetParameterRaw('asciiParam'))
   *         await testService.diagSetParameter('asciiParam', 'AB')
   *         console.log('set parameter with str', testService.diagGetParameterRaw('asciiParam'))
   *     })
   *     ```
   * 4. **unicode parameter**
   *
   *     ```ts
   *     Util.Init(()=>{
   *         // add param arrayParam in Service.
   *         const testService = DiagRequest.from('Can.testService')
   *
   *         // 8 bit number
   *         console.log('24 bits num:', testService.diagGetParameter('unicodeParam'))
   *         testService.diagSetParameter('unicodeParam', '❤')
   *         console.log('set parameter with str:', testService.diagGetParameter('unicodeParam'))
   *
   *         // 16 bit number
   *         console.log('48 bits num:', testService.diagGetParameter('unicodeParam'))
   *         testService.diagSetParameterSize('unicodeParam', 48)
   *         console.log('change size to 16 bits:', testService.diagGetParameter('unicodeParam'))
   *         testService.diagSetParameter('unicodeParam', '❤️')
   *         console.log('set parameter with str', testService.diagGetParameter('unicodeParam'))
   *     })
   *     ```
   *
   * 5. **float parameter**
   *
   *     ```ts
   *     Util.Init(()=>{
   *         // add param arrayParam in Service.
   *         const testService = DiagRequest.from('Can.testService')
   *
   *         // 8 bit number
   *         console.log('32 bits num:', testService.diagGetParameter('floatParam'))
   *         testService.diagSetParameter('floatParam', 0.12345)
   *         console.log('set parameter with float:', testService.diagGetParameter('floatParam'))
   *     })
   *     ```
   */
  diagSetParameter(paramName: string, value: string | number) {
    const param = this.params.find((item) => item.name === paramName)
    if (param) {
      paramSetVal(param, value)
    } else {
      throw new Error(`param ${paramName} not found in DiagRequest ${this.service.name}`)
    }
  }
  /**
   * This function will change the provided parameter's value with provided `Buffer` value.
   * 
   * @param paramName parameter's name need to be changed.
   * @param {Buffer} value new `Buffer` value of the provided parameter.
   * 
   * @example
   * 
   * > Add relative param in Service.
   * 
   * This function modifies the value of a parameter using a Buffer. The Buffer's value will be transferred at the TP layer.
   * You can generate a Buffer using the following methods:
   * 
   * ```ts
   * const newValue1 = Buffer.from([0x12, 0x34, 0x56, 0x78]);
   * 
   * const newValue2 = Buffer.alloc(4);
   * newValue2.writeUInt8(0x01, 0);
   * newValue2.writeUInt8(0x02, 1);
   * newValue2.writeUInt8(0x03, 2);
   * newValue2.writeUInt8(0x04, 3);
   * 
   * const newValue3 = Buffer.from('11223344', 'hex');
   * ```
   * 
   * To modify an array parameter, you can use the following example:
   * 
   * ```ts
   * Util.Init(() => {
  
   *     const testService = DiagRequest.from('Can.testService');
   *     
   *     console.log('arrayParam:', testService.diagGetParameter('arrayParam'));
   *     const newValue1 = Buffer.from([0x12, 0x34, 0x56, 0x78]);
   * 
   *     testService.diagSetParameterRaw('arrayParam', newValue1);
   *     console.log('arrayParam:', testService.diagGetParameter('arrayParam'));
   * });
   * ```
   * 
   * > For more examples on changing different parameter types, please refer to the {@link diagSetParameter | `diagSetParameter`} function.
   * 
   */
  diagSetParameterRaw(paramName: string, value: Buffer) {
    const param = this.params.find((item) => item.name === paramName)
    if (param) {
      paramSetValRaw(param, value)
    } else {
      throw new Error(`param ${paramName} not found in DiagRequest ${this.service.name}`)
    }
  }
  /**
   * Sends a diagnostic output command to the specified device.
   *
   * @param deviceName - The name of the device to send the diagnostic command to.
   * @param addressName - The address name associated with the device.
   * @returns The diagnostic output timestamp.
   */
  async outputDiag(deviceName?: string, addressName?: string): Promise<number> {
    const ts = await this.asyncEmit('sendDiag', {
      device: deviceName,
      address: addressName,
      service: this.service,
      isReq: this.isRequest,
      testerName: this.testerName
    })
    return ts
  }

  /**
   * This function modifies all values of a service.
   * 
   * @param data - The new data's buffer value.
   * 
   * @example
   * 
   * This function is typically used by a job to modify all data of a service. The following code demonstrates how to generate a new service and set its raw data:
   * 
   * ```ts
   * Util.Register('Can.testJob', async (v) => {
   *     //create a new DiagRequest in Can tester
   *     const testService = new DiagRequest('Can');
   *     const newData = Buffer.from([0x10, 0x01, 0x00, 0x01, 0x02]);
   *     await testService.diagSetRaw(newData);
   *     return [testService];
   * });
   * ```
   * 
   * > - Ensure that the job `Can.testJob` is already configured in Service.
   * > - The return type of a job should be a array.
   * 
   * You can also modify the raw data of an existing service with the following code:
   * 
   * ```ts
   * Util.Init(() => {
  
   *     const testService = DiagRequest.from('Can.testService');
   *     const newData = Buffer.from([0x10, 0x02]);
   *     await testService.diagSetRaw(newData);
   * });
   * ```
   * 
   *
   * > - Ensure that the service `Can.testService` is already configured in Service.
   * > - The new raw data size should be equal to the old raw data size.
   */
  diagSetRaw(data: Buffer) {
    applyBuffer(this.service, data, this.isRequest)
  }

  /**
   * This function will return a raw data of one service.
   * @returns raw data of one service.
   * 
   * @example
   * 
   * ```ts
   * Util.Init(()=>{
  
   *     const testService = DiagRequest.from('Can.testService')
   *     console.log('get raw data:', testService.diagGetRaw())
   * })
   * ```
   */
  diagGetRaw() {
    if (this.isRequest) {
      return getTxPdu(this.service)
    } else {
      return getRxPdu(this.service)
    }
  }
}
/**
 * @category UDS
 */
export class DiagJob extends Service {
  constructor(testerName: string, service: ServiceItem) {
    super(testerName, cloneDeep(service), true)
  }
  from(jobName: keyof Jobs) {
    const testerName = jobName.split('.')[0]
    const service = serviceMap.get(jobName)
    if (service && checkServiceId(service.serviceId, ['job'])) {
      return new DiagJob(testerName, service)
    } else {
      throw new Error(`job ${jobName} not found`)
    }
  }
}
/**
 * @category UDS
 */
export class DiagResponse extends Service {
  constructor(testerName: string, service: ServiceItem) {
    super(testerName, cloneDeep(service), false)
  }
  /**
   * @param {string} serviceName
   *
   * > serviceName's type '{{{serviceName}}}' is the string configured by Service.
   *
   * @example
   *
   *     ```ts
   *     Util.Init(async ()=>{
   *         // add param arrayParam in Service.
   *         const testService = DiagRequest.from('Can.testService')
   *         testService.On('send', ()=>{
   *             console.log('send event happened.')
   *         })
   *     }
   *     ```
   */
  static from(serviceName: ServiceName) {
    const testerName = serviceName.split('.')[0]
    const service = serviceMap.get(serviceName)
    if (service && checkServiceId(service.serviceId, ['uds'])) {
      return new DiagResponse(testerName, service)
    } else {
      throw new Error(`service ${serviceName} not found`)
    }
  }
  /**
   * @param {DiagRequest} req
   * @returns {DiagResponse}
   *
   * > req's type '{{{DiagRequest}}}' is the DiagRequest object.
   *
   * @example
   *
   * ```ts
   * Util.On('Can.testService.send', (v)=>{
   *     const response = DiagResponse.fromDiagRequest(v)
   * })
   * ```
   */
  static fromDiagRequest(req: DiagRequest) {
    return new DiagResponse(req.testerName, req.service)
  }
  /**
   * This function will return whether the response is a positive response or not.
   * @returns bool
   *
   * @example
   *
   * ```ts
   * Util.On('Can.testService.recv', (v)=>{
   *     console.log('response is positive:', v.diagIsPositiveResponse())
   * })
   * ```
   *
   */
  diagIsPositiveResponse() {
    const rxBuffer = getRxPdu(this.service)
    const serviceId = this.service.params[0].value[0]
    if (serviceId + 0x40 == rxBuffer[0]) {
      return true
    } else {
      return false
    }
  }
  /**
   * This function will return the response code of one response.
   *
   * > **NOTE**: Positive response does not have response code.
   *
   * @returns response code.
   *
   * @example
   *
   * // here testService2 is a RequestDownload(0x34) service
   * Util.On('Can.testService2.recv', (v)=>{
   *     console.log('response code', v.diagGetResponseCode())
   * })
   *
   */
  diagGetResponseCode() {
    if (!this.diagIsPositiveResponse()) {
      const rxBuffer = getRxPdu(this.service)
      return rxBuffer.readUInt8(0)
    } else {
      throw new Error('DiagResponse is positive response')
    }
  }
}

/**
 * @category UDS
 */
export class DiagRequest extends Service {
  constructor(testerName: string, service: ServiceItem) {
    super(testerName, cloneDeep(service), true)
  }
  /**
   * @param {string} serviceName
   *
   * > serviceName's type '{{{serviceName}}}' is the string configured by Service.
   *
   * @example
   *
   *     ```ts
   *     Util.Init(async ()=>{
   *         // add param arrayParam in Service.
   *         const testService = DiagRequest.from('Can.testService')
   *         testService.On('send', ()=>{
   *             console.log('send event happened.')
   *         })
   *     }
   *     ```
   */
  static from(serviceName: ServiceName) {
    const testerName = serviceName.split('.')[0]
    const service = serviceMap.get(serviceName)
    //request can accept job
    if (service) {
      return new DiagRequest(testerName, service)
    } else {
      throw new Error(`service ${serviceName} not found`)
    }
  }
}

/**
 * @category Util
 */
export class UtilClass {
  private isMain = workerpool.isMainThread
  private event = new Emittery<EventMap>()
  private funcMap = new Map<Function, any>()
  private testerName?: string
  /**
   * Register a handler function for a job.
   * @param jobs 
   * Job name, valid format is \<tester name\>.\<job name\>
   * @param func 
   * Handler function for the job
   * 
   * @example
   * 
   * ```ts
   * Util.Register('Can.testJob', async (v) => {
  
   *     const testService = new DiagRequest();
   *     const newData = Buffer.from([0x10, 0x01, 0x00, 0x01, 0x02]);
   *     await testService.diagSetRaw(newData);
   *     return [testService];
   * });
   * ```
   */
  Register(jobs: JobName, func: Jobs[keyof Jobs]) {
    if (!this.isMain) {
      workerpool.worker({
        [jobs]: async (...args: any[]) => {
          const v = await (func as any)(...args)
          if (Array.isArray(v)) {
            //each item must be DiagRequest
            if (v.every((item) => item instanceof DiagRequest || item instanceof DiagJob)) {
              return v.map((item) => item.service)
            } else {
              throw new Error('return value must be array of DiagRequest')
            }
          } else {
            throw new Error('return value must be array of DiagRequest')
          }
        }
      })
    }
  }
  private async workerOn(event: ServiceNameAll, data: any): Promise<boolean> {
    if (this.event.listenerCount(event) > 0) {
      await this.event.emit(event, data)
      if (event.endsWith('.send') || event.endsWith('.recv')) {
        const eventArray = event.split('.')
        eventArray[1] = '*'
        await this.event.emit(eventArray.join('.') as any, data)
      }
      return true
    } else {
      return false
    }
  }
  /**
   * Registers an event listener for CAN messages.
   *
   * @param id - The CAN message ID to listen for. If `true`, listens for all CAN messages.
   * @param fc - The callback function to be invoked when a CAN message is received.
   */
  OnCan(id: number | true, fc: (msg: CanMessage) => void | Promise<void>) {
    if (id === true) {
      this.event.on('can' as any, fc)
    } else {
      this.event.on(`can.${id}` as any, fc)
    }
  }
  /**
   * Get the tester name, valid in Tester script
   * @returns {string}
   */
  getTesterName() {
    return this.testerName
  }
  /**
   * Registers an event listener for CAN messages that will be invoked once.
   *
   * @param id - The CAN message ID to listen for. If `true`, listens for all CAN messages.
   * @param fc - The callback function to be invoked when a CAN message is received.
   */
  OnCanOnce(id: number | true, fc: (msg: CanMessage) => void | Promise<void>) {
    if (id === true) {
      this.event.once('can' as any).then(fc)
    } else {
      this.event.once(`can.${id}` as any).then(fc)
    }
  }
  /**
   * Unsubscribes from CAN messages.
   *
   * @param id - The identifier of the CAN message to unsubscribe from. If `true`, unsubscribes from all CAN messages.
   * @param fc - The callback function to remove from the event listeners.
   */
  OffCan(id: number | true, fc: (msg: CanMessage) => void | Promise<void>) {
    if (id === true) {
      this.event.off('can' as any, fc)
    } else {
      this.event.off(`can.${id}` as any, fc)
    }
  }
  /**
   * Registers an event listener for LIN messages that will be invoked once.
   *
   * @param id - The LIN message ID or ${databaseName}.${frameName} to listen for. If `true`, listens for all LIN messages.
   * @param fc - The callback function to be invoked when a LIN message is received.
   */
  OnLinOnce(id: number | string | true, fc: (msg: LinMsg) => void | Promise<void>) {
    if (id === true) {
      this.event.once('lin' as any).then(fc)
    } else {
      this.event.once(`lin.${id}` as any).then(fc)
    }
  }
  /**
   * Registers an event listener for LIN messages.
   *
   * @param id - The LIN message ID or ${databaseName}.${frameName} to listen for. If `true`, listens for all LIN messages.
   * @param fc - The callback function to be invoked when a LIN message is received.
   */
  OnLin(id: number | string | true, fc: (msg: LinMsg) => void | Promise<void>) {
    if (id === true) {
      this.event.on('lin' as any, fc)
    } else {
      this.event.on(`lin.${id}` as any, fc)
    }
  }
  /**
   * Unsubscribes from LIN messages.
   *
   * @param id - The identifier of the LIN message to unsubscribe from. If `true`, unsubscribes from all LIN messages.
   * @param fc - The callback function to remove from the event listeners.
   */
  OffLin(id: number | string | true, fc: (msg: LinMsg) => void | Promise<void>) {
    if (id === true) {
      this.event.off('lin' as any, fc)
    } else {
      this.event.off(`lin.${id}` as any, fc)
    }
  }
  /**
   * Registers an event listener for a specific key.
   *
   * @param key - The key to listen for. Only the first character of the key is used, * is a wildcard.
   * @param fc - The callback function to be executed when the event is triggered.
   *             This can be a synchronous function or a function returning a Promise.
   */
  OnKey(key: string, fc: (key: string) => void | Promise<void>) {
    key = key.slice(0, 1)
    if (key) {
      this.event.on(`keyDown${key}` as any, fc)
    }
  }
  /**
   * Registers an event listener for a specific key that will be invoked once.
   *
   * @param key - The key to listen for. Only the first character of the key is used, * is a wildcard.
   * @param fc - The callback function to be executed when the event is triggered.
   *             This can be a synchronous function or a function returning a Promise.
   */
  OnKeyOnce(key: string, fc: (key: string) => void | Promise<void>) {
    key = key.slice(0, 1)
    if (key) {
      this.event.once(`keyDown${key}` as any).then(fc)
    }
  }
  /**
   * Unsubscribes from an event listener for a specific key.
   *
   * @param key - The key to unsubscribe from. Only the first character of the key is used, * is a wildcard.
   * @param fc - The callback function to remove from the event listeners.
   */
  OffKey(key: string, fc: (key: string) => void | Promise<void>) {
    key = key.slice(0, 1)
    if (key) {
      this.event.off(`keyDown${key}` as any, fc)
    }
  }
  /**
   * Registers an event listener for a variable update.
   *
   * @param name - The name of the variable to listen for, * is a wildcard.
   * @param fc - The callback function to be executed when the variable is updated.
   *             This can be a synchronous function or a function returning a Promise.
   *             The callback receives an object with name and value properties.
   */
  OnVar<Name extends keyof VariableMap>(
    name: Name,
    fc: ({ name, value }: { name: Name; value: VariableMap[Name] }) => void | Promise<void>
  ) {
    if (name) {
      this.event.on(`varUpdate${name}` as any, fc)
    }
  }
  /**
   * Registers an event listener for a variable update that will be invoked once.
   *
   * @param name - The name of the variable to listen for, * is a wildcard.
   * @param fc - The callback function to be executed when the variable is updated.
   *             This can be a synchronous function or a function returning a Promise.
   *             The callback receives an object with name and value properties.
   */
  OnVarOnce<Name extends keyof VariableMap>(
    name: Name,
    fc: ({ name, value }: { name: Name; value: VariableMap[Name] }) => void | Promise<void>
  ) {
    if (name) {
      this.event.once(`varUpdate${name}` as any).then(fc)
    }
  }
  /**
   * Unsubscribes from an event listener for a variable update.
   *
   * @param name - The name of the variable to unsubscribe from, * is a wildcard.
   * @param fc - The callback function to remove from the event listeners.
   */
  OffVar<Name extends keyof VariableMap>(
    name: Name,
    fc: ({ name, value }: { name: Name; value: VariableMap[Name] }) => void | Promise<void>
  ) {
    if (name) {
      this.event.off(`varUpdate${name}` as any, fc)
    }
  }
  /**
   * Subscribe to an event once, invoking the registered function when the event is emitted.
   * @param eventName
   * Service name, formatted as \<tester name\>.\<service name\>.\<send|recv\>
   *
   * @param listener
   * Function to be called when the event is emitted
   *
   * @example
   *
   * ```ts
   * Util.OnOnce('Can.testService.send', async (req) => {
   *    // The req is a `DiagRequest`
   *    console.log(req.getServiceName(), ': send once');
   * });
   * ```
   */
  OnOnce<Name extends keyof EventMap>(
    eventName: Name,
    listener: (eventData: EventMap[Name]) => void | Promise<void>
  ) {
    if (eventName.endsWith('.send')) {
      const warpFunc = async (v: any) => {
        const testerName = eventName.split('.')[0]
        const req = new DiagRequest(testerName, v as any)
        await listener(req as any)
      }
      this.event.once(eventName).then(warpFunc)
    } else if (eventName.endsWith('.recv')) {
      const warpFunc = async (v: any) => {
        const testerName = eventName.split('.')[0]
        const resp = new DiagResponse(testerName, v)
        await listener(resp as any)
      }
      this.event.once(eventName).then(warpFunc)
    } else {
      throw new Error(`event ${eventName} not support`)
    }
  }
  /**
   * Subscribe to an event, invoking the registered function when the event is emitted.
   * @param eventName
   * Service name, formatted as \<tester name\>.\<service name\>.\<send|recv\>
   *
   * @param listener
   * Function to be called when the event is emitted
   *
   * @example
   *
   * > The `UDS` is a UDSClass type and has already been created by Service.
   *
   * 1. *send functions*
   *
   *     ```ts
   *     Util.On('Can.testService.send', async (req) => {
   *        // The req is a `DiagRequest`
   *        console.log(req.getServiceName(), ': send');
   *     });
   *     ```
   * 2. *recv function*
   *
   *     ```ts
   *     Util.On('Can.testService.recv', async (req) => {
   *        // The req is a `DiagResponse`
   *        console.log(req.getServiceName(), ':recv');
   *     });
   *     ```
   *
   */
  On<Name extends keyof EventMap>(
    eventName: Name,
    listener: (eventData: EventMap[Name]) => void | Promise<void>
  ) {
    if (eventName.endsWith('.send')) {
      const warpFunc = async (v: any) => {
        const testerName = eventName.split('.')[0]
        const req = new DiagRequest(testerName, v as any)
        await listener(req as any)
      }
      this.event.on(eventName, warpFunc)
      this.funcMap.set(listener, warpFunc)
    } else if (eventName.endsWith('.recv')) {
      const warpFunc = async (v: any) => {
        const testerName = eventName.split('.')[0]
        const resp = new DiagResponse(testerName, v)
        await listener(resp as any)
      }
      this.event.on(eventName, warpFunc)
      this.funcMap.set(listener, warpFunc)
    } else {
      throw new Error(`event ${eventName} not support`)
    }
  }

  /**
   * Unsubscribe from an event.
   *
   * > Only non-anonymous functions can be unsubscribed.
   *
   * @param eventName
   * Service name, formatted as \<tester name\>.\<service name\>.\<send|recv\>
   *
   * @param listener
   * Function to be unsubscribed
   *
   * @example
   *
   * ```ts
   * Util.On('Can.testService.send', ()=>{
   *     console.log('this function will not be Off')
   * })
   *
   * Util.Off('Can.testService.send', ()=>{
   *     console.log('this function will not be Off')
   * })
   *
   * ```
   *
   */
  Off<Name extends keyof EventMap>(
    eventName: Name,
    listener: (eventData: EventMap[Name]) => void | Promise<void>
  ) {
    const func = this.funcMap.get(listener)
    if (func) {
      this.event.off(eventName, func)
    }
  }
  private start(val: Record<string, ServiceItem>, testerName?: string) {
    // process.chdir(projectPath)
    this.testerName = testerName
    for (const key of Object.keys(val)) {
      //convert all param.value to buffer
      const service = val[key]
      for (const param of service.params) {
        param.value = Buffer.from(param.value)
      }
      serviceMap.set(key, service)
    }
  }
  private async canMsg(msg: CanMessage) {
    await this.event.emit(`can.${msg.id}` as any, msg)
    await this.event.emit('can' as any, msg)
  }
  private async linMsg(msg: LinMsg) {
    await this.event.emit(`lin.${msg.frameId}` as any, msg)
    if (msg.database && msg.name) {
      await this.event.emit(`lin.${msg.database}.${msg.name}` as any, msg)
    }
    await this.event.emit('lin' as any, msg)
  }
  private async keyDown(key: string) {
    await this.event.emit(`keyDown${key}` as any, key)
    await this.event.emit(`keyDown*` as any, key)
  }
  private async varUpdate(data: {
    name: string
    value: number | string | number[]
    id: string
    uuid?: string
  }) {
    await this.event.emit(`varUpdate${data.name}` as any, data)
    await this.event.emit(`varUpdate*` as any, data)
  }
  private evnetDone(
    id: number,
    resp?: {
      err?: string
      data?: any
    }
  ) {
    const item = emitMap.get(id)
    if (item) {
      if (resp) {
        if (resp.err) {
          item.reject(resp.err)
        } else {
          item.resolve(resp.data)
        }
      } else {
        item.resolve()
      }
      emitMap.delete(id)
    }
  }
  constructor() {
    if (!this.isMain) {
      workerpool.worker({
        __on: this.workerOn.bind(this),
        __start: this.start.bind(this),
        __eventDone: this.evnetDone.bind(this)
      })
      this.event.on('__canMsg' as any, this.canMsg.bind(this))
      this.event.on('__linMsg' as any, this.linMsg.bind(this))
      this.event.on('__keyDown' as any, this.keyDown.bind(this))
      this.event.on('__varUpdate' as any, this.varUpdate.bind(this))
    }
  }

  /**
   * Register a function, this function will be invoked when UDSClass is initialized.
   * @param fc Non-async or async function
   *
   * @example
   *
   * - Perform actions following UDS initialization using a normal function.
   *     ```ts
   *     Util.Init(()=>{
   *       console.log('Hello UDS!')
   *     })
   *     ```
   *
   * - Perform actions following UDS initialization using an async function.
   *     ```ts
   *     Util.Init(async ()=>{
   *       const file=await fs.readFile(path.join(process.env.PROJECT_ROOT,'file.bin'))
   *       let length=file.length
   *       console.log('Hello UDS file! file length is', length)
   *     })
   *     ```
   *
   * - The last registered function will override the previous ones.
   *     ```ts
   *     // The following code will be ignored
   *     Util.Init(async ()=>{
   *         console.log('1')
   *     })
   *
   *     // The following code will take effect
   *     Util.Init(async ()=>{
   *         console.log('2')
   *     })
   *     ```
   */
  Init(fc: () => void | Promise<void>) {
    this.event.clearListeners('__varFc' as any)
    this.event.on('__varFc' as any, fc)
  }
  /**
   * Register a function, this function will be invoked when UDSClass is terminated.
   * @param fc Non-async or async function
   *
   * @example
   *
   *
   */
  End(fc: () => void | Promise<void>) {
    this.event.clearListeners('__end' as any)
    this.event.on('__end' as any, fc)
  }
}

/**
 * Global instance of UDSClass, providing access to UDS functionality throughout the application.
 * Use this instance to interact with UDS features and services.
 *
 * @category Util
 * @type {UDSClass}
 *
 * @example
 * 1. *Init function*
 *     - Perform actions following UDS initialization using a normal function.
 *         ```ts
 *         Util.Init(()=>{
 *           console.log('Hello UDS!')
 *         })
 *         ```
 *
 *     - Perform actions following UDS initialization using an async function.
 *         ```ts
 *         Util.Init(async ()=>{
 *           const file=await fs.readFile(path.join(process.env.PROJECT_ROOT,'file.bin'))
 *           let length=file.length
 *           console.log('Hello UDS file! file length is', length)
 *         })
 *         ```
 *
 * 2. *send functions*
 *     > * This function will be called after the message has been sent.
 *     > * Please replace `Can.DiagRequest.send` with your own service item name. The format is `<tester name>.<service item name>.send`
 *
 *     ```ts
 *     Util.On('Can.DiagRequest.send', async (req) => {
 *        // The req is a `DiagRequest`
 *        console.log(req.getServiceName(), ': send');
 *     });
 *     ```
 *
 * 3. *recv function*
 *     > * This function will be called after the response message has been received.
 *     > * Please replace `Can.DiagRequest.recv` with your own service item name. The format is `<tester name>.<service item name>.recv`
 *
 *     ```ts
 *     Util.On('Can.DiagRequest.recv', async (req) => {
 *        // The req is a `DiagResponse`
 *        console.log(req.getServiceName(), ':recv');
 *     });
 *     ```
 *
 * 4. **More**
 *     > For more details, please refer to the {@link UDSClass | `UDSClass`} class.
 */
export const Util = new UtilClass()
global.Util = Util

/**
 * Sends a CAN message
 *
 * @category CAN
 * @param {CanMessage} msg - The CAN message to be sent
 * @returns {Promise<number>} - Returns a promise that resolves to sent timestamp
 */
export async function output(msg: CanMessage): Promise<number>
/**
 * Sends a LIN message
 *
 * @category LIN
 * @param {LinMsg} msg - The LIN message to be sent
 * @returns {Promise<number>} - Returns a promise that resolves to sent timestamp
 */
export async function output(msg: LinMsg): Promise<number>
export async function output(msg: CanMessage | LinMsg): Promise<number> {
  const p: Promise<number> = new Promise((resolve, reject) => {
    workerpool.workerEmit({
      id: id,
      event: 'output',
      data: msg
    })
    emitMap.set(id, { resolve, reject })
    id++
  })
  return await p
}

/**
 * Set a signal value
 *
 * @category LIN
 * @category CAN
 * @param {SignalName} signal - The signal to set, dbName.SignalName
 * @param {number|number[]} value - The value to set, can be single number or array
 * @returns {Promise<void>} - Returns a promise that resolves when value is set
 *
 * @example
 * ```ts
 * // Set single value signal
 * await setSignal(lin.xxxx', 123);
 *
 * // Set array value signal
 * await setSignal('lin.xxxx', [1, 2, 3, 4]);
 * ```
 */
export async function setSignal(
  signal: SignalName,
  value: number | number[] | string
): Promise<void> {
  const p: Promise<void> = new Promise((resolve, reject) => {
    workerpool.workerEmit({
      id: id,
      event: 'setSignal',
      data: {
        signal,
        value
      }
    })
    emitMap.set(id, { resolve, reject })
    id++
  })

  return await p
}

/**
 * Set a variable value
 *
 * @category Util
 * @param {keyof VariableMap} name - The variable name
 * @param {number|number[]|string} value - The value to set, can be single number or array
 * @returns {Promise<void>} - Returns a promise that resolves when value is set
 *
 * @example
 * ```ts
 * // Set single value signal
 * await setVar('var2', 123);
 *
 * // Set array value signal
 * await setVar('namespace.var1', [1, 2, 3, 4]);
 * ```
 */
export async function setVar<T extends keyof VariableMap>(
  name: T,
  value: VariableMap[T]
): Promise<void> {
  const p: Promise<void> = new Promise((resolve, reject) => {
    workerpool.workerEmit({
      id: id,
      event: 'setVar',
      data: {
        name,
        value
      }
    })
    emitMap.set(id, { resolve, reject })
    id++
  })

  return await p
}

let rightEntity: EntityAddr | undefined

/**
 * Register a virtual entity
 *
 * @category DOIP
 * @param {EntityAddr} entity - The entity to be registered.
 * @param {string} ip - The IP address of the entity, if node connected to multiple devices.
 * @returns {Promise<void>} - Returns a promise that resolves when the entity is registered.
 */
export async function RegisterEthVirtualEntity(entity: VinInfo, ip?: string) {
  if (rightEntity) {
    throw new Error('only one entity can be registered')
  } else {
    rightEntity = entity
  }
  const p: Promise<void> = new Promise((resolve, reject) => {
    workerpool.workerEmit({
      id: id,
      event: 'registerEthVirtualEntity',
      data: {
        entity,
        ip
      }
    })
    emitMap.set(id, { resolve, reject })
    id++
  })

  return await p
}

//get dot input param type
type TestEventGenerator = Parameters<typeof dot>[0]

// eslint-disable-next-line require-yield
export async function* reporter(source: TestEventGenerator) {
  for await (const event of source) {
    if (
      event.type === 'test:start' ||
      event.type === 'test:pass' ||
      event.type === 'test:fail' ||
      event.type === 'test:diagnostic' ||
      event.type === 'test:dequeue'
    ) {
      workerpool.workerEmit({
        event: 'test',
        id: id,
        data: event
      })
      id++
    }
  }
}
