<template>
  <div v-if="data.panels[id]?.fileError">
    {{ t('panelFileFailed') }}: {{ data.panels[id].fileError }}
    <el-button @click="relinkFile">{{ t('relinkPanel') }}</el-button>
  </div>
  <div v-else-if="legacy">
    <el-button class="migration-button" @click="prepareMigration">{{
      t('migrationCopy')
    }}</el-button>
    <LegacyPanelEditor :height="height - 40" :edit-index="editIndex" />
    <el-dialog
      v-if="migrationOpen"
      v-model="migrationOpen"
      :title="t('migrationCopy')"
      width="560px"
      :append-to="`#win${editIndex}`"
    >
      <template v-if="migration">
        <p>{{ t('migrationLayout') }}</p>
        <p>
          {{ t('migrationConverted') }}: {{ migration.document.controls.length }} ·
          {{ t('migrationSkipped') }}: {{ migration.skipped.length }}
        </p>
        <el-table v-if="migration.skipped.length" :data="migration.skipped" max-height="260">
          <el-table-column prop="item" :label="t('components')" />
          <el-table-column :label="t('migrationSkipped')">
            <template #default="{ row }">{{ t(row.reason) }}</template>
          </el-table-column>
        </el-table>
      </template>
      <template #footer>
        <el-button @click="migrationOpen = false">{{ t('cancel') }}</el-button>
        <el-button
          type="primary"
          :disabled="!migration?.document.controls.length"
          @click="createMigrationCopy"
          >{{ t('migrationCreate') }}</el-button
        >
      </template>
    </el-dialog>
  </div>
  <FreePanelEditor
    v-else
    :initial-document="savedDocument"
    :initial-name="savedName"
    :height="height"
    :dialog-target="`#win${editIndex}`"
    @dirty="layout.setWinModified(editIndex, $event)"
    @save="save"
    @save-as="saveAs"
  />
</template>
<script setup lang="ts">
import { defineAsyncComponent, inject, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { v4 } from 'uuid'
import { useDataStore } from '@r/stores/data'
import { useProjectStore } from '@r/stores/project'
import {
  bindPanelFile,
  panelUsingFile,
  parsePanelFile,
  serializePanelFile
} from '@r/stores/panelFiles'
import type { Layout } from '../layout'
import type { PanelDocument } from 'src/preload/panel'
import { cloneDocument, createDocument } from './free/model'
import { migrateLegacyPanel, migrationCopyName } from './free/migration'
import { usePanelLocale } from './free/locale'
import FreePanelEditor from './free/FreePanelEditor.vue'
const LegacyPanelEditor = defineAsyncComponent(() => import('./LegacyPanelEditor.vue'))
const props = defineProps<{ height: number; editIndex: string }>()
const data = useDataStore()
const project = useProjectStore()
const layout = inject('layout') as Layout
const t = usePanelLocale()
const existing = data.panels[props.editIndex]
const legacy = !!existing && !existing.document && !existing.filePath
const savedDocument = ref(existing?.document ? cloneDocument(existing.document) : createDocument())
let nextNumber = 1
while (Object.values(data.panels).some((panel) => panel.name === `Panel ${nextNumber}`))
  nextNumber++
const savedName = ref(existing?.name || `Panel ${nextNumber}`)
const id = existing?.id || (props.editIndex === 'panel' ? v4() : props.editIndex)
const migrationOpen = ref(false)
const migration = ref<ReturnType<typeof migrateLegacyPanel>>()
function prepareMigration() {
  migration.value = migrateLegacyPanel(data.panels[props.editIndex], data.vars)
  migrationOpen.value = true
}
async function createMigrationCopy() {
  if (!migration.value?.document.controls.length) return
  const name = migrationCopyName(data.panels[props.editIndex].name, data.panels)
  const document = cloneDocument(migration.value.document)
  const filePath = await choosePanelFile(name)
  if (!filePath) return
  if (panelUsingFile(data.panels, filePath)) {
    ElMessage.error(t('fileInUse'))
    return
  }
  try {
    await window.electron.ipcRenderer.invoke(
      'ipc-fs-writeFile',
      filePath,
      serializePanelFile(name, document)
    )
  } catch {
    ElMessage.error(t('panelSaveFailed'))
    return
  }
  const copyId = v4()
  data.panels[copyId] = { id: copyId, name, filePath, document, rule: [], options: {} }
  migrationOpen.value = false
  layout.addWin('panel', copyId, { params: { 'edit-index': copyId } })
}
async function save(name: string, document: PanelDocument, filePath = data.panels[id]?.filePath) {
  if (!name) {
    ElMessage.error(t('nameRequired'))
    return
  }
  if (Object.values(data.panels).some((panel) => panel.id !== id && panel.name === name)) {
    ElMessage.error(t('nameExists'))
    return
  }
  if (!filePath) {
    await saveAs(name, document)
    return
  }
  if (panelUsingFile(data.panels, filePath, id)) {
    ElMessage.error(t('fileInUse'))
    return
  }
  if (filePath) {
    try {
      await window.electron.ipcRenderer.invoke(
        'ipc-fs-writeFile',
        filePath,
        serializePanelFile(name, document)
      )
    } catch {
      ElMessage.error(t('panelSaveFailed'))
      return
    }
  }
  data.panels[id] = {
    ...data.panels[id],
    id,
    name,
    filePath,
    document: cloneDocument(document),
    rule: data.panels[id]?.rule || [],
    options: data.panels[id]?.options || {}
  }
  savedDocument.value = cloneDocument(document)
  savedName.value = name
  layout.setWinModified(props.editIndex, false)
  layout.changeWinName(props.editIndex, name)
  layout.changeWinName(`p${id}`, name)
  ElMessage.success(t('saved'))
}
const fileFilters = [{ name: 'EcuBus Panel', extensions: ['ecpanel'] }]
async function choosePanelFile(name: string) {
  const result = await window.electron.ipcRenderer.invoke('ipc-show-save-dialog', {
    title: t('savePanelAs'),
    filters: fileFilters,
    defaultPath: window.path.join(
      project.projectInfo.path,
      `${name.replace(/[<>:"/\\|?*]/g, '_') || 'Panel'}.ecpanel`
    )
  })
  return result.canceled ? undefined : (result.filePath as string | undefined)
}
async function saveAs(name: string, document: PanelDocument) {
  const filePath = await choosePanelFile(name)
  if (filePath) await save(name, document, filePath)
}
async function relinkFile() {
  const result = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    title: t('importPanel'),
    filters: fileFilters,
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths?.[0]) return
  const filePath = result.filePaths[0]
  if (panelUsingFile(data.panels, filePath, id)) {
    ElMessage.error(t('fileInUse'))
    return
  }
  try {
    const file = parsePanelFile(
      await window.electron.ipcRenderer.invoke('ipc-fs-readFile', filePath, 'utf-8')
    )
    const document = bindPanelFile(file.document, data)
    savedDocument.value = cloneDocument(document)
    savedName.value = data.panels[id].name
    data.panels[id] = { ...data.panels[id], document, filePath, fileError: undefined }
  } catch {
    ElMessage.error(t('panelFileFailed'))
  }
}
</script>
<style scoped>
.migration-button {
  margin: 4px 8px;
}
</style>
