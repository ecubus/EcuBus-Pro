<template>
  <el-button link @click="open">{{ i18next.t('uds.variable.memory.files') }}</el-button>
  <el-dialog
    v-model="visible"
    :title="i18next.t('uds.variable.memory.files')"
    width="800px"
    append-to-body
  >
    <el-table :data="records" row-key="id" @selection-change="selected = $event">
      <el-table-column type="selection" :selectable="(row: RecordInfo) => !row.protected" />
      <el-table-column :label="i18next.t('uds.variable.memory.project')" min-width="320">
        <template #default="{ row }">{{ row.projectPath || row.id }}</template>
      </el-table-column>
      <el-table-column :label="i18next.t('uds.variable.memory.modified')" width="180">
        <template #default="{ row }">{{
          row.modifiedAt === null ? '—' : new Date(row.modifiedAt).toLocaleString()
        }}</template>
      </el-table-column>
      <el-table-column :label="i18next.t('uds.variable.memory.state')" width="100">
        <template #default="{ row }">{{
          i18next.t(
            row.loadFailed
              ? 'uds.variable.memory.readFailed'
              : row.protected
                ? 'uds.variable.memory.inUse'
                : 'uds.variable.memory.stored'
          )
        }}</template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="visible = false">{{ i18next.t('uds.variable.buttons.cancel') }}</el-button>
      <el-button type="danger" :disabled="!selected.length || busy" @click="remove">{{
        i18next.t('uds.variable.memory.delete')
      }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import i18next from 'i18next'
type RecordInfo = {
  id: string
  projectPath: string
  modifiedAt: number | null
  protected: boolean
  loadFailed: boolean
}
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
    await ElMessageBox.confirm(
      i18next.t('uds.variable.memory.deleteConfirm'),
      i18next.t('uds.variable.memory.files'),
      { type: 'warning' }
    )
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
