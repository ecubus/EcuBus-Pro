<template>
    <div>
        <el-tabs class="ldfTabs" type="card" v-model="editableTabsValue" addable v-if="!loading">
            <template #add-icon>
                <el-tooltip  effect="light" content="Delete Database" placement="bottom"
                    >
                    <el-button type="info"  link @click="deleteDatabase">
                        <Icon :icon="deleteIcon" />
                    </el-button>
                </el-tooltip>
                <el-tooltip v-if="errorList.length == 0" effect="light" content="Save Database" placement="bottom"
                    >
                    <el-button type="success"  link @click="saveDataBase">
                        <Icon :icon="saveIcon" :disabled="globalStart"/>
                    </el-button>
                </el-tooltip>
                <el-tooltip v-else effect="light" content="Fix errors to save the database" placement="bottom"
                    >

                    <el-button type="danger"  link  @click="handleTabSwitch('General')" :disabled="globalStart">
                        <Icon :icon="saveIcon" />
                    </el-button>

                </el-tooltip>


            </template>
            <el-tab-pane name="General" label="General">
                <General v-model="ldfObj" ref="generateRef" :edit-index="props.editIndex" />

                <!-- Add error section -->
                <template v-if="errorList.length != 0">
                    <div class="error-section">
                        <el-divider />

                        <VxeGrid v-if="errorList.length > 0" ref="errorGrid" v-bind="errorGridOptions">
                            <template #message="{ row }">
                                <span class="error-type">{{ row.message }}</span>
                            </template>
                            <template #tab="{ row }">
                                <el-button link type="danger" size="small" @click="handleTabSwitch(row.tab)">{{ row.tab
                                    }}</el-button>
                            </template>
                        </VxeGrid>
                    </div>
                </template>
            </el-tab-pane>
            <el-tab-pane name="Nodes" label="Nodes">
                <Node v-model="ldfObj" ref="nodeRef" :edit-index="props.editIndex" />
            </el-tab-pane>
            <el-tab-pane name="Signals" label="Signals">
                <Signal v-model="ldfObj" ref="SignalRef" :edit-index="props.editIndex" />
            </el-tab-pane>
            <el-tab-pane name="Frames" label="Frames">
                <Frame v-model="ldfObj" ref="FrameRef" :edit-index="props.editIndex" />
            </el-tab-pane>
            <el-tab-pane name="Schedule Tables" label="Schedule Tables">
                <Sch v-model="ldfObj" ref="SchRef" :edit-index="props.editIndex" />
            </el-tab-pane>
            <el-tab-pane name="Encodings" label="Encodings">
                <Encode v-model="ldfObj" ref="EncodeRef" :edit-index="props.editIndex" />
            </el-tab-pane>
            <el-tab-pane name="LDF File" label="LDF File">
                <File :ldf-obj="ldfObj" :edit-index="props.editIndex" />
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup lang="ts">

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, toRef, inject, provide, Ref } from "vue";
import General from './general.vue'
import Node from "./node.vue";
import Signal from "./signal.vue";
import ldfParse, { LDF } from "../ldfParse";
import saveIcon from '@iconify/icons-material-symbols/save'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import { Icon } from '@iconify/vue'
import { Layout } from "@r/views/uds/layout";
import { useDataStore } from "@r/stores/data";
import { ElMessage, ElMessageBox, ElNotification } from "element-plus";
import { assign, cloneDeep } from "lodash";
import Frame from "./frame.vue";
import Sch from "./sch.vue";
import Encode from "./encode.vue";
import { VxeGrid, VxeGridProps } from 'vxe-table'
import File from "./file.vue";


const layout = inject('layout') as Layout

const props = defineProps<{
    ldfFile?: string
    editIndex: string
    height: number
}>()

const generateRef = ref()
const nodeRef = ref()
const h = toRef(props, 'height')
const editableTabsValue = ref('General')
provide('height', h)
const database = useDataStore()

const ldfObj = ref<LDF>() as Ref<LDF>

const globalStart=computed(()=>window.globalStart)

const existed = computed(() => {
    let existed = false
    if (database.database && database.database.lin) {
        existed = database.database.lin[props.editIndex] ? true : false
    }
    return existed
})

interface ValidateError {
    message?: string;
    field?: string;
}

type ValidateFieldsError = Record<string, ValidateError[]>;
interface ErrorItem {
    tab: string
    message?: string
    field?: string
}

const errorList = ref<ErrorItem[]>([])



const errorGridOptions = computed<VxeGridProps>(() => ({
    border: true,
    size: 'mini',
    height: h.value-400,
    showOverflow: true,
    columnConfig: { resizable: true },
    rowConfig: {
        isCurrent: true,
        className: 'error-row'
    },
    columns: [
        {
            field: 'tab',
            title: 'Tab',
            width: 120,
            slots: { default: 'tab' },
        }, {
            field: 'field',
            title: 'Field',
            minWidth: 200,

        },
        {
            field: 'message',
            title: 'Error Message',
            slots: { default: 'message' },
            minWidth: 200
        }
    ],
    data: errorList.value
}))

const SignalRef = ref()
const FrameRef = ref()
const SchRef=ref()
const EncodeRef=ref()
async function valid() {
    const list: Promise<void>[] = []

    list.push(generateRef.value.validate())
    list.push(nodeRef.value.validate())
    list.push(SignalRef.value.validate())
    list.push(FrameRef.value.validate())
    list.push(SchRef.value.validate())
    list.push(EncodeRef.value.validate())
    const result = await Promise.allSettled(list)
    errorList.value = []
    for (const [index, r] of result.entries()) {
      
        if (r.status == 'rejected') {
            const errors = r.reason as {
                tab: string,
                error: {
                    field: string,
                    message: string
                }[]
            }
            


            for (const [field, error] of Object.entries(errors.error)) {
               

                errorList.value.push({
                    tab: errors.tab,
                    message: error.message,
                    field: error.field
                })


            }
        }
    }
    if (errorList.value.length > 0) {
        throw new Error('Invalid')
    }
}


function deleteDatabase(){
    ElMessageBox.confirm('Are you sure you want to delete this database?', 'Warning', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        buttonSize: 'small',
        appendTo: `#win${props.editIndex}`,
        type: 'warning'
    }).then(() => {
        database.$patch(() => {
            delete database.database.lin[props.editIndex]
        })
        layout.removeWin(props.editIndex,true)
    }).catch(null)
}
function saveDataBase() {
    valid().then(() => {
        database.$patch(() => {
            database.database.lin[props.editIndex] = cloneDeep(ldfObj.value)
        })
        layout.changeWinName(props.editIndex, ldfObj.value.name)
        layout.setWinModified(props.editIndex, false)

        ElNotification({
            offset: 50,
            type: 'success',
            message: "The database has been saved successfully",
            appendTo: `#win${props.editIndex}`
        })
    }).catch(null)
}
function handleTabSwitch(tabName: string) {
    editableTabsValue.value = tabName
}

let timeout
watch(ldfObj, (val) => {
    layout.setWinModified(props.editIndex, true)
    clearTimeout(timeout)
    timeout=setTimeout(() => {
        valid().catch(null)
    }, 500);
}, { deep: true })

const loading=ref(true)
onMounted(() => {
    // Add your onMounted logic here
    if (!existed.value) {
        window.electron.ipcRenderer.invoke('ipc-fs-readFile', props.ldfFile).then((content: string) => {
           
            try{
                const result = ldfParse(content)
                ldfObj.value = result
                ldfObj.value.name=window.path.parse(props.ldfFile!).name
                loading.value=false
            }catch(err:any){
                ElMessageBox.alert('Parse failed', 'Error', {
                    confirmButtonText: 'OK',
                    type: 'error',
                    buttonSize: 'small',
                    appendTo: `#win${props.editIndex}`,
                    message: `<pre style="max-height:200px;overflow:auto;width:380px;font-size:12px;line-height:12px">${err.message}</pre>`,
                    dangerouslyUseHTMLString: true,
                }).finally(() => {
                    layout.removeWin(props.editIndex,true)
                })
            }
        }).catch((err) => {
            
            ElMessageBox.alert('Parse failed', 'Error', {
                confirmButtonText: 'OK',
                type: 'error',
                buttonSize: 'small',
                appendTo: `#win${props.editIndex}`,
                message: err.message
            }).then(() => {
                layout.removeWin(props.editIndex,true)
            }).catch(null)
          
        })
   
    }else{
        ldfObj.value=cloneDeep(database.database.lin[props.editIndex])
        loading.value=false
        nextTick(() => {
            layout.setWinModified(props.editIndex, false)
        })
    }
    
});


</script>

<style lang="scss">
.ldfTabs {
    padding-right: 5px;
    margin-right: 5px;

    .el-tabs__header {

        margin-bottom: 0px !important;
    }
    .el-tabs__new-tab{
        width: 60px!important;
        cursor: default !important;
    }

}

.error-section {
    padding: 0 20px;
}

.error-type {
    color: var(--el-color-danger);
    font-weight: bold;
}

:deep(.error-cell) {
    cursor: pointer;
}

:deep(.error-row:hover) {
    background-color: var(--el-color-danger-light-9);
}

:deep(.error-highlight) {
    animation: highlightError 2s ease-in-out;
}

@keyframes highlightError {

    0%,
    100% {
        background-color: transparent;
    }

    50% {
        background-color: var(--el-color-danger-light-8);
    }
}
</style>