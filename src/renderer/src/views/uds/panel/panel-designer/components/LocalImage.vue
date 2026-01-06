<template>
  <div class="local-image-container" :style="containerStyle">
    <el-image v-if="localSrc" :src="localSrc" :style="imageStyle" fit="contain" />
    <div v-else class="no-image">{{ t('LocalImage.onImageError') || '无图片' }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useProjectStore } from '@r/stores/project'

const props = defineProps({
  src: {
    type: String,
    default: ''
  },
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '100%'
  },

  t: {
    type: Function,
    default: (key) => key
  }
})

const localSrc = ref('')

const containerStyle = computed(() => ({
  width: props.width,
  height: props.height
}))

const imageStyle = computed(() => ({
  width: '100%',
  height: '100%'
}))

const project = useProjectStore()

const loadLocalImage = (src) => {
  if (!src) {
    localSrc.value = ''
    return
  }

  // 处理网络图片
  if (src.startsWith('http://') || src.startsWith('https://')) {
    localSrc.value = src
    return
  }

  // 处理本地资源，使用相对路径
  if (project.projectInfo?.path) {
    const isAbsolutePath = src.match(/^[A-Za-z]:\\/) || src.startsWith('/')
    // 如果是绝对路径，直接使用
    if (isAbsolutePath) {
      localSrc.value = 'local-resource://' + src
    } else {
      // 相对路径，需要附加项目路径
      localSrc.value = 'local-resource://' + project.projectInfo.path + '\\' + src
    }
  } else {
    localSrc.value = src
  }
}

// 监听src变化
watch(
  () => props.src,
  (newSrc) => {
    loadLocalImage(newSrc)
  },
  { immediate: true }
)

onMounted(() => {
  loadLocalImage(props.src)
})
</script>

<style scoped>
.local-image-container {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.no-image {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  text-align: center;
}
</style>
