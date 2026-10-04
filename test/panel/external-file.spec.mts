import { afterEach, expect, it, vi } from 'vitest'
import path from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import type { CanDB } from '../../src/main/share/can'
import { useDataStore } from '../../src/renderer/src/stores/data'
import { createControl, createDocument } from '../../src/renderer/src/views/uds/panel/free/model'
import { panelSources } from '../../src/renderer/src/views/uds/panel/free/sources'
import {
  bindPanelFile,
  loadPanelFiles,
  panelReferences,
  panelUsingFile,
  parsePanelFile,
  serializePanelFile
} from '../../src/renderer/src/stores/panelFiles'

afterEach(() => vi.unstubAllGlobals())
function fixture() {
  setActivePinia(createPinia())
  const data = useDataStore()
  const document = createDocument()
  document.controls.push(createControl('slider', 'slider', 'Level'))
  return { data, document }
}
it('round trips standalone files and rejects invalid versions, geometry and cyclic containers', () => {
  const { document } = fixture()
  const file = serializePanelFile('Panel', document)
  expect(parsePanelFile(file)).toEqual({ name: 'Panel', document })
  expect(() => parsePanelFile(file.replace('"version": 1', '"version": 99'))).toThrow()
  document.controls[0].width = -1
  expect(() => serializePanelFile('Panel', document)).toThrow()
  const group = createControl('group', 'group', 'Group')
  group.parentId = 'group'
  document.controls = [group]
  expect(() => serializePanelFile('Panel', document)).toThrow()
})
it('round trips HTML content and its panel script', () => {
  const { document } = fixture()
  document.controls = [
    {
      ...createControl('html', 'html', 'HTML'),
      htmlContent: '<button id="run">Run</button>',
      scriptContent: "document.querySelector('#run').textContent = 'Ready'"
    }
  ]
  const file = serializePanelFile('HTML panel', document)
  expect(parsePanelFile(file).document.controls[0]).toMatchObject({
    type: 'html',
    htmlContent: '<button id="run">Run</button>',
    scriptContent: "document.querySelector('#run').textContent = 'Ready'"
  })
})
it('rebinds variables by full name and type across project IDs and preserves unresolved names', () => {
  const { data, document } = fixture()
  data.vars.old = {
    id: 'old',
    name: 'Level',
    type: 'user',
    value: { type: 'number', min: 0, max: 100, initValue: 0, enum: [{ name: 'On', value: 1 }] }
  }
  document.controls[0].binding = panelSources(data.database, data.vars)[0].binding
  data.vars.new = { ...data.vars.old, id: 'new' }
  delete data.vars.old
  const resolved = bindPanelFile(reactive(document), data)
  expect(resolved.controls[0].binding?.node.id).toBe('new')
  expect(document.controls[0].binding?.node.id).toBe('old')
  delete data.vars.new
  const missing = bindPanelFile(document, data).controls[0].binding!
  expect(missing.kind === 'variable' && missing.node.bindValue.variableId).toBe('')
  expect(missing.kind === 'variable' && missing.node.bindValue.variableFullName).toBe('Level')
})
it('persists only relative external references and loads current disk content without writing files', async () => {
  const { data, document } = fixture()
  const directory = path.resolve('test-project')
  const target = path.join(directory, 'panels', 'main.ecpanel')
  data.panels.main = { id: 'main', name: 'Main', rule: [], options: {}, filePath: target, document }
  const invoke = vi.fn(async () => serializePanelFile('Main', { ...document, width: 1234 }))
  vi.stubGlobal('window', { path, electron: { ipcRenderer: { invoke } } })
  const refs = panelReferences(data.panels, directory)
  expect(refs.main.filePath).toBe(path.join('panels', 'main.ecpanel'))
  expect(refs.main.document).toBeUndefined()
  expect(data.panels.main.document).toEqual(document)
  data.panels = refs
  await loadPanelFiles(data, directory)
  expect(data.panels.main.document?.width).toBe(1234)
  expect(invoke).toHaveBeenCalledWith('ipc-fs-readFile', target, 'utf-8')
  invoke.mockRejectedValue(new Error('Missing'))
  await loadPanelFiles(data, directory)
  expect(data.panels.main.document).toBeUndefined()
  expect(data.panels.main.fileError).toBe(target)
  expect(panelReferences(data.panels, directory).main.fileError).toBeUndefined()
})

it('resolves signal database IDs by protocol, database, frame and signal and rejects ambiguous matches', () => {
  const { data, document } = fixture()
  data.database.can.old = {
    name: 'Powertrain',
    messages: [
      { id: 100, name: 'Status', signals: [{ name: 'Speed', start_bit: 0, bit_length: 16 }] }
    ]
  } as CanDB
  document.controls[0].binding = panelSources(data.database, data.vars)[0].binding
  data.database.can.new = data.database.can.old
  delete data.database.can.old
  const rebound = bindPanelFile(document, data).controls[0].binding!
  expect(rebound.kind === 'signal' && rebound.node.bindValue.dbKey).toBe('new')
  data.database.can.duplicate = data.database.can.new
  const ambiguous = bindPanelFile(document, data).controls[0].binding!
  expect(ambiguous.kind === 'signal' && ambiguous.node.bindValue.dbKey).toBe('')
})

it('finds the panel already using a file regardless of path spelling', () => {
  const { data, document } = fixture()
  vi.stubGlobal('window', { path })
  const target = path.resolve('test-project', 'main.ecpanel')
  data.panels.main = { id: 'main', name: 'Main', rule: [], options: {}, filePath: target, document }
  const spelled = path.join(path.resolve('test-project'), 'panels', '..', 'main.ecpanel')
  expect(panelUsingFile(data.panels, spelled)?.id).toBe('main')
  expect(panelUsingFile(data.panels, spelled, 'main')).toBeUndefined()
  expect(panelUsingFile(data.panels, path.resolve('test-project', 'other.ecpanel'))).toBeUndefined()
})
