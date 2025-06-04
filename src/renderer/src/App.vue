<template>
  <el-container>
    <el-header height="35px" style="margin: 0px; padding: 0px">
      <HeaderView />
    </el-header>
    <div>
      <router-view :width="width" :height="height - 35" :edit-index="params['edit-index']" />
    </div>
  </el-container>
</template>

<script setup lang="ts">
import HeaderView from '@r/views/header/header.vue'
import { onMounted, ref } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { useDataStore } from './stores/data'
import { useProjectStore } from './stores/project'
import { useWindowSize } from '@vueuse/core'
import { useGlobalStart } from './stores/runtime'

const data = useDataStore()
const project = useProjectStore()
const { width, height } = useWindowSize()
const globalStart = useGlobalStart()
const params = ref<any>({})
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

::-webkit-scrollbar {
  width: 7px;
  height: 5px;
  border-radius: 15px;
  -webkit-border-radius: 15px;
}

::-webkit-scrollbar-track-piece {
  background-color: var(--el-color-white);
  border-radius: 15px;
  -webkit-border-radius: 15px;
}

::-webkit-scrollbar-thumb:vertical {
  height: 5px;
  background-color: var(--el-color-info-light-7);
  border-radius: 15px;
  -webkit-border-radius: 15px;
}

::-webkit-scrollbar-thumb:horizontal {
  width: 7px;
  background-color: var(--el-color-info-light-7);
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
