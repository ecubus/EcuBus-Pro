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
console.log(libPath)
const basePath = 'D:/code/ecubus-plugin-template/dist'
const importMap = {
  imports: {
    vue: `local-resource:///${libPath}/runtime-dom.esm-browser.min.js`,
    '@vue/shared': `local-resource:///${libPath}/shared.esm-bundler.min.js`,
    'element-plus': 'https://cdn.jsdelivr.net/npm/element-plus@latest/dist/index.full.min.mjs',
    'element-plus/': 'https://cdn.jsdelivr.net/npm/element-plus@latest/',
    '@element-plus/icons-vue':
      'https://cdn.jsdelivr.net/npm/@element-plus/icons-vue@2/dist/index.min.js'
  }
}
const plugins = [
  {
    jsBeforeLoaders: [
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
    }
  }
]
const customFetch = (url: string, options?: RequestInit) => {
  url = url.replace('file:///', 'local-resource:///' + basePath + '/')
  return window.fetch(url, options)
}
</script>

<style scoped></style>
