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
    <el-form-item label="Address name" required prop="name">
      <el-input v-model="data.name" />
    </el-form-item>
    <el-form-item label="Address Type" required prop="taType">
      <el-select v-model="data.taType">
        <el-option value="physical" label="Physical"></el-option>
        <el-option value="functional" label="Functional"></el-option>
      </el-select>
    </el-form-item>
    <el-divider content-position="left"> Tester </el-divider>
    <el-form-item label="tester address" required prop="tester.testerLogicalAddr">
      <el-input v-model.number="data.tester.testerLogicalAddr" placeholder="0" />
    </el-form-item>
    <el-form-item label-width="0">
      <el-row>
        <el-col :span="12">
          <el-form-item label="Connect delay" required prop="tester.createConnectDelay">
            <el-input v-model="data.tester.createConnectDelay" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Active delay" required prop="tester.routeActiveTime">
            <el-input v-model="data.tester.routeActiveTime" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form-item>
    <el-divider content-position="left"> ECU </el-divider>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="ECU address" required prop="entity.logicalAddr">
          <el-input v-model.number="data.entity.logicalAddr" placeholder="0" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="EID" required prop="entity.eid">
          <el-input v-model="data.entity.eid" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="Entity Type" required prop="entity.nodeType">
          <el-select v-model.number="data.entity.nodeType" placeholder="Node">
            <el-option value="node" label="Node"></el-option>
            <el-option value="gateway" label="Gateway"></el-option>
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          label="node address"
          :required="data.entity.nodeType == 'gateway'"
          prop="entity.nodeAddr"
        >
          <el-input
            v-model.number="data.entity.nodeAddr"
            placeholder="0"
            :disabled="data.entity.nodeType == 'node'"
          />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="VIN" required prop="entity.vin">
          <el-input v-model="data.entity.vin" :max="17" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="GID" required prop="entity.gid">
          <el-input v-model="data.entity.gid" :max="17" />
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-divider content-position="left"> Vehicle Identify Request Behavior </el-divider>
    <el-form-item label="VIN Request method" required prop="virReqType">
      <el-select v-model="data.virReqType">
        <el-option value="unicast" label="Unicast VIN Request"></el-option>
        <el-option value="omit" label="Omit VIN, tcp connect directly"></el-option>
        <el-option value="broadcast" label="Broadcast UDP4"></el-option>
        <el-option value="multicast" label="Multicast UDP6" disabled></el-option>
      </el-select>
    </el-form-item>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="Request Address" prop="virReqAddr">
          <el-input v-model="data.virReqAddr" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Entity Miss Behavior" prop="entityNotFoundBehavior">
          <el-select v-model="data.entityNotFoundBehavior">
            <!-- <el-option value="no" label="Report Error"></el-option> -->
            <el-option value="normal" label="Send Normal Request"></el-option>
            <el-option value="withVin" label="Send VIN Request"></el-option>
            <el-option value="withEid" label="Send EID Request"></el-option>
          </el-select>
        </el-form-item>
      </el-col>
    </el-form-item>
    <el-divider content-position="left">Tester Speical Control</el-divider>
    <el-form-item label-width="0">
      <el-col :span="12">
        <el-form-item label="UDP Client Port" prop="udpClientPort">
          <el-input-number
            v-model="data.udpClientPort"
            :min="0"
            :max="65535"
            controls-position="right"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="TCP Client Port" prop="tcpClientPort">
          <el-input-number
            v-model="data.tcpClientPort"
            :min="0"
            :max="65535"
            controls-position="right"
          />
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
import { EntityAddr, EthAddr } from 'nodeCan/doip'
import { useGlobalStart } from '@r/stores/runtime'

const ruleFormRef = ref<FormInstance>()
const globalStart = useGlobalStart()
const data = defineModel<EthAddr>({
  required: true
})

const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (let i = 0; i < addrs.value.length; i++) {
      const hasName = addrs.value[i].ethAddr?.name
      if (hasName == value && i != editIndex.value) {
        callback(new Error('The name already exists'))
      }
    }
    callback()
  } else {
    callback(new Error('Please input node name'))
  }
}

const addrCheck = (rule: any, value: any, callback: any) => {
  if (value.toString().length > 0) {
    for (let i = 0; i < addrs.value.length; i++) {
      if (data.value.entity.nodeType == 'gateway') {
        const hasName = `${addrs.value[i].ethAddr?.entity.logicalAddr}.${addrs.value[i].ethAddr?.entity.nodeAddr}`
        const selfValue = `${data.value.entity.logicalAddr}.${data.value.entity.nodeAddr}`
        if (hasName == selfValue && i != editIndex.value) {
          callback(new Error('The address already exists'))
        }
      } else {
        const hasName = addrs.value[i].ethAddr?.entity.logicalAddr
        if (hasName == value && i != editIndex.value) {
          callback(new Error('The address already exists'))
        }
      }
    }
    if (value < 0 || value > 0xffff) {
      callback(new Error('0 ~ 0xFFFF'))
    }
    if (value == data.value.tester.testerLogicalAddr) {
      callback(new Error("Tester address can't be the same as Tester address"))
    }
    callback()
  } else {
    callback(new Error('Logical address is required'))
  }
}
const taddrCheck = (rule: any, value: any, callback: any) => {
  if (value.toString().length > 0) {
    if (value < 0 || value > 0xffff) {
      callback(new Error('0 ~ 0xFFFF'))
    }
    if (value == data.value.entity.logicalAddr) {
      callback(new Error("Tester address can't be the same as ECU address"))
    }
    // Check that all tester logical addresses match
    for (let i = 0; i < addrs.value.length; i++) {
      if (
        i !== editIndex.value &&
        data.value.tester.testerLogicalAddr !== addrs.value[i].ethAddr?.tester.testerLogicalAddr
      ) {
        callback(new Error('All tester logical addresses must be the same'))
      }
    }
    callback()
  } else {
    callback(new Error('Logical address is required'))
  }
}
const vaddrCheck = (rule: any, value: any, callback: any) => {
  if (data.value.virReqType == 'unicast' || data.value.virReqType == 'omit') {
    if (value) {
      //must be ip address
      const reg = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/
      if (!reg.test(value)) {
        callback(new Error('Invalid IP address'))
      }
      callback()
    } else {
      callback(new Error('Request address is required'))
    }
  } else {
    callback()
  }
}

const rules: FormRules<EthAddr> = {
  name: [
    {
      required: true,
      message: 'Please input addr name',
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
      message: 'xx-xx-xx-xx-xx-xx',
      pattern: /^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/
    }
  ],
  'entity.gid': [
    {
      required: true,
      trigger: 'change',
      message: 'xx-xx-xx-xx-xx-xx',
      pattern: /^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/
    }
  ],
  'entity.vin': [
    {
      required: true,
      trigger: 'change',
      message: '17 characters',
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
