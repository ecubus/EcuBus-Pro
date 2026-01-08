<template>
  <div style="padding: 20px; min-width: 600px">
    <el-form
      ref="ruleFormRef"
      :model="data"
      label-width="150px"
      :rules="rules"
      size="small"
      hide-required-asterisk
      :disabled="globalStart"
    >
      <el-form-item :label="i18next.t('uds.someip.someip.labels.name')" prop="name">
        <el-input
          v-model="data.name"
          :placeholder="i18next.t('uds.someip.someip.placeholders.name')"
        />
      </el-form-item>

      <el-form-item :label="i18next.t('uds.someip.someip.labels.device')" prop="device">
        <el-select
          v-model="data.device"
          clearable
          :placeholder="i18next.t('uds.someip.someip.placeholders.selectDevice')"
        >
          <el-option v-for="item in deviceList" :key="item.id" :label="item.name" :value="item.id">
          </el-option>
        </el-select>
      </el-form-item>

      <el-divider content-position="left">{{
        i18next.t('uds.someip.someip.sections.applicationConfig')
      }}</el-divider>

      <el-form-item
        :label="i18next.t('uds.someip.someip.labels.applicationId')"
        prop="application.id"
      >
        <el-input
          v-model="data.application.id"
          :placeholder="i18next.t('uds.someip.someip.placeholders.applicationId')"
          :max="6"
        />
      </el-form-item>
      <el-collapse>
        <el-collapse-item
          :title="i18next.t('uds.someip.someip.sections.advancedApplicationConfig')"
          name="1"
        >
          <el-form-item label-width="0">
            <el-col :span="12">
              <el-form-item
                :label="i18next.t('uds.someip.someip.labels.maxDispatchers')"
                prop="application.max_dispatchers"
              >
                <el-input v-model.number="data.application.max_dispatchers" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="i18next.t('uds.someip.someip.labels.maxDispatchTime')"
                prop="application.max_dispatch_time"
              >
                <el-input v-model.number="data.application.max_dispatch_time" />
              </el-form-item>
            </el-col>
          </el-form-item>

          <el-form-item label-width="0">
            <el-col :span="12">
              <el-form-item
                :label="i18next.t('uds.someip.someip.labels.threads')"
                prop="application.threads"
              >
                <el-input v-model.number="data.application.threads" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="i18next.t('uds.someip.someip.labels.ioThreadNice')"
                prop="application.io_thread_nice"
              >
                <el-input v-model.number="data.application.io_thread_nice" />
              </el-form-item>
            </el-col>
          </el-form-item>

          <el-form-item
            :label="i18next.t('uds.someip.someip.labels.sessionHandling')"
            prop="application.has_session_handling"
          >
            <el-checkbox v-model="data.application.has_session_handling" />
          </el-form-item>
        </el-collapse-item>
      </el-collapse>

      <el-divider content-position="left">{{
        i18next.t('uds.someip.someip.sections.serviceDiscoveryConfig')
      }}</el-divider>

      <el-form-item prop="serviceDiscovery.enable">
        <template #label>
          <el-tooltip
            :content="i18next.t('uds.someip.someip.tooltips.enableServiceDiscovery')"
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip"
              >{{ i18next.t('uds.someip.someip.labels.enableServiceDiscovery') }}
            </span>
          </el-tooltip>
        </template>
        <el-checkbox v-model="data.serviceDiscovery.enable" />
      </el-form-item>

      <div>
        <!-- Basic Service Discovery Configuration -->
        <el-form-item prop="serviceDiscovery.initial_state">
          <template #label>
            <el-tooltip
              :content="i18next.t('uds.someip.someip.tooltips.initialState')"
              placement="top"
              :show-after="1000"
            >
              <span class="label-with-tooltip"
                >{{ i18next.t('uds.someip.someip.labels.initialState') }}
              </span>
            </el-tooltip>
          </template>
          <el-select
            v-model="data.serviceDiscovery.initial_state"
            :placeholder="i18next.t('uds.someip.someip.placeholders.initialState')"
          >
            <el-option
              :label="i18next.t('uds.someip.someip.options.initialState.unknown')"
              value="unknown"
            />
            <el-option
              :label="i18next.t('uds.someip.someip.options.initialState.suspended')"
              value="suspended"
            />
            <el-option
              :label="i18next.t('uds.someip.someip.options.initialState.resumed')"
              value="resumed"
            />
          </el-select>
        </el-form-item>

        <el-form-item label-width="0">
          <el-col :span="12">
            <el-form-item prop="serviceDiscovery.multicast">
              <template #label>
                <el-tooltip
                  :content="i18next.t('uds.someip.someip.tooltips.multicastAddress')"
                  placement="top"
                  :show-after="1000"
                >
                  <span class="label-with-tooltip"
                    >{{ i18next.t('uds.someip.someip.labels.multicastAddress') }}
                  </span>
                </el-tooltip>
              </template>
              <el-input
                v-model="data.serviceDiscovery.multicast"
                :placeholder="i18next.t('uds.someip.someip.placeholders.multicastAddress')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="serviceDiscovery.port">
              <template #label>
                <el-tooltip
                  :content="i18next.t('uds.someip.someip.tooltips.port')"
                  placement="top"
                  :show-after="1000"
                >
                  <span class="label-with-tooltip"
                    >{{ i18next.t('uds.someip.someip.labels.port') }}
                  </span>
                </el-tooltip>
              </template>
              <el-input
                v-model.number="data.serviceDiscovery.port"
                :placeholder="i18next.t('uds.someip.someip.placeholders.port')"
              />
            </el-form-item>
          </el-col>
        </el-form-item>

        <el-form-item prop="serviceDiscovery.protocol">
          <template #label>
            <el-tooltip
              :content="i18next.t('uds.someip.someip.tooltips.protocol')"
              placement="top"
              :show-after="1000"
            >
              <span class="label-with-tooltip"
                >{{ i18next.t('uds.someip.someip.labels.protocol') }}
              </span>
            </el-tooltip>
          </template>
          <el-select
            v-model="data.serviceDiscovery.protocol"
            :placeholder="i18next.t('uds.someip.someip.placeholders.protocol')"
          >
            <el-option :label="i18next.t('uds.someip.someip.options.protocol.udp')" value="udp" />
            <el-option :label="i18next.t('uds.someip.someip.options.protocol.tcp')" value="tcp" />
          </el-select>
        </el-form-item>

        <!-- Advanced Service Discovery Configuration (Collapsible) -->
        <el-collapse>
          <el-collapse-item
            :title="i18next.t('uds.someip.someip.sections.advancedServiceDiscoveryConfig')"
            name="1"
          >
            <!-- Timing Configuration -->
            <el-divider content-position="left">{{
              i18next.t('uds.someip.someip.sections.timingConfig')
            }}</el-divider>

            <el-form-item label-width="0">
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.initial_delay_min">
                  <template #label>
                    <el-tooltip
                      :content="i18next.t('uds.someip.someip.tooltips.initialDelayMin')"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip"
                        >{{ i18next.t('uds.someip.someip.labels.initialDelayMin') }}
                      </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.initial_delay_min"
                    :placeholder="i18next.t('uds.someip.someip.placeholders.initialDelayMin')"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.initial_delay_max">
                  <template #label>
                    <el-tooltip
                      :content="i18next.t('uds.someip.someip.tooltips.initialDelayMax')"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip"
                        >{{ i18next.t('uds.someip.someip.labels.initialDelayMax') }}
                      </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.initial_delay_max"
                    :placeholder="i18next.t('uds.someip.someip.placeholders.initialDelayMax')"
                  />
                </el-form-item>
              </el-col>
            </el-form-item>

            <el-form-item label-width="0">
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.repetitions_base_delay">
                  <template #label>
                    <el-tooltip
                      :content="i18next.t('uds.someip.someip.tooltips.repetitionsBaseDelay')"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip"
                        >{{ i18next.t('uds.someip.someip.labels.repetitionsBaseDelay') }}
                      </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.repetitions_base_delay"
                    :placeholder="i18next.t('uds.someip.someip.placeholders.repetitionsBaseDelay')"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.repetitions_max">
                  <template #label>
                    <el-tooltip
                      :content="i18next.t('uds.someip.someip.tooltips.repetitionsMax')"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip"
                        >{{ i18next.t('uds.someip.someip.labels.repetitionsMax') }}
                      </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.repetitions_max"
                    :placeholder="i18next.t('uds.someip.someip.placeholders.repetitionsMax')"
                  />
                </el-form-item>
              </el-col>
            </el-form-item>

            <el-form-item label-width="0">
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.cyclic_offer_delay">
                  <template #label>
                    <el-tooltip
                      :content="i18next.t('uds.someip.someip.tooltips.cyclicOfferDelay')"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip"
                        >{{ i18next.t('uds.someip.someip.labels.cyclicOfferDelay') }}
                      </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.cyclic_offer_delay"
                    :placeholder="i18next.t('uds.someip.someip.placeholders.cyclicOfferDelay')"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.request_response_delay">
                  <template #label>
                    <el-tooltip
                      :content="i18next.t('uds.someip.someip.tooltips.requestResponseDelay')"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip"
                        >{{ i18next.t('uds.someip.someip.labels.requestResponseDelay') }}
                      </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.request_response_delay"
                    :placeholder="i18next.t('uds.someip.someip.placeholders.requestResponseDelay')"
                  />
                </el-form-item>
              </el-col>
            </el-form-item>

            <!-- Debounce Configuration -->
            <el-divider content-position="left">{{
              i18next.t('uds.someip.someip.sections.debounceConfig')
            }}</el-divider>

            <el-form-item label-width="0">
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.offer_debounce_time">
                  <template #label>
                    <el-tooltip
                      :content="i18next.t('uds.someip.someip.tooltips.offerDebounceTime')"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip"
                        >{{ i18next.t('uds.someip.someip.labels.offerDebounceTime') }}
                      </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.offer_debounce_time"
                    :placeholder="i18next.t('uds.someip.someip.placeholders.offerDebounceTime')"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.find_debounce_time">
                  <template #label>
                    <el-tooltip
                      :content="i18next.t('uds.someip.someip.tooltips.findDebounceTime')"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip"
                        >{{ i18next.t('uds.someip.someip.labels.findDebounceTime') }}
                      </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.find_debounce_time"
                    :placeholder="i18next.t('uds.someip.someip.placeholders.findDebounceTime')"
                  />
                </el-form-item>
              </el-col>
            </el-form-item>

            <el-form-item label-width="0">
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.find_initial_debounce_reps">
                  <template #label>
                    <el-tooltip
                      :content="i18next.t('uds.someip.someip.tooltips.findInitialDebounceReps')"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip"
                        >{{ i18next.t('uds.someip.someip.labels.findInitialDebounceReps') }}
                      </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.find_initial_debounce_reps"
                    :placeholder="
                      i18next.t('uds.someip.someip.placeholders.findInitialDebounceReps')
                    "
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.find_initial_debounce_time">
                  <template #label>
                    <el-tooltip
                      :content="i18next.t('uds.someip.someip.tooltips.findInitialDebounceTime')"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip"
                        >{{ i18next.t('uds.someip.someip.labels.findInitialDebounceTime') }}
                      </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.find_initial_debounce_time"
                    :placeholder="
                      i18next.t('uds.someip.someip.placeholders.findInitialDebounceTime')
                    "
                  />
                </el-form-item>
              </el-col>
            </el-form-item>

            <!-- TTL Configuration -->
            <el-divider content-position="left">{{
              i18next.t('uds.someip.someip.sections.ttlConfig')
            }}</el-divider>

            <el-form-item prop="serviceDiscovery.ttl">
              <template #label>
                <el-tooltip
                  :content="i18next.t('uds.someip.someip.tooltips.ttl')"
                  placement="top"
                  :show-after="1000"
                >
                  <span class="label-with-tooltip"
                    >{{ i18next.t('uds.someip.someip.labels.ttl') }}
                  </span>
                </el-tooltip>
              </template>
              <el-input
                v-model="data.serviceDiscovery.ttl"
                :placeholder="i18next.t('uds.someip.someip.placeholders.ttl')"
              />
            </el-form-item>

            <!-- Other Configuration -->
            <el-divider content-position="left">{{
              i18next.t('uds.someip.someip.sections.otherConfig')
            }}</el-divider>

            <el-form-item prop="serviceDiscovery.max_remote_subscribers">
              <template #label>
                <el-tooltip
                  :content="i18next.t('uds.someip.someip.tooltips.maxRemoteSubscribers')"
                  placement="top"
                  :show-after="1000"
                >
                  <span class="label-with-tooltip"
                    >{{ i18next.t('uds.someip.someip.labels.maxRemoteSubscribers') }}
                  </span>
                </el-tooltip>
              </template>
              <el-input
                v-model.number="data.serviceDiscovery.max_remote_subscribers"
                :placeholder="i18next.t('uds.someip.someip.placeholders.maxRemoteSubscribers')"
              />
            </el-form-item>

            <el-form-item prop="serviceDiscovery.wait_route_netlink_notification">
              <template #label>
                <el-tooltip
                  :content="i18next.t('uds.someip.someip.tooltips.waitRouteNetlinkNotification')"
                  placement="top"
                  :show-after="1000"
                >
                  <span class="label-with-tooltip"
                    >{{ i18next.t('uds.someip.someip.labels.waitRouteNetlinkNotification') }}
                  </span>
                </el-tooltip>
              </template>
              <el-checkbox v-model="data.serviceDiscovery.wait_route_netlink_notification" />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>
      </div>

      <el-divider content-position="left">
        <el-button icon="Plus" link type="primary" @click="addService">
          {{ i18next.t('uds.someip.someip.buttons.addService') }}
        </el-button>
      </el-divider>

      <div v-if="data.services && data.services.length > 0">
        <el-tabs
          v-model="activeTabName"
          tab-position="left"
          style="height: 100%"
          closable
          @tab-remove="removeTab"
        >
          <el-tab-pane v-for="(item, index) in data.services" :key="index" :name="`index${index}`">
            <template #label>
              <span class="custom-tabs-label">
                <span
                  :class="{
                    addrError: errors[index]
                  }"
                  >{{ getServiceName(item, index) }}</span
                >
              </span>
            </template>
            <serviceConfig
              v-if="data.services[index]"
              :ref="(e) => (serviceRef[index] = e)"
              v-model="data.services[index]"
              :index="index"
              :sd-enable="data.serviceDiscovery.enable || false"
              :services="data.services"
            />
          </el-tab-pane>
        </el-tabs>
      </div>
      <el-divider />
      <el-form-item label-width="0">
        <div style="text-align: left; width: 100%">
          <el-button v-if="editIndex == ''" type="primary" plain @click="onSubmit">
            {{ i18next.t('uds.someip.someip.buttons.addDevice') }}
          </el-button>
          <el-button v-else type="warning" plain @click="onSubmit">
            {{ i18next.t('uds.someip.someip.buttons.saveDevice') }}
          </el-button>
        </div>
      </el-form-item>
    </el-form>
  </div>
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
  watch,
  nextTick,
  h
} from 'vue'
import { v4 } from 'uuid'
import { type FormRules, type FormInstance, ElMessageBox, ElMessage } from 'element-plus'

import { assign, cloneDeep } from 'lodash'
import { useDataStore } from '@r/stores/data'
import type { SomeipInfo, ServiceConfig, ApplicationConfig } from 'nodeCan/someip'
import { useProjectStore } from '@r/stores/project'
import { Icon } from '@iconify/vue'
import { useGlobalStart } from '@r/stores/runtime'
import { i18next } from '@r/i18n'

// Import service configuration component
import serviceConfig from './serviceConfig.vue'

const globalStart = useGlobalStart()
const ruleFormRef = ref<FormInstance>()
const dataBase = useDataStore()

const props = defineProps<{
  index: string
  height: number
}>()

const data = ref<SomeipInfo>({
  id: v4(),
  name: '',
  services: [],
  device: '',
  application: {
    id: '0x6301',
    max_dispatchers: 10,
    max_dispatch_time: 100,
    max_detached_thread_wait_time: 5,
    threads: 2,
    io_thread_nice: 0,
    has_session_handling: true
  },
  serviceDiscovery: {
    enable: false,
    multicast: '224.224.224.245',
    port: 30490,
    protocol: 'udp',
    initial_delay_min: 10,
    initial_delay_max: 100,
    repetitions_base_delay: 200,
    repetitions_max: 3,
    ttl: '3',
    cyclic_offer_delay: 1000,
    request_response_delay: 2000
  }
})

function getServiceName(item: ServiceConfig, index: number) {
  return (
    `${item.instance.replace('0x', '')}.${item.service.replace('0x', '')}` ||
    i18next.t('uds.someip.someip.serviceName', { index })
  )
}

const serviceRef = ref<Record<number, any>>({})

// Check for duplicate service+instance combinations
function checkServiceDuplicates() {
  const serviceMap = new Map<string, number>()
  const duplicateIndices = new Set<number>()

  data.value.services.forEach((service, index) => {
    if (service.service && service.instance) {
      const key = `${service.service}-${service.instance}`
      if (serviceMap.has(key)) {
        // Found duplicate
        duplicateIndices.add(serviceMap.get(key)!)
        duplicateIndices.add(index)
      } else {
        serviceMap.set(key, index)
      }
    }
  })

  // Clear previous errors for services that are no longer duplicates
  for (const index in errors.value) {
    if (!duplicateIndices.has(parseInt(index))) {
      delete errors.value[parseInt(index)]
    }
  }

  // Set errors for duplicate services
  duplicateIndices.forEach((index) => {
    errors.value[index] = new Error(
      i18next.t('uds.someip.someip.validation.serviceInstanceDuplicate')
    )
  })
}

const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (const key of Object.keys(dataBase.devices || {})) {
      if (dataBase.devices[key].type == 'someip' && dataBase.devices[key].someipDevice) {
        if (dataBase.devices[key].someipDevice.name == value && key != editIndex.value) {
          callback(new Error(i18next.t('uds.someip.someip.validation.nameExists')))
        }
      }
    }
    callback()
  } else {
    callback(new Error(i18next.t('uds.someip.someip.validation.inputName')))
  }
}

const deviceList = computed(() => {
  return Object.values(dataBase.devices)
    .filter((item) => item.type == 'eth' && item.ethDevice)
    .map((item) => item.ethDevice!)
})
const activeTabName = ref('')
const emits = defineEmits(['change'])

const idCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    //must be hex string, max ffff
    if (!/^0x[0-9a-fA-F]{1,4}$/.test(value)) {
      callback(new Error(i18next.t('uds.someip.someip.validation.invalidApplicationId')))
    }

    // Check for duplicate application ID across different SOME/IP configurations
    for (const key of Object.keys(dataBase.devices)) {
      if (dataBase.devices[key].type == 'someip' && dataBase.devices[key].someipDevice) {
        const hasApplicationId = dataBase.devices[key].someipDevice.application.id

        if (hasApplicationId == value && key != editIndex.value) {
          callback(new Error(i18next.t('uds.someip.someip.validation.applicationIdExists')))
        }
      }
    }

    callback()
  } else {
    callback(new Error(i18next.t('uds.someip.someip.validation.inputApplicationId')))
  }
}

const portCheck = (rule: any, value: any, callback: any) => {
  if (value !== undefined && value !== null && value !== '') {
    if (isNaN(value) || value < 0 || value > 65535) {
      callback(new Error(i18next.t('uds.someip.someip.validation.portRange')))
    } else {
      callback()
    }
  } else {
    callback()
  }
}

const ipAddressCheck = (rule: any, value: any, callback: any) => {
  if (value && value.trim() !== '') {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(value)) {
      callback(new Error(i18next.t('uds.someip.someip.validation.invalidIpAddress')))
    } else {
      const parts = value.split('.')
      for (const part of parts) {
        if (parseInt(part) > 255) {
          callback(new Error(i18next.t('uds.someip.someip.validation.ipAddressRange')))
        }
      }
      callback()
    }
  } else {
    callback()
  }
}

const rules = computed<FormRules>(() => {
  return {
    name: [
      {
        required: true,
        trigger: 'blur',
        validator: nameCheck
      }
    ],
    device: [
      {
        required: true,
        trigger: 'blur'
      }
    ],
    'application.name': [
      {
        required: true,
        message: i18next.t('uds.someip.someip.validation.inputApplicationName'),
        trigger: 'blur'
      }
    ],
    'application.id': [
      {
        required: true,
        trigger: 'blur',
        validator: idCheck
      }
    ],
    'serviceDiscovery.port': [
      {
        trigger: 'blur',
        validator: portCheck
      }
    ],
    'serviceDiscovery.multicast': [
      {
        trigger: 'blur',
        validator: ipAddressCheck
      }
    ]
  }
})

// Generate unique service ID from 0x0000 to 0xFFFF
function generateUniqueServiceId(): string {
  const usedServiceIds = new Set(data.value.services.map((s) => s.service))

  for (let id = 0; id <= 0xffff; id++) {
    const hexId = `0x${id.toString(16).toUpperCase().padStart(4, '0')}`
    if (!usedServiceIds.has(hexId)) {
      return hexId
    }
  }

  // Fallback if all IDs are used (unlikely)
  return '0x0000'
}

// Generate instance ID - reuse existing if available, otherwise generate unique
function generateInstanceId(): string {
  // If there are existing services, use the same instance ID as the last one
  if (data.value.services.length > 0) {
    return data.value.services[data.value.services.length - 1].instance
  }

  // If no existing services, start with 0x0000
  return '0x0000'
}

function addService() {
  const uniqueServiceId = generateUniqueServiceId()
  const instanceId = generateInstanceId()

  data.value.services.push({
    service: uniqueServiceId,
    instance: instanceId,
    reliable: {
      port: 30509
    },
    events: [],
    eventgroups: []
  })
  activeTabName.value = `index${data.value.services.length - 1}`
}

function removeTab(targetName: string) {
  const index = parseInt(targetName.replace('index', ''))
  data.value.services.splice(index, 1)
  activeTabName.value = `index${data.value.services.length - 1}`
  nextTick(() => {
    delete serviceRef.value[index]
    ruleFormRef.value?.validate()
  })
}

const errors = ref<Record<number, any>>({})
const onSubmit = async () => {
  try {
    errors.value = {}

    // Check for duplicate service combinations first
    checkServiceDuplicates()

    // Validate each service configuration
    for (let i = 0; i < Object.values(serviceRef.value).length; i++) {
      await serviceRef.value[i]?.dataValid().catch((e: any) => {
        errors.value[i] = e
      })
    }

    await ruleFormRef.value?.validate()
    if (Object.keys(errors.value).length > 0) {
      return false
    }

    if (editIndex.value == '') {
      const id = v4()
      data.value.id = id
      dataBase.devices[id] = {
        type: 'someip',
        someipDevice: cloneDeep(data.value)
      }
    } else {
      data.value.id = editIndex.value
      dataBase.devices[editIndex.value].someipDevice = cloneDeep(data.value)
    }

    emits('change', data.value.id, data.value.name)
    return true
  } catch (e) {
    return false
  }
}

let watcher: any
const editIndex = ref(props.index)
function generateUniqueName(): string {
  let index = 0
  let name = i18next.t('uds.someip.someip.defaultName', { index })

  // 检查是否存在同名配置
  while (
    Object.values(dataBase.devices).some(
      (device) =>
        device.type == 'someip' && device.someipDevice && device.someipDevice.name === name
    )
  ) {
    index++
    name = i18next.t('uds.someip.someip.defaultName', { index })
  }

  return name
}
onBeforeMount(() => {
  if (editIndex.value) {
    const editData = dataBase.devices[editIndex.value]
    if (editData && editData.type == 'someip' && editData.someipDevice) {
      data.value = cloneDeep(editData.someipDevice)
      if (data.value.services.length > 0) activeTabName.value = `index${0}`

      // Check device exist
      if (data.value.device) {
        const device = dataBase.devices[data.value.device]
        if (!device || device.type !== 'eth' || !device.ethDevice) {
          data.value.device = ''
        }
      }
    } else {
      editIndex.value = ''
      data.value.name = generateUniqueName()
    }
  } else {
    editIndex.value = ''
    data.value.name = generateUniqueName()
  }
})

onUnmounted(() => {
  // watcher()
})
</script>

<style scoped>
.custom-tabs-label {
  width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  height: 20px;
}

.addrError {
  color: var(--el-color-danger);
  font-weight: bold;
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
