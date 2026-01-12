<template>
  <div class="edit-signal" :style="{ height: `${props.height}px` }">
    <el-scrollbar>
      <div class="edit-signal__content">
        <el-collapse v-if="props.node.type === 'signal'" v-model="activeCollapse">
          <el-collapse-item
            :title="i18next.t('uds.components.editSignal.collapse.signalInformation')"
            name="signal"
          >
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item
                :label="i18next.t('uds.components.editSignal.labels.database')"
                >{{ props.node.bindValue.dbName }}</el-descriptions-item
              >
              <el-descriptions-item
                :label="i18next.t('uds.components.editSignal.labels.signalName')"
                >{{ props.node.bindValue.signalName }}</el-descriptions-item
              >
              <el-descriptions-item :label="i18next.t('uds.components.editSignal.labels.frameId')"
                >0x{{ props.node.bindValue.frameId.toString(16) }}</el-descriptions-item
              >
              <el-descriptions-item
                :label="i18next.t('uds.components.editSignal.labels.startBit')"
                >{{ props.node.bindValue.startBit }}</el-descriptions-item
              >
              <el-descriptions-item
                :label="i18next.t('uds.components.editSignal.labels.bitLength')"
                >{{ props.node.bindValue.bitLength }}</el-descriptions-item
              >
            </el-descriptions>
          </el-collapse-item>
        </el-collapse>
        <el-collapse v-else-if="props.node.type === 'variable'" v-model="activeCollapse">
          <el-collapse-item
            :title="i18next.t('uds.components.editSignal.collapse.variableInformation')"
            name="variable"
          >
            <el-descriptions v-if="varInfo" :column="1" border size="small">
              <el-descriptions-item
                :label="i18next.t('uds.components.editSignal.labels.variableFullName')"
                >{{ varInfo.fullName }}</el-descriptions-item
              >
              <el-descriptions-item
                :label="i18next.t('uds.components.editSignal.labels.variableName')"
                >{{ varInfo.var?.name }}</el-descriptions-item
              >
              <el-descriptions-item
                :label="i18next.t('uds.components.editSignal.labels.variableType')"
                >{{ varInfo.var?.type.toUpperCase() }}</el-descriptions-item
              >
            </el-descriptions>

            <el-alert
              v-else
              :title="
                i18next.t('uds.components.editSignal.messages.variableNotFound', {
                  name: (props.node.bindValue as any).variableName
                })
              "
              type="warning"
              :description="i18next.t('uds.components.editSignal.messages.checkVariableWindow')"
              show-icon
            />
          </el-collapse-item>
        </el-collapse>

        <!-- 当type为variable时暂时不显示description -->

        <el-form :model="form" label-width="120px" size="small">
          <el-form-item :label="i18next.t('uds.components.editSignal.labels.name')">
            <el-input v-model="form.name" />
          </el-form-item>
          <el-form-item :label="i18next.t('uds.components.editSignal.labels.color')">
            <el-color-picker v-model="form.color" show-alpha />
          </el-form-item>
          <template v-if="props.stype == 'line'">
            <el-divider content-position="left">{{
              i18next.t('uds.components.editSignal.labels.yAxis')
            }}</el-divider>
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.yAxisMin')">
              <el-input-number v-model="form.yAxis.min" :controls="false" />
            </el-form-item>
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.yAxisMax')">
              <el-input-number v-model="form.yAxis.max" :controls="false" />
            </el-form-item>
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.splitLine')">
              <el-switch v-model="form.yAxis.splitLine.show" />
            </el-form-item>
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.disableZoom')">
              <el-switch v-model="form.disZoom" />
            </el-form-item>
            <el-divider content-position="left">{{
              i18next.t('uds.components.editSignal.labels.tooltip')
            }}</el-divider>
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.showTooltip')">
              <el-switch v-model="form.tooltip.show" />
            </el-form-item>

            <el-divider content-position="left">{{
              i18next.t('uds.components.editSignal.labels.xAxis')
            }}</el-divider>
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.showGrid')">
              <el-switch v-model="form.xAxis.splitLine.show" />
            </el-form-item>
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.gridStyle')">
              <el-select
                v-model="form.xAxis.splitLine.lineStyle.type"
                :disabled="!form.xAxis.splitLine.show"
              >
                <el-option
                  :label="i18next.t('uds.components.editSignal.options.solid')"
                  value="solid"
                />
                <el-option
                  :label="i18next.t('uds.components.editSignal.options.dashed')"
                  value="dashed"
                />
                <el-option
                  :label="i18next.t('uds.components.editSignal.options.dotted')"
                  value="dotted"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.showValue')">
              <el-switch v-model="form.xAxis.axisPointer.show" />
            </el-form-item>

            <el-divider content-position="left">{{
              i18next.t('uds.components.editSignal.labels.series')
            }}</el-divider>
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.step')">
              <el-select v-model="form.series.step">
                <el-option
                  :label="i18next.t('uds.components.editSignal.options.step')"
                  value="end"
                />
                <el-option
                  :label="i18next.t('uds.components.editSignal.options.line')"
                  :value="false"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.showPoints')">
              <el-switch v-model="form.series.showSymbol" />
            </el-form-item>
            <el-form-item
              v-if="form.series.showSymbol"
              :label="i18next.t('uds.components.editSignal.labels.pointSize')"
            >
              <el-input-number v-model="form.series.symbolSize" :min="2" :max="10" :step="1" />
            </el-form-item>
            <el-form-item
              v-if="form.series.showSymbol"
              :label="i18next.t('uds.components.editSignal.labels.pointStyle')"
            >
              <el-select v-model="form.series.symbol">
                <el-option
                  :label="i18next.t('uds.components.editSignal.options.circle')"
                  value="circle"
                />
                <el-option
                  :label="i18next.t('uds.components.editSignal.options.rectangle')"
                  value="rect"
                />
                <el-option
                  :label="i18next.t('uds.components.editSignal.options.triangle')"
                  value="triangle"
                />
                <el-option
                  :label="i18next.t('uds.components.editSignal.options.diamond')"
                  value="diamond"
                />
              </el-select>
            </el-form-item>
          </template>
          <template v-if="props.stype == 'gauge'">
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.min')">
              <el-input-number v-model="form.yAxis.min" :controls="false" />
            </el-form-item>
            <el-form-item :label="i18next.t('uds.components.editSignal.labels.max')">
              <el-input-number v-model="form.yAxis.max" :controls="false" />
            </el-form-item>
          </template>

          <el-form-item>
            <el-button type="primary" @click="handleSubmit">{{
              i18next.t('uds.components.editSignal.buttons.save')
            }}</el-button>
            <el-button @click="handleCancel">{{
              i18next.t('uds.components.editSignal.buttons.cancel')
            }}</el-button>
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
import i18next from 'i18next'
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
  tooltip: {
    show: props.node.tooltip?.show ?? true
  },
  series: {
    step: props.node.series?.step,
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
      },
      name: form.value.name
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
    tooltip: {
      show: form.value.tooltip.show
    },
    series: {
      step: form.value.series.step,
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
