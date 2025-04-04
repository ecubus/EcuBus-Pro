<template>
  <fc-designer ref="designer" :config="config" :locale="locale" :height="h" />
</template>
<script setup lang="ts">
import fcDesigner from './panel-designer/index.js'
import En from './panel-designer/locale/en.js' // 导入英文语言包
import { ref, computed, toRef, provide } from 'vue'
// 可以在此处获取设计器实例或进行其他操作
const designer = ref(null)
const props = defineProps<{
  height: number
  editIndex: string
}>()

const h = toRef(props, 'height')

const locale = En
const config = computed(() => ({
  // 配置项
  showDevice: false,
  showJsonPreview: false,
  showInputData: false,
  showSaveBtn: true,
  editIndex: props.editIndex,
  formOptions: {
    submitBtn: false
  }
}))

provide('dialogId', `#win${props.editIndex}`)
provide('height', h)
</script>
