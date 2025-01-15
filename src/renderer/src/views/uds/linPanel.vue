<template>
    <div style="display: relative">
        <VxeGrid ref="xGrid" v-bind="gridOptions" class="sequenceTable" :data="tableData">
            <template #toolbar>
                <div style="justify-content: flex-start;display: flex;align-items: center;gap:4px;margin-left: 5px;padding:6px 4px;">
                    <Icon :icon="databaseIcon"/>
                    <span>Database:</span>
                    <span style="color: var(--el-color-primary)">{{ selectedDBName }}</span>
                    <el-divider direction="vertical"></el-divider>
                    <Icon :icon="nodeIcon"/>
                    <span>Node:</span>
                    <span style="color: var(--el-color-primary)">{{ selectedDBName?workNode:'' }}</span>
                    <el-divider direction="vertical"></el-divider>
                    <el-button size="small" type="warning" link @click="resetAllSignals">
                        <Icon :icon="resetIcon" />
                        Reset All
                    </el-button>
                </div>
            </template>

            <template #expand_content="parent">
                <div class="expand-wrapper">
                    <VxeGrid v-bind="childGridOptions" :data="parent.row.childList">
                        <template #physical="{ row }">
                            <el-input v-if="hasPhysicalEncoding(row.encodingType)"
                                     v-model="physicalValues[`${parent.row.name}-${row.name}`]" 
                                     size="small" 
                                     @change="handlePhysicalValueChange($event, parent.row.name, row)"
                                     style="width: 100px;" />
                            <span v-else>-</span>
                        </template>
                        <template #raw="{ row }">
                            <el-input v-model="rawValues[`${parent.row.name}-${row.name}`]" 
                                     size="small" 
                                     @change="handleRawValueChange($event, parent.row.name, row)"
                                     style="width: 100px;" />
                        </template>
                      
                    </VxeGrid>
                </div>
            </template>
            <template #frameData="{ row }">
                            <span>{{ getFrameDataHex(row.name) }}</span>
                        </template>
        </VxeGrid>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, toRef, nextTick, watch, watchEffect } from 'vue'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { Icon } from '@iconify/vue'
import databaseIcon from '@iconify/icons-material-symbols/database'
import nodeIcon from '@iconify/icons-material-symbols/settings-ethernet'
import resetIcon from '@iconify/icons-material-symbols/restart-alt'
import { ElMessage } from 'element-plus'
import { useDataStore } from '@r/stores/data'
import { LDF, getFrameSize } from '@r/database/ldfParse'
import { LinInter } from 'src/preload/data'
import { getFrameData } from 'nodeCan/lin'
import { isEqual } from 'lodash'

interface SignalRow {
    name: string
    encodingType?: string
    bitLength: number
}

interface FrameRow {
    name: string
    childList: SignalRow[]
}

const props = defineProps<{
    height: number
    editIndex: string
}>()

const h = toRef(props, 'height')
const editIndex = toRef(props, 'editIndex')
const dataBase = useDataStore()



const selectedDB=ref('')
const getUsedDb=()=>{
    const device=dataBase.nodes[editIndex.value].channel[0]
    if(device&&dataBase.devices[device].type=='lin'&&dataBase.devices[device].linDevice&&dataBase.devices[device].linDevice.database){
        selectedDB.value=dataBase.devices[device].linDevice.database
    }else{
        selectedDB.value=''
    }
}
watchEffect(()=>{
    getUsedDb()
})
const selectedDBName = computed(() => {
    if (!selectedDB.value || !dataBase.database.lin[selectedDB.value]) return ''
    return `Lin.${dataBase.database.lin[selectedDB.value].name}`
})



const workNode = computed(() => dataBase.nodes[editIndex.value]?.workNode || '')
const physicalValues = ref<Record<string, string>>({})
const rawValues = ref<Record<string, string>>({})

const getPhysicalValue = (rawValue: number, encodingType: string, db: LDF) => {
    const encoding = db.signalEncodeTypes[encodingType]
    if (!encoding) return rawValue.toString()

    for (const type of encoding.encodingTypes) {
        if (type.type === 'physicalValue' && type.physicalValue) {
            const { minValue, maxValue, scale, offset } = type.physicalValue
            // Check if raw value is within the valid range (min to max)
            if (rawValue >= minValue && rawValue <= maxValue) {
                // Apply the physical value calculation formula
                return ((scale * rawValue) + offset).toString()
            }
        }
    }
    return rawValue.toString()
}

const getRawValue = (physicalValue: number, encodingType: string, db: LDF) => {
    const encoding = db.signalEncodeTypes[encodingType]
    if (!encoding) return physicalValue

    for (const type of encoding.encodingTypes) {
        if (type.type === 'physicalValue' && type.physicalValue) {
            const { minValue, maxValue, scale, offset } = type.physicalValue
            // Reverse the physical value formula
            const rawValue = (physicalValue - offset) / scale
            // Check if calculated raw value is within valid range
            if (rawValue >= minValue && rawValue <= maxValue) {
                return rawValue
            }
        }
    }
    return physicalValue
}

// Add function to check if encoding has physical value type
const hasPhysicalEncoding = (encodingType?: string) => {
    if (!encodingType || !selectedDB.value) return false
    const db = dataBase.database.lin[selectedDB.value] as LDF
    const encoding = db.signalEncodeTypes[encodingType]
    if (!encoding) return false
    
    return encoding.encodingTypes.some(type => type.type === 'physicalValue')
}

// 修改工具函数
const updateSignalDisplayValues = (frameName: string, signal: SignalRow, restore: boolean = true) => {
    if (!selectedDB.value) return
    const db = dataBase.database.lin[selectedDB.value] as LDF
    const signalDef = db.signals[signal.name]
   

    // 如果没有上一次的值或不需要恢复，则使用初始值
    const rawValue = restore?(signalDef.value??signalDef.initValue) : signalDef.initValue
    const rawValueStr = Array.isArray(rawValue) ? rawValue.join(',') : rawValue?.toString()
    rawValues.value[`${frameName}-${signal.name}`] = rawValueStr||''
    physicalValues.value[`${frameName}-${signal.name}`] = signal.encodingType && hasPhysicalEncoding(signal.encodingType) ? 
        getPhysicalValue(Number(rawValueStr), signal.encodingType, db) : ''
}

// Update tableData to only show relevant frames
const tableData = computed(() => {
    const frames: FrameRow[] = []
    if (!selectedDB.value || !workNode.value || !dataBase.database.lin[selectedDB.value]) {
        return frames
    }
    
    const db = dataBase.database.lin[selectedDB.value] as LDF

    for (const [frameName, frame] of Object.entries(db.frames)) {
        // Only show frames where workNode is publisher or subscriber
        if (frame.publishedBy !== workNode.value) {
            continue
        }

        const frameRow: FrameRow = {
            name: frameName,
            childList: []
        }

        // Add signals for this frame
        for (const signal of frame.signals) {
            const signalDef = db.signals[signal.name]
            const encodingType = Object.entries(db.signalRep).find(([_, signals]) => 
                signals.includes(signal.name))?.[0]
            
            frameRow.childList.push({
                name: signal.name,
                encodingType,
                bitLength: signalDef.signalSizeBits
            })
        }

        frames.push(frameRow)
    }

    return frames
})

const gridOptions = computed(() => {
    const options: VxeGridProps<FrameRow> = {
        expandConfig: {
            expandAll: true,
            padding: false,
            reserve:true,
        },
        
        border: true,
        size: "mini",
        columnConfig: {
            resizable: true,
        },
        height: props.height,
        showOverflow: true,
        scrollY: {
            enabled: false,
            gt: 0
        },
        rowConfig: {
            isCurrent: true,
            keyField: 'name'
        },
        toolbarConfig: {
            slots: {
                tools: 'toolbar'
            }
        },
        
        align: 'center',
        columns: [
            { type: 'expand', width: 46, slots: { content: 'expand_content' }, resizable: false },
            { field: 'name', title: 'Frame', width: 200,align:'left'},
            { field: 'frameData', title: 'Frame Data (Hex)', minWidth: 200, slots: { default: 'frameData' },align:'left'}
        ],
    }

    return options
})

const childGridOptions = computed(() => {
    const options: VxeGridProps<SignalRow> = {
        border: true,
        size: "mini",
        columnConfig: { resizable: true },
        showOverflow: true,
        align: 'center',
        columns: [
            { field: 'name', title: 'Signal', width: 200,align:'left' },
            { field: 'bitLength', title: 'Bits', width: 100 },
            { field: 'physicalValue', title: 'Physical Value', minWidth: 200, slots: { default: 'physical' } },
            { field: 'rawValue', title: 'Raw Value', minWidth: 200, slots: { default: 'raw' } },
           
        ]
    }
    
    return options
})

const validatePhysicalValue = (value: string, signal: SignalRow): boolean => {
    if (!selectedDB.value || !signal.encodingType) return false
    const db = dataBase.database.lin[selectedDB.value] as LDF
    const encoding = db.signalEncodeTypes[signal.encodingType]
    if (!encoding) return false
    
    const numValue = Number(value)
    if (isNaN(numValue)) return false
    
    for (const type of encoding.encodingTypes) {
        if (type.type === 'physicalValue' && type.physicalValue) {
            const { minValue, maxValue, scale, offset } = type.physicalValue
            
            // Validate encoding range according to LIN spec
            if (minValue < 0 || maxValue > 65535 || minValue > maxValue) {
                return false
            }

            // Calculate corresponding raw value
            const rawValue = (numValue - offset) / scale
            
            // Raw value must be within min/max range and be an integer
            if (rawValue >= minValue && 
                rawValue <= maxValue && 
                Number.isInteger(rawValue)) {
                return true
            }
        }
    }
    return false
}

const validateRawValue = (value: string, signal: SignalRow): boolean => {
    if (!selectedDB.value) return false
    const db = dataBase.database.lin[selectedDB.value] as LDF
    const signalDef = db.signals[signal.name]
    if (!signalDef) return false

    // Handle array type signals
    if (signalDef.singleType === 'ByteArray') {
        const values = value.split(',').map(v => Number(v.trim()))
        if(values.length!=signalDef.signalSizeBits/8){
            return false
        }
        // Check if all values are valid numbers
        if (values.some(v => isNaN(v))) return false
        // Check array length
        if (Array.isArray(signalDef.initValue) && values.length !== signalDef.initValue.length) return false
        // Check each value range
        return values.every(v => v >= 0 && v <= 255)
    }

    // Handle scalar type signals
    const numValue = Number(value)
    if (isNaN(numValue)) return false
    const maxValue = Math.pow(2, signalDef.signalSizeBits) - 1
    return numValue >= 0 && numValue <= maxValue
}

const handlePhysicalValueChange = (value: string, frameName: string, signal: SignalRow) => {
    if (!validatePhysicalValue(value, signal) || value=='') {
        updateSignalDisplayValues(frameName, signal, true)
        return
    }
    
    if (!selectedDB.value) return
    const db = dataBase.database.lin[selectedDB.value] as LDF
    
    let rawValue: number
    if (signal.encodingType) {
        rawValue = getRawValue(Number(value), signal.encodingType, db)
    } else {
        rawValue = Number(value)
    }
    rawValues.value[`${frameName}-${signal.name}`] = rawValue.toString()
    // 更新数据库
    updateSignalValue(frameName, signal.name, rawValue)
}

const handleRawValueChange = (value: string, frameName: string, signal: SignalRow) => {
    if (!validateRawValue(value, signal) || value=='') {
        updateSignalDisplayValues(frameName, signal, true)
        return
    }
    
    if (!selectedDB.value) return
    const db = dataBase.database.lin[selectedDB.value] as LDF
    const signalDef = db.signals[signal.name]

    // Handle array type signals
    if (signalDef.singleType === 'ByteArray') {
        const values = value.split(',').map(v => Number(v.trim()))
        updateSignalValue(frameName, signal.name, values)
    } else {
        const numValue = Number(value)
        
        // Validate physical value if encoding exists
        if (signal.encodingType) {
            const physicalValue = getPhysicalValue(numValue, signal.encodingType, db)
            if (!validatePhysicalValue(physicalValue, signal)) {  
                updateSignalDisplayValues(frameName, signal, true)
                return
            }  
            physicalValues.value[`${frameName}-${signal.name}`] = physicalValue
        } 
        updateSignalValue(frameName, signal.name, numValue)

    }
}

const resetAllSignals = () => {
    if (!selectedDB.value) return
    const db = dataBase.database.lin[selectedDB.value] as LDF
    
    for (const frame of tableData.value) {
        for (const signal of frame.childList) {
            const signalDef = db.signals[signal.name]
            if (!signalDef) continue

            updateSignalDisplayValues(frame.name, signal, false) // 使用初始值
            // Update database value
            db.signals[signal.name].value = undefined
        }
    }
}

// Modify updateSignalValue to handle arrays
const updateSignalValue = (frameName: string, signalName: string, value: number | number[]) => {
    if (!selectedDB.value) return
    const db = dataBase.database.lin[selectedDB.value] as LDF
    if (db.signals[signalName]) {
        db.signals[signalName].value = value
    }
    if(window.globalStart.value){
        window.electron.ipcRenderer.send('ipc-update-lin-signals', selectedDB.value, signalName, value)
    }
}

const getFrameDataHex = (frameName: string): string => {
    if (!selectedDB.value) return ''
    const db = dataBase.database.lin[selectedDB.value] as LDF
    const frame = db.frames[frameName]
    if (!frame) return ''
    const frameData = getFrameData(db, frame)
    const r=frameData.toString('hex').toUpperCase()
    //add space every 2 characters
    return r.match(/.{1,2}/g)?.join(' ') ?? ''
}

// 修改 watch 和 onMounted 中的初始化调用
watch([selectedDB, workNode], () => {
    physicalValues.value = {}
    rawValues.value = {}
    nextTick(() => {
        const db = dataBase.database.lin[selectedDB.value] as LDF
        for (const frame of tableData.value) {
            for (const signal of frame.childList) {
                updateSignalDisplayValues(frame.name, signal, true) // 使用初始值
            }
        }
    })
})

onMounted(() => {
    getUsedDb()
  
      
    for (const frame of tableData.value) {
        for (const signal of frame.childList) {
            updateSignalDisplayValues(frame.name, signal, true) // 使用初始值
        }
    }
    
})
</script>

<style lang="scss">
.expand-wrapper {
    padding-left: 45px;
}

.no-encoding {
    // Style for disabled inputs
    .el-input__inner {
        background-color: var(--el-fill-color-lighter);
        color: var(--el-text-color-secondary);
        cursor: not-allowed;
    }
}
</style>
