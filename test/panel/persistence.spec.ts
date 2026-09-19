import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import path from 'node:path'
import type { PanelItem } from '../../src/preload/data'
import type { PanelDocument } from '../../src/preload/panel'
import PanelEditor from '../../src/renderer/src/views/uds/panel/panelEditor.vue'
import PanelView from '../../src/renderer/src/views/uds/panel/panelView.vue'
import { createControl, createDocument } from '../../src/renderer/src/views/uds/panel/free/model'

const state = vi.hoisted(() => ({
  panels: {} as Record<string, PanelItem>,
  save: undefined as { name: string; document: PanelDocument } | undefined,
  editor: undefined as PanelDocument | undefined,
  view: undefined as PanelDocument | undefined
}))
vi.mock('@r/stores/data', () => ({ useDataStore: () => state }))
vi.mock('@r/stores/project', () => ({ useProjectStore: () => ({ projectInfo: { path: '' } }) }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../../src/renderer/src/views/uds/panel/free/FreePanelEditor.vue', () => ({
  default: {
    props: ['initialDocument', 'initialName', 'height', 'dialogTarget'],
    emits: ['save', 'dirty'],
    setup(props: { initialDocument: PanelDocument }, { emit }: { emit: (...args: any[]) => void }) {
      state.editor = props.initialDocument
      if (state.save) emit('save', state.save.name, state.save.document)
      return () => null
    }
  }
}))
vi.mock('../../src/renderer/src/views/uds/panel/free/FreePanelView.vue', () => ({
  default: {
    props: ['document', 'height'],
    setup(props: { document: PanelDocument }) {
      state.view = props.document
      return () => null
    }
  }
}))
vi.mock('../../src/renderer/src/views/uds/panel/LegacyPanelEditor.vue', () => ({
  __esModule: true,
  default: { render: () => h('div', 'legacy-editor') }
}))
vi.mock('../../src/renderer/src/views/uds/panel/LegacyPanelView.vue', () => ({
  __esModule: true,
  default: { render: () => h('div', 'legacy-view') }
}))

async function render(editIndex: string, preview = false) {
  const app = createSSRApp(preview ? PanelView : PanelEditor, { editIndex, height: 550 })
  for (const name of ['el-button', 'el-dialog', 'el-table', 'el-table-column'])
    app.component(name, { render: () => null })
  app.provide('layout', { setWinModified: vi.fn(), changeWinName: vi.fn() })
  return renderToString(app)
}

const fileInvoke = vi.fn()
beforeEach(() => {
  fileInvoke
    .mockReset()
    .mockImplementation(async (channel: string) =>
      channel === 'ipc-show-save-dialog' ? { canceled: false, filePath: 'main.ecpanel' } : undefined
    )
  vi.stubGlobal('window', {
    path,
    electron: {
      ipcRenderer: {
        invoke: fileInvoke
      }
    }
  })
  state.panels = {}
  state.save = undefined
  state.editor = undefined
  state.view = undefined
})
afterEach(() => vi.unstubAllGlobals())

describe('panel persistence entry points', () => {
  it('keeps the saved document unchanged when an external file write fails', async () => {
    const original = createDocument()
    state.panels.external = {
      id: 'external',
      name: 'External',
      rule: [],
      options: {},
      document: original,
      filePath: 'main.ecpanel'
    }
    const invoke = vi.fn().mockRejectedValue(new Error('Write failed'))
    vi.stubGlobal('window', { electron: { ipcRenderer: { invoke } } })
    state.save = { name: 'External', document: { ...original, width: 1200 } }
    await render('external')
    await vi.waitFor(() => expect(invoke).toHaveBeenCalled())
    expect(state.panels.external.document).toEqual(original)
  })
  it('restores a newly saved document using the persisted editor and runtime window ids', async () => {
    const document = createDocument()
    document.controls = [
      createControl('tabs', 'tabs', 'Pages'),
      createControl('image', 'image', 'Image')
    ]
    const tabs = document.controls[0]
    document.controls[1].parentId = tabs.id
    document.controls[1].tabId = tabs.tabs![0].id
    document.controls[1].imageSrc = 'data:image/png;base64,aGVsbG8='
    state.save = { name: 'Saved panel', document }
    await render('new-panel-id')
    await vi.waitFor(() => expect(state.panels['new-panel-id']?.document).toEqual(document))
    expect(state.panels['new-panel-id'].document).not.toBe(document)

    state.panels = JSON.parse(JSON.stringify(state.panels))
    state.save = undefined
    await render('new-panel-id')
    expect(state.editor).toEqual(document)
    await render('pnew-panel-id', true)
    expect(state.view).toEqual(document)
  })

  it('updates the same panel on repeated saves without creating duplicates', async () => {
    state.save = { name: 'First', document: createDocument() }
    await render('stable-id')
    await vi.waitFor(() => expect(state.panels['stable-id']?.name).toBe('First'))
    state.save = { name: 'Renamed', document: createDocument() }
    await render('stable-id')
    await vi.waitFor(() => expect(state.panels['stable-id']?.name).toBe('Renamed'))
    expect(Object.keys(state.panels)).toEqual(['stable-id'])
    expect(state.panels['stable-id'].name).toBe('Renamed')
    expect(fileInvoke.mock.calls.filter((c) => c[0] === 'ipc-show-save-dialog')).toHaveLength(1)
  })

  it('prompts on the first save of an automatically converted embedded panel', async () => {
    const document = createDocument()
    state.panels.old = { id: 'old', name: 'Old', document, rule: [{ type: 'TText' }], options: {} }
    state.save = { name: 'Old', document }
    await render('old')
    await vi.waitFor(() => expect(state.panels.old.filePath).toBe('main.ecpanel'))
    expect(fileInvoke).toHaveBeenCalledWith('ipc-show-save-dialog', expect.any(Object))
    expect(state.panels.old.rule).toEqual([{ type: 'TText' }])
  })

  it('does not create a new panel or replace converted content when the save dialog is cancelled', async () => {
    fileInvoke.mockResolvedValue({ canceled: true })
    state.save = { name: 'New', document: createDocument() }
    await render('new')
    expect(state.panels.new).toBeUndefined()
    const original = { id: 'old', name: 'Old', document: createDocument(), rule: [], options: {} }
    state.panels.old = original
    state.save = { name: 'Old', document: { ...original.document, width: 1200 } }
    await render('old')
    expect(state.panels.old).toEqual(original)
    expect(fileInvoke.mock.calls.every((c) => c[0] === 'ipc-show-save-dialog')).toBe(true)
  })

  it('keeps legacy panels on the legacy path without rewriting them', async () => {
    const legacy = { id: 'old', name: 'Old', rule: [{ type: 'input' }], options: {} }
    state.panels.old = legacy
    expect(await render('old')).toContain('legacy-editor')
    expect(await render('pold', true)).toContain('legacy-view')
    expect(state.panels.old).toEqual(legacy)
    expect(state.panels.old.document).toBeUndefined()
  })
})
