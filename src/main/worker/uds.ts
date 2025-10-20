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
  applyBuffer,
  UdsAddress
} from '../share/uds'
export { CAN_ID_TYPE, CAN_ADDR_TYPE, CAN_ADDR_FORMAT } from '../share/can'
export type { ServiceItem }
export type { TesterInfo } from '../share/tester'
export type { ServiceId }
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import workerpool, { worker } from 'workerpool'
import { cloneDeep } from 'lodash'
import { v4 } from 'uuid'
import { checkServiceId, ServiceId } from './../share/uds'
import { CAN_ID_TYPE, CanMessage } from '../share/can'
import SecureAccessDll from './secureAccess'
import { EntityAddr, VinInfo } from '../share/doip'
import {
  LinMsg,
  LinCableErrorInject,
  LinDirection,
  LinChecksumType,
  getFrameData
} from '../share/lin'
export { LinDirection, LinChecksumType, LinMode } from '../share/lin'
export { SecureAccessDll }
export type { CanMessage }
export type { EntityAddr }
export type { LinMsg, LinCableErrorInject }
export type { CanAddr } from '../share/can'
export type { EthAddr } from '../share/doip'
export type { LinAddr } from '../share/lin'
export type { CanMsgType } from '../share/can'
export type { UdsAddress }
import { dot } from 'node:test/reporters'
import assert, { AssertionError } from 'node:assert'
import { writeMessageData as writeLinMessageData } from 'src/renderer/src/database/ldf/calc'
import { setSignal as setSignalNode } from '../util'

import { setVar as setVarMain, getVar as getVarMain } from '../var'
/**
 * Node.js built-in assertion library for testing.
 * Provides various assertion methods to validate test expectations.
 * Throws AssertionError when assertions fail, causing the test to fail.
 *
 * @category TEST
 *
 * @example
 * ```ts
 * import { assert } from './worker/uds';
 *
 * // Basic equality assertions
 * assert.equal(actual, expected);
 * assert.strictEqual(actual, expected);
 * assert.notEqual(actual, unexpected);
 *
 * // Boolean assertions
 * assert.ok(value); // truthy check
 * assert.equal(value, true);
 *
 * // Array and object assertions
 * assert.deepEqual(actualObject, expectedObject);
 * assert.deepStrictEqual(actualArray, expectedArray);
 *
 * // Error assertions
 * assert.throws(() => {
 *   throw new Error('Expected error');
 * });
 *
 * // CAN message validation example
 * test('should validate CAN message structure', () => {
 *   const canMsg = { id: 0x123, data: [0x01, 0x02] };
 *   assert.ok(canMsg.id);
 *   assert.equal(typeof canMsg.id, 'number');
 *   assert.ok(Array.isArray(canMsg.data));
 *   assert.equal(canMsg.data.length, 2);
 * });
 *
 * // UDS response validation example
 * test('should validate UDS positive response', () => {
 *   const response = [0x50, 0x01]; // Positive response to service 0x10
 *   assert.equal(response.length, 2);
 *   assert.equal(response[0], 0x50);
 *   assert.equal(response[1], 0x01);
 * });
 * ```
 */
export { assert }

import { test as nodeTest, TestContext } from 'node:test'

export { getCheckSum as getLinCheckSum } from '../share/lin'

let init = process.env.ONLY == 'true' ? true : false
let initPromiseResolve: () => void = () => {}
let initPromiseReject: (e: any) => void = () => {}
const initPromise = new Promise<void>((resolve, reject) => {
  initPromiseResolve = resolve
  initPromiseReject = reject
})

let testCnt = 0
const testEnableControl: Record<number, boolean> = {}

/**
 * 辅助函数：保留原始错误的堆栈信息
 * @param fn 要执行的函数
 * @returns 执行结果
 */
async function preserveErrorStack<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    // 保留原始错误的堆栈信息，但过滤掉 uds.ts 相关的帧
    if (error instanceof Error) {
      const stack = error.stack?.split('\n')
      //fisrt at line
      const atLine = stack?.find((line) => /\d+:\d+/.test(line))

      const newError = new Error(`${error.message}, pos: ${atLine}`)

      throw newError
    }
    throw error
  }
}

/**
 * Test function for writing test cases with conditional execution based on enable control.
 * Provides test context, automatic logging, and supports both synchronous and asynchronous operations.
 * Test execution is controlled by the testEnableControl configuration.
 *
 * @category TEST
 * @param {string} name - The name of the test case
 * @param {Function} fn - The test function to execute (can be sync or async)
 * @property {Function} skip - Skip a test case, marking it as pending. The test will be reported as skipped and not executed.
 *
 * @example
 * ```ts
 * // Basic synchronous test case
 * test('should validate CAN message format', () => {
 *   const canMsg = { id: 0x123, data: [0x01, 0x02] };
 *   assert.equal(canMsg.id, 0x123);
 *   assert.equal(canMsg.data.length, 2);
 * });
 *
 * // Asynchronous test case for UDS communication
 * test('should perform UDS diagnostic session', async () => {
 *   await uds.service(0x10, 0x01); // DiagnosticSessionControl
 *   const response = await uds.getResponse();
 *   assert.equal(response[0], 0x50); // Positive response
 * });
 *
 * // Test with CAN bus operations
 * test('should send and receive CAN messages', async () => {
 *   await can.send({ id: 0x7E0, data: [0x02, 0x10, 0x01] });
 *   const msg = await can.recv(1000);
 *   assert.notEqual(msg, null);
 * });
 *
 * // Skip a test case when feature is not ready
 * test.skip('LIN transport protocol test', () => {
 *   // Test code that will be skipped
 *   lin.sendMessage(0x3C, [0x01, 0x02, 0x03]);
 * });
 * ```
 */

export function test(name: string, fn: () => void | Promise<void>) {
  selfTest(name, async (t) => {
    if (!init) {
      try {
        await initPromise
      } catch (e: any) {
        console.error(`Util.Init function failed: ${e}`)
        process.exit(-1)
      }
      init = true
    }

    t.before(async () => {
      if (testEnableControl[testCnt] != true) {
        t.skip()
        return
      }
      console.log(`<<< TEST START ${name}>>>`)
    })
    t.after(() => {
      console.log(`<<< TEST END ${name}>>>`)
      testCnt++
    })

    if (testEnableControl[testCnt] != true) {
      t.skip()
    } else {
      return preserveErrorStack(fn)
    }
  })
}

test.skip = function (name: string, fn: () => void | Promise<void>) {
  selfTest(name, (t) => {
    t.before(() => {
      console.log(`<<< TEST START ${name}>>>`)
    })
    t.after(() => {
      console.log(`<<< TEST END ${name}>>>`)
      testCnt++
    })
    t.skip()
  })
}

/**
 * Node.js built-in test hook functions.
 * These are aliased and re-exported as custom functions with conditional execution.
 *
 * @category TEST
 */
import {
  beforeEach as nodeBeforeEach,
  afterEach as nodeAfterEach,
  before as nodeBefore,
  after as nodeAfter
} from 'node:test'

/**
 * Run setup code before each test in the current suite.
 * **MUST be used within a describe block.** Only executes if the corresponding test is enabled through testEnableControl.
 * Useful for initializing test data, establishing connections, or setting up mock objects.
 *
 * @category TEST
 * @param {Function} fn - Function to run before each test (can be sync or async)
 *
 * @example
 * ```ts
 * describe('CAN Communication Tests', () => {
 *   // ✅ Correct: beforeEach inside describe block
 *   beforeEach(async () => {
 *     await can.open('kvaser', 0);
 *     await can.setBitrate(500000);
 *   });
 *
 *   beforeEach(() => {
 *     uds.setTesterPresent(true);
 *     uds.setTimeout(5000);
 *   });
 *
 *   test('should send CAN message', () => {
 *     // Test implementation
 *   });
 * });
 *
 * // ❌ Wrong: beforeEach outside describe block
 * // beforeEach(() => { // This will not work properly });
 * ```
 */
export function beforeEach(fn: () => void | Promise<void>) {
  nodeBeforeEach(async () => {
    // Use current testCnt to determine if this hook should run
    if (testEnableControl[testCnt] === true) {
      return preserveErrorStack(fn)
    }
  })
}

/**
 * Run cleanup code after each test in the current suite.
 * **MUST be used within a describe block.** Only executes if the corresponding test is enabled through testEnableControl.
 * Used for cleaning up resources, closing connections, or resetting state after each test.
 *
 * @category TEST
 * @param {Function} fn - Function to run after each test (can be sync or async)
 *
 * @example
 * ```ts
 * describe('UDS Diagnostic Tests', () => {
 *   // ✅ Correct: afterEach inside describe block
 *   afterEach(async () => {
 *     await can.close();
 *   });
 *
 *   afterEach(() => {
 *     uds.setTesterPresent(false);
 *     uds.clearDtc();
 *     testData = null;
 *   });
 *
 *   test('should perform diagnostics', () => {
 *     // Test implementation
 *   });
 * });
 *
 * // ❌ Wrong: afterEach outside describe block
 * // afterEach(() => { // This will not work properly });
 * ```
 */
export function afterEach(fn: () => void | Promise<void>) {
  nodeAfterEach(async () => {
    // Use current testCnt to determine if this hook should run
    if (testEnableControl[testCnt] === true) {
      return preserveErrorStack(fn)
    }
  })
}

/**
 * Run setup code before all tests in the current suite.
 * **MUST be used within a describe block.** Only executes if any test in the suite is enabled through testEnableControl.
 * Used for one-time setup operations like initializing hardware, loading configuration, or establishing database connections.
 *
 * @category TEST
 * @param {Function} fn - Function to run before all tests (can be sync or async)
 *
 * @example
 * ```ts
 * describe('Hardware Integration Tests', () => {
 *   // ✅ Correct: before inside describe block
 *   before(async () => {
 *     await hardware.initialize();
 *     await hardware.selfTest();
 *   });
 *
 *   before(() => {
 *     config = loadTestConfig('test-settings.json');
 *     process.env.TEST_MODE = 'true';
 *   });
 *
 *   test('should connect to ECU', () => {
 *     // Test implementation
 *   });
 * });
 *
 * // ❌ Wrong: before outside describe block
 * // before(() => { // This will not work properly });
 * ```
 */
export function before(fn: () => void | Promise<void>) {
  nodeBefore(async () => {
    // Check if any test is enabled - if so, run the before hook
    const hasEnabledTests = Object.values(testEnableControl).some((enabled) => enabled === true)
    if (hasEnabledTests) {
      return preserveErrorStack(fn)
    }
  })
}

/**
 * Run cleanup code after all tests in the current suite.
 * **MUST be used within a describe block.** Only executes if any test in the suite was enabled through testEnableControl.
 * Used for final cleanup operations like closing hardware connections, saving test reports, or cleaning up temporary files.
 *
 * @category TEST
 * @param {Function} fn - Function to run after all tests (can be sync or async)
 *
 * @example
 * ```ts
 * describe('System Integration Tests', () => {
 *   // ✅ Correct: after inside describe block
 *   after(async () => {
 *     await hardware.shutdown();
 *     await hardware.disconnect();
 *   });
 *
 *   after(() => {
 *     saveTestReport(testResults);
 *     delete process.env.TEST_MODE;
 *     console.log('All tests completed');
 *   });
 *
 *   test('should perform system check', () => {
 *     // Test implementation
 *   });
 * });
 *
 * // ❌ Wrong: after outside describe block
 * // after(() => { // This will not work properly });
 * ```
 */
export function after(fn: () => void | Promise<void>) {
  nodeAfter(async () => {
    // Check if any test was enabled - if so, run the after hook
    const hasEnabledTests = Object.values(testEnableControl).some((enabled) => enabled === true)
    if (hasEnabledTests) {
      return preserveErrorStack(fn)
    }
  })
}

/**
 * Node.js built-in describe function for creating test groups.
 * Aliased to support conditional execution based on environment variables.
 *
 * @category TEST
 */
import { describe as nodeDescribe } from 'node:test'
import { VarUpdateItem } from '../global'
import { DataSet, VarItem } from 'src/preload/data'
import { workerData } from 'node:worker_threads'
import { getMessageData, writeMessageData } from 'src/renderer/src/database/dbc/calc'
import type { Signal } from 'src/renderer/src/database/dbc/dbcVisitor'
import { SomeipMessageBase, SomeipMessageRequest, SomeipMessageResponse } from './someip'
import { SomeipMessage, SomeipMessageType } from '../share/someip'
import { getAllSysVar } from '../share/sysVar'
global.dataSet = workerData as DataSet
const selfDescribe = process.env.ONLY == 'true' ? nodeDescribe.only : nodeDescribe
const selfTest = process.env.ONLY == 'true' ? nodeTest.only : nodeTest
// export { selfDescribe as describe }

/**
 * Create a test group to organize related test cases.
 * **Required container for all test hook functions** (before, after, beforeEach, afterEach).
 * Groups tests logically and provides a scope for shared setup/teardown operations.
 * Automatically increments test counter for proper test enable control tracking.
 *
 * @category TEST
 * @param {string} name - Test group name that describes the functionality being tested
 * @param {Function} fn - Test group function containing test cases and hooks
 *
 * @example
 * ```ts
 * // ✅ Correct: All hooks must be inside describe blocks
 * describe('CAN Communication Tests', () => {
 *   before(async () => {
 *     // One-time setup for the entire test suite
 *     await hardware.initialize();
 *   });
 *
 *   beforeEach(async () => {
 *     // Setup before each test
 *     await can.open('kvaser', 0);
 *   });
 *
 *   test('should send CAN message', () => {
 *     const result = can.send({ id: 0x123, data: [0x01, 0x02] });
 *     assert.equal(result, true);
 *   });
 *
 *   test('should receive CAN message', async () => {
 *     const msg = await can.recv(1000);
 *     assert.notEqual(msg, null);
 *   });
 *
 *   afterEach(async () => {
 *     // Cleanup after each test
 *     await can.close();
 *   });
 *
 *   after(() => {
 *     // Final cleanup for the entire test suite
 *     console.log('All CAN tests completed');
 *   });
 * });
 *
 * // ❌ Wrong: Hooks outside describe blocks will not work
 * // before(() => { // This is invalid });
 * // beforeEach(() => { // This is invalid });
 * // test('standalone test', () => { // This works but hooks don't apply });
 * ```
 */
export function describe(name: string, fn: () => void | Promise<void>) {
  selfDescribe(name, async (t) => {
    before(() => {
      testCnt++
    })

    return preserveErrorStack(fn)
  })
}

const testerList = ['{{{testerName}}}'] as const
const serviceList = ['{{{serviceName}}}'] as const
const allServicesSend = ['{{{serviceName}}}.send'] as const
const allServicesRecv = ['{{{serviceName}}}.recv'] as const
const allSignal = ['{{{signalName}}}'] as const
const allUdsSeq = ['{{{udsSeqName}}}'] as const

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
 * All UDS sequence names configured in Diagnostic Service.
 * @category UDS
 */
export type UdsSeqName = (typeof allUdsSeq)[number]

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
  private addr?: UdsAddress
  constructor(testerName: string, service: ServiceItem, addr?: UdsAddress) {
    super(testerName, cloneDeep(service), false)
    this.addr = addr
  }
  /**
   * Get the UDS address of the response. The address may be undefined if not set.
   * @returns {UdsAddress | undefined} The UDS address if set, undefined otherwise
   */
  getUdsAddress() {
    return this.addr
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
    return !this.service.isNegativeResponse
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
      return this.service.nrc
    } else {
      return undefined
    }
  }
}

/**
 * @category UDS
 */
export class DiagRequest extends Service {
  private addr?: UdsAddress
  constructor(testerName: string, service: ServiceItem, addr?: UdsAddress) {
    super(testerName, cloneDeep(service), true)
    this.addr = addr
  }
  /**
   * Get the UDS address of the request.
   * @returns {UdsAddress | undefined} The UDS address if set, undefined otherwise
   */
  getUdsAddress() {
    return this.addr
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
          const cargs = args.map((item) => {
            if (item instanceof Uint8Array) {
              return Buffer.from(item)
            } else {
              return item
            }
          })
          const v = await (func as any)(...cargs)
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
    } else if (event.endsWith('.send') || event.endsWith('.recv')) {
      const eventArray = event.split('.')
      eventArray[1] = '*'
      if (this.event.listenerCount(eventArray.join('.') as any) > 0) {
        await this.event.emit(eventArray.join('.') as any, data)
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  }
  /**
   * Registers an event listener for CAN messages.
   *
   * @param id - The CAN message ID or ${databaseName}.${frameName} to listen for. If `true`, listens for all CAN messages.
   * @param fc - The callback function to be invoked when a CAN message is received.
   */
  OnCan(id: number | string | true, fc: (msg: CanMessage) => void | Promise<void>) {
    if (id === true) {
      this.event.on('can' as any, fc)
    } else {
      this.event.on(`can.${id}` as any, fc)
    }
  }
  /**
   * Registers an event listener for signal updates from CAN/LIN databases.
   * The signal will be emitted whenever the specified signal value changes.
   *
   * @param signal - The signal name to listen for (format: "database.signalName")
   * @param fc - The callback function invoked when the signal is updated
   * @param fc.rawValue - The raw signal value (number or Buffer)
   * @param fc.physValue - The physical/scaled signal value (could be enum string or scaled number)
   *
   * @example
   * ```typescript
   * // Listen for engine RPM signal updates
   * OnSignal("Engine.EngineRPM", ({ rawValue, physValue }) => {
   *   console.log(`Engine RPM: ${physValue} (raw: ${rawValue})`)
   * })
   *
   * // Listen for gear position signal with enum values
   * OnSignal("Transmission.GearPosition", ({ rawValue, physValue }) => {
   *   console.log(`Gear: ${physValue}`) // Could be "Park", "Drive", "Reverse", etc.
   * })
   *
   * // Async callback example
   * OnSignal("Battery.Voltage", async ({ rawValue, physValue }) => {
   *   if (physValue < 12.0) {
   *     await sendWarning("Low battery voltage detected!")
   *   }
   * })
   * ```
   */
  OnSignal(
    signal: SignalName,
    fc: ({
      rawValue,
      physValue
    }: {
      rawValue: number | Buffer
      physValue: any
    }) => void | Promise<void>
  ) {
    this.event.on(signal as any, fc)
  }

  /**
   * Registers a one-time event listener for signal updates from CAN/LIN databases.
   * The listener will be automatically removed after the first signal update.
   *
   * @param signal - The signal name to listen for (format: "database.signalName")
   * @param fc - The callback function invoked when the signal is updated (only once)
   * @param fc.rawValue - The raw signal value (number or Buffer)
   * @param fc.physValue - The physical/scaled signal value (could be enum string or scaled number)
   *
   * @example
   * ```typescript
   * // Wait for the first engine start signal
   * OnSignalOnce("Engine.EngineStatus", ({ rawValue, physValue }) => {
   *   if (physValue === "Running") {
   *     console.log("Engine started successfully!")
   *   }
   * })
   *
   * // Wait for initialization complete signal
   * OnSignalOnce("System.InitStatus", async ({ rawValue, physValue }) => {
   *   if (physValue === "Complete") {
   *     await startDiagnosticSequence()
   *   }
   * })
   * ```
   */
  OnSignalOnce(
    signal: SignalName,
    fc: ({
      rawValue,
      physValue
    }: {
      rawValue: number | Buffer
      physValue: any
    }) => void | Promise<void>
  ) {
    this.event.once(signal as any).then(fc)
  }

  /**
   * Removes an event listener for signal updates from CAN/LIN databases.
   * The specified callback function will no longer be invoked for signal updates.
   *
   * @param signal - The signal name to stop listening for (format: "database.signalName")
   * @param fc - The exact callback function to remove (must be the same reference)
   *
   * @example
   * ```typescript
   * // Define a callback function
   * const rpmCallback = ({ rawValue, physValue }) => {
   *   console.log(`RPM: ${physValue}`)
   * }
   *
   * // Register the listener
   * OnSignal("Engine.EngineRPM", rpmCallback)
   *
   * // Later, remove the listener
   * OffSignal("Engine.EngineRPM", rpmCallback)
   *
   * // Anonymous functions cannot be removed easily, so use named functions:
   * // ❌ This won't work for removal:
   * // OnSignal("Engine.RPM", ({ physValue }) => console.log(physValue))
   *
   * // ✅ This will work for removal:
   * const callback = ({ physValue }) => console.log(physValue)
   * OnSignal("Engine.RPM", callback)
   * OffSignal("Engine.RPM", callback)
   * ```
   */
  OffSignal(
    signal: SignalName,
    fc: ({
      rawValue,
      physValue
    }: {
      rawValue: number | Buffer
      physValue: any
    }) => void | Promise<void>
  ) {
    this.event.off(signal as any, fc)
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
   * @param id - The CAN message ID or ${databaseName}.${frameName} to listen for. If `true`, listens for all CAN messages.
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
   * Registers an event listener for SOMEIP messages.
   *
   * @param id - The SOMEIP message identifier in format "service.instance.method" or "service.instance.*". If `true`, listens for all SOMEIP messages.
   * @param fc - The callback function to be invoked when a SOMEIP message is received.
   *
   * @example
   * ```ts
   * // Listen for all SOMEIP messages
   * Util.OnSomeipMessage(true, (msg) => {
   *   console.log('Received SOMEIP message:', msg);
   * });
   *
   * // Listen for specific service/instance/method
   * Util.OnSomeipMessage('0034.5678.90ab', (msg) => {
   *   console.log('Received specific SOMEIP message:', msg);
   * });
   *
   * // Listen for specific service/wildcard
   * Util.OnSomeipMessage('0034.*.*', (msg) => {
   *   console.log('Received specific SOMEIP message:', msg);
   * });
   * ```
   */
  OnSomeipMessage(
    id: string | true,
    fc: (msg: SomeipMessageRequest | SomeipMessageResponse) => void | Promise<void>
  ) {
    if (id === true) {
      this.event.on('someip' as any, fc)
    } else {
      this.event.on(`someip.${id}` as any, fc)
    }
  }

  /**
   * Unsubscribes from SOMEIP messages.
   *
   * @param id - The SOMEIP message identifier to unsubscribe from. If `true`, unsubscribes from all SOMEIP messages.
   * @param fc - The callback function to remove from the event listeners.
   *
   * @example
   * ```ts
   * const handler = (msg) => console.log(msg);
   *
   * // Unsubscribe from all SOMEIP messages
   * Util.OffSomeipMessage(true, handler);
   *
   * // Unsubscribe from specific service/instance/method
   * Util.OffSomeipMessage('1234.5678.90ab', handler);
   * ```
   */
  OffSomeipMessage(
    id: string | true,
    fc: (msg: SomeipMessageRequest | SomeipMessageResponse) => void | Promise<void>
  ) {
    if (id === true) {
      this.event.off('someip' as any, fc)
    } else {
      this.event.off(`someip.${id}` as any, fc)
    }
  }

  /**
   * Registers a one-time event listener for SOMEIP messages.
   * The listener will be automatically removed after being invoked once.
   *
   * @param id - The SOMEIP message identifier in format "service.instance.method" or "service.instance.*". If `true`, listens for all SOMEIP messages.
   * @param fc - The callback function to be invoked once when a SOMEIP message is received.
   *
   * @example
   * ```ts
   * // Listen once for any SOMEIP message
   * Util.OnSomeipMessageOnce(true, (msg) => {
   *   console.log('Received one SOMEIP message:', msg);
   * });
   *
   * // Listen once for specific service/instance/method
   * Util.OnSomeipMessageOnce('1234.5678.90ab', (msg) => {
   *   console.log('Received one specific SOMEIP message:', msg);
   * });
   * ```
   */
  OnSomeipMessageOnce(
    id: string | true,
    fc: (msg: SomeipMessageRequest | SomeipMessageResponse) => void | Promise<void>
  ) {
    if (id === true) {
      this.event.once('someip' as any).then(fc)
    } else {
      this.event.once(`someip.${id}` as any).then(fc)
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
   *
   * @example
   * ```ts
   * // Listen for updates to a specific variable
   * Util.OnVar('temperature', ({name, value}) => {
   *   console.log(`${name} changed to ${value}`);
   * });
   *
   * // Listen for all variable updates using wildcard
   * Util.OnVar('*', ({name, value}) => {
   *   console.log(`Variable ${name} updated to ${value}`);
   * });
   * ```
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
        const req = new DiagRequest(testerName, v.service, v.addr)
        await listener(req as any)
      }
      this.event.once(eventName).then(warpFunc)
    } else if (eventName.endsWith('.recv')) {
      const warpFunc = async (v: any) => {
        const testerName = eventName.split('.')[0]
        const resp = new DiagResponse(testerName, v.service, v.addr)
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
        const req = new DiagRequest(testerName, v.service, v.addr)
        await listener(req as any)
      }
      this.event.on(eventName, warpFunc)
      this.funcMap.set(listener, warpFunc)
    } else if (eventName.endsWith('.recv')) {
      const warpFunc = async (v: any) => {
        const testerName = eventName.split('.')[0]
        const resp = new DiagResponse(testerName, v.service, v.addr)
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
  private start(
    val: Record<string, ServiceItem>,
    testerName?: string,
    testControl?: Record<number, boolean>
  ) {
    // process.chdir(projectPath)
    this.testerName = testerName
    global.vars = {}
    if (global.dataSet) {
      const vars: Record<string, VarItem> = cloneDeep(global.dataSet.vars)
      const sysVars = getAllSysVar(
        global.dataSet.devices,
        global.dataSet.tester,
        global.dataSet.database.orti
      )
      for (const v of Object.values(sysVars)) {
        vars[v.id] = cloneDeep(v)
      }
      for (const key of Object.keys(vars)) {
        const v = vars[key]

        if (v.value) {
          const parentName: string[] = []

          // 递归查找所有父级名称
          let currentVar = v
          while (currentVar.parentId) {
            const parent = vars[currentVar.parentId]
            if (parent) {
              parentName.unshift(parent.name) // 将父级名称添加到数组开头
              currentVar = parent
            } else {
              break
            }
          }

          parentName.push(v.name)
          v.name = parentName.join('.')
        }
        global.vars[key] = v
      }
    }
    for (const key of Object.keys(val)) {
      //convert all param.value to buffer
      const service = val[key]
      for (const param of service.params) {
        param.value = Buffer.from(param.value)
      }
      for (const param of service.respParams) {
        param.value = Buffer.from(param.value)
      }
      serviceMap.set(key, service)
    }
    if (testControl) {
      Object.assign(testEnableControl, testControl)
    }
  }
  private async canMsg(msg: CanMessage) {
    //signal emit
    let dbName: string | undefined
    if (msg.device) {
      const device = Object.values(global.dataSet.devices).find(
        (device) => device.canDevice && device.canDevice.name == msg.device
      )
      if (device && device.canDevice!.database) {
        const db = global.dataSet.database.can[device.canDevice!.database]
        if (db) {
          dbName = db.name
          const message = db.messages[msg.id]
          if (message) {
            //apply message to signal
            writeMessageData(message, msg.data, db)
            //emit signal
            for (const signal of Object.values(message.signals)) {
              await this.event.emit(`${db.name}.${signal.name}` as any, {
                rawValue: signal.value,
                physValue: signal.physValueEnum || signal.physValue
              })
            }
          }
        }
      }
    }
    await this.event.emit(`can.${msg.id}` as any, msg)
    if (dbName && msg.name) {
      await this.event.emit(`can.${dbName}.${msg.name}` as any, msg)
    }
    await this.event.emit('can' as any, msg)
  }
  private async linMsg(msg: LinMsg) {
    //signal emit
    let dbName: string | undefined
    if (msg.device) {
      const device = Object.values(global.dataSet.devices).find(
        (device) => device.linDevice && device.linDevice.name == msg.device
      )
      if (device && device.linDevice!.database) {
        const db = global.dataSet.database.lin[device.linDevice!.database]

        if (db) {
          dbName = db.name
          if (!msg.name) {
            for (const frame of Object.values(db.frames)) {
              if (frame.id === msg.frameId) {
                msg.name = frame.name
                break
              }
            }
          }
          if (msg.name) {
            //find frame by frameId
            const frame = db.frames[msg.name]
            if (frame && frame.signals) {
              //apply message to signal
              writeLinMessageData(frame, msg.data, db)
              //emit signal
              for (const signal of Object.values(frame.signals)) {
                const signalDef = db.signals[signal.name]
                if (signalDef) {
                  await this.event.emit(`${db.name}.${signal.name}` as any, {
                    rawValue: signalDef.value,
                    physValue: signalDef.physValueEnum || signalDef.physValue
                  })
                }
              }
            }
          }
        }
      }
    }
    await this.event.emit(`lin.${msg.frameId}` as any, msg)
    if (dbName && msg.name) {
      await this.event.emit(`lin.${dbName}.${msg.name}` as any, msg)
    }
    await this.event.emit('lin' as any, msg)
  }
  private async someipMsg(data: SomeipMessage) {
    let someipMsg: SomeipMessageBase
    if (data.messageType == SomeipMessageType.REQUEST) {
      someipMsg = new SomeipMessageRequest(data)
    } else if (data.messageType == SomeipMessageType.RESPONSE) {
      someipMsg = new SomeipMessageResponse(data)
    } else {
      throw new Error(`someip message type not supported: ${data.messageType}`)
    }

    const msg = someipMsg.msg
    msg.payload = Buffer.from(msg.payload)
    await this.event.emit(
      `someip.${msg.service.toString(16).padStart(4, '0')}.*.*` as any,
      someipMsg
    )
    await this.event.emit(
      `someip.${msg.service.toString(16).padStart(4, '0')}.${msg.instance.toString(16).padStart(4, '0')}.*` as any,
      someipMsg
    )
    await this.event.emit(
      `someip.${msg.service.toString(16).padStart(4, '0')}.${msg.instance.toString(16).padStart(4, '0')}.${msg.method.toString(16).padStart(4, '0')}` as any,
      someipMsg
    )
    await this.event.emit('someip' as any, someipMsg)
  }
  private async keyDown(key: string) {
    await this.event.emit(`keyDown${key}` as any, key)
    await this.event.emit(`keyDown*` as any, key)
  }
  private async varUpdate(data: VarUpdateItem | VarUpdateItem[]) {
    if (Array.isArray(data)) {
      const promiseList: Promise<void>[] = []
      for (const item of data) {
        setVarMain(item.name, item.value)
        promiseList.push(this.event.emit(`varUpdate${item.name}` as any, item))
        promiseList.push(this.event.emit(`varUpdate*` as any, item))
      }
      await Promise.all(promiseList)
    } else {
      setVarMain(data.name, data.value)
      await this.event.emit(`varUpdate${data.name}` as any, data)
      await this.event.emit(`varUpdate*` as any, data)
    }
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
      this.event.on('__someipMsg' as any, this.someipMsg.bind(this))
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
    if (process.env.MODE == 'test') {
      this.event.on('__varFc' as any, async () => {
        try {
          await fc()
          initPromiseResolve()
        } catch (e) {
          initPromiseReject(e)
        }
      })
    } else {
      this.event.on('__varFc' as any, fc)
    }
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
 *     > For more details, please refer to the {@link UtilClass | `UtilClass`} class.
 */
export const Util = new UtilClass()
global.Util = Util
Util.Init(() => {
  initPromiseResolve()
})

/**
 * Sends a CAN message
 *
 * @category CAN
 * @param {CanMessage} msg - The CAN message to be sent
 * @returns {Promise<number>} - Returns a promise that resolves to sent timestamp
 * @example
 * ```ts
 * // Send a standard CAN message with 8 bytes of data
 *  const canMsg: CanMessage = {
      id: 0x111, // CAN ID in hex
      data: Buffer.from([0,1,2,3,4,5,6,7]), // 8 bytes of data
      dir: 'OUT', // Output direction
      msgType: {
        idType: CAN_ID_TYPE.STANDARD, // Standard CAN frame
        remote: false, // Not a remote frame
        brs: false, // No bit rate switching
        canfd: false // Not a CAN FD frame
      }
    }
   const timestamp = await output(canMsg) // Send and get timestamp
 * ```
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
/**
 * Sends a SOMEIP message
 *
 * @category SOMEIP
 * @param {SomeipMessage} msg - The SOMEIP message to be sent
 * @returns {Promise<number>} - Returns a promise that resolves to sent timestamp
 */
export async function output(msg: SomeipMessageBase): Promise<number>
export async function output(msg: CanMessage | LinMsg | SomeipMessageBase): Promise<number> {
  const p: Promise<number> = new Promise((resolve, reject) => {
    workerpool.workerEmit({
      id: id,
      event: 'output',
      data: msg instanceof SomeipMessageBase ? msg.msg : msg
    })
    emitMap.set(id, { resolve, reject })
    id++
  })
  return await p
}

export { SomeipMessageRequest, SomeipMessageResponse }

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
    try {
      setSignalNode({ signal, value })
    } catch (e) {
      reject(e)
      return
    }
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
 * Get a signal's raw value and physical value
 *
 * @category LIN
 * @category CAN
 * @param {SignalName} signal - The signal name in format 'dbName.signalName'
 * @returns {Object} Object containing raw value and physical value
 * @returns {number|number[]|undefined} rawValue - The raw value of the signal
 * @returns {any} physValue - The physical value or enum value of the signal
 *
 * @example
 * ```ts
 * // Get signal value for CAN signal
 * const canSignal = getSignal('can.engineSpeed');
 * console.log('Raw value:', canSignal.rawValue); // e.g. 1000
 * console.log('Physical value:', canSignal.physValue); // e.g. '1000 rpm'
 *
 * // Get signal value for LIN signal
 * const linSignal = getSignal('lin.temperature');
 * console.log('Raw value:', linSignal.rawValue); // e.g. 50
 * console.log('Physical value:', linSignal.physValue); // e.g. '25°C'
 * ```
 */
export function getSignal(signal: SignalName): {
  rawValue: number | number[] | undefined
  physValue: any
} {
  const s = signal.split('.')
  // 验证数据库是否存在
  const db = Object.values(global.dataSet.database.can).find((db) => db.name == s[0])
  if (db) {
    const signalName = s[1]
    let ss: Signal | undefined
    for (const msg of Object.values(db.messages)) {
      for (const signal of Object.values(msg.signals)) {
        if (signal.name == signalName) {
          ss = signal
          break
        }
      }
      if (ss) {
        break
      }
    }
    if (!ss) {
      throw new Error(`Signal ${signalName} not found`)
    }
    return {
      rawValue: ss.value || ss.initValue,
      physValue: ss.physValueEnum || ss.physValue
    }
  } else {
    const linDb = Object.values(global.dataSet.database.lin).find((db) => db.name == s[0])
    if (linDb) {
      const signalName = s[1]

      const signal = linDb.signals[signalName]
      if (!signal) {
        throw new Error(`Signal ${signalName} not found`)
      }
      return {
        rawValue: signal.value || signal.initValue,
        physValue: signal.physValueEnum || signal.physValue
      }
    }
  }

  throw new Error(`Signal ${signal} not found`)
}

/**
 * Set a variable value
 *
 * @category Variable
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
    const { found, target } = setVarMain(name, value)
    if (found && target) {
      workerpool.workerEmit({
        id: id,
        event: 'varApi',
        data: {
          method: 'setVar',
          name,
          value
        }
      })
      emitMap.set(id, { resolve, reject })

      id++
    } else {
      reject(new Error(`var ${name} not found`))
    }
  })

  return await p
}

/**
 * Get a variable value
 *
 * @category Variable
 * @param {string} varName - The name of the variable to get
 * @returns {VarItem} - Returns the variable value and metadata
 *
 * @example
 * ```ts
 * // Get a variable value
 * const var1 = getVar('namespace.var1');
 * console.log(var1.value); // Access the value
 * console.log(var1.type); // Access the type
 * ```
 */
export function getVar<T extends keyof VariableMap>(varName: T): VariableMap[T] {
  return getVarMain(varName) as VariableMap[T]
}

/**
 * Run a UDS sequence
 *
 * @category UDS
 * @param {UdsSeqName} seqName - The name of the UDS sequence to run
 * @param {string} [device] - The optional device name to run the sequence on when multiple devices are connected
 * @returns {Promise<void>} - Returns a promise that resolves when sequence completes
 *
 * @example
 * ```ts
 * // Run a UDS sequence
 * await runUdsSeq('MySequence');
 *
 * // Run sequence on specific device
 * await runUdsSeq('MySequence', 'Device1');
 * ```
 */
export async function runUdsSeq(seqName: UdsSeqName, device?: string): Promise<void> {
  const p: Promise<void> = new Promise((resolve, reject) => {
    workerpool.workerEmit({
      id: id,
      event: 'runUdsSeq',
      data: {
        device,
        name: seqName
      }
    })
    emitMap.set(id, { resolve, reject })
    id++
  })

  return await p
}

/**
 * Stop a running UDS sequence
 *
 * @category UDS
 * @param {UdsSeqName} seqName - The name of the UDS sequence to stop
 * @param {string} [device] - The optional device name when multiple devices are connected
 * @returns {Promise<void>} - Returns a promise that resolves when sequence is stopped
 *
 * @example
 * ```ts
 * // Stop a UDS sequence
 * await stopUdsSeq('MySequence');
 * ```
 */
export async function stopUdsSeq(seqName: UdsSeqName, device?: string): Promise<void> {
  const p: Promise<void> = new Promise((resolve, reject) => {
    workerpool.workerEmit({
      id: id,
      event: 'stopUdsSeq',
      data: {
        device,
        name: seqName
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
 * @deprecated This API is deprecated and not working, enable it through the simulate_by field in the tester config
 *
 * @category DOIP
 * @param {EntityAddr} entity - The entity to be registered.
 * @param {string} ip - The IP address of the entity, if node connected to multiple devices.
 * @returns {Promise<void>} - Returns a promise that resolves when the entity is registered.
 */
export async function RegisterEthVirtualEntity(entity: VinInfo, ip?: string) {
  //Don't do anything
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

/**
 * Start a LIN scheduler
 *
 * @category LIN
 * @param {string} schName - The name of the scheduler to start
 * @returns {Promise<void>} - Returns a promise that resolves when scheduler is started
 *
 * @example
 * ```ts
 * // Start scheduler with default settings
 * await linStartScheduler('MyScheduler');
 * ```
 */
export async function linStartScheduler(schName: string): Promise<void>
/**
 * Start a LIN scheduler
 *
 * @category LIN
 * @param {string} schName - The name of the scheduler to start
 * @param {number} slot - The slot number for the scheduler
 * @returns {Promise<void>} - Returns a promise that resolves when scheduler is started
 *
 * @example
 * ```ts
 * // Start scheduler with specific slot
 * await linStartScheduler('MyScheduler', 0);
 * ```
 */
export async function linStartScheduler(schName: string, slot: number): Promise<void>
/**
 * Start a LIN scheduler
 *
 * @category LIN
 * @param {string} schName - The name of the scheduler to start
 * @param {number} slot - The slot number for the scheduler
 * @param {string} device - The device name to start the scheduler on
 * @returns {Promise<void>} - Returns a promise that resolves when scheduler is started
 *
 * @example
 * ```ts
 * // Start scheduler with slot and device
 * await linStartScheduler('MyScheduler', 0, 'LinDevice1');
 * ```
 */
export async function linStartScheduler(
  schName: string,
  slot: number,
  device: string
): Promise<void>
/**
 * Start a LIN scheduler
 *
 * @category LIN
 * @param {string} schName - The name of the scheduler to start
 * @param {number} slot - The slot number for the scheduler
 * @param {string} device - The device name to start the scheduler on
 * @param {boolean[]} activeCtrl - The active control array for the scheduler
 * @returns {Promise<void>} - Returns a promise that resolves when scheduler is started
 *
 * @example
 * ```ts
 * // Start scheduler with all parameters
 * await linStartScheduler('MyScheduler', 0, 'LinDevice1', [true, false, true, false]);
 * ```
 */
export async function linStartScheduler(
  schName: string,
  slot?: number,
  device?: string,
  activeCtrl?: boolean[]
): Promise<void> {
  const p: Promise<void> = new Promise((resolve, reject) => {
    workerpool.workerEmit({
      id: id,
      event: 'linApi',
      data: {
        method: 'startSch',
        device,
        schName,
        activeCtrl,
        slot
      }
    })
    emitMap.set(id, { resolve, reject })
    id++
  })
  return await p
}

/**
 * Control the power of a LIN device
 *
 * @category LIN
 * @param {boolean} power - The power state to set
 * @param {string} [device] - The optional device name when multiple devices are connected
 * @returns {Promise<void>} - Returns a promise that resolves when power is set
 *
 * @note This function is only available on LinCable devices (https://app.whyengineer.com/docs/um/hardware/lincable.html)
 *
 * @example
 * ```ts
 * // Set power to true
 * await linPowerCtrl(true);
 *
 * // Set power to false on specific device
 * await linPowerCtrl(false, 'Device1');
 * ```
 */
export async function linPowerCtrl(power: boolean, device?: string) {
  const p: Promise<void> = new Promise((resolve, reject) => {
    workerpool.workerEmit({
      id: id,
      event: 'linApi',
      data: {
        method: 'powerCtrl',
        device,
        power
      }
    })
    emitMap.set(id, { resolve, reject })
    id++
  })
  return await p
}

/**
 * Stop a LIN scheduler
 *
 * @category LIN
 * @param {string} [device] - The optional device name when multiple devices are connected
 * @returns {Promise<void>} - Returns a promise that resolves when scheduler is stopped
 *
 * @example
 * ```ts
 * // Stop LIN scheduler
 * await linStopScheduler();
 *
 * // Stop scheduler on specific device
 * await linStopScheduler('Device1');
 * ```
 */
export async function linStopScheduler(device?: string): Promise<void> {
  const p: Promise<void> = new Promise((resolve, reject) => {
    workerpool.workerEmit({
      id: id,
      event: 'linApi',
      data: {
        method: 'stopSch',
        device
      }
    })
    emitMap.set(id, { resolve, reject })
    id++
  })
  return await p
}

/**
 * Set PWM duty cycle
 *
 * @category PWM
 * @param {Object} value - The PWM configuration object
 * @param {number} value.duty - Duty cycle percentage (0-100)
 * @param {string} [value.device] - The optional device name when multiple devices are connected
 * @returns {Promise<void>} - Returns a promise that resolves when duty cycle is set
 *
 * @example
 * ```ts
 * // Set duty cycle to 50%
 * await setPwmDuty({duty: 50});
 *
 * // Set duty cycle on specific device
 * await setPwmDuty({duty: 75, device: 'Device1'});
 * ```
 */
export async function setPwmDuty(value: { duty: number; device?: string }) {
  const p: Promise<void> = new Promise((resolve, reject) => {
    workerpool.workerEmit({
      id: id,
      event: 'pwmApi',
      data: {
        method: 'setDuty',
        duty: value.duty,
        device: value.device
      }
    })
    emitMap.set(id, { resolve, reject })
    id++
  })
  return await p
}
/**
 * Get a frame from database by name
 * 
 * @category LIN
 * @param {('lin')} dbType - The type of database
 * @param {string} dbName - The name of the database
 * @param {string} frameName - The name of the frame to retrieve
 * 
 * @returns {LinMsg} The frame object from the database
 * 
 * @example
 * ```ts
 * // Get a LIN frame
 * const linFrame = getFrameFromDB('lin', 'myLinDb', 'Frame1');

 */
export function getFrameFromDB(dbType: 'lin', dbName: string, frameName: string): LinMsg

/**
 * Get a frame from database by name
 *
 * @category CAN
 * @param {('can')} dbType - The type of database
 * @param {string} dbName - The name of the database
 * @param {string} frameName - The name of the frame to retrieve
 * @returns {CanMessage} The frame object from the database
 *
 * @example
 * ```ts
 * // Get a CAN frame
 * const canFrame = getFrameFromDB('can', 'myCanDb', 'Frame2');
 * ```
 */
export function getFrameFromDB(dbType: 'can', dbName: string, frameName: string): CanMessage
// Implementation
export function getFrameFromDB(
  dbType: 'lin' | 'can',
  dbName: string,
  frameName: string
): LinMsg | CanMessage {
  if (dbType == 'lin') {
    const db = Object.values(global.dataSet.database.lin).find((db) => db.name == dbName)
    if (db) {
      const frame = db.frames[frameName]
      if (frame) {
        // 判断方向
        let direction = LinDirection.RECV
        if (frame.publishedBy === db.node.master.nodeName) {
          direction = LinDirection.SEND
        }

        // 计算校验类型
        const checksumType =
          frame.id === 0x3c || frame.id === 0x3d
            ? LinChecksumType.CLASSIC
            : LinChecksumType.ENHANCED
        const ret: LinMsg = {
          frameId: frame.id,
          data: getFrameData(db, frame),
          direction,
          checksumType,
          database: db.id,
          name: frame.name
        }
        return ret
      } else {
        // is event frame
        const eventFrame = db.eventTriggeredFrames[frameName]
        if (eventFrame) {
          const containsFrame = eventFrame.frameNames[0]
          const frame = db.frames[containsFrame]
          if (frame) {
            const ret: LinMsg = {
              frameId: eventFrame.frameId,
              data: Buffer.alloc(frame.frameSize + 1),
              direction: LinDirection.RECV,
              checksumType: LinChecksumType.CLASSIC,
              database: db.id,
              name: eventFrame.name,
              isEvent: true
            }
            return ret
          }
        }

        // const a = data.frameName.split('.')
        // const slaveNodeName = a[0]
        // const id = a[1]

        // //find slave node
        // const slaveNode = db.nodeAttrs[slaveNodeName]
        // if (slaveNode) {
        //   if (id === 'ReadByIdentifier') {
        //     const data = Buffer.alloc(8)
        //     data.writeUInt8(slaveNode.initial_NAD || 0, 0)
        //     data.writeUInt8(0x6, 1)
        //     data.writeUInt8(0xb2, 2)
        //     data.writeUInt16LE(slaveNode.supplier_id, 4)
        //     data.writeUInt16LE(slaveNode.function_id, 6)
        //     const ret: LinMsg = {
        //       frameId: 0x3c,
        //       data,
        //       direction: LinDirection.SEND,
        //       checksumType: LinChecksumType.CLASSIC,
        //       database: db.id,
        //       name: 'ReadByIdentifier',
        //       isEvent: false
        //     }
        //     return ret
        //   } else if (id === 'AssignNAD') {
        //     const data = Buffer.alloc(8)
        //     data.writeUInt8(slaveNode.initial_NAD || 0, 0)
        //     data.writeUInt8(0x6, 1)
        //     data.writeUInt8(0xb0, 2)
        //     data.writeUInt16LE(slaveNode.supplier_id, 3)
        //     data.writeUInt16LE(slaveNode.function_id, 5)
        //     const ret: LinMsg = {
        //       frameId: 0x3c,
        //       data,
        //       direction: LinDirection.SEND,
        //       checksumType: LinChecksumType.CLASSIC,
        //       database: db.id,
        //       name: 'AssignNAD',
        //       isEvent: false
        //     }
        //     return ret
        //   }
        // }
      }
      throw new Error(`frame ${frameName} not found`)
    } else {
      throw new Error(`database ${dbName} not found`)
    }
  } else if (dbType == 'can') {
    let ret: CanMessage | undefined
    // 查找 CAN 数据库
    const db = Object.values(global.dataSet.database.can).find((db) => db.name == dbName)
    if (db) {
      const msg = Object.values(db.messages).find((m) => m.name === frameName)

      if (msg) {
        // 构造 CanMessage
        return {
          id: msg.id,
          name: msg.name,
          dir: 'OUT',
          data: getMessageData(msg),
          msgType: {
            idType: msg.extId ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
            brs: false,
            canfd: msg.canfd || false,
            remote: false
          },
          database: db.id
        }
      } else {
        throw new Error(`CAN message ${frameName} not found`)
      }
    } else {
      throw new Error(`CAN database ${dbName} not found`)
    }
  } else {
    throw new Error(`database type ${dbType} not supported`)
  }
}
