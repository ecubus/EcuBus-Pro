<template>
  <el-container v-loading="loading" class="homeCtr">
    <!-- <el-button link type="primary" class="returnButton"> <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 2048 2048"><rect width="2048" height="2048" fill="none"/><path fill="currentColor" d="M960 0Q827 0 705 34t-230 96t-194 150t-150 195t-97 229T0 960q0 133 34 255t96 230t150 194t195 150t229 97t256 34q133 0 255-34t230-96t194-150t150-195t97-229t34-256q0-133-34-255t-96-230t-150-194t-195-150t-229-97T960 0m0 1792q-115 0-221-30t-198-84t-169-130t-130-168t-84-199t-30-221q0-115 30-221t84-198t130-169t168-130t199-84t221-30q115 0 221 30t198 84t169 130t130 168t84 199t30 221q0 115-30 221t-84 198t-130 169t-168 130t-199 84t-221 30m233-896H512v128h681l-278 274l90 92l434-430l-434-430l-90 92z"/></svg></el-button> -->
    <el-tabs v-model="activeMenu" tab-position="left" class="main" lazy @tab-change="mainTabChange">
      <el-tab-pane v-if="project.open" name="return">
        <template #label>
          <div class="menu-item normal">
            <svg
              style="transform: rotate(180deg); font-size: 26px; padding: 6px"
              xmlns="http://www.w3.org/2000/svg"
              width="1em"
              height="1em"
              viewBox="0 0 2048 2048"
            >
              <rect width="2048" height="2048" fill="none" />
              <path
                fill="currentColor"
                d="M960 0Q827 0 705 34t-230 96t-194 150t-150 195t-97 229T0 960q0 133 34 255t96 230t150 194t195 150t229 97t256 34q133 0 255-34t230-96t194-150t150-195t97-229t34-256q0-133-34-255t-96-230t-150-194t-195-150t-229-97T960 0m0 1792q-115 0-221-30t-198-84t-169-130t-130-168t-84-199t-30-221q0-115 30-221t84-198t130-169t168-130t199-84t221-30q115 0 221 30t198 84t169 130t130 168t84 199t30 221q0 115-30 221t-84 198t-130 169t-168 130t-199 84t-221 30m233-896H512v128h681l-278 274l90 92l434-430l-434-430l-90 92z"
              />
            </svg>
            <span>Return</span>
          </div>
        </template>
      </el-tab-pane>
      <el-tab-pane v-if="project.open" name="close">
        <template #label>
          <div class="menu-item danger">
            <Icon :icon="close" />
            <span>Close</span>
          </div>
        </template>
      </el-tab-pane>
      <el-tab-pane name="home">
        <template #label>
          <div class="menu-item">
            <Icon :icon="homeIcon" />
            <span>Home</span>
          </div>
        </template>
        <div class="lr">
          <div class="examples">
            <img style="width: 180px; margin-top: 20px; margin-left: 0px" :src="logo" />
            <div>
              <el-divider content-position="left"><strong>Documents</strong></el-divider>
              <div style="text-align: center">
                <div class="doc" @click="openUm">
                  <span class="card-text">User Manual</span>
                  <Icon :icon="externalIcon" style="font-size: 20px" />
                </div>
              </div>
              <el-divider content-position="left"><strong>System Information</strong></el-divider>
              <div class="info">
                <el-scrollbar :height="infoHeight">
                  <el-table :data="versions" style="width: 100%">
                    <el-table-column prop="name" label="Module" width="180" />
                    <el-table-column prop="version" label="Version" />
                  </el-table>
                </el-scrollbar>
              </div>

              <!-- Advertisement Slots -->
              <el-divider content-position="left"
                ><strong>Advertising Partnership</strong></el-divider
              >
              <div class="ad-slots">
                <div class="ad-slot premium" @click="openAdLink('ad1')">
                  <div class="ad-icon">
                    <Icon :icon="starIcon" />
                  </div>
                  <div class="ad-content">
                    <div class="ad-title">📢 Advertise Here</div>
                    <div class="ad-description">
                      Showcase your products and services to professional automotive engineers
                    </div>
                    <div class="ad-cta">Contact Us →</div>
                  </div>
                </div>
                <!-- <div class="ad-slot sponsor" @click="openAdLink('ad2')">
                  <div class="ad-icon">
                    <Icon :icon="heartIcon" />
                  </div>
                  <div class="ad-content">
                    <div class="ad-title">🤝 Partner With Us</div>
                    <div class="ad-description">Become an official EcuBus Pro partner and serve the automotive industry together</div>
                    <div class="ad-cta">Learn More →</div>
                  </div>
                </div> -->
              </div>
            </div>
          </div>

          <!-- <div class="examples">
                        <el-scrollbar>
                            <div class="scrollbar-flex-content">
                                <el-divider direction="vertical" content-position="left"  style="height: 120px;"><template>Project</template></el-divider>
                                    <div class="scrollbar-demo-item" v-if="!project.open">
                                      
                                        <el-button link type="primary">  <Icon :icon="returnIcon" /></el-button>
                                    </div>
                                    <div class="scrollbar-demo-item" v-if="!project.open">
                                        <Icon :icon="close" />
                                        <el-button link type="danger">Close</el-button>
                                    </div>
                                   

                               

                             
                            </div>
                        </el-scrollbar>

                    </div> -->
          <div>
            <div class="notify"></div>
            <el-tabs v-model="homeActiveMenu" class="homeMenu">
              <el-tab-pane name="recent">
                <template #label>
                  <div class="mx-1"><Icon :icon="recentIcon"></Icon> <span>Recent</span></div>
                </template>
                <div class="recent">
                  <el-scrollbar :height="recentHeight">
                    <div
                      v-for="p in projectList.projectList"
                      :key="p.path"
                      class="pitem"
                      @click="openProject(p)"
                    >
                      <div>
                        <div class="name">{{ p.name }}</div>
                        <div class="path">
                          {{ p.path }}
                        </div>
                      </div>
                      <div class="timestamp">{{ formatDate(p.lastOpenTime) }}</div>
                      <div style="display: flex; gap: 20px; align-items: center; width: 100px">
                        <Icon
                          class="closeIcon"
                          :icon="close"
                          style="
                            color: var(--el-color-info-light-3);
                            font-size: 20px;
                            display: none;
                          "
                          @click.stop="projectList.deleteProject(p)"
                        />
                        <Icon
                          class="openIcon"
                          :icon="pinIcon"
                          :style="{
                            display: p.pined ? 'block' : 'none',
                            color: p.pined
                              ? 'var(--el-color-primary)'
                              : 'var(--el-color-info-light-3)'
                          }"
                          style="font-size: 20px"
                          @click.stop="projectList.pinProject(p)"
                        />
                      </div>
                    </div>
                  </el-scrollbar>
                </div>
              </el-tab-pane>
              <el-tab-pane name="pin">
                <template #label>
                  <div class="mx-1"><Icon :icon="pinIcon"></Icon> <span>Pinned</span></div>
                </template>
                <div class="recent">
                  <el-scrollbar :height="recentHeight">
                    <div
                      v-for="p in pinedProjectList"
                      :key="p.path"
                      class="pitem"
                      @click="openProject(p)"
                    >
                      <div>
                        <div class="name">{{ p.name }}</div>
                        <div
                          style="
                            color: var(--el-color-info-dark-2);
                            font-size: 15px;
                            font-weight: 500;
                            max-width: 400px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                          "
                        >
                          {{ p.path }}
                        </div>
                      </div>
                      <div class="timestamp">{{ formatDate(p.lastOpenTime) }}</div>
                      <div style="display: flex; gap: 20px; align-items: center; width: 100px">
                        <Icon
                          class="closeIcon"
                          :icon="close"
                          style="
                            color: var(--el-color-info-light-3);
                            font-size: 20px;
                            display: none;
                          "
                          @click.stop="projectList.deleteProject(p)"
                        />
                        <Icon
                          class="openIcon"
                          :icon="pinIcon"
                          :style="{ display: p.pined ? 'block' : 'none' }"
                          style="color: var(--el-color-info-light-3); font-size: 20px"
                          @click.stop="projectList.pinProject(p)"
                        />
                      </div>
                    </div>
                  </el-scrollbar>
                </div>
              </el-tab-pane>
              <!-- <el-tab-pane name="example">
                                <template #label>
                                    <div class="mx-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em"
                                            viewBox="0 0 24 24">
                                            <rect width="24" height="24" fill="none" />
                                            <path fill="currentColor"
                                                d="M2 2h20v2h-1v14h-6.586l4 4L17 23.414l-5-5l-5 5L5.586 22l4-4H3V4H2zm3 2v12h14V4zm5 2.5l4.667 3.5L10 13.5z" />
                                        </svg> <span>Examples</span>
                                    </div>

                                </template>
                            </el-tab-pane> -->
            </el-tabs>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="new">
        <template #label>
          <div class="menu-item">
            <Icon :icon="newIcon" />
            <span>New</span>
          </div>
        </template>
        <div class="newMenu">
          <newVue :height="height" />
        </div>
      </el-tab-pane>
      <el-tab-pane name="open">
        <template #label>
          <div class="menu-item">
            <Icon :icon="openIcon" />
            <span>Open</span>
          </div>
        </template>
      </el-tab-pane>
      <el-tab-pane name="pluginMarketplace">
        <template #label>
          <div class="menu-item">
            <Icon :icon="pluginIcon" />
            <span>Plugin</span>
          </div>
        </template>
        <div class="marketplaceMenu">
          <PluginMarketplace :height="height" />
        </div>
      </el-tab-pane>
      <el-tab-pane name="user">
        <template #label>
          <div class="menu-item">
            <el-badge :hidden="!hasNotify" is-dot type="primary" class="item">
              <Icon :icon="setting" />
            </el-badge>

            <span>Setting</span>
          </div>
        </template>
        <el-tabs v-model="activeSet" class="settingMenu">
          <el-tab-pane label="Setting" name="setting">
            <template #label>
              <span class="custom-tabs-label">
                <Icon :icon="setting" />
                <span>Setting</span>
              </span>
            </template>
            <el-tabs
              tab-position="left"
              :style="{
                height: height - 110 + 'px'
              }"
            >
              <el-tab-pane label="general">
                <template #label>
                  <span class="custom-tabs-label">
                    <Icon :icon="generalIcon" />
                    <span>General</span>
                  </span>
                </template>
                <general
                  :style="{
                    height: height - 170 + 'px'
                  }"
                />
              </el-tab-pane>
              <!-- <el-tab-pane label="plugin">
                <template #label>
                  <span class="custom-tabs-label">
                    <Icon :icon="pluginIcon" />
                    <span>Plugin</span>
                  </span>
                </template>
                <plugin-manager :height="height - 170" />
              </el-tab-pane> -->
            </el-tabs>
          </el-tab-pane>

          <el-tab-pane label="Others" name="others">
            <template #label>
              <span class="custom-tabs-label">
                <Icon :icon="baseIcon" />
                <span>Others</span>
              </span>
            </template>
            <el-tabs
              tab-position="left"
              :style="{
                height: height - 110 + 'px'
              }"
            >
              <el-tab-pane label="policy">
                <template #label>
                  <span class="custom-tabs-label">
                    <Icon :icon="policyIcon" />
                    <span>License</span>
                  </span>
                </template>
                <policy
                  :style="{
                    height: height - 170 + 'px'
                  }"
                />
              </el-tab-pane>
            </el-tabs>
          </el-tab-pane>
          <el-tab-pane label="Update" name="second">
            <template #label>
              <el-badge is-dot :hidden="!hasUpdate" type="primary">
                <span class="custom-tabs-label">
                  <Icon :icon="updateIcon" />
                  <span>Update</span>
                </span>
              </el-badge>
            </template>
            <update v-model="hasUpdate" :height="height" />
          </el-tab-pane>
        </el-tabs>
      </el-tab-pane>

      <!-- <el-tab-pane name="setting">
                <template #label>
                    <div class="menu-item">
                        <el-badge :hidden="!hasNotify" is-dot type="primary" class="item">
                            <Icon :icon="setting" />
                        </el-badge>


                        <span>Setting</span>
                    </div>
                </template>
                <el-tabs v-model="activeSet" class="settingMenu">
                    <el-tab-pane label="General" name="general"></el-tab-pane>
                    <el-tab-pane label="Update" name="second">
                        <template #label>
                            <el-badge is-dot :hidden="!hasUpdate" type="primary">
                                <span style="margin: 0 10px;">Update</span>
                            </el-badge>
                        </template>
                        <update v-model="hasUpdate" />
                    </el-tab-pane>

                </el-tabs>
            </el-tab-pane> -->
    </el-tabs>
    <!-- <el-aside width="120px">
            <div class="sidebar">
                
                <div class="menu">
                    <div class="menu-item" v-if="user.user">
                        <el-avatar :size="32" :src="user.user.avatar" />
                        <span>{{ user.user.displayName }}</span>
                    </div>
                    <div class="menu-item" v-else>
                        <Icon :icon="userIcon" />
                        <span>Sign In</span>
                    </div>
                    <div class="menu-item">
                        <Icon :icon="newIcon" />
                        <span>New</span>
                    </div>
                    <div class="menu-item">
                        <Icon :icon="openIcon" />
                        <span>Open</span>
                        </div>
                </div>
            </div>
        </el-aside>

        <el-main class="main">
            xx

      
          
       
        </el-main> -->
  </el-container>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, version as vueVersion } from 'vue'
import logo from '@r/assets/logo.svg'
import { useWindowSize } from '@vueuse/core'
import { Icon, IconifyIcon } from '@iconify/vue'
import userIcon from '@iconify/icons-material-symbols/person-outline'
import newIcon from '@iconify/icons-material-symbols/add-circle-outline'
import openIcon from '@iconify/icons-material-symbols/folder-open-outline-sharp'
import homeIcon from '@iconify/icons-material-symbols/home-outline'
import recentIcon from '@iconify/icons-material-symbols/history'
import pinIcon from '@iconify/icons-material-symbols/push-pin-outline'
import close from '@iconify/icons-material-symbols/close'
import setting from '@iconify/icons-material-symbols/settings-outline'
import upgrade from '@iconify/icons-material-symbols/upgrade'
import policyIcon from '@iconify/icons-material-symbols/assignment'
import policy from './policy.vue'
import { useProjectList, useProjectStore } from '@r/stores/project'
import { version, ecubusPro } from './../../../../../package.json'
import { version as elVer, ElMessage } from 'element-plus'
import log from 'electron-log/renderer'
import newVue from './new.vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '@r/stores/data'
import dayjs from 'dayjs'
// import relativeTime from 'dayjs/plugin/relativeTime';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import update from './update.vue'
import updateIcon from '@iconify/icons-material-symbols/browser-updated-sharp'
import baseIcon from '@iconify/icons-material-symbols/align-start'
import generalIcon from '@iconify/icons-material-symbols/settings-outline'
import general from './general.vue'
import externalIcon from '@iconify/icons-mdi/external-link'
import starIcon from '@iconify/icons-material-symbols/star-outline'
import heartIcon from '@iconify/icons-material-symbols/favorite-outline'
import pluginIcon from '@iconify/icons-mdi/puzzle'
import PluginMarketplace from './PluginMarketplace.vue'
import { usePluginStore } from '@r/stores/plugin'
// dayjs.extend(relativeTime);
dayjs.extend(isSameOrAfter)
const hasUpdate = ref(false)
const { width, height } = useWindowSize()
const project = useProjectStore()
const data = useDataStore()
const activeMenu = ref('home')
let lastActiveMenu = 'home'
const homeActiveMenu = ref('recent')
const projectList = useProjectList()
const activeSet = ref('setting')
const pinedProjectList = computed(() => {
  return projectList.projectList.filter((p) => p.pined)
})
const recentHeight = computed(() => {
  return height.value - 35 - 180 + 'px'
})
const infoHeight = computed(() => {
  return height.value - 235 - 80 - 220 + 'px' // Reduced by 120px to make room for ads
})
const pluginStore = usePluginStore()
pluginStore.loadAllPlugins().catch((e) => {
  log.error(e)
})
const hasNotify = computed(() => {
  return hasUpdate.value
})
function formatDate(timestamp: number) {
  const date = dayjs(timestamp)
  const now = dayjs()
  const weekStart = now.startOf('week')

  if (date.isSameOrAfter(weekStart)) {
    // 如果日期在本周内
    return date.format('dddd HH:mm') // 返回周几 + 时间
  } else if (date.year() === now.year()) {
    // 如果是今年的日期
    return date.format('M月D日')
  } else {
    // 如果是往年的日期
    return date.format('YYYY年M月D日')
  }
}
function openProject(p: any) {
  project.openProjectByPath(window.path.join(p.path, p.name))
}

function openUm() {
  window.electron.ipcRenderer.send('ipc-open-um')
}

function openAdLink(adId: string) {
  if (adId === 'ad1') {
    window.electron.ipcRenderer.send(
      'ipc-open-link',
      'https://app.whyengineer.com/docs/about/contact.html'
    )
  }
}

const versions = ref([
  {
    name: 'Ecubus Pro',
    version: version
  },
  {
    name: 'Vue',
    version: vueVersion
  },
  {
    name: 'Element-Plus',
    version: elVer
  }
])
const loading = ref(false)
const router = useRouter()
function mainTabChange(tab: string) {
  if (tab == 'open') {
    nextTick(() => {
      activeMenu.value = lastActiveMenu
    })
    loading.value = true
    project.openProject().finally(() => {
      loading.value = false
    })
  } else if (tab == 'return') {
    nextTick(() => {
      activeMenu.value = lastActiveMenu
    })
    router.push('/uds')
  } else if (tab == 'close') {
    nextTick(() => {
      activeMenu.value = lastActiveMenu
    })
    project.closeProject('close')
  } else {
    lastActiveMenu = tab
  }
  // lastActiveMenu=tab
}

onMounted(() => {
  window.electron.ipcRenderer
    .invoke('ipc-get-version', ecubusPro)
    .then((v) => {
      log.debug(v)
      versions.value.push(...v)
    })
    .catch((e) => {
      log.error(e)
    })
})
</script>

<style lang="scss" scoped>
.main {
  --el-tabs-header-height: 80px;
  text-align: center;

  .el-tabs__header {
    margin-right: 0px !important;
  }

  .is-active {
    .menu-item {
      color: var(--el-color-primary) !important;
    }
  }
}
</style>
<style scoped>
.itable {
  height: v-bind(recentHeight-1100 + 'px');
  overflow-y: auto;
}

.doc {
  margin: auto;
  width: 200px;
  height: 40px;
  border: 1px solid #ccc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.info {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 10px;
  margin: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  background: var(--el-bg-color-overlay);
}

.doc:hover {
  cursor: pointer;

  /* box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); */
  background-color: var(--el-color-info-light-9);
}

.card-text {
  font-family: Arial, sans-serif;
  font-size: 18px;
}

.main {
  /* width: v-bind(width + "px"); */
  height: v-bind(height -35 + 'px');
}

.mx-1 {
  display: flex;

  justify-content: center;
  gap: 4px;
  padding-left: 5px;
  padding-right: 5px;
}

.mx-1 svg {
  font-size: 16px;
}

.mx-1 span {
  font-size: 16px;
  font-weight: bold;
}

.openIcon:hover {
  color: var(--el-color-primary) !important;
}

.closeIcon:hover {
  color: var(--el-color-primary) !important;
}

.homeMenu {
  width: v-bind(width-470 + 'px');
  height: v-bind(height-35 - 80 +'px');
}

.settingMenu {
  width: v-bind(width-130 + 'px');
  height: v-bind(height-40 + 'px');
}

.notify {
  height: 78px;
}

.signMenu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: v-bind(width-120 + 'px');
  height: v-bind(height-35 + 'px');
}

.newMenu {
  width: v-bind(width-120 + 'px');
  height: v-bind(height-35 + 'px');
}

.marketplaceMenu {
  width: v-bind(width-120 + 'px');
  height: v-bind(height-35 + 'px');
}

.sidebar {
  padding: 20px;
  height: v-bind(height-35 + 'px');
  background-color: var(--el-color-primary-light-9);
  display: flex;
  flex-direction: column;
}

.lr {
  display: flex;
  flex-direction: row;
}

.examples {
  width: 350px;
  text-align: left;
}

.returnButton {
  position: absolute;
  bottom: 10px;
  left: 35px;
  z-index: 100;
  transform: rotate(180deg);
  font-size: 30px;
}

.pitem {
  width: v-bind(width-530 + 'px');
  padding: 20px;
  margin: 5px;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.path {
  color: var(--el-color-info-dark-2);
  font-size: 15px;
  font-weight: 500;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pitem > div:first-child {
  flex-grow: 1;
  max-width: calc(100% - 350px);
  min-width: 0;
}

.pitem .name {
  font-size: 18px;
  font-weight: bold;
  /* padding: 5px; */
  /* margin-top: 20px;
    padding-left: 20px; */
  margin-bottom: 4px;
  color: var(--el-color-info-dark-2);
}

.pitem:hover {
  background-color: var(--el-color-info-light-9);
  cursor: pointer;
  border-radius: 5px;
}

.pitem:hover .closeIcon {
  display: block !important;
}

.pitem:hover .openIcon {
  display: block !important;
}

.menu-item {
  width: 50px;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px;
  border-radius: 5px;
  cursor: pointer;
  color: var(--el-text-color-primary);
  transition: background-color 0.3s;
}

.menu-item:hover {
  color: var(--el-color-primary);
}

.sitem {
  width: 50px !important;
  height: 30px !important;
}

.danger:hover {
  color: var(--el-color-danger) !important;
}

.normal:hover {
  color: var(--el-color-info) !important;
}

.menu-item span {
  font-size: 14px;
}

.menu-item svg {
  font-size: 32px;
}

.search-input {
  margin-bottom: 20px;
}

.templates {
  margin-bottom: 30px;
}

.template-image {
  width: 100%;
  display: block;
}

.template-name {
  padding: 10px;
  text-align: center;
}

.scrollbar-flex-content {
  display: flex;
  /* 确保使用 Flexbox */
  height: 150px;
  align-items: center;
  /* 垂直居中 */
  flex-direction: row;
  /* 水平排列 */
}

.scrollbar-demo-item {
  display: flex;
  flex-direction: column;
  /* 内容上下排列 */
  align-items: center;
  /* 内容在 .scrollbar-demo-item 中垂直居中 */
  justify-content: center;
  /* 内容在 .scrollbar-demo-item 中水平居中 */
  width: 100px;
  height: 120px;
  margin: 10px;
  text-align: center;
  border-radius: 4px;
  gap: 10px;
  /* 内容之间的间距 */
  background: var(--el-color-info-light-9);
}

.scrollbar-demo-item svg {
  font-size: 40px;
  color: var(--el-color-info-dark-2);
}

.timestamp {
  color: var(--el-color-info-dark-2);
  font-size: 12px;
  font-weight: 500;
  width: 100px;
  text-align: center;
}

.custom-tabs-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 0 10px;
}

.ad-slots {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 10px;
}

.ad-slot {
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 20px;
  background: linear-gradient(
    135deg,
    var(--el-bg-color-overlay) 0%,
    var(--el-color-info-light-9) 100%
  );
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.4s ease;
  min-height: 70px;
  display: flex;
  align-items: center;
  gap: 15px;
  position: relative;
  overflow: hidden;
}

.ad-slot::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.6s;
}

.ad-slot:hover::before {
  left: 100%;
}

.ad-slot:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.ad-slot.premium {
  border-color: var(--el-color-primary);
  background: linear-gradient(
    135deg,
    var(--el-color-primary-light-9) 0%,
    var(--el-color-primary-light-8) 100%
  );
}

.ad-slot.premium:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 8px 25px rgba(64, 158, 255, 0.3);
}

.ad-slot.sponsor {
  border-color: var(--el-color-success);
  background: linear-gradient(
    135deg,
    var(--el-color-success-light-9) 0%,
    var(--el-color-success-light-8) 100%
  );
}

.ad-slot.sponsor:hover {
  border-color: var(--el-color-success);
  box-shadow: 0 8px 25px rgba(103, 194, 58, 0.3);
}

.ad-icon {
  font-size: 24px;
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  flex-shrink: 0;
}

.ad-slot.sponsor .ad-icon {
  color: var(--el-color-success);
}

.ad-content {
  flex: 1;
  text-align: left;
}

.ad-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 6px;
  line-height: 1.2;
}

.ad-description {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  line-height: 1.4;
}

.ad-cta {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ad-slot.sponsor .ad-cta {
  color: var(--el-color-success);
}
</style>
