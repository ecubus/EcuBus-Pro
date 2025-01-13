<template>
    <div>
        <VxeGrid ref="xGrid" v-bind="gridOptions" @cell-click="cellClick">
            <template #toolbar>
                <div style="justify-content: flex-start;display: flex;align-items: center;gap:2px;margin-left: 5px;padding: 8px;">
                    <el-button-group>
                        <el-tooltip effect="light" content="Add Schedule Table" placement="bottom" >
                            <el-button link @click="addSch">
                                <Icon :icon="fileOpenOutline" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Edit Schedule" placement="bottom" >
                            <el-button link type="success" @click="editSchedule" :disabled="selectedIndex < 0">
                                <Icon :icon="editIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Delete Schedule" placement="bottom" >
                            <el-button link type="danger" @click="deleteSch" :disabled="selectedIndex < 0">
                                <Icon :icon="deleteIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                    </el-button-group>
                </div>
            </template>

            <!-- 添加统计信息插槽 -->
            <template #default_frameCount="{ row }">
                {{ calculateScheduleStats(row).frameDetails || 'No frames' }}
            </template>

            <template #default_totalTime="{ row }">
                {{ calculateScheduleStats(row).totalTime }} ms
            </template>
        </VxeGrid>

        <el-dialog v-if="editDialogVisible"  v-model="editDialogVisible" :close-on-click-modal="false"
                  :title="`Edit Schedule: ${editingSchedule?.name || ''}`"
                  width="70%"
                  align-center :append-to="`#win${editIndex}`">
            <EditSchedule 
                v-if="editDialogVisible && editingSchedule"
                v-model="editingSchedule"
                :edit-index="editIndex"
                ref="editRef"
                :sch-names="ldfObj.schTables.map(t => t.name)"
                :ldf="ldfObj"
                :rules="rules"
            />
        </el-dialog>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, inject, Ref, watch, nextTick } from 'vue'
import { getFrameSize, LDF, SchTable } from '../ldfParse'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { ElMessageBox, ElNotification, FormRules } from 'element-plus'
import { Icon } from '@iconify/vue'
import fileOpenOutline from '@iconify/icons-material-symbols/file-open-outline'
import editIcon from '@iconify/icons-material-symbols/edit-square-outline'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import EditSchedule from './editSchedule.vue'
import Schema from 'async-validator'

const props = defineProps<{
    editIndex: string
}>()

const ldfObj = defineModel<LDF>({
    required: true
})

const height = inject('height') as Ref<number>
const selectedIndex = ref(-1)
const editDialogVisible = ref(false)
const editingSchedule = ref<any>(null)

const xGrid = ref()

// 添加深度监听调度表变化

// Add validation rules
const rules: FormRules<SchTable> = {
    name: [
        {
            validator: (rule: any, value: any, callback: any) => {
                if (!value) {
                    callback(new Error('Schedule name is required'))
                    return
                }
                // Check for duplicate names
                const count = ldfObj.value.schTables.filter(t => t.name === value).length
                if (count > 1) {
                    callback(new Error('Schedule table name must be unique'))
                    return
                }
                callback()
            }
        }
    ],
    entries: [
        {
            validator: (rule: any, value: any, callback: any) => {
                if (!Array.isArray(value)) {
                    callback(new Error('Entries must be an array'))
                    return
                }
                
                for (const entry of value) {
                    // 计算frame最大传输时间
                    let maxFrameTime = 0
                    if (entry.isCommand) {
                        // 命令帧固定8字节
                        const bytes = 8
                        const baseTime = (bytes * 10 + 44) * (1 / ldfObj.value.global.LIN_speed)
                        maxFrameTime = baseTime * 1.4 // 考虑1.4倍的容差
                    } else {
                        // 获取frame大小并计算最大传输时间
                        const bytes = getFrameSize(ldfObj.value, entry.name)
                        const baseTime = (bytes * 10 + 44) * (1 / ldfObj.value.global.LIN_speed)
                        maxFrameTime = baseTime * 1.4 // 考虑1.4倍的容差
                    }

                    // Validate delay time - 必须大于frame的最大传输时间
                    if (typeof entry.delay !== 'number' || entry.delay <= 0) {
                        callback(new Error(`Invalid delay time in entry ${entry.name}`))
                        return
                    }
                    
                    if (entry.delay < maxFrameTime) {
                        callback(new Error(`Delay time (${entry.delay}ms) for ${entry.name} must be greater than maximum frame time (${maxFrameTime.toFixed(2)}ms)`))
                        return
                    }

                    if (entry.isCommand) {
                        // Validate command structure
                        if (!validateCommand(entry)) {
                            callback(new Error(`Invalid command structure in entry ${entry.name}`))
                            return
                        }
                    } else {
                        // Validate frame reference
                        if (!validateFrame(entry.name)) {
                            callback(new Error(`Invalid frame reference: ${entry.name}`))
                            return
                        }
                    }
                }
                callback()
            }
        }
    ]
}

function validateCommand(entry: any): boolean {
    // Validate specific command types
    switch (entry.name) {
        case 'AssignNAD':
            return !!entry.AssignNAD?.nodeName
        case 'ConditionalChangeNAD':
            return validateConditionalChangeNAD(entry.ConditionalChangeNAD)
        case 'DataDump':
            return validateDataDump(entry.DataDump)
        // Add more command validations as needed
        default:
            return true
    }
}

function validateConditionalChangeNAD(cmd: any): boolean {
    return cmd &&
        typeof cmd.nad === 'number' &&
        typeof cmd.id === 'number' &&
        typeof cmd.byte === 'number' &&
        typeof cmd.mask === 'number' &&
        typeof cmd.inv === 'number' &&
        typeof cmd.newNad === 'number'
}

function validateDataDump(cmd: any): boolean {
    return cmd &&
        cmd.nodeName &&
        typeof cmd.D1 === 'number' &&
        typeof cmd.D2 === 'number' &&
        typeof cmd.D3 === 'number' &&
        typeof cmd.D4 === 'number' &&
        typeof cmd.D5 === 'number'
}

function validateFrame(frameName: string): boolean {
    return frameName in ldfObj.value.frames ||
        frameName in ldfObj.value.eventTriggeredFrames ||
        frameName in ldfObj.value.sporadicFrames ||
        ['DiagnosticMasterReq', 'DiagnosticSlaveResp'].includes(frameName)
}

const ErrorList = ref<boolean[]>([])
const editRef=ref()
async function validate() {
    const errors: {
        field: string,
        message: string
    }[] = []
    
    ErrorList.value = []
    
    for (const schedule of ldfObj.value.schTables) {
        const schema = new Schema(rules as any)
        try {
            await schema.validate(schedule)
            ErrorList.value.push(false)
        } catch (e: any) {
            ErrorList.value.push(true)
            for (const key in e.fields) {
                for (const error of e.fields[key]) {
                    errors.push({
                        field: `Schedule ${schedule.name}: ${key}`,
                        message: error.message
                    })
                }
            }
        }
    }
    editRef.value?.validate()
    if (errors.length > 0) {
        throw {
            tab: 'Schedule Tables',
            error: errors,
        }
    }
}

// Update gridOptions to show error highlighting
const gridOptions = computed<VxeGridProps<SchTable>>(() => ({
    border: true,
    size: 'mini',
    height: height.value - 40,
    showOverflow: true,
    columnConfig: { resizable: true },
    rowConfig: { isCurrent: true },
    toolbarConfig: {
        slots: { tools: 'toolbar' }
    },
    columns: [
        { type: 'seq', width: 50, title: '', fixed: 'left' },
        { field: 'name', title: 'Schedule Table', minWidth: 200 },
        { 
            field: 'frameCount', 
            title: 'Frames', 
            width: 250,
            slots: { default: 'default_frameCount' }
        },
        { 
            field: 'totalTime', 
            title: 'Total Time', 
            width: 150,
            slots: { default: 'default_totalTime' }
        },
    ],
    data: ldfObj.value.schTables,
    rowClassName: ({ rowIndex }) => {
        return ErrorList.value[rowIndex] ? 'ldf-danger-row' : ''
    },
}))

function cellClick({ rowIndex }) {
    selectedIndex.value = rowIndex
}

function addSch() {
    ElMessageBox.prompt('Please input schedule table name', 'Add Schedule Table', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        inputPattern: /\S+/,
        inputErrorMessage: 'Name is required'
    }).then(({ value }) => {
        if (!value) return
        
        if (ldfObj.value.schTables.some(t => t.name === value)) {
            ElNotification({
                offset: 50,
                appendTo: `#win${props.editIndex}`,
                title: 'Error',
                message: 'Schedule table name already exists',
                type: 'error'
            })
            return
        }

        if (['MASTERREQ', 'SLAVERESP'].includes(value.toUpperCase())) {
            ElNotification({
                offset: 50,
                appendTo: `#win${props.editIndex}`,
                title: 'Error',
                message: `Name ${value} is reserved`,
                type: 'error'
            })
            return
        }

        ldfObj.value.schTables.push({
            name: value,
            entries: []
        })
    })
}

function deleteSch() {
    if (selectedIndex.value < 0) return

    ElMessageBox.confirm(
        'Are you sure to delete this schedule table?',
        'Warning',
        { type: 'warning' }
    ).then(() => {
        ldfObj.value.schTables.splice(selectedIndex.value, 1)
        selectedIndex.value = -1
    })
}

function editSchedule() {
    if (selectedIndex.value < 0) return
    editingSchedule.value = ldfObj.value.schTables[selectedIndex.value]
    editDialogVisible.value = true
}

function calculateScheduleStats(schedule: SchTable) {
    let totalTime = 0
    const frameStats = {
        unconditional: 0,
        eventTriggered: 0,
        sporadic: 0,
        diagnostic: 0,
        command: 0
    }

    schedule.entries.forEach(entry => {
        totalTime += entry.delay

        if (entry.isCommand) {
            frameStats.command++
            return
        }

        // 判断帧类型并计数
        if (entry.name in ldfObj.value.frames) {
            frameStats.unconditional++
        } else if (entry.name in ldfObj.value.eventTriggeredFrames) {
            frameStats.eventTriggered++
        } else if (entry.name in ldfObj.value.sporadicFrames) {
            frameStats.sporadic++
        } else if (['DiagnosticMasterReq', 'DiagnosticSlaveResp'].includes(entry.name)) {
            frameStats.diagnostic++
        }
    })

    const totalFrames = Object.values(frameStats).reduce((sum, count) => sum + count, 0)
    const details:string[] = []
    
    if (frameStats.unconditional > 0) details.push(`${frameStats.unconditional} unconditional`)
    if (frameStats.eventTriggered > 0) details.push(`${frameStats.eventTriggered} event`)
    if (frameStats.sporadic > 0) details.push(`${frameStats.sporadic} sporadic`)
    if (frameStats.diagnostic > 0) details.push(`${frameStats.diagnostic} diagnostic`)
    if (frameStats.command > 0) details.push(`${frameStats.command} command`)

    return {
        frameCount: totalFrames,
        frameDetails: details.join(', '),
        totalTime: totalTime.toFixed(2)
    }
}

defineExpose({ validate })
</script>

<style>
.ldf-danger-row {
    color: var(--el-color-danger);
    font-weight: bold;
}
</style>