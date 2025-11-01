/* eslint-disable @typescript-eslint/no-explicit-any */
import { reactive, watch } from 'vue'
export { showOpenDialog, showSaveDialog } from './dialog'

// ============ 插件数据和方法 ============

const data = reactive<any>(window.$wujie?.props?.modelValue ?? {})

watch(data, (newVal: any) => {
  window.$wujie.bus.$emit('update:modelValue', {
    pluginId: window.$wujie?.props?.pluginId,
    id: window.$wujie?.props?.editIndex,
    data: newVal
  })
})

export function useData() {
  return data
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
