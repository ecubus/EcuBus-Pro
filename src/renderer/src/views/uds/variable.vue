<template>
  <div>
    <el-tabs v-model="activeTab" class="variableTabs" type="card">
      <el-tab-pane :label="i18next.t('uds.variable.tabs.userVariables')" name="user">
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
                <el-tooltip
                  effect="light"
                  :content="i18next.t('uds.variable.tooltips.addVariable')"
                  placement="bottom"
                >
                  <el-button link @click="openNewVariableDialog">
                    <Icon :icon="fileOpenOutline" style="font-size: 18px" />
                  </el-button>
                </el-tooltip>
                <el-tooltip
                  effect="light"
                  :content="i18next.t('uds.variable.tooltips.editVariable')"
                  placement="bottom"
                >
                  <el-button link type="warning" :disabled="!popoverIndex" @click="editVariable">
                    <Icon :icon="editIcon" style="font-size: 18px" />
                  </el-button>
                </el-tooltip>
                <el-tooltip
                  effect="light"
                  :content="i18next.t('uds.variable.tooltips.deleteVariable')"
                  placement="bottom"
                >
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
            {{ row.value?.type.toUpperCase() || i18next.t('uds.variable.defaults.group') }}
          </template>
          <template #default_initValue="{ row }">
            {{ row.value?.initValue }}
          </template>
          <template #default_min="{ row }">
            <template v-if="row.value?.type == 'number'">
              {{ row.value?.min }}
            </template>
          </template>
          <template #default_max="{ row }">
            <template v-if="row.value?.type == 'number'">
              {{ row.value?.max }}
            </template>
          </template>
        </VxeGrid>
      </el-tab-pane>
      <el-tab-pane :label="i18next.t('uds.variable.tabs.systemVariables')" name="system">
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
            {{ row.value?.type.toUpperCase() || i18next.t('uds.variable.defaults.group') }}
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
      :title="
        isEditing
          ? i18next.t('uds.variable.dialogs.editVariable')
          : i18next.t('uds.variable.dialogs.newVariable')
      "
      width="80%"
      align-center
      :style="{ height: dialogHeight + 'px', overflowY: 'auto' }"
      @close="isEditing = false"
    >
      <el-form
        ref="variableForm"
        :model="newVariableForm"
        :disabled="globalStart"
        label-width="120px"
        size="small"
        :rules="formRules"
      >
        <el-form-item
          v-if="newVariableForm.value"
          :label="i18next.t('uds.variable.labels.namespace')"
          prop="namespace"
        >
          <el-select
            v-model="newVariableForm.namespace"
            :data="namespaceTreeData"
            :placeholder="i18next.t('uds.variable.placeholders.selectNamespace')"
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
        <el-form-item :label="i18next.t('uds.variable.labels.name')" required prop="name">
          <el-input v-model="newVariableForm.name" />
        </el-form-item>
        <el-form-item :label="i18next.t('uds.variable.labels.description')" prop="desc">
          <el-input v-model="newVariableForm.desc" type="textarea" />
        </el-form-item>

        <template v-if="newVariableForm.value">
          <el-form-item
            :label="i18next.t('uds.variable.labels.dataType')"
            required
            prop="value.type"
          >
            <el-select v-model="newVariableForm.value.type">
              <el-option :label="i18next.t('uds.variable.types.number')" value="number" />
              <el-option :label="i18next.t('uds.variable.types.string')" value="string" />
              <el-option :label="i18next.t('uds.variable.types.array')" value="array" />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="i18next.t('uds.variable.labels.initialValue')"
            prop="value.initValue"
          >
            <el-input v-model="newVariableForm.value.initValue" />
          </el-form-item>
          <template v-if="newVariableForm.value.type === 'number'">
            <el-form-item :label="i18next.t('uds.variable.labels.minimum')" prop="value.min">
              <el-input-number v-model="newVariableForm.value.min" controls-position="right" />
            </el-form-item>
            <el-form-item :label="i18next.t('uds.variable.labels.maximum')" prop="value.max">
              <el-input-number v-model="newVariableForm.value.max" controls-position="right" />
            </el-form-item>
            <el-form-item :label="i18next.t('uds.variable.labels.unit')" prop="value.unit">
              <el-input v-model="newVariableForm.value.unit" controls-position="right" />
            </el-form-item>
          </template>
        </template>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="newVariableDialogVisible = false">{{
            i18next.t('uds.variable.buttons.cancel')
          }}</el-button>
          <el-button
            :type="isEditing ? 'warning' : 'primary'"
            size="small"
            @click="createOrUpdateVariable"
          >
            {{
              isEditing
                ? i18next.t('uds.variable.buttons.save')
                : i18next.t('uds.variable.buttons.create')
            }}
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
import { getAllSysVar } from 'nodeCan/sysVar'
import { useGlobalStart } from '@r/stores/runtime'
import i18next from 'i18next'
const variableForm = ref()
// Initialize data store
const dataStore = useDataStore()
const props = defineProps<{
  height: number
}>()
const globalStart = useGlobalStart()

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
const systemTableData = computed(() => {
  return Object.values(getAllSysVar(dataStore.devices, dataStore.tester, dataStore.database.orti))
})
// Define popoverIndex to track the selected variable
const popoverIndex = ref('')

// Load variables from data store on mount
onMounted(() => {
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
      title: i18next.t('uds.variable.columns.variable'),
      treeNode: true,
      minWidth: 150,
      editRender: {},
      slots: { default: 'default_name' }
    },
    {
      field: 'type',
      title: i18next.t('uds.variable.columns.dataType'),
      width: 150,
      editRender: {},
      slots: { default: 'default_type' }
    },
    {
      field: 'initValue',
      title: i18next.t('uds.variable.columns.initValue'),
      width: 150,
      editRender: {},
      slots: { default: 'default_initValue' }
    },
    {
      field: 'min',
      title: i18next.t('uds.variable.columns.min'),
      width: 150,
      editRender: {},
      slots: { default: 'default_min' }
    },
    {
      field: 'max',
      title: i18next.t('uds.variable.columns.max'),
      width: 150,
      editRender: {},
      slots: { default: 'default_max' }
    },
    {
      field: 'desc',
      title: i18next.t('uds.variable.columns.description'),
      width: 200
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
      ElMessageBox.confirm(
        i18next.t('uds.variable.dialogs.deleteConfirm'),
        i18next.t('uds.variable.dialogs.deleteVariable'),
        {
          confirmButtonText: i18next.t('uds.variable.dialogs.yes'),
          cancelButtonText: i18next.t('uds.variable.dialogs.no'),
          type: 'warning',
          appendTo: `#winvariable`,
          buttonSize: 'small'
        }
      )
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
        ElMessageBox.confirm(
          i18next.t('uds.variable.dialogs.deleteConfirm'),
          i18next.t('uds.variable.dialogs.deleteVariable'),
          {
            confirmButtonText: i18next.t('uds.variable.dialogs.yes'),
            cancelButtonText: i18next.t('uds.variable.dialogs.no'),
            type: 'warning',
            appendTo: `#winvariable`,
            buttonSize: 'small'
          }
        )
          .then(() => {
            delete dataStore.vars[popoverIndex.value]
            popoverIndex.value = ''
          })
          .catch(() => {
            // Do nothing
          })
      } else {
        ElMessageBox.confirm(
          i18next.t('uds.variable.dialogs.deleteChildVariablesFirst'),
          i18next.t('uds.variable.dialogs.deleteVariable'),
          {
            confirmButtonText: i18next.t('uds.variable.dialogs.ok'),
            showCancelButton: false,
            type: 'warning',
            appendTo: `#winvariable`,
            buttonSize: 'small'
          }
        )
      }
    }
  }
}

// Form validation rules
const formRules = {
  name: [
    { required: true, message: i18next.t('uds.variable.validation.inputName'), trigger: 'blur' },
    {
      validator: (rule: any, value: string, callback: any) => {
        if (value && !value.match(/^[a-zA-Z0-9_]+$/)) {
          callback(new Error(i18next.t('uds.variable.validation.nameFormat')))
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
          callback(new Error(i18next.t('uds.variable.validation.nameExists')))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  'value.type': [
    {
      required: true,
      message: i18next.t('uds.variable.validation.selectDataType'),
      trigger: 'change'
    }
  ],
  'value.initValue': [
    {
      required: true,
      message: i18next.t('uds.variable.validation.inputInitialValue'),
      trigger: 'blur'
    }
  ],
  'value.min': [
    {
      validator: (rule: any, value: number, callback: any) => {
        if (
          newVariableForm.value?.value?.type === 'number' &&
          newVariableForm.value?.value?.max !== undefined &&
          value >= newVariableForm.value.value.max
        ) {
          callback(new Error(i18next.t('uds.variable.validation.minLessThanMax')))
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
          callback(new Error(i18next.t('uds.variable.validation.maxGreaterThanMin')))
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
