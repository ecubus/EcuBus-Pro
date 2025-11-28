import { PEAK_TP } from '../../src/main/docan/peak'
import { equal, deepEqual } from 'assert'
import { describe, it, beforeAll, afterAll, test } from 'vitest'
import * as path from 'path'
import {
  addrToId,
  CAN_ADDR_FORMAT,
  CAN_ADDR_TYPE,
  CAN_ID_TYPE,
  CanAddr,
  swapAddr
} from '../../src/main/share/can'
import { CAN_TP, CAN_TP_SOCKET, CanTp } from 'src/main/docan/cantp'
import { ZLG_CAN } from 'src/main/docan/zlg'
import { KVASER_CAN } from 'src/main/docan/kvaser'
import { TOOMOSS_CAN } from 'src/main/docan/toomoss'

const dllPath = path.join(__dirname, '../../resources/lib')
PEAK_TP.loadDllPath(dllPath)
ZLG_CAN.loadDllPath(dllPath)
KVASER_CAN.loadDllPath(dllPath)
TOOMOSS_CAN.loadDllPath(dllPath)
function createIncrementArray(length: number, start = 0) {
  const array: number[] = []
  for (let i = 0; i < length; i++) {
    array.push(start + i)
  }
  return array
}

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
  bs: 16,
  maxWTF: 0,
  dlc: 8,
  padding: false,
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
  bs: 16,
  maxWTF: 0,
  dlc: 8,
  padding: false,
  paddingValue: ''
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
  bs: 16,
  maxWTF: 0,
  dlc: 8,
  padding: false,
  paddingValue: ''
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
  bs: 0,
  maxWTF: 0,
  dlc: 8,
  padding: false,
  paddingValue: ''
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
  bs: 16,
  maxWTF: 0,
  dlc: 8,
  padding: false,
  paddingValue: ''
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
  bs: 16,
  maxWTF: 0,
  dlc: 8,
  padding: false,
  paddingValue: ''
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
  bs: 16,
  maxWTF: 0,
  dlc: 8,
  padding: false,
  paddingValue: ''
}
const addrList = [
  normalAddr
  // normalAddrExt,
  // fixedNormalAddr,
  // extendAddr,
  // extendAddrExt,
  // mixedAddr,
  // mixedAddrExt
]
const dataList = [
  // Buffer.from([1]),
  // Buffer.from(createIncrementArray(5)),
  // Buffer.from(createIncrementArray(6)),
  // Buffer.from(createIncrementArray(7)),
  // Buffer.from(createIncrementArray(8)),
  Buffer.from(createIncrementArray(64)),
  Buffer.from(createIncrementArray(61)),
  Buffer.from(createIncrementArray(62)),
  Buffer.from(createIncrementArray(63)),
  Buffer.from(createIncrementArray(2048))
]

describe('peak cantp', () => {
  let client!: CanTp
  let server!: CanTp
  beforeAll(() => {
    server = new CAN_TP(
      new PEAK_TP({
        handle: 81,
        name: 'test',

        vendor: 'peak',
        canfd: false,
        bitrate: {
          preScaler: 80,
          timeSeg1: 2,
          timeSeg2: 1,
          sjw: 1,
          freq: 250000,
          clock: '80'
        },
        bitratefd: {
          preScaler: 8,
          timeSeg1: 3,
          timeSeg2: 1,
          sjw: 1,
          freq: 2000000
        },
        id: 'peak0'
      })
    )
    client = new CAN_TP(
      new PEAK_TP({
        handle: 82,
        name: 'test',
        id: 'peak1',
        vendor: 'peak',
        canfd: false,
        bitrate: {
          preScaler: 80,
          timeSeg1: 2,
          timeSeg2: 1,
          sjw: 1,
          freq: 250000,
          clock: '80'
        },
        bitratefd: {
          preScaler: 8,
          timeSeg1: 3,
          timeSeg2: 1,
          sjw: 1,
          freq: 2000000
        }
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
  })
})

describe('zlg cantp', () => {
  let client!: CanTp
  let server!: CanTp
  beforeAll(() => {
    server = new CAN_TP(
      new ZLG_CAN({
        handle: '41_0_0',
        name: 'test',
        vendor: 'zlg',
        canfd: false,
        bitrate: {
          freq: 500000,
          preScaler: 1,
          timeSeg1: 68,
          timeSeg2: 11,
          sjw: 11
        },
        bitratefd: {
          freq: 1000000,
          preScaler: 1,
          timeSeg1: 20,
          timeSeg2: 19,
          sjw: 19
        },
        id: 'zlg0'
      })
    )
    client = new CAN_TP(
      new ZLG_CAN({
        handle: '41_0_1',
        name: 'test',
        vendor: 'zlg',
        canfd: false,
        bitrate: {
          freq: 500000,
          preScaler: 1,
          timeSeg1: 68,
          timeSeg2: 11,
          sjw: 11
        },
        bitratefd: {
          freq: 1000000,
          preScaler: 1,
          timeSeg1: 20,
          timeSeg2: 19,
          sjw: 19
        },
        id: 'zlg1'
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
    // client.close()
    // server.close()
  })
})

describe('kvaser cantp', () => {
  let client!: CanTp
  let server!: CanTp
  beforeAll(() => {
    server = new CAN_TP(
      new KVASER_CAN({
        handle: 0,
        name: 'test',

        vendor: 'kvaser',
        canfd: false,
        bitrate: {
          freq: 500000,
          preScaler: 1,
          timeSeg1: 68,
          timeSeg2: 11,
          sjw: 11
        },
        bitratefd: {
          freq: 1000000,
          preScaler: 1,
          timeSeg1: 20,
          timeSeg2: 19,
          sjw: 19
        },
        id: 'kvaser0'
      })
    )
    client = new CAN_TP(
      new KVASER_CAN({
        handle: 1,
        name: 'test',

        vendor: 'kvaser',
        canfd: false,
        bitrate: {
          freq: 500000,
          preScaler: 1,
          timeSeg1: 68,
          timeSeg2: 11,
          sjw: 11
        },
        bitratefd: {
          freq: 1000000,
          preScaler: 1,
          timeSeg1: 20,
          timeSeg2: 19,
          sjw: 19
        },
        id: 'kvaser1'
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
    // client.close()
    // server.close()
  })
})

describe('toomoss cantp', () => {
  let client!: CanTp
  let server!: CanTp
  beforeAll(() => {
    server = new CAN_TP(
      new TOOMOSS_CAN({
        handle: '1417675180:0',
        name: 'server',
        vendor: 'toomoss',
        canfd: true,

        bitrate: {
          freq: 500000,
          preScaler: 1,
          timeSeg1: 68,
          timeSeg2: 11,
          sjw: 11
        },
        bitratefd: {
          freq: 1000000,
          preScaler: 1,
          timeSeg1: 20,
          timeSeg2: 19,
          sjw: 19
        },
        id: 'toomoss0',
        toomossRes: true
      })
    )

    client = new CAN_TP(
      new TOOMOSS_CAN({
        handle: '1417675180:1',
        name: 'client',
        vendor: 'toomoss',
        canfd: true,

        bitrate: {
          freq: 500000,
          preScaler: 1,
          timeSeg1: 68,
          timeSeg2: 11,
          sjw: 11
        },
        bitratefd: {
          freq: 1000000,
          preScaler: 1,
          timeSeg1: 20,
          timeSeg2: 19,
          sjw: 19
        },
        id: 'toomoss1',
        toomossRes: true
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
        console.log('result', result)
        deepEqual(result.data, data)
        clientSocket.close()
        serverSocket.close()
      })
    })
  })
  afterAll(() => {
    client.close()
    server.close()
  })
})
