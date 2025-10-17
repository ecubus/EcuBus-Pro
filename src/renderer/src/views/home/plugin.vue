<template>
  <div class="plugin-manager">
    <el-scrollbar :height="height">
      <div class="plugin-header">
        <div class="header-info">
          <h2>Plugin Manager</h2>
          <p>Manage your EcuBus Pro plugins</p>
        </div>
        <div class="header-actions">
          <el-button type="primary" :icon="Refresh" :loading="loading" @click="refreshPlugins">
            Refresh Plugins
          </el-button>
          <el-button :icon="FolderOpened" @click="openPluginDir"> Open Plugin Directory </el-button>
        </div>
      </div>

      <el-divider />

      <!-- 插件统计 -->
      <div class="plugin-stats">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon :icon="pluginIcon" class="stat-icon" />
            <div>
              <div class="stat-value">{{ pluginStats.total }}</div>
              <div class="stat-label">Total Plugins</div>
            </div>
          </div>
        </el-card>
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon :icon="checkIcon" class="stat-icon success" />
            <div>
              <div class="stat-value">{{ pluginStats.enabled }}</div>
              <div class="stat-label">Enabled</div>
            </div>
          </div>
        </el-card>
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon :icon="tabIcon" class="stat-icon info" />
            <div>
              <div class="stat-value">{{ pluginStats.newTabs }}</div>
              <div class="stat-label">New Tabs</div>
            </div>
          </div>
        </el-card>
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <Icon :icon="extensionIcon" class="stat-icon warning" />
            <div>
              <div class="stat-value">{{ pluginStats.extensions }}</div>
              <div class="stat-label">Extensions</div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 插件列表 -->
      <div class="plugin-list">
        <div v-if="plugins.length === 0" class="empty-state">
          <Icon :icon="emptyIcon" class="empty-icon" />
          <p>No plugins found</p>
          <p class="empty-hint">
            Place your plugins in the <code>{{ pluginDir }}</code> directory
          </p>
          <el-button type="primary" @click="openPluginDir">Open Plugin Directory</el-button>
        </div>

        <el-card
          v-for="plugin in plugins"
          :key="plugin.manifest.id"
          shadow="hover"
          class="plugin-card"
        >
          <div class="plugin-card-header">
            <div class="plugin-info">
              <Icon :icon="pluginIcon" class="plugin-icon" />
              <div>
                <h3>{{ plugin.manifest.name }}</h3>
                <p class="plugin-id">{{ plugin.manifest.id }} • v{{ plugin.manifest.version }}</p>
              </div>
            </div>
            <div class="plugin-actions">
              <el-switch
                :model-value="plugin.enabled"
                size="default"
                :active-text="plugin.enabled ? 'Enabled' : ''"
                :inactive-text="!plugin.enabled ? 'Disabled' : ''"
                @change="togglePlugin(plugin.manifest.id)"
              />
              <el-button
                type="danger"
                size="small"
                :icon="Delete"
                plain
                @click="uninstallPlugin(plugin.manifest.id, plugin.manifest.name)"
              >
                Uninstall
              </el-button>
            </div>
          </div>

          <div class="plugin-description">
            {{ plugin.manifest.description || 'No description provided' }}
          </div>

          <div v-if="plugin.manifest.author" class="plugin-meta">
            <Icon :icon="authorIcon" />
            <span>{{ plugin.manifest.author }}</span>
          </div>

          <el-divider />

          <!-- 插件功能 -->
          <div class="plugin-features">
            <div
              v-if="plugin.manifest.tabs && plugin.manifest.tabs.length > 0"
              class="feature-item"
            >
              <Icon :icon="tabIcon" class="feature-icon" />
              <span
                >Adds <strong>{{ plugin.manifest.tabs.length }}</strong> new
                {{ plugin.manifest.tabs.length === 1 ? 'tab' : 'tabs' }}</span
              >
              <el-popover placement="bottom" :width="300" trigger="hover">
                <template #reference>
                  <el-icon class="info-icon"><InfoFilled /></el-icon>
                </template>
                <div v-for="tab in plugin.manifest.tabs" :key="tab.name" class="tab-info">
                  <Icon v-if="tab.icon" :icon="tab.icon" style="margin-right: 5px" />
                  <strong>{{ tab.label }}</strong> ({{ tab.name }})
                </div>
              </el-popover>
            </div>

            <div
              v-if="plugin.manifest.extensions && plugin.manifest.extensions.length > 0"
              class="feature-item"
            >
              <Icon :icon="extensionIcon" class="feature-icon" />
              <span
                >Extends <strong>{{ plugin.manifest.extensions.length }}</strong>
                {{ plugin.manifest.extensions.length === 1 ? 'tab' : 'tabs' }}</span
              >
              <el-popover placement="bottom" :width="300" trigger="hover">
                <template #reference>
                  <el-icon class="info-icon"><InfoFilled /></el-icon>
                </template>
                <div v-for="(ext, idx) in plugin.manifest.extensions" :key="idx" class="ext-info">
                  <strong>{{ ext.targetTab }}</strong> ({{ ext.items.length }}
                  {{ ext.items.length === 1 ? 'item' : 'items' }})
                </div>
              </el-popover>
            </div>
          </div>
        </el-card>
      </div>
    </el-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox, ElSwitch } from 'element-plus'
import { Refresh, FolderOpened, InfoFilled, Delete } from '@element-plus/icons-vue'
import pluginIcon from '@iconify/icons-mdi/puzzle'
import checkIcon from '@iconify/icons-mdi/check-circle'
import tabIcon from '@iconify/icons-mdi/tab'
import extensionIcon from '@iconify/icons-mdi/puzzle-plus'
import emptyIcon from '@iconify/icons-mdi/package-variant'
import authorIcon from '@iconify/icons-mdi/account'
import { useRuntimeStore } from '@r/stores/runtime'

const props = defineProps<{
  height: number
}>()

const runtime = useRuntimeStore()
const loading = ref(false)
const pluginDir = ref('')

// 插件列表
const plugins = computed(() => {
  return runtime.allPlugins
})

// 已启用的插件列表
const enabledPlugins = computed(() => {
  return runtime.enabledPlugins
})

// 插件统计
const pluginStats = computed(() => {
  const allPlugins = runtime.allPlugins
  const enabledCount = runtime.enabledPluginCount
  const newTabs = runtime.newTabs
  const allExtensions = enabledPlugins.value.reduce((acc, p) => {
    return acc + (p.manifest.extensions?.length || 0)
  }, 0)

  return {
    total: allPlugins.length,
    enabled: enabledCount,
    newTabs: newTabs.length,
    extensions: allExtensions
  }
})

// 切换插件启用状态
function togglePlugin(pluginId: string) {
  try {
    const result = runtime.togglePlugin(pluginId)
    const plugin = runtime.getPlugin(pluginId)
    if (plugin) {
      ElMessage.success(`Plugin "${plugin.manifest.name}" ${result ? 'enabled' : 'disabled'}`)
    }
  } catch (error) {
    console.error('Failed to toggle plugin:', error)
    ElMessage.error('Failed to toggle plugin')
  }
}

// 卸载插件
async function uninstallPlugin(pluginId: string, pluginName: string) {
  try {
    const confirmed = await ElMessageBox.confirm(
      `Are you sure you want to uninstall "${pluginName}"? This will permanently delete the plugin from your system.`,
      'Confirm Uninstall',
      {
        confirmButtonText: 'Uninstall',
        cancelButtonText: 'Cancel',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    if (confirmed) {
      loading.value = true
      await runtime.uninstallPlugin(pluginId)
      ElMessage.success(`Plugin "${pluginName}" has been uninstalled successfully`)
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('Failed to uninstall plugin:', error)
      ElMessage.error(`Failed to uninstall plugin: ${error.message || error}`)
    }
  } finally {
    loading.value = false
  }
}

// 刷新插件
async function refreshPlugins() {
  loading.value = true
  try {
    // 使用 runtime store 的刷新方法
    await runtime.refreshPlugins()

    const pluginCount = plugins.value.length
    ElMessage.success(`Successfully reloaded ${pluginCount} plugin(s)`)
  } catch (error) {
    console.error('Failed to refresh plugins:', error)
    ElMessage.error('Failed to refresh plugins')
  } finally {
    loading.value = false
  }
}

// 打开插件目录
async function openPluginDir() {
  try {
    const dir = await window.electron.ipcRenderer.invoke('ipc-get-plugins-dir')
    if (dir) {
      // 使用 shell.openPath
      await window.electron.ipcRenderer.invoke('ipc-open-path', dir)
    }
  } catch (error) {
    console.error('Failed to open plugin directory:', error)
    ElMessage.error('Failed to open plugin directory')
  }
}

// 初始化
onMounted(async () => {
  const dir = await window.electron.ipcRenderer.invoke('ipc-get-plugins-dir')
  if (dir) {
    pluginDir.value = dir
  }
})
</script>

<style scoped>
.plugin-manager {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.plugin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-info h2 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
  font-size: 28px;
  font-weight: 600;
}

.header-info p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.plugin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 8px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  font-size: 48px;
  color: var(--el-color-primary);
}

.stat-icon.success {
  color: var(--el-color-success);
}

.stat-icon.info {
  color: var(--el-color-info);
}

.stat-icon.warning {
  color: var(--el-color-warning);
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: var(--el-text-color-primary);
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--el-text-color-secondary);
}

.empty-icon {
  font-size: 80px;
  color: var(--el-color-info-light-5);
  margin-bottom: 20px;
}

.empty-state p {
  margin: 8px 0;
  font-size: 16px;
}

.empty-hint {
  font-size: 14px !important;
  color: var(--el-text-color-placeholder);
}

.empty-hint code {
  background: var(--el-fill-color-light);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
}

.plugin-card {
  border-radius: 8px;
  transition: all 0.3s;
}

.plugin-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.plugin-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.plugin-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plugin-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.plugin-icon {
  font-size: 40px;
  color: var(--el-color-primary);
}

.plugin-info h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.plugin-id {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.plugin-description {
  color: var(--el-text-color-regular);
  line-height: 1.6;
  margin-bottom: 12px;
}

.plugin-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-bottom: 12px;
}

.plugin-features {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.feature-icon {
  font-size: 18px;
  color: var(--el-color-primary);
}

.info-icon {
  color: var(--el-color-info);
  cursor: help;
}

.tab-info,
.ext-info {
  padding: 4px 0;
  display: flex;
  align-items: center;
}

.tab-info:not(:last-child),
.ext-info:not(:last-child) {
  border-bottom: 1px solid var(--el-border-color-lighter);
}
</style>
