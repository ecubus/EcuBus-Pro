<template>
  <div style="padding: 20px; min-width: 600px">
    <el-form
      ref="ruleFormRef"
      :model="data"
      label-width="150px"
      :rules="rules"
      size="small"
      hide-required-asterisk
    >
      <el-form-item label="SomeIP Name" prop="name">
        <el-input v-model="data.name" :disabled="globalStart" placeholder="Name" />
      </el-form-item>

      <el-form-item label="Simulate By" prop="simulateBy">
        <el-select v-model="data.simulateBy" :disabled="globalStart" clearable>
          <el-option v-for="item in nodesName" :key="item.id" :label="item.name" :value="item.id">
          </el-option>
        </el-select>
      </el-form-item>

      <el-divider content-position="left">Application Configuration</el-divider>

      <el-form-item label="Application Name" prop="application.name">
        <el-input
          v-model="data.application.name"
          :disabled="globalStart"
          placeholder="Application name"
        />
      </el-form-item>

      <el-form-item label="Application ID" prop="application.id">
        <el-input
          v-model="data.application.id"
          :disabled="globalStart"
          placeholder="0x6301"
          :max="6"
        />
      </el-form-item>

      <el-form-item label-width="0">
        <el-col :span="12">
          <el-form-item label="Max Dispatchers" prop="application.max_dispatchers">
            <el-input v-model.number="data.application.max_dispatchers" :disabled="globalStart" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Max Dispatch Time" prop="application.max_dispatch_time">
            <el-input v-model.number="data.application.max_dispatch_time" :disabled="globalStart" />
          </el-form-item>
        </el-col>
      </el-form-item>

      <el-form-item label-width="0">
        <el-col :span="12">
          <el-form-item label="Threads" prop="application.threads">
            <el-input v-model.number="data.application.threads" :disabled="globalStart" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="IO Thread Nice" prop="application.io_thread_nice">
            <el-input v-model.number="data.application.io_thread_nice" :disabled="globalStart" />
          </el-form-item>
        </el-col>
      </el-form-item>

      <el-form-item label="Session Handling" prop="application.has_session_handling">
        <el-checkbox v-model="data.application.has_session_handling" :disabled="globalStart" />
      </el-form-item>

      <el-divider content-position="left">
        <el-button icon="Plus" link type="primary" :disabled="globalStart" @click="addService">
          Add Service
        </el-button>
      </el-divider>
    </el-form>

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
            :services="data.services"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
    <el-divider />
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
import { SomeipInfo, ServiceConfig, ApplicationConfig } from 'src/main/vsomeip/share'
import { useProjectStore } from '@r/stores/project'
import { Icon } from '@iconify/vue'
import { useGlobalStart } from '@r/stores/runtime'

// Import service configuration component (to be created)
// import serviceConfig from './serviceConfig.vue'

const globalStart = useGlobalStart()
const ruleFormRef = ref<FormInstance>()
const dataBase = useDataStore()
const nodesName = computed(() => {
  return Object.values(dataBase.nodes)
})

const props = defineProps<{
  index: string
  height: number
}>()

const data = ref<SomeipInfo>({
  id: v4(),
  name: '',
  services: [],
  simulateBy: undefined,
  application: {
    name: '',
    id: '0x6301',
    max_dispatchers: 10,
    max_dispatch_time: 100,
    max_detached_thread_wait_time: 5,
    threads: 2,
    io_thread_nice: 0,
    has_session_handling: true
  }
})

function getServiceName(item: ServiceConfig, index: number) {
  return `${item.service}.${item.instance}` || `Service${index}`
}

const serviceRef = ref<Record<number, any>>({})

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

const activeTabName = ref('')
const emits = defineEmits(['change'])

const rules = computed<FormRules>(() => {
  return {
    name: [
      {
        required: true,
        trigger: 'blur',
        validator: nameCheck
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
        message: 'Please input application ID',
        trigger: 'blur'
      }
    ]
  }
})

const project = useProjectStore()

function addService() {
  data.value.services.push({
    service: '0x1234',
    instance: '0x5678',
    protocol: 'someip',
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
    for (let i = 0; i < Object.values(serviceRef.value).length; i++) {
      await serviceRef.value[i]?.dataValid().catch((e: any) => {
        errors.value[i] = e
      })
    }
    await ruleFormRef.value?.validate()
    if (Object.keys(errors.value).length > 0) {
      return false
    }

    // Save to data store
    if (!dataBase.someip) {
      dataBase.someip = {}
    }
    dataBase.someip[editIndex.value] = cloneDeep(data.value)

    emits('change', editIndex.value, data.value.name)
    return true
  } catch (e) {
    return false
  }
}

let watcher: any
const editIndex = ref(props.index)

onBeforeMount(() => {
  if (editIndex.value) {
    const editData = dataBase.someip?.[editIndex.value]
    if (editData) {
      data.value = cloneDeep(editData)
      if (data.value.services.length > 0) activeTabName.value = `index${0}`

      // Check simulateBy exist
      if (data.value.simulateBy) {
        const node = dataBase.nodes[data.value.simulateBy]
        if (!node) {
          data.value.simulateBy = undefined
        }
      }
    } else {
      editIndex.value = ''
      data.value.name = `SomeIP_${Object.keys(dataBase.someip || {}).length}`
    }
  } else {
    editIndex.value = ''
    data.value.name = `SomeIP_${Object.keys(dataBase.someip || {}).length}`
  }

  watcher = watch(
    data,
    () => {
      onSubmit()
    },
    { deep: true }
  )
})

onUnmounted(() => {
  watcher()
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
</style>
