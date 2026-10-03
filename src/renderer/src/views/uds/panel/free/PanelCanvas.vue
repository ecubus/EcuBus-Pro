<template>
  <div
    ref="viewport"
    class="panel-viewport"
    tabindex="-1"
    @scroll="refresh"
    @pointerdown.self="emit('select', [])"
  >
    <div
      class="panel-canvas-space"
      :style="{
        width: `${document.width * zoom + 64}px`,
        height: `${document.height * zoom + 64}px`
      }"
    >
      <div
        ref="stage"
        class="panel-stage"
        :class="{ 'show-grid': !preview && snap }"
        :style="{
          width: `${document.width}px`,
          height: `${document.height}px`,
          transform: `scale(${zoom})`
        }"
      >
        <ControlTree
          :document="document"
          :editing="!preview"
          :selected="selected"
          :values="values"
          :pages="pages"
          initial-values
          @select="selectControl"
          @write="(id, value) => emit('write', id, value)"
          @page="(id, page) => emit('page', id, page)"
        />
      </div>
      <template v-if="!preview">
        <button
          v-for="direction in ['e', 's', 'se'] as const"
          :key="direction"
          class="canvas-resize-handle"
          :class="`canvas-resize-${direction}`"
          :aria-label="t('resizeCanvas')"
          :style="{
            left: `${32 + document.width * zoom * (direction === 's' ? 0.5 : 1)}px`,
            top: `${32 + document.height * zoom * (direction === 'e' ? 0.5 : 1)}px`
          }"
          @pointerdown.stop.prevent="startCanvasResize($event, direction)"
          @pointermove.stop="moveCanvasResize"
          @pointerup.stop="endCanvasResize"
          @pointercancel.stop="cancelCanvasResize"
          @lostpointercapture="cancelCanvasResize"
        />
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Moveable from 'moveable'
import Selecto from 'selecto'
import type { PanelControl, PanelDocument } from 'src/preload/panel'
import type { PanelValue } from './runtime'
import {
  boundControl,
  cloneDocument,
  isLocked,
  selectionRoots,
  minimumSize,
  resizeCanvas
} from './model'
import { usePanelLocale } from './locale'
import ControlTree from './ControlTree.vue'

const props = defineProps<{
  document: PanelDocument
  selected: string[]
  zoom: number
  snap: boolean
  preview: boolean
  values?: Record<string, PanelValue>
  pages: Record<string, string>
}>()
const emit = defineEmits<{
  change: [document: PanelDocument]
  resize: [document: PanelDocument, done: boolean]
  select: [ids: string[]]
  write: [id: string, value: PanelValue]
  page: [id: string, page: string]
}>()
const viewport = ref<HTMLElement>()
const stage = ref<HTMLElement>()
const t = usePanelLocale()
let canvasDrag:
  | {
      pointerId: number
      element: HTMLElement
      x: number
      y: number
      zoom: number
      direction: 'e' | 's' | 'se'
      before: PanelDocument
      current: PanelDocument
    }
  | undefined
function startCanvasResize(event: PointerEvent, direction: 'e' | 's' | 'se') {
  if (event.button !== 0 || canvasDrag) return
  const element = event.currentTarget as HTMLElement
  const before = cloneDocument(props.document)
  canvasDrag = {
    pointerId: event.pointerId,
    element,
    x: event.clientX,
    y: event.clientY,
    zoom: props.zoom,
    direction,
    before,
    current: before
  }
  emit('select', [])
  element.setPointerCapture(event.pointerId)
  window.addEventListener('keydown', canvasResizeKey, true)
}
function moveCanvasResize(event: PointerEvent) {
  const drag = canvasDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  const document = cloneDocument(drag.before)
  const snap = (value: number) => (props.snap ? Math.round(value / 8) * 8 : value)
  resizeCanvas(
    document,
    drag.direction === 's'
      ? drag.before.width
      : snap(drag.before.width + (event.clientX - drag.x) / drag.zoom),
    drag.direction === 'e'
      ? drag.before.height
      : snap(drag.before.height + (event.clientY - drag.y) / drag.zoom)
  )
  drag.current = document
  emit('resize', document, false)
}
function endCanvasResize(event: PointerEvent) {
  if (canvasDrag?.pointerId !== event.pointerId) return
  moveCanvasResize(event)
  finishCanvasResize(false)
}
function cancelCanvasResize() {
  finishCanvasResize(true)
}
function finishCanvasResize(cancel: boolean) {
  const drag = canvasDrag
  if (!drag) return
  canvasDrag = undefined
  window.removeEventListener('keydown', canvasResizeKey, true)
  if (drag.element.hasPointerCapture(drag.pointerId))
    drag.element.releasePointerCapture(drag.pointerId)
  emit('resize', cancel ? drag.before : drag.current, !cancel)
}
function canvasResizeKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopImmediatePropagation()
  cancelCanvasResize()
}
let moveable: Moveable | undefined
let selecto: Selecto | undefined
let observer: ResizeObserver | undefined
let currentTargets: HTMLElement[] = []
let targetReady = Promise.resolve()
const targets = () =>
  Array.from(stage.value?.querySelectorAll<HTMLElement>('.panel-canvas-control') || []).filter(
    (el) =>
      selectionRoots(props.document, props.selected).includes(el.dataset.controlId!) &&
      !isLocked(props.document, props.document.controls.find((c) => c.id === el.dataset.controlId)!)
  )
async function refresh() {
  await nextTick()
  if (!moveable) return
  if (moveable.isDragging()) return
  const nextTargets = props.preview ? [] : targets()
  if (
    nextTargets.length !== currentTargets.length ||
    nextTargets.some((target, index) => target !== currentTargets[index])
  ) {
    currentTargets = nextTargets
    targetReady = moveable.waitToChangeTarget()
    moveable.target = nextTargets.length === 1 ? nextTargets[0] : nextTargets
  }
  await targetReady
  if (!moveable || moveable.isDragging()) return
  moveable.snappable = props.snap
  moveable.snapGridWidth = props.snap ? 8 : 0
  moveable.snapGridHeight = props.snap ? 8 : 0
  moveable.elementGuidelines = props.snap
    ? Array.from(stage.value!.querySelectorAll<HTMLElement>('.panel-canvas-control')).filter(
        (el) =>
          !nextTargets.some((target) => target === el || target.contains(el) || el.contains(target))
      )
    : []
  moveable.zoom = 1 / props.zoom
  moveable.updateRect()
  selecto?.setSelectedTargets(targets())
  if (selecto)
    selecto.selectableTargets = Array.from(
      stage.value!.querySelectorAll<HTMLElement>('.panel-canvas-control')
    )
}
async function selectControl(event: MouseEvent, control: PanelControl) {
  if (props.preview || event.button !== 0) return
  event.stopPropagation()
  event.preventDefault()
  viewport.value?.focus({ preventScroll: true })
  const ids = event.shiftKey
    ? props.selected.includes(control.id)
      ? props.selected.filter((id) => id !== control.id)
      : [...props.selected, control.id]
    : props.selected.includes(control.id)
      ? props.selected
      : [control.id]
  emit('select', ids)
  await refresh()
  if (!isLocked(props.document, control) && ids.includes(control.id)) moveable?.dragStart(event)
}
function start(event: { target: HTMLElement | SVGElement; set: (value: number[]) => void }) {
  const control = props.document.controls.find(
    (c) => c.id === (event.target as HTMLElement).dataset.controlId
  )
  if (control) event.set([control.x, control.y])
}
function finish() {
  const document = cloneDocument(props.document)
  targets().forEach((el) => {
    const control = document.controls.find((c) => c.id === el.dataset.controlId)!
    const matrix = new DOMMatrix(el.style.transform)
    control.x = matrix.m41
    control.y = matrix.m42
    control.width = Math.round(parseFloat(el.style.width))
    control.height = Math.round(parseFloat(el.style.height))
    boundControl(control, document)
    el.style.transform = `translate(${control.x}px, ${control.y}px)`
    el.style.width = `${control.width}px`
    el.style.height = `${control.height}px`
  })
  emit('change', document)
  void refresh()
}
onMounted(() => {
  moveable = new Moveable(stage.value!, {
    target: [],
    container: stage.value,
    draggable: true,
    resizable: true,
    origin: false,
    snappable: true,
    snapGridWidth: 8,
    snapGridHeight: 8,
    throttleResize: 1,
    renderDirections: ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'],
    elementSnapDirections: {
      left: true,
      right: true,
      top: true,
      bottom: true,
      center: true,
      middle: true
    },
    snapDirections: { left: true, right: true, top: true, bottom: true, center: true, middle: true }
  })
  moveable
    .on('dragStart', start)
    .on('drag', (e) => {
      e.target.style.transform = e.transform
    })
    .on('dragEnd', finish)
    .on('dragGroupStart', (e) => e.events.forEach(start))
    .on('dragGroup', (e) =>
      e.events.forEach((event) => {
        event.target.style.transform = event.transform
      })
    )
    .on('dragGroupEnd', finish)
    .on('resizeStart', (e) => {
      const control = props.document.controls.find(
        (c) => c.id === (e.target as HTMLElement).dataset.controlId
      )!
      const minimum = minimumSize(control, props.document)
      e.setMin([minimum.width, minimum.height])
      if (e.dragStart) start({ target: e.target, set: e.dragStart.set })
    })
    .on('resize', (e) => {
      e.target.style.width = `${e.width}px`
      e.target.style.height = `${e.height}px`
      e.target.style.transform = e.drag.transform
    })
    .on('resizeEnd', finish)
  selecto = new Selecto({
    container: viewport.value,
    dragContainer: stage.value,
    selectableTargets: Array.from(
      stage.value!.querySelectorAll<HTMLElement>('.panel-canvas-control')
    ),
    selectByClick: false,
    selectFromInside: false,
    hitRate: 0,
    toggleContinueSelect: 'shift',
    keyContainer: viewport.value
  })
  selecto
    .on('dragStart', (e) => {
      const target = e.inputEvent.target as HTMLElement
      if (
        props.preview ||
        target.closest('.moveable-control-box') ||
        target.closest('.panel-canvas-control')
      )
        e.stop()
    })
    .on('selectEnd', (e) =>
      emit(
        'select',
        e.selected.map((el) => (el as HTMLElement).dataset.controlId!)
      )
    )
  observer = new ResizeObserver(() => void refresh())
  observer.observe(viewport.value!)
  void refresh()
})
watch(
  () => [props.document, props.selected, props.zoom, props.snap, props.preview, props.pages],
  refresh,
  {
    deep: true
  }
)
watch(
  () => props.selected.length,
  (length) => {
    if (moveable) moveable.resizable = length === 1
  }
)
watch(
  () => props.document.controls.length,
  async () => {
    await nextTick()
    if (selecto)
      selecto.selectableTargets = Array.from(
        stage.value!.querySelectorAll<HTMLElement>('.panel-canvas-control')
      )
  }
)
onUnmounted(() => {
  window.removeEventListener('keydown', canvasResizeKey, true)
  canvasDrag = undefined
  observer?.disconnect()
  moveable?.destroy()
  selecto?.destroy()
  moveable = undefined
  selecto = undefined
})
</script>
<style scoped>
.canvas-resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  padding: 0;
  border: 1px solid var(--el-color-primary);
  background: var(--el-bg-color);
  transform: translate(-50%, -50%);
  touch-action: none;
  z-index: 2;
}
.canvas-resize-e {
  cursor: ew-resize;
}
.canvas-resize-s {
  cursor: ns-resize;
}
.canvas-resize-se {
  cursor: nwse-resize;
}
.panel-viewport {
  height: 100%;
  min-width: 0;
  overflow: auto;
  background: var(--el-fill-color-light);
  position: relative;
}
.panel-canvas-space {
  position: relative;
  min-width: 100%;
  min-height: 100%;
}
.panel-stage {
  position: absolute;
  left: 32px;
  top: 32px;
  transform-origin: top left;
  background-color: var(--el-bg-color);
  outline: 1px solid var(--el-border-color);
  box-shadow: 0 2px 8px #0000000a;
}
.panel-stage.show-grid {
  background-image: radial-gradient(var(--el-border-color) 1px, transparent 1px);
  background-size: 8px 8px;
}
.panel-stage :deep(.moveable-control-box) {
  --moveable-color: var(--el-color-primary);
}
</style>
