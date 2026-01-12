<template>
  <div>
    <el-tabs v-if="!loading" v-model="editableTabsValue" class="ldfTabs" type="card" addable>
      <template #add-icon>
        <el-tooltip
          effect="light"
          :content="i18next.t('database.ldf.index.tooltips.deleteDatabase')"
          placement="bottom"
        >
          <el-button type="info" link @click="deleteDatabase">
            <Icon :icon="deleteIcon" />
          </el-button>
        </el-tooltip>
        <el-tooltip
          v-if="errorList.length == 0"
          effect="light"
          :content="i18next.t('database.ldf.index.tooltips.saveDatabase')"
          placement="bottom"
        >
          <el-button type="success" link @click="saveDataBase">
            <Icon :icon="saveIcon" :disabled="globalStart" />
          </el-button>
        </el-tooltip>
        <el-tooltip
          v-else
          effect="light"
          :content="i18next.t('database.ldf.index.tooltips.fixErrorsToSave')"
          placement="bottom"
        >
          <el-button
            type="danger"
            link
            :disabled="globalStart"
            @click="handleTabSwitch(i18next.t('database.ldf.index.tabs.general'))"
          >
            <Icon :icon="saveIcon" />
          </el-button>
        </el-tooltip>
      </template>
      <el-tab-pane
        :name="i18next.t('database.ldf.index.tabs.general')"
        :label="i18next.t('database.ldf.index.tabs.general')"
      >
        <General ref="generateRef" v-model="ldfObj" :edit-index="props.editIndex" />

        <!-- Add error section -->
        <template v-if="errorList.length != 0">
          <div class="error-section">
            <el-divider />

            <VxeGrid v-if="errorList.length > 0" ref="errorGrid" v-bind="errorGridOptions">
              <template #message="{ row }">
                <span class="error-type">{{ row.message }}</span>
              </template>
              <template #tab="{ row }">
                <el-button link type="danger" size="small" @click="handleTabSwitch(row.tab)">{{
                  row.tab
                }}</el-button>
              </template>
            </VxeGrid>
          </div>
        </template>
      </el-tab-pane>
      <el-tab-pane
        :name="i18next.t('database.ldf.index.tabs.nodes')"
        :label="i18next.t('database.ldf.index.tabs.nodes')"
      >
        <Node ref="nodeRef" v-model="ldfObj" :edit-index="props.editIndex" />
      </el-tab-pane>
      <el-tab-pane
        :name="i18next.t('database.ldf.index.tabs.signals')"
        :label="i18next.t('database.ldf.index.tabs.signals')"
      >
        <Signal ref="SignalRef" v-model="ldfObj" :edit-index="props.editIndex" />
      </el-tab-pane>
      <el-tab-pane
        :name="i18next.t('database.ldf.index.tabs.frames')"
        :label="i18next.t('database.ldf.index.tabs.frames')"
      >
        <Frame ref="FrameRef" v-model="ldfObj" :edit-index="props.editIndex" />
      </el-tab-pane>
      <el-tab-pane
        :name="i18next.t('database.ldf.index.tabs.scheduleTables')"
        :label="i18next.t('database.ldf.index.tabs.scheduleTables')"
      >
        <Sch ref="SchRef" v-model="ldfObj" :edit-index="props.editIndex" />
      </el-tab-pane>
      <el-tab-pane
        :name="i18next.t('database.ldf.index.tabs.encodings')"
        :label="i18next.t('database.ldf.index.tabs.encodings')"
      >
        <Encode ref="EncodeRef" v-model="ldfObj" :edit-index="props.editIndex" />
      </el-tab-pane>
      <el-tab-pane
        :name="i18next.t('database.ldf.index.tabs.ldfFile')"
        :label="i18next.t('database.ldf.index.tabs.ldfFile')"
      >
        <File :ldf-obj="ldfObj" :edit-index="props.editIndex" />
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
import General from './general.vue'
import Node from './node.vue'
import Signal from './signal.vue'
import ldfParse, { LDF } from '../ldfParse'
import saveIcon from '@iconify/icons-material-symbols/save'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import { Icon } from '@iconify/vue'
import { Layout } from '@r/views/uds/layout'
import { useDataStore } from '@r/stores/data'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { assign, cloneDeep } from 'lodash'
import Frame from './frame.vue'
import Sch from './sch.vue'
import Encode from './encode.vue'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import File from './file.vue'
import { useGlobalStart } from '@r/stores/runtime'
import i18next from 'i18next'

const layout = inject('layout') as Layout

const props = defineProps<{
  ldfFile?: string
  editIndex: string
  height: number
}>()

const generateRef = ref()
const nodeRef = ref()
const h = toRef(props, 'height')
const editableTabsValue = ref(i18next.t('database.ldf.index.tabs.general'))
provide('height', h)
const database = useDataStore()

const ldfObj = ref<LDF>() as Ref<LDF>

const globalStart = useGlobalStart()

const existed = computed(() => {
  let existed = false
  if (database.database && database.database.lin) {
    existed = database.database.lin[props.editIndex] ? true : false
  }
  return existed
})

interface ValidateError {
  message?: string
  field?: string
}

type ValidateFieldsError = Record<string, ValidateError[]>
interface ErrorItem {
  tab: string
  message?: string
  field?: string
}

const errorList = ref<ErrorItem[]>([])

const errorGridOptions = computed<VxeGridProps>(() => ({
  border: true,
  size: 'mini',
  height: h.value - 400,
  showOverflow: true,
  columnConfig: { resizable: true },
  rowConfig: {
    isCurrent: true,
    className: 'error-row'
  },
  columns: [
    {
      field: 'tab',
      title: i18next.t('database.ldf.index.columns.tab'),
      width: 120,
      slots: { default: 'tab' }
    },
    {
      field: 'field',
      title: i18next.t('database.ldf.index.columns.field'),
      minWidth: 200
    },
    {
      field: 'message',
      title: i18next.t('database.ldf.index.columns.errorMessage'),
      slots: { default: 'message' },
      minWidth: 200
    }
  ],
  data: errorList.value
}))

const SignalRef = ref()
const FrameRef = ref()
const SchRef = ref()
const EncodeRef = ref()
async function valid() {
  const list: Promise<void>[] = []

  list.push(generateRef.value.validate())
  list.push(nodeRef.value.validate())
  list.push(SignalRef.value.validate())
  list.push(FrameRef.value.validate())
  list.push(SchRef.value.validate())
  list.push(EncodeRef.value.validate())
  const result = await Promise.allSettled(list)
  errorList.value = []
  for (const [index, r] of result.entries()) {
    if (r.status == 'rejected') {
      const errors = r.reason as {
        tab: string
        error: {
          field: string
          message: string
        }[]
      }

      for (const [field, error] of Object.entries(errors.error)) {
        errorList.value.push({
          tab: errors.tab,
          message: error.message,
          field: error.field
        })
      }
    }
  }
  if (errorList.value.length > 0) {
    throw new Error('Invalid')
  }
}

function deleteDatabase() {
  ElMessageBox.confirm(
    i18next.t('database.ldf.index.dialogs.confirmDelete'),
    i18next.t('database.ldf.index.dialogs.warning'),
    {
      confirmButtonText: i18next.t('database.ldf.index.buttons.ok'),
      cancelButtonText: i18next.t('database.ldf.index.buttons.cancel'),
      buttonSize: 'small',
      appendTo: `#win${props.editIndex}`,
      type: 'warning'
    }
  )
    .then(() => {
      database.$patch(() => {
        delete database.database.lin[props.editIndex]
      })
      layout.removeWin(props.editIndex, true)
    })
    .catch(null)
}
function saveDataBase() {
  valid()
    .then(() => {
      database.$patch(() => {
        const db = cloneDeep(ldfObj.value)
        db.id = props.editIndex
        database.database.lin[props.editIndex] = db
      })
      layout.changeWinName(props.editIndex, ldfObj.value.name)
      layout.setWinModified(props.editIndex, false)

      ElNotification({
        offset: 50,
        type: 'success',
        message: i18next.t('database.ldf.index.messages.databaseSavedSuccessfully'),
        appendTo: `#win${props.editIndex}`
      })
    })
    .catch(null)
}
function handleTabSwitch(tabName: string) {
  editableTabsValue.value = tabName
}

let timeout
watch(
  ldfObj,
  (val) => {
    layout.setWinModified(props.editIndex, true)
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      valid().catch(null)
    }, 500)
  },
  { deep: true }
)

const loading = ref(true)
onMounted(() => {
  // Add your onMounted logic here
  if (!existed.value) {
    window.electron.ipcRenderer
      .invoke('ipc-fs-readFile', props.ldfFile)
      .then((content: string) => {
        try {
          const result = ldfParse(content)
          ldfObj.value = result
          ldfObj.value.name = window.path.parse(props.ldfFile!).name
          loading.value = false
        } catch (err: any) {
          ElMessageBox.alert(
            i18next.t('database.ldf.index.messages.parseFailed'),
            i18next.t('database.ldf.index.messages.error'),
            {
              confirmButtonText: i18next.t('database.ldf.index.buttons.ok'),
              type: 'error',
              buttonSize: 'small',
              appendTo: `#win${props.editIndex}`,
              message: `<pre style="max-height:200px;overflow:auto;width:380px;font-size:12px;line-height:12px">${err.message}</pre>`,
              dangerouslyUseHTMLString: true
            }
          ).finally(() => {
            layout.removeWin(props.editIndex, true)
          })
        }
      })
      .catch((err) => {
        ElMessageBox.alert(
          i18next.t('database.ldf.index.messages.parseFailed'),
          i18next.t('database.ldf.index.messages.error'),
          {
            confirmButtonText: i18next.t('database.ldf.index.buttons.ok'),
            type: 'error',
            buttonSize: 'small',
            appendTo: `#win${props.editIndex}`,
            message: err.message
          }
        )
          .then(() => {
            layout.removeWin(props.editIndex, true)
          })
          .catch(null)
      })
  } else {
    ldfObj.value = cloneDeep(database.database.lin[props.editIndex])
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
