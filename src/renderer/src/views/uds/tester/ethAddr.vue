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
    <el-form-item :label="i18next.t('uds.tester.ethAddr.labels.addressName')" required prop="name">
      <el-input v-model="data.name" />
    </el-form-item>
    <el-form-item
      :label="i18next.t('uds.tester.ethAddr.labels.addressType')"
      required
      prop="taType"
    >
      <el-select v-model="data.taType">
        <el-option
          value="physical"
          :label="i18next.t('uds.tester.ethAddr.options.addressType.physical')"
        ></el-option>
        <el-option
          value="functional"
          :label="i18next.t('uds.tester.ethAddr.options.addressType.functional')"
        ></el-option>
      </el-select>
    </el-form-item>
    <el-divider content-position="left">
      {{ i18next.t('uds.tester.ethAddr.sections.tester') }}
    </el-divider>
    <el-form-item
      :label="i18next.t('uds.tester.ethAddr.labels.testerAddress')"
      required
      prop="tester.testerLogicalAddr"
    >
      <el-input
        v-model.number="data.tester.testerLogicalAddr"
        :placeholder="i18next.t('uds.tester.ethAddr.placeholders.logicalAddress')"
      />
    </el-form-item>
    <el-form-item label-width="0">
      <el-row>
        <el-col :span="12">
          <el-form-item
            :label="i18next.t('uds.tester.ethAddr.labels.connectDelay')"
            required
            prop="tester.createConnectDelay"
          >
            <el-input v-model="data.tester.createConnectDelay" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item
            :label="i18next.t('uds.tester.ethAddr.labels.activeDelay')"
            required
            prop="tester.routeActiveTime"
          >
            <el-input v-model="data.tester.routeActiveTime" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form-item>
    <el-divider content-position="left">
      {{ i18next.t('uds.tester.ethAddr.sections.ecu') }}
    </el-divider>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.ecuAddress')"
          required
          prop="entity.logicalAddr"
        >
          <el-input
            v-model.number="data.entity.logicalAddr"
            :placeholder="i18next.t('uds.tester.ethAddr.placeholders.logicalAddress')"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.eid')"
          required
          prop="entity.eid"
        >
          <el-input v-model="data.entity.eid" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.entityType')"
          required
          prop="entity.nodeType"
        >
          <el-select
            v-model.number="data.entity.nodeType"
            :placeholder="i18next.t('uds.tester.ethAddr.placeholders.entityType')"
          >
            <el-option
              value="node"
              :label="i18next.t('uds.tester.ethAddr.options.entityType.node')"
            ></el-option>
            <el-option
              value="gateway"
              :label="i18next.t('uds.tester.ethAddr.options.entityType.gateway')"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.nodeAddress')"
          :required="data.entity.nodeType == 'gateway'"
          prop="entity.nodeAddr"
        >
          <el-input
            v-model.number="data.entity.nodeAddr"
            :placeholder="i18next.t('uds.tester.ethAddr.placeholders.logicalAddress')"
            :disabled="data.entity.nodeType == 'node'"
          />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.vin')"
          required
          prop="entity.vin"
        >
          <el-input v-model="data.entity.vin" :max="17" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.gid')"
          required
          prop="entity.gid"
        >
          <el-input v-model="data.entity.gid" :max="17" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-divider content-position="left">
      {{ i18next.t('uds.tester.ethAddr.sections.vehicleIdentify') }}
    </el-divider>
    <el-form-item
      :label="i18next.t('uds.tester.ethAddr.labels.vinRequestMethod')"
      required
      prop="virReqType"
    >
      <el-select v-model="data.virReqType">
        <el-option
          value="unicast"
          :label="i18next.t('uds.tester.ethAddr.options.virReqType.unicast')"
        ></el-option>
        <el-option
          value="omit"
          :label="i18next.t('uds.tester.ethAddr.options.virReqType.omit')"
        ></el-option>
        <el-option
          value="broadcast"
          :label="i18next.t('uds.tester.ethAddr.options.virReqType.broadcast')"
        ></el-option>
        <el-option
          value="multicast"
          :label="i18next.t('uds.tester.ethAddr.options.virReqType.multicast')"
          disabled
        ></el-option>
      </el-select>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.requestAddress')"
          prop="virReqAddr"
        >
          <el-input v-model="data.virReqAddr" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.entityMissBehavior')"
          prop="entityNotFoundBehavior"
        >
          <el-select v-model="data.entityNotFoundBehavior">
            <!-- <el-option value="no" label="Report Error"></el-option> -->
            <el-option
              value="normal"
              :label="i18next.t('uds.tester.ethAddr.options.entityNotFoundBehavior.normal')"
            ></el-option>
            <el-option
              value="withVin"
              :label="i18next.t('uds.tester.ethAddr.options.entityNotFoundBehavior.withVin')"
            ></el-option>
            <el-option
              value="withEid"
              :label="i18next.t('uds.tester.ethAddr.options.entityNotFoundBehavior.withEid')"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-divider content-position="left">
      {{ i18next.t('uds.tester.ethAddr.sections.testerSpecialControl') }}
    </el-divider>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.udpClientPort')"
          prop="udpClientPort"
        >
          <el-input-number
            v-model="data.udpClientPort"
            :min="0"
            :max="65535"
            controls-position="right"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.tcpClientPort')"
          prop="tcpClientPort"
        >
          <el-input-number
            v-model="data.tcpClientPort"
            :min="0"
            :max="65535"
            controls-position="right"
          />
        </el-form-item>
      </el-col>
    </el-form-item>
    <template v-if="Number(props.version) == 3">
      <el-divider content-position="left">
        {{ i18next.t('uds.tester.ethAddr.sections.tlsSettingsTesterV3') }}
      </el-divider>
      <el-form-item :label="i18next.t('uds.tester.ethAddr.labels.enableTls')" prop="tls.enabled">
        <el-switch v-model="tlsEnabled" @change="onTlsEnabledChange" />
        <span class="tls-hint">
          {{ i18next.t('uds.tester.ethAddr.tooltips.enableTls') }}
        </span>
      </el-form-item>
      <template v-if="tlsEnabled">
        <el-form-item :label="i18next.t('uds.tester.ethAddr.labels.tlsPort')" prop="tls.port">
          <el-input-number
            v-model="data.tls!.port"
            :min="1"
            :max="65535"
            :placeholder="3496"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item :label="i18next.t('uds.tester.ethAddr.labels.caCert')" prop="tls.ca">
          <el-input
            v-model="data.tls!.ca"
            :placeholder="i18next.t('uds.tester.ethAddr.placeholders.caCertPath')"
          >
            <template #append>
              <el-button @click="selectCertFile('ca')">
                {{ i18next.t('uds.tester.ethAddr.actions.browse') }}
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item :label="i18next.t('uds.tester.ethAddr.labels.clientCert')" prop="tls.cert">
          <el-input
            v-model="data.tls!.cert"
            :placeholder="i18next.t('uds.tester.ethAddr.placeholders.clientCertPath')"
          >
            <template #append>
              <el-button @click="selectCertFile('cert')">
                {{ i18next.t('uds.tester.ethAddr.actions.browse') }}
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item :label="i18next.t('uds.tester.ethAddr.labels.privateKey')" prop="tls.key">
          <el-input
            v-model="data.tls!.key"
            :placeholder="i18next.t('uds.tester.ethAddr.placeholders.privateKeyPath')"
          >
            <template #append>
              <el-button @click="selectCertFile('key')">
                {{ i18next.t('uds.tester.ethAddr.actions.browse') }}
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.skipVerify')"
          prop="tls.rejectUnauthorized"
        >
          <el-switch v-model="skipVerify" />
          <span class="tls-hint">
            {{ i18next.t('uds.tester.ethAddr.tooltips.skipVerify') }}
          </span>
        </el-form-item>
        <el-form-item
          :label="i18next.t('uds.tester.ethAddr.labels.enableKeyLog')"
          prop="tls.enableKeyLog"
        >
          <el-switch v-model="enableKeyLog" />
          <span class="tls-hint">
            {{ i18next.t('uds.tester.ethAddr.tooltips.enableKeyLog') }}
          </span>
        </el-form-item>
        <template v-if="enableKeyLog">
          <el-form-item
            :label="i18next.t('uds.tester.ethAddr.labels.keyLogPath')"
            prop="tls.keyLogPath"
          >
            <el-input
              v-model="data.tls!.keyLogPath"
              :placeholder="i18next.t('uds.tester.ethAddr.placeholders.keyLogPath')"
            >
              <template #append>
                <el-button @click="selectKeyLogFile">
                  {{ i18next.t('uds.tester.ethAddr.actions.browse') }}
                </el-button>
              </template>
            </el-input>
          </el-form-item>
        </template>
      </template>
    </template>
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
import { EntityAddr, EthAddr, TlsConfig } from 'nodeCan/doip'
import { useGlobalStart } from '@r/stores/runtime'
import { useProjectStore } from '@r/stores/project'
import { i18next } from '@r/i18n'

const ruleFormRef = ref<FormInstance>()
const globalStart = useGlobalStart()
const project = useProjectStore()
const data = defineModel<EthAddr>({
  required: true
})

// TLS computed properties
const tlsEnabled = computed({
  get: () => data.value.tls?.enabled || false,
  set: (val) => {
    if (!data.value.tls) {
      data.value.tls = {
        enabled: val,
        port: 3496,
        rejectUnauthorized: true
      }
    } else {
      data.value.tls.enabled = val
    }
  }
})

const skipVerify = computed({
  get: () => data.value.tls?.rejectUnauthorized === false,
  set: (val) => {
    if (data.value.tls) {
      data.value.tls.rejectUnauthorized = !val
    }
  }
})

const enableKeyLog = computed({
  get: () => data.value.tls?.enableKeyLog || false,
  set: (val: boolean) => {
    if (!data.value.tls) {
      data.value.tls = {
        enabled: false,
        port: 3496,
        rejectUnauthorized: true
      }
    }
    data.value.tls.enableKeyLog = val
  }
})

function onTlsEnabledChange(val: boolean) {
  if (val && !data.value.tls) {
    data.value.tls = {
      enabled: true,
      port: 3496,
      rejectUnauthorized: true
    }
  }
}

async function selectCertFile(type: 'ca' | 'cert' | 'key') {
  const titles: Record<string, string> = {
    ca: i18next.t('uds.tester.ethAddr.dialogs.selectCaCert'),
    cert: i18next.t('uds.tester.ethAddr.dialogs.selectClientCert'),
    key: i18next.t('uds.tester.ethAddr.dialogs.selectPrivateKey')
  }
  const extensions: Record<string, string[]> = {
    ca: ['pem', 'crt', 'cer'],
    cert: ['pem', 'crt', 'cer'],
    key: ['pem', 'key']
  }

  const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: titles[type],
    properties: ['openFile'],
    filters: [
      {
        name: i18next.t('uds.tester.ethAddr.dialogs.certificateFiles'),
        extensions: extensions[type]
      },
      { name: i18next.t('uds.tester.ethAddr.dialogs.allFiles'), extensions: ['*'] }
    ]
  })
  const file = r.filePaths[0]
  if (file && data.value.tls) {
    if (project.projectInfo.path) {
      data.value.tls[type] = window.path.relative(project.projectInfo.path, file)
    } else {
      data.value.tls[type] = file
    }
  }
}

async function selectKeyLogFile() {
  const r = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
    defaultPath: project.projectInfo.path,
    title: i18next.t('uds.tester.ethAddr.dialogs.selectKeyLogFile'),
    properties: ['openFile', 'createDirectory'],
    filters: [
      { name: i18next.t('uds.tester.ethAddr.dialogs.logTextFiles'), extensions: ['log', 'txt'] },
      { name: i18next.t('uds.tester.ethAddr.dialogs.allFiles'), extensions: ['*'] }
    ]
  })
  const file = r.filePaths?.[0]
  if (file) {
    if (!data.value.tls) {
      data.value.tls = {
        enabled: false,
        port: 3496,
        rejectUnauthorized: true
      }
    }
    if (project.projectInfo.path) {
      data.value.tls.keyLogPath = window.path.relative(project.projectInfo.path, file)
    } else {
      data.value.tls.keyLogPath = file
    }
  }
}

const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (let i = 0; i < addrs.value.length; i++) {
      const hasName = addrs.value[i].ethAddr?.name
      if (hasName == value && i != editIndex.value) {
        callback(new Error(i18next.t('uds.tester.ethAddr.validation.nameExists')))
      }
    }
    callback()
  } else {
    callback(new Error(i18next.t('uds.tester.ethAddr.validation.inputNodeName')))
  }
}

const addrCheck = (rule: any, value: any, callback: any) => {
  if (value.toString().length > 0) {
    for (let i = 0; i < addrs.value.length; i++) {
      if (data.value.entity.nodeType == 'gateway') {
        const hasName = `${addrs.value[i].ethAddr?.entity.logicalAddr}.${addrs.value[i].ethAddr?.entity.nodeAddr}`
        const selfValue = `${data.value.entity.logicalAddr}.${data.value.entity.nodeAddr}`
        if (hasName == selfValue && i != editIndex.value) {
          callback(new Error(i18next.t('uds.tester.ethAddr.validation.addressExists')))
        }
      } else {
        const hasName = addrs.value[i].ethAddr?.entity.logicalAddr
        if (hasName == value && i != editIndex.value) {
          callback(new Error(i18next.t('uds.tester.ethAddr.validation.addressExists')))
        }
      }
    }
    if (value < 0 || value > 0xffff) {
      callback(new Error(i18next.t('uds.tester.ethAddr.validation.addressRange')))
    }
    if (value == data.value.tester.testerLogicalAddr) {
      callback(new Error(i18next.t('uds.tester.ethAddr.validation.testerAddrSameAsTester')))
    }
    callback()
  } else {
    callback(new Error(i18next.t('uds.tester.ethAddr.validation.logicalAddressRequired')))
  }
}
const taddrCheck = (rule: any, value: any, callback: any) => {
  if (value.toString().length > 0) {
    if (value < 0 || value > 0xffff) {
      callback(new Error(i18next.t('uds.tester.ethAddr.validation.addressRange')))
    }
    if (value == data.value.entity.logicalAddr) {
      callback(new Error(i18next.t('uds.tester.ethAddr.validation.testerAddrSameAsEcu')))
    }
    // Check that all tester logical addresses match
    for (let i = 0; i < addrs.value.length; i++) {
      if (
        i !== editIndex.value &&
        data.value.tester.testerLogicalAddr !== addrs.value[i].ethAddr?.tester.testerLogicalAddr
      ) {
        callback(new Error(i18next.t('uds.tester.ethAddr.validation.testerAddrAllSame')))
      }
    }
    callback()
  } else {
    callback(new Error(i18next.t('uds.tester.ethAddr.validation.logicalAddressRequired')))
  }
}
const vaddrCheck = (rule: any, value: any, callback: any) => {
  if (data.value.virReqType == 'unicast' || data.value.virReqType == 'omit') {
    if (value) {
      //must be ip address
      const reg = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/
      if (!reg.test(value)) {
        callback(new Error(i18next.t('uds.tester.ethAddr.validation.invalidIpAddress')))
      }
      callback()
    } else {
      callback(new Error(i18next.t('uds.tester.ethAddr.validation.requestAddressRequired')))
    }
  } else {
    callback()
  }
}

const rules: FormRules<EthAddr> = {
  name: [
    {
      required: true,
      message: i18next.t('uds.tester.ethAddr.validation.inputAddrName'),
      trigger: 'blur',
      validator: nameCheck
    }
  ],
  'entity.logicalAddr': [
    {
      required: true,
      trigger: 'change',
      type: 'number',
      transform: (v) => Number(v),
      validator: addrCheck
    }
  ],
  'tester.testerLogicalAddr': [
    {
      required: true,
      trigger: 'change',
      type: 'number',
      transform: (v) => Number(v),
      validator: taddrCheck
    }
  ],
  'entity.eid': [
    {
      required: true,
      trigger: 'change',
      message: i18next.t('uds.tester.ethAddr.validation.eidFormat'),
      pattern: /^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/
    }
  ],
  'entity.gid': [
    {
      required: true,
      trigger: 'change',
      message: i18next.t('uds.tester.ethAddr.validation.gidFormat'),
      pattern: /^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/
    }
  ],
  'entity.vin': [
    {
      required: true,
      trigger: 'change',
      message: i18next.t('uds.tester.ethAddr.validation.vinLength'),
      min: 17,
      max: 17
    }
  ],
  virReqAddr: [
    {
      trigger: 'change',
      validator: vaddrCheck
    }
  ]
}

const props = defineProps<{
  index: number
  version?: number
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

.tls-hint {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
