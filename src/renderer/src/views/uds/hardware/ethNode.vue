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
import { EthDevice, EthBaseInfo } from 'nodeCan/doip'
import { CanVendor } from 'nodeCan/can'
import { useGlobalStart } from '@r/stores/runtime'

const ruleFormRef = ref<FormInstance>()
const devices = useDataStore()
const globalStart = useGlobalStart()
const data = ref<EthBaseInfo>({
  device: {
    label: '',
    handle: '',
    id: '',
    detail: undefined
  },
  name: '',
  id: '',
  vendor: 'simulate'
})

const deviceList = ref<EthDevice[]>([])
const deviceLoading = ref(false)
function getDevice(visible: boolean) {
  if (visible) {
    deviceLoading.value = true
    window.electron.ipcRenderer
      .invoke('ipc-get-eth-devices', props.vendor.toLocaleUpperCase())
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
      const hasName = devices.devices[id].ethDevice?.name
      if (hasName == value && id != editIndex.value) {
        callback(new Error('The name already exists'))
      }
    }
    callback()
  } else {
    callback(new Error('Please input node name'))
  }
}

const rules: FormRules<EthBaseInfo> = {
  name: [{ required: true, trigger: 'blur', validator: nameCheck }],
  'device.handle': [
    {
      required: true,
      message: 'Please select device',
      trigger: 'change'
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
      data.value.device.detail = deviceList.value.find(
        (item) => item.handle == data.value.device.handle
      )?.detail
      if (editIndex.value == '') {
        const id = v4()
        data.value.id = id
        devices.devices[id] = {
          type: 'eth',
          ethDevice: cloneDeep(data.value)
        }
        emits('change', id, data.value.name)
      } else {
        data.value.id = editIndex.value

        assign(devices.devices[editIndex.value].ethDevice, data.value)
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
    if (editData && editData.type == 'eth' && editData.ethDevice) {
      data.value = cloneDeep(editData.ethDevice)
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
