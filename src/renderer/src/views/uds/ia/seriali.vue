<template>
  <div style="display: relative" @click="hideContextMenu" @contextmenu.prevent="onContextMenu">
    <VxeGrid ref="xGrid" v-bind="gridOptions" class="sequenceTable" @cell-click="ceilClick">
      <template #default_trigger="{ row, rowIndex }">
        <span class="lr">
          <span
            >{{ row.trigger.type.toUpperCase() }}
            <span v-if="row.trigger.type == 'manual' && row.trigger.onKey" style="padding: 0 5px"
              >({{ row.trigger.onKey }})</span
            >
            <span v-if="row.trigger.type == 'periodic'" style="padding: 0 5px"
              >({{ row.trigger.period || 500 }}ms)</span
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
      <template #default_name="{ row }">
        <span class="name-cell">{{ row.name || '--' }}</span>
      </template>
      <template #edit_name="{ row }">
        <el-input v-model="row.name" size="small" style="width: 100%" />
      </template>
      <template #default_data="{ row }">
        <span class="data-cell">{{ formatData(row.data) || '--' }}</span>
      </template>
      <template #edit_data="{ row }">
        <el-input
          :model-value="getDataDraft(row)"
          size="small"
          class="hex-input"
          placeholder="00 00 07 AA 08 03 22 F1 90 CC CC CC CC"
          @update:model-value="(value: string) => setDataDraft(row, value)"
          @change="applyDataDraft(row)"
          @blur="applyDataDraft(row)"
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
            <el-tooltip
              effect="light"
              :content="i18next.t('uds.network.seriali.tooltips.editConnect')"
              placement="bottom"
            >
              <el-button type="primary" link @click="editConnect">
                <Icon :icon="linkIcon" style="rotate: -45deg; font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip
              effect="light"
              :content="i18next.t('uds.network.seriali.tooltips.addFrame')"
              placement="bottom"
            >
              <el-button link @click="addFrame">
                <Icon :icon="fileOpenOutline" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip
              effect="light"
              :content="i18next.t('uds.network.seriali.tooltips.deleteFrame')"
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
          {{ i18next.t('uds.network.seriali.contextMenu.addFrame') }}
        </div>
        <div class="context-menu-separator"></div>
        <div
          class="context-menu-item"
          :class="{ disabled: popoverIndex < 0 }"
          @click="(copyFrame(), hideContextMenu())"
        >
          {{ i18next.t('uds.network.seriali.contextMenu.copy') }}
        </div>
        <div
          class="context-menu-item"
          :class="{ disabled: !copiedFrame }"
          @click="(pasteFrame(), hideContextMenu())"
        >
          {{ i18next.t('uds.network.seriali.contextMenu.paste') }}
        </div>
        <div class="context-menu-separator"></div>
        <div
          class="context-menu-item"
          :class="{ disabled: popoverIndex < 0 || periodTimer[popoverIndex] == true }"
          @click="(deleteFrame(), hideContextMenu())"
        >
          {{ i18next.t('uds.network.seriali.contextMenu.deleteFrame') }}
        </div>
        <div class="context-menu-item" @click="(deleteAllFrames(), hideContextMenu())">
          {{ i18next.t('uds.network.seriali.contextMenu.deleteAllFrames') }}
        </div>
      </div>
    </Teleport>

    <el-popover width="250" :virtual-ref="ppRef" trigger="click" virtual-triggering>
      <el-row v-if="dataBase.ia[editIndex]?.action[popoverIndex]" style="padding: 10px">
        <el-col :span="24">
          <el-radio-group
            v-model="dataBase.ia[editIndex].action[popoverIndex].trigger.type"
            :disabled="periodTimer[popoverIndex]"
          >
            <el-radio value="manual">{{
              i18next.t('uds.network.seriali.triggerTypes.manual')
            }}</el-radio>
            <el-radio value="periodic">{{
              i18next.t('uds.network.seriali.triggerTypes.periodic')
            }}</el-radio>
          </el-radio-group>
        </el-col>

        <el-col :span="12">
          <div>{{ i18next.t('uds.network.seriali.labels.onKey') }}</div>
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
          <div>{{ i18next.t('uds.network.seriali.labels.period') }}</div>
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
              placeholder="500"
            ></el-input-number>
          </div>
        </el-col>
      </el-row>
    </el-popover>
    <el-dialog
      v-if="connectV"
      v-model="connectV"
      :title="i18next.t('uds.network.seriali.dialogs.iaDeviceConnect')"
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
            i18next.t('uds.network.seriali.transfer.valid'),
            i18next.t('uds.network.seriali.transfer.assigned')
          ]"
        />
      </div>
    </el-dialog>
    <Transition name="bounce">
      <div v-if="animate" class="key-box">
        <span class="key-text">{{ pressedKey }}</span>
      </div>
    </Transition>
  </div>
</template>
<script lang="ts" setup>
import { ArrowDown } from '@element-plus/icons-vue'
import { ref, computed, toRef, nextTick, watch } from 'vue'
import { VxeGridProps } from 'vxe-table'
import { VxeGrid } from 'vxe-table'
import { Icon } from '@iconify/vue'
import fileOpenOutline from '@iconify/icons-material-symbols/file-open-outline'
import linkIcon from '@iconify/icons-material-symbols/add-link'
import sendIcon from '@iconify/icons-material-symbols/send'
import stopIcon from '@iconify/icons-material-symbols/stop'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import { ElMessage } from 'element-plus'
import { useDataStore } from '@r/stores/data'
import { cloneDeep } from 'lodash'
import { onKeyStroke, onKeyUp } from '@vueuse/core'
import { useGlobalStart, useRuntimeStore } from '@r/stores/runtime'
import { v4 } from 'uuid'
import i18next from 'i18next'
import type { SerialAction } from 'src/preload/data'

const xGrid = ref()
const connectV = ref(false)
const buttonRef = ref({})
const popoverIndex = ref(-1)
const ppRef = computed(() => buttonRef.value[popoverIndex.value])
const globalStart = useGlobalStart()
const runtime = useRuntimeStore()
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const copiedFrame = ref<SerialAction | null>(null)
const props = defineProps<{
  height: number
  editIndex: string
}>()
const editIndex = toRef(props, 'editIndex')
const dataBase = useDataStore()

function periodKey(row: SerialAction) {
  return `${editIndex.value}-${row.uuid}`
}
const periodTimer = computed(() => {
  const result: Record<number, boolean> = {}
  const actions = (dataBase.ia[editIndex.value]?.action || []) as SerialAction[]
  actions.forEach((row, index) => {
    result[index] = runtime.serialPeriods[periodKey(row)] == true
  })
  return result
})

function formatData(data: string[]) {
  return data.map((b) => (b || '00').padStart(2, '0').toUpperCase()).join(' ')
}

const dataDrafts = ref<Record<string, string>>({})

function parseHexInput(value: string): string[] | undefined {
  const text = value.trim()
  if (!text) return []
  const compact = text.replace(/0x/gi, '').replace(/[\s,;_-]/g, '')
  if (!compact || compact.length % 2 != 0 || /[^0-9a-f]/i.test(compact)) {
    return undefined
  }
  const result: string[] = []
  for (let i = 0; i < compact.length; i += 2) {
    result.push(compact.slice(i, i + 2).toUpperCase())
  }
  return result
}

function getDataDraft(row: SerialAction) {
  return dataDrafts.value[row.uuid] ?? formatData(row.data)
}

function setDataDraft(row: SerialAction, value: string) {
  dataDrafts.value[row.uuid] = value
}

function applyDataDraft(row: SerialAction) {
  const draft = dataDrafts.value[row.uuid]
  if (draft == undefined) return
  const parsed = parseHexInput(draft)
  if (!parsed) {
    ElMessage.warning(i18next.t('uds.network.seriali.messages.invalidHex'))
  } else {
    row.data = parsed
  }
  delete dataDrafts.value[row.uuid]
}

const gridOptions = computed(() => {
  const v: VxeGridProps<SerialAction> = {
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
      beforeEditMethod({ rowIndex }) {
        if (periodTimer.value[rowIndex] == true) {
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
        title: i18next.t('uds.network.seriali.table.send'),
        minWidth: 80,
        resizable: false,
        slots: { default: 'default_send' }
      },
      {
        field: 'trigger',
        title: i18next.t('uds.network.seriali.table.trigger'),
        minWidth: 140,
        resizable: false,
        slots: { default: 'default_trigger' }
      },
      {
        field: 'name',
        title: i18next.t('uds.network.seriali.table.name'),
        minWidth: 80,
        editRender: {},
        slots: { default: 'default_name', edit: 'edit_name' }
      },
      {
        field: 'channel',
        title: i18next.t('uds.network.seriali.table.channel'),
        minWidth: 100,
        editRender: {},
        slots: { default: 'default_channel', edit: 'edit_channel' }
      },
      {
        field: 'data',
        title: i18next.t('uds.network.seriali.table.data'),
        minWidth: 200,
        editRender: {},
        slots: { default: 'default_data', edit: 'edit_data' }
      }
    ],
    data:
      dataBase.ia[props.editIndex].type == 'serial'
        ? (dataBase.ia[props.editIndex]?.action as SerialAction[]) || []
        : []
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
    channel: channel,
    data: []
  })
}
watch(globalStart, (v) => {
  if (v == false) {
    // 当全局停止时，清除所有周期发送状态
    for (const key of Object.keys(runtime.serialPeriods)) {
      if (key.startsWith(editIndex.value + '-')) {
        runtime.removeSerialPeriod(key)
      }
    }
  }
})
function ceilClick(val: any) {
  popoverIndex.value = val.rowIndex
}

function deleteFrame() {
  if (popoverIndex.value >= 0) {
    const deletedIndex = popoverIndex.value
    const row = dataBase.ia[editIndex.value].action[deletedIndex] as SerialAction
    if (row) {
      delete dataDrafts.value[row.uuid]
    }
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
  const actions = (dataBase.ia[editIndex.value].action || []) as SerialAction[]
  if (actions.length > 0) {
    // Clear all periodic sends first
    for (const row of actions) {
      const key = periodKey(row)
      if (runtime.serialPeriods[key]) {
        runtime.removeSerialPeriod(key)
        window.electron.ipcRenderer.send('ipc-stop-serial-period', key)
      }
      delete dataDrafts.value[row.uuid]
    }
    actions.length = 0
    popoverIndex.value = -1
    xGrid.value?.clearCurrentRow()
  }
}

function copyFrame() {
  if (popoverIndex.value >= 0) {
    const frame = dataBase.ia[editIndex.value].action[popoverIndex.value] as SerialAction
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
  if ((e.ctrlKey || e.metaKey) && !connectV.value) {
    e.preventDefault()
    copyFrame()
  }
})
onKeyStroke(['v', 'V'], (e) => {
  if ((e.ctrlKey || e.metaKey) && !connectV.value) {
    e.preventDefault()
    pasteFrame()
  }
})

// Arrow Up/Down: navigate between frame rows
onKeyStroke('ArrowUp', (e) => {
  if (!connectV.value) {
    const actions = dataBase.ia[editIndex.value].action
    if (actions.length > 0 && popoverIndex.value > 0) {
      e.preventDefault()
      popoverIndex.value--
      xGrid.value?.setCurrentRow(actions[popoverIndex.value])
    }
  }
})
onKeyStroke('ArrowDown', (e) => {
  if (!connectV.value) {
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
  if (!connectV.value) {
    if (popoverIndex.value >= 0 && !periodTimer.value[popoverIndex.value]) {
      e.preventDefault()
      deleteFrame()
    }
  }
})

function sendFrame(index: number) {
  const frame = dataBase.ia[editIndex.value]?.action[index] as SerialAction | undefined
  if (frame) {
    const key = periodKey(frame)
    if (frame.trigger.type != 'manual' && runtime.serialPeriods[key]) {
      runtime.removeSerialPeriod(key)
      window.electron.ipcRenderer.send('ipc-stop-serial-period', key)
      return
    }
    if (!frame.channel) {
      ElMessage.warning(i18next.t('uds.network.seriali.messages.selectChannel'))
      return
    }
    if (frame.data.length == 0) {
      ElMessage.warning(i18next.t('uds.network.seriali.messages.emptyData'))
      return
    }
    if (frame.trigger.type == 'manual') {
      window.electron.ipcRenderer.invoke('ipc-send-serial', cloneDeep(frame)).catch((e: any) => {
        ElMessage.error(ipcErrorText(e))
      })
    } else {
      runtime.setSerialPeriod(key, true)
      window.electron.ipcRenderer
        .invoke('ipc-send-serial-period', key, cloneDeep(frame))
        .catch((e: any) => {
          runtime.removeSerialPeriod(key)
          ElMessage.error(ipcErrorText(e))
        })
    }
  }
}

function ipcErrorText(e: any): string {
  const msg = e?.message || String(e)
  // Electron invoke wraps errors as "Error invoking remote method 'x': Error: <msg>"
  const idx = msg.lastIndexOf('Error: ')
  return idx >= 0 ? msg.slice(idx + 'Error: '.length) : msg
}

const devices = computed(() => {
  const dd: Record<string, { name: string }> = {}
  for (const d in dataBase.devices) {
    const device = dataBase.devices[d]
    if (!device) {
      continue
    }
    if (device.type == 'serial' && device.serialDevice) {
      dd[d] = device.serialDevice
    } else if (device.type == 'can' && device.canDevice && device.canDevice.vendor == 'uartcan') {
      // UDS over UART devices accept raw bytes too, see ipc-send-serial
      dd[d] = device.canDevice
    }
  }
  return dd
})
watch(devices, (val) => {
  //check channel
  const action = dataBase.ia[editIndex.value].action as SerialAction[]
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
function openPr(index: number) {
  if (index != popoverIndex.value) {
    popoverIndex.value = index
    nextTick(() => {
      buttonRef.value[index]?.ref.click()
    })
  }
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

.name-cell {
  cursor: default;
  display: inline-block;
  width: 100%;
}

.data-cell {
  cursor: default;
  display: inline-block;
  width: 100%;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
}

.hex-input :deep(.el-input__inner) {
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
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
