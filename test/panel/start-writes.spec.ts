import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const handlers = vi.hoisted(() => new Map<string, (...args: any[]) => unknown>())
const writes = vi.hoisted(() => ({ setVar: vi.fn(), setSignal: vi.fn() }))
vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, listener: (...args: any[]) => unknown) => handlers.set(channel, listener),
    handle: (channel: string, listener: (...args: any[]) => unknown) =>
      handlers.set(channel, listener)
  }
}))
vi.mock('../../src/main/log', () => ({
  VarLOG: class {
    setVar() {}
  }
}))
vi.mock('../../src/main/share/can', () => ({ getTsUs: () => 0 }))
vi.mock('../../src/main/util', () => ({ setSignal: writes.setSignal }))
vi.mock('../../src/main/var', () => ({
  setVar: (...args: unknown[]) => {
    writes.setVar(...args)
    return { found: false }
  }
}))
await import('../../src/main/ipc/var')
const { useMeasurementStarted, useRuntimeStore } = await import(
  '../../src/renderer/src/stores/runtime'
)

beforeEach(() => {
  writes.setVar.mockClear()
  writes.setSignal.mockClear()
  delete (global as any).vars
  delete (global as any).dataSet
})

it('ignores panel writes before a measurement has created the variable table', () => {
  expect(() => handlers.get('ipc-var-set')!({}, { name: 'Level', value: 1 })).not.toThrow()
  expect(() => handlers.get('ipc-signal-set')!({}, { name: 'Db.Signal', value: 1 })).not.toThrow()
  expect(writes.setVar).not.toHaveBeenCalled()
  expect(writes.setSignal).not.toHaveBeenCalled()
  ;(global as any).vars = {}
  ;(global as any).dataSet = { vars: {} }
  handlers.get('ipc-var-set')!({}, { name: 'Level', value: 1 })
  handlers.get('ipc-signal-set')!({}, { name: 'Db.Signal', value: 1 })
  expect(writes.setVar).toHaveBeenCalledWith('Level', 1)
  expect(writes.setSignal).toHaveBeenCalledWith({ signal: 'Db.Signal', value: 1 })
})

it('treats a measurement as started only after main confirms the current session', () => {
  setActivePinia(createPinia())
  const runtime = useRuntimeStore()
  const started = useMeasurementStarted()
  runtime.globalStart = true
  runtime.signalSession = 'first'
  expect(started.value).toBe(false)
  runtime.startedSession = 'first'
  expect(started.value).toBe(true)
  runtime.signalSession = 'second'
  expect(started.value).toBe(false)
  runtime.startedSession = 'second'
  runtime.globalStart = false
  expect(started.value).toBe(false)
})
