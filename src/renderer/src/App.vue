<template>
  <el-container>
    <el-header height="35px" style="margin: 0px; padding: 0px">
      <HeaderView />
    </el-header>
    <div>
      <router-view
        :id="`win${params.id}`"
        :width="width"
        :height="height - 35"
        :edit-index="params['edit-index']"
      />
    </div>
  </el-container>
</template>

<script setup lang="ts">
import HeaderView from '@r/views/header/header.vue'
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { DataSet, useDataStore } from './stores/data'
import { useProjectStore } from './stores/project'
import { useWindowSize } from '@vueuse/core'
import { useGlobalStart } from './stores/runtime'
import { usePluginStore } from './stores/plugin'
import { useDark } from '@vueuse/core'
import { VxeUI } from 'vxe-table'
import { bus } from 'wujie'
import log from 'electron-log'
import { cloneDeep, assign } from 'lodash'
const data = useDataStore()
const project = useProjectStore()
const pluginStore = usePluginStore()
const { width, height } = useWindowSize()
const globalStart = useGlobalStart()
const isDark = useDark()
const params = ref<any>({})

let isExternalUpdate = false
// 监听插件对 store 的修改，同步到主应用
bus.$on('update:dataStore', (newStore: DataSet) => {
  // 使用 $patch 批量更新 store（Pinia 推荐方式）
  isExternalUpdate = true
  data.$patch((state) => {
    assign(state, newStore)
  })
})

// 监听主应用 store 的变化，同步到插件
data.$subscribe((mutation, state) => {
  if (isExternalUpdate) {
    isExternalUpdate = false
    return
  }
  bus.$emit('update:dataStore:fromMain', cloneDeep(data.getData()))
})

// 监听 globalStart 的变化，同步到插件
watch(
  () => globalStart.value,
  (newValue) => {
    bus.$emit('update:globalStart:fromMain', newValue)
  }
)

// Watch for dark theme changes
watch(isDark, (value) => {
  VxeUI.setTheme(value ? 'dark' : 'default')
})

onMounted(async () => {
  // Set initial theme
  if (isDark.value) {
    VxeUI.setTheme('dark')
  }
})

if (window.params.id) {
  params.value = window.params
  if (params.value['edit-index']) {
    params.value['edit-index'] = params.value['edit-index'].split('_')[0]
  }
}
data.$subscribe(() => {
  if (project.open) {
    project.projectDirty = true
  }
})

window.electron.ipcRenderer.on('ipc-global-stop', () => {
  globalStart.value = false
})

onUnmounted(() => {
  bus.$clear()
})
</script>
<style lang="scss">
body {
  margin: 0px;
  padding: 0px;
  font-family:
    Inter, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
    '微软雅黑', Arial, sans-serif;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  overflow: hidden;
  border-radius: 15px;
}

.el-message-box {
  .el-message-box__header {
    .el-message-box__title {
      color: var(--el-color-info-dark-2);
      font-weight: bold;
    }
  }
}

/* Add global style for el-button-group divider */
.el-button-group {
  .el-button {
    &:not(:last-child):not(:only-child) {
      border-right: 1px solid var(--el-bg-color) !important;
    }

    &:not(:first-child):not(:only-child) {
      border-left: 1px solid var(--el-bg-color) !important;
    }

    &:only-child {
      border: none !important;
    }
  }
}

::-webkit-scrollbar {
  width: 7px;
  height: 5px;
  border-radius: 15px;
  -webkit-border-radius: 15px;
}

::-webkit-scrollbar-track-piece {
  background-color: var(--el-bg-color);
  border-radius: 15px;
  -webkit-border-radius: 15px;
}

::-webkit-scrollbar-thumb:vertical {
  height: 5px;
  background-color: var(--el-border-color-darker);
  border-radius: 15px;
  -webkit-border-radius: 15px;
}

::-webkit-scrollbar-thumb:horizontal {
  width: 7px;
  background-color: var(--el-border-color-darker);
  border-radius: 15px;
  -webkit-border-radius: 15px;
}

.el-dialog {
  clip-path: inset(0 round 5px) !important;
  /* 应用圆角 */
  --el-dialog-padding-primary: 10px !important;
  // margin-top: 30px!important;
  // margin-bottom: 20px!important;
}

.el-popper.is-danger {
  /* Set padding to ensure the height is 32px */
  padding: 6px 12px;
  /* color: var(--el-color-white); */
  background: var(--el-color-danger);
}

.el-popper.is-danger .el-popper__arrow::before {
  background: var(--el-color-danger);
  right: 0;
}
</style>
