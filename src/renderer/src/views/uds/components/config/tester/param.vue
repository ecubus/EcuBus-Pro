<template>
  <el-table
    :id="'paramTable' + props.parentId + props.id"
    :data="data"
    style="width: 100%"
    border
    row-key="id"
    :row-class-name="tableRowClassName"
  >
    <el-table-column width="40" fixed="left" align="center">
      <template #default>
        <el-icon :id="'dragBtn' + props.id" class="drag-btn" @mouseenter="rowDrop">
          <Grid />
        </el-icon>
      </template>
    </el-table-column>
    <el-table-column prop="name" label="Name" width="200" align="center" show-overflow-tooltip>
      <template #default="{ $index, row }">
        <div v-if="editIndex == $index" class="editParam">
          <el-input
            v-model="editValue.name"
            style="padding-left: 15px; padding-right: 15px"
            :disabled="!row.deletable"
          />
          <el-tooltip
            v-if="paramError['name']"
            :content="paramError['name']"
            placement="bottom"
            effect="danger"
          >
            <el-icon class="error">
              <RemoveFilled @click="paramError['name'] = ''" />
            </el-icon>
            {{ paramError['name'] }}
          </el-tooltip>
        </div>
        <span v-else @click="copyText(row.name)">{{ row.name }}</span>
      </template>
    </el-table-column>
    <el-table-column prop="type" label="Type" width="100" align="center">
      <template #default="{ row }">
        <el-tag type="primary">
          {{ row.type }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column
      v-if="checkServiceId(props.serviceId, ['uds'])"
      prop="length"
      label="Length (bit)"
      width="165"
      align="center"
    >
      <template #default="{ row, $index }">
        <div v-if="editIndex == $index" class="editParam">
          <el-input-number
            v-model="editValue.bitLen"
            controls-position="right"
            :disabled="!row.deletable"
          />
          <el-tooltip
            v-if="paramError['bitLen']"
            :content="paramError['bitLen']"
            placement="bottom"
            effect="danger"
          >
            <el-icon class="error">
              <RemoveFilled @click="paramError['bitLen'] = ''" />
            </el-icon>
            {{ paramError['bitLen'] }}
          </el-tooltip>
        </div>
        <span v-else style="text-align: center; color: var(--el-text-color-primary)">{{
          row.bitLen
        }}</span>
      </template>
    </el-table-column>

    <el-table-column prop="Value" label="Value" min-width="300" align="center">
      <template #default="{ row, $index }">
        <div v-if="editIndex == $index" class="editParam">
          <template v-if="row.type == 'FILE'">
            <el-input v-model="editValue.editValue" disabled placeholder="File Path" clearable>
              <template #append>
                <el-button :icon="Folder" @click="selectFile" />
              </template>
            </el-input>
          </template>
          <template v-else>
            <el-select
              v-if="infoParam && infoParam.enum"
              v-model="editValue.editValue"
              filterable
              allow-create
              style="padding-left: 15px; padding-right: 15px"
            >
              <el-option
                v-for="e in infoParam.enum"
                :key="e.value"
                :label="e.name"
                :value="e.value"
              >
                <span style="float: left">{{ e.name }}</span>
                <span style="float: right; color: var(--el-text-color-secondary); font-size: 13px">
                  {{ e.value }}
                </span>
              </el-option>
            </el-select>
            <el-input
              v-else
              v-model="editValue.editValue"
              style="padding-left: 15px; padding-right: 15px"
            />
          </template>
          <el-tooltip
            v-if="paramError['value']"
            :content="paramError['value']"
            placement="bottom"
            effect="danger"
          >
            <el-icon class="error">
              <RemoveFilled @click="paramError['value'] = ''" />
            </el-icon>
            {{ paramError['value'] }}
          </el-tooltip>
        </div>
        <span v-else style="text-align: center; color: var(--el-text-color-primary)">{{
          param2str(row)
        }}</span>
      </template>
    </el-table-column>
    <el-table-column prop="desc" label="Description" align="center" min-width="200">
      <template #default="{ $index, row }">
        <el-input v-if="editIndex == $index" v-model="editValue.desc" />
        <span v-else>{{ row.desc }}</span>
      </template>
    </el-table-column>
    <el-table-column fixed="right" label="Operations" width="180" align="center">
      <template #header>
        <div>
          <el-dropdown :disabled="props.disabled">
            <span>
              <el-button
                size="small"
                type="primary"
                text
                icon="CirclePlusFilled"
                :disabled="props.disabled"
              >
                Add
              </el-button>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="addParam('NUM')"> NUMBER </el-dropdown-item>
                <el-dropdown-item @click="addParam('ASCII')"> ASCII </el-dropdown-item>
                <el-dropdown-item @click="addParam('ARRAY')"> ARRAY </el-dropdown-item>
                <el-dropdown-item @click="addParam('FLOAT')"> FLOAT </el-dropdown-item>
                <el-dropdown-item @click="addParam('DOUBLE')"> DOUBLE </el-dropdown-item>
                <el-dropdown-item @click="addParam('UNICODE')"> UNICODE </el-dropdown-item>
                <el-dropdown-item
                  v-if="!checkServiceId(props.serviceId, ['uds'])"
                  @click="addParam('FILE')"
                >
                  FILE
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </template>
      <template #default="{ row, $index }">
        <div v-if="editIndex != $index">
          <el-button
            size="small"
            type="warning"
            text
            icon="Edit"
            :disabled="!row.editable"
            @click="editParam(row, $index)"
          >
            Edit
          </el-button>
          <el-button
            size="small"
            type="danger"
            text
            icon="DeleteFilled"
            :disabled="!row.deletable"
            @click="deleteParam($index)"
          >
            Delete
          </el-button>
        </div>
        <div v-else>
          <el-button
            size="small"
            type="success"
            text
            icon="FolderChecked"
            @click="saveParam($index, false)"
          >
            Save
          </el-button>
          <el-button
            size="small"
            type="warning"
            text
            icon="Close"
            @click="() => ((editIndex = -1), (paramError = {}))"
          >
            Discard
          </el-button>
        </div>
      </template>
    </el-table-column>
  </el-table>
</template>

<script lang="ts" setup>
import { v4 } from 'uuid'
import { Param, param2len, param2str, paramSetVal, DataType, ServiceItem } from 'nodeCan/uds'
import { watch, ref, nextTick, computed, toRef, onMounted } from 'vue'
import Sortable from 'sortablejs'
import { cloneDeep } from 'lodash'
import { ServiceId, checkServiceId } from 'nodeCan/uds'
import { useClipboard } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { Folder } from '@element-plus/icons-vue'
import { useProjectStore } from '@r/stores/project'
import { error } from 'winston'

const serviceDetail = window.serviceDetail
const paramError = ref<Record<string, string>>({})
const { copy } = useClipboard()
const props = defineProps<{
  id: string
  serviceId: ServiceId
  subFunction?: boolean
  disabled?: boolean
  sid: string
  parentId: string
  otherService?: ServiceItem[]
}>()
const data = defineModel<Param[]>({
  required: true
})

function copyText(text: string) {
  copy(text)
  ElMessage({
    message: 'Copied',
    type: 'success',
    plain: true,
    offset: 30,
    appendTo: `#paramTable${props.parentId}${props.id}`
  })
}

watch(
  () => props.sid,
  () => {
    editIndex.value = -1
    paramError.value = {}
  }
)

const project = useProjectStore()
async function selectFile() {
  const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: 'Script File',
    properties: ['openFile'],
    filters: [{ name: 'All Files', extensions: ['*'] }]
  })
  const file = r.filePaths[0]
  if (file) {
    if (project.projectInfo.path)
      editValue.value.editValue = window.path.relative(project.projectInfo.path, file)
    else editValue.value.editValue = file
  }
  return file
}
interface EditParam extends Param {
  editValue: string
}
const infoParam = computed(() => {
  if (editIndex.value >= 0) {
    if (props.id == 'req') {
      return serviceDetail[props.serviceId].defaultParams[editIndex.value]
    } else {
      return serviceDetail[props.serviceId].defaultRespParams[editIndex.value]
    }
  }
  return undefined
})
const editIndex = ref(-1)
const editValue = ref<EditParam>({
  id: '',
  name: '',
  desc: '',
  value: Buffer.alloc(0),
  type: 'NUM',
  phyValue: undefined,
  bitLen: 0,
  editValue: ''
})

const emits = defineEmits(['change'])

function valid() {
  for (const [index, param] of data.value.entries()) {
    editParam(param, index)
    const r = saveParam(index, true)
    if (r != true) {
      return false
    }
  }
  editIndex.value = -1
  return true
}
const otherService = toRef(props, 'otherService')
function saveParam(index: number, justValid: boolean) {
  let error = false

  const d: EditParam = cloneDeep(editValue.value)
  d.value = Buffer.from(d.value)
  //check name duplicate
  const name = editValue.value.name
  for (const item of data.value) {
    if (item.name == name && item.id != d.id) {
      paramError.value['name'] = 'name duplicate'
      error = true
      break
    }
  }

  {
    if (d.type == 'ASCII' || d.type == 'FILE') {
      //auto change bitLen
      d.bitLen = d.editValue.length * 8
    }
    if (d.type == 'UNICODE') {
      if (d.bitLen == data.value[index].bitLen) {
        const a = Array.from(new TextEncoder().encode(d.editValue))
        d.bitLen = a.length * 8
      }
    }
    if (d.type == 'ARRAY') {
      if (d.bitLen == data.value[index].bitLen) {
        d.bitLen = d.editValue.split(' ').length * 8
      }
    }

    if (d.type == 'FLOAT') {
      d.bitLen = 32
    }
    if (d.type == 'DOUBLE') {
      d.bitLen = 64
    }
    // if (d.type == 'NUM') {
    //   const num = Number(d.value)
    //   if (isNaN(num)) {
    //     paramError.value['value'] = 'value must be a number'
    //     error = true
    //   }
    //   d.bitLen = 32
    // }
  }
  switch (d.type) {
    case 'NUM':
      {
        /*multiple of 8,and <=32*/
        if (d.bitLen % 8 != 0) {
          paramError.value['bitLen'] = 'bitLen must be multiple of 8'
          error = true
        }
        if (d.bitLen > 32) {
          paramError.value['bitLen'] = 'bitLen must be <=32'
          error = true
        }
      }
      break
    case 'ASCII':
    case 'FILE':
    case 'UNICODE':
      {
        if (d.bitLen % 8 != 0) {
          paramError.value['bitLen'] = 'bitLen must be multiple of 8'
          error = true
        }
      }
      break
    case 'ARRAY':
      {
        if (d.bitLen % 8 != 0) {
          paramError.value['bitLen'] = 'bitLen must be multiple of 8'
          error = true
        }
      }
      break
    case 'FLOAT':
      {
        if (d.bitLen != 32) {
          paramError.value['bitLen'] = 'bitLen must be 32'
          error = true
        }
      }
      break
    case 'DOUBLE':
      {
        if (d.bitLen != 64) {
          paramError.value['bitLen'] = 'bitLen must be 64'
        }
      }
      break
    default:
      paramError.value['bitLen'] = `unknown type ${d.type}`
      break
  }

  try {
    paramSetVal(d, d.editValue)
  } catch (e: any) {
    paramError.value['value'] = e.message
    error = true
  }

  if (otherService.value && checkServiceId(props.serviceId, ['uds'])) {
    const editService = otherService.value.find((item) => item.id == props.sid)
    let editParam: Param[] = []
    if (editService) {
      editParam = props.id == 'req' ? editService.params : editService.respParams
    }
    for (const ss of otherService.value) {
      if (ss.id != props.sid) {
        const params = props.id == 'req' ? ss.params : ss.respParams
        let newBuffer = Buffer.alloc(0)
        let oldBuffer = Buffer.alloc(0)
        for (const [index, item] of params.entries()) {
          if (item.deletable == false) {
            oldBuffer = Buffer.concat([oldBuffer, Buffer.from(item.value)])

            if (index == editIndex.value) {
              newBuffer = Buffer.concat([newBuffer, Buffer.from(d.value)])
            } else {
              newBuffer = Buffer.concat([newBuffer, Buffer.from(editParam[index].value)])
            }
          }
        }
        if (ss.suppress) {
          oldBuffer[0] = (0x80 | oldBuffer[0]) >>> 0
        }
        if (props.subFunction) {
          newBuffer[0] = (0x80 | newBuffer[0]) >>> 0
        }

        if (Buffer.compare(newBuffer, oldBuffer) == 0) {
          paramError.value['value'] =
            `The id already exists in service ${ss.name}, please change it`
          error = true
          break
        }
      }
    }
  }

  if (error) return false
  paramError.value = {}
  if (justValid) {
    return true
  }
  delete (d as any).editValue
  data.value[index] = d
  editIndex.value = -1

  emits('change', data.value)
  return true
}

defineExpose({
  valid
})
function editParam(row: Param, index: number) {
  editIndex.value = index
  editValue.value = JSON.parse(JSON.stringify(row))
  editValue.value.editValue = param2str(row)
}
function addParam(type: DataType) {
  let paramName = `param${data.value.length + 1}`
  /* check if the param name already exists */
  const paramNames = data.value.map((item) => item.name)
  if (paramNames.includes(paramName)) {
    let i = 1
    while (paramNames.includes(`${paramName}${i}`)) {
      i++
    }
    paramName = `${paramName}${i}`
  }

  switch (type) {
    case 'NUM':
      data.value.push({
        id: v4(),
        name: paramName,
        desc: '',
        phyValue: 0,
        value: Buffer.alloc(1).fill(0),
        bitLen: 8,
        type: 'NUM',
        deletable: true,
        editable: true
      })
      break
    case 'ASCII':
      data.value.push({
        id: v4(),
        name: paramName,
        desc: '',
        phyValue: '1',
        value: Buffer.from('1', 'ascii'),
        bitLen: 8,
        type: 'ASCII',
        deletable: true,
        editable: true
      })
      break
    case 'FILE':
      data.value.push({
        id: v4(),
        name: paramName,
        desc: '',
        phyValue: '',
        value: Buffer.from(''),
        bitLen: 8,
        type: 'FILE',
        deletable: true,
        editable: true
      })
      break
    case 'ARRAY':
      data.value.push({
        id: v4(),
        name: paramName,
        desc: '',
        phyValue: '00 00 00 00',
        value: Buffer.alloc(4).fill(0),
        bitLen: 32,
        type: 'ARRAY',
        deletable: true,
        editable: true
      })
      break
    case 'UNICODE':
      {
        const p: Param = {
          id: v4(),
          name: paramName,
          desc: '',
          phyValue: 1,
          value: Buffer.alloc(3).fill(0),
          bitLen: 24,
          type: 'UNICODE',
          deletable: true,
          editable: true
        }
        paramSetVal(p, '❤')
        data.value.push(p)
      }
      break
    case 'FLOAT':
      {
        const p: Param = {
          id: v4(),
          name: paramName,
          desc: '',
          phyValue: 0,
          value: Buffer.alloc(4).fill(0),
          bitLen: 32,
          type: 'FLOAT',
          deletable: true,
          editable: true
        }
        paramSetVal(p, 0.0)

        data.value.push(p)
      }
      break
    case 'DOUBLE':
      {
        const p: Param = {
          id: v4(),
          name: paramName,
          desc: '',
          phyValue: 0,
          value: Buffer.alloc(8).fill(0),
          bitLen: 64,
          type: 'DOUBLE',
          deletable: true,
          editable: true
        }
        paramSetVal(p, 0.0)
      }
      break
  }
  emits('change', data.value)
}

function deleteParam(index: number) {
  data.value.splice(index, 1)
  emits('change', data.value)
}
const rowDrop = (event: { preventDefault: () => void }) => {
  event.preventDefault()
  nextTick(() => {
    const wrapper = document.querySelector(
      `#paramTable${props.parentId}${props.id} .el-table__body-wrapper tbody`
    ) as HTMLElement
    Sortable.create(wrapper, {
      filter: '.fixed',
      animation: 300,
      handle: `#dragBtn${props.id}`,
      onMove: function (evt) {
        return evt.related.className.indexOf('fixed') === -1
      },
      onEnd: ({ newIndex, oldIndex }) => {
        if (newIndex === oldIndex) return
        if (newIndex == undefined || oldIndex == undefined) return
        const currentRow = data.value.splice(oldIndex, 1)[0]
        data.value.splice(newIndex, 0, currentRow)
        emits('change', data.value)
      }
    })
  })
}
const tableRowClassName = (val: any) => {
  if (val.rowIndex === editIndex.value) {
    if (Object.keys(paramError.value).length > 0) {
      return 'error-row'
    }
  } else {
    if (val.row.name == 'SERVICE-ID' || val.row.name == 'SUBFUNCTION') {
      return 'fixed'
    }
  }
  return ''
}
</script>

<style>
.error-row {
  background-color: var(--el-color-danger-light-9) !important;
}
</style>
<style scoped>
.drag-btn {
  cursor: move;
}

.editParam {
  position: relative;
}

.editParam .error {
  position: absolute;
  color: var(--el-color-danger);
  top: 7px;
  left: 0px;
  z-index: 10;
}

.editParam .error:hover {
  cursor: pointer;
}
</style>
