<template>
  <el-form :model="data" label-width="120px" size="small" class="hardware" ref="ruleFormRef" :rules="rules"
    :disabled="globalStart" hide-required-asterisk>
    <el-divider content-position="left">
      Device
    </el-divider>
    <el-form-item label="Name" prop="name" required>
      <el-input v-model="data.name" />
    </el-form-item>
    <el-form-item label="Vendor">
      <el-tag>
        {{ props.vendor.toLocaleUpperCase() }}
      </el-tag>
    </el-form-item>
    <el-form-item label="Device" prop="device.handle" required>
      <el-select v-model="data.device.handle" :loading="deviceLoading" style="width: 300px">
        <el-option v-for="item in deviceList" :key="item.handle" :label="item.label" :value="item.handle" />
        <template #footer>
          <el-button text style="float: right; margin-bottom: 10px" size="small" @click="getDevice(true)"
            icon="RefreshRight">
            Refresh
          </el-button>
        </template>
      </el-select>
    </el-form-item>

    <el-divider content-position="left">
      Lin Parameters
    </el-divider>
    <el-form-item label-width="0">

      <el-col :span="12">
        <el-form-item label="Lin Mode" prop="mode" required>
          <el-select v-model="data.mode" @change="clearDatabase">
            <el-option label="Master" value="MASTER" />
            <el-option label="Slave" value="SLAVE" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Baud Rate" prop="baudRate">
          <el-select v-model="data.baudRate" required>
            <el-option label="9600" value="9600" />
            <el-option label="19200" value="19200" />
          </el-select>
        </el-form-item>
      </el-col>
    </el-form-item>

    <el-divider content-position="left">
      Database
    </el-divider>
    <el-form-item label="Database" prop="database">
      <el-select v-model="data.database" placeholder="No Database" clearable style="width: 300px" @change="clearDatabase">
        <el-option v-for="item in dbList" :key="item.value" :label="`LIN.${item.label}`" :value="item.value">
        </el-option>
      </el-select>
    </el-form-item>
  


    <el-divider />

    <el-divider />
    <el-form-item label-width="0">
      <div style="text-align: left; width: 100%">
        <el-button type="primary" @click="onSubmit" v-if="editIndex == ''" plain>
          Add Device
        </el-button>
        <el-button type="warning" @click="onSubmit" v-else plain>
          Save Device
        </el-button>
      </div>
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
  watch,
} from "vue";
import { v4 } from "uuid";
import { type FormRules, type FormInstance, ElMessageBox } from "element-plus";
import { InfoFilled } from "@element-plus/icons-vue";
import { assign, cloneDeep } from "lodash";
import { useDataStore } from "@r/stores/data";
import { VxeGridProps, VxeGrid } from "vxe-table";
import { CanVendor } from "nodeCan/can";
import { LinBaseInfo, LinDevice, LinMode } from "nodeCan/lin";

const ruleFormRef = ref<FormInstance>();
const devices = useDataStore()
const globalStart = toRef(window, 'globalStart')
const props = defineProps<{
  index: string;
  vendor: CanVendor;
}>();
const data = ref<LinBaseInfo>({
  device: {
    label: '',
    handle: '',
    id: '',
  },
  name: '',
  id: '',
  vendor: props.vendor,
  baudRate: 19200,
  mode: LinMode.MASTER,
});

const dbList = computed(() => {
  const list: { label: string; value: string }[] = [];
  for (const key of Object.keys(devices.database.lin)) {
    list.push({
      label: devices.database.lin[key].name,
      value: key
    });
  }
  return list;
});

const filteredNodesName = computed(() => {
  const list: { label: string; value: string }[] = [];
  if (data.value.database) {
    const db = devices.database.lin[data.value.database];
    if (data.value.mode === 'MASTER') {
      list.push({
        label: `${db.node.master.nodeName} (Master)`,
        value: db.node.master.nodeName
      });
    } else {
      // For SLAVE mode, only show slave nodes
      for (const n of db.node.salveNode) {
        list.push({
          label: `${n} (Slave)`,
          value: n
        });
      }
    }
  }
  return list;
});


function clearDatabase(){
  // data.value.workNode = '';
}

const deviceList = ref<LinDevice[]>([]);
const deviceLoading = ref(false);
function getDevice(visible: boolean) {
  if (visible) {
    deviceLoading.value = true;
    window.electron.ipcRenderer
      .invoke("ipc-get-lin-devices", props.vendor.toLocaleUpperCase())
      .then((res) => {
        deviceList.value = res;

      })
      .finally(() => {
        deviceLoading.value = false;
      });
  }
}

const nameCheck = (rule: any, value: any, callback: any) => {
  if (value) {
    for (const id of Object.keys(devices.devices)) {
      const hasName = devices.devices[id].ethDevice?.name;
      if (hasName == value && id != editIndex.value) {
        callback(new Error("The name already exists"));
      }
    }
    callback();
  } else {
    callback(new Error("Please input node name"));
  }
};


const rules = computed(() => {
  return {
    "name": [{ required: true, trigger: "blur", validator: nameCheck }],
    "device.handle": [
      {
        required: true,
        message: "Please select device",
        trigger: "change",
      },
    ],
    "database": [
      {

        message: "Please select database",
        trigger: "change",
      },
    ],
    "workNode": [
      {
        required: data.value.database ? true : false,
        message: "Please select node",
        trigger: "change",
      },
    ],
  }
});



const editIndex = ref(props.index);


const emits = defineEmits(['change'])
const onSubmit = () => {
  ruleFormRef.value?.validate((valid) => {
    if (valid) {
      data.value.vendor = props.vendor;
      if (editIndex.value == "") {
        const id = v4();
        data.value.id = id;
        devices.devices[id] = {
          type: 'lin',
          linDevice: cloneDeep(data.value),
        }
        emits('change', id, data.value.name)
      } else {
        data.value.id = editIndex.value;

        assign(devices.devices[editIndex.value].linDevice, data.value);
        emits('change', editIndex.value, data.value.name)
      }
      dataModify.value = false
    }
  });
};
const dataModify = defineModel({
  default: false,
})
let watcher: any;


onBeforeMount(() => {
  getDevice(true);
  if (editIndex.value) {
    const editData = devices.devices[editIndex.value]
    if (editData && editData.type == 'lin' && editData.linDevice) {
      data.value = cloneDeep(editData.linDevice);
    } else {
      data.value.name = `${props.vendor.toLocaleUpperCase()}_${Object.keys(devices.devices).length}`
      editIndex.value = ''
    }
  }

  watcher = watch(
    data,
    () => {
      dataModify.value = true;
    },
    { deep: true }
  );
});
onUnmounted(() => {
  watcher();
});
</script>
<style scoped>
.hardware {
  margin: 20px;
}

.vm {
  display: flex;
  align-items: center;
  /* 垂直居中对齐 */
}
</style>
