<template>
  <div style="padding: 20px; min-width: 600px">
    <el-form
      ref="ruleFormRef"
      :model="data"
      label-width="150px"
      :rules="rules"
      size="small"
      hide-required-asterisk
    >
      <el-form-item label="Tester Name" prop="name">
        <el-input v-model="data.name" :disabled="globalStart" placeholder="Name" />
      </el-form-item>
      <el-form-item label="Simulate By" prop="simulateBy">
        <el-select v-model="data.simulateBy" :disabled="globalStart" clearable>
          <el-option v-for="item in nodesName" :key="item.id" :label="item.name" :value="item.id">
          </el-option>
        </el-select>
      </el-form-item>
      <!-- <el-form-item label="Target Device" prop="targetDeviceId">
        <el-select v-model="data.targetDeviceId" placeholder="Device" clearable>
          <el-option v-for="item, key in devices" :key="key" :label="item.canDevice?.name" :value="key">
            <span style="float: left">{{ item.canDevice?.name }}</span>
            <span style="
          float: right;
          color: var(--el-text-color-secondary);
          font-size: 13px;
        ">
              {{ item.canDevice?.vendor.toLocaleUpperCase() }}
            </span>
          </el-option>
        </el-select>
      </el-form-item> -->
      <el-form-item label="Tester Script File" prop="script">
        <el-input v-model="data.script" :disabled="globalStart" clearable> </el-input>
        <div class="lr">
          <el-button-group v-loading="buildLoading" style="margin-top: 5px">
            <el-button size="small" plain :disabled="globalStart" @click="editScript('open')">
              <Icon :icon="newIcon" class="icon" style="margin-right: 5px" /> Choose
            </el-button>

            <el-button size="small" plain @click="editScript('build')">
              <Icon :icon="buildIcon" class="icon" style="margin-right: 5px" /> Build
            </el-button>

            <!-- <el-button size="small" plain @click="editScript('refresh')">
              <Icon :icon="refreshIcon" class="icon" style="margin-right: 5px" /> Refresh

            </el-button> -->
            <el-button size="small" plain @click="editScript('edit')">
              <Icon :icon="refreshIcon" class="icon" style="margin-right: 5px" /> Refresh / Edit
            </el-button>
          </el-button-group>
          <el-divider
            v-if="buildStatus"
            direction="vertical"
            style="height: 24px; margin-top: 5px"
          />
          <span
            v-if="buildStatus == 'danger'"
            style="color: var(--el-color-danger)"
            class="buildStatus"
          >
            <Icon :icon="dangerIcon" />Build Failed
          </span>
          <span
            v-else-if="buildStatus == 'success'"
            style="color: var(--el-color-success)"
            class="buildStatus"
          >
            <Icon :icon="successIcon" />Build Success
          </span>
          <span
            v-else-if="buildStatus == 'warning'"
            style="color: var(--el-color-warning)"
            class="buildStatus"
          >
            <Icon :icon="buildIcon" />Need Rebuild
          </span>
          <span
            v-else-if="buildStatus == 'info'"
            style="color: var(--el-color-info)"
            class="buildStatus"
          >
            <Icon :icon="buildIcon" />Need Build
          </span>
          <el-button v-if="buildStatus" link style="margin-top: 5px" :type="buildStatus">
            <Icon
              :icon="refreshIcon"
              class="icon"
              style="margin-right: 5px"
              @click="refreshBuildStatus"
            />
          </el-button>
        </div>

        <!-- stop -->
      </el-form-item>
      <el-divider content-position="left">
        UDS Code Generate
        <el-button link type="primary" size="small" @click="handleExternalClick">
          <Icon :icon="externalIcon" style="font-size: 16px" />
        </el-button>
      </el-divider>
      <el-form-item label="Enable Code Generate" prop="enableCodeGen">
        <el-switch v-model="data.enableCodeGen" :disabled="globalStart" />
      </el-form-item>
      <el-form-item v-if="data.enableCodeGen" label="Template List" prop="generateConfigs">
        <div style="width: 100%">
          <div style="display: flex; margin-bottom: 10px">
            <el-button
              size="small"
              type="primary"
              icon="Plus"
              plain
              :disabled="globalStart"
              @click="addTemplateConfig"
            >
              Add Template
            </el-button>
            <el-button
              size="small"
              type="success"
              icon="Setting"
              plain
              :disabled="globalStart || !hasValidTemplates"
              @click="generateAllCode"
            >
              Generate
            </el-button>
          </div>
          <el-table
            v-if="data.generateConfigs && data.generateConfigs.length > 0"
            :data="data.generateConfigs"
            border
            size="small"
          >
            <el-table-column label="Template Path" min-width="200">
              <template #default="{ row, $index }">
                <div style="display: flex; gap: 8px">
                  <el-input
                    v-model="row.tempaltePath"
                    :disabled="globalStart"
                    placeholder="Template file path"
                    size="small"
                  />
                  <el-button
                    size="small"
                    icon="FolderOpened"
                    :disabled="globalStart"
                    @click="selectTemplatePath($index)"
                  />
                </div>
              </template>
            </el-table-column>
            <el-table-column label="Output Path" min-width="200">
              <template #default="{ row, $index }">
                <div style="display: flex; gap: 8px">
                  <el-input
                    v-model="row.generatePath"
                    :disabled="globalStart"
                    placeholder="Generated file path"
                    size="small"
                  />
                  <el-button
                    size="small"
                    icon="FolderOpened"
                    :disabled="globalStart"
                    @click="selectOutputPath($index)"
                  />
                </div>
              </template>
            </el-table-column>
            <el-table-column label="Actions" width="150" align="center">
              <template #default="{ $index }">
                <el-button
                  size="small"
                  type="success"
                  plain
                  :disabled="!data.generateConfigs?.[$index]?.tempaltePath"
                  @click="previewTemplate($index)"
                >
                  Preview
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  icon="Delete"
                  plain
                  :disabled="globalStart"
                  @click="removeTemplateConfig($index)"
                />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-form-item>
      <el-divider content-position="left"> UDS Timing </el-divider>
      <el-form-item label-width="0">
        <el-col :span="12">
          <el-form-item label="P2 timeout" prop="udsTime.pTime">
            <el-input v-model.number="data.udsTime.pTime" :disabled="globalStart" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="P2 max (0x78)" prop="udsTime.pExtTime">
            <el-input v-model.number="data.udsTime.pExtTime" :disabled="globalStart" />
          </el-form-item>
        </el-col>
      </el-form-item>
      <el-form-item label-width="0">
        <el-col :span="12">
          <el-form-item label="S3 Time" prop="data.udsTime.s3Time">
            <el-input v-model.number="data.udsTime.s3Time" :disabled="globalStart" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Tester Present Enable" prop="udsTime.testerPresentEnable">
            <el-checkbox
              v-model="data.udsTime.testerPresentEnable"
              :disabled="props.type != 'can' || globalStart"
            />
          </el-form-item>
        </el-col>
      </el-form-item>
      <el-form-item v-if="data.udsTime.testerPresentEnable" label-width="0">
        <el-col :span="12">
          <el-form-item label="Tester Present Address" prop="udsTime.testerPresentAddrIndex">
            <el-select v-model.number="data.udsTime.testerPresentAddrIndex" :disabled="globalStart">
              <el-option
                v-for="(item, index) in data.address"
                :key="index"
                :label="getAddrName(item, index)"
                :value="index"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="From Special Service" prop="udsTime.testerPresentSpecialService">
            <el-select v-model="data.udsTime.testerPresentSpecialService" :disabled="globalStart">
              <el-option
                v-for="(item, index) in all3EServices"
                :key="index"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-form-item>
      <template v-if="props.type == 'eth'">
        <el-divider content-position="left"> DOIP Settings </el-divider>
        <el-col :span="12">
          <el-form-item label="DOIP Version" prop="doipVersion">
            <el-select
              v-model.number="data.doipVersion"
              :disabled="globalStart"
              placeholder="DOIP V2"
            >
              <el-option label="DOIP V2" :value="2" />
              <el-option label="DOIP V3" :value="3" />
            </el-select>
          </el-form-item>
        </el-col>
      </template>
      <el-divider content-position="left">
        <el-button icon="Plus" link type="primary" :disabled="globalStart" @click="addCanAddress">
          Add
          {{ props.type.toLocaleUpperCase() }} Address
        </el-button>
        <el-button icon="Switch" link type="success" :disabled="globalStart" @click="addAddrFromDb">
          Load From Database
        </el-button>
      </el-divider>
    </el-form>

    <div v-if="data.address && data.address.length > 0">
      <el-tabs
        v-if="props.type == 'can'"
        v-model="activeTabName"
        tab-position="left"
        style="height: 100%"
        closable
        @tab-remove="removeTab"
      >
        <el-tab-pane v-for="(item, index) in data.address" :key="index" :name="`index${index}`">
          <template #label>
            <span class="custom-tabs-label">
              <span
                :class="{
                  addrError: errors[index]
                }"
                >{{ getAddrName(item, index) }}</span
              >
            </span>
          </template>
          <canAddr
            v-if="data.address[index].canAddr"
            :ref="(e) => (addrRef[index] = e)"
            v-model="data.address[index].canAddr"
            :index="index"
            :addrs="data.address"
          />
        </el-tab-pane>
      </el-tabs>
      <el-tabs
        v-else-if="props.type == 'eth'"
        v-model="activeTabName"
        tab-position="left"
        style="height: 100%"
        closable
        @tab-remove="removeTab"
      >
        <el-tab-pane v-for="(item, index) in data.address" :key="index" :name="`index${index}`">
          <template #label>
            <span class="custom-tabs-label">
              <span
                :class="{
                  addrError: errors[index]
                }"
                >{{ getAddrName(item, index) }}</span
              >
            </span>
          </template>

          <EthAddr
            v-if="data.address[index].ethAddr"
            :ref="(e) => (addrRef[index] = e)"
            v-model="data.address[index].ethAddr"
            :index="index"
            :addrs="data.address"
          />
        </el-tab-pane>
      </el-tabs>
      <el-tabs
        v-else-if="props.type == 'lin'"
        v-model="activeTabName"
        tab-position="left"
        style="height: 100%"
        closable
        @tab-remove="removeTab"
      >
        <el-tab-pane v-for="(item, index) in data.address" :key="index" :name="`index${index}`">
          <template #label>
            <span class="custom-tabs-label">
              <span
                :class="{
                  addrError: errors[index]
                }"
                >{{ getAddrName(item, index) }}</span
              >
            </span>
          </template>

          <LinAddr
            v-if="data.address[index].linAddr"
            :ref="(e) => (addrRef[index] = e)"
            v-model="data.address[index].linAddr"
            :index="index"
            :addrs="data.address"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
    <el-divider />

    <!-- 预览对话框 -->
    <el-dialog
      v-if="previewDialogVisible"
      v-model="previewDialogVisible"
      :title="`Preview Generated Code By: ${currentPreviewTemplate}`"
      width="80%"
      align-center
      append-to="#tester"
    >
      <div v-loading="previewLoading" style="position: relative">
        <!-- 复制按钮 -->
        <el-button
          class="copy-btn"
          type="primary"
          link
          size="small"
          @click="copyPreviewToClipboard"
        >
          <Icon :icon="copyIcon" style="font-size: 18px" />
        </el-button>

        <!-- 预览内容 -->
        <pre
          style="
            margin: 20px;
            overflow: auto;
            background: #f5f5f5;
            padding: 16px;
            border-radius: 4px;
          "
          :style="{
            maxHeight: `${height - 200}px`
          }"
          >{{ previewContent }}</pre
        >
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import {
  Ref,
  computed,
  inject,
  onBeforeMount,
  onMounted,
  onUnmounted,
  ref,
  toRef,
  watch,
  nextTick,
  h
} from 'vue'
import canAddr from './canAddr.vue'
import { v4 } from 'uuid'
import { type FormRules, type FormInstance, ElMessageBox, ElMessage } from 'element-plus'
import { assign, cloneDeep } from 'lodash'
import { useDataStore } from '@r/stores/data'
import { TesterInfo } from 'nodeCan/tester'
import { CAN_ADDR_FORMAT, CAN_ADDR_TYPE, CAN_ID_TYPE } from 'nodeCan/can'
import { HardwareType, ServiceItem, UdsAddress, UdsDevice } from 'nodeCan/uds'
import { useProjectStore } from '@r/stores/project'
import { Icon } from '@iconify/vue'
import buildIcon from '@iconify/icons-material-symbols/build-circle-outline-sharp'
import successIcon from '@iconify/icons-material-symbols/check-circle-outline'
import refreshIcon from '@iconify/icons-material-symbols/refresh'
import newIcon from '@iconify/icons-material-symbols/new-window'
import externalIcon from '@iconify/icons-mdi/external-link'
import buildError from './buildError.vue'
import dangerIcon from '@iconify/icons-material-symbols/dangerous-outline-rounded'
import Handlebars from 'handlebars'
import copyIcon from '@iconify/icons-material-symbols/content-copy'
import EthAddr from './ethAddr.vue'
import LinAddr from './linAddr.vue'
import { LIN_ADDR_TYPE, LIN_SCH_TYPE } from 'nodeCan/lin'
import dbchoose from './dbchoose.vue'
import { useGlobalStart } from '@r/stores/runtime'
import { useClipboard } from '@vueuse/core'

const globalStart = useGlobalStart()
const ruleFormRef = ref<FormInstance>()
const dataBase = useDataStore()
const nodesName = computed(() => {
  return Object.values(dataBase.nodes)
})
const props = defineProps<{
  index: string
  height: number
  type: HardwareType
}>()

// const devices = computed(() => {
//   const devicesList: Record<string, UdsDevice> = {}
//   for (const key of Object.keys(dataBase.devices)) {
//     const device = dataBase.devices[key]
//     if (device.type == 'can') {
//       devicesList[key] = device
//     }
//   }
//   return devicesList
// })

const data = ref<TesterInfo>({
  id: v4(),
  name: '',
  type: props.type,
  script: '',
  targetDeviceId: '',
  seqList: [],
  address: [],
  udsTime: {
    pTime: 2000,
    pExtTime: 5000,
    s3Time: 5000,
    testerPresentEnable: false
  },
  allServiceList: {},
  enableCodeGen: false,
  generateConfigs: []
})

function getAddrName(item: UdsAddress, index: number) {
  if (item.type == 'can') {
    return item.canAddr?.name
  } else if (item.type == 'eth') {
    return item.ethAddr?.name
  } else if (item.type == 'lin') {
    return item.linAddr?.name
  }
  return `Addr${index}`
}

const addrRef = ref<Record<number, any>>({})

const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (const key of Object.keys(dataBase.tester)) {
      const hasName = dataBase.tester[key].name
      if (hasName == value && key != editIndex.value) {
        callback(new Error('The tester name already exists'))
      }
    }
    callback()
  } else {
    callback(new Error('Please input tester name'))
  }
}

const activeTabName = ref('')
const emits = defineEmits(['change'])

const all3EServices = computed(() => {
  let services: ServiceItem[] = []
  for (const key of Object.keys(dataBase.tester)) {
    const tester = dataBase.tester[key]
    if (tester && tester.id == data.value.id) {
      services = tester.allServiceList['0x3E'] || []
      break
    }
  }
  return services
})

const hasValidTemplates = computed(() => {
  return (
    data.value.generateConfigs?.some((config) => config.tempaltePath && config.generatePath) ||
    false
  )
})
const rules = computed<FormRules>(() => {
  return {
    name: [
      {
        required: true,
        trigger: 'blur',
        validator: nameCheck
      }
    ],
    targetDeviceId: [
      {
        required: true,
        message: 'Please select target device',
        trigger: 'change'
      }
    ],
    'udsTime.pTime': [
      {
        required: true,
        message: 'Please input UDS Timeout',
        trigger: 'blur',
        type: 'number'
      }
    ],
    'udsTime.s3Time': [
      {
        required: true,
        message: 'Please input S3 Time',
        trigger: 'blur',
        type: 'number'
      }
    ],
    'udsTime.testerPresentAddrIndex': [
      {
        required: data.value.udsTime.testerPresentEnable,
        message: 'Address is required'
      }
    ]
  }
})

const project = useProjectStore()

function refreshBuildStatus() {
  if (data.value.script) {
    window.electron.ipcRenderer
      .invoke(
        'ipc-get-build-status',
        project.projectInfo.path,
        project.projectInfo.name,
        data.value.script
      )
      .then((val) => {
        buildStatus.value = val
      })
  }
}
const buildLoading = ref(false)
function editScript(action: 'open' | 'edit' | 'build') {
  if (action == 'edit' || action == 'build') {
    if (data.value.script) {
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
                appendTo: '#tester'
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
              data.value.script
            )
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
      data.value.script = window.path.relative(project.projectInfo.path, file)
    else data.value.script = file
  }
  return file
}
const editIndex = ref(props.index)
function addCanAddress() {
  if (props.type == 'can') {
    data.value.address.push({
      type: 'can',
      canAddr: {
        name: `Addr${data.value.address.length}`,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: '0x1',
        TA: '0x2',
        AE: '',
        canIdTx: '0x55',
        canIdRx: '0x56',
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        nBr: 0,
        nCs: 0,
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false,
        remote: false,
        stMin: 10,
        bs: 10,
        maxWTF: 0,
        dlc: 8,
        padding: false,
        paddingValue: '0x00'
      }
    })
  } else if (props.type == 'eth') {
    data.value.address.push({
      type: 'eth',

      ethAddr: {
        name: `Addr${data.value.address.length}`,
        taType: 'physical',
        virReqType: 'broadcast',
        virReqAddr: '',

        entityNotFoundBehavior: 'normal',
        entity: {
          vin: 'ecubus-pro eth000',
          eid: '00-00-00-00-00-00',
          gid: '00-00-00-00-00-00',
          nodeType: 'node',
          logicalAddr: 100 + data.value.address.length
        },
        tester: {
          testerLogicalAddr: 200 + data.value.address.length,
          routeActiveTime: 0,
          createConnectDelay: 1000
        }
      }
    })
  } else if (props.type == 'lin') {
    data.value.address.push({
      type: 'lin',
      linAddr: {
        name: `Addr${data.value.address.length}`,
        addrType: LIN_ADDR_TYPE.PHYSICAL,
        nad: 1,
        stMin: 20,
        nAs: 1000,
        nCr: 1000,
        schType: LIN_SCH_TYPE.DIAG_ONLY
      }
    })
  }
  activeTabName.value = `index${data.value.address.length - 1}`
}
function removeTab(targetName: string) {
  const index = parseInt(targetName.replace('index', ''))
  data.value.address.splice(index, 1)
  nextTick(() => {
    delete addrRef.value[index]
  })
}

function addAddrFromDb() {
  ElMessageBox({
    title: `Load From Database ${props.type}`,
    message: h(dbchoose, {
      type: props.type,
      testerId: editIndex.value,
      onAdd: (addr: UdsAddress) => {
        data.value.address.push(addr)
        activeTabName.value = `index${data.value.address.length - 1}`
      }
    }),
    showCancelButton: false,
    showConfirmButton: false
  })
}

function handleExternalClick() {
  window.electron.ipcRenderer.send(
    'ipc-open-link',
    'https://app.whyengineer.com/docs/um/uds/udscode.html'
  )
}

function addTemplateConfig() {
  if (!data.value.generateConfigs) {
    data.value.generateConfigs = []
  }
  data.value.generateConfigs.push({
    tempaltePath: '',
    generatePath: ''
  })
}

function removeTemplateConfig(index: number) {
  if (data.value.generateConfigs) {
    data.value.generateConfigs.splice(index, 1)
  }
}

async function selectTemplatePath(index: number) {
  const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: 'Select Template File',
    properties: ['openFile'],
    filters: [
      { name: 'Template Files', extensions: ['hbs', 'template', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  const file = r.filePaths[0]
  if (file && data.value.generateConfigs) {
    if (project.projectInfo.path) {
      data.value.generateConfigs[index].tempaltePath = window.path.relative(
        project.projectInfo.path,
        file
      )
    } else {
      data.value.generateConfigs[index].tempaltePath = file
    }
  }
}

async function selectOutputPath(index: number) {
  const r = await window.electron.ipcRenderer.invoke('ipc-show-save-dialog', {
    defaultPath: project.projectInfo.path,
    title: 'Select Output File',
    filters: [
      { name: 'Code Files', extensions: ['c', 'cpp', 'h', 'hpp', 'ts', 'js'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  const file = r.filePath
  if (file && data.value.generateConfigs) {
    if (project.projectInfo.path) {
      data.value.generateConfigs[index].generatePath = window.path.relative(
        project.projectInfo.path,
        file
      )
    } else {
      data.value.generateConfigs[index].generatePath = file
    }
  }
}

async function previewTemplate(index: number) {
  if (!data.value.generateConfigs) return

  const config = data.value.generateConfigs[index]
  let templatePath = config.tempaltePath
  try {
    previewLoading.value = true
    currentPreviewTemplate.value = config.tempaltePath

    // 通过 IPC 读取模板文件内容

    if (project.projectInfo.path && !window.path.isAbsolute(templatePath)) {
      templatePath = window.path.join(project.projectInfo.path, templatePath)
    }

    const templateContent = await window.electron.ipcRenderer.invoke(
      'ipc-fs-readFile',
      templatePath
    )

    // 编译 Handlebars 模板
    const template = Handlebars.compile(templateContent)

    // 准备渲染数据（使用当前的 tester 数据）
    const renderData = {
      tester: data.value,
      project: project.projectInfo
      // 可以添加更多需要的数据
    }

    // 渲染模板
    previewContent.value = template(renderData)
    previewDialogVisible.value = true
  } catch (error: any) {
    const formattedError = await formatHandlebarsError(error, templatePath)
    ElMessageBox({
      title: 'Preview Failed',
      message: h(
        'div',
        {
          style:
            'font-family: monospace; white-space: pre-wrap; text-align: left; max-width: 600px;'
        },
        formattedError
      ),
      confirmButtonText: 'OK',
      buttonSize: 'small',
      appendTo: '#tester'
    })
    console.error('Preview error:', error)
  } finally {
    previewLoading.value = false
  }
}

async function generateAllCode() {
  if (!data.value.generateConfigs) return

  const validConfigs = data.value.generateConfigs.filter(
    (config) => config.tempaltePath && config.generatePath
  )

  if (validConfigs.length === 0) {
    ElMessageBox.alert('No valid template configurations found', 'Warning', {
      confirmButtonText: 'OK',
      type: 'warning',
      buttonSize: 'small',
      appendTo: '#tester'
    })
    return
  }

  try {
    buildLoading.value = true

    // 准备渲染数据
    const renderData = {
      tester: data.value,
      project: project.projectInfo
      // 可以添加更多需要的数据
    }

    let successCount = 0

    // 依次处理每个模板配置，遇到错误就停止
    for (let i = 0; i < validConfigs.length; i++) {
      const config = validConfigs[i]

      // 处理模板文件路径
      let templatePath = config.tempaltePath
      if (project.projectInfo.path && !window.path.isAbsolute(templatePath)) {
        templatePath = window.path.join(project.projectInfo.path, templatePath)
      }

      try {
        // 处理输出文件路径
        let outputPath = config.generatePath
        if (project.projectInfo.path && !window.path.isAbsolute(outputPath)) {
          outputPath = window.path.join(project.projectInfo.path, outputPath)
        }

        // 读取模板文件
        const templateContent = await window.electron.ipcRenderer.invoke(
          'ipc-fs-readFile',
          templatePath
        )

        // 编译 Handlebars 模板
        const template = Handlebars.compile(templateContent)

        // 渲染模板
        const renderedContent = template(renderData)

        // 确保输出目录存在
        const outputDir = window.path.dirname(outputPath)
        const dirExists = await window.electron.ipcRenderer.invoke('ipc-fs-exist', outputDir)
        if (!dirExists) {
          await window.electron.ipcRenderer.invoke('ipc-fs-mkdir', outputDir)
        }

        // 写入文件
        await window.electron.ipcRenderer.invoke('ipc-fs-writeFile', outputPath, renderedContent)

        successCount++
        console.log(`Generated: ${config.tempaltePath} -> ${config.generatePath}`)
      } catch (error: any) {
        // 遇到错误立即停止并显示错误信息
        let formattedError: string
        try {
          formattedError = await formatHandlebarsError(error, templatePath)
        } catch {
          formattedError = getCleanErrorMessage(error)
        }
        const errorMsg = `Failed to generate ${config.tempaltePath}:\n\n${formattedError}`
        ElMessageBox({
          title: 'Generation Failed',
          message: h(
            'div',
            {
              style:
                'font-family: monospace; white-space: pre-wrap; text-align: left; max-width: 600px;'
            },
            errorMsg
          ),
          confirmButtonText: 'OK',
          type: 'error',
          buttonSize: 'small',
          appendTo: '#tester'
        })
        return // 立即返回，停止处理后续模板
      }
    }

    // 所有模板处理成功
    ElMessage({
      message: `Successfully generated ${successCount} file(s)`,
      type: 'success',
      appendTo: '#tester'
    })
  } catch (error: any) {
    ElMessageBox.alert(getCleanErrorMessage(error), 'Code Generation Failed', {
      confirmButtonText: 'OK',
      type: 'error',
      buttonSize: 'small',
      appendTo: '#tester'
    })
  } finally {
    buildLoading.value = false
  }
}

async function copyPreviewToClipboard() {
  try {
    await copy()
    ElMessage({
      message: 'Copied to clipboard!',
      type: 'success',
      appendTo: '#tester'
    })
  } catch (err) {
    ElMessage({
      message: 'Failed to copy to clipboard',
      type: 'error',
      appendTo: '#tester'
    })
  }
}
const errors = ref<Record<number, any>>({})
const onSubmit = async () => {
  try {
    errors.value = {}
    for (let i = 0; i < Object.values(addrRef.value).length; i++) {
      await addrRef.value[i]?.dataValid().catch((e: any) => {
        errors.value[i] = e
      })
    }
    await ruleFormRef.value?.validate()
    if (Object.keys(errors.value).length > 0) {
      return false
    }
    dataBase.tester[editIndex.value].address = cloneDeep(data.value.address)
    dataBase.tester[editIndex.value].name = data.value.name
    dataBase.tester[editIndex.value].script = data.value.script
    dataBase.tester[editIndex.value].udsTime = cloneDeep(data.value.udsTime)
    dataBase.tester[editIndex.value].simulateBy = data.value.simulateBy
    dataBase.tester[editIndex.value].enableCodeGen = data.value.enableCodeGen
    dataBase.tester[editIndex.value].generateConfigs = cloneDeep(data.value.generateConfigs)

    emits('change', editIndex.value, data.value.name)
    return true
  } catch (e) {
    return false
  }
}

let watcher: any

const buildStatus = ref<string | undefined>()

// 预览相关状态
const previewDialogVisible = ref(false)
const previewContent = ref('')
const previewLoading = ref(false)
const currentPreviewTemplate = ref('')
const { copy } = useClipboard({ source: previewContent })

// 提取清晰的错误信息
function getCleanErrorMessage(error: any): string {
  let errorMsg = error.message || error.toString()

  // 处理 IPC 调用错误，提取实际的错误信息
  if (errorMsg.startsWith('Error invoking remote method')) {
    const match = errorMsg.match(/Error: ([^:]+: .+)$/)
    if (match) {
      errorMsg = match[1]
    }
  }

  return errorMsg
}

// 格式化Handlebars解析错误，显示代码上下文
async function formatHandlebarsError(error: any, templatePath: string): Promise<string> {
  const errorMsg = error.message || error.toString()

  // 检查是否是Handlebars解析错误
  const lineMatch = errorMsg.match(/Parse error on line (\d+):/)
  if (!lineMatch) {
    return getCleanErrorMessage(error)
  }

  const errorLine = parseInt(lineMatch[1])

  try {
    // 读取模板文件内容
    const templateContent = await window.electron.ipcRenderer.invoke(
      'ipc-fs-readFile',
      templatePath
    )
    const lines = templateContent.split('\n')

    // 确定显示范围（出错行的前后3行）
    const contextLines = 3
    const startLine = Math.max(0, errorLine - contextLines - 1)
    const endLine = Math.min(lines.length - 1, errorLine + contextLines - 1)

    // 构建代码上下文
    let codeContext = ''
    for (let i = startLine; i <= endLine; i++) {
      const lineNum = i + 1
      const isErrorLine = lineNum === errorLine
      const prefix = isErrorLine ? '>>> ' : '    '
      const lineContent = lines[i] || ''
      codeContext += `${prefix}${lineNum.toString().padStart(3, ' ')}: ${lineContent}\n`
    }

    return `🚫 Template Parse Error on Line ${errorLine}
📝 Code Context:
${codeContext}
💾 File: ${templatePath}`
  } catch (fileError) {
    // 如果无法读取文件，返回原始错误
    return getCleanErrorMessage(error)
  }
}
onBeforeMount(() => {
  if (editIndex.value) {
    const editData = dataBase.tester[editIndex.value]
    if (editData) {
      data.value = cloneDeep(editData)
      if (data.value.address.length > 0) activeTabName.value = `index${0}`

      //check simulateBy exist
      if (data.value.simulateBy) {
        const node = dataBase.nodes[data.value.simulateBy]
        if (!node) {
          data.value.simulateBy = undefined
        }
      }
    } else {
      editIndex.value = ''
      data.value.name = `Tester ${props.type}_${Object.keys(dataBase.tester).length}`
    }
    refreshBuildStatus()
  } else {
    editIndex.value = ''
    data.value.name = `Tester_${props.type}_${Object.keys(dataBase.tester).length}`
  }

  watcher = watch(
    data,
    () => {
      onSubmit()
    },
    { deep: true }
  )
})
onUnmounted(() => {
  watcher()
})
</script>
<style scoped>
.hardware {
  margin: 20px;
}

.custom-tabs-label {
  width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  height: 20px;
}

.lr {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
}

.vm {
  display: flex;
  align-items: center;
  /* 垂直居中对齐 */
  gap: 4px;
}

.addrError {
  color: var(--el-color-danger);
  font-weight: bold;
}

.buildStatus {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
}

.copy-btn {
  position: absolute;
  top: 0px;
  right: -5px;
  z-index: 1;
}
</style>
