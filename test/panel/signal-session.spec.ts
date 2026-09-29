import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

function context() {
  const file = 'src/renderer/src/main.ts'
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const statements = source.statements.filter(
    (node) =>
      (ts.isFunctionDeclaration(node) && node.name?.text === 'receiveLogBatch') ||
      node.getText(source).startsWith('signalChannel.onmessage =')
  )
  const result: any = {
    runtimeStore: { globalStart: true, signalSession: 'new' },
    window: { params: { id: 'popup' }, logBus: { emit: vi.fn() } },
    recordSignalValues: vi.fn(),
    restoreSignalSnapshot: vi.fn(),
    signalValueSnapshot: () => ({ speed: { value: 20, rawValue: 200 } }),
    signalChannel: { postMessage: vi.fn() }
  }
  vm.runInNewContext(
    ts.transpileModule(statements.map((node) => node.getText(source)).join('\n'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 }
    }).outputText,
    result
  )
  return result
}

it('filters the signal cache without filtering display events', () => {
  const state = context()
  state.receiveLogBatch({
    __signalSession: 'old',
    'can.Vehicle.Status.signals.Speed': [[1, { value: 100 }]]
  })
  expect(state.recordSignalValues).not.toHaveBeenCalled()
  expect(state.window.logBus.emit).toHaveBeenCalledOnce()
  state.receiveLogBatch({
    __signalSession: 'new',
    'can.Vehicle.Status.signals.Speed': [[1, { value: 20 }]]
  })
  expect(state.recordSignalValues).toHaveBeenCalledOnce()
  expect(state.window.logBus.emit).toHaveBeenCalledTimes(2)
})

it('delivers the last signal batch after stop without repopulating the cache', () => {
  const state = context()
  state.runtimeStore.globalStart = false
  const samples = [[1, { value: 20, rawValue: 200 }]]
  state.receiveLogBatch({ __signalSession: 'new', 'can.Vehicle.Status.signals.Speed': samples })
  expect(state.recordSignalValues).not.toHaveBeenCalled()
  expect(state.window.logBus.emit).toHaveBeenCalledWith('can.Vehicle.Status.signals.Speed', {
    key: 'can.Vehicle.Status.signals.Speed',
    values: samples
  })
})

it('rejects stale and stopped snapshots and accepts a current-session snapshot', () => {
  const state = context()
  const deliver = (session: string) =>
    state.signalChannel.onmessage({ data: { type: 'snapshot', session, values: {} } })
  deliver('old')
  expect(state.restoreSignalSnapshot).not.toHaveBeenCalled()
  deliver('new')
  expect(state.restoreSignalSnapshot).toHaveBeenCalledOnce()
  state.runtimeStore.globalStart = false
  deliver('new')
  expect(state.restoreSignalSnapshot).toHaveBeenCalledOnce()
})

it('only the main window answers snapshot requests for its active session', () => {
  const state = context()
  state.window.params = {}
  state.signalChannel.onmessage({ data: { type: 'request', session: 'old' } })
  expect(state.signalChannel.postMessage).not.toHaveBeenCalled()
  state.signalChannel.onmessage({ data: { type: 'request', session: 'new' } })
  expect(state.signalChannel.postMessage).toHaveBeenCalledWith({
    type: 'snapshot',
    session: 'new',
    values: { speed: { value: 20, rawValue: 200 } }
  })
})

it('discards queued CAN and LIN frames from an earlier measurement before decoding', () => {
  const file = 'src/renderer/src/worker/dataParse.ts'
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const handler = source.statements.find((node) =>
    node.getText(source).startsWith('if (isWorker)')
  )!
  const worker: any = {
    isWorker: true,
    self: {},
    port: undefined,
    activeSignalSession: undefined,
    initDataBase: vi.fn(),
    database: { orti: {} },
    osStatistics: new Map(),
    dataHandle: vi.fn()
  }
  vm.runInNewContext(
    ts.transpileModule(handler.getText(source), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 }
    }).outputText,
    worker
  )
  worker.self.onmessage({ data: { method: 'initDataBase', signalSession: 'new', data: {} } })
  worker.self.onmessage({ data: { method: 'initDataBase', data: {} } })
  expect(worker.activeSignalSession).toBe('new')
  const port: any = {}
  worker.self.onmessage({ data: { method: 'onmessage', data: port } })
  port.onmessage({
    data: [
      { signalSession: 'old', message: { method: 'canBase' } },
      { signalSession: 'old', message: { method: 'linBase' } },
      { signalSession: 'new', message: { method: 'canBase' } }
    ]
  })
  expect(worker.dataHandle).toHaveBeenCalledOnce()
  expect(worker.dataHandle).toHaveBeenCalledWith(
    'canBase',
    [{ signalSession: 'new', message: { method: 'canBase' } }],
    'new'
  )
})
