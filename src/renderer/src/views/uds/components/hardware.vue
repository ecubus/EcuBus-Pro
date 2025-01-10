<template>
    <div class="main" v-loading="loading">
        <div class="left">
            <el-scrollbar :height="h + 'px'">
                <el-tree ref="treeRef" node-key="id" default-expand-all :data="tData" :expand-on-click-node="false"
                    highlight-current @node-click="nodeClick">
                    <template #default="{ node, data }">
                        <div class="tree-node">
                            <span :class="{
                                isTop: node.level === 1,

                                treeLabel: true
                            }">{{ node.label }}
                            </span>
                            <el-button :disabled="globalStart" type="primary" link v-if="data.append"
                                @click.stop="addNewDevice(data)">
                                <Icon class="tree-add" :icon="circlePlusFilled" />
                            </el-button>

                            <el-button :disabled="globalStart" type="danger" link v-else-if="node.parent?.data.append"
                                @click.stop="removeDevice(data.id)">
                                <Icon class="tree-delete" :icon="removeIcon" />
                            </el-button>

                        </div>
                    </template>
                </el-tree>
            </el-scrollbar>
        </div>
        <div class="shift" :id="`${winKey}Shift`" />
        <div class="right">
            <div v-if="activeTree">
                <canNodeVue v-if="activeTree.type == 'can'" v-model="dataModify" :index="activeTree.id"
                    :vendor="activeTree.vendor" @change="nodeChange" />
                <ethNodeVue v-else-if="activeTree.type == 'eth'" v-model="dataModify" :index="activeTree.id"
                    :vendor="activeTree.vendor" @change="nodeChange" />
                <LinNodeVue v-else-if="activeTree.type == 'lin'" v-model="dataModify" :index="activeTree.id"
                    :vendor="activeTree.vendor" @change="nodeChange" />
            </div>
        </div>

    </div>
</template>

<script lang="ts" setup>
import { Ref, computed, inject, nextTick, onBeforeMount, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
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

const loading = ref(false)
const activeTree = ref<tree>()
const props = defineProps<{
    height: number
    width: number
    deviceId?: string
}>()
const winKey = 'hardware'
const h = toRef(props, 'height')
const w = toRef(props, 'width')
const leftWidth = ref(200)
const dataModify = ref(false)
const treeRef = ref()
const devices = useDataStore()
const globalStart = toRef(window, 'globalStart')
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
            }).then(() => {
                dataModify.value = false
                done()
            }).catch(() => {
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
    }).then(() => {
        if (id == activeTree.value?.id) {
            dataModify.value = false
            activeTree.value = undefined
        }
        delete devices.devices[id]
        treeRef.value?.remove(id)

    }).catch(() => {
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
        }).then(() => {
            dataModify.value = false
            done()
        }).catch(() => {
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

        treeRef.value?.append({ label: name, append: false, id: id, vendor: activeTree.value?.vendor, type: activeTree.value?.type }, activeTree.value?.id)
    }
    activeTree.value = undefined
}

interface tree {
    label: string
    vendor: CanVendor
    type?: "can" | 'lin' | 'eth'
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
    node.children?.push(canTree)
    for (const [key, value] of Object.entries(devices.devices)) {
        if (value.type == 'can' && value.canDevice && value.canDevice.vendor == vendor) {
            canTree.children?.push({
                label: value.canDevice.name,
                append: false,
                vendor: vendor,
                id: key,
                type: 'can',
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
                    type: 'eth',
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
    if (vendor == 'peak') {
        node.children?.push(linTree)
    }
    for (const [key, value] of Object.entries(devices.devices)) {
        if (value.type == 'lin' && value.linDevice && value.linDevice.vendor == vendor) {
            linTree.children?.push({
                label: value.linDevice.name,
                append: false,
                vendor: vendor,
                id: key,
                type: 'lin',
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
function buildTree() {
    const t: tree[] = []
    const zlg: tree = {
        label: 'ZLG',
        vendor: 'zlg',
        append: false,
        id: 'ZLG',
        children: []
    }
    t.push(zlg)
    addSubTree('zlg', zlg)
    const peak: tree = {
        label: 'PEAK',
        append: false,
        id: 'PEAK',
        vendor: 'peak',
        children: []
    }
    t.push(peak)
    addSubTree('peak', peak)
    const kvaser: tree = {
        label: 'KVASER',
        vendor: 'kvaser',
        append: false,
        id: 'KVASER',

        children: []
    }
    t.push(kvaser)
    addSubTree('kvaser', kvaser)
    const simulate: tree = {
        label: 'Simulate',
        vendor: 'simulate',
        append: false,
        id: 'Simulate',

        children: []
    }
    t.push(simulate)
    addSubTree('simulate', simulate)


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
        handles:'e',
        // resize from all edges and corners
        resize: (e, ui) => {

            leftWidth.value = ui.size.width
           
        },
        maxWidth:400,
        minWidth:150,
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
</style>