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
            placeholder="Search by name..."
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
import { DBC, Attribute } from './dbcVisitor'

const props = defineProps<{
  editIndex: string
  width: number
  height: number
}>()

const dbcObj = defineModel<DBC>({
  required: true
})

const h = toRef(props, 'height')
const w = toRef(props, 'width')

// 表格列定义
const columns: VxeGridProps['columns'] = [
  {
    field: 'attrType',
    title: 'Type of Object',
    width: 140,
    fixed: 'left',
    formatter: ({ cellValue }) => {
      const typeMap = {
        network: 'Network',
        node: 'Node',
        message: 'Message',
        signal: 'Signal',
        envVar: 'EnvVar'
      }
      return typeMap[cellValue as keyof typeof typeMap] || cellValue
    }
  },
  { field: 'name', title: 'Name', minWidth: 150 },

  {
    field: 'type',
    title: 'Value Type',
    width: 120,
    formatter: ({ cellValue }) => {
      const typeMap = {
        INT: 'Integer',
        FLOAT: 'Float',
        STRING: 'String',
        ENUM: 'Enum',
        HEX: 'Hex'
      }
      return typeMap[cellValue as keyof typeof typeMap] || cellValue
    }
  },
  {
    field: 'min',
    title: 'Min',
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
    title: 'Max',
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
    title: 'Default',
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

// 准备表格数据
const tableData = computed(() => {
  return Object.values(dbcObj.value.attributes)
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
        item.name.toLowerCase().includes(filterVal) ||
        item.attrType.toLowerCase().includes(filterVal) ||
        item.type.toLowerCase().includes(filterVal)
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
    keyField: 'name'
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
