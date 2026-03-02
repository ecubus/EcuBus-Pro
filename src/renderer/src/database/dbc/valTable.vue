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
            :placeholder="i18next.t('database.dbc.valTable.placeholders.searchByName')"
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
import type { CanDB } from 'nodeCan/can'
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
    field: 'name',
    title: i18next.t('database.dbc.valTable.columns.name'),
    minWidth: 120,
    fixed: 'left'
  },
  { field: 'comment', title: i18next.t('database.dbc.valTable.columns.comment'), minWidth: 120 },
  {
    field: 'usage',
    title: i18next.t('database.dbc.valTable.columns.usage'),
    minWidth: 200,
    showOverflow: true
  }
]

// 准备表格数据
const tableData = computed(() => {
  const data: any[] = []

  // 添加ValueTables数据 (value_tables: Record<name, Record<value, label>>)
  Object.entries(dbcObj.value.value_tables || {}).forEach(([name, table]) => {
    const tbl = table as Record<string, unknown>
    data.push({
      name,
      comment: (tbl?.comment as string) || '',
      usage: '',
      values: (tbl?.values as Record<string, string>) ?? (table as Record<string, string>) ?? {},
      type: 'valueTable'
    })
  })

  // 添加Message中Signal的values数据
  dbcObj.value.messages.forEach((message) => {
    message.signals.forEach((signal) => {
      if (Object.keys(signal.values || {}).length > 0) {
        data.push({
          name: `VtSig_${signal.name}`,
          comment: signal.comment || '',
          usage: `${message.name}:${signal.name}`,
          values: signal.values,
          type: 'signal'
        })
      }
    })
  })

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
        item.name.toLowerCase().includes(filterVal) ||
        item.comment.toLowerCase().includes(filterVal) ||
        item.usage.toLowerCase().includes(filterVal)
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
  expandConfig: {
    lazy: false,
    expandRowKeys: [],
    accordion: false,
    trigger: 'row'
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
