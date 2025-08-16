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
                <el-option label="CSV" value="csv" disabled />
                <el-option label="ASCII" value="asc" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="formData.type == 'file'" label="File Path" prop="path">
              <el-input v-model="formData.path" placeholder="Log file Path" />
            </el-form-item>
            <el-form-item label="Record Types" prop="method">
              <div>
                <el-checkbox
                  v-for="city in methods"
                  :key="city"
                  v-model="methodRef[city]"
                  border
                  :label="city"
                  :value="city"
                  @change="handleMethodChange(city, $event)"
                >
                  {{ city }}
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
import { udsCeil } from '../../udsView'
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

const methods = ['CAN', 'LIN', 'ETH', 'UDS']

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

function handleMethodChange(method: string, checked: boolean) {
  switch (method) {
    case 'CAN': {
      const canMethod = ['canBase', 'canError']
      if (checked) {
        for (const m of canMethod) {
          if (formData.value.method.indexOf(m) == -1) {
            formData.value.method.push(m)
          }
        }
      } else {
        for (const m of canMethod) {
          formData.value.method.splice(formData.value.method.indexOf(m), 1)
        }
      }
      break
    }
    case 'LIN': {
      const linMethod = ['linBase', 'linError', 'linEvent']
      if (checked) {
        for (const m of linMethod) {
          if (formData.value.method.indexOf(m) == -1) {
            formData.value.method.push(m)
          }
        }
      } else {
        for (const m of linMethod) {
          formData.value.method.splice(formData.value.method.indexOf(m), 1)
        }
      }
      break
    }
    case 'ETH': {
      const ethMethod = ['ipBase', 'ipError']
      if (checked) {
        for (const m of ethMethod) {
          if (formData.value.method.indexOf(m) == -1) {
            formData.value.method.push(m)
          }
        }
      } else {
        for (const m of ethMethod) {
          formData.value.method.splice(formData.value.method.indexOf(m), 1)
        }
      }
      break
    }
    case 'UDS': {
      const udsMethod = ['udsSent', 'udsRecv', 'udsNegRecv', 'udsError', 'udsScript', 'udsSystem']
      if (checked) {
        for (const m of udsMethod) {
          if (formData.value.method.indexOf(m) == -1) {
            formData.value.method.push(m)
          }
        }
      } else {
        for (const m of udsMethod) {
          formData.value.method.splice(formData.value.method.indexOf(m), 1)
        }
      }
      break
    }
  }
}
const project = useProjectStore()

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
  if (formData.value.method.includes('canBase')) {
    methodRef.value.CAN = true
  }
  if (formData.value.method.includes('linBase')) {
    methodRef.value.LIN = true
  }
  if (formData.value.method.includes('ipBase')) {
    methodRef.value.ETH = true
  }
  if (formData.value.method.includes('udsSent')) {
    methodRef.value.UDS = true
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
