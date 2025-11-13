/* eslint-disable @typescript-eslint/no-explicit-any */
import { assign } from 'lodash'
import { DataSet } from 'src/preload/data'
import { reactive, watch, ref } from 'vue'

export { showOpenDialog, showSaveDialog } from './dialog'
export type { DataSet } from 'src/preload/data'

// ============ 模拟 Pinia 的 useDataStore ============
let isExternalUpdate = false
// 创建响应式的 dataStore（模拟 Pinia store）
const dataStore = reactive<DataSet>(window.$wujie?.props?.dataStore ?? {})

// 监听插件对 store 的修改，同步到主应用
watch(
  dataStore,
  (newVal: any) => {
    if (isExternalUpdate) {
      isExternalUpdate = false
      return
    }
    if (window.$wujie?.bus) {
      window.$wujie.bus.$emit('update:dataStore', newVal)
    }
  },
  { deep: true }
)

// 监听主应用发送的 store 更新事件
if (window.$wujie?.bus) {
  window.$wujie.bus.$on('update:dataStore:fromMain', (newStore: any) => {
    // 使用 isEqual 比较，只有真正变化时才更新，避免不必要的 watch 触发
    isExternalUpdate = true
    assign(dataStore, newStore)
  })
}

// 模拟 Pinia 的 useDataStore，返回整个 dataSet
export function useData() {
  return dataStore
}

// ============ useGlobalStart ============
// 创建响应式的 globalStart（模拟 Pinia store）
const globalStart = ref<boolean>(window.$wujie?.props?.globalStart ?? false)

// 监听主应用发送的 globalStart 更新事件
if (window.$wujie?.bus) {
  window.$wujie.bus.$on('update:globalStart:fromMain', (newValue: boolean) => {
    globalStart.value = newValue
  })
}

// 模拟 Pinia 的 useGlobalStart，返回响应式的 globalStart ref
export function useGlobalStart() {
  return globalStart
}

export const eventBus = window.parent.logBus
export function getPluginId() {
  return window.$wujie?.props?.pluginId
}
export function getEditIndex() {
  return window.$wujie?.props?.editIndex
}
export function callServerMethod(method: string, ...params: any[]): Promise<any> {
  return window.parent.electron.ipcRenderer.invoke(
    'ipc-plugin-exec',
    { pluginId: window.$wujie?.props?.pluginId, id: window.$wujie?.props?.editIndex },
    method,
    ...params
  )
}

export function addPluginEventListen(event: string, callback: (data: any) => void) {
  eventBus.on(`pluginEvent.${window.$wujie?.props?.pluginId}.${event}`, callback)
}

export function removePluginEventListen(event: string, callback: (data: any) => void) {
  eventBus.off(`pluginEvent.${window.$wujie?.props?.pluginId}.${event}`, callback)
}

export function addPluginErrorListen(callback: (data: { msg: string; data?: any }) => void) {
  eventBus.on(`pluginError.${window.$wujie?.props?.pluginId}`, callback)
}

export function removePluginErrorListen(callback: (data: { event: string; data: any }) => void) {
  eventBus.off(`*pluginError.${window.$wujie?.props?.pluginId}`, callback)
}
