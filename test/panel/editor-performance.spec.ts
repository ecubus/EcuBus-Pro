import { afterEach, expect, it, vi } from 'vitest'
import { createRenderer, h, nextTick, toRaw, ssrContextKey } from 'vue'
import Editor from '../../src/renderer/src/views/uds/panel/free/FreePanelEditor.vue'
import {
  cloneDocument,
  createControl,
  createDocument
} from '../../src/renderer/src/views/uds/panel/free/model'

vi.mock('@r/stores/data', () => ({
  useDataStore: () => ({ database: {}, vars: {}, devices: {}, tester: {} })
}))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn() } }))
vi.mock('../../src/renderer/src/views/uds/panel/free/PanelCanvas.vue', () => ({ default: {} }))
vi.mock('../../src/renderer/src/views/uds/panel/free/SourceLibrary.vue', () => ({ default: {} }))
import { ElMessage } from 'element-plus'

const renderer = createRenderer<any, any>({
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  insert: () => {},
  remove: () => {},
  setText: () => {},
  setElementText: () => {},
  parentNode: () => null,
  nextSibling: () => null,
  patchProp: () => {}
})
const roots: any[] = []
function mount() {
  const document = createDocument()
  document.controls = [createControl('image', 'image', 'Image')]
  const dirty = vi.fn()
  const root = {}
  roots.push(root)
  const component = { ...Editor, render: () => null } as unknown as typeof Editor
  const props = { initialDocument: document, initialName: 'Panel', height: 500, onDirty: dirty }
  const vnode = h(component, props)
  const app = renderer.createApp(component)
  app.provide(ssrContextKey, {})
  vnode.appContext = app._context
  renderer.render(vnode, root)
  return {
    state: (vnode.component as any).setupState,
    document,
    dirty,
    update: (patch: object) => renderer.render(h(component, { ...props, ...patch }), root)
  }
}
afterEach(() => {
  roots.splice(0).forEach((root) => renderer.render(null, root))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('caches the saved document and updates dirty state on edit, undo, name and save', async () => {
  const { state, document, dirty, update } = mount()
  const stringify = vi.spyOn(JSON, 'stringify')
  state.mutate((doc: any) => {
    doc.controls[0].x += 10
  })
  await nextTick()
  expect(dirty).toHaveBeenLastCalledWith(true)
  expect(stringify.mock.calls.some(([value]) => toRaw(value) === document)).toBe(false)
  state.restore('undo')
  await nextTick()
  expect(dirty).toHaveBeenLastCalledWith(false)
  stringify.mockClear()
  state.name = 'Renamed'
  await nextTick()
  expect(dirty).toHaveBeenLastCalledWith(true)
  expect(stringify).not.toHaveBeenCalled()
  update({ initialName: 'Renamed', initialDocument: cloneDocument(state.document) })
  await nextTick()
  expect(dirty).toHaveBeenLastCalledWith(false)
})

it('rejects oversized images before allocating a reader and accepts the size boundary', async () => {
  const read = vi.fn()
  const reader = vi.fn(function () {
    return { readAsDataURL: read }
  })
  vi.stubGlobal('FileReader', reader)
  const { state } = mount()
  state.selected = ['image']
  await nextTick()
  const file = { type: 'image/png', size: 5 * 1024 * 1024 + 1 }
  state.importImage({ target: { files: [file], value: 'file.png' } })
  expect(reader).not.toHaveBeenCalled()
  expect(ElMessage.error).toHaveBeenCalled()
  expect(state.document.controls[0].imageSrc).toBeFalsy()
  file.size--
  state.importImage({ target: { files: [file], value: 'file.png' } })
  expect(read).toHaveBeenCalledWith(file)
})
