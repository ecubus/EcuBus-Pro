import EventEmitter from 'events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanBase } from 'src/main/docan/base'
import {
  CAN_ADDR_FORMAT,
  CAN_ADDR_TYPE,
  CAN_ID_TYPE,
  CanAddr,
  CanBaseInfo,
  CanMsgType,
  swapAddr
} from 'src/main/share/can'
import { CanLOG } from 'src/main/log'
import { TesterInfo } from 'src/main/share/tester'

const S3 = 2000

class StubCan extends CanBase {
  event = new EventEmitter()
  info = { id: 'stub', name: 'stub' } as CanBaseInfo
  log = {
    setOption() {
      /* heartbeat arm is logged in production */
    },
    close() {
      /* noop */
    }
  } as unknown as CanLOG
  close() {
    this._close()
  }
  readBase(
    _id: number,
    _msgType: CanMsgType,
    _timeout: number
  ): Promise<{ data: Buffer; ts: number }> {
    return Promise.resolve({ data: Buffer.alloc(0), ts: 0 })
  }
  writeBase(): Promise<number> {
    return Promise.resolve(0)
  }
  getReadBaseId(): string {
    return 'stub'
  }
  setOption(cmd: string, val: any): any {
    return this._setOption(cmd, val)
  }
}

function makeAddr(
  name: string,
  canIdTx: string,
  canIdRx: string,
  addrType: CAN_ADDR_TYPE
): CanAddr {
  return {
    idType: CAN_ID_TYPE.STANDARD,
    addrFormat: CAN_ADDR_FORMAT.NORMAL,
    addrType,
    name,
    canfd: false,
    brs: false,
    remote: false,
    SA: 'F1',
    TA: addrType == CAN_ADDR_TYPE.FUNCTIONAL ? '00' : '01',
    AE: '',
    canIdTx,
    canIdRx,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 0,
    maxWTF: 0,
    dlc: 8,
    padding: true,
    paddingValue: '00'
  }
}

function makeTester(id: string, addrs: CanAddr[], presentIndex: number): TesterInfo {
  return {
    id,
    name: id,
    type: 'can',
    udsTime: {
      pTime: 2000,
      pExtTime: 5000,
      s3Time: S3,
      testerPresentEnable: true,
      testerPresentAddrIndex: presentIndex
    },
    seqList: [],
    address: addrs.map((canAddr) => ({ type: 'can', canAddr })),
    allServiceList: {}
  }
}

describe('tester present pause', () => {
  let base: StubCan

  beforeEach(() => {
    vi.useFakeTimers()
    base = new StubCan()
  })

  afterEach(() => {
    base.close()
    vi.useRealTimers()
  })

  it('pauses a functional heartbeat while a physical request is in progress', async () => {
    const physical = makeAddr('phy', '0x6F1', '0x6F9', CAN_ADDR_TYPE.PHYSICAL)
    const functional = makeAddr('func', '0x760', '0x760', CAN_ADDR_TYPE.FUNCTIONAL)
    const calls: string[] = []
    base.setOption('testerPresent', {
      addr: functional,
      timeout: S3,
      tester: makeTester('ecu', [physical, functional], 1),
      action: async () => {
        calls.push('3e')
      }
    })
    base.setOption('startTesterPresent', functional)

    const request = { ...physical, uuid: 'node-1' }
    base.setOption('stopTesterPresent', request)
    await vi.advanceTimersByTimeAsync(S3 * 3)
    expect(calls).toEqual([])

    const held = base.setOption('getTesterPresent', functional)
    expect(held.suppressCount).toBe(1)
    expect(held.timer).toBeUndefined()

    base.setOption('startTesterPresent', request)
    await vi.advanceTimersByTimeAsync(S3)
    expect(calls).toEqual(['3e'])
  })

  it('pauses the heartbeat for a response sent on the swapped physical address', async () => {
    const physical = makeAddr('phy', '0x6F1', '0x6F9', CAN_ADDR_TYPE.PHYSICAL)
    const functional = makeAddr('func', '0x760', '0x760', CAN_ADDR_TYPE.FUNCTIONAL)
    let calls = 0
    base.setOption('testerPresent', {
      addr: functional,
      timeout: S3,
      tester: makeTester('ecu', [physical, functional], 1),
      action: async () => {
        calls++
      }
    })
    base.setOption('startTesterPresent', functional)
    base.setOption('stopTesterPresent', swapAddr(physical))
    await vi.advanceTimersByTimeAsync(S3 * 2)
    expect(calls).toBe(0)
    base.setOption('startTesterPresent', swapAddr(physical))
    await vi.advanceTimersByTimeAsync(S3)
    expect(calls).toBe(1)
  })

  it('keeps another tester heartbeat running', async () => {
    const physical = makeAddr('phy', '0x6F1', '0x6F9', CAN_ADDR_TYPE.PHYSICAL)
    const functional = makeAddr('func', '0x760', '0x760', CAN_ADDR_TYPE.FUNCTIONAL)
    const otherPhy = makeAddr('otherPhy', '0x7E0', '0x7E8', CAN_ADDR_TYPE.PHYSICAL)
    const otherFunc = makeAddr('otherFunc', '0x7DF', '0x7DF', CAN_ADDR_TYPE.FUNCTIONAL)
    const calls = { ecu: 0, other: 0 }
    base.setOption('testerPresent', {
      addr: functional,
      timeout: S3,
      tester: makeTester('ecu', [physical, functional], 1),
      action: async () => {
        calls.ecu++
      }
    })
    base.setOption('testerPresent', {
      addr: otherFunc,
      timeout: S3,
      tester: makeTester('other', [otherPhy, otherFunc], 1),
      action: async () => {
        calls.other++
      }
    })
    base.setOption('startTesterPresent', functional)
    base.setOption('startTesterPresent', otherFunc)

    base.setOption('stopTesterPresent', physical)
    await vi.advanceTimersByTimeAsync(S3)
    expect(calls).toEqual({ ecu: 0, other: 1 })

    base.setOption('startTesterPresent', physical)
    await vi.advanceTimersByTimeAsync(S3)
    expect(calls.ecu).toBe(1)
  })

  it('does not resume until every overlapping request has finished', async () => {
    const physical = makeAddr('phy', '0x6F1', '0x6F9', CAN_ADDR_TYPE.PHYSICAL)
    const functional = makeAddr('func', '0x760', '0x760', CAN_ADDR_TYPE.FUNCTIONAL)
    let calls = 0
    base.setOption('testerPresent', {
      addr: functional,
      timeout: S3,
      tester: makeTester('ecu', [physical, functional], 1),
      action: async () => {
        calls++
      }
    })
    base.setOption('startTesterPresent', functional)
    base.setOption('stopTesterPresent', physical)
    base.setOption('stopTesterPresent', functional)
    base.setOption('startTesterPresent', physical)
    await vi.advanceTimersByTimeAsync(S3 * 2)
    expect(calls).toBe(0)
    expect(base.setOption('getTesterPresent', functional).suppressCount).toBe(1)

    base.setOption('startTesterPresent', functional)
    await vi.advanceTimersByTimeAsync(S3)
    expect(calls).toBe(1)
  })

  it('does not let an in-flight tester present restart the timer during a request', async () => {
    const physical = makeAddr('phy', '0x6F1', '0x6F9', CAN_ADDR_TYPE.PHYSICAL)
    const functional = makeAddr('func', '0x760', '0x760', CAN_ADDR_TYPE.FUNCTIONAL)
    let calls = 0
    let release: (() => void) | undefined
    base.setOption('testerPresent', {
      addr: functional,
      timeout: S3,
      tester: makeTester('ecu', [physical, functional], 1),
      action: () => {
        calls++
        base.setOption('stopTesterPresent', functional)
        return new Promise<void>((resolve) => {
          release = () => {
            base.setOption('startTesterPresent', functional)
            resolve()
          }
        })
      }
    })
    base.setOption('startTesterPresent', functional)
    await vi.advanceTimersByTimeAsync(S3)
    expect(calls).toBe(1)
    expect(release).toBeTypeOf('function')

    base.setOption('stopTesterPresent', physical)
    release!()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(S3 * 2)
    expect(calls).toBe(1)
    expect(base.setOption('getTesterPresent', functional).suppressCount).toBe(1)

    base.setOption('startTesterPresent', physical)
    await vi.advanceTimersByTimeAsync(S3)
    expect(calls).toBe(2)
  })

  it('still pauses when the request uses the tester present address itself', async () => {
    const functional = makeAddr('func', '0x7DF', '0x7DF', CAN_ADDR_TYPE.FUNCTIONAL)
    let calls = 0
    base.setOption('testerPresent', {
      addr: functional,
      timeout: S3,
      tester: makeTester('ecu', [functional], 0),
      action: async () => {
        calls++
      }
    })
    base.setOption('startTesterPresent', functional)
    base.setOption('stopTesterPresent', functional)
    await vi.advanceTimersByTimeAsync(S3 * 2)
    expect(calls).toBe(0)
    base.setOption('startTesterPresent', functional)
    await vi.advanceTimersByTimeAsync(S3)
    expect(calls).toBe(1)
  })
})
