import { beforeEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import path from 'node:path'

const disk = vi.hoisted(() => ({
  files: new Map<string, string>(),
  errors: new Map<string, string>(),
  unlink: vi.fn()
}))
vi.mock('../../src/main/store', () => ({ store: { path: 'test-config/config.json' } }))
vi.mock('node:fs', () => ({
  readFileSync: (file: string) => {
    const content = disk.files.get(path.basename(file))
    if (content === undefined) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
    return content
  }
}))
vi.mock('node:fs/promises', () => ({
  readdir: async () => [...disk.files.keys()].map((name) => ({ name, isFile: () => true })),
  stat: async (file: string) => {
    const code = disk.errors.get(path.basename(file))
    if (code) throw Object.assign(new Error(code), { code })
    return { mtimeMs: 123 }
  },
  readFile: async (file: string) => disk.files.get(path.basename(file)),
  unlink: (file: string) => disk.unlink(file)
}))

beforeEach(() => {
  vi.resetModules()
  disk.files.clear()
  disk.errors.clear()
  disk.unlink.mockReset()
})

it.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true]
])('waits for deletion before restoring (failure: %s, cancelled: %s)', async (fails, cancelled) => {
  const p = await import('../../src/main/var/persistence')
  const project = { path: 'projects', name: 'one.ecb' }
  let filename = path.resolve(project.path, project.name)
  if (process.platform === 'win32') filename = filename.toLowerCase()
  const id = createHash('sha256').update(filename).digest('hex') + '.json'
  const variableId = createHash('sha256').update('input').digest('hex')
  disk.files.set(id, JSON.stringify({ projectPath: filename, values: { [variableId]: 42 } }))
  let release!: () => void
  disk.unlink.mockImplementation(async () => {
    await new Promise<void>((resolve) => {
      release = resolve
    })
    if (fails) throw new Error('locked')
    disk.files.delete(id)
  })
  const variables = {
    input: {
      id: 'input',
      name: 'input',
      type: 'user' as const,
      value: { type: 'number' as const, initValue: 0, value: undefined as number | undefined }
    }
  }
  expect(p.rememberedValues(project, variables)).toEqual({ input: 42 })
  const deletion = p.deleteRememberedProjects([id]).catch((error) => error)
  await vi.waitFor(() => expect(disk.unlink).toHaveBeenCalledOnce())
  expect(p.rememberedValues(project, variables)).toEqual({})
  let restored = false
  const controller = new AbortController()
  const restoring = p.restoreVariables(project, variables, controller.signal).then(() => {
    restored = true
  })
  await Promise.resolve()
  expect(restored).toBe(false)
  if (cancelled) {
    controller.abort(new Error('cancelled'))
    await expect(restoring).rejects.toThrow('cancelled')
    await p.stopRememberedVariables()
  }
  release()
  await deletion
  if (!cancelled) await restoring
  expect(variables.input.value.value).toBe(fails && !cancelled ? 42 : undefined)
  if (cancelled && fails) {
    expect((await p.listRememberedProjects())[0].protected).toBe(false)
  }
  await p.stopRememberedVariables()
  expect(p.rememberedValues(project, variables)).toEqual(fails ? { input: 42 } : {})
})

it('keeps readable records, marks inaccessible files and skips missing files', async () => {
  const p = await import('../../src/main/var/persistence')
  for (const letter of ['a', 'b', 'c']) {
    disk.files.set(letter.repeat(64) + '.json', JSON.stringify({ projectPath: letter, values: {} }))
  }
  disk.errors.set('a'.repeat(64) + '.json', 'EPERM')
  disk.errors.set('b'.repeat(64) + '.json', 'ENOENT')
  const records = await p.listRememberedProjects()
  expect(records).toHaveLength(2)
  expect(records[0]).toMatchObject({ loadFailed: true, modifiedAt: null })
  expect(records[1]).toMatchObject({ loadFailed: false, projectPath: 'c', modifiedAt: 123 })
})
