import { createHash } from 'node:crypto'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile, rename, readdir, readFile, stat, unlink } from 'node:fs/promises'
import type { VarItem } from '../../preload/data'
import { store } from '../store'

type Value = number | string | number[]
type Project = { path: string; name: string }
type ProjectCache = {
  projectPath: string
  values: Record<string, unknown>
  revision: number
  savedRevision: number
  loadFailed: boolean
  writing?: Promise<void>
}
const state = {
  activeProject: undefined as Project | undefined,
  activeKey: undefined as string | undefined,
  activeCache: undefined as ProjectCache | undefined,
  deleting: new Map<string, Promise<void>>(),
  projects: new Map<string, ProjectCache>(),
  variableKeys: new Map<string, string>(),
  flushTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  directory: path.join(path.dirname(store.path), 'remembered-variables')
}

async function flushProject(target: string, cache: ProjectCache) {
  if (cache.writing) return cache.writing
  if (cache.revision === cache.savedRevision) return
  cache.writing = (async () => {
    try {
      await mkdir(state.directory, { recursive: true })
      while (cache.revision !== cache.savedRevision) {
        const revision = cache.revision
        const filename = path.join(state.directory, target + '.json')
        const temporary = filename + '.tmp'
        await writeFile(
          temporary,
          JSON.stringify({ projectPath: cache.projectPath, values: cache.values }),
          'utf8'
        )
        await rename(temporary, filename)
        cache.savedRevision = revision
      }
    } catch (error) {
      console.error('Failed to save remembered variables', error)
    }
  })()
  try {
    await cache.writing
  } finally {
    cache.writing = undefined
  }
}

export async function flushRememberedVariables() {
  clearTimeout(state.flushTimer)
  state.flushTimer = undefined
  await Promise.all([...state.projects].map(([target, cache]) => flushProject(target, cache)))
}

export async function stopRememberedVariables() {
  const session = state.activeProject
  await flushRememberedVariables()
  if (state.activeProject === session) {
    state.activeProject = undefined
    state.activeKey = undefined
    state.activeCache = undefined
  }
}

function scheduleFlush(cache: ProjectCache) {
  if (cache.loadFailed) return
  cache.revision++
  if (state.flushTimer) return
  state.flushTimer = setTimeout(() => void flushRememberedVariables(), 500)
  state.flushTimer.unref()
}

function parseRememberedFile(text: string): {
  projectPath: string
  values: Record<string, unknown>
} {
  const content = JSON.parse(text)
  if (
    !content ||
    typeof content.projectPath !== 'string' ||
    !content.values ||
    typeof content.values !== 'object' ||
    Array.isArray(content.values)
  )
    throw new Error('Invalid remembered variables file')
  return content
}

function projectCache(project: Project) {
  if (!project.path || !project.name) return undefined
  const target = key(project)
  if (state.deleting.has(target)) return undefined
  let cache = state.projects.get(target)
  if (!cache) {
    let saved: Record<string, unknown> = {}
    let loadFailed = false
    try {
      saved = parseRememberedFile(
        readFileSync(path.join(state.directory, target + '.json'), 'utf8')
      ).values
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to load remembered variables; using initial values', error)
        loadFailed = true
      }
    }
    cache = {
      projectPath: path.resolve(project.path, project.name),
      values: saved,
      revision: 0,
      savedRevision: 0,
      loadFailed
    }
    for (const [id, entry] of state.projects) {
      if (state.projects.size < 16) break
      if (!entry.writing && entry.revision === entry.savedRevision && id !== state.activeKey)
        state.projects.delete(id)
    }
    state.projects.set(target, cache)
  }
  return cache
}

function variableKey(id: string) {
  let hash = state.variableKeys.get(id)
  if (!hash) {
    hash = createHash('sha256').update(id).digest('hex')
    state.variableKeys.set(id, hash)
  }
  return hash
}

function copy(value: Value): Value {
  return Array.isArray(value) ? [...value] : value
}

function key(project: Project) {
  let filename = path.resolve(project.path, project.name)
  if (process.platform === 'win32') filename = filename.toLowerCase()
  return createHash('sha256').update(filename).digest('hex')
}

function valid(variable: VarItem, value: unknown): value is Value {
  if (variable.type !== 'user' || variable.rememberValue === false || !variable.value) return false
  switch (variable.value.type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'string':
      return typeof value === 'string'
    case 'array':
      return Array.isArray(value) && value.every((v) => typeof v === 'number' && Number.isFinite(v))
  }
}

export function rememberedValues(project: Project, variables: Record<string, VarItem>) {
  const result: Record<string, Value> = {}
  const saved = projectCache(project)?.values
  if (!saved) return result
  for (const [id, variable] of Object.entries(variables)) {
    if (variable.type !== 'user' || variable.rememberValue === false) continue
    const value: unknown = saved[variableKey(id)]
    if (valid(variable, value)) result[id] = copy(value)
  }
  return result
}

export async function restoreVariables(
  project: Project,
  variables: Record<string, VarItem>,
  signal?: AbortSignal
) {
  signal?.throwIfAborted()
  const target = project.path && project.name ? key(project) : undefined
  while (target && state.deleting.has(target)) {
    const deletion = state.deleting.get(target)!.catch(() => {})
    if (!signal) {
      await deletion
      continue
    }
    let onAbort!: () => void
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(signal.reason)
      signal.addEventListener('abort', onAbort, { once: true })
    })
    try {
      await Promise.race([deletion, aborted])
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
    signal.throwIfAborted()
  }
  signal?.throwIfAborted()
  void flushRememberedVariables()
  state.activeProject = { ...project }
  state.activeKey = project.path && project.name ? key(project) : undefined
  if (state.activeKey && state.projects.get(state.activeKey)?.loadFailed)
    state.projects.delete(state.activeKey)
  state.activeCache = projectCache(project)
  const values = rememberedValues(project, variables)
  const cache = state.activeCache
  if (!cache) return
  const allowed = new Set(
    Object.entries(variables)
      .filter(
        ([, variable]) =>
          variable.type === 'user' && variable.rememberValue !== false && variable.value
      )
      .map(([id]) => variableKey(id))
  )
  for (const id of Object.keys(cache.values)) {
    if (!allowed.has(id)) {
      delete cache.values[id]
      scheduleFlush(cache)
    }
  }
  for (const [id, variable] of Object.entries(variables)) {
    if (values[id] !== undefined && variable.value) variable.value.value = values[id]
  }
}

export function rememberVariable(variable: VarItem) {
  const value = variable.value?.value
  if (!state.activeProject || !valid(variable, value)) return
  const cache = state.activeCache
  if (!cache) return
  const saved = cache.values
  const target = variableKey(variable.id)
  const previous = saved[target]
  if (
    previous === value ||
    (Array.isArray(previous) &&
      Array.isArray(value) &&
      previous.length === value.length &&
      previous.every((item, index) => item === value[index]))
  )
    return
  saved[target] = copy(value)
  scheduleFlush(cache)
}

export function panelVariableValues(
  project: Project,
  variables: Record<string, VarItem>,
  running: boolean
) {
  const values = rememberedValues(project, variables)
  const currentProject =
    state.activeProject &&
    (state.activeKey
      ? key(project) === state.activeKey
      : project.path === state.activeProject.path && project.name === state.activeProject.name)
  if (running && currentProject) {
    for (const id of Object.keys(variables)) {
      const variable = global.vars?.[id]?.value
      const current = variable?.value ?? variable?.initValue
      if (current !== undefined) values[id] = copy(current)
    }
  }
  return values
}

const rememberedFilename = /^[a-f0-9]{64}\.json$/

export async function listRememberedProjects() {
  let entries
  try {
    entries = await readdir(state.directory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && rememberedFilename.test(entry.name))
      .map(async (entry) => {
        const target = entry.name.slice(0, -5)
        const filename = path.join(state.directory, entry.name)
        let modifiedAt: number | null = null
        let projectPath = ''
        let loadFailed = false
        try {
          modifiedAt = (await stat(filename)).mtimeMs
          projectPath = parseRememberedFile(await readFile(filename, 'utf8')).projectPath
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
          loadFailed = true
        }
        const cache = state.projects.get(target)
        return {
          id: entry.name,
          projectPath,
          modifiedAt,
          loadFailed: loadFailed || !!cache?.loadFailed,
          protected:
            state.deleting.has(target) ||
            target === state.activeKey ||
            !!cache?.writing ||
            !!(cache && cache.revision !== cache.savedRevision)
        }
      })
  )
  return records.filter((record) => record !== null)
}

export async function deleteRememberedProjects(ids: string[]) {
  const available = new Map((await listRememberedProjects()).map((entry) => [entry.id, entry]))
  for (const id of new Set(ids)) {
    const record = available.get(id)
    if (!record || !rememberedFilename.test(id) || record.protected)
      throw new Error('Remembered project cannot be deleted')
  }
  for (const id of new Set(ids)) {
    const target = id.slice(0, -5)
    const cache = state.projects.get(target)
    if (
      state.deleting.has(target) ||
      target === state.activeKey ||
      cache?.writing ||
      (cache && cache.revision !== cache.savedRevision)
    )
      throw new Error('Remembered project is in use')
    const deletion = unlink(path.join(state.directory, id))
      .then(() => {
        state.projects.delete(target)
      })
      .finally(() => {
        state.deleting.delete(target)
      })
    state.deleting.set(target, deletion)
    await deletion
  }
}
