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
    channel === 'ipc-panel-var-values'
      ? (...args) => {
          variableRequests.push(args[2])
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
      const conf = require('conf')
      const Conf = conf.default || conf
      const config = new Conf({ projectName: 'ecubuspro', projectSuffix: '' })
      const hash = (value) =>
        require('node:crypto').createHash('sha256').update(value).digest('hex')
      let filename = path.join(demo, 'HtmlControl.ecb')
      if (process.platform === 'win32') filename = filename.toLowerCase()
      const memoryDirectory = path.join(path.dirname(config.path), 'remembered-variables')
      fs.mkdirSync(memoryDirectory, { recursive: true })
      const memoryFile = path.join(memoryDirectory, hash(filename) + '.json')
      fs.writeFileSync(memoryFile, '{broken')
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
      assert(
        variableRequests.some(
          (variables) =>
            Object.keys(variables).length === 2 && variables.HtmlLevel && variables.HtmlEnabled
        )
      )
      const beforeRead = variableRequests.length
      assert.equal(await frame.executeJavaScript(`window.panel.getVar('HtmlLevel')`), 30)
      assert.equal(variableRequests.length, beforeRead + 1)
      assert.deepEqual(Object.keys(variableRequests.at(-1)), ['HtmlLevel'])
      assert.deepEqual(variableRequests.at(-1).HtmlLevel.value, { type: 'number' })
      checks.push({ name: 'batched-native-restore-and-single-html-read', passed: true })
      const nativeReads = () =>
        variableRequests.filter((variables) => Object.keys(variables).length === 2).length
      const beforeLayout = nativeReads()
      await win.webContents.executeJavaScript(`
        const panelDocument = panelTest.data.panels['html-demo'].document;
        panelDocument.width += 10;
        panelDocument.controls.find(control => control.id === 'load').x += 5;
      `)
      await new Promise((resolve) => setTimeout(resolve, 200))
      assert.equal(nativeReads(), beforeLayout)
      checks.push({ name: 'layout-change-does-not-query-variables', passed: true })
      checks.push({ name: 'html-initial-read-and-script-build', passed: true })
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
      checks.push({ name: 'corrupt-memory-fallback-and-start-lock-release', passed: true })
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
      assert.equal(fs.readFileSync(memoryFile, 'utf8'), '{broken')
      const obsoleteFile = path.join(memoryDirectory, 'f'.repeat(64) + '.json')
      fs.writeFileSync(
        obsoleteFile,
        JSON.stringify({ projectPath: path.join(demo, 'deleted.ecb'), values: {} })
      )
      await win.webContents.executeJavaScript(
        `panelTest.getLayout().addWin('variable','memory-test',{})`
      )
      await waitFor(
        win,
        `Array.from(document.querySelectorAll('button')).some(button => button.textContent.trim() === 'Remembered values')`
      )
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Remembered values').click()`
      )
      await waitFor(
        win,
        `document.querySelector('.el-dialog__body')?.textContent.includes('deleted.ecb')`
      )
      await capture(win, 'remembered-projects')
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('.el-table__row')).find(row => row.textContent.includes('deleted.ecb')).querySelector('.el-checkbox__input').click()`
      )
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Delete selected values').click()`
      )
      await waitFor(win, `!!document.querySelector('.el-message-box__btns .el-button--primary')`)
      await win.webContents.executeJavaScript(
        `document.querySelector('.el-message-box__btns .el-button--primary').click()`
      )
      await waitFor(
        win,
        `!document.querySelector('.el-table__body')?.textContent.includes('deleted.ecb')`
      )
      assert.equal(fs.existsSync(obsoleteFile), false)
      checks.push({ name: 'manual-memory-cleanup', passed: true })
      await win.webContents.executeJavaScript(
        `document.querySelector('.el-dialog__footer button').click()`
      )
      fs.writeFileSync(memoryFile, '{}')
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-control-id="measurement"] .el-button--success').click()`
      )
      await waitHtml(frame, `document.querySelector('#status').textContent === 'Running'`)
      await frame.executeJavaScript(`panel.setVar('HtmlLevel', 73)`)
      assert.equal(await frame.executeJavaScript(`panel.getVar('HtmlLevel')`), 73)
      app.once('will-quit', () => {
        try {
          const persisted = JSON.parse(
            fs.readFileSync(
              path.join(
                path.dirname(config.path),
                'remembered-variables',
                hash(filename) + '.json'
              ),
              'utf8'
            )
          )
          assert.equal(persisted.values[hash('HtmlLevel')], 73)
          checks.push({ name: 'normal-quit-flushes-pending-variable', passed: true })
          finish()
        } catch (error) {
          finish(error)
        }
      })
      app.quit()
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
