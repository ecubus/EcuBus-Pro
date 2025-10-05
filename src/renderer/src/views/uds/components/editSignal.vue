<template>
  <div class="edit-signal" :style="{ height: `${props.height}px` }">
    <el-scrollbar>
      <div class="edit-signal__content">
        <el-collapse v-if="props.node.type === 'signal'" v-model="activeCollapse">
          <el-collapse-item title="Signal Information" name="signal">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="Database">{{
                props.node.bindValue.dbName
              }}</el-descriptions-item>
              <el-descriptions-item label="Signal Name">{{
                props.node.bindValue.signalName
              }}</el-descriptions-item>
              <el-descriptions-item label="Frame ID"
                >0x{{ props.node.bindValue.frameId.toString(16) }}</el-descriptions-item
              >
              <el-descriptions-item label="Start Bit">{{
                props.node.bindValue.startBit
              }}</el-descriptions-item>
              <el-descriptions-item label="Bit Length">{{
                props.node.bindValue.bitLength
              }}</el-descriptions-item>
            </el-descriptions>
          </el-collapse-item>
        </el-collapse>
        <el-collapse v-else-if="props.node.type === 'variable'" v-model="activeCollapse">
          <el-collapse-item title="Variable Information" name="variable">
            <el-descriptions v-if="varInfo" :column="1" border size="small">
              <el-descriptions-item label="Variable Full Name">{{
                varInfo.fullName
              }}</el-descriptions-item>
              <el-descriptions-item label="Variable Name">{{
                varInfo.var?.name
              }}</el-descriptions-item>
              <el-descriptions-item label="Variable Type">{{
                varInfo.var?.type.toUpperCase()
              }}</el-descriptions-item>
            </el-descriptions>

            <el-alert
              v-else
              :title="`Variable ${(props.node.bindValue as any).variableName} Not Found`"
              type="warning"
              description="Please check in Variable Window"
              show-icon
            />
          </el-collapse-item>
        </el-collapse>

        <!-- 当type为variable时暂时不显示description -->

        <el-form :model="form" label-width="120px" size="small">
          <el-form-item label="Name">
            <el-input v-model="form.name" />
          </el-form-item>
          <el-form-item label="Color">
            <el-color-picker v-model="form.color" show-alpha />
          </el-form-item>
          <template v-if="props.stype == 'line'">
            <el-divider content-position="left">Y Axis</el-divider>
            <el-form-item label="Y Axis Min">
              <el-input-number v-model="form.yAxis.min" :controls="false" />
            </el-form-item>
            <el-form-item label="Y Axis Max">
              <el-input-number v-model="form.yAxis.max" :controls="false" />
            </el-form-item>
            <el-form-item label="Split Line">
              <el-switch v-model="form.yAxis.splitLine.show" />
            </el-form-item>
            <el-form-item label="Disable Zoom">
              <el-switch v-model="form.disZoom" />
            </el-form-item>
            <el-divider content-position="left">X Axis</el-divider>
            <el-form-item label="Show Grid">
              <el-switch v-model="form.xAxis.splitLine.show" />
            </el-form-item>
            <el-form-item label="Grid Style">
              <el-select
                v-model="form.xAxis.splitLine.lineStyle.type"
                :disabled="!form.xAxis.splitLine.show"
              >
                <el-option label="Solid" value="solid" />
                <el-option label="Dashed" value="dashed" />
                <el-option label="Dotted" value="dotted" />
              </el-select>
            </el-form-item>
            <el-form-item label="Show Value">
              <el-switch v-model="form.xAxis.axisPointer.show" />
            </el-form-item>

            <el-divider content-position="left">Series</el-divider>
            <el-form-item label="Show Points">
              <el-switch v-model="form.series.showSymbol" />
            </el-form-item>
            <el-form-item v-if="form.series.showSymbol" label="Point Size">
              <el-input-number v-model="form.series.symbolSize" :min="2" :max="10" :step="1" />
            </el-form-item>
            <el-form-item v-if="form.series.showSymbol" label="Point Style">
              <el-select v-model="form.series.symbol">
                <el-option label="Circle" value="circle" />
                <el-option label="Rectangle" value="rect" />
                <el-option label="Triangle" value="triangle" />
                <el-option label="Diamond" value="diamond" />
              </el-select>
            </el-form-item>
          </template>
          <template v-if="props.stype == 'gauge'">
            <el-form-item label="Min">
              <el-input-number v-model="form.yAxis.min" :controls="false" />
            </el-form-item>
            <el-form-item label="Max">
              <el-input-number v-model="form.yAxis.max" :controls="false" />
            </el-form-item>
          </template>

          <el-form-item>
            <el-button type="primary" @click="handleSubmit">Save</el-button>
            <el-button @click="handleCancel">Cancel</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { GraphBindSignalValue, GraphNode, VarItem } from 'src/preload/data'
import { LineSeriesOption, GaugeSeriesOption } from 'echarts'
import { useDataStore } from '@r/stores/data'
import { getAllSysVar } from 'nodeCan/sysVar'
import { cloneDeep } from 'lodash'
const database = useDataStore()
const props = defineProps<{
  stype: 'line' | 'gauge'
  node: GraphNode<GraphBindSignalValue>
  height: number
}>()

const emit = defineEmits<{
  save: [value: GraphNode<GraphBindSignalValue>]
  cancel: []
}>()

const varInfo = computed(() => {
  if (props.node.type === 'variable') {
    const varInfo = database.vars[(props.node.bindValue as any).variableId]
    if (varInfo) {
      return {
        fullName: (props.node.bindValue as any).variableFullName,
        var: varInfo
      }
    }
    const sysVar = getAllSysVar(database.devices, database.tester, database.database.orti)
    const sysVarInfo = sysVar[(props.node.bindValue as any).variableId]
    if (sysVarInfo) {
      return {
        fullName: (props.node.bindValue as any).variableFullName,
        var: sysVarInfo
      }
    }
  }
  return undefined
})

const form = ref({
  name: props.node.name,
  color: props.node.color,
  yAxis: {
    min: props.node.yAxis?.min ?? 0,
    max: props.node.yAxis?.max ?? 100,
    splitLine: {
      show: props.node.yAxis?.splitLine?.show ?? false
    }
  },
  xAxis: {
    splitLine: {
      show: props.node.xAxis?.splitLine?.show ?? false,
      lineStyle: {
        type: props.node.xAxis?.splitLine?.lineStyle?.type ?? 'dashed'
      }
    },
    axisPointer: {
      show: props.node.xAxis?.axisPointer?.show ?? false
    }
  },
  disZoom: props.node.disZoom ?? false,
  series: {
    showSymbol: props.node.series?.showSymbol ?? false,
    symbolSize: props.node.series?.symbolSize ?? 6,
    symbol: props.node.series?.symbol ?? 'circle'
  }
})

const handleSubmit = () => {
  const node: GraphNode<GraphBindSignalValue> = {
    ...props.node,
    name: form.value.name,
    color: form.value.color,
    yAxis: {
      ...props.node.yAxis,
      min: form.value.yAxis.min,
      max: form.value.yAxis.max,
      splitLine: {
        show: form.value.yAxis.splitLine.show
      }
    },
    xAxis: {
      splitLine: {
        show: form.value.xAxis.splitLine.show,
        lineStyle: {
          type: form.value.xAxis.splitLine.lineStyle.type
        }
      },
      axisPointer: {
        show: form.value.xAxis.axisPointer.show
      }
    },
    disZoom: form.value.disZoom,
    series: {
      showSymbol: form.value.series.showSymbol,
      symbolSize: form.value.series.symbolSize,
      symbol: form.value.series.symbol
    }
  }
  emit('save', node)
}

const handleCancel = () => {
  emit('cancel')
}

const isSignal = computed(() => props.node.type === 'signal')

// 修改折叠面板的初始状态为折叠
const activeCollapse = ref([]) // 默认折叠，空数组表示所有面板都折叠
</script>

<style scoped>
.edit-signal {
  display: flex;
  flex-direction: column;
}

.edit-signal__content {
  padding: 16px;
}

:deep(.el-collapse) {
  margin-bottom: 16px;
}

:deep(.el-descriptions) {
  margin: 8px 0;
}
</style>
