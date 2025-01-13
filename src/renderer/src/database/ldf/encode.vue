<template>
    <div>
        <VxeGrid ref="xGrid" v-bind="gridOptions" @cell-click="cellClick">
            <template #toolbar>
                <div style="justify-content: flex-start;display: flex;align-items: center;gap:2px;margin-left: 5px;padding: 8px;">
                    <el-button-group>
                        <el-tooltip effect="light" content="Add Encoding Type" placement="bottom" >
                            <el-button link @click="addEncode">
                                <Icon :icon="fileOpenOutline" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Edit Encoding Type" placement="bottom" >
                            <el-button link type="success" @click="editEncode" :disabled="selectedIndex < 0">
                                <Icon :icon="editIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Delete Encoding Type" placement="bottom" >
                            <el-button link type="danger" @click="deleteEncode" :disabled="selectedIndex < 0">
                                <Icon :icon="deleteIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                    </el-button-group>
                </div>
            </template>

            <template #default_encodingTypes="{ row }">
                {{ getEncodingTypeDetails(row) }}
            </template>
        </VxeGrid>

        <el-dialog v-if="editDialogVisible" v-model="editDialogVisible" :close-on-click-modal="false"
                  :title="`Edit Encoding Type: ${editingEncode?.name || ''}`"
                  width="70%"
                  align-center :append-to="`#win${editIndex}`">
            <EditEncode
                v-if="editDialogVisible && editingEncode"
                v-model="editingEncode"
                :edit-index="editIndex"
                :ldf="ldfObj"
            />
        </el-dialog>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, inject, Ref } from 'vue'
import { LDF, SignalEncodeType } from '../ldfParse'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { ElMessageBox, ElNotification, FormRules } from 'element-plus'
import { Icon } from '@iconify/vue'
import fileOpenOutline from '@iconify/icons-material-symbols/file-open-outline'
import editIcon from '@iconify/icons-material-symbols/edit-square-outline'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import EditEncode from './editEncode.vue'
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
const editingEncode = ref<SignalEncodeType | null>(null)

const xGrid = ref()

function getEncodingTypeDetails(encode: SignalEncodeType) {
    const details = encode.encodingTypes.map(type => {
        switch(type.type) {
            case 'logicalValue':
                return `Logical(${type.logicalValue?.signalValue})`
            case 'physicalValue':
                return `Physical(${type.physicalValue?.minValue}~${type.physicalValue?.maxValue})`
            case 'bcdValue':
                return 'BCD'
            case 'asciiValue':
                return 'ASCII'
            default:
                return 'Unknown'
        }
    })
    return details.join(', ')
}

// 添加验证规则
const rules: FormRules<SignalEncodeType> = {
    name: [{
        required: true,
        message: 'Name is required',
        validator: (rule: any, value: any, callback: any) => {
            if (!value) {
                callback(new Error('Name is required'))
                return
            }
            // 检查名称唯一性
            if (Object.keys(ldfObj.value.signalEncodeTypes).filter(name => name === value).length > 1) {
                callback(new Error('Encoding type name must be unique'))
                return
            }
            callback()
        }
    }],
    encodingTypes: [{
        type: 'array',
        required: true,
        message: 'At least one encoding type is required',
        validator: (rule: any, value: any, callback: any) => {
            if (!Array.isArray(value) || value.length === 0) {
                callback(new Error('At least one encoding type is required'))
                return
            }

            // 验证每个编码类型的值
            for (const encoding of value) {
                if (!['logicalValue', 'physicalValue', 'bcdValue', 'asciiValue'].includes(encoding.type)) {
                    callback(new Error('Invalid encoding type'))
                    return
                }

                // 验证logical value
                if (encoding.type === 'logicalValue') {
                    if (!encoding.logicalValue || 
                        typeof encoding.logicalValue.signalValue !== 'number') {
                        callback(new Error('Invalid logical value'))
                        return
                    }
                }

                // 验证physical value
                if (encoding.type === 'physicalValue') {
                    if (!encoding.physicalValue ||
                        typeof encoding.physicalValue.minValue !== 'number' ||
                        typeof encoding.physicalValue.maxValue !== 'number' ||
                        typeof encoding.physicalValue.scale !== 'number' ||
                        typeof encoding.physicalValue.offset !== 'number' ||
                        encoding.physicalValue.minValue > encoding.physicalValue.maxValue) {
                        callback(new Error('Invalid physical value range'))
                        return
                    }
                }
            }
            callback()
        }
    }]
}

// 添加错误列表
const ErrorList = ref<boolean[]>([])

// 修改validate函数
async function validate() {
    const errors: {
        field: string,
        message: string
    }[] = []
    
    ErrorList.value = []
    
    for (const encodeName of Object.keys(ldfObj.value.signalEncodeTypes)) {
        const encode = ldfObj.value.signalEncodeTypes[encodeName]
        const schema = new Schema(rules as any)
        try {
            await schema.validate(encode)
            ErrorList.value.push(false)
        } catch (e: any) {
            ErrorList.value.push(true)
            for (const key in e.fields) {
                for (const error of e.fields[key]) {
                    errors.push({
                        field: `Encoding ${encodeName}: ${key}`,
                        message: error.message
                    })
                }
            }
        }
    }

    if (errors.length > 0) {
        throw {
            tab: 'Signal Encoding',
            error: errors
        }
    }
}

// 修改grid options添加错误样式
defineExpose({ validate })

const gridOptions = computed<VxeGridProps<SignalEncodeType>>(() => ({
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
        { field: 'name', title: 'Encoding Type Name', minWidth: 200 },
        { 
            field: 'encodingTypes', 
            title: 'Encoding Details', 
            minWidth: 300,
            slots: { default: 'default_encodingTypes' }
        }
    ],
    data: Object.values(ldfObj.value.signalEncodeTypes)
}))

function cellClick({ rowIndex }) {
    selectedIndex.value = rowIndex
}

function addEncode() {
    ElMessageBox.prompt('Please input encoding type name', 'Add Encoding Type', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        inputPattern: /\S+/,
        inputErrorMessage: 'Name is required',
        buttonSize:'small',
        appendTo: `#win${props.editIndex}`
    }).then(({ value }) => {
        if (!value) return
        
        if (value in ldfObj.value.signalEncodeTypes) {
            ElNotification({
                offset: 50,
                appendTo: `#win${props.editIndex}`,
                title: 'Error',
                message: 'Encoding type name already exists',
                type: 'error'
            })
            return
        }

        ldfObj.value.signalEncodeTypes[value] = {
            name: value,
            encodingTypes: []
        }
        ldfObj.value.signalRep[value] = []
    })
}

function deleteEncode() {
    if (selectedIndex.value < 0) return

    const encodeName = Object.keys(ldfObj.value.signalEncodeTypes)[selectedIndex.value]
    
    ElMessageBox.confirm(
        'Are you sure to delete this encoding type?',
        'Warning',
        { type: 'warning','buttonSize':'small', appendTo: `#win${props.editIndex}` }
    ).then(() => {
        delete ldfObj.value.signalEncodeTypes[encodeName]
        delete ldfObj.value.signalRep[encodeName]
        selectedIndex.value = -1
    })
}

function editEncode() {
    if (selectedIndex.value < 0) return
    const encodeName = Object.keys(ldfObj.value.signalEncodeTypes)[selectedIndex.value]
    editingEncode.value = ldfObj.value.signalEncodeTypes[encodeName]
    editDialogVisible.value = true
}
</script>