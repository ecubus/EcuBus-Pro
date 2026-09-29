import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import type { VarItem } from '../../src/preload/data'

const config = vi.hoisted(() => ({ path: '' }))
vi.mock('../../src/main/store', () => ({
  store: {
    get path() {
      return config.path
    },
    get: () => undefined,
    delete: vi.fn()
  }
}))

it.each([
  ['empty object', {}, true],
  ['missing values', { projectPath: 'project.ecb' }, true],
  ['null values', { projectPath: 'project.ecb', values: null }, true],
  ['array values', { projectPath: 'project.ecb', values: [] }, true],
  ['missing path', { values: {} }, true],
  ['valid empty values', { projectPath: 'project.ecb', values: {} }, false]
] as const)('uses the same list and load validation for %s', async (_name, content, invalid) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'panel-retention-validation-'))
  config.path = path.join(directory, 'config.json')
  vi.resetModules()
  const persistence = await import('../../src/main/var/persistence')
  const project = { path: directory, name: 'project.ecb' }
  let projectPath = path.resolve(project.path, project.name)
  if (process.platform === 'win32') projectPath = projectPath.toLowerCase()
  const id = createHash('sha256').update(projectPath).digest('hex') + '.json'
  const folder = path.join(directory, 'remembered-variables')
  mkdirSync(folder)
  const filename = path.join(folder, id)
  const original = JSON.stringify(content)
  writeFileSync(filename, original)
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect(await persistence.listRememberedProjects()).toEqual([
      expect.objectContaining({ id, loadFailed: invalid, protected: false })
    ])
    await expect(persistence.restoreVariables(project, {})).resolves.toBeUndefined()
    expect(errors.mock.calls.length > 0).toBe(invalid)
    await persistence.stopRememberedVariables()
    expect(readFileSync(filename, 'utf8')).toBe(original)
    await persistence.deleteRememberedProjects([id])
    expect(await persistence.listRememberedProjects()).toEqual([])
  } finally {
    errors.mockRestore()
    rmSync(directory, { recursive: true, force: true })
  }
})

it('atomically writes a project file and restores it with a fresh cache', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'panel-retention-disk-'))
  config.path = path.join(directory, 'config.json')
  vi.resetModules()
  const project = { path: directory, name: 'project.ecb' }
  const variables: Record<string, VarItem> = {
    input: {
      id: 'input',
      name: 'Input',
      type: 'user',
      value: { type: 'array', initValue: [] }
    }
  }
  const first = await import('../../src/main/var/persistence')
  try {
    await first.restoreVariables(project, variables)
    variables.input.value!.value = [0, 42]
    first.rememberVariable(variables.input)
    await first.flushRememberedVariables()
    const folder = path.join(directory, 'remembered-variables')
    const files = readdirSync(folder)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^[a-f0-9]{64}\.json$/)
    expect(
      Object.values(JSON.parse(readFileSync(path.join(folder, files[0]), 'utf8')).values)
    ).toEqual([[0, 42]])
    vi.resetModules()
    const second = await import('../../src/main/var/persistence')
    expect(second.rememberedValues(project, variables)).toEqual({ input: [0, 42] })
    expect(readdirSync(directory)).toEqual(['remembered-variables'])
    const other = { ...project, name: 'other.ecb' }
    await second.restoreVariables(other, variables)
    second.rememberVariable(variables.input)
    await second.flushRememberedVariables()
    const records = await second.listRememberedProjects()
    expect(records).toHaveLength(2)
    const inactive = records.find(
      (record) => record.projectPath === path.join(project.path, project.name)
    )!
    const active = records.find((record) => record.protected)!
    await expect(second.deleteRememberedProjects(['../config.json'])).rejects.toThrow()
    await expect(second.deleteRememberedProjects([active.id])).rejects.toThrow()
    await second.deleteRememberedProjects([inactive.id])
    expect((await second.listRememberedProjects()).map((record) => record.id)).toEqual([active.id])
    await second.stopRememberedVariables()
    expect((await second.listRememberedProjects())[0].protected).toBe(false)
    await second.deleteRememberedProjects([active.id])
    writeFileSync(path.join(folder, active.id), '{broken')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    await second.restoreVariables(other, variables)
    expect((await second.listRememberedProjects())[0]).toMatchObject({
      loadFailed: true,
      protected: true
    })
    await second.stopRememberedVariables()
    expect((await second.listRememberedProjects())[0]).toMatchObject({
      loadFailed: true,
      protected: false
    })
    await second.deleteRememberedProjects([active.id])
    await second.restoreVariables(other, variables)
    variables.input.value!.value = [99]
    second.rememberVariable(variables.input)
    await second.stopRememberedVariables()
    expect((await second.listRememberedProjects())[0]).toMatchObject({
      loadFailed: false,
      protected: false
    })
    expect(
      Object.values(JSON.parse(readFileSync(path.join(folder, active.id), 'utf8')).values)
    ).toEqual([[99]])
    errors.mockRestore()
  } finally {
    await first.flushRememberedVariables()
    rmSync(directory, { recursive: true, force: true })
  }
})
