<template>
    <div>
        <VxeGrid v-bind="gridOptions">
            <template #type="{ row }">
                <Icon :icon="row.type === 'db' ? databaseIcon : row.type === 'frame' ? frameIcon : waveIcon" />
            </template>
        </VxeGrid>
    </div>
</template>
<script setup lang="ts">
import { useDataStore } from '@r/stores/data';
import { computed } from 'vue'
import type { VxeGridProps } from 'vxe-table'
import waveIcon from '@iconify/icons-material-symbols/airwave-rounded'
import databaseIcon from '@iconify/icons-material-symbols/database'
import frameIcon from '@iconify/icons-material-symbols/rectangle-outline'
import { VxeGrid} from 'vxe-table'
import { Icon } from '@iconify/vue'
interface TreeItem {
    id: string,
    name: string,
    children: TreeItem[]
    type: 'db' | 'frame' | 'signal'
    startBit?: number
    txNode?: string
}

const props = defineProps<{
    height: number
    width: number
}>()

const database = useDataStore().database

const gridOptions = computed<VxeGridProps<TreeItem>>(() => ({
    border: true,
    height: props.height,
    size: 'mini',
    treeConfig: {
        rowField: 'id',
        childrenField: 'children'
    },
    columns: [
        { field: 'type', title: '', width: 40, slots: { default: 'type' } },
        { field: 'name', title: 'Name', minWidth: 200, treeNode: true },
        { field: 'txNode', title: 'Tx Node', width: 120 },
        { field: 'startBit', title: 'Start Bit', width: 100 },
      
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
                    id: `lin.${key}.signals.${signalId.name}`,
                    name: signalId.name,
                    children: [],
                    type: 'signal',
                    startBit: signalId.offset,
                    txNode: ldf.signals[signalId.name].punishedBy

                }
                frameItem.children.push(signalItem)
            }
        }
    }
    return signals
}
</script>