<template>
    <div v-loading="loading">
        <el-tabs class="dbcTabs" type="card" v-model="editableTabsValue" addable v-if="!loading">
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

                    <el-button type="danger"  link  @click="handleTabSwitch('Overview')" :disabled="globalStart">
                        <Icon :icon="saveIcon" />
                    </el-button>

                </el-tooltip>


            </template>
            <el-tab-pane name="Overview" label="Overview">
                <Overview v-model="dbcObj" ref="overfiewRef" :edit-index="props.editIndex" :height="h" :width="w" />

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
        </el-tabs>
    </div>
</template>

<script setup lang="ts">

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, toRef, inject, provide, Ref } from "vue";
import Overview from './overfiew.vue'
import dbcParse from '../dbcParse'
import saveIcon from '@iconify/icons-material-symbols/save'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import { Icon } from '@iconify/vue'
import { Layout } from "@r/views/uds/layout";
import { useDataStore } from "@r/stores/data";
import { ElMessage, ElMessageBox, ElNotification } from "element-plus";
import { assign, cloneDeep } from "lodash";
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { DBC } from "./dbcVisitor";



const layout = inject('layout') as Layout

const props = defineProps<{
    dbcFile?: string
    editIndex: string
    height: number
    width: number
}>()

const overfiewRef = ref()

const h = toRef(props, 'height')
const w = toRef(props, 'width')
const editableTabsValue = ref('Overview')
provide('height', h)
const database = useDataStore()

const dbcObj = ref<DBC>() as Ref<DBC>

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

async function valid() {
    const list: Promise<void>[] = []

    list.push(overfiewRef.value.validate())
  
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
            delete database.database.can[props.editIndex]
        })
        layout.removeWin(props.editIndex,true)
    }).catch(null)
}
function saveDataBase() {
    // Check for duplicate database name
    const isDuplicateName = Object.entries(database.database.can)
        .some(([key, db]) => {
            // Skip comparing with itself
            if (key === props.editIndex) return false;
            return db.name === dbcObj.value.name;
        });

    if (isDuplicateName) {
        ElNotification({
            offset: 50,
            type: 'error',
            message: `Database name "${dbcObj.value.name}" already exists`,
            appendTo: `#win${props.editIndex}`
        });
        return;
    }

    valid().then(() => {
        database.$patch(() => {
            database.database.can[props.editIndex] = cloneDeep(dbcObj.value)
        });
        layout.changeWinName(props.editIndex, dbcObj.value.name);
        layout.setWinModified(props.editIndex, false);

        ElNotification({
            offset: 50,
            type: 'success',
            message: "The database has been saved successfully",
            appendTo: `#win${props.editIndex}`
        });
    }).catch(null);
}
function handleTabSwitch(tabName: string) {
    editableTabsValue.value = tabName
}

let timeout
watch(dbcObj, (val) => {
    layout.setWinModified(props.editIndex, true)
    clearTimeout(timeout)
    timeout=setTimeout(() => {
        valid().catch(null)
    }, 500);
}, { deep: true })

const loading=ref(true)

onMounted(() => {
    // Add your onMounted logic here
    if (!existed.value&&props.dbcFile) {
        loading.value=true
        window.electron.ipcRenderer.invoke('ipc-fs-readFile', props.dbcFile).then((content: string) => {
           
            try{
                const result = dbcParse(content)
                dbcObj.value = result
                dbcObj.value.name=window.path.parse(props.dbcFile!).name
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
        dbcObj.value=cloneDeep(database.database.can[props.editIndex])
        loading.value=false
        nextTick(() => {
            layout.setWinModified(props.editIndex, false)
        })
    }
    
});


</script>

<style lang="scss">
.dbcTabs {
   
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