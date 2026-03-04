<template>
  <div class="export-container">
    <div class="export-form">
      <div class="export-section">
        <h3 class="section-title">{{ i18next.t('database.dbc.export.section.format') }}</h3>
        <el-radio-group v-model="selectedFormat" class="format-group">
          <el-radio-button v-for="opt in exportFormats" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="export-section">
        <h3 class="section-title">{{ i18next.t('database.dbc.export.section.description') }}</h3>
        <p class="format-desc">{{ currentFormatDesc }}</p>
      </div>

      <div class="export-actions">
        <el-button type="primary" :loading="exporting" :disabled="!dbcObj" @click="handleExport">
          <Icon :icon="downloadIcon" class="btn-icon" />
          {{ i18next.t('database.dbc.export.actions.export') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import downloadIcon from '@iconify/icons-material-symbols/download'
import type { CanDB } from 'nodeCan/can'
import { ElMessage, ElNotification } from 'element-plus'
import i18next from 'i18next'
import { cloneDeep } from 'lodash'

const props = defineProps<{
  editIndex: string
  width: number
  height: number
}>()

const dbcObj = defineModel<CanDB>({
  required: true
})

const exporting = ref(false)
const selectedFormat = ref('dbc')

const exportFormats = [
  { value: 'dbc', label: 'DBC', ext: 'dbc', descKey: 'database.dbc.export.formats.dbc' },
  { value: 'xlsx', label: 'Excel', ext: 'xlsx', descKey: 'database.dbc.export.formats.xlsx' },
  { value: 'arxml', label: 'ARXML', ext: 'arxml', descKey: 'database.dbc.export.formats.arxml' },
  { value: 'json', label: 'JSON', ext: 'json', descKey: 'database.dbc.export.formats.json' },
  { value: 'yaml', label: 'YAML', ext: 'yaml', descKey: 'database.dbc.export.formats.yaml' },
  { value: 'kcd', label: 'KCD', ext: 'kcd', descKey: 'database.dbc.export.formats.kcd' },
  { value: 'dbf', label: 'DBF', ext: 'dbf', descKey: 'database.dbc.export.formats.dbf' },
  { value: 'sym', label: 'SYM', ext: 'sym', descKey: 'database.dbc.export.formats.sym' }
]

const currentFormatDesc = computed(() => {
  const opt = exportFormats.find((f) => f.value === selectedFormat.value)
  return opt ? i18next.t(opt.descKey) : ''
})

const getFileFilters = () => {
  const opt = exportFormats.find((f) => f.value === selectedFormat.value)
  if (!opt) return []
  const ext = opt.ext
  const name = opt.label.toUpperCase()
  return [
    { name: `${name} (*.${ext})`, extensions: [ext] },
    { name: i18next.t('database.dbc.export.dialogs.allFiles'), extensions: ['*'] }
  ]
}

async function handleExport() {
  if (!dbcObj.value) {
    ElMessage.warning(i18next.t('database.dbc.export.errors.noData'))
    return
  }

  const opt = exportFormats.find((f) => f.value === selectedFormat.value)
  if (!opt) return

  const defaultName = `${dbcObj.value.name || 'database'}.${opt.ext}`

  try {
    const res = await window.electron.ipcRenderer.invoke('ipc-show-save-dialog', {
      title: i18next.t('database.dbc.export.dialogs.saveTitle'),
      defaultPath: defaultName,
      filters: getFileFilters()
    })

    if (res.canceled || !res.filePath) return

    let outputPath = res.filePath
    if (!outputPath.toLowerCase().endsWith(`.${opt.ext}`)) {
      outputPath = `${outputPath}.${opt.ext}`
    }

    exporting.value = true
    await window.electron.ipcRenderer.invoke('ipc-canmartix-exportOtherFile', {
      fileType: selectedFormat.value,
      candb: cloneDeep(dbcObj.value),
      outputFilePath: outputPath
    })

    ElNotification({
      offset: 50,
      type: 'success',
      message: i18next.t('database.dbc.export.messages.success', { path: outputPath }),
      appendTo: `#win${props.editIndex}`
    })
  } catch (err: any) {
    ElNotification({
      offset: 50,
      type: 'error',
      title: i18next.t('database.dbc.export.errors.exportFailed'),
      message: err?.message || String(err),
      appendTo: `#win${props.editIndex}`
    })
  } finally {
    exporting.value = false
  }
}
</script>

<style lang="scss" scoped>
.export-container {
  padding: 24px;
  max-width: 640px;
}

.export-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.export-section {
  .section-title {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.format-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.format-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.export-actions {
  padding-top: 8px;

  .btn-icon {
    margin-right: 6px;
    vertical-align: middle;
  }
}
</style>
