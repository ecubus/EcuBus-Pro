<template>
  <div style="padding:20px;min-width: 600px">
    <el-form ref="ruleFormRef" :model="data" label-width="150px" :rules="rules" size="small" hide-required-asterisk>
      <el-form-item label="Tester Name" prop="name">
        <el-input v-model="data.name" placeholder="Name" />
      </el-form-item>
      <!-- <el-form-item label="Target Device" prop="targetDeviceId">
        <el-select v-model="data.targetDeviceId" placeholder="Device" clearable>
          <el-option v-for="item, key in devices" :key="key" :label="item.canDevice?.name" :value="key">
            <span style="float: left">{{ item.canDevice?.name }}</span>
            <span style="
          float: right;
          color: var(--el-text-color-secondary);
          font-size: 13px;
        ">
              {{ item.canDevice?.vendor.toLocaleUpperCase() }}
            </span>
          </el-option>
        </el-select>
      </el-form-item> -->
      <el-form-item label="Tester Script File" prop="script">
        <el-input v-model="data.script" clearable>

        </el-input>
        <div class="lr">



          <el-button-group style="margin-top: 5px;" v-loading="buildLoading">
            <el-button size="small" plain @click="editScript('open')">
              <Icon :icon="newIcon" class="icon" style="margin-right: 5px" /> Choose
            </el-button>




            <el-button size="small" plain @click="editScript('build')">
              <Icon :icon="buildIcon" class="icon" style="margin-right: 5px" /> Build
            </el-button>

            <!-- <el-button size="small" plain @click="editScript('refresh')">
              <Icon :icon="refreshIcon" class="icon" style="margin-right: 5px" /> Refresh

            </el-button> -->
            <el-button size="small" plain @click="editScript('edit')">
              <Icon :icon="refreshIcon" class="icon" style="margin-right: 5px" /> Refresh / Edit

            </el-button>



          </el-button-group>
          <el-divider direction="vertical" style="height:24px;margin-top:5px;" v-if="buildStatus" />
          <span v-if="buildStatus == 'danger'" style="color: var(--el-color-danger);" class="buildStatus">
            <Icon :icon="dangerIcon" />Build Failed
          </span>
          <span v-else-if="buildStatus == 'success'" style="color: var(--el-color-success);" class="buildStatus">
            <Icon :icon="successIcon" />Build Success
          </span>
          <span v-else-if="buildStatus == 'warning'" style="color: var(--el-color-warning);" class="buildStatus">
            <Icon :icon="buildIcon" />Need Rebuild
          </span>
          <span v-else-if="buildStatus == 'info'" style="color: var(--el-color-info);" class="buildStatus">
            <Icon :icon="buildIcon" />Need Build
          </span>
          <el-button v-if="buildStatus" link style="margin-top: 5px;" :type="buildStatus">
            <Icon :icon="refreshIcon" @click="refreshBuildStatus" class="icon" style="margin-right: 5px" />
          </el-button>

        </div>


        <!-- stop -->



      </el-form-item>

      <el-divider content-position="left">
        UDS Timing
      </el-divider>
      <el-form-item label-width="0">

        <el-col :span="12">
          <el-form-item label="P2 timeout" prop="udsTime.pTime">
            <el-input v-model.number="data.udsTime.pTime" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="P2 max (0x78)" prop="udsTime.pExtTime">
            <el-input v-model.number="data.udsTime.pExtTime"/>
          </el-form-item>
        </el-col>

      </el-form-item>
      <el-form-item label-width="0">

        <el-col :span="12">
          <el-form-item label="S3 Time" prop="data.udsTime.s3Time">
            <el-input v-model.number="data.udsTime.s3Time" disabled />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Tester Present Enable" prop="udsTime.testerPresentEnable">
            <el-checkbox v-model="data.udsTime.testerPresentEnable" disabled />
          </el-form-item>
        </el-col>

      </el-form-item>
      <el-divider content-position="left">
        
        <el-button icon="Plus" link type="primary" @click="addCanAddress">
          Add
          {{ props.type.toLocaleUpperCase() }} Address
        </el-button>
        <el-button icon="Switch" link type="success" @click="addAddrFromDb">
          Load From Database
        </el-button>

     
      </el-divider>
    </el-form>

    <div v-if="data.address && data.address.length > 0">
      <el-tabs tab-position="left" v-model="activeTabName" v-if="props.type == 'can'" style="height: 660px" closable
        @tab-remove="removeTab">
        <el-tab-pane :name="`index${index}`"  v-for="item, index in data.address"
          :key="index">
          <template #label>
            <span class="custom-tabs-label">

              <span :class="{
                addrError: errors[index]

              }">{{ getAddrName(item, index) }}</span>
            </span>
          </template>
          <canAddr :index="index" :addrs="data.address" v-if="data.address[index].canAddr"
            :ref="(e) => addrRef[index] = e" v-model="data.address[index].canAddr" />

        </el-tab-pane>
      </el-tabs>
      <el-tabs tab-position="left" v-else-if="props.type == 'eth'" v-model="activeTabName" style="height: 450px"
        closable @tab-remove="removeTab">
        <el-tab-pane :name="`index${index}`" v-for="item, index in data.address"
          :key="index">
          <template #label>
            <span class="custom-tabs-label">

              <span :class="{
                addrError: errors[index]

              }">{{ getAddrName(item, index)}}</span>
            </span>
          </template>

          <EthAddr :index="index" v-if="data.address[index].ethAddr" :addrs="data.address"
            :ref="(e) => addrRef[index] = e" v-model="data.address[index].ethAddr" />
        </el-tab-pane>
      </el-tabs>
      <el-tabs tab-position="left" v-else-if="props.type == 'lin'" v-model="activeTabName" style="height: 450px"
        closable @tab-remove="removeTab">
        <el-tab-pane :name="`index${index}`"  v-for="item, index in data.address"
          :key="index">
          <template #label>
            <span class="custom-tabs-label">

              <span :class="{
                addrError: errors[index]

              }">{{ getAddrName(item, index) }}</span>
            </span>
          </template>

          <LinAddr :index="index" v-if="data.address[index].linAddr" :addrs="data.address"
            :ref="(e) => addrRef[index] = e" v-model="data.address[index].linAddr" />
        </el-tab-pane>
      </el-tabs>
    </div>
    <el-divider />
  </div>
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
  watch,
  nextTick,
  h
} from "vue";
import canAddr from "./canAddr.vue";
import { v4 } from "uuid";
import { type FormRules, type FormInstance, ElMessageBox, ElMessage } from "element-plus";
import { assign, cloneDeep } from "lodash";
import { useDataStore } from "@r/stores/data";
import { TesterInfo } from "nodeCan/tester";
import { CAN_ADDR_FORMAT, CAN_ADDR_TYPE, CAN_ID_TYPE } from "nodeCan/can";
import { HardwareType, UdsAddress, UdsDevice } from "nodeCan/uds";
import { useProjectStore } from "@r/stores/project";
import { Icon } from '@iconify/vue'
import buildIcon from '@iconify/icons-material-symbols/build-circle-outline-sharp'
import successIcon from '@iconify/icons-material-symbols/check-circle-outline'
import refreshIcon from '@iconify/icons-material-symbols/refresh'
import newIcon from '@iconify/icons-material-symbols/new-window'
import buildError from "./buildError.vue";
import dangerIcon from '@iconify/icons-material-symbols/dangerous-outline-rounded'
import EthAddr from "./ethAddr.vue";
import LinAddr from "./linAddr.vue";
import { LIN_ADDR_TYPE, LIN_SCH_TYPE } from "nodeCan/lin";
import dbchoose from "./dbchoose.vue";

const globalStart = toRef(window, 'globalStart')
const ruleFormRef = ref<FormInstance>();
const dataBase = useDataStore();
const props = defineProps<{
  index: string;
  height: number;
  type: HardwareType;
}>();

// const devices = computed(() => {
//   const devicesList: Record<string, UdsDevice> = {}
//   for (const key of Object.keys(dataBase.devices)) {
//     const device = dataBase.devices[key]
//     if (device.type == 'can') {
//       devicesList[key] = device
//     }
//   }
//   return devicesList
// })

const data = ref<TesterInfo>({
  id: v4(),
  name: "",
  type: props.type,
  script: "",
  targetDeviceId: "",
  seqList: [],
  address: [],
  udsTime: {
    pTime: 2000,
    pExtTime: 5000,
    s3Time: 5000,
    testerPresentEnable: false
  },
  allServiceList: {}
});


function getAddrName(item: UdsAddress, index: number) {
  if (item.type == 'can') {
    return item.canAddr?.name
  } else if (item.type == 'eth') {
    return item.ethAddr?.name
  }else if(item.type == 'lin'){
    return item.linAddr?.name
  }
  return `Addr${index}`
}

const addrRef = ref<Record<number, any>>({})


const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (const key of Object.keys(dataBase.tester)) {
      const hasName = dataBase.tester[key].name;
      if (hasName == value && key != editIndex.value) {
        callback(new Error("The tester name already exists"));
      }
    }
    callback();
  } else {
    callback(new Error("Please input tester name"));
  }
};

const activeTabName = ref('')
const emits = defineEmits(['change'])

const rules: FormRules = {
  "name": [
    {
      required: true,
      trigger: "blur",
      validator: nameCheck,
    },
  ],
  targetDeviceId: [
    {
      required: true,
      message: "Please select target device",
      trigger: "change",
    },
  ],
  "udsTime.pTime": [
    {
      required: true,
      message: "Please input UDS Timeout",
      trigger: "blur",
      type: "number",
    },
  ],
  "udsTime.s3Time": [
    {
      required: true,
      message: "Please input S3 Time",
      trigger: "blur",
      type: "number",
    },
  ],
}

const project = useProjectStore()


function refreshBuildStatus() {
  if (data.value.script) {
    window.electron.ipcRenderer.invoke('ipc-get-build-status', project.projectInfo.path, project.projectInfo.name, data.value.script).then((val) => {
      buildStatus.value = val
    })
  }
}
const buildLoading = ref(false)
function editScript(action: 'open' | 'edit' | 'build') {
  if (action == 'edit' || action == 'build') {
    if (data.value.script) {

      if (project.projectInfo.path) {
        if (action == 'edit') {

          window.electron.ipcRenderer.invoke('ipc-create-project', project.projectInfo.path, project.projectInfo.name, cloneDeep(dataBase.getData())).catch((e: any) => {
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
          window.electron.ipcRenderer.invoke('ipc-build-project', project.projectInfo.path, project.projectInfo.name, cloneDeep(dataBase.getData()), data.value.script)
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
            }).finally(() => {
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
  }
  else {
    openTs()
  }

}
async function openTs() {
  const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: 'Script File', properties: ['openFile'], filters: [
      { name: 'typescript', extensions: ['ts'] },
      { name: 'All Files', extensions: ['*'] }
    ]

  })
  const file = r.filePaths[0]
  if (file) {
    if (project.projectInfo.path)
      data.value.script = window.path.relative(project.projectInfo.path, file)
    else
      data.value.script = file
  }
  return file

}
const editIndex = ref(props.index);
function addCanAddress() {
  if (props.type == 'can') {
    data.value.address.push({
      type: 'can',
      canAddr: {
        name: `Addr${data.value.address.length}`,
        addrFormat: CAN_ADDR_FORMAT.NORMAL,
        addrType: CAN_ADDR_TYPE.PHYSICAL,
        SA: "0x1",
        TA: "0x2",
        AE: "",
        canIdTx: "0x55",
        canIdRx: "0x56",
        nAs: 1000,
        nAr: 1000,
        nBs: 1000,
        nCr: 1000,
        nBr: 0,
        nCs: 0,
        idType: CAN_ID_TYPE.STANDARD,
        brs: false,
        canfd: false,
        remote: false,
        stMin: 10,
        bs: 10,
        maxWTF: 0,
        dlc: 8,
        padding: false,
        paddingValue: '0x00'
      }
    })
  } else if (props.type == 'eth') {
    data.value.address.push({
      type: 'eth',

      ethAddr: {
        name: `Addr${data.value.address.length}`,
        taType: 'physical',
        virReqType: "broadcast",
        virReqAddr: "",
        
        entityNotFoundBehavior: 'normal',
        entity: {
          vin: "ecubus-pro eth000",
          eid: "00-00-00-00-00-00",
          gid: "00-00-00-00-00-00",
          nodeType: "node",
          logicalAddr: 100 + data.value.address.length,
        },
        tester: {
          testerLogicalAddr: 200 + data.value.address.length,
          routeActiveTime: 0,
          createConnectDelay: 1000,
        }
      }
    })
  } else if (props.type == 'lin'){
    data.value.address.push({
      type: 'lin',
      linAddr: {
        name: `Addr${data.value.address.length}`,
        addrType: LIN_ADDR_TYPE.PHYSICAL,
        nad: 1,
        stMin: 20,
        nAs: 1000,
        nCr: 1000,
        schType: LIN_SCH_TYPE.DIAG_ONLY
      }
    })
  }
  activeTabName.value = `index${data.value.address.length - 1}`



}
function removeTab(targetName: string) {
  const index = parseInt(targetName.replace('index', ''))
  data.value.address.splice(index, 1)
  nextTick(() => {
    delete addrRef.value[index]
  })


}


function addAddrFromDb(){
  ElMessageBox({
    title: `Load From Database ${props.type}`,
    message:h(dbchoose,{
      type:props.type,
      testerId:editIndex.value,
      onAdd:(addr:UdsAddress)=>{
        data.value.address.push(addr)
        activeTabName.value = `index${data.value.address.length - 1}`
      }
    }),
    showCancelButton: false,
    showConfirmButton: false,
  
  })
}
const errors = ref<Record<number, any>>({})
const onSubmit = async () => {
  try {

    errors.value = {}
    for (let i = 0; i < Object.values(addrRef.value).length; i++) {

      await addrRef.value[i]?.dataValid().catch((e: any) => {

        errors.value[i] = e

      })

    }
    await ruleFormRef.value?.validate()
    if (Object.keys(errors.value).length > 0) {
      return false
    }
    dataBase.tester[editIndex.value].address = cloneDeep(data.value.address);
    dataBase.tester[editIndex.value].name = data.value.name;
    dataBase.tester[editIndex.value].script = data.value.script;
    dataBase.tester[editIndex.value].udsTime = cloneDeep(data.value.udsTime);

    emits('change', editIndex.value, data.value.name)
    return true
  } catch (e) {
    console.error(e)
    return false
  }

};

let watcher: any;

const buildStatus = ref<string | undefined>()
onBeforeMount(() => {
  if (editIndex.value) {
    const editData = dataBase.tester[editIndex.value]
    if (editData) {
      data.value = cloneDeep(editData)
      if (data.value.address.length > 0)
        activeTabName.value = `index${0}`
    } else {
      editIndex.value = ""
      data.value.name = `Tester ${props.type}_${Object.keys(dataBase.tester).length}`
    }
    refreshBuildStatus()
  } else {
    editIndex.value = ""
    data.value.name = `Tester_${props.type}_${Object.keys(dataBase.tester).length}`
  }

  watcher = watch(
    data,
    () => {

      onSubmit();
    },
    { deep: true }
  );
});
onUnmounted(() => {
  watcher();
});


</script>
<style scoped>
.hardware {
  margin: 20px;
}

.custom-tabs-label {
  width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  height: 20px;
}

.lr {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
}

.vm {
  display: flex;
  align-items: center;
  /* 垂直居中对齐 */
  gap: 4px;
}

.addrError {
  color: var(--el-color-danger);
  font-weight: bold;
}

.buildStatus {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
}
</style>