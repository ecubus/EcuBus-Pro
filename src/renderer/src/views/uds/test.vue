<template>
    <div>
        <div class="main" v-loading="loading">
            <div class="left" v-show="!hideTree">
                <el-scrollbar :height="h + 'px'">
                    <el-tree ref="treeRef" node-key="id" default-expand-all :data="tData" highlight-current
                        :expand-on-click-node="false" @node-click="nodeClick">
                        <template #default="{ node, data }">
                            <el-popover :ref="e => popoverRefs[data.id] = e" placement="bottom-start" :width="100"
                                trigger="contextmenu" popper-class="node-menu" v-if="data.type === 'config'">
                                <template #reference>
                                    <div class="tree-node">
                                        <span :class="{
                                            isTop: node.level === 1,
                                            treeLabel: true
                                        }">{{ node.label }}</span>
                                        <el-tooltip effect="light" content="Refresh Test Case" placement="bottom">
                                            <el-button link type="primary" @click.stop="handleRefresh(data)"
                                                :disabled="refreshLoading[data.id]">
                                                <Icon :icon="refreshLoading[data.id] ? loadingIcon : refreshIcon" />
                                            </el-button>
                                        </el-tooltip>
                                    </div>
                                </template>
                                <div class="menu-items">
                                    <div class="menu-item warning" @click="handleEdit(data)">
                                        <Icon :icon="editIcon" />
                                        <span>Edit</span>
                                    </div>
                                    <div class="menu-item danger" @click="handleDelete(data)">
                                        <Icon :icon="deleteIcon" />
                                        <span>Delete</span>
                                    </div>
                                </div>
                            </el-popover>
                            <div v-else-if="data.type === 'case'" class="tree-node">
                                <span :class="{
                                    treeLabel: true,
                                    'test-pass': data.status === 'pass',
                                    'test-fail': data.status === 'fail',
                                    'test-skip': data.status === 'skip'
                                }">
                                    {{ node.label }}
                                    <span class="test-duration" v-if="data.duration">
                                        ({{ data.duration.toFixed(2) }}ms)
                                    </span>
                                </span>
                            </div>
                            <div v-else class="tree-node">
                                <span :class="{
                                    isTop: node.level === 1,
                                    treeLabel: true
                                }">{{ node.label }}</span>
                                <el-button :disabled="globalStart" link v-if="data.canAdd" type="primary"
                                    @click.stop="addNewConfig()">
                                    <Icon :icon="circlePlusFilled" />
                                </el-button>
                            </div>
                        </template>
                    </el-tree>
                </el-scrollbar>
            </div>
            <div class="shift" id="testerServiceShift" v-show="!hideTree" />
            <div class="right" :style="{ left: hideTree ? '0px' : leftWidth + 5 + 'px' }">
                <!-- Right side content removed -->
            </div>
        </div>

        <!-- Configuration Dialog -->
        <el-dialog v-model="editDialogVisible" v-if="editDialogVisible && activeConfig" title="Edit Configuration"
            width="500px" align-center :append-to="`#wintest`">
            <el-form :model="model" label-width="100px" size="small" ref="ruleFormRef" :rules="rules"
                hide-required-asterisk>
                <el-form-item label="Name" prop="name" required>
                    <el-input v-model="model.name" @change="onConfigChange" />
                </el-form-item>
                <el-form-item label="Test Script File" prop="script">
                    <el-input v-model="model.script" clearable />
                    <div class="lr">
                        <el-button-group v-loading="buildLoading">
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
                        <div class="build-status-container" v-if="buildStatus">
                            <span class="buildStatus" :style="{ color: getBuildStatusColor() }">
                                <Icon :icon="getBuildStatusIcon()" />{{ getBuildStatusText() }}
                            </span>

                        </div>
                    </div>
                </el-form-item>
            </el-form>
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="handleEditCancel" size="small">Cancel</el-button>
                    <el-button type="primary" @click="handleEditSave" size="small">Save</el-button>
                </div>
            </template>
        </el-dialog>
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
import loadingIcon from '@iconify/icons-ep/loading'
import newIcon from '@iconify/icons-material-symbols/new-window'
import dangerIcon from '@iconify/icons-material-symbols/dangerous-outline-rounded'
import { useProjectStore } from "@r/stores/project"
import editIcon from '@iconify/icons-material-symbols/edit-outline'
import deleteIcon from '@iconify/icons-material-symbols/delete-outline'
import type { TestEvent } from 'node:test/reporters'


const loading = ref(false)

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
    // if (data.type === 'config') {
    //     handleEdit(data)
    // }
}

interface tree {
    label: string
    canAdd: boolean
    id: string
    type: 'test' | 'config'
    children: tree[]
    attrs?: {
        time?: string
        status?: 'pass' | 'fail' | 'skip'
    }
    nesting?: number
    parent?: tree
   
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
            type: 'config',
            children: []
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
        type: 'config',
        children: []
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
        buttonSize: 'small',
        appendTo: '#wintest'
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
    if (!activeConfig.value) return

    if (action == 'edit' || action == 'build') {
        if (model.value.script) {
            if (project.projectInfo.path) {
                if (action == 'edit') {
                    window.electron.ipcRenderer.invoke('ipc-create-project', project.projectInfo.path, project.projectInfo.name, cloneDeep(dataBase.getData())).catch((e: any) => {
                        ElMessageBox.alert(e.message, 'Error', {
                            confirmButtonText: 'OK',
                            type: 'error',
                            buttonSize: 'small',
                            appendTo: '#wintest'
                        })
                    })
                } else {
                    buildStatus.value = ''
                    buildLoading.value = true
                    window.electron.ipcRenderer.invoke('ipc-build-project', project.projectInfo.path, project.projectInfo.name, cloneDeep(dataBase.getData()), model.value.script, true)
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
                                buttonSize: 'small',
                                appendTo: '#wintest'
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
                    appendTo: '#wintest'
                })
            }
        } else {
            ElMessageBox.alert('Please select the script file first', 'Warning', {
                confirmButtonText: 'OK',
                type: 'warning',
                buttonSize: 'small',
                appendTo: '#wintest'
            })
        }
    } else {
        openTs().then(file => {
            if (file) {
                model.value.script = file
            }
        })
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

// Add new refs
const editDialogVisible = ref(false)
// const editingConfig = ref<TestConfig | null>(null)
const popoverRefs = ref<Record<string, any>>({})
const hideTree = ref(false)

// Add new ref for refresh loading state
const refreshLoading = ref<Record<string, boolean>>({})

// Add handlers for edit/delete
function handleEdit(data: tree) {

    popoverRefs.value[data.id]?.hide()
    model.value = cloneDeep(dataBase.tests[data.id])
    activeConfig.value = data.id
    editDialogVisible.value = true
    refreshBuildStatus()
}

function handleDelete(data: tree) {
    popoverRefs.value[data.id]?.hide()
    removeConfig(data.id)
    activeConfig.value = ''
}

async function handleEditSave() {
    if (!activeConfig.value) return

    try {
        await ruleFormRef.value?.validate()
        dataBase.tests[activeConfig.value] = cloneDeep(model.value)
        // Update tree node label
        const node = tData.value[0].children?.find(item => item.id === activeConfig.value)
        if (node) {
            node.label = model.value.name
        }
        editDialogVisible.value = false
        activeConfig.value = ''
    } catch (error) {
        // Validation failed
        return false
    }
}

function handleEditCancel() {
    editDialogVisible.value = false
    activeConfig.value = ''
}

// Helper functions for build status
function getBuildStatusColor() {
    const statusColors = {
        danger: 'var(--el-color-danger)',
        success: 'var(--el-color-success)',
        warning: 'var(--el-color-warning)',
        info: 'var(--el-color-info)'
    }
    return statusColors[buildStatus.value as keyof typeof statusColors]
}

function getBuildStatusIcon() {
    const statusIcons = {
        danger: dangerIcon,
        success: successIcon,
        warning: buildIcon,
        info: buildIcon
    }
    return statusIcons[buildStatus.value as keyof typeof statusIcons]
}

function getBuildStatusText() {
    const statusTexts = {
        danger: 'Build Failed',
        success: 'Build Success',
        warning: 'Need Rebuild',
        info: 'Need Build'
    }
    return statusTexts[buildStatus.value as keyof typeof statusTexts]
}


function buildSubTree(infos: TestEvent[], detail: boolean = false) {
   

    let currentSuite: tree | undefined;
    const roots: tree[] = [];
    function startTest(event: any) {
        const originalSuite = currentSuite;
        currentSuite = {
            id:v4(),
            type: 'test',
            canAdd: false,
            label: event.name,
            nesting: event.nesting,
            parent: currentSuite,
            children: [],
        };
        if (originalSuite?.children) {
            originalSuite.children.push(currentSuite);
        }
        if (!currentSuite.parent) {
            roots.push(currentSuite);
        }
    }
    function isFailure(node) {
        return (node?.children && node.children.some((c) => c.tag === 'failure')) || node?.attrs?.failures;
    }
    function isSkipped(node) {
        return (node?.children && node.children.some((c) => c.tag === 'skipped')) || node?.attrs?.skipped;
    }
    for (const event of infos) {
        switch (event.type) {
            case 'test:start': {
                startTest(event.data);
                break;
            }
            case 'test:pass':
            case 'test:fail': {
                if (!currentSuite) {
                    startTest({ name: 'root', nesting: 0 });
                }
                if (currentSuite!.label !== event.data.name ||
                    currentSuite!.nesting !== event.data.nesting) {
                    startTest(event.data);
                }
                const currentTest:tree = currentSuite!;
                if (currentSuite?.nesting === event.data.nesting) {
                    currentSuite = currentSuite.parent;
                }
                if(detail){
                    currentTest.attrs={
                        time: Number(event.data.details.duration_ms / 1000).toFixed(6),
                        status: event.type == 'test:pass'?'pass':event.type == 'test:fail'?'fail':'skip'
                    }
                    

                }
                // currentTest.time = Number(event.data.details.duration_ms / 1000).toFixed(6);
                const nonCommentChildren = currentTest!.children.filter((c: any) => c.comment == null);
                if (nonCommentChildren.length > 0) {

                    if(detail){
                        // currentTest.attrs.tests = nonCommentChildren.length;
                        // currentTest.attrs.failures = currentTest.children.filter(isFailure).length;
                        // currentTest.attrs.skipped = currentTest.children.filter(isSkipped).length;
                    }

                } else {


                    // if (event.data.skip) {
                    //     currentTest.children.push({
                    //         : event.data.name, nesting: event.data.nesting + 1,
                    //     });
                    // }
                    // if (event.data.todo) {
                    //     currentTest.children.push({
                    //         name: event.data.name, nesting: event.data.nesting + 1,
                    //     });
                    // }
                    // if (event.type === 'test:fail') {

                    //     currentTest.children.push({
                    //         name: event.data.name, nesting: event.data.nesting + 1,
                    //     });
                    // }
                }
                break;
            }
        }
    }
    return roots
}
// Update the handleRefresh function
async function handleRefresh(data: tree) {
    if (refreshLoading.value[data.id]) return
    refreshLoading.value[data.id] = true

    try {
        const val = dataBase.tests[data.id]
        if (val && val.script) {
            const v = await window.electron.ipcRenderer.invoke('ipc-get-build-status', project.projectInfo.path, project.projectInfo.name, val.script)
            if (v != 'success') {
                await window.electron.ipcRenderer.invoke('ipc-build-project', project.projectInfo.path, project.projectInfo.name, cloneDeep(dataBase.getData()), val.script, true)
            }

            const testInfo: TestEvent[] = await window.electron.ipcRenderer.invoke('ipc-get-test-info', project.projectInfo.path, project.projectInfo.name, cloneDeep(val))
            const target = tData.value[0].children?.find(item => item.id == data.id)
            if (!target) return []
            
            const newtestInfo = testInfo.filter((item: any) => item.data.name != '____ecubus_pro_test___')

            const roots = buildSubTree(newtestInfo)
            console.log(roots)
            target.children = []

            const root2tree = (parent:tree,root:tree)=>{
                parent.children=parent.children||[]
             
                parent.children.push(root)
                for(const r of root.children){
                    root2tree(root,r)
                }
            }
            for(const root of roots){
                root2tree(target,root)
            }
            




            // data.children = []
            // 强制树更新
            // tData.value = [...tData.value]
        } else {
            ElMessageBox.alert('请先选择测试脚本文件', 'Warning', {
                confirmButtonText: 'OK',
                type: 'warning',
                buttonSize: 'small',
                appendTo: '#wintest'
            })
        }
    } catch (error) {
        console.error('Error in handleRefresh:', error)
    } finally {
        refreshLoading.value[data.id] = false
    }
}
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
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    height: auto;
    margin-top: 5px;

}

.build-status-container {
    display: flex;
    align-items: center;
    gap: 8px;


    border-radius: 4px;
}

.buildStatus {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
    font-size: 12px;
}

.buildStatus .iconify {
    font-size: 16px;
    margin-right: 2px;
}

.desc {
    font-size: 16px;
    color: var(--el-color-info);
    padding: 5px;
}

.isTop {
    font-weight: bold;
}

.menu-items {
    padding: 2px 0;
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 12px;
    line-height: 20px;
}

.menu-item.warning:hover {
    background-color: var(--el-color-warning-light-9);
    color: var(--el-color-warning-dark-2);
}

.menu-item.danger:hover {
    background-color: var(--el-color-danger-light-9);
    color: var(--el-color-danger-dark-2);
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.tree-node .el-button {
    padding: 2px;
}

.tree-node .el-button:hover {
    background-color: var(--el-color-primary-light-9);
}

.el-button-group {
    margin-bottom: 4px;
}

.test-pass {
    color: var(--el-color-success);
}

.test-fail {
    color: var(--el-color-danger);
}

.test-skip {
    color: var(--el-color-info);
}

.test-duration {
    font-size: 0.8em;
    color: var(--el-text-color-secondary);
    margin-left: 4px;
}
</style>

<style lang="scss">
.el-popover.el-popper {
    min-width: 100px !important;
    padding: 0 !important;
    box-shadow: var(--el-box-shadow-light) !important;
    border: 1px solid var(--el-border-color-lighter) !important;

    &.node-menu {
        padding: 0 !important;
        background: var(--el-bg-color) !important;
    }
}
</style>

<style>
.node-menu {
    padding: 0;
}
</style>