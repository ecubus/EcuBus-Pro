<template>
  <el-form
    ref="ruleFormRef"
    :model="data"
    label-width="120px"
    size="small"
    class="hardware"
    :rules="rules"
    :disabled="globalStart"
    hide-required-asterisk
  >
    <el-divider content-position="left"> Device </el-divider>
    <el-form-item label="Name" prop="name" required>
      <el-input v-model="data.name" />
    </el-form-item>
    <el-form-item label="Vendor">
      <el-tag>
        {{ props.vendor.toLocaleUpperCase() }}
      </el-tag>
    </el-form-item>
    <el-form-item label="Device" prop="handle" required>
      <el-select v-model="data.handle" :loading="deviceLoading" style="width: 300px">
        <el-option
          v-for="item in deviceList"
          :key="item.handle"
          :label="item.label"
          :value="item.handle"
          :disabled="item.busy"
        >
          <span
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              width: 100%;
              gap: 15px;
            "
          >
            <span>{{ item.label }}</span>
            <span v-if="item.serialNumber" style="color: var(--el-text-color-secondary)">
              #{{ item.serialNumber }}
            </span>
          </span>
        </el-option>
        <template #footer>
          <el-button
            text
            style="float: right; margin-bottom: 10px"
            size="small"
            icon="RefreshRight"
            @click="getDevice(true)"
          >
            Refresh
          </el-button>
        </template>
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="props.vendor == 'toomoss'"
      label="120R Res Enable"
      prop="toomossRes"
      placeholder="Disable"
    >
      <el-select v-model="data.toomossRes" :loading="deviceLoading" style="width: 300px">
        <el-option label="Enable" :value="true" />
        <el-option label="Disable" :value="false" />
      </el-select>
    </el-form-item>
    <el-form-item
      v-else-if="props.vendor == 'zlg'"
      label="120R Res Enable"
      prop="zlgRes"
      placeholder="Disable"
    >
      <el-select v-model="data.zlgRes" :loading="deviceLoading" style="width: 300px">
        <el-option label="Enable" :value="true" />
        <el-option label="Disable" :value="false" />
      </el-select>
    </el-form-item>
    <el-form-item
      v-else-if="props.vendor == 'kvaser'"
      label="Silent Mode"
      prop="silent"
      placeholder="Disable"
    >
      <!-- add tips, silent mode will not send any message -->
      <template #label="{ label }">
        <span class="vm">
          <span style="margin-right: 2px">{{ label }}</span>
          <el-tooltip>
            <template #content>
              Silent mode will not send any message, only receive message
            </template>

            <el-icon>
              <InfoFilled />
            </el-icon>
          </el-tooltip>
        </span>
      </template>
      <el-checkbox v-model="data.silent" />
    </el-form-item>
    <el-divider content-position="left"> Can Parameters </el-divider>

    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="CAN FD Enable" prop="canfd">
          <el-checkbox v-model="data.canfd" @change="canFdChange" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item v-if="vendorConfigLimit.clock" label="Clock Freq (MHz)" prop="bitrate.clock">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  If you can't find the frequency you need, you can input it manually
                </template>

                <el-icon>
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-select
            v-model="data.bitrate.clock"
            size="small"
            allow-create
            filterable
            style="width: 300px"
            @change="clockChange"
          >
            <el-option
              v-for="item in vendorConfigLimit.clock"
              :key="item.clock"
              :label="item.name"
              :value="item.clock"
            />
          </el-select>
        </el-form-item>
      </el-col>
      <!-- <el-col :span="12">
        <el-form-item label="DLC" prop="dlc">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  CAN:0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9-15:8<br>
                  CAN-FD:0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:12,10:16,11:20,12:24,13:32,14:48,15:64
                </template>

                <el-icon>
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input-number :min="8" :max="15" v-model="data.dlc" controls-position="right" />
        </el-form-item>
      </el-col> -->
    </el-form-item>
    <!-- <el-form-item label-width="0">

      <el-col :span="12">
        <el-form-item label="Padding Enable" prop="padding">
          <el-checkbox v-model="data.padding" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Padding Value" prop="paddingValue">
          <el-input v-model="data.paddingValue" :disabled="!data.padding" />
        </el-form-item>
      </el-col>

    </el-form-item> -->
    <el-form-item label-width="0" prop="bitrate">
      <vxe-grid v-bind="gridOptions" style="width: 100%">
        <template #edit_freq="{ row }">
          <el-input v-model.number="row.freq" style="width: 100%" />
        </template>
        <template #default_time="{ row }">
          <el-tooltip effect="light" placement="bottom">
            <template #content> Bit Timing Calculator </template>
            <el-button type="primary" size="small" plain @click="showCalculator(row)">
              <Icon :icon="tableIcon" />
            </el-button>
          </el-tooltip>
        </template>
        <template #default_clock="{ row, rowIndex }">
          <span v-if="rowIndex == 0">{{ row.clock }}</span>
          <span v-else>{{ data.bitrate.clock }}</span>
        </template>
        <template #edit_preScaler="{ row }">
          <el-input-number v-model="row.preScaler" controls-position="right" />
        </template>
        <template #edit_sjw="{ row }">
          <el-input-number v-model="row.sjw" :min="1" controls-position="right" />
        </template>
        <template #edit_timeSeg1="{ row }">
          <el-input-number v-model="row.timeSeg1" controls-position="right" />
        </template>
        <template #edit_timeSeg2="{ row }">
          <el-input-number v-model="row.timeSeg2" controls-position="right" />
        </template>
        <template #edit_zlg="{ row, rowIndex }">
          <el-input v-if="rowIndex == 0" v-model="row.zlgSpec" />
        </template>
        <template #default_baudrate="{ row, rowIndex }">
          <el-tag>{{ getBaudrateSP(row, rowIndex) }}</el-tag>
        </template>
      </vxe-grid>
    </el-form-item>
    <el-divider content-position="left"> Database </el-divider>
    <el-form-item label="Database" prop="database">
      <el-select v-model="data.database" placeholder="No Database" clearable style="width: 300px">
        <el-option
          v-for="item in dbList"
          :key="item.value"
          :label="`CAN.${item.label}`"
          :value="item.value"
        >
        </el-option>
      </el-select>
    </el-form-item>
    <el-divider />
    <el-form-item label-width="0">
      <div style="text-align: left; width: 100%">
        <el-button v-if="editIndex == ''" type="primary" plain @click="onSubmit">
          Add Device
        </el-button>
        <el-button v-else type="warning" plain @click="onSubmit"> Save Device </el-button>
      </div>
    </el-form-item>
  </el-form>
  <BitTimingCalculator
    v-if="calculatorVisible"
    v-model="calculatorVisible"
    :height="height - 100"
    :freq="currentRow?.freq || 0"
    :clock="Number(data.bitrate.clock || 0)"
    :vendor="props.vendor"
    :ability="vendorConfigLimit"
    @result="handleCalculatorResult"
  />
</template>

<script lang="ts" setup>
import {
  Ref,
  computed,
  inject,
  nextTick,
  onBeforeMount,
  onMounted,
  onUnmounted,
  ref,
  toRef,
  watch
} from 'vue'
import { v4 } from 'uuid'
import { CanVendor, CanBaseInfo, CanDevice, CanBitrate } from 'nodeCan/can'
import { type FormRules, type FormInstance, ElMessageBox } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { assign, cloneDeep } from 'lodash'
import { useDataStore } from '@r/stores/data'
import { VxeGridProps, VxeGrid } from 'vxe-table'
import { Icon } from '@iconify/vue'
import tableIcon from '@iconify/icons-mdi/table'
import BitTimingCalculator from '@r/components/BitTimingCalculator.vue'
import { useGlobalStart } from '@r/stores/runtime'

const props = defineProps<{
  index: string
  vendor: CanVendor
  height: number
}>()
const height = toRef(props, 'height')
const ruleFormRef = ref<FormInstance>()

const devices = useDataStore()
const globalStart = useGlobalStart()

const data = ref<CanBaseInfo>({
  id: '',
  name: '',
  handle: '',
  vendor: 'simulate',
  canfd: false,
  database: '',

  bitrate: {
    sjw: 1,
    timeSeg1: 13,
    timeSeg2: 2,
    preScaler: 10,
    freq: 500000,
    clock: '80'
  }
})

const tableList = computed(() => {
  const list = [data.value.bitrate]
  if (data.value.canfd && data.value.bitratefd) {
    list.push(data.value.bitratefd)
  }
  return list
})

const clockChange = (value: string) => {
  //form validate
  ruleFormRef.value?.validateField('bitrate')
  if (data.value.canfd) {
    ruleFormRef.value?.validateField('bitratefd')
  }
}

const configInfo: Record<CanVendor, any> = {
  ecubus: {
    clock: false,
    timeSeg1: false,
    timeSeg2: false,
    sjw: false,
    preScaler: false,
    freq: true,
    zlgSpec: false,
    can: {},
    canFd: {}
  },
  zlg: {
    clock: false,
    timeSeg1: false,
    timeSeg2: false,
    sjw: false,
    preScaler: false,
    freq: true,
    zlgSpec: true,
    can: {},
    canFd: {}
  },
  slcan: {
    clock: false,
    timeSeg1: false,
    timeSeg2: false,
    sjw: false,
    preScaler: false,
    freq: true,
    zlgSpec: false,
    can: {},
    canFd: {}
  },
  peak: {
    clock: true,
    timeSeg1: true,
    timeSeg2: true,
    sjw: true,
    preScaler: true,
    freq: true,
    zlgSpec: false,
    can: {
      clock: [
        { clock: '8', name: '8' },
        { clock: '20', name: '20' },
        { clock: '24', name: '24' },
        { clock: '30', name: '30' },
        { clock: '40', name: '40' },
        { clock: '60', name: '60' },
        { clock: '80', name: '80' }
      ],
      preScaler: {
        min: 1,
        max: 32
      },
      tsg1: {
        min: 2,
        max: 256
      },
      tsg2: {
        min: 1,
        max: 128
      },
      bitrate: {
        sjw: 1,
        timeSeg1: 13,
        timeSeg2: 2,
        preScaler: 10,
        freq: 500000,
        clock: '80'
      }
    },
    canFd: {
      clock: [
        { clock: '20', name: '20' },
        { clock: '24', name: '24' },
        { clock: '30', name: '30' },
        { clock: '40', name: '40' },
        { clock: '60', name: '60' },
        { clock: '80', name: '80' }
      ],
      preScaler: {
        min: 1,
        max: 256
      },
      tsg1: {
        min: 2,
        max: 256
      },
      tsg2: {
        min: 1,
        max: 128
      },
      bitrate: {
        sjw: 1,
        timeSeg1: 13,
        timeSeg2: 2,
        preScaler: 10,
        freq: 500000,
        clock: '80'
      },
      bitratefd: {
        sjw: 1,
        timeSeg1: 7,
        timeSeg2: 2,
        preScaler: 4,
        freq: 2000000,
        clock: '80'
      }
    }
  },
  vector: {
    clock: true,
    timeSeg1: true,
    timeSeg2: true,
    sjw: true,
    preScaler: true,
    freq: true,
    zlgSpec: false,
    can: {
      clock: [{ clock: '16', name: '16' }],
      preScaler: {
        min: 1,
        max: 32
      },
      tsg1: {
        min: 2,
        max: 256
      },
      tsg2: {
        min: 1,
        max: 128
      },
      bitrate: {
        sjw: 1,
        timeSeg1: 13,
        timeSeg2: 2,
        preScaler: 2,
        freq: 500000,
        clock: '16'
      }
    },
    canFd: {
      clock: [{ clock: '80', name: '80' }],
      preScaler: {
        min: 1,
        max: 256
      },
      tsg1: {
        min: 2,
        max: 256
      },
      tsg2: {
        min: 1,
        max: 128
      },
      bitrate: {
        sjw: 1,
        timeSeg1: 13,
        timeSeg2: 2,
        preScaler: 10,
        freq: 500000,
        clock: '80'
      },
      bitratefd: {
        sjw: 1,
        timeSeg1: 7,
        timeSeg2: 2,
        preScaler: 4,
        freq: 2000000,
        clock: '80'
      }
    }
  },
  kvaser: {
    clock: true,
    timeSeg1: true,
    timeSeg2: true,
    sjw: true,
    preScaler: true,
    freq: true,
    zlgSpec: false,
    can: {
      clock: [
        { clock: '16', name: '16' },
        { clock: '20', name: '20' }
      ],
      preScaler: {
        min: 2,
        max: 8
      },
      tsg1: {
        min: 2,
        max: 256
      },
      tsg2: {
        min: 2,
        max: 128
      },
      bitrate: {
        sjw: 1,
        timeSeg1: 13,
        timeSeg2: 2,
        preScaler: 2,
        freq: 500000,
        clock: '16'
      }
    },
    canFd: {
      clock: [{ clock: '80', name: '80' }],
      bitrate: {
        sjw: 1,
        timeSeg1: 13,
        timeSeg2: 2,
        preScaler: 10,
        freq: 500000,
        clock: '80'
      },
      bitratefd: {
        sjw: 1,
        timeSeg1: 7,
        timeSeg2: 2,
        preScaler: 4,
        freq: 2000000,
        clock: '80'
      },
      preScaler: {
        min: 1,
        max: 32
      }
    }
  },
  simulate: {
    clock: false,
    timeSeg1: false,
    timeSeg2: false,
    sjw: false,
    preScaler: false,
    freq: true,
    zlgSpec: false,
    can: {},
    canFd: {}
  },
  toomoss: {
    clock: true,
    timeSeg1: true,
    timeSeg2: true,
    sjw: true,
    preScaler: true,
    freq: true,
    zlgSpec: false,
    can: {
      clock: [
        { clock: '80', name: '80' },
        { clock: '40', name: '40' }
      ],
      preScaler: {
        min: 1,
        max: 256
      },
      bitrate: {
        sjw: 1,
        timeSeg1: 13,
        timeSeg2: 2,
        preScaler: 10,
        freq: 500000,
        clock: '80'
      }
    },
    canFd: {
      clock: [
        { clock: '80', name: '80' },
        { clock: '40', name: '40' }
      ],
      bitrate: {
        sjw: 1,
        timeSeg1: 13,
        timeSeg2: 2,
        preScaler: 10,
        freq: 500000,
        clock: '80'
      },
      bitratefd: {
        sjw: 1,
        timeSeg1: 7,
        timeSeg2: 2,
        preScaler: 4,
        freq: 2000000,
        clock: '80'
      },
      preScaler: {
        min: 1,
        max: 256
      }
    }
  }
}

const vendorConfigLimit = computed(() => {
  return configInfo[props.vendor][data.value.canfd ? 'canFd' : 'can']
})

const gridOptions = computed(() => {
  const v: VxeGridProps<CanBitrate> = {
    border: true,
    size: 'mini',
    minHeight: 30,
    columnConfig: {
      resizable: true
    },
    editConfig: {
      trigger: 'click',
      mode: 'row',
      autoClear: true
    },
    rowClassName: ({ rowIndex }) => {
      if (rowIndex == 0 && error0.value) {
        return 'can-node-error-row'
      }
      if (rowIndex == 1 && error1.value) {
        return 'can-node-error-row'
      }
      return ''
    },
    columns: [
      // {
      //   field: 'clock',
      //   title: 'Clock',
      //   minWidth: 180,
      //   visible: configInfo[props.vendor].clock,
      //   editRender: {},
      //   slots: { edit: 'edit_clock', default: 'default_clock' }
      // },
      {
        field: 'time',

        fixed: 'left',
        width: 60,
        visible: configInfo[props.vendor].time,

        slots: { default: 'default_time' }
      },
      {
        field: 'freq',
        title: 'Frequency (Hz)',
        minWidth: 150,
        fixed: 'left',
        visible: configInfo[props.vendor].freq,
        editRender: {},
        slots: { edit: 'edit_freq' }
      },
      {
        field: 'timeSeg1',
        title: 'TSEG1',
        width: 150,
        visible: configInfo[props.vendor].timeSeg1,
        editRender: {},
        slots: { edit: 'edit_timeSeg1' }
      },
      {
        field: 'timeSeg2',
        title: 'TSEG2',
        width: 150,
        visible: configInfo[props.vendor].timeSeg2,
        editRender: {},
        slots: { edit: 'edit_timeSeg2' }
      },
      {
        field: 'sjw',
        title: 'SJW',
        width: 150,
        visible: configInfo[props.vendor].sjw,
        editRender: {},
        slots: { edit: 'edit_sjw' }
      },
      {
        field: 'preScaler',
        title: 'Pre Scaler',
        width: 150,
        visible: configInfo[props.vendor].preScaler,
        editRender: {},
        slots: { edit: 'edit_preScaler' }
      },
      {
        field: 'zlgSpec',
        title: 'ZLG Spec',
        minWidth: 300,
        visible: configInfo[props.vendor].zlgSpec,
        editRender: {},
        slots: { edit: 'edit_zlg' }
      },
      {
        field: 'baudrate',
        title: 'Baudrate/Sample Point',
        align: 'center',
        fixed: 'right',
        minWidth: 200,
        slots: { default: 'default_baudrate' }
      }
    ],
    data: tableList.value
  }
  return v
})

const dbList = computed(() => {
  const list: { label: string; value: string }[] = []
  for (const key of Object.keys(devices.database.can)) {
    list.push({
      label: devices.database.can[key].name,
      value: key
    })
  }
  return list
})

function canFdChange() {
  nextTick(() => {
    if (vendorConfigLimit.value.clock) {
      //check if clock is in vendorConfigLimit.value.clock,不存在则使用vendorConfigLimit.value.clock[0].clock
      if (!vendorConfigLimit.value.clock.some((item) => item.clock == data.value.bitrate.clock)) {
        data.value.bitrate.clock = vendorConfigLimit.value.clock[0].clock
      }
    }
    if (data.value.canfd) {
      if (!data.value.bitratefd) {
        if (vendorConfigLimit.value.bitratefd) {
          data.value.bitratefd = cloneDeep(vendorConfigLimit.value.bitratefd)
        } else {
          data.value.bitratefd = cloneDeep(data.value.bitrate)
        }
      }
    }
    ruleFormRef.value?.validateField('bitrate')
    if (data.value.canfd) {
      ruleFormRef.value?.validateField('bitratefd')
    }
  })
}

onMounted(() => {
  if (editIndex.value == '' && vendorConfigLimit.value.bitrate) {
    data.value.bitrate = cloneDeep(vendorConfigLimit.value.bitrate)
  }
  // ruleFormRef.value?.validate()
})

//peak baudrate calc
/*
sjw<=tseg2<=tseg1
f_clock=20000000,nom_brp=1,nom_tseg1=14,nom_tseg2=5,nom_sjw=1  sample point = (tseg1+1)/(tseg1+tseg2+1) =15/20
f_clock=20000000,nom_brp=5,nom_tseg1=2,nom_tseg2=1,nom_sjw=1  sample point = (tseg1+1)/(tseg1+tseg2+1) =3/4
f_clock=20000000,nom_brp=1,nom_tseg1=14,nom_tseg2=5,nom_sjw=5  sample point = (tseg1+1)/(tseg1+tseg2+1) =15/20
*/

function getBaudrateSP(speed: CanBitrate, index: number) {
  if (
    props.vendor == 'peak' ||
    props.vendor == 'kvaser' ||
    props.vendor == 'toomoss' ||
    props.vendor == 'vector'
  ) {
    let f_clock = Number(speed.clock || 80) * 1000000
    if (index == 1) {
      f_clock = Number(data.value.bitrate.clock || 80) * 1000000
    }
    const nom_brp = speed.preScaler
    const nom_tseg1 = speed.timeSeg1
    const nom_tseg2 = speed.timeSeg2
    const nom_sjw = speed.sjw
    const sample_point = (nom_tseg1 + 1) / (nom_tseg1 + nom_tseg2 + 1)
    const baudrate = f_clock / (nom_brp * (nom_tseg1 + nom_tseg2 + 1))
    return `${(baudrate / 1000).toFixed(0)}K / ${(sample_point * 100).toFixed(2)}%`
  } else if (props.vendor == 'simulate') {
    return `${speed.freq / 1000}K/ (Don't care)`
  } else if (props.vendor == 'zlg') {
    if (data.value.bitrate.zlgSpec) {
      return `ZLG (check the ZLG Baud Calculator)`
    } else {
      return speed.freq ? `${speed.freq}Hz` : ''
    }
  }

  return ''
}

const deviceList = ref<CanDevice[]>([])
const deviceLoading = ref(false)
function getDevice(visible: boolean) {
  if (visible) {
    deviceLoading.value = true
    window.electron.ipcRenderer
      .invoke('ipc-get-can-devices', props.vendor.toLocaleUpperCase())
      .then((res) => {
        deviceList.value = res
      })
      .finally(() => {
        deviceLoading.value = false
      })
  }
}

const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (const id of Object.keys(devices.devices)) {
      const hasName = devices.devices[id].canDevice?.name
      if (hasName == value && id != editIndex.value) {
        callback(new Error('The name already exists'))
      }
    }
    callback()
  } else {
    callback(new Error('Please input node name'))
  }
}
const error0 = ref(false)
const error1 = ref(false)
const bitrateCheck = (rule: any, value: any, callback: any) => {
  error0.value = false
  error1.value = false
  if (props.vendor == 'peak' || props.vendor == 'kvaser' || props.vendor == 'toomoss') {
    if (data.value.bitrate.clock == undefined) {
      callback(new Error('Please select clock'))
    }
    //must be in clockList
    // if (!clockList.value.some((item) => item.clock == data.value.bitrate.clock)) {
    //   callback(new Error('Please select correct clock'))
    // }
    if (data.value.bitrate.timeSeg1 + 1 < data.value.bitrate.timeSeg2) {
      error0.value = true
      callback(new Error('normal tseg1 must be greater than tseg2-1'))
    }
    if (data.value.bitrate.sjw > data.value.bitrate.timeSeg2) {
      error0.value = true
      callback(new Error('normal sjw must be less than tseg2'))
    }
    //brp from 1-1024
    if (vendorConfigLimit.value.preScaler) {
      if (
        data.value.bitrate.preScaler < vendorConfigLimit.value.preScaler.min ||
        data.value.bitrate.preScaler > vendorConfigLimit.value.preScaler.max
      ) {
        error0.value = true
        callback(
          new Error(
            `normal prescale must be between ${vendorConfigLimit.value.preScaler.min}-${vendorConfigLimit.value.preScaler.max}`
          )
        )
      }
    }

    if (vendorConfigLimit.value.tsg1) {
      if (
        data.value.bitrate.timeSeg1 < vendorConfigLimit.value.tsg1.min ||
        data.value.bitrate.timeSeg1 > vendorConfigLimit.value.tsg1.max
      ) {
        error0.value = true
        callback(
          new Error(
            `normal tseg1 must be between ${vendorConfigLimit.value.tsg1.min}-${vendorConfigLimit.value.tsg1.max}`
          )
        )
      }
    }
    if (vendorConfigLimit.value.tsg2) {
      if (
        data.value.bitrate.timeSeg2 < vendorConfigLimit.value.tsg2.min ||
        data.value.bitrate.timeSeg2 > vendorConfigLimit.value.tsg2.max
      ) {
        error0.value = true
        callback(
          new Error(
            `normal tseg2 must be between ${vendorConfigLimit.value.tsg2.min}-${vendorConfigLimit.value.tsg2.max}`
          )
        )
      }
    }

    if (data.value.canfd && data.value.bitratefd) {
      if (data.value.bitratefd.timeSeg1 + 1 <= data.value.bitratefd.timeSeg2) {
        error1.value = true
        callback(new Error('data tseg1 must be greater than tseg2-1'))
      }
      if (data.value.bitratefd.sjw > data.value.bitratefd.timeSeg2) {
        error1.value = true
        callback(new Error('data sjw must be less than tseg2'))
      }
      if (vendorConfigLimit.value.preScaler) {
        if (
          data.value.bitratefd.preScaler < vendorConfigLimit.value.preScaler.min ||
          data.value.bitratefd.preScaler > vendorConfigLimit.value.preScaler.max
        ) {
          error1.value = true
          callback(
            new Error(
              `data prescale must be between ${vendorConfigLimit.value.preScaler.min}-${vendorConfigLimit.value.preScaler.max}`
            )
          )
        }
      }
      if (vendorConfigLimit.value.tsg1) {
        if (
          data.value.bitratefd.timeSeg1 < vendorConfigLimit.value.tsg1.min ||
          data.value.bitratefd.timeSeg1 > vendorConfigLimit.value.tsg1.max
        ) {
          error1.value = true
          callback(
            new Error(
              `data tseg1 must be between ${vendorConfigLimit.value.tsg1.min}-${vendorConfigLimit.value.tsg1.max}`
            )
          )
        }
      }
      if (vendorConfigLimit.value.tsg2) {
        if (
          data.value.bitratefd.timeSeg2 < vendorConfigLimit.value.tsg2.min ||
          data.value.bitratefd.timeSeg2 > vendorConfigLimit.value.tsg2.max
        ) {
          error1.value = true
          callback(
            new Error(
              `data tseg2 must be between ${vendorConfigLimit.value.tsg2.min}-${vendorConfigLimit.value.tsg2.max}`
            )
          )
        }
      }
    }
    if (props.vendor == 'kvaser' || props.vendor == 'toomoss' || props.vendor == 'peak') {
      const calcFreq =
        (Number(data.value.bitrate.clock || 40) * 1000000) /
        (data.value.bitrate.preScaler *
          (data.value.bitrate.timeSeg1 + data.value.bitrate.timeSeg2 + 1))
      if (calcFreq != data.value.bitrate.freq) {
        error0.value = true
        callback(new Error(`Please input correct frequency, calculated frequency is ${calcFreq}Hz`))
      }
      if (data.value.canfd && data.value.bitratefd) {
        const calcFreq =
          (Number(data.value.bitrate.clock || 40) * 1000000) /
          (data.value.bitratefd.preScaler *
            (data.value.bitratefd.timeSeg1 + data.value.bitratefd.timeSeg2 + 1))
        if (calcFreq != data.value.bitratefd.freq) {
          error1.value = true
          callback(
            new Error(`Please input correct data frequency, calculated frequency is ${calcFreq}Hz`)
          )
        }
      }
    }
  } else if (props.vendor == 'zlg') {
    if (data.value.bitrate.zlgSpec) {
      callback()
    } else {
      if (data.value.bitrate.freq) {
        if (data.value.canfd && data.value.bitratefd) {
          if (data.value.bitratefd.freq) {
            callback()
          } else {
            error1.value = true
            callback(new Error('Please input data frequency'))
          }
        } else {
          callback()
        }
      } else {
        error0.value = true
        callback(new Error('Please input frequency'))
      }
    }
  }
  callback()
}

const rules: FormRules<CanBaseInfo> = {
  name: [{ required: true, trigger: 'blur', validator: nameCheck }],
  handle: [
    {
      required: true,
      message: 'Please select device',
      trigger: 'change'
    }
  ],
  'bitrate.clock': {
    required: configInfo[props.vendor].clock,
    type: 'number',
    message: 'Clock must be a number',
    transform(value: string) {
      return Number(value)
    }
  },
  bitrate: [
    {
      validator: bitrateCheck
    }
  ],
  bitratefd: [
    {
      validator: bitrateCheck
    }
  ]
}

const editIndex = ref(props.index)

const emits = defineEmits(['change'])
const onSubmit = () => {
  ruleFormRef.value?.validate((valid) => {
    if (valid) {
      data.value.vendor = props.vendor
      if (editIndex.value == '') {
        const id = v4()
        data.value.id = id
        devices.devices[id] = {
          type: 'can',
          canDevice: cloneDeep(data.value)
        }
        emits('change', id, data.value.name)
      } else {
        data.value.id = editIndex.value
        devices.devices[editIndex.value].canDevice = cloneDeep(data.value)
        emits('change', editIndex.value, data.value.name)
      }
      dataModify.value = false
    }
  })
}
const dataModify = defineModel({
  default: false
})
let watcher: any

onBeforeMount(() => {
  getDevice(true)
  if (editIndex.value) {
    const editData = devices.devices[editIndex.value]
    if (editData && editData.type == 'can' && editData.canDevice) {
      data.value = cloneDeep(editData.canDevice)
      if (data.value.database && devices.database.can[data.value.database] == undefined) {
        data.value.database = undefined
      }
    } else {
      data.value.name = `${props.vendor.toLocaleUpperCase()}_${Object.keys(devices.devices).length}`
      editIndex.value = ''
    }
  }

  watcher = watch(
    data,
    () => {
      dataModify.value = true
    },
    { deep: true }
  )
})
onUnmounted(() => {
  watcher()
})

const showCalculator = (row: CanBitrate) => {
  calculatorVisible.value = true
  currentRow.value = row
}

const calculatorVisible = ref(false)
const currentRow = ref<CanBitrate | null>(null)

const handleCalculatorResult = (result: any) => {
  if (currentRow.value) {
    const index = tableList.value.indexOf(currentRow.value)

    if (index == 0) {
      data.value.bitrate.timeSeg1 = result.t1
      data.value.bitrate.timeSeg2 = result.t2
      data.value.bitrate.sjw = result.sjw
      data.value.bitrate.preScaler = result.presc
    } else if (index == 1 && data.value.bitratefd) {
      data.value.bitratefd.timeSeg1 = result.t1
      data.value.bitratefd.timeSeg2 = result.t2
      data.value.bitratefd.sjw = result.sjw
      data.value.bitratefd.preScaler = result.presc
    }
    nextTick(() => {
      ruleFormRef.value?.validateField('bitrate')
      if (data.value.canfd && data.value.bitratefd) {
        ruleFormRef.value?.validateField('bitratefd')
      }
    })
  }
}
</script>
<style scoped>
.hardware {
  margin: 20px;
}

.vm {
  display: flex;
  align-items: center;
  /* 垂直居中对齐 */
}
</style>
<style>
.can-node-error-row {
  background-color: var(--el-color-danger-light-3);
}
</style>
