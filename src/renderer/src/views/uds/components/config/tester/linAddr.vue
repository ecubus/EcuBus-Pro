<template>
  <el-form
    ref="ruleFormRef"
    :model="data"
    label-width="130px"
    size="small"
    :disabled="globalStart"
    :rules="rules"
    class="hardware"
    hide-required-asterisk
  >
    <el-form-item label="Address name" required prop="name">
      <el-input v-model="data.name" />
    </el-form-item>
    <el-form-item label="Address Type" required prop="addrType">
      <el-select v-model="data.addrType">
        <el-option value="physical" label="Physical"></el-option>
        <el-option value="functional" label="Functional"></el-option>
      </el-select>
    </el-form-item>
    <el-divider content-position="left"> TP Base </el-divider>

    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="nCr" prop="nCr">
          <el-input v-model.number="data.nCr" />
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item label="nAs" prop="nAs">
          <el-input v-model.number="data.nAs" />
        </el-form-item>
      </el-col>
    </el-form-item>

    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="NAD" prop="nad">
          <el-input-number v-model.number="data.nad" controls-position="right" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="STmin" prop="stMin">
          <el-input v-model.number="data.stMin" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-divider content-position="left"> Scheduling Settings </el-divider>
    <el-radio-group v-model="data.schType" style="margin-left: 30px">
      <el-radio value="DIAG_ONLY" size="small" border>Diagnostic only</el-radio>
      <el-radio value="DIAG_INTERLEAVED" size="small" border>Interleaved</el-radio>
    </el-radio-group>
  </el-form>
</template>

<script lang="ts" setup>
import {
  Ref,
  computed,
  inject,
  onBeforeMount,
  onMounted,
  onUnmounted,
  ref,
  toRef,
  watch
} from 'vue'
import {
  CanAddr,
  calcCanIdMixed,
  calcCanIdNormalFixed,
  CAN_ADDR_FORMAT,
  CAN_ID_TYPE,
  CAN_ADDR_TYPE
} from 'nodeCan/can'
import { v4 } from 'uuid'
import { type FormRules, type FormInstance, ElMessageBox } from 'element-plus'
import { assign, cloneDeep } from 'lodash'
import { UdsAddress } from 'nodeCan/uds'
import { LinAddr } from 'nodeCan/lin'
import { useGlobalStart } from '@r/stores/runtime'

const ruleFormRef = ref<FormInstance>()
const globalStart = useGlobalStart()
const data = defineModel<LinAddr>({
  required: true
})

const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (let i = 0; i < addrs.value.length; i++) {
      const hasName = addrs.value[i].linAddr?.name
      if (hasName == value && i != editIndex.value) {
        callback(new Error('The name already exists'))
      }
    }
    callback()
  } else {
    callback(new Error('Please input node name'))
  }
}
const nadCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    if (value < 0 || value > 255) {
      callback(new Error('NAD must be 0~255'))
    }
  }
  //validate nad must be unique
  for (let i = 0; i < addrs.value.length; i++) {
    if (Number(value) == Number(addrs.value[i].linAddr?.nad) && i != editIndex.value) {
      callback(new Error('NAD must be unique'))
    }
  }
  callback()
}
const rules: FormRules<LinAddr> = {
  name: [
    {
      required: true,
      message: 'Please input addr name',
      trigger: 'blur',
      validator: nameCheck
    }
  ],
  nad: [
    {
      required: true,
      message: 'Please input NAD',
      trigger: 'blur',
      type: 'number',
      validator: nadCheck,
      min: 0,
      max: 255
    }
  ]
}

const props = defineProps<{
  index: number
  addrs: UdsAddress[]
}>()

const editIndex = toRef(props, 'index')
const addrs = toRef(props, 'addrs')

onMounted(() => {
  ruleFormRef.value?.validate().catch(null)
})

async function dataValid() {
  await ruleFormRef.value?.validate()
}
defineExpose({
  dataValid
})
</script>
<style scoped>
.hardware {
  margin: 20px;
}

.vm {
  display: flex;
  align-items: center;
  /* 垂直居中对齐 */
  gap: 4px;
}
</style>
