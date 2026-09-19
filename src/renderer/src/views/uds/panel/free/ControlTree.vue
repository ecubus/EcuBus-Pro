<template>
  <div
    v-for="control in children"
    :key="control.id"
    :data-control-id="control.id"
    class="panel-canvas-control"
    :class="{
      selected: editing && selected?.includes(control.id),
      editing,
      locked: isLocked(document, control)
    }"
    :style="{
      width: `${control.width}px`,
      height: `${control.height}px`,
      transform: `translate(${control.x}px, ${control.y}px)`
    }"
    @mousedown.stop="emit('select', $event, control)"
  >
    <template v-if="isContainer(control)">
      <div
        class="container-heading"
        :style="{ color: control.color || undefined, fontSize: `${control.fontSize}px` }"
      >
        <span v-if="control.type === 'group'" class="group-label">{{ control.label }}</span>
        <div
          v-else
          class="container-tabs"
          role="tablist"
          :aria-label="control.label"
          @mousedown.stop
        >
          <button
            v-for="page in control.tabs"
            :id="`panel-tab-${instanceId}-${page.id}`"
            :key="page.id"
            role="tab"
            :aria-selected="activePage(control, pages) === page.id"
            :aria-controls="`panel-page-${instanceId}-${control.id}`"
            :tabindex="activePage(control, pages) === page.id ? 0 : -1"
            @click="emit('page', control.id, page.id)"
            @keydown="tabKey($event, control, page.id)"
          >
            {{ page.label }}
          </button>
        </div>
      </div>
      <div
        :id="`panel-page-${instanceId}-${control.id}`"
        class="container-body"
        :style="{ top: `${containerHeader}px` }"
        :role="control.type === 'tabs' ? 'tabpanel' : undefined"
        :aria-labelledby="
          control.type === 'tabs'
            ? `panel-tab-${instanceId}-${activePage(control, pages)}`
            : undefined
        "
      >
        <ControlTree
          :document="document"
          :parent-id="control.id"
          :page-id="control.type === 'tabs' ? activePage(control, pages) : undefined"
          :pages="pages"
          :editing="editing"
          :selected="selected"
          :running="running"
          :values="values"
          :initial-values="initialValues"
          :disabled="disabled"
          :errors="errors"
          @select="(event, child) => emit('select', event, child)"
          @action="(id) => emit('action', id)"
          @write="(id, value) => emit('write', id, value)"
          @page="(id, page) => emit('page', id, page)"
        />
      </div>
    </template>
    <template v-else>
      <ControlView
        :running="running"
        :editing="editing"
        :control="control"
        :inert="editing || undefined"
        :value="
          values?.[control.id] ??
          (initialValues
            ? ['input', 'path'].includes(control.type)
              ? control.initialText || ''
              : control.initialValue
            : undefined)
        "
        :disabled="disabled?.[control.id] ?? control.readOnly"
        @action="emit('action', control.id)"
        @write="emit('write', control.id, $event)"
      />
      <span v-if="editing && control.binding" class="panel-bound-mark"></span>
      <span v-if="errors?.[control.id]" class="binding-error">{{ errors[control.id] }}</span>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue'
import type { PanelControl, PanelDocument } from 'src/preload/panel'
import type { PanelValue } from './runtime'
import { activePage, containerHeader, isContainer, isLocked } from './model'
import ControlView from './ControlView.vue'
const props = defineProps<{
  document: PanelDocument
  parentId?: string
  pageId?: string
  pages: Record<string, string>
  running?: boolean
  editing?: boolean
  selected?: string[]
  values?: Record<string, PanelValue>
  initialValues?: boolean
  disabled?: Record<string, boolean>
  errors?: Record<string, string>
}>()
const emit = defineEmits<{
  select: [event: MouseEvent, control: PanelControl]
  write: [id: string, value: PanelValue]
  action: [id: string]
  page: [id: string, page: string]
}>()
const instanceId = getCurrentInstance()!.uid
const children = computed(() =>
  props.document.controls.filter(
    (c) => c.parentId === props.parentId && (!props.pageId || c.tabId === props.pageId)
  )
)
function tabKey(event: KeyboardEvent, control: PanelControl, page: string) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  const tabs = control.tabs || []
  let index = tabs.findIndex((tab) => tab.id === page)
  index =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
  emit('page', control.id, tabs[index].id)
  const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll('button')
  buttons?.[index]?.focus()
}
</script>
<style scoped>
.panel-canvas-control {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
}
.panel-canvas-control:has(> .container-heading) {
  outline: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
}
.panel-canvas-control.editing {
  cursor: move;
  user-select: none;
}
.panel-canvas-control.editing:hover {
  outline: 1px solid var(--el-border-color);
}
.panel-canvas-control.editing > :deep(.panel-control-content) {
  pointer-events: none;
}
.panel-canvas-control.selected {
  outline: 1px solid var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.panel-canvas-control.locked {
  cursor: default;
}
.container-heading {
  height: 28px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  display: flex;
  align-items: center;
}
.group-label {
  padding: 0 8px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.container-tabs {
  display: flex;
  overflow: auto;
  width: 100%;
  height: 100%;
  scrollbar-width: thin;
}
.container-tabs button {
  flex-shrink: 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--el-text-color-secondary);
  padding: 0 10px;
  font: inherit;
  cursor: pointer;
}
.container-tabs button[aria-selected='true'] {
  color: var(--el-color-primary);
  border-bottom-color: var(--el-color-primary);
  background: var(--el-bg-color);
}
.container-tabs button:focus-visible {
  outline: 1px solid var(--el-color-primary);
  outline-offset: -2px;
}
.container-body {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  overflow: hidden;
}
.panel-bound-mark {
  position: absolute;
  right: 2px;
  top: 2px;
  width: 4px;
  height: 4px;
  background: var(--el-color-primary);
}
.binding-error {
  position: absolute;
  bottom: 0;
  right: 3px;
  font-size: 10px;
  color: var(--el-color-danger);
}
</style>
