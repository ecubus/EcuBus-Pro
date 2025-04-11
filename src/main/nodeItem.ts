import path from 'path'
import fs from 'fs'
import { CanAddr, CanMessage, getTsUs, swapAddr } from './share/can'
import { TesterInfo } from './share/tester'
import UdsTester from './workerClient'
import { CAN_TP, TpError as CanTpError } from './docan/cantp'
import { UdsLOG, VarLOG } from './log'
import { applyBuffer, getRxPdu, getTxPdu, ServiceItem } from './share/uds'
import { findService } from './docan/uds'
import { cloneDeep } from 'lodash'
import type { Message, Signal } from 'src/renderer/src/database/dbc/dbcVisitor'
import { updateSignalPhys, updateSignalRaw } from 'src/renderer/src/database/dbc/calc'
import { NodeItem } from 'src/preload/data'
import LinBase from './dolin/base'
import { EthAddr, EthBaseInfo, VinInfo } from './share/doip'
import { LIN_TP, TpError as LinTpError } from './dolin/lintp'
import { LinMode, LinMsg } from './share/lin'
import { updateSignalVal } from './dolin'
import { DOIP, DoipError } from './doip'
import { CanBase } from './docan/base'
import Transport from 'winston-transport'
import logo from './logo.html?raw'
import fsP from 'fs/promises'
import type { TestEvent } from 'node:test/reporters'

type TestTree = {
  label: string
  type: 'test' | 'config' | 'log'
  children: TestTree[]

  time?: string
  status?: 'pass' | 'fail' | 'skip' | 'running'
  msg?: string
  nesting?: number
  parent?: TestTree
}

type TestLog = {
  message: {
    method: string
    data: any
  }
  level: string
  label: string
}

class TestTransport extends Transport {
  constructor(
    private cb: (info: any) => void,
    opts?: Transport.TransportStreamOptions
  ) {
    super(opts)
    //
    // Consume any custom options here. e.g.:
    // - Connection information for databases
    // - Authentication information for APIs (e.g. loggly, papertrail,
    //   logentries, etc.).
    //
  }

  log(info: any, callback: () => void) {
    this.cb(info)

    // Perform the writing to the remote service
    callback()
  }
}
export class NodeClass {
  private pool?: UdsTester
  private cantp: CAN_TP[] = []
  private lintp: LIN_TP[] = []
  private linBaseId: string[] = []
  private canBaseId: string[] = []
  private ethBaseId: string[] = []
  private startTs = 0
  private boundCb: (frame: CanMessage | LinMsg) => void

  freeEvent: {
    doip: DOIP
    id: string
    cb: (data: { data: Buffer; ts: number } | DoipError) => void
  }[] = []
  log?: UdsLOG
  varLog: VarLOG
  logs: TestLog[] = []
  constructor(
    public nodeItem: NodeItem,
    private canBaseMap: Map<string, CanBase>,
    private linBaseMap: Map<string, LinBase>,
    private doips: DOIP[],
    private ethBaseMap: Map<string, EthBaseInfo>,
    private projectPath: string,
    private projectName: string,
    private testers: Record<string, TesterInfo>,
    private testOptions?:
      | {
          testOnly?: boolean
          id?: string
        }
      | undefined
  ) {
    this.varLog = new VarLOG(nodeItem.id)
    this.boundCb = this.cb.bind(this)

    for (const c of nodeItem.channel) {
      const baseItem = this.canBaseMap.get(c)
      if (baseItem) {
        this.canBaseId.push(c)
        baseItem.attachCanMessage(this.boundCb)
        continue
      }
      const linBaseItem = this.linBaseMap.get(c)
      if (linBaseItem) {
        linBaseItem.attachLinMessage(this.boundCb)
        this.linBaseId.push(c)
        if (nodeItem.workNode) {
          const db = linBaseItem.setupEntry(nodeItem.workNode)
          if (db) {
            linBaseItem.registerNode(db, nodeItem.workNode)
          }
        }
        continue
      }
      const ethBaseItem = this.ethBaseMap.get(c)
      if (ethBaseItem) {
        this.ethBaseId.push(c)
      }
    }
    if (nodeItem.script) {
      const outDir = path.join(this.projectPath, '.ScriptBuild')
      const scriptNameNoExt = path.basename(nodeItem.script, '.ts')
      const jsPath = path.join(outDir, scriptNameNoExt + '.js')
      if (fs.existsSync(jsPath)) {
        this.log = new UdsLOG(`${nodeItem.name} ${path.basename(nodeItem.script)}`)
        if (this.testOptions) {
          this.log.addMethodPrefix('test-')

          const testTransport = new TestTransport((info: any) => {
            const method = info.message.method
            if (
              method == 'test-udsSystem' ||
              method == 'test-udsScript' ||
              method == 'test-udsWarning' ||
              method == 'testInfo'
            ) {
              this.logs.push(info)
            }
          })
          this.log.addTransport(testTransport)
        }
        this.pool = new UdsTester(
          {
            PROJECT_ROOT: this.projectPath,
            PROJECT_NAME: this.projectName,
            MODE: this.testOptions ? 'test' : 'node',
            NAME: nodeItem.name
          },
          jsPath,
          this.log,
          this.testers,
          this.testOptions
        )
        if (this.testOptions) {
          this.startTs = getTsUs()
          this.log?.systemMsg(`Test Config ${this.nodeItem.name} starting...`, getTsUs(), 'info')
        }
        this.pool.registerHandler('output', this.sendFrame.bind(this))
        this.pool.registerHandler('sendDiag', this.sendDiag.bind(this))
        this.pool.registerHandler('setSignal', this.setSignal.bind(this))
        this.pool.registerHandler('setVar', this.setVar.bind(this))
        if (this.ethBaseId.length > 0) {
          this.pool.registerHandler(
            'registerEthVirtualEntity',
            this.registerEthVirtualEntity.bind(this)
          )
        }

        //cantp
        for (const tester of Object.values(this.testers)) {
          if (tester && tester.address.length > 0) {
            for (const c of nodeItem.channel) {
              const canBaseItem = this.canBaseMap.get(c)
              if (canBaseItem && tester.type == 'can') {
                const tp = new CAN_TP(canBaseItem)
                for (const addr of tester.address) {
                  if (addr.type == 'can' && addr.canAddr) {
                    const idT = tp.getReadId(addr.canAddr)
                    tp.event.on(idT, (data) => {
                      if (data instanceof CanTpError) {
                        //TODO:
                      } else {
                        if (data.addr.uuid != this.nodeItem.id) {
                          const item = findService(tester, data.data, true)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, true)
                              this.pool?.triggerSend(tester.name, item, data.ts).catch((e) => {
                                this.log?.scriptMsg(e.toString(), data.ts, 'error')
                              })
                            } catch (e: any) {
                              this.log?.scriptMsg(e.toString(), data.ts, 'error')
                            }
                          }
                        }
                      }
                    })
                    const idR = tp.getReadId(swapAddr(addr.canAddr))
                    tp.event.on(idR, (data) => {
                      if (data instanceof CanTpError) {
                        //TODO:
                      } else {
                        if (data.addr.uuid != this.nodeItem.id) {
                          const item = findService(tester, data.data, false)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, false)
                              this.pool?.triggerRecv(tester.name, item, data.ts).catch((e) => {
                                this.log?.scriptMsg(e.toString(), data.ts, 'error')
                              })
                            } catch (e: any) {
                              this.log?.scriptMsg(e.toString(), data.ts, 'error')
                            }
                          }
                        }
                      }
                    })
                  }
                }
                this.cantp.push(tp)
              }
              const linBaseItem = this.linBaseMap.get(c)
              if (linBaseItem && tester.type == 'lin') {
                const tp = new LIN_TP(linBaseItem)
                for (const addr of tester.address) {
                  if (addr.type == 'lin' && addr.linAddr) {
                    const idT = tp.getReadId(LinMode.MASTER, addr.linAddr)
                    tp.event.on(idT, (data) => {
                      if (data instanceof LinTpError) {
                        //TODO:
                      } else {
                        if (data.addr.uuid != this.nodeItem.id) {
                          const item = findService(tester, data.data, true)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, true)
                              this.pool?.triggerSend(tester.name, item, data.ts).catch((e) => {
                                this.log?.scriptMsg(e.toString(), data.ts, 'error')
                              })
                            } catch (e: any) {
                              this.log?.scriptMsg(e.toString(), data.ts, 'error')
                            }
                          }
                        }
                      }
                    })
                    const idR = tp.getReadId(LinMode.SLAVE, addr.linAddr)
                    tp.event.on(idR, (data) => {
                      if (data instanceof LinTpError) {
                        //TODO:
                      } else {
                        if (data.addr.uuid != this.nodeItem.id) {
                          const item = findService(tester, data.data, false)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, false)
                              this.pool?.triggerRecv(tester.name, item, data.ts).catch((e) => {
                                this.log?.scriptMsg(e.toString(), data.ts, 'error')
                              })
                            } catch (e: any) {
                              this.log?.scriptMsg(e.toString(), data.ts, 'error')
                            }
                          }
                        }
                      }
                    })
                  }
                }
                this.lintp.push(tp)
              }
              const ethBaseItem = this.ethBaseMap.get(c)
              if (ethBaseItem && tester.type == 'eth') {
                const baseItem = this.doips.find((d) => d.base.id == ethBaseItem.id)
                if (baseItem) {
                  for (const addr of tester.address) {
                    if (addr.type == 'eth' && addr.ethAddr) {
                      const idT = baseItem.getId(addr.ethAddr, 'client')

                      const cbT = (data: { data: Buffer; ts: number } | DoipError) => {
                        if (data instanceof DoipError) {
                          //TODO:
                        } else {
                          const item = findService(tester, data.data, true)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, true)
                              this.pool?.triggerSend(tester.name, item, data.ts).catch((e) => {
                                this.log?.scriptMsg(e.toString(), data.ts, 'error')
                              })
                            } catch (e: any) {
                              this.log?.scriptMsg(e.toString(), data.ts, 'error')
                            }
                          }
                        }
                      }
                      baseItem.event.on(idT, cbT)
                      this.freeEvent.push({ doip: baseItem, id: idT, cb: cbT })

                      const idR = baseItem.getId(addr.ethAddr, 'server')
                      const cbR = (data: { data: Buffer; ts: number } | DoipError) => {
                        if (data instanceof DoipError) {
                          //TODO:
                        } else {
                          const item = findService(tester, data.data, false)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, false)
                              this.pool?.triggerRecv(tester.name, item, data.ts).catch((e) => {
                                this.log?.scriptMsg(e.toString(), data.ts, 'error')
                              })
                            } catch (e: any) {
                              this.log?.scriptMsg(e.toString(), data.ts, 'error')
                            }
                          }
                        }
                      }
                      baseItem.event.on(idR, cbR)
                      this.freeEvent.push({ doip: baseItem, id: idR, cb: cbR })
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  private async _generateHtml(data: TestTree) {
    const statusIcons = {
      pass: '✅',
      fail: '❌',
      skip: '⏭️',
      todo: '📝',
      running: '🔄'
    }

    const statusColors = {
      pass: '#67C23A',
      fail: '#F56C6C',
      skip: '#909399',
      todo: '#E6A23C',
      running: '#409EFF'
    }

    function generateTestCaseHtml(node: TestTree): string {
      if (node.type === 'log') {
        // Calculate proper indentation for log entries
        // If the log has a parent, use parent's nesting + 1, otherwise use node's nesting or default to 0
        const nestingLevel = node.parent ? (node.parent.nesting || 0) + 1 : node.nesting || 0

        return `
          <div class="log-entry" style="margin-left: ${nestingLevel * 20}px">
            ${`<div class="log-message">${node.msg}</div>`}
          </div>
        `
      }

      const status = node.status || 'unknown'
      const icon = statusIcons[status as keyof typeof statusIcons] || '❓'
      const color = statusColors[status as keyof typeof statusColors] || '#909399'
      const time = node.time ? `(${node.time}s)` : ''

      let html = `
              <div class="test-case" style="margin-left: ${(node.nesting || 0) * 20}px">
                  <div class="test-header" style="color: ${color}">
                      <span class="icon">${icon}</span>
                      <span class="name">${node.label}</span>
                      <span class="time">${time}</span>
                  </div>
              </div>
          `

      if (node.children && node.children.length > 0) {
        html += `<div class="children">
                  ${node.children.map((child) => generateTestCaseHtml(child)).join('')}
              </div>`
      }

      return html
    }

    const timestamp = new Date().toLocaleString()
    const testConfig = this.nodeItem
    const scriptPath = testConfig?.script || 'No script specified'

    const html = `
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="UTF-8">
              <title>ECUBus-Pro - Test Report</title>
              <style>
                  body {
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                      max-width: 1200px;
                      margin: 0 auto;
                      padding: 20px;
                      background: #f5f7fa;
                  }
                  .container {
                      background: white;
                      border-radius: 8px;
                      box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
                      padding: 20px;
                  }
                  .report-header {
                      display: flex;
                      align-items: center;
                      gap: 20px;
                      margin-bottom: 20px;
                      padding-bottom: 20px;
                      border-bottom: 1px solid #ebeef5;
                  }
                  .logo-container {
                      display: flex;
                      align-items: center;
                  }
                  .logo {
                      width: 64px;
                      height: 64px;
                      margin-right: 16px;
                  }
                  .software-info {
                      flex: 1;
                      padding-top: 0;
                  }
                  .software-name {
                      font-size: 24px;
                      color: #303133;
                      margin: 0;
                  }
                  .report-title {
                      font-size: 18px;
                      color: #606266;
                      margin: 4px 0;
                  }
                  .script-info {
                      color: #606266;
                      font-size: 14px;
                      margin-top: 4px;
                  }
                  .timestamp {
                      color: #909399;
                      font-size: 14px;
                  }
                  .test-case {
                      margin: 8px 0;
                  }
                  .test-header {
                      display: flex;
                      align-items: center;
                      font-size: 14px;
                      padding: 8px;
                      border-radius: 4px;
                      background: #f8f9fb;
                  }
                  .log-entry {
                      margin: 6px 0;
                  }
                  .log-message {
                      padding: 8px 12px;
                      background: #f8f8f8;
                      border-left: 3px solid #409EFF;
                      border-radius: 4px;
                      color: #606266;
                      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                      
                      white-space: pre-wrap;
                      overflow-wrap: break-word;
                      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                  }
                  .log-label {
                      font-weight: 600;
                      color: #409EFF;
                  }
                  .log-label-only {
                      font-weight: 600;
                      color: #409EFF;
                  }
                  .icon {
                      margin-right: 8px;
                  }
                  .name {
                      flex: 1;
                  }
                  .time {
                      color: #909399;
                      font-size: 12px;
                      margin-left: 8px;
                  }
                  .children {
                      margin-left: 20px;
                  }
                  .footer {
                      margin-top: 40px;
                      padding-top: 20px;
                      border-top: 1px solid #ebeef5;
                      color: #909399;
                      font-size: 14px;
                      text-align: center;
                  }
                  
                  .footer a {
                      color: var(--el-color-primary);
                      text-decoration: none;
                  }
                  
                  .footer a:hover {
                      text-decoration: underline;
                  }
                  
                  .footer-links {
                      display: flex;
                      justify-content: center;
                      gap: 20px;
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="report-header">
                      <div class="logo-container">
                          <img src="data:image/png;base64,${logo}" class="logo" alt="ECUBus Pro Logo">
                          <div class="software-info">
                              <h1 class="software-name">ECUBus-Pro</h1>
                              <div class="report-title">Test Report - ${data.label}</div>
                              <div class="script-info">Script: ${scriptPath}</div>
                              <div class="timestamp">Generated at: ${timestamp}</div>
                          </div>
                      </div>
                  </div>
                  <div class="test-cases">
                      ${data.children?.map((child) => generateTestCaseHtml(child)).join('') || ''}
                  </div>
                  
                  <div class="footer">
                      <div class="footer-links">
                          <a href="https://app.whyengineer.com/" target="_blank">Project Homepage</a>
                          <a href="https://github.com/ecubus/EcuBus-Pro" target="_blank">GitHub Repository</a>
                      </div>
                  </div>
              </div>
          </body>
          </html>
      `
    return html
  }
  async generateHtml(reportPath?: string, returnHtml = false) {
    const root: TestTree = {
      label: this.nodeItem.name,
      type: 'config',
      children: []
    }

    function buildSubTree(infos: TestLog[]) {
      let currentSuite: TestTree | undefined
      const roots: TestTree[] = []
      const testMap = new Map<string, TestTree>()
      function startTest(event: any) {
        const originalSuite = currentSuite
        const testId = `${event.name}:${event.line || 0}:${event.column || 0}`

        currentSuite = {
          type: 'test',

          label: event.name,
          nesting: event.nesting,
          parent: currentSuite,
          children: []
        }
        testMap.set(testId, currentSuite)
        if (originalSuite?.children) {
          originalSuite.children.push(currentSuite)
        }
        if (!currentSuite.parent) {
          roots.push(currentSuite)
        }
      }
      for (const info of infos) {
        if (info.message.method == 'testInfo') {
          const event = info.message.data as TestEvent
          if ((event.data as any).name == '____ecubus_pro_test___') {
            continue
          }
          if (event.data)
            switch (event.type) {
              case 'test:dequeue': {
                startTest(event.data)
                break
              }
              case 'test:pass':
              case 'test:fail': {
                if (!currentSuite) {
                  startTest({ name: 'root', nesting: 0, line: 0, column: 0 })
                }
                if (
                  currentSuite!.label !== event.data.name ||
                  currentSuite!.nesting !== event.data.nesting
                ) {
                  startTest(event.data)
                }

                if (currentSuite?.nesting === event.data.nesting) {
                  currentSuite = currentSuite.parent
                }
                if (currentSuite) {
                  if (event.type == 'test:pass') {
                    if (event.data.skip) {
                      currentSuite.status = 'skip'
                    } else {
                      currentSuite.status = 'pass'
                    }
                  } else if (event.type == 'test:fail') {
                    currentSuite.status = 'fail'
                  }
                }
                // if (nonCommentChildren.length > 0) {

                // } else {

                // }
                break
              }
              case 'test:diagnostic': {
                if (currentSuite) {
                  currentSuite.children.push({
                    type: 'log',
                    label: 'Test Diagnostic',
                    msg: event.data.message,
                    nesting: event.data.nesting + 2,

                    children: []
                  })
                }
              }
            }
        } else {
          const val: TestTree = {
            label: info.label,
            type: 'log',

            children: [],
            parent: currentSuite,
            msg: info.message.data.msg
          }
          if (currentSuite) {
            val.nesting = (currentSuite.nesting || 0) + 1
            currentSuite.children.push(val)
          } else {
            root.children.push(val)
          }
        }
      }
      return {
        roots,
        testMap
      }
    }
    const { roots, testMap } = buildSubTree(this.logs)
    //update status
    for (const log of this.logs) {
      if (log.message.method == 'testInfo') {
        const event = log.message.data as TestEvent

        if (event.type == 'test:pass' || event.type == 'test:fail') {
          const testId = `${event.data.name}:${event.data.line || 0}:${event.data.column || 0}`
          const test = testMap.get(testId)
          if (test) {
            if (event.type == 'test:pass') {
              test.status = 'pass'
            } else if (event.type == 'test:fail') {
              test.status = 'fail'
            }
            test.time = Number(event.data.details.duration_ms / 1000).toFixed(3)
          }
        }
      }
    }
    root.children = roots
    const html = await this._generateHtml(root)
    if (returnHtml) {
      return html
    }
    let fpath = path.join(this.projectPath, `${this.nodeItem.name}.html`)
    if (reportPath) {
      fpath = path.join(reportPath, `${this.nodeItem.name}.html`)
      if (path.isAbsolute(fpath)) {
        const dir = path.dirname(fpath)
        if (fs.existsSync(dir)) {
          await fsP.writeFile(fpath, html)
          return fpath
        } else {
          throw new Error(`report directory ${dir} not found`)
        }
      } else {
        fpath = path.join(this.projectPath, fpath)
        const dir = path.dirname(fpath)
        if (!fs.existsSync(dir)) {
          await fsP.mkdir(dir, { recursive: true })
        }
        await fsP.writeFile(fpath, html)
        return fpath
      }
    } else {
      await fsP.writeFile(fpath, html)
      return fpath
    }
  }
  async getTestInfo() {
    const info = await this.pool?.getTestInfo()
    if (this.testOptions) {
      this.log?.systemMsg(
        `Test Config ${this.nodeItem.name} finished, total time: ${((getTsUs() - this.startTs) / 1000).toFixed(2)}ms`,
        getTsUs(),
        'info'
      )
    }
    return info
  }
  setVar(
    pool: UdsTester,
    data: {
      name: string
      value: number | string | number[]
    }
  ) {
    this.varLog.setVar(data.name, data.value)
  }
  setSignal(
    pool: UdsTester,
    data: {
      signal: string
      value: number | string | number[]
    }
  ) {
    if (Array.isArray(data.value)) {
      throw new Error('can not set array value')
    }
    const s = data.signal.split('.')
    // 验证数据库是否存在
    const db = Object.values(global.database.can).find((db) => db.name == s[0])
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
      ss.physValue = data.value
      if (typeof data.value === 'string' && (ss.values || ss.valueTable)) {
        const value: {
          label: string
          value: number
        }[] = ss.values ? ss.values : db.valueTables[ss.valueTable!].values
        if (value) {
          const v = value.find((v) => v.label === data.value)
          if (v) {
            ss.physValue = v.value
          }
        }
      }
      updateSignalPhys(ss)
    } else {
      const linDb = Object.values(global.database.lin).find((db) => db.name == s[0])
      if (linDb) {
        const signalName = s[1]

        const signal = linDb.signals[signalName]
        if (!signal) {
          throw new Error(`Signal ${signalName} not found`)
        }
        // 更新信号值
        updateSignalVal(linDb, signalName, data.value)
      }
    }
  }
  async registerEthVirtualEntity(
    pool: UdsTester,
    data: {
      ip?: string
      entity: VinInfo
    }
  ) {
    let target = this.nodeItem.channel[0]
    if (data.ip) {
      target = data.ip
    }
    const baseItem = this.doips.find((d) => d.base.device.handle == target)
    if (baseItem) {
      await baseItem.registerEntity(data.entity, true, this.log)
    }
  }
  async sendFrame(pool: UdsTester, frame: CanMessage | LinMsg): Promise<number> {
    if ('msgType' in frame) {
      frame.msgType.uuid = this.nodeItem.id
      if (this.canBaseId.length == 1) {
        const baseItem = this.canBaseMap.get(this.canBaseId[0])
        if (baseItem) {
          return await baseItem.writeBase(frame.id, frame.msgType, frame.data, {
            database: baseItem.info.database
          })
        }
      }
      for (const c of this.canBaseId) {
        const baseItem = this.canBaseMap.get(c)
        if (baseItem && baseItem.info.name == frame.device) {
          return await baseItem.writeBase(frame.id, frame.msgType, frame.data, {
            database: baseItem.info.database
          })
        }
      }
      throw new Error(`device ${frame.device} not found`)
    } else {
      frame.uuid = this.nodeItem.id
      frame.data = Buffer.from(frame.data)
      if (this.linBaseId.length == 1) {
        const baseItem = this.linBaseMap.get(this.linBaseId[0])
        if (baseItem) {
          baseItem.setEntry(
            frame.frameId,
            frame.data.length,
            frame.direction,
            frame.checksumType,
            frame.data,
            frame.isEvent ? 2 : 1
          )
          frame.database = baseItem.info.database
          return await baseItem.write(frame)
        }
      }
      for (const c of this.linBaseId) {
        const baseItem = this.linBaseMap.get(c)
        if (baseItem && baseItem.info.name == frame.device) {
          frame.database = baseItem.info.database
          return await baseItem.write(frame)
        }
      }
      throw new Error(`device ${frame.device} not found`)
    }
  }
  async sendDiag(
    pool: UdsTester,
    data: {
      device?: string
      address?: string
      service: ServiceItem
      isReq: boolean
      testerName: string
    }
  ): Promise<number> {
    const tester = Object.values(this.testers).find((t) => t.name == data.testerName)
    if (!tester) {
      throw new Error(`tester ${data.testerName} not found`)
    }
    if (tester) {
      if (tester.address.length == 0) {
        throw new Error(`address not found in ${tester.name}`)
      }
      let buf

      if (data.isReq) {
        buf = getTxPdu(data.service)
      } else {
        buf = getRxPdu(data.service)
      }

      if (tester.type == 'can') {
        if (this.canBaseId.length == 0) {
          throw new Error(`channel not found`)
        } else if (this.canBaseId.length == 1 || data.device == undefined) {
          if (
            (tester.address.length == 1 || data.address == undefined) &&
            tester.address[0].canAddr
          ) {
            const raddr = data.isReq
              ? tester.address[0].canAddr
              : swapAddr(tester.address[0].canAddr)
            raddr.uuid = this.nodeItem.id
            const ts = await this.cantp[0].writeTp(raddr, buf)

            return ts
          } else {
            //find address
            const addr = tester.address.find((a) => a.canAddr?.name == data.address)
            if (addr && addr.canAddr) {
              const raddr = data.isReq ? addr.canAddr : swapAddr(addr.canAddr)
              raddr.uuid = this.nodeItem.id
              const ts = await this.cantp[0].writeTp(raddr, buf)

              return ts
            }
          }
        } else {
          //find device
          let index = -1
          for (let i = 0; i < this.nodeItem.channel.length; i++) {
            if (this.canBaseMap.get(this.nodeItem.channel[i])?.info.name == data.device) {
              index = i
              break
            }
          }
          if (index >= 0) {
            if (
              (tester.address.length == 1 || data.address == undefined) &&
              tester.address[0].canAddr
            ) {
              const raddr = data.isReq
                ? tester.address[0].canAddr
                : swapAddr(tester.address[0].canAddr)
              raddr.uuid = this.nodeItem.id

              const ts = await this.cantp[index].writeTp(raddr, buf)

              return ts
            } else {
              //find address
              const addr = tester.address.find((a) => a.canAddr?.name == data.address)
              if (addr && addr.canAddr) {
                const raddr = data.isReq ? addr.canAddr : swapAddr(addr.canAddr)
                raddr.uuid = this.nodeItem.id
                const ts = await this.cantp[index].writeTp(raddr, buf)
                // if (data.isReq) {
                //   await this.pool?.triggerSend(data.service, ts)
                // } else {
                //   await this.pool?.triggerRecv(data.service, ts)
                // }
                return ts
              }
            }
          }
        }
      } else if (tester.type == 'lin') {
        if (this.linBaseId.length == 0) {
          throw new Error(`channel not found`)
        } else if (this.linBaseId.length == 1 || data.device == undefined) {
          if (
            (tester.address.length == 1 || data.address == undefined) &&
            tester.address[0].linAddr
          ) {
            const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
            const raddr = tester.address[0].linAddr

            const ts = await this.lintp[0].writeTp(mode, raddr, buf, this.nodeItem.id)

            return ts
          } else {
            //find address
            const addr = tester.address.find((a) => a.linAddr?.name == data.address)
            if (addr && addr.linAddr) {
              const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
              const raddr = addr.linAddr

              const ts = await this.lintp[0].writeTp(mode, raddr, buf, this.nodeItem.id)

              return ts
            }
          }
        } else {
          //find device
          let index = -1
          for (let i = 0; i < this.nodeItem.channel.length; i++) {
            if (this.linBaseMap.get(this.nodeItem.channel[i])?.info.name == data.device) {
              index = i
              break
            }
          }
          if (index >= 0) {
            if (
              (tester.address.length == 1 || data.address == undefined) &&
              tester.address[0].linAddr
            ) {
              const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
              const raddr = tester.address[0].linAddr

              const ts = await this.lintp[index].writeTp(mode, raddr, buf, this.nodeItem.id)

              return ts
            } else {
              //find address
              const addr = tester.address.find((a) => a.linAddr?.name == data.address)
              if (addr && addr.linAddr) {
                const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
                const raddr = addr.linAddr

                const ts = await this.lintp[index].writeTp(mode, raddr, buf, this.nodeItem.id)

                return ts
              }
            }
          }
        }
      } else if (tester.type == 'eth') {
        if (tester.address.length == 0) {
          throw new Error(`address not found in ${tester.name}`)
        }
        const send = async (inst: DOIP, aa: EthAddr) => {
          if (data.isReq) {
            const buf = getTxPdu(data.service)
            const clientTcp = await inst.createClient(aa)
            const v = await inst.writeTpReq(clientTcp, buf)
            return v.ts
          } else {
            const buf = getRxPdu(data.service)
            const v = await inst.writeTpResp(aa.tester, buf)
            return v.ts
          }
        }
        if (this.ethBaseId.length == 0) {
          throw new Error(`channel not found`)
        } else if (this.ethBaseId.length == 1 || data.device == undefined) {
          const doipInst = this.doips.find((d) => d.base.id == this.ethBaseId[0])
          if (doipInst) {
            if (
              (tester.address.length == 1 || data.address == undefined) &&
              tester.address[0].ethAddr
            ) {
              const addr = tester.address[0].ethAddr
              return await send(doipInst, addr)
            } else {
              //find address
              const addr = tester.address.find((a) => a.ethAddr?.name == data.address)
              if (addr && addr.ethAddr) {
                return await send(doipInst, addr.ethAddr)
              }
            }
          } else {
            throw new Error(`Does't found attached tester`)
          }
        } else {
          //find device
          let index = -1
          for (let i = 0; i < this.ethBaseId.length; i++) {
            if (this.ethBaseMap.get(this.ethBaseId[i])?.name == data.device) {
              index = i
              break
            }
          }
          if (index >= 0) {
            const doipInst = this.doips.find((d) => d.base.id == this.ethBaseId[index])
            if (doipInst) {
              if (
                (tester.address.length == 1 || data.address == undefined) &&
                tester.address[0].ethAddr
              ) {
                return await send(doipInst, tester.address[0].ethAddr)
              } else {
                //find address
                const addr = tester.address.find((a) => a.ethAddr?.name == data.address)
                if (addr && addr.ethAddr) {
                  return await send(doipInst, addr.ethAddr)
                }
              }
            } else {
              throw new Error(`Does't found attached tester`)
            }
          }
        }
      }
    } else {
      throw new Error(`Does't found attached tester`)
    }
    return 0
  }
  close() {
    for (const c of this.nodeItem.channel) {
      const baseItem = this.canBaseMap.get(c)
      if (baseItem) {
        baseItem.detachCanMessage(this.boundCb)
      }
      const linBaseItem = this.linBaseMap.get(c)
      if (linBaseItem) {
        linBaseItem.detachLinMessage(this.boundCb)
      }
    }
    for (const e of this.freeEvent) {
      e.doip.event.removeListener(e.id, e.cb)
    }

    this.cantp.forEach((tp) => {
      tp.close(false)
    })
    this.lintp.forEach((tp) => {
      tp.close(false)
    })
    this.pool?.stop()
    this.log?.close()
    this.varLog?.close()
  }
  async start() {
    this.pool?.updateTs(0)
    await this.pool?.start(this.projectPath)
  }
  cb(frame: CanMessage | LinMsg) {
    if ('msgType' in frame) {
      if (frame.msgType.uuid != this.nodeItem.id) {
        this.pool?.triggerCanFrame(frame)
      }
    } else {
      if (frame.uuid != this.nodeItem.id) {
        this.pool?.triggerLinFrame(frame)
      }
    }
  }
}
