<template>
    <div>
        <VxeGrid ref="xGrid" v-bind="gridOptions" class="signalTable">
            <template #default_generator_control="{ row }">
                <el-button-group>
                    <el-button link size="small" :type="row.generatorType ? 'success' : 'default'"
                        @click="toggleGenerator(row)">
                        <Icon :icon="row.generatorType ? 'material-symbols:stop' : 'material-symbols:play-arrow'" />
                    </el-button>
                    <el-button link size="small" @click="editGenerator(row)">
                        <Icon icon="material-symbols:edit" />
                    </el-button>
                </el-button-group>
            </template>
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
                    <el-input-number :min="row.minimum" :max="row.maximum" style="width: 178px;" v-model="row.physValue"
                        size="small" controls-position="right" @change="handlePhysValueChange(row)" />
                </template>
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
import { getMessageData } from '@r/database/dbcParse'

const props = defineProps<{
    database: string
    messageName: string
}>()

const dataStore = useDataStore()
const editDialogVisible = ref(false)
const currentSignal = ref<Signal | null>(null)

const message = computed<Message | undefined>(() => {
    const db = Object.values(dataStore.database.can).find(db => db.name === props.database)
    if (db) {
        const msg = Object.values(db.messages).find(msg => msg.name === props.messageName)
        return msg
    }
    return undefined
})
// Get signals data from store
const signals = computed(() => {
    const data: Signal[] = []

    if (message.value) {
        Object.values(message.value.signals).forEach(signal => {
            data.push(signal)
        })

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
            { field: 'name', title: 'Name', minWidth: 120},
            {
                field: 'generatorControl',
                title: 'Generator',
                width: 100,
                slots: { default: 'default_generator_control' }
            },

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
                width: 200,
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

// Convert signed value to two's complement
function toTwosComplement(value: number, bits: number): number {
    if (value >= 0) return value
    const mask = (1 << bits) - 1
    return (~(-value) + 1) & mask
}

// Convert two's complement to signed value
function fromTwosComplement(value: number, bits: number): number {
    if (value & (1 << (bits - 1))) {
        return -(((~value + 1) & ((1 << bits) - 1)))
    }
    return value
}

// Calculate max raw value based on signal length
function getMaxRawValue(length: number): number {
    return Math.pow(2, length) - 1
}

// Convert physical value to raw value
function physToRaw(phys: number, row: Signal): number {
    let rawValue = Math.round((phys - (row.offset || 0)) / (row.factor || 1))

    // Get max value based on length
    const maxRaw = getMaxRawValue(row.length)

    if (row.isSigned) {
        // For signed values, handle negative numbers with two's complement
        if (rawValue < 0) {
            rawValue = toTwosComplement(rawValue, row.length)
        } else if (rawValue > maxRaw / 2) {
            // Limit positive values to max signed value
            rawValue = Math.floor(maxRaw / 2)
        }
    } else {
        // For unsigned values, simply clamp between 0 and max
        rawValue = Math.min(Math.max(rawValue, 0), maxRaw)
    }

    return rawValue
}

// Convert raw value to physical value
function rawToPhys(raw: number, row: Signal): number {
    let actualValue = raw

    if (row.isSigned) {
        // Only convert from two's complement if it's a signed value
        const maxRaw = getMaxRawValue(row.length)
        if (raw > maxRaw / 2) {
            // If the value is in the negative range of two's complement
            actualValue = fromTwosComplement(raw, row.length)
        }
    }

    return actualValue * (row.factor || 1) + (row.offset || 0)
}

// Raw value change handler
function handleRawValueChange(row: Signal) {
    if (row.value === undefined) return

    // Ensure raw value is within bounds
    const maxRaw = getMaxRawValue(row.length)
    row.value = Math.min(Math.max(0, row.value), maxRaw)

    if (row.values || row.valueTable) {
        // For enum values, directly set the raw value as phys value
        row.physValue = row.value
    } else {
        // Calculate new physical value
        const newPhysValue = rawToPhys(row.value, row)

        // Check if this physical value would exceed limits
        if (row.minimum !== undefined && newPhysValue < row.minimum) {
            // Adjust raw value based on minimum physical value
            row.value = physToRaw(row.minimum, row)
            row.physValue = row.minimum
        } else if (row.maximum !== undefined && newPhysValue > row.maximum) {
            // Adjust raw value based on maximum physical value
            row.value = physToRaw(row.maximum, row)
            row.physValue = row.maximum
        } else {
            row.physValue = newPhysValue
        }
    }
    if(message.value){
        emits('change', getMessageData(message.value))
    }
}

// Physical value change handler
function handlePhysValueChange(row: Signal) {
    if (row.physValue === undefined) return

    if (row.values || row.valueTable) {
        // For enum values, directly set the phys value as raw value
        row.value = typeof row.physValue === 'number' ? row.physValue : 0
    } else {
        const physValue = typeof row.physValue === 'number' ? row.physValue : 0

        // Clamp physical value to min/max if defined
        let clampedPhysValue = physValue
        if (row.minimum !== undefined && physValue < row.minimum) {
            clampedPhysValue = row.minimum
        } else if (row.maximum !== undefined && physValue > row.maximum) {
            clampedPhysValue = row.maximum
        }

        // Update physical value if it was clamped
        if (clampedPhysValue !== physValue) {
            row.physValue = clampedPhysValue
        }

        // Calculate and set raw value
        row.value = physToRaw(clampedPhysValue, row)
    }
    if(message.value){
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
    signals.value.forEach(signal => {
        initializeSignal(signal)
    })
    if(message.value){
        emits('change',getMessageData(message.value))
    }
})

//

const xGrid = ref()
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
</style>
