<template>
  <div>
    <!--D:\code\app-template\dist\index.html  -->
    <WujieVue
      :name="editIndex"
      :url="`file:///${props.item.entry}`"
      :fetch="customFetch"
      :plugins="plugins"
      :props="{ ...props, modelValue: dataStore.pluginData[props.pluginId] }"
      :load-error="loadError"
    ></WujieVue>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { EcuBusPlugin, PluginItemConfig } from './tabPluginTypes'
import { useDataStore } from '@r/stores/data'
import { usePluginStore } from '@r/stores/plugin'
import { ElMessageBox } from 'element-plus'

const dataStore = useDataStore()
const props = defineProps<{
  editIndex: string
  pluginId: string
  item: PluginItemConfig
  width: number
  height: number
}>()

const plguinStore = usePluginStore()
const plugin = plguinStore.getPlugin(props.pluginId)!
const editIndex = toRef(props, 'editIndex')
const width = toRef(props, 'width')
const height = toRef(props, 'height')
const libPath = window.electron.ipcRenderer.sendSync('ipc-plugin-lib-path')

const basePath = plugin.path
const importMap = {
  imports: {
    vue: `local-resource:///${libPath}/runtime-dom.esm-browser.min.js`,
    '@vue/shared': `local-resource:///${libPath}/shared.esm-bundler.min.js`,
    'element-plus': `local-resource:///${libPath}/elementplus.index.full.min.mjs`,
    '@element-plus/icons-vue': `local-resource:///${libPath}/elementplus.icon.min.js`
  }
}
const plugins = [
  {
    jsBeforeLoaders: [
      {
        callback(appWindow) {
          appWindow.document.head.innerHTML += `<link rel="stylesheet" href="local-resource:///${libPath}/element.css">`
        }
      },
      {
        content: JSON.stringify(importMap, null, 2),
        attrs: {
          type: 'importmap'
        }
      }
    ],

    htmlLoader: (code) => {
      const reHref = /href="\.\/([^"]*)"/g
      const reSrc = /src="\.\/([^"]*)"/g
      code = code.replace(reHref, 'href="local-resource:///' + basePath + '/$1"')
      code = code.replace(reSrc, 'src="local-resource:///' + basePath + '/$1"')

      return code
    },

    cssExcludes: [/element-plus/]
  }
]
const customFetch = (url: string, options?: RequestInit) => {
  url = url.replace('file:///', 'local-resource:///' + basePath + '/')
  return window.fetch(url, options)
}
const loadError = (url: string, e: Error) => {
  ElMessageBox({
    title: 'Load Error',
    message: e.message,
    type: 'error',
    appendTo: `#win${props.editIndex}`,
    showCancelButton: false,
    showConfirmButton: false,
    center: true
  })
}
</script>

<style scoped></style>
