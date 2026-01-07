<template>
  <el-dialog
    v-if="dialogVisible"
    v-model="dialogVisible"
    :title="
      i18next.t('uds.hardware.bitTimingCalculator.dialogs.title', {
        bitRate: form.bitRate,
        clockFreq: form.clockFreq
      })
    "
    width="80%"
    align-center
    append-to="#winhardware"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <el-table
      :empty-text="i18next.t('uds.hardware.bitTimingCalculator.table.emptyText')"
      :data="results"
      style="width: 100%"
      border
      size="small"
      :height="props.height - 100"
      highlight-current-row
      :current-row="selectedRow"
      @current-change="handleCurrentChange"
    >
      <el-table-column type="index" width="40" label="#" :resizable="false" align="center" />
      <el-table-column
        prop="sp"
        :label="i18next.t('uds.hardware.bitTimingCalculator.table.samplePoint')"
        min-width="140"
        align="center"
        sortable
        :resizable="false"
      />
      <el-table-column
        prop="t1"
        :label="i18next.t('uds.hardware.bitTimingCalculator.table.tseg1')"
        min-width="100"
        sortable
        :resizable="false"
      />
      <el-table-column
        prop="t2"
        :label="i18next.t('uds.hardware.bitTimingCalculator.table.tseg2')"
        width="100"
        sortable
        :resizable="false"
      />

      <el-table-column
        prop="presc"
        :label="i18next.t('uds.hardware.bitTimingCalculator.table.prescaler')"
        width="100"
        sortable
        :resizable="false"
      />
    </el-table>

    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" :disabled="!selectedRow" size="small" plain @click="onOk">{{
          i18next.t('uds.hardware.bitTimingCalculator.buttons.ok')
        }}</el-button>
        <el-button size="small" @click="dialogVisible = false">{{
          i18next.t('uds.hardware.bitTimingCalculator.buttons.cancel')
        }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { CanVendor } from 'nodeCan/can'
import { i18next } from '@r/i18n'

interface CalculatorResult {
  t1: number
  t2: number
  sp: number
  sjw: number
  presc: number
}

const props = defineProps<{
  freq: number
  clock: number
  height: number
  vendor: CanVendor
  ability: Record<string, any>
}>()
const dialogVisible = defineModel<boolean>('modelValue')
const emit = defineEmits<{
  (e: 'result', result: { t1: number; t2: number; sjw: number; presc: number }): void
}>()

const form = ref({
  clockFreq: props.clock,
  bitRate: props.freq / 1000
})

const results = ref<CalculatorResult[]>([])
const selectedRow = ref<CalculatorResult | null>(null)

function calculate() {
  const clock = form.value.clockFreq * 1000000
  const bitrate = form.value.bitRate * 1000

  const newResults: CalculatorResult[] = []

  // Get limits from ability
  const prescalerMin = props.ability.preScaler?.min || 1
  const prescalerMax = props.ability.preScaler?.max || 64
  const tseg1Min = props.ability.tsg1?.min || 2
  const tseg1Max = props.ability.tsg1?.max || 256
  const tseg2Min = props.ability.tsg2?.min || 1
  const tseg2Max = props.ability.tsg2?.max || 128

  // Calculate target number of time quanta
  const targetTq = clock / bitrate

  // Enumerate all possible combinations
  for (let presc = prescalerMin; presc <= prescalerMax; presc++) {
    // Skip if clock/prescaler is not integer
    if (clock % presc !== 0) continue

    // Calculate total time quanta for this prescaler
    const totalTq = Math.round(targetTq / presc)

    // Enumerate all possible TSEG1 values
    for (let t1 = tseg1Min; t1 <= tseg1Max; t1++) {
      // Calculate TSEG2 based on total time quanta
      const t2 = totalTq - t1 - 1 // Subtract 1 for sync segment

      // Skip if TSEG2 is outside valid range
      if (t2 < tseg2Min || t2 > tseg2Max) continue

      // Skip if TSEG1 is less than TSEG2
      if (t1 < t2) continue

      // Calculate sample point percentage using the correct formula
      const sp = Math.round(((t1 + 1) / (t1 + t2 + 1)) * 10000) / 100

      // Add valid combination to results
      newResults.push({
        t1,
        t2,
        sp,
        sjw: 1, // Default SJW to 1 as per requirements
        presc
      })
    }
  }

  // Sort results by sp
  results.value = newResults.sort((a, b) => a.sp - b.sp)
}

function handleCurrentChange(row: CalculatorResult) {
  selectedRow.value = row
}

function onOk() {
  if (selectedRow.value) {
    emit('result', {
      t1: selectedRow.value.t1,
      t2: selectedRow.value.t2,
      sjw: selectedRow.value.sjw,
      presc: selectedRow.value.presc
    })
    dialogVisible.value = false
  }
}

onMounted(() => {
  calculate()
})
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
