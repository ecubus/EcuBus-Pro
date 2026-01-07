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
    <el-form-item :label="i18next.t('uds.tester.canAddr.labels.addressName')" required prop="name">
      <el-input v-model="data.name" />
    </el-form-item>

    <el-form-item
      :label="i18next.t('uds.tester.canAddr.labels.addrFormat')"
      required
      prop="addrFormat"
    >
      <el-select v-model="data.addrFormat">
        <el-option
          :label="i18next.t('uds.tester.canAddr.options.addrFormat.normal')"
          :value="CAN_ADDR_FORMAT.NORMAL"
        />
        <el-option
          :label="i18next.t('uds.tester.canAddr.options.addrFormat.fixedNormal')"
          :value="CAN_ADDR_FORMAT.FIXED_NORMAL"
        />
        <el-option
          :label="i18next.t('uds.tester.canAddr.options.addrFormat.extended')"
          :value="CAN_ADDR_FORMAT.EXTENDED"
        />
        <el-option
          :label="i18next.t('uds.tester.canAddr.options.addrFormat.mixed')"
          :value="CAN_ADDR_FORMAT.MIXED"
        />
        <el-option
          :label="i18next.t('uds.tester.canAddr.options.addrFormat.enhanced')"
          :value="CAN_ADDR_FORMAT.ENHANCED"
          disabled
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="i18next.t('uds.tester.canAddr.labels.addrType')" required prop="addrType">
      <el-select v-model="data.addrType">
        <el-option
          :label="i18next.t('uds.tester.canAddr.options.addrType.physical')"
          :value="CAN_ADDR_TYPE.PHYSICAL"
        />
        <el-option
          :label="i18next.t('uds.tester.canAddr.options.addrType.functional')"
          :value="CAN_ADDR_TYPE.FUNCTIONAL"
        />
      </el-select>
    </el-form-item>
    <el-divider content-position="left">
      {{ i18next.t('uds.tester.canAddr.sections.canBase') }}
    </el-divider>
    <el-form-item :label="i18next.t('uds.tester.canAddr.labels.canIdType')" required prop="idType">
      <el-select v-model="data.idType">
        <el-option
          :label="i18next.t('uds.tester.canAddr.options.canIdType.standard')"
          :value="CAN_ID_TYPE.STANDARD"
        />
        <el-option
          :label="i18next.t('uds.tester.canAddr.options.canIdType.extended')"
          :value="CAN_ID_TYPE.EXTENDED"
        />
      </el-select>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="8">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.canFd')" prop="canfd">
          <el-checkbox v-model="data.canfd" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.brs')" prop="brs">
          <el-checkbox v-model="data.brs" :disabled="!data.canfd" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.remote')" prop="remote">
          <el-checkbox v-model="data.remote" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="8">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.nSa')" prop="SA" required>
          <el-input v-model="data.SA" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.nTa')" prop="TA" required>
          <el-input v-model="data.TA" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.nAe')" prop="AE">
          <el-input v-model="data.AE" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.canIdTx')" prop="canIdTx">
          <el-input v-model="data.canIdTx" :disabled="!canidNeed" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.canIdRx')" prop="canIdRx">
          <el-input v-model="data.canIdRx" :disabled="!canidNeed" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.canIdTxCalc')">
          <el-input v-model="canidCalcTx" disabled />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.canIdRxCalc')">
          <el-input v-model="canidCalcRx" disabled />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item :label="i18next.t('uds.tester.canAddr.labels.dlc')" prop="dlc">
      <template #label="{ label }">
        <span class="vm">
          <span style="margin-right: 2px">{{ label }}</span>
          <el-tooltip>
            <template #content>
              {{ i18next.t('uds.tester.canAddr.tooltips.dlcCan') }}<br />
              {{ i18next.t('uds.tester.canAddr.tooltips.dlcCanFd') }}
            </template>

            <el-icon>
              <InfoFilled />
            </el-icon>
          </el-tooltip>
        </span>
      </template>
      <el-input-number v-model="data.dlc" :min="8" :max="15" controls-position="right" />
    </el-form-item>

    <el-divider content-position="left">
      {{ i18next.t('uds.tester.canAddr.sections.tpBase') }}
    </el-divider>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.paddingEnable')" prop="padding">
          <el-checkbox v-model="data.padding" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.tester.canAddr.labels.paddingValue')"
          prop="paddingValue"
        >
          <el-input v-model="data.paddingValue" :disabled="!data.padding" />
        </el-form-item>
      </el-col>
    </el-form-item>

    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.nAs')" prop="nAs">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  {{ i18next.t('uds.tester.canAddr.tooltips.nAs') }}
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
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.nAr')" prop="nAr">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  {{ i18next.t('uds.tester.canAddr.tooltips.nAr') }}
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
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.nCr')" prop="nCr">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  {{ i18next.t('uds.tester.canAddr.tooltips.nCr') }}
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
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.nBs')" prop="nBs">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  {{ i18next.t('uds.tester.canAddr.tooltips.nBs') }}
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
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.nBr')" prop="nBr">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  {{ i18next.t('uds.tester.canAddr.tooltips.nBr') }}
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
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.nCs')" prop="nCs">
          <template #label="{ label }">
            <span class="vm">
              <span style="margin-right: 2px">{{ label }}</span>
              <el-tooltip>
                <template #content>
                  {{ i18next.t('uds.tester.canAddr.tooltips.nCs') }}
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
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.blockSize')" prop="bs">
          <el-input v-model.number="data.bs" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.stMin')" prop="stMin">
          <el-input v-model.number="data.stMin" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item :label="i18next.t('uds.tester.canAddr.labels.maxWtf')" prop="maxWTF">
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
import { i18next } from '@r/i18n'

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
      callback(
        new Error(i18next.t('uds.tester.canAddr.validation.idTypeMustBeExtendedForFixedNormal'))
      )
    }
  }
  callback()
}

const idCheck = (rule: any, value: any, callback: any) => {
  if (canidNeed.value) {
    if (value) {
      if (data.value.idType == CAN_ID_TYPE.STANDARD) {
        if (Number(value) < 0 || Number(value) > 0x7ff) {
          callback(new Error(i18next.t('uds.tester.canAddr.validation.canIdStandardRange')))
        }
      } else {
        if (Number(value) < 0 || Number(value) > 0x1fffffff) {
          callback(new Error(i18next.t('uds.tester.canAddr.validation.canIdExtendedRange')))
        }
      }
      if (rule.field == 'canIdTx') {
        if (Number.isNaN(Number(value))) {
          callback(new Error(i18next.t('uds.tester.canAddr.validation.hexShouldStartWith0x')))
        }
        if (Number(value) == Number(data.value.canIdRx)) {
          callback(new Error(i18next.t('uds.tester.canAddr.validation.canIdTxNotEqualRx')))
        }
        //all canidtx must be unique
        for (let i = 0; i < addrs.value.length; i++) {
          if (Number(value) == Number(addrs.value[i].canAddr?.canIdTx) && i != editIndex.value) {
            callback(new Error(i18next.t('uds.tester.canAddr.validation.canIdTxMustBeUnique')))
          }
        }
      }
      if (rule.field == 'canIdRx') {
        if (Number.isNaN(Number(value))) {
          callback(new Error(i18next.t('uds.tester.canAddr.validation.hexShouldStartWith0x')))
        }
        if (Number(value) == Number(data.value.canIdTx)) {
          callback(new Error(i18next.t('uds.tester.canAddr.validation.canIdRxNotEqualTx')))
        }

        //all canidrx must be same，except self
        for (let i = 0; i < addrs.value.length; i++) {
          if (Number(value) != Number(addrs.value[i].canAddr?.canIdRx) && i != editIndex.value) {
            callback(new Error(i18next.t('uds.tester.canAddr.validation.canIdRxMustBeSame')))
          }
        }
      }
    } else {
      callback(new Error(i18next.t('uds.tester.canAddr.validation.canIdRequired')))
    }
  }
  callback()
}
const addrCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    if (Number(value) < 0 || Number(value) > 0xff) {
      callback(new Error(i18next.t('uds.tester.canAddr.validation.valueRange')))
    }
    if (rule.field == 'SA') {
      if (Number.isNaN(Number(value))) {
        callback(new Error(i18next.t('uds.tester.canAddr.validation.hexShouldStartWith0x')))
      }
      if (Number(value) == Number(data.value.TA)) {
        callback(new Error("SA can't be equal to TA"))
      }
      //all sa must equal addrs[0].canAddr.SA, 排除自己
      for (let i = 0; i < addrs.value.length; i++) {
        if (Number(value) != Number(addrs.value[i].canAddr?.SA) && i != editIndex.value) {
          callback(new Error(i18next.t('uds.tester.canAddr.validation.saMustBeSame')))
        }
      }
    }
    if (rule.field == 'TA') {
      if (Number.isNaN(Number(value))) {
        callback(new Error(i18next.t('uds.tester.canAddr.validation.hexShouldStartWith0x')))
      }
      if (Number(value) == Number(data.value.SA)) {
        callback(new Error(i18next.t('uds.tester.canAddr.validation.taNotEqualSa')))
      }
      //all TA must be unique, 排除自己
      for (let i = 0; i < addrs.value.length; i++) {
        if (Number(value) == Number(addrs.value[i].canAddr?.TA) && i != editIndex.value) {
          callback(new Error(i18next.t('uds.tester.canAddr.validation.taMustBeUnique')))
        }
      }
    }

    callback()
  } else {
    callback(new Error(i18next.t('uds.tester.canAddr.validation.valueRequired')))
  }
}
const addrAeCheck = (rule: any, value: any, callback: any) => {
  if (data.value.addrFormat == CAN_ADDR_FORMAT.MIXED) {
    if (value) {
      if (Number.isNaN(Number(value))) {
        callback(new Error(i18next.t('uds.tester.canAddr.validation.hexShouldStartWith0x')))
      }
      if (Number(value) < 0 || Number(value) > 0xff) {
        callback(new Error(i18next.t('uds.tester.canAddr.validation.valueRange')))
      }
      callback()
    } else {
      callback(new Error(i18next.t('uds.tester.canAddr.validation.valueRequired')))
    }
  }
  callback()
}
const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (let i = 0; i < addrs.value.length; i++) {
      const hasName = addrs.value[i].canAddr?.name
      if (hasName == value && i != editIndex.value) {
        callback(new Error(i18next.t('uds.tester.canAddr.validation.nameExists')))
      }
    }
    callback()
  } else {
    callback(new Error(i18next.t('uds.tester.canAddr.validation.inputNodeName')))
  }
}
const rules: FormRules<CanAddr> = {
  name: [
    {
      required: true,
      message: i18next.t('uds.tester.canAddr.validation.inputAddrName'),
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
      message: i18next.t('uds.tester.canAddr.validation.inputDlc'),
      trigger: 'blur',
      type: 'number',
      min: 8,
      max: 15
    }
  ],
  paddingValue: [
    {
      required: true,
      message: i18next.t('uds.tester.canAddr.validation.inputPaddingValue'),
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
  nAs: [
    {
      required: true,
      message: i18next.t('uds.tester.canAddr.validation.inputNAs'),
      trigger: 'change',
      type: 'number'
    }
  ],
  nBs: [
    {
      required: true,
      message: i18next.t('uds.tester.canAddr.validation.inputNBs'),
      trigger: 'change',
      type: 'number'
    }
  ],
  nCr: [
    {
      required: true,
      message: i18next.t('uds.tester.canAddr.validation.inputNCr'),
      trigger: 'change',
      type: 'number'
    }
  ],
  nBr: [{ required: false, trigger: 'change', type: 'number' }],
  nCs: [{ required: false, trigger: 'change', type: 'number' }],
  stMin: [
    {
      required: true,
      message: i18next.t('uds.tester.canAddr.validation.inputStMin'),
      type: 'number'
    }
  ],
  bs: [
    { required: true, message: i18next.t('uds.tester.canAddr.validation.inputBs'), type: 'number' }
  ],
  maxWTF: [
    {
      required: true,
      message: i18next.t('uds.tester.canAddr.validation.inputMaxWtf'),
      type: 'number'
    }
  ]
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
    return i18next.t('uds.tester.canAddr.messages.unsupported')
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
    return i18next.t('uds.tester.canAddr.messages.unsupported')
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
