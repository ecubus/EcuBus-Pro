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
        <el-tooltip effect="light" content="Clear Trace" placement="bottom">
          <el-button type="danger" link @click="clearLog('Clear Trace')">
            <Icon :icon="circlePlusFilled" />
          </el-button>
        </el-tooltip>

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
        <el-tooltip effect="light" content="Swtich Overwrite/Scroll" placement="bottom">
          <el-button
            :type="isOverwrite ? 'success' : 'primary'"
            link
            :class="{ 'pause-active': isOverwrite }"
            @click="toggleOverwrite"
          >
            <Icon :icon="switchIcon" />
          </el-button>
        </el-tooltip>
      </el-button-group>

      <el-divider v-if="showFilter" direction="vertical" />
      <el-dropdown v-if="showFilter" trigger="click">
        <span class="el-dropdown-link">
          <Icon :icon="filterIcon" />
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-checkbox-group v-model="checkList" size="small" style="margin: 10px; width: 150px">
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
      <el-select
        v-model="instanceList"
        size="small"
        style="width: 200px; margin: 4px; margin-left: 6px"
        multiple
        collapse-tags
        placeholder="Filter by device"
        clearable
      >
        <el-option v-for="item of allInstanceList" :key="item" :label="item" :value="item" />
      </el-select>
      <el-select
        v-model="idFilterList"
        size="small"
        style="width: 300px; margin: 4px"
        multiple
        collapse-tags
        collapse-tags-tooltip
        placeholder="Filter by ID"
        clearable
        allow-create
        filterable
      >
        <el-option v-for="item of idList" :key="item" :label="item" :value="item" />
      </el-select>
      <el-divider direction="vertical" />
      <el-dropdown size="small" @command="saveAll">
        <el-button type="info" link>
          <Icon :icon="saveIcon" />
        </el-button>

        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="excel">Save as Excel</el-dropdown-item>
            <el-dropdown-item command="asc">Save as ASC</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div :id="`traceTable-${props.editIndex}`" class="realLog"></div>
  </div>
</template>
<script lang="ts" setup>
import {
  ref,
  onMounted,
  onUnmounted,
  computed,
  toRef,
  watch,
  watchEffect,
  PropType,
  nextTick,
  handleError,
  Ref
} from 'vue'

import { CAN_ID_TYPE, CanMessage, CanMsgType, getDlcByLen } from 'nodeCan/can'
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
import switchIcon from '@iconify/icons-material-symbols/cameraswitch-outline-rounded'
import scrollIcon1 from '@iconify/icons-material-symbols/autoplay'
import scrollIcon2 from '@iconify/icons-material-symbols/autopause'
import ExcelJS from 'exceljs'

import { ServiceItem, Sequence, getTxPduStr, getTxPdu } from 'nodeCan/uds'
import { useDataStore } from '@r/stores/data'
import { LinDirection, LinMsg } from 'nodeCan/lin'
import EVirtTable, { Column } from 'e-virt-table'
import { ElLoading } from 'element-plus'
import { useGlobalStart } from '@r/stores/runtime'
let allLogData: LogData[] = []

interface LogData {
  dir?: 'Tx' | 'Rx' | '--'
  data: string
  ts: string
  id: string
  key?: string | number
  dlc?: number
  len?: number
  device: string
  channel: string
  msgType: string
  method: string
  name?: string
  seqIndex?: number
  children?: LogData[] | { name: string; data: string }[]
  deltaTime?: string
  previousTs?: string
}
const isOverwrite = ref(false)
function toggleOverwrite() {
  isOverwrite.value = !isOverwrite.value
  if (isOverwrite.value) {
    // clearLog('Switch Overwrite Mode')
    // remove duplicate data
    const uniqueData = allLogData.filter(
      (item, index, self) => index === self.findIndex((t) => t.key === item.key)
    )
    allLogData = uniqueData
    grid.loadData(allLogData)
  }
}
const database = useDataStore()
const instanceList = ref<string[]>([])
const allInstanceList = computed(() => {
  const list: string[] = []
  for (const item of Object.values(database.devices)) {
    if (item.type == 'can' && item.canDevice) {
      list.push(item.canDevice.name)
    } else if (item.type == 'lin' && item.linDevice) {
      list.push(item.linDevice.name)
    } else if (item.type == 'eth' && item.ethDevice) {
      list.push(item.ethDevice.name)
    }
  }
  return list
})

// ID filter functionality
const idFilterList = ref<string[]>([])
const idList = ref<Set<string>>(new Set())

function addToIdList(id: string) {
  if (
    id &&
    id !== 'canError' &&
    id !== 'linError' &&
    id !== 'linEvent' &&
    id !== 'udsScript' &&
    id !== 'udsSystem'
  ) {
    idList.value.add(id)
  }
}
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
const globalStart = useGlobalStart()
watch(globalStart, (val) => {
  if (val) {
    clearLog('Start Trace')
    isPaused.value = false
  }
})

function clearLog(msg = 'Clear Trace') {
  allLogData = []
  idList.value.clear()

  scrollY = -1

  grid.clearSelection()
  grid.loadData([])
  grid.setExpandRowKeys([])
  grid.scrollYTo(0)
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

const maxLogCount = 50000
const showLogCount = 500

function insertData2(data: LogData[]) {
  if (isOverwrite.value) {
    for (const item of data) {
      if (item.id) {
        // Find index of existing log with same id
        const idx = allLogData.findIndex((log) => log.key === item.key)
        if (idx !== -1) {
          // Overwrite the existing log entry
          // Calculate delta time
          const existingLog = allLogData[idx]
          const currentTime = parseFloat(item.ts)
          const previousTime = parseFloat(existingLog.ts)
          const deltaMs = (currentTime - previousTime) * 1000 // Convert to milliseconds

          // Store previous timestamp and delta time
          item.previousTs = existingLog.ts
          item.deltaTime = deltaMs >= 0 ? `(Δ${deltaMs.toFixed(1)}ms)` : ''

          allLogData[idx] = item
        } else {
          allLogData.push(item)
        }
      } else {
        allLogData.push(item)
      }
    }
  } else {
    allLogData.push(...data)
  }
  if (allLogData.length > maxLogCount) {
    const excessRows = allLogData.length - maxLogCount
    allLogData.splice(0, excessRows)
  }

  // 根据暂停状态决定加载多少数据
  const displayData = isPaused.value ? allLogData : allLogData.slice(-showLogCount)
  grid.clearSelection()
  if (!isOverwrite.value) {
    grid.clearSelection()
    grid.setExpandRowKeys([])
  }
  grid.loadData(displayData)
  if (!isOverwrite.value) {
    grid.scrollYTo(99999999999)
  }
}

let uid = 0
function logDisplay(method: string, vals: LogItem[]) {
  // Don't process logs when paused
  if (isPaused.value) return

  const logData: LogData[] = []
  const insertData = (data: LogData) => {
    // Add ID to idList for future filtering
    addToIdList(data.id)

    // Apply ID filtering
    if (idFilterList.value.length && data.id && !idFilterList.value.includes(data.id)) {
      return
    }

    if (isOverwrite.value) {
      data.key = `${data.channel}-${data.device}-${data.id}`
    } else {
      data.key = uid++
    }
    logData.push(data)
  }
  for (const val of vals) {
    if (instanceList.value.length && val.instance && !instanceList.value.includes(val.instance))
      continue
    if (val.message.method == 'canBase') {
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
        name: val.message.data.name,
        children: val.message.data.children
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
        msgType: `LIN ${val.message.data.checksumType}`,
        dlc: val.message.data.data.length,
        name: val.message.data.name,
        children: val.message.data.children
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
        id: testerName,
        len: val.message.data.recvData ? val.message.data.recvData.length : 0,
        device: val.label,
        channel: val.instance,
        msgType: 'UDS Req' + (val.message.data.msg || ''),
        children: (val.message.data as any).children
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
        id: testerName,
        len: val.message.data.recvData ? val.message.data.recvData.length : 0,
        device: val.label,
        channel: val.instance,
        msgType: msgType,
        children: (val.message.data as any).children
      })
    } else if (val.message.method == 'canError') {
      //find last udsSent or udsPreSend

      insertData({
        method: val.message.method,
        name: '',
        data: val.message.data.msg,
        ts: (val.message.data.ts / 1000000).toFixed(3),
        id: 'canError',
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
          id: 'linError',
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
        id: 'linEvent',
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
        id: 'udsScript',
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
        id: 'udsSystem',
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
  return props.height - 30
})
const tableWidth = computed(() => {
  return props.width
})
// DLC 计算辅助函数
function len2dlc(len: number) {
  if (len <= 8) return len
  if (len <= 12) return 9
  if (len <= 16) return 10
  if (len <= 20) return 11
  if (len <= 24) return 12
  if (len <= 32) return 13
  if (len <= 48) return 14
  return 15
}
function saveAll(command: string) {
  isPaused.value = true
  const loadingInstance = ElLoading.service()

  if (command == 'excel') {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Log Data')

    // Define columns
    worksheet.columns = [
      { header: 'Time', key: 'ts', width: 15 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Data', key: 'data', width: 40 },
      { header: 'Dir', key: 'dir', width: 10 },
      { header: 'ID', key: 'id', width: 15 },
      { header: 'DLC', key: 'dlc', width: 10 },
      { header: 'Len', key: 'len', width: 10 },
      { header: 'Type', key: 'msgType', width: 15 },
      { header: 'Channel', key: 'channel', width: 15 },
      { header: 'Device', key: 'device', width: 20 }
    ]

    // Add data
    allLogData.forEach((log) => {
      worksheet.addRow(log)
    })

    // Style the header row
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }

    // Generate and download the file
    workbook.xlsx
      .writeBuffer()
      .then((buffer) => {
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `log_data_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      })
      .finally(() => {
        loadingInstance.close()
      })
  } else if (command == 'asc') {
    //参考https://github.com/hardbyte/python-can/blob/main/can/io/asc.py
    // 生成 ASC 格式的日志内容
    let ascContent = ''

    // 添加文件头
    const now = new Date()
    const dateStr = now.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      year: 'numeric'
    })
    ascContent += `date ${dateStr}\n`
    ascContent += 'base hex  timestamps absolute\n'
    ascContent += 'internal events logged\n'

    // 开始测量块
    ascContent += `Begin Triggerblock ${dateStr}\n`
    ascContent += '0.000000 Start of measurement\n'

    // 添加数据
    let startTime = 0
    if (allLogData.length > 0) {
      startTime = parseFloat(allLogData[0].ts)
    }

    allLogData.forEach((log) => {
      const timestamp = parseFloat(log.ts)
      const relativeTime = timestamp - startTime

      // 格式化通道号
      const channel = log.channel && Number.isInteger(log.channel) ? parseInt(log.channel) + 1 : 1

      // 格式化 ID
      let id = ''
      if (log.id) {
        id = log.id.replace('0x', '').toUpperCase()
        if (log.msgType && log.msgType.includes('EXT')) {
          id += 'x' // 扩展帧标记
        }
      }

      // 格式化数据
      let data = ''
      if (log.data) {
        data = log.data.replace(/\s+/g, ' ').trim()
      }

      // 构建消息行
      let messageLine = ''

      if (log.method === 'canBase') {
        // CAN 消息
        const dlc = log.dlc ? log.dlc.toString(16) : '0'
        const dir = log.dir === 'Tx' ? 'Tx' : 'Rx'

        if (log.msgType && log.msgType.includes('CANFD')) {
          // CANFD 消息
          const brs = log.msgType.includes('BRS') ? '1' : '0'
          const esi = '0' // 假设 ESI 始终为 0
          const dataLength = log.len || 0

          messageLine = `CANFD ${channel}  ${dir} ${id}                                 ${brs} ${esi} ${dlc} ${dataLength} ${data} 0 0 1000 0 0 0 0 0`
        } else {
          // 普通 CAN 消息
          const dtype = log.data ? `d ${dlc}` : `r ${dlc}`
          messageLine = `${channel}  ${id.padEnd(15)} ${dir.padEnd(4)} ${dtype} ${data}`
        }
      } else if (log.method === 'canError') {
        messageLine = `${channel}  ErrorFrame`
      } else if (log.method === 'linBase') {
        // LIN 消息 (按照 CAN 格式处理)
        const dlc = log.dlc ? log.dlc.toString(16) : '0'
        const dir = log.dir === 'Tx' ? 'Tx' : 'Rx'
        messageLine = `${channel}  ${id.padEnd(15)} ${dir.padEnd(4)} d ${dlc} ${data}`
      } else if (
        log.method === 'udsSent' ||
        log.method === 'udsRecv' ||
        log.method === 'udsNegRecv'
      ) {
        // UDS 消息 (按照 CAN 格式处理)
        const dlc = log.len ? len2dlc(log.len).toString(16) : '0'
        const dir = log.method === 'udsSent' ? 'Tx' : 'Rx'
        messageLine = `${channel}  ${id.padEnd(15)} ${dir.padEnd(4)} d ${dlc} ${data}`
      }

      if (messageLine) {
        ascContent += `${relativeTime.toFixed(6)} ${messageLine}\n`
      }
    })

    // 添加文件尾
    ascContent += 'End TriggerBlock\n'

    // 下载文件
    const blob = new Blob([ascContent], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `log_data_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.asc`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    loadingInstance.close()
  }
}
const isPaused = ref(false)
// const autoScroll = ref(true)

function getData() {
  return allLogData
}

defineExpose({
  clearLog,
  insertData: insertData2,
  getData
})

function togglePause() {
  isPaused.value = !isPaused.value
  scrollY = -1
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

let grid: EVirtTable
let scrollY: number = -1

const columes: Ref<Column[]> = ref([
  {
    key: 'ts',
    title: 'Time',
    width: 200,
    formatter: (row) => {
      if (isOverwrite.value && row.row.deltaTime) {
        return `${row.row.ts} ${row.row.deltaTime}`
      }
      return row.row.ts
    }
  },
  { key: 'name', title: 'Name', width: 200 },
  { key: 'data', title: 'Data', width: 300 },
  { key: 'dir', title: 'Dir', width: 50 },
  { key: 'id', title: 'ID', width: 100 },
  { key: 'dlc', title: 'DLC', width: 100 },
  { key: 'len', title: 'Len', width: 100 },
  { key: 'msgType', title: 'Type', width: 100 },
  { key: 'channel', title: 'Channel', width: 100 },
  { key: 'device', title: 'Device', width: 200 }
])
watch(
  columes,
  () => {
    grid.loadColumns(columes.value)
  },
  { deep: true }
)
watch([isPaused, isOverwrite], (v) => {
  if (v[1]) {
    columes.value[0].type = 'tree'
  } else {
    if (v[0]) {
      columes.value[0].type = 'tree'
    } else {
      columes.value[0].type = undefined
      scrollY = -1
    }
  }
})

onMounted(() => {
  for (const item of checkList.value) {
    const v = LogFilter.value.find((v) => v.v == item)
    if (v) {
      for (const val of v.value) {
        window.logBus.on(val, logDisplay)
      }
    }
  }
  const target = document.getElementById(`traceTable-${props.editIndex}`)

  grid = new EVirtTable(target as any, {
    data: [],
    columns: columes.value,
    config: {
      WIDTH: tableWidth.value,
      HEIGHT: tableHeight.value,
      DISABLED: true,
      HEADER_HEIGHT: 28,
      CELL_HEIGHT: 28,
      ROW_KEY: 'key',
      ENABLE_SELECTOR: false,
      ENABLE_HISTORY: false,
      ENABLE_COPY: false,
      ENABLE_PASTER: false,
      ENABLE_KEYBOARD: false,
      ENABLE_RESIZE_ROW: false,
      EMPTY_TEXT: 'No data',
      BODY_CELL_STYLE_METHOD: ({ row }) => {
        const method = row.method
        let color = getComputedStyle(document.documentElement)
          .getPropertyValue('--el-color-info')
          .trim()
        switch (method) {
          case 'canBase':
          case 'linBase':
            color = getComputedStyle(document.documentElement)
              .getPropertyValue('--el-color-primary')
              .trim()
            break
          case 'linEvent':
            color = getComputedStyle(document.documentElement)
              .getPropertyValue('--el-color-success')
              .trim()
            break
          case 'ipBase':
            color = getComputedStyle(document.documentElement)
              .getPropertyValue('--el-color-primary-dark-2')
              .trim()
            break
          case 'udsSent':
          case 'udsRecv':
            color = getComputedStyle(document.documentElement)
              .getPropertyValue('--el-color-info')
              .trim()
            break
          case 'canError':
          case 'linError':
          case 'ipError':
            color = getComputedStyle(document.documentElement)
              .getPropertyValue('--el-color-danger')
              .trim()
            break
          case 'linWarning':
          case 'udsWarning':
          case 'udsNegRecv':
            color = getComputedStyle(document.documentElement)
              .getPropertyValue('--el-color-warning')
              .trim()
            break
          case 'udsSystem':
            color = getComputedStyle(document.documentElement)
              .getPropertyValue('--el-color-primary')
              .trim()
            break
        }
        return {
          color: color
        }
      }
    }
  })

  grid.on('onScrollY', (v) => {
    if (!isPaused.value && scrollY !== -1 && v < scrollY) {
      if (!isOverwrite.value) {
        isPaused.value = true
      }
    } else {
      scrollY = v
    }
  })
})
watch([tableWidth, tableHeight], () => {
  grid.loadConfig({
    WIDTH: tableWidth.value,
    HEIGHT: tableHeight.value
  })
})

onUnmounted(() => {
  LogFilter.value.forEach((v) => {
    for (const val of v.value) {
      window.logBus.detach(val, logDisplay)
    }
  })
  // cTable.close()
  // stage.destroy()
  grid.destroy()
})
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
