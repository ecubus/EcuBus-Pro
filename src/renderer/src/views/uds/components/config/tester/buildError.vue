<template>
  <div>
    <div v-if="props.useDiv">
      <el-table
        :data="errorData"
        size="small"
        border
        resizable
        :style="{
          height: height + 'px',
          overflowY: 'auto'
        }"
      >
        <el-table-column property="file" label="File" width="200" />
        <el-table-column property="line" label="Line" width="100" />
        <el-table-column property="message" label="Error" />
      </el-table>
    </div>
    <el-dialog
      v-else
      v-model="dialogFormVisible"
      title="Errors"
      width="80%"
      align-center
      size="small"
      :append-to="props.body"
    >
      <template #header>
        <span style="color: var(--el-color-danger); font-size: 20px"
          >Build Errors ({{ errorData.length }})</span
        >
      </template>
      <el-table
        :data="errorData"
        size="small"
        border
        resizable
        :style="{
          height: height - 200 + 'px',
          overflowY: 'auto'
        }"
      >
        <el-table-column property="file" label="File" width="200" />
        <el-table-column property="line" label="Line" width="100" />
        <el-table-column property="message" label="Error" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { over } from 'lodash'
import { computed, toRef } from 'vue'

const dialogFormVisible = defineModel()

const props = defineProps<{
  errorData: {
    file: string
    line: number
    message: string
  }[]
  body?: string
  height: number
  useDiv?: boolean
}>()

const height = toRef(props, 'height')
const errorData = computed(() => props.errorData)
</script>
<style scoped></style>
