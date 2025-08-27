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
      <el-form-item label="SomeIP Name" prop="name">
        <el-input v-model="data.name" placeholder="SomeIP_0" />
      </el-form-item>

      <el-form-item label="Device" prop="device">
        <el-select v-model="data.device" clearable placeholder="Select Device">
          <el-option v-for="item in deviceList" :key="item.id" :label="item.name" :value="item.id">
          </el-option>
        </el-select>
      </el-form-item>

      <el-divider content-position="left">Application Configuration</el-divider>

      <el-form-item label="Application ID" prop="application.id">
        <el-input v-model="data.application.id" placeholder="0x6301" :max="6" />
      </el-form-item>
      <el-collapse>
        <el-collapse-item title="Advanced Application Configuration" name="1">
          <el-form-item label-width="0">
            <el-col :span="12">
              <el-form-item label="Max Dispatchers" prop="application.max_dispatchers">
                <el-input v-model.number="data.application.max_dispatchers" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="Max Dispatch Time" prop="application.max_dispatch_time">
                <el-input v-model.number="data.application.max_dispatch_time" />
              </el-form-item>
            </el-col>
          </el-form-item>

          <el-form-item label-width="0">
            <el-col :span="12">
              <el-form-item label="Threads" prop="application.threads">
                <el-input v-model.number="data.application.threads" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="IO Thread Nice" prop="application.io_thread_nice">
                <el-input v-model.number="data.application.io_thread_nice" />
              </el-form-item>
            </el-col>
          </el-form-item>

          <el-form-item label="Session Handling" prop="application.has_session_handling">
            <el-checkbox v-model="data.application.has_session_handling" />
          </el-form-item>
        </el-collapse-item>
      </el-collapse>

      <el-divider content-position="left">Service Discovery Configuration</el-divider>

      <el-form-item prop="serviceDiscovery.enable">
        <template #label>
          <el-tooltip
            content="Specifies whether the Service Discovery is enabled"
            placement="top"
            :show-after="1000"
          >
            <span class="label-with-tooltip">Enable Service Discovery </span>
          </el-tooltip>
        </template>
        <el-checkbox v-model="data.serviceDiscovery.enable" />
      </el-form-item>

      <div>
        <!-- Basic Service Discovery Configuration -->
        <el-form-item prop="serviceDiscovery.initial_state">
          <template #label>
            <el-tooltip
              content="Specifies the initial Service Discovery state after startup"
              placement="top"
              :show-after="1000"
            >
              <span class="label-with-tooltip">Initial State </span>
            </el-tooltip>
          </template>
          <el-select v-model="data.serviceDiscovery.initial_state" placeholder="unknown">
            <el-option label="Unknown" value="unknown" />
            <el-option label="Suspended" value="suspended" />
            <el-option label="Resumed" value="resumed" />
          </el-select>
        </el-form-item>

        <el-form-item label-width="0">
          <el-col :span="12">
            <el-form-item prop="serviceDiscovery.multicast">
              <template #label>
                <el-tooltip
                  content="The multicast address which the messages of the Service Discovery will be sent to (default: 224.224.224.0)"
                  placement="top"
                  :show-after="1000"
                >
                  <span class="label-with-tooltip">Multicast Address </span>
                </el-tooltip>
              </template>
              <el-input v-model="data.serviceDiscovery.multicast" placeholder="224.224.224.0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="serviceDiscovery.port">
              <template #label>
                <el-tooltip
                  content="The port of the Service Discovery (default: 30490)"
                  placement="top"
                  :show-after="1000"
                >
                  <span class="label-with-tooltip">Port </span>
                </el-tooltip>
              </template>
              <el-input v-model.number="data.serviceDiscovery.port" placeholder="30490" />
            </el-form-item>
          </el-col>
        </el-form-item>

        <el-form-item prop="serviceDiscovery.protocol">
          <template #label>
            <el-tooltip
              content="The protocol that is used for sending the Service Discovery messages"
              placement="top"
              :show-after="1000"
            >
              <span class="label-with-tooltip">Protocol </span>
            </el-tooltip>
          </template>
          <el-select v-model="data.serviceDiscovery.protocol" placeholder="udp">
            <el-option label="UDP" value="udp" />
            <el-option label="TCP" value="tcp" />
          </el-select>
        </el-form-item>

        <!-- Advanced Service Discovery Configuration (Collapsible) -->
        <el-collapse>
          <el-collapse-item title="Advanced Service Discovery Configuration" name="1">
            <!-- Timing Configuration -->
            <el-divider content-position="left">Timing Configuration</el-divider>

            <el-form-item label-width="0">
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.initial_delay_min">
                  <template #label>
                    <el-tooltip
                      content="Minimum delay before first offer message (default: 0)"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip">Initial Delay Min (ms) </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.initial_delay_min"
                    placeholder="0"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.initial_delay_max">
                  <template #label>
                    <el-tooltip
                      content="Maximum delay before first offer message (default: 3000)"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip">Initial Delay Max (ms) </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.initial_delay_max"
                    placeholder="3000"
                  />
                </el-form-item>
              </el-col>
            </el-form-item>

            <el-form-item label-width="0">
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.repetitions_base_delay">
                  <template #label>
                    <el-tooltip
                      content="Base delay sending offer messages within the repetition phase (default: 10)"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip">Repetitions Base Delay (ms) </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.repetitions_base_delay"
                    placeholder="10"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.repetitions_max">
                  <template #label>
                    <el-tooltip
                      content="Maximum number of repetitions for provided services within the repetition phase (default: 3)"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip">Repetitions Max </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.repetitions_max"
                    placeholder="3"
                  />
                </el-form-item>
              </el-col>
            </el-form-item>

            <el-form-item label-width="0">
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.cyclic_offer_delay">
                  <template #label>
                    <el-tooltip
                      content="Cycle of the OfferService messages in the main phase (default: 1000)"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip">Cyclic Offer Delay (ms) </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.cyclic_offer_delay"
                    placeholder="1000"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.request_response_delay">
                  <template #label>
                    <el-tooltip
                      content="Minimum delay of a unicast message to a multicast message for provided services and eventgroups (default: 2000)"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip">Request Response Delay (ms) </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.request_response_delay"
                    placeholder="2000"
                  />
                </el-form-item>
              </el-col>
            </el-form-item>

            <!-- Debounce Configuration -->
            <el-divider content-position="left">Debounce Configuration</el-divider>

            <el-form-item label-width="0">
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.offer_debounce_time">
                  <template #label>
                    <el-tooltip
                      content="Time which the stack collects new service offers before they enter the repetition phase (default: 500)"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip">Offer Debounce Time (ms) </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.offer_debounce_time"
                    placeholder="500"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.find_debounce_time">
                  <template #label>
                    <el-tooltip
                      content="Time which the stack collects non local service requests before sending find messages (default: 500)"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip">Find Debounce Time (ms) </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.find_debounce_time"
                    placeholder="500"
                  />
                </el-form-item>
              </el-col>
            </el-form-item>

            <el-form-item label-width="0">
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.find_initial_debounce_reps">
                  <template #label>
                    <el-tooltip
                      content="Number of initial debounces using find_initial_debounce_time (default: 0, valid values: 0-255)"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip">Find Initial Debounce Reps </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.find_initial_debounce_reps"
                    placeholder="0"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item prop="serviceDiscovery.find_initial_debounce_time">
                  <template #label>
                    <el-tooltip
                      content="Time which the stack collects new service requests before they enter the repetition phase during initial startup (default: 200)"
                      placement="top"
                      :show-after="1000"
                    >
                      <span class="label-with-tooltip">Find Initial Debounce Time (ms) </span>
                    </el-tooltip>
                  </template>
                  <el-input
                    v-model.number="data.serviceDiscovery.find_initial_debounce_time"
                    placeholder="200"
                  />
                </el-form-item>
              </el-col>
            </el-form-item>

            <!-- TTL Configuration -->
            <el-divider content-position="left">TTL Configuration</el-divider>

            <el-form-item prop="serviceDiscovery.ttl">
              <template #label>
                <el-tooltip
                  content="Lifetime of entries for provided services as well as consumed services and eventgroups (default: 0xFFFFFF)"
                  placement="top"
                  :show-after="1000"
                >
                  <span class="label-with-tooltip">TTL </span>
                </el-tooltip>
              </template>
              <el-input v-model="data.serviceDiscovery.ttl" placeholder="0xFFFFFF" />
            </el-form-item>

            <!-- Other Configuration -->
            <el-divider content-position="left">Other Configuration</el-divider>

            <el-form-item prop="serviceDiscovery.max_remote_subscribers">
              <template #label>
                <el-tooltip
                  content="Maximum possible number of different remote subscribers. Additional remote subscribers will not be acknowledged (default: 3)"
                  placement="top"
                  :show-after="1000"
                >
                  <span class="label-with-tooltip">Max Remote Subscribers </span>
                </el-tooltip>
              </template>
              <el-input
                v-model.number="data.serviceDiscovery.max_remote_subscribers"
                placeholder="3"
              />
            </el-form-item>

            <el-form-item prop="serviceDiscovery.wait_route_netlink_notification">
              <template #label>
                <el-tooltip
                  content="Enables the tracking of the route state on_net_interface_or_route_state_changed (default: true)"
                  placement="top"
                  :show-after="1000"
                >
                  <span class="label-with-tooltip">Wait Route Netlink Notification </span>
                </el-tooltip>
              </template>
              <el-checkbox v-model="data.serviceDiscovery.wait_route_netlink_notification" />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>
      </div>

      <el-divider content-position="left">
        <el-button icon="Plus" link type="primary" @click="addService"> Add Service </el-button>
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
            Add Device
          </el-button>
          <el-button v-else type="warning" plain @click="onSubmit"> Save Device </el-button>
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
import type { SomeipInfo, ServiceConfig, ApplicationConfig } from 'src/main/vsomeip/share'
import { useProjectStore } from '@r/stores/project'
import { Icon } from '@iconify/vue'
import { useGlobalStart } from '@r/stores/runtime'

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
    initial_state: 'unknown',
    multicast: '224.224.224.0',
    port: 30490,
    protocol: 'udp',
    initial_delay_min: 0,
    initial_delay_max: 3000,
    repetitions_base_delay: 10,
    repetitions_max: 3,
    ttl: '0xFFFFFF',
    cyclic_offer_delay: 1000,
    request_response_delay: 2000,
    offer_debounce_time: 500,
    find_debounce_time: 500,
    max_remote_subscribers: 3,
    find_initial_debounce_reps: 0,
    find_initial_debounce_time: 200,
    wait_route_netlink_notification: true
  }
})

function getServiceName(item: ServiceConfig, index: number) {
  return `${item.instance.replace('0x', '')}.${item.service.replace('0x', '')}` || `Service${index}`
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
    errors.value[index] = new Error('Service ID and Instance ID combination already exists')
  })
}

const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (const key of Object.keys(dataBase.someip || {})) {
      const hasName = dataBase.someip?.[key]?.name
      if (hasName == value && key != editIndex.value) {
        callback(new Error('The SomeIP name already exists'))
      }
    }
    callback()
  } else {
    callback(new Error('Please input SomeIP name'))
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
      callback(new Error('Please input valid application ID, must be hex string,ex:0x6301'))
    }

    // Check for duplicate application ID across different SOME/IP configurations
    for (const key of Object.keys(dataBase.someip)) {
      const hasApplicationId = dataBase.someip[key].application.id
      if (hasApplicationId == value && key != editIndex.value) {
        callback(new Error('The application ID already exists'))
      }
    }

    callback()
  } else {
    callback(new Error('Please input application ID'))
  }
}

const portCheck = (rule: any, value: any, callback: any) => {
  if (value !== undefined && value !== null && value !== '') {
    if (isNaN(value) || value < 1 || value > 65535) {
      callback(new Error('Port must be 1 - 65535'))
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
      callback(new Error('Please enter a valid IP address'))
    } else {
      const parts = value.split('.')
      for (const part of parts) {
        if (parseInt(part) > 255) {
          callback(new Error('IP address parts must 0 - 255'))
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
        message: 'Please input application name',
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
      dataBase.someip[id] = cloneDeep(data.value)
    } else {
      data.value.id = editIndex.value
      dataBase.someip[editIndex.value] = cloneDeep(data.value)
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
  let name = `SomeIP_${index}`

  // 检查是否存在同名配置
  while (Object.values(dataBase.someip).some((soa) => soa.name === name)) {
    index++
    name = `SomeIP_${index}`
  }

  return name
}
onBeforeMount(() => {
  if (editIndex.value) {
    const editData = dataBase.someip[editIndex.value]
    if (editData) {
      data.value = cloneDeep(editData)
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
