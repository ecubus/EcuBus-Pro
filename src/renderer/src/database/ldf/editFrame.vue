<template>
    <div :id="tableId">
        <VxeGrid ref="xGrid" v-bind="gridOptions" class="signalTable" @menu-click="menuClick" @cell-click="ceilClick">
            <template #toolbar>
                <div
                    style="justify-content: flex-start;display: flex;align-items: center;gap:8px;margin-left: 5px;margin-bottom: 5px;">
                    <el-button-group>
                        <el-tooltip effect="light" content="Add Signal" placement="bottom" >
                            <el-button link @click="addNewSignal">
                                <Icon :icon="fileOpenOutline" style="font-size: 18px;" />
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

                    <el-divider direction="vertical" />

                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span :class="{
                            'ldf-danger-row': idHasError
                        }">Frame ID:</span>
                        <el-input v-model="frameId" style="width: 100px" size="small" @input="updateFrameId"
                            placeholder="Hex" />
                    </div>

                    <el-divider direction="vertical" />

                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span :class="{
                            'ldf-danger-row': frameSizeHasError
                        }">Frame Size:</span>
                        <el-input-number v-model="frame.frameSize" :min="1" :max="8" size="small"
                            style="width: 100px" />
                    </div>

                    <el-divider direction="vertical" />

                    <el-checkbox v-model="autoUpdateOffset" label="Auto Update Offset" size="small" />
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
                {{ getLengthFromLdf(row.name) }}
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
            <template #edit_name="{ row }">
                <el-select v-model="row.name" size="small" style="width: 100%;"
                    @change="(val) => handleSignalChange(row, val)">
                    <el-option v-for="key in availableSignals" :value="key" :key="key" :label="key"></el-option>
                </el-select>
            </template>
            <template #edit_offset="{ row }">
                <el-input-number v-model="row.offset" size="small" style="width: 100%;" :min="getMinOffset(row)"
                    :step="1" controls-position="right" />
            </template>
            <template #default_drag>
                <el-icon :id="'frameDragBtn' + editIndex" class="drag-btn" @mouseenter="rowDrop">
                    <Grid />
                </el-icon>
            </template>
        </VxeGrid>

    </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, inject, Ref, h, watch, onMounted } from 'vue'
import { ElMessageBox, ElOption, ElSelect, FormRules } from 'element-plus';
import { Icon } from '@iconify/vue'
import fileOpenOutline from '@iconify/icons-material-symbols/file-open-outline';
import editIcon from '@iconify/icons-material-symbols/edit-square-outline';
import deleteIcon from '@iconify/icons-material-symbols/delete';
import copyIcon from '@iconify/icons-material-symbols/content-copy';
import { cloneDeep } from 'lodash';
import { Frame, LDF, SignalDef } from '../ldfParse';
import { VxeGrid, VxeGridProps } from 'vxe-table'
import EditSignal from './editSignal.vue';
import { Grid } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import Schema from 'async-validator';

const props = defineProps<{
    editIndex: string
    ldf: LDF
    rules: FormRules
}>();

const frame = defineModel<Frame>({
    required: true
})

const frameSizeHasError=computed(()=>{
    for(const error of errors.value){
        const ea=error.split(' ')
      
        const index=ea.indexOf('Frame')

        if(index!==-1&&ea[index+1]==='size'){
            return true
        }
      
    }
    return false
})
const idHasError=computed(()=>{
    for(const error of errors.value){
        const ea=error.split(' ')
            const index=ea.indexOf('Frame')
        if(index!==-1&&ea[index+1]==='ID'){
            return true
        }
        
    }
    return false
})

interface FrameSignalItem {
    name: string
    offset: number
}

// 修改 availableSignals 计算属性
const availableSignals = computed(() => {
    const signals: string[] = []
    for (const s of Object.values(props.ldf.signals)) {
        // 只显示由当前frame的发布者发布的信号，且还未被添加到frame中的信号
        if (s.punishedBy === frame.value.publishedBy) {
            signals.push(s.signalName)
        }
    }
    return signals
})


const popoverIndex = ref(-1)
const editSig = ref(false)
const editNodeName = ref('')

// 新增的响应式变量
const autoUpdateOffset = ref(true)
const frameId = computed({
    get: () => '0x' + frame.value.id.toString(16),
    set: (val) => {
        const id = parseInt(val.replace('0x', ''), 16)
        if (!isNaN(id)) {
            frame.value.id = id
        }
    }
})

// 修改 addNewSignal 中的验证逻辑
function addNewSignal() {
    const index = ref()
    ElMessageBox({
        title: `Available signals for ${frame.value.name}`,
        buttonSize: "small",
        message: () =>
            h(ElSelect, {
                style: { width: '400px' },
                size: 'small',
                modelValue: index.value,
                'onUpdate:modelValue': (val) => {
                    index.value = val
                },
            }, () => {
                const slist: any[] = []
                for (const s of availableSignals.value) {

                    slist.push(
                        h(ElOption, {
                            value: s,
                            key: s,
                            label: s
                        })
                    )

                }
                return slist
            }),
        showCancelButton: true,
        confirmButtonText: 'Add',
        cancelButtonText: 'Cancel',
    }).then(() => {
        if (index.value) {

            frame.value.signals.push({
                name: index.value,
                offset: 0
            })
            autoUpdateOffset1()

        }
    }).catch(() => {
        null
    })
}

// 修改自动更新函数
function autoUpdateOffset1() {
    if (!autoUpdateOffset.value) return

    for (const [index, s] of frame.value.signals.entries()) {
        if (s.name in props.ldf.signals) {
            s.offset = index == 0 ? frame.value.signals[0].offset : frame.value.signals[index - 1].offset + props.ldf.signals[frame.value.signals[index - 1].name].signalSizeBits
        }
    }
    //frameSize update
    let frameSizeBits = frame.value.signals.length > 0 ? frame.value.signals[0].offset : 0
    for (const s of frame.value.signals) {
        if (s.name in props.ldf.signals) {
            frameSizeBits += props.ldf.signals[s.name].signalSizeBits
        }
    }
    frame.value.frameSize = Math.ceil(frameSizeBits / 8)
}



// 获取信号的最小可用偏移量
function getMinOffset(currentSignal: FrameSignalItem): number {
    const currentIndex = frame.value.signals.findIndex(s => s.name === currentSignal.name)
    if (currentIndex <= 0) return 0

    const prevSignal = frame.value.signals[currentIndex - 1]
    if (prevSignal && prevSignal.name in props.ldf.signals) {
        return prevSignal.offset + props.ldf.signals[prevSignal.name].signalSizeBits
    }
    return 0
}



function editSignal() {
    if (popoverIndex.value >= 0) {
        editNodeName.value = frame.value.signals[popoverIndex.value].name

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
            buttonSize: 'small',
            appendTo: `#win${props.editIndex}`
        }).then(() => {
            frame.value.signals.splice(popoverIndex.value, 1)

            popoverIndex.value = -1
        }).catch(() => {
            //do nothing
        });
    }
}


const height = inject('height') as Ref<number>

const tableId = computed(() => {
    return `frameTable${props.editIndex}`
})

const rowDrop = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    nextTick(() => {
        const wrapper = document.querySelector(
            `#${tableId.value} tbody`
        ) as HTMLElement
        Sortable.create(wrapper, {
            animation: 300,
            handle: `#frameDragBtn${props.editIndex}`,
            onEnd: ({ newIndex, oldIndex }) => {
                if (newIndex === oldIndex) return
                if (newIndex == undefined || oldIndex == undefined) return
                const currentRow = frame.value.signals.splice(oldIndex, 1)[0]
                frame.value.signals.splice(newIndex, 0, currentRow)

                // 如果启用了自动更新，则在拖拽后更新偏移量

                autoUpdateOffset1()

            }
        })
    })
}

const gridOptions = computed<VxeGridProps<FrameSignalItem>>(() => {
    return {
        border: true,
        size: "mini",
        columnConfig: {
            resizable: true,
        },
        height: height.value / 3 * 2,
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
        rowClassName: ({ row }) => {
            let className = ''
            for (const error of errors.value) {
                const errArray = error.split(' ');
                if (errArray.indexOf(row.name) !== -1) {
                    className = 'ldf-danger-row'
                    break
                }

            }
            return className
        },
        toolbarConfig: {
            slots: {
                tools: 'toolbar'
            }
        },
        align: 'center',
        id: `frameTable${props.editIndex}`,
        columns: [

            {
                field: 'drag',
                title: '',
                width: 36,
                resizable: false,
                slots: { default: 'default_drag' }
            },
            {
                field: 'name',
                title: 'Signal',
                minWidth: 150,
                editRender: {},
                slots: { edit: 'edit_name' }
            },
            {
                field: 'offset',
                title: 'Offset [Bit]',
                minWidth: 150,
                editRender: {},
                slots: { edit: 'edit_offset' }
            },
            {
                field: 'length',
                title: 'Length [Bit]',
                width: 150,
                slots: { default: 'default_length' }
            }
        ],
        data: frame.value.signals
    }
})

function handleSignalChange(row: FrameSignalItem, newValue: string) {
    const index = frame.value.signals.findIndex(s => s.name === row.name)
    if (index !== -1 && newValue) {
        frame.value.signals[index].name = newValue
        if (autoUpdateOffset.value) {
            autoUpdateOffset1()
        }
    }
}

// 添加 Frame ID 更新处理
function updateFrameId(val: string) {
    if (val.startsWith('0x')) {
        const newVal = val.replace('0x', '')
        if (/^[0-9a-fA-F]*$/.test(newVal)) {
            frame.value.id = parseInt(newVal, 16)
        }
    }
}

function getLengthFromLdf(signalName: string): number {
    return props.ldf.signals[signalName]?.signalSizeBits || 0
}

function ceilClick(val: any) {
    popoverIndex.value = val.rowIndex
}

function menuClick(val: any) {
    // Handle menu click
}

const errors = ref<string[]>([])
async function validate() {
    errors.value = []
    const schema = new Schema(props.rules as any)
    try {
        await schema.validate(frame.value)
    } catch (e: any) {
        for (const key in e.fields) {
            for (const error of e.fields[key]) {
                errors.value.push(error.toString())
            }
        }
    }
}

onMounted(() => {
    validate()
})


defineExpose({
    validate
})

</script>
<style scoped>
.el-table .danger-row {
    --el-table-tr-bg-color: var(--el-color-danger);
}

.drag-btn {
    cursor: move;
}

.el-divider--vertical {
    height: 20px;
    margin: 0 8px;
}
</style>