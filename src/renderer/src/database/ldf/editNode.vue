<template>
  <div :style="{ height: fh, overflowY: 'auto', padding: '5px' }">
    <el-form ref="ruleFormRef" :model="attr" label-width="150px" size="small" :rules="props.rules">
      <el-form-item
        :label="i18next.t('database.ldf.editNode.labels.linProtocol')"
        prop="LIN_protocol"
        required
      >
        <el-select v-model="attr.LIN_protocol" style="width: 100%">
          <el-option v-for="item in ['2.2', '2.1']" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>

      <el-form-item label-width="0px">
        <el-col :span="12">
          <el-form-item
            :label="i18next.t('database.ldf.editNode.labels.nad')"
            prop="configured_NAD"
            required
          >
            <el-input v-model.number="attr.configured_NAD" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item
            :label="i18next.t('database.ldf.editNode.labels.initNad')"
            prop="initial_NAD"
          >
            <el-input v-model.number="attr.initial_NAD" />
          </el-form-item>
        </el-col>
      </el-form-item>
      <el-form-item label-width="0px">
        <el-col :span="12">
          <el-form-item
            :label="i18next.t('database.ldf.editNode.labels.supplierId')"
            prop="supplier_id"
            required
          >
            <el-input v-model.number="attr.supplier_id" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item
            :label="i18next.t('database.ldf.editNode.labels.functionId')"
            prop="function_id"
            required
          >
            <el-input v-model.number="attr.function_id" />
          </el-form-item>
        </el-col>
      </el-form-item>
      <el-form-item :label="i18next.t('database.ldf.editNode.labels.variant')" prop="variant">
        <el-input v-model.number="attr.variant" />
      </el-form-item>
      <el-form-item
        :label="i18next.t('database.ldf.editNode.labels.responseErrorSignal')"
        prop="response_error"
        required
      >
        <el-select v-model.number="attr.response_error" style="width: 100%">
          <el-option
            v-for="item in ldf.signals"
            :key="item.signalName"
            :label="item.signalName"
            :value="item.signalName"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="i18next.t('database.ldf.editNode.labels.faultStateSignals')"
        prop="fault_state_signals"
      >
        <el-select
          v-model.number="attr.fault_state_signals"
          multiple
          style="width: 100%"
          collapse-tags
          collapse-tags-tooltip
        >
          <el-option
            v-for="item in ldf.signals"
            :key="item.signalName"
            :label="item.signalName"
            :value="item.signalName"
          />
        </el-select>
      </el-form-item>
      <el-form-item label-width="0px">
        <el-col :span="12">
          <el-form-item :label="i18next.t('database.ldf.editNode.labels.p2Min')" prop="P2_min">
            <el-input-number v-model.number="attr.P2_min" controls-position="right" :min="0" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="i18next.t('database.ldf.editNode.labels.stMin')" prop="ST_min">
            <el-input-number v-model.number="attr.ST_min" controls-position="right" :min="0" />
          </el-form-item>
        </el-col>
      </el-form-item>
      <el-form-item label-width="0px">
        <el-col :span="12">
          <el-form-item
            :label="i18next.t('database.ldf.editNode.labels.nAsTimeout')"
            prop="N_As_timeout"
          >
            <el-input-number
              v-model.number="attr.N_As_timeout"
              controls-position="right"
              :min="0"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item
            :label="i18next.t('database.ldf.editNode.labels.nCrTimeout')"
            prop="N_Cr_timeout"
          >
            <el-input-number
              v-model.number="attr.N_Cr_timeout"
              controls-position="right"
              :min="0"
            />
          </el-form-item>
        </el-col>
      </el-form-item>
      <el-form-item
        :label="i18next.t('database.ldf.editNode.labels.configFrames')"
        prop="configFrames"
      >
        <el-select
          v-model.number="attr.configFrames"
          multiple
          style="width: 100%"
          collapse-tags
          collapse-tags-tooltip
        >
          <el-option v-for="item in frames" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { toRef, ref, computed, watch, onMounted, onBeforeUnmount, nextTick, inject, Ref } from 'vue'
import { getConfigFrames, LDF, NodeAttrDef } from '../ldfParse'
import { ElMessageBox, ElNotification, ElOption, ElSelect, FormRules } from 'element-plus'
import i18next from 'i18next'

const h = inject('height') as Ref<number>
const fh = computed(() => Math.ceil((h.value * 2) / 3) + 'px')

const props = defineProps<{
  editIndex: string
  nodeName: string
  rules: FormRules
  ldf: LDF
}>()

const attr = defineModel<NodeAttrDef>({
  required: true
})

const ruleFormRef = ref()

onMounted(() => {
  ruleFormRef.value.validate()
})

function validate() {
  ruleFormRef.value.validate()
}

defineExpose({
  validate
})

const frames = computed(() => {
  return getConfigFrames(props.ldf, props.nodeName)
})
</script>

<style></style>
