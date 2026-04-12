<template>
  <div class="someip-layout">
    <div class="table-wrap">
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
        <template #default_messageType="{ row }">
          <span v-if="row.someipOp === 'subscribe'">Subscribe</span>
          <span v-else-if="row.someipOp === 'unsubscribe'">Unsubscribe</span>
          <span v-else>{{ SomeipMessageTypeMap[row.messageType] }}</span>
        </template>
        <template #default_someipOp="{ row }">
          {{ someipOpLabel(row.someipOp) }}
        </template>
        <template #edit_someipOp="{ row }">
          <el-select
            :model-value="row.someipOp ?? 'send'"
            size="small"
            style="width: 100%"
            @update:model-value="(v) => (row.someipOp = v as SomeipAction['someipOp'])"
          >
            <el-option value="send" label="Send" />
            <el-option value="subscribe" label="Subscribe" />
            <el-option value="unsubscribe" label="Unsubscribe" />
          </el-select>
        </template>
        <template #default_eventGroupId="{ row }">
          {{ row.someipOp !== 'send' ? row.eventGroupId || '—' : '—' }}
        </template>
        <template #edit_eventGroupId="{ row }">
          <el-input
            v-if="row.someipOp !== 'send'"
            v-model="row.eventGroupId"
            size="small"
            style="width: 100%"
            @input="idChange('eventGroupId', $event)"
          />
          <span v-else>—</span>
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
                :content="i18next.t('uds.someip.si.tooltips.editConnect')"
                placement="bottom"
              >
                <el-button type="primary" link @click="editConnect">
                  <Icon :icon="linkIcon" style="rotate: -45deg; font-size: 18px" />
                </el-button>
              </el-tooltip>
              <el-tooltip
                effect="light"
                :content="i18next.t('uds.someip.si.tooltips.addFrame')"
                placement="bottom"
              >
                <el-button link @click="addFrame">
                  <Icon :icon="fileOpenOutline" style="font-size: 18px" />
                </el-button>
              </el-tooltip>
              <el-tooltip
                effect="light"
                :content="i18next.t('uds.someip.si.tooltips.selectFrameFromDatabase')"
                placement="bottom"
              >
                <el-button link disabled @click="openFrameSelect">
                  <Icon :icon="databaseIcon" style="font-size: 18px" />
                </el-button>
              </el-tooltip>
              <el-tooltip
                effect="light"
                :content="i18next.t('uds.someip.si.tooltips.editFrame')"
                placement="bottom"
              >
                <el-button link type="success" :disabled="popoverIndex < 0" @click="editFrame">
                  <Icon :icon="editIcon" style="font-size: 18px" />
                </el-button>
              </el-tooltip>
              <el-tooltip
                effect="light"
                :content="i18next.t('uds.someip.si.tooltips.deleteFrame')"
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
              <el-tooltip effect="light" content="Clear log" placement="bottom">
                <el-button link type="danger" @click="clearLog">
                  <Icon :icon="circlePlusFilled" style="font-size: 18px" />
                </el-button>
              </el-tooltip>
            </el-button-group>
          </div>
        </template>
      </VxeGrid>
    </div>
    <div ref="logContainer" class="log-wrap">
      <div ref="terminalContainer" class="terminal-container"></div>
    </div>

    <el-popover width="250" :virtual-ref="ppRef" trigger="click" virtual-triggering>
      <el-row v-if="dataBase.ia[editIndex]?.action[popoverIndex]" style="padding: 10px">
        <el-col :span="24">
          <el-radio-group
            v-model="dataBase.ia[editIndex].action[popoverIndex].trigger.type"
            :disabled="periodTimer[popoverIndex]"
          >
            <el-radio value="manual">{{
              i18next.t('uds.someip.si.options.triggerType.manual')
            }}</el-radio>
            <el-radio value="periodic">{{
              i18next.t('uds.someip.si.options.triggerType.periodic')
            }}</el-radio>
          </el-radio-group>
        </el-col>

        <el-col :span="12">
          <div>{{ i18next.t('uds.someip.si.labels.onKey') }}</div>
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
          <div>{{ i18next.t('uds.someip.si.labels.period') }}</div>
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
              :placeholder="i18next.t('uds.someip.si.placeholders.period')"
            ></el-input-number>
          </div>
        </el-col>
      </el-row>
    </el-popover>
    <el-dialog
      v-if="connectV"
      v-model="connectV"
      :title="i18next.t('uds.someip.si.dialogs.deviceConnect')"
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
            i18next.t('uds.someip.si.transfer.valid'),
            i18next.t('uds.someip.si.transfer.assigned')
          ]"
        />
      </div>
    </el-dialog>
    <el-dialog
      v-if="editV && formData"
      v-model="editV"
      :title="
        i18next.t('uds.someip.si.dialogs.editFrame', {
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
          label-width="120"
          size="small"
          class="formH"
          :disabled="periodTimer[popoverIndex] == true"
        >
          <el-form-item :label="i18next.t('uds.someip.si.labels.name')">
            <el-input v-model="formData.name" :disabled="formData.database != undefined" />
          </el-form-item>
          <el-form-item label-width="0">
            <el-col :span="8">
              <el-form-item :label="i18next.t('uds.someip.si.labels.serviceId')">
                <el-input v-model="formData.serviceId" @input="idChange('serviceId', $event)" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item :label="i18next.t('uds.someip.si.labels.instanceId')">
                <el-input v-model="formData.instanceId" @input="idChange('instanceId', $event)" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item :label="i18next.t('uds.someip.si.labels.methodId')">
                <el-input v-model="formData.methodId" @input="idChange('methodId', $event)" />
              </el-form-item>
            </el-col>
          </el-form-item>
          <el-form-item label-width="0">
            <el-col :span="8">
              <el-form-item label="Operation">
                <el-select v-model="formData.someipOp" @change="onSomeipOpFormChange">
                  <el-option value="send" label="Send message" />
                  <el-option value="subscribe" label="Subscribe (receive events)" />
                  <el-option value="unsubscribe" label="Unsubscribe" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item :label="i18next.t('uds.someip.si.labels.messageType')">
                <el-select v-model="formData.messageType" :disabled="formData.someipOp !== 'send'">
                  <el-option
                    :value="SomeipMessageType.REQUEST"
                    :label="i18next.t('uds.someip.si.options.messageType.request')"
                  />
                  <el-option
                    :value="SomeipMessageType.REQUEST_NO_RETURN"
                    :label="i18next.t('uds.someip.si.options.messageType.requestNoReturn')"
                  />
                  <el-option
                    :value="SomeipMessageType.NOTIFICATION"
                    label="Notification (server notify)"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item :label="i18next.t('uds.someip.si.labels.protocolVersion')">
                <el-input
                  v-model="formData.protocolVersion"
                  :placeholder="i18next.t('uds.someip.si.placeholders.protocolVersion')"
                />
              </el-form-item>
            </el-col>
          </el-form-item>
          <el-form-item label-width="0">
            <el-col :span="8">
              <el-form-item :label="i18next.t('uds.someip.si.labels.interfaceVersion')">
                <el-input
                  v-model="formData.interfaceVersion"
                  :placeholder="i18next.t('uds.someip.si.placeholders.interfaceVersion')"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="formData.someipOp !== 'send'" :span="8">
              <el-form-item label="Event group ID">
                <el-input
                  v-model="formData.eventGroupId"
                  @input="idChange('eventGroupId', $event)"
                />
              </el-form-item>
            </el-col>
            <el-col v-if="formData.someipOp === 'subscribe'" :span="8">
              <el-form-item label="Event type (request_event)">
                <el-select v-model.number="formData.someipEventType" style="width: 100%">
                  <el-option :value="VsomeipEventType.ET_EVENT" label="ET_EVENT" />
                  <el-option
                    :value="VsomeipEventType.ET_SELECTIVE_EVENT"
                    label="ET_SELECTIVE_EVENT"
                  />
                  <el-option :value="VsomeipEventType.ET_FIELD" label="ET_FIELD" />
                  <el-option :value="VsomeipEventType.ET_UNKNOWN" label="ET_UNKNOWN" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-form-item>
          <el-form-item label-width="0">
            <el-col :span="8">
              <el-form-item :label="i18next.t('uds.someip.si.labels.majorVersion')">
                <el-input
                  v-model="formData.major"
                  :placeholder="i18next.t('uds.someip.si.placeholders.majorVersion')"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item :label="i18next.t('uds.someip.si.labels.minorVersion')">
                <el-input
                  v-model="formData.minor"
                  :placeholder="i18next.t('uds.someip.si.placeholders.minorVersion')"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item
                v-if="
                  (formData.someipOp === 'send' &&
                    formData.messageType == SomeipMessageType.REQUEST) ||
                  formData.someipOp === 'subscribe' ||
                  formData.someipOp === 'unsubscribe'
                "
                :label="
                  formData.someipOp !== 'send' ? 'Subscribe timeout (ms)' : 'Response Timeout(ms)'
                "
              >
                <el-input
                  v-model.number="formData.responseTimeout"
                  placeholder="1000"
                  type="number"
                  min="1"
                />
              </el-form-item>
            </el-col>
          </el-form-item>
          <el-form-item label-width="0">
            <el-col :span="8">
              <el-form-item :label="i18next.t('uds.someip.si.labels.channel')">
                <el-select v-model="formData.channel" size="small" style="width: 100%" clearable>
                  <el-option
                    v-for="key in dataBase.ia[editIndex].devices"
                    :key="key"
                    :value="key"
                    :label="devices[key]?.name"
                  ></el-option>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item :label="i18next.t('uds.someip.si.labels.reliable')">
                <el-select
                  v-model="formData.reliable"
                  :placeholder="i18next.t('uds.someip.si.placeholders.reliable')"
                >
                  <el-option
                    :value="true"
                    :label="i18next.t('uds.someip.si.options.boolean.true')"
                  />
                  <el-option
                    :value="false"
                    :label="i18next.t('uds.someip.si.options.boolean.false')"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8"> </el-col>
          </el-form-item>
        </el-form>
        <el-tabs v-model="activeName">
          <el-tab-pane
            v-if="formData.database"
            :label="i18next.t('uds.someip.si.tabs.signal')"
            name="signal"
          >
            <!-- <CanISignal
                :message-id="formData.id"
                :database="formData.database"
                @change="handleDataChange"
              /> -->
          </el-tab-pane>
          <el-tab-pane :label="i18next.t('uds.someip.si.tabs.request')" name="req">
            <paramVue
              id="req"
              ref="repParamRef"
              v-model="formData.params"
              :parent-id="editIndex"
              sid=""
              service-id="Job"
            />
          </el-tab-pane>
          <el-tab-pane
            v-if="formData.messageType == SomeipMessageType.REQUEST"
            :label="i18next.t('uds.someip.si.tabs.response')"
            name="resp"
          >
            <paramVue
              id="resp"
              ref="repParamRef"
              v-model="formData.respParams"
              :parent-id="editIndex"
              sid=""
              service-id="Job"
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
      :title="i18next.t('uds.someip.si.dialogs.selectFrameFromDatabase')"
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
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import paramVue from '../tester/param.vue'
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

import { writeMessageData } from '@r/database/dbc/calc'
import { useGlobalStart, useRuntimeStore } from '@r/stores/runtime'
import { SomeipInfo, SomeipMessageType, VsomeipEventType } from 'nodeCan/someip'
import { ElNotification } from 'element-plus'
import errorParse from '@r/util/ipcError'
import { SomeipMessageTypeMap } from 'nodeCan/someip'
import i18next from 'i18next'
import { useDark } from '@vueuse/core'

const xGrid = ref()
// const logData = ref<LogData[]>([])
const terminalContainer = ref<HTMLElement>()
const logContainer = ref<HTMLElement>()
const isDark = useDark()
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
const logBuffer: string[] = []

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
    height: Math.max(240, Math.floor(props.height * 0.66)),
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
        if (column.field == 'messageType') {
          return false
        }
        if (column.field == 'eventGroupId' && row.someipOp === 'send') {
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
        title: i18next.t('uds.someip.si.columns.send'),
        width: 100,
        resizable: false,
        slots: { default: 'default_send' }
      },
      {
        field: 'trigger',
        title: i18next.t('uds.someip.si.columns.trigger'),
        width: 200,
        resizable: false,
        slots: { default: 'default_trigger' }
      },
      {
        field: 'name',
        title: i18next.t('uds.someip.si.columns.name'),
        width: 100,
        editRender: {},
        slots: { edit: 'default_name' }
      },
      {
        field: 'messageType',
        title: i18next.t('uds.someip.si.columns.messageType'),
        width: 120,
        editRender: {},
        slots: { default: 'default_messageType' }
      },
      {
        field: 'someipOp',
        title: 'Op',
        width: 110,
        editRender: {},
        slots: { default: 'default_someipOp', edit: 'edit_someipOp' }
      },
      {
        field: 'eventGroupId',
        title: 'Evt grp',
        minWidth: 90,
        editRender: {},
        slots: { default: 'default_eventGroupId', edit: 'edit_eventGroupId' }
      },
      {
        field: 'serviceId',
        title: i18next.t('uds.someip.si.columns.serviceId'),
        minWidth: 100,
        editRender: {},
        slots: { edit: 'default_serviceId' }
      },
      {
        field: 'instanceId',
        title: i18next.t('uds.someip.si.columns.instanceId'),
        minWidth: 100,
        editRender: {},
        slots: { edit: 'default_instanceId' }
      },
      {
        field: 'methodId',
        title: i18next.t('uds.someip.si.columns.methodId'),
        minWidth: 100,
        editRender: {},
        slots: { edit: 'default_methodId' }
      },
      {
        field: 'channel',
        title: i18next.t('uds.someip.si.columns.channel'),
        minWidth: 100,
        editRender: {},
        slots: { default: 'default_channel', edit: 'edit_channel' }
      },

      {
        field: 'params',
        title: i18next.t('uds.someip.si.columns.params'),
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
      someipOp: 'send',
      eventGroupId: '0x0001',
      someipEventType: VsomeipEventType.ET_FIELD,
      messageType: SomeipMessageType.REQUEST,
      serviceId: '0x1000',
      instanceId: '0x1001',
      methodId: '0x1002',
      channel: channel,
      params: [],
      respParams: [],
      responseTimeout: 1000
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
    //clear loadingStates
    loadingStates.value = {}
  }
})

function ceilClick(val: any) {
  popoverIndex.value = val.rowIndex
}
function idChange(type: 'serviceId' | 'instanceId' | 'methodId' | 'eventGroupId', v: string) {
  //if last char is not hex, remove it
  if (v.length > 0) {
    if (v[v.length - 1].match(/[0-9a-fA-F]/) == null) {
      dataBase.ia[editIndex.value].action[popoverIndex.value][type] = v.slice(0, -1)
    }
  }
}

function someipOpLabel(op: SomeipAction['someipOp']) {
  if (op === 'subscribe') return 'Subscribe'
  if (op === 'unsubscribe') return 'Unsub'
  return 'Send'
}

function onSomeipOpFormChange() {
  const fd = formData.value
  if (!fd) return
  if (fd.someipOp !== 'send' && (fd.eventGroupId == null || fd.eventGroupId === '')) {
    fd.eventGroupId = '0x0001'
  }
  if (
    fd.someipOp === 'subscribe' &&
    (fd.someipEventType == null || fd.someipEventType === undefined)
  ) {
    fd.someipEventType = VsomeipEventType.ET_FIELD
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
    const op = frame.someipOp ?? 'send'
    if (op !== 'send' && frame.trigger.type === 'periodic') {
      ElNotification.warning({
        message: 'Subscribe / Unsubscribe only supports manual trigger.'
      })
      return
    }
    if (frame.trigger.type == 'manual') {
      try {
        loadingStates.value[index] = true
        if (op === 'subscribe' || op === 'unsubscribe') {
          await window.electron.ipcRenderer.invoke('ipc-send-someip', cloneDeep(frame))
          writeToTerminal(
            'info',
            `${op === 'subscribe' ? 'Subscribed' : 'Unsubscribed'} — ${frame.name || `${frame.serviceId} / ${frame.instanceId} / evt ${frame.methodId}`}`
          )
        } else {
          const resp = await window.electron.ipcRenderer.invoke('ipc-send-someip', cloneDeep(frame))
          if (frame.messageType === SomeipMessageType.REQUEST) {
            writeToTerminal('response', formatResponse(frame, resp))
          } else if (frame.messageType === SomeipMessageType.NOTIFICATION) {
            writeToTerminal('info', formatNotifySent(frame))
          }
        }
      } catch (error: any) {
        writeToTerminal('error', `${frame.name || frame.methodId}: ${errorParse(error)}`)
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
  if (formData.value && formData.value.someipOp == null) {
    formData.value.someipOp = 'send'
  }
  if (
    formData.value &&
    (formData.value.eventGroupId == null || formData.value.eventGroupId === '')
  ) {
    formData.value.eventGroupId = '0x0001'
  }
  if (formData.value && formData.value.someipEventType == null) {
    formData.value.someipEventType = VsomeipEventType.ET_FIELD
  }
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
const terminalTheme = computed(() => {
  if (isDark.value) {
    return { background: '#1e1e1e', foreground: '#d4d4d4', cursor: 'transparent' }
  }
  return { background: '#ffffff', foreground: '#333333', cursor: 'transparent' }
})

onMounted(async () => {
  window.electron.ipcRenderer.on('someip-incoming-notification', onSomeipIncomingNotification)
  terminal = new Terminal({
    theme: terminalTheme.value,
    fontSize: 12,
    fontFamily: 'Consolas, "Courier New", monospace',
    cursorBlink: false,
    disableStdin: true,
    convertEol: true
  })
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  if (terminalContainer.value) {
    terminal.open(terminalContainer.value)
    fitAddon.fit()
  }
})
watch(isDark, () => {
  if (terminal) {
    terminal.options.theme = terminalTheme.value
  }
})
onUnmounted(() => {
  window.electron.ipcRenderer.removeListener(
    'someip-incoming-notification',
    onSomeipIncomingNotification
  )
  terminal?.dispose()
  terminal = null
  fitAddon = null
})

function openFrameSelect() {
  selectFrameVisible.value = true
}
function clearLog() {
  terminal?.clear()
  logBuffer.length = 0
}
function writeToTerminal(level: 'response' | 'error' | 'info', message: string) {
  const time = new Date().toLocaleTimeString()
  const color = level === 'error' ? '\x1b[31m' : level === 'info' ? '\x1b[32m' : '\x1b[36m'
  const tag = level.toUpperCase()
  terminal?.writeln(`${color}[${time}] [${tag}]\x1b[0m ${message}`)
  logBuffer.push(`[${time}] [${level}] ${message}`)
}

function onSomeipIncomingNotification(
  _e: unknown,
  data: {
    deviceKey: string
    service: number
    instance: number
    method: number
    messageType: number
    returnCode: number
    payload: number[]
  }
) {
  const devs = dataBase.ia[editIndex.value]?.devices
  if (!devs?.includes(data.deviceKey)) return
  const triplet = `0x${data.service.toString(16)} / 0x${data.instance.toString(16)} / 0x${data.method.toString(16)}`
  const hex = data.payload?.length
    ? data.payload
        .map((v) => Number(v).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    : ''
  writeToTerminal('info', `NOTIFICATION ${triplet} rc=${data.returnCode} payload=${hex}`)
}
function formatResponse(frame: SomeipAction, resp: any) {
  const name = frame.name || `${frame.serviceId}.${frame.instanceId}.${frame.methodId}`
  if (!resp) return `${name} empty response`
  const payload = payloadToHex(resp.payload)
  return `${name} type=${resp.messageType} rc=${resp.returnCode} payload=${payload}`
}
function formatNotifySent(frame: SomeipAction) {
  const name = frame.name || `${frame.serviceId}.${frame.instanceId}.${frame.methodId}`
  return `${name} notification sent`
}
function payloadToHex(payload: any) {
  if (!payload) return ''
  if (Array.isArray(payload)) {
    return payload
      .map((v) => Number(v).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  }
  if (payload.type === 'Buffer' && Array.isArray(payload.data)) {
    return payload.data
      .map((v: number) => Number(v).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  }
  return String(payload)
}
watch(globalStart, (val) => {
  if (val) {
    clearLog()
  }
})
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
.someip-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.table-wrap {
  height: 66.6667%;
}
.log-wrap {
  height: 33.3333%;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  overflow: hidden;
}
.log-toolbar {
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.terminal-container {
  height: 100%;
  width: 100%;
}
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
