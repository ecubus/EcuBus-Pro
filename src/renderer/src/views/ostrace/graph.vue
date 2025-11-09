<template>
  <div class="uds-graph">
    <div>
      <div
        style="
          display: flex;
          align-items: center;
          padding: 0 5px;
          height: 25px;
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

        <el-tooltip effect="light" content="Load Off-Line Trace File" placement="bottom">
          <el-button link type="primary" :disabled="globalStart" @click="loadOfflineTrace">
            <Icon :icon="addIcon" />
          </el-button>
        </el-tooltip>
        <el-tooltip
          effect="light"
          content="Load offline data into a new trace window and link"
          placement="bottom"
        >
          <el-checkbox
            v-model="linkTrace"
            size="small"
            label="Link Trace"
            style="margin-left: 10px"
          />
        </el-tooltip>

        <el-divider direction="vertical"></el-divider>
        <el-tooltip effect="light" content="Remove Selection" placement="bottom">
          <el-button link type="primary" :disabled="!selectStart" @click="removeSelection">
            <Icon :icon="cursorIcon" />
          </el-button>
        </el-tooltip>
        <div style="margin-left: auto; display: flex; align-items: center; gap: 10px">
          <span style="margin-right: 10px; font-size: 12px; color: var(--el-text-color-regular)">
            Time: {{ time }}s
          </span>
        </div>
      </div>
      <div class="main">
        <div class="left">
          <div ref="leftContainerRef" class="core-container">
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
          </div>
          <div class="controls-hint">
            <!-- <div class="hint-item">
              <kbd>Ctrl</kbd> + <Icon :icon="'material-symbols:mouse'" class="mouse-icon" /> to zoom
            </div> -->
            <div v-if="toolTipInfo" class="hint-item">
              {{ formattedTooltip }}
            </div>
          </div>
        </div>
        <div :id="`Shift-${charid}`" class="shift"></div>
        <!-- DOM-based separator lines with higher z-index -->

        <div class="right">
          <div style="display: flex; justify-content: center">
            <canvas :id="charid"></canvas>
            <div :id="`main-vscroll-${charid}`"></div>
          </div>
          <div
            :id="`main-timer-${charid}`"
            :style="{ height: styleConfig.axisHeight + 'px' }"
          ></div>
          <div
            :id="`main-navi-${charid}`"
            :style="{ height: styleConfig.navigatorHeight + 'px' }"
          ></div>
          <div v-if="selectStart" class="selection-cursor" :style="selectStartStyle">
            <div class="selection-cursor-label">{{ selectStartText }}</div>
          </div>
          <div v-if="selectEnd" class="selection-cursor" :style="selectEndStyle">
            <div class="selection-cursor-label">{{ selectEndText }}</div>
          </div>
        </div>
        <div class="divider"></div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import pauseIcon from '@iconify/icons-material-symbols/pause-circle-outline'
import playIcon from '@iconify/icons-material-symbols/play-circle-outline'
import addIcon from '@iconify/icons-material-symbols/add-circle-outline'
import cursorIcon from '@iconify/icons-ph/cursor-text-bold'
import {
  ref,
  onMounted,
  computed,
  h,
  onUnmounted,
  watch,
  nextTick,
  watchEffect,
  onBeforeUnmount,
  defineExpose
} from 'vue'
import { Icon } from '@iconify/vue'
import { useDataStore } from '@r/stores/data'

import saveIcon from '@iconify/icons-material-symbols/save'
// import testdata from './blocks.json'
import { useGlobalStart, useRuntimeStore } from '@r/stores/runtime'
// import { PixiGraphRenderer, type GraphConfig } from './PixiGraphRenderer'
import {
  IsrStatus,
  OsEvent,
  parseInfo,
  ResourceStatus,
  SpinlockStatus,
  TaskStatus,
  TaskType,
  isrStatusRecord,
  taskStatusRecord,
  taskTypeRecord
} from 'nodeCan/osEvent'
import { useProjectStore } from '@r/stores/project'
import { ElLoading } from 'element-plus'
import DataHandlerWorker from './dataHandler.ts?worker'
import { TimeGraphContainer } from './timeline/time-graph-container'
import { TimeGraphUnitController } from './timeline/time-graph-unit-controller'
import { TimeGraphChartGrid } from './timeline/layer/time-graph-chart-grid'
import { TimeGraphChart, TimeGraphChartProviders } from './timeline/layer/time-graph-chart'
import { TimeGraphChartArrows } from './timeline/layer/time-graph-chart-arrows'
import { TimeGraphChartSelectionRange } from './timeline/layer/time-graph-chart-selection-range'
import { TimeGraphChartCursors } from './timeline/layer/time-graph-chart-cursors'
import { TimeGraphRangeEventsLayer } from './timeline/layer/time-graph-range-events-layer'
import { TimeGraphRowController } from './timeline/time-graph-row-controller'
import { TimelineChart } from './timeline/time-graph-model'
import { TimeGraphStateStyle } from './timeline/components/time-graph-state'
import { TimeGraphVerticalScrollbar } from './timeline/layer/time-graph-vertical-scrollbar'
import { TimeGraphNavigator } from './timeline/layer/time-graph-navigator'
import { TimeGraphAxisCursors } from './timeline/layer/time-graph-axis-cursors'
import { TimeGraphAxis } from './timeline/layer/time-graph-axis'
import { cloneDeep, method } from 'lodash'
import { getColorFromCssVar } from './timeline/color'

const dataHandlerWorker = new DataHandlerWorker()
let startOffset: bigint = 0n
let startOffset1: bigint = 0n
let startOffsetNumber: number = 0
let offlineLoading: any = null
let lastEventTs: number = 0
const workerRowIds = ref<number[]>([])
let pendingDataResolve:
  | (
      | undefined
      | ((data: {
          rows: TimelineChart.TimeGraphRowModel[]
          range: TimelineChart.TimeGraphRange
          resolution: number
        }) => void)
    )
  | null = null
let pendingFindStateResolve:
  | (
      | undefined
      | ((data: { id?: string; start?: bigint; event?: OsEvent; nextEvent?: OsEvent }) => void)
    )
  | null = null
dataHandlerWorker.onmessage = (event) => {
  const msg = event.data
  if (!msg || !msg.type) return
  if (msg.type === 'loaded') {
    if (linkTrace.value) {
      window.dataParseWorker.postMessage({
        method: 'initDataBase',
        data: cloneDeep(dataStore.database)
      })
      window.dataParseWorker.postMessage({
        method: 'osEvent',
        data: msg.payload.events
      })
    }
    startOffsetNumber = 0
    workerRowIds.value = msg.payload.rowIds || []
    startOffset = BigInt(msg.payload.start || 0)
    startOffset1 = startOffset
    unitController.absoluteRange = BigInt(msg.payload.totalLength || 0)

    unitController.viewRange = {
      start: BigInt(0),
      end: BigInt(msg.payload.totalLength || 0)
    }
    if (rowController) {
      rowController.totalHeight = buttonHeight * workerRowIds.value.length
    }
    if (offlineLoading) {
      offlineLoading.close()
      offlineLoading = null
    }
  } else if (msg.type === 'data') {
    const resolver = pendingDataResolve
    pendingDataResolve = null
    if (resolver) resolver(msg.payload)
  } else if (msg.type === 'foundState') {
    const resolver = pendingFindStateResolve
    pendingFindStateResolve = null
    if (resolver) resolver(msg.payload)
  } else if (msg.type === 'rowIds') {
    workerRowIds.value = msg.payload.rowIds
    if (rowController) {
      rowController.totalHeight = buttonHeight * workerRowIds.value.length
    }
  }
}
const isPaused = ref(false)
const leftWidth = ref(200)
const props = defineProps<{
  height: number
  width: number
  editIndex: string
}>()
const linkTrace = ref(true)
const dataStore = useDataStore()
const orti = computed(() => dataStore.database.orti[props.editIndex.replace('_time', '')])
const height = computed(() => props.height - 25)
const charid = computed(() => `${props.editIndex}_graph`)

const width = computed(() => props.width)

const time = ref(0)
const styleMap = new Map<string, TimeGraphStateStyle>()
let timer: ReturnType<typeof setInterval> | null = null
const timerInterval = 200

// 更新时间显示的函数
const updateTime = () => {
  if (isPaused.value) return

  // 更新x轴范围和时间
  let maxX = lastEventTs / 1000000

  // 使用当前时间更新time值
  const ts = (Date.now() - window.startTime) / 1000

  if (ts > maxX) {
    maxX = ts
  }

  // 设置time值，与graph.vue保持一致
  time.value = maxX

  // 计算x轴范围
  maxX -= startOffsetNumber / 1000000
  // startOffset = BigInt(Math.floor(Math.max(0,(maxX - 5)) * 1000000))
  // const middle = BigInt(Math.floor(Math.min(5,maxX) * 1000000))

  unitController.absoluteRange = BigInt(Math.floor((maxX + 3) * 1000000))

  unitController.viewRange = {
    start: BigInt(Math.floor((maxX - 0.4 - 0.1) * 1000000)),
    end: BigInt(Math.floor((maxX - 0.4 + 0.1) * 1000000))
  }
}
const globalStart = useGlobalStart()

const project = useProjectStore()

async function loadOfflineTrace() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv,text/csv'
  input.style.display = 'none'

  document.body.appendChild(input)
  input.onchange = () => {
    const file = input.files && input.files[0]
    document.body.removeChild(input)
    if (!file) return
    offlineLoading = ElLoading.service({ fullscreen: true })
    dataHandlerWorker.postMessage({
      type: 'loadCsv',
      payload: {
        file,
        cpuFreq: orti.value.cpuFreq,
        coreConfigs: cloneDeep(coreConfigs.value),
        database: orti.value.id
      }
    })
  }
  input.click()
}
function startFunc() {
  lastEventTs = 0
  startOffsetNumber = 0
  startOffset = BigInt(0)
  startOffset1 = startOffset
  unitController.absoluteRange = BigInt(0)

  dataHandlerWorker.postMessage({
    type: 'getRowIds',
    payload: {
      coreConfigs: cloneDeep(coreConfigs.value)
    }
  })
  isPaused.value = false
  // 启动定时器更新时间，使用500ms间隔
  if (timer) clearInterval(timer)
  timer = setInterval(updateTime, timerInterval)
}
// 确保定时器时间间隔与graph.vue保持一致
watch(globalStart, (val) => {
  if (val) {
    startFunc()
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
    buttons: Array<{ name: string; color: string; id: string; numberId: number }>
  }[] = []

  for (const task of orti.value.coreConfigs) {
    //check if core is already in configs
    const core = configs.find((c) => c.id === task.coreId)
    if (!core) {
      configs.push({
        id: task.coreId,
        name: `Core ${task.coreId}`,
        buttons: [
          {
            name: task.name,
            color: task.color,
            id: `${task.coreId}_${task.id}_${task.type}`,
            numberId: Number(task.coreId) * 1000000 + Number(task.id) * 1000 + Number(task.type) * 1
          }
        ]
      })
    }
    if (core) {
      core.buttons.push({
        name: task.name,
        color: task.color,
        id: `${task.coreId}_${task.id}_${task.type}`,
        numberId: Number(task.coreId) * 1000000 + Number(task.id) * 1000 + Number(task.type) * 1
      })
    }
  }
  return configs
})

const buttonHeight = 32

// Ref for the left container (which contains core-container)
const leftContainerRef = ref<HTMLElement | null>(null)

// API methods to control y-axis offset
const setYOffset = (offset: number) => {
  if (leftContainerRef.value) {
    leftContainerRef.value.scrollTop = offset
  }
}
const runtimeStore = useRuntimeStore()

const graphWidth = computed(() => width.value - leftWidth.value - 1 - 10)
const graphHeight = computed(() => height.value - 45)
const unitController = new TimeGraphUnitController(BigInt(0))
unitController.worldRenderFactor = 20

function formatTimeLabel(theNumber: bigint): string {
  theNumber = theNumber + startOffset
  const MICRO_IN_MS = BigInt(1000)
  const MICRO_IN_S = BigInt(1000_000)

  const span = unitController.viewRangeLength

  const formatWithUnit = (
    value: bigint,
    divisor: bigint,
    fractionDigits: number,
    suffix: string
  ) => {
    const intPart = value / divisor
    const remainder = value % divisor
    if (fractionDigits <= 0 || remainder === BigInt(0)) {
      return `${intPart.toString()}${suffix}`
    }
    const scale = BigInt(10) ** BigInt(fractionDigits)
    const dec = (remainder * scale) / divisor
    let decStr = dec.toString().padStart(fractionDigits, '0')
    decStr = decStr.replace(/0+$/g, '')
    return decStr.length > 0
      ? `${intPart.toString()}.${decStr}${suffix}`
      : `${intPart.toString()}${suffix}`
  }

  if (span >= MICRO_IN_S) {
    return formatWithUnit(theNumber, MICRO_IN_S, 3, 's')
  } else if (span >= MICRO_IN_MS) {
    return formatWithUnit(theNumber, MICRO_IN_MS, 3, 'ms')
  }
  return `${theNumber.toString()}us`
}

unitController.numberTranslator = (theNumber: bigint) => formatTimeLabel(theNumber)

let timeGraphChartContainer: TimeGraphContainer | null = null
let rowController: TimeGraphRowController | null = null
let timeGraphChart: TimeGraphChart | null = null
let verticalScrollContainer: TimeGraphContainer | null = null
let vscrollLayer: TimeGraphVerticalScrollbar | null = null
let timeGraphAxisContainer: TimeGraphContainer | null = null
let timeAxisLayer: TimeGraphAxis | null = null
let naviLayer: TimeGraphNavigator | null = null
let naviContainer: TimeGraphContainer | null = null

const styleConfig = {
  // Canvas and layer backgrounds (Element Plus vars)
  chartBackgroundColor: getColorFromCssVar('--el-bg-color', '#ffffff'),
  vscrollWidth: 10,
  vscrollBackgroundColor: getColorFromCssVar('--el-color-white', '#ffffff'),
  axisHeight: 23,
  axisBackgroundColor: getColorFromCssVar('--el-bg-color', '#ffffff'),
  axisColor: getColorFromCssVar('--el-color-black', '#303133'),
  axisVerticalAlign: 'top' as 'top' | 'bottom',
  navigatorHeight: 18,
  navigatorBackgroundColor: getColorFromCssVar('--el-color-white', '#ffffff'),

  // Interaction layers
  selectionRangeColor: getColorFromCssVar('--el-color-primary', '#409EFF'),
  cursorsColor: getColorFromCssVar('--el-color-primary', '#409EFF'),

  // Row styles
  rowBackgroundColor: getColorFromCssVar('--el-color-warning-light-7', '#f5f7fa'),
  rowBackgroundOpacitySelected: 0.6,
  rowLineColorHasStates: getColorFromCssVar('--el-border-color', '#dcdfe6'),
  rowLineColorNoStates: getColorFromCssVar('--el-border-color', '#dcdfe6'),
  rowLineThicknessHasStates: 1,
  rowLineThicknessNoStates: 1
}
function destroyGraph() {
  unitController.removeSelectionRangeChangedHandler(onSelectionRangeChange)
  unitController.removeViewRangeChangedHandler(removeSelection)
  if (timeGraphChartContainer) {
    timeGraphChartContainer.destroy()
    timeGraphChartContainer = null
  }
  if (vscrollLayer) {
    vscrollLayer.destroy()
    vscrollLayer = null
  }
  if (verticalScrollContainer) {
    verticalScrollContainer.destroy()
    verticalScrollContainer = null
  }
  if (rowController) {
    rowController.removeVerticalOffsetChangedHandler(setYOffset)
  }
  if (timeAxisLayer) {
    timeAxisLayer.destroy()
    timeAxisLayer = null
  }
  if (timeGraphAxisContainer) {
    timeGraphAxisContainer.destroy()
    timeGraphAxisContainer = null
  }
}
const toolTipInfo = ref<{
  cur: OsEvent
  next: OsEvent
} | null>(null)

// 获取状态 label
function getStatusLabel(type: TaskType, status: number): string {
  switch (type) {
    case TaskType.TASK:
      return taskStatusRecord[status as TaskStatus] || `Status ${status}`
    case TaskType.ISR:
      return isrStatusRecord[status as IsrStatus] || `Status ${status}`
    case TaskType.SPINLOCK:
      return status === SpinlockStatus.LOCKED ? 'Locked' : 'Unlocked'
    case TaskType.RESOURCE:
      return status === ResourceStatus.START ? 'Start' : 'Stop'
    case TaskType.HOOK:
      return `Hook ${status}`
    case TaskType.SERVICE:
      return `Service ${status}`
    case TaskType.LINE:
      return 'Line'
    default:
      return `Status ${status}`
  }
}

// 获取任务/ISR等的名字
function getEventName(event: OsEvent): string {
  const buttonId = `${event.coreId}_${event.id}_${event.type}`
  const core = coreConfigs.value.find((c) => c.id === event.coreId)
  if (core) {
    const button = core.buttons.find((b) => b.id === buttonId)
    if (button) {
      return button.name
    }
  }
  return `ID ${event.id}`
}

// 格式化 tooltip 中的时间（处理 loadCsv 和 runtime 模式的差异）
function formatTooltipTime(eventTs: number): string {
  // In loadCsv mode (startOffsetNumber === 0), event.ts is already absolute time
  // In runtime mode, event.ts is relative time, need to add startOffset
  const absoluteTime = startOffsetNumber === 0 ? BigInt(eventTs) : BigInt(eventTs) + startOffset

  const MICRO_IN_MS = BigInt(1000)
  const MICRO_IN_S = BigInt(1000_000)
  const span = unitController.viewRangeLength

  const formatWithUnit = (
    value: bigint,
    divisor: bigint,
    fractionDigits: number,
    suffix: string
  ) => {
    const intPart = value / divisor
    const remainder = value % divisor
    if (fractionDigits <= 0 || remainder === BigInt(0)) {
      return `${intPart.toString()}${suffix}`
    }
    const scale = BigInt(10) ** BigInt(fractionDigits)
    const dec = (remainder * scale) / divisor
    let decStr = dec.toString().padStart(fractionDigits, '0')
    decStr = decStr.replace(/0+$/g, '')
    return decStr.length > 0
      ? `${intPart.toString()}.${decStr}${suffix}`
      : `${intPart.toString()}${suffix}`
  }

  if (span >= MICRO_IN_S) {
    return formatWithUnit(absoluteTime, MICRO_IN_S, 3, 's')
  } else if (span >= MICRO_IN_MS) {
    return formatWithUnit(absoluteTime, MICRO_IN_MS, 3, 'ms')
  }
  return `${absoluteTime.toString()}us`
}

// 格式化 tooltip 信息
function formatTooltipInfo(event: OsEvent, showName: boolean = true): string {
  const typeLabel = taskTypeRecord[event.type] || `Type ${event.type}`
  const statusLabel = getStatusLabel(event.type, event.status)
  const timeLabel = formatTooltipTime(event.ts)
  if (showName) {
    const name = getEventName(event)
    return `${name} (${typeLabel}: ${statusLabel}) @ ${timeLabel}`
  }
  return `(${typeLabel}: ${statusLabel}) @ ${timeLabel}`
}

// 格式化时间差值（不需要加上 startOffset）
function formatTimeDelta(delta: bigint): string {
  const absDelta = delta >= 0n ? delta : -delta
  const MICRO_IN_MS = BigInt(1000)
  const MICRO_IN_S = BigInt(1000_000)

  const formatWithUnit = (
    value: bigint,
    divisor: bigint,
    fractionDigits: number,
    suffix: string
  ) => {
    const intPart = value / divisor
    const remainder = value % divisor
    if (fractionDigits <= 0 || remainder === BigInt(0)) {
      return `${intPart.toString()}${suffix}`
    }
    const scale = BigInt(10) ** BigInt(fractionDigits)
    const dec = (remainder * scale) / divisor
    let decStr = dec.toString().padStart(fractionDigits, '0')
    decStr = decStr.replace(/0+$/g, '')
    return decStr.length > 0
      ? `${intPart.toString()}.${decStr}${suffix}`
      : `${intPart.toString()}${suffix}`
  }

  // 根据差值大小选择合适的单位
  if (absDelta >= MICRO_IN_S) {
    return formatWithUnit(absDelta, MICRO_IN_S, 3, 's')
  } else if (absDelta >= MICRO_IN_MS) {
    return formatWithUnit(absDelta, MICRO_IN_MS, 3, 'ms')
  }
  return `${absDelta.toString()}us`
}

// 格式化完整的 tooltip 信息，包括差值
const formattedTooltip = computed(() => {
  if (!toolTipInfo.value) return ''
  const cur = toolTipInfo.value.cur
  const next = toolTipInfo.value.next
  const curText = formatTooltipInfo(cur, true)
  const nextText = formatTooltipInfo(next, false)

  // 计算时间差值
  const delta = BigInt(next.ts) - BigInt(cur.ts)
  const deltaLabel = formatTimeDelta(delta)

  return `${curText} -> ${nextText} (Δ: ${deltaLabel})`
})
function initPixiGraph() {
  destroyGraph()

  const canvas = document.getElementById(charid.value) as HTMLCanvasElement
  if (!canvas) return
  timeGraphChartContainer = new TimeGraphContainer(
    {
      id: charid.value,
      height: graphHeight.value,
      width: graphWidth.value,
      backgroundColor: styleConfig.chartBackgroundColor
    },
    unitController,
    canvas
  )
  const providers: TimeGraphChartProviders = {
    rowProvider: () => {
      return {
        rowIds: workerRowIds.value
      }
    },
    dataProvider: (range: TimelineChart.TimeGraphRange, resolution: number) => {
      return new Promise<{
        rows: TimelineChart.TimeGraphRowModel[]
        range: TimelineChart.TimeGraphRange
        resolution: number
      }>((resolve) => {
        pendingDataResolve = resolve

        dataHandlerWorker.postMessage({
          type: 'getData',
          payload: { range, resolution }
        })
      })
    },
    stateStyleProvider: (model: TimelineChart.TimeGraphState) => {
      const stringColor2number = (color: string) => {
        //rbg(xx,xx,xx)
        const rgb = color.match(/rgb\((\d+),(\d+),(\d+)\)/)
        if (rgb) {
          return parseInt(rgb[1]) * 65536 + parseInt(rgb[2]) * 256 + parseInt(rgb[3])
        }
        return parseInt(color.replace('#', ''), 16)
      }
      const data = model.data as { cur: OsEvent; next: OsEvent }
      const key = `${data.cur.coreId}_${data.cur.id}_${data.cur.type}`
      const rid = `${data.cur.coreId}_${data.cur.id}_${data.cur.type}_${data.cur.status}`
      const style: TimeGraphStateStyle =
        styleMap.get(rid) ||
        ({
          color: 0x000000,
          height: buttonHeight * 0.9
        } as TimeGraphStateStyle)
      if (!styleMap.has(rid)) {
        const data = model.data as { cur: OsEvent; next: OsEvent }

        const core = coreConfigs.value.find((c) => c.id === data.cur.coreId)
        if (core) {
          const button = core.buttons.find((b) => b.id === key)
          if (button) {
            style.color = stringColor2number(button.color)
            if (data.cur.type === TaskType.TASK) {
              if (data.cur.status === TaskStatus.ACTIVE) {
                style.height = buttonHeight * 0.2
              }
            }
          }
        }
        styleMap.set(rid, style)
      }
      return {
        color: style.color,
        height: style.height,
        borderWidth: model.selected ? 1 : 0,
        minWidthForLabels: 100
      }
    },
    rowStyleProvider: (row?: TimelineChart.TimeGraphRowModel) => {
      return {
        backgroundColor: styleConfig.rowBackgroundColor,
        backgroundOpacity: row?.selected ? styleConfig.rowBackgroundOpacitySelected : 0,
        lineColor:
          row?.data && row?.data.hasStates
            ? styleConfig.rowLineColorHasStates
            : styleConfig.rowLineColorNoStates,
        lineThickness:
          row?.data && row?.data.hasStates
            ? styleConfig.rowLineThicknessHasStates
            : styleConfig.rowLineThicknessNoStates
      }
    },
    rowAnnotationStyleProvider: (annotation: TimelineChart.TimeGraphAnnotation) => {
      return {
        color: annotation.data?.color,
        size: 7 * (annotation.data && annotation.data.height ? annotation.data.height : 1.0),
        symbol: annotation.data?.symbol,
        verticalAlign: annotation.data?.verticalAlign,
        opacity: annotation.data?.opacity
      }
    }
  }

  // const timeGraphChartGridLayer = new TimeGraphChartGrid('timeGraphGrid', buttonHeight.value)

  rowController = new TimeGraphRowController(buttonHeight, buttonHeight * workerRowIds.value.length)
  rowController.onVerticalOffsetChangedHandler(setYOffset)

  timeGraphChart = new TimeGraphChart(`timeGraphChart-${charid.value}`, providers, rowController)
  // const timeGraphChartArrows = new TimeGraphChartArrows('timeGraphChartArrows', rowController);
  const timeGraphSelectionRange = new TimeGraphChartSelectionRange(
    `chart-selection-range-${charid.value}`,
    {
      color: styleConfig.selectionRangeColor
    }
  )
  timeGraphChart.registerMouseInteractions({
    click: (el) => {
      if (!globalStart.value) {
        toolTipInfo.value = {
          cur: el.model.data.cur,
          next: el.model.data.next
        }
        // Set traceLinkId when clicking on a state
        if (linkTrace.value && el.model.data.cur) {
          const event = el.model.data.cur as OsEvent
          const key = `${orti.value.name}-${orti.value.name}-${taskTypeRecord[event.type]}.${event.id}_${event.coreId}-${(event.ts + startOffsetNumber).toFixed(0)}`
          runtimeStore.setTraceLinkId(key)
        }
      } else {
        toolTipInfo.value = null
      }
    }
  })
  const timeGraphChartCursors = new TimeGraphChartCursors(
    `chart-cursors-${charid.value}`,
    timeGraphChart,
    rowController,
    { color: styleConfig.cursorsColor }
  )
  // const timeGraphChartRangeEvents = new TimeGraphRangeEventsLayer(
  //   `timeGraphChartRangeEvents-${charid.value}`,
  //   providers
  // )

  timeGraphChartContainer.addLayers([
    timeGraphChart,
    timeGraphSelectionRange,
    timeGraphChartCursors
    // timeGraphChartRangeEvents
  ])
  const yUnitController = new TimeGraphUnitController(BigInt(1))
  verticalScrollContainer = new TimeGraphContainer(
    {
      width: styleConfig.vscrollWidth,
      height: graphHeight.value,
      id: charid.value + '_vscroll',
      backgroundColor: styleConfig.vscrollBackgroundColor
    },
    yUnitController
  )
  vscrollLayer = new TimeGraphVerticalScrollbar(
    `timeGraphVerticalScrollbar-${charid.value}`,
    rowController
  )
  verticalScrollContainer.addLayers([vscrollLayer])
  const vscrollElement = document.getElementById(`main-vscroll-${charid.value}`) as HTMLElement
  if (vscrollElement) {
    vscrollElement.appendChild(verticalScrollContainer.canvas)
  }

  // time axis
  timeGraphAxisContainer = new TimeGraphContainer(
    {
      width: graphWidth.value,
      height: styleConfig.axisHeight,
      id: `main-timer-${charid.value}`,
      backgroundColor: styleConfig.axisBackgroundColor
    },
    unitController
  )
  const timerElement = document.getElementById(`main-timer-${charid.value}`) as HTMLElement
  if (timerElement) {
    timerElement.appendChild(timeGraphAxisContainer.canvas)

    timeAxisLayer = new TimeGraphAxis(`timeGraphAxis-${charid.value}`, {
      lineColor: styleConfig.axisColor,

      verticalAlign: styleConfig.axisVerticalAlign
    })
    timeGraphAxisContainer.addLayers([timeAxisLayer])
  }
  naviContainer = new TimeGraphContainer(
    {
      width: graphWidth.value,
      height: styleConfig.navigatorHeight,
      id: `main-navi-${charid.value}`,
      backgroundColor: styleConfig.navigatorBackgroundColor
    },
    unitController
  )
  const naviElement = document.getElementById(`main-navi-${charid.value}`) as HTMLElement
  if (naviElement) {
    naviElement.appendChild(naviContainer.canvas)
  }
  naviLayer = new TimeGraphNavigator(`timeGraphNavigator-${charid.value}`)
  naviContainer.addLayers([naviLayer])
}
watch(
  () => runtimeStore.traceLinkIdBack,
  (linkId) => {
    if (!linkId || !timeGraphChart) return

    // Parse linkId format: instance-instance-TaskType.id_coreId-time
    // Example: Os_Trace_high-Os_Trace_high-Task.2_0-0.549969
    const parts = linkId.split('-')
    if (parts.length < 4) return

    const instance = parts[0]
    const taskTypePart = parts[2] // TaskType.id_coreId
    const timeStr = parts[3] // time in seconds

    // Check if instance matches current orti
    if (instance !== orti.value.name) return

    // Parse taskType.id_coreId
    const taskTypeMatch = taskTypePart.match(/^(.+)\.(\d+)_(\d+)$/)
    if (!taskTypeMatch) return

    const taskTypeName = taskTypeMatch[1] // e.g., "Task"
    const taskId = parseInt(taskTypeMatch[2])
    const coreId = parseInt(taskTypeMatch[3])
    const timeUs = parseFloat(timeStr)

    // Find taskType from name
    const taskType = Object.entries(taskTypeRecord).find(([_, name]) => name === taskTypeName)?.[0]
    if (!taskType) return

    // Find corresponding button/rowId
    const core = coreConfigs.value.find((c) => c.id === coreId)
    if (!core) return

    const button = core.buttons.find((b) => {
      const [bCoreId, bId, bType] = b.id.split('_')
      return (
        parseInt(bCoreId) === coreId &&
        parseInt(bId) === taskId &&
        parseInt(bType) === parseInt(taskType)
      )
    })
    if (!button) return

    const targetRowId = button.numberId
    const rowIndex = workerRowIds.value.indexOf(targetRowId)
    if (rowIndex < 0) return

    // Ensure row is visible (scroll to row)
    timeGraphChart.selectAndReveal(rowIndex)

    // Convert time to microseconds (bigint)
    // traceLinkId contains absolute time in seconds: (event.ts + startOffsetNumber) / 1000000
    // So we need to convert back to relative time by subtracting startOffsetNumber
    const absoluteTimeUs = Math.floor(timeUs)
    const relativeTimeUs = absoluteTimeUs - startOffsetNumber

    const targetTimeUs = BigInt(Math.max(0, relativeTimeUs)) - startOffset1

    // Get current view range width to keep it unchanged
    const currentViewRange = unitController.viewRange
    const viewWidth = currentViewRange.end - currentViewRange.start

    // Calculate new view range centered on target time, keeping width unchanged
    const half = viewWidth / BigInt(2)
    let newStart = targetTimeUs > half ? targetTimeUs - half : BigInt(0)
    let newEnd = newStart + viewWidth

    // Clamp to absolute range
    if (newEnd > unitController.absoluteRange) {
      newEnd = unitController.absoluteRange
      newStart = newEnd > viewWidth ? newEnd - viewWidth : BigInt(0)
    }

    // Update view range (move to target time, keep width)
    unitController.viewRange = { start: newStart, end: newEnd }

    // Set selection at target time
    unitController.selectionRange = { start: targetTimeUs, end: targetTimeUs }
  }
)
// Arrow click handler - shared function for both left and right arrows
const handleArrowClick = async (
  direction: 'left' | 'right',
  coreId: number,
  buttonIndex: number,
  buttonName: string
) => {
  // 1) Resolve target row id from core/button
  const core = coreConfigs.value.find((c) => c.id === coreId)
  const button = core?.buttons?.[buttonIndex]
  if (!button) return
  const targetRowId = button.numberId

  // 2) Find row index in current chart
  const rowIndex = workerRowIds.value.indexOf(targetRowId)
  if (rowIndex < 0 || !timeGraphChart) return

  // 3) Ensure the row is at least selected and visible
  timeGraphChart.selectAndReveal(rowIndex)

  // 4) Ask worker to find the next/prev state by id
  const currentCursor = unitController.selectionRange
    ? unitController.selectionRange.end
    : undefined
  const workerPromise = new Promise<{
    id?: string
    start?: bigint
    event?: OsEvent
    nextEvent?: OsEvent
  }>((resolve) => {
    pendingFindStateResolve = resolve
  })
  dataHandlerWorker.postMessage({
    type: 'findState',
    payload: { direction, rowId: targetRowId, cursor: currentCursor }
  })
  const found = await workerPromise
  if (!found || found.start === undefined) return
  const newPos: bigint = found.start

  if (linkTrace.value) {
    const event = found.event as OsEvent

    if (event) {
      const key = `${orti.value.name}-${orti.value.name}-${taskTypeRecord[event.type]}.${event.id}_${event.coreId}-${(event.ts + startOffsetNumber).toFixed(0)}`
      runtimeStore.setTraceLinkId(key)
    }
  }
  // 5) Ensure view includes the new position (prefer centering around it)
  {
    const { start: vStart, end: vEnd } = unitController.viewRange
    if (newPos < vStart || newPos > vEnd) {
      const windowLen = unitController.viewRangeLength
      const half = windowLen / BigInt(2)
      let start = newPos > half ? newPos - half : BigInt(0)
      let end = start + windowLen
      if (end > unitController.absoluteRange) {
        end = unitController.absoluteRange
        start = end - windowLen
        if (start < 0) start = BigInt(0)
      }
      unitController.viewRange = { start, end }
    }
  }

  // 6) Now set selection so it is guaranteed inside view range
  unitController.selectionRange = { start: newPos, end: newPos }

  // 7) Highlight the state using the chart by id and update tooltip
  if (found.id) {
    const stateComp = timeGraphChart.getStateById(found.id)
    if (stateComp) {
      toolTipInfo.value = {
        cur: stateComp.model.data!.cur,
        next: stateComp.model.data!.next
      }
      timeGraphChart.selectState(stateComp.model)
    } else if (found.event) {
      // If state component not found but event exists, use event and nextEvent from worker
      const nextEvent = found.nextEvent || found.event
      toolTipInfo.value = {
        cur: found.event,
        next: nextEvent
      }
    }
  } else if (found.event) {
    // If no id but event exists, use event and nextEvent from worker
    const nextEvent = found.nextEvent || found.event
    toolTipInfo.value = {
      cur: found.event,
      next: nextEvent
    }
  }
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
      timer = setInterval(updateTime, timerInterval)
    }
  }
)
const selectStart = ref<bigint | undefined>(undefined)
const selectEnd = ref<bigint | undefined>(undefined)
const selectStartText = computed(() => {
  if (!selectStart.value) return ''
  return formatTimeLabel(selectStart.value)
})
const selectEndText = computed(() => {
  if (!selectEnd.value) return ''
  const endStr = formatTimeLabel(selectEnd.value)
  if (selectStart.value === undefined) return endStr
  const delta = selectEnd.value - selectStart.value
  const sign = delta >= 0n ? '+' : '-'
  const abs = delta >= 0n ? delta : -delta
  const diffStr = formatTimeDelta(abs)
  return `${endStr} (${sign}${diffStr})`
})
const getCursorLeftPx = (timeVal: bigint): number => {
  const view = unitController.viewRange
  const viewLen = unitController.viewRangeLength
  if (viewLen === BigInt(0)) return 0
  const axisCanvas = timeGraphAxisContainer?.canvas as HTMLCanvasElement | undefined
  const widthPx = axisCanvas ? axisCanvas.clientWidth : graphWidth.value
  const clamped = timeVal < view.start ? view.start : timeVal > view.end ? view.end : timeVal
  const dx = Number(clamped - view.start) / Number(viewLen)
  return Math.round(dx * widthPx)
}
const selectStartStyle = computed(() => {
  if (!selectStart.value) return {}
  const x = getCursorLeftPx(selectStart.value)
  return {
    left: x + 'px'
  }
})
const selectEndStyle = computed(() => {
  if (!selectEnd.value) return {}
  const x = getCursorLeftPx(selectEnd.value)
  return {
    left: x + 'px'
  }
})
function onSelectionRangeChange(selectionRange?: TimelineChart.TimeGraphRange) {
  if (!globalStart.value) {
    if (selectionRange) {
      selectStart.value = selectionRange.start
      if (selectionRange.end != selectionRange.start) {
        selectEnd.value = selectionRange.end
      } else {
        selectEnd.value = undefined
      }
    } else {
      selectStart.value = undefined
      selectEnd.value = undefined
    }
  } else {
    selectStart.value = undefined
    selectEnd.value = undefined
  }
}
function removeSelection() {
  selectStart.value = undefined
  selectEnd.value = undefined
  unitController.selectionRange = undefined
}
function logDisplay({
  values
}: {
  values: {
    label: string
    instance: string
    message: {
      method: 'osEvent'
      data: {
        data: string
        id: string //TASK.7_0
        name: string
        ts: number
        raw: OsEvent
      }
    }
  }[]
}) {
  if (!globalStart.value) {
    return
  }

  // Don't process logs when paused
  if (isPaused.value) return

  //filter by instance
  const filteredValues = values.filter((value) => value.instance === orti.value.name)
  const events = filteredValues.map((value) => value.message.data.raw)
  // send to worker
  dataHandlerWorker.postMessage({
    type: 'updateEvents',
    payload: {
      events: events,
      cpuFreq: orti.value.cpuFreq
    }
  })
  if (startOffsetNumber === 0) {
    startOffset = BigInt(filteredValues[0].message.data.ts)
    startOffsetNumber = filteredValues[0].message.data.ts
  }
  lastEventTs = filteredValues.at(-1)?.message.data.ts || 0
}
// Zoom and pan functionality is now handled by PixiGraphRenderer
onMounted(() => {
  // Wait for DOM to be ready

  initPixiGraph()
  unitController.onSelectionRangeChange(onSelectionRangeChange)
  unitController.onViewRangeChanged(removeSelection)

  window.jQuery(`#Shift-${charid.value}`).resizable({
    handles: 'e',
    resize: (e, ui) => {
      leftWidth.value = ui.size.width
    },
    maxWidth: 300,
    minWidth: 100
  })

  if (globalStart.value) {
    startFunc()
  }
  window.logBus.on('osEvent', logDisplay)
})

watch([() => graphWidth.value, () => graphHeight.value], (val1) => {
  // rowController!.rowHeight = val1[2];
  timeGraphChartContainer?.updateCanvas(val1[0], val1[1])
  verticalScrollContainer?.updateCanvas(styleConfig.vscrollWidth, val1[1])
  vscrollLayer?.update(true)
  verticalScrollContainer?.updateCanvas(styleConfig.vscrollWidth, val1[1])
  timeGraphAxisContainer?.updateCanvas(val1[0], styleConfig.axisHeight)
  naviContainer?.updateCanvas(val1[0], styleConfig.navigatorHeight)
  removeSelection()
})

onUnmounted(() => {
  window.logBus.off('osEvent', logDisplay)
  //clear
  if (pendingDataResolve) {
    pendingDataResolve({ rows: [], range: { start: 0n, end: 0n }, resolution: 1 })
  }
  if (pendingFindStateResolve) {
    pendingFindStateResolve({ id: undefined, start: undefined })
  }

  destroyGraph()
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

.selection-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  transform: translateX(-50%);
  z-index: 5;
  pointer-events: none;
}

.selection-cursor-label {
  position: absolute;
  bottom: 0;
  transform: translate(-50%, 0);
  padding: 0 6px;
  height: 16px;
  line-height: 16px;
  border-radius: 2px;
  font-size: 10px;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--el-border-color);
  white-space: nowrap;
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
  overflow-y: hidden;
  height: v-bind(graphHeight + 'px');
  display: flex;
  flex-direction: column;

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

.divider {
  position: absolute;
  left: 0;
  top: v-bind(height-45 + 'px');
  width: v-bind(width + 'px');
  height: 1px;
  background-color: var(--el-border-color);
  z-index: 1000;
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
  font-size: 10px;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color-overlay);
  padding: 2px 2px;
  border-radius: 4px;
  height: 37px;
  overflow-y: auto;
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
