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
    <el-divider content-position="left">Serial Port Device</el-divider>
    <el-form-item label="Name" prop="name" required>
      <el-input v-model="data.name" />
    </el-form-item>
    <el-form-item label="Port" prop="device.handle" required>
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
            <span>{{ item.handle }}</span>
            <span style="color: var(--el-text-color-secondary)">{{ item.label }}</span>
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
    <el-divider content-position="left">Serial Parameters</el-divider>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="Baud Rate" prop="baudRate" required>
          <el-select v-model="data.baudRate" allow-create filterable>
            <el-option label="9600" :value="9600" />
            <el-option label="19200" :value="19200" />
            <el-option label="38400" :value="38400" />
            <el-option label="57600" :value="57600" />
            <el-option label="115200" :value="115200" />
            <el-option label="230400" :value="230400" />
            <el-option label="460800" :value="460800" />
            <el-option label="500000" :value="500000" />
            <el-option label="921600" :value="921600" />
            <el-option label="1000000" :value="1000000" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Data Bits" prop="dataBits">
          <el-select v-model="data.dataBits">
            <el-option label="8" :value="8" />
            <el-option label="7" :value="7" />
            <el-option label="6" :value="6" />
            <el-option label="5" :value="5" />
          </el-select>
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="Stop Bits" prop="stopBits">
          <el-select v-model="data.stopBits">
            <el-option label="1" :value="1" />
            <el-option label="1.5" :value="1.5" />
            <el-option label="2" :value="2" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Parity" prop="parity">
          <el-select v-model="data.parity">
            <el-option label="None" value="none" />
            <el-option label="Even" value="even" />
            <el-option label="Odd" value="odd" />
            <el-option label="Mark" value="mark" />
            <el-option label="Space" value="space" />
          </el-select>
        </el-form-item>
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
import { ref, onBeforeMount } from 'vue'
import { v4 } from 'uuid'
import { type FormRules, type FormInstance } from 'element-plus'
import { assign, cloneDeep } from 'lodash'
import { useDataStore } from '@r/stores/data'
import { useGlobalStart } from '@r/stores/runtime'
import type { SerialBaseInfo, SerialDevice } from 'nodeCan/serial'

const ruleFormRef = ref<FormInstance>()
const devices = useDataStore()
const globalStart = useGlobalStart()
const props = defineProps<{
  index: string
}>()
const emit = defineEmits(['change'])

const data = ref<SerialBaseInfo>({
  device: {
    label: '',
    handle: '',
    id: ''
  },
  name: '',
  id: '',
  vendor: 'serial',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
})

const editIndex = ref('')
const deviceList = ref<SerialDevice[]>([])
const deviceLoading = ref(false)

function getDevice(visible: boolean) {
  if (visible) {
    deviceLoading.value = true
    window.electron.ipcRenderer
      .invoke('ipc-get-serial-devices')
      .then((res: SerialDevice[]) => {
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
      const hasName = devices.devices[id].serialDevice?.name
      if (hasName == value && id != editIndex.value) {
        callback(new Error('Device name already exists'))
      }
    }
    callback()
  } else {
    callback(new Error('Please enter a device name'))
  }
}

const rules: FormRules = {
  name: [{ validator: nameCheck, trigger: 'blur' }],
  'device.handle': [{ required: true, message: 'Please select a port', trigger: 'change' }],
  baudRate: [{ required: true, message: 'Please select baud rate', trigger: 'change' }]
}

async function onSubmit() {
  if (!ruleFormRef.value) return
  await ruleFormRef.value.validate((valid) => {
    if (valid) {
      const id = editIndex.value || v4()
      const deviceData = cloneDeep(data.value)
      deviceData.id = id
      deviceData.device.label = deviceData.device.handle
      deviceData.device.id = deviceData.device.handle
      deviceData.baudRate = Number(deviceData.baudRate)

      if (editIndex.value == '') {
        devices.devices[id] = {
          type: 'serial',
          serialDevice: deviceData
        }
      } else {
        devices.devices[id].serialDevice = deviceData
      }
      emit('change', id, deviceData.name)
    }
  })
}

const dataModify = defineModel<boolean>({ default: false })

function updateFromStore() {
  const device = devices.devices[props.index]
  if (device?.serialDevice) {
    assign(data.value, cloneDeep(device.serialDevice))
    editIndex.value = props.index
    getDevice(true)
  } else {
    editIndex.value = ''
    getDevice(true)
  }
}

defineExpose({
  save: async () => {
    if (!ruleFormRef.value) return false
    return new Promise<boolean>((resolve) => {
      ruleFormRef.value!.validate((valid) => {
        if (valid) {
          onSubmit()
          resolve(true)
        } else {
          resolve(false)
        }
      })
    })
  }
})

onBeforeMount(() => {
  updateFromStore()
})
</script>

<style scoped>
.hardware {
  padding: 20px;
  min-width: 500px;
}
</style>
