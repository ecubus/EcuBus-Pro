<template>
  <el-input
    v-model="draft"
    :disabled="disabled"
    size="small"
    :aria-label="control.label"
    :aria-invalid="invalid || undefined"
    @focus="editing = true"
    @blur="editing = false"
    @change="commit"
  />
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { PanelControl } from 'src/preload/panel'
import type { PanelValue } from './runtime'
import { formatNumber, parseNumber } from './numeric'
import { usePanelLocale } from './locale'
const props = defineProps<{ control: PanelControl; value?: PanelValue; disabled?: boolean }>()
const emit = defineEmits<{ write: [value: number] }>()
const draft = ref('')
const editing = ref(false)
const invalid = ref(false)
const t = usePanelLocale()
watch(
  () => [props.value, props.disabled, props.control.numberFormat],
  () => {
    if (editing.value && !props.disabled) return
    draft.value = formatNumber(props.control, props.value ?? props.control.initialValue)
    invalid.value = false
  },
  { immediate: true }
)
function commit() {
  if (props.disabled) return
  try {
    const value = parseNumber(props.control, draft.value)
    emit('write', value)
    draft.value = formatNumber(props.control, value)
    invalid.value = false
  } catch {
    invalid.value = true
    ElMessage.error(t('invalidNumber'))
  }
}
</script>
