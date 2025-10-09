<template>
  <div class="plugin-manager">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>Micro-App Plugin Manager</span>
          <el-button type="primary" @click="loadApps">Load Apps</el-button>
        </div>
      </template>

      <el-form label-width="120px">
        <el-form-item label="Apps Directory">
          <el-input v-model="appsDirectory" placeholder="D:\apps\plugins" style="width: 400px">
            <template #append>
              <el-button @click="selectDirectory">Browse</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="Status">
          <el-tag :type="statusType">{{ statusText }}</el-tag>
        </el-form-item>
      </el-form>

      <el-divider />

      <h3>Registered Apps ({{ registeredApps.length }})</h3>
      <el-table :data="registeredApps" style="width: 100%">
        <el-table-column prop="name" label="Name" width="200" />
        <el-table-column prop="activeWhen" label="Active When" width="200" />
        <el-table-column prop="entryUrl" label="Entry URL" min-width="300" />
        <el-table-column label="Actions" width="150">
          <template #default="scope">
            <el-button type="danger" size="small" @click="unregisterApp(scope.row.name)">
              Unregister
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-divider />

      <el-collapse>
        <el-collapse-item title="Manual Registration" name="manual">
          <el-form :model="manualApp" label-width="120px">
            <el-form-item label="App Name">
              <el-input v-model="manualApp.name" placeholder="my-app" />
            </el-form-item>

            <el-form-item label="Active When">
              <el-input v-model="manualApp.activeWhen" placeholder="/my-app" />
            </el-form-item>

            <el-form-item label="Entry URL">
              <el-input
                v-model="manualApp.entryUrl"
                placeholder="local-resource:///D:/apps/my-app/index.js"
              />
            </el-form-item>

            <el-form-item label="Custom Props">
              <el-input
                v-model="manualApp.customProps"
                type="textarea"
                :rows="3"
                placeholder='{"key": "value"}'
              />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="registerManualApp"> Register App </el-button>
            </el-form-item>
          </el-form>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <!-- App Container -->
    <el-card v-if="showAppContainer" style="margin-top: 20px">
      <div id="micro-apps-container" style="min-height: 400px"></div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  ElCard,
  ElButton,
  ElForm,
  ElFormItem,
  ElInput,
  ElTag,
  ElDivider,
  ElTable,
  ElTableColumn,
  ElCollapse,
  ElCollapseItem,
  ElMessage
} from 'element-plus'
import {
  pluginManager,
  registerMicroApp,
  unregisterMicroApp,
  loadAppsFromDirectory,
  startMicroApps,
  getRegisteredApps,
  type MicroAppConfig
} from './index'

const appsDirectory = ref('D:\\code\\ecubus-pro\\resources\\examples\\micro-apps')
const loading = ref(false)
const started = ref(false)
const showAppContainer = ref(false)
const registeredApps = ref<MicroAppConfig[]>([])

const manualApp = ref({
  name: '',
  activeWhen: '',
  entryUrl: '',
  customProps: '{}'
})

const statusText = computed(() => {
  if (!started.value) return 'Not Started'
  if (loading.value) return 'Loading...'
  return `Running (${registeredApps.value.length} apps)`
})

const statusType = computed(() => {
  if (!started.value) return 'info'
  if (loading.value) return 'warning'
  return 'success'
})

const selectDirectory = async () => {
  try {
    // Use electron dialog to select directory
    const result = await window.electron.ipcRenderer.invoke('dialog:openDirectory')
    if (result && result.length > 0) {
      appsDirectory.value = result[0]
    }
  } catch (error) {
    console.error('Failed to select directory:', error)
  }
}

const loadApps = async () => {
  if (!appsDirectory.value) {
    ElMessage.warning('Please specify apps directory')
    return
  }

  loading.value = true

  try {
    await loadAppsFromDirectory(appsDirectory.value)

    if (!started.value) {
      startMicroApps()
      started.value = true
      showAppContainer.value = true
    }

    updateRegisteredApps()
    ElMessage.success('Apps loaded successfully!')
  } catch (error) {
    console.error('Failed to load apps:', error)
    ElMessage.error('Failed to load apps: ' + (error as Error).message)
  } finally {
    loading.value = false
  }
}

const registerManualApp = async () => {
  if (!manualApp.value.name || !manualApp.value.activeWhen || !manualApp.value.entryUrl) {
    ElMessage.warning('Please fill in all required fields')
    return
  }

  try {
    let customProps = {}
    if (manualApp.value.customProps) {
      customProps = JSON.parse(manualApp.value.customProps)
    }

    await registerMicroApp({
      name: manualApp.value.name,
      activeWhen: manualApp.value.activeWhen,
      entryUrl: manualApp.value.entryUrl,
      customProps
    })

    if (!started.value) {
      startMicroApps()
      started.value = true
      showAppContainer.value = true
    }

    updateRegisteredApps()
    ElMessage.success(`App "${manualApp.value.name}" registered successfully!`)

    // Reset form
    manualApp.value = {
      name: '',
      activeWhen: '',
      entryUrl: '',
      customProps: '{}'
    }
  } catch (error) {
    console.error('Failed to register app:', error)
    ElMessage.error('Failed to register app: ' + (error as Error).message)
  }
}

const unregisterApp = async (name: string) => {
  try {
    await unregisterMicroApp(name)
    updateRegisteredApps()
    ElMessage.success(`App "${name}" unregistered successfully!`)
  } catch (error) {
    console.error('Failed to unregister app:', error)
    ElMessage.error('Failed to unregister app: ' + (error as Error).message)
  }
}

const updateRegisteredApps = () => {
  const appNames = getRegisteredApps()
  registeredApps.value = appNames
    .map((name) => {
      const config = pluginManager.getAppConfig(name)
      return config || { name, activeWhen: '', entryUrl: '' }
    })
    .filter(Boolean) as MicroAppConfig[]
}

onMounted(() => {
  updateRegisteredApps()
})
</script>

<style scoped>
.plugin-manager {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

#micro-apps-container {
  width: 100%;
  height: 100%;
}
</style>
