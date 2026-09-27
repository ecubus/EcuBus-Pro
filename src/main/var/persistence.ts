import { createHash } from 'node:crypto'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile, rename, readdir, readFile, stat, unlink } from 'node:fs/promises'
import type { VarItem } from '../../preload/data'
import { store } from '../store'

type Value = number | string | number[]
type Project = { path: string; name: string }
let activeProject: Project | undefined
let activeKey: string | undefined
let activeCache: ProjectCache | undefined
type ProjectCache = {
  projectPath: string
  values: Record<string, unknown>
  revision: number
  savedRevision: number
  legacy: boolean
  loadFailed: boolean
  writing?: Promise<void>
}
const projects = new Map<string, ProjectCache>()
const variableKeys = new Map<string, string>()
let flushTimer: ReturnType<typeof setTimeout> | undefined
const directory = path.join(path.dirname(store.path), 'remembered-variables')

async function flushProject(target: string, cache: ProjectCache) {
  if (cache.writing) return cache.writing
  if (cache.revision === cache.savedRevision && !cache.legacy) return
  cache.writing = (async () => {
    try {
      await mkdir(directory, { recursive: true })
      while (cache.revision !== cache.savedRevision) {
        const revision = cache.revision
        const filename = path.join(directory, target + '.json')
        const temporary = filename + '.tmp'
        await writeFile(
          temporary,
          JSON.stringify({ projectPath: cache.projectPath, values: cache.values }),
          'utf8'
        )
        await rename(temporary, filename)
        cache.savedRevision = revision
      }
      if (cache.legacy) {
        store.delete(`rememberedVariables.${target}`)
        cache.legacy = false
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
  clearTimeout(flushTimer)
  flushTimer = undefined
  await Promise.all([...projects].map(([target, cache]) => flushProject(target, cache)))
}

export async function stopRememberedVariables() {
  const session = activeProject
  await flushRememberedVariables()
  if (activeProject === session) {
    activeProject = undefined
    activeKey = undefined
    activeCache = undefined
  }
}

function scheduleFlush(cache: ProjectCache) {
  if (cache.loadFailed) return
  cache.revision++
  if (flushTimer) return
  flushTimer = setTimeout(() => void flushRememberedVariables(), 500)
  flushTimer.unref()
}

function projectCache(project: Project) {
  if (!project.path || !project.name) return undefined
  const target = key(project)
  let cache = projects.get(target)
  if (!cache) {
    let saved: unknown
    let legacy = false
    let loadFailed = false
    try {
      saved = JSON.parse(readFileSync(path.join(directory, target + '.json'), 'utf8'))
      if (saved && typeof saved === 'object' && typeof (saved as any).projectPath === 'string')
        saved = (saved as any).values
    } catch (error) {
      try {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        saved = store.get(`rememberedVariables.${target}`)
        legacy = saved !== undefined
      } catch (readError) {
        console.error('Failed to load remembered variables; using initial values', readError)
        loadFailed = true
      }
    }
    cache = {
      projectPath: path.resolve(project.path, project.name),
      values:
        saved && typeof saved === 'object' && !Array.isArray(saved)
          ? (saved as Record<string, unknown>)
          : {},
      revision: 0,
      savedRevision: 0,
      legacy,
      loadFailed
    }
    for (const [id, entry] of projects) {
      if (projects.size < 16) break
      if (
        !entry.writing &&
        !entry.legacy &&
        entry.revision === entry.savedRevision &&
        id !== activeKey
      )
        projects.delete(id)
    }
    projects.set(target, cache)
    if (legacy) scheduleFlush(cache)
  }
  return cache
}

function variableKey(id: string) {
  let hash = variableKeys.get(id)
  if (!hash) {
    hash = createHash('sha256').update(id).digest('hex')
    variableKeys.set(id, hash)
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

export function restoreVariables(project: Project, variables: Record<string, VarItem>) {
  void flushRememberedVariables()
  activeProject = { ...project }
  activeKey = project.path && project.name ? key(project) : undefined
  if (activeKey && projects.get(activeKey)?.loadFailed) projects.delete(activeKey)
  activeCache = projectCache(project)
  const values = rememberedValues(project, variables)
  const cache = activeCache
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
  if (!activeProject || !valid(variable, value)) return
  const cache = activeCache
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
    activeProject &&
    (activeKey
      ? key(project) === activeKey
      : project.path === activeProject.path && project.name === activeProject.name)
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
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && rememberedFilename.test(entry.name))
      .map(async (entry) => {
        const target = entry.name.slice(0, -5)
        const filename = path.join(directory, entry.name)
        const details = await stat(filename)
        let projectPath = ''
        let loadFailed = false
        try {
          const content = JSON.parse(await readFile(filename, 'utf8'))
          if (typeof content.projectPath === 'string') projectPath = content.projectPath
        } catch {
          loadFailed = true
        }
        const cache = projects.get(target)
        return {
          id: entry.name,
          projectPath,
          modifiedAt: details.mtimeMs,
          loadFailed: loadFailed || !!cache?.loadFailed,
          protected:
            target === activeKey ||
            !!cache?.writing ||
            !!(cache && cache.revision !== cache.savedRevision)
        }
      })
  )
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
    const cache = projects.get(target)
    if (target === activeKey || cache?.writing || (cache && cache.revision !== cache.savedRevision))
      throw new Error('Remembered project is in use')
    store.delete(`rememberedVariables.${target}`)
    await unlink(path.join(directory, id))
    if (target !== activeKey) projects.delete(target)
  }
}
