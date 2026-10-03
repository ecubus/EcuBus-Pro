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
const variableRequests = []
const handle = ipcMain.handle.bind(ipcMain)
ipcMain.handle = (channel, listener) =>
  handle(
    channel,
    channel === 'ipc-var-values'
      ? (...args) => {
          variableRequests.push(args[1])
          return listener(...args)
        }
      : listener
  )
let started = false
const timeout = setTimeout(() => finish(new Error('Electron smoke test timed out')), 120000)

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

const example = path.resolve(__dirname, '../../resources/examples/panel_html')
const demo = path.join(artifacts, 'demo')
fs.cpSync(example, demo, { recursive: true })
const panelFile = path.join(demo, 'html.ecpanel')
const panelDocument = JSON.parse(fs.readFileSync(panelFile, 'utf8'))
const htmlControl = panelDocument.document.controls.find((control) => control.id === 'html')
htmlControl.htmlContent += '<script>window.inlineScriptRan = true;</script>'
htmlControl.scriptContent =
  'window.separateScriptRan = window.inlineScriptRan === true;\n' + htmlControl.scriptContent
fs.writeFileSync(panelFile, JSON.stringify(panelDocument))

async function waitHtml(frame, expression) {
  for (let i = 0; i < 100; i++) {
    if (await frame.executeJavaScript(expression)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`HTML timed out: ${expression}`)
}
app.on('browser-window-created', (_event, win) => {
  if (started) return
  started = true
  win.webContents.once('did-finish-load', async () => {
    try {
      win.setSize(1400, 1000)
      await connectStores(win)
      await win.webContents.executeJavaScript(
        `panelTest.project.openProjectByPath(${JSON.stringify(path.join(demo, 'HtmlControl.ecb'))})`
      )
      await waitFor(win, `!!document.querySelector('[data-control-id="html"] iframe')`)
      const build = await win.webContents.executeJavaScript(
        `window.electron.ipcRenderer.invoke('ipc-build-project',${JSON.stringify(demo)},'HtmlControl.ecb',JSON.parse(JSON.stringify(panelTest.data.getData())),'ecu.ts',false)`
      )
      assert.deepEqual(build, [])
      const frame = win.webContents.mainFrame.framesInSubtree.find(
        (item) => item.url === 'about:srcdoc'
      )
      assert(frame)
      await waitHtml(frame, `document.querySelector('#level-value').textContent === '30 %'`)
      assert.equal(await frame.executeJavaScript(`window.panel.getVar('HtmlLevel')`), 30)
      assert.equal(variableRequests.length, 0)
      checks.push({ name: 'stopped-reads-use-project-values', passed: true })
      await win.webContents.executeJavaScript(`
        const panelDocument = panelTest.data.panels['html-demo'].document;
        panelDocument.width += 10;
        panelDocument.controls.find(control => control.id === 'load').x += 5;
      `)
      await new Promise((resolve) => setTimeout(resolve, 200))
      assert.equal(variableRequests.length, 0)
      checks.push({ name: 'layout-change-does-not-query-variables', passed: true })
      checks.push({ name: 'html-initial-read-and-script-build', passed: true })
      assert.equal(
        await frame.executeJavaScript('window.inlineScriptRan && window.separateScriptRan'),
        true
      )
      checks.push({ name: 'html-inline-and-separate-scripts', passed: true })
      const originalOpenPath = shell.openPath
      const opened = []
      shell.openPath = async (file) => {
        opened.push(file)
        return ''
      }
      try {
        for (const extension of ['exe', 'bat', 'cmd', 'lnk', 'ps1', 'url', 'html', 'PDF', 'txt']) {
          const target = path.join(artifacts, 'manual.' + extension)
          fs.writeFileSync(target, '')
          const result = await win.webContents.executeJavaScript(
            `window.electron.ipcRenderer.invoke('ipc-panel-open-path', ${JSON.stringify(target)}).then(() => true, () => false)`
          )
          assert.equal(result, extension === 'PDF' || extension === 'txt')
        }
        assert.equal(opened.length, 2)
      } finally {
        shell.openPath = originalOpenPath
      }
      checks.push({ name: 'panel-file-types-checked-before-shell-open', passed: true })

      const startError = await win.webContents.executeJavaScript(`
        window.electron.ipcRenderer.invoke('ipc-global-start', {...panelTest.project.projectInfo},
          {vars:{}, database:{can:null}}).then(() => false, () => true)
      `)
      assert.equal(startError, true)
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="measurement"] .el-button--success').click()`
      )
      await waitHtml(frame, `document.querySelector('#status').textContent === 'Running'`)
      await waitHtml(frame, `document.querySelector('#speed').textContent === '60.0'`)
      checks.push({ name: 'html-can-telemetry', passed: true })
      for (const value of ['[1,2]', 'undefined', 'null', 'true', '{}', 'NaN', 'Infinity']) {
        const rejected = await frame.executeJavaScript(
          `panel.setSignal('HtmlDemo.Target', ${value}).then(() => false, () => true)`
        )
        assert.equal(rejected, true)
        const mainRejected = await win.webContents.executeJavaScript(
          `window.electron.ipcRenderer.invoke('ipc-panel-signal-set', {name:'HtmlDemo.Target', value:${value}}).then(() => false, () => true)`
        )
        assert.equal(mainRejected, true)
      }
      assert.equal(await frame.executeJavaScript(`panel.setSignal('HtmlDemo.Target', 20)`), true)
      checks.push({ name: 'html-signal-validation-and-main-process-acknowledgement', passed: true })

      checks.push({ name: 'start-lock-release-after-failure', passed: true })
      await frame.executeJavaScript(
        `document.querySelector('#level').value = '65'; document.querySelector('#level').dispatchEvent(new Event('change'))`
      )
      await waitFor(
        win,
        `document.querySelector('[data-control-id="load"]').textContent.includes('65%')`
      )
      await waitHtml(frame, `document.querySelector('#speed').textContent === '130.0'`)
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="enabled"] .el-switch').click()`
      )
      await waitHtml(
        frame,
        `!document.querySelector('#enabled').checked && document.querySelector('#speed').textContent === '0.0'`
      )
      await frame.executeJavaScript(`document.querySelector('#enabled').click()`)
      await waitHtml(frame, `document.querySelector('#speed').textContent === '130.0'`)
      checks.push({ name: 'html-and-native-controls-bidirectional', passed: true })
      await win.webContents.executeJavaScript(
        `window.electron.ipcRenderer.send('ipc-send-can-period','html-command-0',JSON.parse(JSON.stringify(panelTest.data.ia['html-command'].action[0])))`
      )
      await frame.executeJavaScript(
        `document.querySelector('#target').value='45';document.querySelector('#send').click()`
      )
      await waitHtml(
        frame,
        `document.querySelector('#received').textContent === '45 %' && Number(document.querySelector('#count').textContent) > 0`
      )
      await waitHtml(frame, `document.querySelector('#speed').textContent === '90.0'`)
      checks.push({ name: 'html-physical-signal-write-and-ecu-receive', passed: true })
      await capture(win, 'html-control')
      await frame.executeJavaScript(`document.querySelector('#listen').click()`)
      await waitHtml(frame, `document.querySelector('#listen').textContent === 'Subscribe'`)
      const count = await frame.executeJavaScript(`document.querySelector('#count').textContent`)
      await new Promise((resolve) => setTimeout(resolve, 350))
      assert.equal(
        await frame.executeJavaScript(`document.querySelector('#count').textContent`),
        count
      )
      await frame.executeJavaScript(`panel.setSignal('HtmlDemo.Target', '70')`)
      await waitHtml(frame, `panel.getVar('HtmlLevel').then(value => value === 70)`)
      await waitHtml(
        frame,
        `panel.getSignal('HtmlDemo.Speed').then(signal => Number(signal.physicalValue) === 140)`
      )
      const freshSignal = await frame.executeJavaScript(`panel.getSignal('HtmlDemo.Speed')`)
      assert.equal(Number(freshSignal.rawValue), 1400)
      checks.push({ name: 'html-signal-read-updates-without-subscription', passed: true })
      await frame.executeJavaScript(`document.querySelector('#read').click()`)
      await waitHtml(
        frame,
        `Number(document.querySelector('#count').textContent) > ${Number(count)}`
      )
      await frame.executeJavaScript(`document.querySelector('#listen').click()`)
      await waitHtml(frame, `document.querySelector('#listen').textContent === 'Unsubscribe'`)
      checks.push({ name: 'html-unsubscribe-read-and-resubscribe', passed: true })
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="measurement"] .el-button--danger').click()`
      )
      await waitHtml(frame, `document.querySelector('#status').textContent === 'Stopped'`)
      assert.equal(
        await frame.executeJavaScript(
          `panel.setVar('HtmlLevel', 88).then(() => 'unexpected', error => error.message)`
        ),
        'Panel is stopped'
      )
      assert.equal(
        await frame.executeJavaScript(
          `panel.setSignal('HtmlDemo.Target', '88').then(() => 'unexpected', error => error.message)`
        ),
        'Panel is stopped'
      )
      checks.push({ name: 'html-stopped-writes-rejected', passed: true })
      await waitFor(
        win,
        `panelTest.data.vars.HtmlLevel.value.value === 70 && panelTest.project.projectDirty`
      )
      checks.push({ name: 'stop-writes-panel-value-to-project', passed: true })
      const start = async () => {
        await win.webContents.executeJavaScript(
          `document.querySelector('[data-control-id="measurement"] .el-button--success').click()`
        )
        await waitHtml(frame, `document.querySelector('#status').textContent === 'Running'`)
      }
      const stop = async () => {
        await win.webContents.executeJavaScript(
          `document.querySelector('[data-control-id="measurement"] .el-button--danger').click()`
        )
        await waitHtml(frame, `document.querySelector('#status').textContent === 'Stopped'`)
      }
      await start()
      const beforeRunningRead = variableRequests.length
      assert.equal(await frame.executeJavaScript(`panel.getVar('HtmlLevel')`), 70)
      assert(
        variableRequests
          .slice(beforeRunningRead)
          .some((ids) => JSON.stringify(ids) === '["HtmlLevel"]')
      )
      checks.push({ name: 'restart-uses-project-value', passed: true })
      await stop()
      await win.webContents.executeJavaScript(`
        const levelControl = panelTest.data.panels['html-demo'].document.controls.find(control => control.id === 'level');
        levelControl.rememberValue = false;
        levelControl.initialValue = 12;
      `)
      await start()
      assert.equal(await frame.executeJavaScript(`panel.getVar('HtmlLevel')`), 12)
      await stop()
      await new Promise((resolve) => setTimeout(resolve, 300))
      assert.equal(
        await win.webContents.executeJavaScript(`panelTest.data.vars.HtmlLevel.value.value`),
        70
      )
      checks.push({ name: 'remember-off-starts-from-control-initial-value', passed: true })
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
