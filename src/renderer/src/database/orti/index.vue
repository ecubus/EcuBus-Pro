<template>
  <div v-loading="loading">
    <el-tabs v-if="!loading" v-model="editableTabsValue" class="dbcTabs" type="card" addable>
      <template #add-icon>
        <el-tooltip effect="light" content="Delete Database" placement="bottom">
          <el-button type="info" link @click="deleteDatabase">
            <Icon :icon="deleteIcon" />
          </el-button>
        </el-tooltip>
        <el-tooltip effect="light" content="Save Database" placement="bottom">
          <el-button type="success" link @click="saveDataBase">
            <Icon :icon="saveIcon" :disabled="globalStart" />
          </el-button>
        </el-tooltip>
      </template>
      <el-tab-pane name="Overview" label="Overview">
        <el-form
          ref="formRef"
          :model="dbcObj"
          label-width="100px"
          size="small"
          style="margin: 20px"
        >
          <el-form-item label="Name">
            <el-input v-model="dbcObj.name" />
          </el-form-item>
          <el-form-item> </el-form-item>
        </el-form>
      </el-tab-pane>
      <el-tab-pane name="Connector" label="Connector">
        <el-form
          ref="connectorFormRef"
          :model="connectorForm"
          label-width="120px"
          size="small"
          class="connector-form"
          style="margin: 20px"
        >
          <el-form-item label="Type" required>
            <el-select
              v-model="connectorForm.type"
              placeholder="Select connector type"
              style="width: 200px"
              @change="onConnectorTypeChange"
            >
              <el-option label="SerialPort" value="SerialPort" />
              <el-option label="CAN" value="CAN" disabled />
              <el-option label="ETH" value="ETH" disabled />
            </el-select>
          </el-form-item>

          <el-form-item v-if="connectorForm.type" label="Device">
            <el-select
              v-model="connectorForm.device"
              placeholder="Select device"
              style="width: 300px"
              filterable
            >
              <el-option
                v-for="device in deviceList"
                :key="device.value"
                :label="device.label"
                :value="device.value"
              />
              <template #footer>
                <el-button
                  text
                  style="float: right; margin-bottom: 10px"
                  size="small"
                  icon="RefreshRight"
                  @click="refreshDeviceList"
                >
                  Refresh
                </el-button>
              </template>
            </el-select>
          </el-form-item>

          <!-- SerialPort specific options -->
          <template v-if="connectorForm.type === 'SerialPort'">
            <el-form-item label="Baud Rate">
              <el-select
                v-model="connectorForm.options.baudRate"
                placeholder="Select baud rate"
                style="width: 150px"
              >
                <el-option label="9600" value="9600" />
                <el-option label="19200" value="19200" />
                <el-option label="38400" value="38400" />
                <el-option label="57600" value="57600" />
                <el-option label="115200" value="115200" />
                <el-option label="230400" value="230400" />
                <el-option label="460800" value="460800" />
                <el-option label="921600" value="921600" />
              </el-select>
            </el-form-item>

            <el-form-item label="Data Bits">
              <el-select
                v-model="connectorForm.options.dataBits"
                placeholder="Select data bits"
                style="width: 150px"
              >
                <el-option label="5" value="5" />
                <el-option label="6" value="6" />
                <el-option label="7" value="7" />
                <el-option label="8" value="8" />
              </el-select>
            </el-form-item>

            <el-form-item label="Stop Bits">
              <el-select
                v-model="connectorForm.options.stopBits"
                placeholder="Select stop bits"
                style="width: 150px"
              >
                <el-option label="1" value="1" />
                <el-option label="1.5" value="1.5" />
                <el-option label="2" value="2" />
              </el-select>
            </el-form-item>

            <el-form-item label="Parity">
              <el-select
                v-model="connectorForm.options.parity"
                placeholder="Select parity"
                style="width: 150px"
              >
                <el-option label="None" value="none" />
                <el-option label="Even" value="even" />
                <el-option label="Odd" value="odd" />
                <el-option label="Mark" value="mark" />
                <el-option label="Space" value="space" />
              </el-select>
            </el-form-item>

            <el-form-item label="Flow Control">
              <el-select
                v-model="connectorForm.options.flowControl"
                placeholder="Select flow control"
                style="width: 150px"
              >
                <el-option label="None" value="none" />
                <el-option label="Hardware" value="hardware" />
                <el-option label="Software" value="software" />
              </el-select>
            </el-form-item>
          </template>

          <template v-if="connectorForm.type === 'CAN'">
            <el-form-item label="Bit Rate">
              <el-input
                v-model="connectorForm.options.bitRate"
                placeholder="Enter bit rate (e.g., 500000)"
                disabled
                style="width: 200px"
              />
            </el-form-item>
          </template>

          <!-- ETH specific options (disabled for now) -->
          <template v-if="connectorForm.type === 'ETH'">
            <el-form-item label="IP Address">
              <el-input
                v-model="connectorForm.options.ipAddress"
                placeholder="Enter IP address"
                disabled
                style="width: 200px"
              />
            </el-form-item>
            <el-form-item label="Port">
              <el-input
                v-model="connectorForm.options.port"
                placeholder="Enter port number"
                disabled
                style="width: 150px"
              />
            </el-form-item>
          </template>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  toRef,
  inject,
  provide,
  Ref
} from 'vue'

import saveIcon from '@iconify/icons-material-symbols/save'
import deleteIcon from '@iconify/icons-material-symbols/delete'

import { Icon } from '@iconify/vue'
import { Layout } from '@r/views/uds/layout'
import { useDataStore } from '@r/stores/data'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { assign, cloneDeep } from 'lodash'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { ORTIFile, parseORTI } from '../ortiParse'
import { useGlobalStart } from '@r/stores/runtime'

const layout = inject('layout') as Layout

const props = defineProps<{
  ortiFile?: string
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

const dbcObj = ref<ORTIFile>() as Ref<ORTIFile>

const globalStart = useGlobalStart()

// Connector form data
const connectorFormRef = ref()
const connectorForm = ref({
  type: 'SerialPort',
  device: '',
  options: {
    // SerialPort options
    baudRate: '115200',
    dataBits: '8',
    stopBits: '1',
    parity: 'none',
    flowControl: 'none',
    // CAN options
    bitRate: '',
    // ETH options
    ipAddress: '',
    port: ''
  }
})

// Initialize connector form from dbcObj
function initializeConnectorForm() {
  if (dbcObj.value?.connector) {
    connectorForm.value.type = dbcObj.value.connector.type || ''
    connectorForm.value.device = dbcObj.value.connector.device || ''
    connectorForm.value.options = {
      ...connectorForm.value.options,
      ...dbcObj.value.connector.options
    }
  }
}

// Handle connector type change
function onConnectorTypeChange(type: string) {
  // Reset options when type changes
  connectorForm.value.device = ''

  // Refresh device list for SerialPort
  if (type === 'SerialPort') {
    getSerialPortList()
  }
  if (type === 'SerialPort') {
    connectorForm.value.options = {
      baudRate: '115200',
      dataBits: '8',
      stopBits: '1',
      parity: 'none',
      flowControl: 'none',
      bitRate: '',
      ipAddress: '',
      port: ''
    }
  } else if (type === 'CAN') {
    connectorForm.value.options = {
      baudRate: '',
      dataBits: '',
      stopBits: '',
      parity: '',
      flowControl: '',
      bitRate: '500000',
      ipAddress: '',
      port: ''
    }
  } else if (type === 'ETH') {
    connectorForm.value.options = {
      baudRate: '',
      dataBits: '',
      stopBits: '',
      parity: '',
      flowControl: '',
      bitRate: '',
      ipAddress: '192.168.1.100',
      port: '8080'
    }
  }
}

// Update dbcObj connector when form changes
watch(
  connectorForm,
  (newVal) => {
    if (dbcObj.value) {
      dbcObj.value.connector = {
        type: newVal.type,
        device: newVal.device,
        options: { ...newVal.options }
      }
      // Mark window as modified
      layout.setWinModified(props.editIndex, true)
    }
  },
  { deep: true }
)

const deviceList = ref<
  {
    label: string
    value: string
  }[]
>([])
const refreshing = ref(false)

async function getSerialPortList() {
  deviceList.value = []

  const list = await window.electron.ipcRenderer.invoke('ipc-get-serial-port-list')

  list.forEach((item) => {
    deviceList.value.push({
      label: `${item.path} (${item.manufacturer || 'Unknown'})`,
      value: item.path
    })
  })
  // deviceList.value = list
}

async function refreshDeviceList() {
  refreshing.value = true
  try {
    await getSerialPortList()
  } finally {
    refreshing.value = false
  }
}

const existed = computed(() => {
  let existed = false
  if (database.database && database.database.orti) {
    existed = database.database.orti[props.editIndex] ? true : false
  }
  return existed
})

function deleteDatabase() {
  ElMessageBox.confirm('Are you sure you want to delete this database?', 'Warning', {
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    buttonSize: 'small',
    appendTo: `#win${props.editIndex}`,
    type: 'warning'
  })
    .then(() => {
      database.$patch(() => {
        delete database.database.orti[props.editIndex]
      })
      layout.removeWin(props.editIndex, true)
      layout.removeWin(`${props.editIndex}_trace`, true)
    })
    .catch(null)
}
function saveDataBase() {
  // Check for duplicate database name
  const isDuplicateName = Object.entries(database.database.orti).some(([key, db]) => {
    // Skip comparing with itself
    if (key === props.editIndex) return false
    return db.name === dbcObj.value.name
  })

  if (isDuplicateName) {
    ElNotification({
      offset: 50,
      type: 'error',
      message: `Database name "${dbcObj.value.name}" already exists`,
      appendTo: `#win${props.editIndex}`
    })
    return
  }

  database.$patch(() => {
    const db = cloneDeep(dbcObj.value)
    db.id = props.editIndex
    // Ensure connector data is properly saved
    if (connectorForm.value.type) {
      db.connector = {
        type: connectorForm.value.type,
        device: connectorForm.value.device,
        options: { ...connectorForm.value.options }
      }
    }
    database.database.orti[props.editIndex] = db
  })
  layout.changeWinName(props.editIndex, dbcObj.value.name)
  layout.changeWinName(`${props.editIndex}_trace`, dbcObj.value.name)
  layout.setWinModified(props.editIndex, false)

  ElNotification({
    offset: 50,
    type: 'success',
    message: 'The database has been saved successfully',
    appendTo: `#win${props.editIndex}`
  })
}
function handleTabSwitch(tabName: string) {
  editableTabsValue.value = tabName
}

const loading = ref(true)

onMounted(() => {
  // Initialize device list for SerialPort
  getSerialPortList()

  // Add your onMounted logic here
  if (!existed.value && props.ortiFile) {
    loading.value = true
    window.electron.ipcRenderer
      .invoke('ipc-fs-readFile', props.ortiFile)
      .then((content: string) => {
        const result = parseORTI(content)
        if (result.success && result.data) {
          dbcObj.value = result.data
          dbcObj.value.name = window.path.parse(props.ortiFile!).name
          initializeConnectorForm()
        } else {
          ElMessageBox.alert('Parse failed', 'Error', {
            confirmButtonText: 'OK',
            type: 'error',
            buttonSize: 'small',
            appendTo: `#win${props.editIndex}`,
            message: `<pre style="max-height:200px;overflow:auto;width:380px;font-size:12px;line-height:16px">
${result.errors[0].line ?? ''}${result.errors[0].line ? ':' : ''}${result.errors[0].column ?? ''}${result.errors[0].column ? ':\\n' : ''}
${result.errors[0].message}
</pre>`,
            dangerouslyUseHTMLString: true
          }).finally(() => {
            layout.removeWin(props.editIndex, true)
          })
        }
        loading.value = false
      })
      .catch((err) => {
        ElMessageBox.alert('Parse failed', 'Error', {
          confirmButtonText: 'OK',
          type: 'error',
          buttonSize: 'small',
          appendTo: `#win${props.editIndex}`,
          message: err.message
        })
          .then(() => {
            layout.removeWin(props.editIndex, true)
          })
          .catch(null)
      })
  } else {
    dbcObj.value = cloneDeep(database.database.orti[props.editIndex])
    initializeConnectorForm()
    loading.value = false
    nextTick(() => {
      layout.setWinModified(props.editIndex, false)
    })
  }
})
</script>

<style lang="scss">
.dbcTabs {
  margin-right: 5px;

  .el-tabs__header {
    margin-bottom: 0px !important;
  }

  .el-tabs__new-tab {
    width: 60px !important;
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

// Connector form styles
.connector-form {
  .el-form-item {
    margin-bottom: 18px;
  }

  .el-form-item__label {
    font-weight: 500;
  }

  .el-select,
  .el-input {
    .el-input__wrapper {
      border-radius: 4px;
    }
  }

  .device-selector {
    display: flex;
    align-items: center;
    gap: 8px;

    .refresh-btn {
      flex-shrink: 0;
      min-width: 32px;
      height: 32px;
    }
  }
}
</style>
