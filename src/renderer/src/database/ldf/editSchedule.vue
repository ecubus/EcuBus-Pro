<template>
  <div :id="tableId">
    <VxeGrid ref="xGrid" v-bind="gridOptions" @cell-click="cellClick">
      <template #toolbar>
        <div class="schedule-toolbar">
          <!-- 添加帧表单区域 -->
          <div class="add-frame-form">
            <el-form
              ref="formRef"
              :model="addFrameForm"
              :rules="formRules"
              :inline="true"
              size="small"
            >
              <el-form-item label="Frame Type" prop="type">
                <el-select
                  v-model="addFrameForm.type"
                  style="width: 160px"
                  @change="handleFrameTypeChange"
                >
                  <el-option label="Normal Frame" value="existing" />
                  <el-option label="Event Triggered" value="EventTrigger" />
                  <el-option label="Sporadic" value="Sporadic" />
                  <el-option label="Diagnostic" value="Diagnostic" />
                  <el-option label="AssignNAD" value="AssignNAD" />
                  <el-option label="AssignFrameId" value="AssignFrameId" />
                  <el-option label="ConditionalChangeNAD" value="ConditionalChangeNAD" />
                  <el-option label="DataDump" value="DataDump" />
                  <el-option label="SaveConfiguration" value="SaveConfiguration" />
                  <el-option label="AssignFrameIdRange" value="AssignFrameIdRange" />
                </el-select>
              </el-form-item>

              <!-- Existing Frame Selection -->
              <template v-if="addFrameForm.type === 'existing'">
                <el-form-item label="Frame" prop="frameName">
                  <el-select v-model="addFrameForm.frameName" style="width: 200px">
                    <el-option
                      v-for="frame in availableFrames"
                      :key="frame"
                      :label="frame"
                      :value="frame"
                    />
                  </el-select>
                </el-form-item>
              </template>

              <!-- Event Triggered Frame Form -->
              <template v-if="addFrameForm.type === 'EventTrigger'">
                <el-form-item label="Name" prop="name">
                  <el-input v-model="addFrameForm.name" style="width: 150px" />
                </el-form-item>
                <el-form-item label="Frame ID" prop="frameId">
                  <el-input v-model="addFrameForm.frameId" style="width: 100px" />
                </el-form-item>
                <el-form-item label="Frames" prop="frameNames">
                  <el-select
                    v-model="addFrameForm.frameNames"
                    multiple
                    collapse-tags
                    style="width: 200px"
                  >
                    <el-option
                      v-for="frame in availableFrames"
                      :key="frame"
                      :label="frame"
                      :value="frame"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="Schedule Table" prop="scheduleName">
                  <el-select v-model="addFrameForm.scheduleName" style="width: 200px">
                    <el-option
                      v-for="schName in props.schNames"
                      :key="schName"
                      :label="schName"
                      :value="schName"
                    />
                  </el-select>
                </el-form-item>
              </template>

              <!-- 添加 Sporadic Frame Form -->
              <template v-if="addFrameForm.type === 'Sporadic'">
                <el-form-item label="Name" prop="name">
                  <el-input v-model="addFrameForm.name" style="width: 150px" />
                </el-form-item>
                <el-form-item label="Frames" prop="frameNames">
                  <el-select
                    v-model="addFrameForm.frameNames"
                    multiple
                    collapse-tags
                    style="width: 200px"
                  >
                    <el-option
                      v-for="frame in masterFrames"
                      :key="frame"
                      :label="frame"
                      :value="frame"
                    />
                  </el-select>
                </el-form-item>
              </template>

              <!-- Diagnostic Frame Form -->
              <template v-if="addFrameForm.type === 'Diagnostic'">
                <el-form-item label="Type" prop="diagnosticType">
                  <el-select v-model="addFrameForm.diagnosticType" style="width: 120px">
                    <el-option label="MasterReq" value="MasterReq" />
                    <el-option label="SlaveResp" value="SlaveResp" />
                  </el-select>
                </el-form-item>
              </template>

              <!-- Node Selection for commands that need it -->
              <template
                v-if="
                  ['AssignNAD', 'SaveConfiguration', 'AssignFrameId'].includes(addFrameForm.type)
                "
              >
                <el-form-item label="Node" prop="nodeName">
                  <el-select v-model="addFrameForm.nodeName" style="width: 150px">
                    <el-option
                      v-for="node in props.ldf.node.salveNode"
                      :key="node"
                      :label="node"
                      :value="node"
                    />
                  </el-select>
                </el-form-item>
              </template>

              <!-- 添加AssignFrameId的表单部分 -->
              <template v-if="addFrameForm.type === 'AssignFrameId'">
                <el-form-item label="Frame" prop="frameName">
                  <el-select v-model="addFrameForm.frameName" style="width: 200px">
                    <el-option
                      v-for="frame in availableConfigFrames"
                      :key="frame"
                      :label="frame"
                      :value="frame"
                    />
                  </el-select>
                </el-form-item>
              </template>

              <!-- 添加ConditionalChangeNAD表单部分 -->
              <template v-if="addFrameForm.type === 'ConditionalChangeNAD'">
                <el-form-item label="NAD" prop="nad">
                  <el-input-number
                    v-model="addFrameForm.nad"
                    :min="0"
                    :max="255"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="ID" prop="id">
                  <el-input-number
                    v-model="addFrameForm.id"
                    :min="0"
                    :max="65535"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="Byte" prop="byte">
                  <el-input-number
                    v-model="addFrameForm.byte"
                    :min="0"
                    :max="255"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="Mask" prop="mask">
                  <el-input-number
                    v-model="addFrameForm.mask"
                    :min="0"
                    :max="255"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="Inv" prop="inv">
                  <el-input-number
                    v-model="addFrameForm.inv"
                    :min="0"
                    :max="255"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="New NAD" prop="newNad">
                  <el-input-number
                    v-model="addFrameForm.newNad"
                    :min="0"
                    :max="255"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
              </template>

              <!-- 添加DataDump表单部分 -->
              <template v-if="addFrameForm.type === 'DataDump'">
                <el-form-item label="Node" prop="nodeName">
                  <el-select v-model="addFrameForm.nodeName" style="width: 150px">
                    <el-option
                      v-for="node in props.ldf.node.salveNode"
                      :key="node"
                      :label="node"
                      :value="node"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="D1" prop="D1">
                  <el-input-number
                    v-model="addFrameForm.D1"
                    :min="0"
                    :max="255"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="D2" prop="D2">
                  <el-input-number
                    v-model="addFrameForm.D2"
                    :min="0"
                    :max="255"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="D3" prop="D3">
                  <el-input-number
                    v-model="addFrameForm.D3"
                    :min="0"
                    :max="255"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="D4" prop="D4">
                  <el-input-number
                    v-model="addFrameForm.D4"
                    :min="0"
                    :max="255"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="D5" prop="D5">
                  <el-input-number
                    v-model="addFrameForm.D5"
                    :min="0"
                    :max="255"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
              </template>

              <!-- 添加AssignFrameIdRange表单部分 -->
              <template v-if="addFrameForm.type === 'AssignFrameIdRange'">
                <el-form-item label="Node" prop="nodeName">
                  <el-select v-model="addFrameForm.nodeName" style="width: 150px">
                    <el-option
                      v-for="node in props.ldf.node.salveNode"
                      :key="node"
                      :label="node"
                      :value="node"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="Frame Index" prop="frameIndex">
                  <el-input-number
                    v-model="addFrameForm.frameIndex"
                    :min="0"
                    :max="3"
                    style="width: 100px"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="Frame PIDs" prop="framePIDs">
                  <div style="display: flex; gap: 8px">
                    <el-input-number
                      v-for="(_, index) in 4"
                      :key="index"
                      v-model="addFrameForm.framePIDs[index]"
                      :min="0"
                      :max="63"
                      style="width: 80px"
                      controls-position="right"
                      placeholder="PID"
                    />
                  </div>
                </el-form-item>
              </template>

              <el-form-item>
                <el-button type="primary" plain @click="submitForm">Add Frame</el-button>
                <el-button type="danger" plain :disabled="selectedIndex < 0" @click="deleteFrame">
                  <Icon :icon="deleteIcon" />
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </template>

      <!-- 新增操作列模板 -->
      <template #default_operate>
        <el-button-group>
          <el-button link type="danger" title="Delete Frame" @click="deleteFrame">
            <Icon :icon="deleteIcon" />
          </el-button>
        </el-button-group>
      </template>

      <template #default_drag>
        <el-icon :id="'schDragBtn' + editIndex" class="drag-btn" @mouseenter="rowDrop">
          <Grid />
        </el-icon>
      </template>

      <template #default_name="{ row }">
        {{ getFrameDisplayName(row) }}
      </template>

      <template #default_id="{ row }">
        <el-tag v-if="getFrameId(row)" size="small">0x{{ getFrameId(row) }}</el-tag>
      </template>

      <template #default_type="{ row }">
        <el-tag>{{ getFrameType(row) }}</el-tag>
      </template>

      <template #edit_delay="{ row }">
        <el-input-number
          v-model="row.delay"
          :min="0"
          :step="1"
          size="small"
          controls-position="right"
          @change="updateDelay(row)"
        />
      </template>

      <template #default_minTime="{ row }">
        {{ calculateFrameTime(row).minTime }}
      </template>

      <template #default_maxTime="{ row }">
        {{ calculateFrameTime(row).maxTime }}
      </template>
    </VxeGrid>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, h, inject, Ref, toRef, onMounted } from 'vue'
import { VxeGrid, VxeGridProps } from 'vxe-table'
import { Icon } from '@iconify/vue'
import { ElMessageBox, ElNotification, ElOption, ElSelect } from 'element-plus'
import { Grid, ArrowDown } from '@element-plus/icons-vue'
import fileOpenOutline from '@iconify/icons-material-symbols/file-open-outline'
import addIcon from '@iconify/icons-material-symbols/add'
import deleteIcon from '@iconify/icons-material-symbols/delete'
import Sortable from 'sortablejs'
import { LDF, SchTable, getFrameSize } from '../ldfParse'
import type { FormInstance, FormRules } from 'element-plus'
import Schema from 'async-validator'

const props = defineProps<{
  editIndex: string
  ldf: LDF
  rules: FormRules
  schNames: string[] // 添加可用的调度表名称列表
}>()

const schedule = defineModel<SchTable>({
  required: true
})
const ldf = toRef(props, 'ldf')
const selectedIndex = ref(-1)

type Entry = (typeof schedule.value.entries)[0]

const tableId = computed(() => {
  return `scheduleTable${props.editIndex}`
})
const height = inject('height') as Ref<number>
const gridOptions = computed<VxeGridProps<Entry>>(() => ({
  border: true,
  size: 'mini',
  height: (height.value / 3) * 2,
  showOverflow: true,
  columnConfig: { resizable: true },
  rowConfig: { isCurrent: true },
  toolbarConfig: { slots: { tools: 'toolbar' } },
  editConfig: {
    trigger: 'click',
    mode: 'cell',
    showIcon: false
  },
  id: tableId.value,
  columns: [
    {
      field: 'drag',
      title: '',
      width: 36,
      fixed: 'left',
      resizable: false,
      slots: { default: 'default_drag' }
    },

    {
      field: 'name',
      title: 'Frame',
      minWidth: 200,
      slots: { default: 'default_name' }
    },
    {
      field: 'id',
      title: 'ID',
      width: 80,
      slots: { default: 'default_id' }
    },
    {
      field: 'type',
      title: 'Type',
      width: 200,
      slots: { default: 'default_type' }
    },
    {
      field: 'delay',
      title: 'Delay [ms]',
      width: 150,
      editRender: {},
      slots: { edit: 'edit_delay' }
    },
    {
      field: 'minTime',
      title: 'Min Time [ms]',
      width: 120,
      slots: { default: 'default_minTime' }
    },
    {
      field: 'maxTime',
      title: 'Max Time [ms]',
      width: 120,
      slots: { default: 'default_maxTime' }
    }
  ],
  data: schedule.value.entries,
  rowClassName: ({ row }) => {
    let className = ''
    for (const error of errors.value) {
      const errArray = error.split(' ')
      if (errArray.indexOf(row.name) !== -1) {
        className = 'ldf-danger-row'
        break
      }
    }
    return className
  }
}))

// 帧显示名称计算
function getFrameDisplayName(entry: Entry) {
  if (entry.isCommand) {
    if (entry.name === 'DiagnosticMasterReq') return 'MasterReq'
    if (entry.name === 'DiagnosticSlaveResp') return 'SlaveResp'
    return entry.name
  }
  return entry.name
}

// 帧ID计算
function getFrameId(entry: Entry) {
  if (entry.isCommand) {
    if (entry.name === 'DiagnosticMasterReq') return '3C'
    if (entry.name === 'DiagnosticSlaveResp') return '3D'
    return undefined
  }

  const frame = props.ldf.frames[entry.name]
  if (frame) {
    return frame.id.toString(16)
  }

  const eventFrame = props.ldf.eventTriggeredFrames[entry.name]
  if (eventFrame) {
    return eventFrame.frameId.toString(16)
  }

  return undefined
}

// 帧类型计算
function getFrameType(entry: Entry) {
  if (entry.isCommand) {
    return entry.name
  }

  if (entry.name in props.ldf.frames) {
    return 'Unconditional'
  }
  if (entry.name in props.ldf.eventTriggeredFrames) {
    return 'Event Triggered'
  }
  if (entry.name in props.ldf.sporadicFrames) {
    return 'Sporadic'
  }
  return ''
}

// 帧时间计算
function calculateFrameTime(entry: Entry) {
  const frameSize = entry.isCommand ? 8 : getFrameSize(props.ldf, entry.name)
  const baudRate = props.ldf.global.LIN_speed
  const baseTime = (frameSize * 10 + 44) * (1 / baudRate)

  return {
    minTime: baseTime.toFixed(2),
    maxTime: (baseTime * 1.4).toFixed(2)
  }
}

function cellClick({ rowIndex }) {
  selectedIndex.value = rowIndex
}

const selectedFrame = ref('')

// 新增表单状态
const addFrameForm = ref({
  type: 'existing',
  frameName: '',
  name: '',
  frameId: '',
  frameNames: [],
  diagnosticType: 'MasterReq',
  nodeName: '',
  nad: 0,
  id: 0,
  byte: 0,
  mask: 0,
  inv: 0,
  newNad: 0,
  D1: 0,
  D2: 0,
  D3: 0,
  D4: 0,
  D5: 0,
  frameIndex: 0,
  framePIDs: [0, 0, 0, 0],
  scheduleName: '' // 添加调度表选择字段
  // 其他字段根据需要添加
})

const formRef = ref<FormInstance>()

// 表单验证规则
const formRules = computed<FormRules>(() => ({
  type: [{ required: true, message: 'Please select frame type', trigger: 'change' }],
  name: [
    {
      required:
        addFrameForm.value.type === 'EventTrigger' || addFrameForm.value.type === 'Sporadic',
      message: 'Please input event frame name',
      trigger: 'blur'
    },
    {
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'EventTrigger') {
          callback()
          return
        }

        // 检查是否与其他帧名冲突
        if (value in props.ldf.frames) {
          callback(new Error('Name conflicts with existing unconditional frame'))
          return
        }
        if (value in props.ldf.sporadicFrames) {
          callback(new Error('Name conflicts with existing sporadic frame'))
          return
        }
        // 检查是否与其他event triggered frames冲突(排除自己)
        const conflictEvent = Object.entries(props.ldf.eventTriggeredFrames).find(
          ([k, v]) => k === value && v.schTableName !== props.editIndex
        )
        if (conflictEvent) {
          callback(new Error('Name conflicts with existing event triggered frame'))
          return
        }
        callback()
      }
    },
    {
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'Sporadic') {
          callback()
          return
        }

        // 检查是否与其他帧名冲突
        if (value in props.ldf.frames) {
          callback(new Error('Name conflicts with existing unconditional frame'))
          return
        }
        if (value in props.ldf.eventTriggeredFrames) {
          callback(new Error('Name conflicts with existing event triggered frame'))
          return
        }
        // 检查是否与其他sporadic frames冲突
        if (value in props.ldf.sporadicFrames) {
          callback(new Error('Name conflicts with existing sporadic frame'))
          return
        }
        callback()
      }
    }
  ],
  frameId: [
    {
      required: addFrameForm.value.type === 'EventTrigger',
      message: 'Please input frame ID',
      trigger: 'blur'
    },
    {
      pattern: /^[0-9a-fA-F]+$/,
      message: 'Frame ID must be hexadecimal',
      trigger: 'blur'
    },
    {
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'EventTrigger') {
          callback()
          return
        }

        const id = parseInt(value, 16)
        if (isNaN(id) || id < 0 || id > 0x3f) {
          callback(new Error('Frame ID must be between 0x00 and 0x3F'))
          return
        }

        // 检查ID是否与其他帧冲突
        for (const frame of Object.values(props.ldf.frames)) {
          if (frame.id === id) {
            callback(new Error(`Frame ID conflicts with unconditional frame ${frame.name}`))
            return
          }
        }

        // 检查是否与其他event triggered frames冲突(排除自己)
        for (const [name, frame] of Object.entries(props.ldf.eventTriggeredFrames)) {
          if (frame.frameId === id && frame.schTableName !== props.editIndex) {
            callback(new Error(`Frame ID conflicts with event triggered frame ${name}`))
            return
          }
        }
        callback()
      }
    }
  ],
  diagnosticType: [
    {
      required: addFrameForm.value.type === 'Diagnostic',
      message: 'Please select diagnostic type',
      trigger: 'change'
    }
  ],
  nodeName: [
    {
      required: [
        'AssignNAD',
        'SaveConfiguration',
        'AssignFrameId',
        'DataDump',
        'AssignFrameIdRange'
      ].includes(addFrameForm.value.type),
      message: 'Please select a node',
      trigger: 'change'
    }
  ],
  frameNames: [
    {
      type: 'array',
      required: addFrameForm.value.type === 'EventTrigger',
      message: 'Please select at least one frame',
      trigger: 'change',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'EventTrigger') {
          callback()
          return
        }
        if (!Array.isArray(value) || value.length < 2) {
          callback(new Error('Event triggered frame must have at least 2 frames'))
          return
        }
        callback()
      }
    },
    {
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type === 'Sporadic') {
          if (!Array.isArray(value) || value.length === 0) {
            callback(new Error('Please select at least one frame'))
            return
          }

          // 验证所选frames是否都是master发送的
          for (const frameName of value) {
            const frame = props.ldf.frames[frameName]
            if (!frame || frame.publishedBy !== props.ldf.node.master.nodeName) {
              callback(new Error('Sporadic frames must only include frames published by master'))
              return
            }
          }
        }
        callback()
      }
    }
  ],
  frameName: [
    {
      required:
        addFrameForm.value.type === 'AssignFrameId' || addFrameForm.value.type === 'existing',
      message: 'Please select a frame',
      trigger: 'change',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'AssignFrameId') {
          callback()
          return
        }
        if (!addFrameForm.value.nodeName) {
          callback(new Error('Please select node first'))
          return
        }
        const configFrames = props.ldf.nodeAttrs[addFrameForm.value.nodeName]?.configFrames || []
        if (!configFrames.includes(value)) {
          callback(new Error('Selected frame must be a configurable frame for this node'))
          return
        }
        callback()
      }
    }
  ],
  nad: [
    {
      required: addFrameForm.value.type === 'ConditionalChangeNAD',
      message: 'Please input NAD',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'ConditionalChangeNAD') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 255) {
          callback(new Error('NAD must be between 0 and 255'))
          return
        }
        callback()
      }
    }
  ],
  id: [
    {
      required: addFrameForm.value.type === 'ConditionalChangeNAD',
      message: 'Please input ID',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'ConditionalChangeNAD') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 65535) {
          callback(new Error('ID must be between 0 and 65535'))
          return
        }
        callback()
      }
    }
  ],
  byte: [
    {
      required: addFrameForm.value.type === 'ConditionalChangeNAD',
      message: 'Please input byte',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'ConditionalChangeNAD') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 255) {
          callback(new Error('Byte must be between 0 and 255'))
          return
        }
        callback()
      }
    }
  ],
  mask: [
    {
      required: addFrameForm.value.type === 'ConditionalChangeNAD',
      message: 'Please input mask',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'ConditionalChangeNAD') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 255) {
          callback(new Error('Mask must be between 0 and 255'))
          return
        }
        callback()
      }
    }
  ],
  inv: [
    {
      required: addFrameForm.value.type === 'ConditionalChangeNAD',
      message: 'Please input inv',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'ConditionalChangeNAD') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 255) {
          callback(new Error('Inv must be between 0 and 255'))
          return
        }
        callback()
      }
    }
  ],
  newNad: [
    {
      required: addFrameForm.value.type === 'ConditionalChangeNAD',
      message: 'Please input new NAD',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'ConditionalChangeNAD') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 255) {
          callback(new Error('New NAD must be between 0 and 255'))
          return
        }
        callback()
      }
    }
  ],
  D1: [
    {
      required: addFrameForm.value.type === 'DataDump',
      message: 'Please input D1 value',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'DataDump') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 255) {
          callback(new Error('D1 must be between 0 and 255'))
          return
        }
        callback()
      }
    }
  ],
  D2: [
    {
      required: addFrameForm.value.type === 'DataDump',
      message: 'Please input D2 value',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'DataDump') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 255) {
          callback(new Error('D2 must be between 0 and 255'))
          return
        }
        callback()
      }
    }
  ],
  D3: [
    {
      required: addFrameForm.value.type === 'DataDump',
      message: 'Please input D3 value',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'DataDump') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 255) {
          callback(new Error('D3 must be between 0 and 255'))
          return
        }
        callback()
      }
    }
  ],
  D4: [
    {
      required: addFrameForm.value.type === 'DataDump',
      message: 'Please input D4 value',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'DataDump') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 255) {
          callback(new Error('D4 must be between 0 and 255'))
          return
        }
        callback()
      }
    }
  ],
  D5: [
    {
      required: addFrameForm.value.type === 'DataDump',
      message: 'Please input D5 value',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'DataDump') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 255) {
          callback(new Error('D5 must be between 0 and 255'))
          return
        }
        callback()
      }
    }
  ],
  frameIndex: [
    {
      required: addFrameForm.value.type === 'AssignFrameIdRange',
      message: 'Please input frame index',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'AssignFrameIdRange') {
          callback()
          return
        }
        if (typeof value !== 'number' || value < 0 || value > 3) {
          callback(new Error('Frame index must be between 0 and 3'))
          return
        }

        // 验证选中节点的configFrames数量是否足够
        if (addFrameForm.value.nodeName) {
          const configFrames = props.ldf.nodeAttrs[addFrameForm.value.nodeName]?.configFrames || []
          if (value >= configFrames.length) {
            callback(
              new Error(
                `Frame index exceeds available configurable frames (${configFrames.length})`
              )
            )
            return
          }
        }
        callback()
      }
    }
  ],
  framePIDs: [
    {
      required: addFrameForm.value.type === 'AssignFrameIdRange',
      trigger: 'blur',
      validator: (rule: any, value: any, callback: any) => {
        if (addFrameForm.value.type !== 'AssignFrameIdRange') {
          callback()
          return
        }

        if (!Array.isArray(value) || value.length !== 4) {
          callback(new Error('Must provide 4 PIDs'))
          return
        }

        // 检查每个PID的值是否有效
        for (const pid of value) {
          if (typeof pid !== 'number' || pid < 0 || pid > 63) {
            callback(new Error('Each PID must be between 0 and 63'))
            return
          }
        }

        // 检查PID是否重复
        const uniquePIDs = new Set(value.filter((pid) => pid !== 0))
        if (uniquePIDs.size !== value.filter((pid) => pid !== 0).length) {
          callback(new Error('PIDs must be unique (except 0)'))
          return
        }

        callback()
      }
    }
  ],
  scheduleName: [
    {
      required: addFrameForm.value.type === 'EventTrigger',
      message: 'Please select schedule table for collision handling',
      trigger: 'change'
    }
  ]
}))

// 计算可用的帧
const availableFrames = computed(() => Object.keys(props.ldf.frames))

// 添加计算属性获取master的frames
const masterFrames = computed(() => {
  return Object.entries(props.ldf.frames)
    .filter(([_, frame]) => frame.publishedBy === props.ldf.node.master.nodeName)
    .map(([name]) => name)
})

// 添加计算属性获取可配置帧
const availableConfigFrames = computed(() => {
  if (!addFrameForm.value.nodeName) return []
  return props.ldf.nodeAttrs[addFrameForm.value.nodeName]?.configFrames || []
})

// 处理帧类型变化
function handleFrameTypeChange(type: string) {
  addFrameForm.value = {
    type,
    frameName: '',
    name: '',
    frameId: '',
    frameNames: [],
    diagnosticType: 'MasterReq',
    nodeName: '',
    nad: 0,
    id: 0,
    byte: 0,
    mask: 0,
    inv: 0,
    newNad: 0,
    D1: 0,
    D2: 0,
    D3: 0,
    D4: 0,
    D5: 0,
    frameIndex: 0,
    framePIDs: [0, 0, 0, 0],
    scheduleName: '' // 添加调度表选择字段
  }
  // 重置表单验证
  nextTick(() => {
    formRef.value?.clearValidate()
  })
}

// 处理添加帧
function submitForm() {
  if (!formRef.value) return
  formRef.value.validate((valid) => {
    if (valid) {
      handleAddFrame()
    }
  })
}

// 修改处理添加帧函数
function handleAddFrame() {
  const form = addFrameForm.value

  switch (form.type) {
    case 'existing':
      if (form.frameName) {
        schedule.value.entries.push({
          name: form.frameName,
          delay: 0,
          isCommand: false
        })
      }
      break

    case 'EventTrigger':
      if (form.name && form.frameId && form.frameNames.length > 0 && form.scheduleName) {
        // 添加事件触发帧的逻辑
        ldf.value.eventTriggeredFrames[form.name] = {
          frameId: parseInt(form.frameId, 16),
          name: form.name,
          frameNames: form.frameNames,
          schTableName: form.scheduleName // 使用选择的调度表名称
        }
        schedule.value.entries.push({
          name: form.name,
          delay: 0,
          isCommand: false
        })
      }
      break

    case 'Diagnostic':
      schedule.value.entries.push({
        name: form.diagnosticType === 'MasterReq' ? 'DiagnosticMasterReq' : 'DiagnosticSlaveResp',
        delay: 0,
        isCommand: true
      })
      break

    case 'Sporadic':
      if (form.name && form.frameNames.length > 0) {
        ldf.value.sporadicFrames[form.name] = {
          name: form.name,
          frameNames: form.frameNames
        }
        schedule.value.entries.push({
          name: form.name,
          delay: 0,
          isCommand: false
        })
      }
      break
    case 'AssignNAD':
      if (form.nodeName) {
        schedule.value.entries.push({
          name: 'AssignNAD',
          delay: 0,
          isCommand: true,
          AssignNAD: {
            nodeName: form.nodeName
          }
        })
      }
      break
    case 'AssignFrameId':
      if (form.nodeName && form.frameName) {
        schedule.value.entries.push({
          name: 'AssignFrameId',
          delay: 0,
          isCommand: true,
          AssignFrameId: {
            nodeName: form.nodeName,
            frameName: form.frameName
          }
        })
      }
      break
    case 'ConditionalChangeNAD':
      schedule.value.entries.push({
        name: 'ConditionalChangeNAD',
        delay: 0,
        isCommand: true,
        ConditionalChangeNAD: {
          nad: form.nad,
          id: form.id,
          byte: form.byte,
          mask: form.mask,
          inv: form.inv,
          newNad: form.newNad
        }
      })
      break
    case 'DataDump':
      if (form.nodeName) {
        schedule.value.entries.push({
          name: 'DataDump',
          delay: 0,
          isCommand: true,
          DataDump: {
            nodeName: form.nodeName,
            D1: form.D1,
            D2: form.D2,
            D3: form.D3,
            D4: form.D4,
            D5: form.D5
          }
        })
      }
      break
    case 'SaveConfiguration':
      if (form.nodeName) {
        schedule.value.entries.push({
          name: 'SaveConfiguration',
          delay: 0,
          isCommand: true,
          SaveConfiguration: {
            nodeName: form.nodeName
          }
        })
      }
      break
    case 'AssignFrameIdRange':
      if (form.nodeName) {
        schedule.value.entries.push({
          name: 'AssignFrameIdRange',
          delay: 0,
          isCommand: true,
          AssignFrameIdRange: {
            nodeName: form.nodeName,
            frameIndex: form.frameIndex,
            framePID: form.framePIDs.filter((pid) => pid !== 0) // 只包含非0的PID
          }
        })
      }
      break
  }

  // 重置表单
  handleFrameTypeChange(form.type)
}

function updateDelay(row: any) {
  const entry = schedule.value.entries[selectedIndex.value]
  if (entry) {
    entry.delay = row.delay
  }
}

// 修改删除方法，直接接收行数据
function deleteFrame() {
  if (selectedIndex.value < 0) return

  ElMessageBox.confirm('Are you sure to delete this frame?', 'Warning', {
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    type: 'warning',
    buttonSize: 'small',
    appendTo: `#win${props.editIndex}`
  }).then(() => {
    schedule.value.entries.splice(selectedIndex.value, 1)
    selectedIndex.value = -1
  })
}

const rowDrop = () => {
  nextTick(() => {
    const wrapper = document.querySelector(`#${tableId.value} tbody`) as HTMLElement

    if (wrapper) {
      Sortable.create(wrapper, {
        animation: 300,
        handle: `#schDragBtn${props.editIndex}`,
        onEnd: ({ newIndex, oldIndex }) => {
          if (newIndex === oldIndex) return
          if (newIndex === undefined || oldIndex === undefined) return

          const currentRow = schedule.value.entries.splice(oldIndex, 1)[0]
          schedule.value.entries.splice(newIndex, 0, currentRow)
        }
      })
    }
  })
}
const errors = ref<string[]>([])
async function validate() {
  errors.value = []
  const schema = new Schema(props.rules as any)
  try {
    await schema.validate(schedule.value)
  } catch (e: any) {
    for (const key in e.fields) {
      for (const error of e.fields[key]) {
        // console.log(key, error)
        errors.value.push(error.toString())
      }
    }
  }
}

onMounted(() => {
  validate()
})
defineExpose({
  validate
})
</script>

<style scoped>
.drag-btn {
  cursor: move;
}

.schedule-toolbar {
  padding: 8px;
  display: flex;
}

.add-frame-form {
  flex: 1;
  padding: 20px 0;
}

/* 移除表单项的垂直对齐，允许自然流式布局 */
:deep(.el-form--inline) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:deep(.el-form--inline .el-form-item) {
  margin: 0;
}

/* 确保按钮组样式正常 */
:deep(.el-button-group) {
  display: inline-flex;
}
</style>
