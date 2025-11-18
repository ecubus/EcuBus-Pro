import { createApp, markRaw } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'animate.css'
import router from './router'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createPinia } from 'pinia'
import { VxeLoading, VxeTooltip } from 'vxe-pc-ui'
import { VxeUI } from 'vxe-table'

import 'vxe-table/lib/style.css'
import 'vxe-pc-ui/lib/style.css'
import enUS from 'vxe-pc-ui/lib/language/en-US'
import VxeUIPluginRenderElement from '@vxe-ui/plugin-render-element'
import { Router } from 'vue-router'
import './helper'
import jQuery from 'jquery'
window.jQuery = jQuery
await import('jquery-ui/dist/jquery-ui.js')
import 'jquery-ui/dist/themes/base/jquery-ui.css'
import mitt from 'mitt'
import '@vxe-ui/plugin-render-element/dist/style.css'
import formCreate from '@form-create/element-ui' // 引入 FormCreate
import DataParseWorker from './worker/dataParse.ts?worker'
import fcDesigner from './views/uds/panel-designer/index.js'

import { useDataStore } from './stores/data'

import { Layout } from './views/uds/layout'
import { useProjectStore } from './stores/project'
import { useRuntimeStore } from './stores/runtime'
import { assign, cloneDeep } from 'lodash'
import wujieVue from 'wujie-vue3'
import { initRendererI18n, i18nPlugin } from './i18n'

const channel = new BroadcastChannel('ipc-log')
const dataChannel = new BroadcastChannel('ipc-data')
const projectChannel = new BroadcastChannel('ipc-project')
const runtimeChannel = new BroadcastChannel('ipc-runtime')

const dataParseWorker = new DataParseWorker()

window.logBus = mitt()
window.dataParseWorker = dataParseWorker
dataParseWorker.onmessage = (event) => {
  //main tab
  if (window.params.id == undefined && Layout.externWinNum > 0) {
    channel.postMessage(event.data)
  }
  for (const key of Object.keys(event.data)) {
    window.logBus.emit(key, { key, values: event.data[key] })
  }
}

window.serviceDetail = window.electron?.ipcRenderer.sendSync('ipc-service-detail')
window.electron?.ipcRenderer.on('ipc-log', (event, data) => {
  const groups: { method: string; data: any[] }[] = [] // 存储所有分组，每个元素是 {method, data} 对象
  let currentGroup: { method: string; data: any[] } | null = null

  data.forEach((item: any) => {
    const method = item.message.method

    // 如果是新的method或者当前组的method不同，创建新组
    if (!currentGroup || currentGroup.method !== method) {
      if (currentGroup) {
        groups.push(currentGroup)
      }
      currentGroup = {
        method: method,
        data: []
      }
    }

    currentGroup.data.push(item)
  })

  // 添加最后一组
  if (currentGroup) {
    groups.push(currentGroup)
  }

  // 按顺序发送每个组的数据
  groups.forEach((group) => {
    // window.logBus.emit(group.method, undefined, group.data)
    dataParseWorker.postMessage({
      method: group.method,
      data: group.data
    })
  })
})

VxeUI.use(VxeUIPluginRenderElement)
VxeUI.setI18n('en-US', enUS)
VxeUI.setLanguage('en-US')

const pinia = createPinia()

declare module 'pinia' {
  export interface PiniaCustomProperties {
    router: Router
  }
}
pinia.use(({ store }) => {
  store.router = markRaw(router)
})

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.use(pinia)
app.use(ElementPlus)
app.use(router)
app.use(VxeTooltip)
app.use(VxeLoading)
app.use(formCreate)
app.use(fcDesigner)
app.use(wujieVue)

// 初始化 i18n（同步）
const savedLang = window.electron?.ipcRenderer.sendSync('electron-store-get', 'language') || 'en'
initRendererI18n(savedLang)
app.use(i18nPlugin)

const dataStore = useDataStore()
const projectStore = useProjectStore()
const runtimeStore = useRuntimeStore()

// 直接解析URL参数并赋值给window.params
const urlParams = new URLSearchParams(window.location.search)
window.params = {}
urlParams.forEach((value, key) => {
  window.params[key] = value
})

//单向的
if (window.params.id) {
  router.push(`/${window.params.path}`)
  channel.onmessage = (event) => {
    for (const key of Object.keys(event.data)) {
      window.logBus.emit(key, { key, values: event.data[key] })
    }
  }
  dataChannel.onmessage = (event) => {
    dataStore.$patch((state) => {
      assign(state, event.data)
    })
  }
  dataChannel.postMessage(undefined)
  projectChannel.onmessage = (event) => {
    projectStore.$patch((state) => {
      assign(state, event.data)
    })
  }
  projectChannel.postMessage(undefined)
  runtimeChannel.onmessage = (event) => {
    runtimeStore.$patch((state) => {
      assign(state, event.data)
    })
  }
  runtimeChannel.postMessage(undefined)
} else {
  dataChannel.onmessage = (event) => {
    if (event.data == undefined) {
      dataChannel.postMessage(cloneDeep(dataStore.$state))
    }
  }
  projectChannel.onmessage = (event) => {
    if (event.data == undefined) {
      projectChannel.postMessage(cloneDeep(projectStore.$state))
    }
  }
  runtimeChannel.onmessage = (event) => {
    if (event.data == undefined) {
      runtimeChannel.postMessage(cloneDeep(runtimeStore.$state))
    }
  }
  dataStore.$subscribe((mutation, state) => {
    dataChannel.postMessage(cloneDeep(state))
  })
  projectStore.$subscribe((mutation, state) => {
    projectChannel.postMessage(cloneDeep(state))
  })
  runtimeStore.$subscribe((mutation, state) => {
    runtimeChannel.postMessage(cloneDeep(state))
  })
}
app.mount('#app')
