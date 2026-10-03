<template>
  <div class="panel-sources">
    <el-input v-model="search" :aria-label="t('search')" size="small" clearable />
    <div class="source-filters">
      <button
        v-for="kind in ['signal', 'variable'] as const"
        :key="kind"
        :class="{ active: filter === kind }"
        @click="filter = kind"
      >
        {{ t(kind) }}
      </button>
    </div>
    <div class="source-list">
      <button
        v-for="source in filtered"
        :key="source.key"
        draggable="true"
        :disabled="disabled"
        @dragstart="$event.dataTransfer?.setData('application/ecubus-panel-source', source.key)"
        @dblclick="emit('add', source.key)"
        @keydown.enter.prevent="emit('add', source.key)"
      >
        {{ source.label }}
      </button>
      <span v-if="!filtered.length" class="source-empty">{{ t('noData') }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PanelSource } from './sources'
import { usePanelLocale } from './locale'
const props = defineProps<{ sources: PanelSource[]; disabled?: boolean }>()
const emit = defineEmits<{ add: [key: string] }>()
const t = usePanelLocale()
const search = ref('')
const filter = ref<'signal' | 'variable'>('signal')
const filtered = computed(() =>
  props.sources.filter(
    (source) =>
      source.binding.kind === filter.value &&
      source.label.toLowerCase().includes(search.value.trim().toLowerCase())
  )
)
</script>
<style scoped>
.panel-sources {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.source-filters {
  display: flex;
  gap: 4px;
}
.source-filters button {
  flex: 1;
  background: transparent;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color);
  padding: 4px;
  cursor: pointer;
}
.source-filters .active {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.source-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.source-list button {
  text-align: left;
  overflow-wrap: anywhere;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  padding: 6px;
  font-size: 11px;
  cursor: grab;
}
.source-list button:disabled {
  opacity: 0.5;
  cursor: default;
}
.source-list button:hover {
  border-color: var(--el-color-primary);
}
.source-empty {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
