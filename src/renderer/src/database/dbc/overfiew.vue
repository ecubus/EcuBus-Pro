<template>
    <div class="main">
        <div class="left">
            <div class="header">
                <span style="font-size: 12px;width: 100px;text-align: center;">DB Name</span>
                <el-input size="small" v-model="dbcObj.name" style="width: 100%;"/>
            </div>
            <el-scrollbar :height="h - 77 + 'px'">
                <el-tree
                highlight-current
                    ref="treeRef"
                    :data="treeData"
                    :expand-on-click-node="false"
                    :props="defaultProps"
                    @node-click="handleNodeClick"
                    default-expand-all
                >
                    <template #default="{ node, data }">
                        <div class="tree-node">
                            <Icon 
                                :icon="
                                    data.type === 'signal' ? waveIcon : 
                                    data.type === 'message' ? messageIcon :
                                    data.type === 'node' ? nodeIcon :
                                    data.type === 'category' ? (
                                        data.label === 'Node' ? nodeIcon :
                                        data.label === 'Message' ? messageIcon :
                                        data.label === 'Signal' ? waveIcon : ''
                                    ) : ''
                                "
                                class="tree-icon"
                            />
                            <span class="treeLabel" :class="{ 'category-label': data.type === 'category' }">
                                {{ node.label }}
                            </span>
                        </div>
                    </template>
                </el-tree>
            </el-scrollbar>
        </div>
        <div class="shift" id="dbcOverviewShift" />
        <div class="right">
            <VxeGrid ref="xGrid" v-bind="gridOptions">
                <!-- <template #toolbar>
                    <div style="justify-content: flex-start;display: flex;align-items: center;gap:2px;margin-left: 5px;padding: 8px;">
                        <span style="font-size: 14px;color: var(--el-text-color-secondary);">
                            {{ currentView === 'signals' ? 'Signals' : 'Messages' }}
                        </span>
                    </div>
                </template> -->
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

    return t;
});

const defaultProps = {
    children: 'children',
    label: 'label'
}

// Table configurations
const signalColumns:VxeGridProps['columns'] = [
    { field: 'name', title: 'Name', minWidth: 120,fixed: 'left'},
    { field: 'messageName', title: 'Message', minWidth: 120 },
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
    { 
        field: 'multiplexerIndicator', 
        title: 'Multiplexer', 
        width: 100,
        formatter: ({ cellValue }) => cellValue || '-'
    }
]

const messageColumns = [
    { field: 'name', title: 'Name', minWidth: 150 },
    { field: 'id', title: 'ID', width: 100,
        formatter: ({ cellValue }) => `0x${Number(cellValue).toString(16).toUpperCase()}` },
    { field: 'length', title: 'Length', width: 100 },
    { field: 'sender', title: 'Sender', width: 120 },
    { field: 'signalCount', title: 'Signals', width: 100 }
]

const signalData = ref<Signal[]>([]);
const messageData = ref<Signal[]>([]);

const xGrid = ref()

const gridOptions = computed<VxeGridProps>(() => ({
    border: true,
    size: 'mini',
    height: h.value - 41,
    showOverflow: true,
    columnConfig: { resizable: true },
    scrollY: {
         enabled: true,
         gt: 0,
         mode:'wheel'
      },
    columns:signalColumns,
    data: currentView.value === 'signals' ? signalData.value : messageData.value
}))

// Handle tree node click
const handleNodeClick = (data: any) => {
    if (data.type === 'message') {
        currentView.value = 'signals';
        // Show all signals in this message
        signalData.value = Object.entries(data.data.signals).map(([name, signal]: [string, any]) => ({
            name,
            messageName: data.data.name,
            ...signal,
            // Add value table and comment if they exist
            valueTable: signal.valueTable,
            values: signal.values,
            comment: signal.comment || '',
            multiplexerIndicator: signal.multiplexerIndicator
        }));
    } else if (data.type === 'signal') {
        currentView.value = 'signals';
        // Show single signal
        signalData.value = [{
            name: data.data.name,
            messageName: data.data.messageName,
            ...data.data,
            // Add value table and comment if they exist
            valueTable: data.data.valueTable,
            values: data.data.values,
            comment: data.data.comment || '',
            multiplexerIndicator: data.data.multiplexerIndicator
        }];
    }
};

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


defineExpose({
    validate
})

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
</style>