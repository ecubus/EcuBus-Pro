<template>
  <div v-if="panel?.fileError">{{ t('panelFileFailed') }}: {{ panel.fileError }}</div>
  <FreePanelView v-else-if="panel?.document" :document="panel.document" :height="height" />
  <LegacyPanelView v-else :height="height" :edit-index="editIndex" />
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useDataStore } from '@r/stores/data'
import FreePanelView from './free/FreePanelView.vue'
import { usePanelLocale } from './free/locale'
const t = usePanelLocale()
const LegacyPanelView = defineAsyncComponent(() => import('./LegacyPanelView.vue'))
const props = defineProps<{ height: number; editIndex: string }>()
const data = useDataStore()
const panel = computed(() => data.panels[props.editIndex.slice(1)])
</script>
