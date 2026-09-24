<template>
  <section class="free-panel-runtime" :style="{ height: `${height}px` }">
    <div class="runtime-status">
      <span :class="{ running }">{{ t(running ? 'running' : 'stopped') }}</span
      ><span v-if="invalidCount">{{ t('issues') }}: {{ invalidCount }}</span>
    </div>
    <div class="runtime-scroll">
      <div
        class="runtime-stage"
        :style="{ width: `${document.width}px`, height: `${document.height}px` }"
      >
        <ControlTree
          :running="running"
          :document="document"
          :values="values"
          :disabled="disabledControls"
          :errors="bindingErrors"
          :pages="pages"
          @write="(id, value) => write(document.controls.find((c) => c.id === id)!, value)"
          @action="performAction"
          @page="(id, page) => (pages[id] = page)"
        />
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { Layout } from '../../layout'
import { useProjectStore } from '@r/stores/project'
import { actionAvailable, isActionButton, selectPath } from './actions'
import { getAllSysVar } from 'nodeCan/sysVar'
import type { PanelControl, PanelDocument } from 'src/preload/panel'
import { useDataStore } from '@r/stores/data'
import { useGlobalStart } from '@r/stores/runtime'
import {
  canWrite,
  physicalWriteAvailable,
  PanelConnection,
  sendControlValue,
  signalWriteIsUnique,
  type PanelValue
} from './runtime'
import ControlTree from './ControlTree.vue'
import { usePanelLocale } from './locale'
const props = defineProps<{ document: PanelDocument; height: number }>()
const data = useDataStore()
const project = useProjectStore()
const layout = inject<Layout | undefined>('layout', undefined)
const pending = ref<Record<string, boolean>>({})
const running = useGlobalStart()
const t = usePanelLocale()
const values = ref<Record<string, PanelValue>>({})
const pages = ref<Record<string, string>>({})
const disabledControls = computed(() =>
  Object.fromEntries(
    props.document.controls.map((c) => [
      c.id,
      !!pending.value[c.id] ||
        (isActionButton(c)
          ? !actionAvailable(c, running.value, (id) => !!data.panels[id])
          : !running.value ||
            !valid.value[c.id] ||
            ambiguous.value[c.id] ||
            !physicalWriteAvailable(c, data.database) ||
            !canWrite(c))
    ])
  )
)
const bindingErrors = computed(() =>
  Object.fromEntries(
    props.document.controls.map((c) => [
      c.id,
      c.binding && !valid.value[c.id]
        ? t('invalid')
        : ambiguous.value[c.id]
          ? t('ambiguous')
          : !physicalWriteAvailable(c, data.database)
            ? t('physicalUnavailable')
            : ''
    ])
  )
)
const variables = computed(() => ({
  ...data.vars,
  ...getAllSysVar(data.devices, data.tester, data.database.orti)
}))
const valid = computed(() =>
  Object.fromEntries(
    props.document.controls.map((control) => {
      const binding = control.binding
      let exists = false
      if (binding?.kind === 'variable') {
        const target = binding.node.bindValue
        const variable = variables.value[target.variableId]
        if (variable?.value && variable.type === target.variableType) {
          const path = [variable.name]
          let parent = variable.parentId
          const seen = new Set<string>()
          while (parent && !seen.has(parent)) {
            seen.add(parent)
            const item = variables.value[parent]
            if (!item) break
            path.unshift(item.name)
            parent = item.parentId
          }
          exists =
            path.join('.') === target.variableFullName &&
            variable.value.type === target.variableValueType
        }
      } else if (binding?.kind === 'signal') {
        const target = binding.node.bindValue
        const can = data.database.can[target.dbKey]
        const lin = data.database.lin[target.dbKey]
        exists =
          !!(
            can?.name === target.dbName &&
            can.messages.some(
              (m) => m.id === target.frameId && m.signals.some((s) => s.name === target.signalName)
            )
          ) || !!(lin?.name === target.dbName && lin.signals[target.signalName])
      }
      return [control.id, exists]
    })
  )
)
const ambiguous = computed(() =>
  Object.fromEntries(
    props.document.controls.map((c) => [
      c.id,
      canWrite(c) && !signalWriteIsUnique(c.binding!, data.database)
    ])
  )
)
const invalidCount = computed(
  () =>
    props.document.controls.filter(
      (c) => c.binding && (!valid.value[c.id] || ambiguous.value[c.id])
    ).length
)
const validIds = computed(() =>
  props.document.controls
    .filter((c) => valid.value[c.id])
    .map((c) => c.id)
    .join('\n')
)
let session = 0
const connection = new PanelConnection(window.logBus, (id, value) => {
  values.value[id] = value
})
watch(
  [() => props.document, running, validIds],
  () => {
    session++
    connection.disconnect()
    values.value = {}
    if (running.value) connection.connect(props.document.controls.filter((c) => valid.value[c.id]))
  },
  { immediate: true, deep: true }
)
function write(control: PanelControl, value: PanelValue) {
  if (
    !valid.value[control.id] ||
    ambiguous.value[control.id] ||
    !physicalWriteAvailable(control, data.database)
  )
    return
  if (
    sendControlValue(control, value, running.value, (channel, payload) =>
      window.electron.ipcRenderer.send(channel, payload)
    )
  )
    values.value[control.id] = value
}
let disposed = false
async function performAction(id: string) {
  const control = props.document.controls.find((c) => c.id === id)
  if (!control || disabledControls.value[id]) return
  const startedSession = session
  pending.value[id] = true
  try {
    if (control.type === 'startStop') {
      data.globalRun(running.value ? 'stop' : 'start')
    } else if (control.type === 'path') {
      const path = await selectPath(
        control.pathMode,
        String(values.value[id] ?? ''),
        (channel, options) => window.electron.ipcRenderer.invoke(channel, options)
      )
      // A dialog can outlive the panel or the running measurement.
      if (
        path !== undefined &&
        !disposed &&
        startedSession === session &&
        props.document.controls.find((c) => c.id === id) === control
      )
        write(control, path)
    } else if (control.buttonAction === 'openFile') {
      const absolute = window.electron.ipcRenderer.sendSync(
        'ipc-path-is-absolute',
        control.actionPath
      )
      const path = absolute
        ? control.actionPath
        : window.electron.ipcRenderer.sendSync(
            'ipc-path-join',
            project.projectInfo.path,
            control.actionPath
          )
      await window.electron.ipcRenderer.invoke('ipc-open-path', path)
    } else if (control.buttonAction === 'openPanel') {
      const target = control.actionPanelId!
      if (layout) {
        await layout.addWin('panelPreview', `p${target}`, {
          params: { 'edit-index': `p${target}` },
          name: data.panels[target].name
        })
      } else {
        window.electron.ipcRenderer.send('ipc-open-window', {
          id: `p${target}`,
          path: 'panelPreview',
          'edit-index': `p${target}`,
          name: data.panels[target].name,
          w: 900,
          h: 600
        })
      }
    } else if (control.buttonAction === 'start' || control.buttonAction === 'stop') {
      data.globalRun(control.buttonAction)
    }
  } catch {
    if (!disposed) ElMessage.error(t('actionFailed'))
  } finally {
    delete pending.value[id]
  }
}
onUnmounted(() => {
  disposed = true
  connection.disconnect()
})
</script>
<style scoped>
.free-panel-runtime {
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}
.runtime-status {
  display: flex;
  gap: 20px;
  padding: 6px 12px;
  font-size: 11px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-secondary);
}
.runtime-status .running {
  color: var(--el-color-success);
}
.runtime-scroll {
  overflow: auto;
  flex: 1;
}
.runtime-stage {
  position: relative;
}
</style>
