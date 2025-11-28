<template>
  <div style="position: relative">
    <!-- Add copy button -->
    <el-button class="copy-btn" type="primary" link size="small" @click="copyToClipboard">
      <Icon :icon="copyIcon" style="font-size: 18px" />
    </el-button>
    <pre style="margin: 20px">{{ result }}</pre>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { LDF } from '../ldfParse'
import temp from './ldf.ldf?raw'
import Handlebars from 'handlebars'
import { Icon } from '@iconify/vue'
import copyIcon from '@iconify/icons-material-symbols/content-copy'
import { ElMessage, ElNotification } from 'element-plus'
import { useClipboard } from '@vueuse/core'

const props = defineProps<{
  ldfObj: LDF
  editIndex: string
}>()

const result = ref('')
const { copy } = useClipboard({ source: result })
watch(
  () => props.ldfObj,
  (newVal) => {
    try {
      const template = Handlebars.compile(temp)
      result.value = template(newVal)
    } catch (e: any) {
      result.value = e.message
    }
  },
  { deep: true }
)
onMounted(() => {
  try {
    const template = Handlebars.compile(temp)
    result.value = template(props.ldfObj)
  } catch (e: any) {
    result.value = e.message
  }
})

// Add copy function
async function copyToClipboard() {
  try {
    copy()
    ElNotification({
      message: 'Copied to clipboard!',
      type: 'success',
      appendTo: `#win${props.editIndex}`,
      offset: 50
    })
  } catch (err) {
    ElNotification({
      message: 'Failed to copy',
      type: 'error',
      appendTo: `#win${props.editIndex}`,
      offset: 50
    })
  }
}
</script>

<style scoped>
.copy-btn {
  position: absolute;
  top: -10px;
  right: 0px;
  z-index: 1;
}
</style>
