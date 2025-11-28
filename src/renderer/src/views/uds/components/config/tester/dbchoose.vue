<template>
  <div>
    <el-form ref="formRef" :model="form" label-width="auto" style="width: 380px" size="small">
      <el-form-item label="Database" prop="db" required>
        <el-select v-model="form.db" placeholder="please select database" @change="dbChange">
          <el-option v-for="d in dbList" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="Node" prop="node" required>
        <el-select v-model="form.node">
          <el-option v-for="d in nodeList" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <div style="text-align: right; width: 380px">
        <el-button type="primary" plain @click="loadAddr">Load</el-button>
      </div>
    </el-form>
  </div>
</template>
<script lang="ts" setup>
import { useDataStore } from '@r/stores/data'
import { ElMessageBox } from 'element-plus'
import { LIN_ADDR_TYPE, LIN_SCH_TYPE } from 'nodeCan/lin'
import { HardwareType, UdsAddress } from 'nodeCan/uds'
import { computed, ref } from 'vue'

const props = defineProps<{
  type: HardwareType
  testerId: string
}>()

const database = useDataStore()
const formRef = ref()
const dbList = computed(() => {
  const list: {
    label: string
    value: string
  }[] = []
  if (props.type == 'lin') {
    for (const key of Object.keys(database.database.lin)) {
      list.push({
        label: `${props.type.toLocaleUpperCase()}.${database.database.lin[key].name}`,
        value: key
      })
    }
  }
  return list
})

const nodeList = computed(() => {
  const list: {
    label: string
    value: string
  }[] = []
  if (props.type == 'lin' && form.value.db && database.database.lin[form.value.db]) {
    for (const name of database.database.lin[form.value.db].node.salveNode) {
      list.push({
        label: name,
        value: name
      })
    }
  }
  return list
})

function dbChange() {
  form.value.node = ''
}
const emits = defineEmits(['add'])
function loadAddr() {
  formRef.value.validate().then((valid) => {
    if (valid) {
      if (props.type == 'lin') {
        const db = database.database.lin[form.value.db]

        if (db) {
          const nodeAttr = db.nodeAttrs[form.value.node]
          const newAddr: UdsAddress = {
            type: props.type,

            linAddr: {
              name: `${form.value.node}_addr`,
              addrType: LIN_ADDR_TYPE.PHYSICAL,
              nad: nodeAttr.initial_NAD ? nodeAttr.initial_NAD : nodeAttr.configured_NAD,
              stMin: nodeAttr.ST_min || 20,
              nAs: nodeAttr.N_As_timeout || 1000,
              nCr: nodeAttr.N_Cr_timeout || 1000,
              schType: LIN_SCH_TYPE.DIAG_ONLY
            }
          }
          emits('add', newAddr)
        }
      }
      ElMessageBox.close()
    }
  })
}

const form = ref({
  db: '',
  node: ''
})
</script>
