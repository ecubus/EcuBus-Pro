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

app.on('browser-window-created', (_event, win) => {
  if (started) return
  started = true
  win.webContents.once('did-finish-load', async () => {
    try {
      await connectStores(win)
      win.setSize(1400, 900)
      await win.webContents.executeJavaScript(`panelTest.project.createNewProject()`)
      await waitFor(win, `!!panelTest.getLayout()`)
      await win.webContents.executeJavaScript(`panelTest.getLayout().removeWin('message', true)`)
      await win.webContents.executeJavaScript(
        `panelTest.getLayout().addWin('panel', 'smoke-panel', {params:{'edit-index':'smoke-panel'}})`
      )
      await waitFor(win, `document.querySelectorAll('.panel-palette button').length === 19`)
      await capture(win, 'editor-windowed')
      await win.webContents.executeJavaScript(
        `panelTest.project.project.wins['smoke-panel'].pos.x=20; panelTest.project.project.wins['smoke-panel'].pos.y=20`
      )
      await capture(win, 'editor-before-resize')
      await win.webContents.executeJavaScript(
        `panelTest.project.project.wins['smoke-panel'] = JSON.parse(JSON.stringify(panelTest.project.project.wins['smoke-panel']))`
      )
      const handle = await win.webContents.executeJavaScript(
        `(() => {const r=document.querySelector('#winsmoke-panel .ui-resizable-se').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`
      )
      win.focus()
      win.webContents.sendInputEvent({ type: 'mouseMove', ...handle })
      win.webContents.sendInputEvent({
        type: 'mouseDown',
        ...handle,
        button: 'left',
        clickCount: 1
      })
      await new Promise((resolve) => setTimeout(resolve, 100))
      win.webContents.sendInputEvent({
        type: 'mouseMove',
        x: handle.x + 280,
        y: handle.y + 20,
        modifiers: ['leftButtonDown']
      })
      await new Promise((resolve) => setTimeout(resolve, 100))
      win.webContents.sendInputEvent({
        type: 'mouseUp',
        x: handle.x + 280,
        y: handle.y + 20,
        button: 'left',
        clickCount: 1
      })
      await capture(win, 'editor-resized')
      const resized = await win.webContents.executeJavaScript(`(() => {
        const rect = selector => {const r=document.querySelector(selector).getBoundingClientRect();return {width:r.width,height:r.height}};
        return {pos:{...panelTest.project.project.wins['smoke-panel'].pos},window:rect('#winsmoke-panel'),title:rect('#winsmoke-panel .titleBar'),editor:rect('.free-panel-editor')};
      })()`)
      assert(resized.pos.w > 800)
      assert(Math.abs(resized.window.width - resized.pos.w) < 2)
      assert(Math.abs(resized.title.width - resized.window.width) < 2)
      assert(Math.abs(resized.editor.width - resized.window.width) < 2)
      assert(Math.abs(resized.editor.height - (resized.pos.h - 30)) < 2)
      checks.push({ name: 'window-resize-after-state-replacement', passed: true })
      const title = await win.webContents.executeJavaScript(
        `(() => {const r=document.querySelector('#winsmoke-panel .uds-draggable').getBoundingClientRect();return {x:Math.round(r.x+80),y:Math.round(r.y+r.height/2)}})()`
      )
      win.webContents.sendInputEvent({ type: 'mouseMove', ...title })
      win.webContents.sendInputEvent({ type: 'mouseDown', ...title, button: 'left', clickCount: 1 })
      await new Promise((resolve) => setTimeout(resolve, 100))
      win.webContents.sendInputEvent({
        type: 'mouseMove',
        x: title.x + 20,
        y: title.y + 20,
        modifiers: ['leftButtonDown']
      })
      await new Promise((resolve) => setTimeout(resolve, 100))
      win.webContents.sendInputEvent({
        type: 'mouseUp',
        x: title.x + 20,
        y: title.y + 20,
        button: 'left',
        clickCount: 1
      })
      await waitFor(
        win,
        `Math.abs(panelTest.project.project.wins['smoke-panel'].pos.x - ${resized.pos.x + 20}) < 2`
      )
      const moved = await win.webContents.executeJavaScript(
        `({...panelTest.project.project.wins['smoke-panel'].pos})`
      )
      assert(
        Math.abs(moved.x - (resized.pos.x + 20)) < 2,
        JSON.stringify({ moved, resized: resized.pos, title })
      )
      assert(
        Math.abs(moved.y - (resized.pos.y + 20)) < 2,
        JSON.stringify({ moved, resized: resized.pos, title })
      )
      checks.push({ name: 'window-drag-after-state-replacement', passed: true })
      await win.webContents.executeJavaScript(`panelTest.getLayout().maxWin('smoke-panel')`)
      await capture(win, 'editor-maximized')
      await win.webContents.executeJavaScript(`panelTest.getLayout().maxWin('smoke-panel')`)
      await capture(win, 'editor-restored')
      const restoredWidth = await win.webContents.executeJavaScript(
        `document.querySelector('#winsmoke-panel .titleBar').getBoundingClientRect().width`
      )
      assert(Math.abs(restoredWidth - moved.w) < 2)
      checks.push({ name: 'window-maximize-and-restore', passed: true })
      await win.webContents.executeJavaScript(`panelTest.getLayout().maxWin('smoke-panel')`)
      for (const [index, side, delta] of [
        [0, 'left', 48],
        [1, 'right', -48]
      ]) {
        await capture(win, `before-${side}-sidebar-resize`)
        const before = await win.webContents.executeJavaScript(
          `Number(document.querySelectorAll('.panel-splitter')[${index}].getAttribute('aria-valuenow'))`
        )
        const point = await win.webContents.executeJavaScript(
          `(() => {const r=document.querySelectorAll('.panel-splitter')[${index}].getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+80)}})()`
        )
        win.webContents.sendInputEvent({ type: 'mouseMove', ...point })
        win.webContents.sendInputEvent({
          type: 'mouseDown',
          ...point,
          button: 'left',
          clickCount: 1
        })
        win.webContents.sendInputEvent({
          type: 'mouseMove',
          x: point.x + delta,
          y: point.y,
          button: 'left'
        })
        win.webContents.sendInputEvent({
          type: 'mouseUp',
          x: point.x + delta,
          y: point.y,
          button: 'left',
          clickCount: 1
        })
        await waitFor(
          win,
          `Number(document.querySelectorAll('.panel-splitter')[${index}].getAttribute('aria-valuenow')) === ${before + 48}`
        )
        assert.equal(
          await win.webContents.executeJavaScript(
            `Math.round(document.querySelector('.${side === 'left' ? 'panel-library' : 'panel-inspector'}').getBoundingClientRect().width)`
          ),
          before + 48
        )
      }
      checks.push({ name: 'resize-both-editor-sidebars', passed: true })
      await win.webContents.executeJavaScript(
        `document.querySelector('.panel-status .el-select').click()`
      )
      await waitFor(
        win,
        `Array.from(document.querySelectorAll('.el-select-dropdown__item')).some(el=>el.textContent.trim()==='50%')`
      )
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('.el-select-dropdown__item')).find(el=>el.textContent.trim()==='50%').click()`
      )

      await waitFor(win, `document.querySelector('.panel-stage').style.transform === 'scale(0.5)'`)
      await capture(win, 'canvas-before-drag')
      const canvasHandle = await win.webContents.executeJavaScript(
        `(() => {const r=document.querySelector('.canvas-resize-se').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`
      )
      win.webContents.sendInputEvent({ type: 'mouseMove', ...canvasHandle })
      win.webContents.sendInputEvent({
        type: 'mouseDown',
        ...canvasHandle,
        button: 'left',
        clickCount: 1
      })
      await new Promise((resolve) => setTimeout(resolve, 60))
      win.webContents.sendInputEvent({
        type: 'mouseMove',
        x: canvasHandle.x + 80,
        y: canvasHandle.y + 40,
        button: 'left'
      })
      win.webContents.sendInputEvent({
        type: 'mouseUp',
        x: canvasHandle.x + 80,
        y: canvasHandle.y + 40,
        button: 'left',
        clickCount: 1
      })
      await waitFor(
        win,
        `document.querySelector('.panel-canvas-heading').textContent.includes('960 × 560')`
      )
      await win.webContents.executeJavaScript(
        `document.querySelectorAll('.panel-toolbar button')[1].click()`
      )
      await waitFor(
        win,
        `document.querySelector('.panel-canvas-heading').textContent.includes('800 × 480')`
      )
      await win.webContents.executeJavaScript(
        `document.querySelectorAll('.panel-toolbar button')[2].click()`
      )
      await waitFor(
        win,
        `document.querySelector('.panel-canvas-heading').textContent.includes('960 × 560')`
      )
      await capture(win, 'canvas-resized')
      const edgeHandle = await win.webContents.executeJavaScript(
        `(() => {const r=document.querySelector('.canvas-resize-e').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`
      )
      win.webContents.sendInputEvent({ type: 'mouseMove', ...edgeHandle })
      win.webContents.sendInputEvent({
        type: 'mouseDown',
        ...edgeHandle,
        button: 'left',
        clickCount: 1
      })
      win.webContents.sendInputEvent({
        type: 'mouseMove',
        x: edgeHandle.x - 40,
        y: edgeHandle.y,
        button: 'left'
      })
      await waitFor(
        win,
        `document.querySelector('.panel-canvas-heading').textContent.includes('880 × 560')`
      )
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
      win.webContents.sendInputEvent({
        type: 'mouseUp',
        x: edgeHandle.x - 40,
        y: edgeHandle.y,
        button: 'left',
        clickCount: 1
      })
      await waitFor(
        win,
        `document.querySelector('.panel-canvas-heading').textContent.includes('960 × 560')`
      )
      await win.webContents.executeJavaScript(
        `document.querySelector('.panel-status .el-select').click()`
      )
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('.el-select-dropdown__item')).find(el=>el.textContent.trim()==='100%').click()`
      )
      checks.push({ name: 'canvas-drag-at-half-zoom-and-undo-redo', passed: true })
      await win.webContents.executeJavaScript(
        `document.querySelectorAll('.panel-palette button')[1].click()`
      )
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('.panel-palette button')).find(b=>b.textContent.trim().endsWith('Button')).click()`
      )
      await win.webContents.executeJavaScript(
        `document.querySelector('.panel-toolbar button').click()`
      )
      await waitFor(win, `panelTest.data.panels['smoke-panel']?.document.controls.length === 2`)
      checks.push({ name: 'editor-add-and-save', passed: true })
      await capture(win, 'editor')
      await win.webContents.executeJavaScript(`(async () => {
        panelTest.data.vars.level = {id:'level', name:'Level', type:'user', value:{type:'number', min:0, max:100, initValue:0}};
        const controls = panelTest.data.panels['smoke-panel'].document.controls;
        controls.forEach((c, i) => {
          c.x = 32; c.y = 32 + i * 100;
          c.binding = {kind:'variable', node:{id:'level', name:'Level', type:'variable', enable:true, color:'', bindValue:{variableId:'level', variableType:'user', variableName:'Level', variableFullName:'Level', variableValueType:'number'}}};
        });
        await window.electron.ipcRenderer.invoke('ipc-fs-writeFile',panelTest.data.panels['smoke-panel'].filePath,JSON.stringify({format:'ecubus-panel',version:1,name:panelTest.data.panels['smoke-panel'].name,document:panelTest.data.panels['smoke-panel'].document}));
        panelTest.project.projectInfo = ${JSON.stringify({ name: 'panel.ecb', path: artifacts })};
        await panelTest.project.saveProject();
      })()`)
      await waitFor(win, `!panelTest.project.projectDirty`)
      const saved = JSON.parse(fs.readFileSync(projectFile, 'utf8'))
      assert.equal(saved.data.panels['smoke-panel'].document, undefined)
      assert.equal(
        JSON.parse(
          fs.readFileSync(path.join(artifacts, saved.data.panels['smoke-panel'].filePath), 'utf8')
        ).document.controls.length,
        2
      )
      assert.equal(saved.project.wins['smoke-panel'].options.params['edit-index'], 'smoke-panel')
      checks.push({ name: 'real-ipc-save', passed: true })
      await win.webContents.executeJavaScript(`panelTest.project.closeProject()`)
      await new Promise((resolve) => {
        win.webContents.once('did-finish-load', resolve)
        win.reload()
      })
      await connectStores(win)
      await win.webContents.executeJavaScript(
        `panelTest.project.openProjectByPath(${JSON.stringify(projectFile)})`
      )
      await waitFor(win, `!!document.querySelector('.free-panel-editor')`)
      const restoredPanel = await win.webContents.executeJavaScript(
        `JSON.parse(JSON.stringify(panelTest.data.panels['smoke-panel']))`
      )
      assert.equal(
        restoredPanel.filePath,
        path.join(artifacts, saved.data.panels['smoke-panel'].filePath)
      )
      assert.equal(restoredPanel.document.controls.length, 2)
      assert(
        restoredPanel.document.controls.every(
          (c) => c.binding.node.bindValue.variableId === 'level'
        )
      )
      checks.push({ name: 'reload-and-restore-editor', passed: true })
      await capture(win, 'restored-editor')
      await win.webContents.executeJavaScript(
        `panelTest.getLayout().addWin('panelPreview', 'psmoke-panel', {params:{'edit-index':'psmoke-panel'}})`
      )
      await waitFor(win, `!!document.querySelector('.free-panel-runtime')`)
      await win.webContents.executeJavaScript(`panelTest.getLayout().maxWin('psmoke-panel')`)
      await win.webContents.executeJavaScript(`panelTest.data.globalRun('start')`)
      await waitFor(win, `document.querySelector('.runtime-status')?.innerText.includes('Running')`)
      await win.webContents.executeJavaScript(
        `window.logBus.emit('level', {key:'level', values:[[0,{rawValue:42}]]})`
      )
      await waitFor(
        win,
        `document.querySelector('.free-panel-runtime .panel-reading strong')?.textContent === '42'`
      )
      await capture(win, 'runtime')
      const writes = []
      const listener = (event, payload) => {
        if (event.sender === win.webContents) writes.push(payload)
      }
      ipcMain.on('ipc-var-set', listener)
      await win.webContents.executeJavaScript(`
        const button = document.querySelector('.free-panel-runtime .panel-action');
        button.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, button:0}));
        button.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, button:0}));
      `)
      for (let i = 0; i < 50 && writes.length < 2; i++)
        await new Promise((resolve) => setTimeout(resolve, 100))
      ipcMain.off('ipc-var-set', listener)
      assert.deepEqual(writes, [
        { name: 'Level', value: 1 },
        { name: 'Level', value: 0 }
      ])
      checks.push({ name: 'runtime-sample-and-button-ipc', passed: true, writes })
      await win.webContents.executeJavaScript(`panelTest.getLayout().maxWin('psmoke-panel')`)
      await win.webContents.executeJavaScript(`panelTest.getLayout().externalWin('psmoke-panel')`)
      let external
      for (let i = 0; i < 100; i++) {
        external = BrowserWindow.getAllWindows().find(
          (w) => w !== win && !w.webContents.getURL().startsWith('devtools:')
        )
        if (external && !external.webContents.isLoading()) break
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      assert(external)
      await waitFor(external, `!!document.querySelector('.free-panel-runtime')`)
      external.webContents.closeDevTools()
      await external.webContents.executeJavaScript(
        `window.logBus.emit('level', {key:'level', values:[[0,{rawValue:42}]]})`
      )
      await waitFor(
        external,
        `document.querySelector('.panel-reading strong')?.textContent === '42'`
      )
      await capture(external, 'external-runtime')
      checks.push({ name: 'external-window', passed: true })
      await win.webContents.executeJavaScript(`panelTest.data.globalRun('stop')`)
      await waitFor(
        external,
        `document.querySelector('.runtime-status')?.innerText.includes('Stopped')`
      )
      await external.webContents.executeJavaScript(
        `window.logBus.emit('level', {key:'level', values:[[0,{rawValue:99}]]})`
      )
      assert.equal(
        await external.webContents.executeJavaScript(
          `document.querySelector('.panel-reading strong')?.textContent`
        ),
        '—'
      )
      checks.push({ name: 'stop-disconnects-external-runtime', passed: true })
      const legacy = {
        id: 'legacy-smoke',
        name: 'Legacy',
        options: { formName: 'Legacy' },
        rule: [
          { type: 'TText', field: 'caption', props: { initValue: 'Legacy caption' } },
          {
            type: 'slider',
            field: 'level',
            title: 'Level',
            value: 25,
            props: { min: 0, max: 100 }
          },
          { type: 'input', field: 'unsupported', title: 'Unsupported' }
        ]
      }
      await win.webContents.executeJavaScript(`
        panelTest.data.panels['legacy-smoke'] = ${JSON.stringify(legacy)};
        panelTest.getLayout().addWin('panel', 'legacy-smoke', {params:{'edit-index':'legacy-smoke'}});
      `)
      await waitFor(win, `!!document.querySelector('.migration-button')`)
      await win.webContents.executeJavaScript(`panelTest.getLayout().maxWin('legacy-smoke')`)
      await capture(win, 'legacy-editor')
      await win.webContents.executeJavaScript(`document.querySelector('.migration-button').click()`)
      await waitFor(
        win,
        `document.querySelector('#winlegacy-smoke .el-dialog__body')?.textContent.includes('Unsupported')`
      )
      await capture(win, 'migration-report')
      await win.webContents.executeJavaScript(
        `document.querySelector('#winlegacy-smoke .el-dialog__footer .el-button--primary').click()`
      )
      await waitFor(
        win,
        `Object.values(panelTest.data.panels).some(p => p.name === 'Legacy (V2 1)')`
      )
      const panels = await win.webContents.executeJavaScript(
        `JSON.parse(JSON.stringify(panelTest.data.panels))`
      )
      assert.deepEqual(panels['legacy-smoke'], legacy)
      const copy = Object.values(panels).find((p) => p.name === 'Legacy (V2 1)')
      assert.equal(copy.document.controls.length, 2)
      assert.equal(copy.document.controls[0].label, 'Legacy caption')
      assert.equal(copy.document.controls[1].initialValue, 25)
      await win.webContents.executeJavaScript(
        `panelTest.getLayout().maxWin(${JSON.stringify(copy.id)})`
      )
      await capture(win, 'migration-copy')
      await win.webContents.executeJavaScript(`panelTest.project.saveProject()`)
      await waitFor(win, `!panelTest.project.projectDirty`)
      const migratedFile = JSON.parse(fs.readFileSync(projectFile, 'utf8'))
      assert.deepEqual(migratedFile.data.panels['legacy-smoke'], legacy)
      assert.equal(migratedFile.data.panels[copy.id].document, undefined)
      assert.equal(JSON.parse(fs.readFileSync(copy.filePath, 'utf8')).document.controls.length, 2)
      checks.push({ name: 'legacy-migration-report-copy-and-persistence', passed: true })
      await win.webContents.executeJavaScript(`
        const base = JSON.parse(JSON.stringify(panelTest.data.panels['smoke-panel'].document.controls[0]));
        const examples = [
          {id:'progress-right',label:'Current',x:32,y:32,width:300,height:80,unit:'A',progressDecimals:1},
          {id:'progress-left',label:'Charge',x:32,y:132,width:300,height:80,progressDirection:'left',progressText:'percent',progressDecimals:0},
          {id:'progress-up',label:'Level',x:380,y:32,width:130,height:280,progressDirection:'up'},
          {id:'progress-down',label:'Level',x:550,y:32,width:130,height:280,progressDirection:'down',progressText:'hidden'},
          {id:'progress-origin',label:'Torque',x:32,y:232,width:300,height:80,min:-100,max:100,progressOrigin:0,unit:'Nm'},
          {id:'button-rectangle',type:'button',label:'Rectangle',x:32,y:340,width:160,height:100,buttonShape:'rectangle'},
          {id:'button-rounded',type:'button',label:'Rounded',x:220,y:340,width:160,height:100,buttonShape:'rounded'},
          {id:'button-circle',type:'button',label:'Start',x:420,y:340,width:160,height:100,buttonShape:'circle'}
        ];
        panelTest.data.panels.progress = {id:'progress',name:'Progress',rule:[],options:{},document:{schemaVersion:2,width:760,height:480,controls:examples.map(example=>({...base,type:'progress',progressShowLimits:true,...example}))}};
        panelTest.getLayout().addWin('panelPreview','pprogress',{params:{'edit-index':'pprogress'}});
      `)
      await waitFor(win, `document.querySelectorAll('#winpprogress .panel-progress').length === 5`)
      await win.webContents.executeJavaScript(
        `panelTest.getLayout().maxWin('pprogress'); panelTest.data.globalRun('start')`
      )
      await waitFor(
        win,
        `document.querySelector('#winpprogress .runtime-status')?.innerText.includes('Running')`
      )
      await win.webContents.executeJavaScript(
        `window.logBus.emit('level',{key:'level',values:[[0,{rawValue:42}]]})`
      )
      await waitFor(
        win,
        `document.querySelector('#winpprogress [aria-label="Current"]')?.getAttribute('aria-valuetext') === '42.0 A'`
      )
      await capture(win, 'progress-light')
      const progressStyles = await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('#winpprogress .panel-progress-track > div')).map(e=>e.getAttribute('style'))`
      )
      assert(progressStyles[0].includes('width: 42%'))
      assert(progressStyles[1].includes('right: 0%'))
      assert(progressStyles[2].includes('bottom: 0%') && progressStyles[2].includes('height: 42%'))
      assert(progressStyles[3].includes('top: 0%'))
      await win.webContents.executeJavaScript(`document.documentElement.classList.add('dark')`)
      await capture(win, 'progress-dark')
      const buttonShapes = await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('#winpprogress .panel-action')).map(e=>({radius:getComputedStyle(e).borderRadius,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))`
      )
      assert.equal(buttonShapes[0].radius, '0px')
      assert.notEqual(buttonShapes[1].radius, '0px')
      assert.equal(buttonShapes[2].radius, '50%')
      assert(Math.abs(buttonShapes[2].width - buttonShapes[2].height) < 1)
      const circleWrites = []
      const circleListener = (event, payload) => {
        if (event.sender === win.webContents) circleWrites.push(payload)
      }
      ipcMain.on('ipc-var-set', circleListener)
      await win.webContents.executeJavaScript(
        `const circle=document.querySelector('#winpprogress .button-circle');circle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));circle.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0}));`
      )
      for (let i = 0; i < 50 && circleWrites.length < 2; i++)
        await new Promise((resolve) => setTimeout(resolve, 100))
      ipcMain.off('ipc-var-set', circleListener)
      assert.deepEqual(circleWrites, [
        { name: 'Level', value: 1 },
        { name: 'Level', value: 0 }
      ])
      checks.push({ name: 'button-shapes-and-circle-write', passed: true })
      await win.webContents.executeJavaScript(`
        document.documentElement.classList.remove('dark');
        const progressBase=JSON.parse(JSON.stringify(panelTest.data.panels.progress.document.controls[0]));
        panelTest.data.panels.positions={id:'positions',name:'Value positions',rule:[],options:{},document:{schemaVersion:2,width:800,height:500,controls:['hidden','left','top','right','bottom'].map((position,i)=>({...progressBase,id:position,label:position,labelPosition:'top',progressValuePosition:position,x:20,y:15+i*92,width:320,height:80})).concat([{...progressBase,id:'vertical',label:'Vertical',labelPosition:'left',progressDirection:'up',progressValuePosition:'right',x:400,y:20,width:260,height:380}])}};
        panelTest.getLayout().addWin('panelPreview','ppositions',{params:{'edit-index':'ppositions'}});
      `)
      await waitFor(win, `document.querySelectorAll('#winppositions .panel-progress').length === 6`)
      await win.webContents.executeJavaScript(
        `panelTest.getLayout().maxWin('ppositions');window.electron.ipcRenderer.send('ipc-var-set',{name:'Level',value:42});window.logBus.emit('level',{key:'level',values:[[0,{rawValue:42}]]})`
      )
      const positions = await win.webContents.executeJavaScript(
        `['hidden','left','top','right','bottom','vertical'].map(id=>{const root=document.querySelector('#winppositions [data-control-id="'+id+'"]');const value=root.querySelector('.progress-value');const bar=root.querySelector('.panel-progress-bar').getBoundingClientRect();const r=value?.getBoundingClientRect();return {id,count:root.querySelectorAll('.progress-value').length,correct:!r || (id==='left'?r.right<=bar.left:id==='right'||id==='vertical'?r.left>=bar.right:id==='bottom'?r.top>=bar.bottom:r.bottom<=bar.top)}})`
      )
      assert.equal(positions[0].count, 0)
      assert(positions.slice(1).every((p) => p.count === 1 && p.correct))
      assert(
        await win.webContents.executeJavaScript(
          `document.querySelector('#winppositions [data-control-id="vertical"] .panel-progress-track').getBoundingClientRect().height > 200`
        )
      )
      await capture(win, 'progress-value-positions')
      checks.push({ name: 'progress-independent-value-positions', passed: true })
      await win.webContents.executeJavaScript(
        `document.documentElement.classList.remove('dark'); panelTest.data.globalRun('stop')`
      )
      await waitFor(
        win,
        `document.querySelector('#winpprogress [aria-label="Current"]')?.getAttribute('aria-valuetext') === '—'`
      )
      const stoppedWidths = await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('#winpprogress .panel-progress-track > div')).map(e=>e.style.width || e.style.height)`
      )
      assert(stoppedWidths.every((size) => size === '0%'))
      checks.push({ name: 'progress-directions-format-and-stop', passed: true })
      await win.webContents.executeJavaScript(`
        panelTest.data.vars.bytes = {id:'bytes',name:'Bytes',type:'user',value:{type:'array',initValue:[]}};
        panelTest.data.vars.text = {id:'text', name:'Text', type:'user', value:{type:'string', initValue:''}};
        const baseControl = JSON.parse(JSON.stringify(panelTest.data.panels['smoke-panel'].document.controls[1]));
        const make = (type,id,x,y,extra={}) => ({...baseControl,type,id,label:id,x,y,width:270,height:64,binding:undefined,...extra});
        const numericBinding = baseControl.binding;
        const textBinding = {kind:'variable',node:{id:'text',type:'variable',name:'Text',enable:true,color:'',bindValue:{variableId:'text',variableType:'user',variableName:'Text',variableFullName:'Text',variableValueType:'string'}}};
        panelTest.data.panels.actions = {id:'actions',name:'Actions',rule:[],options:{},document:{schemaVersion:2,width:800,height:520,controls:[
          make('input','input',20,20,{binding:textBinding}),
          make('led','led',670,20,{width:96,height:96,binding:numericBinding}),
          make('input','bytes',20,350,{width:600,height:130,editorMode:'both',binding:{kind:'variable',node:{...textBinding.node,id:'bytes',name:'Bytes',bindValue:{variableId:'bytes',variableName:'Bytes',variableFullName:'Bytes',variableType:'user',variableValueType:'array'}}}}),
          make('path','path',20,100,{binding:textBinding,pathMode:'file'}),
          make('checkbox','check',20,180,{binding:numericBinding,pressValue:8,releaseValue:2}),
          make('radio','radio',20,260,{binding:numericBinding,options:[{label:'Low',value:0},{label:'High',value:7}]}),
          make('startStop','start',340,20),
          make('button','file',340,180,{buttonAction:'openFile',actionPath:'notes.txt'}),
          make('button','panel',340,260,{buttonAction:'openPanel',actionPanelId:'actions-target'})
        ]}};
        panelTest.data.panels['actions-target']={id:'actions-target',name:'Target',rule:[],options:{},document:{schemaVersion:2,width:400,height:200,controls:[]}};
        panelTest.getLayout().addWin('panelPreview','pactions',{params:{'edit-index':'pactions'}});
      `)
      await waitFor(win, `!!document.querySelector('#winpactions .free-panel-runtime')`)
      assert.equal(
        await win.webContents.executeJavaScript(
          `!!document.querySelector('#winpactions [data-control-id="input"] .label-left')`
        ),
        true
      )
      await win.webContents.executeJavaScript(`panelTest.getLayout().maxWin('pactions')`)
      const clickAction = (id, index = 0) =>
        win.webContents.executeJavaScript(
          `document.querySelectorAll('#winpactions [data-control-id="${id}"] button')[${index}].click()`
        )
      await waitFor(
        win,
        `!document.querySelector('#winpactions [data-control-id="start"] button').disabled`
      )
      await clickAction('start')
      await waitFor(
        win,
        `!document.querySelectorAll('#winpactions [data-control-id="start"] button')[1].disabled`
      )
      await waitFor(
        win,
        `!document.querySelector('#winpactions [data-control-id="input"] textarea').readOnly`
      )
      const actionWrites = []
      const actionListener = (event, payload) => {
        if (event.sender === win.webContents) actionWrites.push(payload)
      }
      ipcMain.on('ipc-var-set', actionListener)
      await win.webContents.executeJavaScript(`
        const input = document.querySelector('#winpactions [data-control-id="input"] textarea');
        input.value='hello 中文'; input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
        document.querySelector('#winpactions [data-control-id="check"] input').click();
        document.querySelectorAll('#winpactions [data-control-id="radio"] input')[1].click();
      `)
      await waitFor(
        win,
        `document.querySelector('#winpactions [data-control-id="radio"] input:checked')?.value === '7'`
      )
      await win.webContents.executeJavaScript(`
        const hex = document.querySelector('#winpactions [data-control-id="bytes"] textarea');
        hex.value='41 00 FF'; hex.dispatchEvent(new Event('input',{bubbles:true})); hex.dispatchEvent(new Event('change',{bubbles:true}));
      `)
      await waitFor(
        win,
        `document.querySelector('#winpactions [data-control-id="bytes"] textarea').value === '41 00 FF'`
      )
      assert.equal(
        await win.webContents.executeJavaScript(
          `document.querySelectorAll('#winpactions [data-control-id="led"] .panel-control-label').length`
        ),
        0
      )
      assert.equal(
        await win.webContents.executeJavaScript(
          `parseFloat(document.querySelector('#winpactions [data-control-id="led"] .panel-led').style.width)`
        ),
        84
      )
      const originalOpenDialog = dialog.showOpenDialog
      await win.webContents.executeJavaScript(`
        const ledSource = panelTest.data.panels.actions.document.controls.find(c=>c.id==='led');
        panelTest.data.panels.leds={id:'leds',name:'LED shapes',rule:[],options:{},document:{schemaVersion:2,width:800,height:240,controls:['ellipse','rectangle','up','down','left','right'].map((shape,i)=>({...JSON.parse(JSON.stringify(ledSource)),id:'led-'+shape,x:20+i*125,y:40,width:110,height:80,ledShape:shape,ledKeepAspect:false,ledFrame:i!==5,ledOnColor:'#ff0000',ledOffColor:'#0000ff'}))}};
        panelTest.getLayout().addWin('panelPreview','pleds',{params:{'edit-index':'pleds'}});
      `)
      await waitFor(win, `document.querySelectorAll('#winpleds .panel-led path').length === 6`)
      await win.webContents.executeJavaScript(`panelTest.getLayout().maxWin('pleds')`)
      for (const [value, fill] of [
        [1, '#ff0000'],
        [0, '#0000ff'],
        [99, 'none']
      ]) {
        await win.webContents.executeJavaScript(
          `window.logBus.emit('level',{key:'level',values:[[0,{rawValue:${value}}]]})`
        )
        await waitFor(
          win,
          `Array.from(document.querySelectorAll('#winpleds .panel-led path')).every(el=>el.getAttribute('fill')===${JSON.stringify(fill)})`
        )
      }
      const ledPaths = await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('#winpleds .panel-led path')).map(el=>el.getAttribute('d'))`
      )
      assert.equal(new Set(ledPaths).size, 6)
      assert.equal(
        await win.webContents.executeJavaScript(
          `document.querySelector('#winpleds [data-control-id="led-right"] path').getAttribute('stroke')`
        ),
        'none'
      )
      await win.webContents.executeJavaScript(
        `window.electron.ipcRenderer.send('ipc-var-set',{name:'Level',value:1}); window.logBus.emit('level',{key:'level',values:[[0,{rawValue:1}]]})`
      )
      await waitFor(
        win,
        `Array.from(document.querySelectorAll('#winpleds .panel-led path')).every(el=>el.getAttribute('fill')==='#ff0000')`
      )
      await capture(win, 'led-shapes')
      checks.push({ name: 'led-shapes-colors-frame-and-states', passed: true })
      await win.webContents.executeJavaScript(`
        const nbase=JSON.parse(JSON.stringify(panelTest.data.panels.actions.document.controls.find(c=>c.id==='check')));
        panelTest.data.panels.numbers={id:'numbers',name:'Numeric formats',rule:[],options:{},document:{schemaVersion:2,width:800,height:400,controls:[
          {...nbase,id:'decimal',type:'display',label:'Decimal',x:20,y:20,width:360,height:64,numberDecimals:2,numberShowRange:true,numberShowUnit:true,unit:'V'},
          {...nbase,id:'hex',type:'number',label:'Hex',x:20,y:110,width:360,height:64,numberFormat:'hex'},
          {...nbase,id:'binary',type:'display',label:'Binary',x:20,y:200,width:360,height:64,numberFormat:'binary'},
          {...nbase,id:'alarm',type:'display',label:'Alarm',x:420,y:20,width:320,height:64,alarmMode:'limits',alarmLower:10,alarmUpper:90}
        ]}};
        panelTest.getLayout().addWin('panelPreview','pnumbers',{params:{'edit-index':'pnumbers'}});
      `)
      await waitFor(win, `!!document.querySelector('#winpnumbers [data-control-id="hex"] input')`)
      await win.webContents.executeJavaScript(
        `(() => {panelTest.getLayout().maxWin('pnumbers');const input=document.querySelector('#winpnumbers [data-control-id="hex"] input');input.focus();input.select()})()`
      )
      await win.webContents.insertText('0x2A')
      await win.webContents.executeJavaScript(
        `document.querySelector('#winpnumbers [data-control-id="hex"] input').blur()`
      )
      for (
        let i = 0;
        i < 50 && !actionWrites.some((p) => p.name === 'Level' && p.value === 42);
        i++
      )
        await new Promise((resolve) => setTimeout(resolve, 20))
      assert(actionWrites.some((p) => p.name === 'Level' && p.value === 42))
      await win.webContents.executeJavaScript(
        `window.logBus.emit('level',{key:'level',values:[[0,{rawValue:42}]]})`
      )
      await waitFor(
        win,
        `document.querySelector('#winpnumbers [data-control-id="decimal"] strong').textContent==='42.00'`
      )
      assert.equal(
        await win.webContents.executeJavaScript(
          `document.querySelector('#winpnumbers [data-control-id="binary"] strong').textContent`
        ),
        '0b101010'
      )
      for (const [value, color] of [
        [5, 'rgb(250, 128, 114)'],
        [95, 'rgb(205, 92, 92)'],
        [42, '']
      ]) {
        await win.webContents.executeJavaScript(
          `window.electron.ipcRenderer.send('ipc-var-set',{name:'Level',value:${value}});window.logBus.emit('level',{key:'level',values:[[0,{rawValue:${value}}]]})`
        )
        await waitFor(
          win,
          `document.querySelector('#winpnumbers [data-control-id="alarm"] .panel-reading').style.backgroundColor===${JSON.stringify(color)}`
        )
      }
      await capture(win, 'numeric-formats')
      checks.push({ name: 'numeric-format-editing-and-alarm-colors', passed: true })
      await win.webContents.executeJavaScript(`
        panelTest.data.panels.sliders={id:'sliders',name:'Sliders',rule:[],options:{},document:{schemaVersion:2,width:800,height:500,controls:
          ['left','right','top','bottom','hidden'].map((position,index)=>({...nbase,id:'slider-'+position,type:'slider',label:'Slider',labelPosition:position,x:20,y:20+index*90,width:320,height:80}))
        }};
        panelTest.getLayout().addWin('panelPreview','psliders',{params:{'edit-index':'psliders'}});
      `)
      await waitFor(win, `document.querySelectorAll('#winpsliders .el-slider').length===5`)
      await win.webContents.executeJavaScript(`panelTest.getLayout().maxWin('psliders')`)
      for (const value of [0, 100]) {
        await win.webContents.executeJavaScript(
          `window.logBus.emit('level',{key:'level',values:[[0,{rawValue:${value}}]]})`
        )
        await waitFor(
          win,
          `Array.from(document.querySelectorAll('#winpsliders [role="slider"]')).every(el=>Number(el.getAttribute('aria-valuenow'))===${value})`
        )
        const clear = await win.webContents.executeJavaScript(`
          Array.from(document.querySelectorAll('#winpsliders .panel-control-content')).every(el=>{
            const bounds=el.getBoundingClientRect();
            const thumb=el.querySelector('.el-slider__button-wrapper').getBoundingClientRect();
            const label=el.querySelector('.panel-control-label')?.getBoundingClientRect();
            return thumb.left>=bounds.left && thumb.right<=bounds.right && (!label || thumb.left>=label.right || thumb.right<=label.left || thumb.top>=label.bottom || thumb.bottom<=label.top);
          })
        `)
        assert(clear, `Slider label overlaps thumb at ${value}`)
      }
      await capture(win, 'slider-label-spacing')
      checks.push({ name: 'slider-label-spacing-at-both-endpoints', passed: true })
      await win.webContents.executeJavaScript(`panelTest.getLayout().maxWin('pactions')`)
      const originalOpenPath = shell.openPath
      let dialogCalls = 0
      dialog.showOpenDialog = async () => {
        dialogCalls++
        return { canceled: false, filePaths: [path.join(artifacts, 'firmware.bin')] }
      }
      await clickAction('path')
      await waitFor(
        win,
        `document.querySelector('#winpactions [data-control-id="path"] input').value.endsWith('firmware.bin')`
      )
      assert.equal(dialogCalls, 1)
      const beforeCancel = actionWrites.length
      dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] })
      await clickAction('path')
      await waitFor(
        win,
        `!document.querySelector('#winpactions [data-control-id="path"] button').disabled`
      )
      assert.equal(actionWrites.length, beforeCancel)
      let resolveDialog
      dialog.showOpenDialog = () =>
        new Promise((resolve) => {
          resolveDialog = resolve
        })
      await clickAction('path')
      for (let i = 0; i < 50 && !resolveDialog; i++)
        await new Promise((resolve) => setTimeout(resolve, 20))
      assert(resolveDialog)
      await clickAction('start', 1)
      await waitFor(
        win,
        `!document.querySelectorAll('#winpactions [data-control-id="start"] button')[0].disabled`
      )
      await waitFor(
        win,
        `document.querySelector('#winpactions [data-control-id="input"] textarea').readOnly`
      )
      resolveDialog({ canceled: false, filePaths: ['ignored-after-stop'] })
      await new Promise((resolve) => setTimeout(resolve, 150))
      dialog.showOpenDialog = originalOpenDialog
      assert.equal(actionWrites.length, beforeCancel)
      assert(actionWrites.some((p) => p.name === 'Text' && p.value === 'hello 中文'))
      assert(actionWrites.some((p) => p.name === 'Level' && p.value === 8))
      assert(actionWrites.some((p) => p.name === 'Level' && p.value === 7))
      assert(
        actionWrites.some(
          (p) => p.name === 'Text' && p.value === path.join(artifacts, 'firmware.bin')
        )
      )
      assert(
        actionWrites.some((p) => p.name === 'Bytes' && JSON.stringify(p.value) === '[65,0,255]')
      )
      ipcMain.off('ipc-var-set', actionListener)
      let openedPath
      shell.openPath = async (file) => {
        openedPath = file
        return ''
      }
      await clickAction('file')
      for (let i = 0; i < 50 && !openedPath; i++)
        await new Promise((resolve) => setTimeout(resolve, 20))
      assert.equal(openedPath, path.join(artifacts, 'notes.txt'))
      shell.openPath = originalOpenPath
      await clickAction('panel')
      await waitFor(win, `!!document.querySelector('#winpactions-target .free-panel-runtime')`)
      await win.webContents.executeJavaScript(`panelTest.getLayout().maxWin('pactions')`)
      await capture(win, 'actions-and-inputs')
      await win.webContents.executeJavaScript(`panelTest.project.saveProject()`)
      await waitFor(win, `!panelTest.project.projectDirty`)
      assert.equal(
        JSON.parse(fs.readFileSync(projectFile, 'utf8')).data.panels.actions.document,
        undefined
      )
      checks.push({ name: 'actions-string-path-checkbox-radio', passed: true })
      await win.webContents.executeJavaScript(`panelTest.project.saveProject()`)
      await waitFor(win, `!panelTest.project.projectDirty`)
      const legacySampleText = fs.readFileSync(
        path.resolve(__dirname, '../../resources/examples/script_demo_2/script_demo_2.ecb'),
        'utf8'
      )
      const legacySample = JSON.parse(legacySampleText)
      const autoId = Object.keys(legacySample.data.panels)[0]
      const autoFile = path.join(artifacts, 'legacy-auto.ecb')
      fs.writeFileSync(autoFile, legacySampleText)
      await win.webContents.executeJavaScript(
        `panelTest.project.openProjectByPath(${JSON.stringify(autoFile)})`
      )
      await waitFor(win, `!!panelTest.data.panels[${JSON.stringify(autoId)}]?.document`)
      assert.equal(fs.readFileSync(autoFile, 'utf8'), legacySampleText)
      await win.webContents.executeJavaScript(
        `panelTest.getLayout().addWin('panel',${JSON.stringify(autoId)},{params:{'edit-index':${JSON.stringify(autoId)}}})`
      )
      await waitFor(
        win,
        `!!document.querySelector(${JSON.stringify('#win' + autoId + ' .free-panel-editor')})`
      )
      await win.webContents.executeJavaScript(
        `document.querySelector(${JSON.stringify('#win' + autoId + ' .panel-toolbar button')}).click()`
      )
      await waitFor(win, `!!panelTest.data.panels[${JSON.stringify(autoId)}].filePath`)
      await win.webContents.executeJavaScript(`panelTest.project.saveProject()`)
      await waitFor(win, `!panelTest.project.projectDirty`)
      const autoSaved = JSON.parse(fs.readFileSync(autoFile, 'utf8')).data.panels[autoId]
      assert.equal(autoSaved.document, undefined)
      const autoDocument = JSON.parse(
        fs.readFileSync(path.join(artifacts, autoSaved.filePath), 'utf8')
      ).document
      assert.equal(autoDocument.controls[0].binding.node.bindValue.variableValueType, 'number')
      checks.push({ name: 'real-legacy-auto-upgrade-and-editor-save', passed: true })
      const panelFile = path.join(artifacts, 'standalone.ecpanel')
      const saveDialog = dialog.showSaveDialog
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: panelFile })
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll(${JSON.stringify('#win' + autoId + ' .panel-toolbar button')})).find(b=>b.textContent.trim()==='Save Panel As').click()`
      )
      await waitFor(
        win,
        `panelTest.data.panels[${JSON.stringify(autoId)}].filePath===${JSON.stringify(panelFile)}`
      )
      dialog.showSaveDialog = saveDialog
      assert.equal(JSON.parse(fs.readFileSync(panelFile, 'utf8')).format, 'ecubus-panel')
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll(${JSON.stringify('#win' + autoId + ' .panel-palette button')})).find(b=>b.textContent.trim().endsWith('LED')).click();document.querySelector(${JSON.stringify('#win' + autoId + ' .panel-toolbar button')}).click()`
      )
      await waitFor(
        win,
        `panelTest.data.panels[${JSON.stringify(autoId)}].document.controls.length===2`
      )
      assert.equal(JSON.parse(fs.readFileSync(panelFile, 'utf8')).document.controls.length, 2)
      await win.webContents.executeJavaScript(`panelTest.project.saveProject()`)
      await waitFor(win, `!panelTest.project.projectDirty`)
      const reference = JSON.parse(fs.readFileSync(autoFile, 'utf8')).data.panels[autoId]
      assert.equal(reference.filePath, 'standalone.ecpanel')
      assert.equal(reference.document, undefined)
      await win.webContents.executeJavaScript(`panelTest.project.closeProject()`)
      await waitFor(win, `!panelTest.project.open`)
      await new Promise((resolve) => {
        win.webContents.once('did-finish-load', resolve)
        win.reload()
      })
      await connectStores(win)
      await win.webContents.executeJavaScript(
        `panelTest.project.openProjectByPath(${JSON.stringify(autoFile)})`
      )
      await waitFor(
        win,
        `panelTest.project.open && panelTest.data.panels[${JSON.stringify(autoId)}]?.document?.controls.length===2`
      )
      await win.webContents.executeJavaScript(
        `panelTest.getLayout().addWin('panel',${JSON.stringify(autoId)},{params:{'edit-index':${JSON.stringify(autoId)}}})`
      )
      await waitFor(
        win,
        `!!document.querySelector(${JSON.stringify('#win' + autoId + ' .panel-toolbar')})`
      )
      const importedFile = path.join(artifacts, 'imported.ecpanel')
      fs.copyFileSync(panelFile, importedFile)
      const openDialog = dialog.showOpenDialog
      let importCalls = 0
      dialog.showOpenDialog = async () => {
        importCalls++
        return { canceled: false, filePaths: [importedFile] }
      }
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('.demo-tabs .el-dropdown .lr')).find(el=>el.textContent.trim()==='Panel').dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}))`
      )
      await waitFor(
        win,
        `Array.from(document.querySelectorAll('.el-dropdown-menu__item')).some(el=>el.textContent.trim()==='Import Panel' && el.getBoundingClientRect().height>0)`
      )
      await capture(win, 'panel-menu')
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('.el-dropdown-menu__item')).find(el=>el.textContent.trim()==='Import Panel').click()`
      )
      await waitFor(
        win,
        `Object.values(panelTest.data.panels).some(p=>p.filePath===${JSON.stringify(importedFile)} && p.document.controls.length===2)`
      )
      assert.equal(importCalls, 1)
      dialog.showOpenDialog = openDialog
      await capture(win, 'standalone-panel')
      const editorsBeforeNew = await win.webContents.executeJavaScript(
        `document.querySelectorAll('.free-panel-editor').length`
      )
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('.demo-tabs .el-dropdown .lr')).find(el=>el.textContent.trim()==='Panel').dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}))`
      )
      await waitFor(
        win,
        `Array.from(document.querySelectorAll('.el-dropdown-menu__item')).some(el=>el.textContent.trim()==='New Panel' && el.getBoundingClientRect().height>0)`
      )
      await win.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('.el-dropdown-menu__item')).find(el=>el.textContent.trim()==='New Panel').click()`
      )
      await waitFor(
        win,
        `document.querySelectorAll('.free-panel-editor').length===${editorsBeforeNew + 1}`
      )
      checks.push({ name: 'panel-menu-new-and-import', passed: true })
      checks.push({
        name: 'standalone-panel-save-writeback-reference-reopen-and-import',
        passed: true
      })
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
