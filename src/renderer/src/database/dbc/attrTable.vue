<template>
  <div class="main">
    <VxeGrid ref="xGrid" v-bind="gridOptions">
      <template #toolbar>
        <div
          style="
            justify-content: flex-start;
            display: flex;
            align-items: center;
            gap: 2px;
            margin-left: 5px;
            padding: 8px;
          "
        >
          <el-input
            v-model="searchText"
            :placeholder="i18next.t('database.dbc.attrTable.placeholders.searchByName')"
            style="width: 200px"
            size="small"
            clearable
            @input="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <Icon :icon="searchIcon" />
            </template>
          </el-input>
        </div>
      </template>
    </VxeGrid>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { Icon } from '@iconify/vue'
import searchIcon from '@iconify/icons-material-symbols/search'
import type {
  CanDB,
  EcuDefine,
  EnvDefine,
  FrameDefine,
  GlobalDefine,
  SignalDefine
} from 'nodeCan/can'
import i18next from 'i18next'

const props = defineProps<{
  editIndex: string
  width: number
  height: number
}>()

const dbcObj = defineModel<CanDB>({
  required: true
})

const h = toRef(props, 'height')
const w = toRef(props, 'width')

// 表格列定义
const columns: VxeGridProps['columns'] = [
  {
    field: 'attrType',
    title: i18next.t('database.dbc.attrTable.columns.typeOfObject'),
    width: 140,
    fixed: 'left',
    formatter: ({ cellValue }) => {
      const typeMap = {
        network: i18next.t('database.dbc.attrTable.attrTypes.network'),
        node: i18next.t('database.dbc.attrTable.attrTypes.node'),
        message: i18next.t('database.dbc.attrTable.attrTypes.message'),
        signal: i18next.t('database.dbc.attrTable.attrTypes.signal'),
        envVar: i18next.t('database.dbc.attrTable.attrTypes.envVar')
      }
      return typeMap[cellValue as keyof typeof typeMap] || cellValue
    }
  },
  { field: 'name', title: i18next.t('database.dbc.attrTable.columns.name'), minWidth: 150 },

  {
    field: 'type',
    title: i18next.t('database.dbc.attrTable.columns.valueType'),
    width: 120,
    formatter: ({ cellValue }) => {
      const typeMap = {
        INT: i18next.t('database.dbc.attrTable.valueTypes.integer'),
        FLOAT: i18next.t('database.dbc.attrTable.valueTypes.float'),
        STRING: i18next.t('database.dbc.attrTable.valueTypes.string'),
        ENUM: i18next.t('database.dbc.attrTable.valueTypes.enum'),
        HEX: i18next.t('database.dbc.attrTable.valueTypes.hex')
      }
      return typeMap[cellValue as keyof typeof typeMap] || cellValue
    }
  },
  {
    field: 'min',
    title: i18next.t('database.dbc.attrTable.columns.min'),
    width: 100,
    formatter: ({ row }) => {
      if (row.type === 'INT' || row.type === 'FLOAT' || row.type === 'HEX') {
        return row.min !== undefined ? row.min : '-'
      }
      return '-'
    }
  },
  {
    field: 'max',
    title: i18next.t('database.dbc.attrTable.columns.max'),
    width: 100,
    formatter: ({ row }) => {
      if (row.type === 'INT' || row.type === 'FLOAT' || row.type === 'HEX') {
        return row.max !== undefined ? row.max : '-'
      }
      return '-'
    }
  },

  {
    field: 'defaultValue',
    title: i18next.t('database.dbc.attrTable.columns.default'),
    width: 120,
    formatter: ({ row }) => {
      if (row.defaultValue !== undefined) {
        if (row.type === 'ENUM' && row.enumList) {
          const index = Number(row.defaultValue)
          return row.enumList[index] || row.defaultValue
        }
        return row.defaultValue
      }
      return '-'
    }
  }
]

// Parse define string for min/max/enumList
function parseDefine(define: string): { min?: number; max?: number; enumList?: string[] } {
  const result: { min?: number; max?: number; enumList?: string[] } = {}
  const parts = define.trim().split(/\s+/)
  const type = parts[0]
  if (type === 'INT' || type === 'FLOAT' || type === 'HEX') {
    if (parts[1] !== undefined) result.min = Number(parts[1])
    if (parts[2] !== undefined) result.max = Number(parts[2])
  } else if (type === 'ENUM') {
    const match = define.match(/"([^"]*)"/g)
    result.enumList = match ? match.map((s) => s.slice(1, -1)) : []
  }
  return result
}

function defToRow(
  def: { default: string; define: string; name: string; type: string },
  attrType: 'network' | 'node' | 'message' | 'signal' | 'envVar'
) {
  const { min, max, enumList } = parseDefine(def.define)
  return {
    attrType,
    name: def.name,
    type: def.type,
    min,
    max,
    defaultValue: def.default,
    enumList,
    _key: `${attrType}_${def.name}`
  }
}

// 准备表格数据 - 从 defines 数组构建
const tableData = computed(() => {
  const data: ReturnType<typeof defToRow>[] = []
  const db = dbcObj.value

  ;(db.global_defines || []).forEach((d: GlobalDefine) => data.push(defToRow(d, 'network')))
  ;(db.ecu_defines || []).forEach((d: EcuDefine) => data.push(defToRow(d, 'node')))
  ;(db.frame_defines || []).forEach((d: FrameDefine) => data.push(defToRow(d, 'message')))
  ;(db.signal_defines || []).forEach((d: SignalDefine) => data.push(defToRow(d, 'signal')))
  ;(db.env_defines || []).forEach((d: EnvDefine) => data.push(defToRow(d, 'envVar')))

  return data
})

// 搜索功能
const searchText = ref('')
const xGrid = ref()

const handleSearch = () => {
  const filterVal = searchText.value.trim().toLowerCase()
  xGrid.value?.remove()

  if (filterVal) {
    const filteredData = tableData.value.filter(
      (item) =>
        (item.name || '').toLowerCase().includes(filterVal) ||
        (item.attrType || '').toLowerCase().includes(filterVal) ||
        (item.type || '').toLowerCase().includes(filterVal)
    )
    xGrid.value?.insertAt(filteredData)
  } else {
    xGrid.value?.insertAt(tableData.value)
  }
}

// 表格配置
const gridOptions = computed<VxeGridProps>(() => ({
  border: true,
  size: 'mini',
  height: props.height - 41,
  showOverflow: true,
  rowConfig: {
    keyField: '_key'
  },
  columnConfig: { resizable: true },
  data: tableData.value,
  scrollY: {
    enabled: true,
    gt: 0,
    mode: 'wheel'
  },
  toolbarConfig: {
    slots: { tools: 'toolbar' }
  },
  columns
}))

// 初始化时加载数据
xGrid.value?.insertAt(tableData.value)

defineExpose({
  clearData: () => {
    xGrid.value?.remove()
  }
})
</script>

<style scoped>
:deep(.vxe-toolbar) {
  background-color: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
</style>
