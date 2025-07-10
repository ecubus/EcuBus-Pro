<template>
  <div>
    <div v-loading="loading" class="main">
      <div class="left">
        <el-scrollbar :height="h + 'px'">
          <el-tree
            ref="treeRef"
            node-key="id"
            default-expand-all
            :data="tData"
            highlight-current
            :expand-on-click-node="false"
            @node-click="nodeClick"
          >
            <template #default="{ node, data }">
              <el-popover
                v-if="data.type === 'config'"
                :ref="(e) => (popoverRefs[data.id] = e)"
                placement="bottom-start"
                :width="160"
                trigger="contextmenu"
                popper-class="node-menu"
              >
                <template #reference>
                  <div class="tree-node">
                    <span
                      :class="{
                        isTop: node.level === 1,
                        treeLabel: true
                      }"
                      >{{ node.label }}</span
                    >
                    <el-button-group class="node-actions" style="margin-top: 5px">
                      <el-tooltip
                        effect="light"
                        content="Refresh Test Config"
                        placement="bottom"
                        :show-after="1000"
                      >
                        <el-button
                          plain
                          type="primary"
                          :disabled="
                            refreshLoading[data.id] || runtime.testStates.activeTest != undefined
                          "
                          @click.stop="handleRefresh(data)"
                        >
                          <Icon :icon="refreshLoading[data.id] ? loadingIcon : refreshIcon" />
                        </el-button>
                      </el-tooltip>
                      <el-tooltip
                        v-if="!isRunning[data.id]"
                        effect="light"
                        content="Run Test Config"
                        placement="bottom"
                        :show-after="1000"
                      >
                        <el-button
                          plain
                          type="success"
                          :disabled="!globalStart || runtime.testStates.activeTest != undefined"
                          @click="handleRun(data)"
                        >
                          <Icon :icon="lightIcon" />
                        </el-button>
                      </el-tooltip>
                      <el-tooltip
                        v-else
                        effect="light"
                        content="Stop Test Config"
                        placement="bottom"
                        :show-after="1000"
                      >
                        <el-button
                          plain
                          type="danger"
                          :disabled="!isRunning[data.id]"
                          @click="handleStop(data)"
                        >
                          <Icon :icon="stopIcon" />
                        </el-button>
                      </el-tooltip>
                    </el-button-group>
                  </div>
                </template>
                <div class="menu-items">
                  <div>
                    <el-button
                      class="menu-button"
                      text
                      block
                      :disabled="isRunning[data.id] || runtime.testStates.activeTest !== undefined"
                      @click="handleEdit(data)"
                    >
                      <Icon :icon="editIcon" style="margin-right: 5px" />
                      <span>Edit</span>
                    </el-button>
                  </div>
                  <div>
                    <el-button
                      class="menu-button"
                      text
                      block
                      :disabled="
                        !dataBase.nodes[data.id]?.script ||
                        isRunning[data.id] ||
                        runtime.testStates.activeTest !== undefined
                      "
                      @click="handleExport(data)"
                    >
                      <Icon :icon="exportIcon" style="margin-right: 5px" />
                      <span>Export Report (HTML)</span>
                    </el-button>
                  </div>
                  <div>
                    <el-button
                      class="menu-button"
                      text
                      block
                      :disabled="
                        !dataBase.nodes[data.id]?.script ||
                        isRunning[data.id] ||
                        runtime.testStates.activeTest !== undefined ||
                        true
                      "
                      @click="handleExport(data, 'pdf')"
                    >
                      <Icon :icon="exportIcon" style="margin-right: 5px" />
                      <span>Export Report (PDF)</span>
                    </el-button>
                  </div>
                  <div>
                    <el-button
                      class="menu-button"
                      text
                      block
                      :disabled="isRunning[data.id] || runtime.testStates.activeTest !== undefined"
                      @click="handleDelete(data)"
                    >
                      <Icon :icon="deleteIcon" style="margin-right: 5px" />
                      <span>Delete</span>
                    </el-button>
                  </div>
                </div>
              </el-popover>
              <div v-else-if="data.type === 'test'" class="tree-node">
                <span
                  :class="{
                    treeLabel: true,
                    'test-pass': data.status === 'pass',
                    'test-fail': data.status === 'fail',
                    'test-skip': data.status === 'skip',
                    'test-todo': data.status === 'todo'
                  }"
                >
                  {{ node.label }}
                  <span v-if="data.time" class="test-duration"> ({{ data.time }}s) </span>
                </span>
                <div class="status-icon">
                  <div class="node-actions">
                    <el-button
                      v-if="!isRunning[getParentConfigId(node)]"
                      link
                      type="primary"
                      :disabled="!globalStart || runtime.testStates.activeTest != undefined"
                      @click="handleRun({ ...data, id: getParentConfigId(node) }, false, data.id)"
                    >
                      <Icon :icon="playIcon" />
                    </el-button>
                  </div>

                  <Icon v-if="data.status === 'pass'" :icon="checkIcon" class="icon-pass" />
                  <Icon v-else-if="data.status === 'fail'" :icon="closeIcon" class="icon-fail" />
                  <Icon v-else-if="data.status === 'skip'" :icon="skipIcon" class="icon-skip" />
                  <Icon v-else-if="data.status === 'todo'" :icon="todoIcon" class="icon-todo" />
                  <Icon
                    v-else-if="data.status === 'running'"
                    :icon="runningIcon"
                    class="icon-running"
                  />
                </div>
              </div>
              <div v-else class="tree-node">
                <span
                  :class="{
                    isTop: node.level === 1,
                    treeLabel: true
                  }"
                  >{{ node.label }}</span
                >
                <el-button
                  v-if="data.canAdd"
                  :disabled="globalStart"
                  link
                  type="primary"
                  class="add-button"
                  @click.stop="addNewConfig()"
                >
                  <Icon :icon="circlePlusFilled" />
                </el-button>
              </div>
            </template>
          </el-tree>
        </el-scrollbar>
      </div>
      <div id="tttShift" class="shift" />
      <div class="right" :style="{ left: leftWidth + 5 + 'px' }">
        <trace-component
          ref="traceRef"
          :height="h - 2"
          :capture-test="true"
          :test-id="isSingleRun"
          prefix="test-"
          :capture-system="false"
          :fields="['time', 'message']"
        />
      </div>
    </div>

    <!-- Configuration Dialog -->
    <el-dialog
      v-if="editDialogVisible && activeConfig"
      v-model="editDialogVisible"
      title="Edit Configuration"
      width="500px"
      align-center
      :append-to="`#wintest`"
    >
      <el-scrollbar :height="h * 0.85 - 108 + 'px'">
        <el-form
          ref="ruleFormRef"
          :model="model"
          label-width="120px"
          size="small"
          :rules="rules"
          hide-required-asterisk
        >
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
              <div v-if="buildStatus" class="build-status-container">
                <span class="buildStatus" :style="{ color: getBuildStatusColor() }">
                  <Icon :icon="getBuildStatusIcon()" />{{ getBuildStatusText() }}
                </span>
              </div>
            </div>
          </el-form-item>
          <el-form-item label="Connect Devices" prop="devices">
            <el-select v-model="model.channel" multiple placeholder="Select" style="width: 100%">
              <el-option
                v-for="item in devices"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>

          <el-divider content-position="left"> Report </el-divider>
          <el-form-item label="Report Path" prop="reportPath">
            <el-input v-model="model.reportPath" clearable>
              <template #append>
                <el-button @click="chooseReportPath">
                  <Icon :icon="newIcon" class="icon" />
                </el-button>
              </template>
            </el-input>
            <div class="form-tip">Leave empty to use project root path</div>
          </el-form-item>
        </el-form>
      </el-scrollbar>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="handleEditCancel">Cancel</el-button>
          <el-button type="primary" size="small" @click="handleEditSave">Save</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="tsx" setup>
import {
  ServiceItem,
  param2raw,
  getTxPduStr,
  getRxPduStr,
  Sequence,
  paramSetVal,
  paramSetValRaw
} from 'nodeCan/uds'
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
import { useDataStore } from '@r/stores/data'
import { Layout } from '@r/views/uds/layout'
import { NodeItem } from 'src/preload/data'
import buildIcon from '@iconify/icons-material-symbols/build-circle-outline-sharp'
import successIcon from '@iconify/icons-material-symbols/check-circle-outline'
import refreshIcon from '@iconify/icons-material-symbols/refresh'
import loadingIcon from '@iconify/icons-ep/loading'
import newIcon from '@iconify/icons-material-symbols/new-window'
import dangerIcon from '@iconify/icons-material-symbols/dangerous-outline-rounded'
import { useProjectStore } from '@r/stores/project'
import editIcon from '@iconify/icons-material-symbols/edit-outline'
import deleteIcon from '@iconify/icons-material-symbols/delete-outline'
import type { TestEvent } from 'node:test/reporters'
import lightIcon from '@iconify/icons-material-symbols/play-circle-outline-rounded'
import playIcon from '@iconify/icons-material-symbols/play-arrow'
import stopIcon from '@iconify/icons-material-symbols/stop-circle-outline'
import { TestTree, useGlobalStart, useRuntimeStore } from '@r/stores/runtime'
import checkIcon from '@iconify/icons-material-symbols/check-circle-outline'
import skipIcon from '@iconify/icons-material-symbols/skip-next'
import runningIcon from '@iconify/icons-material-symbols/pending-outline'
import todoIcon from '@iconify/icons-material-symbols/assignment-late-outline'
import exportIcon from '@iconify/icons-material-symbols/export-notes-outline'
import errorParse from '@r/util/ipcError'
import TraceComponent from './log.vue'

const loading = ref(false)
const traceRef = ref()
const runtime = useRuntimeStore()

const isRunning = computed({
  get: () => runtime.testStates.isRunning,
  set: (val) => {
    runtime.testStates.isRunning = val
  }
})

const tData = computed({
  get: () => runtime.testStates.tData,
  set: (val) => {
    runtime.testStates.tData = val
  }
})

const leftWidth = ref(300)

const ruleFormRef = ref<FormInstance>()
const props = defineProps<{
  width: number
  height: number
}>()
const h = toRef(props, 'height')
const w = toRef(props, 'width')

const treeRef = ref()

const globalStart = useGlobalStart()
const dataBase = useDataStore()

const project = useProjectStore()

function getParentConfigId(node: any): string {
  // 向上查找父级 config 节点
  let currentNode = node
  while (currentNode && currentNode.data && currentNode.data.type !== 'config') {
    currentNode = currentNode.parent
  }
  return currentNode?.data?.id || ''
}

function nodeClick(data: TestTree) {
  // if (data.type === 'config') {
  //     handleEdit(data)
  // }
}

const model = ref<NodeItem>({
  id: v4(),
  name: 'Test Config',
  script: '',
  reportPath: '',
  channel: []
})

const isSingleRun = ref<string[] | undefined>(undefined)
function handleRun(data: TestTree, clearLog: boolean = true, singleId?: string) {
  handleRefresh(data)
    .then(() => {
      runtime.testStates.isRunning[data.id] = true
      runtime.testStates.activeTest = data
      const id = singleId || data.id
      if (clearLog) {
        traceRef.value.clearLog()
      }
      const cnt: number[] = []
      const getChildren = (val: TestTree, ids?: string[]) => {
        for (const item of val.children) {
          if (item.testCnt != undefined) {
            cnt.push(item.testCnt)
            if (ids) {
              ids.push(item.id)
            }
          }
          if (item.children) {
            getChildren(item, ids)
          }
        }
      }
      if (data.type == 'config') {
        isSingleRun.value = undefined
        //get node from the tree

        getChildren(data)
      } else {
        isSingleRun.value = [id]

        const node = treeRef.value.getNode(id)
        if (data.testCnt != undefined) {
          cnt.push(data.testCnt)
        }
        getChildren(data, isSingleRun.value)
        if (node) {
          const getParent = (val: any) => {
            if (val.parent && val.parent.data && val.parent.data.type == 'test') {
              if (val.parent.data.testCnt != undefined) {
                cnt.push(val.parent.data.testCnt)
              }
              getParent(val.parent)
            }
          }
          getParent(node)
        }
      }

      const EnableObj: Record<number, boolean> = {}
      for (let i = 0; i < cnt.length; i++) {
        EnableObj[cnt[i]] = true
      }
      //make sure isSingleRun updated
      nextTick(() => {
        window.electron.ipcRenderer
          .invoke(
            'ipc-run-test',
            project.projectInfo.path,
            project.projectInfo.name,
            cloneDeep(dataBase.nodes[data.id]),
            cloneDeep(dataBase.tester),
            EnableObj
          )
          .catch((e: any) => {
            ElMessageBox.alert(e.message, 'Error', {
              confirmButtonText: 'OK',
              type: 'error',
              buttonSize: 'small',
              appendTo: '#wintest'
            })
          })
          .finally(() => {
            runtime.testStates.isRunning[data.id] = false
            runtime.testStates.activeTest = undefined
          })
      })
    })
    .catch((e: any) => {
      ElMessageBox.alert(e.message, 'Error', {
        confirmButtonText: 'OK',
        type: 'error',
        buttonSize: 'small',
        appendTo: '#wintest'
      })
    })
}
function handleStop(data: TestTree) {
  window.electron.ipcRenderer.invoke('ipc-stop-test', data.id).finally(() => {
    runtime.testStates.isRunning[data.id] = false
    runtime.testStates.activeTest = undefined
    //clear all status
    const clear = (val: TestTree) => {
      for (const item of val.children) {
        item.status = undefined
        if (item.children) {
          clear(item)
        }
      }
    }
    clear(data)
  })
}

function buildTree() {
  if (tData.value && tData.value.length > 0) {
    return
  }

  const t: TestTree = {
    label: 'Test Config',
    canAdd: true,
    id: 'root',
    type: 'root',
    disabled: true,
    children: []
  }

  for (const [key, config] of Object.entries(dataBase.nodes)) {
    if (config.isTest) {
      t.children?.push({
        label: config.name,
        canAdd: false,
        id: config.id,
        disabled: true,
        type: 'config',
        children: []
      })
    }
  }

  tData.value = [t]
}

const devices = computed(() => {
  const list: {
    label: string
    value: string
  }[] = []
  for (const item of Object.values(dataBase.devices)) {
    if (item.type == 'can') {
      list.push({
        label: item.canDevice?.name || '',
        value: item.canDevice?.id || ''
      })
    } else if (item.type == 'lin') {
      list.push({
        label: item.linDevice?.name || '',
        value: item.linDevice?.id || ''
      })
    } else if (item.type == 'eth') {
      list.push({
        label: item.ethDevice?.name || '',
        value: item.ethDevice?.id || ''
      })
    }
  }
  return list
})
function generateUniqueName(baseName: string): string {
  let index = 0
  let name = `${baseName} ${index}`

  while (Object.values(dataBase.nodes).some((config) => config.name === name)) {
    index++
    name = `${baseName} ${index}`
  }

  return name
}

function addNewConfig() {
  const defaultName = generateUniqueName('Test Config')
  const id = v4()
  const newConfig: NodeItem = {
    id,
    name: defaultName,
    script: '',
    reportPath: '',
    channel: [],
    isTest: true
  }

  dataBase.nodes[newConfig.id] = newConfig

  tData.value[0].children?.push({
    label: defaultName,
    canAdd: false,
    id: newConfig.id,
    type: 'config',
    children: [],
    disabled: true
  })

  activeConfig.value = newConfig.id
  model.value = cloneDeep(newConfig)
}

function removeConfig(id: string) {
  ElMessageBox.confirm('Are you sure to delete this config?', 'Warning', {
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    type: 'warning',
    buttonSize: 'small',
    appendTo: '#wintest'
  }).then(() => {
    delete dataBase.nodes[id]
    const index = tData.value[0].children?.findIndex((item) => item.id === id)
    if (index !== undefined && index > -1) {
      tData.value[0].children?.splice(index, 1)
    }
    activeConfig.value = ''
  })
}

const activeConfig = ref('')
const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (const [key, config] of Object.entries(dataBase.nodes)) {
      if (config.name === value && key !== activeConfig.value) {
        nextTick(() => {
          model.value.name = dataBase.nodes[activeConfig.value].name
        })
        callback(new Error('The test config name already exists'))
        return
      }
    }
    callback()
  } else {
    callback(new Error('Please input test config name'))
  }
}

const rules = {
  name: [{ required: true, trigger: 'blur', validator: nameCheck }]
}

function onConfigChange() {
  if (activeConfig.value) {
    if (!model.value.name.trim()) {
      model.value.name = dataBase.nodes[activeConfig.value].name
    } else {
      const isDuplicate = Object.entries(dataBase.nodes).some(
        ([key, config]) => config.name === model.value.name && key !== activeConfig.value
      )

      if (isDuplicate) {
        model.value.name = dataBase.nodes[activeConfig.value].name
      } else {
        // 检查script是否发生变化
        const oldConfig = dataBase.nodes[activeConfig.value]
        const scriptChanged = oldConfig.script !== model.value.script

        // 保存新配置
        dataBase.nodes[activeConfig.value] = cloneDeep(model.value)

        // 更新树节点
        const node = tData.value[0].children?.find((item) => item.id === activeConfig.value)
        if (node) {
          node.label = model.value.name
          // 如果script变化了，清空子节点
          if (scriptChanged) {
            node.children = []
          }
        }
      }
    }
  }
}

const buildStatus = ref<string | undefined>()
const buildLoading = ref(false)

function refreshBuildStatus() {
  if (model.value.script) {
    window.electron.ipcRenderer
      .invoke(
        'ipc-get-build-status',
        project.projectInfo.path,
        project.projectInfo.name,
        model.value.script
      )
      .then((val) => {
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
          window.electron.ipcRenderer
            .invoke(
              'ipc-create-project',
              project.projectInfo.path,
              project.projectInfo.name,
              cloneDeep(dataBase.getData())
            )
            .catch((e: any) => {
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
          window.electron.ipcRenderer
            .invoke(
              'ipc-build-project',
              project.projectInfo.path,
              project.projectInfo.name,
              cloneDeep(dataBase.getData()),
              model.value.script,
              true
            )
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
            })
            .finally(() => {
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
    openTs().then((file) => {
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
    else model.value.script = file
  }
  return file
}

function testLog(
  method: string,
  data: {
    message: {
      id: string
      data: TestEvent
      method: string
    }
    level: string
    label: string
  }[]
) {
  for (const item of data) {
    if (item.message.data.type == 'test:dequeue') {
      const key =
        item.message.data.data.name +
        ':' +
        item.message.data.data.line +
        ':' +
        item.message.data.data.column

      if (isSingleRun.value != undefined && !isSingleRun.value.includes(key)) {
        continue
      }
      const node = treeRef.value.getNode(key)
      if (node) {
        node.data.status = 'running'
      }
    } else if (item.message.data.type == 'test:pass') {
      const key =
        item.message.data.data.name +
        ':' +
        item.message.data.data.line +
        ':' +
        item.message.data.data.column
      if (isSingleRun.value != undefined && !isSingleRun.value.includes(key)) {
        continue
      }
      const node = treeRef.value.getNode(key)
      if (node) {
        node.data.status = 'pass'
        if (item.message.data.data.skip) {
          node.data.status = 'skip'
        }
        // if(item.message.data.data.todo){
        //     node.data.status='todo'
        // }

        node.data.time = Number(item.message.data.data.details.duration_ms / 1000).toFixed(3)
      }
    } else if (item.message.data.type == 'test:fail') {
      const key =
        item.message.data.data.name +
        ':' +
        item.message.data.data.line +
        ':' +
        item.message.data.data.column
      if (isSingleRun.value != undefined && !isSingleRun.value.includes(key)) {
        continue
      }
      const node = treeRef.value.getNode(key)
      if (node) {
        node.data.status = 'fail'
        // if(item.message.data.data.todo){
        //     node.data.status='todo'
        // }
        node.data.time = Number(item.message.data.data.details.duration_ms / 1000).toFixed(3)
      }
    }
  }
}
onMounted(() => {
  window.jQuery('#tttShift').resizable({
    handles: 'e',
    resize: (e, ui) => {
      leftWidth.value = ui.size.width
    },

    minWidth: 200
  })

  window.logBus.on('testInfo', testLog)
  buildTree()
  window.electron.ipcRenderer.on('ipc-get-test', (event, data) => {
    const id = data[0]
    if (id) {
      runtime.testStates.activeTest = tData.value[0].children?.find((item) => item.id == id)
    }
  })
})
onUnmounted(() => {
  window.logBus.detach('testInfo', testLog)
})

const editDialogVisible = ref(false)
const popoverRefs = ref<Record<string, any>>({})

const refreshLoading = ref<Record<string, boolean>>({})

function handleEdit(data: TestTree) {
  popoverRefs.value[data.id]?.hide()
  model.value = cloneDeep(dataBase.nodes[data.id])
  activeConfig.value = data.id
  editDialogVisible.value = true
  refreshBuildStatus()
}

function handleDelete(data: TestTree) {
  popoverRefs.value[data.id]?.hide()
  removeConfig(data.id)
  activeConfig.value = ''
}

async function handleEditSave() {
  if (!activeConfig.value) return

  try {
    await ruleFormRef.value?.validate()

    // 检查script是否发生变化
    const oldConfig = dataBase.nodes[activeConfig.value]
    const scriptChanged = oldConfig.script !== model.value.script

    // 保存新配置
    dataBase.nodes[activeConfig.value] = cloneDeep(model.value)

    // 更新树节点
    const node = tData.value[0].children?.find((item) => item.id === activeConfig.value)
    if (node) {
      node.label = model.value.name
      // 如果script变化了，清空子节点
      if (scriptChanged) {
        node.children = []
      }
    }

    editDialogVisible.value = false
    activeConfig.value = ''
  } catch (error) {
    null
  }
}

function handleEditCancel() {
  editDialogVisible.value = false
  activeConfig.value = ''
}

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

function buildSubTree(infos: TestEvent[]) {
  let currentSuite: TestTree | undefined
  const roots: TestTree[] = []
  function startTest(event: any) {
    const originalSuite = currentSuite

    const testId = `${event.name}:${event.line || 0}:${event.column || 0}`

    currentSuite = {
      id: testId,
      type: 'test',
      canAdd: false,
      label: event.name,
      nesting: event.nesting,
      parent: currentSuite,
      children: []
    }
    if (originalSuite?.children) {
      originalSuite.children.push(currentSuite)
    }
    if (!currentSuite.parent) {
      roots.push(currentSuite)
    }
  }
  for (const event of infos) {
    switch (event.type) {
      case 'test:dequeue': {
        startTest(event.data)
        break
      }
      case 'test:pass':
      case 'test:fail': {
        if (!currentSuite) {
          startTest({ name: 'root', nesting: 0, line: 0, column: 0 })
        }
        if (
          currentSuite!.label !== event.data.name ||
          currentSuite!.nesting !== event.data.nesting
        ) {
          startTest(event.data)
        }
        const currentTest: TestTree = currentSuite!
        if (currentSuite?.nesting === event.data.nesting) {
          currentSuite = currentSuite.parent
        }

        const nonCommentChildren = currentTest!.children.filter((c: any) => c.comment == null)
        // if (nonCommentChildren.length > 0) {

        // } else {

        // }
        break
      }
    }
  }
  return roots
}

const root2tree = (cnt: number, parent: TestTree, root: TestTree) => {
  const newNode: TestTree = {
    testCnt: cnt,
    id: root.id,
    type: 'test',
    canAdd: false,
    label: root.label,
    children: []
  }
  cnt++
  parent.children.push(newNode)

  if (root.children && root.children.length > 0) {
    for (const child of root.children) {
      cnt = root2tree(cnt, newNode, child)
    }
  }
  return cnt
}

async function handleRefresh(data: TestTree) {
  if (refreshLoading.value[data.id]) return
  refreshLoading.value[data.id] = true

  try {
    const val = dataBase.nodes[data.id]
    if (val && val.script) {
      await nextTick()
      const v = await window.electron.ipcRenderer.invoke(
        'ipc-get-build-status',
        project.projectInfo.path,
        project.projectInfo.name,
        val.script
      )
      if (v != 'success') {
        const r = await window.electron.ipcRenderer.invoke(
          'ipc-build-project',
          project.projectInfo.path,
          project.projectInfo.name,
          cloneDeep(dataBase.getData()),
          val.script,
          true
        )
        if (r.length > 0) {
          throw new Error(r.map((item) => item.message).join('\n'))
        }
      }

      const testInfo: TestEvent[] = await window.electron.ipcRenderer.invoke(
        'ipc-get-test-info',
        project.projectInfo.path,
        project.projectInfo.name,
        cloneDeep(val),
        cloneDeep(dataBase.tester)
      )
      const target = tData.value[0].children?.find((item) => item.id == data.id)
      if (!target) return

      const newtestInfo = testInfo.filter((item: any) => item.data.name != '____ecubus_pro_test___')
      const roots = buildSubTree(newtestInfo)

      target.children = []
      let cnt = 0
      for (const root of roots) {
        cnt = root2tree(cnt, target, root)
      }
    } else {
      ElMessageBox.alert('Please select the script file first', 'Warning', {
        confirmButtonText: 'OK',
        type: 'warning',
        buttonSize: 'small',
        appendTo: '#wintest'
      })
    }
    refreshLoading.value[data.id] = false
  } catch (error) {
    refreshLoading.value[data.id] = false
    throw error
  }
}

async function handleExport(data: TestTree, type: 'html' | 'pdf' = 'html') {
  popoverRefs.value[data.id]?.hide()

  if (type == 'html') {
    try {
      const p = await window.electron.ipcRenderer.invoke(
        'ipc-get-test-report',
        data.id,
        dataBase.nodes[data.id].reportPath
      )
      if (p) {
        ElMessageBox.confirm('Test report exported successfully, open it?', 'Success', {
          confirmButtonText: 'OK',
          type: 'success',
          buttonSize: 'small',
          appendTo: '#wintest'
        })
          .then(() => {
            window.electron.ipcRenderer.send('ipc-open-link', p)
          })
          .catch(() => {
            null
          })
      }
    } catch (error: any) {
      const msg = errorParse(error)
      ElMessageBox.alert(`Failed to export test report: ${msg}`, 'Error', {
        confirmButtonText: 'OK',
        type: 'error',
        buttonSize: 'small',
        appendTo: '#wintest'
      })
    }
  }
}

async function chooseReportPath() {
  const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: 'Report Path',
    properties: ['openDirectory']
  })

  if (r.filePaths[0]) {
    let path = r.filePaths[0]
    // 如果选择的路径是项目路径的子目录，则使用相对路径
    if (project.projectInfo.path && path.startsWith(project.projectInfo.path)) {
      path = window.path.relative(project.projectInfo.path, path)
    }
    model.value.reportPath = path
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
  padding-right: 8px;
  min-width: 0;
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
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  margin-right: 4px;
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

.node-actions {
  align-items: center;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: 4px;
  height: 20px;
}

.node-actions .el-button {
  padding: 2px;
  height: 20px;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  vertical-align: middle;
}

.node-actions .el-tooltip__trigger {
  display: flex;
  align-items: center;
  height: 100%;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  min-width: 20px;
  height: 20px;
  gap: 4px;
  line-height: 1;
}

.status-icon .iconify {
  vertical-align: middle;
}

.icon-pass {
  color: var(--el-color-success);
}

.icon-fail {
  color: var(--el-color-danger);
}

.icon-skip {
  color: var(--el-color-info);
}

.icon-running {
  color: var(--el-color-warning);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.test-todo {
  color: var(--el-color-warning);
}

.icon-todo {
  color: var(--el-color-warning);
}

.menu-button {
  width: 100%;
  justify-content: flex-start;
  padding: 8px;
  height: auto;
  font-size: 12px;
  line-height: 1;
}

.menu-button.warning:hover {
  color: var(--el-color-warning-dark-2);
  background-color: var(--el-color-warning-light-9);
}

.menu-button.danger:hover {
  color: var(--el-color-danger-dark-2);
  background-color: var(--el-color-danger-light-9);
}

.menu-button.info:hover {
  color: var(--el-color-primary-dark-2);
  background-color: var(--el-color-primary-light-9);
}

.menu-button :deep(.iconify) {
  margin-right: 4px;
  font-size: 16px;
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.2;
}

:deep(.el-dialog__body) {
  padding: 10px 20px;
  /* Remove default max-height if any */
  max-height: none;
}

:deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

:deep(.el-scrollbar__wrap) {
  padding-right: 10px;
}

.add-button {
  padding: 2px;
  height: 20px;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-button :deep(.iconify) {
  font-size: 16px;
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
