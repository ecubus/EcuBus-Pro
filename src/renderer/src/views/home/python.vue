<template>
  <div class="python-settings">
    <el-form :model="form" label-width="200px">
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>Python Executable</span>
            <el-tooltip
              content="Path to Python executable (default: python). Can be absolute path or command in PATH"
              placement="bottom"
              effect="light"
            >
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-input v-model="form.pythonPath" placeholder="python" style="width: 400px">
          <template #prefix>
            <el-icon><Document /></el-icon>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>Enable Virtual Environment</span>
            <el-tooltip
              content="Enable Python virtual environment support (venv)"
              placement="bottom"
              effect="light"
            >
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-switch
          v-model="form.enableVenv"
          inline-prompt
          active-text="Enabled"
          inactive-text="Disabled"
          @change="handleVenvChange"
        />
      </el-form-item>
      <el-form-item v-if="form.enableVenv">
        <template #label>
          <div class="label-container">
            <span>Virtual Environment Path</span>
            <el-tooltip
              content="Path to virtual environment directory (e.g., venv, .venv). Can be relative to project root or absolute path"
              placement="bottom"
              effect="light"
            >
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-input v-model="form.venvPath" placeholder="venv" style="width: 400px">
          <template #prefix>
            <el-icon><Folder /></el-icon>
          </template>
        </el-input>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { QuestionFilled, Document, Folder } from '@element-plus/icons-vue'
import { assign, isEqual, cloneDeep } from 'lodash'

const form = ref({
  pythonPath: 'python',
  enableVenv: false,
  venvPath: 'venv'
})
const OldVal = window.store.get('python.settings') as any

watch(
  form,
  (v) => {
    if (isEqual(v, OldVal)) {
      return
    }
    window.store.set('python.settings', cloneDeep(v))
  },
  { deep: true }
)

const handleVenvChange = (value: boolean) => {
  if (!value) {
    form.value.venvPath = 'venv'
  }
}

onMounted(() => {
  if (OldVal) {
    assign(form.value, OldVal)
  }
})
</script>

<style scoped>
.python-settings {
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
</style>
