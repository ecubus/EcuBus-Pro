<template>
  <div style="display: relative" @click="hideContextMenu" @contextmenu.prevent="onContextMenu">
    <VxeGrid
      ref="xGrid"
      v-bind="gridOptions"
      class="sequenceTable"
      @cell-click="ceilClick"
      @cell-mouseenter="onCellMouseEnter"
      @cell-mouseleave="onCellMouseLeave"
    >
      <template #default_trigger="{ row, rowIndex }">
        <span class="lr">
          <span
            >{{ row.trigger.type.toUpperCase() }}
            <span v-if="row.trigger.type == 'manual' && row.trigger.onKey" style="padding: 0 5px"
              >({{ row.trigger.onKey }})</span
            >
            <span v-if="row.trigger.type == 'periodic'" style="padding: 0 5px"
              >({{ row.trigger.period || 10 }}ms)</span
            >
          </span>
          <el-button
            :ref="(e) => (buttonRef[rowIndex] = e)"
            link
            style="float: right"
            @click="openPr(rowIndex)"
            ><el-icon class="el-icon--right">
              <arrow-down />
            </el-icon>
          </el-button>
        </span>
      </template>
      <template #default_send="{ row, rowIndex }">
        <el-button
          v-if="row.trigger.type == 'manual'"
          type="primary"
          size="small"
          plain
          style="width: 70px"
          :disabled="!globalStart"
          @click="sendFrame(rowIndex)"
        >
          <Icon :icon="sendIcon" />
        </el-button>
        <el-button
          v-else
          :type="periodTimer[rowIndex] ? 'danger' : 'primary'"
          size="small"
          plain
          style="width: 70px"
          :disabled="!globalStart"
          @click="sendFrame(rowIndex)"
        >
          <Icon :icon="periodTimer[rowIndex] ? stopIcon : sendIcon" />
        </el-button>
      </template>
      <template #default_type="{ row }">
        <el-select v-model="row.type" size="small" style="width: 100%">
          <el-option
            v-for="(l, v) in row.remote ? typeMapRemote : typeMap"
            :key="v"
            :value="v"
            :label="l"
          ></el-option>
        </el-select>
      </template>
      <template #default_type1="{ row }">
        {{ typeMap[row.type] }}
      </template>
      <template #default_dlc="{ row }">
        <el-select v-model="row.dlc" size="small" style="width: 100%">
          <el-option v-for="i in 16" :key="i" :value="i - 1"></el-option>
        </el-select>
      </template>
      <template #default_channel="{ row }">
        {{ devices[row.channel]?.name }}
      </template>
      <template #edit_channel="{ row }">
        <el-select v-model="row.channel" size="small" style="width: 100%" clearable>
          <el-option
            v-for="key in dataBase.ia[editIndex].devices"
            :key="key"
            :value="key"
            :label="devices[key]?.name"
          ></el-option>
        </el-select>
      </template>
      <template #default_id="{ row }">
        <el-input v-model="row.id" size="small" style="width: 100%" @input="idChange" />
      </template>
      <template #default_name="{ row }">
        <span class="name-cell">{{ row.name || '--' }}</span>
      </template>
      <template #edit_name="{ row }">
        <el-input v-model="row.name" size="small" style="width: 100%" />
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
            <el-tooltip
              effect="light"
              :content="i18next.t('uds.network.cani.tooltips.editConnect')"
              placement="bottom"
            >
              <el-button type="primary" link @click="editConnect">
                <Icon :icon="linkIcon" style="rotate: -45deg; font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip
              effect="light"
              :content="i18next.t('uds.network.cani.tooltips.addFrame')"
              placement="bottom"
            >
              <el-button link @click="addFrame">
                <Icon :icon="fileOpenOutline" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip
              effect="light"
              :content="i18next.t('uds.network.cani.tooltips.selectFrameFromDatabase')"
              placement="bottom"
            >
              <el-button link @click="openFrameSelect">
                <Icon :icon="databaseIcon" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip
              effect="light"
              :content="i18next.t('uds.network.cani.tooltips.editFrame')"
              placement="bottom"
            >
              <el-button link type="success" :disabled="popoverIndex < 0" @click="editFrame">
                <Icon :icon="editIcon" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip
              effect="light"
              :content="i18next.t('uds.network.cani.tooltips.deleteFrame')"
              placement="bottom"
            >
              <el-button
                link
                type="danger"
                :disabled="popoverIndex < 0 || periodTimer[popoverIndex] == true"
                @click="deleteFrame"
              >
                <Icon :icon="deleteIcon" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
          </el-button-group>
        </div>
      </template>
    </VxeGrid>

    <!-- Right-Click Context Menu (teleported to body to avoid parent CSS interference) -->
    <Teleport to="body">
      <div
        v-show="contextMenuVisible"
        :style="{
          position: 'fixed',
          left: contextMenuX + 'px',
          top: contextMenuY + 'px',
          zIndex: 9999
        }"
        class="context-menu"
        @click.stop
      >
        <div class="context-menu-item" @click="(addFrame(), hideContextMenu())">
          {{ i18next.t('uds.network.cani.contextMenu.addFrame') }}
        </div>
        <div
          class="context-menu-item"
          :class="{ disabled: popoverIndex < 0 || periodTimer[popoverIndex] == true }"
          @click="(editFrame(), hideContextMenu())"
        >
          {{ i18next.t('uds.network.cani.tooltips.editFrame') }}
        </div>
        <div class="context-menu-item" @click="(openFrameSelect(), hideContextMenu())">
          {{ i18next.t('uds.network.cani.contextMenu.selectFrameFromDatabase') }}
        </div>
        <div class="context-menu-separator"></div>
        <div
          class="context-menu-item"
          :class="{ disabled: popoverIndex < 0 }"
          @click="(copyFrame(), hideContextMenu())"
        >
          {{ i18next.t('uds.network.cani.contextMenu.copy') }}
        </div>
        <div
          class="context-menu-item"
          :class="{ disabled: !copiedFrame }"
          @click="(pasteFrame(), hideContextMenu())"
        >
          {{ i18next.t('uds.network.cani.contextMenu.paste') }}
        </div>
        <div class="context-menu-separator"></div>
        <div
          class="context-menu-item"
          :class="{ disabled: popoverIndex < 0 || periodTimer[popoverIndex] == true }"
          @click="(deleteFrame(), hideContextMenu())"
        >
          {{ i18next.t('uds.network.cani.contextMenu.deleteFrame') }}
        </div>
        <div class="context-menu-item" @click="(deleteAllFrames(), hideContextMenu())">
          {{ i18next.t('uds.network.cani.contextMenu.deleteAllFrames') }}
        </div>
      </div>
    </Teleport>

    <el-tooltip
      effect="light"
      placement="top"
      :show-after="200"
      popper-class="frame-data-tooltip"
      :virtual-ref="tooltipTarget"
      virtual-triggering
      :disabled="!tooltipInfo"
    >
      <template #content>
        <div class="tooltip-content">
          <table class="tp-table">
            <tbody>
              <tr v-if="tooltipInfo?.name">
                <td class="tp-label">Name</td>
                <td class="tp-value">{{ tooltipInfo.name }}</td>
              </tr>
              <tr v-if="tooltipInfo?.database">
                <td class="tp-label">DB</td>
                <td class="tp-value">{{ tooltipInfo.database }}</td>
              </tr>
              <tr>
                <td class="tp-label">ID</td>
                <td class="tp-value">0x{{ tooltipInfo?.idHex }}</td>
              </tr>
              <tr>
                <td class="tp-label">Type</td>
                <td class="tp-value">
                  {{ tooltipInfo?.typeName }}<span v-if="tooltipInfo?.remote">, Remote</span
                  ><span v-if="tooltipInfo?.brs">, BRS</span>
                </td>
              </tr>
              <tr>
                <td class="tp-label">DLC</td>
                <td class="tp-value">{{ tooltipInfo?.dlc }}</td>
              </tr>
              <tr>
                <td class="tp-label">Channel</td>
                <td class="tp-value">{{ tooltipInfo?.channelName }}</td>
              </tr>
              <tr>
                <td class="tp-label">Trigger</td>
                <td class="tp-value">
                  {{ tooltipInfo?.triggerType
                  }}<span v-if="tooltipInfo?.triggerDetail">
                    ({{ tooltipInfo.triggerDetail }})</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
          <div class="tp-data">
            <template v-if="tooltipInfo?.dataChunks.length">
              <template v-for="(chunk, ci) in tooltipInfo.dataChunks" :key="ci">
                <span v-if="ci > 0"><br /></span>
                <span>{{ chunk }}</span>
              </template>
            </template>
            <span v-else>--</span>
          </div>
        </div>
      </template>
    </el-tooltip>

    <el-popover width="250" :virtual-ref="ppRef" trigger="click" virtual-triggering>
      <el-row v-if="dataBase.ia[editIndex]?.action[popoverIndex]" style="padding: 10px">
        <el-col :span="24">
          <el-radio-group
            v-model="dataBase.ia[editIndex].action[popoverIndex].trigger.type"
            :disabled="periodTimer[popoverIndex]"
          >
            <el-radio value="manual">{{
              i18next.t('uds.network.cani.triggerTypes.manual')
            }}</el-radio>
            <el-radio value="periodic">{{
              i18next.t('uds.network.cani.triggerTypes.periodic')
            }}</el-radio>
          </el-radio-group>
        </el-col>

        <el-col :span="12">
          <div>{{ i18next.t('uds.network.cani.labels.onKey') }}</div>
          <div>
            <el-input
              v-model="dataBase.ia[editIndex].action[popoverIndex].trigger.onKey"
              size="small"
              style="width: 80%"
              :disabled="dataBase.ia[editIndex].action[popoverIndex].trigger.type != 'manual'"
            ></el-input>
          </div>
        </el-col>
        <el-col :span="12">
          <div>{{ i18next.t('uds.network.cani.labels.period') }}</div>
          <div>
            <el-input-number
              v-model="dataBase.ia[editIndex].action[popoverIndex].trigger.period"
              size="small"
              style="width: 100%"
              controls-position="right"
              :min="1"
              :disabled="
                dataBase.ia[editIndex].action[popoverIndex].trigger.type != 'periodic' ||
                periodTimer[popoverIndex]
              "
              placeholder="10"
            ></el-input-number>
          </div>
        </el-col>
      </el-row>
    </el-popover>
    <el-dialog
      v-if="connectV"
      v-model="connectV"
      :title="i18next.t('uds.network.cani.dialogs.iaDeviceConnect')"
      width="590"
      align-center
      :append-to="`#win${editIndex}_ia`"
    >
      <div
        style="
          text-align: center;
          padding-top: 10px;
          padding-bottom: 10px;
          width: 570px;
          height: 250px;
          overflow: auto;
        "
      >
        <el-transfer
          v-model="dataBase.ia[editIndex].devices"
          class="canit"
          style="text-align: left; display: inline-block"
          :data="allDeviceLabel"
          :titles="[
            i18next.t('uds.network.cani.transfer.valid'),
            i18next.t('uds.network.cani.transfer.assigned')
          ]"
        />
      </div>
    </el-dialog>
    <el-dialog
      v-if="editV && formData"
      v-model="editV"
      :title="
        i18next.t('uds.network.cani.dialogs.editFrame', {
          name: dataBase.ia[editIndex].action[popoverIndex].name
        })
      "
      width="90%"
      align-center
      :append-to="`#win${editIndex}_ia`"
    >
      <div
        :style="{
          padding: '10px',
          height: fh,
          overflowY: 'auto'
        }"
      >
        <el-form
          :model="formData"
          label-width="80"
          size="small"
          class="formH"
          :disabled="periodTimer[popoverIndex] == true"
        >
          <el-form-item :label="i18next.t('uds.network.cani.labels.name')">
            <el-input v-model="formData.name" :disabled="formData.database != undefined" />
          </el-form-item>
          <el-form-item :label="i18next.t('uds.network.cani.labels.id')">
            <el-input v-model="formData.id" @input="idChange" />
          </el-form-item>
          <el-form-item :label="i18next.t('uds.network.cani.labels.channel')">
            <el-select v-model="formData.channel" size="small" style="width: 100%" clearable>
              <el-option
                v-for="key in dataBase.ia[editIndex].devices"
                :key="key"
                :value="key"
                :label="devices[key]?.name"
              ></el-option>
            </el-select>
          </el-form-item>
          <el-form-item :label="i18next.t('uds.network.cani.labels.type')">
            <el-select v-model="formData.type" size="small" style="width: 100%">
              <el-option
                v-for="(l, v) in formData.remote ? typeMapRemote : typeMap"
                :key="v"
                :value="v"
                :label="l"
              ></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label-width="0">
            <el-col :span="12">
              <el-form-item :label="i18next.t('uds.network.cani.labels.remote')">
                <el-checkbox v-model="formData.remote" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="i18next.t('uds.network.cani.labels.brs')">
                <el-checkbox v-model="formData.brs" :disabled="!formData.type.includes('fd')" />
              </el-form-item>
            </el-col>
          </el-form-item>
          <el-form-item :label="i18next.t('uds.network.cani.labels.dlc')">
            <el-select v-model="formData.dlc" size="small" style="width: 100%">
              <el-option v-for="i in 16" :key="i" :value="i - 1"></el-option>
            </el-select>
          </el-form-item>
        </el-form>
        <el-tabs v-model="activeName">
          <el-tab-pane
            v-if="formData.database"
            :label="i18next.t('uds.network.cani.tabs.signal')"
            name="signal"
          >
            <CanISignal
              :message-id="formData.id"
              :database="formData.database"
              @change="handleDataChange"
            />
          </el-tab-pane>
          <el-tab-pane :label="i18next.t('uds.network.cani.tabs.rawData')" name="raw">
            <div style="margin-left: 10px">
              <el-input
                v-for="index in dlcToLen"
                :key="index"
                :ref="
                  (el: any) => {
                    if (el) byteInputRefs[index - 1] = el
                  }
                "
                v-model="formData.data[index - 1]"
                class="dataI"
                :maxlength="2"
                :placeholder="i18next.t('uds.network.cani.placeholders.hexByte')"
                style="width: 65px; margin-right: 5px; margin-bottom: 5px"
                @focus="onByteFocus"
                @input="dataChange(index - 1, $event)"
                @change="dataChangeDone"
                ><template #prepend>{{ index - 1 }}</template></el-input
              >
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>
    <Transition name="bounce">
      <div v-if="animate" class="key-box">
        <span class="key-text">{{ pressedKey }}</span>
      </div>
    </Transition>
    <el-dialog
      v-if="selectFrameVisible"
      v-model="selectFrameVisible"
      :title="i18next.t('uds.network.cani.dialogs.selectFrameFromDatabase')"
      :append-to="`#win${editIndex}_ia`"
      width="600"
      align-center
    >
      <Signal
        :height="(h * 2) / 3"
        :width="480"
        protocol-filter="can"
        selectable-level="frame"
        :speical-db="speicalDb"
        @add-frame="handleFrameSelect"
      />
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
import { ArrowDown } from '@element-plus/icons-vue'
import { ref, onMounted, onUnmounted, computed, toRef, nextTick, watch } from 'vue'
import {
  CAN_ID_TYPE,
  CanBaseInfo,
  CanDevice,
  CanInterAction,
  CanMsgType,
  getDlcByLen
} from 'nodeCan/can'
import { VxeGridProps } from 'vxe-table'
import { VxeGrid } from 'vxe-table'
import { Icon } from '@iconify/vue'
import CanISignal from './canisignale.vue'
import circlePlusFilled from '@iconify/icons-material-symbols/scan-delete-outline'
import infoIcon from '@iconify/icons-material-symbols/info-outline'
import errorIcon from '@iconify/icons-material-symbols/chat-error-outline-sharp'
import warnIcon from '@iconify/icons-material-symbols/warning-outline-rounded'
import saveIcon from '@iconify/icons-material-symbols/save'
import fileOpenOutline from '@iconify/icons-material-symbols/file-open-outline'
import linkIcon from '@iconify/icons-material-symbols/add-link'
import sendIcon from '@iconify/icons-material-symbols/send'
import stopIcon from '@iconify/icons-material-symbols/stop'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import editIcon from '@iconify/icons-material-symbols/edit-square-outline'
import { ServiceItem, Sequence, getTxPduStr, getTxPdu } from 'nodeCan/uds'
import { useDataStore } from '@r/stores/data'
import { cloneDeep, isEqual } from 'lodash'
import { onKeyStroke, onKeyUp } from '@vueuse/core'
import Signal from '../components/signal.vue'
import databaseIcon from '@iconify/icons-material-symbols/database'
import { GraphBindFrameValue, GraphNode } from 'src/preload/data'
import { Message } from 'nodeCan/can'
import { writeMessageData } from '@r/database/dbc/calc'
import { useGlobalStart, useRuntimeStore } from '@r/stores/runtime'
import { v4 } from 'uuid'
import i18next from 'i18next'

const xGrid = ref()
const tooltipRowIndex = ref(-1)
const tooltipTarget = ref<HTMLElement | null>(null)
let tooltipTimer: ReturnType<typeof setTimeout> | null = null

const tooltipInfo = computed(() => {
  const idx = tooltipRowIndex.value
  if (idx < 0) return null
  const row = dataBase.ia[editIndex.value]?.action[idx]
  if (!row) return null

  // Explicitly read all row properties so Vue tracks every reactive dependency
  const name = row.name
  const database = row.database
  const rawId = row.id
  const rowType = row.type
  const remote = row.remote
  const brs = row.brs
  const dlc = row.dlc
  const channel = row.channel
  const trigger = row.trigger
  const data = row.data

  return {
    name,
    database,
    idHex: rawId
      ? parseInt(rawId, 16)
          .toString(16)
          .toUpperCase()
          .padStart(rowType.includes('ecan') ? 8 : 4, '0')
      : '--',
    typeName: typeMap[rowType || ''] || rowType,
    remote,
    brs,
    dlc,
    channelName: devices.value[channel]?.name || channel || '--',
    triggerType: trigger.type.toUpperCase(),
    triggerDetail:
      trigger.type === 'manual' && trigger.onKey
        ? `Key: ${trigger.onKey}`
        : trigger.type === 'periodic'
          ? `${trigger.period || 10}ms`
          : '',
    dataChunks: (() => {
      if (!data || data.length === 0) return []
      const formatted = data.map((b: string) => (b || '00').padStart(2, '0').toUpperCase())
      const chunks: string[] = []
      for (let i = 0; i < formatted.length; i += 16) {
        chunks.push(formatted.slice(i, i + 16).join(' '))
      }
      return chunks
    })()
  }
})
// const logData = ref<LogData[]>([])
const typeMap = {
  can: i18next.t('uds.network.cani.frameTypes.can'),
  canfd: i18next.t('uds.network.cani.frameTypes.canFd'),
  ecan: i18next.t('uds.network.cani.frameTypes.extendedCan'),
  ecanfd: i18next.t('uds.network.cani.frameTypes.extendedCanFd')
}
const typeMapRemote = {
  can: i18next.t('uds.network.cani.frameTypes.can'),
  ecan: i18next.t('uds.network.cani.frameTypes.extendedCan')
}
const activeName = ref('signal')
const connectV = ref(false)
const editV = ref(false)
const buttonRef = ref({})
const popoverIndex = ref(-1)
const ppRef = computed(() => buttonRef.value[popoverIndex.value])
const globalStart = useGlobalStart()
const runtime = useRuntimeStore()
const periodTimer = computed({
  get: () => {
    const result: Record<number, boolean> = {}
    for (const [key, value] of Object.entries(runtime.canPeriods)) {
      const a = key.split('-')
      const item = a.slice(0, -1).join('-')
      const index = Number(a[a.length - 1])

      if (item === editIndex.value) {
        result[index] = value
      }
    }
    return result
  },
  set: (val) => {
    // 当 periodTimer 被设置时，更新 runtime store
    for (const [index, value] of Object.entries(val)) {
      const key = `${editIndex.value}-${index}`
      if (value) {
        runtime.setCanPeriod(key, true)
      } else {
        runtime.removeCanPeriod(key)
      }
    }
  }
})
const selectFrameVisible = ref(false)
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const copiedFrame = ref<CanInterAction | null>(null)
const speicalDb = computed(() => {
  //connected device db
  const list: string[] = []
  for (const d of dataBase.ia[editIndex.value].devices) {
    const db = dataBase.devices[d].canDevice?.database
    if (db) {
      list.push(db)
    }
  }
  return list
})
const props = defineProps<{
  height: number
  editIndex: string
}>()
// const start = toRef(props, 'start')
const h = toRef(props, 'height')
const editIndex = toRef(props, 'editIndex')
const dataBase = useDataStore()
const gridOptions = computed(() => {
  const v: VxeGridProps<CanInterAction> = {
    border: true,
    size: 'mini',
    columnConfig: {
      resizable: true
    },
    height: props.height,
    showOverflow: true,
    scrollY: {
      enabled: true,
      gt: 0
    },
    rowConfig: {
      isCurrent: true,
      keyField: 'uuid'
    },
    editConfig: {
      trigger: 'click',
      mode: 'cell',
      showIcon: false,
      beforeEditMethod({ rowIndex, column, row }) {
        if (periodTimer.value[rowIndex] == true) {
          return false
        }
        if (column.field == 'name' && row.database != undefined) {
          return false
        }
        return true
      }
    },
    toolbarConfig: {
      slots: {
        tools: 'toolbar'
      }
    },
    align: 'center',
    columns: [
      {
        type: 'seq',
        width: 40,
        title: '#',
        align: 'center',
        fixed: 'left',
        resizable: false
      },
      {
        field: 'send',
        title: i18next.t('uds.network.cani.table.send'),
        minWidth: 80,
        resizable: false,
        slots: { default: 'default_send' }
      },
      {
        field: 'trigger',
        title: i18next.t('uds.network.cani.table.trigger'),
        minWidth: 140,
        resizable: false,
        slots: { default: 'default_trigger' }
      },
      {
        field: 'name',
        title: i18next.t('uds.network.cani.table.name'),
        minWidth: 80,
        editRender: {},
        slots: { default: 'default_name', edit: 'edit_name' }
      },
      {
        field: 'id',
        title: i18next.t('uds.network.cani.table.idHex'),
        minWidth: 80,
        editRender: {},
        slots: { edit: 'default_id' }
      },
      {
        field: 'channel',
        title: i18next.t('uds.network.cani.table.channel'),
        minWidth: 100,
        editRender: {},
        slots: { default: 'default_channel', edit: 'edit_channel' }
      },
      {
        field: 'type',
        title: i18next.t('uds.network.cani.table.type'),
        minWidth: 90,
        editRender: {},
        slots: { default: 'default_type1', edit: 'default_type' }
      },
      {
        field: 'dlc',
        title: i18next.t('uds.network.cani.table.dlc'),
        minWidth: 70,
        editRender: {},
        slots: { edit: 'default_dlc' }
      }
    ],
    data:
      dataBase.ia[props.editIndex].type == 'can' ? dataBase.ia[props.editIndex]?.action || [] : []
  }
  return v
})
function addFrame() {
  const channel = Object.keys(devices.value)[0] || ''
  dataBase.ia[editIndex.value].action.push({
    uuid: v4(),
    trigger: {
      type: 'manual'
    },
    name: '',
    id: '1',
    channel: channel,
    type: 'can',
    dlc: 8,
    data: []
  })
}
watch(globalStart, (v) => {
  if (v == false) {
    // 当全局停止时，清除所有周期发送状态
    for (const key of Object.keys(runtime.canPeriods)) {
      if (key.startsWith(editIndex.value + '-')) {
        runtime.removeCanPeriod(key)
      }
    }
  }
})
function getLenByDlc(dlc: number, canFd: boolean) {
  const map: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 8,
    10: 8,
    11: 8,
    12: 8,
    13: 8,
    14: 8,
    15: 8
  }
  const mapFd: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 12,
    10: 16,
    11: 20,
    12: 24,
    13: 32,
    14: 48,
    15: 64
  }
  if (canFd) {
    return mapFd[dlc] || 0
  } else {
    return map[dlc] || 0
  }
}
const dlcToLen = computed(() => {
  if (formData.value == undefined) {
    return 0
  }
  const fd = formData.value.type.includes('fd')
  const dlc = formData.value.dlc
  return getLenByDlc(dlc, fd)
})
function ceilClick(val: any) {
  popoverIndex.value = val.rowIndex
}
function onCellMouseEnter({ rowIndex, $event }: any) {
  if (tooltipTimer) {
    clearTimeout(tooltipTimer)
    tooltipTimer = null
  }
  const tr = $event.currentTarget.parentElement as HTMLElement
  // Same row: tr unchanged. Only update target and fire synthetic event on row change
  if (tooltipRowIndex.value !== rowIndex || tooltipTarget.value !== tr) {
    tooltipRowIndex.value = rowIndex
    tooltipTarget.value = tr
    nextTick(() => {
      // Dispatch synthetic mouseenter so el-tooltip detects hover on the row
      tr.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    })
  }
}
function onCellMouseLeave() {
  // el-tooltip auto-hides via its own mouseleave listener on the tr.
  // Delay clearing rowIndex to allow moving between rows without flicker
  if (tooltipTimer) {
    clearTimeout(tooltipTimer)
    tooltipTimer = null
  }
  tooltipTimer = setTimeout(() => {
    tooltipRowIndex.value = -1
    tooltipTarget.value = null
  }, 200)
}
function idChange(v: string) {
  //if last char is not hex, remove it
  if (v.length > 0) {
    if (v[v.length - 1].match(/[0-9a-fA-F]/) == null) {
      dataBase.ia[editIndex.value].action[popoverIndex.value].id = v.slice(0, -1)
    }
  }
}
function dataChangeDone() {
  if (formData.value && formData.value.database) {
    const db = dataBase.database.can[formData.value.database]
    if (db) {
      const message = db.messages[parseInt(formData.value.id, 16)]
      if (message) {
        const data = Buffer.from(formData.value.data.map((v) => parseInt(v, 16)))
        writeMessageData(message, data, db)
      }
    }
  }
}
const byteInputRefs = ref<any[]>([])
function onByteFocus(event: FocusEvent) {
  // Auto-select existing content so user can type over it immediately
  const target = event.target as HTMLElement
  const input =
    target.tagName === 'INPUT' ? (target as HTMLInputElement) : target.querySelector('input')
  input?.select()
}
function dataChange(index: number, v: string) {
  if (v.length > 0 && formData.value) {
    if (v[v.length - 1].match(/[0-9a-fA-F]/) == null) {
      formData.value.data[index] = v.slice(0, -1)
    }
  }
  // Auto-focus next byte input when current is fully filled (2 hex chars)
  if (v.length >= 2) {
    nextTick(() => {
      const nextRef = byteInputRefs.value[index + 1]
      if (nextRef) {
        if (typeof nextRef.focus === 'function') {
          nextRef.focus()
          nextRef.select?.()
        } else if (nextRef.$el) {
          const input = nextRef.$el.querySelector('input')
          input?.focus()
          input?.select()
        }
      }
    })
  }
}
function handleDataChange(data: Buffer) {
  if (formData.value) {
    for (let i = 0; i < data.length; i++) {
      formData.value.data[i] = data[i].toString(16)
    }
  }
}

function deleteFrame() {
  if (popoverIndex.value >= 0) {
    const deletedIndex = popoverIndex.value
    dataBase.ia[editIndex.value].action.splice(deletedIndex, 1)
    const actions = dataBase.ia[editIndex.value].action
    if (actions.length > 0) {
      // Select the previous record, or the first if the deleted one was at index 0
      popoverIndex.value = Math.max(0, deletedIndex - 1)
      xGrid.value?.setCurrentRow(actions[popoverIndex.value])
    } else {
      popoverIndex.value = -1
      xGrid.value?.clearCurrentRow()
    }
  }
}

function deleteAllFrames() {
  const actions = dataBase.ia[editIndex.value].action
  if (actions.length > 0) {
    // Clear all periodic sends first
    for (let i = 0; i < actions.length; i++) {
      const key = `${editIndex.value}-${i}`
      if (runtime.canPeriods[key]) {
        runtime.removeCanPeriod(key)
        window.electron.ipcRenderer.send('ipc-stop-can-period', key)
      }
    }
    actions.length = 0
    popoverIndex.value = -1
    xGrid.value?.clearCurrentRow()
  }
}

function copyFrame() {
  if (popoverIndex.value >= 0) {
    const frame = dataBase.ia[editIndex.value].action[popoverIndex.value]
    if (frame) {
      copiedFrame.value = cloneDeep(frame)
    }
  }
}

function pasteFrame() {
  if (copiedFrame.value) {
    const channel = Object.keys(devices.value)[0] || ''
    const frame = cloneDeep(copiedFrame.value)
    frame.uuid = v4()
    if (!Object.keys(devices.value).includes(frame.channel)) {
      frame.channel = channel
    }
    dataBase.ia[editIndex.value].action.push(frame)
  }
}

function onContextMenu(event: MouseEvent) {
  const target = event.target as HTMLElement
  // Locate row by VxeGrid CSS class instead of relying on data-row-index attribute
  const row = target.closest('.vxe-body--row') as HTMLElement | null
  if (row?.parentElement) {
    const allRows = Array.from(row.parentElement.querySelectorAll('.vxe-body--row'))
    const rowIndex = allRows.indexOf(row)
    if (rowIndex >= 0) {
      popoverIndex.value = rowIndex
      xGrid.value?.setCurrentRow(dataBase.ia[editIndex.value].action[rowIndex])
    }
  }
  contextMenuVisible.value = true
  // Keep menu within viewport bounds
  const menuWidth = 220
  const menuHeight = 220
  contextMenuX.value = Math.min(event.clientX, window.innerWidth - menuWidth)
  contextMenuY.value = Math.min(event.clientY, window.innerHeight - menuHeight)
}

function hideContextMenu() {
  contextMenuVisible.value = false
}

const pressedKey = ref('')
const animate = ref(false)
onKeyStroke(true, (e) => {
  // e.preventDefault()
  if (globalStart.value) {
    const key = e.key
    pressedKey.value = key.toLocaleUpperCase()
    for (const [index, v] of dataBase.ia[editIndex.value].action.entries()) {
      if (
        v.trigger.type == 'manual' &&
        v.trigger.onKey &&
        v.trigger.onKey.toLocaleLowerCase() == key
      ) {
        animate.value = true
        sendFrame(index)
      }
    }
  }
})
onKeyUp(true, () => {
  setTimeout(() => {
    animate.value = false
  }, 200)
})

// Ctrl+C / Ctrl+V keyboard shortcuts for copy/paste frame
onKeyStroke(['c', 'C'], (e) => {
  if ((e.ctrlKey || e.metaKey) && !editV.value && !connectV.value && !selectFrameVisible.value) {
    e.preventDefault()
    copyFrame()
  }
})
onKeyStroke(['v', 'V'], (e) => {
  if ((e.ctrlKey || e.metaKey) && !editV.value && !connectV.value && !selectFrameVisible.value) {
    e.preventDefault()
    pasteFrame()
  }
})

// Arrow Up/Down: navigate between frame rows
onKeyStroke('ArrowUp', (e) => {
  if (!editV.value && !connectV.value && !selectFrameVisible.value) {
    const actions = dataBase.ia[editIndex.value].action
    if (actions.length > 0 && popoverIndex.value > 0) {
      e.preventDefault()
      popoverIndex.value--
      xGrid.value?.setCurrentRow(actions[popoverIndex.value])
    }
  }
})
onKeyStroke('ArrowDown', (e) => {
  if (!editV.value && !connectV.value && !selectFrameVisible.value) {
    const actions = dataBase.ia[editIndex.value].action
    if (actions.length > 0 && popoverIndex.value < actions.length - 1) {
      e.preventDefault()
      popoverIndex.value++
      xGrid.value?.setCurrentRow(actions[popoverIndex.value])
    }
  }
})

// Delete key: delete selected frame
onKeyStroke('Delete', (e) => {
  if (!editV.value && !connectV.value && !selectFrameVisible.value) {
    if (popoverIndex.value >= 0 && !periodTimer.value[popoverIndex.value]) {
      e.preventDefault()
      deleteFrame()
    }
  }
})

function sendFrame(index: number) {
  const frame = dataBase.ia[editIndex.value]?.action[index]
  if (frame) {
    if (frame.trigger.type == 'manual') {
      window.electron.ipcRenderer.send('ipc-send-can', cloneDeep(frame))
    } else {
      const key = `${editIndex.value}-${index}`
      if (runtime.canPeriods[key]) {
        runtime.removeCanPeriod(key)
        window.electron.ipcRenderer.send('ipc-stop-can-period', key)
      } else {
        runtime.setCanPeriod(key, true)
        window.electron.ipcRenderer.send('ipc-send-can-period', key, cloneDeep(frame))
      }
    }
  }
}

const devices = computed(() => {
  const dd: Record<string, CanBaseInfo> = {}
  for (const d in dataBase.devices) {
    if (dataBase.devices[d] && dataBase.devices[d].type == 'can' && dataBase.devices[d].canDevice) {
      dd[d] = dataBase.devices[d].canDevice
    }
  }
  return dd
})
watch(devices, (val) => {
  //check channel
  const action = dataBase.ia[editIndex.value].action as CanInterAction[]
  const list = Object.keys(val)
  for (const a of action) {
    if (!list.includes(a.channel)) {
      a.channel = ''
    }
  }
})
interface Option {
  key: string
  label: string
  disabled: boolean
}

const allDeviceLabel = computed(() => {
  const dd: Option[] = []
  for (const d of Object.keys(devices.value)) {
    dd.push({ key: d, label: devices.value[d].name, disabled: false })
  }
  return dd
})

function editConnect() {
  connectV.value = true
}
const formData = ref<CanInterAction>()
function editFrame() {
  formData.value = cloneDeep(dataBase.ia[editIndex.value].action[popoverIndex.value])
  if (formData.value?.database == undefined) {
    activeName.value = 'raw'
  }
  nextTick(() => {
    editV.value = true
  })
}
function openPr(index: number) {
  if (index != popoverIndex.value) {
    popoverIndex.value = index
    nextTick(() => {
      buttonRef.value[index]?.ref.click()
    })
  }
}

watch(
  formData,
  (v) => {
    v = cloneDeep(v)
    if (v && popoverIndex.value != -1) {
      if (!isEqual(dataBase.ia[editIndex.value].action[popoverIndex.value], v)) {
        Object.assign(dataBase.ia[editIndex.value].action[popoverIndex.value], v)
        if (globalStart.value) {
          window.electron.ipcRenderer.send(
            'ipc-update-can-period',
            `${editIndex.value}-${popoverIndex.value}`,
            v
          )
        }
      }
    }
  },
  {
    deep: true
  }
)

const fh = computed(() => Math.ceil((h.value * 2) / 3) + 'px')

onMounted(async () => {
  // 不再需要从 IPC 获取状态
})

function handleFrameSelect(frame: GraphNode<GraphBindFrameValue>) {
  if (frame.bindValue.frameInfo) {
    const channel = Object.keys(devices.value)[0] || ''
    const frameInfo = frame.bindValue.frameInfo as Message
    let type: 'can' | 'canfd' | 'ecan' | 'ecanfd' = 'can'
    if (frameInfo.is_fd) {
      if (frameInfo.is_extended_frame) {
        type = 'ecanfd'
      } else {
        type = 'canfd'
      }
    } else {
      if (frameInfo.is_extended_frame) {
        type = 'ecan'
      }
    }
    // 创建新的 frame action
    dataBase.ia[editIndex.value].action.push({
      uuid: v4(),
      trigger: {
        type: 'manual'
      },
      database: frame.bindValue.dbKey,
      name: frameInfo.name,
      id: frameInfo.id.toString(16), // 转换为16进制字符串
      channel: channel,
      type: type,
      dlc: getDlcByLen(frameInfo.length, frameInfo.is_fd),
      data: new Array(frameInfo.length).fill('00') // 初始化数据为全0
    })
  }
  selectFrameVisible.value = false
}

function openFrameSelect() {
  selectFrameVisible.value = true
}
</script>
<style lang="scss">
.canit {
  --el-transfer-panel-body-height: 200px;
}

.dataI {
  .el-input-group__prepend {
    padding: 0 5px !important;
  }
}

/* Context Menu (global — Teleport renders it outside component tree) */
.context-menu {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 220px;
  font-size: 13px;
}

.context-menu-item {
  padding: 6px 16px;
  cursor: pointer;
  color: var(--el-text-color-primary);
  transition: background-color 0.15s;
}

.context-menu-item:hover {
  background-color: var(--el-color-primary-light-9);
}

.context-menu-item.disabled {
  color: var(--el-text-color-disabled);
  cursor: not-allowed;
  pointer-events: none;
}

.context-menu-separator {
  height: 1px;
  margin: 4px 0;
  background-color: var(--el-border-color-light);
}

/* Frame data tooltip */
.frame-data-tooltip {
  max-width: 480px !important;
  padding: 6px 8px !important;
}

.tooltip-content {
  font-size: 11px;
  line-height: 1.5;
}

.tp-table {
  border-collapse: collapse;
  width: 100%;
}

.tp-table tr {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.tp-label {
  color: var(--el-text-color-secondary);
  padding: 2px 8px 2px 0;
  white-space: nowrap;
  vertical-align: top;
  text-align: right;
  width: 50px;
}

.tp-value {
  color: var(--el-text-color-primary);
  padding: 2px 0;
  word-break: break-all;
}

.tp-data {
  margin-top: 6px;
  padding: 4px 6px;
  background: var(--el-fill-color-light);
  border-radius: 3px;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 10px;
  line-height: 1.6;
  word-break: break-all;
  color: var(--el-text-color-primary);
}
</style>
<style scoped>
.key-box {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background-color: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  padding: 2rem;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.key-text {
  font-size: 2.25rem;
  font-weight: bold;
  color: #1f2937;
}

.hint-text {
  color: #6b7280;
}

.name-cell {
  cursor: default;
  display: inline-block;
  width: 100%;
}

/* 动画效果 */
.bounce-enter-active {
  animation: bounce-in 0.2s;
}

.bounce-leave-active {
  animation: bounce-in 0.2s reverse;
}

@keyframes bounce-in {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }

  50% {
    transform: scale(1.1);
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
