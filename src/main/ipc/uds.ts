import { BrowserWindow, ipcMain, shell } from 'electron'
import scriptIndex from '../../../resources/docs/.gitkeep?asset&asarUnpack'
import esbuildWin from '../../../resources/bin/esbuild.exe?asset&asarUnpack'
import path from 'path'
import {
  compileTsc,
  createProject,
  deleteNode,
  deleteTester,
  findService,
  getBuildStatus,
  refreshProject,
  UDSTesterMain
} from '../docan/uds'
import { CAN_ID_TYPE, CanInterAction, formatError, swapAddr } from '../share/can'
import { CAN_SOCKET, CanBase } from '../docan/base'
import { CAN_TP, TpError } from '../docan/cantp'
import { getTxPdu, UdsAddress, UdsDevice } from '../share/uds'
import { TesterInfo } from '../share/tester'
import log from 'electron-log'

import { UdsLOG } from '../log'
import { clientTcp, DOIP, getEthDevices } from './../doip'
import { EthAddr, EthBaseInfo } from '../share/doip'

import { getCanDevices, openCanDevice } from '../docan/can'
import dllLib from '../../../resources/lib/zlgcan.dll?asset&asarUnpack'
import { getLinDevices, openLinDevice, updateSignalVal } from '../dolin'
import EventEmitter from 'events'
import LinBase from '../dolin/base'
import { DataSet, LinInter, NodeItem, TestConfig, VarItem } from 'src/preload/data'
import { LinMode } from '../share/lin'
import { LIN_TP } from '../dolin/lintp'
import { TpError as LinTpError } from '../dolin/lintp'
import type { DBC, Message, Signal } from 'src/renderer/src/database/dbc/dbcVisitor'
import { getMessageData } from 'src/renderer/src/database/dbc/calc'
import { NodeClass } from '../nodeItem'
import { getJsPath } from '../util'
import UdsTester from '../workerClient'
import { serviceDetail } from '../uds/service'

const libPath = path.dirname(dllLib)
log.info('dll lib path:', libPath)

ipcMain.on('ipc-service-detail', (event, arg) => {
  event.returnValue = serviceDetail
})

ipcMain.on('ipc-open-script-api', (event, arg) => {
  shell.openPath(path.join(path.dirname(scriptIndex), 'scriptApi', 'index.html'))
})

ipcMain.handle('ipc-get-build-status', async (event, ...arg) => {
  const projectPath = arg[0] as string
  const projectName = arg[1] as string
  const testerScript = arg[2] as string
  return await getBuildStatus(projectPath, projectName, testerScript)
})

ipcMain.handle('ipc-create-project', async (event, ...arg) => {
  const projectPath = arg[0] as string
  const projectName = arg[1] as string
  const data = arg[2] as DataSet

  await createProject(projectPath, projectName, data, 'ECB')
  await refreshProject(projectPath, projectName, data, 'ECB')
  await shell.openPath(path.join(projectPath, `${projectName}.code-workspace`))
})

ipcMain.handle('ipc-build-project', async (event, ...arg) => {
  const projectPath = arg[0] as string
  const projectName = arg[1] as string
  const data = arg[2] as DataSet
  const entry = arg[3] as string
  const isTest = arg[4] || false

  const result = await compileTsc(
    projectPath,
    projectName,
    data,
    entry,
    esbuildWin,
    path.join(libPath, 'js'),
    isTest
  )
  if (result.length > 0) {
    for (const err of result) {
      sysLog.error(`${err.file}:${err.line} build error: ${err.message}`)
    }
  }
  return result
})

ipcMain.handle('ipc-get-test-info', async (event, ...arg) => {
  const projectPath = arg[0] as string
  const projectName = arg[1] as string
  const test = arg[2] as TestConfig
  const testers = arg[3] as Record<string, TesterInfo>

  const log = new UdsLOG(test.name)
  const jsPath = getJsPath(test.script, projectPath)
  const worker = new UdsTester(
    {
      PROJECT_ROOT: projectPath,
      PROJECT_NAME: projectName,
      MODE: 'test',
      NAME: test.name
    },
    jsPath,
    log,
    testers,
    { testOnly: true }
  )
  await worker.start(projectPath)
  const testInfo = await worker.getTestInfo()
  worker.stop()

  return testInfo
})

const testMap = new Map<string, NodeClass>()
ipcMain.handle('ipc-run-test', async (event, ...arg) => {
  const projectPath = arg[0] as string
  const projectName = arg[1] as string
  const test = arg[2] as TestConfig
  const testers = arg[3] as Record<string, TesterInfo>
  const last = testMap.get(test.id)
  if (last) {
    last.close()
    testMap.delete(test.id)
  }
  const nodeItem: NodeItem = {
    id: test.id,
    name: test.name,
    channel: test.channel,
    script: test.script
  }
  const node = new NodeClass(
    nodeItem,
    canBaseMap,
    linBaseMap,
    doips,
    ethBaseMap,
    projectPath,
    projectName,
    testers,
    {
      id: test.id
    }
  )

  await node.start()
  testMap.set(test.id, node)
  try {
    await node.getTestInfo()
  } catch (err: any) {
    null
  }
  node.close()
})
ipcMain.handle('ipc-get-test-report', async (event, ...arg) => {
  const testId = arg[0] as string
  const reportPath = arg[1] as string
  const node = testMap.get(testId)
  if (node) {
    return await node.generateHtml(reportPath)
  }
  return ''
})
ipcMain.handle('ipc-stop-test', async (event, ...arg) => {
  const testId = arg[0] as string
  const worker = testMap.get(testId)
  if (worker) {
    worker.close()
    testMap.delete(testId)
  }
})

ipcMain.handle('ipc-get-test', async (event, ...arg) => {
  return testMap.keys()
})

ipcMain.handle('ipc-delete-node', async (event, ...arg) => {
  const projectPath = arg[0] as string
  const projectName = arg[1] as string
  const node = arg[2]
  // return await deleteNode(projectPath, projectName, node)
})
ipcMain.handle('ipc-delete-tester', async (event, ...arg) => {
  const projectPath = arg[0] as string
  const projectName = arg[1] as string
  const node = arg[2]
  // return await deleteTester(projectPath, projectName, node)
})

ipcMain.handle('ipc-get-can-devices', async (event, ...arg) => {
  return getCanDevices(arg[0])
})

ipcMain.handle('ipc-get-eth-devices', async (event, ...arg) => {
  const vendor = arg[0].toUpperCase()
  if (vendor == 'SIMULATE') {
    return getEthDevices()
  }
  return []
})

ipcMain.handle('ipc-get-lin-devices', async (event, ...arg) => {
  return getLinDevices(arg[0])
})

interface Subscription {
  owner: string
  name: string
  displayName: string
  createdTime: string
  description: string
  user: string
  pricing: string
  plan: string
  payment: string
  startTime: string
  endTime: string
  period: string
  state: string
}

interface NodeItemA {
  close: () => void
}

const canBaseMap = new Map<string, CanBase>()
const ethBaseMap = new Map<string, EthBaseInfo>()
const linBaseMap = new Map<string, LinBase>()
const udsTesterMap = new Map<string, UDSTesterMain>()
const nodeMap = new Map<string, NodeItemA>()
let cantps: {
  close: () => void
}[] = []
let doips: DOIP[] = []

async function globalStart(
  devices: Record<string, UdsDevice>,
  testers: Record<string, TesterInfo>,
  nodes: Record<string, NodeItem>,
  projectInfo: { path: string; name: string }
) {
  let activeKey = ''
  testMap.forEach((value) => {
    value.close()
  })
  testMap.clear()
  try {
    for (const key in devices) {
      const device = devices[key]
      if (device.type == 'can' && device.canDevice) {
        const canDevice = device.canDevice
        activeKey = canDevice.name
        const canBase = openCanDevice(canDevice)

        sysLog.info(`start can device ${canDevice.vendor}-${canDevice.handle} success`)
        if (canBase) {
          canBase.event.on('close', (errMsg) => {
            if (errMsg) {
              sysLog.error(`${canDevice.vendor}-${canDevice.handle} error: ${errMsg}`)
              globalStop(true)
            }
          })
          canBaseMap.set(key, canBase)
        }
      } else if (device.type == 'eth' && device.ethDevice) {
        const ethDevice = device.ethDevice
        activeKey = ethDevice.name
        ethBaseMap.set(key, ethDevice)
      } else if (device.type == 'lin' && device.linDevice) {
        const linDevice = device.linDevice
        activeKey = linDevice.name
        const linBase = openLinDevice(linDevice)
        sysLog.info(`start lin device ${linDevice.vendor}-${linDevice.device.handle} success`)
        if (linBase) {
          linBase.event.on('close', (errMsg) => {
            if (errMsg) {
              sysLog.error(`${linDevice.vendor}-${linDevice.device.handle} error: ${errMsg}`)
              globalStop(true)
            }
          })
          linBaseMap.set(key, linBase)
        }
      }
    }
  } catch (err: any) {
    sysLog.error(`${activeKey} - ${err.toString()}`)
    throw err
  }
  //testes
  const doipConnectList: {
    tester: TesterInfo
    addr: UdsAddress
    connect: () => Promise<clientTcp>
  }[] = []
  for (const key in testers) {
    const tester = testers[key]
    if (tester.type == 'can') {
      for (const val of canBaseMap.values()) {
        const cantp = new CAN_TP(val, true)
        for (const addr of tester.address) {
          if (addr.type == 'can' && addr.canAddr) {
            const id = cantp.getReadId(addr.canAddr)
            cantp.event.on(id, (data) => {
              if (!(data instanceof TpError)) {
                const log = new UdsLOG(tester.name)
                const item = findService(tester, data.data, true)
                if (item) {
                  log.sent(tester.id, item, data.ts, data.data)
                }

                log.close()
              }
            })
            const idR = cantp.getReadId(swapAddr(addr.canAddr))
            cantp.event.on(idR, (data) => {
              if (!(data instanceof TpError)) {
                const log = new UdsLOG(tester.name)
                const item = findService(tester, data.data, false)
                if (item) {
                  log.recv(tester.id, item, data.ts, data.data)
                }
                log.close()
              }
            })
          }
        }
        if (cantp.rxBaseHandleExist.size > 0) {
          cantps.push(cantp)
          if (
            tester.udsTime.testerPresentEnable &&
            tester.udsTime.testerPresentAddrIndex != undefined
          ) {
            const addr = tester.address[tester.udsTime.testerPresentAddrIndex]

            if (addr && addr.canAddr) {
              let data = Buffer.from([0x3e, 0x00])
              if (tester.udsTime.testerPresentSpecialService) {
                const service = tester.allServiceList['0x3E']?.find(
                  (e) => e.id == tester.udsTime.testerPresentSpecialService
                )
                if (service) {
                  data = getTxPdu(service)
                }
              }
              const taddr = addr.canAddr
              cantp.setOption('testerPresent', {
                addr: taddr,
                timeout: tester.udsTime.s3Time,
                action: () => {
                  return cantp.writeTp(taddr, data)
                },
                tester: tester
              })
            }
          }
        }
      }
    } else if (tester.type == 'eth') {
      for (const val of ethBaseMap.values()) {
        const doip = new DOIP(val, tester)
        doips.push(doip)

        for (const addr of tester.address) {
          if (addr.type == 'eth' && addr.ethAddr) {
            doipConnectList.push({
              tester: tester,
              addr: addr,
              connect: () => doip.createClient(addr.ethAddr!)
            })
          }
        }
      }
    } else if (tester.type == 'lin') {
      for (const val of linBaseMap.values()) {
        const lintp = new LIN_TP(val)
        for (const addr of tester.address) {
          if (addr.type == 'lin' && addr.linAddr) {
            const id = lintp.getReadId(LinMode.MASTER, addr.linAddr)
            lintp.event.on(id, (data) => {
              if (!(data instanceof LinTpError)) {
                const log = new UdsLOG(tester.name)

                const item = findService(tester, data.data, true)
                if (item) {
                  log.sent(tester.id, item, data.ts, data.data)
                }

                log.close()
              }
            })
            const idR = lintp.getReadId(LinMode.SLAVE, addr.linAddr)
            lintp.event.on(idR, (data) => {
              if (!(data instanceof LinTpError)) {
                const log = new UdsLOG(tester.name)

                const item = findService(tester, data.data, false)
                if (item) {
                  log.recv(tester.id, item, data.ts, data.data)
                }
                log.close()
              }
            })
          }
        }
        if (lintp.rxBaseHandleExist.size > 0) {
          cantps.push(lintp)
        }
      }
    }
  }

  //nodes
  for (const key in nodes) {
    const node = nodes[key]
    const nodeItem = new NodeClass(
      node,
      canBaseMap,
      linBaseMap,
      doips,
      ethBaseMap,
      projectInfo.path,
      projectInfo.name,
      testers
    )
    try {
      await nodeItem.start()
      nodeMap.set(key, nodeItem)
    } catch (err: any) {
      nodeItem.log?.systemMsg(formatError(err), 0, 'error')
      nodeItem.close()
    }
  }

  //doip connect list
  // const list=doipConnectList.map((e)=>{
  //     return e.connect()
  // })
  // Promise.allSettled(list).then((e) => {
  //     for (const [index, r] of e.entries()) {
  //         if (r.status == 'rejected') {

  //             sysLog.warn(`Tester(${doipConnectList[index].tester.name})-Addr(${doipConnectList[index].addr.ethAddr?.name}) ${r.reason.toString()}, send diag will retry`)

  //         }
  //     }
  // })
}
ipcMain.handle('ipc-global-start', async (event, ...arg) => {
  let i = 0
  const projectInfo = arg[i++] as {
    path: string
    name: string
  }
  const devices = arg[i++] as Record<string, UdsDevice>
  const testers = arg[i++] as Record<string, TesterInfo>
  const nodes = arg[i++] as Record<string, NodeItem>

  global.database = arg[i++]
  global.vars = {}
  const vars: Record<string, VarItem> = arg[i++]
  for (const key in vars) {
    const v = vars[key]
    if (v.value) {
      const parentName: string[] = []
      if (v.parentId) {
        const parent = vars[v.parentId]
        if (parent) {
          parentName.push(parent.name)
        }
      }
      parentName.push(v.name)
      v.name = parentName.join('.')
    }
    global.vars[key] = v
  }
  try {
    await globalStart(devices, testers, nodes, projectInfo)
  } catch (err: any) {
    globalStop(true)
    throw err
  }
})

ipcMain.handle('ipc-switch-tester-present', async (event, ...arg) => {
  const tester = arg[0] as TesterInfo
  const enable = arg[1] as boolean
  if (tester.udsTime.testerPresentEnable && tester.udsTime.testerPresentAddrIndex != undefined) {
    const addr = tester.address[tester.udsTime.testerPresentAddrIndex]

    if (addr && addr.canAddr) {
      for (const base of canBaseMap.values()) {
        if (base.info.id == tester.targetDeviceId) {
          if (enable) {
            base.setOption('enableTesterPresent', addr.canAddr)
          } else {
            base.setOption('disableTesterPresent', addr.canAddr)
          }
        }
      }
    }
  }
})

interface timerType {
  timer: NodeJS.Timeout
  socket: CAN_SOCKET
  period: number
  ia: CanInterAction
}
const timerMap = new Map<string, timerType>()

export function globalStop(emit = false) {
  //clear all timer
  timerMap.forEach((value) => {
    clearInterval(value.timer)
    value.socket.close()
  })
  timerMap.clear()
  canBaseMap.forEach((value) => {
    value.close()
    sysLog.info(`stop can device ${value.info.vendor}-${value.info.handle}`)
  })
  canBaseMap.clear()

  schMap.clear()
  // ethBaseMap.clear()
  linBaseMap.forEach((value) => {
    value.stopSch()
    value.close()
  })
  linBaseMap.clear()

  nodeMap.forEach((value) => {
    value.close()
  })
  nodeMap.clear()
  cantps.forEach((value) => {
    value.close()
  })
  cantps = []

  doips.forEach((value) => {
    value.close()
  })
  doips = []

  if (emit) {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('ipc-global-stop')
    })
  }
}

ipcMain.handle('ipc-global-stop', async (event, ...arg) => {
  globalStop()
})

const schMap = new Map<string, LinBase>()
ipcMain.handle('ipc-start-schedule', async (event, ...arg) => {
  const linIa: LinInter = arg[0] as LinInter
  const schName: string = arg[1] as string
  const active = arg[2]
  //find linBase by linia devices

  linIa.devices.forEach((d) => {
    const base = linBaseMap.get(d)

    if (base && base.info.database) {
      const db = global.database.lin[base.info.database]
      base.startSch(db, schName, active, 0)
      schMap.set(base.info.id, base)
    }
  })
})
ipcMain.handle('ipc-stop-schedule', async (event, ...arg) => {
  const linIa: LinInter = arg[0] as LinInter

  //find linBase by linia devices

  linIa.devices.forEach((d) => {
    const base = linBaseMap.get(d)

    if (base) {
      base.stopSch()
    }
  })
  schMap.delete(linIa.id)
})

ipcMain.handle('ipc-get-schedule', async (event, ...arg) => {
  const id = arg[0] as string
  const val = schMap.get(id)
  return val?.getActiveSchName()
})

ipcMain.handle('ipc-run-sequence', async (event, ...arg) => {
  const projectPath = arg[0] as string
  const projectName = arg[1] as string
  const tester = arg[2] as TesterInfo
  const device = arg[3] as UdsDevice
  const seqIndex = arg[4] as number
  const cycle = arg[5] as number
  let uds: UDSTesterMain | undefined
  try {
    uds = new UDSTesterMain(
      {
        projectPath,
        projectName
      },
      tester,
      device
    )
    if (device.type == 'can' && device.canDevice) {
      const canBase = canBaseMap.get(device.canDevice.id)
      if (canBase) {
        uds.setCanBase(canBaseMap.get(device.canDevice.id))
        udsTesterMap.set(tester.id, uds)
        await uds.runSequence(seqIndex, cycle)
      } else {
        throw new Error(
          `can device ${device.canDevice.vendor}-${device.canDevice.handle} not found`
        )
      }
    } else if (device.type == 'eth' && device.ethDevice) {
      const id = device.ethDevice.id
      const ethBase = doips.find((e) => e.base.id == id)
      if (ethBase) {
        uds.setDoip(ethBase)
        udsTesterMap.set(tester.id, uds)
        await uds.runSequence(seqIndex, cycle)
      } else {
        throw new Error(
          `eth device ${device.ethDevice.vendor}-${device.ethDevice.device.handle} not found`
        )
      }
    } else if (device.type == 'lin' && device.linDevice) {
      const id = device.linDevice.id
      const linBase = linBaseMap.get(id)
      if (linBase) {
        uds.setLinBase(linBase)
        udsTesterMap.set(tester.id, uds)
        await uds.runSequence(seqIndex, cycle)
      } else {
        throw new Error(
          `lin device ${device.linDevice.vendor}-${device.linDevice.device.handle} not found`
        )
      }
    }
  } catch (err: any) {
    uds?.close()
    udsTesterMap.delete(tester.id)
    sysLog.error(`Sequence ${tester.name} ` + err.toString())

    throw err
  }
})

ipcMain.handle('ipc-stop-sequence', async (event, ...arg) => {
  const id = arg[0] as string
  const uds = udsTesterMap.get(id)

  if (uds) {
    uds.cancel()
  }
})

function getLenByDlc(dlc: number, canFd: boolean) {
  const map: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 8,
    10: 8,
    11: 8,
    12: 8,
    13: 8,
    14: 8,
    15: 8
  }
  const mapFd: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 12,
    10: 16,
    11: 20,
    12: 24,
    13: 32,
    14: 48,
    15: 64
  }
  if (canFd) {
    return mapFd[dlc] || 0
  } else {
    return map[dlc] || 0
  }
}
ipcMain.on('ipc-send-can', (event, ...arg) => {
  const ia = arg[0] as CanInterAction

  const canBase = canBaseMap.get(ia.channel)
  if (canBase) {
    const fd = ia.type.includes('fd')
    const len = getLenByDlc(ia.dlc, fd)
    if (fd) {
      if (canBase.info.canfd == false) {
        sysLog.error(`can device ${canBase.info.vendor}-${canBase.info.handle} not enable canfd`)
        return
      }
    }

    const socket = new CAN_SOCKET(
      canBase,
      parseInt(ia.id, 16),
      {
        idType: ia.type.includes('e') ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
        brs: ia.brs || false,
        canfd: fd,
        remote: ia.remote || false
      },
      {
        database: ia.database,
        name: ia.name
      }
    )
    let b: Buffer = Buffer.alloc(len)
    let db: DBC | undefined
    let message: Message | undefined
    if (ia.database) {
      db = global.database.can[ia.database]
      if (db) {
        message = db.messages[parseInt(ia.id, 16)]
        if (message) {
          b = getMessageData(message)
        }
      }
    } else {
      for (const [index, d] of ia.data.entries()) {
        b[index] = parseInt(d, 16)
      }
    }

    socket
      .write(b)
      .catch(null)
      .finally(() => {
        socket.close()
      })
  } else {
    sysLog.error(`can device not found`)
  }
})

// ipcMain.handle('ipc-get-can-period', (event, ...arg) => {
//     const info: Record<string, number> = {}
//     timerMap.forEach((value, key) => {
//         info[key] = value.period
//     })
//     return info
// })

function send(id: string) {
  const item = timerMap.get(id)
  if (!item) return
  let db: DBC | undefined
  let message: Message | undefined
  if (item.ia.database) {
    db = global.database.can[item.ia.database]
    if (db) {
      message = db.messages[parseInt(item.ia.id, 16)]
    }
  }
  if (message) {
    const data = getMessageData(message)
    item.socket.write(data).catch(null)
  } else {
    const b = Buffer.alloc(item.ia.dlc)
    for (const [index, d] of item.ia.data.entries()) {
      b[index] = parseInt(d, 16)
    }
    item.socket.write(b).catch(null)
  }
}
ipcMain.on('ipc-update-can-signal', (event, ...arg) => {
  const dbName = arg[0] as string
  const id = arg[1] as number
  const signalName = arg[2] as string
  const signal = arg[3] as Signal

  const db = global.database.can[dbName]
  if (db) {
    const message = db.messages[id]
    if (message) {
      const rawsignal = message.signals[signalName]
      if (rawsignal) {
        Object.assign(rawsignal, signal)
      }
    }
  }
})

ipcMain.on('ipc-update-can-period', (event, ...arg) => {
  const id = arg[0] as string
  const ia = arg[1] as CanInterAction

  const item = timerMap.get(id)
  if (item) {
    item.ia = ia
  }
})
ipcMain.on('ipc-send-can-period', (event, ...arg) => {
  const id = arg[0] as string
  const ia = arg[1] as CanInterAction

  const canBase = canBaseMap.get(ia.channel)
  if (canBase) {
    const fd = ia.type.includes('fd')
    if (fd) {
      if (canBase.info.canfd == false) {
        sysLog.error(`can device ${canBase.info.vendor}-${canBase.info.handle} not enable canfd`)
        return
      }
    }
    const socket = new CAN_SOCKET(
      canBase,
      parseInt(ia.id, 16),
      {
        idType: ia.type.includes('e') ? CAN_ID_TYPE.EXTENDED : CAN_ID_TYPE.STANDARD,
        brs: ia.brs || false,
        canfd: fd,
        remote: ia.remote || false
      },
      {
        database: ia.database,
        name: ia.name
      }
    )
    //if timer exist, clear it
    const timer = timerMap.get(id)
    if (timer) {
      clearInterval(timer.timer)
      timer.socket.close()
    }

    //create new timer
    const t = setInterval(() => {
      send(id)
    }, ia.trigger.period || 10)
    timerMap.set(id, {
      timer: t,
      socket: socket,
      period: ia.trigger.period || 10,
      ia: ia
    })
  } else {
    sysLog.error(`can device not found`)
  }
})
ipcMain.on('ipc-stop-can-period', (event, ...arg) => {
  const id = arg[0] as string
  const timer = timerMap.get(id)
  if (timer) {
    clearInterval(timer.timer)
    timer.socket.close()
    timerMap.delete(id)
  }
})

ipcMain.on('ipc-update-lin-signals', (event, ...arg) => {
  const dbIndex = arg[0] as string
  const signalName = arg[1] as string
  const value = arg[2] as any
  const db = global.database.lin[dbIndex]
  if (db) {
    updateSignalVal(db, signalName, value)
  }
})
