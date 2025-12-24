<template>
  <div class="plugin-settings">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="180px" @submit.prevent>
      <el-form-item label="Plugin Download Path" prop="downloadPath">
        <template #label>
          <div class="label-container">
            <span>Plugin Download Path</span>
            <el-tooltip placement="bottom" effect="light">
              <template #content>
                <div class="tooltip-content">
                  <div>The path where plugins will be downloaded.</div>
                  <div>Path must contain only English letters, numbers,</div>
                  <div>underscores (_), and path separators (/, \\, :).</div>
                  <div>No spaces or special characters allowed.</div>
                </div>
              </template>
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
        <div class="path-input-container">
          <el-input v-model="form.downloadPath" style="width: calc(100% - 100px)" />
          <el-button-group>
            <el-button :icon="Folder" title="Select Plugin Download Path" @click="selectPath" />
            <el-button
              :icon="FolderOpened"
              :disabled="!form.downloadPath"
              title="Open Plugin Download Path in File Manager"
              @click="openPath"
            />
          </el-button-group>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElNotification, FormInstance, FormRules } from 'element-plus'
import { QuestionFilled, Folder, FolderOpened } from '@element-plus/icons-vue'
import { assign, isEqual, cloneDeep } from 'lodash'

const formRef = ref<FormInstance>()
const form = ref({
  downloadPath: ''
})

// Path validation: only English letters, numbers, forward slashes, backslashes, colons, and underscores
// No spaces, no special characters, only English characters
const validatePathFormat = (path: string): boolean => {
  if (!path) return true // Allow empty path

  // Check for spaces
  if (/\s/.test(path)) {
    return false
  }

  // Only allow: English letters (a-z, A-Z), numbers (0-9), path separators (/, \), Windows drive colon (:), and underscore (_)
  const validPathRegex = /^[a-zA-Z0-9/\\:_]+$/
  if (!validPathRegex.test(path)) {
    return false
  }

  // Ensure all characters are ASCII (English only)
  for (let i = 0; i < path.length; i++) {
    const charCode = path.charCodeAt(i)
    if (charCode > 127) {
      return false // Non-ASCII character found (not English)
    }
  }

  return true
}

const validatePath = () => {
  if (!form.value.downloadPath) {
    return true
  }

  if (/\s/.test(form.value.downloadPath)) {
    return false
  }

  if (!validatePathFormat(form.value.downloadPath)) {
    return false
  }

  return true
}

const rules: FormRules = {
  downloadPath: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          callback()
          return
        }

        if (/\s/.test(value)) {
          callback(new Error('Path cannot contain spaces'))
          return
        }

        if (!validatePathFormat(value)) {
          callback(
            new Error(
              'Path must contain only English letters, numbers, underscores, and path separators. No spaces or special characters allowed.'
            )
          )
          return
        }

        callback()
      },
      trigger: 'blur'
    }
  ]
}

const OldVal = window.store.get('plugin.settings') as any

watch(
  form,
  (v) => {
    if (isEqual(v, OldVal)) {
      return
    }
    if (validatePath()) {
      window.store.set('plugin.settings', cloneDeep(v))
    }
  },
  { deep: true }
)

async function selectPath() {
  const result = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    title: 'Select Plugin Download Directory',
    properties: ['openDirectory']
  })

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return
  }

  const selectedPath = result.filePaths[0]
  console.log(selectedPath)
  // Validate the selected path
  if (validatePathFormat(selectedPath)) {
    form.value.downloadPath = selectedPath
  } else {
    ElNotification.error({
      message:
        'Selected path contains invalid characters. Only English letters, numbers, underscores, and path separators are allowed.',
      position: 'bottom-right'
    })
  }
}

async function openPath() {
  await window.electron.ipcRenderer.invoke('ipc-open-plugin-path')
}

onMounted(() => {
  if (OldVal) {
    assign(form.value, OldVal)
  }
})
</script>

<style scoped>
.plugin-settings {
  padding: 20px;
}

.label-container {
  display: flex;
  align-items: center;
}

.question-icon {
  margin-left: 4px;
  font-size: 14px;
  color: #909399;
  cursor: help;
  line-height: 1;
}

.error-message {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 4px;
}

.path-input-container {
  width: 100%;
  display: flex;
  gap: 8px;
  align-items: center;
}

.path-input-container :deep(.el-input) {
  flex: 1;
  max-width: 600px;
}

.tooltip-content {
  line-height: 1.5;
}
</style>
