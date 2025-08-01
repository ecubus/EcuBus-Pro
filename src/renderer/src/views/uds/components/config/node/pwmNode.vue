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
    <el-form-item label="Device" prop="device.handle" required>
      <el-select v-model="data.device.handle" :loading="deviceLoading" style="width: 300px">
        <el-option
          v-for="item in deviceList"
          :key="item.handle"
          :label="item.label"
          :value="item.handle"
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

    <el-divider content-position="left"> PWM Parameters </el-divider>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="Frequency (Hz)" prop="freq" required>
          <el-input-number
            v-model="data.freq"
            controls-position="right"
            :min="1"
            :max="20000"
            :step="1"
            style="width: 100%"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Initial Duty (%)" prop="initDuty" required>
          <el-input-number
            v-model="data.initDuty"
            controls-position="right"
            :min="0"
            :max="100"
            :step="0.1"
            :precision="1"
            style="width: 100%"
          />
        </el-form-item>
      </el-col>
    </el-form-item>

    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="Polarity">
          <el-select v-model="data.polarity" style="width: 100%">
            <el-option label="Active High" :value="true" />
            <el-option label="Active Low" :value="false" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <!-- <el-form-item label="Reset Status">
          <el-switch
            v-model="data.resetStatus"
            active-text="Enable"
            inactive-text="Disable"
          />
        </el-form-item> -->
      </el-col>
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
import { type FormRules, type FormInstance, ElMessageBox } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { assign, cloneDeep } from 'lodash'
import { useDataStore } from '@r/stores/data'
import { VxeGridProps, VxeGrid } from 'vxe-table'
import { CanVendor } from 'nodeCan/can'
import type { PwmBaseInfo, PwmDevice } from 'src/main/share/uds'
import { useGlobalStart } from '@r/stores/runtime'

const ruleFormRef = ref<FormInstance>()
const devices = useDataStore()
const globalStart = useGlobalStart()
const props = defineProps<{
  index: string
  vendor: CanVendor
}>()
const data = ref<PwmBaseInfo>({
  device: {
    label: '',
    handle: '',
    id: ''
  },
  name: '',
  id: '',
  vendor: props.vendor,
  freq: 1000,
  initDuty: 50.0,
  polarity: false,
  resetStatus: false
})

const deviceList = ref<PwmDevice[]>([])
const deviceLoading = ref(false)
function getDevice(visible: boolean) {
  if (visible) {
    deviceLoading.value = true
    window.electron.ipcRenderer
      .invoke('ipc-get-pwm-devices', props.vendor)
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
      const hasName = devices.devices[id].pwmDevice?.name
      if (hasName == value && id != editIndex.value) {
        callback(new Error('The name already exists'))
      }
    }
    callback()
  } else {
    callback(new Error('Please input node name'))
  }
}

const rules = computed(() => {
  return {
    name: [{ required: true, trigger: 'blur', validator: nameCheck }],
    'device.handle': [
      {
        required: true,
        message: 'Please select device',
        trigger: 'change'
      }
    ],
    freq: [
      {
        required: true,
        message: 'Please input frequency',
        trigger: 'blur'
      }
    ],
    initDuty: [
      {
        required: true,
        message: 'Please input initial duty cycle',
        trigger: 'blur'
      }
    ]
  }
})

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
          type: 'pwm',
          pwmDevice: cloneDeep(data.value)
        }
        emits('change', id, data.value.name)
      } else {
        data.value.id = editIndex.value

        assign(devices.devices[editIndex.value].pwmDevice, data.value)
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
    if (editData && editData.type == 'pwm' && editData.pwmDevice) {
      data.value = cloneDeep(editData.pwmDevice)
    } else {
      data.value.name = `${props.vendor.toLocaleUpperCase()}_PWM_${Object.keys(devices.devices).length}`
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
