<template>
  <div>
    <div class="tools">
      <el-tooltip effect="light" content="Add a new sequence" placement="bottom" >
        <el-button type="primary" size="small" link plain @click="addNewSeq" :disabled="start">
          <Icon :icon="addCircle" class="icon" />
        </el-button>
      </el-tooltip>
      <el-divider direction="vertical" />
      <el-button-group>
        <el-tooltip effect="light" content="Run chosen sequence" placement="bottom" >
          <el-button :disabled="!activeTabName || start||!tester.targetDeviceId" type="success" size="small" link plain @click="startSeq">
            <Icon :icon="playIcon" class="icon" />
          </el-button>
        </el-tooltip>
        <!-- stop -->
        <el-tooltip effect="light" content="Stop chosen sequence" placement="bottom" >
          <el-button :disabled="!activeTabName || !start" type="danger" size="small" link plain @click="stopSeq">
            <Icon :icon="stopIcon" class="icon" />
          </el-button>
        </el-tooltip>
      </el-button-group>
      <el-divider direction="vertical" />
      <el-tooltip effect="light" content="Cycle Run" placement="bottom" :show-after="500">
        <Icon :icon="cycleIcon" style="color:var(--el-color-info)" />
      </el-tooltip>
      <el-input-number v-model="seqCycle" :min="1" :step="1" style="width: 80px;margin-left: 10px" size="small"
        controls-position="right" />
      <el-divider direction="vertical" />
      <Icon :icon="deviceIcon" style="color:var(--el-color-info)" />
      <el-select v-model="tester.targetDeviceId" placeholder="Device" clearable style="width: 300px;margin-left: 10px"
        size="small">
        <el-option v-for="item, key in devices" :key="key"  :label="getName(item)" :value="key">
          <span style="float: left">{{ getName(item)}}</span>
          <span style="
          float: right;
          color: var(--el-text-color-secondary);
          font-size: 12px;
         
        ">
            {{ getVendor(item) }}
          </span>
        </el-option>
      </el-select>

    </div>
    <div v-if="tester.seqList.length > 0">
      <el-tabs tab-position="left" v-model="activeTabName" class="seqTabs seqTabs1" closable @tab-remove="removeTab">
        <el-tab-pane :name="`index${index}`" :label="item.name ? item.name : `Addr${index}`"
          v-for="item, index in tester.seqList" :key="index">
          <template #label>
            <span class="custom-tabs-label">

              <span :class="{
                addrError: errors[index]
              }">{{ item.name ? item.name : `Seq${index}` }}</span>
            </span>
          </template>

          <subseqeunce :index="index" :id="props.editIndex" :ref="(e: any) => subSeqRef[index] = e"
            :height="tableHeight" :disabled="start" v-model="tester.seqList[index]" />
        </el-tab-pane>
      </el-tabs>
    </div>
    <div v-else>
      <el-empty class="seqTabs">
        <el-button type="primary" link @click="addNewSeq" icon="Plus">
          Add Sequence First
        </el-button>
      </el-empty>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { v4 } from 'uuid'
import { Param, param2len, param2str, paramSetVal, DataType, UdsDevice } from 'nodeCan/uds'
import { onMounted, ref, nextTick, computed, toRef, onBeforeMount } from 'vue'
import subseqeunce from './subsequence.vue'
import { useDataStore } from "@r/stores/data";
import addCircle from '@iconify/icons-material-symbols/add-circle-outline-rounded'
import playIcon from '@iconify/icons-material-symbols/play-circle-outline'
import stopIcon from '@iconify/icons-material-symbols/stop-circle-outline'
import logIcon from '@iconify/icons-material-symbols/text-ad-outline-rounded'
import cycleIcon from '@iconify/icons-material-symbols/cycle'
import { Icon } from '@iconify/vue'
import { ElMessageBox } from 'element-plus';
import { useProjectStore } from '@r/stores/project';
import { clone, cloneDeep } from 'lodash';
import deviceIcon from '@iconify/icons-material-symbols/important-devices-outline'

const seqCycle = ref(1)
const dataBase = useDataStore();
const activeTabName = ref('')
const errors = ref<Record<string, any>>({})
const props = defineProps<{
  editIndex: string
  width: number,
  height: number
}>()
const tester = toRef(dataBase.tester, props.editIndex)
const h = toRef(props, 'height')
const w = toRef(props, 'width')
const devices = computed(() => {
  const devicesList: Record<string, UdsDevice> = {}
  for (const key of Object.keys(dataBase.devices)) {
    const device = dataBase.devices[key]
    if (device.type == tester.value.type) {
      devicesList[key] = device
    }
  }
  return devicesList
})

function getName(device: UdsDevice) {
 if(device.type=='can'){
    return device.canDevice?.name
 }else if(device.type=='eth'){
   return device.ethDevice?.name
 }else if(device.type=='lin'){
   return device.linDevice?.name
 }
 else{
  return ''
 }
}
function getVendor(device: UdsDevice) {
  if(device.type=='can'){
    return device.canDevice?.vendor.toLocaleUpperCase()
 }else if(device.type=='eth'){
   return device.ethDevice?.vendor.toLocaleUpperCase()
 }else if(device.type=='lin'){
   return device.linDevice?.vendor.toLocaleUpperCase()
 }else{
  return ''
 }
}
const subSeqRef = ref<Record<number, any>>({})

const start = ref(false)
function removeTab(index: string) {
  
  const num=parseInt(index.replace('index', ''))
  ElMessageBox.confirm(`Are you sure to delete ${tester.value.seqList[num].name||`Seq${num}`}?`, 'Warning', {
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    type: 'warning',
    buttonSize: 'small',
    appendTo: `#win${props.editIndex}_sequence`
  }).then(() => {
    tester.value.seqList.splice(num, 1)
    if (tester.value.seqList.length > 0)
      activeTabName.value = `index${tester.value.seqList.length - 1}`
    else
      activeTabName.value = ''
  }).catch(() => {
    // do nothing
  });
  
}
function addNewSeq() {
  tester.value.seqList.push({
    name: `Seq${tester.value.seqList.length}`,
    services: []
  })
  activeTabName.value = `index${tester.value.seqList.length - 1}`
}

const project = useProjectStore()

function startSeq() {
  if (start.value == false&&tester.value.targetDeviceId) {
    for (const v of Object.values(subSeqRef.value)) {
      v?.clear()
    }
    if (window.globalStart.value == false) {
      ElMessageBox.alert('Sequence can only be start during a running measurement', 'Warning', {
        confirmButtonText: 'OK',
        type: 'warning',
        buttonSize: 'small',
        appendTo: `#win${props.editIndex}_sequence`
      });
      return
    }
    start.value = true
    const seqIndex = parseInt(activeTabName.value.replace('index', ''))
    window.electron.ipcRenderer.invoke('ipc-run-sequence', project.projectInfo.path, project.projectInfo.name, 
    cloneDeep(tester.value),cloneDeep(dataBase.devices[tester.value.targetDeviceId]), seqIndex, seqCycle.value)
      .catch((e) => {
        console.log(e)
      }).finally(() => {
        start.value = false
      })
  }

}
function stopSeq() {
  if (start.value == true) {
    window.electron.ipcRenderer.invoke('ipc-stop-sequence', props.editIndex)
    start.value = false
  }
}

const tableHeight = computed(() => {
  return h.value - 45
})

onBeforeMount(() => {
  if (tester.value.seqList.length > 0)
    activeTabName.value = `index${0}`

});

</script>
<style scoped>
.seqTabs {
  height: v-bind(tableHeight + 'px') !important;

}
</style>
<style lang="scss">
.seqTabs1 {

  .el-tabs__content {
    padding: 0px !important;

  }
}

.tools {
  margin: 5px;
  margin-left: 10px;
  margin-right: 10px;
  padding: 4px;
  border: 1px dashed var(--el-color-info-light-5);
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.custom-tabs-label {
  width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  height: 20px;

}

.icon {
  font-size: 20px;
}
</style>
