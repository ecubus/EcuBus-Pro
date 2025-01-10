<template>
  <div>
    <div class="demo-tabs" :class="{ 'tablePin': pined }">
      <el-tabs type="border-card" v-model="activeMenu">
        <!-- <el-tab-pane name="_home">
          <template #label>
            <img :src="logo" style="width: 35px;padding-left:5px;padding-right:5px; -webkit-app-region: drag" />
          </template>

</el-tab-pane> -->
        <el-tab-pane name="home">
          <template #label>
            <span class="lr">
              <Icon :icon="homeIcon" style="font-size: 16px; " />
              <span>Home</span>
            </span>
          </template>
          <div style="display:flex;gap:5px;padding:15px;">
            <div class="grid mingird" @click="dataBase.globalRun('start')" :class="{
              girdenable: !globalStart,
              girddisable: globalStart
            }" style="color:var(--el-color-success)">
              <Icon :icon="lightIcon" style="font-size: 32px;" />
              <span>Start</span>
            </div>
            <div class="grid mingird" @click="dataBase.globalRun('stop')" :class="{
              girdenable: globalStart,
              girddisable: !globalStart
            }" style="color:var(--el-color-danger)">
              <Icon :icon="stopIcon" style="font-size: 32px;" />
              <span>Stop</span>
            </div>
            <el-divider direction="vertical" style="height: 54px;" />
            <div class="grid girdenable" @click="handleSelect(['trace'])">
              <Icon :icon="logIcon" style="font-size: 24px; " />
              <span>Trace</span>
            </div>
            <div class="grid girdenable" @click="handleSelect(['message'])">
              <Icon :icon="msgIcon" style="font-size: 24px; " />
              <span>Message</span>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane name="hardware">
          <template #label>
            <span class="lr">
              <Icon :icon="hardware" style="font-size: 16px; " />
              <span>Hardware</span>
            </span>
          </template>
          <div style="display:flex;gap:5px;padding:15px">
           
            <div class="grid girdenable" @click="handleSelect(['hardware'])">
              <Icon :icon="deviceIcon" style="font-size: 24px; " />
              <span>Devices</span>
            </div>
            <div class="grid girdenable" @click="handleSelect(['network'])">
              <Icon :icon="networkNode" style="font-size: 24px; " />
              <span>Network</span>
            </div>
            <div class="grid girdenable">
              <Icon :icon="interIcon" style="font-size: 24px; " />
              <el-dropdown @command="openIA">
                <span class="lr">
                  Interact
                  <el-icon class="el-icon--right">
                    <arrow-down />
                  </el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu size="small">
                    <el-dropdown-item v-for="item, key in dataBase.ia" :command="key" :key="key">{{ item.name }}
                    </el-dropdown-item>
                    <el-dropdown-item disabled v-if="Object.keys(dataBase.ia).length == 0">No
                      Interaction</el-dropdown-item>

                  </el-dropdown-menu>
                </template>
              </el-dropdown>

            </div>

          </div>
        </el-tab-pane>
        <el-tab-pane name="diag">
          <template #label>
            <span class="lr">
              <Icon :icon="diagIcon" style="font-size: 16px; " />
              <span>Diagnostics</span>
            </span>
          </template>
          <div style="display:flex;gap:5px;padding:15px">
            <div class="grid girdenable" @click="handleSelect(['tester'])">
              <Icon :icon="textFields" style="font-size: 24px; " />
              <span>UDS Tester</span>
            </div>
            <div class="grid girdenable">
              <Icon :icon="diagServiceIcon" style="font-size: 24px; " />
              <el-dropdown @command="openService">
                <span class="lr">
                  Services
                  <el-icon class="el-icon--right">
                    <arrow-down />
                  </el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu size="small">
                    <el-dropdown-item v-for="item, key in dataBase.tester" :command="key" :key="key">{{ item.name }}
                    </el-dropdown-item>
                    <el-dropdown-item disabled v-if="Object.keys(dataBase.tester).length == 0">No
                      Tester</el-dropdown-item>

                  </el-dropdown-menu>
                </template>
              </el-dropdown>

            </div>
            <div class="grid girdenable">
              <Icon :icon="stepIcon" style="font-size: 24px; " />
              <el-dropdown @command="openSequence">
                <span class="lr">
                  Sequence
                  <el-icon class="el-icon--right">
                    <arrow-down />
                  </el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu size="small">
                    <el-dropdown-item v-for="item, key in dataBase.tester" :command="key" :key="key">{{ item.name }}
                    </el-dropdown-item>
                    <el-dropdown-item disabled v-if="Object.keys(dataBase.tester).length == 0">No
                      Tester</el-dropdown-item>

                  </el-dropdown-menu>
                </template>
              </el-dropdown>

            </div>
          </div>
        </el-tab-pane>
        <!-- <el-tab-pane label="">
        <template #label>
          <span class="lr">
            <Icon :icon="toolIcon" style="font-size: 16px; " />
            <span>Tools</span>
          </span>
        </template>
        <div style="display:flex;gap:5px;padding:15px">
          <div class="grid girdenable" @click="handleSelect(['tester'])">
            <Icon :icon="textFields" style="font-size: 24px; " />
            <span>UDS Tester</span>
          </div>
     
        </div>
      </el-tab-pane> -->
        <el-tab-pane name="other">
          <template #label>
            <span class="lr">
              <Icon :icon="userIcon" style="font-size: 16px; " />
              <span>Others</span>
            </span>
          </template>
          <div style="display:flex;gap:5px;padding:15px">
            <div class="grid girdenable">
              <Icon :icon="dataBaseIcon" style="font-size: 24px; " />
              <el-dropdown @command="openDatabase">
                <span class="lr">
                  Database
                  <el-icon class="el-icon--right">
                    <arrow-down />
                  </el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu size="small">
                    <!-- <el-dropdown-item v-for="item, key in dataBase.database" :command="key" :key="key">{{ item.name }}
                      </el-dropdown-item> -->
                    <el-dropdown-item icon="Plus" command="addLin">Add Lin (LDF)
                    </el-dropdown-item>
                    <el-dropdown-item icon="Plus" disabled command="addCan">Add CAN (DBC)
                    </el-dropdown-item>
                    <el-dropdown-item divider v-for="item, index in dataBaseList" :command="item.url" :key="item.url"
                      :disabled="item.disabled" :divided="index == 0">
                      <Icon :icon="dataBaseIcon" style="margin-right: 5px;" />{{ item.url }}

                    </el-dropdown-item>

                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <!-- <div class="grid girdenable" @click="handleSelect(['script'])">
              <Icon :icon="codeIcon" style="font-size: 24px; " />
              <span>Edit Script</span>
            </div> -->
            <div class="grid girdenable" @click="openApi()">

              <Icon :icon="apiIcon" style="font-size: 24px; " />
              <span>Script Api</span>
            </div>

          </div>

        </el-tab-pane>
      </el-tabs>
      <el-button style="position:absolute;top:135px;right:5px" v-if="activeMenu" type="info" link
        @click="pined = !pined">
        <svg xmlns="http://www.w3.org/2000/svg" v-if="!pined" width="1em" height="1em" viewBox="0 0 24 24">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="m3 21l5-5m5.259 2.871c-3.744-.85-7.28-4.386-8.13-8.13c-.135-.592-.202-.888-.007-1.369c.194-.48.433-.63.909-.927c1.076-.672 2.242-.886 3.451-.78c1.697.151 2.546.226 2.97.005c.423-.22.71-.736 1.286-1.767l.728-1.307c.48-.86.72-1.291 1.285-1.494s.905-.08 1.585.166a5.63 5.63 0 0 1 3.396 3.396c.246.68.369 1.02.166 1.585c-.203.564-.633.804-1.494 1.285l-1.337.745c-1.03.574-1.544.862-1.765 1.289c-.22.428-.14 1.258.02 2.918c.118 1.22-.085 2.394-.766 3.484c-.298.476-.447.714-.928.909c-.48.194-.777.127-1.37-.008" />
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" v-else width="1em" height="1em" viewBox="0 0 24 24">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M7.5 8c-.541.128-1 .142-1.507.459c-.92.575-1.142 1.258-.905 2.302c.852 3.753 4.398 7.299 8.15 8.15c1.045.238 1.728.017 2.304-.903c.3-.48.33-1 .458-1.508m-4-8.7a1.3 1.3 0 0 0 .43-.118c.97-.505 1.5-2.148 2.02-3.082c.481-.863.722-1.294 1.288-1.498s.907-.08 1.588.166a5.64 5.64 0 0 1 3.406 3.406c.246.681.37 1.022.166 1.588s-.635.807-1.498 1.288c-.94.524-2.605 1.06-3.11 2.04a1.2 1.2 0 0 0-.113.41M3 21l5-5M3 3l18 18"
            color="currentColor" />
        </svg>
        <!-- <Icon :class="{
          xpin: pined
        }" :icon="pinIcon" /> -->
      </el-button>
      <div style="width: 75px;position:absolute;top:50px;right:2px" v-if="maxWinId">
        <span class="menu-right" @click="layoutMaster.minWin(maxWinId)">
          <Icon :icon="checkIndeterminateSmall" />
        </span>

        <span class="menu-right" @click="layoutMaster.maxWin(maxWinId)">
          <Icon :icon="resizeIcon" />
        </span>

        <span class="menu-right" @click="layoutMaster.removeWin(maxWinId)">
          <Icon :icon="closeIcon" />
        </span>
      </div>
    </div>
    <div class="windows" v-if="!maxWinId && hideLayout.length > 0">
      <div v-for="item in hideLayout" :key="item.id" class="littleWin">
        <Icon v-if="layoutMaster.validLayout[item.title].icon" :icon="layoutMaster.validLayout[item.title].icon || ''"
          style="margin-right: 5px; font-size: 14px" />
        <el-text style="width: 60px;" truncated>
          {{
            firstByteUpper(item.title)
          }}<span v-if="item.options.name != undefined">-{{ `${item.options.name ? item.options.name :
            'Untitled'}`
            }}</span>
        </el-text>


        <span class="menu-right" @click="layoutMaster.showWin(item.id)">
          <Icon :icon="resizeIcon" />
        </span>

        <span class="menu-right" @click="layoutMaster.removeWin(item.id)">
          <Icon :icon="closeIcon" />
        </span>


      </div>
    </div>
    <div class="content">

      <div class="left1" v-if="layoutMaster.left1.value"></div>
      <div class="left2" v-if="layoutMaster.left2.value"></div>
      <div class="left" v-if="layoutMaster.left.value"></div>
      <div class="right" v-if="layoutMaster.right.value"></div>
      <div class="right1" v-if="layoutMaster.right1.value"></div>
      <div class="right2" v-if="layoutMaster.right2.value"></div>
      <div v-for="item in project.project.wins" :key="item.id" style="position: absolute; padding: 1px">

        <div v-show="!item.hide" v-if="layoutMaster.getLayoutType(item.id) == undefined" :id="`win${item.id}`" class="uds-window" :style="{
          top: `${item.pos.y}px`,
          left: `${item.pos.x}px`,
          width: `${item.pos.w}px`,
          height: `${item.pos.h}px`
        }">
          <div class="titleBar" :style="{
            width: `${item.pos.w - 2}px`,
            height: '25px',
            borderRadius: '3px 3px 0px 0px',
            backgroundColor:
              layoutMaster.activeWin.value == item.id
                ? 'var(--el-color-primary-light-5)'
                : 'var(--el-color-info-light-7)',
            borderTop: 'solid 1px var(--el-color-info-light-5)',
            borderRight: 'solid 1px var(--el-color-info-light-5)',
            borderLeft: 'solid 1px var(--el-color-info-light-5)'
          }" @dblclick="layoutMaster.maxWin(item.id)">
            <div class="uds-draggable" :style="{
              height: '19px',
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '3px',
              width: `${item.pos.w - 2}px`
            }">
              <span class="title" :style="{ width: `${item.pos.w - 85}px` }">
                <Icon v-if="layoutMaster.validLayout[item.title].icon"
                  :icon="layoutMaster.validLayout[item.title].icon || ''" style="margin-right: 5px; font-size: 14px" />
                <span style="display: inline-flex; align-items: center;">{{
                  item.label
                }}<span v-if="item.options.name != undefined">-{{ `${item.options.name ? item.options.name :
                    'Untitled'}`
                    }}</span>
                  <span v-if="modify[item.id]" style="margin-left: 2px;font-weight: bolder">*</span>

                </span>

              </span>
              <div style="width: 75px" class="uds-no-drag">
                <span class="menu-right" @click="layoutMaster.minWin(item.id)">
                  <Icon :icon="checkIndeterminateSmall" />
                </span>

                <span class="menu-right" @click="layoutMaster.maxWin(item.id)">
                  <Icon :icon="resizeIcon" />
                </span>

                <span class="menu-right" @click="layoutMaster.removeWin(item.id)">
                  <Icon :icon="closeIcon" />
                </span>
              </div>
            </div>
          </div>
          <!-- <KeepAlive> -->
          <div class="uds-no-drag window" style="overflow: auto" :style="{

            height: item.pos.h - 28 + 'px',
            backgroundColor: 'white'
          }">
            <component :ref="(r) => {
              layoutMaster.winRef[item.id] = r
            }
              " :is="layoutMaster.validLayout[item.title].component" :width="item.pos.w - 6" :height="item.pos.h - 30"
              :id="item.id" v-bind="layoutMaster.data.project.wins[item.id].options.params" />
          </div>
          <!-- </KeepAlive> -->
        </div>


        <!-- <span class="remove" @click="removeItem(item.i)">x</span> -->
      </div>

    </div>
    <div class="footer">
      <div v-for="item in project.project.wins" :key="item.id">
        <div v-if="layoutMaster.getLayoutType(item.id) == 'bottom'" :id="`win${item.id}`">
          <div class="titleBar" :style="{
            width: `${contentW}px`,
            height: '25px',
            borderRadius: '3px 3px 0px 0px',
            backgroundColor:

              'var(--el-color-primary-light-9)'
            ,
            borderTop: 'solid 1px var(--el-color-primary-light-7)',
            borderRight: 'solid 1px var(--el-color-primary-light-9)',
            borderLeft: 'solid 1px var(--el-color-primary-light-9)'
          }">
            <div :style="{
              height: '19px',
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '3px',
              width: `${contentW}px`
            }">
              <span class="title" :style="{ width: `${contentW - 85}px` }">
                <Icon v-if="layoutMaster.validLayout[item.title].icon"
                  :icon="layoutMaster.validLayout[item.title].icon || ''" style="margin-right: 5px; font-size: 14px" />
                <span style="display: inline-flex; align-items: center;">{{
                  firstByteUpper(item.title)
                }}<span v-if="item.options.name != undefined">-{{ `${item.options.name ? item.options.name :
                    'Untitled'}`
                    }}</span>
                  <span v-if="modify[item.id]" style="margin-left: 2px;font-weight: bolder">*</span>

                </span>

              </span>
              <div style="width: 25px" class="uds-no-drag">

                <span class="menu-right" @click="layoutMaster.removeWin(item.id)">
                  <Icon :icon="closeIcon" />
                </span>
              </div>
            </div>
          </div>
          <div style="overflow: auto" :style="{

            height: item.pos.h - 26 + 'px',
            backgroundColor: 'white'
          }">
            <component :ref="(r) => {
              layoutMaster.winRef[item.id] = r
            }
              " :is="layoutMaster.validLayout[item.title].component" :width="contentW" :height="item.pos.h - 30"
              :id="item.id" v-bind="layoutMaster.data.project.wins[item.id].options.params" />
          </div>


        </div>


      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, provide, ref, toRef, watch, watchEffect } from 'vue'
import type { Component, Ref } from 'vue'
import { useWindowSize } from '@vueuse/core'
import settingsIcon from '@iconify/icons-material-symbols/settings'
import { Icon, IconifyIcon } from '@iconify/vue'
import closeIcon from '@iconify/icons-material-symbols/close'
import resizeIcon from '@iconify/icons-material-symbols/resize'
import networkNode from '@iconify/icons-material-symbols/network-node'
import textFields from '@iconify/icons-material-symbols/text-fields'
import checkIndeterminateSmall from '@iconify/icons-material-symbols/check-indeterminate-small'
import hardware from '@iconify/icons-material-symbols/hardware-outline'
import diagIcon from '@iconify/icons-material-symbols/diagnosis'
import diagServiceIcon from '@iconify/icons-material-symbols/home-repair-service-outline'
import stepIcon from '@iconify/icons-material-symbols/step-rounded'
import deviceIcon from '@iconify/icons-material-symbols/important-devices-outline'
import logIcon from '@iconify/icons-material-symbols/text-ad-outline-rounded'
import msgIcon from '@iconify/icons-material-symbols/terminal'
import toolIcon from '@iconify/icons-material-symbols/service-toolbox-outline-rounded'
import userIcon from '@iconify/icons-material-symbols/person-outline'
import homeIcon from '@iconify/icons-material-symbols/add-home-outline-rounded'
import lightIcon from '@iconify/icons-material-symbols/play-circle-outline-rounded'
import stopIcon from '@iconify/icons-material-symbols/stop-circle-outline'
import apiIcon from '@iconify/icons-material-symbols/api'
import logoutIcon from '@iconify/icons-material-symbols/logout'
import codeIcon from '@iconify/icons-material-symbols/code-blocks-outline'
import pinIcon from '@iconify/icons-material-symbols/push-pin-outline'
import interIcon from '@iconify/icons-material-symbols/interactive-space-outline'
import dataBaseIcon from '@iconify/icons-material-symbols/database'
import logo from '@r/assets/logo64.png'
import { v4 } from 'uuid'
import { cloneDeep } from 'lodash'
import { useDataStore } from '@r/stores/data'
import * as joint from '@joint/core'
import { UDSView } from './components/udsView'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Layout } from './layout'
import { useProjectStore } from '@r/stores/project'
import ldfParse from '@r/database/ldfParse'

const activeMenu = ref('')
const pined = ref(true)
const { width, height } = useWindowSize()
const graph = new joint.dia.Graph()
const dataBase = useDataStore();
const project = useProjectStore();
const layoutMaster = new Layout()
const udsView = new UDSView(graph, layoutMaster)
const globalStart = toRef(window, 'globalStart')

provide('udsView', udsView)


function firstByteUpper(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}


function openService(testerIndex: string) {
  layoutMaster.addWin('testerService', `${testerIndex}_services`, {
    name: dataBase.tester[testerIndex].name,
    params: {
      'edit-index': testerIndex,
    }
  })
}
function openIA(testerIndex: string) {
  const item = dataBase.ia[testerIndex]
  if (item.type == 'can') {
    layoutMaster.addWin('cani', `${testerIndex}_ia`, {
      name: dataBase.ia[testerIndex].name,
      params: {
        'edit-index': testerIndex,
      }
    })
  }else if (item.type == 'lin') {
    layoutMaster.addWin('lini', `${testerIndex}_ia`, {
      name: dataBase.ia[testerIndex].name,
      params: {
        'edit-index': testerIndex,
      }
    })
  }
}
function openSequence(testerIndex: string) {
  layoutMaster.addWin('testerSequence', `${testerIndex}_sequence`, {
    name: dataBase.tester[testerIndex].name,
    params: {
      'edit-index': testerIndex,
    }
  })
}
//watch width and height change


const dataBaseList = computed(() => {
  const list: { url: string, disabled: boolean }[] = []
  if (dataBase.database) {
    for (const key in dataBase.database) {

      for (const key1 of Object.values(dataBase.database[key])) {
        const item = key1 as any
        list.push({
          url: `${key.toUpperCase()}.${item.name}`,
          disabled: false
        })
      }
    }
  }
  if (list.length == 0) {
    list.push({
      url: 'No Database',
      disabled: true
    })
  }
  return list
})
async function openDatabase(testerIndex: string) {
  // layoutMaster.addWin('testerSequence', `${testerIndex}_sequence`, {
  //   name: dataBase.tester[testerIndex].name,
  //   params: {
  //     'edit-index': testerIndex,
  //   }
  // })
  const fileExtMap = {
    'lin': 'ldf',
    'can': 'dbc'
  }
  if (testerIndex.startsWith('add')) {
    const type = testerIndex.split('add')[1].toLocaleLowerCase()
    const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
      title: 'Open Database File', properties: ['openFile '], filters: [
        { name: `Database File`, extensions: [fileExtMap[type]] },
      ]

    })
    const file = r.filePaths[0]
    if (file == undefined) {
      return
    }


    if (type == 'lin') {

      const id = v4()
      layoutMaster.addWin('ldf', `${id}`, {

        params: {
          'edit-index': id,
          'ldfFile': file,
        }
      })


    }





  } else if (testerIndex.startsWith('LIN.')) {
    const name = testerIndex.split('.')[1]
    //findDb
    for (const key of Object.keys(dataBase.database.lin)) {
      if (dataBase.database.lin[key].name == name) {
        layoutMaster.addWin('ldf', key, {
          name: dataBase.database.lin[key].name,
          params: {
            'edit-index': key,
            'ldf': dataBase.database.lin[key],

          }
        })
        break
      }
    }
  }

}
const maxWinId = toRef(layoutMaster, 'maxWinId')
const modify = computed(() => layoutMaster.modify.value)
provide('layout', layoutMaster)

function openApi() {
  window.electron.ipcRenderer.send('ipc-open-script-api')
}

onMounted(() => {
  if (pined.value) {
    activeMenu.value = 'home'
  }
  layoutMaster.setupParentElement('.content')
  const tabs = document.getElementsByClassName('demo-tabs')[0]
  if (tabs) {
    //鼠标离开时actvieMenu为空
    let timer: any
    tabs.addEventListener('mouseleave', () => {
      if (pined.value == false) {
        timer = setTimeout(() => {
          activeMenu.value = ''
        }, 500)

      }

    })
    tabs.addEventListener('mouseenter', () => {
      clearTimeout(timer)
    })

  }
  layoutMaster.restoreWin()
})


const handleSelect = (keyPath: string[]) => {
  layoutMaster.addWin(keyPath[0], keyPath[1] ? keyPath[1] : keyPath[0])
}

const hideLayout = computed(() => {
  return Object.values(project.project.wins).filter((item) => item.hide && layoutMaster.getLayoutType(item.id) == undefined)
})

const heightOffset = computed(() => {
  if (pined.value || activeMenu.value) {
    return 45 + 114
  } else {
    return 45 + 114 - 83
  }
})


// const contentH = computed(
//   () => Math.floor((height.value - heightOffset.value) / rowHeight.value) * rowHeight.value
// )
// const contentW = computed(() => Math.floor(width.value / rowHeight.value) * rowHeight.value)

const bottomH = computed(() => {
  let h = 0
  for (const w of Object.values(project.project.wins)) {
    if (layoutMaster.getLayoutType(w.id) == 'bottom') {
      h += w.pos.h
    }
  }
  return h
})
const contentH = computed(
  () => (height.value - heightOffset.value - bottomH.value)
)
const contentW = computed(() => width.value)
// const contentLeft = computed(() => Math.floor((width.value - contentW.value) / 2))
layoutMaster.setWinSize(contentH.value, contentW.value)
watch([contentH, contentW], (val) => {
  layoutMaster.setWinSize(val[0], val[1])
  layoutMaster.winSizeCheck(val[0], val[1])
})
</script>

<style lang="scss">
.vue-grid-item.vue-grid-placeholder {
  background: none !important;
}

.demo-tabs .el-tabs__header {
  background-color: var(--el-color-primary-light-9);
  border-bottom: none !important;
}

.demo-tabs .el-tabs__content {
  padding: 0px !important;
}

.demo-tabs {
  .el-tabs--border-card {
    .el-tabs__header {
      .el-tabs__item.is-active {
        border-left-color: var(--el-bg-color-overlay) !important;
        border-right-color: var(--el-bg-color-overlay) !important;
        border-radius: 10px 10px 0px 0px !important;
      }
    }
  }
}

.demo-tabs .el-tabs--border-card {
  border-top: none !important;
  border-left: none !important;
  border-right: none !important;
  // border-bottom: solid 1px var(--el-color-info-light-5);

}

.tablePin .el-tabs__content {
  border-bottom: 1px solid var(--el-color-info-light-5);
}

#tab-_home {
  padding: 0px !important;
}

.menu {
  font-size: 20px;

  .play {
    color: var(--el-color-primary) !important;
  }

  .stop {
    color: var(--el-color-danger) !important;
  }

  .el-menu-item.is-active {
    border-bottom: 2px solid #fff !important;

    .el-sub-menu__title {
      border-bottom: 2px solid #fff !important;

    }

  }

  .el-sub-menu.is-active .el-sub-menu__title {
    border-bottom: 2px solid #fff !important;
  }
}
</style>
<style scoped>
.menu {
  --el-menu-item-height: 40px !important;
  --el-menu-horizontal-height: 44px !important;
  width: v-bind(width + 'px');
}

.flex-grow {
  flex-grow: 1;
}

.title {
  line-height: 20px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  /* 垂直居中 */
  margin-left: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window {
  /* 设置除顶部以外的三边边框 */
  border-right: solid 1px var(--el-color-info-light-5);
  border-bottom: solid 1px var(--el-color-info-light-5);
  border-left: solid 1px var(--el-color-info-light-5);

  /* 设置顶部边框为无 */
  border-top: none;

  /* 设置除顶部左右角以外的圆角 */
  border-bottom-right-radius: 3px;
  border-bottom-left-radius: 3px;

  /* 将顶部左右角的圆角设置为0 */
  border-top-right-radius: 0;
  border-top-left-radius: 0;
}

/* .windowModified {
  color: var(--el-text-color-primary);
  border-right: solid 2px var(--el-color-info-light-5)!important;
  border-bottom: solid 2px var(--el-color-info-light-5)!important;
  border-left: solid 2px var(--el-color-info-light-5)!important;
} */

.menu-right {
  font-size: 14px;
  padding: 0px 5px;
}

.menu-right:hover {
  cursor: pointer;
  color: var(--el-color-info-dark-2);
}

.content {
  width: v-bind(contentW + 'px');
  height: v-bind(contentH + 'px');
  top: v-bind(0 + 'px');
  left: v-bind(contentLeft + 'px');
  touch-action: none;
  overflow-y: hidden;
  overflow-x: hidden;
  position: relative;
  background-color: #FAFAFA;
}

.lr {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lr svg {
  margin-right: 5px;
}

.tb {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* .modified {
  position: relative;
  font-weight: 400;
  background-color: var(--el-color-info-light-5) !important;
} */

.windows {
  position: absolute;
  bottom: v-bind(bottomH + 'px');
  display: flex;
  height: 28px;
  left: 0px;
  z-index: 1000;
  flex-direction: row;

  /* 使子元素从右到左排列 */
  /* overflow-x: auto; */

}

.littleWin {
  background-color: var(--el-color-info-light-9);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 140px;
  height: 26px;
  position: relative;
  border: solid 1px var(--el-color-info-light-5);
}

/* 上下布局 */
.grid {
  display: flex;
  gap: 2px;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  width: 80px;
  height: 46px;
  padding: 4px;
  color: var(--el-color-info-dark-2);
}

.mingird {
  width: 40px !important;
}

.grid svg {
  font-size: 32px;
}


.grid span {
  /* margin-top: 5px; */
  font-size: 14px;
}

.girdenable:hover {
  cursor: pointer;
  background-color: var(--el-color-primary-light-9);
  border-radius: 4px;

}

.girddisable {
  color: var(--el-color-info-dark-2) !important;
}


.left1 {
  position: absolute;
  top: 0;
  left: 0;
  height: v-bind(contentH / 2 - 10 + 'px');
  width: v-bind(contentW / 2 - 10 + 'px');
  border-radius: 10px;
  margin: 10px;
  background-color: var(--el-color-primary-light-7);
  opacity: 0.8;
  /* 模糊效果 */
  /* filter: blur(1px); */
  z-index: v-bind(zIndex - 1);
}

.left2 {
  position: absolute;
  top: v-bind(contentH / 2 + 'px');
  left: 0;
  height: v-bind(contentH / 2 - 10 + 'px');
  width: v-bind(contentW / 2 - 10 + 'px');
  border-radius: 10px;
  margin: 10px;
  background-color: var(--el-color-primary-light-7);
  opacity: 0.8;
  /* 模糊效果 */
  /* filter: blur(1px); */
  z-index: v-bind(zIndex - 1);
}

.left {
  position: absolute;
  top: 0;
  left: 0;
  height: v-bind(contentH + 'px');
  width: v-bind(contentW / 2 - 10 + 'px');
  border-radius: 10px;
  background-color: var(--el-color-primary-light-7);
  opacity: 0.8;
  /* 模糊效果 */
  /* filter: blur(1px); */
  z-index: v-bind(zIndex - 1);
}

.right1 {
  position: absolute;
  top: 0;
  right: 0;
  height: v-bind(contentH / 2 - 10 + 'px');
  width: v-bind(contentW / 2 - 10 + 'px');
  border-radius: 10px;
  margin: 10px;
  background-color: var(--el-color-primary-light-7);
  opacity: 0.8;
  /* 模糊效果 */
  /* filter: blur(1px); */
  z-index: v-bind(zIndex - 1);
}

.right2 {
  position: absolute;
  top: v-bind(contentH / 2 + 'px');
  right: 0;
  height: v-bind(contentH / 2 - 10 + 'px');
  width: v-bind(contentW / 2 - 10 + 'px');
  border-radius: 10px;
  margin: 10px;
  background-color: var(--el-color-primary-light-7);
  opacity: 0.8;
  /* 模糊效果 */
  /* filter: blur(1px); */
  z-index: v-bind(zIndex - 1);
}

.right {
  position: absolute;
  top: 0;
  right: 0;
  height: v-bind(contentH + 'px');
  width: v-bind(contentW / 2 - 10 + 'px');
  border-radius: 10px;
  background-color: var(--el-color-primary-light-7);
  opacity: 0.8;
  /* 模糊效果 */
  /* filter: blur(1px); */
  z-index: v-bind(zIndex - 1);
}

.el-dropdown-link {
  cursor: pointer;
  display: flex;
  align-items: center;
  color: var(--el-color-primary);
}
</style>
