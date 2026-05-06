<template>
  <div>
    <div id="networkMain" class="w">
      <div class="left">
        <el-scrollbar :height="h + 'px'">
          <el-tree
            default-expand-all
            :data="tData"
            :props="defaultProps"
            :expand-on-click-node="false"
          >
            <template #default="{ node, data }">
              <span class="tree-node">
                <span class="tree-label">
                  <Icon v-if="data.icon" style="margin-right: 5px" :icon="data.icon" />

                  <span
                    :class="{
                      isTop: node.level === 1,

                      treeLabel: true
                    }"
                    >{{ node.label }}</span
                  >
                </span>
                <el-button
                  v-if="data.canAdd"
                  link
                  type="primary"
                  @click.stop="addNode(data.type, node.parent?.data)"
                >
                  <Icon :icon="circlePlusFilled" />
                </el-button>
              </span>
            </template>
          </el-tree>
        </el-scrollbar>
      </div>
      <div id="networkShift" class="shift" />
      <div v-loading="loading" class="right">
        <div id="networkGraph" @contextmenu.prevent="handleGraphContextMenu" />
      </div>
      <div class="help">
        <span>
          <Icon :icon="zoomInRounded" class="helpButton" @click="scalePaper1('in')" />
        </span>
        <span>
          <Icon :icon="zoomOutRounded" class="helpButton" @click="scalePaper1('out')" />
        </span>
        <span>
          <Icon :icon="fullscreenIcon" class="helpButton" @click="fitPater" />
        </span>
      </div>
      <!-- Context menu -->
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <div class="context-menu-item" @click="handleContextEdit">
          <Icon :icon="editIcon" class="menu-icon" />
          {{ i18next.t('uds.network.contextMenu.edit') }}
        </div>
        <div class="context-menu-item" @click="handleContextCopy">
          <Icon :icon="copyIcon" class="menu-icon" />
          {{ i18next.t('uds.network.contextMenu.copy') }}
        </div>
        <div
          v-if="contextMenu.canDelete"
          class="context-menu-item danger"
          @click="handleContextDelete"
        >
          <Icon :icon="deleteIcon" class="menu-icon" />
          {{ i18next.t('uds.network.contextMenu.delete') }}
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import * as joint from '@joint/core'
import {
  computed,
  onMounted,
  toRef,
  ref,
  nextTick,
  watch,
  provide,
  inject,
  onUnmounted,
  watchEffect
} from 'vue'
import {
  UDSView,
  udsCeil,
  udsHardware,
  Node as UdsNode,
  Replay as UdsReplay,
  getCeilInstanceAs
} from './udsView'
import { useGlobalStart } from '@r/stores/runtime'
import fullscreenIcon from '@iconify/icons-material-symbols/fullscreen'
import zoomInRounded from '@iconify/icons-material-symbols/zoom-in-rounded'
import zoomOutRounded from '@iconify/icons-material-symbols/zoom-out-rounded'
import { Icon, IconifyIcon } from '@iconify/vue'
import toolsPliersWireStripperOutline from '@iconify/icons-material-symbols/tools-pliers-wire-stripper-outline'
import circlePlusFilled from '@iconify/icons-ep/circle-plus-filled'
import removeFilled from '@iconify/icons-ep/remove-filled'
import { ElMessageBox } from 'element-plus'
import computerOutlineRounded from '@iconify/icons-material-symbols/computer-outline-rounded'
import textFields from '@iconify/icons-material-symbols/text-fields'
import assistantDeviceRounded from '@iconify/icons-material-symbols/assistant-device-rounded'
import editIcon from '@iconify/icons-material-symbols/edit'
import locationDisabled from '@iconify/icons-material-symbols/location-disabled'
import fileIcon from '@iconify/icons-material-symbols/file-open-rounded'
import copyIcon from '@iconify/icons-material-symbols/content-copy'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import { Layout } from '../layout'
import { v4 } from 'uuid'
import { useDataStore } from '@r/stores/data'
import deviceIcon from '@iconify/icons-material-symbols/important-devices-outline'
import interIcon from '@iconify/icons-material-symbols/interactive-space-outline'
import networkNode from '@iconify/icons-material-symbols/network-node'
import nodeIcon from '@iconify/icons-material-symbols/variables-outline-rounded'
import { useProjectStore } from '@r/stores/project'
import soaIcon from '@iconify/icons-material-symbols/linked-services-outline'
import replayIcon from '@iconify/icons-material-symbols/replay'
import i18next from 'i18next'
import { NodeItem, Inter, LogItem, ReplayItem } from 'src/preload/data'
import { cloneDeep } from 'lodash'
import { UdsDevice } from 'nodeCan/uds'

interface Tree {
  id: string
  type: string
  label: string
  canAdd?: boolean
  contextMenu?: boolean
  children: Tree[]
  icon?: IconifyIcon
}

const dataBase = useDataStore()
const globalStart = useGlobalStart()
const leftWidth = ref(200)
const initDone = ref(false)

// When globalStart stops, stop all playing replays and restore to play (idle) state
watch(globalStart, (val) => {
  if (val) return
  for (const id of Object.keys(dataBase.replays)) {
    const replay = getCeilInstanceAs<UdsReplay>(id)
    if (replay?.getIsPlaying()) {
      replay.setPlaying(false)
      replay.setProgress(0)
    }
  }
})

function addChild(parent: Tree) {
  const c: Tree = {
    type: 'device',
    label: i18next.t('uds.network.tree.devices'),
    canAdd: false,
    children: [],
    icon: deviceIcon,
    id: 'device'
  }
  if (parent.type == 'can') {
    for (const key of Object.keys(dataBase.devices)) {
      const item = dataBase.devices[key]
      if (item.type == 'can' && item.canDevice) {
        const cc: Tree = {
          type: 'device',
          label: item.canDevice.name,
          canAdd: false,
          children: [],
          icon: deviceIcon,
          contextMenu: true,
          id: key
        }
        c.children.push(cc)
      }
    }
  } else if (parent.type == 'eth') {
    for (const key of Object.keys(dataBase.devices)) {
      const item = dataBase.devices[key]
      if (item.type == 'eth' && item.ethDevice) {
        const cc: Tree = {
          type: 'device',
          label: item.ethDevice.name,
          canAdd: false,
          children: [],
          icon: deviceIcon,
          contextMenu: true,
          id: key
        }
        c.children.push(cc)
      }
    }
  } else if (parent.type == 'lin') {
    for (const key of Object.keys(dataBase.devices)) {
      const item = dataBase.devices[key]
      if (item.type == 'lin' && item.linDevice) {
        const cc: Tree = {
          type: 'device',
          label: item.linDevice.name,
          canAdd: false,
          children: [],
          icon: deviceIcon,
          contextMenu: true,
          id: key
        }
        c.children.push(cc)
      }
    }
  } else if (parent.type == 'pwm') {
    for (const key of Object.keys(dataBase.devices)) {
      const item = dataBase.devices[key]
      if (item.type == 'pwm' && item.pwmDevice) {
        const cc: Tree = {
          type: 'device',
          label: item.pwmDevice.name,
          canAdd: false,
          children: [],
          icon: deviceIcon,
          contextMenu: true,
          id: key
        }
        c.children.push(cc)
      }
    }
  } else if (parent.type == 'someip') {
    for (const key of Object.keys(dataBase.devices)) {
      const item = dataBase.devices[key]
      if (item.type == 'someip' && item.someipDevice) {
        const cc: Tree = {
          type: 'device',
          label: item.someipDevice.name,
          canAdd: false,
          children: [],
          icon: deviceIcon,
          contextMenu: true,
          id: key
        }
        c.children.push(cc)
      }
    }
  }
  parent.children.push(c)
  //interactive
  const i: Tree = {
    type: 'interactive',
    label: i18next.t('uds.network.tree.interactive'),
    canAdd: true,
    children: [],
    icon: interIcon,
    id: 'interactive'
  }
  if (parent.type == 'can') {
    for (const key of Object.keys(dataBase.ia)) {
      const item = dataBase.ia[key]
      if (item.type == 'can') {
        const cc: Tree = {
          type: 'interactive',
          label: item.name,
          canAdd: false,
          children: [],
          icon: interIcon,
          contextMenu: true,
          id: key
        }
        i.children.push(cc)
      }
    }
  } else if (parent.type == 'lin') {
    for (const key of Object.keys(dataBase.ia)) {
      const item = dataBase.ia[key]
      if (item.type == 'lin') {
        const cc: Tree = {
          type: 'interactive',
          label: item.name,
          canAdd: false,
          children: [],
          icon: interIcon,
          contextMenu: true,
          id: key
        }
        i.children.push(cc)
      }
    }
  } else if (parent.type == 'pwm') {
    for (const key of Object.keys(dataBase.ia)) {
      const item = dataBase.ia[key]
      if (item.type == 'pwm') {
        const cc: Tree = {
          type: 'interactive',
          label: item.name,
          canAdd: false,
          children: [],
          icon: interIcon,
          contextMenu: true,
          id: key
        }
        i.children.push(cc)
      }
    }
  } else if (parent.type == 'someip') {
    for (const key of Object.keys(dataBase.ia)) {
      const item = dataBase.ia[key]
      if (item.type == 'someip') {
        const cc: Tree = {
          type: 'interactive',
          label: item.name,
          canAdd: false,
          children: [],
          icon: interIcon,
          contextMenu: true,
          id: key
        }
        i.children.push(cc)
      }
    }
  }
  if (parent.type != 'eth') {
    parent.children.push(i)
  }
}
const tData = computed(() => {
  const can: Tree = {
    type: 'can',
    label: i18next.t('uds.network.tree.can'),
    canAdd: false,
    children: [],
    id: 'can',
    icon: networkNode
  }
  const lin: Tree = {
    type: 'lin',
    label: i18next.t('uds.network.tree.lin'),
    canAdd: false,
    icon: networkNode,
    children: [],
    id: 'lin'
  }
  const eth: Tree = {
    type: 'eth',
    label: i18next.t('uds.network.tree.ethernet'),
    canAdd: false,
    icon: networkNode,
    children: [],
    id: 'eth'
  }
  const node: Tree = {
    type: 'node',
    label: i18next.t('uds.network.tree.node'),
    canAdd: true,
    icon: nodeIcon,
    children: [],
    id: 'node'
  }
  const pwm: Tree = {
    type: 'pwm',
    label: i18next.t('uds.network.tree.pwm'),
    canAdd: false,
    icon: networkNode,
    children: [],
    id: 'pwm'
  }
  const log: Tree = {
    type: 'log',
    label: i18next.t('uds.network.tree.loggers'),
    canAdd: true,
    icon: fileIcon,
    children: [],
    id: 'log'
  }
  const replay: Tree = {
    type: 'replay',
    label: i18next.t('uds.network.tree.replays'),
    canAdd: true,
    icon: replayIcon,
    children: [],
    id: 'replay'
  }
  for (const key of Object.keys(dataBase.nodes)) {
    const item = dataBase.nodes[key]

    const cc: Tree = {
      type: 'node',
      label: item.name,
      canAdd: false,
      children: [],
      icon: nodeIcon,
      contextMenu: true,
      id: key
    }
    node.children.push(cc)
  }
  for (const key of Object.keys(dataBase.logs)) {
    const item = dataBase.logs[key]
    const cc: Tree = {
      type: 'log',
      label: item.name,
      canAdd: false,
      children: [],
      icon: fileIcon,
      id: key
    }
    log.children.push(cc)
  }
  for (const key of Object.keys(dataBase.replays)) {
    const item = dataBase.replays[key]
    const cc: Tree = {
      type: 'replay',
      label: item.name,
      canAdd: false,
      children: [],
      icon: replayIcon,
      id: key
    }
    replay.children.push(cc)
  }
  const someip: Tree = {
    type: 'someip',
    label: i18next.t('uds.network.tree.someip'),
    canAdd: false,
    icon: soaIcon,
    children: [],
    id: 'someip'
  }

  addChild(can)
  addChild(lin)
  addChild(eth)
  addChild(pwm)
  addChild(someip)

  // addChild(node)
  return [can, lin, eth, someip, pwm, node, log, replay]
})

const defaultProps = {
  children: 'children',
  label: 'label'
}
const udsView = inject('udsView') as UDSView
const props = defineProps<{
  height: number
  width: number
}>()
const h = toRef(props, 'height')
const w = toRef(props, 'width')

const panning = ref(false)
const panStartPosition = { x: 0, y: 0 }
let paper: joint.dia.Paper

// Clipboard for copy/paste functionality
const clipboard = ref<{
  type: 'node' | 'interactive' | 'log' | 'replay' | 'device' | null
  data: NodeItem | Inter | LogItem | ReplayItem | UdsDevice | null
}>({ type: null, data: null })

// Context menu state
const contextMenu = ref<{
  visible: boolean
  x: number
  y: number
  targetId: string
  targetType: string
  canDelete: boolean
}>({ visible: false, x: 0, y: 0, targetId: '', targetType: '', canDelete: false })

const treePop = ref<Record<string, any>>({})
const project = useProjectStore()

watch([w, h, leftWidth], () => {
  paper?.setDimensions(w.value - leftWidth.value - 5, h.value - 5)
})

const loading = ref(true)

// Handle keyboard events for copy/paste
function handleKeyboardEvent(event: KeyboardEvent) {
  // Ctrl+C or Cmd+C for copy
  if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
    copySelectedNode()
  }
  // Ctrl+V or Cmd+V for paste
  if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
    pasteNode()
  }
}

// Copy the selected node to clipboard
function copySelectedNode() {
  const selectedId = udsView.selectedElement
  if (!selectedId) return

  // Check if it's a node type that can be copied
  if (dataBase.nodes[selectedId]) {
    clipboard.value = {
      type: 'node',
      data: cloneDeep(dataBase.nodes[selectedId])
    }
  } else if (dataBase.ia[selectedId]) {
    clipboard.value = {
      type: 'interactive',
      data: cloneDeep(dataBase.ia[selectedId])
    }
  } else if (dataBase.logs[selectedId]) {
    clipboard.value = {
      type: 'log',
      data: cloneDeep(dataBase.logs[selectedId])
    }
  } else if (dataBase.replays[selectedId]) {
    clipboard.value = {
      type: 'replay',
      data: cloneDeep(dataBase.replays[selectedId])
    }
  } else if (dataBase.devices[selectedId]) {
    clipboard.value = {
      type: 'device',
      data: cloneDeep(dataBase.devices[selectedId])
    }
  }
}

// Helper function to get device name
function getDeviceName(device: UdsDevice): string {
  if (device.canDevice) return device.canDevice.name
  if (device.ethDevice) return device.ethDevice.name
  if (device.linDevice) return device.linDevice.name
  if (device.pwmDevice) return device.pwmDevice.name
  if (device.someipDevice) return device.someipDevice.name
  return 'Device'
}

// Generate unique name with incremental suffix
// If original name ends with _<number>, increment the number
// Otherwise, add _1 suffix
// Continue incrementing if name already exists in the collection
function generateUniqueName(originalName: string, existingNames: string[]): string {
  // Match pattern: name_<number> at the end
  const match = originalName.match(/^(.+)_(\d+)$/)
  let baseName: string
  let startNum: number

  if (match) {
    baseName = match[1]
    startNum = parseInt(match[2], 10) + 1
  } else {
    baseName = originalName
    startNum = 1
  }

  // Find a unique name by incrementing the number
  let newName = `${baseName}_${startNum}`
  while (existingNames.includes(newName)) {
    startNum++
    newName = `${baseName}_${startNum}`
  }

  return newName
}

// Get existing names from a record collection
function getExistingNames<T extends { name: string }>(collection: Record<string, T>): string[] {
  return Object.values(collection).map((item) => item.name)
}

// Paste node from clipboard
function pasteNode() {
  if (!clipboard.value.type || !clipboard.value.data) return

  const id = v4()
  const copiedData = clipboard.value.data

  if (clipboard.value.type === 'node') {
    const nodeData = copiedData as NodeItem
    const existingNames = getExistingNames(dataBase.nodes)
    const newName = generateUniqueName(nodeData.name, existingNames)
    dataBase.nodes[id] = {
      ...cloneDeep(nodeData),
      id: id,
      name: newName,
      channel: [] // Clear channel connections, user needs to reconnect
    }
    udsView.addNode(id, dataBase.nodes[id])
    udsView.changeName(id, newName)
  } else if (clipboard.value.type === 'interactive') {
    const iaData = copiedData as Inter
    const existingNames = getExistingNames(dataBase.ia)
    const newName = generateUniqueName(iaData.name, existingNames)
    dataBase.ia[id] = {
      ...cloneDeep(iaData),
      id: id,
      name: newName,
      devices: [] // Clear device connections
    }
    udsView.addIg(id, dataBase.ia[id])
    udsView.changeName(id, newName)
  } else if (clipboard.value.type === 'log') {
    const logData = copiedData as LogItem
    const existingNames = getExistingNames(dataBase.logs)
    const newName = generateUniqueName(logData.name, existingNames)
    dataBase.logs[id] = {
      ...cloneDeep(logData),
      id: id,
      name: newName,
      channel: [] // Clear channel connections
    }
    udsView.addLog(id, dataBase.logs[id])
    udsView.changeName(id, newName)
  } else if (clipboard.value.type === 'replay') {
    const replayData = copiedData as ReplayItem
    const existingNames = getExistingNames(dataBase.replays)
    const newName = generateUniqueName(replayData.name, existingNames)
    dataBase.replays[id] = {
      ...cloneDeep(replayData),
      id: id,
      name: newName,
      channel: [] // Clear channel connections
    }
    udsView.addReplay(id, dataBase.replays[id])
    udsView.changeName(id, newName)
  } else if (clipboard.value.type === 'device') {
    const deviceData = copiedData as UdsDevice
    const newDevice = cloneDeep(deviceData)
    const existingNames = Object.values(dataBase.devices).map((d) => getDeviceName(d))
    const originalName = getDeviceName(newDevice)
    const newName = generateUniqueName(originalName, existingNames)
    // Update name and clear handle for the copied device
    if (newDevice.canDevice) {
      newDevice.canDevice.name = newName
      newDevice.canDevice.id = id
      newDevice.canDevice.handle = '' // Clear device handle, user needs to reselect
    } else if (newDevice.ethDevice) {
      newDevice.ethDevice.name = newName
      newDevice.ethDevice.id = id
      newDevice.ethDevice.device.handle = '' // Clear device handle
    } else if (newDevice.linDevice) {
      newDevice.linDevice.name = newName
      newDevice.linDevice.id = id
      newDevice.linDevice.device.handle = '' // Clear device handle
    } else if (newDevice.pwmDevice) {
      newDevice.pwmDevice.name = newName
      newDevice.pwmDevice.id = id
      newDevice.pwmDevice.device.handle = '' // Clear device handle
    } else if (newDevice.someipDevice) {
      newDevice.someipDevice.name = newName
      newDevice.someipDevice.id = id
      // someip uses different connection fields
    }
    dataBase.devices[id] = newDevice
    udsView.addDevice(id, dataBase.devices[id])
    udsView.changeName(id, newName)
  }

  fitPater()
}

// Hide context menu
function hideContextMenu() {
  contextMenu.value.visible = false
}

// Handle context menu event on graph
function handleGraphContextMenu(event: MouseEvent) {
  if (!paper) return

  // Find the element at the click position
  const localPoint = paper.clientToLocalPoint({ x: event.clientX, y: event.clientY })
  const elementViews = paper.findViewsFromPoint(localPoint)
  if (elementViews && elementViews.length > 0) {
    const elementView = elementViews[0]
    if (elementView && elementView.model) {
      const id = elementView.model.id as string
      const ceil = udsView.ceilMap.get(id)
      if (ceil) {
        const targetType = ceil.data.type
        const container = document.getElementById('networkMain')
        if (container) {
          const containerRect = container.getBoundingClientRect()
          showContextMenu(
            event.clientX - containerRect.left,
            event.clientY - containerRect.top,
            id,
            targetType
          )
        }
      }
    }
  }
}

// Show context menu at position
function showContextMenu(x: number, y: number, targetId: string, targetType: string) {
  // Check if the element can be deleted
  let canDelete = true
  if (targetType === 'device') {
    // Devices cannot be deleted from context menu (they are managed elsewhere)
    canDelete = false
  } else if (targetType === 'node' && dataBase.nodes[targetId]?.isTest) {
    // Test nodes cannot be deleted
    canDelete = false
  }

  contextMenu.value = {
    visible: true,
    x,
    y,
    targetId,
    targetType,
    canDelete
  }
}

// Handle context menu edit action
function handleContextEdit() {
  const targetId = contextMenu.value.targetId
  const targetType = contextMenu.value.targetType
  hideContextMenu()

  // Trigger edit based on type
  const ceil = udsView.ceilMap.get(targetId)
  if (ceil) {
    ceil.events.emit('edit', ceil)
  }
}

// Handle context menu copy action
function handleContextCopy() {
  const targetId = contextMenu.value.targetId
  hideContextMenu()

  // Copy to clipboard
  udsView.selectedElement = targetId
  copySelectedNode()
}

// Handle context menu delete action
function handleContextDelete() {
  const targetId = contextMenu.value.targetId
  const targetType = contextMenu.value.targetType
  hideContextMenu()

  if (!contextMenu.value.canDelete) return

  // Confirm deletion
  ElMessageBox.confirm(
    i18next.t('uds.network.dialogs.deleteNodeMessage'),
    i18next.t('uds.network.dialogs.warning'),
    {
      confirmButtonText: i18next.t('uds.network.dialogs.ok'),
      cancelButtonText: i18next.t('uds.network.dialogs.cancel'),
      type: 'warning',
      buttonSize: 'small',
      appendTo: '#networkMain',
      closeOnClickModal: false,
      closeOnPressEscape: false
    }
  )
    .then(() => {
      // Remove from data store
      if (targetType === 'node') {
        delete dataBase.nodes[targetId]
      } else if (targetType === 'interactive') {
        delete dataBase.ia[targetId]
      } else if (targetType === 'log') {
        delete dataBase.logs[targetId]
      } else if (targetType === 'replay') {
        delete dataBase.replays[targetId]
      }
      layout.removeWin(targetId)
    })
    .catch(() => {
      // Cancelled
    })
}

interface RelayStop {
  key: 'replayStop'
  values: {
    message: {
      replayId: string
      data: {
        reason?: string
      }
    }
  }[]
}
interface RelayProgress {
  key: 'replayProgress'
  values: {
    message: {
      replayId: string
      data: {
        percent: number
      }
    }
  }[]
}
function replayCallback(val: RelayStop | RelayProgress) {
  if (val.key === 'replayStop') {
    const replay = getCeilInstanceAs<UdsReplay>(val.values[0].message.replayId)

    if (replay) {
      replay.setPlaying(false)
    }
  } else if (val.key === 'replayProgress') {
    const last = val.values[val.values.length - 1]
    const replay = getCeilInstanceAs<UdsReplay>(last.message.replayId)
    if (replay) {
      replay.setProgress(last.message.data.percent)
    }
  }
}
onMounted(() => {
  loading.value = true
  window.logBus.on('replayStop', replayCallback)
  window.logBus.on('replayProgress', replayCallback)
  window.jQuery('#networkShift').resizable({
    handles: 'e',
    containment: '#networkMain',
    // resize from all edges and corners
    resize: (e, ui) => {
      leftWidth.value = ui.size.width
    },
    maxWidth: 400,
    minWidth: 200
  })

  paper = new joint.dia.Paper({
    el: document.getElementById('networkGraph'),
    model: udsView.graph,
    width: w.value - leftWidth.value - 5,
    height: h.value - 5,
    gridSize: 10,
    drawGrid: true,
    background: {
      color: 'var(--el-color-info-light-9)'
    },
    interactive: {
      elementMove: true,
      linkMove: false
    },
    snapLabels: true,
    defaultLink: () => new joint.shapes.standard.Link(),
    linkPinning: true
  })

  paper.el.addEventListener('wheel', function (event) {
    event.preventDefault() // 防止页面滚动
    const delta = event.deltaY // 获取滚动方向和距离

    if (event.ctrlKey) {
      // 获取鼠标位置
      const clientX = event.clientX
      const clientY = event.clientY
      // 获取鼠标基于画布的偏移
      const offset = paper.clientToLocalPoint(clientX, clientY)
      // 更新缩放比例
      const currentScale = paper.scale().sx - delta * 0.001
      // 应用缩放
      paper.scaleUniformAtPoint(currentScale, { x: offset.x, y: offset.y })
    } else {
      if (event.shiftKey) {
        paper.translate(paper.translate().tx - delta * 0.2, paper.translate().ty) // 滚动时移动画布
      } else {
        paper.translate(paper.translate().tx, paper.translate().ty - delta * 0.2) // 滚动时移动画布
      }
    }
  })
  udsView.setPaper(paper)

  // Mouse down event to start panning
  paper.on('blank:pointerdown', function (event, x, y) {
    panning.value = true
    panStartPosition.x = x
    panStartPosition.y = y
    //add class to body to change the cursor icon
    document.body.classList.add('is-panning')

    // prevent text selection
    event.preventDefault()
  })

  // Mouse move event to handle panning
  paper.on('cell:pointermove blank:pointermove', function (event: any, x: number, y: number) {
    if (panning.value && paper) {
      // Calculate the distance the mouse has moved
      const dx = x - panStartPosition.x
      const dy = y - panStartPosition.y
      // Move the paper by that distance
      paper.translate(paper.translate().tx + dx, paper.translate().ty + dy)
    }
  })

  // Mouse up event to end panning
  paper.on('cell:pointerup blank:pointerup', function (event: any, x: number, y: number) {
    if (panning.value && paper) {
      // Update the paper origin position
      paper.translate(
        paper.translate().tx + (x - panStartPosition.x),
        paper.translate().ty + (y - panStartPosition.y)
      )
      panning.value = false
      //remove class from body to change the cursor icon back
      document.body.classList.remove('is-panning')
    }
  })

  paper.on('element:mouseenter', function (elementView) {
    elementView.showTools()
  })

  paper.on('element:mouseleave', function (elementView) {
    elementView.hideTools()
  })

  // Keyboard events for copy/paste
  document.addEventListener('keydown', handleKeyboardEvent)

  // Element selection for copy
  paper.on('element:pointerdown', function (elementView) {
    const model = elementView.model
    const id = model.id as string
    const ceil = udsView.ceilMap.get(id)
    if (ceil) {
      udsView.selectedElement = id
    }
  })

  // Double click to edit
  paper.on('element:pointerdblclick', function (elementView) {
    const model = elementView.model
    const id = model.id as string
    const ceil = udsView.ceilMap.get(id)
    if (ceil) {
      ceil.events.emit('edit', ceil)
    }
  })

  // Hide context menu on blank click
  paper.on('blank:pointerdown', function () {
    hideContextMenu()
  })

  nextTick(() => {
    if (project.project.wins['network'].hide) {
      const q = watch(
        () => project.project.wins['network']?.hide,
        (v) => {
          if (v) {
            //hide
          } else {
            nextTick(() => {
              buildView()
              initDone.value = true
              loading.value = false
            })
          }
          q()
        }
      )
    } else {
      buildView()
      initDone.value = true
      loading.value = false
    }

    // fitPater()
  })
})
const layout = inject('layout') as Layout

watchEffect(() => {
  if (initDone.value) {
    //device dynamic update
    for (const el of udsView.ceilMap.values()) {
      if (el instanceof UdsNode) {
        if (dataBase.nodes[el.getId()] == undefined) {
          udsView.removeElement(el.getId())
        }
      } else if (el instanceof udsHardware) {
        if (dataBase.devices[el.getId()] == undefined) {
          udsView.removeElement(el.getId())
          //remove device in ia
          for (const key of Object.keys(dataBase.ia)) {
            const item = dataBase.ia[key]
            const index = item.devices.indexOf(el.getId())
            if (index != -1) {
              item.devices.splice(index, 1)
            }
          }
          //remove device in node
          for (const key of Object.keys(dataBase.nodes)) {
            const item = dataBase.nodes[key]
            const index = item.channel.indexOf(el.getId())
            if (index != -1) {
              item.channel.splice(index, 1)
            }
          }
        }
      }
    }
    for (const key of Object.keys(dataBase.devices)) {
      udsView.addDevice(key, dataBase.devices[key])
      if (dataBase.devices[key].type == 'can' && dataBase.devices[key].canDevice) {
        udsView.changeName(key, dataBase.devices[key].canDevice.name)
      } else if (dataBase.devices[key].type == 'eth' && dataBase.devices[key].ethDevice) {
        udsView.changeName(key, dataBase.devices[key].ethDevice.name)
      } else if (dataBase.devices[key].type == 'lin' && dataBase.devices[key].linDevice) {
        udsView.changeName(key, dataBase.devices[key].linDevice.name)
      } else if (dataBase.devices[key].type == 'someip' && dataBase.devices[key].someipDevice) {
        udsView.changeName(key, dataBase.devices[key].someipDevice.name)
      } else if (dataBase.devices[key].type == 'pwm' && dataBase.devices[key].pwmDevice) {
        udsView.changeName(key, dataBase.devices[key].pwmDevice.name)
      }
    }
    // test nodes
    for (const key of Object.keys(dataBase.nodes)) {
      udsView.addNode(key, dataBase.nodes[key])
      if (dataBase.nodes[key].isTest) {
        udsView.changeName(key, dataBase.nodes[key].name)
      }
    }
    //check link
    for (const from of Object.keys(dataBase.ia)) {
      for (const to of Object.keys(dataBase.devices)) {
        if (dataBase.ia[from].devices.indexOf(to) == -1) {
          udsView.removeLink(from, to)
        }
      }
    }
    //add new link
    for (const key of Object.keys(dataBase.ia)) {
      for (const to of dataBase.ia[key].devices) {
        if (dataBase.devices[to]) {
          udsView.addLink(key, to)
        }
      }
    }
    //check link
    for (const from of Object.keys(dataBase.nodes)) {
      for (const to of Object.keys(dataBase.devices)) {
        if (dataBase.nodes[from].channel.indexOf(to) == -1) {
          udsView.removeLink(from, to)
        }
      }
    }
    //add new link
    for (const key of Object.keys(dataBase.nodes)) {
      for (const to of dataBase.nodes[key].channel) {
        if (dataBase.devices[to]) {
          udsView.addLink(key, to)
        }
      }
    }
    //check log
    for (const from of Object.keys(dataBase.logs)) {
      for (const to of Object.keys(dataBase.devices)) {
        if (dataBase.logs[from].channel.indexOf(to) == -1) {
          udsView.removeLink(to, from)
        }
      }
    }
    //add new link
    for (const key of Object.keys(dataBase.logs)) {
      for (const to of dataBase.logs[key].channel) {
        if (dataBase.devices[to]) {
          udsView.addLink(to, key)
        }
      }
    }
    //check replay - remove deleted replays
    for (const el of udsView.ceilMap.values()) {
      if (el instanceof UdsReplay) {
        if (dataBase.replays[el.getId()] == undefined) {
          udsView.removeElement(el.getId())
        }
      }
    }
    //add new replays
    for (const key of Object.keys(dataBase.replays)) {
      udsView.addReplay(key, dataBase.replays[key])
    }
    //check replay links
    for (const from of Object.keys(dataBase.replays)) {
      for (const to of Object.keys(dataBase.devices)) {
        if (dataBase.replays[from].channel.indexOf(to) == -1) {
          udsView.removeLink(from, to)
        }
      }
    }
    //add new replay links
    for (const key of Object.keys(dataBase.replays)) {
      for (const to of dataBase.replays[key].channel) {
        if (dataBase.devices[to]) {
          udsView.addLink(key, to)
        }
      }
    }
  }
})

function buildView() {
  for (const key of Object.keys(dataBase.devices)) {
    udsView.addDevice(key, dataBase.devices[key])
  }
  for (const key of Object.keys(dataBase.ia)) {
    udsView.addIg(key, dataBase.ia[key])
    //check devices if device is not in the list remove it
    const ff = dataBase.ia[key].devices.filter((v) => {
      return dataBase.devices[v] != undefined
    })
    if (ff.length != dataBase.ia[key].devices.length) {
      dataBase.ia[key].devices = ff
    }

    for (const to of dataBase.ia[key].devices) {
      udsView.addLink(key, to)
    }
  }
  //add node
  for (const key of Object.keys(dataBase.nodes)) {
    udsView.addNode(key, dataBase.nodes[key])
    //check devices if device is not in the list remove it
    const ff = dataBase.nodes[key].channel.filter((v) => {
      return dataBase.devices[v] != undefined
    })
    if (ff.length != dataBase.nodes[key].channel.length) {
      dataBase.nodes[key].channel = ff
    }

    for (const to of dataBase.nodes[key].channel) {
      udsView.addLink(key, to)
    }
  }
  //add log
  for (const key of Object.keys(dataBase.logs)) {
    udsView.addLog(key, dataBase.logs[key])
    //check devices if device is not in the list remove it
    const ff = dataBase.logs[key].channel.filter((v) => {
      return dataBase.devices[v] != undefined
    })
    if (ff.length != dataBase.logs[key].channel.length) {
      dataBase.logs[key].channel = ff
    }
    for (const to of dataBase.logs[key].channel) {
      udsView.addLink(to, key)
    }
  }
  //add replay
  for (const key of Object.keys(dataBase.replays)) {
    udsView.addReplay(key, dataBase.replays[key])
    //check devices if device is not in the list remove it
    const ff = dataBase.replays[key].channel.filter((v) => {
      return dataBase.devices[v] != undefined
    })
    if (ff.length != dataBase.replays[key].channel.length) {
      dataBase.replays[key].channel = ff
    }
    for (const to of dataBase.replays[key].channel) {
      udsView.addLink(key, to)
    }
    window.electron.ipcRenderer.invoke('ipc-replay-get-state', key).then((val: any) => {
      const replay = getCeilInstanceAs<UdsReplay>(key)
      if (replay) {
        if (val === 'running') {
          replay.setPlaying(true)
        } else {
          replay.setPlaying(false)
        }
      }
    })
  }
  fitPater()

  layout.on(`max:network`, fitPater)
}

function editNode(data: Tree) {
  layout.addWin(data.type, data.id, {
    name: data.label
  })
  treePop.value[data.id].hide()
}

function removeNode(data: Tree) {
  treePop.value[data.id].hide()
  ElMessageBox.confirm(
    i18next.t('uds.network.dialogs.deleteNodeMessage'),
    i18next.t('uds.network.dialogs.warning'),
    {
      confirmButtonText: i18next.t('uds.network.dialogs.ok'),
      cancelButtonText: i18next.t('uds.network.dialogs.cancel'),
      type: 'warning',
      buttonSize: 'small',
      appendTo: '#networkMain',
      closeOnClickModal: false,
      closeOnPressEscape: false
    }
  )
    .then(() => {
      layout.removeWin(data.id)
      // if (data.type == 'can') {
      //   udsView.removeElement(data.id)
      //   delete udsData.can[data.id]
      // } else if (data.type == 'tester') {
      //   udsView.removeElement(data.id)
      //   delete udsData.tester[data.id]
      // } else if (data.type == 'canAddr') {
      //   delete udsData.canAddr[data.id]
      // }
      layout.removeWin(data.id)
    })
    .catch(() => {
      //do nothing
    })
}

function addNode(type: string, parent?: Tree) {
  // layout.addWin(type, v4())

  if (type == 'interactive') {
    const id = v4()
    if (parent?.type == 'can') {
      const devices: string[] = []
      // for (const key of Object.keys(dataBase.devices)) {
      //   const item = dataBase.devices[key]
      //   if (item.type == 'can' && item.canDevice) {
      //     devices.push(key)
      //   }
      // }

      dataBase.ia[id] = {
        name: i18next.t('uds.network.names.iaTemplate', { label: parent?.label }),
        type: 'can',
        id: id,
        devices: devices, // Add an empty array for devices,
        action: []
      }
      udsView.addIg(id, dataBase.ia[id])
      // add link
      for (const key of devices) {
        udsView.addLink(id, key)
      }
    } else if (parent?.type == 'lin') {
      const devices: string[] = []
      // for (const key of Object.keys(dataBase.devices)) {
      //   const item = dataBase.devices[key]
      //   if (item.type == 'lin' && item.linDevice) {
      //     devices.push(key)
      //   }
      // }
      //lin only one device

      dataBase.ia[id] = {
        name: i18next.t('uds.network.names.iaTemplate', { label: parent?.label }),
        type: 'lin',
        id: id,
        devices: devices, // Add an empty array for devices,
        action: []
      }
      udsView.addIg(id, dataBase.ia[id])
      // add link
      for (const key of devices) {
        udsView.addLink(id, key)
      }
    } else if (parent?.type == 'pwm') {
      const devices: string[] = []
      // for (const key of Object.keys(dataBase.devices)) {
      //   const item = dataBase.devices[key]
      //   if (item.type == 'pwm' && item.pwmDevice) {
      //     devices.push(key)
      //   }
      // }
      dataBase.ia[id] = {
        name: i18next.t('uds.network.names.iaTemplate', { label: parent?.label }),
        type: 'pwm',
        id: id,
        devices: devices, // Add an empty array for devices,
        action: []
      }
      udsView.addIg(id, dataBase.ia[id])
      // add link
      for (const key of devices) {
        udsView.addLink(id, key)
      }
    } else if (parent?.type == 'someip') {
      const devices: string[] = []
      dataBase.ia[id] = {
        name: i18next.t('uds.network.names.iaTemplate', { label: parent?.label }),
        type: 'someip',
        id: id,
        devices: devices, // Add an empty array for devices,
        action: []
      }
      udsView.addIg(id, dataBase.ia[id])
      // add link
      for (const key of devices) {
        udsView.addLink(id, key)
      }
    }
  } else if (type == 'node') {
    const id = v4()
    {
      const devices: string[] = []
      // for (const key of Object.keys(dataBase.devices)) {
      //   const item = dataBase.devices[key]
      //   if (item.type == 'can' && item.canDevice) {
      //     devices.push(key)
      //   }
      // }
      dataBase.nodes[id] = {
        name: i18next.t('uds.network.names.nodeTemplate', {
          count: Object.keys(dataBase.nodes).length + 1
        }),

        id: id,
        channel: devices // Add an empty array for devices,
      }
      udsView.addNode(id, dataBase.nodes[id])
      // add link
      for (const key of devices) {
        udsView.addLink(id, key)
      }
    }
  } else if (type == 'log') {
    const id = v4()
    const devices: string[] = []
    dataBase.logs[id] = {
      name: i18next.t('uds.network.names.loggerTemplate', {
        count: Object.keys(dataBase.logs).length + 1
      }),
      id: id,
      type: 'file',
      format: 'asc',
      path: 'log.txt',
      channel: [],
      method: []
    }
    udsView.addLog(id, dataBase.logs[id])
    // add link
    for (const key of devices) {
      udsView.addLink(id, key)
    }
  } else if (type == 'replay') {
    const id = v4()
    const devices: string[] = []
    dataBase.replays[id] = {
      name: i18next.t('uds.network.names.replayTemplate', {
        count: Object.keys(dataBase.replays).length + 1
      }),
      id: id,
      filePath: '',
      format: 'asc',
      channel: [],
      channelMap: [],
      mode: 'online',
      speedFactor: 1,
      repeatCount: 1
    }
    udsView.addReplay(id, dataBase.replays[id])
    // add link
    for (const key of devices) {
      udsView.addLink(key, id)
    }
  }
  //fit
  fitPater()
}

function scalePaper1(command: 'in' | 'out') {
  if (paper) {
    const step = 0.1 // Scaling step
    const currentScale = paper.scale().sx // Assuming uniform scaling for simplicity

    // Determine the new scale based on the command
    let newScale = command === 'in' ? currentScale + step : currentScale - step

    // Limit the scale to a reasonable range to prevent too much scaling
    newScale = Math.max(0.2, Math.min(5, newScale))

    // Calculate the center of the paper
    const originalSize = paper.getComputedSize()
    const centerX = originalSize.width / 2
    const centerY = originalSize.height / 2

    // Calculate the new origin to keep the center
    const newOriginX = paper.translate().tx - centerX * (newScale - currentScale)
    const newOriginY = paper.translate().ty - centerY * (newScale - currentScale)

    // Update the origin and scale
    paper.translate(newOriginX, newOriginY)
    paper.scale(newScale, newScale)
  }
}

function fitPater() {
  nextTick(() => {
    if (paper) {
      paper.transformToFitContent({
        horizontalAlign: 'middle',
        verticalAlign: 'middle',
        padding: 50,
        maxScaleX: 1.5,
        maxScaleY: 1.5
      })
    }
  })
}

onUnmounted(() => {
  udsView.clear()
  layout.off(`max:network`, fitPater)
  paper.remove()
  window.logBus.off('replayStop', replayCallback)
  window.logBus.off('replayProgress', replayCallback)
  document.removeEventListener('keydown', handleKeyboardEvent)
})
</script>
<style>
.is-panning {
  cursor: move;
}

.tree-popover {
  --el-popover-padding: 0px !important;
  min-width: 75px !important;
  width: 75px !important;
}
</style>
<style scoped>
.tree-item {
  padding: 2px;
  padding-left: 6px;
  margin: 2px;
  border-radius: 2px;
  font-size: 12px;
}

.tree-item:hover {
  background-color: var(--el-color-info-light-8);
  cursor: pointer;
}

.config {
  max-height: 500px;
  overflow-y: auto;
}

.my-header {
  margin-top: 10px;
  display: flex;
  align-items: center;
  /* 垂直居中对齐 */
}

.my-header svg {
  margin-right: 10px;
  /* 在Icon和h4之间增加一些间距 */
}

.vm {
  display: flex;
  align-items: center;
  /* 垂直居中对齐 */
}

.my-header h4 {
  margin: 0;
  /* 移除h4的默认外边距 */
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
  width: v-bind(leftWidth + 1 +'px');
  height: v-bind(h + 'px');
  z-index: 0;
  border-right: solid 1px var(--el-border-color);
}

.shift:hover {
  border-right: solid 4px var(--el-color-primary);
}

.shift:active {
  border-right: solid 4px var(--el-color-primary);
}

.tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding-right: 8px;
}

.right {
  position: absolute;
  top: 2px;
  left: v-bind(leftWidth + 5 + 'px');
  width: v-bind(w - leftWidth -8 + 'px');
  height: v-bind(h-7 + 'px');
  z-index: 0;
}

.w {
  height: v-bind(h + 'px');
  width: v-bind(w + 'px');
  position: relative;
}

.help {
  bottom: 0px;
  right: 0px;
  z-index: 2;
  position: absolute;
  margin: 10px;
  color: #909399;
  font-size: 20px;
}

.helpButton {
  margin: 2px;
}

.helpButton:hover {
  cursor: pointer;
  color: var(--el-color-primary);
}

.tree-label {
  display: flex;
  align-items: center;
}

.tree-add {
  color: var(--el-color-primary);
}

.tree-add:hover {
  color: var(--el-color-primary-dark-2);
  cursor: pointer;
}

.tree-remove {
  color: var(--el-color-danger);
}

.tree-remove:hover {
  color: var(--el-color-danger-dark-2);
  cursor: pointer;
}

.treeLabel {
  display: inline-block;
  white-space: nowrap;
  /* 保证内容不会换行 */
  overflow: hidden;
  /* 超出容器部分隐藏 */
  text-overflow: ellipsis;
  /* 使用省略号表示超出部分 */
  width: v-bind(leftWidth - 110 + 'px') !important;
}

.isTop {
  font-weight: bold;
}

.context-menu {
  position: absolute;
  z-index: 100;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  padding: 4px 0;
  min-width: 120px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  color: var(--el-text-color-regular);
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background-color: var(--el-fill-color-light);
}

.context-menu-item.danger {
  color: var(--el-color-danger);
}

.context-menu-item.danger:hover {
  background-color: var(--el-color-danger-light-9);
}

.menu-icon {
  margin-right: 8px;
  font-size: 16px;
}
</style>
