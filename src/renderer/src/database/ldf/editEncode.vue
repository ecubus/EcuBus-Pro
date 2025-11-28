<template>
  <div>
    <VxeGrid ref="typeGrid" v-bind="typeGridOptions" @cell-click="typeClick">
      <template #toolbar>
        <div class="encode-toolbar">
          <div class="add-encode-form">
            <el-form
              ref="formRef"
              :model="encodeForm"
              :rules="formRules"
              :inline="true"
              size="small"
            >
              <el-form-item label="Type" prop="type">
                <el-select
                  v-model="encodeForm.type"
                  style="width: 160px"
                  @change="handleTypeChange"
                >
                  <el-option label="Logical Value" value="logicalValue" />
                  <el-option label="Physical Value" value="physicalValue" />
                  <el-option label="BCD Value" value="bcdValue" />
                  <el-option label="ASCII Value" value="asciiValue" />
                </el-select>
              </el-form-item>

              <!-- Logical Value Fields -->
              <template v-if="encodeForm.type === 'logicalValue'">
                <el-form-item label="Value" prop="logicalValue.signalValue">
                  <el-input-number
                    v-model="encodeForm.logicalValue.signalValue"
                    :min="0"
                    :max="65535"
                    step-strictly
                    :step="1"
                    style="width: 130px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="Description" prop="logicalValue.textInfo">
                  <el-input v-model="encodeForm.logicalValue.textInfo" style="width: 200px" />
                </el-form-item>
              </template>

              <!-- Physical Value Fields -->
              <template v-if="encodeForm.type === 'physicalValue'">
                <el-form-item label="Min" prop="physicalValue.minValue">
                  <el-input-number
                    v-model="encodeForm.physicalValue.minValue"
                    :min="0"
                    :max="65535"
                    :step="1"
                    step-strictly
                    style="width: 130px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="Max" prop="physicalValue.maxValue">
                  <el-input-number
                    v-model="encodeForm.physicalValue.maxValue"
                    :min="0"
                    :max="65535"
                    :step="1"
                    step-strictly
                    style="width: 130px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="Scale" prop="physicalValue.scale">
                  <el-input-number
                    v-model="encodeForm.physicalValue.scale"
                    style="width: 130px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="Offset" prop="physicalValue.offset">
                  <el-input-number
                    v-model="encodeForm.physicalValue.offset"
                    style="width: 130px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="Description" prop="physicalValue.textInfo">
                  <el-input v-model="encodeForm.physicalValue.textInfo" style="width: 200px" />
                </el-form-item>
              </template>

              <el-form-item>
                <el-button
                  :type="selectedTypeIndex >= 0 ? 'warning' : 'primary'"
                  plain
                  @click="submitForm"
                >
                  {{ selectedTypeIndex >= 0 ? 'Save' : 'Add' }} Encode
                </el-button>
                <el-button v-if="selectedTypeIndex >= 0" type="info" plain @click="clearChoose">
                  <Icon :icon="clearIcon" />
                </el-button>
                <el-button
                  v-if="selectedTypeIndex >= 0"
                  type="danger"
                  plain
                  :disabled="selectedTypeIndex < 0"
                  @click="deleteEncodeType"
                >
                  <Icon :icon="deleteIcon" />
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </template>

      <template #default_details="{ row }">
        <template v-if="row.type === 'logicalValue'">
          Value: {{ row.logicalValue?.signalValue }}
          {{ row.logicalValue?.textInfo ? `, Description: ${row.logicalValue.textInfo}` : '' }}
        </template>
        <template v-else-if="row.type === 'physicalValue'">
          Range: {{ row.physicalValue?.minValue }} ~ {{ row.physicalValue?.maxValue }}, Scale:
          {{ row.physicalValue?.scale }}, Offset: {{ row.physicalValue?.offset }}
          {{ row.physicalValue?.textInfo ? `, Description: ${row.physicalValue.textInfo}` : '' }}
        </template>
        <template v-else>
          {{ row.type }}
        </template>
      </template>
    </VxeGrid>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, inject, Ref, nextTick } from 'vue'
import { VxeGrid, VxeGridInstance, VxeGridProps } from 'vxe-table'
import { LDF, SignalEncodeType } from '../ldfParse'
import { Icon } from '@iconify/vue'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import { ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import clearIcon from '@iconify/icons-material-symbols/close'
const props = defineProps<{
  editIndex: string
  ldf: LDF
}>()

const modelValue = defineModel<SignalEncodeType>({
  required: true
})

const formRef = ref<FormInstance>()
const selectedTypeIndex = ref(-1)

const encodeForm = ref({
  type: 'logicalValue',
  logicalValue: {
    signalValue: 0,
    textInfo: ''
  },
  physicalValue: {
    minValue: 0,
    maxValue: 100,
    scale: 1,
    offset: 0,
    textInfo: ''
  }
})

const formRules = computed<FormRules>(() => ({
  type: [{ required: true, message: 'Please select type', trigger: 'change' }],
  'logicalValue.signalValue': [
    {
      required: encodeForm.value.type === 'logicalValue',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (encodeForm.value.type !== 'logicalValue') {
          callback()
          return
        }
        // Signal value must be between 0 and 65535 per LIN spec
        if (typeof value !== 'number' || value < 0 || value > 65535) {
          callback(new Error('Signal value must be between 0 and 65535'))
          return
        }
        callback()
      }
    }
  ],
  'physicalValue.minValue': [
    {
      required: encodeForm.value.type === 'physicalValue',

      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (encodeForm.value.type !== 'physicalValue') {
          callback()
          return
        }
        // Min value must be between 0 and 65535 per LIN spec
        if (typeof value !== 'number' || value < 0 || value > 65535) {
          callback(new Error('Min value must be between 0 and 65535'))
          return
        }
        callback()
      }
    }
  ],
  'physicalValue.maxValue': [
    {
      required: encodeForm.value.type === 'physicalValue',

      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (encodeForm.value.type !== 'physicalValue') {
          callback()
          return
        }

        // Max value must be between 0 and 65535 per LIN spec
        if (typeof value !== 'number' || value < 0 || value > 65535) {
          callback(new Error('Max value must be between 0 and 65535'))
          return
        }
        // Max value must be greater than or equal to min value
        if (value < encodeForm.value.physicalValue.minValue) {
          callback(new Error('Max value must be greater than or equal to min value'))
          return
        }
        callback()
      }
    }
  ]
  // Add other validation rules as needed
}))

const height = inject('height') as Ref<number>
const typeGrid = ref<VxeGridInstance>()
const typeGridOptions = computed<VxeGridProps>(() => ({
  border: true,
  size: 'mini',
  height: (height.value / 3) * 2,
  showOverflow: true,
  columnConfig: { resizable: true },
  rowConfig: { isCurrent: true },
  toolbarConfig: {
    slots: { tools: 'toolbar' }
  },
  columns: [
    { field: 'type', title: 'Type', width: 120 },
    { field: 'details', title: 'Details', minWidth: 300, slots: { default: 'default_details' } }
  ],
  data: modelValue.value.encodingTypes
}))

function typeClick({ rowIndex }) {
  selectedTypeIndex.value = rowIndex
  if (rowIndex >= 0) {
    const selectedType = modelValue.value.encodingTypes[rowIndex]
    encodeForm.value = {
      type: selectedType.type,
      logicalValue: {
        signalValue: selectedType.logicalValue?.signalValue || 0,
        textInfo: selectedType.logicalValue?.textInfo || ''
      },
      physicalValue: {
        minValue: selectedType.physicalValue?.minValue || 0,
        maxValue: selectedType.physicalValue?.maxValue || 100,
        scale: selectedType.physicalValue?.scale || 1,
        offset: selectedType.physicalValue?.offset || 0,
        textInfo: selectedType.physicalValue?.textInfo || ''
      }
    }
  } else {
    handleTypeChange(encodeForm.value.type)
  }
}

function handleTypeChange(type: string) {
  encodeForm.value = {
    type,
    logicalValue: {
      signalValue: 0,
      textInfo: ''
    },
    physicalValue: {
      minValue: 0,
      maxValue: 100,
      scale: 1,
      offset: 0,
      textInfo: ''
    }
  }
}

function submitForm() {
  if (!formRef.value) return

  formRef.value.validate((valid) => {
    if (valid) {
      const type = {
        type: encodeForm.value.type
      } as any

      if (encodeForm.value.type === 'logicalValue') {
        type.logicalValue = { ...encodeForm.value.logicalValue }
      } else if (encodeForm.value.type === 'physicalValue') {
        type.physicalValue = { ...encodeForm.value.physicalValue }
      }

      if (selectedTypeIndex.value >= 0) {
        // 编辑现有编码类型：先删除再添加
        modelValue.value.encodingTypes.splice(selectedTypeIndex.value, 1)
        const index = selectedTypeIndex.value
        nextTick(() => {
          modelValue.value.encodingTypes.splice(index, 0, type)
        })
      } else {
        // 添加新的编码类型
        modelValue.value.encodingTypes.push(type)
      }

      // 重置表单和选中状态
      handleTypeChange(encodeForm.value.type)
      selectedTypeIndex.value = -1
      typeGrid.value?.clearCurrentRow()
    }
  })
}

function deleteEncodeType() {
  if (selectedTypeIndex.value < 0) return

  const row = modelValue.value.encodingTypes[selectedTypeIndex.value]
  ElMessageBox.confirm('Are you sure to delete this encoding type?', 'Warning', {
    type: 'warning',
    buttonSize: 'small',
    appendTo: `#win${props.editIndex}`
  }).then(() => {
    modelValue.value.encodingTypes.splice(selectedTypeIndex.value, 1)
    selectedTypeIndex.value = -1
    handleTypeChange(encodeForm.value.type)
    typeGrid.value?.clearCurrentRow()
  })
}

function clearChoose() {
  selectedTypeIndex.value = -1
  typeGrid.value?.clearCurrentRow()
  handleTypeChange(encodeForm.value.type)
}
</script>

<style scoped>
.edit-encode {
  padding: 20px;
}

.encode-toolbar {
  padding: 8px;
  display: flex;
}

.add-encode-form {
  flex: 1;
  padding: 20px 0;
}

:deep(.el-form--inline) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:deep(.el-form--inline .el-form-item) {
  margin: 0;
}

:deep(.el-button-group) {
  display: inline-flex;
}
</style>
