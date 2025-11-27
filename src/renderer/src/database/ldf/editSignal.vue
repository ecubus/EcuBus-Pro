<template>
  <div :style="{ height: fh, overflowY: 'auto', padding: '5px' }">
    <el-form
      ref="ruleFormRef"
      :model="signal"
      label-width="150px"
      size="small"
      :rules="props.rules"
    >
      <!-- <el-form-item label="Signal Name" prop="signalName" required>
                <el-input v-model="signal.signalName" @change="encodeChange"/>
            </el-form-item> -->
      <el-form-item label-width="0px">
        <el-col :span="12">
          <el-form-item label="Signal Size [bits]" prop="signalSizeBits" required>
            <el-input-number v-model="signal.signalSizeBits" :min="1" @change="signalBitChange" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Signal Type" prop="singleType" required>
            <el-select v-model="signal.singleType" style="width: 100%" @change="signalTypeChange">
              <el-option
                v-for="item in ['Scalar', 'ByteArray']"
                :key="item"
                :label="item"
                :value="item"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-form-item>

      <el-form-item
        v-if="signal.singleType == 'Scalar'"
        label="Init Value"
        prop="initValue"
        required
      >
        <el-input v-model.number="signal.initValue" style="width: 100px" />
      </el-form-item>
      <div v-else>
        <el-form-item label="Init Value" prop="initValue">
          <el-form-item
            v-for="i in Math.ceil(signal.signalSizeBits / 8)"
            :key="i"
            label-width="0px"
          >
            <el-input v-model.number="signal.initValue[i - 1]" style="width: 100px" />
          </el-form-item>
        </el-form-item>
      </div>
      <el-form-item v-if="signal.singleType == 'Scalar'" label="Encode Type" prop="encode">
        <el-select
          v-model="encode"
          style="width: 100%"
          clearable
          placeholder="None"
          @change="encodeChange"
        >
          <el-option v-for="item in singleEncodeTypes" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-divider content-position="left"> Publisher/Subscriber Choose </el-divider>
      <el-form-item label="Publisher" prop="punishedBy" required>
        <el-select v-model="signal.punishedBy" style="width: 100%">
          <el-option v-for="item in nodeList" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="Subscribe Node(s)" prop="subscribedBy" required>
        <el-select
          v-model.number="signal.subscribedBy"
          multiple
          style="width: 100%"
          collapse-tags
          collapse-tags-tooltip
        >
          <el-option v-for="item in nodeList" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { toRef, ref, computed, watch, onMounted, onBeforeUnmount, nextTick, inject, Ref } from 'vue'
import { LDF, SignalDef } from '../ldfParse'
import { ElMessageBox, ElNotification, ElOption, ElSelect, FormRules } from 'element-plus'

const h = inject('height') as Ref<number>
const fh = computed(() => Math.ceil((h.value * 2) / 3) + 'px')
const signal = defineModel<SignalDef>({
  required: true
})
const props = defineProps<{
  ldf: LDF
  editIndex: string
  rules: FormRules
}>()

const ldfObj = toRef(props, 'ldf')
const ruleFormRef = ref()
const encode = ref('')
// let backupEncode=''

onMounted(() => {
  //find encode in ldfObj.value.signalRep
  for (const [key, v] of Object.entries(ldfObj.value.signalRep)) {
    if (v.includes(signal.value.signalName)) {
      encode.value = key
      // backupEncode=key
      break
    }
  }
  ruleFormRef.value.validate()
})
const singleEncodeTypes = computed(() => {
  return Object.keys(ldfObj.value.signalRep)
})
function signalTypeChange() {
  if (signal.value.singleType == 'ByteArray') {
    signal.value.initValue = new Array(Math.ceil(signal.value.signalSizeBits / 8)).fill(0)
  } else {
    signal.value.initValue = 0
  }
}
function signalBitChange() {
  if (signal.value.singleType == 'ByteArray') {
    if (Array.isArray(signal.value.initValue)) {
      signal.value.initValue = signal.value.initValue.slice(
        0,
        Math.ceil(signal.value.signalSizeBits / 8)
      )
    }
  }
}
function encodeChange() {
  const val = encode.value

  //remove signal from old encode
  for (const [key, v] of Object.entries(ldfObj.value.signalRep)) {
    if (v.includes(signal.value.signalName)) {
      v.splice(v.indexOf(signal.value.signalName), 1)
    }
  }
  if (val) {
    //add signal to new encode
    ldfObj.value.signalRep[val].push(signal.value.signalName)
  }
}
function validate() {
  ruleFormRef.value.validate()
}

defineExpose({
  validate
})

const nodeList = computed(() => {
  const list: string[] = []
  list.push(ldfObj.value.node.master.nodeName)
  ldfObj.value.node.salveNode.forEach((item) => {
    list.push(item)
  })
  return list
})
</script>

<style></style>
