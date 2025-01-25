import { createApp, markRaw } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'animate.css';
import router from './router'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createPinia } from 'pinia'
import { VxeLoading, VxeTooltip } from 'vxe-pc-ui'
import { VxeUI } from 'vxe-table'

import "vxe-table/lib/style.css"
import 'vxe-pc-ui/lib/style.css'
import enUS from 'vxe-pc-ui/lib/language/en-US'
import VxeUIPluginRenderElement from '@vxe-ui/plugin-render-element'
import { Router } from 'vue-router'
import './helper'
import jQuery from 'jquery';
window.jQuery = jQuery;
await import("jquery-ui/dist/jquery-ui.js");
import 'jquery-ui/dist/themes/base/jquery-ui.css'
import EventBus from './event'

import DataParseWorker from './worker/dataParse.ts?worker'

const dataParseWorker = new DataParseWorker()
window.logBus = new EventBus()
window.dataParseWorker=dataParseWorker  
dataParseWorker.onmessage = (event) => {
  for(const key of Object.keys(event.data)){
    window.logBus.emit(key, undefined, key,event.data[key])
  }
}
window.electron.ipcRenderer.on('ipc-log', (event, data) => {
  const group = {}
  data.forEach((item: any) => {
    if (!group[item.message.method]) {
      group[item.message.method] = []
    }
    group[item.message.method].push(item)

  })

  for (const key of Object.keys(group)) {
    
    window.logBus.emit(key, undefined, group[key])
    // 解析数据
    dataParseWorker.postMessage({
      method:key,
      data:group[key]
    })
  }
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
pinia.use(({ store }) => { store.router = markRaw(router) });
const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.use(pinia)
app.use(ElementPlus)
app.use(router)
app.use(VxeTooltip)
app.use(VxeLoading)

app.mount('#app')