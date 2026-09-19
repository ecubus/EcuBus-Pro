import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { useDataStore } from '../../src/renderer/src/stores/data'
import { useProjectStore } from '../../src/renderer/src/stores/project'
import { createControl, createDocument } from '../../src/renderer/src/views/uds/panel/free/model'
import { upgradeLegacyPanels } from '../../src/renderer/src/stores/panelCompatibility'
import { serializePanelFile } from '../../src/renderer/src/stores/panelFiles'

vi.mock('electron-log', () => ({ error: vi.fn(), info: vi.fn() }))

let directory: string
let file: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'ecubus-panel-'))
  file = path.join(directory, 'panel.ecb')
  setActivePinia(createPinia())
  vi.stubGlobal('window', {
    path,
    params: {},
    store: { get: vi.fn(), set: vi.fn() },
    electron: {
      ipcRenderer: {
        send: vi.fn(),
        invoke: vi.fn(async (channel: string, target: string, content: string) => {
          if (target !== file) throw new Error('Unexpected file access')
          if (channel === 'ipc-fs-writeFile') return writeFile(target, content, 'utf8')
          if (channel === 'ipc-fs-readFile') return readFile(target, 'utf8')
          throw new Error(`Unexpected IPC: ${channel}`)
        })
      }
    }
  })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await unlink(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
  await rmdir(directory)
})

it('reopens external Panel references from disk and retains missing references without a stale fallback', async () => {
  const external = path.join(directory, 'main.ecpanel')
  vi.mocked(window.electron.ipcRenderer.invoke).mockImplementation(async (channel, ...args) => {
    const target = args[0] as string
    if (![file, external].includes(target)) throw new Error('Unexpected file access')
    if (channel === 'ipc-fs-writeFile') return writeFile(target, args[1], 'utf8')
    if (channel === 'ipc-fs-readFile') return readFile(target, 'utf8')
    throw new Error('Unexpected IPC')
  })
  const data = useDataStore()
  const project = useProjectStore()
  project.router = { push: vi.fn() } as unknown as typeof project.router
  project.open = true
  project.projectInfo = { name: 'panel.ecb', path: directory }
  const document = createDocument()
  data.panels.main = {
    id: 'main',
    name: 'Main',
    filePath: external,
    document,
    rule: [],
    options: {}
  }
  try {
    await writeFile(external, serializePanelFile('Main', document), 'utf8')
    await project.saveProject()
    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.data.panels.main.filePath).toBe('main.ecpanel')
    expect(saved.data.panels.main.document).toBeUndefined()
    await project.closeProject()
    document.width = 1200
    await writeFile(external, serializePanelFile('Main', document), 'utf8')
    await project.openProjectByPath(file)
    await vi.waitFor(() => expect(project.open).toBe(true))
    expect(data.panels.main.document?.width).toBe(1200)
    await project.closeProject()
    await unlink(external)
    await project.openProjectByPath(file)
    await vi.waitFor(() => expect(project.open).toBe(true))
    expect(data.panels.main.document).toBeUndefined()
    expect(data.panels.main.fileError).toBe(external)
    await project.saveProject()
    expect(JSON.parse(await readFile(file, 'utf8')).data.panels.main.filePath).toBe('main.ecpanel')
  } finally {
    await unlink(external).catch(() => {})
  }
})

it('upgrades an actual legacy sample on open without rewriting the file and preserves its original rules on save', async () => {
  const source = JSON.parse(
    await readFile('resources/examples/script_demo_2/script_demo_2.ecb', 'utf8')
  )
  const originalPanels = JSON.parse(JSON.stringify(source.data.panels))
  const id = Object.keys(originalPanels)[0]
  await writeFile(file, JSON.stringify(source), 'utf8')
  const originalFile = await readFile(file, 'utf8')
  const data = useDataStore()
  const project = useProjectStore()
  project.router = { push: vi.fn() } as unknown as typeof project.router
  await project.openProjectByPath(file)
  await vi.waitFor(() => expect(project.open).toBe(true))
  const converted = data.panels[id]
  expect(converted.document?.controls).toHaveLength(1)
  expect(converted.document?.controls[0]).toMatchObject({
    type: 'button',
    buttonVariant: 'primary',
    binding: { kind: 'variable', node: { bindValue: { variableValueType: 'number' } } }
  })
  expect(converted.rule).toEqual(originalPanels[id].rule)
  expect(converted.options).toEqual(originalPanels[id].options)
  expect(converted.id).toBe(originalPanels[id].id)
  expect(await readFile(file, 'utf8')).toBe(originalFile)
  const expectedDocument = JSON.parse(JSON.stringify(converted.document))
  await project.saveProject()
  await project.closeProject()
  await project.openProjectByPath(file)
  await vi.waitFor(() => expect(project.open).toBe(true))
  expect(data.panels[id].document).toEqual(expectedDocument)
  expect(data.panels[id].rule).toEqual(originalPanels[id].rule)
  expect(Object.keys(data.panels)).toEqual(Object.keys(originalPanels))
})

it('keeps complex real legacy panels intact and does not overwrite existing V2 documents', async () => {
  for (const example of [
    'panel/panel',
    'can/Can',
    'lin_aa/lin_aa',
    'canopen_pdo/canopen_pdo',
    'uds_bin_file/uds_bin_file'
  ]) {
    const source = JSON.parse(await readFile(`resources/examples/${example}.ecb`, 'utf8'))
    const before = JSON.stringify(source.data.panels)
    upgradeLegacyPanels(source.data)
    expect(JSON.stringify(source.data.panels)).toBe(before)
  }
  const data = useDataStore()
  data.panels.saved = {
    id: 'saved',
    name: 'Saved',
    rule: [{ type: 'TText' }],
    options: {},
    document: createDocument()
  }
  const before = JSON.stringify(data.panels)
  upgradeLegacyPanels(data)
  expect(JSON.stringify(data.panels)).toBe(before)
})

it('uses the same conversion for example projects', async () => {
  const source = JSON.parse(
    await readFile('resources/examples/script_demo_2/script_demo_2.ecb', 'utf8')
  )
  await writeFile(file, JSON.stringify(source), 'utf8')
  const project = useProjectStore()
  project.router = { push: vi.fn() } as unknown as typeof project.router
  await project.createExampleProject(file)
  const panels = useDataStore().panels
  expect(Object.values(panels)[0].document?.controls).toHaveLength(1)
  expect(Object.values(panels)[0].rule).toEqual(
    Object.values(source.data.panels as Record<string, { rule: unknown[] }>)[0].rule
  )
})

it('never writes panel documents into the project file', async () => {
  const data = useDataStore()
  const project = useProjectStore()
  project.router = { push: vi.fn() } as unknown as typeof project.router
  project.open = true
  project.projectDirty = true
  project.projectInfo = { name: 'panel.ecb', path: directory }
  const document = createDocument()
  const tabs = createControl('tabs', 'tabs', 'Pages')
  const control = createControl('number', 'input', 'Level', 16, 24)
  control.parentId = tabs.id
  control.tabId = tabs.tabs![1].id
  control.labelPosition = 'left'
  control.binding = {
    kind: 'variable',
    node: {
      id: 'level',
      type: 'variable',
      name: 'Level',
      enable: true,
      color: '',
      bindValue: {
        variableId: 'level',
        variableType: 'user',
        variableName: 'Level',
        variableFullName: 'Level',
        variableValueType: 'number'
      }
    }
  }
  document.controls = [
    tabs,
    control,
    {
      ...createControl('image', 'image', 'Image'),
      imageSrc: 'data:image/png;base64,aGVsbG8=',
      imageFit: 'contain'
    }
  ]
  data.panels.free = { id: 'free', name: 'Free', document, rule: [], options: {} }
  data.panels.legacy = { id: 'legacy', name: 'Legacy', rule: [{ type: 'input' }], options: {} }
  for (const id of ['free', 'pfree']) {
    project.project.wins[id] = {
      id,
      title: id === 'free' ? 'panel' : 'panelPreview',
      label: 'Panel',
      pos: { x: 10, y: 20, w: 800, h: 550 },
      options: { name: 'Free', params: { 'edit-index': id } }
    }
  }
  const expectedPanels = JSON.parse(JSON.stringify(data.panels))
  delete expectedPanels.free.document
  const expectedWindows = JSON.parse(JSON.stringify(project.project.wins))
  await project.saveProject()
  expect(project.projectDirty).toBe(false)
  const saved = await readFile(file, 'utf8')
  expect(JSON.parse(saved).data.panels).toEqual(expectedPanels)
  expect(data.panels.free.document).toEqual(document)

  expect(await project.closeProject()).toBe(true)
  expect(data.panels).toEqual({})
  await project.openProjectByPath(file)
  await vi.waitFor(() => expect(project.open).toBe(true))
  expect(data.panels).toEqual(expectedPanels)
  expect(project.project.wins).toEqual(expectedWindows)
  expect(await readFile(file, 'utf8')).toBe(saved)
})
