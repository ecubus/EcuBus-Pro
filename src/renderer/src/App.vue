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
import { onMounted, ref, watch } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { useDataStore } from './stores/data'
import { useProjectStore } from './stores/project'
import { useWindowSize } from '@vueuse/core'
import { useGlobalStart } from './stores/runtime'
import { usePluginStore } from './stores/plugin'
import { useDark } from '@vueuse/core'
import { VxeUI } from 'vxe-table'
import { bus } from 'wujie'
import log from 'electron-log'
const data = useDataStore()
const project = useProjectStore()
const pluginStore = usePluginStore()
const { width, height } = useWindowSize()
const globalStart = useGlobalStart()
const isDark = useDark()
const params = ref<any>({})

bus.$on('update:modelValue', (pluginId: string, id: string, data: any) => {
  log.info('plugin data update', {
    pluginId,
    id,
    data
  })
  if (pluginId == id) {
    //single data
    data.pluginData[pluginId] = data
  } else {
    //multi data
    if (data.pluginData[pluginId]) {
      data.pluginData[pluginId][id] = data
    } else {
      data.pluginData[pluginId] = {
        [id]: data
      }
    }
  }
})

// Watch for dark theme changes
watch(isDark, (value) => {
  VxeUI.setTheme(value ? 'dark' : 'default')
})

onMounted(async () => {
  // Set initial theme
  if (isDark.value) {
    VxeUI.setTheme('dark')
  }

  await pluginStore.loadAllPlugins()
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
