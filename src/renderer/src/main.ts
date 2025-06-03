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
import EventBus from './event'
import '@vxe-ui/plugin-render-element/dist/style.css'
import formCreate from '@form-create/element-ui' // 引入 FormCreate
import DataParseWorker from './worker/dataParse.ts?worker'
import fcDesigner from './views/uds/panel-designer/index.js'

import { useDataStore } from './stores/data'
import { assign } from 'lodash'
import { cloneDeep } from 'lodash'
import { useProjectStore } from './stores/project'
import { useRuntimeStore } from './stores/runtime'
const channel = new BroadcastChannel('ipc-log')
const dataChannel = new BroadcastChannel('ipc-data')
const projectChannel = new BroadcastChannel('ipc-project')
const runtimeChannel = new BroadcastChannel('ipc-runtime')
const dataParseWorker = new DataParseWorker()

window.logBus = new EventBus()
window.dataParseWorker = dataParseWorker
dataParseWorker.onmessage = (event) => {
  //main tab
  if (window.params.id == undefined) {
    channel.postMessage(event.data)
  }
  for (const key of Object.keys(event.data)) {
    window.logBus.emit(key, undefined, key, event.data[key])
  }
}

window.serviceDetail = window.electron.ipcRenderer.sendSync('ipc-service-detail')
window.electron.ipcRenderer.on('ipc-log', (event, data) => {
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

// 直接解析URL参数并赋值给window.params
const urlParams = new URLSearchParams(window.location.search)
window.params = {}
urlParams.forEach((value, key) => {
  window.params[key] = value
})

app.mount('#app')
const database = useDataStore()
const project = useProjectStore()
const runtime = useRuntimeStore()
if (window.params.id) {
  router.push(`/${window.params.path}`)
  channel.onmessage = (data) => {
    for (const key of Object.keys(data)) {
      window.logBus.emit(key, undefined, key, data[key])
    }
  }
}
//bi-directional communication
dataChannel.onmessage = (val) => {
  database.$patch((ss) => {
    Object.assign(ss, val.data)
  })
}
projectChannel.onmessage = (val) => {
  project.$patch((ss) => {
    Object.assign(ss, val.data)
  })
}
runtimeChannel.onmessage = (val) => {
  runtime.$patch((ss) => {
    Object.assign(ss, val.data)
  })
}
database.$subscribe((mutation, state) => {
  dataChannel.postMessage(cloneDeep(state))
})
project.$subscribe((mutation, state) => {
  projectChannel.postMessage(cloneDeep(state))
})
runtime.$subscribe((mutation, state) => {
  runtimeChannel.postMessage(cloneDeep(state))
})
