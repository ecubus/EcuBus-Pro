<template>
  <div v-loading="loading">
    <el-tabs v-if="!loading" v-model="editableTabsValue" class="dbcTabs" type="card" addable>
      <template #add-icon>
        <el-tooltip effect="light" content="Delete Database" placement="bottom">
          <el-button type="info" link @click="deleteDatabase">
            <Icon :icon="deleteIcon" />
          </el-button>
        </el-tooltip>
        <el-tooltip effect="light" content="Save Database" placement="bottom">
          <el-button type="success" link @click="saveDataBase">
            <Icon :icon="saveIcon" :disabled="globalStart" />
          </el-button>
        </el-tooltip>
      </template>
      <el-tab-pane name="Overview" label="Overview">
        <el-form
          ref="formRef"
          :model="dbcObj"
          label-width="100px"
          size="small"
          style="margin: 20px"
        >
          <el-form-item label="Name">
            <el-input v-model="dbcObj.name" />
          </el-form-item>
          <el-form-item> </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
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
import Overview from './overfiew.vue'
import ValTable from './valTable.vue'
import AttrTable from './attrTable.vue'
import dbcParse from '../dbcParse'
import saveIcon from '@iconify/icons-material-symbols/save'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import { Icon } from '@iconify/vue'
import { Layout } from '@r/views/uds/layout'
import { useDataStore } from '@r/stores/data'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { assign, cloneDeep } from 'lodash'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { ORTIFile, parseORTI } from '../ortiParse'
import { useGlobalStart } from '@r/stores/runtime'

const layout = inject('layout') as Layout

const props = defineProps<{
  ortiFile?: string
  editIndex: string
  height: number
  width: number
}>()

const overfiewRef = ref()

const h = toRef(props, 'height')
const w = toRef(props, 'width')
const editableTabsValue = ref('Overview')
provide('height', h)
const database = useDataStore()

const dbcObj = ref<ORTIFile>() as Ref<ORTIFile>

const globalStart = useGlobalStart()

const existed = computed(() => {
  let existed = false
  if (database.database && database.database.orti) {
    existed = database.database.orti[props.editIndex] ? true : false
  }
  return existed
})

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
        delete database.database.orti[props.editIndex]
      })
      layout.removeWin(props.editIndex, true)
    })
    .catch(null)
}
function saveDataBase() {
  // Check for duplicate database name
  const isDuplicateName = Object.entries(database.database.orti).some(([key, db]) => {
    // Skip comparing with itself
    if (key === props.editIndex) return false
    return db.name === dbcObj.value.name
  })

  if (isDuplicateName) {
    ElNotification({
      offset: 50,
      type: 'error',
      message: `Database name "${dbcObj.value.name}" already exists`,
      appendTo: `#win${props.editIndex}`
    })
    return
  }

  database.$patch(() => {
    const db = cloneDeep(dbcObj.value)
    db.id = props.editIndex
    database.database.orti[props.editIndex] = db
  })
  layout.changeWinName(props.editIndex, dbcObj.value.name)
  layout.setWinModified(props.editIndex, false)

  ElNotification({
    offset: 50,
    type: 'success',
    message: 'The database has been saved successfully',
    appendTo: `#win${props.editIndex}`
  })
}
function handleTabSwitch(tabName: string) {
  editableTabsValue.value = tabName
}

const loading = ref(true)

onMounted(() => {
  // Add your onMounted logic here
  if (!existed.value && props.ortiFile) {
    loading.value = true
    window.electron.ipcRenderer
      .invoke('ipc-fs-readFile', props.ortiFile)
      .then((content: string) => {
        const result = parseORTI(content)
        if (result.success && result.data) {
          dbcObj.value = result.data
          dbcObj.value.name = window.path.parse(props.ortiFile!).name
        } else {
          ElMessageBox.alert('Parse failed', 'Error', {
            confirmButtonText: 'OK',
            type: 'error',
            buttonSize: 'small',
            appendTo: `#win${props.editIndex}`,
            message: `<pre style="max-height:200px;overflow:auto;width:380px;font-size:12px;line-height:16px">
${result.errors[0].line ?? ''}${result.errors[0].line ? ':' : ''}${result.errors[0].column ?? ''}${result.errors[0].column ? ':\\n' : ''}
${result.errors[0].message}
</pre>`,
            dangerouslyUseHTMLString: true
          }).finally(() => {
            layout.removeWin(props.editIndex, true)
          })
        }
        loading.value = false
      })
      .catch((err) => {
        ElMessageBox.alert('Parse failed', 'Error', {
          confirmButtonText: 'OK',
          type: 'error',
          buttonSize: 'small',
          appendTo: `#win${props.editIndex}`,
          message: err.message
        })
          .then(() => {
            layout.removeWin(props.editIndex, true)
          })
          .catch(null)
      })
  } else {
    dbcObj.value = cloneDeep(database.database.orti[props.editIndex])
    loading.value = false
    nextTick(() => {
      layout.setWinModified(props.editIndex, false)
    })
  }
})
</script>

<style lang="scss">
.dbcTabs {
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
