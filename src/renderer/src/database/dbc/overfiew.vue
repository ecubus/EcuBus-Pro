<template>
    <div class="main">
        <div class="left">
            <div class="header">
                <span style="font-size: 12px;width: 100px;text-align: center;">DB Name</span>
                <el-input size="small" v-model="dbcObj.name" style="width: 100%;"/>
            </div>
            <div class="search-box">
                <el-input
                    v-model="treeQuery"
                    size="small"
                    placeholder="Filter tree nodes..."
                    clearable
                    @input="onTreeQueryChanged"
                    @clear="onTreeQueryChanged"
                >
                    <template #prefix>
                        <Icon :icon="searchIcon" />
                    </template>
                </el-input>
            </div>
            <el-tree-v2
                ref="treeRef"
                :data="treeData"
                :props="defaultProps"
                :height="h - 117"
                :item-size="24"
                highlight-current
                :expand-on-click-node="false"
                :filter-method="treeFilterMethod"
                @node-click="handleNodeClick"
            >
                <template #default="{ node, data }">
                    <div class="tree-node">
                        <Icon 
                            :icon="getNodeIcon(data)"
                            class="tree-icon"
                        />
                        <span class="treeLabel" :class="{ 'category-label': data.type === 'category' }">
                            {{ node.label }}
                        </span>
                    </div>
                </template>
            </el-tree-v2>
        </div>
        <div class="shift" id="dbcOverviewShift" />
        <div class="right">
            <VxeGrid ref="xGrid" v-bind="gridOptions">
                <template #toolbar>
                    <div style="justify-content: flex-start;display: flex;align-items: center;gap:2px;margin-left: 5px;padding: 8px;">
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
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, toRef, ref, watch, onMounted, onBeforeMount, inject } from "vue";

import { useDataStore } from "@r/stores/data";
import { Layout } from '@r/views/uds/layout'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { DBC, Signal } from "./dbcVisitor";
import { Icon } from '@iconify/vue';
import removeIcon from '@iconify/icons-ep/remove';
import waveIcon from '@iconify/icons-material-symbols/airwave-rounded'
import messageIcon from '@iconify/icons-material-symbols/business-messages-outline'
import nodeIcon from '@iconify/icons-material-symbols/point-scan'
import { multiCalc } from "./parse";
import searchIcon from '@iconify/icons-material-symbols/search'
import { ElTreeV2 } from "element-plus";
// import { validateLDF } from './validator'

const dbcObj = defineModel<DBC>({
    required: true
})

const props = defineProps<{
    editIndex: string,
    width: number,
    height: number
}>()

const h = toRef(props,'height');
const w = toRef(props,'width');
const leftWidth = ref(300);
const currentView = ref('signals');
const database = useDataStore()

// Tree data structure
const treeData = computed(() => {
    // Get all signals from all messages and sort them
    const allSignals = Object.entries(dbcObj.value.messages).reduce((acc, [msgId, msg]) => {
        Object.entries(msg.signals).forEach(([name, signal]) => {
            acc.push({
                label: name,
                type: 'signal',
                data: {
                    ...signal,
                    messageId: msgId,
                    messageName: msg.name
                }
            });
        });
        return acc;
    }, [] as any[]).sort((a, b) => a.label.localeCompare(b.label));

    const t = [
        {
            label: 'Node',
            type: 'category',
            children: Object.entries(dbcObj.value.nodes).map(([name, node]) => ({
                label: name,
                type: 'node',
                data: node
            }))
        },
        {
            label: 'Message',
            type: 'category',
            children: Object.entries(dbcObj.value.messages)
                .sort((a, b) => a[1].name.localeCompare(b[1].name))
                .map(([id, msg]) => ({
                    label: `${msg.name} (0x${Number(id).toString(16)})`,
                    type: 'message',
                    data: msg,
                    children: Object.entries(msg.signals)
                        .map(([name, signal]) => ({
                            label: name,
                            type: 'signal',
                            data: {
                                ...signal,
                                messageId: id,
                                messageName: msg.name
                            }
                        }))
                }))
        },
        {
            label: 'Signal',
            type: 'category',
            children: allSignals
        }
    ];

    // Add id field to each node
    const addIds = (nodes: any[], prefix = '') => {
        return nodes.map((node, index) => ({
            ...node,
            id: `${prefix}${index}`,
            children: node.children ? addIds(node.children, `${prefix}${index}-`) : undefined
        }));
    };

    return addIds(t);
});

const defaultProps = {
    value: 'id',
    label: 'label',
    children: 'children',
}

// Table configurations
const signalColumns:VxeGridProps['columns'] = [
    { field: 'name', title: 'Name', minWidth: 120,fixed: 'left'},
    { field: 'messageName', title: 'Message', minWidth: 120 },
    { 
        field: 'multiplexerIndicator', 
        title: 'Multiplexer', 
        width: 100,
        formatter: ({ row }) => multiCalc(row) || '-'
    },
    { field: 'startBit', title: 'Start Bit', width: 100 },
    { field: 'length', title: 'Length', width: 80 },
    { field: 'isLittleEndian', title: 'Byte Order', width: 100,
        formatter: ({ cellValue }) => cellValue ? 'Intel' : 'Motorola' },
    { field: 'isSigned', title: 'Type', width: 80,
        formatter: ({ cellValue }) => cellValue ? 'Signed' : 'Unsigned' },
    { field: 'factor', title: 'Factor', width: 80 },
    { field: 'offset', title: 'Offset', width: 80 },
    { field: 'minimum', title: 'Min', width: 80 },
    { field: 'maximum', title: 'Max', width: 80 },
    { field: 'unit', title: 'Unit', width: 80 },
    { field: 'valueTable', title: 'Value Table', width: 120,
        formatter: ({ row }) => {
            if (row.values) {
                return row.values.map(v => `${v.value}:${v.label}`).join(', ')
            }
            return row.valueTable || ''
        }
    },
    { field: 'comment', title: 'Comment', width: 200 },
    
]

// Add message columns configuration
const messageColumns: VxeGridProps['columns'] = [
    { field: 'name', title: 'Name', minWidth: 150, fixed: 'left' },
    { field: 'id', title: 'ID', width: 100,
        formatter: ({ cellValue }) => `0x${Number(cellValue).toString(16).toUpperCase()}` },
    { field: 'length', title: 'Length', width: 100 },
    { field: 'sender', title: 'Sender', width: 120 },
    { field: 'receivers', title: 'Receivers', width: 150,
        formatter: ({ row }) => {
            const receivers = row.signals
                ? [...new Set(Object.values<Signal>(row.signals).flatMap(signal => signal.receivers))]
                : [];
            return receivers.join(', ');
        }
    },
    { field: 'role', title: 'Role', width: 100 },
    { field: 'signalCount', title: 'Signals', width: 100,
        formatter: ({ row }) => Object.keys(row.signals).length },
    { field: 'comment', title: 'Comment', width: 200 }
]

const signalData = ref<Signal[]>([]);
const xGrid = ref();

// Add search related refs
const searchText = ref('')
let tableData:any[] = []

// Modify insert data function
function insertData(data: any[]) {
    tableData = data // Store original data
    xGrid.value.insertAt(data)
}

// Add search function
const handleSearch = () => {
    xGrid.value?.remove() // Clear current data
    
    const filterVal = searchText.value.trim().toLowerCase()
    if (filterVal) {
        const filteredData = tableData.filter(item => {
            // Search in name
            if (item.name?.toLowerCase().includes(filterVal)) return true
            
            
            
            return false
        })
        
        xGrid.value.insertAt(filteredData)
    } else {
        // If no search text, show all data
        xGrid.value.insertAt(tableData)
    }
}

const gridOptions = computed<VxeGridProps>(() => ({
    border: true,
    size: 'mini',
    height: h.value - 41,
    showOverflow: true,
    columnConfig: { resizable: true },
    scrollY: {
        enabled: true,
        gt: 0,
        mode: 'wheel'
    },
    toolbarConfig: {
        slots: { tools: 'toolbar' }
    },
    columns: currentView.value === 'signals' ? signalColumns : messageColumns,
}))

// Handle tree node click
const handleNodeClick = (data: any) => {
    searchText.value = '' // Clear search text when switching nodes
    if (data.type === 'message') {
        currentView.value = 'signals'
        const signals = Object.values<Signal>(data.data.signals)
            .sort((a, b) => a.startBit - b.startBit)
        xGrid.value?.remove()
        insertData(signals)
    } else if (data.type === 'signal') {
        currentView.value = 'signals'
        xGrid.value?.remove()
        insertData([data.data])
    } else if (data.type === 'node') {
        currentView.value = 'messages'
        const nodeName = data.label
        const nodeMessages = Object.entries(dbcObj.value.messages)
            .filter(([_, msg]) => {
                if (msg.sender === nodeName) return true
                return Object.values(msg.signals).some(signal => 
                    signal.receivers.includes(nodeName)
                )
            })
            .map(([id, msg]) => ({
                ...msg,
                id: parseInt(id),
                role: msg.sender === nodeName ? 'Sender' : 'Receiver'
            }))
            .sort((a, b) => a.id - b.id)
        
        xGrid.value?.remove()
        insertData(nodeMessages)
    }
}

const removeNode = (data: any) => {
    // Handle node removal logic
}

async function validate() {
    // Implement validation logic here
}

onMounted(() => {
    window.jQuery('#dbcOverviewShift').resizable({
        handles: 'e',
        resize: (e, ui) => {
            leftWidth.value = ui.size.width;
        },
        maxWidth: 400,
        minWidth: 200,
    });
});

// Add clear function
function clearData() {
    xGrid.value?.remove();
}

defineExpose({
    validate,
    clearData
});

const treeRef = ref<InstanceType<typeof ElTreeV2>>()
const treeQuery = ref('')

// Helper function to get node icon
const getNodeIcon = (data: any) => {
    if (data.type === 'signal') return waveIcon
    if (data.type === 'message') return messageIcon
    if (data.type === 'node') return nodeIcon
    if (data.type === 'category') {
        if (data.label === 'Node') return nodeIcon
        if (data.label === 'Message') return messageIcon
        if (data.label === 'Signal') return waveIcon
    }
    return ''
}

const onTreeQueryChanged = () => {
    treeRef.value?.filter(treeQuery.value)
}

const treeFilterMethod = (query: string, node: any) => {
    // Always show category nodes
    if (node.type === 'category') return true
    
    const searchText = query.toLowerCase()
    const nodeLabel = node.label.toLowerCase()
    
    // For message nodes, also search in ID
    if (node.type === 'message') {
        const idMatch = node.label.toLowerCase().includes(searchText)
        return idMatch || nodeLabel.includes(searchText)
    }
    
    return nodeLabel.includes(searchText)
}

</script>

<style scoped>
.main {
    position: relative;
    height: v-bind(h - 41 + 'px');
    width: v-bind(w + 'px');
}

.left {
    position: absolute;
    top: 0px;
    left: 0px;
    width: v-bind(leftWidth + 'px');
    z-index: 1;
    display: flex;
    flex-direction: column;
}

.shift {
    position: absolute;
    top: 0px;
    left: 0px;
    width: v-bind(leftWidth + 1 + 'px');
    height: v-bind(h - 41 + 'px');
    z-index: 0;
    border-right: solid 1px var(--el-border-color);
}

.shift:hover {
    border-right: solid 4px var(--el-color-primary);
}

.shift:active {
    border-right: solid 4px var(--el-color-primary);
}

.right {
    position: absolute;
    left: v-bind(leftWidth + 5 + 'px');
    width: v-bind(w - leftWidth - 6 + 'px');
    height: v-bind(h - 41 + 'px');
    z-index: 0;
    overflow: auto;
}

.tree-node {
    flex: 1;
    display: flex;
    align-items: center;
    font-size: 12px;
    padding-right: 5px;
    gap: 4px;
}

.treeLabel {
    display: inline-block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: v-bind(leftWidth - 100 + 'px');
}

.tree-delete {
    color: var(--el-color-danger);
}

.tree-delete:hover {
    color: var(--el-color-danger-dark-2);
    cursor: pointer;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px;
    /* border-bottom: solid 1px var(--el-border-color); */
    background-color: var(--el-fill-color-light);
    gap: 5px;   
}

.tree-icon {
    font-size: 16px;
    margin-right: 4px;
    color: var(--el-text-color-secondary);
}

.category-label {
    font-weight: bold;
}

:deep(.vxe-toolbar) {
    background-color: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
}

/* Add styles for el-tree-v2 */
:deep(.el-tree-node__content) {
    height: 24px;
}

:deep(.el-tree-node__expand-icon) {
    margin-right: 4px;
}

/* Add styles for role column */
:deep(.vxe-table--body td.role-column) {
    .sender {
        color: var(--el-color-success);
    }
    .receiver {
        color: var(--el-color-warning);
    }
}

:deep(.keyword-highlight) {
    color: var(--el-color-primary);
    font-weight: bold;
}

.search-box {
    padding: 6px;
    background-color: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
}

/* Adjust tree height to account for search box */
:deep(.el-tree-v2) {
    height: v-bind(h - 117 + 'px') !important;
}
</style>