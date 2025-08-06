import { test, expect, describe, beforeAll, afterAll } from 'vitest'
import { EntityAddr, EthAddr, EthBaseInfo, EthDevice } from '../../src/main/share/doip'
import { clientTcp, DOIP, DOIP_ERROR_ID, DoipError } from '../../src/main/doip'
import { cloneDeep } from 'lodash'
const eth: EthBaseInfo = {
  device: {
    label: '',
    id: '',
    handle: '127.0.0.1'
  },
  name: 'localhost',
  vendor: 'simulate',
  id: 'localhost'
}

const ethAddr: EthAddr = {
  name: '',
  taType: 'physical',
  tester: {
    routeActiveTime: 0,
    createConnectDelay: 0,
    testerLogicalAddr: 0
  },
  entity: {
    vin: 'ecubus-pro111111111111111111111',
    logicalAddr: 1,
    eid: '00-00-00-00-00-00-00-00',
    gid: '00-00-00-00-00-00-00-00'
  },
  virReqType: 'omit',
  virReqAddr: ''
}
describe('vin request', () => {
  let doip: DOIP
  beforeAll(async () => {
    doip = new DOIP(eth)
  })
  test('vin request', async () => {
    const r = await doip.sendVehicleIdentificationRequest(ethAddr)
    expect(r.length).toBe(0)
  })
  test('vin request with vin', async () => {
    const r = await doip.sendVehicleIdentificationRequestWithVIN(ethAddr)
    expect(r.length).toBe(0)
  })

  test('vin request with eid', async () => {
    const r = await doip.sendVehicleIdentificationRequestWithEID(ethAddr)
    expect(r.length).toBe(0)
  })
  afterAll(() => {
    doip.close()
  })
})
describe('vin request with resp', () => {
  let doip: DOIP
  beforeAll(async () => {
    doip = new DOIP(eth)
    await doip.registerEntity(ethAddr.entity, false)
  })
  test('vin request', async () => {
    const r = await doip.sendVehicleIdentificationRequest(ethAddr)
    expect(r.length).toBe(1)
  })
  test('vin request with vin', async () => {
    const r = await doip.sendVehicleIdentificationRequestWithVIN(ethAddr)
    //TODO:
    expect(r.length).toBe(1)
  })

  test('vin request with eid', async () => {
    const r = await doip.sendVehicleIdentificationRequestWithEID(ethAddr)
    expect(r.length).toBe(1)
  })
  afterAll(() => {
    doip.close()
  })
})
describe('announce check', () => {
  let doip: DOIP
  beforeAll(async () => {
    doip = new DOIP(eth)
    await doip.registerEntity(ethAddr.entity, true)
  })
  test('entry found', () => {
    const e = doip.entityMap
    expect(e.size).toBe(1)
  })
  afterAll(() => {
    doip.close()
  })
})

describe('doip client with self entity', () => {
  let doip: DOIP
  beforeAll(async () => {
    doip = new DOIP(eth)
    await doip.registerEntity(ethAddr.entity, false)
  })
  test('connect entity', async () => {
    const e = await doip.createClient(ethAddr)
    await doip.routeActiveRequest(e)
    expect(e.state).toBe('active')
  })

  afterAll(() => {
    doip.close()
  })
})
describe('doip diag 0x10', () => {
  let doip: DOIP
  let client: clientTcp
  beforeAll(async () => {
    doip = new DOIP(eth)
    await doip.registerEntity(ethAddr.entity, false)
  })
  test('connect entity', async () => {
    const e = await doip.createClient(ethAddr)
    await doip.routeActiveRequest(e)
    expect(e.state).toBe('active')
    client = e
  })
  test('write diag request', async () => {
    await doip.writeTpReq(client, Buffer.from([0x10, 0x02]))
  })
  test('write diag response', async () => {
    await doip.writeTpResp(ethAddr.tester, Buffer.from([0x50, 0x02]))
  })

  afterAll(() => {
    doip.close()
  })
})
describe.skip('doip client without entity', () => {
  let doip: DOIP
  beforeAll(async () => {
    doip = new DOIP(eth)
  })
  test('connect entity', async () => {
    try {
      const e = await doip.createClient(ethAddr)
      await doip.routeActiveRequest(e)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e.errorId).toBe(DOIP_ERROR_ID.DOIP_PARAM_ERR)
    }
  })
  afterAll(() => {
    doip.close()
  })
})

describe.skip('doip client directly', () => {
  let doip: DOIP
  beforeAll(async () => {
    doip = new DOIP(eth)
  })
  test('connect entity', async () => {
    try {
      const ethAddr1 = cloneDeep(ethAddr)
      ethAddr1.virReqType = 'omit'
      ethAddr1.virReqAddr = '192.168.1.1'
      const e = await doip.createClient(ethAddr1)
      await doip.routeActiveRequest(e)
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e.errorId).toBe(DOIP_ERROR_ID.DOIP_TCP_ERROR)
    }
  })
  afterAll(() => {
    doip.close()
  })
})

describe('doip client twice with same tester', () => {
  let doip: DOIP
  beforeAll(async () => {
    doip = new DOIP(eth)
    await doip.registerEntity(ethAddr.entity, false)
  })
  test('connect entity', async () => {
    const e = await doip.createClient(ethAddr)
    await doip.routeActiveRequest(e)
    expect(e.state).toBe('active')
  })
  test('connect entity again with same tester', async () => {
    const ethAddr1 = cloneDeep(ethAddr)

    const e = await doip.createClient(ethAddr1)
    try {
      await doip.routeActiveRequest(e)
      expect(e.state).toBe('active')
    } catch (e: any) {
      expect(e.errorId).toBe(DOIP_ERROR_ID.DOIP_ROUTE_ACTIVE_ERR)
    }
  })
  afterAll(() => {
    doip.close()
  })
})

describe.skip('doip client twice with diff tester', () => {
  let doip: DOIP
  beforeAll(async () => {
    doip = new DOIP(eth)
    await doip.registerEntity(ethAddr.entity)
  })
  test('connect entity', async () => {
    const e = await doip.createClient(ethAddr)
    await doip.routeActiveRequest(e)
    expect(e.state).toBe('active')
  })
  test('connect entity again with diff tester', async () => {
    const ethAddr1 = cloneDeep(ethAddr)
    ethAddr1.tester.testerLogicalAddr = 3
    const e = await doip.createClient(ethAddr1)
    await doip.routeActiveRequest(e)
    expect(e.state).toBe('active')
    expect(doip.connectTable.length).toBe(2)
  })
  afterAll(() => {
    doip.close()
  })
})

