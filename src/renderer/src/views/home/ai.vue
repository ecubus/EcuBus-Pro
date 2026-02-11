<template>
  <div class="ai-settings">
    <el-form :model="form" label-width="auto">
      <el-form-item>
        <template #label>
          <div class="label-container">
            <span>{{ $t('ai.generateSkillDoc') }}</span>
            <el-tooltip
              :content="$t('ai.generateSkillDocTooltip')"
              placement="bottom"
              effect="light"
            >
              <el-icon class="question-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </template>
        <el-switch v-model="form.generateSkillDoc" />
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { QuestionFilled } from '@element-plus/icons-vue'
import { assign, isEqual, cloneDeep } from 'lodash'

const OldVal = window.store.get('ai.settings') as any
const form = ref({
  generateSkillDoc: OldVal?.generateSkillDoc ?? true
})

watch(
  form,
  (v) => {
    if (isEqual(v, OldVal)) {
      return
    }
    window.store.set('ai.settings', cloneDeep(v))
  },
  { deep: true }
)

onMounted(() => {
  if (OldVal) {
    assign(form.value, OldVal)
  }
})
</script>

<style scoped>
.ai-settings {
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
