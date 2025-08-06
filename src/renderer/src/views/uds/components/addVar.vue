<template>
  <div style="margin-top: -5px">
    <VxeGrid v-bind="gridOptions" ref="vxeRef" @cell-click="handleCellClick">
      <template #toolbar>
        <div
          style="
            justify-content: flex-start;
            display: flex;
            align-items: center;
            gap: 4px;
            padding-bottom: 5px;
          "
        >
          <el-input
            v-model="searchText"
            placeholder="Search by name..."
            style="width: 200px"
            size="small"
            clearable
            @change="handleSearch"
            @clear="handleSearch"
          >
            <template #prefix>
              <Icon :icon="searchIcon" />
            </template>
          </el-input>
          <el-divider direction="vertical" />
          <el-tooltip
            effect="light"
            :content="!isExpanded ? 'Collapse All' : 'Expand All'"
            placement="bottom"
          >
            <el-button link @click="toggleExpand">
              <Icon
                :icon="isExpanded ? tableExpandIcon : tableCollapseIcon"
                style="font-size: 14px"
              />
            </el-button>
          </el-tooltip>
          <el-divider direction="vertical" />
          <el-tooltip effect="light" content="Add Variable" placement="bottom">
            <el-button type="primary" link :disabled="!highlightedRow" @click="addVariable">
              <Icon :icon="variableIcon" style="font-size: 14px" />
            </el-button>
          </el-tooltip>
          <el-tooltip
            v-if="props.highlightId"
            effect="light"
            content="Remove Attach Signal"
            placement="bottom"
          >
            <el-button type="warning" link @click="removeSignal">
              <Icon :icon="deleteIcon" style="font-size: 14px" />
            </el-button>
          </el-tooltip>
        </div>
      </template>
      <template #type="{ row }">
        <Icon :icon="row.type === 'user' ? userIcon : varIcon" />
      </template>
    </VxeGrid>
  </div>
</template>
<script setup lang="ts">
import { useDataStore } from '@r/stores/data'
import { computed, h, ref, onMounted, nextTick } from 'vue'
import type { VxeGridProps } from 'vxe-table'
import varIcon from '@iconify/icons-mdi/application-variable-outline'
import userIcon from '@iconify/icons-material-symbols/person-outline'
import variableIcon from '@iconify/icons-material-symbols/variable-add'
import { VxeGrid } from 'vxe-table'
import { Icon } from '@iconify/vue'
import tableExpandIcon from '@iconify/icons-material-symbols/expand-all'
import tableCollapseIcon from '@iconify/icons-material-symbols/collapse-all'
import { GraphBindVariableValue, GraphNode } from 'src/preload/data'
import { v4 } from 'uuid'
import searchIcon from '@iconify/icons-material-symbols/search'
import { ElMessage } from 'element-plus'
import { getAllSysVar } from 'nodeCan/sysVar'
import deleteIcon from '@iconify/icons-material-symbols/leak-remove'

interface TreeItem {
  id: string
  name: string
  parentId?: string
  children: TreeItem[]
  type: 'user' | 'system'
  value?: {
    type: string
    initValue?: any
    min?: number
    max?: number
    unit?: string
  }
  desc?: string
}

const vxeRef = ref()
const props = defineProps<{
  height: number
  highlightId?: string
}>()

const database = useDataStore()

const highlightedRow = ref<TreeItem | null>(null)
const isExpanded = ref(false)

const searchText = ref('')
const allVariables = computed(() => {
  const variables: TreeItem[] = []
  const variableMap = new Map<string, TreeItem>()
  const sysVars = Object.values(getAllSysVar(database.devices, database.tester))
  const allList = [...Object.values(database.vars), ...sysVars]
  // 先创建所有用户变量节点
  for (const varItem of allList) {
    const variable: TreeItem = {
      id: varItem.id,
      name: varItem.name,
      parentId: varItem.parentId,
      children: [],
      type: varItem.type,
      value: varItem.value,
      desc: varItem.desc
    }
    variableMap.set(varItem.id, variable)
  }

  // 处理用户变量的父子关系
  for (const varItem of allList) {
    const variable = variableMap.get(varItem.id)!
    if (varItem.parentId) {
      const parent = variableMap.get(varItem.parentId)
      if (parent) {
        parent.children.push(variable)
      }
    } else {
      variables.push(variable)
    }
  }

  return variables
})

const gridOptions = computed<VxeGridProps<TreeItem>>(() => ({
  border: true,
  height: props.height,
  size: 'mini',
  treeConfig: {
    rowField: 'id',
    childrenField: 'children',
    expandAll: false
  },
  rowConfig: {
    keyField: 'id',
    isCurrent: true
  },
  toolbarConfig: {
    slots: {
      tools: 'toolbar'
    }
  },
  columns: [
    { field: 'type', title: '', width: 40, slots: { default: 'type' } },
    { field: 'name', title: 'Name', minWidth: 200, treeNode: true },
    { field: 'value.type', title: 'Type', width: 100 },
    { field: 'value.initValue', title: 'Init Value', width: 100 },
    { field: 'value.min', title: 'Min', width: 100 },
    { field: 'value.max', title: 'Max', width: 100 },
    { field: 'value.unit', title: 'Unit', width: 100 },
    { field: 'desc', title: 'Description', width: 200 }
  ],
  data: allVariables.value
}))

function handleCellClick({ row }: { row: TreeItem }) {
  if (row.value) {
    highlightedRow.value = row
  } else {
    //clearCurrentRow
    vxeRef.value?.clearCurrentRow()
    highlightedRow.value = null
  }
}

function toggleExpand() {
  vxeRef.value.setAllTreeExpand(false)
  isExpanded.value = false
}

const emits = defineEmits<{
  addVariable: [value: GraphNode<GraphBindVariableValue> | null] // named tuple syntax
}>()

function randomColor() {
  let color
  do {
    color =
      '#' +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, '0')
  } while (color === '#ffffff' || color === '#FFFFFF')
  return color
}
function removeSignal() {
  emits('addVariable', null)
}
function addVariable() {
  if (!highlightedRow.value) return
  const fullNameList: string[] = [highlightedRow.value.name]
  let parent = highlightedRow.value.parentId
  while (parent) {
    const parentInfo = database.vars[parent]
    if (parentInfo) {
      fullNameList.unshift(parentInfo.name)
      parent = parentInfo.parentId
    } else {
      const sysVarInfo = getAllSysVar(database.devices, database.tester)[parent]
      if (sysVarInfo) {
        fullNameList.unshift(sysVarInfo.name)
        parent = sysVarInfo.parentId
      } else {
        break
      }
    }
  }

  emits('addVariable', {
    type: 'variable',
    enable: true,
    id: highlightedRow.value.id,
    name: highlightedRow.value.name,
    color: randomColor(),
    yAxis: {
      min: highlightedRow.value.value?.min || 0,
      max: highlightedRow.value.value?.max || 100,
      unit: highlightedRow.value.value?.unit
    },
    bindValue: {
      variableId: highlightedRow.value.id,
      variableType: highlightedRow.value.type,
      variableName: highlightedRow.value.name,
      variableFullName: fullNameList.join('.')
    }
  })
}

// 添加一个辅助函数来处理ID匹配
function matchesId(searchText: string, id?: string): boolean {
  if (!id) return false
  return id.toLowerCase().includes(searchText.toLowerCase())
}

// 修改 filterTreeData 函数中的匹配逻辑
function filterTreeData(
  data: TreeItem[],
  searchText: string
): { items: TreeItem[]; count: number } {
  let count = 0
  const filtered = data
    .map((item) => {
      if (count >= MAX_SEARCH_RESULTS) return null

      const newItem = { ...item }
      if (item.children && item.children.length) {
        const result = filterTreeData(item.children, searchText)
        newItem.children = result.items
        count += result.count
      }

      const matches =
        item.name.toLowerCase().includes(searchText) ||
        (newItem.children && newItem.children.length > 0) ||
        item.value?.type?.toLowerCase().includes(searchText) ||
        String(item.value?.initValue).toLowerCase().includes(searchText) ||
        String(item.value?.min).includes(searchText) ||
        String(item.value?.max).includes(searchText) ||
        item.value?.unit?.toLowerCase().includes(searchText) ||
        matchesId(searchText, item.id)

      if (matches) {
        count++
      }

      return matches ? newItem : null
    })
    .filter(Boolean) as TreeItem[]

  return { items: filtered, count }
}

// 同样需要更新 collectExpandedKeys 函数中的匹配逻辑
function collectExpandedKeys(data: TreeItem[], searchText: string) {
  const keys: TreeItem[] = []

  data.forEach((item) => {
    if (item.children && item.children.length) {
      const childKeys = collectExpandedKeys(item.children, searchText)
      if (
        childKeys.length > 0 ||
        item.name.toLowerCase().includes(searchText) ||
        matchesId(searchText, item.id)
      ) {
        keys.push(item)
        keys.push(...childKeys)
      }
    } else if (
      item.name.toLowerCase().includes(searchText) ||
      item.value?.type?.toLowerCase().includes(searchText) ||
      String(item.value?.initValue).toLowerCase().includes(searchText) ||
      String(item.value?.min).includes(searchText) ||
      String(item.value?.max).includes(searchText) ||
      item.value?.unit?.toLowerCase().includes(searchText) ||
      matchesId(searchText, item.id)
    ) {
      keys.push(item)
    }
  })

  return keys
}

// 添加一个常量定义最大搜索结果数
const MAX_SEARCH_RESULTS = 10

// 修改 handleSearch 函数
function handleSearch() {
  const filterVal = searchText.value.trim().toLowerCase()
  vxeRef.value?.remove()

  if (filterVal) {
    const { items: filteredData } = filterTreeData(allVariables.value, filterVal)
    vxeRef.value?.insertAt(filteredData)

    // Collect and set expanded keys
    const expandedKeys = collectExpandedKeys(filteredData, filterVal)
    vxeRef.value?.setTreeExpand(expandedKeys, true)
  } else {
    const records = vxeRef.value.getTreeExpandRecords()
    vxeRef.value?.insertAt(allVariables.value).then(() => {
      vxeRef.value?.setTreeExpand(records, true)
    })
  }
}

// Initialize data
onMounted(() => {
  vxeRef.value?.insertAt(allVariables.value).then(() => {
    if (props.highlightId) {
      const row = vxeRef.value?.getRowById(props.highlightId)
      if (row) {
        vxeRef.value?.setCurrentRow(row)
        nextTick(() => {
          vxeRef.value?.scrollToRow(row, 'id')
        })
      }
    }
  })
})
</script>
<style>
.row-highlight {
  background-color: #e6f3ff !important;
}

:deep(.vxe-toolbar) {
  background-color: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
</style>

