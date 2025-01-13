<template>
  <div>
  <div :id="tableId">
    <VxeGrid ref="xGrid" v-bind="gridOptions" class="sequenceTable" :data="data.services" @cell-click="ceilClick">
      <template #default_drag>
        <el-icon :id="'sequenceDragBtn' + props.id + props.index" class="drag-btn" @mouseenter="rowDrop">
          <Grid />
        </el-icon>
      </template>
      <template #default_enable="{ row }">
        <el-checkbox size="small" v-model="row.enable" />
      </template>
      <template #edit_name="{ row }">
        <div>
          <el-select size="small" v-model="row.serviceId" :disabled="props.disabled">
            <el-option v-for="item in services" :key="item.id" :label="item.name" :value="item.id">
              <span style="float: left">{{ item.name }}</span>
              <span style="float: right; color: var(--el-text-color-secondary); font-size: 13px">{{ item.serviceId
                }}</span>
            </el-option>
          </el-select>
        </div>
      </template>
      <template #default_name="{ row }">
        <span>{{ services[row.serviceId]?.name || 'NULL' }}</span>
      </template>
      <template #edit_addr="{ row }">
        <div>
          <el-select size="small" v-model="row.addressIndex" :disabled="props.disabled">
            <el-option v-for="item, index in addrs" :key="index" :label="getUdsAddrName(item)" :value="index" />
          </el-select>
        </div>
      </template>
      <template #edit_delay="{ row }">
        <el-input-number v-model="row.delay" size="small" controls-position="right" :min="0" style="width:100%"
          :disabled="props.disabled" />
      </template>
      <template #edit_retryNum="{ row }">
        <el-input-number v-model="row.retryNum" size="small" controls-position="right" :min="0" style="width:100%"
          :disabled="props.disabled" />
      </template>
      <template #default_addr="{ row }">
        <span style="font-size: 12px;">{{ getUdsAddrName(addrs[row.addressIndex]) }}</span>
      </template>
      <template #default_type="{ row }">
        <el-tag type="primary">
          {{ row.type }}
        </el-tag>
      </template>
      <template #edit_desc="{ row }">
        <el-input v-model="row.desc" size="small" />
      </template>

      <template #default_checkResp="{ row }">
        <el-switch v-model="row.checkResp" size="small" inline-prompt active-text="Y" inactive-text="N"
          :disabled="props.disabled" />
      </template>
      <template #default_failBehavior="{ row }">
        <!-- <el-radio-group v-model="row.failBehavior" size="small">
          <el-radio-button value="stop">Stop</el-radio-button>
          <el-radio-button value="continue">Continue</el-radio-button>
        </el-radio-group> -->

        <span :class="{
          'warning': row.failBehavior == 'continue',
          'bold': true
        }">{{ row.failBehavior.toUpperCase() }}</span>
      </template>
      <template #edit_failBehavior="{ row }">
        <el-select v-model="row.failBehavior" size="small" :disabled="props.disabled">
          <el-option value="stop" label="Stop" />
          <el-option value="continue" label="Continue" />
        </el-select>
      </template>
      <template #toolbar>
        <div style="justify-content: flex-end;display: flex;align-items: center;gap:2px;margin-right: 10px">
          <span style="color:var(--el-color-info);font-weight:bold">NAME:</span>

          <el-input v-model="data.name" size="small" style="width:100px;margin:4px;" />
          <el-divider direction="vertical" />
          <el-button-group>
            <el-tooltip effect="light" content="Add a new service" placement="bottom" >
              <el-button type="primary" link size="small" @click="addService" :disabled="props.disabled">
                <Icon :icon="circlePlusFilled" class="icon" />
              </el-button>
            </el-tooltip>
            <el-tooltip effect="light" content="Remove" placement="bottom" >
              <el-button type="danger" link size="small" :disabled="actionRow == -1 || props.disabled"
                @click="deleteService">
                <Icon :icon="removeIcon" class="icon" />
              </el-button>
            </el-tooltip>
          </el-button-group>
        </div>
      </template>
    </VxeGrid>
  </div>
</div>
</template>

<script lang="tsx" setup>
import { v4 } from 'uuid'
import { Sequence, SequenceItem, ServiceItem, UdsAddress, getUdsAddrName } from 'nodeCan/uds'
import { onMounted, ref, nextTick, computed, toRef, Ref, onUnmounted, watch } from 'vue'
import Sortable from 'sortablejs'
import { Icon } from '@iconify/vue'
import { cloneDeep } from 'lodash'
import { VxeGridProps } from 'vxe-table'
import { VxeGrid } from 'vxe-table'
import { ServiceId } from 'nodeCan/service'
import circlePlusFilled from '@iconify/icons-material-symbols/add-circle-outline'
import removeIcon from '@iconify/icons-material-symbols/remove-rounded'
import { useDataStore } from '@r/stores/data'

const props = defineProps<{
  id: string
  index: number
  height: number
  disabled: boolean
}>()
const data = defineModel<Sequence>({
  required: true
})
const xGrid = ref()
watch(() => props.disabled, (val) => {
  if (val) {
    excuseResults.value.forEach((item) => {
      item.status = 'notStart'
      item.msg = 'Not Start'
    })

  }
})



const database = useDataStore()
const services = computed(() => {
  const t: Record<string, ServiceItem> = {}
  const testerServices = database.tester[props.id].allServiceList
  for (const item of Object.values(testerServices)) {
    for (const s of item) {
      t[s.id] = s
    }
  }
  return t
})
const addrs = computed(() => {
  return database.tester[props.id].address
})


const gridOptions = computed(() => {
  const v: VxeGridProps<SequenceItem> = {
    border: true,
    size: "mini",
    height: props.height,
    columnConfig: {
      resizable: true,
    },
    showOverflow: false,
    rowConfig: {
      isCurrent: true,
      useKey: true

    },
    id: `sequenceTable${props.id}${props.index}`,
    editConfig: {
      trigger: 'click',
      mode: 'cell',
      beforeEditMethod({ columnIndex }) {
        if (props.disabled) {
          return false
        }
        if (columnIndex == 0 || columnIndex == 1 || columnIndex == 5 || columnIndex == 9) {
          return false
        }
        return true
      },
      showIcon: false
    },
    toolbarConfig: {
      slots: {
        tools: 'toolbar'
      }
    },
    align: 'center',
    columns: [
      { field: 'drag', title: '', width: 36, resizable: false, editRender: {}, slots: { default: 'default_drag' } },
      { field: 'enable', title: 'EN', width: 40, resizable: false, editRender: {}, slots: { default: 'default_enable' } },
      { field: 'service', title: 'Service', minWidth: 200, editRender: {}, slots: { edit: 'edit_name', default: 'default_name' } },
      { field: 'addr', title: 'Address', width: 200, editRender: {}, slots: { edit: 'edit_addr', default: 'default_addr' } },
      { field: 'delay', title: 'Delay', width: 200, editRender: {}, slots: { edit: 'edit_delay' } },
      { field: 'checkResp', title: 'Check Resp', width: 100, resizable: false, editRender: {}, slots: { default: 'default_checkResp' } },
      { field: 'retryNum', title: 'Retry', width: 200, editRender: {}, slots: { edit: 'edit_retryNum' } },
      { field: 'failBehavior', title: 'Failed Action', width: 200, editRender: {}, slots: { default: 'default_failBehavior', edit: 'edit_failBehavior' } },
      { field: 'desc', title: 'Description', width: 100, editRender: {}, slots: { edit: 'edit_desc' } },
      {
        field: 'status', title: 'Execute Status', fixed: 'right', width: 160, resizable: false, editRender: {}, slots: {
          default: ({ rowIndex}) => {
          
            const getStatusClass = () => {
              const status = excuseResults.value[rowIndex]?.status;
              switch (status) {
                case 'finished': return 'seq-success';
                case 'error': return 'seq-error';
                case 'notStart': return 'seq-notStart';
                case 'start': return 'seq-start';
                case 'progress': return 'seq-start';
                default: return '';
              }
            };

            return (
              <div class={getStatusClass()}>
                {excuseResults.value[rowIndex]?.msg}
              </div>
            );
          }
        }
      },

    ],
  }
  return v
})

const excuseResults = ref<{
  status: 'error' | 'notStart' | 'progress' | 'start' | 'finished'
  msg: string
  percent?: string
}[]>([])
function addService() {
  data.value.services.push({
    enable: true,
    checkResp: true,
    retryNum: 0,
    addressIndex: 0,
    failBehavior: 'stop',
    serviceId: '',
    delay: 50
  })
  actionRow.value = -1
  excuseResults.value.push({
    status: 'notStart',
    msg: 'Not Start'
  })
  xGrid.value?.clearCurrentRow()
}


function deleteService() {
  if (actionRow.value != -1) {
    data.value.services.splice(actionRow.value, 1)
    excuseResults.value.splice(actionRow.value, 1)
  }
  actionRow.value = -1
  xGrid.value?.clearCurrentRow()
}
const tableId = computed(() => {
  return `sequenceTable${props.id}${props.index}`
})
const actionRow = ref(-1)

function ceilClick(val: any) {
  actionRow.value = val.rowIndex;
}

function error(vals: LogItem[]) {
  for (const val of vals) {
    if (val.message.id != props.id) {
      continue
    }
    for (let i = 0; i < excuseResults.value.length; i++) {
      if (excuseResults.value[i].status == 'progress' || excuseResults.value[i].status == 'start') {
        excuseResults.value[i].status = 'error'
        excuseResults.value[i].msg = 'Error'
        break
      }
    }
  }
 
}


const rowDrop = (event: { preventDefault: () => void }) => {
  event.preventDefault()
  nextTick(() => {
    const wrapper = document.querySelector(
      `#${tableId.value} tbody`
    ) as HTMLElement
    Sortable.create(wrapper, {
      animation: 300,
      handle: `#sequenceDragBtn${props.id}${props.index}`,
      onEnd: ({ newIndex, oldIndex }) => {
        if (newIndex === oldIndex) return
        if (newIndex == undefined || oldIndex == undefined) return
        const currentRow = data.value.services.splice(oldIndex, 1)[0]
        data.value.services.splice(newIndex, 0, currentRow)
        const currentResult = excuseResults.value.splice(oldIndex, 1)[0]
        excuseResults.value.splice(newIndex, 0, currentResult)
        // xGrid.value?.reloadData(data.value.services)
      }
    })
  })
}
interface LogItem {
  level: string,
  label: string,
  message: {
    id: string,
    data: {
      action: 'start' | 'finished' | 'progress'
      index: number
      percent?: number
    },
    method: string
  }

}
function logDisplay(vals: LogItem[]) {
  for (const val of vals) {
    if (val.message.id != props.id) {
      continue
    }
    excuseResults.value[val.message.data.index].status = val.message.data.action
    if (val.message.data.action == 'start') {
      excuseResults.value[val.message.data.index].msg = 'Running'
    } else if (val.message.data.action == 'finished') {
      excuseResults.value[val.message.data.index].msg = 'Success'
    }
    if (val.message.data.percent) {
      excuseResults.value[val.message.data.index].msg = val.message.data.percent.toFixed(2) + '%'
    }
  }
  
}
function clear(){
  
  for (let i = 0; i < excuseResults.value.length; i++) {
    excuseResults.value[i].status = 'notStart'
    excuseResults.value[i].msg = 'Not Start'
  }
}


defineExpose({
  clear
})


onMounted(() => {
  for (let i = 0; i < data.value.services.length; i++) {
    excuseResults.value.push({
      status: 'notStart',
      msg: 'Not Start'
    })
  }
  window.logBus.on('udsIndex', logDisplay)
  window.logBus.on('udsError', error)
  
})
onUnmounted(() => {
  window.logBus.detach('udsIndex', logDisplay)
  window.logBus.detach('udsError', error)
})

</script>

<style>
.error-row {
  background-color: var(--el-color-danger-light-9) !important;
}

.sequenceTable {
  --vxe-ui-table-column-padding-mini: 2px 0px;
}

.seq-success {
  width: 100%;
  height: 100%;
  color: var(--el-color-white);
  background-color: var(--el-color-success);
}

.seq-error {
  width: 100%;
  height: 100%;
  color: var(--el-color-white);
  background-color: var(--el-color-danger);
}

.seq-notStart {
  width: 100%;
  height: 100%;
  /* color:var(--el-color-white); */
  background-color: var(--el-color-info-light-5);
}

.seq-start {
  width: 100%;
  height: 100%;
  color: var(--el-color-white);
  background-color: var(--el-color-primary);
}
</style>
<style scoped>
.drag-btn {
  cursor: move;
}



.bold {
  font-weight: bold;
}


.warning {
  color: var(--el-color-warning);
}
</style>
