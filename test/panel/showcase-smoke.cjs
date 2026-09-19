const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')

const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'ecubus-panel-electron-'))
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

function finish(error) {
  clearTimeout(timeout)
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
  app.exit(error ? 1 : 0)
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

const example = path.resolve(__dirname, '../../resources/examples/panel_showcase')
const demo = path.join(artifacts, 'demo')
fs.cpSync(example, demo, { recursive: true })
async function editInput(win, selector, value) {
  await win.webContents.executeJavaScript(
    `(() => {const el=document.querySelector(${JSON.stringify(selector)});el.focus();el.select()})()`
  )
  await win.webContents.insertText(value)
  await win.webContents.executeJavaScript(
    `document.querySelector(${JSON.stringify(selector)}).blur()`
  )
}
app.on('browser-window-created', (_event, win) => {
  if (started) return
  started = true
  win.webContents.once('did-finish-load', async () => {
    try {
      win.setSize(1500, 1100)
      await connectStores(win)
      await win.webContents.executeJavaScript(
        `panelTest.project.openProjectByPath(${JSON.stringify(path.join(demo, 'PanelShowcase.ecb'))})`
      )
      await waitFor(win, `!!document.querySelector('[data-control-id="measurement"]')`)
      const build = await win.webContents.executeJavaScript(
        `window.electron.ipcRenderer.invoke('ipc-build-project',${JSON.stringify(demo)},'PanelShowcase.ecb',JSON.parse(JSON.stringify(panelTest.data.getData())),'simulation.ts',false)`
      )
      assert.deepEqual(build, [])
      checks.push({ name: 'compile-demo-script', passed: true })
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="measurement"] .el-button--success').click()`
      )
      await waitFor(
        win,
        `document.querySelector('[data-control-id="physical-speed"] strong').textContent!=='—'`
      )
      await waitFor(
        win,
        `document.querySelector('[data-control-id="progress"] .panel-digital')?.textContent !== '0%'`
      )
      const speed = await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="physical-speed"] strong').textContent`
      )
      assert(Number.isFinite(Number(speed)))
      checks.push({ name: 'simulated-can-telemetry', passed: true, speed })
      await waitFor(
        win,
        `document.querySelector('[data-control-id="auto"] .el-switch').classList.contains('is-checked')`
      )
      await capture(win, 'showcase-overview')
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="auto"] .el-switch').click()`
      )
      await editInput(win, '[data-control-id="target"] input', '25')
      await editInput(win, '[data-control-id="level-input"] input', '50')
      await waitFor(
        win,
        `Number(document.querySelector('[data-control-id="physical-speed"] strong').textContent) >= 80`
      )
      checks.push({ name: 'dbc-physical-target-and-variable-input', passed: true })
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="pulse"] button').dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true}));document.querySelector('[data-control-id="pulse"] button').dispatchEvent(new PointerEvent('pointerup',{button:0,bubbles:true}))`
      )
      await waitFor(
        win,
        `document.querySelector('[data-control-id="count"] strong').textContent==='1'`
      )
      checks.push({ name: 'momentary-button-counter', passed: true })
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="enable"] input').click()`
      )
      await waitFor(
        win,
        `document.querySelector('[data-control-id="physical-speed"] strong').textContent==='0.0'`
      )
      checks.push({ name: 'disable-motor-zero-speed', passed: true })
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('.container-tabs button')).find(el=>el.textContent.includes('02')).click()`
      )
      await waitFor(
        win,
        `document.querySelector('[data-control-id="text-editor"] textarea')?.value.includes('48 65')`
      )
      await editInput(win, '[data-control-id="hex"] input', '0xFF')
      await waitFor(
        win,
        `document.querySelector('[data-control-id="decimal"] strong').textContent==='255'`
      )
      await editInput(win, '[data-control-id="byte-editor"] textarea', '41 42 43')
      await waitFor(
        win,
        `document.querySelectorAll('[data-control-id="byte-editor"] textarea')[1].value==='ABC'`
      )
      await editInput(win, '[data-control-id="text-editor"] textarea:nth-of-type(1)', '44 65 6D 6F')
      await waitFor(
        win,
        `document.querySelectorAll('[data-control-id="text-editor"] textarea')[1].value==='Demo'`
      )
      checks.push({ name: 'hex-binary-text-and-byte-editors', passed: true })
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path.join(demo, 'PanelDemo.dbc')]
      })
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="path-file"] button').click()`
      )
      await waitFor(
        win,
        `document.querySelector('[data-control-id="path-file"] input').value.endsWith('PanelDemo.dbc')`
      )
      assert.equal(
        await win.webContents.executeJavaScript(
          `document.querySelector('[data-control-id="path-directory"] input').value`
        ),
        ''
      )
      let opened
      shell.openPath = async (target) => {
        opened = target
        return ''
      }
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="open-guide"] button').click()`
      )
      assert.equal(opened, path.join(demo, 'DEMO.md'))
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="open-detail"] button').click()`
      )
      await waitFor(win, `!!document.querySelector('#winpdemo-detail')`)
      await win.webContents.executeJavaScript(
        `panelTest.getLayout().removeWin('pdemo-detail',true)`
      )
      checks.push({ name: 'path-and-file-panel-actions', passed: true })
      await capture(win, 'showcase-inputs')
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('.container-tabs button')).find(el=>el.textContent.includes('03')).click()`
      )
      await waitFor(win, `document.querySelector('[data-control-id="shape-circle"] button')`)
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="shape-circle"] button').click()`
      )
      await waitFor(
        win,
        `document.querySelector('[data-control-id="led-up"] path').getAttribute('fill')==='#22c55e'`
      )
      await waitFor(win, `document.querySelector('[data-control-id="image"] img').naturalWidth>0`)
      checks.push({ name: 'toggle-led-shapes-and-image', passed: true })
      await capture(win, 'showcase-appearance')
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="measurement"] .el-button--danger').click()`
      )
      await waitFor(
        win,
        `document.querySelector('.runtime-status').textContent.includes('Stopped')`
      )
      checks.push({ name: 'stop-simulation', passed: true })
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
