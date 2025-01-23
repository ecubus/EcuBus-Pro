<template>
    <div style="margin-top: -5px;">
        <VxeGrid v-bind="gridOptions" ref="vxeRef" @cell-click="handleCellClick">
            <template #toolbar>
                <div style="justify-content: flex-start;display: flex;align-items: center;gap:4px;padding-bottom: 5px;">
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
                    <el-tooltip effect="light" :content="!isExpanded ? 'Collapse All' : 'Expand All'" placement="bottom">
                        <el-button link @click="toggleExpand">
                            <Icon :icon="isExpanded ?tableExpandIcon: tableCollapseIcon" style="font-size: 14px;" />
                        </el-button>
                    </el-tooltip>
                    <el-divider direction="vertical" />
                    <el-tooltip effect="light" :content="props.selectableLevel=='signal'?'Add Signal':'Add Frame'" placement="bottom">
                        <el-button type="primary" link :disabled="!highlightedRow" @click="addSignal">
                            <Icon :icon="props.selectableLevel=='signal'?waveIcon:frameIcon" style="font-size: 14px;" />
                        </el-button>
                    </el-tooltip>
                </div>
            </template>
            <template #type="{ row }">
                <Icon :icon="row.type === 'db' ? databaseIcon : row.type === 'frame' ? frameIcon : waveIcon" />
            </template>
        </VxeGrid>
    </div>
</template>
<script setup lang="ts">
import { useDataStore } from '@r/stores/data';
import { computed, h, ref, onMounted } from 'vue'
import type { VxeGridProps } from 'vxe-table'
import waveIcon from '@iconify/icons-material-symbols/airwave-rounded'
import databaseIcon from '@iconify/icons-material-symbols/database'
import frameIcon from '@iconify/icons-material-symbols/rectangle-outline'
import { VxeGrid} from 'vxe-table'
import { Icon } from '@iconify/vue'
import tableExpandIcon from '@iconify/icons-material-symbols/expand-all'
import tableCollapseIcon from '@iconify/icons-material-symbols/collapse-all'
import { GraphBindFrameValue, GraphBindSignalValue, GraphNode } from 'src/preload/data';
import { v4 } from 'uuid';
import { DBC, Signal as DbcSignal } from '@r/database/dbc/dbcVisitor'
import searchIcon from '@iconify/icons-material-symbols/search'
import { ElMessage } from 'element-plus'

// 在 interface TreeItem 之前添加类型定义
type ProtocolFilter = 'all' | 'can' | 'lin'

// 添加 SelectableLevel 类型定义
type SelectableLevel = 'signal' | 'frame'

interface TreeItem {
    id: string,
    name: string,
    children: TreeItem[]
    type: 'db' | 'frame' | 'signal'
    startBit?: number
    txNode?: string
    bitLen?: number
    frameId?: number
    dbInfo?:{
        name:string
        key:string
    }
}
const vxeRef=ref()
const props = defineProps<{
    height: number
    width: number
    protocolFilter?: ProtocolFilter  // 协议过滤
    selectableLevel?: SelectableLevel  // 可选择的层级
}>()

// 修改默认值
const defaultProps = {
    protocolFilter: 'all' as ProtocolFilter,
    selectableLevel: 'signal' as SelectableLevel
}

const database = useDataStore().database

const highlightedRow = ref<TreeItem | null>(null)
const isExpanded = ref(false)

const searchText = ref('')
const allSignals = computed(() => {
    const filter = props.protocolFilter || defaultProps.protocolFilter
    const signals: TreeItem[] = []
    
    if (filter === 'all' || filter === 'can') {
        signals.push(...getCanSignals())
    }
    
    if (filter === 'all' || filter === 'lin') {
        signals.push(...getLinSignals())
    }
    
    return signals
})

const gridOptions = computed<VxeGridProps<TreeItem>>(() => ({
    border: true,
    height: props.height,
    size: 'mini',
    treeConfig: {
        rowField: 'id',
        childrenField: 'children',
        expandAll:false
    },
    rowConfig: {
        isCurrent: true,
    },
    toolbarConfig: {
        slots: {
            tools: 'toolbar'
        }
    },
    columns: [
        { field: 'type', title: '', width: 40, slots: { default: 'type' } },
        { field: 'name', title: 'Name', minWidth: 200, treeNode: true },
        { field: 'txNode', title: 'Tx Node', width: 120 },
        { field: 'startBit', title: 'Start Bit', width: 100 },
        { field: 'bitLen', title: 'Bit Length', width: 100 }
      
    ],
    data: allSignals.value,
}))

function getLinSignals() {
    const signals: TreeItem[] = []
    for (const [key, ldf] of Object.entries(database.lin)) {
        const db: TreeItem = {
            id: key,
            name: `LIN.${ldf.name}`,
            children: [],
            type: 'db'
        }
        signals.push(db)

        //add frames
        for (const [frameId, frame] of Object.entries(ldf.frames)) {
            const frameItem: TreeItem = {
                id: `${key}.frames.${frameId}`,
                name: frame.name,
                children: [],
                frameId:frame.id,
                type: 'frame',
                dbInfo:{
                    name:ldf.name,
                    key:key
                }
            }
            db.children.push(frameItem)
            //add signals in the frame
            for (const signalId of frame.signals) {
                const signalItem: TreeItem = {
                    id: `lin.${ldf.name}.signals.${signalId.name}`,
                    name: signalId.name,
                    children: [],
                    type: 'signal',
                    frameId: frame.id,
                    startBit: signalId.offset,
                    bitLen: ldf.signals[signalId.name].signalSizeBits,
                    txNode: ldf.signals[signalId.name].punishedBy,
                    dbInfo:{
                        name:ldf.name,
                        key:key
                    }
                }
                frameItem.children.push(signalItem)
            }
        }
    }
    return signals
}

function getCanSignals() {
    const signals: TreeItem[] = []
    for (const [key, dbc] of Object.entries(database.can)) {
        const db: TreeItem = {
            id: key,
            name: `CAN.${dbc.name}`,
            children: [],
            type: 'db'
        }
        signals.push(db)

        // add messages
        for (const [messageId, message] of Object.entries(dbc.messages)) {
            const messageItem: TreeItem = {
                id: `${key}.messages.${messageId}`,
                name: message.name,
                children: [],
                type: 'frame',
                frameId:message.id,
                dbInfo:{
                    name:dbc.name,
                    key:key
                }
            }
            db.children.push(messageItem)

            // add signals in the message
            for (const [signalName, signal] of Object.entries(message.signals)) {
                const signalItem: TreeItem = {
                    id: `can.${dbc.name}.signals.${signalName}`,
                    name: signalName,
                    children: [],
                    type: 'signal',
                    frameId: message.id,
                    startBit: signal.startBit,
                    bitLen: signal.length,
                    txNode: signal.receivers?.join(','),
                    dbInfo: {
                        name: dbc.name,
                        key: key
                    }
                }
                messageItem.children.push(signalItem)
            }
        }
    }
    return signals
}

function handleCellClick({ row }: { row: TreeItem }) {
    const level = props.selectableLevel || defaultProps.selectableLevel
    
    if ((level === 'signal' && row.type === 'signal') ||
        (level === 'frame' && (row.type === 'frame' ))) {
        highlightedRow.value = row
    } else {
        highlightedRow.value = null
        vxeRef.value.clearCurrentRow()
    }
}

function toggleExpand() {
    
    vxeRef.value.setAllTreeExpand(false)
    isExpanded.value = false
    
   
}


const emits = defineEmits<{
  addSignal: [value: GraphNode<GraphBindSignalValue>] // named tuple syntax
  addFrame: [value: GraphNode<GraphBindFrameValue>] // named tuple syntax
}>()
function randomColor(){
    return '#'+Math.floor(Math.random()*16777215).toString(16);
}
function getMaxByBitLength(bitLength:number){
    return Math.pow(2,bitLength)-1
}
function addSignal() {
    if (!highlightedRow.value) return

    if (highlightedRow.value.type === 'frame') {


        let frameInfo
        if(highlightedRow.value.dbInfo?.key){
            if(props.protocolFilter=='can'||props.protocolFilter=='all'){
                frameInfo=database.can[highlightedRow.value.dbInfo?.key].messages[highlightedRow.value.frameId!]
            }else if(props.protocolFilter=='lin'||props.protocolFilter=='all'){
                frameInfo=database.lin[highlightedRow.value.dbInfo?.key].frames[highlightedRow.value.name]
            }
        }
        // 如果选中的是 frame，创建一个虚拟的信号节点
        emits('addFrame', {
            type: 'frame',
            enable: true,
            id: highlightedRow.value.id,
            name: highlightedRow.value.name,
            color: randomColor(),
            yAxis: {
                min: 0,
                max: 1  // frame 节点默认 0/1 状态
            },
            bindValue: {
                dbKey: highlightedRow.value.dbInfo?.key || '',
                dbName: highlightedRow.value.dbInfo?.name || '',
                frameInfo:frameInfo
            }
        })
    } else {
        // 原有的信号选择逻辑
        emits('addSignal', {
            type: 'signal',
            enable: true,
            id: highlightedRow.value.id,
            name: highlightedRow.value.name,
            color: randomColor(),
            yAxis: {
                min: 0,
                max: getMaxByBitLength(highlightedRow.value.bitLen || 0)
            },
            bindValue: {
                signalName: highlightedRow.value.name,
                startBit: highlightedRow.value.startBit || 0,
                bitLength: highlightedRow.value.bitLen || 0,
                dbKey: highlightedRow.value.dbInfo?.key || '',
                dbName: highlightedRow.value.dbInfo?.name || '',
                frameId: highlightedRow.value.frameId || 0
            }
        })
    }
}

// 添加一个辅助函数来处理ID匹配
function matchesId(searchText: string, id?: number): boolean {
    if (!id) return false
    
    // 转换搜索文本为小写
    searchText = searchText.toLowerCase()
    
    // 尝试多种格式匹配:
    // 1. 直接数字匹配 (例如: "291")
    // 2. 0x格式十六进制匹配 (例如: "0x123")
    // 3. 不带0x的十六进制匹配 (例如: "123")
    return String(id).includes(searchText) || // 十进制匹配
           ('0x' + id.toString(16)).toLowerCase().includes(searchText) || // 带0x的十六进制匹配
           id.toString(16).toLowerCase().includes(searchText.replace('0x', '')) // 不带0x的十六进制匹配
}

// 修改 filterTreeData 函数中的匹配逻辑
function filterTreeData(data: TreeItem[], searchText: string): { items: TreeItem[], count: number } {
    let count = 0
    const filtered = data.map(item => {
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
            
            (item.type === 'signal' && (
                (item.txNode?.toLowerCase().includes(searchText)) ||
                String(item.startBit).includes(searchText) ||
                String(item.bitLen).includes(searchText) ||
                matchesId(searchText, item.frameId)
            ))
            
        if (matches && item.type === 'frame') {
            count++
        }
        
        return matches ? newItem : null
    }).filter(Boolean) as TreeItem[]
    
    return { items: filtered, count }
}

// 同样需要更新 collectExpandedKeys 函数中的匹配逻辑
function collectExpandedKeys(data: TreeItem[], searchText: string) {
    const keys: TreeItem[] = []
    
    data.forEach(item => {
        if (item.children && item.children.length) {
            const childKeys = collectExpandedKeys(item.children, searchText)
            if (childKeys.length > 0 || 
                item.name.toLowerCase().includes(searchText) ||
                (item.type === 'frame' && matchesId(searchText, item.frameId))) {
                keys.push(item)
                keys.push(...childKeys)
            }
        } else if (
            item.type === 'signal' && (
                item.name.toLowerCase().includes(searchText) ||
                (item.txNode?.toLowerCase().includes(searchText)) ||
                String(item.startBit).includes(searchText) ||
                String(item.bitLen).includes(searchText) ||
                matchesId(searchText, item.frameId)
            )
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
        const { items: filteredData } = filterTreeData(allSignals.value, filterVal)
        vxeRef.value?.insertAt(filteredData)
        
        // Collect and set expanded keys
        const expandedKeys = collectExpandedKeys(filteredData, filterVal)
        vxeRef.value?.setTreeExpand(expandedKeys, true)
        
    } else {
        const records=vxeRef.value.getTreeExpandRecords()
        vxeRef.value?.insertAt(allSignals.value).then(()=>{
            vxeRef.value?.setTreeExpand(records, true)
        })
    }
}

// Initialize data
onMounted(() => {
    vxeRef.value?.insertAt(allSignals.value)
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