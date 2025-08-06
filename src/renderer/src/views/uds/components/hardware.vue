<template>
  <div v-loading="loading" class="main">
    <div class="left">
      <el-scrollbar :height="h + 'px'">
        <el-tree
          ref="treeRef"
          node-key="id"
          default-expand-all
          :data="tData"
          :expand-on-click-node="false"
          highlight-current
          @node-click="nodeClick"
        >
          <template #default="{ node, data }">
            <div class="tree-node">
              <span
                :class="{
                  isTop: node.level === 1,
                  vm: true,
                  treeLabel: true
                }"
              >
                <span v-if="data.vendor == 'ecubus' && node.level == 1" class="ecubus-logo">
                  <img src="@r/assets/logo1.svg" />
                  <Icon
                    :icon="hoveredEcuBus ? questionIcon1 : questionIcon"
                    style="width: 16px; height: 16px; color: var(--el-color-primary)"
                    @click.stop="openEcuBusHardware"
                    @mouseenter="hoveredEcuBus = true"
                    @mouseleave="hoveredEcuBus = false"
                  />
                </span>

                <span v-else>{{ node.label }}</span>
              </span>
              <el-button
                v-if="data.append"
                :disabled="globalStart"
                type="primary"
                link
                @click.stop="addNewDevice(data)"
              >
                <Icon class="tree-add" :icon="circlePlusFilled" />
              </el-button>

              <el-button
                v-else-if="node.parent?.data.append"
                :disabled="globalStart"
                type="danger"
                link
                @click.stop="removeDevice(data.id)"
              >
                <Icon class="tree-delete" :icon="removeIcon" />
              </el-button>
            </div>
          </template>
        </el-tree>
      </el-scrollbar>
    </div>
    <div :id="`${winKey}Shift`" class="shift" />
    <div class="right">
      <div v-if="activeTree">
        <canNodeVue
          v-if="activeTree.type == 'can'"
          v-model="dataModify"
          :height="h"
          :index="activeTree.id"
          :vendor="activeTree.vendor"
          @change="nodeChange"
        />
        <ethNodeVue
          v-else-if="activeTree.type == 'eth'"
          v-model="dataModify"
          :index="activeTree.id"
          :vendor="activeTree.vendor"
          @change="nodeChange"
        />
        <LinNodeVue
          v-else-if="activeTree.type == 'lin'"
          v-model="dataModify"
          :index="activeTree.id"
          :vendor="activeTree.vendor"
          @change="nodeChange"
        />
        <PwmNodeVue
          v-else-if="activeTree.type == 'pwm'"
          v-model="dataModify"
          :index="activeTree.id"
          :vendor="activeTree.vendor"
          @change="nodeChange"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {
  Ref,
  computed,
  inject,
  nextTick,
  onBeforeMount,
  onMounted,
  onUnmounted,
  ref,
  toRef,
  watch
} from 'vue'
import { Icon } from '@iconify/vue'
import { type FormRules, type FormInstance, ElMessageBox, ElMessage } from 'element-plus'
import circlePlusFilled from '@iconify/icons-ep/circle-plus-filled'
import removeIcon from '@iconify/icons-ep/remove'
import { useDataStore } from '@r/stores/data'
import canNodeVue from './config/node/canNode.vue'
import ethNodeVue from './config/node/ethNode.vue'
import { CanVendor } from 'nodeCan/can'
import { Layout } from '../layout'
import LinNodeVue from './config/node/linNode.vue'
import { useGlobalStart } from '@r/stores/runtime'
import { ecubusPro } from './../../../../../../package.json'
import questionIcon from '@iconify/icons-mdi/question-mark-circle-outline'
import questionIcon1 from '@iconify/icons-mdi/question-mark-circle'
import PwmNodeVue from './config/node/pwmNode.vue'

const loading = ref(false)
const activeTree = ref<tree>()
const hoveredEcuBus = ref(false)
const props = defineProps<{
  height: number
  width: number
  deviceId?: string
}>()
const winKey = 'hardware'
const h = toRef(props, 'height')
const w = toRef(props, 'width')
const leftWidth = ref(220)
const dataModify = ref(false)
const treeRef = ref()
const devices = useDataStore()
const globalStart = useGlobalStart()

function openEcuBusHardware() {
  window.electron.ipcRenderer.send('ipc-open-link', 'https://app.whyengineer.com/docs/um/hardware/')
}

function nodeClick(data: tree, node: any) {
  if (activeTree.value?.id == data.id) {
    return
  }
  if (node.parent?.data.append == true) {
    const done = () => {
      activeTree.value = undefined
      nextTick(() => {
        activeTree.value = data
      })
    }
    if (dataModify.value) {
      ElMessageBox.confirm('Are you sure you want to discard your changes?', 'Warning', {
        confirmButtonText: 'Discard',
        cancelButtonText: 'Cancel',
        type: 'warning',
        buttonSize: 'small',
        appendTo: `#win${winKey}`
      })
        .then(() => {
          dataModify.value = false
          done()
        })
        .catch(() => {
          treeRef.value?.setCurrentKey(activeTree.value?.id)
        })
    } else {
      done()
    }
  }
}

function removeDevice(id: string) {
  ElMessageBox.confirm('Are you sure to delete this device?', 'Warning', {
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    type: 'warning',
    buttonSize: 'small',
    appendTo: `#win${winKey}`
  })
    .then(() => {
      if (id == activeTree.value?.id) {
        dataModify.value = false
        activeTree.value = undefined
      }
      delete devices.devices[id]
      treeRef.value?.remove(id)
    })
    .catch(() => {
      null
    })
}
function addNewDevice(node: tree) {
  const done = () => {
    activeTree.value = undefined
    nextTick(() => {
      activeTree.value = node
    })
  }

  if (dataModify.value) {
    ElMessageBox.confirm('Are you sure you want to discard your changes?', 'Warning', {
      confirmButtonText: 'Discard',
      cancelButtonText: 'Cancel',
      type: 'warning',
      buttonSize: 'small',
      appendTo: `#win${winKey}`
    })
      .then(() => {
        dataModify.value = false
        done()
      })
      .catch(() => {
        treeRef.value?.setCurrentKey(activeTree.value?.id)
      })
  } else {
    done()
  }
}

function nodeChange(id: string, name: string) {
  //change tree stuff

  const node = treeRef.value?.getNode(id)
  if (node) {
    node.data.label = name
  } else {
    treeRef.value?.append(
      {
        label: name,
        append: false,
        id: id,
        vendor: activeTree.value?.vendor,
        type: activeTree.value?.type
      },
      activeTree.value?.id
    )
  }
  activeTree.value = undefined
}

interface tree {
  label: string
  vendor: CanVendor
  type?: 'can' | 'lin' | 'eth' | 'pwm'
  append: boolean
  id: string
  children?: tree[]
}
const tData = ref<tree[]>([])

function addSubTree(vendor: CanVendor, node: tree) {
  const canTree: tree = {
    label: 'CAN',
    append: true,
    id: vendor + 'CAN',
    vendor: vendor,
    type: 'can',
    children: []
  }
  if (vendor != 'ecubus') {
    node.children?.push(canTree)
  }
  for (const [key, value] of Object.entries(devices.devices)) {
    if (value.type == 'can' && value.canDevice && value.canDevice.vendor == vendor) {
      canTree.children?.push({
        label: value.canDevice.name,
        append: false,
        vendor: vendor,
        id: key,
        type: 'can'
      })
    }
  }
  if (vendor == 'simulate') {
    const ethTree: tree = {
      label: 'Ethernet',
      append: true,
      id: vendor + 'Eth',
      vendor: vendor,
      type: 'eth',
      children: []
    }
    node.children?.push(ethTree)
    for (const [key, value] of Object.entries(devices.devices)) {
      if (value.type == 'eth' && value.ethDevice && value.ethDevice.vendor == vendor) {
        ethTree.children?.push({
          label: value.ethDevice.name,
          append: false,
          vendor: vendor,
          id: key,
          type: 'eth'
        })
      }
    }
  }
  const linTree: tree = {
    label: 'LIN',
    append: true,
    id: vendor + 'LIN',
    vendor: vendor,
    type: 'lin',
    children: []
  }
  if (
    vendor == 'peak' ||
    vendor == 'toomoss' ||
    vendor == 'kvaser' ||
    vendor == 'vector' ||
    vendor == 'ecubus'
  ) {
    node.children?.push(linTree)
  }
  for (const [key, value] of Object.entries(devices.devices)) {
    if (value.type == 'lin' && value.linDevice && value.linDevice.vendor == vendor) {
      linTree.children?.push({
        label: value.linDevice.name,
        append: false,
        vendor: vendor,
        id: key,
        type: 'lin'
      })
    }
  }
  const pwmTree: tree = {
    label: 'PWM',
    append: true,
    id: vendor + 'PWM',
    vendor: vendor,
    type: 'pwm',
    children: []
  }
  if (vendor == 'ecubus') {
    node.children?.push(pwmTree)
  }
  for (const [key, value] of Object.entries(devices.devices)) {
    if (value.type == 'pwm' && value.pwmDevice && value.pwmDevice.vendor == vendor) {
      pwmTree.children?.push({
        label: value.pwmDevice.name,
        append: false,
        vendor: vendor,
        id: key,
        type: 'pwm'
      })
    }
  }
  // const ethTree:tree={
  //     label:'Ethernet',
  //     append:false,
  //     id:vendor+'Ethernet',
  //     type:'eth',
  //     children:[]
  // }
}
async function buildTree() {
  const t: tree[] = []
  const vendors: CanVendor[] = (
    await window.electron.ipcRenderer.invoke('ipc-get-vendor', ecubusPro)
  ).map((v: any) => v.name)

  console.log('vendors', vendors)

  if (vendors.includes('ecubus')) {
    const ecubus: tree = {
      label: 'ECUBUS',
      vendor: 'ecubus',
      append: false,
      id: 'ECUBUS',
      children: []
    }
    t.push(ecubus)
    addSubTree('ecubus', ecubus)
  }

  if (vendors.includes('zlg')) {
    const zlg: tree = {
      label: 'ZLG',
      vendor: 'zlg',
      append: false,
      id: 'ZLG',
      children: []
    }
    t.push(zlg)
    addSubTree('zlg', zlg)
  }
  if (vendors.includes('peak')) {
    const peak: tree = {
      label: 'PEAK',
      append: false,
      id: 'PEAK',
      vendor: 'peak',
      children: []
    }
    t.push(peak)
    addSubTree('peak', peak)
  }
  if (vendors.includes('kvaser')) {
    const kvaser: tree = {
      label: 'KVASER',
      vendor: 'kvaser',
      append: false,
      id: 'KVASER',

      children: []
    }
    t.push(kvaser)
    addSubTree('kvaser', kvaser)
  }
  if (vendors.includes('simulate')) {
    const simulate: tree = {
      label: 'Simulate',
      vendor: 'simulate',
      append: false,
      id: 'Simulate',

      children: []
    }
    t.push(simulate)
    addSubTree('simulate', simulate)
  }
  if (vendors.includes('toomoss')) {
    const toomoss: tree = {
      label: 'TOOMOSS',
      vendor: 'toomoss',
      append: false,
      id: 'TOOMOSS',
      children: []
    }
    t.push(toomoss)
    addSubTree('toomoss', toomoss)
  }
  if (vendors.includes('vector')) {
    const vector: tree = {
      label: 'VECTOR',
      vendor: 'vector',
      append: false,
      id: 'VECTOR',
      children: []
    }
    t.push(vector)
    addSubTree('vector', vector)
  }

  if (vendors.includes('slcan')) {
    const slcan: tree = {
      label: 'SLCAN',
      vendor: 'slcan',
      append: false,
      id: 'SLCAN',
      children: []
    }
    t.push(slcan)
    addSubTree('slcan', slcan)
  }
  if (vendors.includes('candle')) {
    const candle: tree = {
      label: 'CANDLE',
      vendor: 'candle',
      append: false,
      id: 'CANDLE',
      children: []
    }
    t.push(candle)
    addSubTree('candle', candle)
  }

  tData.value = t
}

const layout = inject('layout') as Layout
watch(dataModify, (val) => {
  layout.setWinModified(winKey, val)
})
const deviceId = toRef(props, 'deviceId')
watch(deviceId, (val) => {
  if (val) {
    const node = treeRef.value?.getNode(val)
    if (node) {
      treeRef.value?.setCurrentKey(val)
      nodeClick(node.data, node)
    }
  }
})
onBeforeMount(() => {
  buildTree()
})
onMounted(() => {
  window.jQuery(`#${winKey}Shift`).resizable({
    handles: 'e',
    // resize from all edges and corners
    resize: (e, ui) => {
      leftWidth.value = ui.size.width
    },
    maxWidth: 400,
    minWidth: 220
  })

  if (deviceId.value) {
    const node = treeRef.value?.getNode(deviceId.value)
    if (node) {
      treeRef.value?.setCurrentKey(deviceId.value)
      nodeClick(node.data, node)
    }
  }
})
</script>
<style scoped>
.tips {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  flex-direction: column;
}

.button {
  padding: 10px;
  border: 2px dashed var(--el-border-color);
  border-radius: 5px;
  text-align: center;
  margin: 10px;
}

.button .desc {
  font-size: 16px;
  color: var(--el-color-info);
  padding: 5px;
}

.button:hover {
  cursor: pointer;
  border: 2px dashed var(--el-color-primary-dark-2);
}

.isTop {
  font-weight: bold;
}

.left {
  position: absolute;
  top: 0px;
  left: 0px;
  width: v-bind(leftWidth + 'px');
  z-index: 1;
}

.shift {
  position: absolute;
  top: 0px;
  left: 0px;
  width: v-bind(leftWidth + 1 + 'px');
  height: v-bind(h + 'px');
  z-index: 0;
  border-right: solid 1px var(--el-border-color);
}

/* .tree-add {
    color: var(--el-color-primary);
}

.tree-add:hover {
    color: var(--el-color-primary-dark-2);
    cursor: pointer;
}

.tree-delete {
    color: var(--el-color-danger);
}

.tree-delete:hover {
    color: var(--el-color-danger-dark-2);
    cursor: pointer;
} */

.shift:hover {
  border-right: solid 4px var(--el-color-primary);
}

.shift:active {
  border-right: solid 4px var(--el-color-primary);
}

.hardware {
  margin: 20px;
}

.tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  padding-right: 5px;
}

.right {
  position: absolute;
  left: v-bind(leftWidth + 5 + 'px');
  width: v-bind(w - leftWidth - 6 + 'px');
  height: v-bind(h + 'px');
  z-index: 0;
  overflow: auto;
}

.main {
  position: relative;
  height: v-bind(h + 'px');
  width: v-bind(w + 'px');
}

.el-tabs {
  --el-tabs-header-height: 24 !important;
}

.addr {
  border: 1px solid var(--el-border-color);
  border-radius: 5px;
  padding: 5px;
  max-height: 200px;
  min-height: 50px;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
  display: block;
  position: relative;
}

.addrClose {
  position: absolute;
  right: 5px;
  top: 5px;
  width: 12px;
  height: 12px;
}

.addrClose:hover {
  color: var(--el-color-danger);
  cursor: pointer;
}

.subClose {
  z-index: 100;
}

.subClose:hover {
  color: var(--el-color-danger);
  cursor: pointer;
}

.param {
  margin-right: 5px;
  border-radius: 2px;
}

.treeLabel {
  display: inline-block;
  white-space: nowrap;
  /* 保证内容不会换行 */
  overflow: hidden;
  /* 超出容器部分隐藏 */
  text-overflow: ellipsis;
  /* 使用省略号表示超出部分 */
  width: v-bind(leftWidth - 100 + 'px') !important;
}

.logo {
  height: 11px;
}

.vm {
  display: flex;
  align-items: center;
}

.ecubus-logo {
  height: 16px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.ecubus-logo img {
  height: 16px;
  /* width: 100px; */
}

.ecubus-logo span {
  line-height: 14px;
}
</style>

