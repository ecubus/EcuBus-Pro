<template>
  <div>
    <VxeGrid ref="xGrid" v-bind="gridOptions" @cell-click="cellClick">
      <template #toolbar>
        <div
          style="
            justify-content: flex-start;
            display: flex;
            align-items: center;
            gap: 2px;
            margin-left: 5px;
            padding: 8px;
          "
        >
          <el-button-group>
            <el-tooltip
              effect="light"
              :content="i18next.t('database.ldf.node.tooltips.addNode')"
              placement="bottom"
            >
              <el-button link @click="addNewSlaveNode">
                <Icon :icon="fileOpenOutline" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip
              effect="light"
              :content="i18next.t('database.ldf.node.tooltips.copyNode')"
              placement="bottom"
            >
              <el-button link type="info" :disabled="selectedIndex < 0" @click="copySlaveNode">
                <Icon :icon="copyIcon" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip
              effect="light"
              :content="i18next.t('database.ldf.node.tooltips.editNode')"
              placement="bottom"
            >
              <el-button link type="success" :disabled="selectedIndex < 0" @click="editSlaveNode">
                <Icon :icon="editIcon" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip
              effect="light"
              :content="i18next.t('database.ldf.node.tooltips.deleteNode')"
              placement="bottom"
            >
              <el-button link type="danger" :disabled="selectedIndex < 0" @click="removeSlaveNode">
                <Icon :icon="deleteIcon" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
          </el-button-group>
        </div>
      </template>

      <template #default_name="{ row }">
        <el-tag>{{ row.name }}</el-tag>
      </template>

      <template #default_configCount="{ row }">
        <el-tag size="small" type="info">{{ getConfigFramesCount(row.name) }}</el-tag>
      </template>

      <template #default_initialNad="{ row }">
        <el-tag size="small" type="info">0x{{ getInitialNad(row.name) }}</el-tag>
      </template>

      <template #default_configuredNad="{ row }">
        <el-tag size="small">0x{{ getConfiguredNad(row.name) }}</el-tag>
      </template>

      <template #default_supplierId="{ row }"> 0x{{ getSupplierId(row.name) }} </template>

      <template #default_functionId="{ row }"> 0x{{ getFunctionId(row.name) }} </template>

      <template #default_variant="{ row }"> 0x{{ getVariant(row.name) }} </template>

      <template #default_protocol="{ row }">
        {{ getProtocol(row.name) }}
      </template>
    </VxeGrid>

    <el-dialog
      v-if="editAttr"
      v-model="editAttr"
      :title="i18next.t('database.ldf.node.dialogs.nodeAttributes', { name: editNodeName })"
      width="70%"
      align-center
      :close-on-click-modal="false"
      :append-to="`#win${editIndex}`"
    >
      <EditNode
        ref="editRef"
        v-model="ldfObj.nodeAttrs[editNodeName]"
        :edit-index="editIndex"
        :node-name="editNodeName"
        :ldf="ldfObj"
        :rules="rules"
      >
      </EditNode>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, inject, Ref, computed } from 'vue'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { Icon } from '@iconify/vue'
import fileOpenOutline from '@iconify/icons-material-symbols/file-open-outline'
import editIcon from '@iconify/icons-material-symbols/edit-square-outline'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import copyIcon from '@iconify/icons-material-symbols/content-copy'
import { ElMessageBox, FormRules } from 'element-plus'
import EditNode from './editNode.vue'
import { getConfigFrames, LDF, NodeAttrDef } from '../ldfParse'
import { cloneDeep } from 'lodash'
import Schema from 'async-validator'
import { i18next } from '@r/i18n'

const props = defineProps<{
  editIndex: string
}>()

const ldfObj = defineModel<LDF>({
  required: true
})
const editRef = ref()

const rules: FormRules<NodeAttrDef> = {
  LIN_protocol: [
    { required: true, message: i18next.t('database.ldf.node.validation.pleaseSelectLinProtocol') },
    {
      validator: (rule: any, value: any, callback: any) => {
        if (!['2.1', '2.2'].includes(value)) {
          callback(new Error(i18next.t('database.ldf.node.validation.invalidLinProtocolVersion')))
        } else {
          callback()
        }
      }
    }
  ],
  configured_NAD: [
    {
      required: true,
      type: 'number',
      validator: (rule: any, value: number | undefined, callback: any) => {
        if (typeof value === 'string') {
          //报错
          callback(new Error(i18next.t('database.ldf.node.validation.pleaseEnterConfiguredNad')))
          return
        }
        if (value === undefined) {
          callback(new Error(i18next.t('database.ldf.node.validation.pleaseEnterConfiguredNad')))
          return
        }
        if (value < 0 || value > 255) {
          callback(new Error(i18next.t('database.ldf.node.validation.nadRange')))
        } else {
          callback()
        }
      }
    }
  ],
  initial_NAD: [
    {
      required: true,
      type: 'number',
      validator: (rule: any, value: number | undefined, callback: any) => {
        if (typeof value === 'string') {
          //报错
          callback(new Error(i18next.t('database.ldf.node.validation.pleaseEnterInitialNad')))
          return
        }
        if (value === undefined) {
          callback(new Error(i18next.t('database.ldf.node.validation.pleaseEnterInitialNad')))
          return
        }
        if (value < 0 || value > 255) {
          callback(new Error(i18next.t('database.ldf.node.validation.nadRange')))
        } else {
          callback()
        }
      }
    }
  ],
  supplier_id: [
    {
      required: true,
      type: 'number',
      validator: (rule: any, value: number | undefined, callback: any) => {
        if (typeof value === 'string') {
          //报错
          callback(new Error(i18next.t('database.ldf.node.validation.pleaseEnterSupplierId')))
          return
        }
        if (value === undefined) {
          callback(new Error(i18next.t('database.ldf.node.validation.pleaseEnterSupplierId')))
          return
        }
        if (value < 0 || value > 65535) {
          callback(new Error(i18next.t('database.ldf.node.validation.supplierIdRange')))
        } else {
          callback()
        }
      }
    }
  ],
  function_id: [
    {
      required: true,
      type: 'number',
      validator: (rule: any, value: number | undefined, callback: any) => {
        if (typeof value === 'string') {
          //报错
          callback(new Error(i18next.t('database.ldf.node.validation.pleaseEnterFunctionId')))
          return
        }
        if (value === undefined) {
          callback(new Error(i18next.t('database.ldf.node.validation.pleaseEnterFunctionId')))
          return
        }
        if (value < 0 || value > 65535) {
          callback(new Error(i18next.t('database.ldf.node.validation.functionIdRange')))
        } else {
          callback()
        }
      }
    }
  ],
  variant: [
    {
      required: false,
      type: 'number',
      validator: (rule: any, value: number | undefined, callback: any) => {
        if (value === undefined) {
          callback()
          return
        }
        if (value < 0 || value > 255) {
          callback(new Error(i18next.t('database.ldf.node.validation.variantRange')))
        } else {
          callback()
        }
      }
    }
  ],
  response_error: [
    {
      required: true,
      message: i18next.t('database.ldf.node.validation.pleaseSelectResponseErrorSignal')
    },
    {
      validator: (rule: any, value: any, callback: any) => {
        if (!value || !Object.keys(ldfObj.value.signals).includes(value)) {
          callback(new Error(i18next.t('database.ldf.node.validation.invalidSignalSelection')))
        } else {
          callback()
        }
      }
    }
  ],
  fault_state_signals: [
    {
      type: 'array',
      validator: (rule: any, value: any, callback: any) => {
        if (!Array.isArray(value)) {
          callback(new Error(i18next.t('database.ldf.node.validation.invalidSignalSelection')))
          return
        }
        const validSignals = Object.keys(ldfObj.value.signals)
        if (value.some((signal) => !validSignals.includes(signal))) {
          callback(new Error(i18next.t('database.ldf.node.validation.oneOrMoreSignalsInvalid')))
        } else {
          callback()
        }
      }
    }
  ],
  P2_min: [
    {
      required: true,
      type: 'number',
      message: i18next.t('database.ldf.node.validation.p2MinRequired')
    },
    {
      type: 'number',
      min: 0,
      message: i18next.t('database.ldf.node.validation.p2MinMustBeGreaterThan0')
    }
  ],
  ST_min: [
    {
      required: true,
      type: 'number',
      message: i18next.t('database.ldf.node.validation.stMinRequired')
    },
    {
      type: 'number',
      min: 0,
      message: i18next.t('database.ldf.node.validation.stMinMustBeGreaterThan0')
    }
  ],
  N_As_timeout: [
    {
      required: true,
      type: 'number',
      message: i18next.t('database.ldf.node.validation.nAsTimeoutRequired')
    },
    {
      type: 'number',
      min: 0,
      message: i18next.t('database.ldf.node.validation.nAsTimeoutMustBeGreaterThan0')
    }
  ],
  N_Cr_timeout: [
    {
      required: true,
      type: 'number',
      message: i18next.t('database.ldf.node.validation.nCrTimeoutRequired')
    },
    {
      type: 'number',
      min: 0,
      message: i18next.t('database.ldf.node.validation.nCrTimeoutMustBeGreaterThan0')
    }
  ],
  configFrames: [
    {
      type: 'array',
      required: true,
      message: i18next.t('database.ldf.node.validation.pleaseSelectAtLeastOneConfigFrame')
    },
    {
      validator: (rule: any, value: any, callback: any) => {
        if (!Array.isArray(value)) {
          callback(new Error(i18next.t('database.ldf.node.validation.invalidFrameSelection')))
          return
        }
        const validFrames = getConfigFrames(ldfObj.value, editNodeName1)
        if (value.some((frame) => !validFrames.includes(frame))) {
          callback(new Error(i18next.t('database.ldf.node.validation.oneOrMoreFramesInvalid')))
        } else {
          callback()
        }
      }
    }
  ]
}
let editNodeName1 = ''
const editNodeName = ref('')
const editAttr = ref(false)
const selectedIndex = ref(-1)

const height = inject('height') as Ref<number>

const gridOptions = computed<VxeGridProps>(() => ({
  border: true,
  size: 'mini',
  height: height.value - 40,
  showOverflow: true,
  columnConfig: { resizable: true },
  rowConfig: { isCurrent: true },
  toolbarConfig: {
    slots: { tools: 'toolbar' }
  },
  rowClassName: ({ rowIndex }) => {
    return ErrorList.value[rowIndex] ? 'ldf-danger-row' : ''
  },
  columns: [
    {
      type: 'seq',
      width: 50,
      title: '#',
      align: 'center',
      fixed: 'left',
      resizable: false
    },
    {
      field: 'name',
      title: i18next.t('database.ldf.node.columns.nodeName'),
      minWidth: 150,
      slots: { default: 'default_name' }
    },
    {
      field: 'initialNad',
      title: i18next.t('database.ldf.node.columns.initialNad'),
      width: 150,
      align: 'center',
      slots: { default: 'default_initialNad' }
    },
    {
      field: 'configuredNad',
      title: i18next.t('database.ldf.node.columns.configNad'),
      width: 150,
      align: 'center',
      slots: { default: 'default_configuredNad' }
    },
    {
      field: 'supplierId',
      title: i18next.t('database.ldf.node.columns.supplierId'),
      width: 150,
      align: 'center',
      slots: { default: 'default_supplierId' }
    },
    {
      field: 'functionId',
      title: i18next.t('database.ldf.node.columns.functionId'),
      width: 150,
      align: 'center',
      slots: { default: 'default_functionId' }
    },
    {
      field: 'variant',
      title: i18next.t('database.ldf.node.columns.variant'),
      width: 150,
      align: 'center',
      slots: { default: 'default_variant' }
    },
    {
      field: 'protocol',
      title: i18next.t('database.ldf.node.columns.protocol'),
      width: 150,
      align: 'center',
      slots: { default: 'default_protocol' }
    },
    {
      field: 'configCount',
      title: i18next.t('database.ldf.node.columns.configFrames'),
      width: 120,
      align: 'center',
      slots: { default: 'default_configCount' }
    }
  ],
  data: ldfObj.value.node.salveNode.map((node) => ({ name: node }))
}))

function cellClick({ rowIndex }) {
  selectedIndex.value = rowIndex
}

function addNewSlaveNode() {
  ElMessageBox.prompt(
    i18next.t('database.ldf.node.dialogs.pleaseEnterSlaveNodeName'),
    i18next.t('database.ldf.node.dialogs.addSlaveNode'),
    {
      confirmButtonText: i18next.t('database.ldf.node.buttons.add'),
      cancelButtonText: i18next.t('database.ldf.node.buttons.cancel'),
      inputPattern: /^[a-zA-Z][a-zA-Z0-9_]+$/,
      appendTo: `#win${props.editIndex}`,
      inputErrorMessage: i18next.t('database.ldf.node.validation.nodeNamePattern'),
      inputValidator: (value) => {
        if (!value) return i18next.t('database.ldf.node.validation.nodeNameCannotBeEmpty')
        if (ldfObj.value.node.salveNode.includes(value))
          return i18next.t('database.ldf.node.validation.nodeNameAlreadyExists')
        if (value === ldfObj.value.node.master.nodeName)
          return i18next.t('database.ldf.node.validation.slaveNodeNameCannotEqualMaster')
        return true
      }
    }
  )
    .then(({ value }) => {
      ldfObj.value.node.salveNode.push(value)
      ldfObj.value.nodeAttrs[value] = {
        LIN_protocol: '',
        configured_NAD: 0,
        initial_NAD: 0,
        supplier_id: 0,
        function_id: 0,
        variant: 0,
        response_error: '',
        fault_state_signals: [],
        P2_min: 0,
        ST_min: 0,
        N_As_timeout: 0,
        N_Cr_timeout: 0,
        configFrames: []
      }
    })
    .catch(() => null)
}

function copySlaveNode() {
  if (selectedIndex.value < 0) return
  const sourceNode = ldfObj.value.node.salveNode[selectedIndex.value]

  ElMessageBox.prompt(
    i18next.t('database.ldf.node.dialogs.pleaseEnterSlaveNodeName'),
    i18next.t('database.ldf.node.dialogs.copySlaveNode'),
    {
      confirmButtonText: i18next.t('database.ldf.node.buttons.copy'),
      cancelButtonText: i18next.t('database.ldf.node.buttons.cancel'),
      inputPattern: /^[a-zA-Z][a-zA-Z0-9_]+$/,
      appendTo: `#win${props.editIndex}`,
      inputErrorMessage: i18next.t('database.ldf.node.validation.nodeNamePattern'),
      inputValidator: (value) => {
        if (!value) return i18next.t('database.ldf.node.validation.nodeNameCannotBeEmpty')
        if (ldfObj.value.node.salveNode.includes(value))
          return i18next.t('database.ldf.node.validation.nodeNameAlreadyExists')
        if (value === ldfObj.value.node.master.nodeName)
          return i18next.t('database.ldf.node.validation.slaveNodeNameCannotEqualMaster')
        return true
      }
    }
  )
    .then(({ value }) => {
      ldfObj.value.node.salveNode.push(value)
      ldfObj.value.nodeAttrs[value] = cloneDeep(ldfObj.value.nodeAttrs[sourceNode])
    })
    .catch(() => null)
}

function editSlaveNode() {
  if (selectedIndex.value < 0) return
  editNodeName.value = ldfObj.value.node.salveNode[selectedIndex.value]
  editNodeName1 = editNodeName.value
  editAttr.value = true
}

function removeSlaveNode() {
  if (selectedIndex.value < 0) return

  const nodeName = ldfObj.value.node.salveNode[selectedIndex.value]
  ElMessageBox.confirm(
    i18next.t('database.ldf.node.dialogs.confirmDelete'),
    i18next.t('database.ldf.node.dialogs.deleteNode'),
    {
      type: 'warning',
      confirmButtonText: i18next.t('database.ldf.node.buttons.yes'),
      cancelButtonText: i18next.t('database.ldf.node.buttons.no'),
      buttonSize: 'small',
      appendTo: `#win${props.editIndex}`
    }
  )
    .then(() => {
      delete ldfObj.value.nodeAttrs[nodeName]
      ldfObj.value.node.salveNode.splice(selectedIndex.value, 1)
      selectedIndex.value = -1
    })
    .catch(() => null)
}

function getConfigFramesCount(nodeName: string) {
  return ldfObj.value.nodeAttrs[nodeName]?.configFrames?.length || 0
}

function getInitialNad(nodeName: string) {
  const attrs = ldfObj.value.nodeAttrs[nodeName]
  if (!attrs || attrs.initial_NAD === undefined) return '00'
  return attrs.initial_NAD.toString(16).padStart(2, '0')
}

function getConfiguredNad(nodeName: string) {
  const attrs = ldfObj.value.nodeAttrs[nodeName]
  if (!attrs || attrs.configured_NAD === undefined) return '00'
  return attrs.configured_NAD.toString(16).padStart(2, '0')
}

function getSupplierId(nodeName: string) {
  const attrs = ldfObj.value.nodeAttrs[nodeName]
  if (!attrs || attrs.supplier_id === undefined) return '0000'
  return attrs.supplier_id.toString(16).padStart(4, '0')
}

function getFunctionId(nodeName: string) {
  const attrs = ldfObj.value.nodeAttrs[nodeName]
  if (!attrs || attrs.function_id === undefined) return '00'
  return attrs.function_id.toString(16).padStart(2, '0')
}

function getVariant(nodeName: string) {
  const attrs = ldfObj.value.nodeAttrs[nodeName]
  if (!attrs || attrs.variant === undefined) return '00'
  return attrs.variant.toString(16).padStart(2, '0')
}

function getProtocol(nodeName: string) {
  return ldfObj.value.nodeAttrs[nodeName]?.LIN_protocol || 'N/A'
}
const ErrorList = ref<boolean[]>([])
async function validate() {
  //schema valid the data
  const errors: {
    field: string
    message: string
  }[] = []
  ErrorList.value = []
  for (const key of Object.keys(ldfObj.value.nodeAttrs)) {
    const schema = new Schema(rules as any)
    editNodeName1 = key
    try {
      await schema.validate(ldfObj.value.nodeAttrs[key])
      ErrorList.value.push(false)
    } catch (e: any) {
      ErrorList.value.push(true)

      for (const key in e.fields) {
        for (const error of e.fields[key]) {
          errors.push({
            field: `${editNodeName1} : ${key}`,
            message: error.message
          })
        }
      }
    }
  }
  editNodeName1 = editNodeName.value
  editRef.value?.validate()
  if (errors.length > 0) {
    throw {
      tab: i18next.t('database.ldf.node.tabs.nodes'),
      error: errors
    }
  }
  return true
}

defineExpose({ validate })
</script>

<style></style>
