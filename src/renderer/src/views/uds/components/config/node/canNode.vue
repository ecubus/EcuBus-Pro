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
        />
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
    <el-divider content-position="left"> Can Parameters </el-divider>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="CAN FD Enable" prop="canfd">
          <el-checkbox v-model="data.canfd" @change="canFdChange" />
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
          <el-input v-model="row.freq" />
        </template>
        <template #edit_clock="{ row, rowIndex }">
          <el-select v-if="rowIndex == 0" v-model="row.clock" size="small">
            <el-option
              v-for="item in clockList"
              :key="item.clock"
              :label="item.name"
              :value="item.clock"
            />
          </el-select>
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
</template>

<script lang="ts" setup>
import {
  Ref,
  computed,
  inject,
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

const ruleFormRef = ref<FormInstance>()
const devices = useDataStore()
const globalStart = toRef(window, 'globalStart')
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

const configInfo: Record<CanVendor, any> = {
  zlg: {
    clock: false,
    timeSeg1: false,
    timeSeg2: false,
    sjw: false,
    preScaler: false,
    freq: true,
    zlgSpec: true
  },
  peak: {
    clock: true,
    timeSeg1: true,
    timeSeg2: true,
    sjw: true,
    preScaler: true,
    freq: false,
    zlgSpec: false
  },
  kvaser: {
    clock: true,
    timeSeg1: true,
    timeSeg2: true,
    sjw: true,
    preScaler: true,
    freq: true,
    zlgSpec: false
  },
  simulate: {
    clock: false,
    timeSeg1: false,
    timeSeg2: false,
    sjw: false,
    preScaler: false,
    freq: false,
    zlgSpec: false
  },
  toomoss: {
    clock: true,
    timeSeg1: true,
    timeSeg2: true,
    sjw: true,
    preScaler: true,
    freq: true,
    zlgSpec: false
  }
}

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
    columns: [
      {
        field: 'clock',
        title: 'Clock',
        minWidth: 180,
        visible: configInfo[props.vendor].clock,
        editRender: {},
        slots: { edit: 'edit_clock', default: 'default_clock' }
      },
      {
        field: 'freq',
        title: 'Frequency',
        minWidth: 180,
        visible: configInfo[props.vendor].freq,
        editRender: {},
        slots: { edit: 'edit_freq' }
      },
      {
        field: 'timeSeg1',
        title: 'TSEG1',
        width: 180,
        visible: configInfo[props.vendor].timeSeg1,
        editRender: {},
        slots: { edit: 'edit_timeSeg1' }
      },
      {
        field: 'timeSeg2',
        title: 'TSEG2',
        width: 180,
        visible: configInfo[props.vendor].timeSeg2,
        editRender: {},
        slots: { edit: 'edit_timeSeg2' }
      },
      {
        field: 'sjw',
        title: 'SJW',
        width: 180,
        visible: configInfo[props.vendor].sjw,
        editRender: {},
        slots: { edit: 'edit_sjw' }
      },
      {
        field: 'preScaler',
        title: 'Pre Scaler',
        width: 180,
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
        minWidth: 250,
        slots: { default: 'default_baudrate' }
      }
    ],
    data: tableList.value
  }
  return v
})
const clockList = computed(() => {
  if (props.vendor == 'peak') {
    return [
      { clock: '8', name: '8' },
      { clock: '20', name: '20' },
      { clock: '24', name: '24' },
      { clock: '30', name: '30' },
      { clock: '40', name: '40' },
      { clock: '60', name: '60' },
      { clock: '80', name: '80' }
    ]
  } else if (props.vendor == 'kvaser') {
    return [
      { clock: '80', name: '80' },
      { clock: '40', name: '40' }
    ]
  } else if (props.vendor == 'toomoss') {
    return [{ clock: '40', name: '40' }]
  }
  return []
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
  if (data.value.canfd) {
    if (!data.value.bitratefd) {
      data.value.bitratefd = {
        sjw: 1,
        timeSeg1: 2,
        timeSeg2: 1,
        preScaler: 1,
        freq: 500000
      }
    }
  }
}

//peak baudrate calc
/*
sjw<=tseg2<=tseg1
f_clock=20000000,nom_brp=1,nom_tseg1=14,nom_tseg2=5,nom_sjw=1  sample point = (tseg1+1)/(tseg1+tseg2+1) =15/20
f_clock=20000000,nom_brp=5,nom_tseg1=2,nom_tseg2=1,nom_sjw=1  sample point = (tseg1+1)/(tseg1+tseg2+1) =3/4
f_clock=20000000,nom_brp=1,nom_tseg1=14,nom_tseg2=5,nom_sjw=5  sample point = (tseg1+1)/(tseg1+tseg2+1) =15/20
*/

function getBaudrateSP(speed: CanBitrate, index: number) {
  if (props.vendor == 'peak' || props.vendor == 'kvaser' || props.vendor == 'toomoss') {
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
    return `SIMULATE (don't care)`
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

const bitrateCheck = (rule: any, value: any, callback: any) => {
  if (props.vendor == 'peak' || props.vendor == 'kvaser' || props.vendor == 'toomoss') {
    if (data.value.bitrate.clock == undefined) {
      callback(new Error('Please select clock'))
    }
    //must be in clockList
    if (!clockList.value.some((item) => item.clock == data.value.bitrate.clock)) {
      callback(new Error('Please select correct clock'))
    }
    if (data.value.bitrate.timeSeg1 + 1 < data.value.bitrate.timeSeg2) {
      callback(new Error('normal tseg1 must be greater than tseg2-1'))
    }
    if (data.value.bitrate.sjw > data.value.bitrate.timeSeg2) {
      callback(new Error('normal sjw must be less than tseg2'))
    }
    //brp from 1-1024
    if (data.value.bitrate.preScaler < 1 || data.value.bitrate.preScaler > 1024) {
      callback(new Error('normal prescale must be between 1-1024'))
    }
    //tseg1 from 1-256
    if (data.value.bitrate.timeSeg1 < 1 || data.value.bitrate.timeSeg1 > 256) {
      callback(new Error('normal tseg1 must be between 1-256'))
    }
    //tseg2 from 1-128
    if (data.value.bitrate.timeSeg2 < 1 || data.value.bitrate.timeSeg2 > 128) {
      callback(new Error('normal tseg2 must be between 1-128'))
    }
    if (data.value.canfd && data.value.bitratefd) {
      if (data.value.bitratefd.timeSeg1 + 1 <= data.value.bitratefd.timeSeg2) {
        callback(new Error('data tseg1 must be greater than tseg2-1'))
      }
      if (data.value.bitratefd.sjw > data.value.bitratefd.timeSeg2) {
        callback(new Error('data sjw must be less than tseg2'))
      }
      //brp from 1-1024
      if (data.value.bitratefd.preScaler < 1 || data.value.bitratefd.preScaler > 1024) {
        callback(new Error('data prescale must be between 1-1024'))
      }
      //tseg1 from 1-32
      if (data.value.bitratefd.timeSeg1 < 1 || data.value.bitratefd.timeSeg1 > 32) {
        callback(new Error('data tseg1 must be between 1-32'))
      }
      //tseg2 from 1-128
      if (data.value.bitratefd.timeSeg2 < 1 || data.value.bitratefd.timeSeg2 > 16) {
        callback(new Error('data tseg2 must be between 1-16'))
      }
    }
    if (props.vendor == 'kvaser' || props.vendor == 'toomoss') {
      const calcFreq =
        (Number(data.value.bitrate.clock || 40) * 1000000) /
        (data.value.bitrate.preScaler *
          (data.value.bitrate.timeSeg1 + data.value.bitrate.timeSeg2 + 1))
      if (calcFreq != data.value.bitrate.freq) {
        callback(new Error(`Please input correct frequency, calculated frequency is ${calcFreq}Hz`))
      }
      if (data.value.canfd && data.value.bitratefd) {
        const calcFreq =
          (Number(data.value.bitrate.clock || 40) * 1000000) /
          (data.value.bitratefd.preScaler *
            (data.value.bitratefd.timeSeg1 + data.value.bitratefd.timeSeg2 + 1))
        if (calcFreq != data.value.bitratefd.freq) {
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
            callback(new Error('Please input data frequency'))
          }
        } else {
          callback()
        }
      } else {
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

const props = defineProps<{
  index: string
  vendor: CanVendor
}>()

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
        assign(devices.devices[editIndex.value].canDevice, data.value)
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
