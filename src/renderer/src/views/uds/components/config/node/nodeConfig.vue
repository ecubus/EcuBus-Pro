<template>
    <div style="display: relative">
        <el-tabs v-model="activeName" style="width: 600px;">
            <el-tab-pane label="General" name="general">
                <div style="height: 270px;width: 570px;overflow-y: auto;">
                    <el-form ref="ruleFormRef" :model="data" label-width="100px" :rules="rules" size="small"
                        :disabled="globalStart" hide-required-asterisk>
                        <el-form-item label="Node Name" prop="name">
                            <el-input v-model="data.name" placeholder="Name" />
                        </el-form-item>
                        <el-form-item label="Attach Tester" prop="attachTester">
                            <el-select v-model="data.attachTester" placeholder="Tester">
                                <el-option v-for="item in testers" :key="item.id" :label="item.name" :value="item.id">
                                </el-option>
                            </el-select>
                        </el-form-item>
                        <el-form-item label="Node Script File" prop="script">
                            <el-input v-model="data.script" clearable>

                            </el-input>
                            <div class="lr">



                                <el-button-group style="margin-top: 5px;" v-loading="buildLoading">
                                    <el-button size="small" plain @click="editScript('open')" :disabled="globalStart">
                                        <Icon :icon="newIcon" class="icon" style="margin-right: 5px" /> Choose
                                    </el-button>




                                    <el-button size="small" plain @click="editScript('build')" :disabled="globalStart">
                                        <Icon :icon="buildIcon" class="icon" style="margin-right: 5px" /> Build
                                    </el-button>

                                    <!-- <el-button size="small" plain @click="editScript('refresh')">
              <Icon :icon="refreshIcon" class="icon" style="margin-right: 5px" /> Refresh

            </el-button> -->
                                    <el-button size="small" plain @click="editScript('edit')" :disabled="globalStart">
                                        <Icon :icon="refreshIcon" class="icon" style="margin-right: 5px" /> Refresh /
                                        Edit

                                    </el-button>



                                </el-button-group>
                                <el-divider direction="vertical" style="height:24px;margin-top:5px;"
                                    v-if="buildStatus" />
                                <span v-if="buildStatus == 'danger'" style="color: var(--el-color-danger);"
                                    class="buildStatus">
                                    <Icon :icon="dangerIcon" />Build Failed
                                </span>
                                <span v-else-if="buildStatus == 'success'" style="color: var(--el-color-success);"
                                    class="buildStatus">
                                    <Icon :icon="successIcon" />Build Success
                                </span>
                                <span v-else-if="buildStatus == 'warning'" style="color: var(--el-color-warning);"
                                    class="buildStatus">
                                    <Icon :icon="buildIcon" />Need Rebuild
                                </span>
                                <span v-else-if="buildStatus == 'info'" style="color: var(--el-color-info);"
                                    class="buildStatus">
                                    <Icon :icon="buildIcon" />Need Build
                                </span>
                                <el-button v-if="buildStatus" link style="margin-top: 5px;" :type="buildStatus">
                                    <Icon :icon="refreshIcon" @click="refreshBuildStatus" class="icon"
                                        style="margin-right: 5px" />
                                </el-button>

                            </div>


                            <!-- stop -->



                        </el-form-item>
                        <el-form-item label="Node Active" prop="disabled">
                            <el-switch v-model="data.disabled" disabled active-text="Disabled"
                                inactive-text="Enabled" />
                        </el-form-item>

                    </el-form>

                </div>
            </el-tab-pane>

            <el-tab-pane label="Connected" name="Connected">
                <div
                    style="text-align: center;padding-top:10px;padding-bottom: 10px;width:570px;height:250px; overflow: auto;">

                    <el-transfer class="canit" style="text-align: left; display: inline-block;"
                        v-model="dataBase.nodes[editIndex].channel" :data="allDeviceLabel"
                        :titles="['Valid', 'Assigned ']" @leftCheckChange="handleLeftCheckChange" />
                </div>
            </el-tab-pane>
            <el-tab-pane label="Database" name="Database" v-if="data.type == 'lin'">
                <div style="height: 270px;width: 570px;overflow-y: auto;">
                    <el-form :model="data" label-width="100px" size="small" :disabled="globalStart || dbName == undefined">
                        <el-form-item label="Database" prop="database">

                            <el-select v-model="dbName" placeholder="No Database" disabled>
                                <el-option v-for="item in db" :key="item.value" :label="`Lin.${item.label}`"
                                    :value="item.value">
                                </el-option>
                            </el-select>
                        </el-form-item>
                        <el-form-item label="Net Node" prop="workNode" v-if="dbName">
                            <el-select v-model="data.workNode" placeholder="Node Name" clearable>
                                <el-option v-for="item in nodesName" :key="item.value" :label="item.label"
                                    :value="item.value">
                                </el-option>
                            </el-select>
                        </el-form-item>
                        <el-alert v-else title="Choose database in connected device" type="info" :closable="false" />
                    </el-form>
                </div>
            </el-tab-pane>
        </el-tabs>



    </div>
</template>
<script lang="ts" setup>
import { ArrowDown } from '@element-plus/icons-vue'
import { ref, onMounted, onUnmounted, computed, toRef, nextTick, watch, watchEffect } from 'vue'
import { CAN_ID_TYPE, CanBaseInfo, CanDevice, CanInterAction, CanMsgType, getDlcByLen } from 'nodeCan/can';
import { useDataStore } from '@r/stores/data';
import buildIcon from '@iconify/icons-material-symbols/build-circle-outline-sharp'
import successIcon from '@iconify/icons-material-symbols/check-circle-outline'
import refreshIcon from '@iconify/icons-material-symbols/refresh'
import dangerIcon from '@iconify/icons-material-symbols/dangerous-outline-rounded'
import newIcon from '@iconify/icons-material-symbols/new-window'
import { Icon } from '@iconify/vue'
import { useProjectStore } from '@r/stores/project';
import { ElMessageBox, FormRules, TransferKey } from 'element-plus';
import { cloneDeep } from 'lodash';
import { TesterInfo } from 'nodeCan/tester';

const activeName = ref('general')
const props = defineProps<{
    editIndex: string
    type: string

}>()
const globalStart = toRef(window, 'globalStart')
const editIndex = toRef(props, 'editIndex')
const dataBase = useDataStore()
const buildStatus = ref<string | undefined>()
const data = toRef(dataBase.nodes, editIndex.value)
const nameCheck = (rule: any, value: any, callback: any) => {
    if (value) {
        for (const key of Object.keys(dataBase.nodes)) {
            const hasName = dataBase.nodes[key].name;
            if (hasName == value && key != editIndex.value) {
                callback(new Error("The node name already exists"));
            }
        }
        callback();
    } else {
        callback(new Error("Please input node name"));
    }
};


const handleLeftCheckChange = (value: TransferKey[], movedKeys?: TransferKey[]) => {

    if (value.length > 1) {
        value.splice(0, 1)
    }
}
const rules: FormRules = {
    "name": [
        {
            required: true,
            trigger: "blur",
            validator: nameCheck,
        },
    ],
}
const testers = computed(
    () => {
        const testerList: TesterInfo[] = []
        for (const key of Object.keys(dataBase.tester)) {
            if (props.type == dataBase.tester[key].type) {
                testerList.push(dataBase.tester[key])
            }
        }
        return testerList
    }


)
const buildLoading = ref(false)
function editScript(action: 'open' | 'edit' | 'build' | 'refresh') {
    if (action == 'edit' || action == 'build') {
        if (data.value.script) {

            if (project.projectInfo.path) {
                if (action == 'edit') {
                    window.electron.ipcRenderer.invoke('ipc-create-project', project.projectInfo.path, project.projectInfo.name, cloneDeep(dataBase.getData())).catch((e: any) => {
                        ElMessageBox.alert(e.message, 'Error', {
                            confirmButtonText: 'OK',
                            type: 'error',
                            buttonSize: 'small',
                            appendTo: '#tester'
                        })
                    })
                } else {
                    buildStatus.value = ''
                    buildLoading.value = true
                    window.electron.ipcRenderer.invoke('ipc-build-project', project.projectInfo.path, project.projectInfo.name, cloneDeep(dataBase.getData()), data.value.script)
                        .then((val) => {
                            if (val.length > 0) {

                                buildStatus.value = 'danger'
                            } else {
                                buildStatus.value = 'success'
                                // ElMessage({
                                //   message: 'Build Success',
                                //   appendTo: '#tester',
                                //   type: 'success',
                                //   offset: 35,
                                //   duration: 2000
                                // })
                            }
                        })
                        .catch((e: any) => {
                            ElMessageBox.alert(e.message, 'Error', {
                                confirmButtonText: 'OK',
                                type: 'error',
                                buttonSize: 'small',
                                appendTo: '#tester'
                            })
                        }).finally(() => {
                            buildLoading.value = false
                        })
                }


            } else {
                ElMessageBox.alert('Please save the project first', 'Warning', {
                    confirmButtonText: 'OK',
                    type: 'warning',
                    buttonSize: 'small',
                    appendTo: '#tester'
                })
            }
        } else {
            ElMessageBox.alert('Please select the script file first', 'Warning', {
                confirmButtonText: 'OK',
                type: 'warning',
                buttonSize: 'small',
                appendTo: '#tester'
            })
        }
    }
    else {
        openTs()
    }

}
async function openTs() {
    const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
        defaultPath: project.projectInfo.path,
        title: 'Script File', properties: ['openFile'], filters: [
            { name: 'typescript', extensions: ['ts'] },
            { name: 'All Files', extensions: ['*'] }
        ]

    })
    const file = r.filePaths[0]
    if (file) {
        if (project.projectInfo.path)
            data.value.script = window.path.relative(project.projectInfo.path, file)
        else
            data.value.script = file
    }
    return file

}
const project = useProjectStore()

function refreshBuildStatus() {
    if (data.value.script) {
        window.electron.ipcRenderer.invoke('ipc-get-build-status', project.projectInfo.path, project.projectInfo.name, data.value.script).then((val) => {
            buildStatus.value = val
        })
    }
}


const db = computed(() => {
    const list: {
        label: string,
        value: string
    }[] = []
    if (props.type == 'lin') {
        for (const key of Object.keys(dataBase.database.lin)) {

            list.push({ label: dataBase.database.lin[key].name, value: key })

        }
    }
    return list
})

const dbName = ref('')
const getUsedDb = () => {
    const device = data.value.channel[0]
    if (device && dataBase.devices[device] && dataBase.devices[device].type == 'lin' && dataBase.devices[device].linDevice && dataBase.devices[device].linDevice.database) {
        dbName.value = dataBase.devices[device].linDevice.database
    } else {
        dbName.value = ''
        data.value.workNode = ''
    }
}
watchEffect(() => {
    getUsedDb()
})


const nodesName = computed(() => {
    const list: {
        label: string,
        value: string
    }[] = []
    if (dbName.value && props.type == 'lin' && data.value.type == 'lin') {

        const device = data.value.channel[0]

        const db = dataBase.database.lin[dbName.value]

        if (dataBase.devices[device].linDevice?.mode == 'MASTER') {
            list.push({
                label: `${db.node.master.nodeName} (Master)`,
                value: db.node.master.nodeName
            })

        } 
        for (const n of db.node.salveNode) {
            list.push({
                label: `${n} (Slave)`,
                value: n
            })
        }


    }
    return list
})

interface Option {
    key: string
    label: string
    disabled: boolean
}
const allDeviceLabel = computed(() => {
    const dd: Option[] = []
    for (const d of Object.keys(allDevices.value)) {
        const deviceDisabled = (data.value.channel.length >= maxDeviceNum.value) && (data.value.channel.indexOf(d) == -1)
        dd.push({ key: d, label: allDevices.value[d].name, disabled: globalStart.value || (deviceDisabled) })
    }
    return dd
})
const allDevices = computed(() => {
    const dd: Record<string, {
        name: string
    }> = {}
    for (const d in dataBase.devices) {
        if (dataBase.devices[d].type == 'can' && dataBase.devices[d].canDevice) {
            dd[d] = dataBase.devices[d].canDevice
        }
        else if (dataBase.devices[d].type == 'eth' && dataBase.devices[d].ethDevice) {
            dd[d] = dataBase.devices[d].ethDevice
        }
        else if (dataBase.devices[d].type == 'lin' && dataBase.devices[d].linDevice) {
            dd[d] = dataBase.devices[d].linDevice
        }
    }
    return dd
})





const maxDeviceNum = computed(() => {
    if (props.type == 'lin') {
        return 1
    }
    return Infinity
})
// const start = toRef(props, 'start')
// const h = toRef(props, 'height')







// const fh = computed(() => Math.ceil(h.value * 2 / 3) + 'px')

onMounted(() => {
    refreshBuildStatus()
})


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
.lr {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
}

.buildStatus {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
    margin-top: 5px;
}
</style>