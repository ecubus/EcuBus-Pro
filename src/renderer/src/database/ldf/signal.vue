<template>
    <div>
        <VxeGrid ref="xGrid" v-bind="gridOptions" class="signalTable" @menu-click="menuClick" @cell-click="ceilClick">
            <template #toolbar>
                <div
                    style="justify-content: flex-start;display: flex;align-items: center;gap:2px;margin-left: 5px;padding: 8px;">
                    <el-button-group>
                        <el-tooltip effect="light" content="Add Signal" placement="bottom" >
                            <el-button link @click="addNewSignal">
                                <Icon :icon="fileOpenOutline" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Copy Signal" placement="bottom" >
                            <el-button link type="info" @click="copySignal" :disabled="popoverIndex < 0">
                                <Icon :icon="copyIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Edit Signal" placement="bottom" >
                            <el-button link type="success" @click="editSignal" :disabled="popoverIndex < 0">
                                <Icon :icon="editIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Delete Signal" placement="bottom" >
                            <el-button link type="danger" @click="deleteSignal" :disabled="popoverIndex < 0">
                                <Icon :icon="deleteIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                    </el-button-group>
                </div>
            </template>
            <template #default_name="{ row }">
                {{ row.name }}
            </template>
            <template #default_publish="{ row }">
                {{ row.publish }}
            </template>
            <template #default_subscribe="{ row }">
                {{ row.subscribe }}
            </template>
            <template #default_length="{ row }">
                {{ row.length }}
            </template>
            <template #default_initValue="{ row }">
                {{ row.initValue }}
            </template>
            <template #default_unit="{ row }">
                {{ row.unit }}
            </template>
            <template #default_encoding="{ row }">
                {{ row.encoding }}
            </template>
            <template #default_frames="{ row }">
                {{ row.frames.join(', ') }}
            </template>
        </VxeGrid>
        <el-dialog v-if="editSig" v-model="editSig" :title="`${editNodeName} Signal`" width="70%" align-center
            :close-on-click-modal="false" :append-to="`#win${editIndex}`">
            <EditSignal ref="editRef" v-model="ldfObj.signals[editNodeName]" :edit-index="editIndex" :ldf="ldfObj" :rules="rules">
                :ldf="ldfObj">
            </EditSignal>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, inject, Ref } from 'vue'
import { ElMessageBox, FormRules } from 'element-plus';
import { Icon } from '@iconify/vue'
import fileOpenOutline from '@iconify/icons-material-symbols/file-open-outline';
import editIcon from '@iconify/icons-material-symbols/edit-square-outline';
import deleteIcon from '@iconify/icons-material-symbols/delete';
import copyIcon from '@iconify/icons-material-symbols/content-copy';
import { cloneDeep } from 'lodash';
import { LDF, SignalDef } from '../ldfParse';
import { VxeGrid, VxeGridProps } from 'vxe-table'
import EditSignal from './editSignal.vue';
import Schema from 'async-validator';
const props = defineProps<{
    editIndex: string
}>();

const ldfObj = defineModel<LDF>({
    required: true
})
const editRef = ref()
interface signalTable {
    name: string
    publish: string
    subscribe: string
    length: number
    initValue: string
    unit?: string
    encoding?: string
    frames: string[]
}
const ErrorList=ref<boolean[]>([])
const popoverIndex = ref(-1)
const editSig = ref(false)
const editNodeName = ref('')
let editNodeName1 = ''
function addNewSignal() {
    ElMessageBox.prompt('Please input signal name', 'Add Signal', {
        confirmButtonText: 'Add',
        cancelButtonText: 'Cancel',
        inputPattern: /^[a-zA-Z][a-zA-Z0-9_]+$/,
        appendTo: `#win${props.editIndex}`,
        buttonSize: 'small',
        inputErrorMessage: 'signal name must be alphanumeric, and underscore',
        inputValidator: (val: string) => {
            if (val in ldfObj.value.signals) {
                return 'signal name already exist'
            }
            return true
        }
    }).then(({ value }) => {
        ldfObj.value.signals[value] = {
            signalName: value,
            signalSizeBits: 0,
            initValue: 0,
            punishedBy: '',
            subscribedBy: [],
            singleType: 'Scalar',
        }
    }).catch(() => {
        null
    });
}
function copySignal() {
    ElMessageBox.prompt('Please input signal name', 'Copy Signal', {
        confirmButtonText: 'Confirm',
        cancelButtonText: 'Cancel',
        buttonSize: 'small',
        inputPattern: /^[a-zA-Z][a-zA-Z0-9_]+$/,
        appendTo: `#win${props.editIndex}`,
        inputErrorMessage: 'signal name must be alphanumeric, and underscore',
        inputValidator: (val: string) => {
            if (val in ldfObj.value.signals) {
                return 'signal name already exist'
            }
            return true
        }
    }).then(({ value }) => {
        const c = cloneDeep(ldfObj.value.signals[signalTables.value[popoverIndex.value].name])
        c.signalName = value
        ldfObj.value.signals[value] = c
    }).catch(() => {
        null
    });
}
function editSignal() {

    if (popoverIndex.value >= 0) {
        editNodeName.value = signalTables.value[popoverIndex.value].name
        editNodeName1 = editNodeName.value

        nextTick(() => {
            // Open edit dialog
            editSig.value = true
        })
    }
}

function deleteSignal() {
    if (popoverIndex.value >= 0) {
        ElMessageBox.confirm('Are you sure to delete this signal?', 'Delete Signal', {
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            type: 'warning',
            buttonSize: 'small'
        }).then(() => {
            delete ldfObj.value.signals[signalTables.value[popoverIndex.value].name]
            signalTables.value.splice(popoverIndex.value, 1)
            popoverIndex.value = -1
        }).catch(() => {
            //do nothing
        });
    }
}

const signalTables = computed(() => {
    const singleTables: signalTable[] = []
    for (const rs of Object.values(ldfObj.value.signals)) {
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
        const signalTable: signalTable = {
            name: rs.signalName,
            publish: rs.punishedBy,
            subscribe: rs.subscribedBy.join(', '),
            length: rs.signalSizeBits,
            initValue: showInitHex(rs.initValue),
            unit: unit,
            encoding: encoding,
            frames: []
        }
        for (const frame of Object.values(ldfObj.value.frames)) {
            frame.signals.forEach((signal) => {
                if (signal.name == rs.signalName) {
                    signalTable.frames.push(frame.name)
                }
            })
        }
        singleTables.push(signalTable)
    }
    return singleTables
})

function showInitHex(vv: number | number[]) {
    if (Array.isArray(vv)) {
        const r = vv.map((v) => '0x' + v.toString(16)).join(', ')
        return r
    } else {
        return '0x' + vv.toString(16)
    }
}
const height = inject('height') as Ref<number>

const gridOptions = computed<VxeGridProps<signalTable>>(() => {
    return {
        border: true,
        size: "mini",
        columnConfig: {
            resizable: true,
        },
        height: height.value - 40,
        showOverflow: true,
        scrollY: {
            enabled: true,
            gt: 0
        },
        rowConfig: {
            isCurrent: true,
        },
        editConfig: {
            trigger: 'click',
            mode: 'cell',
            showIcon: false,
            beforeEditMethod({ rowIndex }) {
                return true
            }
        },
        rowClassName: ({ rowIndex }) => {
            return ErrorList.value[rowIndex] ? 'ldf-danger-row' : ''
        },
        toolbarConfig: {
            slots: {
                tools: 'toolbar'
            }
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
            { field: 'name', title: 'Signal', width: 150, slots: { default: 'default_name' } },
            { field: 'publish', title: 'Publisher', width: 150, slots: { default: 'default_publish' } },
            { field: 'subscribe', title: 'Subscribers', width: 150, slots: { default: 'default_subscribe' } },
            { field: 'length', title: 'Length [Bit]', width: 100, slots: { default: 'default_length' } },
            { field: 'initValue', title: 'Init Value', minWidth: 150, slots: { default: 'default_initValue' } },
            { field: 'unit', title: 'Unit', width: 100, slots: { default: 'default_unit' } },
            { field: 'encoding', title: 'Encoding', width: 150, slots: { default: 'default_encoding' } },
            { field: 'frames', title: 'Joined Frame', width: 200, slots: { default: 'default_frames' } },
        ],
        data: signalTables.value
    }
})

function ceilClick(val: any) {
    popoverIndex.value = val.rowIndex
}

function menuClick(val: any) {
    // Handle menu click
}


const nodeList = computed(() => {
    const list: string[] = []
    list.push(ldfObj.value.node.master.nodeName)
    ldfObj.value.node.salveNode.forEach((item) => {
        list.push(item)
    })
    return list
})

const rules: FormRules<SignalDef> = {
    signalSizeBits: [
        { required: true, message: 'Please enter signal size' },
        {
            validator: (rule: any, value: number | undefined, callback: any) => {
                if (typeof value !== 'number') {
                    callback(new Error('Signal size must be a number'))
                    return
                }
                if (value <= 0) {
                    callback(new Error('Signal size must be greater than 0'))
                    return
                }
                if (ldfObj.value.signals[editNodeName1].singleType === 'Scalar' && value > 64) {
                    callback(new Error('Scalar signal size cannot exceed 64 bits'))
                    return
                }
                if (ldfObj.value.signals[editNodeName1].singleType === 'ByteArray' && value % 8 !== 0) {
                    callback(new Error('ByteArray signal size must be multiple of 8'))
                    return
                }
                callback()
            }
        }
    ],
    singleType: [
        { required: true, message: 'Please select signal type' }
    ],
    initValue: [
        {
            validator: (rule: any, value: any, callback: any) => {

                if (ldfObj.value.signals[editNodeName1].singleType === 'Scalar') {
                    if (typeof value !== 'number') {
                        callback(new Error('Initial value must be a number'))
                        return
                    }
                    const maxValue = Math.pow(2, ldfObj.value.signals[editNodeName1].signalSizeBits) - 1
                    if (value < 0 || value > maxValue) {
                        callback(new Error(`Value must be between 0 and ${maxValue}`))
                        return
                    }
                } else {
                    if (!Array.isArray(value)) {
                        callback(new Error('ByteArray initial value must be an array'))
                        return
                    }
                    const expectedLength = Math.ceil(ldfObj.value.signals[editNodeName1].signalSizeBits / 8)
                    if (value.length !== expectedLength) {
                        callback(new Error(`ByteArray must have ${expectedLength} elements`))
                        return
                    }
                    for (let i = 0; i < value.length; i++) {
                        if (typeof value[i] !== 'number' || value[i] < 0 || value[i] > 255) {
                            callback(new Error(`Element ${i + 1} must be between 0 and 255`))
                            return
                        }
                    }
                }
                callback()
            }
        }
    ],
    punishedBy: [
        { required: true, message: 'Please select publisher' },
        {
            validator: (rule: any, value: string, callback: any) => {

                if (!nodeList.value.includes(value)) {
                    callback(new Error('Invalid publisher node'))
                    return
                }
                callback()
            }
        }
    ],
    subscribedBy: [
        { required: true, message: 'Please select at least one subscriber', type: 'array' },
        {
            validator: (rule: any, value: string[], callback: any) => {
                if (!Array.isArray(value)) {
                    callback(new Error('Subscribers must be an array'))
                    return
                }
                if (value.length === 0) {
                    callback(new Error('Please select at least one subscriber'))
                    return
                }
                for (const node of value) {
                    if (!nodeList.value.includes(node)) {
                        callback(new Error(`Invalid subscriber node: ${node}`))
                        return
                    }
                }
                if (value.includes(ldfObj.value.signals[editNodeName1].punishedBy)) {
                    callback(new Error('Publisher cannot be a subscriber'))
                    return
                }
                callback()
            }
        }
    ]
}

async function validate() {
    const errors: {
        field: string,
        message: string
    }[] = []

    ErrorList.value=[]
    for (const key of Object.keys(ldfObj.value.signals)) {
        const schema = new Schema(rules as any)
        editNodeName1 = key
        try {
            await schema.validate(ldfObj.value.signals[key])
            ErrorList.value.push(false)
        } catch (e: any) {
            ErrorList.value.push(true)
            for (const key in e.fields) {
                for (const error of e.fields[key]) {
                    errors.push({
                        field: `${editNodeName1} : ${key}`,
                        message: error.message
                    })
                }
            }


        }
    }
    editNodeName1=editNodeName.value
    editRef.value?.validate()
    if (errors.length > 0) {
        throw {
            tab: 'Signals',
            error: errors,
        }
    }
}

defineExpose({ validate })

</script>
<style>
.ldf-danger-row {
    color:var(--el-color-danger)!important;
    font-weight: bolder;
}
</style>