/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataSet } from 'src/preload/data'
import { reactive, watch } from 'vue'
import { isEqual } from 'lodash'
export { showOpenDialog, showSaveDialog } from './dialog'

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
      console.log('pluginEmit')
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
    Object.assign(dataStore, newStore || {})
  })
}

// 模拟 Pinia 的 useDataStore，返回整个 dataSet
export function useData() {
  return dataStore
}

export const eventBus = window.parent.logBus

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
