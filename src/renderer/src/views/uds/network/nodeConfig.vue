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
            <el-form-item label="Node Name" prop="name">
              <el-input v-model="formData.name" placeholder="Name" />
            </el-form-item>

            <el-form-item label="Net Node" prop="workNode">
              <el-select v-model="formData.workNode" placeholder="Node Name" clearable>
                <el-option
                  v-for="item in nodesName"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="Node Script File" prop="script">
              <el-input v-model="formData.script" clearable> </el-input>
              <div class="lr">
                <el-button-group v-loading="buildLoading" style="margin-top: 5px">
                  <el-button size="small" plain :disabled="globalStart" @click="editScript('open')">
                    <Icon :icon="newIcon" class="icon" style="margin-right: 5px" /> Choose
                  </el-button>

                  <el-button
                    size="small"
                    plain
                    :disabled="globalStart"
                    @click="editScript('build')"
                  >
                    <Icon :icon="buildIcon" class="icon" style="margin-right: 5px" /> Build
                  </el-button>

                  <!-- <el-button size="small" plain @click="editScript('refresh')">
              <Icon :icon="refreshIcon" class="icon" style="margin-right: 5px" /> Refresh

            </el-button> -->
                  <el-button size="small" plain :disabled="globalStart" @click="editScript('edit')">
                    <Icon :icon="refreshIcon" class="icon" style="margin-right: 5px" /> Refresh /
                    Edit
                  </el-button>
                </el-button-group>
                <el-divider
                  v-if="buildStatus"
                  direction="vertical"
                  style="height: 24px; margin-top: 5px"
                />
                <span
                  v-if="buildStatus == 'danger'"
                  style="color: var(--el-color-danger)"
                  class="buildStatus"
                >
                  <Icon :icon="dangerIcon" />Build Failed
                </span>
                <span
                  v-else-if="buildStatus == 'success'"
                  style="color: var(--el-color-success)"
                  class="buildStatus"
                >
                  <Icon :icon="successIcon" />Build Success
                </span>
                <span
                  v-else-if="buildStatus == 'warning'"
                  style="color: var(--el-color-warning)"
                  class="buildStatus"
                >
                  <Icon :icon="buildIcon" />Need Rebuild
                </span>
                <span
                  v-else-if="buildStatus == 'info'"
                  style="color: var(--el-color-info)"
                  class="buildStatus"
                >
                  <Icon :icon="buildIcon" />Need Build
                </span>
                <el-button v-if="buildStatus" link style="margin-top: 5px" :type="buildStatus">
                  <Icon
                    :icon="refreshIcon"
                    class="icon"
                    style="margin-right: 5px"
                    @click="refreshBuildStatus"
                  />
                </el-button>
              </div>

              <!-- stop -->
            </el-form-item>
            <el-form-item label="Node Active" prop="disabled">
              <el-switch
                v-model="formData.disabled"
                disabled
                active-text="Disabled"
                inactive-text="Enabled"
              />
            </el-form-item>
            <el-form-item v-if="formData.isTest">
              <el-tag type="success">Test Node</el-tag>
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
const buildStatus = ref<string | undefined>()
const formData = ref(cloneDeep(dataBase.nodes[editIndex.value]))
const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (const key of Object.keys(dataBase.nodes)) {
      const hasName = dataBase.nodes[key].name
      if (hasName == value && key != editIndex.value) {
        callback(new Error('The node name already exists'))
      }
    }
    callback()
  } else {
    callback(new Error('Please input node name'))
  }
}

const handleLeftCheckChange = (value: TransferKey[], movedKeys?: TransferKey[]) => {
  if (value.length > 1) {
    value.splice(0, 1)
  }
}
const rules: FormRules = {
  name: [
    {
      required: true,
      trigger: 'blur',
      validator: nameCheck
    }
  ]
}

const buildLoading = ref(false)
function editScript(action: 'open' | 'edit' | 'build' | 'refresh') {
  if (action == 'edit' || action == 'build') {
    if (formData.value.script) {
      if (project.projectInfo.path) {
        if (action == 'edit') {
          window.electron.ipcRenderer
            .invoke(
              'ipc-create-project',
              project.projectInfo.path,
              project.projectInfo.name,
              cloneDeep(dataBase.getData())
            )
            .catch((e: any) => {
              ElMessageBox.alert(e.message, 'Error', {
                confirmButtonText: 'OK',
                type: 'error',
                buttonSize: 'small',
                appendTo: '#tester'
              })
            })
        } else {
          buildStatus.value = ''
          buildLoading.value = true
          window.electron.ipcRenderer
            .invoke(
              'ipc-build-project',
              project.projectInfo.path,
              project.projectInfo.name,
              cloneDeep(dataBase.getData()),
              formData.value.script,
              formData.value.isTest
            )
            .then((val) => {
              if (val.length > 0) {
                buildStatus.value = 'danger'
              } else {
                buildStatus.value = 'success'
                // ElMessage({
                //   message: 'Build Success',
                //   appendTo: '#tester',
                //   type: 'success',
                //   offset: 35,
                //   duration: 2000
                // })
              }
            })
            .catch((e: any) => {
              ElMessageBox.alert(e.message, 'Error', {
                confirmButtonText: 'OK',
                type: 'error',
                buttonSize: 'small',
                appendTo: '#tester'
              })
            })
            .finally(() => {
              buildLoading.value = false
            })
        }
      } else {
        ElMessageBox.alert('Please save the project first', 'Warning', {
          confirmButtonText: 'OK',
          type: 'warning',
          buttonSize: 'small',
          appendTo: '#tester'
        })
      }
    } else {
      ElMessageBox.alert('Please select the script file first', 'Warning', {
        confirmButtonText: 'OK',
        type: 'warning',
        buttonSize: 'small',
        appendTo: '#tester'
      })
    }
  } else {
    openTs()
  }
}
async function openTs() {
  const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: 'Script File',
    properties: ['openFile'],
    filters: [
      { name: 'typescript', extensions: ['ts'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  const file = r.filePaths[0]
  if (file) {
    if (project.projectInfo.path)
      formData.value.script = window.path.relative(project.projectInfo.path, file)
    else formData.value.script = file
  }
  return file
}
const project = useProjectStore()

function refreshBuildStatus() {
  if (formData.value.script) {
    window.electron.ipcRenderer
      .invoke(
        'ipc-get-build-status',
        project.projectInfo.path,
        project.projectInfo.name,
        formData.value.script
      )
      .then((val) => {
        buildStatus.value = val
      })
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

const nodesName = computed(() => {
  const list: {
    label: string
    value: string
  }[] = []

  for (const deviceId of formData.value.channel) {
    const device = dataBase.devices[deviceId]
    if (device && device.type == 'lin' && device.linDevice) {
      const d = device.linDevice
      if (d.database) {
        const db = dataBase.database.lin[d.database]

        if (d.mode == 'MASTER') {
          list.push({
            label: `${db.name}:${db.node.master.nodeName}`,
            value: `${db.name}:${db.node.master.nodeName}`
          })
        }
        for (const n of db.node.salveNode) {
          list.push({
            label: `${db.name}:${n}`,
            value: `${db.name}:${n}`
          })
        }
      }
    }
  }
  return list
})

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
    } else if (dataBase.devices[d].type == 'someip' && dataBase.devices[d].someipDevice) {
      dd[d] = dataBase.devices[d].someipDevice
    }
  }
  return dd
})

const ruleFormRef = ref<FormInstance>()
watch(
  () => formData.value.channel,
  () => {
    nextTick(() => {
      let found = false
      for (const node of nodesName.value) {
        if (node.value == formData.value.workNode) {
          found = true
          break
        }
      }
      if (!found) {
        formData.value.workNode = ''
      }
    })
  },
  { deep: true }
)
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
      dataBase.nodes[editIndex.value] = cloneDeep(formData.value)

      props.ceil.changeName(dataBase.nodes[editIndex.value].name)
      // const t=props.ceil.getNodeBottomName()
      props.ceil.changeNameBottom(dataBase.nodes[editIndex.value].workNode || '')

      ElMessageBox.close()
    }
  })
}

// 监听data变化，更新formData

onMounted(() => {
  refreshBuildStatus()
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
