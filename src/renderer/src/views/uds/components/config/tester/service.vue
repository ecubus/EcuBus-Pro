<template>
  <div v-loading="loading" class="main">
    <div class="left">
      <el-scrollbar :height="h + 'px'">
        <el-tree
          :id="editIndex + 'tree'"
          ref="treeRef"
          class="serviceTree"
          node-key="id"
          default-expand-all
          :data="tData"
          highlight-current
          style="margin-right: 5px; padding: 5px"
          :expand-on-click-node="false"
          @node-click="nodeClick"
        >
          <template #default="{ node, data }">
            <div class="tree-node">
              <span
                :class="{
                  isServiceTop: !(data.id == data.serviceId),
                  isJob:
                    checkServiceId(data.id, ['job']) ||
                    checkServiceId(node.parent?.data.id, ['job']),

                  treeLabel: true
                }"
                >{{ node.label }}
                <span v-if="data.parent && checkServiceId(data.serviceId, ['uds'])"
                  >({{ data.serviceId }})</span
                ></span
              >
              <el-button
                v-if="data.parent"
                :disabled="globalStart"
                link
                type="primary"
                @click.stop="addNewService(data.label, data.serviceId)"
              >
                <Icon :icon="circlePlusFilled" />
              </el-button>
              <el-button
                v-else
                :disabled="globalStart"
                link
                type="danger"
                @click.stop="removeService(data.serviceId, data.id)"
              >
                <Icon class="tree-delete" :icon="removeIcon" />
              </el-button>
            </div>
          </template>
        </el-tree>
      </el-scrollbar>
    </div>
    <div id="testerServiceShift" class="shift" />
    <div class="right">
      <el-form
        v-if="activeService"
        ref="ruleFormRef"
        :disabled="globalStart"
        :model="model"
        label-width="140px"
        size="small"
        class="hardware"
        :rules="rules"
        hide-required-asterisk
        @submit.prevent
      >
        <el-form-item label="Name" prop="name" required>
          <el-input v-model="model.name" style="width: 100%" @change="reqParamChange" />
        </el-form-item>
        <template v-if="checkServiceId(model.serviceId, ['uds'])">
          <el-form-item label-width="0">
            <el-col :span="12">
              <el-form-item label="AutoSync Func / ID" prop="serviceId" required>
                <el-checkbox v-model="model.autoSubfunc" @change="reqParamChange" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="Suppress Response" prop="serviceId" required>
                <el-checkbox
                  v-model="model.suppress"
                  :disabled="!serviceDetail[model.serviceId].hasSubFunction"
                  @change="suppressChange"
                />
              </el-form-item>
            </el-col>
          </el-form-item>

          <el-form-item label="TX PDU">
            <div style="white-space: nowrap; overflow-x: auto">
              <span
                v-for="(item, index) in reqArrayStr"
                :key="index"
                :style="{
                  padding: '1px',
                  backgroundColor:
                    index % 2 == 0
                      ? 'var(--el-color-info-light-7)'
                      : 'var(--el-color-primary-light-7)'
                }"
                class="param"
                >{{ item }}</span
              >
            </div>
          </el-form-item>
          <el-form-item v-if="!model.suppress" label="RX PDU">
            <div style="white-space: nowrap; overflow-x: auto">
              <span
                v-for="(item, index) in respArrayStr"
                :key="index"
                :style="{
                  padding: '1px',
                  backgroundColor:
                    index % 2 == 0
                      ? 'var(--el-color-info-light-7)'
                      : 'var(--el-color-primary-light-7)'
                }"
                class="param"
                >{{ item }}</span
              >
            </div>
          </el-form-item>
        </template>
        <template v-else>
          <el-form-item label="Description">
            <el-input
              v-model="model.desc"
              style="width: 100%"
              :rows="2"
              type="textarea"
              @change="reqParamChange"
            />
          </el-form-item>

          <el-alert
            title="Job requires these request parameters to serve as the function's input arguments."
            style="margin-bottom: 5px"
            effect="light"
            type="info"
            :closable="false"
          />
          <el-alert
            v-if="serviceDetail[model.serviceId].desc"
            style="margin-bottom: 5px"
            effect="light"
            type="primary"
            :closable="false"
          >
            <template #default>
              <div @click="handleDescClick" v-html="serviceDetail[model.serviceId].desc"></div>
            </template>
          </el-alert>
        </template>
        <el-form-item label-width="0px" style="margin-bottom: 0px" prop="params">
          <div style="width: 100%">
            <el-tabs v-model="activeName" type="border-card">
              <el-tab-pane label="Request" name="request">
                <paramVue
                  :id="'req'"
                  ref="repParamRef"
                  v-model="model.params"
                  :parent-id="editIndex"
                  :sub-function="model.suppress"
                  :disabled="serviceDetail[model.serviceId].fixedParam"
                  :sid="model.id"
                  :service-id="model.serviceId"
                  :other-service="serviceList[model.serviceId]"
                  @change="suppressChange"
                />
              </el-tab-pane>
              <el-tab-pane
                v-if="
                  checkServiceId(model.serviceId, ['uds']) &&
                  !(serviceDetail[model.serviceId].hasSubFunction && model.suppress)
                "
                label="Response"
                name="response"
              >
                <paramVue
                  :id="'resp'"
                  ref="respParamRef"
                  v-model="model.respParams"
                  :parent-id="editIndex"
                  :sub-function="model.suppress"
                  :sid="model.id"
                  :service-id="model.serviceId"
                  :disabled="model.autoSubfunc"
                  :other-service="serviceList[model.serviceId]"
                  @change="suppressChange"
                />
              </el-tab-pane>
              <el-tab-pane
                v-if="dataBase.tester[editIndex].enableCodeGen"
                label="CodeGenerate"
                name="CodeGenerate"
              >
                <configVue
                  :id="'config'"
                  ref="configRef"
                  v-model="generateConfigList"
                  :parent-id="editIndex"
                  :disabled="globalStart"
                  @change="updateGenerateConfigs"
                />
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-form-item>
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
    <el-dialog
      v-if="dialogVisible"
      v-model="dialogVisible"
      title="ODX File Import"
      width="80%"
      :append-to="`#win${editIndex}_services`"
      align-center
      :before-close="handleClose"
    >
      <el-form
        ref="odxFormRef"
        :model="odxForm"
        label-width="auto"
        size="small"
        style="margin: 10px"
      >
        <el-form-item label="Ecu" prop="ecuName" required>
          <el-select v-model="odxForm.ecuName">
            <el-option v-for="ecu in ecuList" :key="ecu" :label="ecu" :value="ecu" />
          </el-select>
        </el-form-item>
        <el-form-item label="Variant" prop="variant" required>
          <el-select v-model="odxForm.variant">
            <el-option v-for="v in variants[odxForm.ecuName]" :key="v" :label="v" :value="v" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" plain @click="cancelImportOdx">Cancel</el-button>
          <el-button type="primary" size="small" plain @click="realImportOdx"> Import </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="tsx" setup>
import {
  ServiceItem,
  param2raw,
  getTxPduStr,
  getRxPduStr,
  Sequence,
  paramSetVal,
  paramSetValRaw
} from 'nodeCan/uds'
import { cloneDeep } from 'lodash'
import { v4, validate } from 'uuid'
import { Ref, computed, inject, nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import paramVue from './param.vue'
import configVue from './config.vue'
import closeIcon from '@iconify/icons-material-symbols/close'
import { Icon } from '@iconify/vue'
import { type FormRules, type FormInstance, ElMessageBox, ElMessage } from 'element-plus'
import circlePlusFilled from '@iconify/icons-ep/circle-plus-filled'
import removeIcon from '@iconify/icons-ep/remove'
import loadIcon from '@iconify/icons-material-symbols/upload'
import { ServiceId, checkServiceId } from 'nodeCan/uds'
import { useDataStore } from '@r/stores/data'
import { useGlobalStart } from '@r/stores/runtime'

const serviceDetail = window.serviceDetail
const dialogVisible = ref(false)
const loading = ref(false)
const activeService = ref('')
const ruleFormRef = ref<FormInstance>()
const props = defineProps<{
  editIndex: string
  serviceId?: string[]
  width: number
  height: number
}>()
const h = toRef(props, 'height')
const w = toRef(props, 'width')
const leftWidth = ref(300)
const activeName = ref('request')
const dataBase = useDataStore()
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
const configRef = ref()
const globalStart = useGlobalStart()

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
  activeName.value = 'request'
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
  if (deletedCnt == 0 && serviceList.value[id]?.length && checkServiceId(id, ['uds'])) {
    ElMessageBox({
      message: 'This service may only be created once.',
      type: 'warning',
      title: 'Warning',
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
    autoSubfunc: true
  }
  if (serviceList.value[id] == undefined) {
    serviceList.value[id] = []
  }
  const targetService = serviceList.value[id]
  let q = ''
  if (!checkServiceId(id, ['uds'])) {
    q = ''
  } else {
    q = Number(id).toString()
  }
  if (serviceDetail[id].defaultParams) {
    for (const p of serviceDetail[id].defaultParams) {
      const s = cloneDeep(p.param)
      s.id = v4()
      s.value = Buffer.from(p.param.value || Buffer.alloc(Math.ceil(p.param.bitLen / 8)))
      model.value.params.push(s)
      JSON.stringify(s)
    }
  }
  if (serviceDetail[id].defaultRespParams) {
    for (const p of serviceDetail[id].defaultRespParams) {
      const s = cloneDeep(p.param)
      s.id = v4()
      s.value = Buffer.from(p.param.value || Buffer.alloc(Math.ceil(p.param.bitLen / 8)))
      model.value.respParams.push(s)
    }
  }

  if (checkServiceId(id, ['uds'])) {
    for (const [index, p] of model.value.params.entries()) {
      if (p.deletable == false) {
        // 将当前值转换为十六进制数值
        const currentValue = parseInt(p.value.toString('hex'), 16)
        let maxValue = currentValue

        // 查找所有目标服务中的最大值
        for (const v of targetService) {
          const b = Buffer.from(v.params[index].value)
          const compareValue = parseInt(b.toString('hex'), 16)

          if (compareValue >= maxValue) {
            maxValue = compareValue
          }
        }

        // 如果当前值不是唯一的，使用最大值+1
        if (maxValue >= currentValue) {
          // 将新值转回Buffer
          const newValueHex = (maxValue + 1).toString(16).padStart(p.value.length * 2, '0')
          p.value = Buffer.from(newValueHex, 'hex')
          if (p.value.length * 8 > p.bitLen) {
            activeService.value = ''
            ElMessageBox({
              message: 'The value is out of range',
              type: 'warning',
              title: 'Warning',
              buttonSize: 'small',
              appendTo: `#win${editIndex.value}_services`
            })
            return
          }
        }
        paramSetValRaw(p, p.value)
        reqParamChange()
        break
      }
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
        if (
          Object.prototype.hasOwnProperty.call(importData, ecu) &&
          Object.prototype.hasOwnProperty.call(importData[ecu], variant)
        ) {
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
  autoSubfunc: true
})

// 生成配置列表（用于表格显示）
const generateConfigList = ref<Array<{ key: string; value: string }>>([])

// 监听 model 变化，同步 generateConfigs
watch(
  () => model.value,
  (newVal) => {
    if (newVal.generateConfigs) {
      generateConfigList.value = Object.entries(newVal.generateConfigs).map(([key, value]) => ({
        key,
        value
      }))
    } else {
      generateConfigList.value = []
    }
  },
  { deep: true, immediate: true }
)

function suppressChange() {
  if (model.value.serviceId.startsWith('0x')) {
    const lastVal = model.value.params[0].value[0]
    if (model.value.suppress) {
      activeName.value = 'request'
      paramSetVal(model.value.params[0], lastVal | 0x80)
    } else {
      paramSetVal(model.value.params[0], lastVal & 0x7f)
    }
  }
  reqParamChange()
}

function handleDescClick(e: Event) {
  if ((e.target as HTMLElement).tagName == 'A') {
    e.preventDefault()
    //get href
    const href = (e.target as HTMLElement).getAttribute('href')
    window.electron.ipcRenderer.send('ipc-open-link', href)
  }
}

// 更新 model 中的 generateConfigs
function updateGenerateConfigs() {
  if (!model.value.generateConfigs) {
    model.value.generateConfigs = {}
  }

  // 清空原有配置
  model.value.generateConfigs = {}

  // 从列表重建配置对象
  for (const item of generateConfigList.value) {
    if (item.key.trim()) {
      model.value.generateConfigs[item.key.trim()] = item.value
    }
  }
  onSubmit()
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
  const names: { name: string; id: string }[] = []
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
  serviceId: [{ required: true, message: 'Please choose service', trigger: 'change' }]
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

        r = configRef.value?.valid()

        if (r == false) {
          return
        }

        const serviceId = model.value.serviceId
        if (serviceList.value[serviceId] == undefined) {
          serviceList.value[serviceId] = []
        }
        const index = serviceList.value[serviceId].findIndex((item) => item.id == model.value.id)

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
    handles: 'e',
    // resize from all edges and corners
    resize: (e, ui) => {
      leftWidth.value = ui.size.width
    },
    maxWidth: 400,
    minWidth: 200
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
