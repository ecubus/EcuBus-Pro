<template>
  <div class="uds-graph">
    <div>
      <div
        style="
          display: flex;
          align-items: center;
          padding: 0 5px;

          border-bottom: solid 1px var(--el-border-color);
        "
      >
        <el-button-group>
          <el-tooltip effect="light" :content="isPaused ? 'Resume' : 'Pause'" placement="bottom">
            <el-button
              :type="isPaused ? 'success' : 'warning'"
              link
              :disabled="!globalStart"
              :class="{ 'pause-active': isPaused }"
              @click="isPaused = !isPaused"
            >
              <Icon :icon="isPaused ? playIcon : pauseIcon" />
            </el-button>
          </el-tooltip>
        </el-button-group>
        <el-divider direction="vertical"></el-divider>
        <el-button-group>
          <el-tooltip effect="light" content="Load Off-Line Trace File" placement="bottom">
            <el-button link type="primary" :disabled="globalStart" @click="loadOfflineTrace">
              <Icon :icon="addIcon" />
            </el-button>
          </el-tooltip>

          <el-divider direction="vertical"></el-divider>
          <el-tooltip effect="light" content="Save Trace To File" placement="bottom">
            <el-button link type="primary">
              <Icon :icon="saveIcon" />
            </el-button>
          </el-tooltip>
        </el-button-group>
        <span
          style="
            margin-right: 10px;
            font-size: 12px;
            color: var(--el-text-color-regular);
            margin-left: auto;
          "
        >
          Time: {{ time }}s
        </span>
      </div>
      <div class="main">
        <div class="left">
          <div class="core-container">
            <!-- Dynamic Core Sections -->
            <div v-for="core in coreConfigs" :key="core.id" class="core-section">
              <div class="core-label-vertical">
                <span class="core-text">{{ core.name }}</span>
              </div>
              <div class="button-group">
                <div
                  v-for="(button, buttonIndex) in core.buttons"
                  :key="`core${core.id}-${buttonIndex}`"
                  class="button-item"
                  :style="{
                    height: buttonHeight + 'px',
                    borderLeftColor: button.color,
                    borderRightColor: button.color
                  }"
                >
                  <div class="button-content">
                    <div
                      v-show="!globalStart"
                      class="arrow-left"
                      @click.stop="handleArrowClick('left', core.id, buttonIndex, button.name)"
                    >
                      <Icon :icon="'material-symbols:chevron-left'" />
                    </div>
                    <span class="button-text">{{ button.name }}</span>
                    <div
                      v-show="!globalStart"
                      class="arrow-right"
                      @click.stop="handleArrowClick('right', core.id, buttonIndex, button.name)"
                    >
                      <Icon :icon="'material-symbols:chevron-right'" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="controls-hint">
              <div class="hint-item">
                <kbd>Ctrl</kbd> + <Icon :icon="'material-symbols:mouse'" class="mouse-icon" /> to
                zoom
              </div>
              <div class="hint-item">
                <kbd>Alt</kbd> + <Icon :icon="'material-symbols:mouse'" class="mouse-icon" />/
                <kbd>Drag</kbd> to shift
              </div>
            </div>
          </div>
        </div>
        <div :id="`Shift-${charid}`" class="shift"></div>
        <!-- DOM-based separator lines with higher z-index -->
        <div
          v-for="(separator, index) in separatorPositions"
          :key="`separator-${index}`"
          class="separator-line"
          :style="{
            top: separator.y + 'px',
            left: 0,
            width: width - 10 + 'px'
          }"
        ></div>
        <div class="right">
          <canvas :id="charid" :width="width - leftWidth - 1" :height="height"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import pauseIcon from '@iconify/icons-material-symbols/pause-circle-outline'
import playIcon from '@iconify/icons-material-symbols/play-circle-outline'
import addIcon from '@iconify/icons-material-symbols/add-circle-outline'

import {
  ref,
  onMounted,
  computed,
  h,
  onUnmounted,
  watch,
  nextTick,
  watchEffect,
  onBeforeUnmount
} from 'vue'
import { Icon } from '@iconify/vue'
import { useDataStore } from '@r/stores/data'

import saveIcon from '@iconify/icons-material-symbols/save'
import testdata from './blocks.json'
import { useGlobalStart } from '@r/stores/runtime'
import { PixiGraphRenderer, type GraphConfig } from './PixiGraphRenderer'
import { IsrStatus, OsEvent, parseInfo, TaskStatus, TaskType, VisibleBlock } from 'nodeCan/osEvent'
import { useProjectStore } from '@r/stores/project'
import { ElLoading } from 'element-plus'
import DataHandlerWorker from './dataHandler.ts?worker'
const dataHandlerWorker = new DataHandlerWorker()
dataHandlerWorker.onmessage = (event) => {
  console.log('dataHandlerWorker', event.data)
}
const isPaused = ref(false)
const leftWidth = ref(200)
const props = defineProps<{
  height: number
  width: number
  editIndex: string
}>()

const dataStore = useDataStore()
const orti = computed(() => dataStore.database.orti[props.editIndex.replace('_trace', '')])
const height = computed(() => props.height - 19)

const charid = computed(() => `${props.editIndex}_graph`)

const width = computed(() => props.width)

const time = ref(0)
let pixiRenderer: PixiGraphRenderer | null = null
let timer: ReturnType<typeof setInterval> | null = null

// 更新时间显示的函数
const updateTime = () => {
  if (isPaused.value) return

  // 更新x轴范围和时间
  let maxX = 5
  let minX = 0

  const lastBlock = visibleBlocks.at(-1)
  if (lastBlock && lastBlock.end) {
    maxX = lastBlock.end
  }

  // 使用当前时间更新time值
  const ts = (Date.now() - window.startTime) / 1000

  if (ts > maxX) {
    maxX = ts
  }

  // 设置time值，与graph.vue保持一致
  time.value = maxX

  // 计算x轴范围
  maxX = Math.ceil(maxX) + 5
  minX = Math.floor(minX)

  // Update viewport range
  if (pixiRenderer) {
    pixiRenderer.updateViewport(minX, maxX)
  }
}
const globalStart = useGlobalStart()

const project = useProjectStore()

async function loadOfflineTrace() {
  const loading = ElLoading.service({ fullscreen: true })
  visibleBlocks = []
  try {
    const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
      defaultPath: project.projectInfo.path,
      title: 'Offline Trace File',
      properties: ['openFile'],
      filters: [{ name: 'excel', extensions: ['xlsx'] }]
    })
    const file = r.filePaths[0]
    if (file) {
      const res = await window.electron.ipcRenderer.invoke(
        'ipc-ostrace-parse-excel',
        file,
        orti.value.cpuFreq
      )
      visibleBlocks = res.blocks.slice(0, 400)

      console.log('visibleBlocks', visibleBlocks)

      if (pixiRenderer) {
        pixiRenderer.setBlocks(visibleBlocks)
        pixiRenderer.updateViewport(5, 6)
      }
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.close()
  }
}
// 确保定时器时间间隔与graph.vue保持一致
watch(globalStart, (val) => {
  if (val) {
    isPaused.value = false
    // 启动定时器更新时间，使用500ms间隔
    if (timer) clearInterval(timer)
    timer = setInterval(updateTime, 500)
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
})

// Dynamic core configuration - can be extended infinitely
const coreConfigs = computed(() => {
  const configs: {
    id: number
    name: string
    buttons: Array<{ name: string; color: string; id: number; type: number }>
  }[] = []
  for (const task of orti.value.coreConfigs) {
    //check if core is already in configs
    const core = configs.find((c) => c.id === task.coreId)
    if (!core) {
      configs.push({
        id: task.coreId,
        name: task.name,
        buttons: [
          {
            name: task.name,
            color: task.color,
            id: task.id,
            type: task.type
          }
        ]
      })
    }
    if (core) {
      core.buttons.push({
        name: task.name,
        color: task.color,
        id: task.id,
        type: task.type
      })
    }
  }
  return configs
})

// Computed property for total button count across all cores
const totalButtons = computed(() => {
  return coreConfigs.value.reduce((total, core) => total + core.buttons.length, 0)
})

const buttonHeight = computed(() => {
  // buttonHeight is the absolute height of each button including border
  const availableHeight = height.value - 45
  return availableHeight / totalButtons.value
})

// Computed property for separator line positions
const separatorPositions = computed(() => {
  const positions: Array<{ y: number }> = []
  let currentY = 0

  for (let i = 0; i < coreConfigs.value.length - 1; i++) {
    const core = coreConfigs.value[i]

    currentY += buttonHeight.value * core.buttons.length
    positions.push({ y: currentY }) // Align with button borders
  }
  //add bottom line - total buttons with borders between them
  const totalWithBorders = totalButtons.value * buttonHeight.value
  positions.push({ y: totalWithBorders })
  return positions
})

let visibleBlocks: VisibleBlock[] = testdata.slice(0, 100)
function updateTimeLine() {
  if (!pixiRenderer) return

  const currentTimeX = time.value
  pixiRenderer.updateTimeline(currentTimeX, globalStart.value)
}

watch([() => globalStart.value, () => time.value], () => {
  updateTimeLine()
})

async function initPixiGraph() {
  const canvas = document.getElementById(charid.value) as HTMLCanvasElement
  if (!canvas) return

  const config: GraphConfig = {
    width: width.value,
    height: height.value,
    leftWidth: leftWidth.value,
    totalButtons: totalButtons.value,
    buttonHeight: buttonHeight.value,
    coreConfigs: coreConfigs.value
  }

  try {
    pixiRenderer = await PixiGraphRenderer.create(canvas, config)
    pixiRenderer.setBlocks(visibleBlocks)
    pixiRenderer.updateViewport(7, 8.4)
  } catch (error) {
    console.error('Failed to initialize Pixi renderer:', error)
  }
}

// Example usage (commented out):
// To add a new core: addCore(2, 'Core 2', [{ name: 'NewTask', color: '#e67e22' }])
// To remove a core: removeCore(1)
// To add button to existing core: addButtonToCore(0, { name: 'NewButton', color: '#8e44ad' })

// Arrow click handler - shared function for both left and right arrows
const handleArrowClick = (
  direction: 'left' | 'right',
  coreId: number,
  buttonIndex: number,
  buttonName: string
) => {
  console.log(
    `Arrow clicked: ${direction}, Core: ${coreId}, Button Index: ${buttonIndex}, Button Name: ${buttonName}`
  )
}

// 监听暂停/恢复状态
watch(
  () => isPaused.value,
  (paused) => {
    if (paused && timer) {
      clearInterval(timer)
      timer = null
    } else if (!paused && globalStart.value) {
      if (timer) clearInterval(timer)
      timer = setInterval(updateTime, 500)
    }
  }
)
// Zoom and pan functionality is now handled by PixiGraphRenderer
onMounted(() => {
  // Wait for DOM to be ready
  nextTick(async () => {
    await initPixiGraph()
  })

  window.jQuery(`#Shift-${charid.value}`).resizable({
    handles: 'e',
    resize: (e, ui) => {
      leftWidth.value = ui.size.width
    },
    maxWidth: 300,
    minWidth: 100
  })

  if (globalStart.value) {
    timer = setInterval(updateTime, 500)
  }
})

watch(
  [
    () => width.value,
    () => leftWidth.value,
    () => totalButtons.value,
    () => buttonHeight.value,
    () => coreConfigs.value
  ],
  () => {
    // Update pixi renderer after resize
    nextTick(() => {
      if (pixiRenderer) {
        pixiRenderer.updateConfig({
          width: width.value,
          height: height.value,
          leftWidth: leftWidth.value,
          totalButtons: totalButtons.value,
          buttonHeight: buttonHeight.value,
          coreConfigs: coreConfigs.value
        })
        updateTimeLine()
      }
    })
  }
)

onBeforeUnmount(() => {
  // Cleanup pixi renderer
  if (pixiRenderer) {
    pixiRenderer.destroy()
    pixiRenderer = null
  }
})
onUnmounted(() => {
  dataHandlerWorker.terminate()
  // 清除定时器
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>
<style scoped>
.pause-active {
  box-shadow: inset 0 0 4px var(--el-color-info-light-5);
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
}

.main {
  position: relative;
  height: 100%;
  width: 100%;
}

.left {
  position: absolute;
  top: 0px;
  left: 0px;
  width: v-bind(leftWidth + 'px');
  z-index: 2;
  /* changed from 1 to 2 */
  height: v-bind(height + 'px');
  overflow: hidden;
  overflow-x: hidden;
  overflow-y: auto;
}

.shift {
  position: absolute;
  top: 0px;
  left: 0px;
  width: v-bind(leftWidth + 1 + 'px');
  height: v-bind(height + 'px');
  z-index: 1;
  /* changed from 0 to 3 */
  border-right: solid 1px var(--el-border-color);
}

.shift:hover {
  border-right: solid 4px var(--el-color-primary);
  cursor: col-resize;
}

.shift:active {
  border-right: solid 4px var(--el-color-primary);
}

.right {
  position: absolute;
  right: 0;
  width: v-bind(width - leftWidth - 1 + 'px');
  height: v-bind(height + 'px');
  z-index: 1;
  overflow: hidden;
  /* 改为 hidden 以防止滚动条影响画布 */
}

.border-bottom {
  border-bottom: solid 1px var(--el-border-color);
  background-color: var(--el-background-color);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.core-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.core-section {
  display: flex;
  flex-direction: row;
}

.core-label-vertical {
  width: 24px;
  background-color: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-lr;
  text-orientation: mixed;
  position: relative;
}

.core-text {
  font-weight: 600;
  font-size: 12px;
  color: var(--el-text-color-primary);
  transform: rotate(180deg);
  white-space: nowrap;
}

.button-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.button-item {
  position: relative;
  display: flex;
  align-items: center;
  border-left: 20px solid;
  border-right: 20px solid;
  background-color: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.8;
  margin-left: 0;
  /* Force pixel-perfect rendering and prevent sub-pixel rendering */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  box-sizing: border-box;
  -webkit-box-sizing: border-box;
}

.button-item::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background-color: var(--el-border-color-lighter);
  transform: scaleY(1);
  -webkit-transform: scaleY(1);
}

.button-item:hover {
  opacity: 1;

  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.button-content {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 8px;
  position: relative;
}

.button-text {
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arrow-left,
.arrow-right {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  color: white;
  font-size: 20px;
  z-index: 10;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow-left {
  left: -20px;
}

.arrow-right {
  right: -20px;
}

.button-item:hover .arrow-left,
.button-item:hover .arrow-right {
  opacity: 0.8;
}

.button-item:hover .arrow-left:hover,
.button-item:hover .arrow-right:hover {
  opacity: 1;
  transform: translateY(-50%) scale(1.2);
}

.separator-line {
  position: absolute;
  height: 1px;
  background-color: var(--el-color-info-dark-2);
  z-index: 1000;
  pointer-events: none;
}

.controls-hint {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color-overlay);
  padding: 4px 8px;
  border-radius: 4px;
  /* border: 1px solid var(--el-border-color-light); */
  margin-top: 4px;
  max-height: 40px;
  overflow: hidden;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hint-item kbd {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 2px;
  padding: 1px 4px;
  font-size: 10px;
  font-family: monospace;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
  line-height: 1;
}

.mouse-icon {
  font-size: 12px;
  color: var(--el-text-color-regular);
}
</style>

<style>
.node-menu {
  padding: 0;
}
</style>

<style lang="scss">
.el-popover.el-popper {
  min-width: 100px !important;
  padding: 0 !important;
  box-shadow: var(--el-box-shadow-light) !important;
  border: 1px solid var(--el-border-color-lighter) !important;

  &.node-menu {
    padding: 0 !important;
    background: var(--el-bg-color) !important;
  }
}
</style>
