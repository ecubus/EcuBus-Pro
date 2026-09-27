const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')

const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'ecubus-panel-electron-'))
require('./smoke-console.cjs')(artifacts)
for (const key of ['APPDATA', 'LOCALAPPDATA']) {
  process.env[key] = path.join(artifacts, key)
  fs.mkdirSync(process.env[key], { recursive: true })
}
delete process.env.ELECTRON_RENDERER_URL
process.env.NODE_ENV = 'production'
app.setPath('userData', path.join(artifacts, 'profile'))
const projectFile = path.join(artifacts, 'panel.ecb')
dialog.showSaveDialog = async (...args) => ({
  canceled: false,
  filePath: path.join(artifacts, path.basename(args.at(-1).defaultPath || 'Panel.ecpanel'))
})
const checks = []
let started = false
const timeout = setTimeout(() => finish(new Error('Electron smoke test timed out')), 90000)

let finished = false
function finish(error) {
  if (finished) return
  finished = true
  clearTimeout(timeout)
  try {
    fs.writeFileSync(
      path.join(artifacts, 'result.json'),
      JSON.stringify(
        {
          artifacts,
          checks,
          error: error ? String(error.stack || error) : null
        },
        null,
        2
      )
    )
    console.log(JSON.stringify({ artifacts, checks, error: error ? String(error) : null }))
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.closeDevTools()
      win.destroy()
    }
  } finally {
    app.exit(error ? 1 : 0)
  }
}

async function waitFor(win, expression) {
  for (let i = 0; i < 100; i++) {
    if (await win.webContents.executeJavaScript(expression)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${expression}`)
}

async function connectStores(win) {
  await waitFor(
    win,
    `!!document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia`
  )
  await win.webContents.executeJavaScript(`
    window.panelTest = {};
    panelTest.pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    panelTest.project = panelTest.pinia._s.get('project');
    panelTest.data = panelTest.pinia._s.get('useDataStore');
    panelTest.findLayout = function visit(vnode) {
      if (!vnode) return null;
      if (vnode.component?.provides?.layout) return vnode.component.provides.layout;
      const nested = visit(vnode.component?.subTree);
      if (nested) return nested;
      for (const child of Array.isArray(vnode.children) ? vnode.children : []) {
        const found = visit(child);
        if (found) return found;
      }
      return null;
    };
    panelTest.getLayout = () => panelTest.findLayout(document.querySelector('#app').__vue_app__._container._vnode);
    void 0;
  `)
}

async function capture(win, name) {
  await win.webContents.executeJavaScript(
    `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`
  )
  await new Promise((resolve) => setTimeout(resolve, 200))
  const screenshot = await win.webContents.capturePage()
  assert(!screenshot.isEmpty())
  fs.writeFileSync(path.join(artifacts, name + '.png'), screenshot.toPNG())
}

const examples = [
  'can/Can',
  'canopen_pdo/canopen_pdo',
  'lin_aa/lin_aa',
  'panel/panel',
  'script_demo_2/script_demo_2',
  'uds_bin_file/uds_bin_file'
]
app.on('browser-window-created', (_event, win) => {
  if (started) return
  started = true
  win.webContents.once('did-finish-load', async () => {
    try {
      win.setSize(1300, 900)
      await connectStores(win)
      for (const name of examples) {
        const source = path.resolve(__dirname, '../../resources/examples', name + '.ecb')
        const config = JSON.parse(fs.readFileSync(source, 'utf8'))
        const [id, panel] = Object.entries(config.data.panels)[0]
        const target = path.join(artifacts, name.replaceAll('/', '-') + '.ecb')
        const panelTarget = path.join(artifacts, path.basename(panel.filePath))
        fs.copyFileSync(path.join(path.dirname(source), panel.filePath), panelTarget)
        panel.filePath = path.basename(panelTarget)
        // The old Program example contains an unsupported legacy DBC unrelated to its variable-only panel.
        config.data.database.can = Object.fromEntries(
          Object.entries(config.data.database.can || {}).filter(
            ([, db]) => db.version === 'canmartix'
          )
        )
        config.project.wins = {
          ['p' + id]: {
            id: 'p' + id,
            title: 'panelPreview',
            label: panel.name,
            pos: { x: 0, y: 0, w: 920, h: 510 },
            options: { name: panel.name, params: { 'edit-index': 'p' + id } }
          }
        }
        fs.writeFileSync(target, JSON.stringify(config))
        await win.webContents.executeJavaScript(
          `panelTest.project.projectDirty=false;panelTest.project.openProjectByPath(${JSON.stringify(target)})`
        )
        await waitFor(
          win,
          `!!document.querySelector(${JSON.stringify('#winp' + id + ' .free-panel-runtime')})`
        )
        assert.equal(
          await win.webContents.executeJavaScript(
            `panelTest.data.panels[${JSON.stringify(id)}].fileError || ''`
          ),
          ''
        )
        assert.equal(
          await win.webContents.executeJavaScript(
            `document.querySelector(${JSON.stringify('#winp' + id + ' .runtime-status')}).textContent.includes('issues')`
          ),
          false
        )
        const count = JSON.parse(fs.readFileSync(panelTarget, 'utf8')).document.controls.length
        assert.equal(
          await win.webContents.executeJavaScript(
            `document.querySelectorAll(${JSON.stringify('#winp' + id + ' [data-control-id]')}).length`
          ),
          count
        )
        await capture(win, 'migrated-' + path.basename(name))
        checks.push({ name: 'migrated-' + name, passed: true })
      }
      finish()
    } catch (error) {
      await capture(win, 'failure').catch(() => {})
      finish(error)
    }
  })
})
require(
  path.resolve(
    process.env.PANEL_SMOKE_BUILD_DIR || path.join(__dirname, '../../out'),
    'main/index.js'
  )
)
