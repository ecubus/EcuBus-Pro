<template>
  <div>
    <!--D:\code\app-template\dist\index.html  -->
    <WujieVue
      :name="editIndex"
      :url="entry"
      :fetch="isDev ? undefined : customFetch"
      :plugins="plugins"
      :props="{ ...props, modelValue: data, isDark: darkValue }"
      :load-error="loadError"
    ></WujieVue>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, toRef, unref } from 'vue'
import { PluginItemConfig } from 'src/preload/plugin'
import { useDataStore } from '@r/stores/data'
import { usePluginStore } from '@r/stores/plugin'
import { ElMessageBox } from 'element-plus'
import { destroyApp } from 'wujie'
import { cloneDeep } from 'lodash'
import { InstanceofPlugin } from 'wujie-polyfill'
import { useDark } from '@vueuse/core'
const dataStore = useDataStore()
const props = defineProps<{
  editIndex: string
  pluginId: string
  item: PluginItemConfig
  width: number
  height: number
}>()

const data = cloneDeep(
  props.editIndex == props.pluginId
    ? dataStore.pluginData[props.pluginId]
    : dataStore.pluginData[props.pluginId][props.editIndex]
)

const isDev = props.item.entry?.startsWith('http')

const entry = isDev ? props.item.entry : `file:///${props.item.entry}`
const entryBase = props.item.entry?.split('/').slice(0, -1).join('/')

const plguinStore = usePluginStore()
const plugin = plguinStore.getPlugin(props.pluginId)!
const editIndex = toRef(props, 'editIndex')
const width = toRef(props, 'width')
const height = toRef(props, 'height')
const libPath = window.electron.ipcRenderer.sendSync('ipc-plugin-lib-path')
const isDark = useDark()
const darkValue = unref(isDark)
const basePath = plugin.path

const importMap = {
  imports: {
    vue: `local-resource:///${libPath}/runtime-dom.esm-browser.min.js`,
    '@vue/shared': `local-resource:///${libPath}/shared.esm-bundler.min.js`,
    'element-plus': `local-resource:///${libPath}/elementplus.index.full.min.mjs`,
    '@element-plus/icons-vue': `local-resource:///${libPath}/elementplus.icon.min.js`,
    '@ecubus-pro/renderer-plugin-sdk': `local-resource:///${libPath}/sdk.mjs`
  }
}
const plugins = [
  {
    jsBeforeLoaders: [
      {
        callback(appWindow) {
          appWindow.document.head.innerHTML += `<link rel="stylesheet" href="local-resource:///${libPath}/element.css">`
          if (darkValue) {
            appWindow.document.head.innerHTML += `<link rel="stylesheet" href="local-resource:///${libPath}/element.dark.css">`
          }
        }
      },
      {
        content: JSON.stringify(importMap, null, 2),
        attrs: {
          type: 'importmap'
        }
      }
    ],
    jsLoader: (code) => {
      // 替换popper.js内计算偏左侧偏移量
      const codes = code.replace(
        'left: elementRect.left - parentRect.left',
        'left: fixed ? elementRect.left : elementRect.left - parentRect.left'
      )
      // 替换popper.js内右侧偏移量
      return codes.replace('popper.right > data.boundaries.right', 'false')
    },

    htmlLoader: (code) => {
      if (darkValue) {
        //add class dark to html
        code = code.replace('<html ', '<html class="dark" ')
      }

      const reHref = /href="\.\/([^"]*)"/g
      const reSrc = /src="\.\/([^"]*)"/g
      code = code.replace(reHref, 'href="local-resource:///' + basePath + '/' + entryBase + '/$1"')
      code = code.replace(reSrc, 'src="local-resource:///' + basePath + '/' + entryBase + '/$1"')
      return code
    },

    cssExcludes: [/element-plus/],
    cssBeforeLoaders: [
      // 强制使子应用body定位是relative
      { content: 'body{position: relative !important}' }
    ]
  },
  InstanceofPlugin()
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

onUnmounted(() => {
  destroyApp(props.editIndex)
})
</script>

<style scoped></style>
