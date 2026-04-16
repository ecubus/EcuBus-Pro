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

      <el-divider content-position="left">
        <el-tooltip
          :content="i18next.t('uds.someip.serviceConfig.tooltips.eventsSection')"
          placement="top"
          :show-after="800"
        >
          <span class="label-with-tooltip">{{
            i18next.t('uds.someip.serviceConfig.sections.eventsAndGroups')
          }}</span>
        </el-tooltip>
      </el-divider>

      <div style="margin-bottom: 8px">
        <el-button icon="Plus" type="primary" link @click="addEvent">
          {{ i18next.t('uds.someip.serviceConfig.buttons.addEvent') }}
        </el-button>
      </div>
      <el-table
        :data="modelValue.events || []"
        border
        size="small"
        style="width: 100%; margin-bottom: 20px"
      >
        <el-table-column
          :label="i18next.t('uds.someip.serviceConfig.labels.eventId')"
          min-width="120"
        >
          <template #default="{ row }">
            <el-input
              v-model="row.event"
              :placeholder="i18next.t('uds.someip.serviceConfig.placeholders.eventId')"
            />
          </template>
        </el-table-column>
        <el-table-column
          :label="i18next.t('uds.someip.serviceConfig.labels.isField')"
          width="90"
          align="center"
        >
          <template #default="{ row }">
            <el-checkbox v-model="row.is_field" />
          </template>
        </el-table-column>
        <el-table-column
          :label="i18next.t('uds.someip.serviceConfig.labels.isReliableEvent')"
          width="110"
          align="center"
        >
          <template #default="{ row }">
            <el-checkbox v-model="row.is_reliable" />
          </template>
        </el-table-column>
        <el-table-column min-width="140">
          <template #header>
            <el-tooltip
              :content="i18next.t('uds.someip.serviceConfig.tooltips.updateCycleMs')"
              placement="top"
              :show-after="800"
            >
              <span class="label-with-tooltip">{{
                i18next.t('uds.someip.serviceConfig.labels.updateCycleMs')
              }}</span>
            </el-tooltip>
          </template>
          <template #default="{ row }">
            <el-input-number
              v-model="row.cycle"
              :min="0"
              :step="1"
              controls-position="right"
              style="width: 100%"
            />
          </template>
        </el-table-column>
        <el-table-column width="88" align="center" fixed="right">
          <template #default="{ $index }">
            <el-button type="danger" link @click="removeEvent($index)">
              {{ i18next.t('uds.someip.serviceConfig.buttons.remove') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-bottom: 8px">
        <el-button icon="Plus" type="primary" link @click="addEventgroup">
          {{ i18next.t('uds.someip.serviceConfig.buttons.addEventgroup') }}
        </el-button>
      </div>
      <el-table :data="modelValue.eventgroups || []" border size="small" style="width: 100%">
        <el-table-column
          :label="i18next.t('uds.someip.serviceConfig.labels.eventgroupId')"
          min-width="120"
        >
          <template #default="{ row }">
            <el-input
              v-model="row.eventgroup"
              :placeholder="i18next.t('uds.someip.serviceConfig.placeholders.eventgroupId')"
            />
          </template>
        </el-table-column>
        <el-table-column
          :label="i18next.t('uds.someip.serviceConfig.labels.eventsInGroup')"
          min-width="220"
        >
          <template #default="{ row }">
            <el-select
              v-model="row.events"
              multiple
              filterable
              allow-create
              default-first-option
              collapse-tags
              collapse-tags-tooltip
              style="width: 100%"
              :placeholder="i18next.t('uds.someip.serviceConfig.placeholders.eventIds')"
            >
              <el-option
                v-for="opt in eventIdOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column width="88" align="center" fixed="right">
          <template #default="{ $index }">
            <el-button type="danger" link @click="removeEventgroup($index)">
              {{ i18next.t('uds.someip.serviceConfig.buttons.remove') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-form>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { type FormRules, type FormInstance } from 'element-plus'
import type { ServiceConfig, ServiceEvent } from 'nodeCan/someip'
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

const eventIdOptions = computed(() => {
  const events = modelValue.value.events || []
  const ids = events.map((e) => e.event?.trim()).filter((id): id is string => !!id)
  return [...new Set(ids)].map((id) => ({ label: id, value: id }))
})

function ensureEventsModel() {
  const m = modelValue.value
  if (!Array.isArray(m.events)) m.events = []
  if (!Array.isArray(m.eventgroups)) m.eventgroups = []
  for (const ev of m.events) {
    const raw = ev as ServiceEvent & Record<string, unknown>
    const legacyUc = raw['update-cycle']
    if (legacyUc !== undefined && legacyUc !== '' && legacyUc !== null) {
      if (ev.cycle === undefined) {
        const n = Number(legacyUc)
        if (!Number.isNaN(n)) ev.cycle = n
      }
      delete raw['update-cycle']
    }
    if (ev.cycle !== undefined && ev.cycle !== null) {
      const n = Number(ev.cycle)
      if (!Number.isNaN(n)) ev.cycle = n
    }
    if (typeof ev.is_field === 'string') ev.is_field = ev.is_field === 'true'
    if (typeof ev.is_reliable === 'string') ev.is_reliable = ev.is_reliable !== 'false'
    if (ev.is_field === undefined) ev.is_field = false
    if (ev.is_reliable === undefined) ev.is_reliable = true
  }
  for (const g of m.eventgroups) {
    if (!Array.isArray(g.events)) g.events = []
  }
}

function addEvent() {
  ensureEventsModel()
  modelValue.value.events!.push({
    event: '',
    is_field: false,
    is_reliable: true
  })
}

function removeEvent(index: number) {
  const list = modelValue.value.events
  if (!list) return
  const removed = list[index]?.event?.trim()
  list.splice(index, 1)
  if (removed) {
    for (const g of modelValue.value.eventgroups || []) {
      g.events = (g.events || []).filter((id) => id !== removed)
    }
  }
}

function addEventgroup() {
  ensureEventsModel()
  modelValue.value.eventgroups!.push({ eventgroup: '', events: [] })
}

function removeEventgroup(index: number) {
  modelValue.value.eventgroups?.splice(index, 1)
}

function validateEventsAndGroups(): Promise<void> {
  const m = modelValue.value
  const hex = /^0x[0-9a-fA-F]+$/
  for (const ev of m.events || []) {
    if (!ev.event?.trim()) continue
    if (!hex.test(ev.event)) {
      return Promise.reject(
        new Error(i18next.t('uds.someip.serviceConfig.validation.invalidHexFormat'))
      )
    }
  }
  for (const g of m.eventgroups || []) {
    if (!g.eventgroup?.trim()) continue
    if (!hex.test(g.eventgroup)) {
      return Promise.reject(
        new Error(i18next.t('uds.someip.serviceConfig.validation.invalidHexFormat'))
      )
    }
    for (const id of g.events || []) {
      if (id && !hex.test(id)) {
        return Promise.reject(
          new Error(i18next.t('uds.someip.serviceConfig.validation.invalidHexFormat'))
        )
      }
    }
  }
  return Promise.resolve()
}

watch(
  () => modelValue.value,
  () => {
    ensureEventsModel()
  },
  { deep: true, immediate: true }
)

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
  await validateEventsAndGroups()
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
