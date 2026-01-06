<template>
  <div style="display: relative">
    <el-tabs v-model="activeName" style="width: 600px">
      <el-tab-pane label="General" name="general">
        <div style="height: 270px; width: 570px; overflow-y: auto">
          <el-form
            ref="ruleFormRef"
            :model="formData"
            label-width="100px"
            :rules="rules"
            size="small"
            :disabled="globalStart"
            hide-required-asterisk
          >
            <el-form-item label="Name" prop="name" required>
              <el-input v-model="formData.name" placeholder="Name" />
            </el-form-item>

            <el-form-item label="Log Enable" prop="disabled">
              <el-switch
                v-model="formData.disabled"
                disabled
                active-text="Disabled"
                inactive-text="Enabled"
              />
            </el-form-item>
            <el-form-item label="Transport" prop="type">
              <el-select v-model="formData.type" placeholder="Transport">
                <el-option label="File" value="file" />
                <el-option label="Socket" value="socket" disabled />
              </el-select>
            </el-form-item>
            <el-form-item label="Format" prop="format">
              <el-select v-model="formData.format" placeholder="Format">
                <el-option label="ASC Format" value="asc" />
                <el-option label="Vector BLF Format" value="blf" />
                <el-option label="CSV Format" value="csv" disabled />
              </el-select>
            </el-form-item>
            <el-form-item v-if="formData.format == 'blf'" label="Compression">
              <el-select v-model="formData.compression" placeholder="Compression level">
                <el-option label="Default (-1)" :value="-1" />
                <el-option label="No compression (0)" :value="0" />
                <el-option label="Fast (1)" :value="1" />
                <el-option label="Balanced (6)" :value="6" />
                <el-option label="Max (9)" :value="9" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="formData.type == 'file'" label="File Path" prop="path">
              <el-input v-model="formData.path" placeholder="Log file Path">
                <template #append>
                  <el-button size="small" @click="browseFile">Browse</el-button>
                </template>
              </el-input>
            </el-form-item>
            <el-alert
              v-if="formData.type == 'file'"
              type="info"
              :closable="false"
              show-icon
              style="margin-bottom: 15px"
            >
              <template #title>
                A timestamp (YYYYMMDDHHmmss) will be automatically appended to the filename.
              </template>
            </el-alert>

            <el-form-item label="Record Types" prop="method">
              <div>
                <el-checkbox
                  v-for="city in methods"
                  :key="city"
                  v-model="methodRef[city.value]"
                  border
                  :disabled="city.disabled"
                  :label="city.label"
                  :value="city.value"
                  @change="handleMethodChange(city, $event)"
                >
                  {{ city.label }}
                </el-checkbox>
              </div>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane label="Connected" name="Connected">
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
            v-model="formData.channel"
            class="canit"
            style="text-align: left; display: inline-block"
            :data="allDeviceLabel"
            :titles="['Valid', 'Assigned ']"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 添加底部按钮区域 -->
    <div style="float: right; margin-right: 30px">
      <el-button size="small" @click="handleCancel">Cancel</el-button>
      <el-button size="small" type="primary" :disabled="globalStart" @click="handleConfirm"
        >OK</el-button
      >
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ArrowDown } from '@element-plus/icons-vue'
import { ref, onMounted, onUnmounted, computed, toRef, nextTick, watch, watchEffect } from 'vue'
import {
  CAN_ID_TYPE,
  CanBaseInfo,
  CanDevice,
  CanInterAction,
  CanMsgType,
  getDlcByLen
} from 'nodeCan/can'
import { useDataStore } from '@r/stores/data'
import buildIcon from '@iconify/icons-material-symbols/build-circle-outline-sharp'
import successIcon from '@iconify/icons-material-symbols/check-circle-outline'
import refreshIcon from '@iconify/icons-material-symbols/refresh'
import dangerIcon from '@iconify/icons-material-symbols/dangerous-outline-rounded'
import newIcon from '@iconify/icons-material-symbols/new-window'
import { Icon } from '@iconify/vue'
import { useProjectStore } from '@r/stores/project'
import { ElMessageBox, FormInstance, FormRules, TransferKey } from 'element-plus'
import { cloneDeep } from 'lodash'
import { TesterInfo } from 'nodeCan/tester'
import { udsCeil } from './udsView'
import { useGlobalStart } from '@r/stores/runtime'

const activeName = ref('general')
const props = defineProps<{
  editIndex: string
  ceil: udsCeil
}>()
const globalStart = useGlobalStart()
const editIndex = toRef(props, 'editIndex')
const dataBase = useDataStore()
const methodRef = ref<Record<string, boolean>>({})
const formData = ref(cloneDeep(dataBase.logs[editIndex.value]))
if (formData.value.format === 'blf' && formData.value.compression === undefined) {
  formData.value.compression = -1
}
const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (const key of Object.keys(dataBase.logs)) {
      const hasName = dataBase.logs[key].name
      if (hasName == value && key != editIndex.value) {
        callback(new Error('The log name already exists'))
      }
    }
    callback()
  } else {
    callback(new Error('Please input node name'))
  }
}

const methods = [
  {
    label: 'CAN',
    value: 'CAN',
    methods: ['canBase', 'canError'],
    disabled: false
  },
  {
    label: 'LIN',
    value: 'LIN',
    methods: ['linBase', 'linError', 'linEvent'],
    disabled: true
  },
  {
    label: 'ETH',
    value: 'ETH',
    methods: ['ipBase', 'ipError'],
    disabled: true
  },
  {
    label: 'UDS',
    value: 'UDS',
    methods: ['udsSent', 'udsRecv', 'udsNegRecv', 'udsError', 'udsScript', 'udsSystem'],
    disabled: true
  }
]

const rules = computed(() => {
  const rules: FormRules = {
    name: [
      {
        required: true,
        trigger: 'blur',
        validator: nameCheck
      }
    ],
    path: [
      {
        required: formData.value.type == 'file' ? true : false,
        message: 'Please input log file path'
      }
    ]
  }
  return rules
})

function handleMethodChange(
  method: { value: string; methods: string[]; disabled: boolean },
  checked: boolean
) {
  const methodList = method.methods
  if (checked) {
    for (const m of methodList) {
      if (formData.value.method.indexOf(m) == -1) {
        formData.value.method.push(m)
      }
    }
  } else {
    for (const m of methodList) {
      if (formData.value.method.indexOf(m) != -1) {
        formData.value.method.splice(formData.value.method.indexOf(m), 1)
      }
    }
  }
}
const project = useProjectStore()

async function browseFile() {
  const formatExtensions: Record<string, string[]> = {
    asc: ['asc'],
    blf: ['blf'],
    csv: ['csv']
  }

  const formatNames: Record<string, string> = {
    asc: 'ASC Format',
    blf: 'Vector BLF Format',
    csv: 'CSV Format'
  }

  const currentFormat = formData.value.format || 'asc'
  const extensions = formatExtensions[currentFormat] || ['*']
  const formatName = formatNames[currentFormat] || 'Log File'

  const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: 'Select Log File',
    properties: ['openFile'],
    filters: [
      { name: formatName, extensions: extensions },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  const file = r.filePaths[0]
  if (file) {
    if (project.projectInfo.path) {
      formData.value.path = window.path.relative(project.projectInfo.path, file)
    } else {
      formData.value.path = file
    }
  }
}

// const db = computed(() => {
//     const list: {
//         label: string,
//         value: string
//     }[] = []
//     if (props.type == 'lin') {
//         for (const key of Object.keys(dataBase.database.lin)) {

//             list.push({ label: dataBase.database.lin[key].name, value: key })

//         }
//     }
//     return list
// })

// const dbName = ref('')
// const getUsedDb = () => {
//     const device = data.value.channel[0]
//     if (device && dataBase.devices[device] && dataBase.devices[device].type == 'lin' && dataBase.devices[device].linDevice && dataBase.devices[device].linDevice.database) {
//         dbName.value = dataBase.devices[device].linDevice.database
//     } else {
//         dbName.value = ''
//         data.value.workNode = ''
//     }
// }
// watchEffect(() => {
//     getUsedDb()
// })

watch(
  () => formData.value.format,
  (val) => {
    if (val === 'blf' && formData.value.compression === undefined) {
      formData.value.compression = -1
    }
  }
)

interface Option {
  key: string
  label: string
  disabled: boolean
}
const allDeviceLabel = computed(() => {
  const dd: Option[] = []
  for (const d of Object.keys(allDevices.value)) {
    const deviceDisabled = false
    dd.push({
      key: d,
      label: allDevices.value[d].name,
      disabled: globalStart.value || deviceDisabled
    })
  }
  return dd
})
const allDevices = computed(() => {
  const dd: Record<
    string,
    {
      name: string
    }
  > = {}
  for (const d in dataBase.devices) {
    if (dataBase.devices[d].type == 'can' && dataBase.devices[d].canDevice) {
      dd[d] = dataBase.devices[d].canDevice
    } else if (dataBase.devices[d].type == 'eth' && dataBase.devices[d].ethDevice) {
      dd[d] = dataBase.devices[d].ethDevice
    } else if (dataBase.devices[d].type == 'lin' && dataBase.devices[d].linDevice) {
      dd[d] = dataBase.devices[d].linDevice
    } else if (dataBase.devices[d].type == 'pwm' && dataBase.devices[d].pwmDevice) {
      dd[d] = dataBase.devices[d].pwmDevice
    }
  }
  return dd
})

const ruleFormRef = ref<FormInstance>()

// 取消修改
const handleCancel = () => {
  ElMessageBox.close()
}

// 确认修改
const handleConfirm = async () => {
  if (!ruleFormRef.value) return

  await ruleFormRef.value.validate((valid, fields) => {
    if (valid) {
      // 验证通过，更新数据
      dataBase.logs[editIndex.value] = cloneDeep(formData.value)

      props.ceil.changeName(dataBase.logs[editIndex.value].name)

      ElMessageBox.close()
    }
  })
}

// 监听data变化，更新formData

onMounted(() => {
  // refreshBuildStatus()
  for (const m of methods) {
    for (const sm of formData.value.method) {
      if (m.methods.includes(sm)) {
        methodRef.value[m.value] = true
      }
    }
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
.lr {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
}

.buildStatus {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
}
</style>
