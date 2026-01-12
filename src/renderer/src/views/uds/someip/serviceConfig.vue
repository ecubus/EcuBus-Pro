<template>
  <div>
    <el-form
      ref="ruleFormRef"
      :disabled="globalStart"
      :model="modelValue"
      label-width="150px"
      :rules="rules"
      size="small"
      hide-required-asterisk
    >
      <el-form-item prop="service" required>
        <template #label>
          <el-tooltip
            :content="i18next.t('uds.someip.serviceConfig.tooltips.serviceId')"
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip"
              >{{ i18next.t('uds.someip.serviceConfig.labels.serviceId') }}
            </span>
          </el-tooltip>
        </template>
        <el-input
          v-model="modelValue.service"
          :placeholder="i18next.t('uds.someip.serviceConfig.placeholders.serviceId')"
        />
      </el-form-item>

      <el-form-item prop="instance" required>
        <template #label>
          <el-tooltip
            :content="i18next.t('uds.someip.serviceConfig.tooltips.instanceId')"
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip"
              >{{ i18next.t('uds.someip.serviceConfig.labels.instanceId') }}
            </span>
          </el-tooltip>
        </template>
        <el-input
          v-model="modelValue.instance"
          :placeholder="i18next.t('uds.someip.serviceConfig.placeholders.instanceId')"
        />
      </el-form-item>

      <!-- <el-form-item prop="protocol">
        <template #label>
          <el-tooltip
            content="The protocol implementation for this service. Default is 'someip'. Other values can be used for external service implementations."
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip">Protocol </span>
          </el-tooltip>
        </template>
        <el-input v-model="modelValue.protocol" placeholder="someip"  />
      </el-form-item> -->

      <el-form-item v-if="!sdEnable" prop="unicast" required>
        <template #label>
          <el-tooltip
            :content="i18next.t('uds.someip.serviceConfig.tooltips.unicastAddress')"
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip"
              >{{ i18next.t('uds.someip.serviceConfig.labels.unicastAddress') }}
            </span>
          </el-tooltip>
        </template>
        <el-input
          v-model="modelValue.unicast"
          :placeholder="i18next.t('uds.someip.serviceConfig.placeholders.unicastAddress')"
        />
      </el-form-item>

      <el-divider content-position="left">{{
        i18next.t('uds.someip.serviceConfig.sections.communicationConfig')
      }}</el-divider>

      <el-form-item prop="tcpValidation">
        <template #label>
          <el-tooltip
            :content="i18next.t('uds.someip.serviceConfig.tooltips.reliableTcp')"
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip"
              >{{ i18next.t('uds.someip.serviceConfig.labels.reliableTcp') }}
            </span>
          </el-tooltip>
        </template>
        <el-checkbox v-model="useReliable" @change="onReliableChange">
          {{ i18next.t('uds.someip.serviceConfig.labels.enableTcpCommunication') }}
        </el-checkbox>
        <el-input v-model="tcpValidation" style="display: none" />
      </el-form-item>

      <div v-if="useReliable && modelValue.reliable" style="margin-bottom: 30px">
        <el-form-item prop="reliable.port">
          <template #label>
            <el-tooltip
              :content="i18next.t('uds.someip.serviceConfig.tooltips.tcpPort')"
              placement="top"
              :show-after="1000"
            >
              <span class="label-with-tooltip"
                >{{ i18next.t('uds.someip.serviceConfig.labels.tcpPort') }}
              </span>
            </el-tooltip>
          </template>
          <el-input-number
            v-model="modelValue.reliable!.port"
            :min="1"
            :max="65535"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <el-tooltip
              :content="i18next.t('uds.someip.serviceConfig.tooltips.enableMagicCookies')"
              placement="top"
              :show-after="1000"
            >
              <span class="label-with-tooltip"
                >{{ i18next.t('uds.someip.serviceConfig.labels.enableMagicCookies') }}
              </span>
            </el-tooltip>
          </template>
          <el-checkbox v-model="modelValue.reliable!['enable-magic-cookies']" />
        </el-form-item>
      </div>

      <el-form-item prop="udpValidation">
        <template #label>
          <el-tooltip
            :content="i18next.t('uds.someip.serviceConfig.tooltips.unreliableUdp')"
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip"
              >{{ i18next.t('uds.someip.serviceConfig.labels.unreliableUdp') }}
            </span>
          </el-tooltip>
        </template>
        <el-checkbox v-model="useUnreliable" @change="onUnreliableChange">
          {{ i18next.t('uds.someip.serviceConfig.labels.enableUdpCommunication') }}
        </el-checkbox>
        <el-input v-model="udpValidation" style="display: none" />
      </el-form-item>

      <div v-if="useUnreliable && modelValue.unreliable">
        <el-form-item>
          <template #label>
            <el-tooltip
              :content="i18next.t('uds.someip.serviceConfig.tooltips.udpPort')"
              placement="top"
              :show-after="1000"
            >
              <span class="label-with-tooltip"
                >{{ i18next.t('uds.someip.serviceConfig.labels.udpPort') }}
              </span>
            </el-tooltip>
          </template>
          <el-input-number
            v-model="modelValue.unreliable"
            :min="1"
            :max="65535"
            style="width: 200px"
          />
        </el-form-item>
      </div>
    </el-form>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { type FormRules, type FormInstance } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import type { ServiceConfig } from 'nodeCan/someip'
import { useGlobalStart } from '@r/stores/runtime'
import i18next from 'i18next'

const globalStart = useGlobalStart()
const ruleFormRef = ref<FormInstance>()

const props = defineProps<{
  index: number
  services: ServiceConfig[]
  sdEnable: boolean
}>()

const modelValue = defineModel<ServiceConfig>({ required: true })

// Reactive flags for optional configurations
const useReliable = ref(!!modelValue.value.reliable)
const useUnreliable = ref(!!modelValue.value.unreliable)

// Validation fields for form rules
const tcpValidation = ref('')
const udpValidation = ref('')
const sdEnable = computed(() => {
  return props.sdEnable
})

// Hex validation helper
const hexValidator = (rule: any, value: any, callback: any) => {
  if (value && !/^0x[0-9a-fA-F]+$/.test(value)) {
    callback(new Error(i18next.t('uds.someip.serviceConfig.validation.invalidHexFormat')))
  } else {
    callback()
  }
}

// Port validation helper
const portValidator = (rule: any, value: any, callback: any) => {
  if (value && (value < 1 || value > 65535)) {
    callback(new Error(i18next.t('uds.someip.serviceConfig.validation.portRange')))
  } else {
    callback()
  }
}

// TCP validation helper
const tcpProtocolValidator = (rule: any, value: any, callback: any) => {
  const hasReliable = !!modelValue.value.reliable
  const hasUnreliable = modelValue.value.unreliable !== undefined

  if (!hasReliable && !hasUnreliable) {
    callback(new Error(i18next.t('uds.someip.serviceConfig.validation.atLeastOneProtocol')))
  } else {
    callback()
  }
}

// UDP validation helper
const udpProtocolValidator = (rule: any, value: any, callback: any) => {
  const hasReliable = !!modelValue.value.reliable
  const hasUnreliable = modelValue.value.unreliable !== undefined

  if (!hasReliable && !hasUnreliable) {
    callback(new Error(i18next.t('uds.someip.serviceConfig.validation.atLeastOneProtocol')))
  } else {
    callback()
  }
}

const rules = computed<FormRules>(() => {
  return {
    service: [
      {
        required: true,
        message: i18next.t('uds.someip.serviceConfig.validation.inputServiceId'),
        trigger: 'blur'
      },
      { validator: hexValidator, trigger: 'blur' }
    ],
    instance: [
      {
        required: true,
        message: i18next.t('uds.someip.serviceConfig.validation.inputInstanceId'),
        trigger: 'blur'
      },
      { validator: hexValidator, trigger: 'blur' }
    ],
    'reliable.port': [{ validator: portValidator, trigger: 'blur' }],
    unreliable: [{ validator: portValidator, trigger: 'blur' }],
    tcpValidation: [{ validator: tcpProtocolValidator, trigger: 'change' }],
    udpValidation: [{ validator: udpProtocolValidator, trigger: 'change' }]
  }
})

// Reliable configuration management
const onReliableChange = (enabled: boolean) => {
  if (enabled) {
    if (!modelValue.value.reliable) {
      modelValue.value.reliable = {
        port: 30509,
        'enable-magic-cookies': false
      }
    }
  } else {
    if (modelValue.value.reliable) {
      delete modelValue.value.reliable
    }
  }
  // Trigger validation for both TCP and UDP
  tcpValidation.value = tcpValidation.value === 'valid' ? 'check' : 'valid'
  udpValidation.value = udpValidation.value === 'valid' ? 'check' : 'valid'
}

// Unreliable configuration management
const onUnreliableChange = (enabled: boolean) => {
  if (enabled) {
    if (modelValue.value.unreliable === undefined) {
      modelValue.value.unreliable = 30510
    }
  } else {
    if (modelValue.value.unreliable !== undefined) {
      delete modelValue.value.unreliable
    }
  }
  // Trigger validation for both TCP and UDP
  tcpValidation.value = tcpValidation.value === 'valid' ? 'check' : 'valid'
  udpValidation.value = udpValidation.value === 'valid' ? 'check' : 'valid'
}

// Validation method for parent component
async function dataValid() {
  await ruleFormRef.value?.validate()
}

// Expose validation method to parent
defineExpose({
  dataValid
})

// Watch for changes in reliable/unreliable to update flags
watch(
  () => modelValue.value.reliable,
  (newReliable) => {
    useReliable.value = !!newReliable
  }
)

watch(
  () => modelValue.value.unreliable,
  (newUnreliable) => {
    useUnreliable.value = newUnreliable !== undefined
  }
)
</script>

<style scoped>
.el-card {
  margin-bottom: 15px;
}

.el-form-item {
  margin-bottom: 15px;
}

.el-divider {
  margin: 20px 0;
}

.label-with-tooltip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.label-with-tooltip .el-icon {
  color: var(--el-color-info);
  cursor: help;
  font-size: 14px;
  vertical-align: middle;
}

.el-tooltip__trigger {
  cursor: help;
}
</style>
