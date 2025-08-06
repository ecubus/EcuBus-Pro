<template>
  <div class="ldf">
    <el-form ref="ruleFormRef" :model="ldfObj" label-width="200px" size="small" :rules="rules">
      <el-form-item label="Database Name" prop="name" required>
        <el-input v-model="ldfObj.name" style="width: 200px"> </el-input>
      </el-form-item>
      <el-divider />
      <el-form-item label="Master Node Name" prop="node.master.nodeName" required>
        <el-input v-model="ldfObj.node.master.nodeName" style="width: 200px" />
      </el-form-item>
      <el-divider />
      <el-form-item label-width="0">
        <el-col :span="12">
          <el-form-item label="LIN Version" prop="global.LIN_protocol_version">
            <el-select v-model="ldfObj.global.LIN_protocol_version" style="width: 200px">
              <el-option v-for="item in ['2.2', '2.1']" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="LIN Lang Version" prop="global.LIN_language_version">
            <el-select v-model="ldfObj.global.LIN_language_version" style="width: 200px">
              <el-option v-for="item in ['2.2', '2.1']" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-form-item>

      <el-form-item label="LIN Speed(kbps)" prop="global.LIN_speed">
        <el-select v-model="ldfObj.global.LIN_speed" style="width: 200px">
          <el-option v-for="item in [19.2, 9.6]" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-divider />
      <el-form-item label-width="0">
        <el-col :span="12">
          <el-form-item label="Timebase (ms)" prop="node.master.timeBase">
            <el-input-number
              v-model="ldfObj.node.master.timeBase"
              :min="1"
              controls-position="right"
              :step="1"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Jitter (ms)" prop="node.master.jitter">
            <el-input-number
              v-model="ldfObj.node.master.jitter"
              :min="0"
              controls-position="right"
              :step="0.1"
            />
          </el-form-item>
        </el-col>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  toRef,
  ref,
  h,
  watch,
  onMounted,
  onBeforeMount,
  inject
} from 'vue'

import { ElMessageBox, ElNotification, ElSelect, ElOption } from 'element-plus'
import { ArrowUpBold, ArrowDownBold, Plus, Edit, Delete } from '@element-plus/icons-vue'

import { LDF } from '../ldfParse'
import { useDataStore } from '@r/stores/data'
import { Layout } from '@r/views/uds/layout'
import { VxeGrid, VxeGridProps } from 'vxe-table'

// import { validateLDF } from './validator'

const ldfObj = defineModel<LDF>({
  required: true
})

const props = defineProps<{
  editIndex: string
}>()

const database = useDataStore()

async function validate() {
  return new Promise((resolve, reject) => {
    ruleFormRef.value.validate(async (valid, invalidFields) => {
      if (valid) {
        resolve(true)
      } else {
        /*error: {
                    field: string,
                    message: string
                }[] */

        const errors: {
          field: string
          message: string
        }[] = []
        for (const key of Object.keys(invalidFields)) {
          for (const field of invalidFields[key]) {
            errors.push({
              field: key,
              message: field.message
            })
          }
        }
        reject({
          tab: 'General',
          error: errors
        })
      }
    })
  })
}

defineExpose({
  validate
})
const rules = ref({
  name: [
    {
      validator: (rule, value, callback) => {
        if (value) {
          for (const key of Object.keys(database.database.lin)) {
            if (database.database.lin[key].name == value && key != props.editIndex) {
              callback(new Error('The database name already exists'))
              return
            }
          }

          callback()
        } else {
          callback(new Error('Please input the database name'))
        }
      },
      trigger: 'blur'
    }
  ],
  'node.master.nodeName': [
    {
      validator: (rule, value, callback) => {
        if (value) {
          //master node can't be the same as slave node
          for (const node of ldfObj.value.node.salveNode) {
            if (node == value) {
              callback(new Error("Master node can't be the same as slave node"))
              return
            }
          }
          callback()
        } else {
          callback(new Error('Please input the master node name'))
        }
      }
    }
  ]
})
const ruleFormRef = ref()
</script>

<style scoped>
.ldf {
  margin: 20px;
}
</style>

