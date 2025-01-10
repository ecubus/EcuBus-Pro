<template>
  <div class="main" v-loading="loading">
    <div class="left">
      <el-scrollbar :height="h + 'px'">
        <el-tree ref="treeRef" class="serviceTree" node-key="id" :id="editIndex + 'tree'" default-expand-all
          :data="tData" highlight-current style="margin-right: 5px; padding: 5px" :expand-on-click-node="false"
          @node-click="nodeClick">
          <template #default="{ node, data }">
            <div class="tree-node">
              <span :class="{
                isServiceTop: !(data.id == data.serviceId),
                isJob: data.id == 'Job' || node.parent?.data.id == 'Job',
                treeLabel: true
              }">{{ node.label }}
                <span v-if="data.parent && data.serviceId != 'Job'">({{ data.serviceId }})</span></span>
              <el-button :disabled="globalStart" link v-if="data.parent" type="primary"
                @click.stop="addNewService(data.label, data.serviceId)">

                <Icon :icon="circlePlusFilled" />
              </el-button>
              <el-button :disabled="globalStart" link v-else type="danger"
                @click.stop="removeService(data.serviceId, data.id)">
                <Icon class="tree-delete" :icon="removeIcon" />
              </el-button>
            </div>
          </template>
        </el-tree>
      </el-scrollbar>
    </div>
    <div class="shift" id="testerServiceShift" />
    <div class="right">
      <el-form :disabled="globalStart" v-if="activeService" :model="model" label-width="140px" size="small"
        class="hardware" ref="ruleFormRef" :rules="rules" hide-required-asterisk>
        <el-form-item label="Name" prop="name" required>
          <el-input v-model="model.name" style="width: 100%" @change="reqParamChange" />
        </el-form-item>
        <!-- <el-form-item label="Sub Function" prop="subfunc" v-if="model.serviceId != 'Job'"
          :disabled="!serviceDetail[model.serviceId].hasSubFunction">
          <el-select v-model="model.subfunc"
            :disabled="!serviceDetail[model.serviceId].hasSubFunction" @change="subFuncChange">
            <el-option v-for="item in subfuncOptions" :key="item.name" :label="item.name" :value="item.subFunction">
              <span style="float: left">{{ item.name }}</span>
              <span style="
                  display: flex;
                  align-items: center;
                  float: right;
                  color: var(--el-text-color-secondary);
                  font-size: 13px;
                " :style="{
                  'margin-right': item.deleted ? '0px' : '13px'
                }">{{ item.subFunction }}
                <Icon :icon="closeIcon" v-if="item.deleted" class="subClose" @click.stop="deleteSubFunc(item)" />
              </span>
            </el-option>
            <template #footer>
              <el-button v-if="!isAdding" text bg size="small" @click="onAddOption">
                Add Sub Function
              </el-button>
              <template v-else>
                <el-form :inline="true" :model="optionVal" :rules="subFuncRules" ref="subFuncRef">
                  <el-form-item label="Name" prop="name">
                    <el-input v-model="optionVal.name" />
                  </el-form-item>
                  <el-form-item label="SubFunc" prop="subFunction">
                    <el-input v-model="optionVal.subFunction" />
                  </el-form-item>
                </el-form>
                <el-button type="primary" size="small" @click="onConfirm"> confirm </el-button>
                <el-button size="small" @click="clear"> cancel </el-button>
              </template>
            </template>
          </el-select>
         
        </el-form-item> -->
        <el-form-item label="Job Description" v-if="model.serviceId == 'Job'">
          <el-input v-model="model.desc" style="width: 100%" @change="reqParamChange" :rows="2" type="textarea" />
        </el-form-item>
        <el-form-item label-width='0' v-if="model.serviceId != 'Job'">
          <el-col :span="12">
            <el-form-item label="AutoSync Func / ID" prop="serviceId" required>
              <el-checkbox v-model="model.autoSubfunc" @change="reqParamChange" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Suppress Response" prop="serviceId" required>
              <el-checkbox v-model="model.suppress" :disabled="!serviceDetail[model.serviceId].hasSubFunction"
                @change="suppressChange" />
            </el-form-item>
          </el-col>
        </el-form-item>

        <el-form-item label="TX PDU" v-if="model.serviceId != 'Job'">
          <div style="white-space: nowrap; overflow-x: auto">
            <span v-for="(item, index) in reqArrayStr" :key="index" :style="{
              backgroundColor:
                index % 2 == 0
                  ? 'var(--el-color-info-light-9)'
                  : 'var(--el-color-primary-light-9)'
            }" class="param">{{ item }}</span>
          </div>
        </el-form-item>
        <el-form-item label="RX PDU" v-if="model.serviceId != 'Job' && !model.suppress">
          <div style="white-space: nowrap; overflow-x: auto">
            <span v-for="(item, index) in respArrayStr" :key="index" :style="{
              backgroundColor:
                index % 2 == 0
                  ? 'var(--el-color-info-light-9)'
                  : 'var(--el-color-primary-light-9)'
            }" class="param">{{ item }}</span>
          </div>
        </el-form-item>
        <el-alert title="The job requires these request parameters to serve as the function's input arguments."
          style="margin-bottom: 5px" effect="light" type="info" :closable="false" v-if="model.serviceId == 'Job'" />
        <el-alert title="ASCII Param Env Variable" effect="light" style="margin-bottom: 5px" type="success"
          :closable="false" v-if="model.serviceId == 'Job'">
          <template #default>
            <ul style="margin: 0">
              <li><strong>${ProPath}:</strong> project root path</li>
              <li><strong>${ProName}:</strong> project name</li>
              <li><strong>${%serviceName%.serviceId}:</strong> access serviceId by serviceName</li>
              <li><strong>${address.idType}:</strong> get running address idType (CAN)</li>
            </ul>
          </template>
        </el-alert>
        <el-form-item label-width="0px" style="margin-bottom: 0px" prop="params">
          <div style="width: 100%">
            <el-tabs v-model="activeName" type="border-card">
              <el-tab-pane label="Request" name="request">
                <paramVue :parent-id="editIndex" v-model="model.params" ref="repParamRef" :sid="model.id" :id="'req'"
                  :serviceId="model.serviceId" @change="reqParamChange" :other-service="serviceList[model.serviceId]" />
              </el-tab-pane>
              <el-tab-pane label="Response" name="response"
                v-if="model.serviceId != 'Job' && !(serviceDetail[model.serviceId].hasSubFunction && model.suppress)">
                <paramVue :parent-id="editIndex" :sid="model.id" @change="reqParamChange" ref="respParamRef" v-model="model.respParams"
                  :id="'resp'" :serviceId="model.serviceId" :disabled="model.autoSubfunc"
                  :other-service="serviceList[model.serviceId]" />
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-form-item>
        <!-- <el-form-item label-width="0">
          <div style="text-align: left; width: 100%; margin-top:20px">
            <div v-if="!isEdit" style="display: flex; align-items: center; justify-content: flex-start">
              <el-button type="primary" @click="onSubmit" plain>
                Add <span v-if="model.serviceId != 'Job'" style="margin-left: 5px"> Service</span><span v-else
                  style="margin-left: 5px"> Job</span></el-button>
            </div>
            <div v-else style="display: flex; align-items: center; justify-content: flex-start">
              <el-button type="warning" @click="onSubmit" plain>
                Save <span v-if="model.serviceId != 'Job'" style="margin-left: 5px">Service</span><span v-else
                  style="margin-left: 5px">Job</span></el-button>
            </div>
          </div>
        </el-form-item> -->
      </el-form>
      <div v-else class="tips">
        <!-- <div class="button" @click="importOdx">
          <div class="desc">Load from ODX file (ISO-22901)</div>
          <Icon :icon="loadIcon" style="font-size: 35px;color:var(--el-color-info)" />
        </div>
        <div class="button ebp">
          <div class="desc">Load from EBP file (EcuBus-Pro)</div>
          <Icon :icon="loadIcon" style="font-size: 35px;color:var(--el-color-info)"
            @click="addNewService('Service', '0x10')" />
        </div> -->
      </div>

    </div>
    <el-dialog v-if="dialogVisible" v-model="dialogVisible" title="ODX File Import" width="80%"
      :append-to='`#win${editIndex}_services`' align-center :before-close="handleClose">
      <el-form :model="odxForm" label-width="auto" size="small" style="margin:10px" ref="odxFormRef">
        <el-form-item label="Ecu" prop="ecuName" required>
          <el-select v-model="odxForm.ecuName">
            <el-option :label="ecu" :value="ecu" v-for="ecu in ecuList" :key="ecu" />
          </el-select>
        </el-form-item>
        <el-form-item label="Variant" prop="variant" required>
          <el-select v-model="odxForm.variant">
            <el-option :label="v" :value="v" v-for="v in variants[odxForm.ecuName]" :key="v" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelImportOdx" size="small" plain>Cancel</el-button>
          <el-button type="primary" @click="realImportOdx" size="small" plain>
            Import
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="tsx" setup>
import { ServiceItem, param2raw, getTxPduStr, getRxPduStr, Sequence, paramSetVal, paramSetValRaw } from 'nodeCan/uds'
import { cloneDeep } from 'lodash'
import { v4, validate } from 'uuid'
import { Ref, computed, inject, nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import paramVue from './param.vue'
import closeIcon from '@iconify/icons-material-symbols/close'
import { Icon } from '@iconify/vue'
import { type FormRules, type FormInstance, ElMessageBox, ElMessage } from 'element-plus'
import circlePlusFilled from '@iconify/icons-ep/circle-plus-filled'
import removeIcon from '@iconify/icons-ep/remove'
import loadIcon from '@iconify/icons-material-symbols/upload'
import { ServiceId, serviceDetail } from 'nodeCan/service'
import { useDataStore } from '@r/stores/data'
import { Layout } from '@r/views/uds/layout'


const dialogVisible = ref(false)
const loading = ref(false)
const activeService = ref('')
const ruleFormRef = ref<FormInstance>()
const props = defineProps<{
  editIndex: string
  serviceId?: string[]
  width: number,
  height: number
}>()
const h = toRef(props, 'height')
const w = toRef(props, 'width')
const leftWidth = ref(300)
const activeName = ref('request')
const dataBase = useDataStore();
const editIndex = toRef(props, 'editIndex')
const serviceList = toRef(dataBase.tester[editIndex.value], 'allServiceList')
const sequence = toRef(dataBase.tester[editIndex.value], 'seqList')
const treeRef = ref()
const ecuList = ref<string[]>([])
const variants = ref<string[]>([])
const odxForm = ref({
  ecuName: '',
  variant: ''
})
const repParamRef = ref()
const respParamRef = ref()
const globalStart = toRef(window, 'globalStart')
const layout = inject('layout') as Layout


function nodeClick(data: any) {
  ruleFormRef.value?.clearValidate()

  const targetService = serviceList.value[data.serviceId]


  if (!data.parent && targetService) {
    activeService.value = data.serviceId
    const index = targetService.findIndex((item) => item.id == data.id)
    if (index > -1) {

      model.value = cloneDeep(targetService[index])

    }

  } else {

    activeService.value = ''
  }

}
function removeService(serviceId: ServiceId, id: string) {
  // if(activeService.value&&dataModify.value&&id!=model.value.id){
  //   treeRef.value.setCurrentKey(model.value.id)
  //   ElMessageBox.confirm('Are you sure to leave without saving?', 'Warning', {
  //     confirmButtonText: 'OK',
  //     cancelButtonText: 'Cancel',
  //     type: 'warning',
  //     buttonSize: 'small',
  //     appendTo: `#win${editIndex.value}_services`
  //   }).then(() => {
  //      dataModify.value = false
  //      removeService(serviceId,id)
  //   })
  //   return
  // }
  const targetService = serviceList.value[serviceId]
  if (targetService) {
    const name = targetService.find((item) => item.id == id)?.name
    ElMessageBox.confirm(`Are you sure to delete this ${name}`, 'Warning', {
      confirmButtonText: 'OK',
      cancelButtonText: 'Cancel',
      type: 'warning',
      buttonSize: 'small',
      appendTo: `#win${editIndex.value}_services`
    }).then(() => {
      for (const seq of sequence.value) {
        for (const [index, s] of seq.services.entries()) {
          if (s.serviceId == id) {
            ElMessageBox.alert(
              `This service is used in sequence ${seq.name}[${index}], please remove it first`,
              'Warning',
              {
                confirmButtonText: 'OK',
                type: 'warning',
                buttonSize: 'small',
                appendTo: `#win${editIndex.value}_services`
              }
            )
            return
          }
        }
      }

      const index = targetService.findIndex((item) => item.id == id)
      if (index > -1) {
        targetService.splice(index, 1)
      }
      treeRef.value.remove(treeRef.value.getNode(id))

      activeService.value = ''
    })
  }
}

function addNewService(name: string, id: ServiceId) {


  let deletedCnt = 0

  serviceDetail[id].defaultParams.map((item) => {
    if (item.param.deletable == false) {
      deletedCnt++
    }
  })
  if (deletedCnt == 0 && serviceList.value[id]?.length&&id!='Job') {
    ElMessageBox({
      message: "This service may only be created once.",
      type: "warning",
      title: "Warning",
      buttonSize: 'small',
      appendTo: `#win${editIndex.value}_services`
    })
    return
  }

  // treeRef.value.setCurrentKey(id)
  activeService.value = id



  model.value = {
    id: v4(),
    name: '',
    serviceId: id,
    params: [],
    respParams: [],
    suppress: false,
    autoSubfunc: true,

  }
  if (serviceList.value[id] == undefined) {
    serviceList.value[id] = []
  }
  const targetService = serviceList.value[id]
  let q = ''
  if (id == 'Job') {
    q = ''
  } else {
    q = Number(id).toString()
    if (serviceDetail[id].defaultParams) {
      for (const p of serviceDetail[id].defaultParams) {
        const s = cloneDeep(p.param)
        s.id = v4()
        model.value.params.push(s)

      }
    }
    if (serviceDetail[id].defaultRespParams) {
      for (const p of serviceDetail[id].defaultRespParams) {
        const s = cloneDeep(p.param)
        s.id = v4()
        model.value.respParams.push(s)
      }
    }
  }
  for (const [index, p] of model.value.params.entries()) {
    if (p.deletable == false) {
      // 将当前值转换为十六进制数值
      const currentValue = parseInt(p.value.toString('hex'), 16);
      let maxValue = currentValue;

      // 查找所有目标服务中的最大值
      for (const v of targetService) {
        const b = Buffer.from(v.params[index].value);
        const compareValue = parseInt(b.toString('hex'), 16);

        if (compareValue >= maxValue) {
          maxValue = compareValue;
        }
      }

      // 如果当前值不是唯一的，使用最大值+1
      if (maxValue >= currentValue) {
        // 将新值转回Buffer
        const newValueHex = (maxValue + 1).toString(16).padStart(p.value.length * 2, '0');
        p.value = Buffer.from(newValueHex, 'hex');
        if (p.value.length * 8 > p.bitLen) {
          activeService.value = ''
          ElMessageBox({
            message: "The value is out of range",
            type: "warning",
            title: "Warning",
            buttonSize: 'small',
            appendTo: `#win${editIndex.value}_services`
          })
          return
        }
      }
      paramSetValRaw(p, p.value)
      reqParamChange();
      break;
    }
  }
  if (targetService == undefined) {
    model.value.name = name + q + '0'
  } else {
    /*unique name */
    let i = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (targetService.findIndex((item) => item.name == name + q + i) == -1) {
        model.value.name = name + q + i
        break
      }
      i++
    }
  }

  serviceList.value[id].push(cloneDeep(model.value))

  treeRef.value.append(
    {
      label: model.value.name,
      id: model.value.id,
      serviceId: id,
      parent: false
    },
    id
  )
  treeRef.value.setCurrentKey(model.value.id)

}

const odxFormRef = ref<FormInstance>()
let importData: any

function handleClose(done: () => void) {
  null
}
function cancelImportOdx() {
  dialogVisible.value = false
  window.electron.ipcRenderer.send('ipcCloseOdxParse', editIndex.value)
}

function reqParamChange() {

  if (model.value.autoSubfunc) {
    for (const v of model.value.params) {
      if (v.deletable == false) {
        const respParam = model.value.respParams.find((item) => item.name == v.name)
        if (respParam) {
          respParam.value = Buffer.from(v.value)
          respParam.phyValue = cloneDeep(v.phyValue)
        }
      }
    }
  }
  onSubmit()
}

function realImportOdx() {
  if (importData) {
    odxFormRef.value?.validate((valid) => {
      if (valid) {
        const ecu = odxForm.value.ecuName
        const variant = odxForm.value.variant
        if (Object.prototype.hasOwnProperty.call(importData, ecu) && Object.prototype.hasOwnProperty.call(importData[ecu], variant)) {
          const data = importData[ecu][variant] as Record<string, ServiceItem[]>
          for (const key of Object.keys(data)) {
            const parent = treeRef.value.getNode(key)
            for (const addItem of data[key]) {

              if (serviceList.value[key] == undefined) {
                serviceList.value[key] = []
              }
              if (addItem.subfunc) {
                addItem.autoSubfunc = true
                addItem.suppress = false
              }
              serviceList.value[key].push(addItem)
              treeRef.value.append(
                {
                  label: addItem.name,
                  id: addItem.id,
                  serviceId: key,
                  parent: false
                },
                parent
              )
            }



          }
          dialogVisible.value = false
          ElMessage.success('Import success')
        } else {
          ElMessage.error('Ecu or variant not found')
        }
      }
    })
  }
  dialogVisible.value = false
}
function importOdx() {
  ElMessage.warning('Unsupported')
  return
  // window.electron.ipcRenderer.invoke('ipcShowOpenDialog', {
  //   title: 'Select ODX file',
  //   filters: [{ name: 'ODX', extensions: ['odx', 'pdx', 'xml','odx-cs','odx-c'] }],
  //   properties: ['openFile']
  // }).then((res) => {
  //   if (res.canceled) {
  //     return
  //   } else {
  //     loading.value = true
  //     window.electron.ipcRenderer.invoke('ipcOdxParse', editIndex.value, res.filePaths[0]).then((res) => {
  //       if (res.error == 0) {
  //         dialogVisible.value = true
  //         console.log(res.data)
  //         importData = res.data
  //         ecuList.value = Object.keys(res.data)
  //         for (const ecu of ecuList.value) {
  //           variants.value[ecu] = Object.keys(res.data[ecu])
  //         }
  //         if (ecuList.value.length > 0) {
  //           odxForm.value.ecuName = ecuList.value[0]
  //           odxForm.value.variant = variants.value[ecuList.value[0]][0]
  //         }
  //       } else {
  //         ElMessage.error(res.message)
  //       }
  //     }).catch((err) => {
  //       ElMessage.error(err.message)
  //     }).finally(() => {
  //       loading.value = false
  //     })
  //   }
  // }).catch((err) => {
  //   ElMessage.error(err.message)
  // })
}
interface tree {
  label: string
  parent: boolean
  id: string
  serviceId: string
  isSeq?: boolean
  children?: tree[]
}
const tData = ref<tree[]>([])
function buildTree() {
  const t: tree[] = []
  for (const key of Object.keys(serviceDetail)) {
    const serviceId = key
    const s: tree[] = []
    if (serviceList.value[key]) {
      for (const vvv of serviceList.value[key]) {
        s.push({
          label: vvv.name,
          parent: false,
          id: vvv.id,
          serviceId: serviceId
        })
      }
    }

    t.push({
      label: serviceDetail[key].name,
      parent: true,
      id: key,
      serviceId: serviceId,
      children: s
    })
  }
  tData.value = t
}
// watch(
//   serviceList,
//   () => {
//     buildTree()
//   },
//   { deep: true }
// )


const reqArrayStr = computed(() => {
  return getTxPduStr(model.value)
})
const respArrayStr = computed(() => {
  return getRxPduStr(model.value)
})
const model = ref<ServiceItem>({
  id: v4(),
  name: 'DiagnosticSessionControl16',
  serviceId: '0x10',
  params: [],
  respParams: [],
  autoSubfunc: true,
})

function suppressChange(val) {

  const lastVal = model.value.params[0].value[0]
  if (val) {
    paramSetVal(model.value.params[0], lastVal | 0x80)
  } else {
    paramSetVal(model.value.params[0], lastVal & 0x7f)
  }
  reqParamChange()
}


const paramCheck = (rule: any, value: any, callback: any) => {
  const ps = [model.value.params, model.value.respParams]
  for (const [i, q] of ps.entries()) {
    const indexStr = i == 0 ? 'Req' : 'Resp'
    for (const [index, p] of q.entries()) {
      if (p.name == '') {
        callback(new Error(`[${index}]${indexStr}Param name can't be empty`))
        return
      }
      if (p.type == 'ASCII') {
        if (p.phyValue == '') {
          callback(new Error(`[${index}]${indexStr}Param value can't be empty`))
          return
        }
      }
    }
    /* make sure name is unique */
    for (const q of ps) {
      for (const [index, p] of q.entries()) {
        if (p.name) {
          const nameList = q.map((item) => item.name)
          nameList.splice(index, 1)
          const indexx = nameList.findIndex((item) => item == p.name)
          if (indexx > -1) {
            callback(new Error(`[${index}]${indexStr}Param name must be unique`))
            return
          }
        }
      }
    }
  }
  callback()
}

const globalNameCheck = (rule: any, value: any, callback: any) => {
  const names: { name: string, id: string }[] = []
  for (const item of Object.values(serviceList.value)) {
    if (item) {
      for (const i of item) {
        names.push({ name: i.name, id: i.id })
      }
    }
  }
  const index = names.findIndex((item) => item.name == value)
  if (index > -1 && names[index].id != model.value.id) {
    callback(new Error('Name already exists'))
  }
  callback()
}
const rules: FormRules = {
  name: [
    { required: true, message: 'Please input addr name', trigger: 'blur' },
    { validator: globalNameCheck, trigger: 'blur' }
  ],
  params: [{ validator: paramCheck, trigger: 'blur' }],
  serviceId: [{ required: true, message: 'Please choose service', trigger: 'change' }],
}

function onSubmit() {
  ruleFormRef.value?.clearValidate()
  nextTick(() => {
    ruleFormRef.value?.validate((valid) => {
      if (valid) {
        let r = repParamRef.value?.valid()

        if (r == false) {
          return
        }
        r = respParamRef.value?.valid()

        if (r == false) {
          return
        }

        const serviceId = model.value.serviceId
        if (serviceList.value[serviceId] == undefined) {
          serviceList.value[serviceId] = []
        }
        const index = serviceList.value[serviceId].findIndex(
          (item) => item.id == model.value.id
        )

        if (index > -1) {
          const t = cloneDeep(model.value)
          t.id = serviceList.value[serviceId][index].id
          serviceList.value[serviceId][index] = t
          const node = treeRef.value.getNode(t.id)
          node.data.label = t.name
        }
      }
    })
  })

}

function viewService(serviceId: string, id: string) {
  treeRef.value.setCurrentKey(id)
  activeService.value = serviceId
  if (serviceList.value[serviceId]) {

    const index = serviceList.value[serviceId].findIndex((item) => item.id == id)
    if (index > -1) {

      model.value = cloneDeep(serviceList.value[serviceId][index])
    }
  }

}
defineExpose({
  viewService
})



onMounted(() => {
  window.jQuery('#testerServiceShift').resizable({
        handles:'e',
        // resize from all edges and corners
        resize: (e, ui) => {

            leftWidth.value = ui.size.width
           
        },
        maxWidth:400,
        minWidth:200,
    })
  

  nextTick(() => {
    buildTree()
    if (props.serviceId) {
      const serviceId = props.serviceId[0]
      const id = props.serviceId[1]
      viewService(serviceId, id)
    }
  })
})
</script>
<style>
.serviceTree .el-tree-node__content {
  height: 20px !important;
}
</style>
<style scoped>
.tips {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  flex-direction: column;
}

.button {
  padding: 10px;
  border: 2px dashed var(--el-border-color);
  border-radius: 5px;
  text-align: center;
  margin: 10px;
}

.button .desc {
  font-size: 16px;
  color: var(--el-color-info);
  padding: 5px;
}

.button:hover {
  cursor: pointer;
  border: 2px dashed var(--el-color-primary-dark-2);
}

.isServiceTop {
  font-weight: bold;
}

.isJob {
  color: var(--el-color-primary-dark-2);
}

.left {
  position: absolute;
  top: 0px;
  left: 0px;
  width: v-bind(leftWidth + 'px');
  z-index: 1;
}

.shift {
  position: absolute;
  top: 0px;
  left: 0px;
  width: v-bind(leftWidth + 1 + 'px');
  height: v-bind(h + 'px');
  z-index: 0;
  border-right: solid 1px var(--el-border-color);
}

.tree-add {
  color: var(--el-color-primary);
}

.tree-add:hover {
  color: var(--el-color-primary-dark-2);
  cursor: pointer;
}

.tree-delete {
  color: var(--el-color-danger);
}

.tree-delete:hover {
  color: var(--el-color-danger-dark-2);
  cursor: pointer;
}

.shift:hover {
  border-right: solid 4px var(--el-color-primary);
}

.shift:active {
  border-right: solid 4px var(--el-color-primary);
}

.hardware {
  margin: 20px;
}

.tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  padding-right: 5px;
}

.right {
  position: absolute;
  left: v-bind(leftWidth + 5 + 'px');
  width: v-bind(w - leftWidth - 6 + 'px');
  height: v-bind(h + 'px');
  z-index: 0;
  overflow: auto;
}

.main {
  position: relative;
  height: v-bind(h + 'px');
  width: v-bind(w + 'px');
}

.el-tabs {
  --el-tabs-header-height: 24 !important;
}

.addr {
  border: 1px solid var(--el-border-color);
  border-radius: 5px;
  padding: 5px;
  max-height: 200px;
  min-height: 50px;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
  display: block;
  position: relative;
}

.addrClose {
  position: absolute;
  right: 5px;
  top: 5px;
  width: 12px;
  height: 12px;
}

.addrClose:hover {
  color: var(--el-color-danger);
  cursor: pointer;
}

.subClose {
  z-index: 100;
}

.subClose:hover {
  color: var(--el-color-danger);
  cursor: pointer;
}

.param {
  margin-right: 5px;
  border-radius: 2px;
}

.treeLabel {
  display: inline-block;
  white-space: nowrap;
  /* 保证内容不会换行 */
  overflow: hidden;
  /* 超出容器部分隐藏 */
  text-overflow: ellipsis;
  /* 使用省略号表示超出部分 */
  width: v-bind(leftWidth - 100 + 'px') !important;
}
</style>