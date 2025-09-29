<template>
  <div class="uds-graph">
    <div>
      <div
        style="
          display: flex;
          align-items: center;
          padding: 0 5px;

          border-bottom: solid 1px var(--el-border-color);
        "
      >
        <el-button-group>
          <el-tooltip effect="light" :content="isPaused ? 'Resume' : 'Pause'" placement="bottom">
            <el-button
              :type="isPaused ? 'success' : 'warning'"
              link
              :disabled="!globalStart"
              :class="{ 'pause-active': isPaused }"
              @click="isPaused = !isPaused"
            >
              <Icon :icon="isPaused ? playIcon : pauseIcon" />
            </el-button>
          </el-tooltip>
        </el-button-group>
        <el-divider direction="vertical"></el-divider>
        <el-button-group>
          <el-tooltip effect="light" content="Load Off-Line Trace File" placement="bottom">
            <el-button link type="primary" :disabled="globalStart" @click="loadOfflineTrace">
              <Icon :icon="addIcon" />
            </el-button>
          </el-tooltip>

          <el-divider direction="vertical"></el-divider>
          <el-tooltip effect="light" content="Save Trace To File" placement="bottom">
            <el-button link type="primary">
              <Icon :icon="saveIcon" />
            </el-button>
          </el-tooltip>
        </el-button-group>
        <span
          style="
            margin-right: 10px;
            font-size: 12px;
            color: var(--el-text-color-regular);
            margin-left: auto;
          "
        >
          Time: {{ time }}s
        </span>
      </div>
      <div class="main">
        <div class="left">
          <div class="core-container">
            <!-- Dynamic Core Sections -->
            <div v-for="core in coreConfigs" :key="core.id" class="core-section">
              <div class="core-label-vertical">
                <span class="core-text">{{ core.name }}</span>
              </div>
              <div class="button-group">
                <div
                  v-for="(button, buttonIndex) in core.buttons"
                  :key="`core${core.id}-${buttonIndex}`"
                  class="button-item"
                  :style="{
                    height: buttonHeight + 'px',
                    borderLeftColor: button.color,
                    borderRightColor: button.color
                  }"
                >
                  <div class="button-content">
                    <div
                      v-show="!globalStart"
                      class="arrow-left"
                      @click.stop="handleArrowClick('left', core.id, buttonIndex, button.name)"
                    >
                      <Icon :icon="'material-symbols:chevron-left'" />
                    </div>
                    <span class="button-text">{{ button.name }}</span>
                    <div
                      v-show="!globalStart"
                      class="arrow-right"
                      @click.stop="handleArrowClick('right', core.id, buttonIndex, button.name)"
                    >
                      <Icon :icon="'material-symbols:chevron-right'" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div :id="`Shift-${charid}`" class="shift"></div>
        <!-- DOM-based separator lines with higher z-index -->
        <div
          v-for="(separator, index) in separatorPositions"
          :key="`separator-${index}`"
          class="separator-line"
          :style="{
            top: separator.y + 'px',
            left: 0,
            width: width - 10 + 'px'
          }"
        ></div>
        <div :id="charid" class="right"></div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import pauseIcon from '@iconify/icons-material-symbols/pause-circle-outline'
import playIcon from '@iconify/icons-material-symbols/play-circle-outline'
import addIcon from '@iconify/icons-material-symbols/add-circle-outline'

import { ref, onMounted, computed, h, onUnmounted, watch, nextTick, watchEffect } from 'vue'
import { Icon } from '@iconify/vue'
import { useDataStore } from '@r/stores/data'

import saveIcon from '@iconify/icons-material-symbols/save'
import testdata from './blocks.json'
import { useGlobalStart } from '@r/stores/runtime'
import * as echarts from 'echarts'
import { ECBasicOption } from 'echarts/types/dist/shared'
import { IsrStatus, OsEvent, parseInfo, TaskStatus, TaskType } from 'nodeCan/osEvent'
import { useProjectStore } from '@r/stores/project'
import { ElLoading } from 'element-plus'

const isPaused = ref(false)
const leftWidth = ref(200)
const props = defineProps<{
  height: number
  width: number
  editIndex: string
}>()

const dataStore = useDataStore()
const orti = computed(() => dataStore.database.orti[props.editIndex.replace('_trace', '')])
const height = computed(() => props.height - 19)

const charid = computed(() => `${props.editIndex}_graph`)

const width = computed(() => props.width)

const time = ref(0)
let chart: echarts.ECharts
let timer: ReturnType<typeof setInterval> | null = null

// 更新时间显示的函数
const updateTime = () => {
  if (isPaused.value) return

  // 更新x轴范围和时间
  let maxX = 5
  let minX = 0

  const lastBlock = visibleBlocks.at(-1)
  if (lastBlock && lastBlock.end) {
    maxX = lastBlock.end
  }

  // 使用当前时间更新time值
  const ts = (Date.now() - window.startTime) / 1000

  if (ts > maxX) {
    maxX = ts
  }

  // 设置time值，与graph.vue保持一致
  time.value = maxX

  // 计算x轴范围
  maxX = Math.ceil(maxX) + 5
  minX = Math.floor(minX)

  // Update x-axis range and separator lines
  if (chart) {
    chart.setOption({
      xAxis: {
        max: maxX,
        min: minX
      }
    })
  }
}
const globalStart = useGlobalStart()

const project = useProjectStore()

async function loadOfflineTrace() {
  const loading = ElLoading.service({ fullscreen: true })
  visibleBlocks = []
  try {
    const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
      defaultPath: project.projectInfo.path,
      title: 'Offline Trace File',
      properties: ['openFile'],
      filters: [{ name: 'excel', extensions: ['xlsx'] }]
    })
    const file = r.filePaths[0]
    if (file) {
      const res = await window.electron.ipcRenderer.invoke(
        'ipc-ostrace-parse-excel',
        file,
        orti.value.cpuFreq
      )
      visibleBlocks = res.blocks.slice(0, 400)

      console.log('visibleBlocks', visibleBlocks)

      chart.setOption({
        xAxis: {
          min: 5,
          max: 6
        },
        series: [
          {
            data: visibleBlocks.map((block) => [
              block.start,
              block.end,
              block.id,
              block.coreId,
              block.type,
              block.status
            ])
          }
        ]
      })
    }
  } catch (error) {
    console.error(error)
  } finally {
    loading.close()
  }
}
// 确保定时器时间间隔与graph.vue保持一致
watch(globalStart, (val) => {
  if (val) {
    isPaused.value = false
    // 启动定时器更新时间，使用500ms间隔
    if (timer) clearInterval(timer)
    timer = setInterval(updateTime, 500)
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
})

const darkColor = (color: string, level: number) => {
  const rgb = color.match(/\d+/g)!.map(Number)
  const factor = 1 - 0.2 * level
  const [r, g, b] = rgb.map((v) => Math.max(0, Math.min(255, v * factor)))
  return `rgb(${r}, ${g}, ${b})`
}

// Dynamic core configuration - can be extended infinitely
const coreConfigs = computed(() => {
  const configs: {
    id: number
    name: string
    buttons: Array<{ name: string; color: string; id: number; type: number }>
  }[] = []
  for (const task of orti.value.coreConfigs) {
    //check if core is already in configs
    const core = configs.find((c) => c.id === task.coreId)
    if (!core) {
      configs.push({
        id: task.coreId,
        name: task.name,
        buttons: [
          {
            name: task.name,
            color: task.color,
            id: task.id,
            type: task.type
          }
        ]
      })
    }
    if (core) {
      core.buttons.push({
        name: task.name,
        color: task.color,
        id: task.id,
        type: task.type
      })
    }
  }
  return configs
})

// Computed property for total button count across all cores
const totalButtons = computed(() => {
  return coreConfigs.value.reduce((total, core) => total + core.buttons.length, 0)
})

const buttonHeight = computed(() => {
  // buttonHeight is the absolute height of each button including border
  const availableHeight = height.value - 45
  return availableHeight / totalButtons.value
})

// Computed property for separator line positions
const separatorPositions = computed(() => {
  const positions: Array<{ y: number }> = []
  let currentY = 0

  for (let i = 0; i < coreConfigs.value.length - 1; i++) {
    const core = coreConfigs.value[i]

    currentY += buttonHeight.value * core.buttons.length
    positions.push({ y: currentY }) // Align with button borders
  }
  //add bottom line - total buttons with borders between them
  const totalWithBorders = totalButtons.value * buttonHeight.value
  positions.push({ y: totalWithBorders })
  return positions
})

interface VisibleBlock {
  type: TaskType
  id: number
  start: number
  end?: number
  coreId: number
  status: number | string
}

const coreStatus: Record<
  number,
  {
    activeDataIndex: number
    lasttype: TaskType
    status: number
    cnt: number
    cntTimer?: number
    yPos: number
    color: string
  }
> = {}
let visibleBlocks: VisibleBlock[] = testdata.slice(0, 200)
function updateTimeLine() {
  if (!chart) return

  const currentTimeX = time.value

  const x = chart.convertToPixel('grid', [currentTimeX, 0])

  // Update timeline position using incremental update
  chart.setOption({
    graphic: [
      {
        id: 'timeline',
        $action: 'replace',
        type: 'line',
        shape: {
          x1: x[0],
          y1: 0,
          x2: x[0],
          y2: x[1]
        },
        style: {
          stroke: 'blue',
          lineWidth: 1
        },
        silent: true,
        z: 100,
        invisible: !globalStart.value
      }
    ]
  })
}

watch([() => globalStart.value, () => time.value], () => {
  updateTimeLine()
})

function initChart() {
  const initTimeLine = {
    id: 'timeline',
    type: 'line',
    shape: {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: height.value - 45
    },
    style: {
      stroke: 'blue',
      lineWidth: 1
    },
    silent: true,
    z: 100,
    invisible: !globalStart.value
  }
  const option: ECBasicOption = {
    animation: false,
    animationDuration: 0,
    dataZoom: [
      {
        show: true,
        type: 'inside',
        height: 15,
        bottom: 10,
        showDetail: false,
        showDataShadow: false,
        realtime: true,
        // filterMode:'none',
        zoomOnMouseWheel: 'ctrl'
        // minValueSpan:0.000001,//1us
        // maxValueSpan:0.1,
      }
    ],
    grid: {
      left: '5px',
      right: '20px',
      top: '0',
      bottom: '45px',
      containLabel: false
    },
    graphic: [initTimeLine],
    xAxis: {
      type: 'value',
      min: 7,
      max: 8.4,
      name: '[s]',
      nameLocation: 'end',
      nameGap: 0,
      nameTextStyle: {
        fontSize: 12,
        padding: [0, 0, 0, 5] // 调整 [s] 的位置，上右下左
      },

      axisLabel: {
        show: true
        // interval:1,
        // formatter: (value: number) => Number.isInteger(value) ? value.toFixed(0) : ''
      },
      axisTick: {
        show: true,
        interval: 10
      },
      splitLine: {
        show: false
      },
      axisLine: {
        show: false,
        onZero: false,
        lineStyle: {
          color: '#333'
        }
      },
      triggerEvent: false,
      position: 'bottom'
    },
    yAxis: {
      min: 0,
      max: totalButtons.value,
      interval: 1,
      triggerEvent: true,
      splitLine: {
        show: false
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false,
        length: 5
      },

      axisLabel: {
        show: false
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: function (params) {
        if (
          params.componentType === 'series' &&
          params.seriesType === 'custom' &&
          params.seriesName === '运算块'
        ) {
          const blockData = visibleBlocks[params.dataIndex]
          if (blockData) {
            const end =
              blockData.end ||
              (globalStart.value ? time.value : (chart.getOption().xAxis as any)[0].max)
            // 查找对应的 core 名称
            const coreName = `Core-${blockData.coreId}`
            let task
            for (const core of coreConfigs.value) {
              if (core.id === blockData.coreId) {
                task = core.buttons.find((b) => b.id === blockData.id && b.type === blockData.type)
              }
            }

            // if (blockData.type == TaskType.LINE) {
            //   return `
            //    <strong>${blockData.name.split(':').join('->')}</strong><br/>
            //    Core: ${coreName}<br/>
            //    Time: ${blockData.start * 1000000}us<br/>

            //  `
            // }

            return `
               <strong>${task?.name}</strong><br/>
               ${parseInfo(blockData.type, blockData.status as number, '<br/>')}
               Core: ${coreName}<br/>
               Start: ${blockData.start * 1000000}us<br/>
               Duration: ${(end - blockData.start) * 1000000}us<br/>
               End: ${end * 1000000}us
             `
          }
        }
        return ''
      }
    },
    series: [
      {
        name: '运算块',
        type: 'custom',
        renderItem: function (params, api) {
          const start = api.value(0)
          const end =
            api.value(1) ||
            (globalStart.value ? time.value : (chart.getOption().xAxis as any)[0].max)
          const id = api.value(2)
          const coreId = api.value(3)
          const type = api.value(4)
          const status = api.value(5)

          if (type == TaskType.SERVICE || type == TaskType.HOOK) {
            return null
          }

          // 根据 coreId 和 name 查找对应的颜色和位置信息
          let color = '#95a5a6' // 默认颜色
          let yPos = 0

          for (const core of coreConfigs.value) {
            if (core.id != coreId) {
              yPos += core.buttons.length
              continue
            }

            const buttonIndex = core.buttons.findIndex((b) => b.id === id && b.type === type)
            if (buttonIndex != -1) {
              const button = core.buttons[buttonIndex]

              color = button.color
              yPos += buttonIndex
              break
            } else {
              // if (type == TaskType.LINE) {
              //   const names = name.split(':')
              //   const from = names[0]
              //   const to = names[1]
              //   const fromBlock = core.buttons.findIndex((b) => b.name === from)
              //   const toBlock = core.buttons.findIndex((b) => b.name === to)

              //   if (fromBlock != -1 && toBlock != -1) {
              //     color = 'black'
              //     let toOffset = 0
              //     let fromOffset = 0
              //     if (fromBlock > toBlock) {
              //       fromOffset += 1
              //     } else {
              //       toOffset += 1
              //     }
              //     const startPoint = api.coord([
              //       start,
              //       totalButtons.value - yPos - fromBlock - fromOffset
              //     ])
              //     const endPoint = api.coord([
              //       start,
              //       totalButtons.value - yPos - toBlock - toOffset
              //     ])

              //     //返回一个垂直的先from - to 的线
              //     return {
              //       type: 'line',
              //       shape: {
              //         x1: startPoint[0],
              //         y1: startPoint[1],
              //         x2: endPoint[0],
              //         y2: endPoint[1]
              //       },
              //       style: {
              //         stroke: color,
              //         lineWidth: 1
              //       }
              //     }
              //   }
              // }
              return null
            }
          }

          let height = buttonHeight.value
          yPos = totalButtons.value - yPos - 1
          let text = ''
          const diff = end - start
          if (type == TaskType.TASK || type == TaskType.ISR) {
            if (diff > 1) {
              //s
              text = `${diff.toFixed(1)}s`
            } else if (diff > 0.001) {
              //ms
              text = `${(diff * 1000).toFixed(1)}ms`
            } else {
              text = `${(diff * 1000000).toFixed(1)}us`
            }
          }
          if (type == TaskType.TASK || type == TaskType.ISR) {
            coreStatus[coreId] = {
              status: status,
              lasttype: type,
              activeDataIndex: params.dataIndex,
              cnt: 0,
              yPos: yPos,
              color: color
            }
            if (type == TaskType.TASK && status != 1) {
              height = height * 0.1
              text = ''
              yPos += 0.45
            }
          } else {
            if (coreStatus[coreId] == undefined) {
              return null
            }

            coreStatus[coreId].cnt++

            if (coreStatus[coreId].cntTimer != undefined && start >= coreStatus[coreId].cntTimer) {
              coreStatus[coreId].cnt--
            }
            //use api.value(1) ? or  end
            coreStatus[coreId].cntTimer = api.value(1)

            yPos = coreStatus[coreId].yPos + (coreStatus[coreId].cnt - 1) * 0.2
            color = coreStatus[coreId].color
            //add alpha
            color = darkColor(color, coreStatus[coreId].cnt)
            height = height * 0.2
          }

          const startPoint = api.coord([start, yPos])
          const endPoint = api.coord([end, yPos])
          let width = endPoint[0] - startPoint[0]
          if (width < 4) {
            width = 4
          }

          return {
            type: 'group',

            children: [
              // 主块
              {
                type: 'rect',
                shape: {
                  x: startPoint[0],
                  y: startPoint[1] - height,
                  width: width,
                  height: height
                },
                style: {
                  fill: color
                }
              },

              // 块内文本（持续时间）
              {
                type: 'text',
                style: {
                  text: text,
                  x: (startPoint[0] + endPoint[0]) / 2,
                  y: startPoint[1] - height / 2,
                  textAlign: 'center',
                  textVerticalAlign: 'middle',
                  fontSize: 8,
                  fill: '#000',
                  fontWeight: 'bold',

                  overflow: 'truncate', // 超出截断
                  width: width - 4 // 文字允许的宽度（稍微减一点边距）
                }
              }
            ]
          }
        },
        data: visibleBlocks.map((block) => [
          block.start,
          block.end,
          block.id,
          block.coreId,
          block.type,
          block.status
        ]),
        z: 1
      }
    ]
  }
  chart.setOption(option)
  initEvent()
}

const linColor = 'black'

// Example usage (commented out):
// To add a new core: addCore(2, 'Core 2', [{ name: 'NewTask', color: '#e67e22' }])
// To remove a core: removeCore(1)
// To add button to existing core: addButtonToCore(0, { name: 'NewButton', color: '#8e44ad' })

// Arrow click handler - shared function for both left and right arrows
const handleArrowClick = (
  direction: 'left' | 'right',
  coreId: number,
  buttonIndex: number,
  buttonName: string
) => {
  console.log(
    `Arrow clicked: ${direction}, Core: ${coreId}, Button Index: ${buttonIndex}, Button Name: ${buttonName}`
  )
}

// 监听暂停/恢复状态
watch(
  () => isPaused.value,
  (paused) => {
    if (paused && timer) {
      clearInterval(timer)
      timer = null
    } else if (!paused && globalStart.value) {
      if (timer) clearInterval(timer)
      timer = setInterval(updateTime, 500)
    }
  }
)
const datazoomInfo = {
  start: 0,
  end: 100
}
function initEvent() {
  chart.on('datazoom', (params: any) => {
    datazoomInfo.start = params.start
    datazoomInfo.end = params.end
    updateTimeLine()
  })

  // Add mouse wheel event listener for datazoom and scale control
  const chartDom = chart.getDom()
  chartDom.addEventListener('wheel', handleWheelEvent, { passive: false })
}

// Mouse wheel event handler
function handleWheelEvent(event: WheelEvent) {
  event.preventDefault()

  const delta = -event.deltaY / 1000 // Normalize wheel delta
  const isCtrlPressed = event.ctrlKey

  if (isCtrlPressed) {
    // Ctrl + wheel: adjust datazoom window size (zoom in/out the visible range)
    handleScaleAdjustment(delta, event)
  } else {
    // Normal wheel: adjust datazoom position (pan left/right)
    handleDatazoomAdjustment(delta)
  }
}

// Handle datazoom window size adjustment (Ctrl+wheel)
function handleScaleAdjustment(delta: number, event: WheelEvent) {
  // Get current datazoom range
  const currentStart = datazoomInfo.start
  const currentEnd = datazoomInfo.end
  const currentRange = currentEnd - currentStart

  // Calculate zoom factor (positive delta = zoom in/smaller window, negative = zoom out/larger window)
  const zoomFactor = 1 - delta * 0.1
  let newRange = currentRange * zoomFactor

  // Ensure minimum and maximum range limits
  newRange = Math.max(1, Math.min(100, newRange)) // Range between 1% and 100%

  // Calculate center point of current datazoom window
  const center = (currentStart + currentEnd) / 2

  // Calculate new start and end positions centered around current center
  let newStart = center - newRange / 2
  let newEnd = center + newRange / 2

  // Ensure boundaries (0-100%)
  if (newStart < 0) {
    newStart = 0
    newEnd = newRange
  } else if (newEnd > 100) {
    newEnd = 100
    newStart = 100 - newRange
  }

  // Update datazoom window
  chart.dispatchAction({
    type: 'dataZoom',
    start: newStart,
    end: newEnd
  })
}

// Handle datazoom area adjustment (normal wheel scrolling)
function handleDatazoomAdjustment(delta: number) {
  const currentOption = chart.getOption() as any
  const dataZoom = currentOption.dataZoom[0]

  // Get current datazoom range
  const currentStart = datazoomInfo.start
  const currentEnd = datazoomInfo.end

  // Calculate scroll amount (as percentage)
  const scrollAmount = delta * 5 // 5% per scroll step

  // Calculate new range
  let newStart = currentStart - scrollAmount
  let newEnd = currentEnd - scrollAmount

  // Ensure boundaries
  if (newStart < 0) {
    const offset = -newStart
    newStart = 0
    newEnd += offset
  }
  if (newEnd > 100) {
    const offset = newEnd - 100
    newEnd = 100
    newStart -= offset
  }

  // Ensure minimum range
  if (newEnd - newStart < 1) {
    return
  }

  // Update datazoom
  chart.dispatchAction({
    type: 'dataZoom',
    start: Math.max(0, newStart),
    end: Math.min(100, newEnd)
  })
}
onMounted(() => {
  // 初始化数据
  const dom = document.getElementById(charid.value)
  if (dom) {
    chart = echarts.init(dom)
    initChart()
  }

  window.jQuery(`#Shift-${charid.value}`).resizable({
    handles: 'e',
    resize: (e, ui) => {
      leftWidth.value = ui.size.width
    },
    maxWidth: 300,
    minWidth: 100
  })

  if (globalStart.value) {
    timer = setInterval(updateTime, 500)
  }
})

watch([() => height.value, () => width.value, () => leftWidth.value], () => {
  // Update chart after resize
  nextTick(() => {
    chart.resize()
    updateTimeLine()
  })
})

onUnmounted(() => {
  // 清除定时器
  if (timer) {
    clearInterval(timer)
    timer = null
  }

  // Remove wheel event listener
  if (chart && chart.getDom()) {
    chart.getDom().removeEventListener('wheel', handleWheelEvent)
  }

  chart.dispose()
})
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
  width: v-bind(width - leftWidth - 1 + 'px');
  height: v-bind(height + 'px');
  z-index: 1;
  overflow: hidden;
  /* 改为 hidden 以防止滚动条影响画布 */
}

.border-bottom {
  border-bottom: solid 1px var(--el-border-color);
  background-color: var(--el-background-color);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.core-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.core-section {
  display: flex;
  flex-direction: row;
}

.core-label-vertical {
  width: 24px;
  background-color: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-lr;
  text-orientation: mixed;
  position: relative;
}

.core-text {
  font-weight: 600;
  font-size: 12px;
  color: var(--el-text-color-primary);
  transform: rotate(180deg);
  white-space: nowrap;
}

.button-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.button-item {
  position: relative;
  display: flex;
  align-items: center;
  border-left: 20px solid;
  border-right: 20px solid;
  background-color: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.8;
  margin-left: 0;
  /* Force pixel-perfect rendering and prevent sub-pixel rendering */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  box-sizing: border-box;
  -webkit-box-sizing: border-box;
}

.button-item::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background-color: var(--el-border-color-lighter);
  transform: scaleY(1);
  -webkit-transform: scaleY(1);
}

.button-item:hover {
  opacity: 1;

  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.button-content {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 8px;
  position: relative;
}

.button-text {
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arrow-left,
.arrow-right {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  color: white;
  font-size: 20px;
  z-index: 10;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow-left {
  left: -20px;
}

.arrow-right {
  right: -20px;
}

.button-item:hover .arrow-left,
.button-item:hover .arrow-right {
  opacity: 0.8;
}

.button-item:hover .arrow-left:hover,
.button-item:hover .arrow-right:hover {
  opacity: 1;
  transform: translateY(-50%) scale(1.2);
}

.separator-line {
  position: absolute;
  height: 1px;
  background-color: var(--el-color-info-dark-2);
  z-index: 1000;
  pointer-events: none;
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
