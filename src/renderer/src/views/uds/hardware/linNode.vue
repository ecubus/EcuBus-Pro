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
      {{ i18next.t('uds.hardware.linNode.sections.device') }}
    </el-divider>
    <el-form-item :label="i18next.t('uds.hardware.linNode.labels.name')" prop="name" required>
      <el-input v-model="data.name" />
    </el-form-item>
    <el-form-item :label="i18next.t('uds.hardware.linNode.labels.vendor')">
      <el-tag>
        {{ props.vendor.toLocaleUpperCase() }}
      </el-tag>
    </el-form-item>
    <el-form-item
      :label="i18next.t('uds.hardware.linNode.labels.device')"
      prop="device.handle"
      required
    >
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
            {{ i18next.t('uds.hardware.linNode.labels.refresh') }}
          </el-button>
        </template>
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="props.vendor == 'toomoss'"
      :label="i18next.t('uds.hardware.linNode.labels.voltageControl')"
      prop="device.toomossVolt"
    >
      <el-select
        v-model="data.device.toomossVolt"
        :loading="deviceLoading"
        :placeholder="i18next.t('uds.hardware.linNode.options.input12v')"
        style="width: 300px"
      >
        <el-option :label="i18next.t('uds.hardware.linNode.options.output0v')" :value="0" />
        <el-option :label="i18next.t('uds.hardware.linNode.options.output12v')" :value="1" />
        <el-option :label="i18next.t('uds.hardware.linNode.options.output5v')" :value="2" />
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="props.vendor == 'ecubus'"
      :label="i18next.t('uds.hardware.linNode.labels.powerEnable')"
      prop="device.lincablePowerEnable"
    >
      <el-switch v-model="data.device.lincablePowerEnable" />
    </el-form-item>
    <el-divider content-position="left">
      {{ i18next.t('uds.hardware.linNode.sections.linParameters') }}
    </el-divider>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.hardware.linNode.labels.linMode')"
          prop="mode"
          required
        >
          <el-select v-model="data.mode" @change="clearDatabase">
            <el-option :label="i18next.t('uds.hardware.linNode.options.master')" value="MASTER" />
            <el-option :label="i18next.t('uds.hardware.linNode.options.slave')" value="SLAVE" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.hardware.linNode.labels.baudRate')" prop="baudRate">
          <el-select v-model="data.baudRate" required>
            <el-option
              :label="i18next.t('uds.hardware.linNode.options.baudRate9600')"
              :value="9600"
            />
            <el-option
              :label="i18next.t('uds.hardware.linNode.options.baudRate19200')"
              :value="19200"
            />
            <el-option
              :label="i18next.t('uds.hardware.linNode.options.custom')"
              :value="0"
              :disabled="props.vendor != 'ecubus'"
            />
          </el-select>
        </el-form-item>
      </el-col>
    </el-form-item>
    <template v-if="data.baudRate == 0">
      <el-form-item label-width="0">
        <el-col :span="12">
          <el-form-item
            :label="i18next.t('uds.hardware.linNode.labels.majorPrescale')"
            prop="device.lincableCustomBaudRatePrescale"
          >
            <el-select v-model="data.device.lincableCustomBaudRatePrescale">
              <el-option label="/2" :value="0" />
              <el-option label="/4" :value="1" />
              <el-option label="/8" :value="2" />
              <el-option label="/16" :value="3" />
              <el-option label="/32" :value="4" />
              <el-option label="/64" :value="5" />
              <el-option label="/128" :value="6" />
              <el-option label="/256" :value="7" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item
            :label="i18next.t('uds.hardware.linNode.labels.minorPrescale')"
            prop="device.lincableCustomBaudRateBitMap"
          >
            <el-input-number
              v-model="data.device.lincableCustomBaudRateBitMap"
              :min="0"
              :max="32"
              :step="1"
              controls-position="right"
            >
            </el-input-number>
          </el-form-item>
        </el-col>
      </el-form-item>

      <el-form-item :label="i18next.t('uds.hardware.linNode.labels.baudRateDisplay')">
        <el-alert :type="calculatedType" :closable="false">{{ calculatedBaudRate }}</el-alert>
      </el-form-item>
    </template>
    <el-divider content-position="left">
      {{ i18next.t('uds.hardware.linNode.sections.database') }}
    </el-divider>
    <el-form-item :label="i18next.t('uds.hardware.linNode.labels.database')" prop="database">
      <el-select
        v-model="data.database"
        :placeholder="i18next.t('uds.hardware.linNode.options.noDatabase')"
        clearable
        style="width: 300px"
        @change="clearDatabase"
      >
        <el-option
          v-for="item in dbList"
          :key="item.value"
          :label="`LIN.${item.label}`"
          :value="item.value"
        >
        </el-option>
      </el-select>
    </el-form-item>

    <el-divider />
    <el-form-item label-width="0">
      <div style="text-align: left; width: 100%">
        <el-button v-if="editIndex == ''" type="primary" plain @click="onSubmit">
          {{ i18next.t('uds.hardware.linNode.buttons.addDevice') }}
        </el-button>
        <el-button v-else type="warning" plain @click="onSubmit">
          {{ i18next.t('uds.hardware.linNode.buttons.saveDevice') }}
        </el-button>
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
import { LinBaseInfo, LinDevice, LinMode } from 'nodeCan/lin'
import { useGlobalStart } from '@r/stores/runtime'
import i18next from 'i18next'

const ruleFormRef = ref<FormInstance>()
const devices = useDataStore()
const globalStart = useGlobalStart()
const props = defineProps<{
  index: string
  vendor: CanVendor
}>()
const data = ref<LinBaseInfo>({
  device: {
    label: '',
    handle: '',
    id: ''
  },
  name: '',
  id: '',
  vendor: props.vendor,
  baudRate: 19200,
  mode: LinMode.MASTER
})

const dbList = computed(() => {
  const list: { label: string; value: string }[] = []
  for (const key of Object.keys(devices.database.lin)) {
    list.push({
      label: devices.database.lin[key].name,
      value: key
    })
  }
  return list
})

const filteredNodesName = computed(() => {
  const list: { label: string; value: string }[] = []
  if (data.value.database) {
    const db = devices.database.lin[data.value.database]
    if (data.value.mode === 'MASTER') {
      list.push({
        label: `${db.node.master.nodeName} (Master)`,
        value: db.node.master.nodeName
      })
    } else {
      // For SLAVE mode, only show slave nodes
      for (const n of db.node.salveNode) {
        list.push({
          label: `${n} (Slave)`,
          value: n
        })
      }
    }
  }
  return list
})

function clearDatabase() {
  // data.value.workNode = '';
}

const deviceList = ref<LinDevice[]>([])
const deviceLoading = ref(false)
function getDevice(visible: boolean) {
  if (visible) {
    deviceLoading.value = true
    window.electron.ipcRenderer
      .invoke('ipc-get-lin-devices', props.vendor.toLocaleUpperCase())
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
      const hasName = devices.devices[id].linDevice?.name
      if (hasName == value && id != editIndex.value) {
        callback(new Error(i18next.t('uds.hardware.linNode.validation.nameExists')))
      }
    }
    callback()
  } else {
    callback(new Error(i18next.t('uds.hardware.linNode.validation.inputNodeName')))
  }
}
const calculatedBaudRate = ref('')
const calculatedType = ref('primary')
const baudRateCheck = (rule: any, value: any, callback: any) => {
  if (data.value.baudRate == 0) {
    const majorPrescale = Math.pow(2, (data.value.device.lincableCustomBaudRatePrescale || 1) + 1)
    const minorPrescale = data.value.device.lincableCustomBaudRateBitMap || 1
    const baudRate = 5_500_000 / (majorPrescale * minorPrescale)
    calculatedBaudRate.value = `${baudRate.toFixed(1)}`
    if (baudRate > 20000 && baudRate <= 50000) {
      calculatedBaudRate.value = `${baudRate.toFixed(1)} ${i18next.t('uds.hardware.linNode.messages.baudRateWarning')}`
      calculatedType.value = 'warning'
    } else if (baudRate > 50000) {
      calculatedType.value = 'error'
      callback(new Error(i18next.t('uds.hardware.linNode.validation.baudRateTooHigh')))
    } else {
      calculatedType.value = 'primary'
    }
    callback()
  } else {
    callback()
  }
}

const rules = computed(() => {
  return {
    name: [{ required: true, trigger: 'blur', validator: nameCheck }],
    'device.handle': [
      {
        required: true,
        message: i18next.t('uds.hardware.linNode.validation.selectDevice'),
        trigger: 'change'
      }
    ],
    database: [
      {
        message: i18next.t('uds.hardware.linNode.validation.selectDatabase'),
        trigger: 'change'
      }
    ],
    workNode: [
      {
        required: data.value.database ? true : false,
        message: i18next.t('uds.hardware.linNode.validation.selectNode'),
        trigger: 'change'
      }
    ],
    'device.lincableCustomBaudRatePrescale': [{ trigger: 'change', validator: baudRateCheck }],
    'device.lincableCustomBaudRateBitMap': [{ trigger: 'change', validator: baudRateCheck }]
  }
})

const editIndex = ref(props.index)
onMounted(() => {
  ruleFormRef.value?.validate().catch(() => {
    null
  })
})
const emits = defineEmits(['change'])
const onSubmit = () => {
  ruleFormRef.value?.validate((valid) => {
    if (valid) {
      data.value.vendor = props.vendor
      if (editIndex.value == '') {
        const id = v4()
        data.value.id = id
        devices.devices[id] = {
          type: 'lin',
          linDevice: cloneDeep(data.value)
        }
        emits('change', id, data.value.name)
      } else {
        data.value.id = editIndex.value

        assign(devices.devices[editIndex.value].linDevice, data.value)
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
    if (editData && editData.type == 'lin' && editData.linDevice) {
      data.value = cloneDeep(editData.linDevice)
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
