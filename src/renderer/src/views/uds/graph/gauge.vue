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
                ? i18next.t('uds.graph.gauge.tooltips.resume')
                : i18next.t('uds.graph.gauge.tooltips.pause')
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
            :content="i18next.t('uds.graph.gauge.tooltips.addVariables')"
            placement="bottom"
          >
            <el-button link type="primary" @click="addNode">
              <Icon :icon="addIcon" />
            </el-button>
          </el-tooltip>
          <el-tooltip
            effect="light"
            :content="i18next.t('uds.graph.gauge.tooltips.addSignals')"
            placement="bottom"
          >
            <el-button link type="primary" @click="addSignal">
              <Icon :icon="waveIcon" />
            </el-button>
          </el-tooltip>
        </el-button-group>
      </div>
      <span style="margin-right: 10px; font-size: 12px; color: var(--el-text-color-regular)">
        {{ i18next.t('uds.graph.gauge.labels.time', { time: time }) }}
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
              :empty-text="i18next.t('uds.graph.gauge.tree.emptyText')"
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
                      <span>{{ i18next.t('uds.graph.gauge.menu.edit') }}</span>
                    </div>
                    <div class="menu-item danger" @click="handleDelete(data, $event)">
                      <Icon :icon="deleteIcon" />
                      <span>{{ i18next.t('uds.graph.gauge.menu.delete') }}</span>
                    </div>
                  </div>
                </el-popover>
              </template>
            </el-tree>
          </el-scrollbar>
        </div>
        <div v-show="!hideTree" :id="`graphShift-${props.editIndex}`" class="shift" />
        <div
          class="right"
          :style="{ left: hideTree ? '0px' : leftWidth + 5 + 'px', width: canvasWidth + 'px' }"
        >
          <div class="canvas-container" :style="{ height: height + 'px' }">
            <div class="charts-grid">
              <div
                v-for="(chart, index) in enabledCharts"
                :key="chart.id"
                class="chart-container"
                :style="getChartContainerStyle(index)"
              >
                <div
                  :id="`chart-${props.editIndex}-${chart.id}`"
                  style="width: 100%; height: 100%"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <el-dialog
      v-if="signalDialogVisible"
      v-model="signalDialogVisible"
      :title="i18next.t('uds.graph.gauge.dialogs.addSignal')"
      width="95%"
      align-center
      :append-to="appendId"
    >
      <signal :height="tableHeight" :width="width" @add-signal="handleAddSignal" />
    </el-dialog>
    <el-dialog
      v-if="variableDialogVisible"
      v-model="variableDialogVisible"
      :title="i18next.t('uds.graph.gauge.dialogs.addVariable')"
      width="95%"
      align-center
      :append-to="appendId"
    >
      <add-var :height="tableHeight" @add-variable="handleAddSignal" />
    </el-dialog>
    <el-dialog
      v-if="editDialogVisible && editingNode"
      v-model="editDialogVisible"
      :title="i18next.t('uds.graph.gauge.dialogs.editSignal')"
      width="500px"
      align-center
      :append-to="appendId"
    >
      <edit-signal
        stype="gauge"
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
import { ref, onMounted, computed, h, onUnmounted, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useDataStore } from '@r/stores/data'
import { GraphBindSignalValue, GraphBindVariableValue, GraphNode } from 'src/preload/data'
import { use } from 'echarts/core'
import { LineChart, GaugeChart } from 'echarts/charts'
import {
  GridComponent,
  DataZoomComponent,
  TitleComponent,
  TooltipComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECBasicOption } from 'echarts/types/dist/shared'
import { ElNotification, formatter } from 'element-plus'
import signal from '../components/signal.vue'
import editSignal from '../components/editSignal.vue'
import { GaugeSeriesOption } from 'echarts'
import addVar from '../components/addVar.vue'
import { useGlobalStart } from '@r/stores/runtime'
import { i18next } from '@r/i18n'

use([
  LineChart,
  GaugeChart,
  GridComponent,
  DataZoomComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer
])

const isPaused = ref(false)
const hideTree = ref(false)
const variableDialogVisible = ref(false)
const leftWidth = ref(200)
const props = defineProps<{
  height: number
  width: number
  editIndex?: string
}>()
const popoverRefs = ref<Record<string, any>>({})
const graphs = useDataStore().guages
const appendId = computed(() => (props.editIndex ? `#win${props.editIndex}` : '#wingraph'))
const height = computed(() => props.height - 22)
const tableHeight = computed(() => (height.value * 2) / 3)
const globalStart = useGlobalStart()
const filteredTreeData = ref<
  GraphNode<GraphBindSignalValue | GraphBindVariableValue, GaugeSeriesOption>[]
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
  data: GraphNode<GraphBindSignalValue, GaugeSeriesOption>,
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

const handleEdit = (data: GraphNode<GraphBindSignalValue, GaugeSeriesOption>, event: Event) => {
  popoverRefs.value[data.id]?.hide()
  editingNode.value = { ...data }
  editDialogVisible.value = true
}

const handleEditSave = (updatedNode: GraphNode<GraphBindSignalValue>) => {
  const index = filteredTreeData.value.findIndex((v) => v.id === updatedNode.id)
  if (index !== -1) {
    filteredTreeData.value[index] = updatedNode
    graphs[updatedNode.id] = updatedNode

    // 更新图表配置
    chartInstances[updatedNode.id].setOption({
      series: {
        ...updatedNode.series,
        // 更新线条颜色
        pointer: {
          itemStyle: {
            color: updatedNode.color
          }
        },
        detail: {
          color: updatedNode.color
        },
        min: updatedNode.yAxis?.min,
        max: updatedNode.yAxis?.max
      }
    })
  }

  editDialogVisible.value = false
  editingNode.value = null
}

const handleEditCancel = () => {
  editDialogVisible.value = false
  editingNode.value = null
}

let timer: ReturnType<typeof setInterval> | null = null

// 更新时间显示的函数
const updateTime = () => {
  if (isPaused.value) return

  // 更新x轴范围和时间
  let maxX = 5
  let minX = 0

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
}

// 确保定时器时间间隔与graph.vue保持一致
watch(globalStart, (val) => {
  if (val) {
    //clear all charts data and set start to 0
    enabledCharts.value.forEach((c) => {
      chartInstances[c.id].setOption({
        series: {
          data: [
            {
              name: c.name
            }
          ]
        }
      })
    })

    // 启动定时器更新时间，使用500ms间隔
    if (timer) clearInterval(timer)
    timer = setInterval(updateTime, 500)
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
})

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

function dataUpdate({
  key,
  values
}: {
  key: string
  values: [number, { value: number | string; rawValue: number }][]
}) {
  if (isPaused.value) {
    return
  }

  // 获取对应的echarts实例
  const chart = chartInstances[key]
  if (!chart) return

  // 仅获取最后一条数据
  if (values && values.length > 0) {
    const latestData = values[values.length - 1]

    // 更新时间
    if (latestData && typeof latestData[0] === 'number') {
      const dataTime = latestData[0] as number
      // 与graph.vue保持一致的时间更新逻辑
      if (dataTime > time.value) {
        time.value = dataTime
      }
    }

    // 更新仪表盘数据 - 只需要最新值
    chart.setOption({
      series: [
        {
          data: [
            {
              value: latestData ? latestData[1].value : 0,
              name: enabledCharts.value.find((c) => c.id === key)?.name || ''
            }
          ]
        }
      ]
    })
  }
}

const enabledCharts = computed(() => {
  return Object.values(filteredTreeData.value).filter((node) => node.enable)
})

// 添加图表实例管理
const chartInstances: Record<string, echarts.ECharts> = {}

// 修改初始化图表实例函数
const initChart = (chartId: string) => {
  const dom = document.getElementById(`chart-${props.editIndex}-${chartId}`)

  if (dom) {
    const chart = echarts.init(dom)
    chartInstances[chartId] = chart

    // 仪表盘配置
    const node = filteredTreeData.value.find((n) => n.id === chartId)
    if (!node) return

    // 获取设置项
    const option = getChartOption(node)
    chart.setOption(option)
  }
}

// 监听图表容器大小变化
watch([() => canvasWidth.value, () => height.value, enabledCharts], () => {
  nextTick(() => {
    Object.values(chartInstances).forEach((instance) => {
      instance.resize()
    })
  })
})

const getChartOption = (
  chart: GraphNode<GraphBindSignalValue | GraphBindVariableValue>
): ECBasicOption => {
  // 检查是否存在枚举值
  const hasEnums = !!chart.yAxis?.enums && chart.yAxis.enums.length > 0

  // 仪表盘配置
  const option: ECBasicOption = {
    series: {
      type: 'gauge',
      radius: hasEnums ? '100%' : '85%', // 存在枚举时设置为0%，相当于隐藏仪表盘
      progress: {
        show: !hasEnums
      },
      animation: true,

      animationDuration: 500, // 初始动画时长
      animationDurationUpdate: 200, // 数据更新动画时长

      axisLabel: {
        distance: 10,
        show: !hasEnums,
        formatter: (value: number) => {
          if (chart.yAxis?.enums) {
            const enumItem = chart.yAxis?.enums.find((item) => item.value === value)
            if (enumItem) {
              return enumItem.label
            }
          }

          if (Number.isInteger(value)) {
            return value.toFixed(0) + (chart.yAxis?.unit ?? '')
          }
          const val = value.toFixed(2)
          //remove 0 in tail
          const r = val.replace(/\.?0+$/, '')
          return r + (chart.yAxis?.unit ?? '')
        },
        fontSize: 10
      },
      axisLine: {
        show: !hasEnums, // 存在枚举时不显示轴线
        lineStyle: {
          width: 5
        }
      },
      axisTick: {
        show: !hasEnums // 存在枚举时不显示刻度
      },
      title: {
        offsetCenter: [0, '90%'],
        fontSize: 12
      },
      min: chart.yAxis?.min,
      max: chart.yAxis?.max,
      pointer: {
        show: !hasEnums, // 存在枚举时不显示指针
        itemStyle: {
          color: chart.color
        }
      },
      splitLine: {
        show: !hasEnums // 存在枚举时不显示分隔线
      },
      splitNumber: 10,
      detail: {
        valueAnimation: false,
        formatter: (value: number) => {
          if (Number.isNaN(value)) {
            return i18next.t('uds.graph.gauge.messages.na')
          }
          if (chart.yAxis?.enums) {
            const enumItem = chart.yAxis?.enums.find((item) => item.value === value)
            if (enumItem) {
              return enumItem.label
            }
          }
          if (Number.isInteger(value)) {
            return value.toFixed(0) + (chart.yAxis?.unit ?? '')
          }
          const r = value.toFixed(2)
          return r.replace(/\.?0+$/, '') + (chart.yAxis?.unit ?? '')
        },
        offsetCenter: [0, hasEnums ? '0%' : '35%'], // 存在枚举时将detail文本居中显示
        fontSize: hasEnums ? 24 : 14, // 存在枚举时增大字体
        color: chart.color,
        backgroundColor: hasEnums ? 'rgba(0,0,0,0.05)' : 'transparent', // 枚举时添加背景
        borderRadius: 10,
        borderWidth: hasEnums ? 1 : 0,
        padding: hasEnums ? [10, 10] : [0, 0], // 枚举时添加内边距
        width: hasEnums ? '100%' : 'auto', // 枚举时设置宽度
        height: hasEnums ? '60%' : 'auto' // 枚举时设置高度
      },
      data: [
        {
          name: chart.name
        }
      ]
    }
  }

  return option
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
  // 初始化所有图表
  nextTick(() => {
    enabledCharts.value.forEach((chart) => {
      if (!chartInstances[chart.id]) {
        initChart(chart.id)
      }
      window.logBus.on(chart.id, dataUpdate)
    })

    // 如果全局启动标志为true，则启动定时器
    if (globalStart.value && !isPaused.value) {
      if (timer) clearInterval(timer)
      timer = setInterval(updateTime, 500)
    }
  })
})

// 监听启用图表的变化
watch(
  () => enabledCharts.value,
  () => {
    nextTick(() => {
      // 初始化新增的图表
      enabledCharts.value.forEach((chart) => {
        if (!chartInstances[chart.id]) {
          initChart(chart.id)
        }
      })
      // 清理已移除的图表
      Object.keys(chartInstances).forEach((id) => {
        if (!enabledCharts.value.find((c) => c.id === id)) {
          chartInstances[id].dispose()
          delete chartInstances[id]
        }
      })
    })
  }
)

onUnmounted(() => {
  // 清除定时器
  if (timer) {
    clearInterval(timer)
    timer = null
  }

  // 清理所有图表实例
  Object.values(chartInstances).forEach((instance) => {
    instance.dispose()
  })

  //detach
  filteredTreeData.value.forEach((key) => {
    window.logBus.off(key.id, dataUpdate)
  })
})

const signalDialogVisible = ref(false)
const editDialogVisible = ref(false)
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
        message: i18next.t('uds.graph.gauge.messages.signalAlreadyExists'),
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

// 在删除图表时也要清理对应的缓存
const handleDelete = (data: GraphNode<GraphBindSignalValue>, event: Event) => {
  popoverRefs.value[data.id]?.hide()
  const index = filteredTreeData.value.findIndex((v) => v.id == data.id)
  // 删除图表实例
  if (chartInstances[data.id]) {
    chartInstances[data.id].dispose()
    delete chartInstances[data.id]
  }

  filteredTreeData.value.splice(index, 1)
  delete graphs[data.id]
  window.logBus.off(data.id, dataUpdate)
}

const getChartContainerStyle = (index: number) => {
  const count = enabledCharts.value.length

  // 计算每个表盘的位置
  // 基于图表数量计算行列
  let cols = 1,
    rows = 1

  // 根据图表数量优化布局计算
  if (count <= 1) {
    cols = rows = 1
  } else if (count <= 2) {
    cols = 2
    rows = 1
  } else if (count <= 4) {
    cols = rows = 2
  } else {
    // 对于更多图表,使用最接近正方形的布局
    cols = Math.ceil(Math.sqrt(count))
    rows = Math.ceil(count / cols)
  }

  // 计算每个表盘的宽高和位置
  const containerWidth = canvasWidth.value
  const containerHeight = height.value

  const itemWidth = containerWidth / cols
  const itemHeight = containerHeight / rows

  const row = Math.floor(index / cols)
  const col = index % cols

  const top = row * itemHeight
  const left = col * itemWidth

  // 使用字符串直接设置样式，避免类型问题
  return `position: absolute; width: ${itemWidth}px; height: ${itemHeight}px; top: ${top}px; left: ${left}px; padding: 5px; box-sizing: border-box;`
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
  height: v-bind(height + 'px');
  z-index: 1;
  overflow: hidden;
  /* 改为 hidden 以防止滚动条影响画布 */
}

.canvas-container {
  position: relative;
  width: 100%;
  background-color: var(--el-bg-color);
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

.charts-grid {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0;
}

.chart-container {
  width: 100%;
  height: 100%;
  position: relative;
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
