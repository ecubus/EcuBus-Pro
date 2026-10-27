<template>
  <div>
    <el-input
      v-model="search"
      size="small"
      clearable
      :placeholder="i18next.t('uds.cdd.searchFaultCodes', { defaultValue: 'Search fault codes' })"
      :aria-label="i18next.t('uds.cdd.searchFaultCodes', { defaultValue: 'Search fault codes' })"
      style="max-width: 360px; margin-bottom: 8px"
    />
    <el-table
      :data="filteredRows"
      border
      size="small"
      :max-height="420"
      :empty-text="i18next.t('uds.cdd.noData', { defaultValue: 'No data' })"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <el-descriptions :column="1" border size="small" class="dtc-properties">
            <el-descriptions-item
              v-for="(value, name) in row.properties"
              :key="name"
              :label="String(name)"
            >
              {{ propertyValue(value) }}
            </el-descriptions-item>
          </el-descriptions>
        </template>
      </el-table-column>
      <el-table-column
        :label="i18next.t('uds.cdd.rawCode', { defaultValue: 'Raw code' })"
        width="110"
      >
        <template #default="{ row }">
          <span class="dtc-code">{{ rawCode(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="dtc" label="DTC" width="90" />
      <el-table-column
        prop="failureType"
        :label="i18next.t('uds.cdd.failureType', { defaultValue: 'Failure type' })"
        width="110"
      />
      <el-table-column
        prop="failureTypeText"
        :label="i18next.t('uds.cdd.failureTypeText', { defaultValue: 'Failure description' })"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="errorText"
        :label="i18next.t('uds.cdd.description', { defaultValue: 'Description' })"
        min-width="240"
        show-overflow-tooltip
      />
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import i18next from 'i18next'
import type { CddDtc } from 'nodeCan/cdd'

const props = defineProps<{ rows: CddDtc[] }>()
const search = ref('')

function rawCode(dtc: CddDtc) {
  const bits = dtc.bitLength ?? (dtc.failureType == null ? 16 : 24)
  return `0x${dtc.raw
    .toString(16)
    .toUpperCase()
    .padStart(bits / 4, '0')}`
}

function propertyValue(value: unknown) {
  return value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)
}

const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.rows.filter((row) =>
    [rawCode(row), row.dtc, row.failureType, row.failureTypeText, row.errorText]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  )
})
</script>

<style scoped>
.dtc-code {
  font-family: monospace;
}

.dtc-properties {
  margin: 8px 16px;
}
</style>
