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
import { DBC, Message, Signal } from './dbcVisitor'

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
  { field: 'name', title: 'Name', minWidth: 120, fixed: 'left' },
  { field: 'comment', title: 'Comment', minWidth: 120 },
  {
    field: 'usage',
    title: 'Usage',
    minWidth: 200,
    showOverflow: true
  }
]

// 准备表格数据
const tableData = computed(() => {
  const data: any[] = []

  // 添加ValueTables数据
  Object.entries(dbcObj.value.valueTables).forEach(([name, table]) => {
    //遍历所有信号，看看哪些信号使用了这个valueTable
    const usage: string[] = []
    for (const message of Object.values<Message>(dbcObj.value.messages)) {
      for (const signal of Object.values<Signal>(message.signals)) {
        if (signal.valueTable === name) {
          usage.push(`${message.name}:${signal.name}`)
        }
      }
    }

    data.push({
      name,
      comment: table.comment || '',
      usage: usage.join(', '),
      values: table.values,
      type: 'valueTable'
    })
  })

  // 添加Message中Signal的values数据
  Object.entries(dbcObj.value.messages).forEach(([_, message]) => {
    Object.entries(message.signals).forEach(([signalName, signal]) => {
      if (signal.values && signal.values.length > 0) {
        data.push({
          name: `VtSig_${signalName}`,
          comment: '',
          usage: `${message.name}:${signalName}`,
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
