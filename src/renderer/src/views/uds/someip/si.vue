<template>
  <div style="display: relative">
    <VxeGrid ref="xGrid" v-bind="gridOptions" class="sequenceTable" @cell-click="ceilClick">
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
          :loading="loadingStates[rowIndex]"
          @click="sendFrame(rowIndex)"
        >
          <Icon v-if="!loadingStates[rowIndex]" :icon="sendIcon" />
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
      <template #default_serviceId="{ row }">
        <el-input
          v-model="row.serviceId"
          size="small"
          style="width: 100%"
          @input="idChange('serviceId', $event)"
        />
      </template>
      <template #default_instanceId="{ row }">
        <el-input
          v-model="row.instanceId"
          size="small"
          style="width: 100%"
          @input="idChange('instanceId', $event)"
        />
      </template>
      <template #default_methodId="{ row }">
        <el-input
          v-model="row.methodId"
          size="small"
          style="width: 100%"
          @input="idChange('methodId', $event)"
        />
      </template>
      <template #default_name="{ row }">
        <el-input v-model="row.name" size="small" style="width: 100%" />
      </template>
      <template #default_params="{ row }">
        {{ row.params.length }}
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
            <el-tooltip effect="light" content="Edit Connect" placement="bottom">
              <el-button type="primary" link @click="editConnect">
                <Icon :icon="linkIcon" style="rotate: -45deg; font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip effect="light" content="Add Frame" placement="bottom">
              <el-button link @click="addFrame">
                <Icon :icon="fileOpenOutline" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip effect="light" content="Select Frame from Database" placement="bottom">
              <el-button link disabled @click="openFrameSelect">
                <Icon :icon="databaseIcon" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip effect="light" content="Edit Frame" placement="bottom">
              <el-button link type="success" :disabled="popoverIndex < 0" @click="editFrame">
                <Icon :icon="editIcon" style="font-size: 18px" />
              </el-button>
            </el-tooltip>
            <el-tooltip effect="light" content="Delete Frame" placement="bottom">
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

    <el-popover width="250" :virtual-ref="ppRef" trigger="click" virtual-triggering>
      <el-row v-if="dataBase.ia[editIndex]?.action[popoverIndex]" style="padding: 10px">
        <el-col :span="24">
          <el-radio-group
            v-model="dataBase.ia[editIndex].action[popoverIndex].trigger.type"
            :disabled="periodTimer[popoverIndex]"
          >
            <el-radio value="manual">Manual</el-radio>
            <el-radio value="periodic">Periodic</el-radio>
          </el-radio-group>
        </el-col>

        <el-col :span="12">
          <div>On Key:</div>
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
          <div>Period (ms):</div>
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
      title="IA Device Connect"
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
          :titles="['Valid', 'Assigned ']"
        />
      </div>
    </el-dialog>
    <el-dialog
      v-if="editV && formData"
      v-model="editV"
      :title="`Edit Frame ${dataBase.ia[editIndex].action[popoverIndex].name}`"
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
          <el-form-item label="Name">
            <el-input v-model="formData.name" :disabled="formData.database != undefined" />
          </el-form-item>
          <el-form-item label-width="0">
            <el-col :span="8">
              <el-form-item label="Service ID">
                <el-input v-model="formData.serviceId" @input="idChange('serviceId', $event)" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="Instance ID">
                <el-input v-model="formData.instanceId" @input="idChange('instanceId', $event)" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="Method ID">
                <el-input v-model="formData.methodId" @input="idChange('methodId', $event)" />
              </el-form-item>
            </el-col>
          </el-form-item>

          <el-form-item label="Channel">
            <el-select v-model="formData.channel" size="small" style="width: 100%" clearable>
              <el-option
                v-for="key in dataBase.ia[editIndex].devices"
                :key="key"
                :value="key"
                :label="devices[key]?.name"
              ></el-option>
            </el-select>
          </el-form-item>
        </el-form>
        <el-tabs v-model="activeName">
          <el-tab-pane v-if="formData.database" label="Signal" name="signal">
            <!-- <CanISignal
                :message-id="formData.id"
                :database="formData.database"
                @change="handleDataChange"
              /> -->
          </el-tab-pane>
          <el-tab-pane label="Request" name="req">
            <paramVue
              id="req"
              ref="repParamRef"
              v-model="formData.params"
              :parent-id="editIndex"
              sid=""
              service-id="0x10"
            />
          </el-tab-pane>
          <el-tab-pane label="Response" name="resp">
            <paramVue
              id="resp"
              ref="repParamRef"
              v-model="formData.respParams"
              :parent-id="editIndex"
              sid=""
              service-id="0x10"
            />
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
      title="Select Frame from Database"
      :append-to="`#win${editIndex}_ia`"
      width="600"
      align-center
    >
      <!-- <Signal
        :height="(h * 2) / 3"
        :width="480"
        protocol-filter="can"
        selectable-level="frame"
        :speical-db="speicalDb"
        @add-frame="handleFrameSelect"
      /> -->
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
import { ArrowDown } from '@element-plus/icons-vue'
import { ref, onMounted, onUnmounted, computed, toRef, nextTick, watch } from 'vue'
import paramVue from '../components/config/tester/param.vue'
import { VxeGridProps } from 'vxe-table'
import { VxeGrid } from 'vxe-table'
import { Icon } from '@iconify/vue'
// import CanISignal from './canisignale.vue'
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
import { useDataStore } from '@r/stores/data'
import { cloneDeep, isEqual } from 'lodash'
import { onKeyStroke, onKeyUp } from '@vueuse/core'
// import Signal from './components/signal.vue'
import databaseIcon from '@iconify/icons-material-symbols/database'
import type { GraphBindFrameValue, GraphNode, SomeipAction } from 'src/preload/data'
import { Message } from '@r/database/dbc/dbcVisitor'
import { writeMessageData } from '@r/database/dbc/calc'
import { useGlobalStart, useRuntimeStore } from '@r/stores/runtime'
import { SomeipInfo, SomeipMessageType } from 'nodeCan/someip'
import { ElMessage } from 'element-plus'
import errorParse from '@r/util/ipcError'

const xGrid = ref()
// const logData = ref<LogData[]>([])

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
    for (const [key, value] of Object.entries(runtime.someipPeriods)) {
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
        runtime.setSomeipPeriod(key, true)
      } else {
        runtime.removeSomeipPeriod(key)
      }
    }
  }
})
const selectFrameVisible = ref(false)
const loadingStates = ref<Record<number, boolean>>({})

const props = defineProps<{
  height: number
  editIndex: string
}>()
// const start = toRef(props, 'start')
const h = toRef(props, 'height')
const editIndex = toRef(props, 'editIndex')
const dataBase = useDataStore()
const gridOptions = computed(() => {
  const v: VxeGridProps<SomeipAction> = {
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
      isCurrent: true
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
        if (column.field == 'params') {
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
        width: 50,
        title: '#',
        align: 'center',
        fixed: 'left',
        resizable: false
      },
      {
        field: 'send',
        title: 'Send',
        width: 100,
        resizable: false,
        slots: { default: 'default_send' }
      },
      {
        field: 'trigger',
        title: 'Trigger',
        width: 200,
        resizable: false,
        slots: { default: 'default_trigger' }
      },
      { field: 'name', title: 'Name', width: 100, editRender: {}, slots: { edit: 'default_name' } },
      {
        field: 'serviceId',
        title: 'Service ID',
        minWidth: 100,
        editRender: {},
        slots: { edit: 'default_serviceId' }
      },
      {
        field: 'instanceId',
        title: 'Instance ID',
        minWidth: 100,
        editRender: {},
        slots: { edit: 'default_instanceId' }
      },
      {
        field: 'methodId',
        title: 'Method ID',
        minWidth: 100,
        editRender: {},
        slots: { edit: 'default_methodId' }
      },
      {
        field: 'channel',
        title: 'Channel',
        minWidth: 100,
        editRender: {},
        slots: { default: 'default_channel', edit: 'edit_channel' }
      },

      {
        field: 'params',
        title: 'Params',
        width: 100,
        editRender: {},
        slots: { default: 'default_params' }
      }
    ],
    data:
      dataBase.ia[props.editIndex]?.type == 'someip'
        ? dataBase.ia[props.editIndex]?.action || []
        : []
  }
  return v
})
function addFrame() {
  const channel = Object.keys(devices.value)[0] || ''
  if (dataBase.ia[editIndex.value]?.type == 'someip') {
    dataBase.ia[editIndex.value].action.push({
      trigger: {
        type: 'manual'
      },
      name: '',
      messageType: SomeipMessageType.REQUEST,
      serviceId: '0x1000',
      instanceId: '0x1001',
      methodId: '0x1002',
      channel: channel,
      params: [],
      respParams: []
    })
  }
}
watch(globalStart, (v) => {
  if (v == false) {
    // 当全局停止时，清除所有周期发送状态
    for (const key of Object.keys(runtime.someipPeriods)) {
      if (key.startsWith(editIndex.value + '-')) {
        runtime.removeSomeipPeriod(key)
      }
    }
  }
})

function ceilClick(val: any) {
  popoverIndex.value = val.rowIndex
}
function idChange(type: 'serviceId' | 'instanceId' | 'methodId', v: string) {
  //if last char is not hex, remove it
  if (v.length > 0) {
    if (v[v.length - 1].match(/[0-9a-fA-F]/) == null) {
      dataBase.ia[editIndex.value].action[popoverIndex.value][type] = v.slice(0, -1)
    }
  }
}

function deleteFrame() {
  if (popoverIndex.value >= 0) {
    dataBase.ia[editIndex.value].action.splice(popoverIndex.value, 1)
    popoverIndex.value = -1
    xGrid.value?.clearCurrentRow()
  }
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
async function sendFrame(index: number) {
  const frame = dataBase.ia[editIndex.value]?.action[index]
  if (frame) {
    if (frame.trigger.type == 'manual') {
      try {
        loadingStates.value[index] = true
        await window.electron.ipcRenderer.invoke('ipc-send-someip', cloneDeep(frame))
      } catch (error: any) {
        ElMessage.error({
          message: errorParse(error),
          offset: 30,
          type: 'error',
          appendTo: `#win${editIndex.value}_ia`
        })
      } finally {
        loadingStates.value[index] = false
      }
    } else {
      const key = `${editIndex.value}-${index}`
      if (runtime.someipPeriods[key]) {
        runtime.removeSomeipPeriod(key)
        window.electron.ipcRenderer.send('ipc-stop-someip-period', key)
      } else {
        runtime.setSomeipPeriod(key, true)
        window.electron.ipcRenderer.send('ipc-send-someip-period', key, cloneDeep(frame))
      }
    }
  }
}

const devices = computed(() => {
  const dd: Record<string, SomeipInfo> = {}
  for (const d in dataBase.devices) {
    if (
      dataBase.devices[d] &&
      dataBase.devices[d].type == 'someip' &&
      dataBase.devices[d].someipDevice
    ) {
      dd[d] = dataBase.devices[d].someipDevice
    }
  }
  return dd
})
watch(devices, (val) => {
  //check channel
  const action = dataBase.ia[editIndex.value]?.action as SomeipAction[]
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
const formData = ref<SomeipAction>()
function editFrame() {
  formData.value = cloneDeep(dataBase.ia[editIndex.value].action[popoverIndex.value])
  if (formData.value?.database == undefined) {
    activeName.value = 'req'
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
            'ipc-update-someip-period',
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
