<template>
    <div>
        <VxeGrid ref="xGrid" v-bind="gridOptions" class="signalTable">
            <!-- <template #default_generator_control="{ row }">
                <el-button-group>
                    <el-button link size="small" :type="row.generatorType ? 'success' : 'default'"
                        @click="toggleGenerator(row)">
                        <Icon :icon="row.generatorType ? 'material-symbols:stop' : 'material-symbols:play-arrow'" />
                    </el-button>
                    <el-button link size="small" @click="editGenerator(row)">
                        <Icon icon="material-symbols:edit" />
                    </el-button>
                </el-button-group>
            </template> -->
            <template #default_raw_control="{ row }">
                <div class="value-control">
                    <el-input-number v-model="row.value" size="small" :min="0" :max="getMaxRawValue(row.length)"
                        :step="1" step-strictly controls-position="right" @change="handleRawValueChange(row)" />
                </div>
            </template>
            <template #default_phys_value="{ row }">
                <template v-if="row.values">
                    <el-select v-model="row.physValue" size="small" style="width: 100%"
                        @change="handlePhysValueChange(row)">
                        <el-option v-for="item in row.values" :key="item.value" :label="item.label"
                            :value="item.value" />
                    </el-select>
                </template>
                <template v-else-if="row.valueTable">
                    <el-select v-model="row.physValue" size="small" style="width: 100%"
                        @change="handlePhysValueChange(row)">
                        <el-option v-for="item in getValues(row.valueTable)" :key="item.value" :label="item.label"
                            :value="item.value" />
                    </el-select>
                </template>
                <template v-else>
                    <el-input-number :min="row.minimum!=row.maximum?row.minimum:undefined" :max="row.maximum!=row.minimum?row.maximum:undefined" style="width: 100%;" v-model="row.physValue"
                        size="small" controls-position="right" @change="handlePhysValueChange(row)" />
                </template>
            </template>
            <template #default_name="{ row }">
                <div class="name-cell">
                    <span>{{ row.name }}</span>
                    <el-button
                        link
                        size="small"
                        @click="copySignalName(row.name)"
                        type="primary"
                        class="copy-button"
                    >
                        <Icon :icon="copyIcon" />
                    </el-button>
                </div>
            </template>
        </VxeGrid>

        <el-dialog v-model="editDialogVisible" title="Edit Signal Generator" width="400px">
            <el-form v-if="currentSignal" :model="currentSignal" label-width="100px" size="small">
                <el-form-item label="Generator Type">
                    <el-select v-model="currentSignal.generatorType" style="width: 100%">
                        <el-option label="None" value="" />
                        <el-option label="Sine" value="sine" />
                        <el-option label="Counter" value="counter" />
                    </el-select>
                </el-form-item>
            </el-form>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { VxeGridProps } from 'vxe-table'
import { VxeGrid } from 'vxe-table'
import { Icon } from '@iconify/vue'
import { Message, Signal } from '@r/database/dbc/dbcVisitor'
import { useDataStore } from '@r/stores/data'
import {getMessageData, getMaxRawValue, rawToPhys, updateSignalPhys, updateSignalRaw } from '@r/database/dbc/calc'
import copyIcon from '@iconify/icons-material-symbols/content-copy-outline'
import { cloneDeep } from 'lodash'
const props = defineProps<{
    database: string
    messageId: string
}>()

const dataStore = useDataStore()
const editDialogVisible = ref(false)
const currentSignal = ref<Signal | null>(null)

const message = computed<Message | undefined>(() => {
    const db = Object.values(dataStore.database.can).find(db => db.name === props.database)
    if (db) {
        const msg = db.messages[parseInt(props.messageId,16)]
        return msg
    }
    return undefined
})
// Get signals data from store
const signals = computed(() => {
    const data: Signal[] = []
    let multiplexer:Signal|undefined
    if (message.value) {
        Object.values(message.value.signals).forEach(signal => {
            if(signal.multiplexerIndicator){
                if(signal.multiplexerIndicator=='M'){
                    data.push(signal)
                    multiplexer=signal
                }
            }else{
                data.push(signal)
            }
           
        })
        if(multiplexer){
            Object.values(message.value.signals).forEach(signal => {
                if(signal.multiplexerIndicator){
                    if(signal.multiplexerIndicator=='M'){
                    //skip
                    }else if(signal.multiplexerRange){
                        const target=message.value!.signals[signal.multiplexerRange.name]
                        for(let i=0;i<=signal.multiplexerRange.range.length;i++){
                            if(target.value==signal.multiplexerRange.range[i]){
                                data.push(signal)
                                break
                            }
                        }
                    }else{
                        const val=Number(signal.multiplexerIndicator.slice(1))
                        if(val==multiplexer!.value){
                            data.push(signal)
                        }
                    }
                }
            
            })
        }
    }
   
    return data
})

function getValues(valueTable: string) {
    const t: { label: string; value: number }[] = []
    const db = Object.values(dataStore.database.can).find(db => db.name === props.database)
    if (db) {
        const vt = Object.values(db.valueTables).find(vt => vt.name === valueTable)
        if (vt) {
            vt.values.forEach(value => {
                t.push({ label: value.label, value: value.value })
            })
        }
    }
    return t
}

const gridOptions = computed<VxeGridProps<Signal>>(() => {
    return {
        border: true,
        size: 'mini',
        height: 250,
        columnConfig: {
            resizable: true
        },
        showOverflow:true,
        editConfig: {
            trigger: 'click',
            mode: 'cell',
            showIcon: false
        },
        scrollY: {
            enabled: true,
            gt: 0,
            mode: 'wheel'
        },
        columns: [
            { 
                field: 'name', 
                title: 'Name', 
                width: 300,
                minWidth: 100,
                slots: { 
                    default: 'default_name'
                }
            },
            // {
            //     field: 'generatorControl',
            //     title: 'Generator',
            //     width: 100,
            //     slots: { default: 'default_generator_control' }
            // },

            {
                field: 'value',
                title: 'Raw Value',
                width: 150,
                resizable: false,
                slots: { default: 'default_raw_control' }
            },

            {
                field: 'physValue',
                title: 'Phys Value',
                minWidth: 150,
                resizable: false,
                slots: { default: 'default_phys_value' }
            },

            { field: 'unit', title: 'Unit', width: 80, align: 'center' },
            { field: 'startBit', title: 'Start Bit', width: 120, align: 'center', sortable: true },
            { field: 'length', title: 'Length', width: 100, align: 'center', sortable: true },
        ],
        data: signals.value
    }
})

function toggleGenerator(row: Signal) {
    if (row.generatorType) {
        row.generatorType = undefined
    } else {
        row.generatorType = 'sine' // Default to sine
    }
}

function editGenerator(row: Signal) {
    currentSignal.value = row
    editDialogVisible.value = true
}



// Raw value change handler
function handleRawValueChange(row: Signal) {
    updateSignalRaw(row)
    if(message.value){
        window.electron.ipcRenderer.send('ipc-update-can-signal', props.database, parseInt(props.messageId,16), row.name, cloneDeep(row))
        emits('change', getMessageData(message.value))
    }
}

// Physical value change handler
function handlePhysValueChange(row: Signal) {
    updateSignalPhys(row)
    if(message.value){
        window.electron.ipcRenderer.send('ipc-update-can-signal', props.database, parseInt(props.messageId,16), row.name, cloneDeep(row))
        emits('change', getMessageData(message.value))
    }
}


const emits = defineEmits<{
    'change': [Buffer]
}>()

// Initialize signal values
function initializeSignal(signal: Signal) {
    if (signal.value === undefined) {
        signal.value = 0

        if (signal.values || signal.valueTable) {
            // For enum values
            signal.physValue = 0
        } else {
            // For numeric values, calculate initial phys value
            signal.physValue = rawToPhys(0, signal)
        }
    } else if (signal.physValue === undefined) {
        // If raw value exists but phys value doesn't, calculate it
        if (signal.values || signal.valueTable) {
            signal.physValue = signal.value
        } else {
            signal.physValue = rawToPhys(signal.value, signal)
        }
    }
}

onMounted(() => {
    // Initialize all signals
    if(message.value){
        Object.values(message.value.signals).forEach(signal => {
            initializeSignal(signal)
        })
        emits('change',getMessageData(message.value))
    }
})

//

const xGrid = ref()

// 添加复制函数
function copySignalName(name: string) {
    navigator.clipboard.writeText(name)
}
</script>

<style scoped>
.signalTable {
    margin: 10px;
}

.value-control {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 5px;
}

.arrows {
    display: flex;
    flex-direction: column;
    margin-left: 5px;
}

.arrows .el-button {
    padding: 0;
    height: 12px;
}

.name-cell {
    position: relative;
    padding-right: 24px; /* 为复制按钮留出空间 */
}

.copy-button {
    position: absolute;
    right: 0px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0;
    transition: opacity 0.2s;
}

.name-cell:hover .copy-button {
    opacity: 1;
}
</style>
