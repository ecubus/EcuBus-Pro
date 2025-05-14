<template>
  <div class="toolbar">
    <div class="toolbar-item">
      <img
        :src="logo"
        style="
          width: 24px;
          height: auto;
          padding-left: 4px;
          padding-right: 4px;
          -webkit-app-region: drag;
        "
      />
      <el-button-group v-if="project.open">
        <el-button link>
          <Icon class="menuIcon" :icon="home" @click="backHomeHandler" />
        </el-button>
        <el-button link>
          <Icon
            :class="{
              menuIconGreen: project.projectDirty,
              menuIconInfo: !project.projectDirty
            }"
            :icon="saveIcon"
            @click="project.saveProject()"
          />
        </el-button>
      </el-button-group>
      <el-divider direction="vertical" />
      <el-button-group v-if="project.open">
        <el-button
          link
          :disabled="globalStart"
          :type="globalStart ? 'info' : 'success'"
          @click="dataBase.globalRun('start')"
        >
          <Icon style="font-size: 18px" :icon="lightIcon" />
        </el-button>
        <el-button
          link
          :disabled="!globalStart"
          :type="!globalStart ? 'info' : 'danger'"
          @click="dataBase.globalRun('stop')"
        >
          <Icon style="font-size: 18px" :icon="stopIcon" />
        </el-button>
      </el-button-group>
    </div>
    <div class="toolbar-item project-name" :class="{ 'project-name-dirty': project.projectDirty }">
      <span>{{ title }} </span>
    </div>

    <div class="toolbar-item">
      <!-- <div style="display: inline-block;margin-right: 10px;" v-if="project.type == 'uds'">
        <el-tooltip :content="project.projectInfo.uds?.connectInfo" placement="bottom-start">
          <span class="menu-right"  v-if="project.projectInfo.uds?.connected==false">
            <Icon :icon="circleCloseFilled" />
          </span>
          <span class="menu-right" style="color: var(--el-color-success);" v-else>
            <Icon :icon="successFilled" />
          </span>
        </el-tooltip>
      </div> -->

      <span class="menu-right" @click="winHandle('min')">
        <Icon :icon="Min" />
      </span>
      <span class="menu-right" @click="winHandle('max')">
        <Icon :icon="FullScreen" />
      </span>

      <span class="menu-right" @click="winHandle('close')">
        <Icon :icon="Close" />
      </span>
    </div>
    <!-- 添加其他工具栏元素... -->
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, inject, Ref, watch, onBeforeUnmount, toRef, watchEffect } from 'vue'
import { useProjectStore, State as projectState } from '@r/stores/project'
import { useRouter } from 'vue-router'
import logo from '@r/assets/logo64.png'
import { Icon } from '@iconify/vue'
import FullScreen from '@iconify/icons-ep/full-screen'
import Min from '@iconify/icons-ep/minus'
import Close from '@iconify/icons-ep/close'
import circleCloseFilled from '@iconify/icons-ep/circle-close-filled'
import successFilled from '@iconify/icons-ep/success-filled'
import addBox from '@iconify/icons-material-symbols/add-box'
import saveIcon from '@iconify/icons-material-symbols/save-outline'
import saveAs from '@iconify/icons-material-symbols/save-as'
import close from '@iconify/icons-material-symbols/close'
import home from '@iconify/icons-material-symbols/home-outline'
import lightIcon from '@iconify/icons-material-symbols/play-circle-outline-rounded'
import stopIcon from '@iconify/icons-material-symbols/stop-circle-outline'
import { onKeyStroke, onKeyDown } from '@vueuse/core'
import { useDataStore } from '@r/stores/data'
import { ElLoading } from 'element-plus'

const project = useProjectStore()
const router = useRouter()
function backHomeHandler() {
  void router.push('/')
}
const title = ref('')
const globalStart = toRef(window, 'globalStart')
const dataBase = useDataStore()

async function closeHandle() {
  if (project.projectDirty) {
    //save project
    const r = await project.closeProject('close')
    if (r == false) {
      return
    }
  }
  window.electron.ipcRenderer.send('close', window.params.id)
}
function winHandle(action: string) {
  if (action == 'min') {
    window.electron.ipcRenderer.send('minimize', window.params.id)
  } else if (action == 'max') {
    window.electron.ipcRenderer.send('maximize', window.params.id)
  } else if (action == 'close') {
    if (window.globalStart.value) {
      //TODO:add force close
      ElLoading.service()
      window.electron.ipcRenderer.invoke('ipc-global-stop').finally(() => {
        closeHandle()
      })
    } else {
      closeHandle()
    }
  }
}

watchEffect(() => {
  title.value = ''
  if (project.open) {
    if (project.projectInfo.name == '') {
      title.value += 'Untitled'
    } else {
      title.value += project.projectInfo.name
    }
    if (project.projectDirty) {
      title.value += '*'
    }
    // title.value += ` : ${project.type.toUpperCase()}${project.projectDirty?'*':''}`
  }
})

onKeyStroke('s', (e) => {
  if (e.ctrlKey) {
    e.preventDefault()
    if (project.open) {
      project.saveProject()
    }
  }
})

onKeyDown(true, (e) => {
  if (window.globalStart.value) {
    if (e.key == 's' && e.ctrlKey) {
      return
    }
    window.electron.ipcRenderer.send('ipc-key-down', e.key)
  }
})

// onMounted(() => {
//   caclTitle()
// })

// project.$subscribe((val: any, state: projectState) => {
//   caclTitle()
//   document.title = 'EcuBus Pro' + title.value
// });
</script>

<style lang="scss" scoped>
.menuIcon {
  font-size: 18px;
  color: var(--el-color-primary-light-3);
}

.menuIcon:hover {
  color: var(--el-color-primary-dark-2);
}

.menuIconGreen {
  font-size: 18px;
  color: var(--el-color-success-light-3);
}

.menuIconGreenDark {
  font-size: 18px;
  color: var(--el-color-success);
}

.menuIconGreenDark:hover {
  font-size: 18px;
  color: var(--el-color-success-dark-2);
}

.menuIconStop {
  font-size: 18px;
  color: var(--el-color-danger);
}

.menuIconStop:hover {
  font-size: 18px;
  color: var(--el-color-danger-dark-2);
}

.menuIconGreen:hover {
  color: var(--el-color-success);
}

.menuIconInfo {
  font-size: 18px;
  color: var(--el-color-info-light-3);
}

.menuIconInfo:hover {
  color: var(--el-color-info-dark-2);
}

.toolbar {
  overflow: hidden;
  height: 35px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  -webkit-app-region: drag;
  background-color: var(--el-color-primary-light-9);
}

.toolbar-item {
  -webkit-app-region: no-drag;
  height: 35px;
  display: flex;
  align-items: center;
}

.menu {
  display: inline-block;
  height: 35px;
  line-height: 35px;
  vertical-align: middle;
  font-size: 14px;
  font-weight: 500;
  padding-left: 10px;
  padding-right: 10px;
}

.project-name {
  -webkit-app-region: drag;
  color: var(--el-color-info-dark-2);
  display: flex;
  align-items: center;
  /* 这将垂直居中子元素 */
  justify-content: center;
  /* 如果你也想水平居中，可以添加这一行 */
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-name svg {
  margin-right: 10px;
  height: 35px;
  line-height: 35px;
  vertical-align: middle;
}

.project-name span {
  font-weight: normal;
  font-size: 14px;
}

.project-name-dirty span {
  color: var(--el-color-info-dark-2);
  font-weight: bold !important;
}

.menu:hover {
  background-color: var(--el-color-info-light-8);
  margin-top: 5px;
  margin-bottom: 2px;
  height: 25px;
  line-height: 25px;
  border-radius: 5px;
}

.menu-right {
  margin-top: 2px;
  display: inline-block;
  height: 35px;
  line-height: 35px;
  vertical-align: middle;
  font-size: 14px;
  font-weight: 500;
  padding-left: 10px;
  padding-right: 10px;
}

.menu-right:hover {
  background-color: var(--el-color-info-light-8);
  border-radius: 5px;
}
</style>
