<template>
  <el-tabs v-if="!loading" v-model="editableTabsValue" class="ldfTabs" type="card" addable>
    <template #add-icon>
      <el-tooltip effect="light" content="Delete Database" placement="bottom">
        <el-button type="info" link @click="deleteDatabase">
          <Icon :icon="deleteIcon" />
        </el-button>
      </el-tooltip>
      <el-tooltip
        v-if="errorList.length == 0"
        effect="light"
        content="Save Database"
        placement="bottom"
      >
        <el-button type="success" link @click="saveDataBase">
          <Icon :icon="saveIcon" :disabled="globalStart" />
        </el-button>
      </el-tooltip>
      <el-tooltip
        v-else
        effect="light"
        content="Fix errors to save the database"
        placement="bottom"
      >
        <el-button type="danger" link :disabled="globalStart" @click="handleTabSwitch('General')">
          <Icon :icon="saveIcon" />
        </el-button>
      </el-tooltip>
    </template>
    <el-tab-pane v-for="item in vbsObj.idlObj" :key="item.id" :label="item.name">
      <h1>idl</h1>
    </el-tab-pane>
    <el-tab-pane label="Config" name="Config">
      <h1>config</h1>
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  toRef,
  inject,
  provide,
  Ref
} from 'vue'

import saveIcon from '@iconify/icons-material-symbols/save'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import { Icon } from '@iconify/vue'
import { Layout } from '@r/views/uds/layout'
import { useDataStore } from '@r/stores/data'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { assign, cloneDeep } from 'lodash'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { v4 } from 'uuid'
import { parseXml, parseIdl } from '../vbsParse'
const layout = inject('layout') as Layout

const errorList = ref<string[]>([])
const props = defineProps<{
  idlFilePath: string | string[]
  configFilePath: string
  editIndex: string
  height: number
}>()

const generateRef = ref()
const nodeRef = ref()
const h = toRef(props, 'height')
const editableTabsValue = ref('General')
provide('height', h)
const database = useDataStore()

const vbsObj = ref<(typeof database.database.vbs)[string]>() as Ref<
  (typeof database.database.vbs)[string]
>

const globalStart = computed(() => window.globalStart)

const existed = computed(() => {
  let existed = false
  if (database.database && database.database.vbs) {
    existed = database.database.vbs[props.editIndex] ? true : false
  }
  return existed
})

async function valid() {
  //
}

function deleteDatabase() {
  ElMessageBox.confirm('Are you sure you want to delete this database?', 'Warning', {
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    buttonSize: 'small',
    appendTo: `#win${props.editIndex}`,
    type: 'warning'
  })
    .then(() => {
      database.$patch(() => {
        delete database.database.vbs[props.editIndex]
      })
      layout.removeWin(props.editIndex, true)
    })
    .catch(null)
}
function saveDataBase() {
  valid()
    .then(() => {
      database.$patch(() => {
        const db = cloneDeep(vbsObj.value)
        db.id = props.editIndex
        database.database.vbs[props.editIndex] = db
      })
      layout.changeWinName(props.editIndex, vbsObj.value.name)
      layout.setWinModified(props.editIndex, false)

      ElNotification({
        offset: 50,
        type: 'success',
        message: 'The database has been saved successfully',
        appendTo: `#win${props.editIndex}`
      })
    })
    .catch(null)
}
function handleTabSwitch(tabName: string) {
  editableTabsValue.value = tabName
}

async function load() {
  const id = props.editIndex
  vbsObj.value = {
    id,
    idlFilePath: props.idlFilePath,
    configFilePath: props.configFilePath,
    name: `${window.path.parse(props.configFilePath).base}`,
    idlObj: {}
  }
  const idlFiles = Array.isArray(props.idlFilePath) ? props.idlFilePath : [props.idlFilePath]
  for (const idlFile of idlFiles) {
    const content = await window.electron.ipcRenderer.invoke('ipc-fs-readFile', idlFile)
    const subId = v4()
    const idl = await parseIdl(content)
    vbsObj.value.idlObj[subId] = {
      ...idl,
      id: subId,
      name: window.path.parse(idlFile).name
    }
  }

  const configContent = await window.electron.ipcRenderer.invoke(
    'ipc-fs-readFile',
    props.configFilePath
  )
  const config = parseXml(configContent)
  vbsObj.value.xmlObj = config
  layout.changeWinName(props.editIndex, vbsObj.value.name)
  console.log(vbsObj.value)
}

const loading = ref(true)
onMounted(() => {
  if (!existed.value) {
    load()
      .then(() => {
        layout.setWinModified(props.editIndex, true)
      })
      .catch((err) => {
        ElMessageBox.alert('Parse failed', 'Error', {
          confirmButtonText: 'OK',
          type: 'error',
          message: err.message
        })
          .then(() => {
            layout.removeWin(props.editIndex, true)
          })
          .catch(null)
      })
      .finally(() => {
        loading.value = false
      })
  } else {
    vbsObj.value = cloneDeep(database.database.vbs[props.editIndex])
    loading.value = false
    nextTick(() => {
      layout.setWinModified(props.editIndex, false)
    })
  }
})
</script>

<style lang="scss">
.ldfTabs {
  padding-right: 5px;
  margin-right: 5px;

  .el-tabs__header {
    margin-bottom: 0px !important;
  }
  .el-tabs__new-tab {
    width: 60px !important;
    cursor: default !important;
  }
}

.error-section {
  padding: 0 20px;
}

.error-type {
  color: var(--el-color-danger);
  font-weight: bold;
}

:deep(.error-cell) {
  cursor: pointer;
}

:deep(.error-row:hover) {
  background-color: var(--el-color-danger-light-9);
}

:deep(.error-highlight) {
  animation: highlightError 2s ease-in-out;
}

@keyframes highlightError {
  0%,
  100% {
    background-color: transparent;
  }

  50% {
    background-color: var(--el-color-danger-light-8);
  }
}
</style>
