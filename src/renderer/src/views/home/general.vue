<template>
  <div class="general-settings">
    <el-form :model="form" label-width="120px">
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>{{ $t('general.theme') }}</span>
            <el-tooltip :content="$t('general.themeTooltip')" placement="bottom" effect="light">
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-switch
          v-model="isDark"
          inline-prompt
          :active-icon="Moon"
          :inactive-icon="Sunny"
          @change="handleThemeChange"
        />
      </el-form-item>
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>{{ $t('general.language') }}</span>
          </div>
        </template>
        <LanguageSwitcher />
      </el-form-item>
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>{{ $t('general.uiZoom') }}</span>
            <el-tooltip :content="$t('general.uiZoomTooltip')" placement="bottom" effect="light">
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
        <div class="zoom-container">
          <el-slider
            v-model="form.zoom"
            :min="50"
            :max="200"
            :step="1"
            @change="handleZoomChange"
          />
          <span class="zoom-value">{{ form.zoom }}%</span>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { QuestionFilled, Moon, Sunny } from '@element-plus/icons-vue'
import { assign, isEqual, cloneDeep } from 'lodash'
import { useDark } from '@vueuse/core'
import LanguageSwitcher from '../../components/LanguageSwitcher.vue'

const isDark = useDark()
const form = ref({
  zoom: 100
})
const OldVal = window.store.get('general.settings') as any

watch(
  form,
  (v) => {
    if (isEqual(v, OldVal)) {
      return
    }
    window.store.set('general.settings', cloneDeep(v))
  },
  { deep: true }
)

const handleZoomChange = (value: number) => {
  window.electron.webFrame.setZoomFactor(value / 100)
}

const handleThemeChange = (value: boolean) => {
  isDark.value = value
}

onMounted(() => {
  if (OldVal) {
    assign(form.value, OldVal)
  }
})
</script>

<style scoped>
.general-settings {
  padding: 20px;
}

.zoom-container {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.zoom-container :deep(.el-slider) {
  width: 400px;
}

.zoom-value {
  min-width: 60px;
  color: #606266;
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
