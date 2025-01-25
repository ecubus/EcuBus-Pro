<template>
    <div style="display: relative">
        <VxeGrid ref="xGrid" v-bind="gridOptions" class="sequenceTable" @cell-click="ceilClick">
            <template #default_trigger="{ row, rowIndex }">
                <span class="lr">
                    <span>{{ row.trigger.type.toUpperCase() }} <span
                            v-if="row.trigger.type == 'manual' && row.trigger.onKey" style="padding: 0 5px;">({{
                                row.trigger.onKey }})</span>
                        <span v-if="row.trigger.type == 'periodic'" style="padding: 0 5px;">({{ row.trigger.period || 10
                            }}ms)</span>
                    </span> <el-button link :ref="e => buttonRef[rowIndex] = e" @click="openPr(rowIndex)"
                        style="float: right;"><el-icon class="el-icon--right">
                            <arrow-down />
                        </el-icon> </el-button>
                </span>
            </template>
            <template #default_send="{ row, rowIndex }">
                <el-button v-if="row.trigger.type == 'manual'" type="primary" size="small" plain style="width: 70px;"
                    :disabled="!globalStart" @click="sendFrame(rowIndex)">
                    <Icon :icon="sendIcon" />
                </el-button>
                <el-button v-else :type="periodTimer[rowIndex] ? 'danger' : 'primary'" size="small" plain
                    style="width: 70px;" :disabled="!globalStart" @click="sendFrame(rowIndex)">
                    <Icon :icon="periodTimer[rowIndex] ? stopIcon : sendIcon" />
                </el-button>
            </template>
            <template #default_type="{ row }">
                <el-select v-model="row.type" size="small" style="width: 100%;">
                    <el-option v-for="l, v in typeMap" :value="v" :label="l" :key="v"></el-option>

                </el-select>
            </template>
            <template #default_type1="{ row }">
                {{ typeMap[row.type] }}
            </template>
            <template #default_dlc="{ row }">
                <el-select v-model="row.dlc" size="small" style="width: 100%;">
                    <el-option v-for="i in 16" :value="i - 1" :key="i"></el-option>


                </el-select>
            </template>
            <template #default_channel="{ row }">
                {{ devices[row.channel]?.name }}
            </template>
            <template #edit_channel="{ row }">
                <el-select v-model="row.channel" size="small" style="width: 100%;" clearable>
                    <el-option v-for="item, key in devices" :value="key" :key="key" :label="item.name"></el-option>


                </el-select>
            </template>
            <template #default_id="{ row }">
                <el-input v-model="row.id" size="small" style="width: 100%;" @input="idChange" />

            </template>
            <template #default_name="{ row }">
                <el-input v-model="row.name" size="small" style="width: 100%;" />

            </template>
            <template #toolbar>
                <div style="justify-content: flex-start;display: flex;align-items: center;gap:2px;margin-left: 5px;">
                    <el-button-group>
                        <el-tooltip effect="light" content="Edit Connect" placement="bottom">
                            <el-button type="primary" link @click="editConnect">
                                <Icon :icon="linkIcon" style="rotate: -45deg;font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Add Frame" placement="bottom">
                            <el-button link @click="addFrame">
                                <Icon :icon="fileOpenOutline" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Select Frame from Database" placement="bottom">
                            <el-button link @click="openFrameSelect">
                                <Icon :icon="databaseIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Edit Frame" placement="bottom">
                            <el-button link type="success" @click="editFrame" :disabled="popoverIndex < 0">
                                <Icon :icon="editIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                        <el-tooltip effect="light" content="Delete Frame" placement="bottom">
                            <el-button link type="danger" @click="deleteFrame"
                                :disabled="popoverIndex < 0 || periodTimer[popoverIndex] == true">
                                <Icon :icon="deleteIcon" style="font-size: 18px;" />
                            </el-button>
                        </el-tooltip>
                    </el-button-group>


                </div>
            </template>
        </VxeGrid>

        <el-popover width="250" :virtual-ref="ppRef" trigger="click" virtual-triggering>
            <el-row v-if="dataBase.ia[editIndex]?.action[popoverIndex]" style="padding: 10px;">
                <el-col :span="24">
                    <el-radio-group v-model="dataBase.ia[editIndex].action[popoverIndex].trigger.type"
                        :disabled="periodTimer[popoverIndex]">
                        <el-radio value="manual">Manual</el-radio>
                        <el-radio value="periodic">Periodic</el-radio>
                    </el-radio-group>
                </el-col>

                <el-col :span="12">
                    <div>On Key:</div>
                    <div><el-input size="small" style="width: 80%;"
                            :disabled="dataBase.ia[editIndex].action[popoverIndex].trigger.type != 'manual'"
                            v-model="dataBase.ia[editIndex].action[popoverIndex].trigger.onKey"></el-input></div>
                </el-col>
                <el-col :span="12">
                    <div>Period (ms):</div>
                    <div><el-input-number size="small" style="width: 100%;" controls-position="right" :min="1"
                            :disabled="dataBase.ia[editIndex].action[popoverIndex].trigger.type != 'periodic' || periodTimer[popoverIndex]"
                            placeholder="10"
                            v-model="dataBase.ia[editIndex].action[popoverIndex].trigger.period"></el-input-number>
                    </div>

                </el-col>


            </el-row>
        </el-popover>
        <el-dialog v-if="connectV" v-model="connectV" title="IA Device Connect" width="590" align-center
            :append-to="`#win${editIndex}_ia`">
            <div
                style="text-align: center;padding-top:10px;padding-bottom: 10px;width:570px;height:250px; overflow: auto;">

                <el-transfer class="canit" style="text-align: left; display: inline-block;"
                    v-model="dataBase.ia[editIndex].devices" :data="allDeviceLabel" :titles="['Valid', 'Assigned ']" />
            </div>
        </el-dialog>
        <el-dialog v-if="editV && formData" v-model="editV"
            :title="`Edit Frame ${dataBase.ia[editIndex].action[popoverIndex].name}`" width="90%" align-center
            :append-to="`#win${editIndex}_ia`">
            <div :style="{
                padding: '10px',
                height: fh,
                overflowY: 'auto',
            }">

                <el-form :model="formData" label-width="80" size="small" class="formH"
                    :disabled="periodTimer[popoverIndex] == true">
                    <el-form-item label="Name">
                        <el-input v-model="formData.name" :disabled="formData.database != undefined" />
                    </el-form-item>
                    <el-form-item label="ID">
                        <el-input v-model="formData.id" @input="idChange" />
                    </el-form-item>
                    <el-form-item label="Channel">
                        <el-select v-model="formData.channel" size="small" style="width: 100%;" clearable>
                            <el-option v-for="item, key in devices" :value="key" :key="key"
                                :label="item.name"></el-option>


                        </el-select>
                    </el-form-item>
                    <el-form-item label="Type">
                        <el-select v-model="formData.type" size="small" style="width: 100%;">
                            <el-option v-for="l, v in typeMap" :value="v" :label="l" :key="v"></el-option>

                        </el-select>
                    </el-form-item>
                    <el-form-item label-width="0">
                        <el-col :span="12">
                            <el-form-item label="Remote">
                                <el-checkbox v-model="formData.remote" />
                            </el-form-item>
                        </el-col>
                        <el-col :span="12">
                            <el-form-item label="BRS">
                                <el-checkbox v-model="formData.brs" :disabled="!formData.type.includes('fd')" />
                            </el-form-item>
                        </el-col>
                    </el-form-item>
                    <el-form-item label="DLC">
                        <el-select v-model="formData.dlc" size="small" style="width: 100%;">
                            <el-option v-for="i in 16" :value="i - 1" :key="i"></el-option>
                        </el-select>
                    </el-form-item>





                </el-form>
                <el-tabs v-model="activeName">
                    <el-tab-pane label="Signal" name="signal" v-if="formData.database">
                        <CanISignal :message-id="formData.id" :database="formData.database"
                            @change="handleDataChange" />
                    </el-tab-pane>
                    <el-tab-pane label="Raw Data" name="raw">
                        <div style="margin-left: 10px;"> <el-input class="dataI" v-for="index in dlcToLen" :key="index"
                                v-model="formData.data[index - 1]" :maxlength="2" placeholder="00"
                                style="width: 65px;margin-right: 5px;margin-bottom: 5px"
                                @input="dataChange(index - 1, $event)" @change="dataChangeDone"><template #prepend>{{
                                    index - 1
                                    }}</template></el-input>
                        </div>
                    </el-tab-pane>


                </el-tabs>
            </div>


        </el-dialog>
        <Transition name="bounce">
            <div v-if="animate" class="key-box">
                <span class="key-text">{{ pressedKey }}</span>
            </div>
        </Transition>
        <el-dialog v-model="selectFrameVisible" title="Select Frame from Database" :append-to="`#win${editIndex}_ia`"
            width="600" align-center>
            <Signal :height="h * 2 / 3" :width="480" protocol-filter="can" selectable-level="frame"
                :speical-db="speicalDb" @add-frame="handleFrameSelect" />
        </el-dialog>
    </div>
</template>
<script lang="ts" setup>
import { ArrowDown } from '@element-plus/icons-vue'
import { ref, onMounted, onUnmounted, computed, toRef, nextTick, watch } from 'vue'
import { CAN_ID_TYPE, CanBaseInfo, CanDevice, CanInterAction, CanMsgType, getDlcByLen } from 'nodeCan/can';
import { VxeGridProps } from 'vxe-table'
import { VxeGrid } from 'vxe-table'
import { Icon } from '@iconify/vue'
import CanISignal from './canisignale.vue'
import circlePlusFilled from '@iconify/icons-material-symbols/scan-delete-outline'
import infoIcon from '@iconify/icons-material-symbols/info-outline'
import errorIcon from '@iconify/icons-material-symbols/chat-error-outline-sharp'
import warnIcon from '@iconify/icons-material-symbols/warning-outline-rounded'
import saveIcon from '@iconify/icons-material-symbols/save'
import fileOpenOutline from '@iconify/icons-material-symbols/file-open-outline';
import linkIcon from '@iconify/icons-material-symbols/add-link';
import sendIcon from '@iconify/icons-material-symbols/send';
import stopIcon from '@iconify/icons-material-symbols/stop';
import deleteIcon from '@iconify/icons-material-symbols/delete';
import editIcon from '@iconify/icons-material-symbols/edit-square-outline';
import { ServiceItem, Sequence, getTxPduStr, getTxPdu } from 'nodeCan/uds';
import { useDataStore } from '@r/stores/data';
import { cloneDeep, isEqual } from 'lodash';
import { onKeyStroke, onKeyUp } from '@vueuse/core';
import Signal from './components/signal.vue'
import databaseIcon from '@iconify/icons-material-symbols/database'
import { GraphBindFrameValue, GraphNode } from 'src/preload/data';
import { Message } from '@r/database/dbc/dbcVisitor';
import { writeMessageData } from '@r/database/dbc/calc';

const xGrid = ref()
// const logData = ref<LogData[]>([])
const typeMap = {
    'can': 'CAN',
    'canfd': 'CAN FD',
    'ecan': 'Extended CAN',
    'ecanfd': 'Extended CAN FD'
}
const activeName = ref('signal')
const connectV = ref(false)
const editV = ref(false)
const buttonRef = ref({})
const popoverIndex = ref(-1)
const ppRef = computed(() => buttonRef.value[popoverIndex.value])
const globalStart = toRef(window, 'globalStart')
const periodTimer = ref<Record<number, boolean>>({})
const selectFrameVisible = ref(false)
const speicalDb = computed(() => {
    //connected device db
    const list: string[] = []
    for (const d of dataBase.ia[editIndex.value].devices) {
        const db = dataBase.devices[d].canDevice?.database
        if (db) {
            list.push(db)
        }
    }
    return list
})

function addFrame() {
    const channel = Object.keys(devices.value)[0] || ''
    dataBase.ia[editIndex.value].action.push({
        trigger: {
            type: 'manual',
        },
        name: '',
        id: '1',
        channel: channel,
        type: 'can',
        dlc: 8,
        data: []
    })
}
watch(globalStart, (v) => {
    if (v == false) {
        periodTimer.value = {}
    }
})
function getLenByDlc(dlc: number, canFd: boolean) {
    const map: Record<number, number> = {
        0: 0,
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5,
        6: 6,
        7: 7,
        8: 8,
        9: 8,
        10: 8,
        11: 8,
        12: 8,
        13: 8,
        14: 8,
        15: 8
    }
    const mapFd: Record<number, number> = {
        0: 0,
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5,
        6: 6,
        7: 7,
        8: 8,
        9: 12,
        10: 16,
        11: 20,
        12: 24,
        13: 32,
        14: 48,
        15: 64
    }
    if (canFd) {
        return mapFd[dlc] || 0
    } else {
        return map[dlc] || 0
    }
}
const dlcToLen = computed(() => {
    if (formData.value == undefined) {
        return 0
    }
    const fd = formData.value.type.includes('fd')
    const dlc = formData.value.dlc
    return getLenByDlc(dlc, fd)
})
function ceilClick(val: any) {
    popoverIndex.value = val.rowIndex
}
function idChange(v: string) {
    //if last char is not hex, remove it
    if (v.length > 0) {
        if (v[v.length - 1].match(/[0-9a-fA-F]/) == null) {
            dataBase.ia[editIndex.value].action[popoverIndex.value].id = v.slice(0, -1)
        }
    }
}
function dataChangeDone() {
    if (formData.value && formData.value.database) {
        const db = Object.values(dataBase.database.can).find(db => db.name == formData.value!.database)
        if (db) {
            const message = db.messages[parseInt(formData.value.id, 16)]
            if (message) {
                const data = Buffer.from(formData.value.data.map(v => parseInt(v, 16)))
                writeMessageData(message, data, db)
            }
        }
    }
}
function dataChange(index: number, v: string) {
    if (v.length > 0 && formData.value) {
        if (v[v.length - 1].match(/[0-9a-fA-F]/) == null) {
            formData.value.data[index] = v.slice(0, -1)
        }

    }
}
function handleDataChange(data: Buffer) {
    if (formData.value) {
        for (let i = 0; i < data.length; i++) {
            formData.value.data[i] = data[i].toString(16)
        }
    }
}

function deleteFrame() {
    if (popoverIndex.value >= 0) {
        dataBase.ia[editIndex.value].action.splice(popoverIndex.value, 1)
        popoverIndex.value = -1
        xGrid.value?.clearCurrentRow()
    }
}
const pressedKey = ref('')
const animate = ref(false)
onKeyStroke(true, (e) => {
    // e.preventDefault()
    if (globalStart.value) {

        const key = e.key
        pressedKey.value = key.toLocaleUpperCase()
        for (const [index, v] of dataBase.ia[editIndex.value].action.entries()) {

            if (v.trigger.type == 'manual' && v.trigger.onKey && v.trigger.onKey.toLocaleLowerCase() == key) {
                animate.value = true
                sendFrame(index)
            }
        }

    }
})
onKeyUp(true, () => {
    setTimeout(() => {
        animate.value = false
    }, 200);

})
function sendFrame(index: number) {
    const frame = dataBase.ia[editIndex.value]?.action[index]
    if (frame) {
        if (frame.trigger.type == 'manual') {
            window.electron.ipcRenderer.send('ipc-send-can', cloneDeep(frame))
        } else {
            if (periodTimer.value[index] == true) {
                periodTimer.value[index] = false
                window.electron.ipcRenderer.send('ipc-stop-can-period', `${editIndex.value}-${index}`)
            } else {
                periodTimer.value[index] = true
                window.electron.ipcRenderer.send('ipc-send-can-period', `${editIndex.value}-${index}`, cloneDeep(frame))
            }

        }

    }

}

const devices = computed(() => {
    const dd: Record<string, CanBaseInfo> = {}
    for (const d in dataBase.devices) {
        if (dataBase.devices[d] && dataBase.devices[d].type == 'can' && dataBase.devices[d].canDevice) {
            dd[d] = dataBase.devices[d].canDevice


        }

    }
    return dd
})
interface Option {
    key: string
    label: string
    disabled: boolean
}
const allDeviceLabel = computed(() => {
    const dd: Option[] = []
    for (const d of Object.keys(devices.value)) {
        dd.push({ key: d, label: devices.value[d].name, disabled: false })
    }
    return dd
})

function editConnect() {
    connectV.value = true
}
const formData = ref<CanInterAction>()
function editFrame() {
    formData.value = cloneDeep(dataBase.ia[editIndex.value].action[popoverIndex.value])
    if (formData.value?.database == undefined) {
        activeName.value = "raw"
    }
    nextTick(() => {
        editV.value = true
    })
}
function openPr(index: number) {
    if (index != popoverIndex.value) {
        popoverIndex.value = index
        nextTick(() => {
            buttonRef.value[index]?.ref.click()
        })

    }

}
const props = defineProps<{
    height: number
    editIndex: string

}>()
// const start = toRef(props, 'start')
const h = toRef(props, 'height')
watch(formData, (v) => {
    v=cloneDeep(v)
    if (v && popoverIndex.value != -1) {
        if (!isEqual(dataBase.ia[editIndex.value].action[popoverIndex.value], v)) {
            Object.assign(dataBase.ia[editIndex.value].action[popoverIndex.value], v)
            if (window.globalStart.value) {
                window.electron.ipcRenderer.send('ipc-update-can-period', `${editIndex.value}-${popoverIndex.value}`, v)
            }
        }

    }
}, {
    deep: true
})
const editIndex = toRef(props, 'editIndex')
const dataBase = useDataStore()
const gridOptions = computed(() => {
    const v: VxeGridProps<CanInterAction> = {
        border: true,
        size: "mini",
        columnConfig: {
            resizable: true,
        },
        height: props.height,
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
            beforeEditMethod({ rowIndex, column, row }) {
                if (periodTimer.value[rowIndex] == true) {
                    return false
                }
                if (column.field == 'name' && row.database != undefined) {
                    return false
                }
                return true
            }
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
            { field: 'send', title: 'Send', width: 100, resizable: false, slots: { default: 'default_send' } },
            { field: 'trigger', title: 'Trigger', width: 150, resizable: false, slots: { default: 'default_trigger' } },
            { field: 'name', title: 'Name', width: 100, editRender: {}, slots: { edit: 'default_name' } },
            { field: 'id', title: 'ID (HEX)', minWidth: 100, editRender: {}, slots: { edit: 'default_id' } },
            { field: 'channel', title: 'Channel', minWidth: 100, editRender: {}, slots: { default: 'default_channel', edit: 'edit_channel' } },
            { field: 'type', title: 'Type', width: 100, editRender: {}, slots: { default: 'default_type1', edit: 'default_type' } },
            { field: 'dlc', title: 'DLC', width: 100, editRender: {}, slots: { edit: 'default_dlc' } },

        ],
        data: dataBase.ia[props.editIndex]?.action || []

    }
    return v
})



const fh = computed(() => Math.ceil(h.value * 2 / 3) + 'px')

onMounted(async () => {
    // Get initial period status
    const periods = await window.electron.ipcRenderer.invoke('ipc-get-can-period')
    for (const [key, period] of Object.entries(periods)) {
        const a = key.split('-')
        const item = a.slice(0, -1).join('-')
        const index = Number(a[a.length - 1])

        if (item === editIndex.value) {
            periodTimer.value[index] = true
        }
    }
})

function handleFrameSelect(frame: GraphNode<GraphBindFrameValue>) {
    if (frame.bindValue.frameInfo) {

        const channel = Object.keys(devices.value)[0] || ''
        const frameInfo = frame.bindValue.frameInfo as Message
        let type: "can" | "canfd" | "ecan" | "ecanfd" = 'can'
        if (frameInfo.canfd) {
            if (frameInfo.extId) {
                type = 'ecanfd'
            } else {
                type = 'canfd'
            }
        } else {
            if (frameInfo.extId) {
                type = 'ecan'
            }
        }
        // 创建新的 frame action
        dataBase.ia[editIndex.value].action.push({
            trigger: {
                type: 'manual',
            },
            database: frame.bindValue.dbName,
            name: frameInfo.name,
            id: frameInfo.id.toString(16), // 转换为16进制字符串
            channel: channel,
            type: type,
            dlc: frameInfo.length,
            data: new Array(frameInfo.length).fill('00') // 初始化数据为全0
        })
    }
    selectFrameVisible.value = false
}

function openFrameSelect() {
    selectFrameVisible.value = true
}

</script>
<style lang="scss">
.canit {
    --el-transfer-panel-body-height: 200px
}

.dataI {
    .el-input-group__prepend {
        padding: 0 5px !important;
    }
}
</style>
<style scoped>
.key-box {
    position: absolute;
    bottom: 20px;
    right: 20px;
    background-color: white;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    border-radius: 0.5rem;
    padding: 2rem;
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.key-text {
    font-size: 2.25rem;
    font-weight: bold;
    color: #1f2937;
}

.hint-text {
    color: #6b7280;
}

/* 动画效果 */
.bounce-enter-active {
    animation: bounce-in 0.2s;
}

.bounce-leave-active {
    animation: bounce-in 0.2s reverse;
}

@keyframes bounce-in {
    0% {
        transform: scale(0.3);
        opacity: 0;
    }

    50% {
        transform: scale(1.1);
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}
</style>
