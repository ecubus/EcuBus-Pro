<template>
  <div v-loading="loading" class="main">
    <div class="left">
      <el-scrollbar :height="h + 'px'">
        <el-tree
          ref="treeRef"
          node-key="id"
          default-expand-all
          :data="tData"
          highlight-current
          :expand-on-click-node="false"
          @node-click="nodeClick"
        >
          <template #default="{ node, data }">
            <div class="tree-node">
              <span
                :class="{
                  isTop: node.level === 1,

                  treeLabel: true
                }"
                >{{ node.label }}
              </span>
              <el-button
                v-if="data.append"
                type="primary"
                link
                :disabled="data.disabled || globalStart"
                @click.stop="addNewDevice(data)"
              >
                <Icon :icon="circlePlusFilled" />
              </el-button>

              <el-button
                v-else-if="node.parent?.data.append"
                type="danger"
                link
                :disabled="data.disabled || globalStart"
                @click.stop="removeDevice(data)"
              >
                <Icon :icon="removeIcon" />
              </el-button>
            </div>
          </template>
        </el-tree>
      </el-scrollbar>
    </div>
    <div :id="`${winKey}Shift`" class="shift" />
    <div class="right">
      <div v-if="activeTree">
        <someipVue
          v-if="activeTree.type"
          :index="activeTree.id"
          :type="activeTree.type"
          :height="h"
          @change="nodeChange"
        >
        </someipVue>
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
  onMounted,
  onUnmounted,
  provide,
  ref,
  toRef,
  watch
} from 'vue'
import { Icon } from '@iconify/vue'
import { type FormRules, type FormInstance, ElMessageBox, ElMessage } from 'element-plus'
import circlePlusFilled from '@iconify/icons-ep/circle-plus-filled'
import removeIcon from '@iconify/icons-ep/remove'
import { useDataStore } from '@r/stores/data'
// import testerCanVue from './config/tester/testercan.vue'
import { Layout } from '../layout'
import { cloneDeep } from 'lodash'
import { v4 } from 'uuid'
import { HardwareType } from 'nodeCan/uds'
import { useProjectStore } from '@r/stores/project'
import { useGlobalStart } from '@r/stores/runtime'
import someipVue from './someip.vue'

const loading = ref(false)
const activeTree = ref<tree>()
const props = defineProps<{
  height: number
  width: number
}>()
const winKey = 'soa'
const h = toRef(props, 'height')
const w = toRef(props, 'width')
const leftWidth = ref(200)
const treeRef = ref()
const globalData = useDataStore()
const project = useProjectStore()
const rightWidth = computed(() => {
  return w.value - leftWidth.value
})
const rightHeight = computed(() => {
  return h.value - 56
})
// provide('width', rightWidth)
// provide('height', rightHeight)

function nodeClick(data: tree, node: any) {
  if (activeTree.value?.id == data.id) {
    return
  }
  activeTree.value = undefined
  nextTick(() => {
    if (node.parent?.data.append == true) {
      activeTree.value = data
    }
  })
}
function removeDevice(data: tree) {
  ElMessageBox.confirm('Are you sure to delete this SOA config?', 'Warning', {
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    type: 'warning',
    buttonSize: 'small',
    appendTo: `#win${winKey}`
  }).then(() => {
    if (data.type == 'someip') {
      delete globalData.someip[data.id]
      treeRef.value?.remove(data.id)
      activeTree.value = undefined
      //close relative window
      layout.removeWin(`${data.id}_services`, true)
      layout.removeWin(`${data.id}_sequence`, true)
    }
  })
}
function generateUniqueName(type: 'someip' | 'dds'): string {
  let index = 0
  let name = `${type}_${index}`

  if (type == 'someip') {
    // 检查是否存在同名配置
    while (Object.values(globalData.someip).some((soa) => soa.name === name)) {
      index++
      name = `${type}_${index}`
    }
  }

  return name
}
function addNewDevice(node: tree) {
  activeTree.value = undefined
  const id = v4()

  // 使用新的生成唯一名称的函数
  const name = generateUniqueName(node.type)

  treeRef.value?.append(
    {
      label: name,
      append: false,
      id: id,
      type: node.type
    },
    node.id
  )
  if (node.type == 'someip') {
    globalData.someip[id] = {
      id: id,
      name: name,
      services: [],
      application: {
        name: name,
        id: ''
      },
      device: ''
    }
  }

  nextTick(() => {
    activeTree.value = treeRef.value?.getNode(id).data
    treeRef.value.setCurrentKey(id)
  })
}
function nodeChange(id: string, name: string) {
  //change tree stuff
  const node = treeRef.value?.getNode(id)
  if (node) {
    node.data.label = name
    layout.changeWinName(`${id}_services`, name)
    layout.changeWinName(`${id}_sequence`, name)
  }
}

interface tree {
  label: string
  type: 'someip' | 'dds'
  append: boolean
  id: string
  children?: tree[]
  disabled?: boolean
}
const tData = ref<tree[]>([])
const globalStart = useGlobalStart()

function buildTree() {
  const t: tree[] = []
  const can: tree = {
    label: 'SOME/IP',
    type: 'someip',
    append: true,
    id: 'CAN',
    children: []
  }
  for (const key in globalData.someip) {
    can.children?.push({
      label: globalData.someip[key].name,
      type: 'someip',
      append: false,
      id: key
    })
  }
  t.push(can)

  const eth: tree = {
    label: 'DDS',
    type: 'dds',
    append: true,
    id: 'DDS',
    children: [],
    disabled: true
  }

  t.push(eth)

  tData.value = t
}

const layout = inject('layout') as Layout
onMounted(() => {
  window.jQuery(`#${winKey}Shift`).resizable({
    handles: 'e',
    // resize from all edges and corners
    resize: (e, ui) => {
      leftWidth.value = ui.size.width
    },
    maxWidth: 400,
    minWidth: 150
  })

  nextTick(() => {
    buildTree()
  })
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

.tree-add {
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
}

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
  width: v-bind(leftWidth - 80 + 'px') !important;
}
</style>
