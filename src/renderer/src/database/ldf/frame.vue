<template>
    <div>
        <VxeGrid ref="xGrid" v-bind="gridOptions" @cell-click="cellClick">
            <template #toolbar>
                <div style="justify-content: flex-start;display: flex;align-items: center;gap:2px;margin-left: 5px;padding: 8px;">
                    <el-button-group>
                        <el-tooltip effect="light" content="Add Frame" placement="bottom" >
                            <el-button link @click="addFrame">
                                <Icon :icon="fileOpenOutline" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Edit Frame" placement="bottom" >
                            <el-button link type="success" @click="editFrame" :disabled="popoverIndex < 0">
                                <Icon :icon="editIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Delete Frame" placement="bottom" >
                            <el-button link type="danger" @click="removeFrame" :disabled="popoverIndex < 0">
                                <Icon :icon="deleteIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                    </el-button-group>
                    <!-- <el-checkbox size="small" v-model="autoOffset" label="Enable Auto FrameSize/StartBit Calculate"
                    border /> -->
                </div>
            </template>
            <template #default_name="{ row }">{{ row.name }}</template>
            <template #default_punishedBy="{ row }">{{ row.punishedBy }}</template>
            <template #default_id="{ row }">{{ row.id}}</template>
            <template #default_frameSize="{ row }">{{ row.frameSize }}</template>
            <template #default_maxTime="{ row }">{{ row.maxTime }}</template>
            <template #default_minTime="{ row }">{{ row.minTime }}</template>
        </VxeGrid>
        <el-dialog v-if="editFrameV" v-model="editFrameV" :title="`Edit Frame: ${editFrameName}`" :close-on-click-modal="false"
        width="70%" align-center :append-to="`#win${editIndex}`">
            <EditFrame v-model="ldfObj.frames[editFrameName]" :edit-index="editIndex" ref="editRef" :ldf="ldfObj" :rules="rules">
            </EditFrame>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup>
import { ref, watch, inject, Ref, computed, nextTick, toRaw, onMounted, h, toRef } from 'vue'
import { Frame, LDF, SignalDef, getFrameSize } from '../ldfParse';
import { ElNotification, ElSelect, ElMessageBox, ElOption, ElInput } from 'element-plus';
import {
    ArrowUpBold,
    ArrowDownBold,
    Plus,
    Edit,
    Delete
} from '@element-plus/icons-vue'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { Icon } from '@iconify/vue'
import fileOpenOutline from '@iconify/icons-material-symbols/file-open-outline'
import editIcon from '@iconify/icons-material-symbols/edit-square-outline'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import EditFrame from './editFrame.vue'
import { FormRules } from 'element-plus'
import Schema from 'async-validator'

interface frameTable {
    name: string
    id: string,
    punishedBy: string
    frameSize: number
    maxTime: string
    minTime: string
    signalCount: number  // Add this line
    signals: {
        name: string
        startBit: number
        publish: string
        subscribe: string
        length: number
        initValue: string
        unit?: string
        encoding?: string
    }[]
}

const props = defineProps<{
    editIndex: string
}>();

// const autoOffset = ref(false)
const ldfObj = defineModel<LDF>({
    required: true
})

const frameTables = computed(() => {
    const schTables: frameTable[] = []

    for (const frame of Object.values(ldfObj.value.frames)) {
        const buadrate = ldfObj.value.global.LIN_speed
        const bytes = getFrameSize(ldfObj.value, frame.name)

        const frameMinTime = (bytes * 10 + 44) * (1 / buadrate)
        const frameMaxTime = frameMinTime * 1.4
        const tf: frameTable = {
            name: frame.name,
            id: '0x' + frame.id.toString(16),
            punishedBy: frame.publishedBy,
            frameSize: frame.frameSize,
            maxTime: frameMaxTime.toFixed(2),
            minTime: frameMinTime.toFixed(2),
            signalCount: frame.signals.length,  // Add this line
            signals: []
        }

        for (const s of frame.signals) {
            if (s.name in ldfObj.value.signals) {
                const rs = ldfObj.value.signals[s.name]
                let encoding: string | undefined
                let unit
                for (const r of Object.keys(ldfObj.value.signalRep)) {
                    if (ldfObj.value.signalRep[r].indexOf(rs.signalName) != -1 && r in ldfObj.value.signalEncodeTypes && ldfObj.value.signalEncodeTypes[r].encodingTypes.length > 0) {
                        encoding = ldfObj.value.signalEncodeTypes[r].encodingTypes[0].type
                        if (encoding == 'logicalValue') {
                            unit = ldfObj.value.signalEncodeTypes[r].encodingTypes[0].logicalValue?.textInfo
                        } else if (encoding == 'physicalValue') {
                            unit = ldfObj.value.signalEncodeTypes[r].encodingTypes[0].physicalValue?.textInfo
                        }
                    }
                }
                tf.signals.push({
                    name: rs.signalName,
                    startBit: s.offset,
                    publish: rs.punishedBy,
                    subscribe: rs.subscribedBy.join(', '),
                    length: rs.signalSizeBits,
                    initValue: Array.isArray(rs.initValue) ? rs.initValue.join(', ') : rs.initValue.toString(),
                    unit: unit,
                    encoding: encoding
                })
            }
        }
        schTables.push(tf)
    }
    return schTables
})

const popoverIndex = ref(-1)

function removeFrame() {
    if (popoverIndex.value >= 0) {
        ElMessageBox.confirm('Are you sure to delete this frame?', 'Delete frame', {
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            type: 'warning',
            buttonSize: 'small'
        }).then(() => {
            delete ldfObj.value.frames[frameTables.value[popoverIndex.value].name]
            popoverIndex.value = -1
        }).catch(() => {
            //do nothing
        });
    }
}



function addFrame() {
    const name = ref('new Frame')
    const publishedBy = ref(ldfObj.value.node.master.nodeName)
    const nodeList = [ldfObj.value.node.master.nodeName, ...ldfObj.value.node.salveNode]

    ElMessageBox({
        title: `Add New Frame`,
        buttonSize: "small",
        message: () =>
            h('div', [
                h('div', [
                    h('span', 'Frame Name: '),
                    h(ElInput, {
                        size: 'small',
                        modelValue: name.value,
                        'onUpdate:modelValue': (val) => {
                            name.value = val
                        },
                    })
                ]),
                h('div', [
                    h('span', 'Publisher: '),
                    h(ElSelect, {
                        style: { width: '100%' },
                        size: 'small',
                        modelValue: publishedBy.value,
                        'onUpdate:modelValue': (val) => {
                            publishedBy.value = val
                        },
                    }, () => {
                        const slist: any[] = []
                        for (const s of nodeList) {
                            slist.push(
                                h(ElOption, {
                                    value: s,
                                    key: s,
                                    label: s
                                })
                            )
                        }
                        return slist
                    })
                ]),
                h('span', {
                    style: {
                        color: 'gray',
                        fontSize: '12px'
                    }
                }, "Name and Publisher cannot be empty and can't be changed again after creation",)
            ]),
    }).then(() => {
        if (name.value && !(name.value in ldfObj.value.frames)) {
            ldfObj.value.frames[name.value] = {
                name: name.value,
                publishedBy: publishedBy.value,
                id: 0,
                frameSize: 0,
                signals: []
            }
        } else {
            ElNotification({
                offset: 50,
                appendTo: `#win${props.editIndex}`,
                title: 'Error',
                message: 'Frame name already exists or empty',
                type: 'error'
            })
        }
    }).catch(() => {
        null
    })
}


const height = inject('height') as Ref<number>

const gridOptions = computed<VxeGridProps<frameTable>>(() => {
    return {
        border: true,
        size: "mini",
        columnConfig: {
            resizable: true,
        },
        height: height.value-40,
        showOverflow: true,
        scrollY: {
            enabled: true,
            gt: 0
        },
        rowConfig: {
            isCurrent: true,
        },
        toolbarConfig: {
            slots: {
                tools: 'toolbar'
            }
        },
        rowClassName: ({ rowIndex }) => {
            return ErrorList.value[rowIndex] ? 'ldf-danger-row' : ''
        },
        align: 'center',
        columns: [
            {
                type: "seq",
                width: 50,
                title: "",
                align: "center",
                fixed: "left",
                resizable: false,
            },
            { field: 'name', title: 'Frame Name', width: 150, slots: { default: 'default_name' } },
            { field: 'punishedBy', title: 'Frame Publisher', width: 150, slots: { default: 'default_punishedBy' } },
            { field: 'id', title: 'Frame ID', minWidth: 150, slots: { default: 'default_id' } },
            { field: 'frameSize', title: 'Frame Size', minWidth: 150, slots: { default: 'default_frameSize' } },
            { field: 'signalCount', title: 'Signal Count', width: 120 },  // Add this line
            { field: 'maxTime', title: 'Max.Frame Time [ms]', width: 150, slots: { default: 'default_maxTime' } },
            { field: 'minTime', title: 'Min.Frame Time [ms]', width: 150, slots: { default: 'default_minTime' } },
        ],
        data: frameTables.value
    }
})

function cellClick({ rowIndex }) {
    popoverIndex.value = rowIndex
}

const editFrameV = ref(false)
const editFrameName = ref('')
let editFrameName1=''

function editFrame() {
    if (popoverIndex.value >= 0) {
        editFrameName.value = frameTables.value[popoverIndex.value].name
        editFrameName1=editFrameName.value
        nextTick(() => {
            editFrameV.value = true
        })
    }
}

const ErrorList=ref<boolean[]>([])

// Add validation rules
const rules: FormRules<Frame> = {
    signals: [
        {
            validator: (rule: any, value: any, callback: any) => {
                if (!Array.isArray(value)) {
                    callback(new Error('Signals must be an array'))
                    return
                }
                // Check for duplicate signals
                const signalNames = value.map(s => s.name)
                const hasDuplicates = signalNames.length !== new Set(signalNames).size
                if (hasDuplicates) {
                    callback(new Error('Duplicate signals are not allowed'))
                    return
                }

                // Check for signal overlaps and validate signal existence
                const signalRanges: Array<{ start: number; end: number; name: string }> = []
                for (const signal of value) {
                    if (!(signal.name in ldfObj.value.signals)) {
                        callback(new Error(`Signal ${signal.name} not found in LDF`))
                        return
                    }
                    const signalSize = ldfObj.value.signals[signal.name].signalSizeBits
                    const start = signal.offset
                    const end = signal.offset + signalSize - 1

                    // Check for overlaps with other signals
                    for (const range of signalRanges) {
                        if (!(end < range.start || start > range.end)) {
                            callback(new Error(`Signal ${signal.name} overlaps with signal ${range.name}`))
                            return
                        }
                    }
                    signalRanges.push({ start, end, name: signal.name })

                    const frame = ldfObj.value.frames[editFrameName1]
                    // Check if signal fits within frame size
                    if (end >= frame.frameSize * 8) {
                        callback(new Error(`Signal ${signal.name} exceeds frame size`))
                        return
                    }
                }
                callback()
            }
        }
    ],
    id: [
        {
            validator: (rule: any, value: any, callback: any) => {
                if (typeof value !== 'number') {
                    callback(new Error('Frame ID must be a number'))
                    return
                }
                if (value < 0 || value > 0x3F) {
                    callback(new Error('Frame ID must be between 0 and 0x3F'))
                    return
                }
                const frame=ldfObj.value.frames[editFrameName1]
                // Check for duplicate frame IDs
                for (const otherFrame of Object.values(ldfObj.value.frames)) {
                    if (otherFrame.name !== frame.name && otherFrame.id === value) {
                        callback(new Error('Frame ID is already used by another frame'))
                        return
                    }
                }
                callback()
            }
        }
    ],
    frameSize: [
        {
            validator: (rule: any, value: any, callback: any) => {
                if (typeof value !== 'number') {
                    callback(new Error('Frame size must be a number'))
                    return
                }
                if (value <= 0 || value > 8) {
                    callback(new Error('Frame size must be between 1 and 8 bytes'))
                    return
                }
                // Check if size is sufficient for signals
                let maxOffset = 0
                const frame=ldfObj.value.frames[editFrameName1]
                for (const signal of frame.signals) {
                    if (signal.name in ldfObj.value.signals) {
                        const signalSize =ldfObj.value.signals[signal.name].signalSizeBits
                        maxOffset = Math.max(maxOffset, signal.offset + signalSize)
                    }
                }
                if (maxOffset > value * 8) {
                    callback(new Error(`Frame size too small for signals (needs at least ${Math.ceil(maxOffset/8)} bytes)`))
                    return
                }
                callback()
            }
        }
    ]
}

const editRef=ref()
async function validate() {
    const errors: {
        field: string,
        message: string
    }[] = []
    ErrorList.value=[]
    for(const key of Object.keys(ldfObj.value.frames)){
        const frame=ldfObj.value.frames[key]
        const schema = new Schema(rules as any)
        editFrameName1=key
        try {
            await schema.validate(frame)
            ErrorList.value.push(false)
        } catch (e: any) {
            ErrorList.value.push(true)
            for (const key in e.fields) {
                for (const error of e.fields[key]) {
                    errors.push({
                        field: `Frame ${frame.name}: ${key}`,
                        message: error.message
                 })
                }
            }
            ErrorList.value.push(false)
        }
    }
    editFrameName1=editFrameName.value
    editRef.value?.validate()
    if (errors.length > 0) {
        throw {
            tab: 'Frames',
            error: errors,
        }
    }
    
}

defineExpose({ validate })
</script>
<style>

</style>