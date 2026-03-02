<template>
  <div>
    <VxeGrid ref="xGrid" v-bind="gridOptions" class="signalTable">
      <!-- <template #default_generator_control="{ row }">
                <el-button-group>
                    <el-button link size="small" :type="row.generatorType ? 'success' : 'default'"
                        @click="toggleGenerator(row)">
                        <Icon :icon="row.generatorType ? 'material-symbols:stop' : 'material-symbols:play-arrow'" />
                    </el-button>
                    <el-button link size="small" @click="editGenerator(row)">
                        <Icon icon="material-symbols:edit" />
                    </el-button>
                </el-button-group>
            </template> -->
      <template #default_raw_control="{ row }">
        <div class="value-control">
          <el-input
            v-model="row.value"
            size="small"
            :min="0"
            :max="getMaxRawValue(row.bit_length)"
            @change="handleRawValueChange(row)"
          />
        </div>
      </template>
      <template #default_phys_value="{ row }">
        <template v-if="getSignalValues(row).length">
          <el-select
            v-model="row.physValue"
            size="small"
            style="width: 100%"
            @change="handlePhysValueChange(row, dataStore.database.can[props.database])"
          >
            <el-option
              v-for="(item, idx) in getSignalValues(row)"
              :key="idx"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </template>

        <template v-else>
          <el-input
            v-model="row.physValue"
            :min="row.min !== row.max ? Number(row.min) : undefined"
            :max="row.max !== row.min ? Number(row.max) : undefined"
            style="width: 100%"
            size="small"
            controls-position="right"
            @change="handlePhysValueChange(row, dataStore.database.can[props.database])"
          />
        </template>
      </template>
      <template #default_name="{ row }">
        <div class="name-cell">
          <span>{{ row.name }}</span>
          <el-button
            link
            size="small"
            type="primary"
            class="copy-button"
            @click="copySignalName(row.name)"
          >
            <Icon :icon="copyIcon" />
          </el-button>
        </div>
      </template>
    </VxeGrid>

    <!-- <el-dialog
      v-model="editDialogVisible"
      :title="i18next.t('uds.network.canisignale.dialogs.editSignalGenerator')"
      width="400px"
    >
      <el-form v-if="currentSignal" :model="currentSignal" label-width="100px" size="small">
        <el-form-item :label="i18next.t('uds.network.canisignale.labels.generatorType')">
          <el-select v-model="currentSignal.generatorType" style="width: 100%">
            <el-option :label="i18next.t('uds.network.canisignale.options.none')" value="" />
            <el-option :label="i18next.t('uds.network.canisignale.options.sine')" value="sine" />
            <el-option
              :label="i18next.t('uds.network.canisignale.options.counter')"
              value="counter"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </el-dialog> -->
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { VxeGridProps } from 'vxe-table'
import { VxeGrid } from 'vxe-table'
import { Icon } from '@iconify/vue'
import { CanDB, Message, Signal } from 'nodeCan/can'
import { useDataStore } from '@r/stores/data'
import {
  getMessageData,
  getMaxRawValue,
  getActiveSignals,
  rawToPhys,
  updateSignalPhys,
  updateSignalRaw
} from '@r/database/dbc/calc'
import copyIcon from '@iconify/icons-material-symbols/content-copy-outline'
import { cloneDeep } from 'lodash'
import { useGlobalStart } from '@r/stores/runtime'
import i18next from 'i18next'
const props = defineProps<{
  database: string
  messageId: string
}>()

const dataStore = useDataStore()
const editDialogVisible = ref(false)
const currentSignal = ref<Signal | null>(null)

const message = computed<Message | undefined>(() => {
  const db = dataStore.database.can[props.database]
  if (db) {
    const msgId = parseInt(props.messageId, 16)
    return db.messages?.find((m) => m.id === msgId)
  }
  return undefined
})
// Get signals data from store
const signals = computed(() => {
  return message.value ? getActiveSignals(message.value) : []
})

// Signal.values is Record<string, string> (raw->label); convert for el-select. physValue uses label.
function getSignalValues(signal: Signal): { label: string; value: string }[] {
  const v = signal.values
  if (!v || typeof v !== 'object') return []
  return Object.entries(v).map(([k, val]) => ({ label: val, value: val }))
}

const gridOptions = computed<VxeGridProps<Signal>>(() => {
  return {
    border: true,
    size: 'mini',
    height: 250,
    columnConfig: {
      resizable: true
    },
    showOverflow: true,
    editConfig: {
      trigger: 'click',
      mode: 'cell',
      showIcon: false
    },
    scrollY: {
      enabled: true,
      gt: 0,
      mode: 'wheel'
    },
    columns: [
      {
        field: 'name',
        title: i18next.t('uds.network.canisignale.table.name'),
        width: 300,
        minWidth: 100,
        slots: {
          default: 'default_name'
        }
      },
      // {
      //     field: 'generatorControl',
      //     title: 'Generator',
      //     width: 100,
      //     slots: { default: 'default_generator_control' }
      // },

      {
        field: 'value',
        title: i18next.t('uds.network.canisignale.table.rawValue'),
        width: 150,
        resizable: false,
        slots: { default: 'default_raw_control' }
      },

      {
        field: 'physValue',
        title: i18next.t('uds.network.canisignale.table.physValue'),
        minWidth: 150,
        resizable: false,
        slots: { default: 'default_phys_value' }
      },

      {
        field: 'unit',
        title: i18next.t('uds.network.canisignale.table.unit'),
        width: 80,
        align: 'center'
      },
      {
        field: 'start_bit',
        title: i18next.t('uds.network.canisignale.table.startBit'),
        width: 120,
        align: 'center',
        sortable: true
      },
      {
        field: 'bit_length',
        title: i18next.t('uds.network.canisignale.table.length'),
        width: 100,
        align: 'center',
        sortable: true
      }
    ],
    data: signals.value
  }
})

function editGenerator(row: Signal) {
  currentSignal.value = row
  editDialogVisible.value = true
}

const globalStart = useGlobalStart()
// Raw value change handler
function handleRawValueChange(row: Signal) {
  updateSignalRaw(row)
  if (message.value) {
    if (globalStart.value) {
      window.electron.ipcRenderer.send(
        'ipc-update-can-signal',
        props.database,
        parseInt(props.messageId, 16),
        row.name,
        cloneDeep(row)
      )
    }

    emits('change', getMessageData(message.value))
  }
}

// Physical value change handler
function handlePhysValueChange(row: Signal, db: CanDB) {
  updateSignalPhys(row, db)
  if (message.value) {
    if (globalStart.value) {
      window.electron.ipcRenderer.send(
        'ipc-update-can-signal',
        props.database,
        parseInt(props.messageId, 16),
        row.name,
        cloneDeep(row)
      )
    }
    emits('change', getMessageData(message.value))
  }
}

const emits = defineEmits<{
  change: [Buffer]
}>()

// Initialize signal values
function initializeSignal(signal: Signal) {
  if (signal.value === undefined) {
    signal.value = signal.initial_value
  }
  updateSignalRaw(signal)
}

onMounted(() => {
  // Initialize all signals (signals is array)
  if (message.value) {
    ;(message.value.signals || []).forEach((signal) => {
      initializeSignal(signal)
    })
    emits('change', getMessageData(message.value))
  }
})

//

const xGrid = ref()

// 添加复制函数
function copySignalName(name: string) {
  navigator.clipboard.writeText(name)
}
</script>

<style scoped>
.signalTable {
  margin: 10px;
}

.value-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 5px;
}

.arrows {
  display: flex;
  flex-direction: column;
  margin-left: 5px;
}

.arrows .el-button {
  padding: 0;
  height: 12px;
}

.name-cell {
  position: relative;
  padding-right: 24px; /* 为复制按钮留出空间 */
}

.copy-button {
  position: absolute;
  right: 0px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.2s;
}

.name-cell:hover .copy-button {
  opacity: 1;
}
</style>
