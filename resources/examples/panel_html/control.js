const panel = window.panel
const $ = (selector) => document.querySelector(selector)
const unsubscribe = []
let listening = false
let disposed = false

function showLevel(value) {
  $('#level').value = String(value)
  $('#level-value').textContent = `${value} %`
}
function showEnabled(value) {
  $('#enabled').checked = Number(value) === 1
}
function showSpeed(signal) {
  const value = Number(signal.physicalValue)
  $('#speed').textContent = Number.isFinite(value) ? value.toFixed(1) : '—'
}
async function run(action) {
  try {
    await action()
    $('#error').textContent = ''
  } catch (error) {
    $('#error').textContent = error.message
  }
}
async function readValues() {
  showLevel(await panel.getVar('HtmlLevel'))
  showEnabled(await panel.getVar('HtmlEnabled'))
  showSpeed(await panel.getSignal('HtmlDemo.Speed'))
  $('#received').textContent = `${await panel.getVar('HtmlRxTarget')} %`
  $('#count').textContent = String(await panel.getVar('HtmlRxCount'))
}
function stopListening() {
  unsubscribe.splice(0).forEach((off) => off())
  listening = false
  $('#listen').textContent = 'Subscribe'
}
async function startListening() {
  if (listening) return
  listening = true
  const subscriptions = [
    () => panel.onVar('HtmlLevel', showLevel),
    () => panel.onVar('HtmlEnabled', showEnabled),
    () =>
      panel.onVar('HtmlRxTarget', (value) => {
        $('#received').textContent = `${value} %`
      }),
    () =>
      panel.onVar('HtmlRxCount', (value) => {
        $('#count').textContent = String(value)
      }),
    () => panel.onSignal('HtmlDemo.Speed', showSpeed)
  ]
  try {
    for (const subscribe of subscriptions) {
      const off = await subscribe()
      if (disposed) off()
      else unsubscribe.push(off)
    }
    $('#listen').textContent = 'Unsubscribe'
  } catch (error) {
    stopListening()
    throw error
  }
}
$('#level').onchange = () => run(() => panel.setVar('HtmlLevel', Number($('#level').value)))
$('#enabled').onchange = () => run(() => panel.setVar('HtmlEnabled', $('#enabled').checked ? 1 : 0))
$('#send').onclick = () =>
  run(async () => {
    const target = Number($('#target').value)
    if (!Number.isFinite(target) || target < 0 || target > 100) throw new Error('Target: 0–100')
    // String values select physical conversion; numeric values select raw encoding.
    await panel.setSignal('HtmlDemo.Target', String(target))
  })
$('#read').onclick = () => run(readValues)
$('#listen').onclick = () =>
  run(async () => {
    if (listening) stopListening()
    else await startListening()
  })
async function refreshRunning() {
  const running = await panel.isRunning()
  $('#status').textContent = running ? 'Running' : 'Stopped'
  for (const selector of ['#level', '#enabled', '#target', '#send']) $(selector).disabled = !running
  if (!running) $('#speed').textContent = '—'
}
const timer = setInterval(() => run(refreshRunning), 500)
window.addEventListener('pagehide', () => {
  disposed = true
  clearInterval(timer)
  stopListening()
})
run(async () => {
  await startListening()
  await readValues()
  await refreshRunning()
})
