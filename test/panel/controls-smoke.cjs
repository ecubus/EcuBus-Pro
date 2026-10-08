const { app, BrowserWindow } = require('electron')
const assert = require('node:assert/strict')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let win
const checks = []
const evaluate = (code) => win.webContents.executeJavaScript(code)
const selector = (id, child = '') => `[data-control-id="${id}"] ${child}`.trim()
async function waitFor(code) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(code)) return
    await delay(100)
  }
  throw new Error(`Timed out: ${code}`)
}
async function writeValues() {
  return evaluate(`window.controlTest.writes.map(item => item.value)`)
}
async function clearWrites(value = 0) {
  await evaluate(
    `window.logBus.emit('level', {key:'level',values:[[0,{rawValue:${value}}]]}); window.controlTest.writes=[];`
  )
  await delay(50)
}
async function click(id, child) {
  await evaluate(`(() => {
    const element=document.querySelector(${JSON.stringify(selector(id, child))});
    element.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));
    document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0}));
    element.click();
  })()`)
  await delay(50)
}
async function edit(id, child, value) {
  await evaluate(`(() => {
    const input=document.querySelector(${JSON.stringify(selector(id, child))});
    input.focus(); input.dispatchEvent(new FocusEvent('focus')); input.value=${JSON.stringify(value)};
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true})); input.blur(); input.dispatchEvent(new FocusEvent('blur'));
  })()`)
  await delay(50)
}
async function type(id, child, text) {
  await evaluate(
    `(() => { const input=document.querySelector(${JSON.stringify(selector(id, child))}); input.focus(); input.select(); })()`
  )
  for (const keyCode of text) {
    win.webContents.sendInputEvent({ type: 'char', keyCode })
    await delay(20)
  }
  await delay(50)
}
async function value(id, child) {
  return evaluate(`document.querySelector(${JSON.stringify(selector(id, child))}).value`)
}

app.whenReady().then(async () => {
  win = new BrowserWindow({
    show: true,
    x: -3000,
    y: 0,
    width: 1100,
    height: 900,
    webPreferences: { backgroundThrottling: false }
  })
  try {
    await win.loadURL('http://127.0.0.1:5199/?runtime=1')
    win.focus()
    await waitFor(`!!document.querySelector('[data-control-id="dimmer"]')`)
    await evaluate(`(() => {
      const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
      const data=pinia._s.get('useDataStore');
      const runtime=pinia._s.get('useRuntimeStore');
      let component=document.querySelector('.free-panel-runtime').__vueParentComponent;
      while (!component.props.document) component=component.parent;
      const panelDocument=component.props.document;
      const base=JSON.parse(JSON.stringify(panelDocument.controls.find(item=>item.id==='dimmer')));
      window.controlTest={writes:[],document:panelDocument};
      data.vars.text={id:'text',name:'Text',type:'user',value:{type:'string',initValue:''}};
      data.vars.bytes={id:'bytes',name:'Bytes',type:'user',value:{type:'array',initValue:[]}};
      const make=(type,id,extra={})=>({...base,type,id,label:id,width:270,height:70,
        x:16+(panelDocument.controls.length%3)*290,y:16+Math.floor(panelDocument.controls.length/3)*85,
        initialValue:0,options:[{label:'Low',value:0},{label:'High',value:7}],...extra});
      const binding=(id,type)=>({kind:'variable',node:{id,name:id,type:'variable',enable:true,color:'',
        bindValue:{variableId:id,variableName:id,variableFullName:id==='text'?'Text':'Bytes',variableType:'user',variableValueType:type}}});
      panelDocument.width=900; panelDocument.height=750; panelDocument.controls=[];
      for (const [type,id,extra] of [
        ['number','decimal',{}],['number','hex',{numberFormat:'hex'}],['number','binary',{numberFormat:'binary'}],
        ['checkbox','check',{pressValue:8,releaseValue:2}],['radio','radio',{}],['select','select',{}],
        ['switch','switch',{pressValue:8,releaseValue:2}],['button','momentary',{pressValue:8,releaseValue:2,toggle:false}],
        ['button','toggle',{pressValue:8,releaseValue:2,toggle:true}],
        ['input','text',{binding:binding('text','string'),editorMode:'text',height:80}],
        ['input','bytes',{binding:binding('bytes','array'),editorMode:'both',height:80}],
        ['path','path',{binding:binding('text','string')}],
        ['display','display',{}],['progress','progress',{}],['gauge','gauge',{}],['led','led',{pressValue:8,releaseValue:2}],
        ['number','readonly',{readOnly:true}]
      ]) panelDocument.controls.push(make(type,id,extra));
      window.electron.ipcRenderer.send=(channel,payload)=>{
        window.controlTest.writes.push({channel,...payload});
        const id=payload.name==='Level'?'level':payload.name==='Text'?'text':'bytes';
        window.logBus.emit(id,{key:id,values:[[0,{rawValue:payload.value}]]});
      };
      window.electron.ipcRenderer.invoke=async(channel)=>channel==='ipc-var-values'?{}:{canceled:true};
      runtime.signalSession='controls-test'; runtime.startedSession='controls-test'; runtime.globalStart=true;
    })()`)
    await waitFor(`!document.querySelector('[data-control-id="decimal"] input').disabled`)
    await clearWrites()
    await edit('decimal', 'input', '60')
    assert.deepEqual(await writeValues(), [60])
    await clearWrites(60)
    await click('decimal', '.el-input-number__increase')
    assert.deepEqual(await writeValues(), [61])
    await clearWrites()
    await edit('hex', 'input', '0x2A')
    await edit('binary', 'input', '0b1111')
    assert.deepEqual(await writeValues(), [42, 15])
    checks.push('decimal buttons/input and hex/binary commits')

    await clearWrites(2)
    await click('check', 'input')
    await click('check', 'input')
    await click('switch', '.el-switch')
    await click('switch', '.el-switch')
    await click('radio', 'input[value="7"]')
    await click('select', '.el-select')
    await waitFor(
      `Array.from(document.querySelectorAll('.el-select-dropdown__item')).some(item=>item.textContent.trim()==='Low')`
    )
    await evaluate(
      `Array.from(document.querySelectorAll('.el-select-dropdown__item')).find(item=>item.textContent.trim()==='Low').click()`
    )
    await delay(50)
    assert.deepEqual(await writeValues(), [8, 2, 8, 2, 7, 0])
    checks.push('checkbox, switch, radio and select values')

    await clearWrites(2)
    await evaluate(`(() => {
      const button=document.querySelector('[data-control-id="momentary"] button');
      button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
      button.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0}));
    })()`)
    await click('toggle', 'button')
    await click('toggle', 'button')
    assert.deepEqual(await writeValues(), [8, 2, 8, 2])
    checks.push('momentary and toggle buttons')

    await clearWrites()
    await edit('text', 'textarea', 'hello 中文')
    await edit('bytes', 'textarea', '41 00 FF')
    await edit('path', 'input', 'C:\\firmware.bin')
    assert.deepEqual(await writeValues(), ['hello 中文', [65, 0, 255], 'C:\\firmware.bin'])
    checks.push('text, hex bytes and path commits')

    await clearWrites()
    await type('path', 'input', 'D:/a.bin')
    assert.equal(await value('path', 'input'), 'D:/a.bin', 'path must accept typing')
    await evaluate(`window.logBus.emit('text',{key:'text',values:[[0,{rawValue:'received'}]]})`)
    await delay(50)
    assert.equal(await value('path', 'input'), 'D:/a.bin', 'path must preserve focused draft')
    await evaluate(`document.querySelector(${JSON.stringify(selector('path', 'input'))}).blur()`)
    await delay(50)
    assert.deepEqual(await writeValues(), ['D:/a.bin'])
    assert.equal(await value('path', 'input'), 'D:/a.bin')
    await type('decimal', 'input', '9')
    await evaluate(`window.logBus.emit('level',{key:'level',values:[[0,{rawValue:12}]]})`)
    await delay(50)
    assert.equal(await value('decimal', 'input'), '9', 'decimal must preserve focused draft')
    await evaluate(`document.querySelector(${JSON.stringify(selector('decimal', 'input'))}).blur()`)
    await delay(50)
    assert.deepEqual(await writeValues(), ['D:/a.bin', 9])
    checks.push('typed path and decimal drafts survive external updates')

    await clearWrites(42)
    assert.equal(await value('decimal', 'input'), '42')
    assert.equal(await value('hex', 'input'), '0x2A')
    assert.equal(await value('binary', 'input'), '0b101010')
    assert.equal(
      await evaluate(`document.querySelector('[data-control-id="display"] strong').textContent`),
      '42'
    )
    assert.equal(
      await evaluate(
        `document.querySelector('[data-control-id="progress"] .progress-value').textContent`
      ),
      '42'
    )
    assert.equal(
      await evaluate(
        `document.querySelector('[data-control-id="gauge"] .gauge-value').textContent.trim()`
      ),
      '42'
    )
    assert.deepEqual(await writeValues(), [])
    checks.push('external updates without writes')

    for (const [received, state] of [
      [8, 'on'],
      [2, 'off'],
      [99, 'unknown']
    ]) {
      await clearWrites(received)
      assert.ok(
        await evaluate(
          `document.querySelector('[data-control-id="led"] .panel-led').classList.contains(${JSON.stringify(state)})`
        )
      )
      assert.deepEqual(await writeValues(), [])
    }
    checks.push('LED on, off and unknown states')

    for (const [id, child, key, incoming, expected] of [
      ['hex', 'input', 'level', 31, '0x1F'],
      ['binary', 'input', 'level', 9, '0b1001'],
      ['text', 'textarea', 'text', 'received', 'received'],
      ['bytes', 'textarea', 'bytes', [66, 67], '42 43']
    ]) {
      await evaluate(
        `(() => { const input=document.querySelector(${JSON.stringify(selector(id, child))}); input.focus(); input.dispatchEvent(new FocusEvent('focus')); })()`
      )
      const before = await value(id, child)
      await evaluate(
        `window.logBus.emit(${JSON.stringify(key)},{key:${JSON.stringify(key)},values:[[0,{rawValue:${JSON.stringify(incoming)}}]]})`
      )
      await delay(50)
      assert.equal(await value(id, child), before, `${id} must preserve focused draft`)
      await evaluate(
        `(() => { const input=document.querySelector(${JSON.stringify(selector(id, child))}); input.blur(); input.dispatchEvent(new FocusEvent('blur')); })()`
      )
      await delay(50)
      assert.equal(
        await value(id, child),
        expected,
        `${id} must show latest received value after blur`
      )
    }
    assert.deepEqual(await writeValues(), [])
    checks.push('focused external updates synchronize on blur without writes')

    await edit('hex', 'input', 'invalid')
    assert.deepEqual(await writeValues(), [])
    assert.equal(
      await evaluate(
        `document.querySelector('[data-control-id="hex"] input').getAttribute('aria-invalid')`
      ),
      'true'
    )
    await edit('bytes', 'textarea', 'GG')
    assert.deepEqual(await writeValues(), [])
    assert.ok(await evaluate(`!!document.querySelector('[data-control-id="bytes"] .editor-error')`))
    checks.push('invalid input rejection')

    assert.ok(
      await evaluate(`document.querySelector('[data-control-id="readonly"] input').disabled`)
    )
    await click('readonly', '.el-input-number__increase')
    assert.deepEqual(await writeValues(), [])
    await evaluate(
      `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('useRuntimeStore').globalStart=false`
    )
    await delay(50)
    await click('check', 'input')
    await click('switch', '.el-switch')
    await click('toggle', 'button')
    await edit('text', 'textarea', 'ignored')
    assert.deepEqual(await writeValues(), [])
    checks.push('stopped and readonly controls')
    console.log(JSON.stringify({ checks }))
    app.exit(0)
  } catch (error) {
    console.error(JSON.stringify({ checks, error: String(error.stack) }))
    app.exit(1)
  }
})
