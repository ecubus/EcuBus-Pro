import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

function execute(source: string, context: object) {
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
    }).outputText,
    context
  )
}

it.each(['Example.app', 'Example.APP', 'alias'])(
  'rejects application directories before shell.openPath: %s',
  async (name) => {
    const file = 'src/main/ipc/fs.ts'
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    )
    const handler = source.statements.find((node) =>
      node.getText(source).startsWith("ipcMain.handle('ipc-panel-open-path'")
    )!
    let open!: (event: unknown, target: string) => Promise<boolean>
    const shell = { openPath: vi.fn(async () => '') }
    execute(handler.getText(source), {
      ipcMain: {
        handle: (_channel: string, callback: typeof open) => {
          open = callback
        }
      },
      fsP: {
        realpath: async () =>
          name === 'alias' ? '/Applications/Example.app' : `/Applications/${name}`,
        stat: async () => ({ isDirectory: () => true, isFile: () => false })
      },
      path,
      shell
    })
    await expect(open(null, name)).rejects.toThrow('Panel can only open')
    expect(shell.openPath).not.toHaveBeenCalled()
  }
)

it.each([false, true])(
  'relinks with a unique name, excluding the current panel (collision=%s)',
  async (collision) => {
    const file = 'src/renderer/src/views/uds/panel/panelEditor.vue'
    const script = readFileSync(file, 'utf8')
      .split('<script setup lang="ts">')[1]
      .split('</script>')[0]
    const source = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true)
    const fn = source.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'relinkFile'
    )!
    const panels: any = { current: { id: 'current', name: 'Panel', fileError: 'missing' } }
    if (collision) {
      panels.other = { id: 'other', name: 'Panel' }
      panels.other2 = { id: 'other2', name: 'Panel (2)' }
    }
    const invoke = vi.fn(async (channel: string) =>
      channel === 'ipc-show-open-dialog' ? { filePaths: ['new.ecpanel'] } : 'file contents'
    )
    const context: any = {
      data: { panels },
      id: 'current',
      props: { editIndex: 'current' },
      fileFilters: [],
      window: { electron: { ipcRenderer: { invoke } } },
      t: (key: string) => key,
      panelUsingFile: () => false,
      parsePanelFile: () => ({ name: 'Panel', document: {} }),
      bindPanelFile: (doc: object) => doc,
      cloneDocument: (doc: object) => doc,
      savedDocument: {},
      savedName: {},
      layout: { changeWinName: vi.fn() },
      ElMessage: { error: vi.fn() }
    }
    execute(fn.getText(source), context)
    await context.relinkFile()
    const expected = collision ? 'Panel (3)' : 'Panel'
    expect(panels.current.name).toBe(expected)
    expect(context.savedName.value).toBe(expected)
    expect(context.layout.changeWinName).toHaveBeenCalledWith('pcurrent', expected)
    expect(context.ElMessage.error).not.toHaveBeenCalled()
    expect(invoke.mock.calls.some(([channel]) => channel === 'ipc-fs-writeFile')).toBe(false)
  }
)
