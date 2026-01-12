<template>
  <div v-loading="loading">
    <el-tabs v-if="!loading" v-model="editableTabsValue" class="dbcTabs" type="card" addable>
      <template #add-icon>
        <el-tooltip
          effect="light"
          :content="i18next.t('database.orti.index.tooltips.deleteDatabase')"
          placement="bottom"
        >
          <el-button type="info" link @click="deleteDatabase">
            <Icon :icon="deleteIcon" />
          </el-button>
        </el-tooltip>
        <el-tooltip
          effect="light"
          :content="i18next.t('database.orti.index.tooltips.saveDatabase')"
          placement="bottom"
        >
          <el-button type="success" link @click="saveDataBase">
            <Icon :icon="saveIcon" :disabled="globalStart" />
          </el-button>
        </el-tooltip>
      </template>
      <el-tab-pane name="TASK/ISR" :label="i18next.t('database.orti.index.tabs.taskIsr')">
        <div>
          <vxe-grid
            ref="coreConfigGridRef"
            v-bind="coreConfigGridOptions"
            v-model:data="dbcObj.coreConfigs"
            :height="h - 40"
          >
            <template #edit_type="{ row }">
              <el-select v-model="row.type" size="small" style="width: 100%">
                <el-option :label="i18next.t('database.orti.index.values.task')" :value="0" />
                <el-option :label="i18next.t('database.orti.index.values.isr')" :value="1" />
              </el-select>
            </template>
            <template #edit_color="{ row }">
              <el-color-picker v-model="row.color" size="small" :teleported="false" />
            </template>
            <template #default_color="{ row }">
              <div
                :style="{
                  width: '20px',
                  height: '20px',
                  backgroundColor: row.color,
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  margin: '0 auto'
                }"
              ></div>
            </template>
            <template #default_buttons="{ rowIndex }">
              <!-- delete row -->
              <el-button type="danger" link @click="deleteRow(rowIndex)">
                <Icon :icon="deleteIcon" />
              </el-button>
            </template>
            <template #toolbar>
              <div
                style="
                  justify-content: flex-start;
                  display: flex;
                  align-items: center;
                  gap: 2px;
                  height: 34px;
                "
              >
                <span style="padding-left: 5px; padding-right: 5px"
                  >{{ i18next.t('database.orti.index.labels.name') }}:</span
                >
                <el-input
                  v-model="dbcObj.name"
                  :placeholder="i18next.t('database.orti.index.placeholders.enterName')"
                  style="width: 150px"
                  size="small"
                />
                <el-divider direction="vertical" />
                <!-- cpuFreq -->
                <span style="padding-left: 5px; padding-right: 5px"
                  >{{ i18next.t('database.orti.index.labels.cpuFreq') }}:</span
                >
                <el-input-number
                  v-model="dbcObj.cpuFreq"
                  :placeholder="i18next.t('database.orti.index.placeholders.enterCpuFrequency')"
                  style="width: 100px"
                  size="small"
                  :step="1"
                />

                <el-divider direction="vertical" />
                <!-- add row -->
                <el-button type="primary" link @click="addRow">
                  <Icon :icon="addIcon" /><span>{{
                    i18next.t('database.orti.index.buttons.addTaskIsr')
                  }}</span>
                </el-button>
              </div>
            </template>
          </vxe-grid>
        </div>
      </el-tab-pane>
      <el-tab-pane name="Resource" :label="i18next.t('database.orti.index.tabs.resource')">
        <div>
          <vxe-grid
            ref="resourceConfigGridRef"
            v-bind="resourceConfigGridOptions"
            v-model:data="dbcObj.resourceConfigs"
            :height="h - 40"
          >
            <template #resource_buttons="{ rowIndex }">
              <el-button type="danger" link @click="deleteResourceRow(rowIndex)">
                <Icon :icon="deleteIcon" />
              </el-button>
            </template>
            <template #resource_toolbar>
              <div
                style="
                  justify-content: flex-start;
                  display: flex;
                  align-items: center;
                  gap: 2px;
                  height: 34px;
                "
              >
                <el-button type="primary" link @click="addResourceRow">
                  <Icon :icon="addIcon" /><span>{{
                    i18next.t('database.orti.index.buttons.addResource')
                  }}</span>
                </el-button>
              </div>
            </template>
          </vxe-grid>
        </div>
      </el-tab-pane>
      <el-tab-pane name="Service" :label="i18next.t('database.orti.index.tabs.service')">
        <div>
          <vxe-grid
            ref="serviceConfigGridRef"
            v-bind="serviceConfigGridOptions"
            v-model:data="dbcObj.serviceConfigs"
            :height="h - 40"
          >
            <template #service_buttons="{ rowIndex }">
              <el-button type="danger" link @click="deleteServiceRow(rowIndex)">
                <Icon :icon="deleteIcon" />
              </el-button>
            </template>
            <template #service_toolbar>
              <div
                style="
                  justify-content: flex-start;
                  display: flex;
                  align-items: center;
                  gap: 2px;
                  height: 34px;
                "
              >
                <el-button type="primary" link @click="addServiceRow">
                  <Icon :icon="addIcon" /><span>{{
                    i18next.t('database.orti.index.buttons.addService')
                  }}</span>
                </el-button>
              </div>
            </template>
          </vxe-grid>
        </div>
      </el-tab-pane>
      <el-tab-pane name="Hook" :label="i18next.t('database.orti.index.tabs.hook')">
        <div>
          <vxe-grid
            ref="hookConfigGridRef"
            v-bind="hookConfigGridOptions"
            v-model:data="dbcObj.hostConfigs"
            :height="h - 40"
          >
            <template #hook_buttons="{ rowIndex }">
              <el-button type="danger" link @click="deleteHookRow(rowIndex)">
                <Icon :icon="deleteIcon" />
              </el-button>
            </template>
            <template #hook_toolbar>
              <div
                style="
                  justify-content: flex-start;
                  display: flex;
                  align-items: center;
                  gap: 2px;
                  height: 34px;
                "
              >
                <el-button type="primary" link @click="addHookRow">
                  <Icon :icon="addIcon" /><span>{{
                    i18next.t('database.orti.index.buttons.addHook')
                  }}</span>
                </el-button>
              </div>
            </template>
          </vxe-grid>
        </div>
      </el-tab-pane>
      <el-tab-pane name="Connector" :label="i18next.t('database.orti.index.tabs.connector')">
        <el-form
          ref="connectorFormRef"
          :model="connectorForm"
          :rules="connectorFormRules"
          label-width="120px"
          size="small"
          class="connector-form"
          style="margin: 20px"
        >
          <el-form-item
            :label="i18next.t('database.orti.index.connector.type')"
            prop="type"
            required
          >
            <el-select
              v-model="connectorForm.type"
              :placeholder="i18next.t('database.orti.index.connector.selectType')"
              style="width: 200px"
              @change="onConnectorTypeChange"
            >
              <el-option
                :label="i18next.t('database.orti.index.connector.types.serialPort')"
                value="SerialPort"
              />
              <el-option
                :label="i18next.t('database.orti.index.connector.types.binaryFile')"
                value="BinaryFile"
              />
              <el-option
                :label="i18next.t('database.orti.index.connector.types.csvFile')"
                value="CSVFile"
              />
              <el-option
                :label="i18next.t('database.orti.index.connector.types.can')"
                value="CAN"
                disabled
              />
              <el-option
                :label="i18next.t('database.orti.index.connector.types.eth')"
                value="ETH"
                disabled
              />
            </el-select>
          </el-form-item>

          <!-- SerialPort specific options -->
          <template v-if="connectorForm.type === 'SerialPort'">
            <el-form-item
              v-if="connectorForm.type"
              :label="i18next.t('database.orti.index.connector.device')"
              prop="device"
            >
              <el-select
                v-model="connectorForm.device"
                :placeholder="i18next.t('database.orti.index.connector.selectDevice')"
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
                    {{ i18next.t('database.orti.index.buttons.refresh') }}
                  </el-button>
                </template>
              </el-select>
            </el-form-item>
            <el-form-item
              :label="i18next.t('database.orti.index.connector.baudRate')"
              prop="options.baudRate"
            >
              <el-select
                v-model="connectorForm.options.baudRate"
                :placeholder="i18next.t('database.orti.index.connector.selectBaudRate')"
                filterable
                allow-create
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
                <el-option label="2000000" value="2000000" />
                <el-option label="4000000" value="4000000" />
              </el-select>
            </el-form-item>

            <el-form-item :label="i18next.t('database.orti.index.connector.dataBits')">
              <el-select
                v-model="connectorForm.options.dataBits"
                :placeholder="i18next.t('database.orti.index.connector.selectDataBits')"
                style="width: 150px"
              >
                <el-option label="5" value="5" />
                <el-option label="6" value="6" />
                <el-option label="7" value="7" />
                <el-option label="8" value="8" />
              </el-select>
            </el-form-item>

            <el-form-item :label="i18next.t('database.orti.index.connector.stopBits')">
              <el-select
                v-model="connectorForm.options.stopBits"
                :placeholder="i18next.t('database.orti.index.connector.selectStopBits')"
                style="width: 150px"
              >
                <el-option label="1" value="1" />
                <el-option label="1.5" value="1.5" />
                <el-option label="2" value="2" />
              </el-select>
            </el-form-item>

            <el-form-item :label="i18next.t('database.orti.index.connector.parity')">
              <el-select
                v-model="connectorForm.options.parity"
                :placeholder="i18next.t('database.orti.index.connector.selectParity')"
                style="width: 150px"
              >
                <el-option
                  :label="i18next.t('database.orti.index.connector.parityOptions.none')"
                  value="none"
                />
                <el-option
                  :label="i18next.t('database.orti.index.connector.parityOptions.even')"
                  value="even"
                />
                <el-option
                  :label="i18next.t('database.orti.index.connector.parityOptions.odd')"
                  value="odd"
                />
                <el-option
                  :label="i18next.t('database.orti.index.connector.parityOptions.mark')"
                  value="mark"
                />
                <el-option
                  :label="i18next.t('database.orti.index.connector.parityOptions.space')"
                  value="space"
                />
              </el-select>
            </el-form-item>
          </template>

          <template v-if="connectorForm.type === 'CAN'">
            <el-form-item :label="i18next.t('database.orti.index.connector.bitRate')">
              <el-input
                v-model="connectorForm.options.bitRate"
                :placeholder="i18next.t('database.orti.index.connector.enterBitRate')"
                disabled
                style="width: 200px"
              />
            </el-form-item>
          </template>

          <!-- ETH specific options (disabled for now) -->
          <template v-if="connectorForm.type === 'ETH'">
            <el-form-item :label="i18next.t('database.orti.index.connector.ipAddress')">
              <el-input
                v-model="connectorForm.options.ipAddress"
                :placeholder="i18next.t('database.orti.index.connector.enterIpAddress')"
                disabled
                style="width: 200px"
              />
            </el-form-item>
            <el-form-item :label="i18next.t('database.orti.index.connector.port')">
              <el-input
                v-model="connectorForm.options.port"
                :placeholder="i18next.t('database.orti.index.connector.enterPort')"
                disabled
                style="width: 150px"
              />
            </el-form-item>
          </template>

          <template v-if="connectorForm.type === 'BinaryFile' || connectorForm.type === 'CSVFile'">
            <el-form-item
              :label="i18next.t('database.orti.index.connector.file')"
              prop="options.file"
            >
              <el-input
                v-model="connectorForm.options.file"
                :placeholder="i18next.t('database.orti.index.connector.enterFilePath')"
                style="width: 80%"
              >
                <template #append>
                  <el-button type="primary" link @click="chooseFile">
                    <Icon :icon="newIcon" />
                  </el-button>
                </template>
              </el-input>
            </el-form-item>
          </template>
        </el-form>
      </el-tab-pane>
      <el-tab-pane name="Record File" :label="i18next.t('database.orti.index.tabs.recordFile')">
        <el-form
          ref="recordFileFormRef"
          :model="recordFileForm"
          label-width="120px"
          size="small"
          class="connector-form"
          style="margin: 20px"
        >
          <el-form-item :label="i18next.t('database.orti.index.recordFile.enableRecord')">
            <el-switch v-model="recordFileForm.enable" />
            <span style="margin-left: 10px; color: var(--el-text-color-secondary); font-size: 12px">
              {{ i18next.t('database.orti.index.recordFile.enableRecordDescription') }}
            </span>
          </el-form-item>

          <el-form-item :label="i18next.t('database.orti.index.recordFile.fileName')" prop="name">
            <el-input
              v-model="recordFileForm.name"
              :placeholder="i18next.t('database.orti.index.recordFile.enterFileName')"
              style="width: 80%"
            >
              <template #append>
                <el-button type="primary" link @click="chooseRecordFile">
                  <Icon :icon="newIcon" />
                </el-button>
              </template>
            </el-input>
          </el-form-item>
          <el-alert type="info" :closable="false" show-icon style="margin-top: 20px">
            <template #title>
              <span v-html="i18next.t('database.orti.index.recordFile.alertMessage')"></span>
            </template>
          </el-alert>
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
import addIcon from '@iconify/icons-material-symbols/add'
import newIcon from '@iconify/icons-material-symbols/new-window'
import { Icon } from '@iconify/vue'
import { Layout } from '@r/views/uds/layout'
import { useDataStore } from '@r/stores/data'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { assign, cloneDeep } from 'lodash'
import { VxeGrid, VxeGridProps, VxeGridInstance } from 'vxe-table'
import { ORTIFile, parseORTI } from '../ortiParse'
import { useGlobalStart } from '@r/stores/runtime'
import { useProjectStore } from '@r/stores/project'
import i18next from 'i18next'

const layout = inject('layout') as Layout

const props = defineProps<{
  ortiFile?: string
  editIndex: string
  height: number
  width: number
}>()

const overfiewRef = ref()
const coreConfigGridRef = ref<VxeGridInstance>()
const resourceConfigGridRef = ref<VxeGridInstance>()
const serviceConfigGridRef = ref<VxeGridInstance>()
const hookConfigGridRef = ref<VxeGridInstance>()

const h = toRef(props, 'height')
const w = toRef(props, 'width')
const editableTabsValue = ref('TASK/ISR')
provide('height', h)
const database = useDataStore()

const dbcObj = ref<ORTIFile>() as Ref<ORTIFile>

const globalStart = useGlobalStart()

// Core configs grid configuration
const coreConfigGridOptions = ref<VxeGridProps>({
  border: true,
  stripe: true,
  resizable: true,
  showHeaderOverflow: true,
  showOverflow: true,
  keepSource: true,
  size: 'mini',
  id: 'coreConfigGrid',
  rowConfig: {
    isHover: true
  },
  columnConfig: {
    resizable: true
  },
  sortConfig: {
    trigger: 'cell',
    remote: false
  },
  filterConfig: {
    remote: false
  },
  editConfig: {
    trigger: 'click',
    mode: 'cell',
    showStatus: true,
    beforeEditMethod: ({ row, column }) => {
      // Only allow editing activeInterval for Task (type=0)
      if (column.field === 'activeInterval' && row.type !== 0) {
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
  columns: [
    {
      align: 'center',
      title: '#',
      width: 50,
      type: 'seq',
      resizable: false
    },
    {
      align: 'center',
      field: 'name',
      title: i18next.t('database.orti.index.columns.name'),
      width: 200,
      editRender: { name: 'input' }
    },
    {
      field: 'id',
      title: i18next.t('database.orti.index.columns.id'),
      align: 'center',
      minWidth: 60,
      editRender: { name: 'input', attrs: { type: 'number' } }
    },
    {
      field: 'coreId',
      title: i18next.t('database.orti.index.columns.coreId'),
      width: 80,
      align: 'center',
      editRender: { name: 'input', attrs: { type: 'number' } }
    },
    {
      align: 'center',
      field: 'type',
      title: i18next.t('database.orti.index.columns.type'),
      width: 100,
      editRender: {},
      slots: { edit: 'edit_type' },
      formatter: ({ cellValue }) => {
        return cellValue === 0
          ? i18next.t('database.orti.index.values.task')
          : cellValue === 1
            ? i18next.t('database.orti.index.values.isr')
            : cellValue
      }
    },

    {
      align: 'center',
      field: 'activeInterval',
      title: i18next.t('database.orti.index.columns.activeInterval'),
      width: 150,
      editRender: {
        name: 'input',
        attrs: { type: 'number', min: 0 }
      },
      formatter: ({ row, cellValue }) => {
        if (row.type !== 0) {
          return '-'
        }
        return cellValue !== undefined ? cellValue : ''
      }
    },
    {
      align: 'center',
      field: 'color',
      title: i18next.t('database.orti.index.columns.color'),
      width: 120,

      editRender: {},
      slots: { edit: 'edit_color', default: 'default_color' }
    },
    {
      align: 'center',
      field: 'buttons',
      title: '',
      width: 50,
      fixed: 'right',
      slots: { default: 'default_buttons' }
    }
  ]
})

function deleteRow(rowIndex: number) {
  dbcObj.value?.coreConfigs.splice(rowIndex, 1)
}

function addRow() {
  dbcObj.value?.coreConfigs.push({
    id: 0,
    name: `Task_${dbcObj.value?.coreConfigs.length}`,
    coreId: 0,
    type: 0,
    color: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)})`
  })
}

// Resource configs grid configuration
const resourceConfigGridOptions = ref<VxeGridProps>({
  border: true,
  stripe: true,
  resizable: true,
  showHeaderOverflow: true,
  showOverflow: true,
  keepSource: true,
  size: 'mini',
  id: 'resourceConfigGrid',
  rowConfig: {
    isHover: true
  },
  columnConfig: {
    resizable: true
  },
  sortConfig: {
    trigger: 'cell',
    remote: false
  },
  filterConfig: {
    remote: false
  },
  editConfig: {
    trigger: 'click',
    mode: 'cell',
    showStatus: true
  },
  toolbarConfig: {
    slots: {
      tools: 'resource_toolbar'
    }
  },
  columns: [
    {
      align: 'center',
      title: '#',
      width: 50,
      type: 'seq',
      resizable: false
    },
    {
      align: 'center',
      field: 'name',
      title: i18next.t('database.orti.index.columns.name'),
      editRender: { name: 'input' }
    },
    {
      field: 'id',
      title: i18next.t('database.orti.index.columns.id'),
      align: 'center',
      width: 100,
      editRender: { name: 'input', attrs: { type: 'number' } }
    },
    {
      field: 'coreId',
      title: i18next.t('database.orti.index.columns.coreId'),
      width: 100,
      align: 'center',
      editRender: { name: 'input', attrs: { type: 'number' } }
    },
    {
      align: 'center',
      field: 'buttons',
      title: '',
      width: 50,
      fixed: 'right',
      slots: { default: 'resource_buttons' }
    }
  ]
})

function deleteResourceRow(rowIndex: number) {
  dbcObj.value?.resourceConfigs.splice(rowIndex, 1)
}

function addResourceRow() {
  dbcObj.value?.resourceConfigs.push({
    id: dbcObj.value?.resourceConfigs.length || 0,
    name: `Resource_${dbcObj.value?.resourceConfigs.length}`,
    coreId: 0
  })
}

// Service configs grid configuration
const serviceConfigGridOptions = ref<VxeGridProps>({
  border: true,
  stripe: true,
  resizable: true,
  showHeaderOverflow: true,
  showOverflow: true,
  keepSource: true,
  size: 'mini',
  id: 'serviceConfigGrid',
  rowConfig: {
    isHover: true
  },
  columnConfig: {
    resizable: true
  },
  sortConfig: {
    trigger: 'cell',
    remote: false
  },
  filterConfig: {
    remote: false
  },
  editConfig: {
    trigger: 'click',
    mode: 'cell',
    showStatus: true
  },
  toolbarConfig: {
    slots: {
      tools: 'service_toolbar'
    }
  },
  columns: [
    {
      align: 'center',
      title: '#',
      width: 50,
      type: 'seq',
      resizable: false
    },
    {
      align: 'center',
      field: 'name',
      title: i18next.t('database.orti.index.columns.name'),
      minWidth: 250,
      editRender: { name: 'input' }
    },
    {
      field: 'id',
      title: i18next.t('database.orti.index.columns.id'),
      align: 'center',
      width: 100,
      editRender: { name: 'input', attrs: { type: 'number' } }
    },
    {
      align: 'center',
      field: 'buttons',
      title: '',
      width: 50,
      fixed: 'right',
      slots: { default: 'service_buttons' }
    }
  ]
})

function deleteServiceRow(rowIndex: number) {
  dbcObj.value?.serviceConfigs.splice(rowIndex, 1)
}

function addServiceRow() {
  dbcObj.value?.serviceConfigs.push({
    id: dbcObj.value?.serviceConfigs.length || 0,
    name: `Service_${dbcObj.value?.serviceConfigs.length}`
  })
}

// Hook configs grid configuration
const hookConfigGridOptions = ref<VxeGridProps>({
  border: true,
  stripe: true,
  resizable: true,
  showHeaderOverflow: true,
  showOverflow: true,
  keepSource: true,
  size: 'mini',
  id: 'hookConfigGrid',
  rowConfig: {
    isHover: true
  },
  columnConfig: {
    resizable: true
  },
  sortConfig: {
    trigger: 'cell',
    remote: false
  },
  filterConfig: {
    remote: false
  },
  editConfig: {
    trigger: 'click',
    mode: 'cell',
    showStatus: true
  },
  toolbarConfig: {
    slots: {
      tools: 'hook_toolbar'
    }
  },
  columns: [
    {
      align: 'center',
      title: '#',
      width: 50,
      type: 'seq',
      resizable: false
    },
    {
      align: 'center',
      field: 'name',
      title: i18next.t('database.orti.index.columns.name'),
      minWidth: 250,
      editRender: { name: 'input' }
    },
    {
      field: 'id',
      title: i18next.t('database.orti.index.columns.id'),
      align: 'center',
      width: 100,
      editRender: { name: 'input', attrs: { type: 'number' } }
    },
    {
      align: 'center',
      field: 'buttons',
      title: '',
      width: 50,
      fixed: 'right',
      slots: { default: 'hook_buttons' }
    }
  ]
})

function deleteHookRow(rowIndex: number) {
  dbcObj.value?.hostConfigs.splice(rowIndex, 1)
}

function addHookRow() {
  dbcObj.value?.hostConfigs.push({
    id: dbcObj.value?.hostConfigs.length || 0,
    name: `Hook_${dbcObj.value?.hostConfigs.length}`
  })
}
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

    // CAN options
    bitRate: '',
    // ETH options
    ipAddress: '',
    port: '',
    // BinaryFile options
    file: ''
  }
})

// Record File form data
const recordFileFormRef = ref()
const recordFileForm = ref({
  enable: false,
  name: 'processed_log.csv'
})

// Connector form validation rules
const connectorFormRules = computed(() => {
  const rules: any = {
    type: [
      {
        required: true,
        message: i18next.t('database.orti.index.validation.selectConnectorType'),
        trigger: 'change'
      }
    ]
  }

  if (connectorForm.value.type === 'SerialPort') {
    rules.device = [
      {
        required: true,
        message: i18next.t('database.orti.index.validation.selectDevice'),
        trigger: 'change'
      }
    ]
    rules['options.baudRate'] = [
      {
        required: true,
        message: i18next.t('database.orti.index.validation.selectBaudRate'),
        trigger: 'change'
      }
    ]
  } else if (connectorForm.value.type === 'BinaryFile' || connectorForm.value.type === 'CSVFile') {
    rules['options.file'] = [
      {
        required: true,
        message: i18next.t('database.orti.index.validation.selectFile'),
        trigger: 'change'
      }
    ]
  }

  return rules
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

// Initialize record file form from dbcObj
function initializeRecordFileForm() {
  if (dbcObj.value?.recordFile) {
    recordFileForm.value.enable = dbcObj.value.recordFile.enable ?? false
    recordFileForm.value.name = dbcObj.value.recordFile.name || ''
  } else {
    recordFileForm.value.enable = false
    recordFileForm.value.name = ''
  }
}

// Handle connector type change
function onConnectorTypeChange(type: string) {
  // Reset options when type changes
  connectorForm.value.device = ''

  // Clear form validation
  nextTick(() => {
    connectorFormRef.value?.clearValidate()
  })

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

      bitRate: '',
      ipAddress: '',
      port: '',
      file: ''
    }
  } else if (type === 'CAN') {
    connectorForm.value.options = {
      baudRate: '',
      dataBits: '',
      stopBits: '',
      parity: '',

      bitRate: '500000',
      ipAddress: '',
      port: '',
      file: ''
    }
  } else if (type === 'ETH') {
    connectorForm.value.options = {
      baudRate: '',
      dataBits: '',
      stopBits: '',
      parity: '',

      bitRate: '',
      ipAddress: '192.168.1.100',
      port: '8080',
      file: ''
    }
  } else if (connectorForm.value.type === 'BinaryFile' || connectorForm.value.type === 'CSVFile') {
    connectorForm.value.options = {
      baudRate: '',
      dataBits: '',
      stopBits: '',
      parity: '',

      bitRate: '',
      ipAddress: '',
      port: '',
      file: ''
    }
  }
}

async function chooseFile() {
  const project = useProjectStore()
  const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: 'Choose File',
    properties: ['openFile'],
    filters: [
      connectorForm.value.type === 'BinaryFile'
        ? { name: 'Binary', extensions: ['bin'] }
        : { name: 'CSV', extensions: ['csv'] }
    ]
  })

  let file = r.filePaths[0]
  if (file) {
    if (project.projectInfo.path) file = window.path.relative(project.projectInfo.path, file)

    connectorForm.value.options.file = file
  }
}

async function chooseRecordFile() {
  const project = useProjectStore()
  const r = await window.electron.ipcRenderer.invoke('ipc-show-save-dialog', {
    defaultPath: project.projectInfo.path,
    title: 'Choose Record File',
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  })

  let file = r.filePath
  if (file) {
    if (project.projectInfo.path) file = window.path.relative(project.projectInfo.path, file)

    recordFileForm.value.name = file
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

// Update dbcObj recordFile when form changes
watch(
  recordFileForm,
  (newVal) => {
    if (dbcObj.value) {
      dbcObj.value.recordFile = {
        enable: newVal.enable,
        name: newVal.name
      }
      // Mark window as modified
      layout.setWinModified(props.editIndex, true)
    }
  },
  { deep: true }
)

// Watch for changes in coreConfigs to mark window as modified
watch(
  () => dbcObj.value?.coreConfigs,
  () => {
    if (dbcObj.value) {
      layout.setWinModified(props.editIndex, true)
    }
  },
  { deep: true }
)

// Watch for changes in database name to mark window as modified
watch(
  () => dbcObj.value?.name,
  () => {
    if (dbcObj.value) {
      layout.setWinModified(props.editIndex, true)
    }
  }
)

// Watch for changes in resourceConfigs to mark window as modified
watch(
  () => dbcObj.value?.resourceConfigs,
  () => {
    if (dbcObj.value) {
      layout.setWinModified(props.editIndex, true)
    }
  },
  { deep: true }
)

// Watch for changes in serviceConfigs to mark window as modified
watch(
  () => dbcObj.value?.serviceConfigs,
  () => {
    if (dbcObj.value) {
      layout.setWinModified(props.editIndex, true)
    }
  },
  { deep: true }
)

// Watch for changes in hostConfigs to mark window as modified
watch(
  () => dbcObj.value?.hostConfigs,
  () => {
    if (dbcObj.value) {
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
  ElMessageBox.confirm(
    i18next.t('database.orti.index.deleteConfirm.message'),
    i18next.t('database.orti.index.deleteConfirm.title'),
    {
      confirmButtonText: i18next.t('database.orti.index.deleteConfirm.ok'),
      cancelButtonText: i18next.t('database.orti.index.deleteConfirm.cancel'),
      buttonSize: 'small',
      appendTo: `#win${props.editIndex}`,
      type: 'warning'
    }
  )
    .then(() => {
      database.$patch(() => {
        delete database.database.orti[props.editIndex]
      })
      layout.removeWin(props.editIndex, true)
      layout.removeWin(`${props.editIndex}_trace`, true)
      layout.removeWin(`${props.editIndex}_time`, true)
    })
    .catch(null)
}
async function saveDataBase() {
  // Check if name is empty
  if (!dbcObj.value.name || dbcObj.value.name.trim() === '') {
    ElNotification({
      offset: 50,
      type: 'error',
      message: i18next.t('database.orti.index.errors.databaseNameCannotBeEmpty'),
      appendTo: `#win${props.editIndex}`
    })
    return
  }
  //cpu freq can't be 0
  if (dbcObj.value.cpuFreq <= 0) {
    ElNotification({
      offset: 50,
      type: 'error',
      message: i18next.t('database.orti.index.errors.cpuFrequencyCannotBeZero'),
      appendTo: `#win${props.editIndex}`
    })
    return
  }

  // Validate connector form
  try {
    await connectorFormRef.value?.validate()
  } catch (error) {
    // ElNotification({
    //   offset: 50,
    //   type: 'error',
    //   message: 'Please complete the connector configuration',
    //   appendTo: `#win${props.editIndex}`
    // })
    // Switch to Connector tab to show validation errors
    editableTabsValue.value = 'Connector'
    return
  }

  //task 里 ID 不能重复
  const idList = new Set()
  const isrList = new Set()
  for (const task of dbcObj.value.coreConfigs) {
    if (task.type === 0) {
      if (idList.has(`${task.coreId}_${task.id}`)) {
        ElNotification({
          offset: 50,
          type: 'error',
          message: i18next.t('database.orti.index.errors.taskIdAlreadyExists', {
            id: task.id,
            coreId: task.coreId
          }),
          appendTo: `#win${props.editIndex}`
        })
        return
      }
      idList.add(`${task.coreId}_${task.id}`)
    } else if (task.type === 1) {
      if (isrList.has(`${task.coreId}_${task.id}`)) {
        ElNotification({
          offset: 50,
          type: 'error',
          message: i18next.t('database.orti.index.errors.isrIdAlreadyExists', { id: task.id }),
          appendTo: `#win${props.editIndex}`
        })
        return
      }
      isrList.add(`${task.coreId}_${task.id}`)
    }
  }
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
      message: i18next.t('database.orti.index.errors.duplicateDatabaseName', {
        name: dbcObj.value.name
      }),
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
    // Ensure record file data is properly saved
    db.recordFile = {
      enable: recordFileForm.value.enable,
      name: recordFileForm.value.name
    }
    database.database.orti[props.editIndex] = db
  })
  layout.changeWinName(props.editIndex, dbcObj.value.name)
  layout.changeWinName(`${props.editIndex}_trace`, dbcObj.value.name)
  layout.setWinModified(props.editIndex, false)

  ElNotification({
    offset: 50,
    type: 'success',
    message: i18next.t('database.orti.index.messages.saveSuccess'),
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
          initializeRecordFileForm()
        } else {
          ElMessageBox.alert(
            i18next.t('database.orti.index.errors.parseFailed'),
            i18next.t('database.orti.index.errors.error'),
            {
              confirmButtonText: i18next.t('database.orti.index.deleteConfirm.ok'),
              type: 'error',
              buttonSize: 'small',
              appendTo: `#win${props.editIndex}`,
              message: `<pre style="max-height:200px;overflow:auto;width:380px;font-size:12px;line-height:16px">
${result.errors[0].line ?? ''}${result.errors[0].line ? ':' : ''}${result.errors[0].column ?? ''}${result.errors[0].column ? ':\\n' : ''}
${result.errors[0].message}
</pre>`,
              dangerouslyUseHTMLString: true
            }
          ).finally(() => {
            layout.removeWin(props.editIndex, true)
          })
        }
        loading.value = false
      })
      .catch((err) => {
        ElMessageBox.alert(
          i18next.t('database.orti.index.errors.parseFailed'),
          i18next.t('database.orti.index.errors.error'),
          {
            confirmButtonText: i18next.t('database.orti.index.deleteConfirm.ok'),
            type: 'error',
            buttonSize: 'small',
            appendTo: `#win${props.editIndex}`,
            message: err.message
          }
        )
          .then(() => {
            layout.removeWin(props.editIndex, true)
          })
          .catch(null)
      })
  } else {
    dbcObj.value = cloneDeep(database.database.orti[props.editIndex])
    initializeConnectorForm()
    initializeRecordFileForm()
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
<style scoped>
:deep(.vxe-toolbar) {
  padding: 0px !important;
  display: block !important;
}
</style>
