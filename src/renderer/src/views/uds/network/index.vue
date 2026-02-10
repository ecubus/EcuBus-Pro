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
        <div id="networkGraph" />
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

const treePop = ref<Record<string, any>>({})
const project = useProjectStore()

watch([w, h, leftWidth], () => {
  paper?.setDimensions(w.value - leftWidth.value - 5, h.value - 5)
})

const loading = ref(true)

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
</style>
