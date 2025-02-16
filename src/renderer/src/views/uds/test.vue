<template>
    <div class="main" v-loading="loading">
        <div class="left">
            <el-scrollbar :height="h + 'px'">
                <el-tree ref="treeRef" node-key="id" default-expand-all :data="tData" highlight-current
                    :expand-on-click-node="false" @node-click="nodeClick">
                    <template #default="{ node, data }">
                        <div class="tree-node">
                            <span :class="{
                                isTop: node.level === 1,
                                treeLabel: true
                            }">{{ node.label }}</span>
                            <el-button :disabled="globalStart" link v-if="data.canAdd" type="primary"
                                @click.stop="addNewConfig()">
                                <Icon :icon="circlePlusFilled" />
                            </el-button>
                            <el-button :disabled="globalStart" link v-if="!data.canAdd" type="danger"
                                @click.stop="removeConfig(data.id)">
                                <Icon class="tree-delete" :icon="removeIcon" />
                            </el-button>
                        </div>
                    </template>
                </el-tree>
            </el-scrollbar>
        </div>
        <div class="shift" id="testerServiceShift" />
        <div class="right">
            <el-form v-if="activeConfig" :model="model" label-width="100px" size="small" class="hardware"
                ref="ruleFormRef" :rules="rules" hide-required-asterisk>
                <el-form-item label="Name" prop="name" required>
                    <el-input v-model="model.name" @change="onConfigChange" />
                </el-form-item>
                <el-form-item label="Test Script File" prop="script">
                    <el-input v-model="model.script" clearable />
                    <div class="lr">
                        <el-button-group style="margin-top: 5px;" v-loading="buildLoading">
                            <el-button size="small" plain @click="editScript('open')">
                                <Icon :icon="newIcon" class="icon" style="margin-right: 5px" /> Choose
                            </el-button>
                            <el-button size="small" plain @click="editScript('build')">
                                <Icon :icon="buildIcon" class="icon" style="margin-right: 5px" /> Build
                            </el-button>
                            <el-button size="small" plain @click="editScript('edit')">
                                <Icon :icon="refreshIcon" class="icon" style="margin-right: 5px" /> Refresh / Edit
                            </el-button>
                        </el-button-group>
                        <el-divider direction="vertical" style="height:24px;margin-top:5px;" v-if="buildStatus" />
                        <span v-if="buildStatus == 'danger'" style="color: var(--el-color-danger);" class="buildStatus">
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
                </el-form-item>
            </el-form>

        </div>
    </div>
</template>

<script lang="tsx" setup>
import { ServiceItem, param2raw, getTxPduStr, getRxPduStr, Sequence, paramSetVal, paramSetValRaw } from 'nodeCan/uds'
import { cloneDeep } from 'lodash'
import { v4, validate } from 'uuid'
import { Ref, computed, inject, nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import paramVue from './param.vue'
import closeIcon from '@iconify/icons-material-symbols/close'
import { Icon } from '@iconify/vue'
import { type FormRules, type FormInstance, ElMessageBox, ElMessage } from 'element-plus'
import circlePlusFilled from '@iconify/icons-ep/circle-plus-filled'
import removeIcon from '@iconify/icons-ep/remove'
import loadIcon from '@iconify/icons-material-symbols/upload'
import { ServiceId, serviceDetail } from 'nodeCan/service'
import { useDataStore } from '@r/stores/data'
import { Layout } from '@r/views/uds/layout'
import { TestConfig } from 'src/preload/data'
import buildIcon from '@iconify/icons-material-symbols/build-circle-outline-sharp'
import successIcon from '@iconify/icons-material-symbols/check-circle-outline'
import refreshIcon from '@iconify/icons-material-symbols/refresh'
import newIcon from '@iconify/icons-material-symbols/new-window'
import dangerIcon from '@iconify/icons-material-symbols/dangerous-outline-rounded'
import { useProjectStore } from "@r/stores/project"

const dialogVisible = ref(false)
const loading = ref(false)
const activeService = ref('')
const ruleFormRef = ref<FormInstance>()
const props = defineProps<{
    width: number,
    height: number
}>()
const h = toRef(props, 'height')
const w = toRef(props, 'width')
const leftWidth = ref(300)

const dataBase = useDataStore();

const treeRef = ref()
const ecuList = ref<string[]>([])
const variants = ref<string[]>([])
const odxForm = ref({
    ecuName: '',
    variant: ''
})
const repParamRef = ref()
const respParamRef = ref()
const globalStart = toRef(window, 'globalStart')
const layout = inject('layout') as Layout

const project = useProjectStore()

function nodeClick(data: tree) {
    if (data.type === 'config') {
        activeConfig.value = data.id
        model.value = cloneDeep(dataBase.tests[data.id])
    }
}

interface tree {
    label: string
    canAdd: boolean
    id: string
    type: 'test' | 'config'
    children?: tree[]
}
const tData = ref<tree[]>([])

const model = ref<TestConfig>({
    id: v4(),
    name: 'Test Config',
    script: ''
})

function buildTree() {
    const t: tree = {
        label: 'Test Config',
        canAdd: true,
        id: 'root',
        type: 'test',
        children: []
    }

    // 添加已有的测试配置到树中
    for (const [key, config] of Object.entries(dataBase.tests)) {
        t.children?.push({
            label: config.name,
            canAdd: false,
            id: config.id,
            type: 'config'
        })
    }

    tData.value = [t]
}

// 添加一个生成唯一名称的辅助函数
function generateUniqueName(baseName: string): string {
    let index = 0;
    let name = `${baseName} ${index}`;

    // 检查是否存在同名配置
    while (Object.values(dataBase.tests).some(config => config.name === name)) {
        index++;
        name = `${baseName} ${index}`;
    }

    return name;
}

// 修改 addNewConfig 方法
function addNewConfig() {
    const defaultName = generateUniqueName('Test Config');

    const newConfig: TestConfig = {
        id: v4(),
        name: defaultName,
        script: ''
    }

    // 添加到数据库
    dataBase.tests[newConfig.id] = newConfig

    // 更新树
    tData.value[0].children?.push({
        label: defaultName,
        canAdd: false,
        id: newConfig.id,
        type: 'config'
    })

    // 选中新建的配置
    activeConfig.value = newConfig.id
    model.value = cloneDeep(newConfig)
}

// 删除测试配置
function removeConfig(id: string) {
    ElMessageBox.confirm('Are you sure to delete this config?', 'Warning', {
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        type: 'warning',
        buttonSize: 'small'
    }).then(() => {
        delete dataBase.tests[id]
        const index = tData.value[0].children?.findIndex(item => item.id === id)
        if (index !== undefined && index > -1) {
            tData.value[0].children?.splice(index, 1)
        }
        activeConfig.value = ''
    })
}

// 添加状态变量
const activeConfig = ref('')
const nameCheck = (rule: any, value: any, callback: any) => {
    if (value) {
        // 检查所有测试配置中是否有重名
        for (const [key, config] of Object.entries(dataBase.tests)) {
            if (config.name === value && key !== activeConfig.value) {
                // 恢复为数据库中的名称
                nextTick(() => {
                    model.value.name = dataBase.tests[activeConfig.value].name
                })
                callback(new Error("The test config name already exists"));
                return;
            }
        }
        callback();
    } else {
        callback(new Error("Please input test config name"));
    }
};

const rules = {
    name: [
        { required: true, trigger: "blur", validator: nameCheck }
    ],

}

// 配置改变时的处理方法
function onConfigChange() {
    if (activeConfig.value) {
        // 如果名称为空或重复，恢复数据库中的名称
        if (!model.value.name.trim()) {
            model.value.name = dataBase.tests[activeConfig.value].name
        } else {
            // 检查名称是否重复
            const isDuplicate = Object.entries(dataBase.tests).some(([key, config]) =>
                config.name === model.value.name && key !== activeConfig.value
            )

            if (isDuplicate) {
                model.value.name = dataBase.tests[activeConfig.value].name
            } else {
                dataBase.tests[activeConfig.value] = cloneDeep(model.value)
                // 更新树节点标签
                const node = tData.value[0].children?.find(item => item.id === activeConfig.value)
                if (node) {
                    node.label = model.value.name
                }
            }
        }
    }
}

// 添加新的状态变量
const buildStatus = ref<string | undefined>()
const buildLoading = ref(false)

// 添加编辑脚本相关方法
function refreshBuildStatus() {
    if (model.value.script) {
        window.electron.ipcRenderer.invoke('ipc-get-build-status', project.projectInfo.path, project.projectInfo.name, model.value.script).then((val) => {
            buildStatus.value = val
        })
    }
}

function editScript(action: 'open' | 'edit' | 'build') {
    if (action == 'edit' || action == 'build') {
        if (model.value.script) {
            if (project.projectInfo.path) {
                if (action == 'edit') {
                    window.electron.ipcRenderer.invoke('ipc-create-project', project.projectInfo.path, project.projectInfo.name, cloneDeep(dataBase.getData())).catch((e: any) => {
                        ElMessageBox.alert(e.message, 'Error', {
                            confirmButtonText: 'OK',
                            type: 'error',
                            buttonSize: 'small'
                        })
                    })
                } else {
                    buildStatus.value = ''
                    buildLoading.value = true
                    window.electron.ipcRenderer.invoke('ipc-build-project', project.projectInfo.path, project.projectInfo.name, cloneDeep(dataBase.getData()), model.value.script)
                        .then((val) => {
                            if (val.length > 0) {
                                buildStatus.value = 'danger'
                            } else {
                                buildStatus.value = 'success'
                            }
                        })
                        .catch((e: any) => {
                            ElMessageBox.alert(e.message, 'Error', {
                                confirmButtonText: 'OK',
                                type: 'error',
                                buttonSize: 'small'
                            })
                        }).finally(() => {
                            buildLoading.value = false
                        })
                }
            } else {
                ElMessageBox.alert('Please save the project first', 'Warning', {
                    confirmButtonText: 'OK',
                    type: 'warning',
                    buttonSize: 'small'
                })
            }
        } else {
            ElMessageBox.alert('Please select the script file first', 'Warning', {
                confirmButtonText: 'OK',
                type: 'warning',
                buttonSize: 'small'
            })
        }
    } else {
        openTs()
    }
}

async function openTs() {
    const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
        defaultPath: project.projectInfo.path,
        title: 'Script File',
        properties: ['openFile'],
        filters: [
            { name: 'typescript', extensions: ['ts'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    })
    const file = r.filePaths[0]
    if (file) {
        if (project.projectInfo.path)
            model.value.script = window.path.relative(project.projectInfo.path, file)
        else
            model.value.script = file
    }
    return file
}

onMounted(() => {
    window.jQuery('#testerServiceShift').resizable({
        handles: 'e',
        resize: (e, ui) => {
            leftWidth.value = ui.size.width
        },
        maxWidth: 400,
        minWidth: 200,
    })

    buildTree()
})
</script>
<style>
.serviceTree .el-tree-node__content {
    height: 20px !important;
}
</style>
<style scoped>
.button {
    padding: 10px;
    border: 2px dashed var(--el-border-color);
    border-radius: 5px;
    text-align: center;
    margin: 10px;
}

.button .desc {
    font-size: 16px;
    color: var(--el-color-info);
    padding: 5px;
}

.button:hover {
    cursor: pointer;
    border: 2px dashed var(--el-color-primary-dark-2);
}

.isServiceTop {
    font-weight: bold;
}

.isJob {
    color: var(--el-color-primary-dark-2);
}

.left {
    position: absolute;
    top: 0px;
    left: 0px;
    width: v-bind(leftWidth + 'px');
    z-index: 1;
}

.shift {
    position: absolute;
    top: 0px;
    left: 0px;
    width: v-bind(leftWidth + 1 + 'px');
    height: v-bind(h + 'px');
    z-index: 0;
    border-right: solid 1px var(--el-border-color);
}

.tree-add {
    color: var(--el-color-primary);
}

.tree-add:hover {
    color: var(--el-color-primary-dark-2);
    cursor: pointer;
}

.tree-delete {
    color: var(--el-color-danger);
}

.tree-delete:hover {
    color: var(--el-color-danger-dark-2);
    cursor: pointer;
}

.shift:hover {
    border-right: solid 4px var(--el-color-primary);
}

.shift:active {
    border-right: solid 4px var(--el-color-primary);
}

.hardware {
    margin: 20px;
}

.tree-node {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    padding-right: 5px;
}

.right {
    position: absolute;
    left: v-bind(leftWidth + 5 + 'px');
    width: v-bind(w - leftWidth - 6 + 'px');
    height: v-bind(h + 'px');
    z-index: 0;
    overflow: auto;
}

.main {
    position: relative;
    height: v-bind(h + 'px');
    width: v-bind(w + 'px');
}

.el-tabs {
    --el-tabs-header-height: 24 !important;
}

.addr {
    border: 1px solid var(--el-border-color);
    border-radius: 5px;
    padding: 5px;
    max-height: 200px;
    min-height: 50px;
    overflow-y: auto;
    overflow-x: hidden;
    width: 100%;
    display: block;
    position: relative;
}

.addrClose {
    position: absolute;
    right: 5px;
    top: 5px;
    width: 12px;
    height: 12px;
}

.addrClose:hover {
    color: var(--el-color-danger);
    cursor: pointer;
}

.subClose {
    z-index: 100;
}

.subClose:hover {
    color: var(--el-color-danger);
    cursor: pointer;
}

.param {
    margin-right: 5px;
    border-radius: 2px;
}

.treeLabel {
    display: inline-block;
    white-space: nowrap;
    /* 保证内容不会换行 */
    overflow: hidden;
    /* 超出容器部分隐藏 */
    text-overflow: ellipsis;
    /* 使用省略号表示超出部分 */
    width: v-bind(leftWidth - 80 + 'px') !important;
}

.lr {
    min-width: 300px;
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

.desc {
    font-size: 16px;
    color: var(--el-color-info);
    padding: 5px;
}

.isTop {
    font-weight: bold;
}
</style>