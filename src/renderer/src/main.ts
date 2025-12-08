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
import log from 'electron-log'
import { useDataStore } from './stores/data'

import { Layout } from './views/uds/layout'
import { useProjectStore } from './stores/project'
import { useRuntimeStore } from './stores/runtime'
import { assign, cloneDeep } from 'lodash'
import wujieVue from 'wujie-vue3'

const logChannel = new BroadcastChannel('ipc-log')
const formatReason = (reason: unknown) => {
  if (reason instanceof Error) {
    return reason.stack ?? `${reason.name}: ${reason.message}`
  }
  if (typeof reason === 'object') {
    try {
      return JSON.stringify(reason)
    } catch (err) {
      return `Unserializable reason: ${String(err)}`
    }
  }
  return String(reason)
}

// Global exception monitoring
window.addEventListener('error', (event) => {
  log.error('[GlobalError]', event.message, {
    source: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error?.stack
  })
})

window.addEventListener('unhandledrejection', (event) => {
  log.error('[UnhandledRejection]', formatReason(event.reason))
})


const dataChannel = new BroadcastChannel('ipc-data')
const projectChannel = new BroadcastChannel('ipc-project')
const runtimeChannel = new BroadcastChannel('ipc-runtime')
window.logBus = mitt()

window.serviceDetail = window.electron?.ipcRenderer.sendSync('ipc-service-detail')

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

const dataStore = useDataStore()
const projectStore = useProjectStore()
const runtimeStore = useRuntimeStore()

// 直接解析URL参数并赋值给window.params
const urlParams = new URLSearchParams(window.location.search)
window.params = {}
urlParams.forEach((value, key) => {
  window.params[key] = value
})
const id = window.params.id || 'main'

//单向的
if (window.params.id) {
  router.push(`/${window.params.path}`)
  logChannel.onmessage = (event) => {
    //main tab
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
  const dataParseWorker = new DataParseWorker()
  window.api?.getPort(id)

  window.dataParseWorker = dataParseWorker
  dataParseWorker.onmessage = (event) => {
    logChannel.postMessage(event.data)
    //main tab
    for (const key of Object.keys(event.data)) {
      window.logBus.emit(key, { key, values: event.data[key] })
    }
  }
  window.onmessage = (event) => {
    // event.source === window means the message is coming from the preload
    // script, as opposed to from an <iframe> or other source.
    if (event.source === window && event.data == id) {
      const [port] = event.ports
      dataParseWorker.postMessage(
        {
          method: 'onmessage',
          data: port
        },
        [port]
      )
    }
  }
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
