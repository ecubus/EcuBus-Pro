import { readFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import vm from 'node:vm'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'
import { waitForStart } from '../../src/main/startCancellation'

function functions(file: string, names: string[]) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  return source.statements
    .filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ''))
    .map((node) => node.getText(source))
    .join('\n')
}
const code = ts.transpileModule(
  functions('src/main/ipc/uds.ts', ['globalStart', 'globalStop']) +
    '\n' +
    functions('src/main/ipc/plugin.ts', ['startPlugins', 'stopPlugins']) +
    '\nexports.globalStart = globalStart',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

it.each([
  'serial',
  'config',
  'router',
  'node',
  'plugin',
  'serial-failure',
  'node-failure',
  'plugin-failure'
])('cleans up and does not continue after stop during %s', async (phase) => {
  let release!: () => void
  let enter!: () => void
  const entered = new Promise<void>((resolve) => {
    enter = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const pending = async () => {
    enter()
    await gate
    if (phase.endsWith('failure')) throw new Error('start failed')
  }
  const serialClose = vi.fn(),
    nodeClose = vi.fn(),
    pluginStop = vi.fn(),
    nextPluginStart = vi.fn()
  const controller = new AbortController()
  const context: any = {
    exports: {},
    waitForStart,
    global: { deviceIndexMap: new Map() },
    startController: controller,
    trackEvent: vi.fn(),
    getDeviceSymbol: () => '',
    VarLOG: class {
      setVarByKeyBatch() {}
    },
    SerialBase: class {
      event = new EventEmitter()
      open = pending
      close = serialClose
    },
    NodeClass: class {
      init() {}
      start = pending
      close = nodeClose
    },
    generateConfigFile: phase === 'config' ? pending : async () => 'config',
    startRouterCounter: vi.fn(pending),
    stopRouterCounter: vi.fn(),
    VSomeIP_Client: class {
      init() {}
      attachSomeipMessage() {}
    },
    openCanDevice: vi.fn(),
    sysLog: { info: vi.fn(), error: vi.fn() },
    formatError: String,
    getTsUs: () => 0,
    startTs: 0,
    setProjectSimulateCount: vi.fn(async () => {}),
    monitorEventLoopDelay: vi.fn(() => ({ enable: vi.fn() })),
    setInterval: vi.fn(),
    clearTimeout: vi.fn(),
    timer: undefined,
    monitor: undefined,
    cantps: [],
    doips: [],
    exTransportList: [],
    plugins: phase.startsWith('plugin')
      ? {
          first: {
            name: 'first',
            stop: pluginStop,
            nodeItem: { nodeItem: {}, init: vi.fn(), start: pending }
          },
          next: {
            name: 'next',
            stop: vi.fn(),
            nodeItem: { nodeItem: {}, init: vi.fn(), start: nextPluginStart }
          }
        }
      : {}
  }
  context.global.sysLog = context.sysLog
  for (const key of [
    'canBaseMap',
    'linBaseMap',
    'ethBaseMap',
    'pwmBaseMap',
    'serialBaseMap',
    'someipMap',
    'udsTesterMap',
    'nodeMap',
    'ortiMap',
    'replayMap',
    'testMap',
    'timerMap',
    'someipPeriodMap',
    'schMap'
  ])
    context[key] = new Map()
  vm.runInNewContext(code, context)
  const devices: any = {}
  if (phase.startsWith('serial'))
    devices.first = {
      type: 'serial',
      serialDevice: { id: 's', name: 'serial', device: { handle: 'test' } }
    }
  if (phase === 'config' || phase === 'router')
    devices.first = { type: 'someip', someipDevice: { name: 'someip' } }
  if (Object.keys(devices).length) devices.next = { type: 'can', canDevice: { id: 'c' } }
  const data = {
    devices,
    nodes: phase.startsWith('node') ? { first: {} } : {},
    tester: {},
    replays: {},
    vars: {},
    graphs: {},
    guages: {},
    datas: {},
    panels: {},
    logs: {},
    database: { can: {}, lin: {}, orti: {} }
  }
  const starting = context.exports.globalStart(
    data,
    { path: 'test', name: 'test.ecb' },
    controller.signal
  )
  await entered
  await context.exports.globalStop()
  await expect(starting).rejects.toThrow()
  if (phase.startsWith('node')) expect(nodeClose).toHaveBeenCalledOnce()
  if (phase.startsWith('serial')) expect(serialClose).toHaveBeenCalledOnce()
  // The cancelled start must settle even while the original operation remains pending.
  release()
  await new Promise((resolve) => setImmediate(resolve))
  expect(context.openCanDevice).not.toHaveBeenCalled()
  expect(context.setProjectSimulateCount.mock.calls).toEqual([[0]])
  expect(context.monitorEventLoopDelay).not.toHaveBeenCalled()
  expect(context.setInterval).not.toHaveBeenCalled()
  expect(context.serialBaseMap.size).toBe(0)
  expect(context.nodeMap.size).toBe(0)
  if (phase.startsWith('serial'))
    expect(serialClose).toHaveBeenCalledTimes(phase === 'serial' ? 2 : 1)
  if (phase.startsWith('node')) expect(nodeClose).toHaveBeenCalledOnce()
  if (phase.startsWith('plugin')) {
    expect(pluginStop).toHaveBeenCalledTimes(2)
    expect(nextPluginStart).not.toHaveBeenCalled()
  }
  if (phase === 'config') expect(context.startRouterCounter).not.toHaveBeenCalled()
  if (phase === 'router') expect(context.stopRouterCounter).toHaveBeenCalledTimes(2)
})
