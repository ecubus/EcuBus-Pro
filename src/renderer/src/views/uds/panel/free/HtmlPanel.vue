<template>
  <iframe
    ref="frame"
    class="panel-html-frame"
    :srcdoc="srcdoc"
    sandbox="allow-scripts"
    :title="control.label"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getAllSysVar } from 'nodeCan/sysVar'
import { useDataStore } from '@r/stores/data'
import type { PanelControl } from 'src/preload/panel'

const props = defineProps<{
  control: PanelControl
  running?: boolean
  editing?: boolean
}>()

const data = useDataStore()
const frame = ref<HTMLIFrameElement>()
const latest = new Map<string, unknown>()
const subscriptions = new Map<number, { key: string; name: string; kind: 'variable' | 'signal' }>()
const keySubscriptions = new Map<string, Set<number>>()
const keyListeners = new Map<string, (payload: any) => void>()
let nextSubscription = 0

const BRIDGE_BOOTSTRAP = `(() => {
  let requestId = 0
  const pending = new Map()
  const callbacks = new Map()
  const request = (method, args) => new Promise((resolve, reject) => {
    const id = ++requestId
    pending.set(id, { resolve, reject })
    window.parent.postMessage({ channel: 'ecubus-panel', type: 'request', id, method, args }, '*')
  })
  window.addEventListener('message', event => {
    if (event.source !== window.parent || !event.data || event.data.channel !== 'ecubus-panel') return
    const message = event.data
    if (message.type === 'response') {
      const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id)
      message.error ? item.reject(new Error(message.error)) : item.resolve(message.result)
    } else if (message.type === 'event') {
      const callback = callbacks.get(message.subscriptionId)
      if (callback) callback(message.value)
    }
  })
  const subscribe = (kind, name, callback) => request('subscribe', [kind, name]).then(id => {
    callbacks.set(id, callback)
    return () => {
      callbacks.delete(id)
      window.parent.postMessage({ channel: 'ecubus-panel', type: 'request', id: ++requestId, method: 'unsubscribe', args: [id] }, '*')
    }
  })
  window.panel = {
    getVar: name => request('getVar', [name]),
    setVar: (name, value) => request('setVar', [name, value]),
    getSignal: name => request('getSignal', [name]),
    setSignal: (name, value) => request('setSignal', [name, value]),
    onVar: (name, callback) => subscribe('variable', name, callback),
    onSignal: (name, callback) => subscribe('signal', name, callback),
    isRunning: () => request('isRunning', [])
  }
})()`

function escapeScript(value: string) {
  return value.replace(/<\/script/gi, '<\\/script')
}

const SCRIPT_END = '<' + '/script>'
const srcdoc = computed(
  () => `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;width:100%;height:100%;overflow:auto;color:#303133;background:transparent}*{box-sizing:border-box}</style><script>${escapeScript(BRIDGE_BOOTSTRAP)}${SCRIPT_END}</head><body>${escapeScript(props.control.htmlContent || '')}<script>${escapeScript(props.editing ? '' : props.control.scriptContent || '')}${SCRIPT_END}</body></html>`
)

function allVariables() {
  return {
    ...data.vars,
    ...getAllSysVar(data.devices, data.tester, data.database.orti)
  }
}

function variableName(id: string, variables: Record<string, any>) {
  const item = variables[id]
  if (!item) return ''
  const names = [item.name]
  const seen = new Set([id])
  let parent = item.parentId
  while (parent && !seen.has(parent)) {
    seen.add(parent)
    const parentItem = variables[parent]
    if (!parentItem) break
    names.unshift(parentItem.name)
    parent = parentItem.parentId
  }
  return names.join('.')
}

function findVariable(name: string) {
  const variables = allVariables()
  const entry = Object.entries(variables).find(
    ([id, item]) => variableName(id, variables) === name || item.name === name
  )
  return entry ? { id: entry[0], item: entry[1] } : undefined
}

function variableValue(item: any) {
  return item?.value?.value ?? item?.value?.initValue
}

function findSignal(name: string) {
  const [dbName, signalName] = name.split('.', 2)
  if (!dbName || !signalName) return undefined
  const can = Object.values(data.database.can).find((item) => item.name === dbName)
  if (can) {
    const matches = can.messages.flatMap((message) =>
      message.signals
        .filter((signal) => signal.name === signalName)
        .map((signal) => ({
          signal,
          key: `can.${can.name}.${message.name}.signals.${signal.name}`
        }))
    )
    return matches.length === 1 ? matches[0] : undefined
  }
  const lin = Object.values(data.database.lin).find((item) => item.name === dbName)
  const signal = lin?.signals[signalName]
  const frame =
    lin &&
    Object.values(lin.frames).find((item) =>
      item.signals.some((itemSignal) => itemSignal.name === signalName)
    )
  return lin && signal && frame
    ? { signal, key: `lin.${lin.name}.${frame.name}.signals.${signalName}` }
    : undefined
}

function signalValue(signal: any) {
  const rawValue = signal.rawValue ?? signal.value
  const physicalValue = signal.physValueEnum ?? signal.physValue ?? signal.value
  return {
    name: signal.name || signal.signalName,
    value: physicalValue,
    rawValue,
    physicalValue
  }
}

function post(message: unknown) {
  frame.value?.contentWindow?.postMessage({ channel: 'ecubus-panel', ...(message as object) }, '*')
}

function notify(key: string, value: unknown) {
  latest.set(key, value)
  for (const id of keySubscriptions.get(key) || [])
    post({ type: 'event', subscriptionId: id, value })
}

function attachKey(key: string) {
  if (keyListeners.has(key)) return
  const listener = (payload: any) => {
    const latestValue = payload?.values?.[payload.values.length - 1]?.[1]
    if (!latestValue) return
    notify(
      key,
      key.startsWith('can.') || key.startsWith('lin.')
        ? signalValue(latestValue)
        : latestValue.rawValue
    )
  }
  keyListeners.set(key, listener)
  window.logBus.on(key, listener)
}

function detachKey(key: string) {
  if (keySubscriptions.get(key)?.size) return
  const listener = keyListeners.get(key)
  if (listener) window.logBus.off(key, listener)
  keyListeners.delete(key)
}

function respond(id: number, result?: unknown, error?: unknown) {
  post({ type: 'response', id, result, error: error instanceof Error ? error.message : error })
}

function handleRequest(message: { id: number; method: string; args: any[] }) {
  const [name, value] = message.args || []
  try {
    if (message.method === 'isRunning') return respond(message.id, !!props.running)
    if (message.method === 'getVar') {
      const variable = findVariable(String(name))
      if (!variable) throw new Error(`Variable ${name} not found`)
      return respond(message.id, latest.get(variable.id) ?? variableValue(variable.item))
    }
    if (message.method === 'setVar') {
      if (!props.running) throw new Error('Panel is stopped')
      const variable = findVariable(String(name))
      if (!variable) throw new Error(`Variable ${name} not found`)
      const variableType = variable.item.value?.type
      if (
        (variableType === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) ||
        (variableType === 'string' && typeof value !== 'string') ||
        (variableType === 'array' &&
          (!Array.isArray(value) ||
            value.some((item) => typeof item !== 'number' || !Number.isFinite(item))))
      )
        throw new Error(`Invalid value for variable ${name}`)
      window.electron.ipcRenderer.send('ipc-var-set', {
        name: variableName(variable.id, allVariables()),
        value
      })
      notify(variable.id, value)
      return respond(message.id, true)
    }
    if (message.method === 'getSignal') {
      const target = findSignal(String(name))
      if (!target) throw new Error(`Signal ${name} not found or is ambiguous`)
      const current = latest.get(target.key)
      return respond(message.id, current || signalValue(target.signal))
    }
    if (message.method === 'setSignal') {
      if (!props.running) throw new Error('Panel is stopped')
      const target = findSignal(String(name))
      if (!target) throw new Error(`Signal ${name} not found or is ambiguous`)
      window.electron.ipcRenderer.send('ipc-signal-set', { name: String(name), value })
      return respond(message.id, true)
    }
    if (message.method === 'subscribe') {
      const kind = name as 'variable' | 'signal'
      const target = kind === 'variable' ? findVariable(String(value)) : findSignal(String(value))
      if (!target) throw new Error(`${kind} ${value} not found or is ambiguous`)
      const key = kind === 'variable' ? (target as any).id : (target as any).key
      const id = ++nextSubscription
      subscriptions.set(id, { key, name: String(value), kind })
      let ids = keySubscriptions.get(key)
      if (!ids) keySubscriptions.set(key, (ids = new Set()))
      ids.add(id)
      attachKey(key)
      return respond(message.id, id)
    }
    if (message.method === 'unsubscribe') {
      const subscription = subscriptions.get(Number(name))
      if (subscription) {
        subscriptions.delete(Number(name))
        const ids = keySubscriptions.get(subscription.key)
        ids?.delete(Number(name))
        if (ids?.size === 0) {
          keySubscriptions.delete(subscription.key)
          detachKey(subscription.key)
        }
      }
      return respond(message.id, true)
    }
    throw new Error(`Unknown panel API: ${message.method}`)
  } catch (error) {
    respond(message.id, undefined, error)
  }
}

function onMessage(event: MessageEvent) {
  if (event.source !== frame.value?.contentWindow || !event.data) return
  const message = event.data
  if (message.channel === 'ecubus-panel' && message.type === 'request') handleRequest(message)
}

onMounted(() => window.addEventListener('message', onMessage))
onUnmounted(() => {
  window.removeEventListener('message', onMessage)
  keyListeners.forEach((listener, key) => window.logBus.off(key, listener))
  keyListeners.clear()
  subscriptions.clear()
  keySubscriptions.clear()
})
</script>

<style scoped>
.panel-html-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
}
</style>
