<template>
    <div class="uds-graph">
        <div style="justify-content: space-between;display: flex;align-items: center;gap:0px;padding-left: 5px;padding: 1px"
            class="border-bottom">
            <div style="display: flex;align-items: center;gap:4px;">
                <el-button-group>
                    <el-button link type="primary" :class="{ 'pause-active': hideTree }" @click="treeHide">
                        <Icon :icon="hideIcon" />
                    </el-button>

                    <el-tooltip effect="light" :content="isPaused ? 'Resume' : 'Pause'" placement="bottom">
                        <el-button :type="isPaused ? 'success' : 'warning'" link :class="{ 'pause-active': isPaused }" @click="isPaused = !isPaused">
                            <Icon :icon="isPaused ? playIcon : pauseIcon" />
                        </el-button>

                    </el-tooltip>
                </el-button-group>
                <el-divider direction="vertical"></el-divider>
                <el-button-group>
                    <el-tooltip effect="light" content="Add Variables" placement="bottom">
                        <el-button link type="primary" @click="addNode" disabled>
                            <Icon :icon="addIcon" />
                        </el-button>

                    </el-tooltip>
                    <el-tooltip effect="light" content="Add Signals" placement="bottom">
                        <el-button link type="primary" @click="addSignal">
                            <Icon :icon="waveIcon" />
                        </el-button>

                    </el-tooltip>
                </el-button-group>
            </div>
            <span style="margin-right: 10px;font-size: 12px;color: var(--el-text-color-regular)">
                Time: {{ time }}s
            </span>
        </div>
        <div>
            <div class="main">
                <div class="left" v-show="!hideTree">
                    <el-scrollbar :height="height">
                        <el-tree highlight-current node-key="id" :data="filteredTreeData" ref="treeRef"
                            :props="defaultProps" empty-text="Add" @node-click="handleNodeClick">
                            <template #default="{ data }">
                                <el-popover :ref="e => popoverRefs[data.id] = e" placement="bottom-start" :width="100"
                                    trigger="contextmenu" popper-class="node-menu">
                                    <template #reference>
                                        <span class="tree-node">
                                            <el-checkbox v-model="data.enable"
                                                @change="(val) => handleCheckChange(data, val)"
                                                class="custom-checkbox" />
                                            <span class="color-block" :style="{ backgroundColor: data.color }" />
                                            <span class="node-label">{{ data.name }}</span>
                                        </span>
                                    </template>
                                    <div class="menu-items">
                                        <div class="menu-item warning" @click="handleEdit(data, $event)">
                                            <Icon :icon="editIcon" />
                                            <span>Edit</span>
                                        </div>
                                        <div class="menu-item danger" @click="handleDelete(data, $event)">
                                            <Icon :icon="deleteIcon" />
                                            <span>Delete</span>
                                        </div>
                                    </div>
                                </el-popover>
                            </template>
                        </el-tree>
                    </el-scrollbar>
                </div>
                <div class="shift" id="graphShift" v-show="!hideTree" />
                <div class="right" :style="{ left: hideTree ? '0px' : leftWidth + 5 + 'px' }">
                    <div class="canvas-container" :style="{ width: canvasWidth + 'px', height: height + 'px' }">
                        <div v-if="isZoomY" style="position: absolute;top:5px;right:3px;color:var(--el-color-primary);">
                            <Icon :icon="zoomInIcon" />
                        </div>
                        <div v-if="isDragging"
                            style="position: absolute;top:5px;right:3px;color:var(--el-color-primary);">
                            <Icon :icon="dragVerticalIcon" />
                        </div>
                        <div v-for="(chart, index) in enabledCharts" :key="chart.id" :style="{
                            height: `${(height - (enabledCharts.length - 1) * 5) / enabledCharts.length}px`,
                            marginTop: index === 0 ? '0' : '5px'
                        }" class="chart-container">
                            <div :id="`chart-${chart.id}`" style="width: 100%; height: 100%;" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <el-dialog v-model="signalDialogVisible" v-if="signalDialogVisible" title="Add Signal" width="95%" align-center
            :append-to="appendId">
            <signal :height="tableHeight" :width="width" @add-signal="handleAddSignal" />
        </el-dialog>

        <el-dialog v-model="editDialogVisible" v-if="editDialogVisible && editingNode" title="Edit Signal" width="500px"
            align-center :append-to="appendId">
            <edit-signal :height="tableHeight" :node="editingNode" @save="handleEditSave" @cancel="handleEditCancel" />
        </el-dialog>
    </div>
</template>
<script lang="ts" setup>
import * as echarts from 'echarts'
import pauseIcon from '@iconify/icons-material-symbols/pause-circle-outline'
import playIcon from '@iconify/icons-material-symbols/play-circle-outline'
import hideIcon from '@iconify/icons-material-symbols/hide'
import addIcon from '@iconify/icons-material-symbols/add-circle-outline'
import deleteIcon from '@iconify/icons-material-symbols/delete-outline'
import editIcon from '@iconify/icons-material-symbols/edit-outline'
import zoomInIcon from '@iconify/icons-material-symbols/zoom-in'
import dragVerticalIcon from '@iconify/icons-material-symbols/drag-pan'
import waveIcon from '@iconify/icons-material-symbols/airwave-rounded'
import { ref, onMounted, computed, h, onUnmounted, watch, nextTick } from 'vue';
import { Icon } from '@iconify/vue'
import { useDataStore } from '@r/stores/data';
import { GraphBindSignalValue, GraphNode } from 'src/preload/data';
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECBasicOption } from 'echarts/types/dist/shared'
import { ElNotification, formatter } from 'element-plus'
import signal from './components/signal.vue'
import editSignal from './components/editSignal.vue'

use([LineChart, GridComponent, DataZoomComponent, CanvasRenderer])

const isPaused = ref(false);
const hideTree = ref(false);
const leftWidth = ref(200)
const props = defineProps<{
    height: number
    width: number
    editIndex?: string
}>()
const popoverRefs = ref<Record<string, any>>({})
const graphs = useDataStore().graphs
const appendId = computed(() => props.editIndex ? `#win${props.editIndex}` : '#wingraph')
const height = computed(() => props.height - 22)
const tableHeight = computed(() => height.value * 2 / 3)
// 修改测试数据
const filteredTreeData = ref<GraphNode<GraphBindSignalValue>[]>([])
const treeRef = ref()
const time=ref(0)



const defaultProps = {
    label: 'label',
}

const handleNodeClick = (data: any) => {
    // console.log(data)
}

function treeHide() {
    hideTree.value = !hideTree.value;
    // 如果需要在隐藏/显示时保存之前的宽度，可以添加相关逻辑
}

function handleCheckChange(data: GraphNode<GraphBindSignalValue>, checked: boolean) {
    graphs[data.id].enable = checked
    filteredTreeData.value.forEach(node => {
        if (node.id === data.id) {
            node.enable = checked
        }
    })
}

const addNode = () => {
    // 这里添加你的节点添加逻辑
    console.log('Add node clicked')
}

// 添加画布宽度计算
const canvasWidth = computed(() => {
    return hideTree.value ? props.width : props.width - leftWidth.value - 5
})



const handleEdit = (data: GraphNode<GraphBindSignalValue>, event: Event) => {
    popoverRefs.value[data.id]?.hide()
    editingNode.value = { ...data }
    editDialogVisible.value = true
}

const handleEditSave = (updatedNode: GraphNode<GraphBindSignalValue>) => {
    const index = filteredTreeData.value.findIndex(v => v.id === updatedNode.id)
    if (index !== -1) {
        filteredTreeData.value[index] = updatedNode
        graphs[updatedNode.id] = updatedNode

        // 更新图表配置
        chartInstances[updatedNode.id].setOption({
            yAxis: {
                ...updatedNode.yAxis,
                // 更新轴标签颜色
                nameTextStyle: {
                    color: updatedNode.color
                }
            },
            xAxis: updatedNode.xAxis,
            series: {
                ...updatedNode.series,
                // 更新线条颜色
                lineStyle: {
                    color: updatedNode.color
                },
                itemStyle: {
                    color: updatedNode.color
                }
            }
        })

        // 如果有缓存的数据，使用新的颜色重绘
        if (chartDataCache[updatedNode.id]?.length > 0) {
            chartInstances[updatedNode.id].setOption({
                series: {
                    data: chartDataCache[updatedNode.id]
                }
            })
        }
    }

    editDialogVisible.value = false
    editingNode.value = null
}

const handleEditCancel = () => {
    editDialogVisible.value = false
    editingNode.value = null
}
const updateTime = () => {
    if(isPaused.value){
        return
    }
    // 更新x轴范围
    let maxX = 5
    let minX = 0
    Object.values(chartDataCache).forEach((v) => {
        const lastOne = v[v.length - 1]
        if(lastOne){
            const val = lastOne[0] as number
            if (val > maxX) {
                maxX = val
            }
        }
        // 获取每个图表数据的最小x值
        const firstOne = v[0]
        if(firstOne){
            const val = firstOne[0] as number
            if (val < minX || minX === 0) {
                minX = val
            }
        }
    })
    const ts = (Date.now() - window.startTime) / 1000
    if(ts>maxX){
        maxX=ts
    }
   
    time.value = maxX
    maxX = Math.ceil(maxX) + 5
    minX = Math.floor(minX)
  
    enabledCharts.value.forEach(c => {
        chartInstances[c.id].setOption({
            xAxis: {
                min: minX,
                max: maxX
            }
        })
    })
}
watch(() => window.globalStart.value, (val) => {

    if (val) {
        //clear cache
        Object.keys(chartDataCache).forEach(key => {
            chartDataCache[key] = []
        })
        //clear all charts data and set start to 0
        enabledCharts.value.forEach(c => {
            chartInstances[c.id].setOption({
                series: {
                    data: []
                },
                xAxis: {
                    min: 0,
                    max: 10
                }
            })
        })
        if (timer) {
            clearInterval(timer)
        }
        timer = setInterval(updateTime, 500)
    } else {
        clearInterval(timer)
    }

})

// 添加数据缓存
const chartDataCache: Record<string, (number | string)[][]> = {}

function dataUpdate(key: string, datas: (number | string)[][]) {
    if (isPaused.value) {
        return
    }


    // 获取对应的echarts实例
    const chart = chartInstances[key]
    if (!chart) return

    // 初始化或获取缓存数据
    if (!chartDataCache[key]) {
        chartDataCache[key] = []
    }

    // 添加新数据
    chartDataCache[key] = chartDataCache[key].concat(datas)

    // 如果数据超过1000个点，移除最早的数据
    if (chartDataCache[key].length > 1000) {
        chartDataCache[key].splice(0, chartDataCache[key].length - 1000)
    }
  

    // 更新图表
    chart.setOption({
        series: {
            data: chartDataCache[key]
        }
    })


}

const enabledCharts = computed(() => {
    return Object.values(filteredTreeData.value)
        .filter(node => node.enable)
})

// 修改模拟数据生成函数，返回二维数组格式
const generateMockData = (count: number) => {
    return Array.from({ length: count }, (_, i) => [
        i * 0.1,  // 时间
        Math.sin(i * 0.1) * 5  // 值
    ])
}

// 添加图表实例管理
const chartInstances: Record<string, echarts.ECharts> = {}

// 替换拖拽相关的状态和处理函数
const isDragging = ref(false)
const isZoomY = ref(false)
const inYArea = ref(false)
let timer

// 修改初始化图表实例函数
const initChart = (chartId: string) => {
    const dom = document.getElementById(`chart-${chartId}`)

    if (dom) {

        const chart = echarts.init(dom)
        chartInstances[chartId] = chart

        // 使用 echarts 事件
        chart.on('mousedown', (params) => {

            if (params.componentType == 'yAxis' || params.componentType == 'series') {
                if (params.event?.event.ctrlKey) {
                    isDragging.value = false
                } else {
                    isDragging.value = true
                }


            }
        })
        chart.on('dataZoom', (event: any) => {
            let dz = { start: event.start, end: event.end };
            if (event.batch)
                dz = { start: event.batch[0].start, end: event.batch[0].end };
            //update all charts except the current one
            enabledCharts.value.forEach(c => {
                if (c.id !== chartId) {
                    chartInstances[c.id].setOption({
                        dataZoom: [
                            {
                                start: dz.start,
                                end: dz.end
                            }
                        ]
                    })
                }
            })
        });
        chart.on('mouseover', (params) => {
            if (params.componentType == 'yAxis' || params.componentType == 'series') {
                inYArea.value = true

                if (params.event?.event.ctrlKey && !graphs[chartId].disZoom) {
                    isZoomY.value = true

                }
            }
        })

        // Add mouseout handler to reset cursor
        chart.on('mouseout', (params) => {
            inYArea.value = false
            isZoomY.value = false
        })

        // Add keyup handler to reset cursor when ctrl is released
        document.addEventListener('keyup', (event) => {


            isZoomY.value = false

        })

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Control' && inYArea.value && !graphs[chartId].disZoom) {
                isZoomY.value = true
            }
            isDragging.value = false
        })

        dom.addEventListener('mouseup', (event) => {
            isDragging.value = false
            isZoomY.value = false
            inYArea.value = false
        })
        dom.addEventListener('mousemove', (event) => {
            if (event.ctrlKey) {
                isDragging.value = false
            }
            if (isDragging.value) {
                const range = chartInstances[chartId].getOption().yAxis as ECBasicOption['yAxis'] as any
                const { min, max } = range[0]
                const offset = (max - min)
                let deltaY = event.movementY
                if (deltaY > 0) {
                    deltaY += offset * 0.2
                } else {
                    deltaY -= offset * 0.2
                }
                const newRange = {
                    min: min + deltaY * 0.05,
                    max: max + deltaY * 0.05
                }

                chartInstances[chartId].setOption({
                    yAxis: {
                        min: newRange.min,
                        max: newRange.max
                    }
                })

                // 更新graph的yAxis信息
                const node = filteredTreeData.value.find(n => n.id === chartId)
                if (node) {
                    node.yAxis = {
                        ...node.yAxis,
                        min: newRange.min,
                        max: newRange.max
                    }
                    graphs[chartId].yAxis = node.yAxis
                }
            }
        })

        // Add wheel event handler for zooming
        dom.addEventListener('wheel', (event: WheelEvent) => {
            if (event.ctrlKey && isZoomY.value) {

                if (graphs[chartId].disZoom) {
                    isZoomY.value = false
                    return
                }
                const yAxis = (chart.getOption() as any).yAxis[0];
                const range = yAxis.max - yAxis.min
                const offset = range * 0.2

                let newMin: number, newMax: number
                if (event.deltaY < 0) {
                    //zoom in
                    newMin = yAxis.min + offset
                    newMax = yAxis.max - offset
                } else {
                    //zoom out
                    newMin = yAxis.min - offset
                    newMax = yAxis.max + offset
                }

                chart.setOption({
                    yAxis: {
                        min: newMin,
                        max: newMax
                    }
                });

                // 更新graph的yAxis信息
                const node = filteredTreeData.value.find(n => n.id === chartId)
                if (node) {
                    node.yAxis = {
                        ...node.yAxis,
                        min: newMin,
                        max: newMax
                    }
                    graphs[chartId].yAxis = node.yAxis
                }
            }
        }, { passive: false });

        //dom outside
        dom.addEventListener('mouseleave', (event) => {
            isDragging.value = false
        })

        chart.on('mouseout', (params) => {
            //prevent mouseup event
            params.event?.event.preventDefault()
        })

        updateChartOption(chartId)
        if (graphs[chartId]) {
            chart.setOption({
                yAxis: graphs[chartId].yAxis,
                xAxis: graphs[chartId].xAxis,
                series: graphs[chartId].series
            })
        }
    }
}

// 更新图表配置
const updateChartOption = (chartId: string) => {
    const chart = enabledCharts.value.find(c => c.id === chartId)
    const index = enabledCharts.value.findIndex(c => c.id === chartId)

    if (chart && chartInstances[chartId]) {
        const option = getChartOption(chart, index)
        chartInstances[chartId].setOption(option)


    }
}

// 监听图表容器大小变化
watch([() => canvasWidth.value, () => height.value, enabledCharts], () => {
    nextTick(() => {
        Object.values(chartInstances).forEach(instance => {
            instance.resize()
        })
    })

})

const getChartOption = (chart: GraphNode<GraphBindSignalValue>, index: number): ECBasicOption => {
    const isLast = index === enabledCharts.value.length - 1
    const isFirst = index === 0
    const option: ECBasicOption = {
        animation: false,
        dataZoom: [
            {
                show: isLast,
                type: 'slider',
                height: 20,
                bottom: 10,
                showDetail: true,
                showDataShadow: false
            },


        ],
        grid: {
            left: '80px',  // 增加左边距，为标题留出空间
            right: '20px',
            top: isFirst ? '20px' : '10px',
            bottom: isLast ? '45px' : '4px',
            containLabel: false
        },
        xAxis: {
            type: 'value',
            min: 0,
            max: 10,
            name: isLast ? '[s]' : '',
            nameLocation: 'end',
            nameGap: 0,
            nameTextStyle: {
                fontSize: 12,
                padding: [0, 0, 0, 5] // 调整 [s] 的位置，上右下左
            },


            axisLabel: {
                show: isLast,
                // interval:1,
                // formatter: (value: number) => Number.isInteger(value) ? value.toFixed(0) : ''
            },
            axisTick: {
                show: isLast,
                interval: 10,
            },
            splitLine: {
                show: false
            },
            axisLine: {
                show: true,
                onZero: false,
                lineStyle: {
                    color: '#333'
                }
            },
            triggerEvent: false,
            position: 'bottom'
        },
        yAxis: {
            triggerEvent: true,
            splitLine: {
                show: false
            },
            axisLine: {
                show: true
            },
            axisTick: {
                show: true,
                length: 4,


            },

            min: 0,
            max: 20,
            axisLabel: {
                fontSize: 10,
                show: true,
                formatter: (value: number) => {
                    let val = Number.isInteger(value) ? value.toFixed(0) : ''
                    //如果val太大，显示科学计数法
                    if (val.length > 6) {
                        val = value.toExponential()
                    }
                    if (val.length > 6) {
                        return ''
                    }
                    return val
                },
            },
            name: chart.name,
            nameLocation: 'middle',
            nameGap: 65,  // 调整标题距离轴的距离
            nameRotate: 90,  // 垂直旋转文字
            nameTextStyle: {
                fontSize: 11,
                padding: [0, 0, 0, 5],  // 微调文字位置
                align: 'center',
                color: chart.color
            },
        },
        series: [{
            name: chart.name,
            type: 'line',
            triggerLineEvent: true,
            showSymbol: false,

            itemStyle: {
                color: chart.color
            },
            lineStyle: {
                color: chart.color,
                width: 2
            },
            cursor: 'ns-resize',  // 添加鼠标样式
            emphasis: {           // 添加鼠标悬停效果
                focus: 'series',
                lineStyle: {
                    width: 3
                }
            },
            silent: false, // Enable mouse events on the line
        }]
    }
    return option
}

onMounted(() => {
    window.jQuery('#graphShift').resizable({
        handles: 'e',
        resize: (e, ui) => {
            leftWidth.value = ui.size.width
        },
        maxWidth: 300,
        minWidth: 100,
    })



    for (const v of Object.values(graphs)) {
        if (v.graph && v.graph.id != props.editIndex) {
            continue
        }
        filteredTreeData.value.push(v)
    }
    // 初始化所有图表
    nextTick(() => {
        enabledCharts.value.forEach(chart => {
            if (!chartInstances[chart.id]) {
                initChart(chart.id)
            }
            window.logBus.on(chart.id, dataUpdate)
        })
    })
    if (window.globalStart.value) {
        timer = setInterval(updateTime, 500);
    }
})

// 监听启用图表的变化
watch(() => enabledCharts.value, () => {
    nextTick(() => {
        // 初始化新增的图表
        enabledCharts.value.forEach(chart => {
            if (!chartInstances[chart.id]) {
                initChart(chart.id)
            }
        })
        // 清理已移除的图表
        Object.keys(chartInstances).forEach(id => {
            if (!enabledCharts.value.find(c => c.id === id)) {
                chartInstances[id].dispose()
                delete chartInstances[id]
            }
        })
        //update grid and dataZoom for all charts
        enabledCharts.value.forEach((c, index) => {
            const isLast = index === enabledCharts.value.length - 1
            const isFirst = index === 0
            chartInstances[c.id].setOption({
                grid: {
                    top: isFirst ? '20px' : '10px',
                    bottom: isLast ? '45px' : '4px',
                },
                dataZoom: [
                    {
                        show: isLast,
                        type: 'slider',
                        height: 12,
                        bottom: 10,
                        showDetail: true,
                        showDataShadow: false
                    },
                ]
            })
        })
    })
})

onUnmounted(() => {
    clearInterval(timer)
    // 清理所有图表实例
    Object.values(chartInstances).forEach(instance => {
        instance.off('mousedown')
        instance.off('mousemove')
        instance.off('globalout')
        instance.off('mouseup')
        instance.dispose()
    })
    // 清理数据缓存
    Object.keys(chartDataCache).forEach(key => {
        delete chartDataCache[key]
    })
    //detach
    filteredTreeData.value.forEach(key => {
        window.logBus.detach(key.id, dataUpdate)
    })
})

const signalDialogVisible = ref(false)
const editDialogVisible = ref(false)
const editingNode = ref<GraphNode<GraphBindSignalValue> | null>(null)

const addSignal = () => {
    signalDialogVisible.value = true
}

const handleAddSignal = (node: GraphNode<GraphBindSignalValue>) => {
    signalDialogVisible.value = false

    //check existing graph
    const existed = filteredTreeData.value.find(v => v.id == node.id)
    if (existed) {
        ElNotification({
            offset: 50,
            message: 'Signal already exists',
            type: 'warning',
            appendTo: appendId.value
        })
        return
    }


    if (props.editIndex) {
        node.graph = {
            id: props.editIndex,
        }

    }
    filteredTreeData.value.push(node)
    window.logBus.on(node.id, dataUpdate)
    graphs[node.id] = node
    nextTick(() => {
        treeRef.value.setChecked(node.id, true)
    })

}

// 在删除图表时也要清理对应的缓存
const handleDelete = (data: GraphNode<GraphBindSignalValue>, event: Event) => {
    popoverRefs.value[data.id]?.hide()
    const index = filteredTreeData.value.findIndex(v => v.id == data.id)
    // 删除图表实例
    if (chartInstances[data.id]) {
        chartInstances[data.id].dispose()
        delete chartInstances[data.id]
    }
    // 删除数据缓存
    delete chartDataCache[data.id]

    filteredTreeData.value.splice(index, 1)
    delete graphs[data.id]
    window.logBus.detach(data.id, dataUpdate)
}

</script>
<style scoped>
.pause-active {
    box-shadow: inset 0 0 4px var(--el-color-info-light-5);
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.05);
}

.main {
    position: relative;
    height: 100%;
    width: 100%;
}

.left {
    position: absolute;
    top: 0px;
    left: 0px;
    width: v-bind(leftWidth + 'px');
    z-index: 2;
    /* changed from 1 to 2 */
    height: v-bind(height + 'px');
    overflow: hidden;
    overflow-x: hidden;
    overflow-y: auto;
}

.shift {
    position: absolute;
    top: 0px;
    left: 0px;
    width: v-bind(leftWidth + 1 + 'px');
    height: v-bind(height + 'px');
    z-index: 1;
    /* changed from 0 to 3 */
    border-right: solid 1px var(--el-border-color);
}

.shift:hover {
    border-right: solid 4px var(--el-color-primary);
    cursor: col-resize;
}

.shift:active {
    border-right: solid 4px var(--el-color-primary);
}

.right {
    position: absolute;
    right: 0;
    height: v-bind(height + 'px');
    z-index: 1;
    overflow: hidden;
    /* 改为 hidden 以防止滚动条影响画布 */

}

.canvas-container {
    position: relative;
    background-color: var(--el-bg-color);
}

.border-bottom {
    border-bottom: solid 1px var(--el-border-color);
    background-color: var(--el-background-color);
}

.tree-node {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 14px;
    width: 100%;
    overflow: hidden;
}

.custom-checkbox {
    flex-shrink: 0;
}

:deep(.el-checkbox__inner) {
    width: 14px;
    height: 14px;
}

:deep(.el-checkbox__input) {
    line-height: 14px;
}

.color-block {
    flex-shrink: 0;
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 1px solid #ddd;
}

.node-label {
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.menu-items {
    padding: 2px 0;
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 4px;
    /* 减小间距 */
    padding: 2px 8px;
    /* 减小上下内边距 */
    cursor: pointer;
    transition: all 0.3s;
    font-size: 12px;
    /* 稍微减小字体 */
    line-height: 20px;
    /* 添加行高控制 */
}

.menu-item.warning:hover {
    background-color: var(--el-color-warning-light-9);
    color: var(--el-color-warning-dark-2);
}

.menu-item.danger:hover {
    background-color: var(--el-color-danger-light-9);
    color: var(--el-color-danger-dark-2);
}

.menu-item .iconify {
    font-size: 14px;
    color: inherit;
}



.floating-icon :deep(.iconify) {
    font-size: 20px;
    display: block;
}

:deep(.chart-container .echarts) {
    width: 100% !important;
    height: 100% !important;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}
</style>

<style>
.node-menu {
    padding: 0;
}
</style>

<style lang="scss">
.el-popover.el-popper {
    min-width: 100px !important;
    padding: 0 !important;
    box-shadow: var(--el-box-shadow-light) !important;
    border: 1px solid var(--el-border-color-lighter) !important;

    &.node-menu {
        padding: 0 !important;
        background: var(--el-bg-color) !important;
    }
}
</style>