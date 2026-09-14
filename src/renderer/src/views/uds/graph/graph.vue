<template>
  <div class="uds-graph">
    <div
      style="
        justify-content: space-between;
        display: flex;
        align-items: center;
        gap: 0px;
        padding-left: 5px;
        padding: 1px;
      "
      class="border-bottom"
    >
      <div style="display: flex; align-items: center; gap: 4px">
        <el-button-group>
          <el-button link type="primary" :class="{ 'pause-active': hideTree }" @click="treeHide">
            <Icon :icon="hideIcon" />
          </el-button>

          <el-tooltip
            effect="light"
            :content="
              isPaused
                ? i18next.t('uds.graph.graph.tooltips.resume')
                : i18next.t('uds.graph.graph.tooltips.pause')
            "
            placement="bottom"
          >
            <el-button
              :type="isPaused ? 'success' : 'warning'"
              link
              :class="{ 'pause-active': isPaused }"
              @click="isPaused = !isPaused"
            >
              <Icon :icon="isPaused ? playIcon : pauseIcon" />
            </el-button>
          </el-tooltip>
        </el-button-group>
        <el-divider direction="vertical"></el-divider>
        <el-button-group>
          <el-tooltip
            effect="light"
            :content="i18next.t('uds.graph.graph.tooltips.addVariables')"
            placement="bottom"
          >
            <el-button link type="primary" @click="addNode">
              <Icon :icon="addIcon" />
            </el-button>
          </el-tooltip>
          <el-tooltip
            effect="light"
            :content="i18next.t('uds.graph.graph.tooltips.addSignals')"
            placement="bottom"
          >
            <el-button link type="primary" @click="addSignal">
              <Icon :icon="waveIcon" />
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>
      <span style="margin-right: 10px; font-size: 12px; color: var(--el-text-color-regular)">
        {{ i18next.t('uds.graph.graph.labels.time', { time: time }) }}
      </span>
    </div>
    <div>
      <div class="main">
        <div v-show="!hideTree" class="left">
          <el-scrollbar :height="height">
            <el-tree
              ref="treeRef"
              highlight-current
              node-key="id"
              :data="filteredTreeData"
              :props="defaultProps"
              :empty-text="i18next.t('uds.graph.graph.tree.emptyText')"
              @node-click="handleNodeClick"
            >
              <template #default="{ data }">
                <el-popover
                  :ref="(e) => (popoverRefs[data.id] = e)"
                  placement="bottom-start"
                  :width="100"
                  trigger="contextmenu"
                  popper-class="node-menu"
                >
                  <template #reference>
                    <span class="tree-node">
                      <el-checkbox
                        v-model="data.enable"
                        class="custom-checkbox"
                        @change="(val) => handleCheckChange(data, val)"
                      />
                      <span class="color-block" :style="{ backgroundColor: data.color }" />
                      <span class="node-label">{{ data.name }}</span>
                    </span>
                  </template>
                  <div class="menu-items">
                    <div class="menu-item warning" @click="handleEdit(data, $event)">
                      <Icon :icon="editIcon" />
                      <span>{{ i18next.t('uds.graph.graph.menu.edit') }}</span>
                    </div>
                    <div class="menu-item danger" @click="handleDelete(data, $event)">
                      <Icon :icon="deleteIcon" />
                      <span>{{ i18next.t('uds.graph.graph.menu.delete') }}</span>
                    </div>
                  </div>
                </el-popover>
              </template>
            </el-tree>
          </el-scrollbar>
        </div>
        <div v-show="!hideTree" :id="`graphShift-${props.editIndex}`" class="shift" />
        <div class="right" :style="{ left: hideTree ? '0px' : leftWidth + 5 + 'px' }">
          <div
            class="canvas-container"
            :style="{ width: canvasWidth + 'px', height: height + 'px' }"
          >
            <div
              v-if="isZoomY"
              style="position: absolute; top: 5px; right: 3px; color: var(--el-color-primary)"
            >
              <Icon :icon="zoomInIcon" />
            </div>
            <div
              v-if="isDragging"
              style="position: absolute; top: 5px; right: 3px; color: var(--el-color-primary)"
            >
              <Icon :icon="dragVerticalIcon" />
            </div>
            <div class="chart-container" :style="{ height: height + 'px' }">
              <div v-if="enabledCharts.length === 0" class="empty-chart">
                {{ i18next.t('uds.graph.graph.labels.emptyChart') }}
              </div>
              <div
                v-show="enabledCharts.length > 0"
                :id="chartDomId"
                style="width: 100%; height: 100%"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <el-dialog
      v-if="signalDialogVisible"
      v-model="signalDialogVisible"
      :title="i18next.t('uds.graph.graph.dialogs.addSignal')"
      width="95%"
      align-center
      :append-to="appendId"
    >
      <signal :height="tableHeight" @add-signal="handleAddSignal" />
    </el-dialog>
    <el-dialog
      v-if="variableDialogVisible"
      v-model="variableDialogVisible"
      :title="i18next.t('uds.graph.graph.dialogs.addVariable')"
      width="95%"
      align-center
      :append-to="appendId"
    >
      <add-var :height="tableHeight" @add-variable="handleAddSignal" />
    </el-dialog>

    <el-dialog
      v-if="editDialogVisible && editingNode"
      v-model="editDialogVisible"
      :title="
        editingNode.type === 'signal'
          ? i18next.t('uds.graph.graph.dialogs.editSignal')
          : i18next.t('uds.graph.graph.dialogs.editVariable')
      "
      width="500px"
      align-center
      :append-to="appendId"
    >
      <edit-signal
        stype="line"
        :height="tableHeight"
        :node="editingNode"
        @save="handleEditSave"
        @cancel="handleEditCancel"
      />
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
import * as echarts from 'echarts'
import pauseIcon from '@iconify/icons-material-symbols/pause-circle-outline'
import playIcon from '@iconify/icons-material-symbols/play-circle-outline'
import hideIcon from '@iconify/icons-material-symbols/hide'
import addIcon from '@iconify/icons-material-symbols/add-circle-outline'
import deleteIcon from '@iconify/icons-material-symbols/delete-outline'
import editIcon from '@iconify/icons-material-symbols/edit-outline'
import zoomInIcon from '@iconify/icons-material-symbols/zoom-in'
import dragVerticalIcon from '@iconify/icons-material-symbols/drag-pan'
import waveIcon from '@iconify/icons-material-symbols/airwave-rounded'
import { ref, onMounted, computed, h, onUnmounted, watch, nextTick, inject } from 'vue'
import { Icon } from '@iconify/vue'
import { useDataStore } from '@r/stores/data'
import { GraphBindSignalValue, GraphBindVariableValue, GraphNode } from 'src/preload/data'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, DataZoomComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECBasicOption } from 'echarts/types/dist/shared'
import { ElNotification, formatter } from 'element-plus'
import signal from '../components/signal.vue'
import addVar from '../components/addVar.vue'
import editSignal from '../components/editSignal.vue'
import { LineSeriesOption } from 'echarts'
import { useGlobalStart } from '@r/stores/runtime'
import { Layout } from '../layout'
import i18next from 'i18next'

use([LineChart, GridComponent, DataZoomComponent, LegendComponent, CanvasRenderer])

const isPaused = ref(false)
const hideTree = ref(false)
const leftWidth = ref(200)
const props = defineProps<{
  height: number
  width: number
  editIndex?: string
}>()
const popoverRefs = ref<Record<string, any>>({})
const graphs = useDataStore().graphs
const appendId = computed(() => (props.editIndex ? `#win${props.editIndex}` : '#wingraph'))
const height = computed(() => props.height - 22)
const tableHeight = computed(() => (height.value * 2) / 3)
const chartDomId = computed(() => `chart-${props.editIndex ?? 'graph'}-main`)
// 修改测试数据
const filteredTreeData = ref<
  GraphNode<GraphBindSignalValue | GraphBindVariableValue, LineSeriesOption>[]
>([])
const treeRef = ref()
const time = ref(0)

const defaultProps = {
  label: 'label'
}

const handleNodeClick = (data: any) => {
  // console.log(data)
}

function treeHide() {
  hideTree.value = !hideTree.value
  // 如果需要在隐藏/显示时保存之前的宽度，可以添加相关逻辑
}

function handleCheckChange(
  data: GraphNode<GraphBindSignalValue, LineSeriesOption>,
  checked: boolean
) {
  graphs[data.id].enable = checked
  filteredTreeData.value.forEach((node) => {
    if (node.id === data.id) {
      node.enable = checked
    }
  })
  if (checked) {
    window.logBus.on(data.id, dataUpdate)
  } else {
    window.logBus.off(data.id, dataUpdate)
  }
}

const addNode = () => {
  variableDialogVisible.value = true
}

// 添加画布宽度计算
const canvasWidth = computed(() => {
  return hideTree.value ? props.width : props.width - leftWidth.value - 5
})

const handleEdit = (data: GraphNode<GraphBindSignalValue, LineSeriesOption>, event: Event) => {
  popoverRefs.value[data.id]?.hide()
  editingNode.value = { ...data }
  editDialogVisible.value = true
}

const handleEditSave = (updatedNode: GraphNode<GraphBindSignalValue, LineSeriesOption>) => {
  const index = filteredTreeData.value.findIndex((v) => v.id === updatedNode.id)
  if (index !== -1) {
    filteredTreeData.value[index] = updatedNode
    graphs[updatedNode.id] = updatedNode
    rebuildChartOption()
  }

  editDialogVisible.value = false
  editingNode.value = null
}

const handleEditCancel = () => {
  editDialogVisible.value = false
  editingNode.value = null
}
const globalStart = useGlobalStart()

const updateTime = () => {
  if (isPaused.value) {
    return
  }
  // 更新x轴范围
  let maxX = 5
  Object.values(chartDataCache).forEach((v) => {
    const lastOne = v[v.length - 1]
    if (lastOne) {
      const val = (lastOne[0] as number) / 1000000
      if (val > maxX) {
        maxX = val
      }
    }
  })

  const ts = (Date.now() - window.startTime) / 1000
  if (ts > maxX) {
    maxX = ts
  }

  maxX = parseFloat(maxX.toFixed(2))
  time.value = maxX

  // 实现滑动窗口：当时间超过设定值时，x轴随时间移动
  const WINDOW_SIZE = 10 // 10秒窗口
  let minX = 0
  let displayMaxX = maxX

  if (maxX > WINDOW_SIZE) {
    // 不使用Math.floor，让x轴平滑移动
    minX = maxX - WINDOW_SIZE
    displayMaxX = maxX
  } else {
    minX = 0
    displayMaxX = WINDOW_SIZE
  }

  // x轴范围设置
  const newMinX = minX
  const newMaxX = displayMaxX

  cachedXAxisMin = newMinX

  chartInstance?.setOption(
    {
      xAxis: {
        min: newMinX,
        max: newMaxX
      }
    },
    false,
    false
  )
}
watch(globalStart, (val) => {
  if (val) {
    //clear cache
    Object.keys(chartDataCache).forEach((key) => {
      chartDataCache[key] = []
      chartTimeIndex[key] = new Map()
    })
    cachedXAxisMin = 0

    chartInstance?.setOption({
      dataZoom: [
        {
          start: 0,
          end: 100
        }
      ],
      series: enabledCharts.value.map((c) => ({
        data: [],
        showSymbol: getShowSymbol(c.id)
      })),
      xAxis: {
        min: 0,
        max: 10
      },
      tooltip: {
        show: getShowTooTip()
      }
    })
    if (timer) {
      clearInterval(timer)
    }
    timer = setInterval(updateTime, 100)
  } else {
    chartInstance?.setOption({
      tooltip: {
        show: getShowTooTip()
      },
      series: enabledCharts.value.map((c) => ({
        showSymbol: getShowSymbol(c.id)
      }))
    })
    clearInterval(timer)
  }
})

const getShowTooTip = (id?: string, val?: boolean) => {
  if (val == undefined) {
    if (id && graphs[id]) {
      val = graphs[id].tooltip?.show
    } else {
      val = enabledCharts.value.some((c) => c.tooltip?.show !== false)
    }
  }
  if (val) {
    if (isPaused.value) {
      return true
    } else if (!globalStart.value) {
      return true
    } else {
      return false
    }
  } else {
    return false
  }
}
const getShowSymbol = (id: string, val?: boolean) => {
  if (val == undefined) {
    val = graphs[id].series?.showSymbol
  }
  if (val) {
    if (isPaused.value) {
      return true
    } else if (!globalStart.value) {
      return true
    } else {
      return false
    }
  } else {
    return false
  }
}
watch(isPaused, () => {
  chartInstance?.setOption({
    tooltip: {
      show: getShowTooTip()
    },
    series: enabledCharts.value.map((c) => ({
      showSymbol: getShowSymbol(c.id)
    }))
  })
})

// 添加数据缓存
const chartDataCache: Record<string, (number | string)[][]> = {}
// 时间索引缓存：key为图表ID，value为时间桶到数据索引的映射
// 时间桶粒度为100ms，例如：时间0.15s对应桶1 (Math.floor(0.15/0.1))
const TIME_BUCKET_SIZE = 0.1 // 100ms
const chartTimeIndex: Record<string, Map<number, number>> = {}
const layout = inject('layout') as Layout

// 添加批量更新机制
const pendingUpdates: Record<string, boolean> = {}
let updateScheduled = false
// 缓存 x 轴范围，避免频繁调用 getOption
let cachedXAxisMin = 0

function scheduleBatchUpdate() {
  if (updateScheduled) return
  updateScheduled = true

  requestAnimationFrame(() => {
    if (chartInstance) {
      chartInstance.setOption(
        {
          series: enabledCharts.value.map((c) => ({
            data: chartDataCache[c.id] || []
          }))
        },
        false,
        true
      )
    }

    Object.keys(pendingUpdates).forEach((key) => delete pendingUpdates[key])
    updateScheduled = false
  })
}

function dataUpdate({
  key,
  values
}: {
  key: string
  values: [number, { value: number | string; rawValue: number }][]
}) {
  if (isPaused.value || !globalStart.value) {
    return
  }
  if (!chartInstance || getSeriesIndex(key) < 0) return

  // 初始化或获取缓存数据
  if (!chartDataCache[key]) {
    chartDataCache[key] = []
    chartTimeIndex[key] = new Map()
  }

  // 添加新数据并更新时间索引
  const cache = chartDataCache[key]
  const startIndex = cache.length

  // 优化：合并 map 和 forEach，一次遍历完成数据转换和索引更新
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    const point: (number | string)[] = [
      v[0],
      typeof v[1].value === 'number' ? v[1].value : v[1].rawValue
    ]

    // 直接 push 比 concat 更快（避免创建新数组）
    cache.push(point)

    // 同时更新时间索引
    const timeBucket = Math.floor((v[0] as number) / TIME_BUCKET_SIZE)
    if (!chartTimeIndex[key].has(timeBucket)) {
      chartTimeIndex[key].set(timeBucket, startIndex + i)
    }
  }

  // 性能优化：只有当数据量超过阈值时才进行清理，避免频繁操作
  const MAX_POINTS = 2000 // 最大保留点数
  if (cache.length > MAX_POINTS) {
    // 优化：使用缓存的 x 轴最小值，避免调用 getOption
    const xAxisMin = cachedXAxisMin
    if (xAxisMin !== undefined) {
      const bufferTime = 10
      const minX = xAxisMin - bufferTime

      // 使用时间索引快速定位删除位置 O(1)
      const targetBucket = Math.floor(minX / TIME_BUCKET_SIZE)
      let firstValidIndex = -1

      // 从目标桶开始向后查找第一个有效的索引
      for (let bucket = targetBucket; bucket <= targetBucket + 10; bucket++) {
        if (chartTimeIndex[key].has(bucket)) {
          firstValidIndex = chartTimeIndex[key].get(bucket)!
          break
        }
      }

      if (firstValidIndex > 0) {
        // 优化：使用 slice 创建新数组比 splice 删除大量元素更快
        chartDataCache[key] = cache.slice(firstValidIndex)

        // 优化：直接创建新 Map，比遍历删除更快
        const newTimeIndex = new Map<number, number>()
        chartTimeIndex[key].forEach((index, bucket) => {
          if (index >= firstValidIndex) {
            newTimeIndex.set(bucket, index - firstValidIndex)
          }
        })
        chartTimeIndex[key] = newTimeIndex
      }
    } else {
      // 如果无法获取x轴信息，则保留最新的1500个点
      const keepCount = 1500
      if (cache.length > keepCount) {
        const deleteCount = cache.length - keepCount

        // 优化：直接取最后 N 个元素，比 splice 快
        chartDataCache[key] = cache.slice(deleteCount)

        // 优化：直接创建新 Map
        const newTimeIndex = new Map<number, number>()
        chartTimeIndex[key].forEach((index, bucket) => {
          if (index >= deleteCount) {
            newTimeIndex.set(bucket, index - deleteCount)
          }
        })
        chartTimeIndex[key] = newTimeIndex
      }
    }
  }

  // 标记需要更新，并调度批量更新
  pendingUpdates[key] = true
  scheduleBatchUpdate()
}

const enabledCharts = computed(() => {
  return Object.values(filteredTreeData.value).filter((node) => node.enable)
})

const getSeriesIndex = (nodeId: string) => {
  return enabledCharts.value.findIndex((c) => c.id === nodeId)
}

let chartInstance: echarts.ECharts | null = null

// 替换拖拽相关的状态和处理函数
const isDragging = ref(false)
const isZoomY = ref(false)
const inYArea = ref(false)
let timer
const maxYAxisLength = ref(80)
watch(maxYAxisLength, (newVal) => {
  chartInstance?.setOption({
    grid: {
      left: newVal + 'px'
    }
  })
})

const isYAxisZoomDisabled = () => {
  return enabledCharts.value.some((c) => c.disZoom)
}

const persistSharedYAxis = (min: number, max: number) => {
  enabledCharts.value.forEach((node) => {
    node.yAxis = {
      ...node.yAxis,
      min,
      max
    }
    graphs[node.id].yAxis = node.yAxis
  })
}

const initChart = () => {
  const dom = document.getElementById(chartDomId.value)
  if (!dom || chartInstance) return

  chartInstance = echarts.init(dom)

  chartInstance.on('mousedown', (params) => {
    if (params.componentType == 'yAxis' || params.componentType == 'series') {
      if (params.event?.event.ctrlKey) {
        isDragging.value = false
      } else {
        isDragging.value = true
      }
    }
  })

  chartInstance.on('mouseover', (params) => {
    if (params.componentType == 'yAxis' || params.componentType == 'series') {
      inYArea.value = true
      if (params.event?.event.ctrlKey && !isYAxisZoomDisabled()) {
        isZoomY.value = true
      }
    }
  })

  chartInstance.on('mouseout', () => {
    inYArea.value = false
    isZoomY.value = false
  })

  document.addEventListener('keyup', () => {
    isZoomY.value = false
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Control' && inYArea.value && !isYAxisZoomDisabled()) {
      isZoomY.value = true
    }
    isDragging.value = false
  })

  dom.addEventListener('mouseup', () => {
    isDragging.value = false
    isZoomY.value = false
    inYArea.value = false
  })

  dom.addEventListener('mousemove', (event) => {
    if (event.ctrlKey) {
      isDragging.value = false
    }
    if (isDragging.value && chartInstance) {
      const range = chartInstance.getOption().yAxis as ECBasicOption['yAxis'] as any
      const { min, max } = range[0]
      const offset = max - min
      let deltaY = event.movementY
      if (deltaY > 0) {
        deltaY += offset * 0.2
      } else {
        deltaY -= offset * 0.2
      }
      const newRange = {
        min: min + deltaY * 0.05,
        max: max + deltaY * 0.05
      }

      chartInstance.setOption({
        yAxis: {
          min: newRange.min,
          max: newRange.max
        }
      })
      persistSharedYAxis(newRange.min, newRange.max)
    }
  })

  dom.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      if (event.ctrlKey && isZoomY.value && chartInstance) {
        if (isYAxisZoomDisabled()) {
          isZoomY.value = false
          return
        }
        const yAxis = (chartInstance.getOption() as any).yAxis[0]
        const range = yAxis.max - yAxis.min
        const offset = range * 0.2

        let newMin: number, newMax: number
        if (event.deltaY < 0) {
          newMin = yAxis.min + offset
          newMax = yAxis.max - offset
        } else {
          newMin = yAxis.min - offset
          newMax = yAxis.max + offset
        }

        chartInstance.setOption({
          yAxis: {
            min: newMin,
            max: newMax
          }
        })
        persistSharedYAxis(newMin, newMax)
      }
    },
    { passive: false }
  )

  dom.addEventListener('mouseleave', () => {
    isDragging.value = false
  })

  chartInstance.on('mouseout', (params) => {
    params.event?.event.preventDefault()
  })

  rebuildChartOption()
}

const rebuildChartOption = () => {
  if (!chartInstance) return
  chartInstance.setOption(getCombinedChartOption(), true)
}

function reszie(q?: any) {
  if (q && q.id != props.editIndex) {
    return
  }
  nextTick(() => {
    chartInstance?.resize()
  })
}
// 监听图表容器大小变化
watch([() => canvasWidth.value, () => height.value, enabledCharts], () => {
  nextTick(() => {
    reszie()
  })
})

const formatSeriesValue = (
  chart: GraphNode<GraphBindSignalValue | GraphBindVariableValue, LineSeriesOption>,
  value: number | string
) => {
  if (chart.bindValue.stringRange) {
    const stringVal = chart.bindValue.stringRange.find((v) => v.value == value)
    if (stringVal) {
      return stringVal.name
    }
  }
  return typeof value === 'number' ? value.toFixed(2) : value
}

const getSeriesOption = (
  chart: GraphNode<GraphBindSignalValue | GraphBindVariableValue, LineSeriesOption>
): LineSeriesOption => {
  return {
    ...chart.series,
    id: chart.id,
    name: chart.name,
    type: 'line',
    triggerLineEvent: true,
    showSymbol: getShowSymbol(chart.id, chart.series?.showSymbol),
    large: true,
    sampling: 'lttb',
    data: chartDataCache[chart.id] || [],
    itemStyle: {
      ...chart.series?.itemStyle,
      color: chart.color
    },
    lineStyle: {
      ...chart.series?.lineStyle,
      color: chart.color,
      width: chart.series?.lineStyle?.width ?? 2
    },
    cursor: 'ns-resize',
    emphasis: {
      focus: 'series',
      lineStyle: {
        width: 3
      }
    },
    silent: false
  } as LineSeriesOption
}

const getSharedYAxisOption = (): ECBasicOption['yAxis'] => {
  const charts = enabledCharts.value
  const singleChart = charts.length === 1 ? charts[0] : null

  let min: number | undefined
  let max: number | undefined
  charts.forEach((chart) => {
    if (chart.yAxis?.min !== undefined) {
      min = min === undefined ? chart.yAxis.min : Math.min(min, chart.yAxis.min as number)
    }
    if (chart.yAxis?.max !== undefined) {
      max = max === undefined ? chart.yAxis.max : Math.max(max, chart.yAxis.max as number)
    }
  })

  return {
    triggerEvent: true,
    splitLine: {
      show: false
    },
    axisLine: {
      show: true
    },
    axisTick: {
      show: true,
      length: 4
    },
    scale: charts.length > 1,
    min: min ?? (singleChart ? 0 : undefined),
    max: max ?? (singleChart ? 20 : undefined),
    axisLabel: {
      fontSize: 10,
      show: true,
      formatter: (value: number) => {
        const getWidth = (label: string) => {
          const rect = echarts.format.getTextRect(label, '10px')
          return Math.ceil(rect.width + 40)
        }

        if (singleChart?.bindValue.stringRange) {
          const val = singleChart.bindValue.stringRange.find((v) => v.value == value)?.name
          if (val) {
            const w = getWidth(val)
            if (w > maxYAxisLength.value) {
              maxYAxisLength.value = w
            }
            return val
          }
        }

        let val = Number.isInteger(value) ? value.toFixed(0) : ''
        if (val.length > 6) {
          val = value.toExponential()
        }
        if (val.length > 0 && singleChart?.yAxis?.unit) {
          val = val + singleChart.yAxis.unit
        }
        const w = getWidth(val)
        if (w > maxYAxisLength.value) {
          maxYAxisLength.value = w
        }
        return val
      }
    },
    name: charts.length === 1 ? charts[0].name : i18next.t('uds.graph.graph.labels.sharedYAxis'),
    nameLocation: 'middle',
    nameGap: 65,
    nameRotate: 90,
    nameTextStyle: {
      fontSize: 11,
      padding: [0, 0, 0, 5],
      align: 'center',
      color: charts.length === 1 ? charts[0].color : undefined
    }
  }
}

const getCombinedChartOption = (): ECBasicOption => {
  const charts = enabledCharts.value
  const multiSeries = charts.length > 1

  return {
    animation: false,
    legend: multiSeries
      ? {
          type: 'scroll',
          top: 0,
          data: charts.map((c) => c.name)
        }
      : undefined,
    tooltip: {
      show: globalStart.value ? false : getShowTooTip(),
      trigger: multiSeries ? 'axis' : 'item',
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params]
        if (!items.length || !items[0]?.data) {
          return ''
        }

        const timeStr = i18next.t('uds.graph.graph.tooltip.time', {
          time: items[0].data[0] * 1000
        })
        const lines = [timeStr]

        items.forEach((item) => {
          const chart = charts[item.seriesIndex]
          if (!chart) return
          const valueStr = i18next.t('uds.graph.graph.tooltip.seriesValue', {
            name: item.seriesName,
            value: formatSeriesValue(chart, item.data[1])
          })
          lines.push(`${item.marker}${valueStr}`)
        })

        return lines.join('<br/>')
      }
    },
    dataZoom: [
      {
        show: charts.length > 0,
        type: 'slider',
        height: 20,
        bottom: 10,
        showDetail: true,
        showDataShadow: false,
        filter: 'weakFilter'
      }
    ],
    grid: {
      left: maxYAxisLength.value + 'px',
      right: '20px',
      top: multiSeries ? '40px' : '20px',
      bottom: '45px',
      containLabel: false
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: 10,
      name: '[s]',
      nameLocation: 'end',
      nameGap: 0,
      nameTextStyle: {
        fontSize: 12,
        padding: [0, 0, 0, 5]
      },
      axisLabel: {
        show: true,
        formatter: (value: number) =>
          Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)
      },
      axisTick: {
        show: true,
        interval: 10
      },
      splitLine: {
        show: false
      },
      axisLine: {
        show: true,
        onZero: false,
        lineStyle: {
          color: '#333'
        }
      },
      triggerEvent: false,
      position: 'bottom'
    },
    yAxis: getSharedYAxisOption(),
    series: charts.map((chart) => getSeriesOption(chart))
  }
}

onMounted(() => {
  window.jQuery(`#graphShift-${props.editIndex}`).resizable({
    handles: 'e',
    resize: (e, ui) => {
      leftWidth.value = ui.size.width
    },
    maxWidth: 300,
    minWidth: 100
  })

  for (const v of Object.values(graphs)) {
    if (v.graph && v.graph.id != props.editIndex) {
      continue
    }

    filteredTreeData.value.push(v)
  }
  nextTick(() => {
    if (enabledCharts.value.length > 0) {
      initChart()
    }
    filteredTreeData.value.forEach((chart) => {
      if (chart.enable) {
        window.logBus.on(chart.id, dataUpdate)
      }
    })
  })
  if (globalStart.value) {
    timer = setInterval(updateTime, 100)
  }
  layout.on('show', reszie)
})

watch(
  () => enabledCharts.value.map((c) => c.id).join(','),
  () => {
    nextTick(() => {
      if (enabledCharts.value.length === 0) {
        chartInstance?.dispose()
        chartInstance = null
        return
      }
      if (!chartInstance) {
        initChart()
        return
      }
      rebuildChartOption()
    })
  }
)

onUnmounted(() => {
  clearInterval(timer)
  chartInstance?.off('mousedown')
  chartInstance?.off('mousemove')
  chartInstance?.off('globalout')
  chartInstance?.off('mouseup')
  chartInstance?.dispose()
  chartInstance = null
  Object.keys(chartDataCache).forEach((key) => {
    delete chartDataCache[key]
    delete chartTimeIndex[key]
  })
  cachedXAxisMin = 0
  //detach
  filteredTreeData.value.forEach((key) => {
    window.logBus.off(key.id, dataUpdate)
  })
  layout.off('show', reszie)
})

const signalDialogVisible = ref(false)
const editDialogVisible = ref(false)
const variableDialogVisible = ref(false)
const editingNode = ref<GraphNode<GraphBindSignalValue> | null>(null)

const addSignal = () => {
  signalDialogVisible.value = true
}

const handleAddSignal = (node: GraphNode<GraphBindSignalValue | GraphBindVariableValue> | null) => {
  signalDialogVisible.value = false
  variableDialogVisible.value = false
  if (node) {
    //check existing graph
    const existed = filteredTreeData.value.find((v) => v.id == node.id)
    if (existed) {
      ElNotification({
        offset: 50,
        message: i18next.t('uds.graph.graph.messages.signalAlreadyExists'),
        type: 'warning',
        appendTo: appendId.value
      })
      return
    }

    if (props.editIndex) {
      node.graph = {
        id: props.editIndex
      }
    }
    filteredTreeData.value.push(node)

    window.logBus.on(node.id, dataUpdate)
    graphs[node.id] = node
    nextTick(() => {
      treeRef.value.setChecked(node.id, true)
    })
  }
}

const handleDelete = (data: GraphNode<GraphBindSignalValue>, event: Event) => {
  popoverRefs.value[data.id]?.hide()
  const index = filteredTreeData.value.findIndex((v) => v.id == data.id)
  delete chartDataCache[data.id]
  delete chartTimeIndex[data.id]

  filteredTreeData.value.splice(index, 1)
  delete graphs[data.id]
  window.logBus.off(data.id, dataUpdate)

  nextTick(() => {
    if (enabledCharts.value.length === 0) {
      chartInstance?.dispose()
      chartInstance = null
      return
    }
    rebuildChartOption()
  })
}
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
  height: v-bind(height + 'px');
  z-index: 1;
  overflow: hidden;
  /* 改为 hidden 以防止滚动条影响画布 */
}

.canvas-container {
  position: relative;
  background-color: var(--el-bg-color);
}

.empty-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.border-bottom {
  border-bottom: solid 1px var(--el-border-color);
  background-color: var(--el-background-color);
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 14px;
  width: 100%;
  overflow: hidden;
}

.custom-checkbox {
  flex-shrink: 0;
}

:deep(.el-checkbox__inner) {
  width: 14px;
  height: 14px;
}

:deep(.el-checkbox__input) {
  line-height: 14px;
}

.color-block {
  flex-shrink: 0;
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 1px solid #ddd;
}

.node-label {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-items {
  padding: 2px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 4px;
  /* 减小间距 */
  padding: 2px 8px;
  /* 减小上下内边距 */
  cursor: pointer;
  transition: all 0.3s;
  font-size: 12px;
  /* 稍微减小字体 */
  line-height: 20px;
  /* 添加行高控制 */
}

.menu-item.warning:hover {
  background-color: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}

.menu-item.danger:hover {
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger-dark-2);
}

.menu-item .iconify {
  font-size: 14px;
  color: inherit;
}

.floating-icon :deep(.iconify) {
  font-size: 20px;
  display: block;
}

:deep(.chart-container .echarts) {
  width: 100% !important;
  height: 100% !important;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
