<template>
  <div class="ostrace-table">
    <div class="toolbar border-bottom">
      <div style="display: flex; align-items: center; gap: 4px">
        <el-button-group>
          <el-tooltip effect="light" :content="isPaused ? 'Resume' : 'Pause'" placement="bottom">
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
      </div>
      <span style="margin-right: 10px; font-size: 12px; color: var(--el-text-color-regular)">
      </span>
    </div>

    <div class="main">
      <el-tabs v-model="activeTab" type="border-card" class="category-tabs">
        <el-tab-pane v-for="category in categoryData" :key="category.type" :name="category.type">
          <template #label>
            <span>{{ category.label }}</span>
          </template>
          <VxeGrid
            :ref="(el) => setGridRef(category.type, el)"
            v-bind="getGridOptions(category.type)"
            :data="category.tableData"
            class="category-table"
          >
            <template
              v-for="column in getColumns(category.type)"
              :key="column.field"
              #[`default_${column.field}`]="{ row: dataRow }"
            >
              {{ dataRow[column.field] }}
            </template>
          </VxeGrid>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>
<script lang="ts" setup>
import pauseIcon from '@iconify/icons-material-symbols/pause-circle-outline'
import playIcon from '@iconify/icons-material-symbols/play-circle-outline'
import { ref, onMounted, computed, onUnmounted, watch, nextTick, watchEffect } from 'vue'
import { Icon } from '@iconify/vue'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { useGlobalStart } from '@r/stores/runtime'
import { useDataStore } from '@r/stores/data'
import { TaskType } from 'nodeCan/osEvent'

const isPaused = ref(false)
const activeTab = ref<CategoryType>('cpu')

const props = defineProps<{
  height: number
  width: number
  editIndex: string
}>()
const dataStore = useDataStore()
const orti = computed(() => dataStore.database.orti[props.editIndex.replace('_trace', '')])
const height = computed(() => props.height)

type CategoryType = 'task' | 'isr' | 'hook' | 'resource' | 'service' | 'cpu'

type TaskTableRow = {
  id: string
  name: string
  status: string
  activeCount: number
  startCount: number
  executionTimeMin: number | string
  executionTimeMax: number | string
  executionTimeAvg: number | string
  activationIntervalMin: number | string
  activationIntervalMax: number | string
  activationIntervalAvg: number | string
  startIntervalMin: number | string
  startIntervalMax: number | string
  startIntervalAvg: number | string
  delayTimeMin: number | string
  delayTimeMax: number | string
  delayTimeAvg: number | string
  taskLost: number | string
  jitter: number | string
}

type IsrTableRow = {
  id: string
  name: string
  status: string
  runCount: number
  executionTimeMin: number | string
  executionTimeMax: number | string
  executionTimeAvg: number | string
  callIntervalMin: number | string
  callIntervalMax: number | string
  callIntervalAvg: number | string
}

type ResourceTableRow = {
  id: string
  name: string
  status: string
  acquireCount: number
  releaseCount: number
}

type ServiceTableRow = {
  id: string
  name: string
  count: number
  lastStatus: number | string
}

type HookTableRow = {
  id: string
  name: string
  count: number
  lastStatus: number | string
  lastTriggerTime?: number | string
}

type CpuTableRow = {
  id: string
  name: string
  coreId: number
  loadPercent: number | string
  executionTime: number | string
  totalTime: number | string
}

type CategoryData = {
  type: CategoryType
  label: string
  tableData: any[]
}

const categoryData = ref<CategoryData[]>([
  { type: 'cpu', label: 'CPU', tableData: [] },
  { type: 'task', label: 'Tasks', tableData: [] },
  { type: 'isr', label: 'ISRs', tableData: [] },
  { type: 'hook', label: 'Hooks', tableData: [] },
  { type: 'resource', label: 'Resources', tableData: [] },
  { type: 'service', label: 'Services', tableData: [] }
])

const gridRefs = ref<Record<CategoryType, any>>({
  cpu: null,
  task: null,
  isr: null,
  hook: null,
  resource: null,
  service: null
})

const setGridRef = (type: CategoryType, el: any) => {
  if (el) {
    gridRefs.value[type] = el
  }
}

const getColumns = (type: CategoryType) => {
  switch (type) {
    case 'cpu':
      return [
        { field: 'name', title: 'Core Name', minWidth: 150 },
        { field: 'coreId', title: 'Core ID', width: 100 },
        { field: 'loadPercent', title: 'Load (%)', width: 120 },
        { field: 'totalTime', title: 'Total Time (ms)', width: 150 }
      ]
    case 'task':
      return [
        { field: 'name', title: 'Name', minWidth: 150 },
        { field: 'status', title: 'Status', width: 100 },
        { field: 'activeCount', title: 'Active Count', width: 120 },
        { field: 'startCount', title: 'Start Count', width: 120 },
        { field: 'executionTimeMin', title: 'Exec Min (μs)', width: 120 },
        { field: 'executionTimeMax', title: 'Exec Max (μs)', width: 120 },
        { field: 'executionTimeAvg', title: 'Exec Avg (μs)', width: 120 },
        { field: 'activationIntervalMin', title: 'Act Int Min (μs)', width: 140 },
        { field: 'activationIntervalMax', title: 'Act Int Max (μs)', width: 140 },
        { field: 'activationIntervalAvg', title: 'Act Int Avg (μs)', width: 140 },
        { field: 'startIntervalMin', title: 'Start Int Min (μs)', width: 140 },
        { field: 'startIntervalMax', title: 'Start Int Max (μs)', width: 140 },
        { field: 'startIntervalAvg', title: 'Start Int Avg (μs)', width: 140 },
        { field: 'delayTimeMin', title: 'Delay Min (μs)', width: 130 },
        { field: 'delayTimeMax', title: 'Delay Max (μs)', width: 130 },
        { field: 'delayTimeAvg', title: 'Delay Avg (μs)', width: 130 },
        { field: 'taskLost', title: 'Task Lost (%)', width: 120 },
        { field: 'jitter', title: 'Jitter (%)', width: 120 }
      ]
    case 'isr':
      return [
        { field: 'name', title: 'Name', minWidth: 150 },
        { field: 'status', title: 'Status', width: 100 },
        { field: 'runCount', title: 'Run Count', width: 120 },
        { field: 'executionTimeMin', title: 'Exec Min (μs)', width: 120 },
        { field: 'executionTimeMax', title: 'Exec Max (μs)', width: 120 },
        { field: 'executionTimeAvg', title: 'Exec Avg (μs)', width: 120 },
        { field: 'callIntervalMin', title: 'Call Int Min (μs)', width: 140 },
        { field: 'callIntervalMax', title: 'Call Int Max (μs)', width: 140 },
        { field: 'callIntervalAvg', title: 'Call Int Avg (μs)', width: 140 }
      ]
    case 'resource':
      return [
        { field: 'name', title: 'Name', minWidth: 150 },
        { field: 'status', title: 'Status', width: 100 },
        { field: 'acquireCount', title: 'Acquire Count', width: 140 },
        { field: 'releaseCount', title: 'Release Count', width: 140 }
      ]
    case 'service':
      return [
        { field: 'name', title: 'Name', minWidth: 150 },
        { field: 'count', title: 'Count', width: 120 },
        { field: 'lastStatus', title: 'Last Status', width: 120 }
      ]
    case 'hook':
      return [
        { field: 'name', title: 'Name', minWidth: 150 },
        { field: 'count', title: 'Count', width: 120 },
        { field: 'lastStatus', title: 'Last Status', width: 120 },
        { field: 'lastTriggerTime', title: 'Last Trigger Time (μs)', width: 180 }
      ]
    default:
      return []
  }
}

const getGridOptions = (type: CategoryType): VxeGridProps => {
  return {
    size: 'mini',
    border: true,
    showOverflow: true,
    height: height.value - 60, // 减去 toolbar(40px) 和 tabs header(约50px)
    columnConfig: {
      resizable: true
    },
    columns: getColumns(type).map((col) => ({
      ...col,
      slots: { default: `default_${col.field}` }
    })),
    rowConfig: {
      keyField: 'id'
    },
    align: 'center',
    scrollX: {
      enabled: true
    },
    scrollY: {
      enabled: true
    }
  }
}

const globalStart = useGlobalStart()

// 解析变量ID以确定类型和名称
const parseVarId = (id: string) => {
  // Format: OsTrace.{ortiId}.{Type}.{key}.{metric}
  // Example: OsTrace.ECU_1.Task.T_1_0.Status
  const parts = id.split('.')
  if (parts.length == 4) {
    const type = 'cpu' as CategoryType
    const key = parts.slice(0, -1).join('.')
    const metric = parts.at(-1)
    return { type, key, metric, fullId: id }
  } else {
    const type = parts[2].toLowerCase() as CategoryType
    const key = parts.slice(0, -1).join('.')
    const metric = parts.at(-1)

    return { type, key, metric, fullId: id }
  }
}

// 格式化数值
const formatValue = (value: number | string): string => {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toString()
    }
    return parseFloat(value.toFixed(2)).toString()
  }
  return value
}

// 数据更新处理
function dataUpdate({
  key,
  values
}: {
  key: string
  values: [number, { value: number | string; rawValue: number }][]
}) {
  if (isPaused.value || !values || values.length === 0) {
    return
  }

  const latestData = values[values.length - 1]
  const parsed = parseVarId(key)

  if (!parsed) return

  const { type, key: itemKey, metric } = parsed

  // 查找对应的category
  const category = categoryData.value.find((c) => c.type === type)
  if (!category) return

  // 查找行数据（应该已经由onMounted初始化）
  let row = category.tableData.find((r) => r.id === itemKey)
  if (!row) {
    // 如果没找到，说明可能是动态添加的，创建新行
    row = {
      id: itemKey,
      name: itemKey
    }

    // 根据类型初始化不同字段
    switch (type) {
      case 'cpu':
        Object.assign(row, {
          coreId: 0,
          loadPercent: '--',
          executionTime: '--',
          totalTime: '--'
        })
        break
      case 'task':
        Object.assign(row, {
          status: '--',
          activeCount: 0,
          startCount: 0,
          executionTimeMin: '--',
          executionTimeMax: '--',
          executionTimeAvg: '--',
          activationIntervalMin: '--',
          activationIntervalMax: '--',
          activationIntervalAvg: '--',
          startIntervalMin: '--',
          startIntervalMax: '--',
          startIntervalAvg: '--',
          delayTimeMin: '--',
          delayTimeMax: '--',
          delayTimeAvg: '--',
          taskLost: '--',
          jitter: '--'
        })
        break
      case 'isr':
        Object.assign(row, {
          status: '--',
          runCount: 0,
          executionTimeMin: '--',
          executionTimeMax: '--',
          executionTimeAvg: '--',
          callIntervalMin: '--',
          callIntervalMax: '--',
          callIntervalAvg: '--'
        })
        break
      case 'resource':
        Object.assign(row, {
          status: '--',
          acquireCount: 0,
          releaseCount: 0
        })
        break
      case 'service':
        Object.assign(row, {
          count: 0,
          lastStatus: '--'
        })
        break
      case 'hook':
        Object.assign(row, {
          count: 0,
          lastStatus: '--',
          lastTriggerTime: '--'
        })
        break
    }

    category.tableData.push(row)
  }

  // 更新对应的metric值
  const value = latestData[1].value

  // 映射metric名称到字段名
  const metricMap: Record<string, string> = {
    LoadPercent: 'loadPercent',
    TotalTime: 'totalTime',
    Status: 'status',
    ActiveCount: 'activeCount',
    StartCount: 'startCount',
    ExecutionTimeMin: 'executionTimeMin',
    ExecutionTimeMax: 'executionTimeMax',
    ExecutionTimeAvg: 'executionTimeAvg',
    ActivationIntervalMin: 'activationIntervalMin',
    ActivationIntervalMax: 'activationIntervalMax',
    ActivationIntervalAvg: 'activationIntervalAvg',
    StartIntervalMin: 'startIntervalMin',
    StartIntervalMax: 'startIntervalMax',
    StartIntervalAvg: 'startIntervalAvg',
    DelayTimeMin: 'delayTimeMin',
    DelayTimeMax: 'delayTimeMax',
    DelayTimeAvg: 'delayTimeAvg',
    TaskLost: 'taskLost',
    Jitter: 'jitter',
    RunCount: 'runCount',
    CallIntervalMin: 'callIntervalMin',
    CallIntervalMax: 'callIntervalMax',
    CallIntervalAvg: 'callIntervalAvg',
    AcquireCount: 'acquireCount',
    ReleaseCount: 'releaseCount',
    Count: 'count',
    LastStatus: 'lastStatus',
    LastTriggerTime: 'lastTriggerTime'
  }

  const fieldName = metricMap[metric!]
  if (fieldName && row) {
    row[fieldName] = formatValue(value)
  }
}
watch(globalStart, (newVal) => {
  isPaused.value = false
  if (newVal) {
    initializeData()
  }
})

let bindKeys: string[] = []
// 清理旧的事件监听
const cleanupEventListeners = () => {
  bindKeys.forEach((key) => {
    window.logBus.off(key, dataUpdate)
  })
  bindKeys = []
}

// 初始化数据
const initializeData = () => {
  if (!orti.value) return

  // 清理旧数据
  categoryData.value.forEach((category) => {
    category.tableData = []
  })

  // 清理旧的事件监听
  cleanupEventListeners()

  const ortiId = orti.value.id
  const getKey = (type: TaskType, id: number, coreId: number): string => {
    const map: Record<TaskType, string> = {
      [TaskType.TASK]: 'Task',
      [TaskType.ISR]: 'ISR',
      [TaskType.RESOURCE]: 'Resource',
      [TaskType.SERVICE]: 'Service',
      [TaskType.HOOK]: 'Hook',
      [TaskType.SPINLOCK]: 'Spinlock',
      [TaskType.LINE]: 'Line'
    }
    return `${ortiId}.${map[type]}.${type}_${id}_${coreId}`
  }

  // 初始化 CPU Cores 数据
  const cpuCategory = categoryData.value.find((c) => c.type === 'cpu')
  if (cpuCategory && orti.value.coreConfigs) {
    // 获取所有不同的 coreId
    const uniqueCoreIds = new Set<number>()
    orti.value.coreConfigs.forEach((config) => {
      uniqueCoreIds.add(config.coreId)
    })

    // 为每个 core 创建一行
    uniqueCoreIds.forEach((coreId) => {
      const key = `OsTrace.${ortiId}.Core${coreId}`
      const row: any = {
        id: key,
        name: `Core ${coreId}`,
        coreId: coreId,
        loadPercent: '--',
        executionTime: '--',
        totalTime: '--'
      }

      const keys = ['LoadPercent', 'TotalTime']
      keys.forEach((xkey) => {
        bindKeys.push(`${key}.${xkey}`)
      })

      cpuCategory.tableData.push(row)
    })
  }

  // 初始化 Tasks 数据
  if (orti.value.coreConfigs) {
    const taskCategory = categoryData.value.find((c) => c.type === 'task')
    if (taskCategory) {
      orti.value.coreConfigs
        .filter((config) => config.type === 0)
        .forEach((taskConfig) => {
          const key = `OsTrace.${getKey(TaskType.TASK, taskConfig.id, taskConfig.coreId)}`

          const row: any = {
            id: key,
            name: taskConfig.name,
            status: '--',
            activeCount: 0,
            startCount: 0,
            executionTimeMin: '--',
            executionTimeMax: '--',
            executionTimeAvg: '--',
            activationIntervalMin: '--',
            activationIntervalMax: '--',
            activationIntervalAvg: '--',
            startIntervalMin: '--',
            startIntervalMax: '--',
            startIntervalAvg: '--',
            delayTimeMin: '--',
            delayTimeMax: '--',
            delayTimeAvg: '--',
            taskLost: '--',
            jitter: '--'
          }
          const keys = [
            'Status',
            'ActiveCount',
            'StartCount',
            'ExecutionTimeMin',
            'ExecutionTimeMax',
            'ExecutionTimeAvg',
            'ActivationIntervalMin',
            'ActivationIntervalMax',
            'ActivationIntervalAvg',
            'StartIntervalMin',
            'StartIntervalMax',
            'StartIntervalAvg',
            'DelayTimeMin',
            'DelayTimeMax',
            'DelayTimeAvg',
            'TaskLost',
            'Jitter'
          ]
          keys.forEach((xkey) => {
            bindKeys.push(`${key}.${xkey}`)
          })
          taskCategory.tableData.push(row)
        })
    }
  }

  // 初始化 ISRs 数据
  if (orti.value.coreConfigs) {
    const isrCategory = categoryData.value.find((c) => c.type === 'isr')
    if (isrCategory) {
      orti.value.coreConfigs
        .filter((config) => config.type === 1) // ISR type
        .forEach((isrConfig) => {
          const key = `OsTrace.${getKey(TaskType.ISR, isrConfig.id, isrConfig.coreId)}`
          const row: any = {
            id: key,
            name: isrConfig.name,
            status: '--',
            runCount: 0,
            executionTimeMin: '--',
            executionTimeMax: '--',
            executionTimeAvg: '--',
            callIntervalMin: '--',
            callIntervalMax: '--',
            callIntervalAvg: '--'
          }
          const keys = [
            'Status',
            'RunCount',
            'ExecutionTimeMin',
            'ExecutionTimeMax',
            'ExecutionTimeAvg',
            'CallIntervalMin',
            'CallIntervalMax',
            'CallIntervalAvg'
          ]
          keys.forEach((xkey) => {
            bindKeys.push(`${key}.${xkey}`)
          })
          isrCategory.tableData.push(row)
        })
    }
  }

  // 初始化 Resources 数据
  if (orti.value.resourceConfigs) {
    const resourceCategory = categoryData.value.find((c) => c.type === 'resource')
    if (resourceCategory) {
      orti.value.resourceConfigs.forEach((resourceConfig) => {
        const key = `OsTrace.${getKey(TaskType.RESOURCE, resourceConfig.id, resourceConfig.coreId)}`
        const row: any = {
          id: key,
          name: resourceConfig.name,
          status: '--',
          acquireCount: 0,
          releaseCount: 0
        }
        resourceCategory.tableData.push(row)
        const keys = ['Status', 'AcquireCount', 'ReleaseCount']
        keys.forEach((xkey) => {
          bindKeys.push(`${key}.${xkey}`)
        })
      })
    }
  }

  // 初始化 Services 数据
  if (orti.value.serviceConfigs) {
    const serviceCategory = categoryData.value.find((c) => c.type === 'service')
    if (serviceCategory) {
      orti.value.serviceConfigs.forEach((serviceConfig) => {
        const key = `OsTrace.${getKey(TaskType.SERVICE, serviceConfig.id, 0)}`
        const row: any = {
          id: key,
          name: serviceConfig.name,
          count: 0,
          lastStatus: '--'
        }
        serviceCategory.tableData.push(row)
        const keys = ['Count', 'LastStatus']
        keys.forEach((xkey) => {
          bindKeys.push(`${key}.${xkey}`)
        })
      })
    }
  }

  // 初始化 Hooks 数据
  if (orti.value.hostConfigs) {
    const hookCategory = categoryData.value.find((c) => c.type === 'hook')
    if (hookCategory) {
      orti.value.hostConfigs.forEach((hookConfig) => {
        const key = `OsTrace.${getKey(TaskType.HOOK, hookConfig.id, 0)}`
        const row: any = {
          id: key,
          name: hookConfig.name,
          count: 0,
          lastStatus: '--',
          lastTriggerTime: '--'
        }
        hookCategory.tableData.push(row)
        const keys = ['Count', 'LastStatus', 'LastTriggerTime']
        keys.forEach((xkey) => {
          bindKeys.push(`${key}.${xkey}`)
        })
      })
    }
  }

  // 监听所有OsTrace相关的变量
  bindKeys.forEach((key) => {
    window.logBus.on(key, dataUpdate)
  })
}

watchEffect(() => {
  initializeData()
})

onUnmounted(() => {
  // 解除所有事件监听
  cleanupEventListeners()
})
</script>
<style scoped>
.ostrace-table {
  height: v-bind(height + 'px');
  display: flex;
  flex-direction: column;
  width: 100%;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;

  padding-left: 5px;
  padding: 1px;
}

.pause-active {
  box-shadow: inset 0 0 4px var(--el-color-info-light-5);
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
}

.main {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.category-table {
  width: 100%;
}

.border-bottom {
  border-bottom: solid 1px var(--el-border-color);
  background-color: var(--el-background-color);
}
</style>
<style>
.category-tabs {
  .el-tabs__content {
    padding: 0px !important;
  }
}
</style>
