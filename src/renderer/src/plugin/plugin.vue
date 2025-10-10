<template>
  <div>
    <!--D:\code\app-template\dist\index.html  -->
    <WujieVue
      style="height: 100px; width: 100px"
      name="A"
      url="file:///D:/code/app-template/dist/index.html"
      :fetch="customFetch"
      :plugins="plugins"
    ></WujieVue>
  </div>
</template>

<script setup lang="ts">
const importMap = {
  imports: {
    vue: 'https://cdn.jsdelivr.net/npm/@vue/runtime-dom@latest/dist/runtime-dom.esm-browser.js',
    '@vue/shared': 'https://cdn.jsdelivr.net/npm/@vue/shared@latest/dist/shared.esm-bundler.js',
    'element-plus': 'https://cdn.jsdelivr.net/npm/element-plus@latest/dist/index.full.min.mjs',
    'element-plus/': 'https://cdn.jsdelivr.net/npm/element-plus@latest/',
    '@element-plus/icons-vue':
      'https://cdn.jsdelivr.net/npm/@element-plus/icons-vue@2/dist/index.min.js'
  }
}
const plugins = [
  {
    // 在子应用所有的js之前
    // jsBeforeLoaders: [
    //   // 插入一个内联监本
    //   { content: 'console.log("app",window.parent.vue)' },
    //   { content: 'window.vue = window.parent.vue' }
    // ]
  }
]
const customFetch = (url: string, options?: RequestInit) => {
  url = url.replace('file:///', 'local-resource:///')
  return window.fetch(url, options)
}
</script>
