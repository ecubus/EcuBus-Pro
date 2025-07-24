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

const dataBase = useDataStore()
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
// 添加时间戳映射来跟踪最后更新时间
let lastUpdateTime: Record<string, number> = {}

function dataChange(field: string, value: any, rule: any, api: any, setFlag: boolean) {
  // console.log('data', field, value, rule, api, setFlag)
  if (globalStart.value) {
    //check update here, 如果不相等，发送ipc

    if (dataStroe[field] !== value) {
      // 立即更新本地存储，实现乐观更新
      dataStroe[field] = value
      // 记录更新时间戳
      lastUpdateTime[field] = Date.now()

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
    const currentTime = Date.now()
    const offset = 200
    for (const field of filedBackMap[key]) {
      const value = values[0][1].rawValue
      // 只有在以下情况下才更新UI：
      // 1. 本地数据确实不同
      // 2. 距离最后一次用户操作超过100ms（防抖）
      // 3. 或者这是第一次接收到数据（lastUpdateTime[field]不存在）
      const timeSinceLastUpdate = lastUpdateTime[field]
        ? currentTime - lastUpdateTime[field]
        : Infinity
      const shouldUpdate =
        dataStroe[field] !== value && (timeSinceLastUpdate > offset || !lastUpdateTime[field])

      if (shouldUpdate) {
        fApi.value.setValue(field, value)
        dataStroe[field] = value
        // 只有在非用户操作触发的更新时才更新时间戳
        if (timeSinceLastUpdate > offset || !lastUpdateTime[field]) {
          lastUpdateTime[field] = currentTime
        }
      }
    }
  }
}

const panel = computed(() => {
  const index = props.editIndex.slice(1)
  return dataBase.panels[index]
})

function init() {
  for (const key of Object.keys(filedBackMap)) {
    window.logBus.detach(key, dataUpdate)
  }
  rule.value = []
  filedBackMap = {}
  dataStroe = {}
  ruleBackMap = {}
  lastUpdateTime = {} // 重置时间戳映射
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

    rule.value = cloneDeep(panel.value.rule)
    options.value = cloneDeep(panel.value.options)
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
