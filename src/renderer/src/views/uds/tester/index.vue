<template>
  <div v-loading="loading" class="main">
    <div class="left">
      <div class="left-toolbar">
        <el-dropdown :disabled="globalStart" @command="handleImport">
          <el-button size="small" link :disabled="globalStart">
            <Icon :icon="uploadIcon" style="margin-right: 2px" />
            Import
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="ecb">
                <Icon :icon="documentIcon" style="margin-right: 4px" />
                ECB File
              </el-dropdown-item>
              <el-dropdown-item command="odx">
                <Icon :icon="folderOpenedIcon" style="margin-right: 4px" />
                ODX / PDX File
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <el-scrollbar :height="h - 28 + 'px'">
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
                @click.stop="removeDevice(data.id)"
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
        <testerCanVue
          v-if="activeTree.type"
          :index="activeTree.id"
          :type="activeTree.type"
          :height="h"
          @change="nodeChange"
        >
        </testerCanVue>
      </div>
    </div>

    <el-dialog
      v-if="importDialogVisible"
      v-model="importDialogVisible"
      :title="importDialogTitle"
      width="480"
      :append-to="`#win${winKey}`"
      align-center
      destroy-on-close
    >
      <div v-if="importItems.length > 0">
        <el-checkbox
          v-model="importSelectAll"
          :indeterminate="importIndeterminate"
          style="margin-bottom: 8px"
          @change="handleSelectAllChange"
        >
          Select All
        </el-checkbox>
        <el-divider style="margin: 4px 0 8px 0" />
        <el-scrollbar max-height="300px">
          <el-checkbox-group v-model="importSelected">
            <div v-for="item in importItems" :key="item.id" class="import-item">
              <el-checkbox :value="item.id">
                <span>{{ item.label }}</span>
                <el-tag size="small" type="info" style="margin-left: 8px">{{ item.type }}</el-tag>
              </el-checkbox>
            </div>
          </el-checkbox-group>
        </el-scrollbar>
      </div>
      <el-empty v-else description="No testers found in this file" :image-size="80" />
      <template #footer>
        <el-button size="small" @click="importDialogVisible = false">Cancel</el-button>
        <el-button
          size="small"
          type="primary"
          :disabled="importSelected.length === 0"
          @click="confirmImport"
        >
          Import ({{ importSelected.length }})
        </el-button>
      </template>
    </el-dialog>
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
import uploadIcon from '@iconify/icons-ep/upload'
import documentIcon from '@iconify/icons-ep/document'
import folderOpenedIcon from '@iconify/icons-ep/folder-opened'
import { useDataStore } from '@r/stores/data'
import testerCanVue from './testercan.vue'
import { Layout } from '../layout'
import { cloneDeep } from 'lodash'
import { v4 } from 'uuid'
import { applyOdxImportedSubfuncParamFlags, HardwareType } from 'nodeCan/uds'
import type { TesterInfo } from 'nodeCan/tester'
import { useProjectStore } from '@r/stores/project'
import { useGlobalStart } from '@r/stores/runtime'
import i18next from 'i18next'

const loading = ref(false)
const activeTree = ref<tree>()
const props = defineProps<{
  height: number
  width: number
}>()
const winKey = 'tester'
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
function removeDevice(id: string) {
  ElMessageBox.confirm(
    i18next.t('uds.tester.dialogs.deleteTesterMessage'),
    i18next.t('uds.tester.dialogs.warning'),
    {
      confirmButtonText: i18next.t('uds.tester.dialogs.ok'),
      cancelButtonText: i18next.t('uds.tester.dialogs.cancel'),
      type: 'warning',
      buttonSize: 'small',
      appendTo: `#win${winKey}`
    }
  )
    .then(() => {
      window.electron.ipcRenderer
        .invoke(
          'ipc-delete-tester',
          project.projectInfo.path,
          project.projectInfo.name,
          cloneDeep(globalData.tester[id])
        )
        .finally(() => {
          delete globalData.tester[id]
          treeRef.value?.remove(id)
          activeTree.value = undefined
          //close relative window
          layout.removeWin(`${id}_services`, true)
          layout.removeWin(`${id}_sequence`, true)
        })
    })
    .catch(() => {
      null
    })
}
function generateUniqueName(type: HardwareType): string {
  let index = 0
  let name = `Tester_${type}_${index}`

  // 检查是否存在同名配置
  while (Object.values(globalData.tester).some((tester) => tester.name === name)) {
    index++
    name = `Tester_${type}_${index}`
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

  globalData.tester[id] = {
    id: id,
    name: name,
    type: node.type,
    script: '',
    targetDeviceId: '',
    seqList: [],
    address: [],
    udsTime: {
      pTime: 2000,
      pExtTime: 5000,
      s3Time: 5000,
      testerPresentEnable: false
    },
    allServiceList: {}
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
  type: HardwareType
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
    label: i18next.t('uds.tester.tree.canInterface'),
    type: 'can',
    append: true,
    id: 'CAN',
    children: []
  }
  for (const key in globalData.tester) {
    if (globalData.tester[key].type == 'can') {
      can.children?.push({
        label: globalData.tester[key].name,
        type: 'can',
        append: false,
        id: key
      })
    }
  }
  t.push(can)
  const lin: tree = {
    label: i18next.t('uds.tester.tree.linInterface'),
    type: 'lin',
    append: true,
    id: 'LIN',
    children: [],
    disabled: false
  }
  for (const key in globalData.tester) {
    if (globalData.tester[key].type == 'lin') {
      lin.children?.push({
        label: globalData.tester[key].name,
        type: 'lin',
        append: false,
        id: key
      })
    }
  }
  t.push(lin)
  const eth: tree = {
    label: i18next.t('uds.tester.tree.ethInterface'),
    type: 'eth',
    append: true,
    id: 'ETH',
    children: [],
    disabled: false
  }
  for (const key in globalData.tester) {
    if (globalData.tester[key].type == 'eth') {
      eth.children?.push({
        label: globalData.tester[key].name,
        type: 'eth',
        append: false,
        id: key
      })
    }
  }
  t.push(eth)

  tData.value = t
}

interface ImportItem {
  id: string
  label: string
  type: HardwareType
  tester: TesterInfo
}

const importDialogVisible = ref(false)
const importKind = ref<'ecb' | 'odx' | null>(null)
const importDialogTitle = ref('Import Tester')
const importItems = ref<ImportItem[]>([])
const importSelected = ref<string[]>([])
const importSelectAll = ref(false)
const importIndeterminate = computed(
  () => importSelected.value.length > 0 && importSelected.value.length < importItems.value.length
)

watch(importSelected, (val) => {
  importSelectAll.value = val.length === importItems.value.length && val.length > 0
})

function handleSelectAllChange(val: boolean) {
  importSelected.value = val ? importItems.value.map((i) => i.id) : []
}

async function handleImport(command: string) {
  if (command === 'ecb') {
    await importFromEcb()
  } else if (command === 'odx') {
    await importFromOdx()
  }
}

async function importFromEcb() {
  const res = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: 'Import Tester from ECB',
    properties: ['openFile'],
    filters: [
      { name: 'EcuBus-Pro', extensions: ['ecb'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (res.canceled || !res.filePaths?.length) return

  loading.value = true
  try {
    const content = await window.electron.ipcRenderer.invoke('ipc-fs-readFile', res.filePaths[0])
    const parsed = JSON.parse(content)
    const testers: Record<string, TesterInfo> = parsed?.data?.tester || parsed?.tester || {}

    const items: ImportItem[] = []
    for (const [, tester] of Object.entries(testers)) {
      items.push({
        id: v4(),
        label: tester.name,
        type: tester.type,
        tester: tester
      })
    }

    if (items.length === 0) {
      ElMessage({
        message: 'No testers found in the ECB file',
        type: 'warning',
        appendTo: `#win${winKey}`
      })
      return
    }

    importDialogTitle.value = 'Import from ECB'
    importKind.value = 'ecb'
    importItems.value = items
    importSelected.value = items.map((i) => i.id)
    importSelectAll.value = true
    importDialogVisible.value = true
  } catch (e: any) {
    ElMessage({
      message: 'Failed to read ECB file: ' + (e.message || e),
      type: 'error',
      appendTo: `#win${winKey}`
    })
  } finally {
    loading.value = false
  }
}

async function importFromOdx() {
  const res = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: 'Import Tester from ODX/PDX',
    properties: ['openFile'],
    filters: [
      { name: 'ODX/PDX Files', extensions: ['odx', 'pdx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (res.canceled || !res.filePaths?.length) return

  loading.value = true
  try {
    const result = await window.electron.ipcRenderer.invoke(
      'ipcOdxParseTesterInfo',
      '',
      res.filePaths[0],
      true
    )

    if (result.error !== 0) {
      ElMessage({
        message: 'ODX parse error: ' + (result.message || 'Unknown error'),
        type: 'error',
        appendTo: `#win${winKey}`
      })
      return
    }

    const items: ImportItem[] = []
    for (const [containerName, layers] of Object.entries(result.data as Record<string, any>)) {
      for (const [layerName, tester] of Object.entries(layers as Record<string, any>)) {
        items.push({
          id: v4(),
          label: containerName !== layerName ? `${containerName} / ${layerName}` : layerName,
          type: (tester as TesterInfo).type,
          tester: tester as TesterInfo
        })
      }
    }

    if (items.length === 0) {
      ElMessage({
        message: 'No tester configurations found in the ODX/PDX file',
        type: 'warning',
        appendTo: `#win${winKey}`
      })
      return
    }

    importDialogTitle.value = 'Import from ODX/PDX'
    importKind.value = 'odx'
    importItems.value = items
    importSelected.value = items.map((i) => i.id)
    importSelectAll.value = true
    importDialogVisible.value = true
  } catch (e: any) {
    ElMessage({
      message: 'Failed to parse ODX/PDX file: ' + (e.message || e),
      type: 'error',
      appendTo: `#win${winKey}`
    })
  } finally {
    loading.value = false
  }
}

function confirmImport() {
  const selected = importItems.value.filter((i) => importSelected.value.includes(i.id))
  let count = 0

  for (const item of selected) {
    const newId = v4()
    const tester = cloneDeep(item.tester)
    tester.id = newId
    tester.name = generateUniqueImportName(tester.name, tester.type)
    if (importKind.value === 'odx') {
      applyOdxImportedSubfuncParamFlags(tester, window.serviceDetail)
    }

    globalData.tester[newId] = tester

    const parentId = tester.type === 'can' ? 'CAN' : tester.type === 'lin' ? 'LIN' : 'ETH'
    treeRef.value?.append(
      {
        label: tester.name,
        append: false,
        id: newId,
        type: tester.type
      },
      parentId
    )
    count++
  }

  importDialogVisible.value = false
  importKind.value = null
  ElMessage({
    message: `Imported ${count} tester(s)`,
    type: 'success',
    appendTo: `#win${winKey}`
  })
}

function generateUniqueImportName(baseName: string, type: HardwareType): string {
  let name = baseName
  let suffix = 1
  while (Object.values(globalData.tester).some((t) => t.name === name)) {
    name = `${baseName}_${suffix}`
    suffix++
  }
  return name
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

.left-toolbar {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 8px;
  border-bottom: 1px solid var(--el-border-color);
}

.import-item {
  padding: 2px 0;
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
