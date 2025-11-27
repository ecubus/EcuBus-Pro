import { SIMULATE_CAN } from '../../src/main/docan/simulate'
import { equal, deepEqual } from 'assert'
import { describe, it, beforeAll, afterAll } from 'vitest'
import * as path from 'path'
import {
  addrToId,
  CAN_ADDR_FORMAT,
  CAN_ADDR_TYPE,
  CAN_ID_TYPE,
  CanAddr,
  swapAddr
} from '../../src/main/share/can'
import { CAN_TP, CAN_TP_SOCKET, CanTp, TP_ERROR_ID, TpError } from '../../src/main/docan/cantp'
import { CAN_SOCKET } from 'src/main/docan/base'

function createIncrementArray(length: number, start = 0) {
  const array: number[] = []
  for (let i = 0; i < length; i++) {
    array.push(start + i)
  }
  return array
}
describe('simulate can-tp test', () => {
  const normalAddr: CanAddr = {
    idType: CAN_ID_TYPE.STANDARD,
    addrFormat: CAN_ADDR_FORMAT.NORMAL,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    name: 'normalAddr',
    canfd: false,
    brs: false,
    remote: false,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7df',
    canIdRx: '0x7e8',
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    dlc: 0,
    paddingValue: ''
  }
  const normalAddrExt: CanAddr = {
    idType: CAN_ID_TYPE.EXTENDED,
    addrFormat: CAN_ADDR_FORMAT.NORMAL,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'normalAddrExt',
    canfd: false,
    brs: false,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 8
  }
  const fixedNormalAddr: CanAddr = {
    idType: CAN_ID_TYPE.EXTENDED,
    addrFormat: CAN_ADDR_FORMAT.FIXED_NORMAL,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'fixedNormalAddr',
    canfd: false,
    brs: false,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 8
  }
  const extendAddr: CanAddr = {
    idType: CAN_ID_TYPE.STANDARD,
    addrFormat: CAN_ADDR_FORMAT.EXTENDED,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'extendAddr',
    canfd: false,
    brs: false,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 8
  }
  const extendAddrExt: CanAddr = {
    idType: CAN_ID_TYPE.EXTENDED,
    addrFormat: CAN_ADDR_FORMAT.EXTENDED,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'extendAddrExt',
    canfd: false,
    brs: false,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 8
  }
  const mixedAddr: CanAddr = {
    idType: CAN_ID_TYPE.STANDARD,
    addrFormat: CAN_ADDR_FORMAT.MIXED,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'mixedAddr',
    canfd: false,
    brs: false,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 8
  }
  const mixedAddrExt: CanAddr = {
    idType: CAN_ID_TYPE.EXTENDED,
    addrFormat: CAN_ADDR_FORMAT.MIXED,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'mixedAddrExt',
    canfd: false,
    brs: false,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 8
  }
  const addrList = [
    normalAddr,
    normalAddrExt,
    fixedNormalAddr,
    extendAddr,
    extendAddrExt,
    mixedAddr,
    mixedAddrExt
  ]
  const dataList = [
    Buffer.from([1]),
    Buffer.from(createIncrementArray(5)),
    Buffer.from(createIncrementArray(6)),
    Buffer.from(createIncrementArray(7)),
    Buffer.from(createIncrementArray(8)),
    Buffer.from(createIncrementArray(60)),
    Buffer.from(createIncrementArray(61)),
    // Buffer.from(createIncrementArray(62)),
    // Buffer.from(createIncrementArray(63)),
    // Buffer.from(createIncrementArray(64)),
    Buffer.from(createIncrementArray(220))
  ]
  let client!: CanTp
  let server!: CanTp
  describe('dual self tp', () => {
    beforeAll(() => {
      server = new CAN_TP(
        new SIMULATE_CAN({
          handle: 0,
          name: 'test',

          vendor: 'simulate',
          canfd: false,
          bitrate: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          bitratefd: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          id: '1'
        })
      )
      client = new CAN_TP(
        new SIMULATE_CAN({
          handle: 1,
          name: 'test',

          vendor: 'simulate',
          canfd: false,
          bitrate: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          bitratefd: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          id: '1'
        })
      )
    })
    dataList.forEach((data) => {
      addrList.forEach((addr) => {
        it(`write ${data.length} bytes data to ${addr.name}`, async () => {
          const clientSocket = new CAN_TP_SOCKET(client, addr)
          const serverSocket = new CAN_TP_SOCKET(server, swapAddr(addr))
          await clientSocket.write(data)
          const result = await serverSocket.read(1000)
          deepEqual(result.data, data)
          clientSocket.close()
          serverSocket.close()
        })
      })
    })
    afterAll(() => {
      client.close()
      server.close()
      equal(client.event.eventNames().length, 0)
      equal(server.event.eventNames().length, 0)
    })
  })
  describe('dual self tp error check client', () => {
    beforeAll(() => {
      server = new CAN_TP(
        new SIMULATE_CAN({
          handle: 0,
          name: 'test',

          vendor: 'simulate',
          canfd: false,
          bitrate: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          bitratefd: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          id: '1'
        })
      )
      client = new CAN_TP(
        new SIMULATE_CAN({
          handle: 1,
          name: 'test',

          vendor: 'simulate',
          canfd: false,
          bitrate: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          bitratefd: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          id: '1'
        })
      )
    })
    it('write without fc', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: false,
        brs: false,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }
      const clientSocket = new CAN_TP_SOCKET(client, addr)
      try {
        await clientSocket.write(
          Buffer.from([
            0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
            0x0f, 0x10
          ])
        )
        equal(true, false)
      } catch (e: any) {
        equal(e.errorId, TP_ERROR_ID.TP_TIMEOUT_BS)
      }
      clientSocket.close()
    })
    it('read and close', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: false,
        brs: false,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }
      // server.addMapping(addr)
      const clientSocket = new CAN_TP_SOCKET(client, addr)
      try {
        setTimeout(() => {
          clientSocket.close()
        }, 100)
        await clientSocket.read(2000)
        equal(true, false)
      } catch (e: any) {
        equal(e.errorId, TP_ERROR_ID.TP_BUS_CLOSED)
      }
      clientSocket.close()
    })
    it('read and N_CR timeout', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: false,
        brs: false,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }
      // server.addMapping(addr)
      const clientSocket = new CAN_TP_SOCKET(client, addr)
      try {
        setTimeout(() => {
          const servers = server as CAN_TP
          const recvId = addrToId(swapAddr(addr))
          const canSocket = new CAN_SOCKET(servers.base, recvId, addr)
          canSocket.write(Buffer.from([0x12, 0x58, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05]))
          setTimeout(() => {
            canSocket.write(Buffer.from([0x21, 0x58, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05]))
          }, 100)
        }, 100)
        const d = await clientSocket.read(2000)
        equal(true, false)
      } catch (e: any) {
        equal(e.errorId, TP_ERROR_ID.TP_TIMEOUT_CR)
      }
      clientSocket.close()
    })
    it('write has first fc without next fc', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: false,
        brs: false,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }
      const data = Buffer.from(createIncrementArray(600))
      // server.addMapping(addr)
      try {
        const servers = server as CAN_TP
        setTimeout(() => {
          if (addr.bs > 0) {
            servers.sendFC(swapAddr(addr), 0, false)
          }
        }, 100)

        await client.writeTp(addr, data)

        equal(true, false)
      } catch (e: any) {
        // console.log(e)
        equal(e.errorId, TP_ERROR_ID.TP_TIMEOUT_BS)
        // client.close()
      }
    })
    it('write and close', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: false,
        brs: false,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }
      const data = Buffer.from([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10
      ])
      // server.addMapping(addr)
      try {
        setTimeout(() => {
          client.close()
        }, 10)
        await client.writeTp(addr, data)
        equal(true, false)
      } catch (e: any) {
        // console.log(e)
        equal(e.errorId, TP_ERROR_ID.TP_BUS_CLOSED)
        client.close()
      }
    })

    afterAll(() => {
      client.close()
      server.close()
      equal(client.event.eventNames().length, 0)
      equal(server.event.eventNames().length, 0)
    })
  })
})

describe('simulate canfd can-tp test', () => {
  const normalAddr: CanAddr = {
    idType: CAN_ID_TYPE.STANDARD,
    addrFormat: CAN_ADDR_FORMAT.NORMAL,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    name: 'normalAddr',
    canfd: true,
    brs: true,
    remote: false,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7df',
    canIdRx: '0x7e8',
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: true,
    paddingValue: '',
    dlc: 10
  }
  const normalAddrExt: CanAddr = {
    idType: CAN_ID_TYPE.EXTENDED,
    addrFormat: CAN_ADDR_FORMAT.NORMAL,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'normalAddrExt',
    canfd: true,
    brs: true,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 10
  }
  const fixedNormalAddr: CanAddr = {
    idType: CAN_ID_TYPE.EXTENDED,
    addrFormat: CAN_ADDR_FORMAT.FIXED_NORMAL,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'fixedNormalAddr',
    canfd: true,
    brs: true,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 8
  }
  const extendAddr: CanAddr = {
    idType: CAN_ID_TYPE.STANDARD,
    addrFormat: CAN_ADDR_FORMAT.EXTENDED,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'extendAddr',
    canfd: true,
    brs: true,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 8
  }
  const extendAddrExt: CanAddr = {
    idType: CAN_ID_TYPE.EXTENDED,
    addrFormat: CAN_ADDR_FORMAT.EXTENDED,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'extendAddrExt',
    canfd: true,
    brs: true,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 8
  }
  const mixedAddr: CanAddr = {
    idType: CAN_ID_TYPE.STANDARD,
    addrFormat: CAN_ADDR_FORMAT.MIXED,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'mixedAddr',
    canfd: true,
    brs: true,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 15
  }
  const mixedAddrExt: CanAddr = {
    idType: CAN_ID_TYPE.EXTENDED,
    addrFormat: CAN_ADDR_FORMAT.MIXED,
    addrType: CAN_ADDR_TYPE.PHYSICAL,
    SA: '01',
    TA: '02',
    AE: '03',
    canIdTx: '0x7e8',
    canIdRx: '0x7df',
    name: 'mixedAddrExt',
    canfd: true,
    brs: true,
    remote: false,
    nAs: 1000,
    nAr: 1000,
    nBs: 1000,
    nCr: 1000,
    stMin: 0,
    bs: 1,
    maxWTF: 0,
    padding: false,
    paddingValue: '',
    dlc: 8
  }
  const addrList = [
    normalAddr,
    normalAddrExt,
    fixedNormalAddr,
    extendAddr,
    extendAddrExt,
    mixedAddr,
    mixedAddrExt
  ]
  const dataList = [
    // Buffer.from(createIncrementArray(13)),
    Buffer.from(createIncrementArray(17)),
    Buffer.from(createIncrementArray(18)),
    Buffer.from(createIncrementArray(19)),
    // Buffer.from(createIncrementArray(20)),
    // Buffer.from(createIncrementArray(21)),
    // Buffer.from(createIncrementArray(63)),
    // Buffer.from(createIncrementArray(64)),
    Buffer.from(createIncrementArray(220))
  ]
  let client!: CanTp
  let server!: CanTp
  describe('dual self tp', () => {
    beforeAll(() => {
      server = new CAN_TP(
        new SIMULATE_CAN({
          handle: 0,
          name: 'test',

          vendor: 'simulate',
          canfd: true,
          bitrate: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          bitratefd: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          id: '1'
        })
      )
      client = new CAN_TP(
        new SIMULATE_CAN({
          handle: 1,
          name: 'test',

          vendor: 'simulate',
          canfd: true,
          bitrate: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          bitratefd: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          id: '2'
        })
      )
    })
    dataList.forEach((data) => {
      addrList.forEach((addr) => {
        it(`write ${data.length} bytes data to ${addr.name}`, async () => {
          const clientSocket = new CAN_TP_SOCKET(client, addr)
          const serverSocket = new CAN_TP_SOCKET(server, swapAddr(addr))
          await clientSocket.write(data)
          const result = await serverSocket.read(1000)
          deepEqual(result.data, data)
          clientSocket.close()
          serverSocket.close()
        })
      })
    })
    afterAll(() => {
      client.close()
      server.close()
      equal(client.event.eventNames().length, 0)
      equal(server.event.eventNames().length, 0)
    })
  })
  describe('dual self tp error check client', () => {
    beforeAll(() => {
      server = new CAN_TP(
        new SIMULATE_CAN({
          handle: 0,
          name: 'test',

          vendor: 'simulate',
          canfd: true,
          bitrate: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          bitratefd: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          id: '1'
        })
      )
      client = new CAN_TP(
        new SIMULATE_CAN({
          handle: 1,
          name: 'test',
          id: '1',
          vendor: 'simulate',
          canfd: true,
          bitrate: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          },
          bitratefd: {
            freq: 500000,
            timeSeg1: 0x0f,
            timeSeg2: 0x04,
            sjw: 0x01,
            preScaler: 0x01
          }
        })
      )
    })

    it('write without fc', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: true,
        brs: true,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }
      const clientSocket = new CAN_TP_SOCKET(client, addr)
      try {
        await clientSocket.write(Buffer.from(createIncrementArray(600)))
        equal(true, false)
      } catch (e: any) {
        equal(e.errorId, TP_ERROR_ID.TP_TIMEOUT_BS)
      }
      clientSocket.close()
    })
    it('error sf', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: true,
        brs: true,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }
      const clientSocket = new CAN_TP_SOCKET(client, addr)
      const servers = server as CAN_TP
      const recvId = addrToId(swapAddr(addr))
      const canSocket = new CAN_SOCKET(servers.base, recvId, addr)
      canSocket.write(Buffer.from('0013000102030405060708090a0b0c0d0e0f1011', 'hex'))

      try {
        await clientSocket.read(1000)
        equal(true, false)
      } catch (e: any) {
        equal(e.errorId, TP_ERROR_ID.TP_TIMEOUT_UPPER_READ)
      }
      clientSocket.close()
    })
    it('error ff', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: true,
        brs: true,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }
      const clientSocket = new CAN_TP_SOCKET(client, addr)
      const servers = server as CAN_TP
      const recvId = addrToId(swapAddr(addr))
      const canSocket = new CAN_SOCKET(servers.base, recvId, addr)
      canSocket.write(Buffer.from('1003000102030405060708090A0B0C0D0E0F', 'hex'))

      try {
        await clientSocket.read(1000)
        equal(true, false)
      } catch (e: any) {
        equal(e.errorId, TP_ERROR_ID.TP_TIMEOUT_UPPER_READ)
      }
      clientSocket.close()
    })
    it('read and close', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: true,
        brs: true,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }

      // server.addMapping(addr)
      const clientSocket = new CAN_TP_SOCKET(client, addr)
      try {
        setTimeout(() => {
          clientSocket.close()
        }, 100)
        await clientSocket.read(2000)
        equal(true, false)
      } catch (e: any) {
        equal(e.errorId, TP_ERROR_ID.TP_BUS_CLOSED)
      }
      clientSocket.close()
    })
    it('read and N_CR timeout', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: true,
        brs: true,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }
      // server.addMapping(addr)
      const clientSocket = new CAN_TP_SOCKET(client, addr)
      try {
        setTimeout(() => {
          const servers = server as CAN_TP
          const recvId = addrToId(swapAddr(addr))
          const canSocket = new CAN_SOCKET(servers.base, recvId, addr)
          canSocket.write(Buffer.from('10DC000102030405060708090A0B0C0D0E0F1011', 'hex'))
          setTimeout(() => {
            canSocket.write(Buffer.from('211213141516171091A1B1C1D1E1F2021222324', 'hex'))
          }, 100)
        }, 100)
        await clientSocket.read(2000)
        equal(true, false)
      } catch (e: any) {
        equal(e.errorId, TP_ERROR_ID.TP_TIMEOUT_CR)
      }
      clientSocket.close()
    })
    it('write has first fc without next fc', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: true,
        brs: true,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }
      const data = Buffer.from(createIncrementArray(600))
      // server.addMapping(addr)
      try {
        const servers = server as CAN_TP
        setTimeout(() => {
          servers.sendFC(swapAddr(addr), 0, false)
        }, 100)

        await client.writeTp(addr, data)

        equal(true, false)
      } catch (e: any) {
        equal(e.errorId, TP_ERROR_ID.TP_TIMEOUT_BS)
        // client.close()
      }
    })
    it('write and close', async () => {
      const addr: CanAddr = {
        idType: CAN_ID_TYPE.STANDARD,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '01',
        TA: '02',
        AE: '03',
        canIdTx: '0x7df',
        canIdRx: '0x7e8',
        name: 'addr',
        canfd: true,
        brs: true,
        remote: false,
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        stMin: 0,
        bs: 1,
        maxWTF: 0,
        padding: false,
        paddingValue: '',
        dlc: 8
      }
      const data = Buffer.from(createIncrementArray(600))
      // server.addMapping(addr)
      try {
        setTimeout(() => {
          client.close()
        }, 10)
        await client.writeTp(addr, data)
        equal(true, false)
      } catch (e: any) {
        // console.log(e)
        equal(e.errorId, TP_ERROR_ID.TP_BUS_CLOSED)
        client.close()
      }
    })

    afterAll(() => {
      client.close()
      server.close()
      equal(client.event.eventNames().length, 0)
      equal(server.event.eventNames().length, 0)
    })
  })
})

//error SF: 0013000102030405060708090a0b0c0d0e0f1011
//error FF: 1011000102030405060708090A0B0C0D0E0F10
