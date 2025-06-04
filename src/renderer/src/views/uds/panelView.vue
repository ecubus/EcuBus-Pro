<template>
  <div style="margin: 20px">
    <formCreate
      v-if="rule.length > 0"
      v-model:api="fApi"
      :rule="rule"
      :option="options"
      @change="dataChange"
    ></formCreate>
  </div>
</template>
<script setup lang="ts">
import formCreate from '@form-create/element-ui'
import {
  ref,
  computed,
  toRef,
  provide,
  inject,
  onMounted,
  onUnmounted,
  onBeforeMount,
  watch,
  nextTick,
  watchEffect
} from 'vue'
import { useDataStore } from '@r/stores/data'
import { cloneDeep } from 'lodash'
import { GraphBindSignalValue, GraphBindVariableValue, GraphNode, VarItem } from 'src/preload/data'
import { useGlobalStart } from '@r/stores/runtime'

const panels = useDataStore().panels
// formCreate.component('Grid', Grid)
// formCreate.component('LocalImage', LocalImage)

const props = defineProps<{
  height: number
  editIndex: string
}>()
const fApi = ref<any>({})
// const formData = ref({})
const rule = ref<any[]>([])
const options = ref<any>({})
const globalStart = useGlobalStart()

let ruleBackMap: Record<string, any> = {}
let filedBackMap: Record<string, string[]> = {}
let dataStroe: Record<string, any> = {}

function dataChange(field: string, value: any, rule: any, api: any, setFlag: boolean) {
  // console.log('data', field, value, rule, api, setFlag)
  if (globalStart.value) {
    //check update here, 如果不相等，发送ipc

    if (dataStroe[field] !== value) {
      dataStroe[field] = value
      if (ruleBackMap[field].variable && ruleBackMap[field].variable.variableType == 'user') {
        // window.logBus.emit(ruleBackMap[field].id, value)
        window.electron.ipcRenderer.send('ipc-var-set', {
          name: ruleBackMap[field].variable.variableFullName,
          value: value
        })
      } else {
        window.electron.ipcRenderer.send('ipc-signal-set', {
          name: `${ruleBackMap[field].signal.dbName}.${ruleBackMap[field].signal.signalName}`,
          value: value
        })
      }
    }
  }
}

function dataUpdate(key: string, values: [number, { value: number | string; rawValue: number }][]) {
  if (filedBackMap[key]) {
    for (const field of filedBackMap[key]) {
      const value = values[0][1].rawValue
      if (dataStroe[field] !== value) {
        fApi.value.setValue(field, value)
        dataStroe[field] = value
      }
    }
  }
}

const panel = computed(() => {
  const index = props.editIndex.slice(1)
  return panels[index]
})

function init() {
  for (const key of Object.keys(filedBackMap)) {
    window.logBus.detach(key, dataUpdate)
  }
  rule.value = []
  filedBackMap = {}
  dataStroe = {}
  ruleBackMap = {}
  if (panel.value) {
    //递归变量rule，rule 有children 递归, 如果field存在，就写入filedMap
    const recursion = (rule: any) => {
      if (rule.props && (rule.props.variable || rule.props.signal)) {
        const v: GraphNode<GraphBindSignalValue | GraphBindVariableValue> =
          rule.props.variable || rule.props.signal

        if (rule.field) {
          if (filedBackMap[v.id]) {
            filedBackMap[v.id].push(rule.field)
          } else {
            filedBackMap[v.id] = [rule.field]
          }
          ruleBackMap[rule.field] = {
            id: v.id,
            rule: rule,
            variable: rule.props.variable?.bindValue,
            signal: rule.props.signal?.bindValue
          }
        }
      }
      if (rule.children) {
        for (let i = 0; i < rule.children.length; i++) {
          recursion(rule.children[i])
        }
      }
    }
    for (let i = 0; i < panel.value.rule.length; i++) {
      recursion(panel.value.rule[i])
    }

    nextTick(() => {
      rule.value = cloneDeep(panel.value.rule)
      options.value = cloneDeep(panel.value.options)
    })
    for (const key of Object.keys(filedBackMap)) {
      window.logBus.on(key, dataUpdate)
    }
  }
}
watch(panel, (val) => {
  init()
})

watch(globalStart, (val) => {
  if (val) {
    init()
  }
})
let timer: any
onMounted(() => {
  init()
})

onUnmounted(() => {
  clearInterval(timer)
  for (const key of Object.keys(filedBackMap)) {
    window.logBus.detach(key, dataUpdate)
  }
})
</script>
