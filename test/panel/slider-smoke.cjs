const { app, BrowserWindow } = require('electron')
const assert = require('node:assert/strict')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let win
async function evaluate(expression) {
  return win.webContents.executeJavaScript(expression)
}
async function waitFor(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return
    await delay(100)
  }
  throw new Error(`Timed out: ${expression}`)
}
async function slider() {
  return evaluate(`(() => {
    const control = document.querySelector('[data-control-id="dimmer"]');
    const runway = control.querySelector('.el-slider__runway').getBoundingClientRect();
    const button = control.querySelector('[role="slider"]');
    const rect = button.getBoundingClientRect();
    return { left: runway.left, width: runway.width, x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2, value: Number(button.getAttribute('aria-valuenow')) };
  })()`)
}
async function writes() {
  return evaluate(`document.querySelector('output').textContent`)
}
function mouse(type, x, y) {
  win.webContents.sendInputEvent({
    type,
    x: Math.round(x),
    y: Math.round(y),
    button: 'left',
    clickCount: 1
  })
}

app.whenReady().then(async () => {
  win = new BrowserWindow({
    show: true,
    x: -3000,
    y: 0,
    width: 1100,
    height: 750,
    webPreferences: { backgroundThrottling: false }
  })
  try {
    await win.loadURL('http://127.0.0.1:5199/?runtime=1')
    await waitFor(`!!document.querySelector('[data-control-id="dimmer"] [role="slider"]')`)
    await evaluate(`document.querySelector('button').click()`)
    await evaluate(`(() => {
      const runtime = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('useRuntimeStore');
      runtime.signalSession = 'slider-test';
      runtime.startedSession = 'slider-test';
    })()`)
    await waitFor(
      `document.querySelector('[data-control-id="dimmer"] [role="slider"]').getAttribute('aria-disabled') === 'false'`
    )
    await evaluate(`window.logBus.emit('level', { key: 'level', values: [[0, { rawValue: 0 }]] })`)
    await delay(100)
    assert.equal((await slider()).value, 0)
    const before = await writes()
    const start = await slider()
    mouse('mouseDown', start.x, start.y)
    mouse('mouseMove', start.left + start.width * 0.4, start.y)
    await delay(100)
    mouse('mouseMove', start.left + start.width * 0.75, start.y)
    await delay(100)
    assert.equal(await writes(), before, 'drag must not write before release')
    mouse('mouseUp', start.left + start.width * 0.75, start.y)
    await delay(150)
    const dragged = (await slider()).value
    assert.ok(dragged >= 73 && dragged <= 77, `drag committed ${dragged}, expected 75`)
    assert.equal((await writes()).slice(before.length).trim(), `ipc-var-set Level=${dragged}`)

    const held = await slider()
    const heldBefore = await writes()
    mouse('mouseDown', held.x, held.y)
    mouse('mouseMove', held.left + held.width * 0.5, held.y)
    await delay(100)
    await evaluate(`window.logBus.emit('level', { key: 'level', values: [[1, { rawValue: 10 }]] })`)
    await delay(100)
    mouse('mouseMove', held.left + held.width * 0.6, held.y)
    await delay(100)
    mouse('mouseUp', held.left + held.width * 0.6, held.y)
    await delay(150)
    const heldValue = (await slider()).value
    assert.ok(Math.abs(heldValue - 60) <= 2, `received value replaced drag: ${heldValue}`)
    assert.equal(
      (await writes()).slice(heldBefore.length).trim(),
      `ipc-var-set Level=${heldValue}`,
      'received value must not be written on release'
    )

    const click = await slider()
    mouse('mouseDown', click.left + click.width * 0.25, click.y)
    mouse('mouseUp', click.left + click.width * 0.25, click.y)
    await delay(150)
    assert.ok(Math.abs((await slider()).value - 25) <= 2, 'runway click must commit')

    await evaluate(`document.querySelector('[data-control-id="dimmer"] [role="slider"]').focus()`)
    const keyBefore = (await slider()).value
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Right' })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Right' })
    await delay(150)
    assert.equal((await slider()).value, keyBefore + 1)

    await evaluate(`(() => {
      const input = document.querySelector('[data-control-id="target"] input');
      input.value = '60';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
    })()`)
    await waitFor(
      `document.querySelector('[data-control-id="dimmer"] [role="slider"]').getAttribute('aria-valuenow') === '60'`
    )
    const receivedBefore = await writes()
    await evaluate(`window.logBus.emit('level', { key: 'level', values: [[0, { rawValue: 42 }]] })`)
    await waitFor(
      `document.querySelector('[data-control-id="dimmer"] [role="slider"]').getAttribute('aria-valuenow') === '42'`
    )
    assert.equal(await writes(), receivedBefore, 'received values must not write back')

    await evaluate(`document.querySelector('button').click()`)
    await delay(100)
    const disabled = await slider()
    const stoppedBefore = await writes()
    mouse('mouseDown', disabled.left + disabled.width * 0.8, disabled.y)
    mouse('mouseUp', disabled.left + disabled.width * 0.8, disabled.y)
    await delay(100)
    assert.equal(await writes(), stoppedBefore, 'stopped slider must not write')
    console.log(
      'Panel slider: drag, click, keyboard, numeric input, receive and stopped checks passed'
    )
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
