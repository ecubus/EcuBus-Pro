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
            content="The unique identifier of the service in hexadecimal format (e.g., 0x1234). This ID must be unique within the system."
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip">Service ID </span>
          </el-tooltip>
        </template>
        <el-input v-model="modelValue.service" placeholder="0x1234" />
      </el-form-item>

      <el-form-item prop="instance" required>
        <template #label>
          <el-tooltip
            content="The instance identifier of the service in hexadecimal format (e.g., 0x5678). Multiple instances of the same service can exist with different instance IDs."
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip">Instance ID </span>
          </el-tooltip>
        </template>
        <el-input v-model="modelValue.instance" placeholder="0x5678" />
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
            content="The unicast IP address that hosts the service instance. Required for external services when service discovery is disabled."
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip">Unicast Address </span>
          </el-tooltip>
        </template>
        <el-input v-model="modelValue.unicast" placeholder="192.168.1.100" />
      </el-form-item>

      <el-divider content-position="left">Communication Configuration</el-divider>

      <el-form-item prop="tcpValidation">
        <template #label>
          <el-tooltip
            content="Enable reliable TCP communication for this service. TCP provides guaranteed delivery and error checking."
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip">Reliable (TCP) </span>
          </el-tooltip>
        </template>
        <el-checkbox v-model="useReliable" @change="onReliableChange">
          Enable TCP Communication
        </el-checkbox>
        <el-input v-model="tcpValidation" style="display: none" />
      </el-form-item>

      <div v-if="useReliable && modelValue.reliable" style="margin-bottom: 30px">
        <el-form-item prop="reliable.port">
          <template #label>
            <el-tooltip
              content="The TCP port number for reliable communication. Must be between 1 and 65535."
              placement="top"
              :show-after="1000"
            >
              <span class="label-with-tooltip">TCP Port </span>
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
              content="Enable magic cookies for TCP connections. Magic cookies help detect if the remote endpoint supports SOME/IP protocol."
              placement="top"
              :show-after="1000"
            >
              <span class="label-with-tooltip">Enable Magic Cookies </span>
            </el-tooltip>
          </template>
          <el-checkbox v-model="modelValue.reliable!['enable-magic-cookies']" />
        </el-form-item>
      </div>

      <el-form-item prop="udpValidation">
        <template #label>
          <el-tooltip
            content="Enable unreliable UDP communication for this service. UDP provides faster communication but without delivery guarantees."
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip">Unreliable (UDP) </span>
          </el-tooltip>
        </template>
        <el-checkbox v-model="useUnreliable" @change="onUnreliableChange">
          Enable UDP Communication
        </el-checkbox>
        <el-input v-model="udpValidation" style="display: none" />
      </el-form-item>

      <div v-if="useUnreliable && modelValue.unreliable">
        <el-form-item>
          <template #label>
            <el-tooltip
              content="The UDP port number for unreliable communication. Must be between 1 and 65535."
              placement="top"
              :show-after="1000"
            >
              <span class="label-with-tooltip">UDP Port </span>
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
import { ref, computed, watch, defineExpose } from 'vue'
import { type FormRules, type FormInstance } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import type { ServiceConfig } from 'src/main/vsomeip/share'
import { useGlobalStart } from '@r/stores/runtime'

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
    callback(new Error('Please input valid hex format (e.g., 0x1234)'))
  } else {
    callback()
  }
}

// Port validation helper
const portValidator = (rule: any, value: any, callback: any) => {
  if (value && (value < 1 || value > 65535)) {
    callback(new Error('Port must be between 1 and 65535'))
  } else {
    callback()
  }
}

// TCP validation helper
const tcpProtocolValidator = (rule: any, value: any, callback: any) => {
  const hasReliable = !!modelValue.value.reliable
  const hasUnreliable = modelValue.value.unreliable !== undefined

  if (!hasReliable && !hasUnreliable) {
    callback(new Error('At least one communication protocol must be enabled'))
  } else {
    callback()
  }
}

// UDP validation helper
const udpProtocolValidator = (rule: any, value: any, callback: any) => {
  const hasReliable = !!modelValue.value.reliable
  const hasUnreliable = modelValue.value.unreliable !== undefined

  if (!hasReliable && !hasUnreliable) {
    callback(new Error('At least one communication protocol must be enabled'))
  } else {
    callback()
  }
}

const rules = computed<FormRules>(() => {
  return {
    service: [
      { required: true, message: 'Please input service ID', trigger: 'blur' },
      { validator: hexValidator, trigger: 'blur' }
    ],
    instance: [
      { required: true, message: 'Please input instance ID', trigger: 'blur' },
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
