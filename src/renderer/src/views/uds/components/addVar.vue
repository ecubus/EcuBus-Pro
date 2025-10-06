<template>
  <div style="margin-top: -5px">
    <VxeGrid
      v-bind="gridOptions"
      ref="vxeRef"
      class="add-var-grid"
      @checkbox-change="handleCellClick"
    >
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
            <el-button type="primary" link :disabled="!highlightedRows.length" @click="addVariable">
              <Icon :icon="variableIcon" style="font-size: 14px" />
              <span v-if="highlightedRows.length" style="margin-left: 4px; font-size: 12px">
                ({{ highlightedRows.length }})
              </span>
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
    enum?: { name: string; value: number }[]
  }
  desc?: string
}

const vxeRef = ref()
const props = defineProps<{
  height: number
  highlightId?: string
}>()

const database = useDataStore()

const highlightedRows = ref<TreeItem[]>([])
const isExpanded = ref(false)

const searchText = ref('')
const allVariables = computed(() => {
  const variables: TreeItem[] = []
  const variableMap = new Map<string, TreeItem>()
  const sysVars = Object.values(
    getAllSysVar(database.devices, database.tester, database.database.orti)
  )

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

const gridOptions = computed<any>(() => ({
  border: true,
  height: props.height,

  size: 'mini',
  treeConfig: {
    rowField: 'id',
    childrenField: 'children',
    expandAll: false
  },
  checkboxConfig: {
    highlight: true,
    showHeader: false,
    labelField: 'name',
    visibleMethod: ({ row }) => {
      return false
    },
    checkMethod: ({ row }) => {
      return row.value
    },
    trigger: 'row'
  },
  rowConfig: {
    keyField: 'id'
    // isCurrent: true
  },
  toolbarConfig: {
    slots: {
      tools: 'toolbar'
    }
  },
  columnConfig: {
    resizable: true
  },
  columns: [
    // { type: 'checkbox', title: 'type', minWidth: 40, align: 'center'},
    {
      type: 'checkbox',
      field: 'type',
      title: '',
      width: 32,
      slots: { default: 'type' },
      resizable: false
    },

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

function handleCellClick() {
  highlightedRows.value = vxeRef.value.getCheckboxRecords().filter((row: TreeItem) => row.value)
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
  if (!highlightedRows.value.length) return
  for (const row of highlightedRows.value) {
    const fullNameList: string[] = [row.name]
    let parent = row.parentId
    while (parent) {
      const parentInfo = database.vars[parent]
      if (parentInfo) {
        fullNameList.unshift(parentInfo.name)
        parent = parentInfo.parentId
      } else {
        const sysVarInfo = getAllSysVar(database.devices, database.tester, database.database.orti)[
          parent
        ]
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
      id: row.id,
      name: row.name,
      color: randomColor(),
      yAxis: {
        min: row.value?.min || 0,
        max: row.value?.max || 100,
        unit: row.value?.unit
      },
      bindValue: {
        variableId: row.id,
        variableType: row.type,
        variableName: row.name,
        variableFullName: fullNameList.join('.'),
        variableValueType: row.value?.type as 'number' | 'string' | 'array',
        stringRange: row.value?.enum
      }
    })
  }
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

      // 检查当前节点是否匹配
      const currentMatches =
        item.name.toLowerCase().includes(searchText) ||
        item.value?.type?.toLowerCase().includes(searchText) ||
        String(item.value?.initValue).toLowerCase().includes(searchText) ||
        String(item.value?.min).includes(searchText) ||
        String(item.value?.max).includes(searchText) ||
        item.value?.unit?.toLowerCase().includes(searchText) ||
        matchesId(searchText, item.id)

      // 如果当前节点匹配，保留所有子节点
      if (currentMatches) {
        count++
        // 保持原有的子节点结构不变
        if (item.children && item.children.length) {
          newItem.children = item.children
        }
        return newItem
      }

      // 如果当前节点不匹配，递归过滤子节点
      if (item.children && item.children.length) {
        const result = filterTreeData(item.children, searchText)
        newItem.children = result.items
        count += result.count

        // 如果有子节点匹配，保留当前节点
        if (newItem.children.length > 0) {
          return newItem
        }
      }

      return null
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
.vxe-table--render-default .vxe-body--row.row--checked > .vxe-body--column {
  background-color: #e6f3ff !important;
}

:deep(.vxe-toolbar) {
  background-color: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
</style>
