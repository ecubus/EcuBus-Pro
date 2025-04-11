<template>
  <div>
    <el-tabs v-model="activeTab" class="variableTabs" type="card">
      <el-tab-pane label="User Variables" name="user">
        <VxeGrid
          ref="userVariableGrid"
          v-bind="userGridOptions"
          class="variableTable"
          :data="userTableData"
          @cell-click="cellClick"
          @cell-dblclick="editVariable"
        >
          <template #toolbar>
            <div
              style="
                justify-content: flex-start;
                display: flex;
                align-items: center;
                gap: 2px;
                margin-left: 5px;
              "
            >
              <el-button-group>
                <el-tooltip effect="light" content="Add Variable" placement="bottom">
                  <el-button link @click="openNewVariableDialog">
                    <Icon :icon="fileOpenOutline" style="font-size: 18px" />
                  </el-button>
                </el-tooltip>
                <el-tooltip effect="light" content="Edit Variable" placement="bottom">
                  <el-button link type="warning" :disabled="!popoverIndex" @click="editVariable">
                    <Icon :icon="editIcon" style="font-size: 18px" />
                  </el-button>
                </el-tooltip>
                <el-tooltip effect="light" content="Delete Variable" placement="bottom">
                  <el-button link type="danger" :disabled="!popoverIndex" @click="deleteVariable">
                    <Icon :icon="deleteIcon" style="font-size: 18px" />
                  </el-button>
                </el-tooltip>
              </el-button-group>
            </div>
          </template>
          <template #default_name="{ row }">
            {{ row.name }}
          </template>
          <template #default_type="{ row }">
            {{ row.value?.type.toUpperCase() || 'GROUP' }}
          </template>
          <template #default_initValue="{ row }">
            {{ row.value?.initValue }}
          </template>
          <template #default_min="{ row }">
            {{ row.value?.min }}
          </template>
          <template #default_max="{ row }">
            {{ row.value?.max }}
          </template>
        </VxeGrid>
      </el-tab-pane>
      <el-tab-pane label="System Variables" name="system">
        <VxeGrid
          ref="systemVariableGrid"
          v-bind="userGridOptions"
          class="variableTable"
          :data="systemTableData"
        >
          <template #toolbar> </template>
          <template #default_name="{ row }">
            {{ row.name }}
          </template>
          <template #default_type="{ row }">
            {{ row.value?.type.toUpperCase() || 'GROUP' }}
          </template>
          <template #default_initValue="{ row }">
            {{ row.value?.initValue }}
          </template>
          <template #default_min="{ row }">
            {{ row.value?.min }}
          </template>
          <template #default_max="{ row }">
            {{ row.value?.max }}
          </template>
        </VxeGrid>
      </el-tab-pane>
    </el-tabs>
    <el-dialog
      v-model="newVariableDialogVisible"
      :close-on-click-modal="false"
      :title="isEditing ? 'Edit Variable' : 'New Variable'"
      width="80%"
      align-center
      :style="{ height: dialogHeight + 'px', overflowY: 'auto' }"
      @close="isEditing = false"
    >
      <el-form
        ref="variableForm"
        :model="newVariableForm"
        label-width="120px"
        size="small"
        :rules="formRules"
      >
        <el-form-item v-if="newVariableForm.value" label="Namespace" prop="namespace">
          <el-select
            v-model="newVariableForm.namespace"
            :data="namespaceTreeData"
            placeholder="Select namespace"
            filterable
            allow-create
            clearable
          >
            <el-option
              v-for="item in namespaceTreeData"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Name" required prop="name">
          <el-input v-model="newVariableForm.name" />
        </el-form-item>
        <el-form-item label="Description" prop="desc">
          <el-input v-model="newVariableForm.desc" type="textarea" />
        </el-form-item>

        <template v-if="newVariableForm.value">
          <el-form-item label="Data Type" required prop="value.type">
            <el-select v-model="newVariableForm.value.type">
              <el-option label="Number" value="number" />
              <el-option label="String" value="string" />
              <el-option label="Array" value="array" />
            </el-select>
          </el-form-item>
          <el-form-item label="Initial Value" prop="value.initValue">
            <el-input v-model="newVariableForm.value.initValue" />
          </el-form-item>
          <template v-if="newVariableForm.value.type === 'number'">
            <el-form-item label="Minimum" prop="value.min">
              <el-input-number v-model="newVariableForm.value.min" controls-position="right" />
            </el-form-item>
            <el-form-item label="Maximum" prop="value.max">
              <el-input-number v-model="newVariableForm.value.max" controls-position="right" />
            </el-form-item>
            <el-form-item label="Unit" prop="value.unit">
              <el-input v-model="newVariableForm.value.unit" controls-position="right" />
            </el-form-item>
          </template>
        </template>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="newVariableDialogVisible = false">Cancel</el-button>
          <el-button
            :type="isEditing ? 'warning' : 'primary'"
            size="small"
            @click="createOrUpdateVariable"
          >
            {{ isEditing ? 'Save' : 'Create' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import fileOpenOutline from '@iconify/icons-material-symbols/file-open-outline'
import editIcon from '@iconify/icons-material-symbols/edit-square-outline'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import saveIcon from '@iconify/icons-material-symbols/save'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { useDataStore } from '../../stores/data'
import { VarItem, VarValueNumber, VarValueString, VarValueArray } from 'src/preload/data'
import { v4 } from 'uuid'
import { cloneDeep } from 'lodash'

const variableForm = ref()
// Initialize data store
const dataStore = useDataStore()
const props = defineProps<{
  height: number
}>()

// Active tab
const activeTab = ref('user')
const dialogHeight = computed(() => {
  return props.height - 100
})
const userVariableGrid = ref()
const userTableData = computed(() => {
  const list: VarItem[] = []
  for (const item of Object.values(dataStore.vars)) {
    list.push(cloneDeep(item))
  }
  return list
})
const systemTableData = ref<VarItem[]>([])
// Define popoverIndex to track the selected variable
const popoverIndex = ref('')

// Load variables from data store on mount
onMounted(() => {
  refreshSystemTable()

  // Process all variables and build the hierarchy

  // Process system variables
  // systemTableData.value = Object.values(systemVariables.value)
})

const isEditing = ref(false)

function openNewVariableDialog() {
  //clear validate
  variableForm.value?.clearValidate()
  isEditing.value = false
  newVariableForm.value = {
    namespace: '',
    name: '',
    desc: '',
    type: 'user',
    value: { type: 'number', initValue: 0, min: 0, max: 100 },
    id: v4()
  }
  newVariableDialogVisible.value = true
}

// Grid options for user variables
const userGridOptions = computed<VxeGridProps>(() => ({
  border: true,
  size: 'mini',
  columnConfig: {
    resizable: true
  },
  treeConfig: {
    transform: true,
    rowField: 'id',
    parentField: 'parentId'
  },
  height: props.height - 40,
  showOverflow: true,
  scrollY: {
    enabled: true,
    gt: 0
  },
  rowConfig: {
    isCurrent: true,
    keyField: 'id'
  },

  toolbarConfig: {
    slots: {
      tools: 'toolbar'
    }
  },
  align: 'center',
  columns: [
    { type: 'seq', width: 70, title: '#' },

    {
      field: 'name',
      title: 'Variable',
      treeNode: true,
      minWidth: 150,
      editRender: {},
      slots: { default: 'default_name' }
    },
    {
      field: 'type',
      title: 'Data Type',
      width: 150,
      editRender: {},
      slots: { default: 'default_type' }
    },
    {
      field: 'initValue',
      title: 'Init Value',
      width: 150,
      editRender: {},
      slots: { default: 'default_initValue' }
    },
    {
      field: 'min',
      title: 'Min',
      width: 150,
      editRender: {},
      slots: { default: 'default_min' }
    },
    {
      field: 'max',
      title: 'Max',
      width: 150,
      editRender: {},
      slots: { default: 'default_max' }
    }
  ]
}))

function cellClick(val: any) {
  popoverIndex.value = val.row.id
}

function editVariable() {
  //clear validate
  variableForm.value?.clearValidate()
  const variable = dataStore.vars[popoverIndex.value]
  if (variable) {
    isEditing.value = true
    newVariableForm.value = cloneDeep(variable)

    newVariableForm.value.namespace = newVariableForm.value.parentId

    newVariableDialogVisible.value = true
  }
}

function deleteVariable() {
  const variable = dataStore.vars[popoverIndex.value]

  if (variable) {
    if (variable.value) {
      ElMessageBox.confirm('Are you sure to delete this variable?', 'Delete Variable', {
        confirmButtonText: 'Yes',
        cancelButtonText: 'No',
        type: 'warning',
        appendTo: `#winvariable`,
        buttonSize: 'small'
      })
        .then(() => {
          delete dataStore.vars[popoverIndex.value]
          popoverIndex.value = ''
        })
        .catch(() => {
          // Do nothing
        })
    } else {
      //check all child variable has been deleted
      const childVariables = Object.values(dataStore.vars).filter(
        (item) => item.parentId === popoverIndex.value
      )
      if (childVariables.length === 0) {
        ElMessageBox.confirm('Are you sure to delete this variable?', 'Delete Variable', {
          confirmButtonText: 'Yes',
          cancelButtonText: 'No',
          type: 'warning',
          appendTo: `#winvariable`,
          buttonSize: 'small'
        })
          .then(() => {
            delete dataStore.vars[popoverIndex.value]
            popoverIndex.value = ''
          })
          .catch(() => {
            // Do nothing
          })
      } else {
        ElMessageBox.confirm('Please delete all child variables first', 'Delete Variable', {
          confirmButtonText: 'OK',
          showCancelButton: false,
          type: 'warning',
          appendTo: `#winvariable`,
          buttonSize: 'small'
        })
      }
    }
  }
}

// Form validation rules
const formRules = {
  name: [
    { required: true, message: 'Please input variable name', trigger: 'blur' },
    {
      validator: (rule: any, value: string, callback: any) => {
        if (value && !value.match(/^[a-zA-Z0-9_]+$/)) {
          callback(new Error('Variable name only contain letters, numbers, and underscores'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    },
    {
      validator: (rule: any, value: string, callback: any) => {
        // Check for duplicate names within the same parent
        const parentId = newVariableForm.value?.parentId
        const currentId = newVariableForm.value?.id

        const hasDuplicate = Object.values(dataStore.vars).some((item) => {
          // Skip checking against itself when editing
          if (currentId && item.id === currentId) return false

          // Check if names match and parent IDs match
          return item.name === value && item.parentId === parentId
        })

        if (hasDuplicate) {
          callback(new Error('Variable name already exists in this namespace'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  'value.type': [{ required: true, message: 'Please select data type', trigger: 'change' }],
  'value.initValue': [{ required: true, message: 'Please input initial value', trigger: 'blur' }],
  'value.min': [
    {
      validator: (rule: any, value: number, callback: any) => {
        if (
          newVariableForm.value?.value?.type === 'number' &&
          newVariableForm.value?.value?.max !== undefined &&
          value >= newVariableForm.value.value.max
        ) {
          callback(new Error('Minimum value must be less than maximum value'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  'value.max': [
    {
      validator: (rule: any, value: number, callback: any) => {
        if (
          newVariableForm.value?.value?.type === 'number' &&
          newVariableForm.value?.value?.min !== undefined &&
          value <= newVariableForm.value.value.min
        ) {
          callback(new Error('Maximum value must be greater than minimum value'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const newVariableDialogVisible = ref(false)

type FromVarItem = VarItem & {
  namespace?: string
}

const newVariableForm = ref<FromVarItem>({
  namespace: '',
  name: '',
  desc: '',
  type: 'user',
  value: {
    type: 'number',
    initValue: 0,
    min: 0,
    max: 100
  },
  id: ''
})

function createOrUpdateVariable() {
  variableForm.value?.validate((valid: boolean) => {
    console.log(valid)
    if (valid) {
      const clone = cloneDeep(newVariableForm.value)
      const namespace = clone.namespace
      delete clone.namespace
      if (isEditing.value) {
        //find by id
        const item = dataStore.vars[clone.id]
        if (item) {
          if (namespace) {
            const item = dataStore.vars[namespace]
            if (item) {
              dataStore.vars[clone.id] = {
                ...clone,
                parentId: item.id
              }
            } else {
              //create namespace
              const id = v4()
              dataStore.vars[id] = {
                type: 'user',
                id,
                name: namespace
              }
              dataStore.vars[clone.id] = {
                ...clone,
                parentId: id
              }
            }
          } else {
            clone.parentId = undefined
            dataStore.vars[clone.id] = clone
          }
        }
      } else {
        if (namespace) {
          //check namespace exist
          const item = dataStore.vars[namespace]
          if (item) {
            dataStore.vars[clone.id] = {
              ...clone,
              parentId: item.id
            }
          } else {
            //create namespace
            const id = v4()
            dataStore.vars[id] = {
              type: 'user',
              id,
              name: namespace
            }
            dataStore.vars[clone.id] = {
              ...clone,
              parentId: id
            }
          }
        } else {
          dataStore.vars[clone.id] = clone
        }
      }

      newVariableDialogVisible.value = false
      popoverIndex.value = ''
      //clear highlight
      userVariableGrid.value?.clearCurrentRow()
    }
  })
}

function refreshSystemTable() {
  systemTableData.value = []
  //can statistics
  systemTableData.value.push({
    type: 'system',
    id: `Statistics`,
    name: `Statistics`
  })
  for (const device of Object.values(dataStore.devices)) {
    if (device.type === 'can' && device.canDevice) {
      systemTableData.value.push({
        type: 'system',
        id: `${device.canDevice.id}`,
        name: `${device.canDevice.name}`,
        parentId: `Statistics`
      })

      const list = ['BusLoad', 'BusLoadMin', 'BusLoadMax', 'BusLoadAvg']
      for (const item of list) {
        systemTableData.value.push({
          type: 'system',
          id: `${device.canDevice.id}.${item}`,
          name: `${item}`,
          parentId: `${device.canDevice.id}`,
          value: {
            type: 'number',
            initValue: 0,
            min: 0,
            max: 100
          }
        })
      }
    }
  }
}

// Add computed property for namespace tree data
const namespaceTreeData = computed(() => {
  const list: {
    label: string
    value: string
  }[] = []

  for (const varItem of Object.values(dataStore.vars)) {
    if (varItem.value == undefined) {
      list.push({
        label: varItem.name,
        value: varItem.id
      })
    }
  }

  return list
})
</script>
<style lang="scss">
.variableTabs {
  padding-right: 5px;
  margin-right: 5px;

  .el-tabs__header {
    margin-bottom: 0px !important;
  }
}
</style>
