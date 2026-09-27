import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { VarItem } from '../../src/preload/data'
import { createHash } from 'node:crypto'
import path from 'node:path'

const saved = vi.hoisted(() => new Map<string, unknown>())
const counts = vi.hoisted(() => ({ reads: 0, writes: 0, failWrites: false, readError: '' }))
const files = vi.hoisted(() => new Map<string, string>())
vi.mock('node:fs', () => ({
  readFileSync: (filename: string) => {
    if (counts.readError) throw Object.assign(new Error('read failed'), { code: counts.readError })
    if (!files.has(filename)) throw Object.assign(new Error('not found'), { code: 'ENOENT' })
    return files.get(filename)
  }
}))
vi.mock('node:fs/promises', () => ({
  mkdir: async () => {},
  writeFile: async (filename: string, value: string) => {
    counts.writes++
    if (counts.failWrites) throw new Error('disk full')
    files.set(filename, value)
  },
  rename: async (from: string, to: string) => {
    files.set(to, files.get(from)!)
    files.delete(from)
  }
}))
vi.mock('../../src/main/store', () => ({
  store: {
    path: 'test-config/config.json',
    get: (key: string) => {
      counts.reads++
      const value = saved.get(key)
      return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
    },
    delete: (key: string) => saved.delete(key)
  }
}))
import {
  rememberVariable,
  rememberedValues,
  restoreVariables,
  flushRememberedVariables,
  stopRememberedVariables,
  panelVariableValues
} from '../../src/main/var/persistence'
import { setVar as assignVar, setVarByKey as assignByKey } from '../../src/main/var'
function setVar(name: string, value: number | string | number[]) {
  const result = assignVar(name, value)
  if (result.found && result.target) rememberVariable(result.target)
}
function setVarByKey(id: string, value: number | string | number[]) {
  const result = assignByKey(id, value)
  if (result?.found && result.target) rememberVariable(result.target)
}

const project = { path: 'test-project', name: 'one.ecb' }
const variable = (id = 'input'): VarItem => ({
  id,
  name: id,
  type: 'user',
  value: { type: 'string', initValue: 'default' }
})
let projectNumber = 0
afterEach(async () => {
  counts.failWrites = false
  await flushRememberedVariables()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
beforeEach(() => {
  vi.useFakeTimers()
  project.name = `project-${++projectNumber}.ecb`
  counts.readError = ''
  counts.reads = counts.writes = 0
  saved.clear()
  files.clear()
  global.vars = {}
})

it('restores a user input after runtime state is discarded without changing its initial value', async () => {
  global.vars = { input: variable() }
  restoreVariables(project, global.vars)
  setVar('input', 'C:/firmware.hex')
  global.vars = { input: variable() }
  restoreVariables(project, global.vars)
  expect(global.vars.input.value).toEqual({
    type: 'string',
    initValue: 'default',
    value: 'C:/firmware.hex'
  })
})
it('isolates projects and restores empty strings and zero', async () => {
  global.vars = {
    input: variable(),
    number: { ...variable('number'), value: { type: 'number', initValue: 10 } }
  }
  restoreVariables(project, global.vars)
  setVar('input', '')
  setVarByKey('number', 0)
  expect(rememberedValues(project, global.vars)).toEqual({ input: '', number: 0 })
  expect(rememberedValues({ ...project, name: 'two.ecb' }, global.vars)).toEqual({})
})
it('never saves system variables or explicitly disabled variables', async () => {
  global.vars = {
    input: { ...variable(), rememberValue: false },
    system: { ...variable('system'), type: 'system' }
  }
  restoreVariables(project, global.vars)
  setVar('input', 'ignored')
  setVarByKey('system', 'ignored')
  expect(saved.size).toBe(0)
})
it('rejects stale types and clears values when retention is disabled', async () => {
  global.vars = { input: variable() }
  restoreVariables(project, global.vars)
  setVar('input', 'text')
  const changed = { input: { ...variable(), value: { type: 'number' as const, initValue: 5 } } }
  expect(rememberedValues(project, changed)).toEqual({})
  global.vars.input.rememberValue = false
  restoreVariables(project, global.vars)
  await flushRememberedVariables()
  expect(rememberedValues(project, global.vars)).toEqual({})
  expect([...files.values()].map((value) => JSON.parse(value).values)).toEqual([{}])
})
it('copies arrays and ignores nonfinite numeric values', async () => {
  global.vars = {
    input: { ...variable(), value: { type: 'array', initValue: [] } },
    number: { ...variable('number'), value: { type: 'number' } }
  }
  restoreVariables(project, global.vars)
  const bytes = [1, 2]
  setVarByKey('input', bytes)
  bytes[0] = 9
  setVarByKey('number', Infinity)
  expect(rememberedValues(project, global.vars)).toEqual({ input: [1, 2] })
})

it('also honors explicit enablement', async () => {
  global.vars = { input: { ...variable(), rememberValue: true } }
  restoreVariables(project, global.vars)
  setVar('input', 'saved')
  expect(rememberedValues(project, global.vars)).toEqual({ input: 'saved' })
})

it('loads values written under the original project and variable hashes', async () => {
  let filename = path.resolve(project.path, project.name)
  if (process.platform === 'win32') filename = filename.toLowerCase()
  const projectHash = createHash('sha256').update(filename).digest('hex')
  const idHash = createHash('sha256').update('input').digest('hex')
  saved.set(`rememberedVariables.${projectHash}`, { [idHash]: 'previous version' })
  expect(rememberedValues(project, { input: variable() })).toEqual({ input: 'previous version' })
  expect(saved.size).toBe(1)
  await flushRememberedVariables()
  expect(saved.size).toBe(0)
  expect([...files.values()].map((value) => JSON.parse(value).values)).toEqual([
    { [idHash]: 'previous version' }
  ])
})

it('batches continuous updates and reads all variables from one cached snapshot', async () => {
  global.vars = Object.fromEntries(
    Array.from({ length: 100 }, (_, i) => [String(i), variable(String(i))])
  )
  restoreVariables(project, global.vars)
  expect(counts.reads).toBe(1)
  for (let i = 0; i < 100; i++) setVarByKey(String(i), String(i))
  expect(counts.writes).toBe(0)
  expect(Object.keys(rememberedValues(project, global.vars))).toHaveLength(100)
  expect(counts.reads).toBe(1)
  await vi.advanceTimersByTimeAsync(500)
  expect(counts.writes).toBe(1)
  setVarByKey('0', '0')
  await vi.advanceTimersByTimeAsync(500)
  expect(counts.writes).toBe(1)
})

it('flushes pending values when switching projects and on explicit shutdown flush', async () => {
  global.vars = { input: variable() }
  restoreVariables(project, global.vars)
  setVar('input', 'first')
  restoreVariables({ ...project, name: `other-${project.name}` }, global.vars)
  await flushRememberedVariables()
  expect(counts.writes).toBe(1)
  setVar('input', 'second')
  await flushRememberedVariables()
  expect(counts.writes).toBe(2)
  expect(rememberedValues(project, global.vars)).toEqual({ input: 'first' })
  expect(rememberedValues({ ...project, name: `other-${project.name}` }, global.vars)).toEqual({
    input: 'second'
  })
})

it('returns current values in one batch and does not leak them into another project', async () => {
  global.vars = { input: variable(), disabled: { ...variable('disabled'), rememberValue: false } }
  restoreVariables(project, global.vars)
  setVar('input', 'remembered')
  global.vars.input.value!.value = 'current'
  setVar('disabled', 'runtime only')
  expect(panelVariableValues(project, global.vars, true)).toEqual({
    input: 'current',
    disabled: 'runtime only'
  })
  expect(panelVariableValues(project, global.vars, false)).toEqual({ input: 'remembered' })
  expect(panelVariableValues({ ...project, name: 'different.ecb' }, global.vars, true)).toEqual({})
})

it('does not flush or reload caches when reads alternate between project paths', async () => {
  global.vars = { input: variable() }
  restoreVariables(project, global.vars)
  const renamed = { ...project, name: `saved-${project.name}` }
  for (let i = 0; i < 20; i++) {
    setVar('input', String(i))
    expect(rememberedValues(renamed, global.vars)).toEqual({})
    expect(rememberedValues(project, global.vars)).toEqual({ input: String(i) })
  }
  expect(counts.reads).toBe(2)
  expect(counts.writes).toBe(0)
  await vi.advanceTimersByTimeAsync(500)
  expect(counts.writes).toBe(1)
})

it('keeps dirty values after a failed shutdown flush and retries without blocking other projects', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  global.vars = { input: variable() }
  restoreVariables(project, global.vars)
  setVar('input', 'pending')
  counts.failWrites = true
  await expect(flushRememberedVariables()).resolves.toBeUndefined()
  expect(error).toHaveBeenCalled()
  const other = { ...project, name: `retry-${project.name}` }
  expect(() => restoreVariables(other, global.vars)).not.toThrow()
  setVar('input', 'other')
  expect(rememberedValues(project, global.vars)).toEqual({ input: 'pending' })
  counts.failWrites = false
  await flushRememberedVariables()
  const persisted = [...files.values()].map((value) => JSON.parse(value).values) as Record<
    string,
    string
  >[]
  expect(persisted.flatMap(Object.values).sort()).toEqual(['other', 'pending'])
  const writes = counts.writes
  await flushRememberedVariables()
  expect(counts.writes).toBe(writes)
})

it('does not load or persist unsaved projects', async () => {
  global.vars = { input: variable() }
  restoreVariables({ path: '', name: 'Untitled' }, global.vars)
  setVar('input', 'temporary')
  expect(rememberedValues({ path: '', name: 'Untitled' }, global.vars)).toEqual({})
  await flushRememberedVariables()
  expect(counts.reads).toBe(0)
  expect(files.size).toBe(0)
})

it('prunes deleted variables only with a full project restore, not a partial query', async () => {
  global.vars = { input: variable(), removed: variable('removed') }
  restoreVariables(project, global.vars)
  setVar('input', 'kept')
  setVar('removed', 'obsolete')
  rememberedValues(project, { input: global.vars.input })
  expect(rememberedValues(project, global.vars).removed).toBe('obsolete')
  delete global.vars.removed
  restoreVariables(project, global.vars)
  await flushRememberedVariables()
  expect([...files.values()].flatMap((value) => Object.values(JSON.parse(value).values))).toEqual([
    'kept'
  ])
})

it('keeps worker variable setters independent of storage', async () => {
  global.vars = { input: variable() }
  restoreVariables(project, global.vars)
  assignVar('input', 'worker local')
  await flushRememberedVariables()
  expect(files.size).toBe(0)
  expect(rememberedValues(project, global.vars)).toEqual({})
})

it('flushes an update arriving while the previous write is pending', async () => {
  global.vars = { input: variable() }
  restoreVariables(project, global.vars)
  setVar('input', 'first')
  const pending = flushRememberedVariables()
  await Promise.resolve()
  setVar('input', 'last')
  await pending
  expect([...files.values()].flatMap((value) => Object.values(JSON.parse(value).values))).toEqual([
    'last'
  ])
})

it.each(['invalid json', 'EPERM'])(
  'starts with initial values after %s and preserves the unreadable file',
  async (failure) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let filename = path.resolve(project.path, project.name)
    if (process.platform === 'win32') filename = filename.toLowerCase()
    const target = path.join(
      'test-config',
      'remembered-variables',
      createHash('sha256').update(filename).digest('hex') + '.json'
    )
    files.set(target, '{broken')
    if (failure === 'EPERM') counts.readError = 'EPERM'
    global.vars = { input: variable() }
    expect(() => restoreVariables(project, global.vars)).not.toThrow()
    expect(global.vars.input.value!.value).toBeUndefined()
    setVar('input', 'runtime')
    await flushRememberedVariables()
    expect(files.get(target)).toBe('{broken')
    counts.readError = ''
    const id = createHash('sha256').update('input').digest('hex')
    files.set(target, JSON.stringify({ [id]: 'recovered' }))
    restoreVariables(project, global.vars)
    expect(global.vars.input.value!.value).toBe('recovered')
  }
)

it('does not resolve or hash the project path on frequent assignments', async () => {
  global.vars = { input: variable() }
  restoreVariables(project, global.vars)
  const resolve = vi.spyOn(path, 'resolve')
  const stringify = vi.spyOn(JSON, 'stringify')
  for (let i = 0; i < 100; i++) setVar('input', String(i))
  expect(resolve).not.toHaveBeenCalled()
  expect(stringify).not.toHaveBeenCalled()
})

it('does not release a new session when an earlier stop finishes', async () => {
  global.vars = { input: variable() }
  restoreVariables(project, global.vars)
  setVar('input', 'first')
  const stopping = stopRememberedVariables()
  restoreVariables(project, global.vars)
  await stopping
  setVar('input', 'new session')
  expect(rememberedValues(project, global.vars)).toEqual({ input: 'new session' })
  await stopRememberedVariables()
  setVar('input', 'after stop')
  expect(rememberedValues(project, global.vars)).toEqual({ input: 'new session' })
})
