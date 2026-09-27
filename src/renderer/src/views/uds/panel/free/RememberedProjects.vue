<template>
  <el-button link @click="open">{{ t('memoryFiles') }}</el-button>
  <el-dialog v-model="visible" :title="t('memoryFiles')" width="800px" append-to-body>
    <el-table :data="records" row-key="id" @selection-change="selected = $event">
      <el-table-column type="selection" :selectable="(row: RecordInfo) => !row.protected" />
      <el-table-column :label="t('memoryProject')" min-width="320">
        <template #default="{ row }">{{ row.projectPath || row.id }}</template>
      </el-table-column>
      <el-table-column :label="t('memoryModified')" width="180">
        <template #default="{ row }">{{ new Date(row.modifiedAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column :label="t('memoryState')" width="100">
        <template #default="{ row }">{{
          t(row.loadFailed ? 'memoryReadFailed' : row.protected ? 'memoryInUse' : 'memoryStored')
        }}</template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="visible = false">{{ t('cancel') }}</el-button>
      <el-button type="danger" :disabled="!selected.length || busy" @click="remove">{{
        t('memoryDelete')
      }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usePanelLocale } from './locale'
type RecordInfo = {
  id: string
  projectPath: string
  modifiedAt: number
  protected: boolean
  loadFailed: boolean
}
const t = usePanelLocale()
const visible = ref(false)
const busy = ref(false)
const records = ref<RecordInfo[]>([])
const selected = ref<RecordInfo[]>([])
async function refresh() {
  records.value = await window.electron.ipcRenderer.invoke('ipc-var-memory-list')
  selected.value = []
}
async function open() {
  try {
    await refresh()
    visible.value = true
  } catch (error) {
    ElMessage.error(String(error))
  }
}
async function remove() {
  try {
    await ElMessageBox.confirm(t('memoryDeleteConfirm'), t('memoryFiles'), { type: 'warning' })
  } catch {
    return
  }
  busy.value = true
  try {
    await window.electron.ipcRenderer.invoke(
      'ipc-var-memory-delete',
      selected.value.map((row) => row.id)
    )
  } catch (error) {
    ElMessage.error(String(error))
  } finally {
    busy.value = false
    await refresh().catch((error) => ElMessage.error(String(error)))
  }
}
</script>
