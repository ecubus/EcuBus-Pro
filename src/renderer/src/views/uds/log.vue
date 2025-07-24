<template>
  <div>
    <VxeGrid
      ref="xGrid"
      v-bind="gridOptions"
      class="sequenceTable"
      :height="tableHeight"
      @menu-click="menuClick"
    >
      <template #default_type="{ row }">
        <Icon
          v-if="row.level == 'error'"
          :icon="errorIcon"
          style="font-size: 14px; margin-top: 8px"
        />
        <Icon
          v-else-if="row.level == 'info'"
          :icon="infoIcon"
          style="font-size: 14px; margin-top: 8px"
        />
        <Icon
          v-else-if="row.level == 'warn'"
          :icon="warnIcon"
          style="font-size: 14px; margin-top: 8px"
        />
        <Icon
          v-else-if="row.level == 'success'"
          :icon="successIcon"
          style="font-size: 14px; margin-top: 8px"
        />
        <Icon
          v-else-if="row.level == 'primary'"
          :icon="primaryIcon"
          style="font-size: 14px; margin-top: 8px"
        />
      </template>
      <template #toolbar>
        <div
          style="
            justify-content: flex-start;
            display: flex;
            align-items: center;
            gap: 2px;
            margin-left: 5px;
          "
        >
          <el-button-group>
            <el-tooltip effect="light" content="Clear Message" placement="bottom">
              <el-button type="danger" link @click="clearLog">
                <Icon :icon="circlePlusFilled" />
              </el-button>
            </el-tooltip>
          </el-button-group>

          <el-divider direction="vertical" />
          <el-dropdown size="small">
            <el-button type="info" link @click="saveLog">
              <Icon :icon="saveIcon" />
            </el-button>

            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>Save Message</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </template>
      <template #message_content="{ row }">
        <span v-html="convertMessageToHtml(row.message)"></span>
      </template>
    </VxeGrid>
  </div>
</template>
<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed, toRef, watch } from 'vue'
import { CAN_ID_TYPE, CanMsgType, getDlcByLen } from 'nodeCan/can'
import { VxeGridProps, VxeGridPropTypes } from 'vxe-table'
import { VxeGrid } from 'vxe-table'
import { Icon } from '@iconify/vue'
import circlePlusFilled from '@iconify/icons-material-symbols/scan-delete-outline'
import infoIcon from '@iconify/icons-material-symbols/info-outline'
import errorIcon from '@iconify/icons-material-symbols/chat-error-outline-sharp'
import warnIcon from '@iconify/icons-material-symbols/warning-outline-rounded'
import saveIcon from '@iconify/icons-material-symbols/save'
import successIcon from '@iconify/icons-material-symbols/check-circle-outline'
import primaryIcon from '@iconify/icons-material-symbols/line-start-square-outline-rounded'
import { useProjectStore } from '@r/stores/project'
import type { TestEvent } from 'node:test/reporters'
import { useGlobalStart } from '@r/stores/runtime'
interface LogData {
  time: string
  label: string
  level: string
  message: string
}

const xGrid = ref()
const globalStart = useGlobalStart()
// const logData = ref<LogData[]>([])

function clearLog() {
  // logData.value = []
  xGrid.value?.remove().finally(() => {
    xGrid.value?.scrollTo(0, 0)
  })
}

const props = withDefaults(
  defineProps<{
    height: number
    prefix?: string
    captureTest?: boolean
    captureSystem?: boolean
    testId?: string[]
    fields?: string[]
  }>(),
  {
    prefix: '',
    captureTest: false,
    captureSystem: true,
    fields: () => ['time', 'source', 'message']
  }
)

function getData() {
  return xGrid.value.getTableData()
}

const testId = toRef(props, 'testId')
// const start = toRef(props, 'start')

defineExpose({
  clearLog,
  getData
})

watch(globalStart, (val) => {
  if (val) {
    clearLog()
  }
})
const tableHeight = toRef(props, 'height')
const project = useProjectStore()
// Add new function to convert message text to HTML with clickable links
function convertMessageToHtml(message: string) {
  return message.replace(/(https?:\/\/[^\s]+|file:\/\/[^\s]+)/g, (match) => {
    if (match.startsWith('file://')) {
      // Remove 'file://' prefix and convert to relative path
      const absolutePath = match.substring(7)
      const relativePath = window.path.relative(project.projectInfo.path, absolutePath)
      return `<strong>${relativePath}</strong>`
    }
    // Handle regular http/https URLs as before
    return `<a href="${match}" target="_blank">${match}</a>`
  })
}

const gridOptions = computed(() => {
  const columes: VxeGridPropTypes.Columns<LogData> = []
  for (const field of props.fields) {
    if (field == 'time') {
      columes.push({ field: 'time', title: 'Time', width: 120 })
    } else if (field == 'source') {
      columes.push({ field: 'label', title: 'Source', width: 200 })
    } else if (field == 'message') {
      columes.push({
        field: 'message',
        title: 'Message',
        minWidth: 200,
        align: 'left',
        slots: { default: 'message_content' } // Add custom slot for message
      })
    }
  }
  const v: VxeGridProps<LogData> = {
    border: false,
    size: 'mini',
    columnConfig: {
      resizable: true
    },
    showOverflow: true,
    scrollY: {
      enabled: true,
      gt: 0,
      mode: 'wheel'
    },
    rowConfig: {
      isCurrent: true,
      height: 30,
      keyField: 'id'
    },
    toolbarConfig: {
      slots: {
        tools: 'toolbar'
      }
    },
    align: 'center',
    columns: [
      {
        field: 'level',
        title: '#',
        width: 36,
        resizable: false,
        editRender: {},
        slots: { default: 'default_type' }
      },
      ...columes
    ],
    rowClassName: ({ row }) => {
      return row.level
    },
    menuConfig: {
      body: {
        options: [
          [
            {
              code: 'copyRaw',
              name: 'Copy',
              visible: true,
              disabled: false,
              prefixConfig: {
                icon: 'vxe-icon-copy'
              }
            }
          ]
        ]
      }
    }
  }

  return v
})

function menuClick(val: any) {
  switch (val.menu.code) {
    case 'copyRaw': {
      const data = `${val.row.label} ${val.row.message}`
      navigator.clipboard.writeText(data)
      break
    }
  }
}

function saveLog() {
  xGrid.value.exportData()
}

function udsLog(method: string, datas: any[]) {
  const logData: {
    time: string
    label: string
    level: string
    message: string
    id: number
  }[] = []
  datas.forEach((data) => {
    logData.push({
      time: new Date().toLocaleTimeString(),
      label: data.label,
      level: data.level,
      message: data.message.data.msg,
      id: cnt++
    })
  })
  xGrid.value.insertAt(logData, -1).then((v: any) => {
    xGrid.value.scrollToRow(v.row)
  })
}

function testLog(
  method: string,
  data: {
    message: {
      id: string
      data: TestEvent
      method: string
    }
    level: string
    label: string
  }[]
) {
  const logData: {
    time: string
    label: string
    level: string
    message: string
    id: number
  }[] = []
  for (const item of data) {
    if ((item.message.data?.data as any).name == '____ecubus_pro_test___') {
      continue
    }
    if (item.message.data.type == 'test:dequeue') {
      const key =
        item.message.data.data.name +
        ':' +
        item.message.data.data.line +
        ':' +
        item.message.data.data.column
      if (testId.value != undefined && !testId.value.includes(key)) {
        continue
      }
      logData.push({
        time: new Date().toLocaleTimeString(),
        label: item.message.data.data.name,
        level: 'primary',
        message: `Test ${item.message.data.data.name} starting...`,

        id: cnt++
      })
    } else if (item.message.data.type == 'test:pass') {
      const key =
        item.message.data.data.name +
        ':' +
        item.message.data.data.line +
        ':' +
        item.message.data.data.column
      if (testId.value != undefined && !testId.value.includes(key)) {
        continue
      }
      logData.push({
        time: new Date().toLocaleTimeString(),
        label: item.message.data.data.name,
        level: 'success',
        message: `Test ${item.message.data.data.name} passed, ${item.message.data.data.details.duration_ms}ms`,
        id: cnt++
      })
    } else if (item.message.data.type == 'test:fail') {
      const key =
        item.message.data.data.name +
        ':' +
        item.message.data.data.line +
        ':' +
        item.message.data.data.column
      if (testId.value != undefined && !testId.value.includes(key)) {
        continue
      }
      let file = item.message.data.data.file
      if (file) {
        file = window.path.relative(project.projectInfo.path, file)
      }
      logData.push({
        time: new Date().toLocaleTimeString(),
        label: item.message.data.data.name,
        level: 'error',
        message: `Test ${item.message.data.data.name} failed, ${item.message.data.data.details.duration_ms}ms, file: ${file}:${item.message.data.data.line}, details: ${item.message.data.data.details.error.message}`,
        id: cnt++
      })
    } else if (item.message.data.type == 'test:diagnostic') {
      logData.push({
        time: new Date().toLocaleTimeString(),
        label: 'Test Diagnostic',
        level: 'info',
        message: item.message.data.data.message,
        id: cnt++
      })
    }
  }
  xGrid.value.insertAt(logData, -1).then((v: any) => {
    xGrid.value.scrollToRow(v.row)
  })
}

let mainLog
let cnt = 0
onMounted(() => {
  cnt = 0
  if (props.captureSystem) {
    mainLog = window.electron.ipcRenderer.on('ipc-log-main', (event, data) => {
      data.time = new Date().toLocaleTimeString()
      data.id = cnt++
      xGrid.value?.insertAt(data, -1).then((v: any) => {
        xGrid.value.scrollToRow(v.row)
      })
    })
  }
  if (props.captureTest) {
    window.logBus.on('testInfo', testLog)
  }
  window.logBus.on(props.prefix + 'udsSystem', udsLog)
  window.logBus.on(props.prefix + 'udsScript', udsLog)
  window.logBus.on(props.prefix + 'udsWarning', udsLog)
})

onUnmounted(() => {
  if (props.captureSystem) {
    mainLog()
  }
  if (props.captureTest) {
    window.logBus.detach('testInfo', testLog)
  }
  window.logBus.detach(props.prefix + 'udsSystem', udsLog)
  window.logBus.detach(props.prefix + 'udsScript', udsLog)
  window.logBus.detach(props.prefix + 'udsWarning', udsLog)
})
</script>

<style>
.info {
  color: var(--el-color-info-dark-5);
}
.primary {
  color: var(--el-color-primary);
}
.debug {
  color: var(--el-color-info);
}

.success {
  color: var(--el-color-success);
}

.error {
  color: var(--el-color-danger);
}

.warn {
  color: var(--el-color-warning);
}

/* Add styles for links in messages */
.sequenceTable a {
  color: var(--el-color-primary);
  text-decoration: none;
  cursor: pointer;
}

.sequenceTable a:hover {
  text-decoration: underline;
}
</style>
