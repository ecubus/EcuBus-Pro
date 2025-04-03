<template>
  <fc-designer ref="designer" height="100vh" :config="config" :locale="locale" />
</template>
<script setup lang="ts">
import En from '@form-create/designer/locale/en.js' // 导入英文语言包
import { ref } from 'vue'
// 可以在此处获取设计器实例或进行其他操作
const designer = ref(null)
const locale = En
const config = ref({
  // 配置项
  showDevice: false,
  showJsonPreview: false,
  showInputData: false,
  showSaveBtn: true
})
</script>
