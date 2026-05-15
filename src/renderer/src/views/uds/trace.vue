<template>
  <div
    style="position: relative"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div
      v-if="isDragOver"
      style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(64, 158, 255, 0.15);
        border: 2px dashed var(--el-color-primary);
        border-radius: 4px;
        pointer-events: none;
      "
    >
      <span style="font-size: 16px; color: var(--el-color-primary); font-weight: bold">
        {{ i18next.t('uds.trace.messages.dropFileHint') }}
      </span>
    </div>
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
      <el-popover trigger="click" :width="320" placement="bottom-start" :teleported="false">
        <template #reference>
          <el-button type="info" link style="margin-left: 4px" title="Column Configuration">
            <Icon :icon="columnIcon" />
          </el-button>
        </template>
        <div style="max-height: 300px; overflow-y: auto">
          <div
            v-for="(col, idx) in columnConfig"
            :key="col.key"
            :draggable="true"
            style="
              display: flex;
              align-items: center;
              gap: 6px;
              padding: 4px 6px;
              cursor: grab;
              border-radius: 4px;
            "
            :style="{
              background: colDragOverIdx === idx ? 'var(--el-color-primary-light-8)' : 'transparent'
            }"
            @dragstart="onColDragStart(idx)"
            @dragover.prevent="onColDragOver(idx)"
            @dragleave="colDragOverIdx = -1"
            @drop.prevent="onColDrop(idx)"
            @dragend="colDragOverIdx = -1"
          >
            <el-checkbox
              v-model="col.visible"
              :disabled="col.key === 'seqIndex'"
              size="small"
              @change="applyColumnConfig"
            />
            <span style="font-size: 12px; flex: 1; user-select: none">{{ col.title }}</span>
            <el-input-number
              v-model="col.width"
              :min="40"
              :max="600"
              :step="10"
              size="small"
              style="width: 80px"
              controls-position="right"
              @change="applyColumnConfig"
            />
            <span style="color: var(--el-text-color-placeholder); font-size: 10px">⠿</span>
          </div>
        </div>
        <el-button size="small" style="margin-top: 8px; width: 100%" @click="resetColumnConfig">
          {{ i18next.t('uds.trace.resetColumns') }}
        </el-button>
      </el-popover>
      <template v-if="traceFileActive">
        <el-divider direction="vertical" />
        <span style="font-size: 12px; color: var(--el-text-color-secondary); white-space: nowrap">
          {{ traceFileTotalFrames }} frames
        </span>
        <el-select
          v-model="traceFilePageSize"
          size="small"
          style="width: 100px"
          @change="onPageSizeChange"
        >
          <el-option :value="10000" label="10000/page" />
          <el-option :value="20000" label="20000/page" />
          <el-option :value="50000" label="50000/page" />
          <el-option :value="100000" label="100000/page" />
          <el-option :value="200000" label="200000/page" />
          <el-option :value="500000" label="500000/page" />
          <el-option :value="1000000" label="1000000/page" />
        </el-select>
        <el-tooltip effect="light" content="First Page" placement="bottom">
          <el-button
            size="small"
            :icon="DArrowLeft"
            link
            :disabled="traceFileCurrentPage <= 0 || traceFileLoading"
            @click="traceFileGoFirst"
          />
        </el-tooltip>
        <el-tooltip effect="light" content="Previous Page" placement="bottom">
          <el-button
            size="small"
            :icon="ArrowLeft"
            link
            :disabled="traceFileCurrentPage <= 0 || traceFileLoading"
            @click="traceFileGoPrev"
          />
        </el-tooltip>
        <span style="font-size: 12px; color: var(--el-text-color-regular); white-space: nowrap">
          {{ traceFileCurrentPage + 1 }} / {{ traceFileTotalPages }}
        </span>
        <el-tooltip effect="light" content="Next Page" placement="bottom">
          <el-button
            size="small"
            :icon="ArrowRight"
            link
            :disabled="traceFileCurrentPage >= traceFileTotalPages - 1 || traceFileLoading"
            @click="traceFileGoNext"
          />
        </el-tooltip>
        <el-tooltip effect="light" content="Last Page" placement="bottom">
          <el-button
            size="small"
            :icon="DArrowRight"
            link
            :disabled="traceFileCurrentPage >= traceFileTotalPages - 1 || traceFileLoading"
            @click="traceFileGoLast"
          />
        </el-tooltip>
        <el-input-number
          v-model="traceFileJumpPage"
          size="small"
          :min="1"
          :max="traceFileTotalPages"
          controls-position="right"
          style="width: 80px"
          @keyup.enter="traceFileGoJump"
        />
        <el-tooltip effect="light" content="Jump to Page" placement="bottom">
          <el-button
            size="small"
            :icon="ArrowRight"
            :loading="traceFileLoading"
            :type="traceFileLoading ? 'primary' : ''"
            @click="traceFileGoJump"
          />
        </el-tooltip>
      </template>
    </div>
    <div :id="`traceTable-${props.editIndex}`" class="realLog"></div>
    <!-- Detail panel (Wireshark-style) -->
    <div
      v-if="detailPanelHeight > 0"
      class="detail-resize-handle"
      @mousedown="onDetailResizeStart"
    ></div>
    <div
      v-if="detailPanelHeight > 0 && detailInfo"
      class="detail-panel"
      :style="{ height: detailPanelHeight + 'px' }"
    >
      <div class="detail-panel-header">
        <span style="font-weight: bold; font-size: 12px">
          {{ detailInfo.msgName || detailInfo.frameFields.find((f) => f.label === 'ID')?.value }}
        </span>
        <el-button link size="small" style="margin-left: auto" @click="closeDetailPanel">
          ✕
        </el-button>
      </div>
      <div class="detail-panel-body">
        <div class="detail-hex" :style="{ width: detailHexWidth + 'px' }">
          <details open class="detail-collapsible">
            <summary class="detail-hex-title">Frame</summary>
            <div class="detail-fields">
              <div v-for="f in detailInfo.frameFields" :key="f.label" class="detail-field-row">
                <span class="detail-label">{{ f.label }}:</span>
                <span class="detail-value">{{ f.value }}</span>
              </div>
            </div>
          </details>
          <details open class="detail-collapsible">
            <summary class="detail-hex-title" style="margin-top: 6px">Data</summary>
            <pre class="hex-dump">{{ formatHexDump(detailInfo.dataBytes) }}</pre>
          </details>
        </div>
        <div class="detail-col-resize" @mousedown="onColResizeStart"></div>
        <div class="detail-tree">
          <template v-if="detailInfo.msgName && detailInfo.signals.length > 0">
            <table class="detail-signal-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Physical</th>
                  <th>Raw</th>
                  <th>Bit</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sig in detailInfo.signals" :key="sig.name" :title="sig.comment">
                  <td class="detail-sig-name">{{ sig.name }}</td>
                  <td class="detail-sig-phys">
                    {{ sig.enumLabel || sig.physValue }}
                    <span v-if="sig.unit" class="detail-sig-unit">{{ sig.unit }}</span>
                  </td>
                  <td class="detail-sig-raw">{{ sig.rawHex }}</td>
                  <td class="detail-sig-bits">{{ sig.bitPos }}</td>
                </tr>
              </tbody>
            </table>
          </template>
          <div v-else class="detail-no-signals">
            {{ detailInfo.msgName ? 'No signals' : 'No DBC mapping for this channel' }}
          </div>
        </div>
      </div>
    </div>
    <el-dialog
      v-model="channelMapDialogVisible"
      title="Channel → Device Mapping"
      width="480"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      append-to-body
    >
      <el-table :data="channelMapTemp" size="small" style="width: 100%">
        <el-table-column label="Log Channel" width="120" align="center">
          <template #default="{ row }"> CH{{ row.logChannel }} </template>
        </el-table-column>
        <el-table-column label="→" width="50" align="center">
          <template #default>→</template>
        </el-table-column>
        <el-table-column label="Project Device">
          <template #default="{ row }">
            <el-select
              v-model="row.deviceId"
              placeholder="Not mapped"
              size="small"
              clearable
              style="width: 100%"
            >
              <el-option
                v-for="dev in canDeviceOptions"
                :key="dev.key"
                :label="dev.label"
                :value="dev.key"
              />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="cancelChannelMap">Cancel</el-button>
        <el-button type="primary" @click="confirmChannelMap">OK</el-button>
      </template>
    </el-dialog>
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

import {
  CAN_ID_TYPE,
  CanMessage,
  CanMsgType,
  Signal as CanSignal,
  Message as CanDbMessage,
  getDlcByLen
} from 'nodeCan/can'
import { writeMessageData } from '@r/database/dbc/calc'
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
import columnIcon from '@iconify/icons-material-symbols/view-column-outline'
import ExcelJS from 'exceljs'

import { ServiceItem, Sequence, getTxPduStr, getTxPdu } from 'nodeCan/uds'
import { useDataStore } from '@r/stores/data'
import { LinDirection, LinMsg, LinSignal } from 'nodeCan/lin'
import EVirtTable, { Column } from 'e-virt-table'
import { ElLoading, ElMessageBox, ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import { useGlobalStart, useRuntimeStore } from '@r/stores/runtime'
import {
  SomeipMessageType,
  SomeipMessageTypeMap,
  VsomeipAvailabilityInfo,
  SomeipMessage
} from 'nodeCan/someip'
import { TraceItem, TraceColumnConfig, TraceChannelMap } from 'src/preload/data'
import { cloneDeep } from 'lodash'
import { Layout } from './layout'
import i18next from 'i18next'

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
  deltaTs?: number
  absTimeStr?: string
  children?: LogData[] | { key?: string; name: string; data: string; children?: any[] }[]
  deltaTime?: string
  previousTs?: number
  count?: number
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
  data: CanMessage<Record<string, CanSignal>>
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
  data: LinMsg<Record<string, LinSignal>>
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
    liveStartMs = Date.now()
  } else {
    isPaused.value = true
  }
})

function clearLog(msg = i18next.t('uds.trace.tooltips.clearTrace')) {
  allLogData = []
  idList.value.clear()
  liveSeqCounter = 0
  liveStartMs = 0

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

          // Store previous timestamp, delta time and increment count
          item.previousTs = existingLog.ts
          item.deltaTs = currentTime - previousTime
          item.deltaTime = deltaMs >= 0 ? `(Δ${deltaMs.toFixed(3)}ms)` : ''
          item.count = (existingLog.count || 1) + 1

          allLogData[idx] = item
        } else {
          item.count = 1
          allLogData.push(item)
        }
      } else {
        item.count = 1
        allLogData.push(item)
      }
    }
  } else {
    // Non-overwrite: compute deltaTs from previous item
    for (const item of data) {
      if (allLogData.length > 0) {
        const prevItem = allLogData[allLogData.length - 1]
        item.deltaTs = item.ts - prevItem.ts
      }
      allLogData.push(item)
    }
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
let liveSeqCounter = 0
let liveStartMs = 0

function withUniqueChildKeys(
  children: { key?: string; name: string; data: string; children?: any[] }[] | undefined,
  seed: string
) {
  if (!Array.isArray(children) || children.length === 0) return undefined
  return children.map((child, idx) => {
    const childKey = `${seed}/c${idx}-${child.name}`
    return {
      ...child,
      key: childKey,
      children: withUniqueChildKeys(child.children as any, childKey)
    }
  })
}

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

    liveSeqCounter++
    data.seqIndex = liveSeqCounter
    // UTC time: use pre-computed absTimeStr (from replay original time) or compute from start wall clock
    if (!data.absTimeStr && liveStartMs > 0) {
      const d = new Date(liveStartMs + data.ts / 1000)
      const y = d.getUTCFullYear()
      const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      const h = String(d.getUTCHours()).padStart(2, '0')
      const mi = String(d.getUTCMinutes()).padStart(2, '0')
      const s = String(d.getUTCSeconds()).padStart(2, '0')
      const ms = String(d.getUTCMilliseconds()).padStart(3, '0')
      data.absTimeStr = `${y}-${mo}-${day} ${h}:${mi}:${s}.${ms}`
    }

    if (isOverwrite.value) {
      data.key = `${data.channel}-${data.device}-${data.id}-${data.dir || ''}`
      data.children = withUniqueChildKeys(data.children as any, String(data.key)) as any
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
      const canData = val.message.data
      insertData({
        method: val.message.method,
        dir: canData.dir == 'OUT' ? 'Tx' : 'Rx',
        data: data2str(canData.data),
        ts: canData.originalTs ?? canData.ts!,
        id: '0x' + canData.id.toString(16),
        dlc: getDlcByLen(canData.data.length, canData.msgType.canfd),
        len: canData.data.length,
        device: val.label,
        channel: val.instance,
        msgType: CanMsgType2Str(canData.msgType),
        name: canData.name,
        absTimeStr: canData.absTimeStr,
        children: Object.entries(canData.signals || {}).map(([name, signal]) => {
          return {
            name: name,
            data: `PHY:${signal.physValue} RAW:${signal.value}`
          }
        })
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
        children: Object.entries(val.message.data.signals || {}).map(
          ([name, signal]: [string, LinSignal]) => {
            return {
              name: name,
              data: `PHY:${signal.physValueEnum ? signal.physValueEnum : signal.physValue} RAW:${signal.value}`
            }
          }
        )
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
      const someipData = val.message.data as SomeipMessage & {
        children?: { name: string; data: string; children?: any[] }[]
        summary?: string
        sd?: boolean
        header?: Uint8Array
        data?: Uint8Array
      }
      const n16 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
      const rawPayload =
        someipData.payload && someipData.payload instanceof Uint8Array
          ? someipData.payload
          : someipData.data && someipData.data instanceof Uint8Array
            ? someipData.data
            : new Uint8Array()
      insertData({
        method: val.message.method,
        name:
          someipData.summary ||
          `Client:0x${n16(someipData.client).toString(16).padStart(4, '0')} Session:0x${n16(someipData.session).toString(16).padStart(4, '0')}`,
        data: data2str(rawPayload),
        ts: someipData.ts!,
        id: `SID:0x${n16(someipData.service).toString(16).padStart(4, '0')} IID:0x${n16(someipData.instance).toString(16).padStart(4, '0')} MID:0x${n16(someipData.method).toString(16).padStart(4, '0')}`,
        len: rawPayload.length,
        dlc: rawPayload.length,
        dir: someipData.sending ? 'Tx' : 'Rx',
        device: val.label,
        channel: val.instance,
        msgType: someipData.sd
          ? `${SomeipMessageTypeMap[someipData.messageType] || 'Unknown'} (SD)`
          : SomeipMessageTypeMap[someipData.messageType] || 'Unknown',
        children: someipData.children || []
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

const detailPanelHeight = ref(0)
const detailHexWidth = ref(320)
const detailPanelMinHeight = 120
const detailPanelDefaultHeight = 200

const tableHeight = computed(() => {
  return props.height - 30 - detailPanelHeight.value - (detailPanelHeight.value > 0 ? 8 : 0)
})
const tableWidth = computed(() => {
  return props.width
})

// Detail panel: selected row and decoded signals
const selectedRowData = ref<LogData | null>(null)

interface DecodedSignal {
  name: string
  value: string
  physValue: string
  unit: string
  rawHex: string
  bitPos: string
  comment: string
  enumLabel: string
}
interface DetailInfo {
  frameFields: { label: string; value: string }[]
  msgName: string
  msgComment: string
  signals: DecodedSignal[]
  dataBytes: number[]
}
const detailInfo = ref<DetailInfo | null>(null)

function str2data(hex: string): number[] {
  return hex
    .trim()
    .split(/\s+/)
    .map((b) => parseInt(b, 16))
}

function decodeSelectedRow(row: LogData) {
  selectedRowData.value = row
  const dataBytes = str2data(row.data)
  const fields: { label: string; value: string }[] = [
    { label: '#', value: String(row.seqIndex ?? '') },
    { label: 'Time(s)', value: (row.ts / 1000000).toFixed(6) },
    { label: 'Direction', value: row.dir ?? '--' },
    { label: 'Channel', value: row.channel },
    { label: 'Device', value: row.device },
    { label: 'ID', value: row.id },
    { label: 'DLC', value: String(row.dlc ?? '') },
    { label: 'Length', value: String(row.len ?? dataBytes.length) },
    { label: 'Type', value: row.msgType }
  ]
  if (row.absTimeStr) {
    fields.push({ label: 'UTC Time', value: row.absTimeStr })
  }
  if (row.deltaTs !== undefined) {
    fields.push({ label: 'Δt(s)', value: (row.deltaTs / 1000000).toFixed(6) })
  } else if (row.previousTs !== undefined) {
    const delta = (row.ts - row.previousTs) / 1000000
    fields.push({ label: 'Δt(s)', value: delta.toFixed(6) })
  }

  let msgName = row.name || ''
  let msgComment = ''
  const signals: DecodedSignal[] = []

  // Try DBC decoding if channel map available
  if (row.method === 'canBase' && channelDbcMapCache) {
    const chNum = parseInt(row.channel.replace('CH', ''), 10)
    const chDbc = channelDbcMapCache.get(chNum)
    if (chDbc && chDbc.db) {
      const frameId = parseInt(row.id, 16)
      const isExtended = row.msgType?.includes('X') ?? false
      const dbMsg = chDbc.db.messages.find(
        (m: CanDbMessage) => m.id === frameId && m.is_extended_frame === isExtended
      )
      if (dbMsg) {
        msgName = dbMsg.name
        msgComment = dbMsg.comment || ''
        const msgClone = cloneDeep(dbMsg) as CanDbMessage
        const buf = Buffer.from(dataBytes)
        writeMessageData(msgClone, buf, chDbc.db)
        for (const sig of msgClone.signals) {
          const enumLabel =
            sig.values && sig.value !== undefined ? sig.values[String(sig.value)] || '' : ''
          signals.push({
            name: sig.name,
            value: sig.value ?? '',
            physValue: sig.physValue ?? '',
            unit: sig.unit || '',
            rawHex:
              sig.value !== undefined ? '0x' + Number(sig.value).toString(16).toUpperCase() : '',
            bitPos: `[${sig.start_bit}|${sig.bit_length}] ${sig.is_big_endian ? 'BE' : 'LE'}`,
            comment: sig.comment || '',
            enumLabel
          })
        }
      }
    }
  }

  // Fallback: use live signal data from children if DBC decoding didn't produce signals
  if (signals.length === 0 && row.children && row.children.length > 0) {
    for (const child of row.children) {
      const match = child.data?.match(/PHY:(.*?)\s+RAW:(.*)/)
      const rawVal = match ? match[2].trim() : ''
      signals.push({
        name: child.name || '',
        value: rawVal,
        physValue: match ? match[1] : child.data || '',
        unit: '',
        rawHex: rawVal,
        bitPos: '',
        comment: '',
        enumLabel: ''
      })
    }
    if (!msgName) msgName = row.name || ''
  }

  detailInfo.value = {
    frameFields: fields,
    msgName,
    msgComment,
    signals,
    dataBytes
  }
}

function closeDetailPanel() {
  detailPanelHeight.value = 0
  selectedRowData.value = null
  detailInfo.value = null
}

// Drag resize for detail panel
let isResizingDetail = false
let resizeStartY = 0
let resizeStartHeight = 0

function onDetailResizeStart(e: MouseEvent) {
  isResizingDetail = true
  resizeStartY = e.clientY
  resizeStartHeight = detailPanelHeight.value
  document.addEventListener('mousemove', onDetailResizeMove)
  document.addEventListener('mouseup', onDetailResizeEnd)
  e.preventDefault()
}

function onDetailResizeMove(e: MouseEvent) {
  if (!isResizingDetail) return
  const delta = resizeStartY - e.clientY
  const newHeight = Math.max(detailPanelMinHeight, resizeStartHeight + delta)
  const maxHeight = props.height - 100
  detailPanelHeight.value = Math.min(newHeight, maxHeight)
}

function onDetailResizeEnd() {
  isResizingDetail = false
  document.removeEventListener('mousemove', onDetailResizeMove)
  document.removeEventListener('mouseup', onDetailResizeEnd)
}

// Drag resize for detail column split
let isResizingCol = false
let colResizeStartX = 0
let colResizeStartWidth = 0

function onColResizeStart(e: MouseEvent) {
  isResizingCol = true
  colResizeStartX = e.clientX
  colResizeStartWidth = detailHexWidth.value
  document.addEventListener('mousemove', onColResizeMove)
  document.addEventListener('mouseup', onColResizeEnd)
  e.preventDefault()
}

function onColResizeMove(e: MouseEvent) {
  if (!isResizingCol) return
  const delta = e.clientX - colResizeStartX
  detailHexWidth.value = Math.max(150, Math.min(colResizeStartWidth + delta, 800))
}

function onColResizeEnd() {
  isResizingCol = false
  document.removeEventListener('mousemove', onColResizeMove)
  document.removeEventListener('mouseup', onColResizeEnd)
}

function formatHexDump(bytes: number[]): string {
  const lines: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.slice(offset, offset + 16)
    const hex = chunk.map((b) => b.toString(16).padStart(2, '0')).join(' ')
    const ascii = chunk.map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')).join('')
    const addr = offset.toString(16).padStart(4, '0')
    lines.push(`${addr}  ${hex.padEnd(47)}  ${ascii}`)
  }
  return lines.join('\n')
}
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

// ---- Drag-and-drop BLF/ASC file support with pagination ----
const isDragOver = ref(false)
const traceFileSessionId = ref<string | null>(null)
const traceFileTotalFrames = ref(0)
const traceFilePageSize = ref(100000)
const traceFileCurrentPage = ref(0)
const traceFileLoading = ref(false)
const traceFileChannelCount = ref(0)
const traceFileMeasurementStartMs = ref(0)
let dragLeaveTimer: any = null

const traceFileTotalPages = computed(() =>
  traceFileTotalFrames.value > 0
    ? Math.ceil(traceFileTotalFrames.value / traceFilePageSize.value)
    : 0
)
const traceFileActive = computed(() => traceFileSessionId.value !== null)

// Channel map dialog
const channelMapDialogVisible = ref(false)
const channelMapTemp = ref<TraceChannelMap[]>([])
let channelMapResolve: (() => void) | null = null

const canDeviceOptions = computed(() => {
  const opts: { key: string; label: string }[] = []
  for (const [id, dev] of Object.entries(database.devices)) {
    if (dev.type === 'can' && dev.canDevice) {
      opts.push({ key: id, label: dev.canDevice.name })
    }
  }
  return opts
})

function showChannelMapDialog(channels: number[]): Promise<void> {
  const saved = trace.value.channelMap || []
  channelMapTemp.value = channels.map((ch) => {
    const existing = saved.find((m) => m.logChannel === ch)
    if (existing) return { ...existing }
    // Auto-match: channel N → Nth CAN device (by order)
    const canDevKeys = Object.entries(database.devices)
      .filter(([, d]) => d.type === 'can' && d.canDevice)
      .map(([id]) => id)
    const autoDeviceId = canDevKeys[ch - 1] || ''
    return { logChannel: ch, deviceId: autoDeviceId }
  })
  channelMapDialogVisible.value = true
  return new Promise((resolve) => {
    channelMapResolve = resolve
  })
}

function confirmChannelMap() {
  trace.value.channelMap = channelMapTemp.value.filter((m) => m.deviceId)
  channelMapDialogVisible.value = false
  channelDbcMapCache = null
  channelMsgNameCache = null
  channelMapResolve?.()
  channelMapResolve = null
}

function cancelChannelMap() {
  channelMapDialogVisible.value = false
  channelMapResolve?.()
  channelMapResolve = null
}

function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('Files')) {
    isDragOver.value = true
    clearTimeout(dragLeaveTimer)
  }
}

function onDragLeave() {
  dragLeaveTimer = setTimeout(() => {
    isDragOver.value = false
  }, 100)
}

function buildChannelDbcMap(): Map<number, { dbKey: string; db: any; deviceName: string }> {
  const map = new Map<number, { dbKey: string; db: any; deviceName: string }>()
  const chMap = trace.value.channelMap
  if (chMap && chMap.length > 0) {
    for (const entry of chMap) {
      const dev = database.devices[entry.deviceId]
      if (dev && dev.type === 'can' && dev.canDevice) {
        const canDev = dev.canDevice
        if (canDev.database && database.database.can[canDev.database]) {
          map.set(entry.logChannel, {
            dbKey: canDev.database,
            db: database.database.can[canDev.database],
            deviceName: canDev.name || `CH${entry.logChannel}`
          })
        } else {
          map.set(entry.logChannel, {
            dbKey: '',
            db: null,
            deviceName: canDev.name || `CH${entry.logChannel}`
          })
        }
      }
    }
  }
  return map
}

type ParsedFrame = {
  channel: number
  ts: number
  id: number
  dir: string
  msgType: { idType: string; brs: boolean; canfd: boolean; remote: boolean }
  data: number[]
  isError?: boolean
}

let channelDbcMapCache: Map<number, { dbKey: string; db: any; deviceName: string }> | null = null
// Pre-built message name lookup: channel -> (msgKey -> messageName)
let channelMsgNameCache: Map<number, Map<string, string>> | null = null

function buildMsgNameCache(
  chDbcMap: Map<number, { dbKey: string; db: any; deviceName: string }>
): Map<number, Map<string, string>> {
  const cache = new Map<number, Map<string, string>>()
  for (const [ch, entry] of chDbcMap) {
    if (!entry.db || !entry.db.messages) continue
    const lookup = new Map<string, string>()
    for (const m of entry.db.messages) {
      const key = `${m.id}-${!!m.is_extended_frame}`
      lookup.set(key, m.name)
    }
    cache.set(ch, lookup)
  }
  return cache
}

function formatAbsTime(tsUs: number): string {
  const startMs = traceFileMeasurementStartMs.value
  if (startMs > 0) {
    const d = new Date(startMs + tsUs / 1000)
    const y = d.getUTCFullYear()
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    const h = String(d.getUTCHours()).padStart(2, '0')
    const mi = String(d.getUTCMinutes()).padStart(2, '0')
    const s = String(d.getUTCSeconds()).padStart(2, '0')
    const ms = String(d.getUTCMilliseconds()).padStart(3, '0')
    return `${y}-${mo}-${day} ${h}:${mi}:${s}.${ms}`
  }
  // Fallback: elapsed time
  const totalSeconds = tsUs / 1000000
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`
}

function framesToLogData(
  frames: ParsedFrame[],
  indexOffset: number,
  prevLastTs: number
): LogData[] {
  if (!channelDbcMapCache) {
    channelDbcMapCache = buildChannelDbcMap()
    channelMsgNameCache = buildMsgNameCache(channelDbcMapCache)
  }
  const result: LogData[] = []

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    if (frame.isError) continue

    const msgType: CanMsgType = {
      idType: frame.msgType.idType as CAN_ID_TYPE,
      brs: frame.msgType.brs,
      canfd: frame.msgType.canfd,
      remote: frame.msgType.remote
    }
    const dataArr = new Uint8Array(frame.data)
    let name: string | undefined

    const chDbc = channelDbcMapCache.get(frame.channel)
    const msgLookup = channelMsgNameCache?.get(frame.channel)
    if (msgLookup) {
      const isExtended = msgType.idType === CAN_ID_TYPE.EXTENDED
      name = msgLookup.get(`${frame.id}-${isExtended}`)
    }

    const deviceName = chDbc?.deviceName || `CH${frame.channel}`

    const idStr = '0x' + frame.id.toString(16)
    const globalIndex = indexOffset + i + 1
    const deltaTs = prevLastTs >= 0 ? frame.ts - prevLastTs : undefined
    prevLastTs = frame.ts
    result.push({
      method: 'canBase',
      dir: frame.dir === 'OUT' ? 'Tx' : 'Rx',
      data: data2str(dataArr),
      ts: frame.ts,
      id: idStr,
      dlc: getDlcByLen(dataArr.length, msgType.canfd),
      len: dataArr.length,
      device: deviceName,
      channel: `CH${frame.channel}`,
      msgType: CanMsgType2Str(msgType),
      name,
      seqIndex: globalIndex,
      deltaTs,
      absTimeStr: formatAbsTime(frame.ts),
      key: `${globalIndex}-CH${frame.channel}-${idStr}`
    })
    addToIdList(idStr)
  }
  return result
}

async function closeTraceFileSession() {
  if (traceFileSessionId.value) {
    await window.electron.ipcRenderer.invoke('ipc-trace-file-close', traceFileSessionId.value)
    traceFileSessionId.value = null
  }
  traceFileTotalFrames.value = 0
  traceFileCurrentPage.value = 0
  traceFileChannelCount.value = 0
  traceFileMeasurementStartMs.value = 0
  channelDbcMapCache = null
  channelMsgNameCache = null
}

async function loadTraceFilePage(page: number) {
  if (!traceFileSessionId.value || traceFileLoading.value) return
  if (page < 0 || page >= traceFileTotalPages.value) return

  traceFileLoading.value = true
  try {
    const result = await window.electron.ipcRenderer.invoke(
      'ipc-trace-file-page',
      traceFileSessionId.value,
      page,
      traceFilePageSize.value
    )
    const { frames, prevLastTs } = result as {
      frames: ParsedFrame[]
      totalFrames: number
      prevLastTs: number
    }

    const indexOffset = page * traceFilePageSize.value
    const parsedData = framesToLogData(frames, indexOffset, prevLastTs)
    allLogData = parsedData
    grid.loadData(allLogData)
    grid.scrollYTo(0)
    traceFileCurrentPage.value = page
  } catch (err: any) {
    ElMessage.error(i18next.t('uds.trace.messages.parseError', { msg: err.message || err }))
  } finally {
    traceFileLoading.value = false
  }
}

function traceFileGoFirst() {
  loadTraceFilePage(0)
}
function traceFileGoPrev() {
  loadTraceFilePage(traceFileCurrentPage.value - 1)
}
function traceFileGoNext() {
  loadTraceFilePage(traceFileCurrentPage.value + 1)
}
function traceFileGoLast() {
  loadTraceFilePage(traceFileTotalPages.value - 1)
}
const traceFileJumpPage = ref(1)
function traceFileGoJump() {
  const target = traceFileJumpPage.value - 1
  loadTraceFilePage(target)
}
function onPageSizeChange() {
  if (traceFileSessionId.value) {
    loadTraceFilePage(0)
  }
}

async function onDrop(e: DragEvent) {
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const file = files[0]
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'blf' && ext !== 'asc') {
    ElMessage.warning(i18next.t('uds.trace.messages.unsupportedFormat'))
    return
  }

  const filePath = window.electron.webUtils.getPathForFile(file)
  if (!filePath) return

  await closeTraceFileSession()
  clearLog(i18next.t('uds.trace.messages.dropFileHint'))
  isPaused.value = true
  channelDbcMapCache = null
  channelMsgNameCache = null

  const loadingInstance = ElLoading.service({
    text: i18next.t('uds.trace.messages.parsingFile')
  })

  try {
    const openResult = await window.electron.ipcRenderer.invoke('ipc-trace-file-open', filePath)
    const { sessionId, totalFrames, channels, measurementStartTimeMs } = openResult as {
      sessionId: string
      totalFrames: number
      channels: number[]
      measurementStartTimeMs: number
    }

    traceFileSessionId.value = sessionId
    traceFileTotalFrames.value = totalFrames
    traceFileChannelCount.value = channels.length
    traceFileMeasurementStartMs.value = measurementStartTimeMs
    traceFileCurrentPage.value = 0
    traceFileJumpPage.value = 1

    // Show channel map dialog if there are CAN devices configured
    if (canDeviceOptions.value.length > 0 && channels.length > 0) {
      loadingInstance.close()
      await showChannelMapDialog(channels)
    }

    channelDbcMapCache = null
    channelMsgNameCache = null
    const loadingInstance2 = ElLoading.service({
      text: i18next.t('uds.trace.messages.parsingFile')
    })

    try {
      // Load first page
      const pageResult = await window.electron.ipcRenderer.invoke(
        'ipc-trace-file-page',
        sessionId,
        0,
        traceFilePageSize.value
      )
      const { frames: firstFrames, prevLastTs: firstPrevLastTs } = pageResult as {
        frames: ParsedFrame[]
        totalFrames: number
        prevLastTs: number
      }

      const parsedData = framesToLogData(firstFrames, 0, firstPrevLastTs)
      allLogData = parsedData
      grid.loadData(allLogData)
      grid.scrollYTo(0)

      ElMessage.success(
        i18next.t('uds.trace.messages.parseComplete', {
          count: totalFrames,
          channels: channels.length
        })
      )
    } finally {
      loadingInstance2.close()
    }
  } catch (err: any) {
    ElMessage.error(i18next.t('uds.trace.messages.parseError', { msg: err.message || err }))
    await closeTraceFileSession()
  } finally {
    loadingInstance.close()
  }
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

// All available column definitions (index column always first and visible)
const allColumnDefs: { key: string; title: string; width: number; formatter?: any }[] = [
  {
    key: 'seqIndex',
    title: '#',
    width: 80,
    formatter: (row: any) => (row.row.seqIndex != null ? String(row.row.seqIndex) : '')
  },
  {
    key: 'ts',
    title: i18next.t('uds.trace.columns.time'),
    width: 200,
    formatter: (row: any) => {
      if (row.row.ts) {
        if (isOverwrite.value) {
          const parts = [(row.row.ts / 1000000).toFixed(6)]
          if (row.row.count != null && row.row.count > 0) parts.push(`#${row.row.count}`)
          return parts.join(' ')
        }
        return (row.row.ts / 1000000).toFixed(6)
      } else {
        return ''
      }
    }
  },
  {
    key: 'deltaTs',
    title: 'Δt(s)',
    width: 120,
    formatter: (row: any) => (row.row.deltaTs != null ? (row.row.deltaTs / 1000000).toFixed(6) : '')
  },
  {
    key: 'absTimeStr',
    title: 'UTC Time',
    width: 200,
    formatter: (row: any) => row.row.absTimeStr || ''
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
]

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

// Column config: controls visibility, order and width (index column always first)
function buildColumnConfig(): { key: string; title: string; visible: boolean; width: number }[] {
  const saved = trace.value.columnConfig
  if (saved && saved.length > 0) {
    // Rebuild from saved config, merging with allColumnDefs for title/formatter
    const result: { key: string; title: string; visible: boolean; width: number }[] = []
    for (const sc of saved) {
      const def = allColumnDefs.find((d) => d.key === sc.key)
      if (def) {
        result.push({ key: sc.key, title: def.title, visible: sc.visible, width: sc.width })
      }
    }
    // Add any new columns not in saved config
    for (const def of allColumnDefs) {
      if (!result.find((r) => r.key === def.key)) {
        result.push({ key: def.key, title: def.title, visible: true, width: def.width })
      }
    }
    return result
  }
  return allColumnDefs.map((c) => ({ key: c.key, title: c.title, visible: true, width: c.width }))
}

const columnConfig = ref(buildColumnConfig())

const colDragOverIdx = ref(-1)
let colDragStartIdx = -1

function onColDragStart(idx: number) {
  if (columnConfig.value[idx].key === 'seqIndex') return
  colDragStartIdx = idx
}
function onColDragOver(idx: number) {
  if (idx === 0) return // can't drop onto index column
  colDragOverIdx.value = idx
}
function onColDrop(idx: number) {
  colDragOverIdx.value = -1
  if (colDragStartIdx < 0 || colDragStartIdx === idx || idx === 0) return
  if (columnConfig.value[colDragStartIdx].key === 'seqIndex') return
  const item = columnConfig.value.splice(colDragStartIdx, 1)[0]
  columnConfig.value.splice(idx, 0, item)
  applyColumnConfig()
}

function applyColumnConfig() {
  const visible = columnConfig.value.filter((c) => c.visible)
  const newCols: Column[] = visible.map((c) => {
    const def = allColumnDefs.find((d) => d.key === c.key)!
    const col: Column = { key: def.key, title: def.title, width: c.width }
    if (def.formatter) col.formatter = def.formatter
    return col
  })
  // Apply tree type to seqIndex column if in overwrite mode
  if (isOverwrite.value) {
    const seqCol = newCols.find((c) => c.key === 'seqIndex')
    if (seqCol) seqCol.type = 'tree'
  }
  columes.value = newCols
  // Persist to project
  saveColumnConfig()
}

function saveColumnConfig() {
  trace.value.columnConfig = columnConfig.value.map((c) => ({
    key: c.key,
    visible: c.visible,
    width: c.width
  }))
}

function resetColumnConfig() {
  columnConfig.value = allColumnDefs.map((c) => ({
    key: c.key,
    title: c.title,
    visible: true,
    width: c.width
  }))
  applyColumnConfig()
}

const columes: Ref<Column[]> = ref(
  (() => {
    const visible = columnConfig.value.filter((c) => c.visible)
    return visible.map((c) => {
      const def = allColumnDefs.find((d) => d.key === c.key)!
      const col: Column = { key: def.key, title: def.title, width: c.width }
      if (def.formatter) col.formatter = def.formatter
      return col
    })
  })()
)
watch(
  columes,
  () => {
    grid.loadColumns(columes.value)
  },
  { deep: true }
)
watch([isPaused, isOverwrite], (v) => {
  applyColumnConfig()
  if (!v[0] && !v[1]) {
    scrollY = -1
  }
  if (v[0]) {
    //load data
    grid.loadData(allLogData)
    grid.scrollYTo(99999999999)
  }
})

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
      ENABLE_RESIZE_COLUMN: true,
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
    // Open detail panel for clicked row
    if (row) {
      const logRow = allLogData.find((d) => d.key === row.rowKey)
      if (logRow) {
        if (detailPanelHeight.value === 0) {
          detailPanelHeight.value = detailPanelDefaultHeight
        }
        decodeSelectedRow(logRow)
      }
    }
  })
  grid.on('resizeColumnChange', (info: { key: string; width: number }) => {
    const cfg = columnConfig.value.find((c) => c.key === info.key)
    if (cfg) {
      cfg.width = Math.round(info.width)
      saveColumnConfig()
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
  closeTraceFileSession()
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

/* Detail panel styles */
.detail-resize-handle {
  height: 4px;
  cursor: ns-resize;
  background: var(--el-border-color-lighter);
  border-top: 1px solid var(--el-border-color);
  border-bottom: 1px solid var(--el-border-color);
}
.detail-resize-handle:hover {
  background: var(--el-color-primary-light-7);
}

.detail-panel {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--el-border-color);
  overflow: hidden;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.detail-panel-header {
  display: flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
  min-height: 24px;
}

.detail-panel-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.detail-tree {
  flex: 1;
  overflow: auto;
  padding: 4px 8px;
  min-width: 0;
}

.detail-hex {
  min-width: 150px;
  overflow: auto;
  padding: 4px 8px;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}

.detail-col-resize {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  flex-shrink: 0;
}

.detail-col-resize:hover {
  background: var(--el-color-primary-light-7);
}

.detail-hex-title {
  font-weight: bold;
  font-size: 12px;
  color: var(--el-text-color-primary);
  padding: 2px 0;
  cursor: pointer;
  user-select: none;
}

.detail-collapsible {
  margin: 0;
}

.hex-dump {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre;
  color: var(--el-text-color-regular);
}

details > summary {
  cursor: pointer;
  user-select: none;
}

.detail-section {
  font-weight: bold;
  color: var(--el-text-color-primary);
  padding: 2px 0;
  font-size: 12px;
}

.detail-comment {
  font-weight: normal;
  color: var(--el-text-color-secondary);
  font-style: italic;
}

.detail-fields {
  padding-left: 4px;
}

.detail-field-row {
  padding: 1px 0;
  display: flex;
  gap: 8px;
}

.detail-label {
  color: var(--el-text-color-secondary);
  min-width: 80px;
}

.detail-value {
  color: var(--el-text-color-primary);
}

.detail-signal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.detail-signal-table th {
  text-align: left;
  padding: 2px 8px;
  color: var(--el-text-color-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color-lighter);
  white-space: nowrap;
  position: sticky;
  top: 0;
  background: var(--el-bg-color);
}

.detail-signal-table td {
  padding: 2px 8px;
  white-space: nowrap;
}

.detail-signal-table tbody tr:hover {
  background: var(--el-fill-color-light);
}

.detail-no-signals {
  color: var(--el-text-color-placeholder);
  padding: 8px;
  font-style: italic;
}

.detail-sig-name {
  color: var(--el-color-primary);
  font-weight: 500;
}

.detail-sig-phys {
  color: var(--el-text-color-primary);
}

.detail-sig-unit {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.detail-sig-raw {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.detail-sig-bits {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}
</style>
