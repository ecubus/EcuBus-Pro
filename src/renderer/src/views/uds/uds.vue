<template>
  <div>
    <div class="demo-tabs" :class="{ tablePin: pined }">
      <el-tabs v-model="activeMenu" type="border-card">
        <el-tab-pane v-for="tab in tabsConfig" :key="tab.name" :name="tab.name">
          <template #label>
            <span class="lr">
              <img v-if="isImgIcon(tab.icon)" :src="tab.icon" style="width: 16px; height: 16px" />
              <Icon v-else :icon="tab.icon" style="font-size: 16px" />
              <span>{{ tab.label }}</span>
            </span>
          </template>
          <div style="display: flex; gap: 5px; padding: 15px">
            <template v-for="(item, index) in tab.items" :key="index">
              <!-- 分隔符 -->
              <el-divider
                v-if="item.type === 'divider'"
                direction="vertical"
                style="height: 54px"
              />

              <!-- 普通按钮 -->
              <div
                v-else-if="item.type === 'button'"
                class="grid girdenable"
                :class="[item.class, item.minWidth ? 'mingird' : '']"
                :style="item.style"
                @click="item.onClick"
              >
                <el-image
                  v-if="isImgIcon(item.icon)"
                  :src="item.icon"
                  style="width: 22px; height: 22px"
                  fit="scale-down"
                />
                <Icon v-else :icon="item.icon" :style="{ fontSize: '22px' }" />
                <span>{{ item.label }}</span>
              </div>

              <!-- 下拉菜单 -->
              <div
                v-else-if="item.type === 'dropdown'"
                class="grid girdenable"
                @click="item.onClick"
              >
                <el-image
                  v-if="isImgIcon(item.icon)"
                  :src="item.icon"
                  style="width: 22px; height: 22px"
                  fit="scale-down"
                />
                <Icon v-else :icon="item.icon" :style="{ fontSize: '22px' }" />
                <el-dropdown @command="item.onCommand">
                  <span class="lr">
                    {{ item.label }}
                    <el-icon class="el-icon--right">
                      <arrow-down />
                    </el-icon>
                  </span>
                  <template #dropdown>
                    <component :is="item.dropdownContent" :item="item" />
                  </template>
                </el-dropdown>
              </div>
            </template>
          </div>
        </el-tab-pane>
      </el-tabs>
      <el-button
        v-if="activeMenu"
        style="position: absolute; top: 135px; right: 5px"
        type="info"
        link
        @click="pined = !pined"
      >
        <svg
          v-if="!pined"
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
        >
          <path
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="m3 21l5-5m5.259 2.871c-3.744-.85-7.28-4.386-8.13-8.13c-.135-.592-.202-.888-.007-1.369c.194-.48.433-.63.909-.927c1.076-.672 2.242-.886 3.451-.78c1.697.151 2.546.226 2.97.005c.423-.22.71-.736 1.286-1.767l.728-1.307c.48-.86.72-1.291 1.285-1.494s.905-.08 1.585.166a5.63 5.63 0 0 1 3.396 3.396c.246.68.369 1.02.166 1.585c-.203.564-.633.804-1.494 1.285l-1.337.745c-1.03.574-1.544.862-1.765 1.289c-.22.428-.14 1.258.02 2.918c.118 1.22-.085 2.394-.766 3.484c-.298.476-.447.714-.928.909c-.48.194-.777.127-1.37-.008"
          />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
          <path
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M7.5 8c-.541.128-1 .142-1.507.459c-.92.575-1.142 1.258-.905 2.302c.852 3.753 4.398 7.299 8.15 8.15c1.045.238 1.728.017 2.304-.903c.3-.48.33-1 .458-1.508m-4-8.7a1.3 1.3 0 0 0 .43-.118c.97-.505 1.5-2.148 2.02-3.082c.481-.863.722-1.294 1.288-1.498s.907-.08 1.588.166a5.64 5.64 0 0 1 3.406 3.406c.246.681.37 1.022.166 1.588s-.635.807-1.498 1.288c-.94.524-2.605 1.06-3.11 2.04a1.2 1.2 0 0 0-.113.41M3 21l5-5M3 3l18 18"
            color="currentColor"
          />
        </svg>
        <!-- <Icon :class="{
          xpin: pined
        }" :icon="pinIcon" /> -->
      </el-button>
      <div v-if="maxWinId" style="width: 75px; position: absolute; top: 50px; right: 2px">
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
    <div v-if="!maxWinId && hideLayout.length > 0" class="windows">
      <div v-for="item in hideLayout" :key="item.id" class="littleWin">
        <Icon
          v-if="layoutMaster.validLayout[item.title]?.icon"
          :icon="layoutMaster.validLayout[item.title].icon || ''"
          style="margin-right: 5px; font-size: 14px"
        />
        <el-text style="width: 60px" truncated>
          {{ firstByteUpper(item.title)
          }}<span v-if="item.options.name != undefined"
            >-{{ `${item.options.name ? item.options.name : 'Untitled'}` }}</span
          >
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
      <div v-if="layoutMaster.left1.value" class="left1"></div>
      <div v-if="layoutMaster.left2.value" class="left2"></div>
      <div v-if="layoutMaster.left.value" class="left"></div>
      <div v-if="layoutMaster.right.value" class="right"></div>
      <div v-if="layoutMaster.right1.value" class="right1"></div>
      <div v-if="layoutMaster.right2.value" class="right2"></div>
      <div
        v-for="item in project.project.wins"
        :key="item.id"
        style="position: absolute; padding: 1px"
      >
        <div
          v-show="!item.hide && isWinInCurrentPage(item)"
          v-if="layoutMaster.getLayoutType(item.id) == undefined && !item.isExternal"
          :id="`win${item.id}`"
          class="uds-window"
          :style="{
            transform: 'translate(0px, 0px)',
            top: `${item.pos.y}px`,
            left: `${item.pos.x}px`,
            width: `${item.pos.w}px`,
            height: `${item.pos.h}px`
          }"
        >
          <div
            class="titleBar"
            :style="{
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
            }"
            @dblclick="layoutMaster.maxWin(item.id)"
          >
            <div
              class="uds-draggable"
              :style="{
                height: '19px',
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '3px',
                width: `${item.pos.w - 2}px`
              }"
            >
              <span class="title" :style="{ width: `${item.pos.w - 85}px` }">
                <Icon
                  v-if="layoutMaster.validLayout[item.title]?.icon"
                  :icon="layoutMaster.validLayout[item.title].icon || ''"
                  style="margin-right: 5px; font-size: 14px"
                />
                <span style="display: inline-flex; align-items: center"
                  >{{ item.label
                  }}<span v-if="item.options.name != undefined"
                    >-{{ `${item.options.name ? item.options.name : 'Untitled'}` }}</span
                  >
                  <span v-if="modify[item.id]" style="margin-left: 2px; font-weight: bolder"
                    >*</span
                  >
                </span>
              </span>
              <div
                style="display: flex; align-items: center; justify-content: flex-end"
                class="uds-no-drag"
              >
                <span class="menu-right" @click="layoutMaster.minWin(item.id)">
                  <Icon :icon="checkIndeterminateSmall" />
                </span>

                <span class="menu-right" @click="layoutMaster.maxWin(item.id)">
                  <Icon :icon="resizeIcon" />
                </span>
                <template v-if="layoutMaster.validLayout[item.title]?.allowExt">
                  <span class="menu-right" @click="layoutMaster.externalWin(item.id)">
                    <Icon :icon="externalLinkIcon" />
                  </span>
                </template>
                <span class="menu-right" @click="layoutMaster.removeWin(item.id)">
                  <Icon :icon="closeIcon" />
                </span>
              </div>
            </div>
          </div>
          <!-- <KeepAlive> -->
          <div
            class="uds-no-drag window"
            style="overflow: auto"
            :style="{
              height: item.pos.h - 28 + 'px',
              backgroundColor: 'var(--el-bg-color)'
            }"
          >
            <component
              :is="layoutMaster.validLayout[item.title]?.component"
              :id="item.id"
              :ref="
                (r) => {
                  layoutMaster.winRef[item.id] = r
                }
              "
              :width="item.pos.w - 6"
              :height="item.pos.h - 30"
              v-bind="layoutMaster.data.project.wins[item.id].options.params"
            />
          </div>
          <!-- </KeepAlive> -->
        </div>

        <!-- <span class="remove" @click="removeItem(item.i)">x</span> -->
      </div>
    </div>
    <div class="footer">
      <div v-for="item in project.project.wins" :key="item.id">
        <div
          v-if="item.layoutType == 'bottom'"
          v-show="isWinInCurrentPage(item)"
          :id="`win${item.id}`"
        >
          <div
            class="titleBar"
            :style="{
              width: `${contentW}px`,
              height: '25px',
              borderRadius: '3px 3px 0px 0px',
              backgroundColor: 'var(--el-color-primary-light-9)',
              borderTop: 'solid 1px var(--el-color-primary-light-7)',
              borderRight: 'solid 1px var(--el-color-primary-light-9)',
              borderLeft: 'solid 1px var(--el-color-primary-light-9)'
            }"
          >
            <div
              :style="{
                height: '19px',
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '3px',
                width: `${contentW}px`
              }"
            >
              <span class="title" :style="{ width: `${contentW - 85}px` }">
                <Icon
                  v-if="layoutMaster.validLayout[item.title].icon"
                  :icon="layoutMaster.validLayout[item.title].icon || ''"
                  style="margin-right: 5px; font-size: 14px"
                />
                <span style="display: inline-flex; align-items: center"
                  >{{ firstByteUpper(item.title)
                  }}<span v-if="item.options.name != undefined"
                    >-{{ `${item.options.name ? item.options.name : 'Untitled'}` }}</span
                  >
                  <span v-if="modify[item.id]" style="margin-left: 2px; font-weight: bolder"
                    >*</span
                  >
                </span>
              </span>
              <div style="width: 25px" class="uds-no-drag">
                <span class="menu-right" @click="layoutMaster.removeWin(item.id)">
                  <Icon :icon="closeIcon" />
                </span>
              </div>
            </div>
          </div>
          <div
            style="overflow: auto"
            :style="{
              height: item.pos.h - 26 + 'px',
              backgroundColor: 'var(--el-bg-color)'
            }"
          >
            <component
              :is="layoutMaster.validLayout[item.title].component"
              :id="item.id"
              :ref="
                (r) => {
                  layoutMaster.winRef[item.id] = r
                }
              "
              :width="contentW"
              :height="item.pos.h - 30"
              v-bind="layoutMaster.data.project.wins[item.id].options.params"
            />
          </div>
        </div>
      </div>
    </div>
    <Pages />
  </div>
</template>

<script lang="ts" setup>
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  toRef,
  watch,
  watchEffect,
  h
} from 'vue'
import type { Component, Ref } from 'vue'
import { useWindowSize } from '@vueuse/core'
import settingsIcon from '@iconify/icons-material-symbols/settings'
import { Icon, IconifyIcon } from '@iconify/vue'
import closeIcon from '@iconify/icons-material-symbols/close'
import resizeIcon from '@iconify/icons-material-symbols/resize'
import networkNode from '@iconify/icons-material-symbols/network-node'
import textFields from '@iconify/icons-material-symbols/text-fields'
import checkIndeterminateSmall from '@iconify/icons-material-symbols/check-indeterminate-small'
import externalLinkIcon from '@iconify/icons-mdi/external-link'
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
import graphIcon from '@iconify/icons-ep/histogram'
import logo from '@r/assets/logo64.png'
import { v4 } from 'uuid'
import { cloneDeep } from 'lodash'
import { useDataStore } from '@r/stores/data'
import * as joint from '@joint/core'
import { UDSView } from './components/udsView'
import {
  ElMessage,
  ElDropdownMenu,
  ElDropdownItem,
  ElDivider,
  ElButton,
  ElIcon,
  ElMessageBox
} from 'element-plus'
import { Layout } from './layout'
import { useProjectStore } from '@r/stores/project'
import ldfParse from '@r/database/ldfParse'
import testConfig from '@iconify/icons-grommet-icons/test'
import testConfigIcon from '@iconify/icons-grommet-icons/test-desktop'
import lineIcon from '@iconify/icons-mdi/chart-line'
import gaugeIcon from '@iconify/icons-mdi/gauge'
import packageIcon from '@iconify/icons-mdi/package-variant'
import varIcon from '@iconify/icons-mdi/application-variable-outline'
import dataIcon from '@iconify/icons-mdi/data-usage'
import panelIcon1 from '@iconify/icons-mdi/solar-panel'
import data from '@iconify/icons-ep/full-screen'
import soaIcon from '@iconify/icons-material-symbols/linked-services-outline'
import soaConfigIcon from '@iconify/icons-material-symbols/linked-services'
import { useGlobalStart, useRuntimeStore } from '@r/stores/runtime'
import { usePluginStore } from '@r/stores/plugin'
import osTraceIcon from '@iconify/icons-ph/crosshair-fill'
import { CirclePlusFilled, Delete, Edit, ArrowDown } from '@element-plus/icons-vue'
import type { EcuBusPlugin, PluginItemConfig, PluginTabConfig } from '../../../../preload/plugin'
import Pages from './pages.vue'

// TypeScript 接口定义
interface TabItem {
  type: 'button' | 'dropdown' | 'divider'
  label?: string
  icon?: any
  class?: any

  style?: any
  minWidth?: boolean
  onClick?: () => void

  onCommand?: (command: string) => void
  dropdownContent?: Component
  // 插件相关
  pluginId?: string // 插件 ID
  handlerName?: string // 处理器名称
}

interface TabConfig {
  name: string
  label: string
  icon: any
  items: TabItem[]
}

const defaultPageId = 0
const pageWidth = ref(30)
const activeMenu = ref('')
const pined = ref(true)
const { width, height } = useWindowSize()
const graph = new joint.dia.Graph()
const dataBase = useDataStore()
const project = useProjectStore()
const runtime = useRuntimeStore()
const pluginStore = usePluginStore()
const layoutMaster = new Layout()
const udsView = new UDSView(graph, layoutMaster)
const globalStart = useGlobalStart()

provide('udsView', udsView)

function firstByteUpper(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// 下拉菜单组件定义
const TraceDropdown = {
  setup() {
    return () =>
      h(ElDropdownMenu, { size: 'small' }, () => [
        h(ElDropdownItem, { command: 'trace' }, () =>
          h(
            'div',
            { style: 'display: flex; align-items: center; justify-content: space-between' },
            [
              h('span', dataBase.traces['trace']?.name || 'Trace'),
              h(ElDivider, { direction: 'vertical' }),
              h(ElButton, { link: true }, () =>
                h(
                  ElIcon,
                  {
                    onClick: (e) => {
                      e.stopPropagation()
                      openTrace('addTrace')
                    }
                  },
                  () => h(CirclePlusFilled)
                )
              )
            ]
          )
        ),
        ...Object.entries(dataBase.traces)
          .filter(([key]) => key !== 'trace')
          .map(([key, item]) =>
            h(ElDropdownItem, { command: key }, () =>
              h('div', { style: 'display: flex; align-items: center; width: 100%' }, [
                h('span', (item as any).name || 'Trace'),
                h(ElDivider, { direction: 'vertical' }),
                h(ElButton, { link: true, type: 'danger' }, () =>
                  h(
                    ElIcon,
                    {
                      onClick: (e) => {
                        e.stopPropagation()
                        openTrace('deletaTrace', key)
                      }
                    },
                    () => h(Delete)
                  )
                )
              ])
            )
          )
      ])
  }
}

const GraphDropdown = {
  setup() {
    return () =>
      h(ElDropdownMenu, { size: 'small' }, () => [
        h(ElDropdownItem, { command: 'graph' }, () => [
          h(Icon, { icon: lineIcon, style: 'margin-right: 5px' }),
          'Line'
        ]),
        h(ElDropdownItem, { command: 'gauge' }, () => [
          h(Icon, { icon: gaugeIcon, style: 'margin-right: 5px' }),
          'Gauge'
        ]),
        h(ElDropdownItem, { command: 'datas' }, () => [
          h(Icon, { icon: dataIcon, style: 'margin-right: 5px' }),
          'Datas'
        ])
      ])
  }
}

const PanelDropdown = {
  setup() {
    return () =>
      h(ElDropdownMenu, { size: 'small' }, () => [
        h(ElDropdownItem, { command: 'panel', icon: CirclePlusFilled }, () => 'Add Panel'),
        ...Object.values(dataBase.panels).map((item: any, index) =>
          h(
            ElDropdownItem,
            { key: item.id, divider: true, command: item.id, divided: index === 0 },
            () =>
              h(
                'div',
                {
                  style:
                    'display: flex; align-items: center; justify-content: space-between; width: 100%;'
                },
                [
                  h('div', { style: 'display: flex; align-items: center' }, [
                    h(Icon, { icon: panelIcon1, style: 'margin-right: 5px' }),
                    h('span', { style: 'display: flex; align-items: center' }, item.name),
                    h(ElDivider, { direction: 'vertical' }),
                    h('div', [
                      h(ElButton, { link: true, type: 'warning' }, () =>
                        h(
                          ElIcon,
                          {
                            onClick: (e) => {
                              e.stopPropagation()
                              editPanel(item.id)
                            }
                          },
                          () => h(Edit)
                        )
                      ),
                      h(ElButton, { link: true, type: 'danger' }, () =>
                        h(
                          ElIcon,
                          {
                            onClick: (e) => {
                              e.stopPropagation()
                              deletePanel(item.id)
                            }
                          },
                          () => h(Delete)
                        )
                      )
                    ])
                  ])
                ]
              )
          )
        )
      ])
  }
}

const InteractDropdown = {
  setup() {
    return () =>
      h(ElDropdownMenu, { size: 'small' }, () => [
        ...Object.entries(dataBase.ia).map(([key, item]) =>
          h(ElDropdownItem, { key, command: key }, () => (item as any).name)
        ),
        ...(Object.keys(dataBase.ia).length === 0
          ? [h(ElDropdownItem, { disabled: true }, () => 'No Interaction')]
          : [])
      ])
  }
}

const ServiceDropdown = {
  setup() {
    return () =>
      h(ElDropdownMenu, { size: 'small' }, () => [
        ...Object.entries(dataBase.tester).map(([key, item]) =>
          h(ElDropdownItem, { key, command: key }, () => (item as any).name)
        ),
        ...(Object.keys(dataBase.tester).length === 0
          ? [h(ElDropdownItem, { disabled: true }, () => 'No Tester')]
          : [])
      ])
  }
}

const SequenceDropdown = {
  setup() {
    return () =>
      h(ElDropdownMenu, { size: 'small' }, () => [
        ...Object.entries(dataBase.tester).map(([key, item]) =>
          h(ElDropdownItem, { key, command: key }, () => (item as any).name)
        ),
        ...(Object.keys(dataBase.tester).length === 0
          ? [h(ElDropdownItem, { disabled: true }, () => 'No Tester')]
          : [])
      ])
  }
}

const DatabaseDropdown = {
  setup() {
    return () =>
      h(ElDropdownMenu, { size: 'small' }, () => [
        h(ElDropdownItem, { icon: CirclePlusFilled, command: 'addLin' }, () => 'Add Lin (LDF)'),
        h(ElDropdownItem, { icon: CirclePlusFilled, command: 'addCan' }, () => 'Add CAN (DBC)'),
        h(ElDropdownItem, { icon: CirclePlusFilled, command: 'addOrti' }, () => 'Add OS (ORTI)'),
        ...dataBaseList.value.map((item, index) =>
          h(
            ElDropdownItem,
            {
              key: item.url,
              divider: true,
              command: item.url,
              disabled: item.disabled,
              divided: index === 0
            },
            () => [h(Icon, { icon: dataBaseIcon, style: 'margin-right: 5px' }), item.url]
          )
        )
      ])
  }
}

const OsTraceDropdown = {
  setup() {
    return () =>
      h(ElDropdownMenu, { size: 'small' }, () => [
        ...Object.entries(dataBase.database.orti).map(([key, item]) =>
          h('div', {}, [
            h(ElDropdownItem, { key, command: key }, () => (item as any).name + ' Statistics'),
            h(
              ElDropdownItem,
              {
                key,
                command: `${key}_TimeLine`
              },
              () => (item as any).name + ' Timeline'
            )
          ])
        ),
        ...(Object.keys(dataBase.database.orti).length === 0
          ? [
              h(ElDropdownItem, { disabled: true }, () => [
                'No ORTI File',
                h('br'),
                'Add In Database'
              ])
            ]
          : [])
      ])
  }
}

// 将插件配置转换为内部 TabItem 格式
function convertPluginItemToTabItem(item: PluginItemConfig, plugin: EcuBusPlugin): TabItem | null {
  if (item.type === 'button') {
    return {
      type: 'button',
      label: item.label,
      icon: item.icon ? resolvePluginIcon(plugin, item.icon) : undefined,

      class: item.class,
      style: item.style,

      pluginId: plugin.manifest.id,
      handlerName: item.onClick,
      onClick: () => {
        if (item.onClick) {
          const isDev = process.env.NODE_ENV === 'development'
          if (item.entry || isDev) {
            layoutMaster.addWin('plugin', plugin.manifest.id, {
              name: item.label,
              params: {
                'edit-index': plugin.manifest.id,
                pluginId: plugin.manifest.id,
                item: item,
                isPlugin: true
              }
            })
          } else {
            ElMessageBox({
              title: 'Plugin Error',
              message: `This plugin does not have an entry point in the extension ${item.label}`,
              type: 'error',
              showCancelButton: false,
              showConfirmButton: false,
              center: true
            })
          }
        }
      }
    }
  }

  if (item.type === 'dropdown') {
    // 创建动态下拉菜单组件
    const PluginDropdown = {
      setup() {
        return () =>
          h(ElDropdownMenu, { size: 'small' }, () =>
            item.items.map((menuItem) =>
              h(
                ElDropdownItem,
                {
                  key: menuItem.command,
                  command: menuItem.command,
                  disabled: menuItem.disabled,
                  divided: menuItem.divided
                },
                () => {
                  const resolved = menuItem.icon
                    ? resolvePluginIcon(plugin, menuItem.icon)
                    : undefined
                  const iconVNode = resolved
                    ? isImgIcon(resolved)
                      ? h('img', {
                          src: resolved,
                          style: 'margin-right: 5px; width: 20px; height: 20px; object-fit: contain'
                        })
                      : h(Icon, { icon: resolved, style: 'margin-right: 5px; font-size: 20px' })
                    : null
                  return [iconVNode, menuItem.label]
                }
              )
            )
          )
      }
    }

    return {
      type: 'dropdown',
      label: item.label,
      icon: item.icon ? resolvePluginIcon(plugin, item.icon) : undefined,

      pluginId: plugin.manifest.id,
      handlerName: item.onCommand,
      onCommand: (command: string) => {
        if (item.onCommand) {
          console.log(
            `Plugin ${plugin.manifest.id} dropdown command: ${command}, handler: ${item.onCommand}`
          )
          ElMessage.warning('Plugin handler system not yet implemented')
        }
      },
      dropdownContent: PluginDropdown
    }
  }

  return null
}

// 动态加载 iconify 图标
function loadIconify(iconName: string): any {
  // 如果是简单的字符串，尝试从已导入的图标中查找
  // 或者返回字符串让 Icon 组件自行处理
  return iconName
}
// 解析插件图标：相对路径转为本地资源 URL，其它保持原样
function resolvePluginIcon(plugin: EcuBusPlugin, icon?: string): any {
  if (!icon) return undefined
  const reIsAbsolute = /[\w+\-+]+:\/\//
  if (reIsAbsolute.test(icon) || icon.startsWith('data:')) {
    return icon
  }
  const looksLikePath = icon.includes('/') || icon.includes('\\') || /\.[a-zA-Z0-9]+$/.test(icon)
  if (looksLikePath) {
    const installed = pluginStore.getPlugin(plugin.manifest.id)
    if (installed?.path) {
      const fullPath = installed.path + '\\' + icon
      const normalized = fullPath.replace(/\\/g, '/')
      return 'local-resource:///' + normalized
    }
  }
  return icon
}
function isImgIcon(icon: any): boolean {
  return (
    typeof icon === 'string' &&
    (icon.startsWith('local-resource:///') ||
      icon.startsWith('http://') ||
      icon.startsWith('https://') ||
      icon.startsWith('data:') ||
      icon.includes('/') ||
      icon.includes('\\') ||
      /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(icon))
  )
}

// 合并插件的 tabs 和 items（直接从 plugin store 获取）
function mergePluginTabs(baseTabs: TabConfig[]): TabConfig[] {
  const result = cloneDeep(baseTabs)

  // 只有在插件加载完成时才合并
  if (pluginStore.loaded) {
    const enabledPlugins = pluginStore.getEnabledPlugins()

    // 1. 添加插件新增的 tabs（仅启用的插件）
    for (const plugin of enabledPlugins) {
      for (const tab of plugin.manifest.tabs || []) {
        const tabConfig: TabConfig = {
          name: tab.name,
          label: tab.label,
          icon: tab.icon ? resolvePluginIcon(plugin, tab.icon) : userIcon,
          items: []
        }

        // 转换插件 items
        for (const item of tab.items || []) {
          const convertedItem = convertPluginItemToTabItem(item, plugin)
          if (convertedItem) {
            tabConfig.items.push(convertedItem)
          }
        }

        result.push(tabConfig)
      }
    }

    // 2. 扩展现有的 tabs（仅启用的插件）
    for (const plugin of enabledPlugins) {
      for (const extension of plugin.manifest.extensions || []) {
        // 找到要扩展的目标 tab
        const targetTab = result.find((tab) => tab.name === extension.targetTab)

        if (targetTab) {
          const convertedItems: TabItem[] = []
          for (const item of extension.items) {
            const convertedItem = convertPluginItemToTabItem(item, plugin)
            if (convertedItem) {
              convertedItems.push(convertedItem)
            }
          }

          targetTab.items.push(...convertedItems)
        }
      }
    }
  }

  return result
}

// 基础 Tabs 配置数据
const baseTabsConfig = computed<TabConfig[]>(() => [
  {
    name: 'home',
    label: 'Home',
    icon: homeIcon,
    items: [
      {
        type: 'button',
        label: 'Start',
        icon: lightIcon,
        iconSize: '32px',
        minWidth: true,
        class: {
          girdenable: !globalStart.value,
          girddisable: globalStart.value
        },
        style: 'color: var(--el-color-success)',
        onClick: () => dataBase.globalRun('start')
      },
      {
        type: 'button',
        label: 'Stop',
        icon: stopIcon,
        iconSize: '32px',
        minWidth: true,
        class: {
          girdenable: globalStart.value,
          girddisable: !globalStart.value
        },
        style: 'color: var(--el-color-danger)',
        onClick: () => dataBase.globalRun('stop')
      },
      { type: 'divider' },
      {
        type: 'dropdown',
        label: 'Trace',
        icon: logIcon,
        onClick: () => openTrace('trace'),
        onCommand: openTrace,
        dropdownContent: TraceDropdown
      },
      { type: 'divider' },
      {
        type: 'dropdown',
        label: 'Graph',
        icon: graphIcon,
        onCommand: openGraph,
        dropdownContent: GraphDropdown
      },
      {
        type: 'dropdown',
        label: 'Panel',
        icon: panelIcon1,
        onCommand: openPanel,
        dropdownContent: PanelDropdown
      },
      { type: 'divider' },
      {
        type: 'button',
        label: 'Message',
        icon: msgIcon,
        onClick: () => handleSelect(['message'])
      }
    ]
  },
  {
    name: 'hardware',
    label: 'Hardware',
    icon: hardware,
    items: [
      {
        type: 'button',
        label: 'Devices',
        icon: deviceIcon,
        onClick: () => handleSelect(['hardware'])
      },
      {
        type: 'button',
        label: 'Network',
        icon: networkNode,
        onClick: () => handleSelect(['network'])
      },
      {
        type: 'dropdown',
        label: 'Interact',
        icon: interIcon,
        onCommand: openIA,
        dropdownContent: InteractDropdown
      }
    ]
  },
  {
    name: 'diag',
    label: 'Diagnostics',
    icon: diagIcon,
    items: [
      {
        type: 'button',
        label: 'UDS Tester',
        icon: textFields,
        onClick: () => handleSelect(['tester'])
      },
      {
        type: 'dropdown',
        label: 'Services',
        icon: diagServiceIcon,
        onCommand: openService,
        dropdownContent: ServiceDropdown
      },
      {
        type: 'dropdown',
        label: 'Sequence',
        icon: stepIcon,
        onCommand: openSequence,
        dropdownContent: SequenceDropdown
      }
    ]
  },
  {
    name: 'soa',
    label: 'SOA',
    icon: soaIcon,
    items: [
      {
        type: 'button',
        label: 'SOA Config',
        icon: soaConfigIcon,
        onClick: () => handleSelect(['soa'])
      }
    ]
  },
  {
    name: 'test',
    label: 'Test',
    icon: testConfig,
    items: [
      {
        type: 'button',
        label: 'Test Setup',
        icon: testConfig,
        iconSize: '18px',
        onClick: () => handleSelect(['test'])
      }
    ]
  },
  {
    name: 'other',
    label: 'Others',
    icon: userIcon,
    items: [
      {
        type: 'dropdown',
        label: 'Database',
        icon: dataBaseIcon,
        onCommand: openDatabase,
        dropdownContent: DatabaseDropdown
      },
      {
        type: 'button',
        label: 'Variables',
        icon: varIcon,
        onClick: () => handleSelect(['variable'])
      },
      { type: 'divider' },
      {
        type: 'dropdown',
        label: 'OS Info',
        icon: osTraceIcon,
        onCommand: openOsTrace,
        dropdownContent: OsTraceDropdown
      },
      { type: 'divider' },
      {
        type: 'button',
        label: 'Script Api',
        icon: apiIcon,
        onClick: openApi
      },
      {
        type: 'button',
        label: 'Packages',
        icon: packageIcon,
        onClick: openPackage
      }
    ]
  }
])

// 最终的 tabs 配置（合并插件）
const tabsConfig = computed<TabConfig[]>(() => {
  return mergePluginTabs(baseTabsConfig.value)
})

function openTrace(command: string, key?: string) {
  if (command == 'trace') {
    layoutMaster.addWin('trace', 'trace', {
      params: {
        'edit-index': 'trace'
      }
    })
  } else if (command == 'addTrace') {
    const id = v4()
    dataBase.traces[id] = {
      id: id,
      name: `Trace${Object.keys(dataBase.traces).length + 1}`
    }
    layoutMaster.addWin('trace', id, {
      params: {
        'edit-index': id
      }
    })
  } else if (command == 'deletaTrace') {
    delete dataBase.traces[key!]
    layoutMaster.removeWin(key!)
  } else {
    layoutMaster.addWin('trace', command, {
      params: {
        'edit-index': command
      }
    })
  }
}
function openGraph(command: string) {
  if (command == 'graph') {
    layoutMaster.addWin('graph', 'graph', {
      params: {
        'edit-index': 'graph'
      }
    })
  } else if (command == 'gauge') {
    layoutMaster.addWin('gauge', 'gauge', {
      params: {
        'edit-index': 'gauge'
      }
    })
  } else if (command == 'datas') {
    layoutMaster.addWin('datas', 'datas', {
      params: {
        'edit-index': 'datas'
      }
    })
  }
}
function openPanel(command: string) {
  if (command == 'panel') {
    layoutMaster.addWin('panel', 'panel', {
      params: {
        'edit-index': command
      }
    })
  } else {
    const item = dataBase.panels[command]
    if (item) {
      layoutMaster.addWin('panelPreview', `p${command}`, {
        params: {
          'edit-index': `p${command}`
        },
        name: item.name
      })
    }
  }
}
function editPanel(command: string) {
  layoutMaster.addWin('panel', command, {
    params: {
      'edit-index': command
    }
  })
}
function deletePanel(command: string) {
  layoutMaster.removeWin(`p${command}`)
  layoutMaster.removeWin(command)
  delete dataBase.panels[command]
}

function openService(testerIndex: string) {
  layoutMaster.addWin('testerService', `${testerIndex}_services`, {
    name: dataBase.tester[testerIndex].name,
    params: {
      'edit-index': testerIndex
    }
  })
}
function openPackage() {
  layoutMaster.addWin('package', 'package', {})
}
function openIA(testerIndex: string) {
  const item = dataBase.ia[testerIndex]
  if (item.type == 'can') {
    layoutMaster.addWin('cani', `${testerIndex}_ia`, {
      name: dataBase.ia[testerIndex].name,
      params: {
        'edit-index': testerIndex
      }
    })
  } else if (item.type == 'lin') {
    layoutMaster.addWin('lini', `${testerIndex}_ia`, {
      name: dataBase.ia[testerIndex].name,
      params: {
        'edit-index': testerIndex
      }
    })
  }
}
function openSequence(testerIndex: string) {
  layoutMaster.addWin('testerSequence', `${testerIndex}_sequence`, {
    name: dataBase.tester[testerIndex].name,
    params: {
      'edit-index': testerIndex
    }
  })
}
//watch width and height change

const dataBaseList = computed(() => {
  const list: { url: string; disabled: boolean }[] = []
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
    lin: 'ldf',
    can: 'dbc',
    orti: 'orti'
  }
  if (testerIndex.startsWith('add')) {
    const type = testerIndex.split('add')[1].toLocaleLowerCase()
    const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
      title: 'Open Database File',
      properties: ['openFile'],
      filters: [{ name: `Database File`, extensions: [fileExtMap[type]] }]
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
          ldfFile: file
        }
      })
    } else if (type == 'can') {
      const id = v4()
      layoutMaster.addWin('dbc', `${id}`, {
        params: {
          'edit-index': id,
          dbcFile: file
        }
      })
    } else if (type == 'orti') {
      const id = v4()
      layoutMaster.addWin('orti', `${id}`, {
        params: {
          'edit-index': id,
          ortiFile: file
        }
      })
    }
  } else if (testerIndex.startsWith('LIN.')) {
    const name = testerIndex.split('.').slice(1).join('.')
    //findDb
    for (const key of Object.keys(dataBase.database.lin)) {
      if (dataBase.database.lin[key].name == name) {
        layoutMaster.addWin('ldf', key, {
          name: dataBase.database.lin[key].name,
          params: {
            'edit-index': key
          }
        })
        break
      }
    }
  } else if (testerIndex.startsWith('CAN.')) {
    const name = testerIndex.split('.').slice(1).join('.')
    //for can
    for (const key of Object.keys(dataBase.database.can)) {
      if (dataBase.database.can[key].name == name) {
        layoutMaster.addWin('dbc', key, {
          name: dataBase.database.can[key].name,
          params: {
            'edit-index': key
          }
        })
      }
    }
  } else if (testerIndex.startsWith('ORTI.')) {
    const name = testerIndex.split('.').slice(1).join('.')
    //for orti
    for (const key of Object.keys(dataBase.database.orti)) {
      if (dataBase.database.orti[key].name == name) {
        layoutMaster.addWin('orti', key, {
          name: dataBase.database.orti[key].name,
          params: {
            'edit-index': key
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

function isWinInCurrentPage(win: any) {
  const pid = win.pageId || defaultPageId
  const current = project.project.activePageId || defaultPageId
  return pid === current
}

// 监听窗口重新排列
watch(
  () => runtime.rearrangeWindows,
  (shouldRearrange) => {
    if (shouldRearrange) {
      // 获取所有hide为false的窗口
      const visibleWindows = Object.values(project.project.wins).filter(
        (win) =>
          !win.hide && win.layoutType === undefined && !win.isExternal && isWinInCurrentPage(win)
      )

      if (visibleWindows.length > 0) {
        rearrangeWindows(visibleWindows)
      }

      // 重置标志
      runtime.rearrangeWindows = false
    }
  }
)

// 窗口重新排列函数 - 优化版算法
function rearrangeWindows(windows: any[]) {
  const windowCount = windows.length
  if (windowCount === 0) return

  const padding = 0 // 窗口间距
  const availableWidth = contentW.value - padding * 2
  const availableHeight = contentH.value - padding * 2

  // 计算最优的行列布局
  const rows = Math.ceil(Math.sqrt(windowCount))
  const cols = Math.ceil(windowCount / rows)

  // 计算每个窗口的尺寸
  const winWidth = (availableWidth - (cols - 1) * padding) / cols
  const winHeight = (availableHeight - (rows - 1) * padding) / rows

  // 排列窗口
  windows.forEach((win, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    win.pos.x = padding + col * (winWidth + padding)
    win.pos.y = padding + row * (winHeight + padding)
    win.pos.w = winWidth
    win.pos.h = winHeight
  })
}

function openApi() {
  window.electron.ipcRenderer.send('ipc-open-script-api')
}

function openOsTrace(index: string) {
  if (index.endsWith('_TimeLine')) {
    index = index.replace('_TimeLine', '')
    layoutMaster.addWin('osTime', `${index}_time`, {
      name: dataBase.database.orti[index].name,
      params: {
        'edit-index': `${index}_time`
      }
    })
  } else {
    layoutMaster.addWin('osTrace', `${index}_trace`, {
      name: dataBase.database.orti[index].name,
      params: {
        'edit-index': `${index}_trace`
      }
    })
  }
}

onMounted(async () => {
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
  return Object.values(project.project.wins).filter(
    (item) => item.hide && item.layoutType == undefined && isWinInCurrentPage(item)
  )
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
    if (w.layoutType == 'bottom' && isWinInCurrentPage(w)) {
      h += w.pos.h
    }
  }
  return h
})
const contentH = computed(() => height.value - heightOffset.value - bottomH.value - pageWidth.value)
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
  background-color: var(--el-bg-color) !important;
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
  background-color: var(--el-bg-color);
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

.pages {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: v-bind(pageWidth + 'px');
  padding: 0 8px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  background-color: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);
}

.page-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.page-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-input {
  width: 100px;
}

.page-close {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.page-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
}

.windows {
  position: absolute;
  bottom: v-bind(bottomH + pageWidth + 'px');
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
  width: 90px;
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
