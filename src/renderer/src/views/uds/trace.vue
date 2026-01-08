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
        <el-tooltip
          effect="light"
          :content="i18next.t('uds.trace.tooltips.clearTrace')"
          placement="bottom"
        >
          <el-button
            type="danger"
            link
            @click="clearLog(i18next.t('uds.trace.tooltips.clearTrace'))"
          >
            <Icon :icon="circlePlusFilled" />
          </el-button>
        </el-tooltip>

        <el-tooltip
          effect="light"
          :content="
            isPaused
              ? i18next.t('uds.trace.tooltips.resume')
              : i18next.t('uds.trace.tooltips.pause')
          "
          placement="bottom"
        >
          <el-button
            :type="isPaused ? 'success' : 'warning'"
            link
            :class="{ 'pause-active': isPaused }"
            @click="togglePause"
          >
            <Icon :icon="isPaused ? playIcon : pauseIcon" />
          </el-button>
        </el-tooltip>
        <el-tooltip
          effect="light"
          :content="i18next.t('uds.trace.tooltips.switchOverwriteScroll')"
          placement="bottom"
        >
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
            <el-checkbox-group
              v-model="trace.filter"
              size="small"
              style="margin: 10px; width: 100px"
            >
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
        v-model="trace.filterDevice"
        size="small"
        style="width: 200px; margin: 4px; margin-left: 6px"
        multiple
        collapse-tags
        :placeholder="i18next.t('uds.trace.placeholders.filterByDevice')"
        clearable
      >
        <el-option v-for="item of allInstanceList" :key="item" :label="item" :value="item" />
      </el-select>
      <el-select
        v-model="trace.filterId"
        size="small"
        style="width: 300px; margin: 4px"
        multiple
        collapse-tags
        collapse-tags-tooltip
        :placeholder="i18next.t('uds.trace.placeholders.filterById')"
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
            <el-dropdown-item command="excel">{{
              i18next.t('uds.trace.menu.saveAsExcel')
            }}</el-dropdown-item>
            <el-dropdown-item command="asc">{{
              i18next.t('uds.trace.menu.saveAsAsc')
            }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown size="small" @command="othersFeature">
        <el-button type="info" link>
          <Icon :icon="othersIcon" />
        </el-button>

        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="changeName">{{
              i18next.t('uds.trace.menu.changeName')
            }}</el-dropdown-item>
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
  onBeforeMount,
  onUnmounted,
  computed,
  toRef,
  watch,
  watchEffect,
  PropType,
  nextTick,
  handleError,
  Ref,
  inject
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
import othersIcon from '@iconify/icons-material-symbols/more-horiz'
import ExcelJS from 'exceljs'

import { ServiceItem, Sequence, getTxPduStr, getTxPdu } from 'nodeCan/uds'
import { useDataStore } from '@r/stores/data'
import { LinDirection, LinMsg } from 'nodeCan/lin'
import EVirtTable, { Column } from 'e-virt-table'
import { ElLoading, ElMessageBox } from 'element-plus'
import { useGlobalStart, useRuntimeStore } from '@r/stores/runtime'
import {
  SomeipMessageType,
  SomeipMessageTypeMap,
  VsomeipAvailabilityInfo,
  SomeipMessage
} from 'nodeCan/someip'
import { TraceItem } from 'src/preload/data'
import { cloneDeep } from 'lodash'
import { Layout } from './layout'
import { i18next } from '@r/i18n'
let allLogData: LogData[] = []

interface LogData {
  dir?: 'Tx' | 'Rx' | '--'
  data: string
  ts: number
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
  previousTs?: number
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

function othersFeature(command: string) {
  if (command == 'changeName') {
    ElMessageBox.prompt(
      i18next.t('uds.trace.dialogs.enterNewName'),
      i18next.t('uds.trace.dialogs.changeName'),
      {
        confirmButtonText: i18next.t('uds.trace.dialogs.ok'),
        cancelButtonText: i18next.t('uds.trace.dialogs.cancel'),
        buttonSize: 'small',
        appendTo: `#win${props.editIndex}`,
        inputValue: trace.value.name,

        inputValidator: (val: string) => {
          if (val) {
            return true
          } else {
            return i18next.t('uds.trace.validation.nameNotEmpty')
          }
        }
      }
    )
      .then(({ value }) => {
        trace.value.name = value
        layout?.changeWinName(props.editIndex, trace.value.name)
      })
      .catch(() => {
        null
      })
  }
}
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

interface SomeipBaseLog {
  method: 'someipBase'
  data: SomeipMessage
}

interface SomeipServiceValidLog {
  method: 'someipServiceValid'
  data: {
    info: VsomeipAvailabilityInfo
    ts: number
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

interface OsEventLog {
  method: 'osEvent'
  data: {
    data: string
    name: string
    id: string
    ts: number
  }
}

interface OsErrorLog {
  method: 'osError'
  error: string | { data: string; name: string; id: string; ts: number }
  ts: number
}

interface LogItem {
  message:
    | CanBaseLog
    | UdsLog
    | UdsErrorLog
    | IpBaseLog
    | LinBaseLog
    | LinErrorLog
    | SomeipBaseLog
    | SomeipServiceValidLog
    | OsEventLog
    | OsErrorLog
  level: string
  instance: string
  label: string
}
const globalStart = useGlobalStart()
watch(globalStart, (val) => {
  if (val) {
    clearLog(i18next.t('uds.trace.messages.startTrace'))
    isPaused.value = false
    logData = []
  }
})

function clearLog(msg = i18next.t('uds.trace.tooltips.clearTrace')) {
  allLogData = []
  idList.value.clear()

  scrollY = -1

  grid.clearSelection()
  grid.loadData([])
  grid.setExpandRowKeys([])
  grid.scrollYTo(0)
}
const maxDataLen = 1024
function data2str(data: Uint8Array) {
  if (data.length > maxDataLen) {
    return (
      data
        .slice(0, maxDataLen)
        .reduce((acc, val) => acc + val.toString(16).padStart(2, '0') + ' ', '') + '...'
    )
  } else {
    return data.reduce((acc, val) => acc + val.toString(16).padStart(2, '0') + ' ', '')
  }
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
const showLogCount = 1000

const runtimeStore = useRuntimeStore()
watch(
  () => runtimeStore.traceLinkId,
  (val) => {
    if (val) {
      isPaused.value = true

      nextTick(() => {
        //Os_Trace_high-Os_Trace_high-Service.114_0-5302048
        // 使用 getCellValue 检查是否成功找到行，如果没找到，尝试对最后的数字部分做 +1 和 -1 处理浮点数累计误差
        let targetKey = val
        const cellValue = grid.getCellValue(val, 'key')
        if (cellValue !== val) {
          // 解析 traceLinkId 格式：Os_Trace_high-Os_Trace_high-Service.114_0-5302048
          const parts = val.split('-')
          if (parts.length > 0) {
            const lastPart = parts[parts.length - 1]
            const number = parseInt(lastPart, 10)

            if (!isNaN(number)) {
              // 尝试 +1
              const tryKey1 = parts.slice(0, -1).join('-') + '-' + (number + 1).toString()
              const cellValue1 = grid.getCellValue(tryKey1, 'key')
              if (cellValue1 === tryKey1) {
                targetKey = tryKey1
              } else {
                // 尝试 -1
                const tryKey2 = parts.slice(0, -1).join('-') + '-' + (number - 1).toString()
                const cellValue2 = grid.getCellValue(tryKey2, 'key')
                if (cellValue2 === tryKey2) {
                  targetKey = tryKey2
                }
              }
            }
          }
        }

        // 找到正确的 key 后再执行滚动和设置当前行
        if (targetKey) {
          grid.scrollToRowkey(targetKey)
          grid.setCurrentRow(targetKey)
        }
      })
    }
  }
)

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
          const currentTime = item.ts
          const previousTime = existingLog.ts
          const deltaMs = (currentTime - previousTime) / 1000 // Convert to milliseconds

          // Store previous timestamp and delta time
          item.previousTs = existingLog.ts
          item.deltaTime = deltaMs >= 0 ? `(Δ${deltaMs.toFixed(3)}ms)` : ''

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

  if (globalStart.value) {
    if (allLogData.length > maxLogCount) {
      const excessRows = allLogData.length - maxLogCount
      allLogData.splice(0, excessRows)
    }
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

let logData: LogData[] = []
let timer: any = null
function logDisplay({ values }: { values: LogItem[] }) {
  const vals = values
  // Don't process logs when paused
  if (isPaused.value) return

  const insertData = (data: LogData) => {
    // Add ID to idList for future filtering
    addToIdList(data.id)

    // Apply ID filtering
    if (trace.value.filterId!.length && data.id && !trace.value.filterId!.includes(data.id)) {
      return
    }

    if (isOverwrite.value) {
      data.key = `${data.channel}-${data.device}-${data.id}`
    } else {
      data.key = `${data.channel}-${data.device}-${data.id}-${data.ts.toFixed(0)}`
    }

    logData.push(data)
  }
  for (const val of vals) {
    if (
      trace.value.filterDevice!.length &&
      val.instance &&
      !trace.value.filterDevice!.includes(val.instance)
    )
      continue
    if (val.message.method == 'canBase') {
      insertData({
        method: val.message.method,
        dir: val.message.data.dir == 'OUT' ? 'Tx' : 'Rx',
        data: data2str(val.message.data.data),
        ts: val.message.data.ts!,
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
        ts: val.message.data.ts,
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
        ts: val.message.data.ts!,
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
        dir: 'Tx',
        name: testerName,
        data: `${data2str(val.message.data.recvData ? val.message.data.recvData : new Uint8Array(0))}`.trim(),
        ts: val.message.data.ts!,
        id: testerName,
        len: val.message.data.recvData ? val.message.data.recvData.length : 0,
        device: val.label,
        channel: val.instance,
        msgType: i18next.t('uds.trace.messageTypes.udsReq') + (val.message.data.msg || ''),
        children: (val.message.data as any).children
      })
    } else if (val.message.method == 'udsRecv') {
      let testerName = val.message.data.service.name
      if (val.message.id) {
        testerName = `${database.tester[val.message.id]?.name}.${val.message.data.service.name}`
      }
      const data = val.message.data.recvData ? val.message.data.recvData : new Uint8Array(0)
      let method: string = val.message.method
      let msgType = i18next.t('uds.trace.messageTypes.udsResp') + (val.message.data.msg || '')

      if (data[0] == 0x7f) {
        method = 'udsNegRecv'
        msgType = i18next.t('uds.trace.messageTypes.udsNegativeResp') + (val.message.data.msg || '')
      }
      insertData({
        method: method,
        dir: 'Rx',
        name: testerName,
        data: `${data2str(val.message.data.recvData ? val.message.data.recvData : new Uint8Array(0))}`.trim(),
        ts: val.message.data.ts!,
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
        ts: val.message.data.ts!,
        id: 'canError',
        len: 0,
        device: val.label,
        channel: val.instance,
        msgType: i18next.t('uds.trace.messageTypes.canError')
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
          ts: val.message.data.ts!,
          id: '0x' + val.message.data.data.frameId?.toString(16),
          len: val.message.data.data.data.length,
          dlc: val.message.data.data.data.length,
          dir: val.message.data.data.direction == LinDirection.SEND ? 'Tx' : 'Rx',
          device: val.label,
          channel: val.instance,
          msgType: i18next.t('uds.trace.messageTypes.linError')
        })
      } else {
        insertData({
          method: val.message.method,
          name: '',
          data: val.message.data.msg,
          ts: val.message.data.ts!,
          id: 'linError',
          len: 0,
          device: val.label,
          channel: val.instance,
          msgType: i18next.t('uds.trace.messageTypes.linError')
        })
      }
    } else if (val.message.method == 'linEvent') {
      insertData({
        method: val.message.method,
        name: '',
        data: val.message.data.msg,
        ts: val.message.data.ts!,
        id: 'linEvent',
        len: 0,
        device: val.label,
        channel: val.instance,
        msgType: i18next.t('uds.trace.messageTypes.linEvent')
      })
    } else if (val.message.method == 'udsScript') {
      insertData({
        method: val.message.method,
        name: '',
        data: val.message.data.msg,
        ts: val.message.data.ts!,
        id: 'udsScript',
        len: 0,
        device: val.label,
        channel: val.instance,
        msgType: i18next.t('uds.trace.messageTypes.scriptMessage')
      })
    } else if (val.message.method == 'udsSystem') {
      insertData({
        method: val.message.method,
        name: '',
        data: val.message.data.msg,
        ts: val.message.data.ts!,
        id: 'udsSystem',
        len: 0,
        device: val.label,
        channel: val.instance,
        msgType: i18next.t('uds.trace.messageTypes.systemMessage')
      })
    } else if (val.message.method == 'someipBase') {
      const childrenList: { name: string; data: string }[] = [
        {
          name: i18next.t('uds.trace.messageTypes.version'),
          data: `${i18next.t('uds.trace.messageTypes.protocolVersion')}:${val.message.data.protocolVersion}, ${i18next.t('uds.trace.messageTypes.interfaceVersion')}:${val.message.data.interfaceVersion}`
        },
        {
          name: i18next.t('uds.trace.messageTypes.returnCode'),
          data: '0x' + val.message.data.returnCode.toString(16).padStart(2, '0')
        }
      ]
      if (val.message.data.ip) {
        childrenList.push({
          name: i18next.t('uds.trace.messageTypes.address'),
          data: `${val.message.data.ip}:${val.message.data.port}`
        })
      }
      if (val.message.data.protocol) {
        childrenList.push({
          name: i18next.t('uds.trace.messageTypes.protocol'),
          data: val.message.data.protocol
        })
      }

      insertData({
        method: val.message.method,
        name: `Client:0x${val.message.data.client.toString(16).padStart(4, '0')} Session:0x${val.message.data.session.toString(16).padStart(4, '0')}`,
        data: data2str(val.message.data.payload),
        ts: val.message.data.ts!,
        id: `SID:0x${val.message.data.service.toString(16).padStart(4, '0')} IID:0x${val.message.data.instance.toString(16).padStart(4, '0')} MID:0x${val.message.data.method.toString(16).padStart(4, '0')}`,
        len: val.message.data.payload.length,
        dlc: val.message.data.payload.length,
        dir: val.message.data.sending ? 'Tx' : 'Rx',
        device: val.label,
        channel: val.instance,
        msgType: SomeipMessageTypeMap[val.message.data.messageType],
        children: childrenList
      })
    } else if (val.message.method == 'someipServiceValid') {
      insertData({
        method: val.message.method,
        data: `${i18next.t('uds.trace.messageTypes.service')}:0x${val.message.data.info.service.toString(16).padStart(4, '0')} ${i18next.t('uds.trace.messageTypes.instance')}:0x${val.message.data.info.instance.toString(16).padStart(4, '0')} ${i18next.t('uds.trace.messageTypes.available')}:${val.message.data.info.available}`,
        ts: val.message.data.ts!,
        id: '',
        len: 0,
        device: val.label,
        channel: val.instance,
        msgType: i18next.t('uds.trace.messageTypes.someipServiceValid')
      })
    } else if (val.message.method == 'osEvent') {
      insertData({
        method: val.message.method,

        data: val.message.data.data,
        ts: val.message.data.ts!,
        name: val.message.data.name,
        id: val.message.data.id,
        len: 0,
        device: val.label,
        channel: val.instance,
        msgType: i18next.t('uds.trace.messageTypes.osEvent')
      })
    } else if (val.message.method == 'osError') {
      if (typeof val.message.error == 'string') {
        insertData({
          method: val.message.method,
          name: '',
          data: val.message.error,
          ts: val.message.ts!,
          id: 'osError',
          len: 0,
          device: val.label,
          channel: val.instance,
          msgType: i18next.t('uds.trace.messageTypes.osError')
        })
      } else {
        insertData({
          method: val.message.method,
          name: '',
          data: val.message.error.data,
          ts: val.message.ts!,
          id: val.message.error.id,
          len: 0,
          device: val.label,
          channel: val.instance,
          msgType: i18next.t('uds.trace.messageTypes.osError')
        })
      }
    }
  }
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
    default: () => ['canBase', 'ipBase', 'linBase', 'uds', 'someipBase', 'osTrace']
  }
})

function filterChange(
  method: 'uds' | 'canBase' | 'ipBase' | 'linBase' | 'someipBase' | 'osTrace',
  val: boolean
) {
  const i = LogFilter.value.find((v) => v.v == method)
  if (i) {
    i.value.forEach((v) => {
      window.logBus.off(v, logDisplay)
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
      { header: i18next.t('uds.trace.columns.time'), key: 'ts', width: 15 },
      { header: i18next.t('uds.trace.columns.name'), key: 'name', width: 20 },
      { header: i18next.t('uds.trace.columns.data'), key: 'data', width: 40 },
      { header: i18next.t('uds.trace.columns.dir'), key: 'dir', width: 10 },
      { header: i18next.t('uds.trace.columns.id'), key: 'id', width: 15 },
      { header: i18next.t('uds.trace.columns.dlc'), key: 'dlc', width: 10 },
      { header: i18next.t('uds.trace.columns.len'), key: 'len', width: 10 },
      { header: i18next.t('uds.trace.columns.type'), key: 'msgType', width: 15 },
      { header: i18next.t('uds.trace.columns.channel'), key: 'channel', width: 15 },
      { header: i18next.t('uds.trace.columns.device'), key: 'device', width: 20 }
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
      startTime = allLogData[0].ts
    }

    allLogData.forEach((log) => {
      const timestamp = log.ts
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
  getData
})

function togglePause() {
  isPaused.value = !isPaused.value
  scrollY = -1
}

const LogFilter = ref<
  {
    label: string
    v: 'uds' | 'canBase' | 'ipBase' | 'linBase' | 'someipBase' | 'osTrace'
    value: string[]
  }[]
>([
  {
    label: i18next.t('uds.trace.filters.can'),
    v: 'canBase',
    value: ['canBase', 'canError']
  },
  {
    label: i18next.t('uds.trace.filters.lin'),
    v: 'linBase',
    value: ['linBase', 'linError', 'linWarning', 'linEvent']
  },
  {
    label: i18next.t('uds.trace.filters.uds'),
    v: 'uds',
    value: ['udsSent', 'udsRecv']
  },
  {
    label: i18next.t('uds.trace.filters.eth'),
    v: 'ipBase',
    value: ['ipBase', 'ipError']
  },
  {
    label: i18next.t('uds.trace.filters.someip'),
    v: 'someipBase',
    value: ['someipBase', 'someipError', 'someipServiceValid']
  },
  {
    label: i18next.t('uds.trace.filters.osTrace'),
    v: 'osTrace',
    value: ['osEvent', 'osError']
  }
])

let grid: EVirtTable
let scrollY: number = -1

const columes: Ref<Column[]> = ref([
  {
    key: 'ts',
    title: i18next.t('uds.trace.columns.time'),
    width: 200,
    formatter: (row) => {
      if (row.row.ts) {
        if (isOverwrite.value && row.row.deltaTime) {
          return `${(row.row.ts / 1000000).toFixed(6)} ${row.row.deltaTime}`
        }
        return (row.row.ts / 1000000).toFixed(6)
      } else {
        return ''
      }
    }
  },
  { key: 'name', title: i18next.t('uds.trace.columns.name'), width: 200 },
  { key: 'data', title: i18next.t('uds.trace.columns.data'), width: 300 },
  { key: 'dir', title: i18next.t('uds.trace.columns.dir'), width: 50 },
  { key: 'id', title: i18next.t('uds.trace.columns.id'), width: 100 },
  { key: 'dlc', title: i18next.t('uds.trace.columns.dlc'), width: 100 },
  { key: 'len', title: i18next.t('uds.trace.columns.len'), width: 100 },
  { key: 'msgType', title: i18next.t('uds.trace.columns.type'), width: 100 },
  { key: 'channel', title: i18next.t('uds.trace.columns.channel'), width: 100 },
  { key: 'device', title: i18next.t('uds.trace.columns.device'), width: 200 }
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
  if (v[0]) {
    //load data
    grid.loadData(allLogData)
    grid.scrollYTo(99999999999)
  }
})

const trace = ref<TraceItem>(
  cloneDeep(
    database.traces[props.editIndex] || {
      id: props.editIndex,
      name: i18next.t('uds.trace.defaultName'),
      filter: props.defaultCheckList,
      filterDevice: [],
      filterId: []
    }
  )
)

const layout = inject('layout') as Layout | undefined

watch(
  trace,
  (newVal) => {
    database.traces[props.editIndex] = newVal
    layout?.changeWinName(props.editIndex, newVal.name)
  },
  {
    deep: true
  }
)

onBeforeMount(() => {
  if (trace.value.filter == undefined) {
    trace.value.filter = props.defaultCheckList
  }

  if (trace.value.filterDevice == undefined) {
    trace.value.filterDevice = []
  }

  if (trace.value.filterId == undefined) {
    trace.value.filterId = []
  }
  layout?.changeWinName(props.editIndex, trace.value.name)
})
onMounted(() => {
  timer = setInterval(() => {
    if (logData.length) {
      insertData2(logData)
      logData = []
    }
  }, 100)

  for (const item of trace.value.filter!) {
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
      HIGHLIGHT_SELECTED_ROW: true,
      WIDTH: tableWidth.value,
      HEIGHT: tableHeight.value,
      DISABLED: true,
      CELL_PADDING: 4,
      HEADER_HEIGHT: 28,
      CELL_HEIGHT: 28,
      ROW_KEY: 'key',
      ENABLE_SELECTOR: false,
      ENABLE_HISTORY: false,
      ENABLE_COPY: false,
      ENABLE_PASTER: false,
      ENABLE_KEYBOARD: false,
      ENABLE_RESIZE_ROW: false,
      EMPTY_TEXT: i18next.t('uds.trace.emptyText'),
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

          case 'udsSent':
          case 'udsRecv':
            color = getComputedStyle(document.documentElement)
              .getPropertyValue('--el-color-info')
              .trim()
            break
          case 'canError':
          case 'linError':
          case 'ipError':
          case 'someipError':
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
          case 'ipBase':
          case 'someipBase':
            color = 'purple'
            break
          case 'osEvent':
            color = 'rgb(108, 22, 133)'
            break
          case 'osError':
            color = getComputedStyle(document.documentElement)
              .getPropertyValue('--el-color-danger')
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
  grid.on('click', (v) => {
    // runtimeStore.setTraceLinkId('')
    const row = grid.getCurrentRow()
    if (row && row.rowKey == runtimeStore.traceLinkId) {
      runtimeStore.setTraceLinkId('')
    } else {
      runtimeStore.setTraceLinkIdBack(row?.rowKey || '')
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
      window.logBus.off(val, logDisplay)
    }
  })
  // cTable.close()
  // stage.destroy()
  grid.destroy()
  clearInterval(timer)
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

.osEvent {
  color: rgb(108, 22, 133);
}

.osError {
  color: var(--el-color-danger);
}

.pause-active {
  box-shadow: inset 0 0 4px var(--el-color-info-light-5);
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
}
</style>
