<template>
    <div class="uds-graph">
        <div style="justify-content: flex-start;display: flex;align-items: center;gap:0px;padding-left: 5px;padding: 1px"
            class="border-bottom">

            <el-button-group>
                <el-button link type="primary" :class="{ 'pause-active': hideTree }" @click="treeHide">
                    <Icon :icon="hideIcon" />
                </el-button>

                <el-tooltip effect="light" :content="isPaused ? 'Resume' : 'Pause'" placement="bottom">
                    <el-button :type="isPaused ? 'success' : 'warning'" link :class="{ 'pause-active': isPaused }">
                        <Icon :icon="isPaused ? playIcon : pauseIcon" />
                    </el-button>

                </el-tooltip>
            </el-button-group>
            <el-divider direction="vertical"></el-divider>
            <el-button-group>
                <el-tooltip effect="light" content="Add Variables" placement="bottom" >
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
        <div>
            <div class="main">
                <div class="left" v-show="!hideTree">
                    <el-scrollbar :height="height">
                        <el-tree highlight-current node-key="id" :data="filteredTreeData" :props="defaultProps"
                            show-checkbox empty-text="Add" :default-checked-keys="defaultCheckedKeys"
                            @check-change="handleCheckChange" @node-click="handleNodeClick">
                            <template #default="{ data }">
                                <el-popover :ref="e => popoverRefs[data.id] = e" placement="bottom-start" :width="100"
                                    trigger="contextmenu" popper-class="node-menu" @show="handleContextMenu(data)">
                                    <template #reference>
                                        <span class="tree-node">
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
        <el-dialog v-model="signalDialogVisible" v-if="signalDialogVisible" title="Add Signals" width="95%" align-center :append-to="appendId">
            <signal :height="tableHeight" :width="width" />
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
import { GraphNode } from 'src/preload/data';
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECBasicOption } from 'echarts/types/dist/shared'
import { formatter } from 'element-plus'
import signal from './components/signal.vue'

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
const appendId=computed(()=>props.editIndex?`#win${props.editIndex}`:'#wingraph')
const height = computed(() => props.height - 22)
const tableHeight = computed(() => height.value*2/3 )
// 修改测试数据
const filteredTreeData = computed<GraphNode[]>(() => {
    const list:GraphNode[]=[]
    for(const v of Object.values(graphs)){
        if(v.graph&&v.graph.id!=props.editIndex){
            continue
        }
        list.push(v)
    }
    return list
})

const defaultProps = {
    label: 'label',
}

const defaultCheckedKeys = computed(() => {
    return Object.values(filteredTreeData.value)
        .filter(node => node.enable)
        .map(node => node.id)
})

const handleCheckChange = (data: GraphNode, checked: boolean) => {

    if (data.id && graphs[data.id]) {
        graphs[data.id].enable = checked
    }
}

const handleNodeClick = (data: any) => {
    console.log(data)
}

function treeHide() {
    hideTree.value = !hideTree.value;
    // 如果需要在隐藏/显示时保存之前的宽度，可以添加相关逻辑
}

const addNode = () => {
    // 这里添加你的节点添加逻辑
    console.log('Add node clicked')
}

// 添加画布宽度计算
const canvasWidth = computed(() => {
    return hideTree.value ? props.width : props.width - leftWidth.value - 5
})

const handleContextMenu = (data: GraphNode) => {
    console.log('Right click on node:', data)
}

const handleEdit = (data: GraphNode, event: Event) => {
    // unref(popoverRef).popperRef?.delayHide?.()
    popoverRefs.value[data.id]?.hide()
}

const handleDelete = (data: GraphNode, event: Event) => {

    popoverRefs.value[data.id]?.hide()

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
        })
        dom.addEventListener('mousemove', (event) => {
            if (event.ctrlKey) {
                isDragging.value = false
            }
            if (isDragging.value) {

                const range = chartInstances[chartId].getOption().yAxis as ECBasicOption['yAxis'] as any
                const { min, max } = range[0]
                const deltaY = event.movementY
                const newRange = {
                    min: min + deltaY * 0.1,
                    max: max + deltaY * 0.1
                }

                chartInstances[chartId].setOption({
                    yAxis: {
                        min: newRange.min,
                        max: newRange.max
                    }
                })

            }
        })

        // Add wheel event handler for zooming
        dom.addEventListener('wheel', (event: WheelEvent) => {

            if (event.ctrlKey && isZoomY.value) { // Only zoom when Ctrl is pressed


                const yAxis = (chart.getOption() as any).yAxis[0];
                const range = yAxis.max - yAxis.min
                const offset = range * 0.05
                if (event.deltaY < 0) {
                    //zoom in

                    chart.setOption({
                        yAxis: {
                            min: yAxis.min - offset,
                            max: yAxis.max + offset
                        }
                    });
                } else {
                    //zoom out
                    chart.setOption({
                        yAxis: {
                            min: yAxis.min + offset,
                            max: yAxis.max - offset
                        }
                    });
                }
                // const newRange = calculateYAxisZoom(yAxis.min, yAxis.max, event.deltaY, zoomPoint);
                // console.log(newRange)
                // chart.setOption({
                //     yAxis: {
                //         min: newRange.min,
                //         max: newRange.max
                //     }
                // });
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
watch([() => canvasWidth.value, () => height.value], () => {
    nextTick(() => {
        Object.values(chartInstances).forEach(instance => {
            instance.resize()
        })
    })

})

const getChartOption = (chart: GraphNode, index: number): ECBasicOption => {
    const isLast = index === enabledCharts.value.length - 1
    const isFirst = index === 0
    const option: ECBasicOption = {
        animation: false,
        dataZoom: [
            {
                show: isLast,
                type: 'slider',
                height: 12,
                bottom: 10,
                showDetail: true,
                showDataShadow: false
            },


        ],
        grid: {
            left: '60px',  // 增加左边距，为标题留出空间
            right: '20px',
            top: isFirst ? '20px' : '10px',
            bottom: isLast ? '45px' : '4px',
            containLabel: false
        },
        xAxis: {
            type: 'value',
            min: 0,
            max: 15,
            name: isLast ? '[s]' : '',
            nameLocation: 'end',
            nameGap: 0,
            nameTextStyle: {
                fontSize: 12,
                padding: [0, 0, 0, 5] // 调整 [s] 的位置，上右下左
            },
            interval: 1,

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
                show: true,
                formatter: (value: number) => Number.isInteger(value) ? value.toFixed(0) : ''

            },
            name: chart.name,
            nameLocation: 'middle',
            nameGap: 45,  // 调整标题距离轴的距离
            nameRotate: 90,  // 垂直旋转文字
            nameTextStyle: {
                fontSize: 12,
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
            data: generateMockData(100),  // 使用处理后的数据
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
    // 初始化所有图表
    nextTick(() => {
        enabledCharts.value.forEach(chart => {
            initChart(chart.id)
        })
    })
})

// 监听启用图表的变化
watch(() => enabledCharts.value, (newCharts) => {
    nextTick(() => {
        // 初始化新增的图表
        newCharts.forEach(chart => {
            if (!chartInstances[chart.id]) {
                initChart(chart.id)
            }
        })
        // 清理已移除的图表
        Object.keys(chartInstances).forEach(id => {
            if (!newCharts.find(c => c.id === id)) {
                chartInstances[id].dispose()
                delete chartInstances[id]
            }
        })
    })
})

onUnmounted(() => {
    // 清理所有图表实例
    Object.values(chartInstances).forEach(instance => {
        instance.off('mousedown')
        instance.off('mousemove')
        instance.off('globalout')
        instance.off('mouseup')
        instance.dispose()
    })
})

const signalDialogVisible = ref(false)

const addSignal = () => {
    signalDialogVisible.value = true
}

const handleAddSignal = () => {
    signalDialogVisible.value = false
    // Add logic to handle selected signals
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

.color-block {
    flex-shrink: 0;
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 1px solid #ddd;
}

.node-label {
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