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
    <el-divider content-position="left">
      {{ i18next.t('uds.hardware.serialNode.sections.device') }}
    </el-divider>
    <el-form-item :label="i18next.t('uds.hardware.serialNode.labels.name')" prop="name" required>
      <el-input v-model="data.name" />
    </el-form-item>
    <el-form-item :label="i18next.t('uds.hardware.serialNode.labels.vendor')">
      <el-tag>
        {{ props.vendor.toLocaleUpperCase() }}
      </el-tag>
    </el-form-item>
    <el-form-item
      :label="i18next.t('uds.hardware.serialNode.labels.port')"
      prop="device.handle"
      required
    >
      <el-select
        v-model="data.device.handle"
        :loading="deviceLoading"
        style="width: 300px"
        @change="onPortChange"
      >
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
            {{ i18next.t('uds.hardware.serialNode.labels.refresh') }}
          </el-button>
        </template>
      </el-select>
    </el-form-item>

    <el-divider content-position="left">
      {{ i18next.t('uds.hardware.serialNode.sections.serialParameters') }}
    </el-divider>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.hardware.serialNode.labels.baudRate')"
          prop="baudRate"
          required
        >
          <el-select
            v-model="data.baudRate"
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          >
            <el-option v-for="b in baudList" :key="b" :label="b.toString()" :value="b" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.hardware.serialNode.labels.dataBits')">
          <el-select v-model="data.dataBits" style="width: 100%">
            <el-option v-for="d in [8, 7, 6, 5]" :key="d" :label="d.toString()" :value="d" />
          </el-select>
        </el-form-item>
      </el-col>
    </el-form-item>

    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.hardware.serialNode.labels.stopBits')">
          <el-select v-model="data.stopBits" style="width: 100%">
            <el-option v-for="s in [1, 1.5, 2]" :key="s" :label="s.toString()" :value="s" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.hardware.serialNode.labels.parity')">
          <el-select v-model="data.parity" style="width: 100%">
            <el-option
              v-for="p in ['none', 'even', 'odd', 'mark', 'space']"
              :key="p"
              :label="p"
              :value="p"
            />
          </el-select>
        </el-form-item>
      </el-col>
    </el-form-item>

    <el-divider />
    <el-form-item label-width="0">
      <div style="text-align: left; width: 100%">
        <el-button v-if="editIndex == ''" type="primary" plain @click="onSubmit">
          {{ i18next.t('uds.hardware.serialNode.buttons.addDevice') }}
        </el-button>
        <el-button v-else type="warning" plain @click="onSubmit">
          {{ i18next.t('uds.hardware.serialNode.buttons.saveDevice') }}
        </el-button>
      </div>
    </el-form-item>
  </el-form>
</template>

<script lang="ts" setup>
import { computed, onBeforeMount, onUnmounted, ref, watch } from 'vue'
import { v4 } from 'uuid'
import { type FormInstance } from 'element-plus'
import { assign, cloneDeep } from 'lodash'
import { useDataStore } from '@r/stores/data'
import { CanVendor } from 'nodeCan/can'
import type { SerialBaseInfo, SerialDevice } from 'src/main/share/serial'
import { useGlobalStart } from '@r/stores/runtime'
import i18next from 'i18next'

const ruleFormRef = ref<FormInstance>()
const devices = useDataStore()
const globalStart = useGlobalStart()
const props = defineProps<{
  index: string
  vendor: CanVendor
}>()

const baudList = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 500000, 921600, 1000000]

const data = ref<SerialBaseInfo>({
  device: {
    label: '',
    handle: '',
    id: ''
  },
  name: '',
  id: '',
  vendor: props.vendor,
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
})

const deviceList = ref<SerialDevice[]>([])
const deviceLoading = ref(false)
function getDevice(visible: boolean) {
  if (visible) {
    deviceLoading.value = true
    window.electron.ipcRenderer
      .invoke('ipc-get-serial-devices')
      .then((res) => {
        deviceList.value = res
      })
      .finally(() => {
        deviceLoading.value = false
      })
  }
}

function onPortChange(handle: string) {
  const found = deviceList.value.find((d) => d.handle == handle)
  if (found) {
    data.value.device = cloneDeep(found)
  } else {
    data.value.device = { label: handle, handle, id: handle }
  }
}

const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (const id of Object.keys(devices.devices)) {
      const hasName = devices.devices[id].serialDevice?.name
      if (hasName == value && id != editIndex.value) {
        callback(new Error(i18next.t('uds.hardware.serialNode.validation.nameExists')))
        return
      }
    }
    callback()
  } else {
    callback(new Error(i18next.t('uds.hardware.serialNode.validation.inputNodeName')))
  }
}

const baudRateCheck = (rule: any, value: any, callback: any) => {
  const n = Number(value)
  if (value === '' || value === null || value === undefined || Number.isNaN(n) || n <= 0) {
    callback(new Error(i18next.t('uds.hardware.serialNode.validation.inputBaudRate')))
    return
  }
  callback()
}

const rules = computed(() => {
  return {
    name: [{ required: true, trigger: 'blur', validator: nameCheck }],
    'device.handle': [
      {
        required: true,
        message: i18next.t('uds.hardware.serialNode.validation.selectPort'),
        trigger: 'change'
      }
    ],
    baudRate: [{ required: true, trigger: ['blur', 'change'], validator: baudRateCheck }]
  }
})

const editIndex = ref(props.index)

const emits = defineEmits(['change'])

function persist(): string {
  // baudRate may come back as a string from allow-create select
  data.value.baudRate = Number(data.value.baudRate)
  data.value.vendor = props.vendor
  if (editIndex.value == '') {
    const id = v4()
    data.value.id = id
    devices.devices[id] = {
      type: 'serial',
      serialDevice: cloneDeep(data.value)
    }
    emits('change', id, data.value.name)
    return id
  } else {
    data.value.id = editIndex.value
    assign(devices.devices[editIndex.value].serialDevice, data.value)
    emits('change', editIndex.value, data.value.name)
    return editIndex.value
  }
}

const onSubmit = () => {
  ruleFormRef.value?.validate((valid) => {
    if (valid) {
      persist()
      dataModify.value = false
    }
  })
}

// Expose save method for parent component to call
function save() {
  return new Promise<boolean>((resolve) => {
    ruleFormRef.value?.validate((valid) => {
      if (valid) {
        persist()
        dataModify.value = false
        resolve(true)
      } else {
        resolve(false)
      }
    })
  })
}
defineExpose({ save })
const dataModify = defineModel({
  default: false
})
let watcher: any

onBeforeMount(() => {
  getDevice(true)
  if (editIndex.value) {
    const editData = devices.devices[editIndex.value]
    if (editData && editData.type == 'serial' && editData.serialDevice) {
      data.value = cloneDeep(editData.serialDevice)
    } else {
      data.value.name = `${props.vendor.toLocaleUpperCase()}_Serial_${Object.keys(devices.devices).length}`
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
}
</style>
