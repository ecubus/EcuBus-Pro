<template>
    <div style="margin-top: -5px;">
        <VxeGrid v-bind="gridOptions" ref="vxeRef" @cell-click="handleCellClick">
            <template #toolbar>
                <div style="justify-content: flex-start;display: flex;align-items: center;gap:4px;">
                    <el-tooltip effect="light" :content="!isExpanded ? 'Collapse All' : 'Expand All'" placement="bottom">
                        <el-button link @click="toggleExpand">
                            <Icon :icon="isExpanded ?tableExpandIcon: tableCollapseIcon  " style="font-size: 14px;" />
                        </el-button>
                    </el-tooltip>
                    <el-divider direction="vertical" />
                    <el-tooltip effect="light" content="Add Signal" placement="bottom">
                        <el-button type="primary" link :disabled="!highlightedRow" @click="addSignal">
                            <Icon :icon="waveIcon" style="font-size: 14px;" />
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
import { computed, h, ref } from 'vue'
import type { VxeGridProps } from 'vxe-table'
import waveIcon from '@iconify/icons-material-symbols/airwave-rounded'
import databaseIcon from '@iconify/icons-material-symbols/database'
import frameIcon from '@iconify/icons-material-symbols/rectangle-outline'
import { VxeGrid} from 'vxe-table'
import { Icon } from '@iconify/vue'
import tableExpandIcon from '@iconify/icons-material-symbols/expand-all'
import tableCollapseIcon from '@iconify/icons-material-symbols/collapse-all'
import { GraphBindSignalValue, GraphNode } from 'src/preload/data';
import { v4 } from 'uuid';


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
}>()

const database = useDataStore().database

const highlightedRow = ref<TreeItem | null>(null)
const isExpanded = ref(true)

const gridOptions = computed<VxeGridProps<TreeItem>>(() => ({
    border: true,
    height: props.height,
    size: 'mini',
    treeConfig: {
        rowField: 'id',
        childrenField: 'children'
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
    data: getLinSignals()
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
                type: 'frame'
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

function handleCellClick({ row }: { row: TreeItem }) {
    if (row.type === 'signal') {
        highlightedRow.value = row
    } else {
        highlightedRow.value = null
        vxeRef.value.clearCurrentRow()
    }
}

function toggleExpand() {
   
    vxeRef.value.setAllTreeExpand(isExpanded.value)
    isExpanded.value = !isExpanded.value
}


const emits = defineEmits<{
  addSignal: [value: GraphNode] // named tuple syntax
}>()
function randomColor(){
    return '#'+Math.floor(Math.random()*16777215).toString(16);
}
function getMaxByBitLength(bitLength:number){
    return Math.pow(2,bitLength)-1
}
function addSignal() {
    if (highlightedRow.value) {
        emits('addSignal',{
          type:'signal',
          enable:true,
          id:highlightedRow.value.id,
          name:highlightedRow.value.name,
          color:randomColor(),
          yAxis:{
            min:0,
            max:getMaxByBitLength(highlightedRow.value.bitLen||0)
          },
          bindValue:{
            signalName:highlightedRow.value.name,
            startBit:highlightedRow.value.startBit||0,
            bitLength:highlightedRow.value.bitLen||0,
            dbKey:highlightedRow.value.dbInfo?.key||'',
            dbName:highlightedRow.value.dbInfo?.name||'',
            frameId:highlightedRow.value.frameId||0
          }
        })
    }
}
</script>
<style>
.row-highlight {
    background-color: #e6f3ff !important;
}
</style>