<template>
  <div>
    <!--D:\code\app-template\dist\index.html  -->
    <WujieVue name="A" url="file:///index.html" :fetch="customFetch" :plugins="plugins"></WujieVue>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'

const props = defineProps<{
  editIndex: string

  width: number
  height: number
}>()
const editIndex = toRef(props, 'editIndex')
const width = toRef(props, 'width')
const height = toRef(props, 'height')
const libPath = window.electron.ipcRenderer.sendSync('ipc-plugin-lib-path')

const basePath = 'D:/code/ecubus-plugin-template/dist'
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
</script>

<style scoped></style>
