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
            <el-tooltip effect="light" content="Add Node" placement="bottom">
              <el-button link @click="addNewSlaveNode">
                <Icon :icon="fileOpenOutline" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip effect="light" content="Copy Node" placement="bottom">
              <el-button link type="info" :disabled="selectedIndex < 0" @click="copySlaveNode">
                <Icon :icon="copyIcon" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip effect="light" content="Edit Node" placement="bottom">
              <el-button link type="success" :disabled="selectedIndex < 0" @click="editSlaveNode">
                <Icon :icon="editIcon" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip effect="light" content="Delete Node" placement="bottom">
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
      :title="`${editNodeName} Attributes`"
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

const props = defineProps<{
  editIndex: string
}>()

const ldfObj = defineModel<LDF>({
  required: true
})
const editRef = ref()

const rules: FormRules<NodeAttrDef> = {
  LIN_protocol: [
    { required: true, message: 'Please select LIN protocol' },
    {
      validator: (rule: any, value: any, callback: any) => {
        if (!['2.1', '2.2'].includes(value)) {
          callback(new Error('Invalid LIN protocol version'))
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
          callback(new Error('Please enter configured NAD'))
          return
        }
        if (value === undefined) {
          callback(new Error('Please enter configured NAD'))
          return
        }
        if (value < 0 || value > 255) {
          callback(new Error('NAD must be between 0 and 255'))
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
          callback(new Error('Please enter initial NAD'))
          return
        }
        if (value === undefined) {
          callback(new Error('Please enter initial NAD'))
          return
        }
        if (value < 0 || value > 255) {
          callback(new Error('NAD must be between 0 and 255'))
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
          callback(new Error('Please enter supplier ID'))
          return
        }
        if (value === undefined) {
          callback(new Error('Please enter supplier ID'))
          return
        }
        if (value < 0 || value > 65535) {
          callback(new Error('Supplier ID must be between 0 and 65535'))
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
          callback(new Error('Please enter function ID'))
          return
        }
        if (value === undefined) {
          callback(new Error('Please enter function ID'))
          return
        }
        if (value < 0 || value > 65535) {
          callback(new Error('Function ID must be between 0 and 65535'))
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
          callback(new Error('Variant must be between 0 and 255'))
        } else {
          callback()
        }
      }
    }
  ],
  response_error: [
    { required: true, message: 'Please select response error signal' },
    {
      validator: (rule: any, value: any, callback: any) => {
        if (!value || !Object.keys(ldfObj.value.signals).includes(value)) {
          callback(new Error('Invalid signal selection'))
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
          callback(new Error('Invalid signal selection'))
          return
        }
        const validSignals = Object.keys(ldfObj.value.signals)
        if (value.some((signal) => !validSignals.includes(signal))) {
          callback(new Error('One or more selected signals are invalid'))
        } else {
          callback()
        }
      }
    }
  ],
  P2_min: [
    { required: true, type: 'number', message: 'P2 min is required' },
    { type: 'number', min: 0, message: 'P2 min must be greater than 0' }
  ],
  ST_min: [
    { required: true, type: 'number', message: 'ST min is required' },
    { type: 'number', min: 0, message: 'ST min must be greater than 0' }
  ],
  N_As_timeout: [
    { required: true, type: 'number', message: 'N_As timeout is required' },
    { type: 'number', min: 0, message: 'N_As timeout must be greater than 0' }
  ],
  N_Cr_timeout: [
    { required: true, type: 'number', message: 'N_Cr timeout is required' },
    { type: 'number', min: 0, message: 'N_Cr timeout must be greater than 0' }
  ],
  configFrames: [
    { type: 'array', required: true, message: 'Please select at least one config frame' },
    {
      validator: (rule: any, value: any, callback: any) => {
        if (!Array.isArray(value)) {
          callback(new Error('Invalid frame selection'))
          return
        }
        const validFrames = getConfigFrames(ldfObj.value, editNodeName1)
        if (value.some((frame) => !validFrames.includes(frame))) {
          callback(new Error('One or more selected frames are invalid'))
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
      title: 'Node Name',
      minWidth: 150,
      slots: { default: 'default_name' }
    },
    {
      field: 'initialNad',
      title: 'Initial NAD',
      width: 150,
      align: 'center',
      slots: { default: 'default_initialNad' }
    },
    {
      field: 'configuredNad',
      title: 'Config NAD',
      width: 150,
      align: 'center',
      slots: { default: 'default_configuredNad' }
    },
    {
      field: 'supplierId',
      title: 'Supplier ID',
      width: 150,
      align: 'center',
      slots: { default: 'default_supplierId' }
    },
    {
      field: 'functionId',
      title: 'Function ID',
      width: 150,
      align: 'center',
      slots: { default: 'default_functionId' }
    },
    {
      field: 'variant',
      title: 'Variant',
      width: 150,
      align: 'center',
      slots: { default: 'default_variant' }
    },
    {
      field: 'protocol',
      title: 'Protocol',
      width: 150,
      align: 'center',
      slots: { default: 'default_protocol' }
    },
    {
      field: 'configCount',
      title: 'Config Frames',
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
  ElMessageBox.prompt('Please enter the slave node name', 'Add Slave Node', {
    confirmButtonText: 'Add',
    cancelButtonText: 'Cancel',
    inputPattern: /^[a-zA-Z][a-zA-Z0-9_]+$/,
    appendTo: `#win${props.editIndex}`,
    inputErrorMessage:
      'Node name can only contain letters, numbers, and underscores, and must start with a letter',
    inputValidator: (value) => {
      if (!value) return "Node name can't be empty"
      if (ldfObj.value.node.salveNode.includes(value)) return 'Node name already exists'
      if (value === ldfObj.value.node.master.nodeName)
        return "Slave node name can't equal master node name"
      return true
    }
  })
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

  ElMessageBox.prompt('Please enter the slave node name', 'Copy Slave Node', {
    confirmButtonText: 'Copy',
    cancelButtonText: 'Cancel',
    inputPattern: /^[a-zA-Z][a-zA-Z0-9_]+$/,
    appendTo: `#win${props.editIndex}`,
    inputErrorMessage:
      'Node name can only contain letters, numbers, and underscores, and must start with a letter',
    inputValidator: (value) => {
      if (!value) return "Node name can't be empty"
      if (ldfObj.value.node.salveNode.includes(value)) return 'Node name already exists'
      if (value === ldfObj.value.node.master.nodeName)
        return "Slave node name can't equal master node name"
      return true
    }
  })
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
  ElMessageBox.confirm('Are you sure to delete this node?', 'Delete Node', {
    type: 'warning',
    confirmButtonText: 'Yes',
    cancelButtonText: 'No',
    buttonSize: 'small',
    appendTo: `#win${props.editIndex}`
  })
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
      tab: 'Nodes',
      error: errors
    }
  }
  return true
}

defineExpose({ validate })
</script>

<style></style>
