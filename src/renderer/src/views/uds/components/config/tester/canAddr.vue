<template>
  <el-form
    ref="ruleFormRef"
    :model="data"
    label-width="120px"
    size="small"
    :disabled="globalStart"
    :rules="rules"
    class="hardware"
    hide-required-asterisk
  >
    <el-form-item label="Address name" required prop="name">
      <el-input v-model="data.name" />
    </el-form-item>

    <el-form-item label="Addr Format" required prop="addrFormat">
      <el-select v-model="data.addrFormat">
        <el-option label="NORMAL" :value="CAN_ADDR_FORMAT.NORMAL" />
        <el-option label="FIXED_NORMAL" :value="CAN_ADDR_FORMAT.FIXED_NORMAL" />
        <el-option label="EXTENDED" :value="CAN_ADDR_FORMAT.EXTENDED" />
        <el-option label="MIXED" :value="CAN_ADDR_FORMAT.MIXED" />
        <el-option label="ENHANCED" :value="CAN_ADDR_FORMAT.ENHANCED" disabled />
      </el-select>
    </el-form-item>
    <el-form-item label="Addr Type" required prop="addrType">
      <el-select v-model="data.addrType">
        <el-option label="ADDR_PHYSICAL" :value="CAN_ADDR_TYPE.PHYSICAL" />
        <el-option label="ADDR_FUNCTIONAL" :value="CAN_ADDR_TYPE.FUNCTIONAL" />
      </el-select>
    </el-form-item>
    <el-divider content-position="left"> CAN Base </el-divider>
    <el-form-item label="CAN-ID Type" required prop="idType">
      <el-select v-model="data.idType">
        <el-option label="STANDARD_ID" :value="CAN_ID_TYPE.STANDARD" />
        <el-option label="EXTEND_ID" :value="CAN_ID_TYPE.EXTENDED" />
      </el-select>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="8">
        <el-form-item label="CAN FD" prop="canfd">
          <el-checkbox v-model="data.canfd" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="BRS" prop="brs">
          <el-checkbox v-model="data.brs" :disabled="!data.canfd" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="Remote" prop="remote">
          <el-checkbox v-model="data.remote" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="8">
        <el-form-item label="N_SA" prop="SA" required>
          <el-input v-model="data.SA" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="N_TA" prop="TA" required>
          <el-input v-model="data.TA" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="N_AE" prop="AE">
          <el-input v-model="data.AE" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="CAN_ID TX" prop="canIdTx">
          <el-input v-model="data.canIdTx" :disabled="!canidNeed" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="CAN_ID RX" prop="canIdRx">
          <el-input v-model="data.canIdRx" :disabled="!canidNeed" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="CAN_ID TX (calc)">
          <el-input v-model="canidCalcTx" disabled />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="CAN_ID RX (calc)">
          <el-input v-model="canidCalcRx" disabled />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label="DLC" prop="dlc">
      <template #label="{ label }">
        <span class="vm">
          <span style="margin-right: 2px">{{ label }}</span>
          <el-tooltip>
            <template #content>
              CAN:0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9-15:8<br />
              CAN-FD:0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:12,10:16,11:20,12:24,13:32,14:48,15:64
            </template>

            <el-icon>
              <InfoFilled />
            </el-icon>
          </el-tooltip>
        </span>
      </template>
      <el-input-number v-model="data.dlc" :min="8" :max="15" controls-position="right" />
    </el-form-item>

    <el-divider content-position="left"> TP Base </el-divider>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="Padding Enable" prop="padding">
          <el-checkbox v-model="data.padding" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Padding Value" prop="paddingValue">
          <el-input v-model="data.paddingValue" :disabled="!data.padding" />
        </el-form-item>
      </el-col>
    </el-form-item>

    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="nAs" prop="nAs">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  Time for transmission of the CAN frame (any N-PDU) on the sender side (see ISO
                  15765-2)
                </template>
                <el-icon>
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model.number="data.nAs" />
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item label="nAr" prop="nAr">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  Time for transmission of the CAN frame (any N-PDU) on the receiver side (see ISO
                  15765-2)
                </template>
                <el-icon>
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model.number="data.nAr" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="nCr" prop="nCr">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  Time until reception of the next consecutive frame N-PDU (see ISO 15765-2)
                </template>
                <el-icon>
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model.number="data.nCr" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="nBs" prop="nBs">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  Time until reception of the next flow control N-PDU (see ISO 15765-2)
                </template>
                <el-icon>
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model.number="data.nBs" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="nBr" prop="nBr">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  Time until transmission of the next FlowControl N_PDU (see ISO 15765-2)
                </template>
                <el-icon>
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model.number="data.nBr" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="nCs" prop="nCs">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  Time until transmission of the next ConsecutiveFrame N_PDU (see ISO 15765-2)
                </template>
                <el-icon>
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model.number="data.nCs" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="Block Size" prop="bs">
          <el-input v-model.number="data.bs" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="STmin" prop="stMin">
          <el-input v-model.number="data.stMin" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="MAX WTF" prop="maxWTF">
          <el-input v-model.number="data.maxWTF" />
        </el-form-item>
      </el-col>
    </el-form-item>
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
import { useGlobalStart } from '@r/stores/runtime'

const ruleFormRef = ref<FormInstance>()
const globalStart = useGlobalStart()
const data = defineModel<CanAddr>({
  required: true
})

const canidNeed = computed(() => {
  if (data.value.addrFormat == CAN_ADDR_FORMAT.FIXED_NORMAL) {
    return false
  }
  if (data.value.addrFormat == CAN_ADDR_FORMAT.MIXED && data.value.idType == CAN_ID_TYPE.EXTENDED) {
    return false
  }

  return true
})

const idTypeCheck = (rule: any, value: any, callback: any) => {
  if (data.value.addrFormat == CAN_ADDR_FORMAT.FIXED_NORMAL) {
    if (data.value.idType == CAN_ID_TYPE.STANDARD) {
      callback(new Error('CAN-ID Type must be EXTENDED_ID when Addr Format is FIXED_NORMAL'))
    }
  }
  callback()
}

const idCheck = (rule: any, value: any, callback: any) => {
  if (canidNeed.value) {
    if (value) {
      if (data.value.idType == CAN_ID_TYPE.STANDARD) {
        if (Number(value) < 0 || Number(value) > 0x7ff) {
          callback(new Error('CAN-ID must be 0~0x7FF'))
        }
      } else {
        if (Number(value) < 0 || Number(value) > 0x1fffffff) {
          callback(new Error('CAN-ID must be 0~0x1FFFFFFF'))
        }
      }
      if (rule.field == 'canIdTx') {
        if (Number(value) == Number(data.value.canIdRx)) {
          callback(new Error("CAN-ID TX can't be equal to CAN-ID RX"))
        }
        //all canidtx must be unique
        for (let i = 0; i < addrs.value.length; i++) {
          if (Number(value) == Number(addrs.value[i].canAddr?.canIdTx) && i != editIndex.value) {
            callback(new Error('CAN-ID TX must be unique'))
          }
        }
      }
      if (rule.field == 'canIdRx') {
        if (Number(value) == Number(data.value.canIdTx)) {
          callback(new Error("CAN-ID RX can't be equal to CAN-ID TX"))
        }

        //all canidrx must be same，except self
        for (let i = 0; i < addrs.value.length; i++) {
          if (Number(value) != Number(addrs.value[i].canAddr?.canIdRx) && i != editIndex.value) {
            callback(new Error('CAN-ID RX must be same'))
          }
        }
      }
    } else {
      callback(new Error(`CAN-ID is need`))
    }
  }
  callback()
}
const addrCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    if (Number(value) < 0 || Number(value) > 0xff) {
      callback(new Error('value must be 0~0xFF'))
    }
    if (rule.field == 'SA') {
      if (Number(value) == Number(data.value.TA)) {
        callback(new Error("SA can't be equal to TA"))
      }
      //all sa must equal addrs[0].canAddr.SA, 排除自己
      for (let i = 0; i < addrs.value.length; i++) {
        if (Number(value) != Number(addrs.value[i].canAddr?.SA) && i != editIndex.value) {
          callback(new Error('SA must same'))
        }
      }
    }
    if (rule.field == 'TA') {
      if (Number(value) == Number(data.value.SA)) {
        callback(new Error("TA can't be equal to SA"))
      }
      //all TA must be unique, 排除自己
      for (let i = 0; i < addrs.value.length; i++) {
        if (Number(value) == Number(addrs.value[i].canAddr?.TA) && i != editIndex.value) {
          callback(new Error('TA must unique'))
        }
      }
    }

    callback()
  } else {
    callback(new Error(`value is need`))
  }
}
const addrAeCheck = (rule: any, value: any, callback: any) => {
  if (data.value.addrFormat == CAN_ADDR_FORMAT.MIXED) {
    if (value) {
      if (Number(value) < 0 || Number(value) > 0xff) {
        callback(new Error('value must be 0~0xFF'))
      }
      callback()
    } else {
      callback(new Error(`value is need`))
    }
  }
  callback()
}
const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (let i = 0; i < addrs.value.length; i++) {
      const hasName = addrs.value[i].canAddr?.name
      if (hasName == value && i != editIndex.value) {
        callback(new Error('The name already exists'))
      }
    }
    callback()
  } else {
    callback(new Error('Please input node name'))
  }
}
const rules: FormRules<CanAddr> = {
  name: [
    {
      required: true,
      message: 'Please input addr name',
      trigger: 'blur',
      validator: nameCheck
    }
  ],
  idType: [{ required: true, validator: idTypeCheck, trigger: 'change' }],
  canIdRx: [{ required: canidNeed.value, validator: idCheck, trigger: 'change' }],
  canIdTx: [{ required: canidNeed.value, validator: idCheck, trigger: 'change' }],
  dlc: [
    {
      required: true,
      message: 'Please input DLC from 0-15',
      trigger: 'blur',
      type: 'number',
      min: 8,
      max: 15
    }
  ],
  paddingValue: [
    {
      required: true,
      message: 'Please input padding value from 0-255',
      trigger: 'blur',
      type: 'number',
      transform: (value) => Number(value),
      min: 0,
      max: 255
    }
  ],
  SA: [{ required: true, validator: addrCheck, trigger: 'change' }],
  TA: [{ required: true, validator: addrCheck, trigger: 'change' }],
  AE: [{ required: false, validator: addrAeCheck, trigger: 'change' }],
  nAr: [{ required: true, message: 'Please input nAr', trigger: 'change', type: 'number' }],
  nAs: [{ required: true, message: 'Please input nAs', trigger: 'change', type: 'number' }],
  nBs: [{ required: true, message: 'Please input nBs', trigger: 'change', type: 'number' }],
  nCr: [{ required: true, message: 'Please input nCr', trigger: 'change', type: 'number' }],
  nBr: [{ required: false, trigger: 'change', type: 'number' }],
  nCs: [{ required: false, trigger: 'change', type: 'number' }],
  stMin: [{ required: true, message: 'Please input stMin', type: 'number' }],
  bs: [{ required: true, message: 'Please input bs', type: 'number' }],
  maxWTF: [{ required: true, message: 'Please input maxWTF', type: 'number' }]
}

const canidCalcTx = computed(() => {
  if (canidNeed.value) {
    return data.value.canIdTx
  } else {
    if (data.value.addrFormat == CAN_ADDR_FORMAT.MIXED)
      return calcCanIdMixed(Number(data.value.SA), Number(data.value.TA), data.value.addrType)
        .toString(16)
        .toUpperCase()
    if (data.value.addrFormat == CAN_ADDR_FORMAT.FIXED_NORMAL) {
      return calcCanIdNormalFixed(Number(data.value.SA), Number(data.value.TA), data.value.addrType)
        .toString(16)
        .toUpperCase()
    }
    return 'Unsupported'
  }
})

const canidCalcRx = computed(() => {
  if (canidNeed.value) {
    return data.value.canIdRx
  } else {
    if (data.value.addrFormat == CAN_ADDR_FORMAT.MIXED)
      return calcCanIdMixed(Number(data.value.TA), Number(data.value.SA), data.value.addrType)
        .toString(16)
        .toUpperCase()
    if (data.value.addrFormat == CAN_ADDR_FORMAT.FIXED_NORMAL) {
      return calcCanIdNormalFixed(Number(data.value.TA), Number(data.value.SA), data.value.addrType)
        .toString(16)
        .toUpperCase()
    }
    return 'Unsupported'
  }
})

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
