<template>
  <div class="uds-graph">
    <div>
      <div class="main">
        <VxeGrid
          ref="userVariableGrid"
          v-bind="userGridOptions"
          class="variableTable"
          :data="userTableData"
          @checkbox-all="handleCheckboxChange"
          @checkbox-change="handleCheckboxChange"
        >
          <template #toolbar>
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
                  <el-tooltip
                    effect="light"
                    :content="isPaused ? 'Resume' : 'Pause'"
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
                  <el-tooltip effect="light" content="Add Variables" placement="bottom">
                    <el-button link type="primary" @click="addNode">
                      <Icon :icon="addIcon" />
                    </el-button>
                  </el-tooltip>
                  <el-tooltip effect="light" content="Add Signals" placement="bottom">
                    <el-button link type="primary" @click="addSignal">
                      <Icon :icon="waveIcon" />
                    </el-button>
                  </el-tooltip>
                  <el-divider direction="vertical"></el-divider>
                  <el-tooltip effect="light" content="Delete Signal" placement="bottom">
                    <el-button
                      link
                      type="danger"
                      :disabled="!selectedRows.length"
                      @click="deleteSignal"
                    >
                      <Icon :icon="deleteIcon" />
                      <span v-if="selectedRows.length" style="margin-left: 4px; font-size: 12px">
                        ({{ selectedRows.length }})
                      </span>
                    </el-button>
                  </el-tooltip>
                </el-button-group>
              </div>
              <span
                style="margin-right: 10px; font-size: 12px; color: var(--el-text-color-regular)"
              >
                Time: {{ time }}s
              </span>
            </div>
          </template>
          <template #default_name="{ row }">
            {{ row.name }}
          </template>
          <template #default_value="{ row }">
            {{ row.value }}
          </template>
          <template #default_unit="{ row }">
            {{ row.unit }}
          </template>
          <template #default_fullName="{ row }">
            {{ row.fullName }}
          </template>
          <template #default_rawValue="{ row }">
            {{ row.rawValue }}
          </template>
          <template #default_lastUpdate="{ row }">
            {{ row.lastUpdate || '--' }}
          </template>
        </VxeGrid>
      </div>
    </div>
    <el-dialog
      v-if="signalDialogVisible"
      v-model="signalDialogVisible"
      title="Add Signal"
      width="95%"
      align-center
      :append-to="appendId"
    >
      <signal :height="tableHeight" :width="width" @add-signal="handleAddSignal" />
    </el-dialog>
    <el-dialog
      v-if="variableDialogVisible"
      v-model="variableDialogVisible"
      title="Add Variable"
      width="95%"
      align-center
      :append-to="appendId"
    >
      <add-var :height="tableHeight" @add-variable="handleAddSignal" />
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
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

import { ElNotification, ElMessageBox, formatter } from 'element-plus'
import signal from '../components/signal.vue'
import addVar from '../components/addVar.vue'
import { VxeGrid, VxeGridProps, VxeTableEvents } from 'vxe-table'
import { useGlobalStart } from '@r/stores/runtime'

const isPaused = ref(false)

const variableDialogVisible = ref(false)

const props = defineProps<{
  height: number
  width: number
  editIndex?: string
}>()

const dataStore = useDataStore()
const datas = dataStore.datas
const appendId = computed(() => (props.editIndex ? `#win${props.editIndex}` : '#wingraph'))
const height = computed(() => props.height)
const tableHeight = computed(() => (height.value * 2) / 3)

type TableType = {
  id: string
  name: string
  fullName: string
  value: string | number
  unit: string
  rawValue: number | string
  lastUpdate: number
}
// 用户表格数据和配置
const userTableData = ref<TableType[]>([])
const userVariableGrid = ref()

const selectedRows = ref<TableType[]>([])

// 处理复选框变化事件
const handleCheckboxChange = () => {
  selectedRows.value = userVariableGrid.value.getCheckboxRecords()
}

function getUnit(row: GraphNode<GraphBindSignalValue | GraphBindVariableValue>) {
  return row.yAxis?.unit
}

function getFullName(row: GraphNode<GraphBindSignalValue | GraphBindVariableValue>) {
  if (row.type === 'variable') {
    return (row.bindValue as any).variableFullName
  }
  return (row.bindValue as any).signalName
}

// VxeTable配置
const userGridOptions = computed<VxeGridProps<TableType>>(() => ({
  size: 'mini',
  border: true,
  showOverflow: true,
  height: height.value,
  columnConfig: {
    resizable: true
  },
  checkboxConfig: {
    highlight: true,
    showHeader: true,
    trigger: 'row'
  },
  columns: [
    { type: 'checkbox', width: 50 },
    { type: 'seq', width: 50, title: '#' },
    { field: 'name', title: 'Name', minWidth: 150, slots: { default: 'default_name' } },
    {
      field: 'fullName',
      title: 'Full Name',
      minWidth: 200,
      slots: { default: 'default_fullName' }
    },
    { field: 'value', title: 'Value', minWidth: 150, slots: { default: 'default_value' } },
    { field: 'unit', title: 'Unit', width: 100, slots: { default: 'default_unit' } },
    {
      field: 'rawValue',
      title: 'Raw Value',
      minWidth: 150,
      slots: { default: 'default_rawValue' }
    },
    {
      field: 'lastUpdate',
      title: 'Last Update',
      minWidth: 150,
      slots: { default: 'default_lastUpdate' }
    }
  ],
  data: userTableData.value,
  rowConfig: {
    keyField: 'id'
  },
  toolbarConfig: {
    slots: {
      tools: 'toolbar'
    }
  },
  align: 'center',
  scrollX: {
    enabled: true
  },
  scrollY: {
    enabled: true
  }
}))

const time = ref(0)

const addNode = () => {
  variableDialogVisible.value = true
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
const globalStart = useGlobalStart()

// 确保定时器时间间隔与graph.vue保持一致
watch(globalStart, (val) => {
  if (val) {
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

    // 更新表格数据
    const dataItem = datas[key]
    if (dataItem) {
      // 格式化值显示
      let formattedValue: string | number = latestData[1].value

      const rawValue = latestData[1].rawValue

      // 获取当前时间作为最后更新时间

      const lastUpdate = latestData[0]

      // 如果是GraphNode类型，提取更多信息
      if ((dataItem as any).color !== undefined && (dataItem as any).yAxis !== undefined) {
        const nodeInfo = dataItem as unknown as GraphNode<
          GraphBindSignalValue | GraphBindVariableValue
        >

        // 检查是否存在枚举值
        if (nodeInfo.yAxis?.enums && nodeInfo.yAxis.enums.length > 0) {
          const enumItem = nodeInfo.yAxis.enums.find((item) => item.value === formattedValue)
          if (enumItem) {
            formattedValue = enumItem.label
          }
        } else if (typeof formattedValue === 'number') {
          // 数字格式化
          if (Number.isInteger(formattedValue)) {
            formattedValue = formattedValue.toString()
          } else {
            formattedValue = parseFloat(formattedValue.toFixed(2)).toString()
          }
        }
      }

      const existingRowIndex = userTableData.value.findIndex((r) => r.id === key)

      if (existingRowIndex >= 0) {
        // 更新现有行的数据
        const rowData = userTableData.value[existingRowIndex]

        // 更新属性

        rowData.value = formattedValue

        rowData.rawValue = rawValue
        rowData.lastUpdate = lastUpdate

        // // 使用reloadRow方法刷新行
        // nextTick(() => {
        //   userVariableGrid.value?.reloadRow(rowData)
        // })
      }
    }
  }
}

onMounted(() => {
  // 初始化数据
  for (const v of Object.values(datas)) {
    // 检查值是否包含graph属性以安全地访问
    if (v.graph && v.graph.id != props.editIndex) {
      continue
    }

    userTableData.value.push({
      id: v.id,
      name: v.name,
      fullName: getFullName(v),
      value: '--',
      unit: getUnit(v),
      rawValue: '--',
      lastUpdate: 0
    })
  }

  // 初始化表格数据
  nextTick(() => {
    // 注册数据更新事件
    Object.keys(datas).forEach((key) => {
      window.logBus.on(key, dataUpdate)
    })

    // 如果全局启动标志为true，则启动定时器
    if (globalStart.value && !isPaused.value) {
      if (timer) clearInterval(timer)
      timer = setInterval(updateTime, 500)
    }
  })
})

onUnmounted(() => {
  // 清除定时器
  if (timer) {
    clearInterval(timer)
    timer = null
  }

  // 解除所有事件监听
  Object.keys(datas).forEach((key) => {
    window.logBus.off(key, dataUpdate)
  })
})

const signalDialogVisible = ref(false)

const addSignal = () => {
  signalDialogVisible.value = true
}

// 删除信号功能
const deleteSignal = () => {
  if (!selectedRows.value.length) return

  const count = selectedRows.value.length
  const message =
    count === 1
      ? 'Are you sure you want to delete this signal?'
      : `Are you sure you want to delete ${count} signals?`

  ElMessageBox.confirm(message, 'Delete Signal', {
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    type: 'warning',
    appendTo: appendId.value,
    buttonSize: 'small'
  })
    .then(() => {
      // 批量删除
      selectedRows.value.forEach((row) => {
        // 从表格中移除
        const index = userTableData.value.findIndex((r) => r.id === row.id)
        if (index !== -1) {
          userTableData.value.splice(index, 1)
        }

        // 解除事件监听
        window.logBus.off(row.id, dataUpdate)

        // 从数据存储中删除
        if (datas[row.id]) {
          delete datas[row.id]
        }
      })

      // 清除选中状态
      selectedRows.value = []

      userVariableGrid.value?.clearCheckboxRow()
      userVariableGrid.value?.clearCurrentRow()
    })
    .catch(() => {
      // 用户取消，不做处理
    })
}

const handleAddSignal = (node: GraphNode<GraphBindSignalValue | GraphBindVariableValue> | null) => {
  signalDialogVisible.value = false
  variableDialogVisible.value = false

  if (node) {
    // 检查是否已存在
    const existed = userTableData.value.find((v) => v.id == node.id)
    if (existed) {
      ElNotification({
        offset: 50,
        message: 'Signal already exists',
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

    userTableData.value.push({
      id: node.id,
      name: node.name,
      fullName: getFullName(node),
      value: '--',
      unit: getUnit(node),
      rawValue: '--',
      lastUpdate: 0
    })

    window.logBus.on(node.id, dataUpdate)
    datas[node.id] = node
  }
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

.variableTable {
  height: v-bind(height + 'px');
  width: 100%;
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
</style>

<style>
.row-highlight {
  background-color: #e6f3ff !important;
}
.vxe-table--render-default .vxe-body--row.row--checked > .vxe-body--column {
  background-color: #e6f3ff !important;
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
