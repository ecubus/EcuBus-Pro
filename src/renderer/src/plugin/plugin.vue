<template>
  <div>
    <!--D:\code\app-template\dist\index.html  -->
    <WujieVue
      :name="editIndex"
      :url="entry"
      :fetch="isDev ? undefined : customFetch"
      :plugins="plugins"
      :props="{
        ...props,
        isDark: darkValue,
        dataStore: cloneDeep(dataStore.getData()),
        globalStart: globalStartValue
      }"
      :load-error="loadError"
    ></WujieVue>
  </div>
</template>

<script setup lang="ts">
import { inject, onMounted, onUnmounted, toRef, unref } from 'vue'
import { PluginItemConfig } from 'src/preload/plugin'
import { useDataStore } from '@r/stores/data'
import { usePluginStore } from '@r/stores/plugin'
import { useGlobalStart } from '@r/stores/runtime'
import { ElMessageBox } from 'element-plus'
import { destroyApp } from 'wujie'
import { cloneDeep } from 'lodash'
import { InstanceofPlugin } from 'wujie-polyfill'
import { useDark } from '@vueuse/core'
import { error } from 'electron-log'
import { Layout } from '@r/views/uds/layout'

const dataStore = useDataStore()
const globalStartRef = useGlobalStart()
const props = defineProps<{
  editIndex: string
  pluginId: string
  item: PluginItemConfig
  width: number
  height: number
}>()
const plguinStore = usePluginStore()

const getConstItem = () => {
  const pluginInfo = plguinStore.getPlugin(props.pluginId)
  if (pluginInfo) {
    const configs = pluginInfo.manifest.tabs || pluginInfo.manifest.extensions || []
    for (const config of configs) {
      return config.items.find((item) => item.id === props.item.id) || null
    }
  }

  return null
}
const qitem = getConstItem()

const isDev = qitem?.entry?.startsWith('http')

const entry = isDev ? qitem?.entry : `file:///${qitem?.entry}`

const entryBase = qitem?.entry?.split('/').slice(0, -1).join('/')

const plugin = plguinStore.getPlugin(props.pluginId)!
const editIndex = toRef(props, 'editIndex')
const width = toRef(props, 'width')
const height = toRef(props, 'height')
const libPath = window.electron.ipcRenderer.sendSync('ipc-plugin-lib-path')
const isDark = useDark()
const darkValue = unref(isDark)
const globalStartValue = unref(globalStartRef)
const basePath = plugin.path.replace(/'/g, '%27')
const layout = inject('layout') as Layout

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
  error(url, e)
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

onMounted(() => {
  if (!qitem) {
    ElMessageBox({
      title: 'Item Not Found',
      message: `The item is not found in the plugin`,
      type: 'error',
      appendTo: `#win${props.editIndex}`,
      showCancelButton: false,
      showConfirmButton: true,
      confirmButtonText: 'Close',
      center: true
    }).finally(() => {
      layout.removeWin(props.editIndex, true)
    })
  }
})
// 安全销毁 wujie 应用，避免 stopIframeLoading 内部 loop/loop2 的竞态条件
const safeDestroyApp = async (name: string) => {
  // 1. 等待 wujie 加载队列完成（startApp promise）
  const queue = (window as any).__WUJIE_QUEUE?.[name]
  if (queue instanceof Promise) {
    try {
      await queue
    } catch {
      // 加载过程中的错误忽略
    }
  }

  // 2. 等待 stopIframeLoading 内部的 loop/loop2 完成
  //    loop2 使用 setTimeout(..., 1) 轮询，最长持续 1 秒
  //    这里等待 100ms 通常足够让循环检测到状态变化并退出
  await new Promise((resolve) => setTimeout(resolve, 100))

  // 3. 安全销毁
  try {
    destroyApp(name)
  } catch (e) {
    null
  }

  // 4. 清理队列引用
  if ((window as any).__WUJIE_QUEUE?.[name]) {
    delete (window as any).__WUJIE_QUEUE[name]
  }
}

onUnmounted(() => {
  safeDestroyApp(props.editIndex)
})
</script>

<style scoped></style>
