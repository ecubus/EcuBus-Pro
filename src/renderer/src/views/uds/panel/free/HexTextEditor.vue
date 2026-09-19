<template>
  <div class="hex-text-editor">
    <span v-if="invalid" class="editor-error" role="status">{{ t('invalidHex') }}</span>
    <el-input
      v-if="mode !== 'text'"
      v-model="hex"
      type="textarea"
      resize="none"
      :readonly="disabled"
      :aria-label="`${control.label} HEX`"
      :aria-invalid="invalid || undefined"
      @focus="editing = true"
      @blur="editing = false"
      @change="commit(true)"
    />
    <el-input
      v-if="mode !== 'hex'"
      v-model="text"
      type="textarea"
      resize="none"
      :readonly="disabled"
      :aria-label="`${control.label} Text`"
      @focus="editing = true"
      @blur="editing = false"
      @change="commit(false)"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { PanelControl } from 'src/preload/panel'
import type { PanelValue } from './runtime'
import { formatHex, parseEditorValue, validBytes } from './hexText'
import { usePanelLocale } from './locale'
const props = defineProps<{ control: PanelControl; value?: PanelValue; disabled?: boolean }>()
const emit = defineEmits<{ write: [value: string | number[]] }>()
const mode = computed(() => props.control.editorMode || 'text')
const array = computed(
  () =>
    props.control.binding?.kind === 'variable' &&
    props.control.binding.node.bindValue.variableValueType === 'array'
)
const hex = ref('')
const text = ref('')
const invalid = ref(false)
const editing = ref(false)
const t = usePanelLocale()
function display(value: string | number[] | undefined) {
  if (Array.isArray(value) && !validBytes(value)) {
    hex.value = ''
    text.value = ''
    invalid.value = true
    return
  }
  hex.value = formatHex(value)
  text.value = Array.isArray(value)
    ? value.map((byte) => String.fromCharCode(byte)).join('')
    : value || ''
  invalid.value = false
}
watch(
  () => [props.value, props.disabled, props.control.binding, props.control.editorMode],
  () => {
    if (editing.value && !props.disabled) return
    display(typeof props.value === 'number' ? undefined : props.value)
  },
  { immediate: true, deep: true }
)
function commit(isHex: boolean) {
  if (props.disabled) return
  try {
    const value = parseEditorValue(isHex ? hex.value : text.value, isHex, array.value)
    emit('write', value)
    display(value)
  } catch {
    invalid.value = true
    ElMessage.error(t('invalidHex'))
  }
}
</script>
<style scoped>
.hex-text-editor {
  position: relative;
  display: flex;
  gap: 6px;
  width: 100%;
  height: 100%;
  min-height: 32px;
}
.editor-error {
  position: absolute;
  bottom: 0;
  left: 4px;
  z-index: 1;
  color: var(--el-color-danger);
  font-size: 11px;
  background: var(--el-bg-color);
}
.hex-text-editor > .el-textarea {
  flex: 1;
  min-width: 0;
  height: 100%;
}
.hex-text-editor :deep(textarea) {
  height: 100%;
  font-family: Consolas, monospace;
  font-size: inherit;
}
</style>
