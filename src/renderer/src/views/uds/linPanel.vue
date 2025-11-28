<template>
  <div style="display: relative">
    <VxeGrid ref="xGrid" v-bind="gridOptions" class="sequenceTable" :data="tableData">
      <template #toolbar>
        <div
          style="
            justify-content: flex-start;
            display: flex;
            align-items: center;
            gap: 4px;
            margin-left: 5px;
            padding: 6px 4px;
          "
        >
          <Icon :icon="databaseIcon" />
          <span>Database:</span>
          <span style="color: var(--el-color-primary)">{{ db?.name || 'None' }}</span>
          <el-divider direction="vertical"></el-divider>
          <Icon :icon="nodeIcon" />
          <span>Node:</span>
          <span style="color: var(--el-color-primary)">{{ workNode || 'None' }}</span>
          <el-divider direction="vertical"></el-divider>
          <el-button size="small" type="warning" link @click="resetAllSignals">
            <Icon :icon="resetIcon" />
            Reset All
          </el-button>
        </div>
      </template>

      <template #expand_content="parent">
        <div class="expand-wrapper">
          <VxeGrid v-bind="childGridOptions" :data="parent.row.childList">
            <template #physical="{ row }">
              <el-input
                v-if="hasPhysicalEncoding(row.encodingType)"
                v-model="physicalValues[`${parent.row.name}-${row.name}`]"
                size="small"
                style="width: 100px"
                @change="handlePhysicalValueChange($event, parent.row.name, row)"
              />
              <el-select
                v-else-if="getLogicalValue(row.encodingType).length > 0"
                v-model="rawValues[`${parent.row.name}-${row.name}`]"
                size="small"
                style="width: 100%"
                @change="handleRawValueChange($event, parent.row.name, row)"
              >
                <el-option
                  v-for="item in getLogicalValue(row.encodingType)"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                ></el-option>
              </el-select>
              <span v-else>-</span>
            </template>
            <template #raw="{ row }">
              <el-input
                v-model="rawValues[`${parent.row.name}-${row.name}`]"
                size="small"
                style="width: 100px"
                @change="handleRawValueChange($event, parent.row.name, row)"
              />
            </template>
          </VxeGrid>
        </div>
      </template>
      <template #frameData="{ row }">
        <span>{{ getFrameDataHex(row.name) }}</span>
      </template>
    </VxeGrid>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, toRef, nextTick, watch, watchEffect } from 'vue'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { Icon } from '@iconify/vue'
import databaseIcon from '@iconify/icons-material-symbols/database'
import nodeIcon from '@iconify/icons-material-symbols/settings-ethernet'
import resetIcon from '@iconify/icons-material-symbols/restart-alt'
import { ElMessage } from 'element-plus'
import { useDataStore } from '@r/stores/data'
import { LDF, getFrameSize } from '@r/database/ldfParse'
import { LinInter } from 'src/preload/data'
import { getFrameData } from 'nodeCan/lin'
import { isEqual } from 'lodash'
import { getPhysicalValue, getRawValue } from '@r/database/ldf/calc'
import { useGlobalStart } from '@r/stores/runtime'

interface SignalRow {
  name: string
  encodingType?: string
  bitLength: number
}

interface FrameRow {
  name: string
  childList: SignalRow[]
}

const props = defineProps<{
  height: number
  editIndex: string
}>()
const globalStart = useGlobalStart()
const h = toRef(props, 'height')
const editIndex = toRef(props, 'editIndex')
const dataBase = useDataStore()

const dbKey = computed(() => {
  const node = dataBase.nodes[editIndex.value]
  if (node.workNode) {
    const dbName = node.workNode.split(':')[0]

    for (const [key, ld] of Object.entries(dataBase.database.lin)) {
      if (ld.name == dbName) {
        return key
      }
    }
  }
  return ''
})

const db = computed(() => {
  const node = dataBase.nodes[editIndex.value]
  if (node.workNode) {
    const dbName = node.workNode.split(':')[0]

    for (const [key, ld] of Object.entries(dataBase.database.lin)) {
      if (ld.name == dbName) {
        return ld
      }
    }
  }
  return null
})
const workNode = computed(() => {
  const node = dataBase.nodes[editIndex.value]
  if (node.workNode) {
    return node.workNode.split(':')[1]
  }
  return ''
})

const physicalValues = ref<Record<string, string>>({})
const rawValues = ref<Record<string, string>>({})

// Add function to check if encoding has physical value type
const hasPhysicalEncoding = (encodingType?: string) => {
  if (!encodingType || !db.value) return false
  const encoding = db.value.signalEncodeTypes[encodingType]
  if (!encoding) return false

  return encoding.encodingTypes.some((type) => type.type === 'physicalValue')
}

const getLogicalValue = (encodingType?: string) => {
  const list: {
    label: string
    value: string
  }[] = []
  if (!encodingType || !db.value) return list

  const encoding = db.value.signalEncodeTypes[encodingType]
  if (!encoding) return list

  for (const type of encoding.encodingTypes) {
    if (type.type === 'logicalValue') {
      list.push({
        label: type.logicalValue!.textInfo || `${type.logicalValue!.signalValue}`,
        value: type.logicalValue!.signalValue.toString()
      })
    }
  }
  return list
}

// 修改工具函数
const updateSignalDisplayValues = (
  frameName: string,
  signal: SignalRow,
  restore: boolean = true
) => {
  if (!db.value) return

  const signalDef = db.value.signals[signal.name]

  // 如果没有上一次的值或不需要恢复，则使用初始值
  const rawValue = restore ? (signalDef.value ?? signalDef.initValue) : signalDef.initValue
  const rawValueStr = Array.isArray(rawValue) ? rawValue.join(',') : rawValue?.toString()
  rawValues.value[`${frameName}-${signal.name}`] = rawValueStr || ''
  if (signal.encodingType) {
    const encodeInfo = db.value.signalEncodeTypes[signal.encodingType]
    const { numVal, strVal, usedEncode } = getPhysicalValue(
      Number(rawValueStr),
      encodeInfo.encodingTypes,
      db.value
    )
    if (usedEncode) {
      physicalValues.value[`${frameName}-${signal.name}`] =
        numVal !== undefined ? numVal.toString() : ''
    }
  }
}

// Update tableData to only show relevant frames
const tableData = computed(() => {
  const frames: FrameRow[] = []
  if (!db.value || !workNode.value) {
    return frames
  }

  for (const [frameName, frame] of Object.entries(db.value.frames)) {
    // Only show frames where workNode is publisher or subscriber
    if (frame.publishedBy !== workNode.value) {
      continue
    }

    const frameRow: FrameRow = {
      name: frameName,
      childList: []
    }

    // Add signals for this frame
    for (const signal of frame.signals) {
      const signalDef = db.value.signals[signal.name]
      const encodingType = Object.entries(db.value.signalRep).find(([_, signals]) =>
        signals.includes(signal.name)
      )?.[0]

      frameRow.childList.push({
        name: signal.name,
        encodingType,
        bitLength: signalDef.signalSizeBits
      })
    }

    frames.push(frameRow)
  }

  return frames
})

const gridOptions = computed(() => {
  const options: VxeGridProps<FrameRow> = {
    expandConfig: {
      expandAll: true,
      padding: false,
      reserve: true
    },

    border: true,
    size: 'mini',
    columnConfig: {
      resizable: true
    },
    height: props.height,
    showOverflow: true,
    scrollY: {
      enabled: false,
      gt: 0
    },
    rowConfig: {
      isCurrent: true,
      keyField: 'name'
    },
    toolbarConfig: {
      slots: {
        tools: 'toolbar'
      }
    },

    align: 'center',
    columns: [
      { type: 'expand', width: 46, slots: { content: 'expand_content' }, resizable: false },
      { field: 'name', title: 'Frame', width: 200, align: 'left' },
      {
        field: 'frameData',
        title: 'Frame Data (Hex)',
        minWidth: 200,
        slots: { default: 'frameData' },
        align: 'left'
      }
    ]
  }

  return options
})

const childGridOptions = computed(() => {
  const options: VxeGridProps<SignalRow> = {
    border: true,
    size: 'mini',
    columnConfig: { resizable: true },
    showOverflow: true,
    align: 'center',
    columns: [
      { field: 'name', title: 'Signal', width: 200, align: 'left' },
      { field: 'bitLength', title: 'Bits', width: 100 },
      {
        field: 'physicalValue',
        title: 'Physical/Logical Value',
        minWidth: 200,
        slots: { default: 'physical' }
      },
      { field: 'rawValue', title: 'Raw Value', minWidth: 200, slots: { default: 'raw' } }
    ]
  }

  return options
})

// const validatePhysicalValue = (value: string, signal: SignalRow): boolean => {
//   if (!db.value || !signal.encodingType) return false
//   const encoding = db.value.signalEncodeTypes[signal.encodingType]
//   if (!encoding) return false

//   const numValue = Number(value)
//   if (isNaN(numValue)) return false

//   for (const type of encoding.encodingTypes) {
//     if (type.type === 'physicalValue' && type.physicalValue) {
//       const { minValue, maxValue, scale, offset } = type.physicalValue

//       // Validate encoding range according to LIN spec
//       if (minValue < 0 || maxValue > 65535 || minValue > maxValue) {
//         return false
//       }

//       // Calculate corresponding raw value
//       const rawValue = (numValue - offset) / scale

//       // Raw value must be within min/max range and be an integer
//       if (rawValue >= minValue && rawValue <= maxValue && Number.isInteger(rawValue)) {
//         return true
//       }
//     }
//   }
//   return false
// }

const validateRawValue = (value: string, signal: SignalRow): boolean => {
  if (!db.value) return false
  const signalDef = db.value.signals[signal.name]
  if (!signalDef) return false

  // Handle array type signals
  if (signalDef.singleType === 'ByteArray') {
    const values = value.split(',').map((v) => Number(v.trim()))
    if (values.length != signalDef.signalSizeBits / 8) {
      return false
    }
    // Check if all values are valid numbers
    if (values.some((v) => isNaN(v))) return false
    // Check array length
    if (Array.isArray(signalDef.initValue) && values.length !== signalDef.initValue.length)
      return false
    // Check each value range
    return values.every((v) => v >= 0 && v <= 255)
  }

  // Handle scalar type signals
  const numValue = Number(value)
  if (isNaN(numValue)) return false
  const maxValue = Math.pow(2, signalDef.signalSizeBits) - 1
  return numValue >= 0 && numValue <= maxValue
}

const handlePhysicalValueChange = (value: string, frameName: string, signal: SignalRow) => {
  if (!db.value) return
  if (!signal.encodingType) return
  const encodeInfo = db.value.signalEncodeTypes[signal.encodingType]
  const val = getRawValue(Number(value), encodeInfo.encodingTypes, db.value)
  if (val.value === undefined) {
    updateSignalDisplayValues(frameName, signal, true)
    return
  }

  if (!db.value) return

  rawValues.value[`${frameName}-${signal.name}`] = val.value.toString()
  // 更新数据库
  updateSignalValue(frameName, signal.name, val.value)
}

const handleRawValueChange = (value: string, frameName: string, signal: SignalRow) => {
  if (!validateRawValue(value, signal) || value == '') {
    updateSignalDisplayValues(frameName, signal, true)
    return
  }

  if (!db.value) return
  const signalDef = db.value.signals[signal.name]

  // Handle array type signals
  if (signalDef.singleType === 'ByteArray') {
    const values = value.split(',').map((v) => Number(v.trim()))
    updateSignalValue(frameName, signal.name, values)
  } else {
    const numValue = Number(value)

    // Validate physical value if encoding exists
    if (signal.encodingType) {
      const encodeInfo = db.value.signalEncodeTypes[signal.encodingType]
      const { numVal, strVal, usedEncode } = getPhysicalValue(
        numValue,
        encodeInfo.encodingTypes,
        db.value
      )
      if (usedEncode) {
        //

        physicalValues.value[`${frameName}-${signal.name}`] =
          numVal !== undefined ? numVal.toString() : ''
      }
    }
    updateSignalValue(frameName, signal.name, numValue)
  }
}

const resetAllSignals = () => {
  if (!db.value) return

  for (const frame of tableData.value) {
    for (const signal of frame.childList) {
      const signalDef = db.value.signals[signal.name]
      if (!signalDef) continue

      updateSignalDisplayValues(frame.name, signal, false) // 使用初始值
      // Update database value
      updateSignalValue(frame.name, signal.name, signalDef.initValue)
    }
  }
}

// Modify updateSignalValue to handle arrays
const updateSignalValue = (frameName: string, signalName: string, value: number | number[]) => {
  if (!db.value) return
  if (db.value.signals[signalName]) {
    db.value.signals[signalName].value = value
  }
  if (globalStart.value) {
    window.electron.ipcRenderer.send('ipc-update-lin-signals', dbKey.value, signalName, value)
  }
}

const getFrameDataHex = (frameName: string): string => {
  if (!db.value) return ''
  const frame = db.value.frames[frameName]
  if (!frame) return ''
  const frameData = getFrameData(db.value, frame)
  const r = frameData.toString('hex').toUpperCase()
  //add space every 2 characters
  return r.match(/.{1,2}/g)?.join(' ') ?? ''
}

// 修改 watch 和 onMounted 中的初始化调用
watch([db, workNode], () => {
  physicalValues.value = {}
  rawValues.value = {}
  nextTick(() => {
    for (const frame of tableData.value) {
      for (const signal of frame.childList) {
        updateSignalDisplayValues(frame.name, signal, true) // 使用初始值
      }
    }
  })
})

onMounted(() => {
  for (const frame of tableData.value) {
    for (const signal of frame.childList) {
      updateSignalDisplayValues(frame.name, signal, true) // 使用初始值
    }
  }
})
</script>

<style lang="scss">
.expand-wrapper {
  padding-left: 45px;
}

.no-encoding {
  // Style for disabled inputs
  .el-input__inner {
    background-color: var(--el-fill-color-lighter);
    color: var(--el-text-color-secondary);
    cursor: not-allowed;
  }
}
</style>
