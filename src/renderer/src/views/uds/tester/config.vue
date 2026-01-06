<template>
  <el-table
    :id="'configTable' + props.parentId + props.id"
    :data="data"
    style="width: 100%"
    border
    row-key="key"
    :row-class-name="tableRowClassName"
  >
    <el-table-column prop="key" label="Key" width="200" align="center" show-overflow-tooltip>
      <template #default="{ $index, row }">
        <div v-if="editIndex == $index" class="editParam">
          <el-input
            v-model="editValue.key"
            style="padding-left: 15px; padding-right: 15px"
            placeholder="Configuration key"
          />
          <el-tooltip
            v-if="configError['key']"
            :content="configError['key']"
            placement="bottom"
            effect="danger"
          >
            <el-icon class="error">
              <RemoveFilled @click="configError['key'] = ''" />
            </el-icon>
            {{ configError['key'] }}
          </el-tooltip>
        </div>
        <span v-else @click="copyText(row.key)">{{ row.key }}</span>
      </template>
    </el-table-column>
    <el-table-column prop="value" label="Value" min-width="300" align="center">
      <template #default="{ row, $index }">
        <div v-if="editIndex == $index" class="editParam">
          <el-input
            v-model="editValue.value"
            style="padding-left: 15px; padding-right: 15px"
            placeholder="Configuration value"
          />
          <el-tooltip
            v-if="configError['value']"
            :content="configError['value']"
            placement="bottom"
            effect="danger"
          >
            <el-icon class="error">
              <RemoveFilled @click="configError['value'] = ''" />
            </el-icon>
            {{ configError['value'] }}
          </el-tooltip>
        </div>
        <span v-else style="text-align: center; color: var(--el-text-color-primary)">{{
          row.value
        }}</span>
      </template>
    </el-table-column>

    <el-table-column fixed="right" label="Operations" width="180" align="center">
      <template #header>
        <div>
          <el-button
            size="small"
            type="primary"
            text
            icon="CirclePlusFilled"
            :disabled="props.disabled"
            @click="addConfig"
          >
            Add Config
          </el-button>
        </div>
      </template>
      <template #default="{ row, $index }">
        <div v-if="editIndex != $index">
          <el-button size="small" type="warning" text icon="Edit" @click="editConfig(row, $index)">
            Edit
          </el-button>
          <el-button
            size="small"
            type="danger"
            text
            icon="DeleteFilled"
            @click="deleteConfig($index)"
          >
            Delete
          </el-button>
        </div>
        <div v-else>
          <el-button
            size="small"
            type="success"
            text
            icon="FolderChecked"
            @click="saveConfig($index, false)"
          >
            Save
          </el-button>
          <el-button
            size="small"
            type="warning"
            text
            icon="Close"
            @click="() => ((editIndex = -1), (configError = {}))"
          >
            Discard
          </el-button>
        </div>
      </template>
    </el-table-column>
  </el-table>
</template>

<script lang="ts" setup>
import { watch, ref, nextTick } from 'vue'
import { cloneDeep } from 'lodash'
import { useClipboard } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { RemoveFilled } from '@element-plus/icons-vue'

interface ConfigItem {
  key: string
  value: string
}

const configError = ref<Record<string, string>>({})
const { copy } = useClipboard()

const props = defineProps<{
  id: string
  disabled?: boolean
  parentId: string
}>()

const data = defineModel<ConfigItem[]>({
  required: true
})

const emits = defineEmits(['change'])

function copyText(text: string) {
  copy(text)
  ElMessage({
    message: 'Copied',
    type: 'success',
    plain: true,
    offset: 30,
    appendTo: `#configTable${props.parentId}${props.id}`
  })
}

const editIndex = ref(-1)
const editValue = ref<ConfigItem>({
  key: '',
  value: ''
})

function valid() {
  for (const [index, config] of data.value.entries()) {
    editConfig(config, index)
    const r = saveConfig(index, true)
    if (r != true) {
      return false
    }
  }
  editIndex.value = -1
  return true
}

function saveConfig(index: number, justValid: boolean) {
  let error = false

  const d: ConfigItem = cloneDeep(editValue.value)

  // 检查key是否为空
  if (!d.key.trim()) {
    configError.value['key'] = 'Key cannot be empty'
    error = true
  }

  // 检查key是否重复
  const key = d.key.trim()
  for (const [index, item] of data.value.entries()) {
    if (item.key === key && index !== editIndex.value) {
      configError.value['key'] = 'Key already exists'
      error = true
      break
    }
  }

  // 检查value（可以为空，但不能只包含空格）
  if (d.value !== d.value.trim()) {
    d.value = d.value.trim()
  }

  if (error) return false

  configError.value = {}
  if (justValid) {
    return true
  }

  data.value[index] = d
  editIndex.value = -1

  emits('change', data.value)
  return true
}

defineExpose({
  valid
})

function editConfig(row: ConfigItem, index: number) {
  editIndex.value = index
  editValue.value = cloneDeep(row)
}

function addConfig() {
  let configName = `config${data.value.length + 1}`

  // 检查配置名是否已存在
  const configKeys = data.value.map((item) => item.key)
  if (configKeys.includes(configName)) {
    let i = 1
    while (configKeys.includes(`${configName}${i}`)) {
      i++
    }
    configName = `${configName}${i}`
  }

  data.value.push({
    key: configName,
    value: ''
  })

  emits('change', data.value)
}

function deleteConfig(index: number) {
  data.value.splice(index, 1)
  emits('change', data.value)
}

const tableRowClassName = (val: any) => {
  if (val.rowIndex === editIndex.value) {
    if (Object.keys(configError.value).length > 0) {
      return 'error-row'
    }
  }
  return ''
}
</script>

<style>
.error-row {
  background-color: var(--el-color-danger-light-9) !important;
}
</style>
<style scoped>
.editParam {
  position: relative;
}

.editParam .error {
  position: absolute;
  color: var(--el-color-danger);
  top: 7px;
  left: 0px;
  z-index: 10;
}

.editParam .error:hover {
  cursor: pointer;
}
</style>
