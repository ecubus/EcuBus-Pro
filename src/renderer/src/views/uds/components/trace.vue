<template>
  <div>
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
        <el-tooltip effect="light" content="Clear Log" placement="bottom">
          <el-button type="danger" link @click="clearLog">
            <Icon :icon="circlePlusFilled" />
          </el-button>
        </el-tooltip>

        <!-- <el-tooltip effect="light" :content="autoScroll ? 'Disable Auto-Scroll' : 'Enable Auto-Scroll'" placement="bottom" >
                     <el-button :type="autoScroll ? 'success' : 'warning'" link @click="toggleAutoScroll">
                        <Icon :icon="autoScroll ? scrollIcon2 : scrollIcon1" />
                     </el-button>
                  </el-tooltip> -->
      </el-button-group>
      <el-tooltip effect="light" :content="isPaused ? 'Resume' : 'Pause'" placement="bottom">
        <el-button
          :type="isPaused ? 'success' : 'warning'"
          link
          :class="{ 'pause-active': isPaused }"
          @click="togglePause"
        >
          <Icon :icon="isPaused ? playIcon : pauseIcon" />
        </el-button>
      </el-tooltip>
      <el-divider v-if="showFilter" direction="vertical" />
      <el-dropdown v-if="showFilter">
        <span class="el-dropdown-link">
          <Icon :icon="filterIcon" />
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-checkbox-group v-model="checkList" size="small" style="width: 200px; margin: 10px">
              <el-checkbox
                v-for="item of LogFilter"
                :key="item.v"
                :label="item.label"
                :value="item.v"
                @change="filterChange(item.v, $event)"
              />
            </el-checkbox-group>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-divider direction="vertical" />
      <el-dropdown size="small">
        <el-button type="info" link @click="saveAll">
          <Icon :icon="saveIcon" />
        </el-button>

        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>Save as raw</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div :id="`traceTable-${props.editIndex}`" class="realLog"></div>
  </div>
</template>
<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed, toRef, watch, watchEffect, PropType } from 'vue'

import { CAN_ID_TYPE, CanMessage, CanMsgType, getDlcByLen } from 'nodeCan/can'
import { VxeGridProps } from 'vxe-table'
import { VxeGrid } from 'vxe-table'
import { Icon } from '@iconify/vue'
import circlePlusFilled from '@iconify/icons-material-symbols/scan-delete-outline'
import email from '@iconify/icons-material-symbols/mark-email-unread-outline-rounded'
import emailFill from '@iconify/icons-material-symbols/mark-email-unread-rounded'
import systemIcon from '@iconify/icons-material-symbols/manage-accounts-outline'
import preStart from '@iconify/icons-material-symbols/line-start-rounded'
import sent from '@iconify/icons-material-symbols/start-rounded'
import recv from '@iconify/icons-material-symbols/line-start-arrow-outline'
import info from '@iconify/icons-material-symbols/info-outline'
import errorIcon from '@iconify/icons-material-symbols/chat-error-outline-sharp'
import filterIcon from '@iconify/icons-material-symbols/filter-alt-off-outline'
import saveIcon from '@iconify/icons-material-symbols/save'
import pauseIcon from '@iconify/icons-material-symbols/pause-circle-outline'
import playIcon from '@iconify/icons-material-symbols/play-circle-outline'
import scrollIcon1 from '@iconify/icons-material-symbols/autoplay'
import scrollIcon2 from '@iconify/icons-material-symbols/autopause'
import konva from 'konva'
import { ServiceItem, Sequence, getTxPduStr, getTxPdu } from 'nodeCan/uds'
import { useDataStore } from '@r/stores/data'
import { LinDirection, LinMsg } from 'nodeCan/lin'
import { CTable, CTableColumns, LogData } from './trace'

const database = useDataStore()
const xGrid = ref()
// const logData = ref<LogData[]>([])

interface CanBaseLog {
  method: 'canBase'
  data: CanMessage
}
interface IpBaseLog {
  method: 'ipBase'
  data: {
    dir: 'OUT' | 'IN'
    data: Uint8Array
    ts: number
    local: string
    remote: string
    type: 'udp' | 'tcp'
    name: string
  }
}
interface LinBaseLog {
  method: 'linBase'
  data: LinMsg
}

interface UdsLog {
  method: 'udsSent' | 'udsRecv' | 'udsNegRecv'
  id?: string
  data: { service: ServiceItem; ts: number; recvData?: Uint8Array; msg?: string }
}
interface UdsErrorLog {
  method: 'udsError' | 'udsScript' | 'udsSystem' | 'canError' | 'linEvent'
  data: { msg: string; ts: number }
}
interface LinErrorLog {
  method: 'linError'
  data: { msg: string; ts: number; data?: LinMsg }
}

interface LogItem {
  message: CanBaseLog | UdsLog | UdsErrorLog | IpBaseLog | LinBaseLog | LinErrorLog
  level: string
  instance: string
  label: string
}

watch(window.globalStart, (val) => {
  if (val) {
    clearLog()
    isPaused.value = false
  }
})
function clearLog() {
  // logData.value = []
  // xGrid.value?.remove()
  cTable.clearData()
}
function data2str(data: Uint8Array) {
  return data.reduce((acc, val) => acc + val.toString(16).padStart(2, '0') + ' ', '')
}
function CanMsgType2Str(msgType: CanMsgType) {
  let str = ''
  if (msgType.canfd) {
    str += 'CANFD '
  }
  if (msgType.remote) {
    str += 'REMOTE '
  }
  if (msgType.brs) {
    str += 'BRS '
  }
  if (msgType.idType == CAN_ID_TYPE.STANDARD) {
    str += 'STD'
  } else {
    str += 'EXT'
  }
  return str
}
function insertData1(data: LogData[]) {
  xGrid.value.insertAt(data, -1).then((v: any) => {
    xGrid.value.scrollToRow(v.row)

    const { fullData } = xGrid.value.getTableData()
    const limit = 1000
    if (fullData.length > limit) {
      xGrid.value.remove(fullData.slice(0, fullData.length - limit + 10))
    }
  })
}
function insertData2(data: LogData[]) {
  cTable.addRows(data)
}
function logDisplay(vals: LogItem[]) {
  // Don't process logs when paused
  if (isPaused.value) return

  const logData: LogData[] = []
  const insertData = (data: LogData) => {
    logData.push(data)
  }
  for (const val of vals) {
    if (val.message.method == 'canBase') {
      // let name=
      // if(val.message.data.msgType.uuid){
      //    const node=database.nodes[val.message.data.msgType.uuid]
      //    if(node){
      //       name=node.name
      //    }
      // }
      insertData({
        method: val.message.method,
        dir: val.message.data.dir == 'OUT' ? 'Tx' : 'Rx',
        data: data2str(val.message.data.data),
        ts: ((val.message.data.ts || 0) / 1000000).toFixed(3),
        id: '0x' + val.message.data.id.toString(16),
        dlc: getDlcByLen(val.message.data.data.length, val.message.data.msgType.canfd),
        len: val.message.data.data.length,
        device: val.label,
        channel: val.instance,
        msgType: CanMsgType2Str(val.message.data.msgType),
        name: val.message.data.name
      })
    } else if (val.message.method == 'ipBase') {
      insertData({
        method: val.message.method,
        dir: val.message.data.dir == 'OUT' ? 'Tx' : 'Rx',
        data: data2str(val.message.data.data),
        ts: (val.message.data.ts / 1000000).toFixed(3),
        id: `${val.message.data.local}=>${val.message.data.remote}`,
        dlc: val.message.data.data.length,
        len: val.message.data.data.length,
        device: val.label,
        channel: val.instance,
        msgType: val.message.data.type.toLocaleUpperCase(),
        name: val.message.data.name
      })
    } else if (val.message.method == 'linBase') {
      insertData({
        method: val.message.method,
        dir: val.message.data.direction == LinDirection.SEND ? 'Tx' : 'Rx',
        data: data2str(val.message.data.data),
        ts: ((val.message.data.ts || 0) / 1000000).toFixed(3),
        id: '0x' + val.message.data.frameId.toString(16),
        len: val.message.data.data.length,
        device: val.label,
        channel: val.instance,
        msgType: 'LIN',
        dlc: val.message.data.data.length,
        name: val.message.data.name
      })
    } else if (val.message.method == 'udsSent') {
      let testerName = val.message.data.service.name
      if (val.message.id) {
        testerName = `${database.tester[val.message.id]?.name}.${val.message.data.service.name}`
      }

      insertData({
        method: val.message.method,
        dir: '--',
        name: testerName,
        data: `${data2str(val.message.data.recvData ? val.message.data.recvData : new Uint8Array(0))}`.trim(),
        ts: (val.message.data.ts / 1000000).toFixed(3),
        id: '',
        len: val.message.data.recvData ? val.message.data.recvData.length : 0,
        device: val.label,
        channel: val.instance,
        msgType: 'UDS Req' + (val.message.data.msg || '')
      })
    } else if (val.message.method == 'udsRecv') {
      let testerName = val.message.data.service.name
      if (val.message.id) {
        testerName = `${database.tester[val.message.id]?.name}.${val.message.data.service.name}`
      }
      const data = val.message.data.recvData ? val.message.data.recvData : new Uint8Array(0)
      let method: string = val.message.method
      let msgType = 'UDS Resp' + (val.message.data.msg || '')

      if (data[0] == 0x7f) {
        method = 'udsNegRecv'
        msgType = 'UDS Negative Resp' + (val.message.data.msg || '')
      }
      insertData({
        method: method,
        dir: '--',
        name: testerName,
        data: `${data2str(val.message.data.recvData ? val.message.data.recvData : new Uint8Array(0))}`.trim(),
        ts: (val.message.data.ts / 1000000).toFixed(3),
        id: '',
        len: val.message.data.recvData ? val.message.data.recvData.length : 0,
        device: val.label,
        channel: val.instance,
        msgType: msgType
      })
    } else if (val.message.method == 'canError') {
      //find last udsSent or udsPreSend

      insertData({
        method: val.message.method,
        name: '',
        data: val.message.data.msg,
        ts: (val.message.data.ts / 1000000).toFixed(3),
        id: '',
        len: 0,
        device: val.label,
        channel: val.instance,
        msgType: 'CAN Error'
      })
    } else if (val.message.method == 'linError') {
      if (val.message.data.data) {
        let method = 'linError'
        if (val.message.data.data?.isEvent || val.message.data.data?.frameId == 0x3d) {
          method = 'linWarning'
        }
        insertData({
          method: method,
          name: val.message.data.data.name,
          data: val.message.data.msg,
          ts: (val.message.data.ts / 1000000).toFixed(3),
          id: '0x' + val.message.data.data.frameId?.toString(16),
          len: val.message.data.data.data.length,
          dlc: val.message.data.data.data.length,
          dir: val.message.data.data.direction == LinDirection.SEND ? 'Tx' : 'Rx',
          device: val.label,
          channel: val.instance,
          msgType: 'LIN Error'
        })
      } else {
        insertData({
          method: val.message.method,
          name: '',
          data: val.message.data.msg,
          ts: (val.message.data.ts / 1000000).toFixed(3),
          id: '',
          len: 0,
          device: val.label,
          channel: val.instance,
          msgType: 'LIN Error'
        })
      }
    } else if (val.message.method == 'linEvent') {
      insertData({
        method: val.message.method,
        name: '',
        data: val.message.data.msg,
        ts: (val.message.data.ts / 1000000).toFixed(3),
        id: '',
        len: 0,
        device: val.label,
        channel: val.instance,
        msgType: 'LIN Event'
      })
    } else if (val.message.method == 'udsScript') {
      insertData({
        method: val.message.method,
        name: '',
        data: val.message.data.msg,
        ts: (val.message.data.ts / 1000000).toFixed(3),
        id: '',
        len: 0,
        device: val.label,
        channel: val.instance,
        msgType: 'Script Message'
      })
    } else if (val.message.method == 'udsSystem') {
      insertData({
        method: val.message.method,
        name: '',
        data: val.message.data.msg,
        ts: (val.message.data.ts / 1000000).toFixed(3),
        id: '',
        len: 0,
        device: val.label,
        channel: val.instance,
        msgType: 'System Message'
      })
    }
  }
  insertData2(logData)
}

const props = defineProps({
  editIndex: {
    type: String,
    default: ''
  },
  width: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  showFilter: {
    type: Boolean,
    default: true
  },
  defaultCheckList: {
    type: Array as PropType<string[]>,
    default: () => ['canBase', 'ipBase', 'linBase', 'uds']
  }
})

// Initialize checkList with the prop value
const checkList = ref(props.defaultCheckList)

function filterChange(method: 'uds' | 'canBase' | 'ipBase' | 'linBase', val: boolean) {
  const i = LogFilter.value.find((v) => v.v == method)
  if (i) {
    i.value.forEach((v) => {
      window.logBus.detach(v, logDisplay)
      if (val) {
        window.logBus.on(v, logDisplay)
      }
    })
  }
}

const tableHeight = computed(() => {
  return props.height - 20
})
const tableWidth = computed(() => {
  return props.width
})

const gridOptions = computed(() => {
  const v: VxeGridProps<LogData> = {
    border: true,
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
      height: 30
    },
    toolbarConfig: {
      slots: {
        tools: 'toolbar'
      }
    },
    align: 'center',
    columns: [
      {
        field: 'type',
        title: '',
        width: 36,
        resizable: false,
        editRender: {},
        slots: { default: 'default_type' }
      },
      { field: 'ts', title: 'Time', width: 100 },
      { field: 'name', title: 'Name', width: 200 },
      { field: 'data', title: 'Data', minWidth: 300 },
      { field: 'dir', title: 'Dir', width: 50 },
      // { field: 'seqIndex', title: 'Num', width: 50 },

      { field: 'id', title: 'ID', width: 100 },

      { field: 'dlc', title: 'DLC', width: 100 },
      { field: 'len', title: 'Len', width: 100 },
      { field: 'msgType', title: 'Type', width: 100 },
      { field: 'channel', title: 'Channel', width: 100 },
      { field: 'device', title: 'Device', width: 200 }
    ],
    rowClassName: ({ row }) => {
      return row.method
    },
    menuConfig: {
      body: {
        options: [
          [
            { code: 'copyRaw', name: 'Copy data as raw', visible: true, disabled: false },
            { code: 'copyArray', name: 'Copy data as array', visible: true, disabled: false },
            { code: 'copyRow', name: 'Copy row (json)', visible: true, disabled: false }
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
      const data = val.row.data
      navigator.clipboard.writeText(data)

      break
    }
    case 'copyArray': {
      const data1 = val.row.data
        .split(' ')
        .map((v: any) => `0x${v}`)
        .join(',')
      navigator.clipboard.writeText(data1)

      break
    }
    case 'copyRow': {
      const data2 = JSON.stringify(val.row, null, 2)
      navigator.clipboard.writeText(data2)

      break
    }
  }
}

function saveAll() {
  xGrid.value.exportData()
}
const isPaused = ref(false)
// const autoScroll = ref(true)
function scrollHandle(x) {
  if (x.type == 'body' && !isPaused.value && x.direction != 'left' && x.direction != 'right') {
    isPaused.value = true
  }
}

function getData() {
  return xGrid.value.getTableData()
}

defineExpose({
  clearLog,
  insertData: insertData1,
  getData
})

function togglePause() {
  isPaused.value = !isPaused.value
}

const LogFilter = ref<
  {
    label: string
    v: 'uds' | 'canBase' | 'ipBase' | 'linBase'
    value: string[]
  }[]
>([
  {
    label: 'CAN',
    v: 'canBase',
    value: ['canBase', 'canError']
  },
  {
    label: 'LIN',
    v: 'linBase',
    value: ['linBase', 'linError', 'linWarning', 'linEvent']
  },
  {
    label: 'UDS',
    v: 'uds',
    value: ['udsSent', 'udsRecv']
  },
  {
    label: 'ETH',
    v: 'ipBase',
    value: ['ipBase', 'ipError']
  }
])

let stage: konva.Stage
let cTable: CTable
onMounted(() => {
  for (const item of checkList.value) {
    const v = LogFilter.value.find((v) => v.v == item)
    if (v) {
      for (const val of v.value) {
        window.logBus.on(val, logDisplay)
      }
    }
  }
  stage = new konva.Stage({
    container: `traceTable-${props.editIndex}`, // id of container <div>
    width: tableWidth.value,
    height: tableHeight.value
  })
  const layer = new konva.Layer()
  stage.add(layer)
  cTable = new CTable(layer)
})
watch([tableWidth, tableHeight], () => {
  stage.setSize({ width: tableWidth.value, height: tableHeight.value })
  cTable.resize(tableWidth.value, tableHeight.value)
})

onUnmounted(() => {
  LogFilter.value.forEach((v) => {
    for (const val of v.value) {
      window.logBus.detach(val, logDisplay)
    }
  })
  cTable.close()
  stage.destroy()
})

const colorMap = {
  canBase: '#409eff',
  linEvent: '#67c23a',
  ipBase: 'rgb(51.2,126.4,204)',
  udsSent: '#909399',
  udsRecv: '#909399',
  canError: '#f56c6c',
  linError: '#f56c6c',
  linWarning: '#e6a23c',
  ipError: '#f56c6c',
  udsSystem: '#409eff',
  udsWarning: '#f56c6c',
  udsNegRecv: '#f56c6c'
}
</script>

<style>
.canBase {
  color: var(--el-color-primary);
}

.linEvent {
  color: var(--el-color-success);
}
.ipBase {
  color: var(--el-color-primary-dark-2);
}

.udsSent {
  color: var(--el-color-info);
}

.udsRecv {
  color: var(--el-color-info);
}

.canError {
  color: var(--el-color-danger);
}
.linError {
  color: var(--el-color-danger);
}
.linWarning {
  color: var(--el-color-warning);
}
.ipError {
  color: var(--el-color-danger);
}

.udsSystem {
  color: var(--el-color-primary);
}

.udsWarning {
  color: var(--el-color-warning);
}
.udsNegRecv {
  color: var(--el-color-warning);
}
.pause-active {
  box-shadow: inset 0 0 4px var(--el-color-info-light-5);
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
}
</style>
