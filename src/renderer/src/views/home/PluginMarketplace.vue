<template>
  <div class="plugin-marketplace">
    <div class="marketplace-header">
      <h2>Plugin Marketplace</h2>
      <p>Discover and install plugins for EcuBus Pro</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading plugins...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <p class="error-message">{{ error }}</p>
      <button class="retry-button" @click="fetchPlugins">Retry</button>
    </div>

    <!-- Plugins List -->
    <div v-else class="marketplace-plugins">
      <div v-if="validPlugins.length === 0" class="empty-state">
        <div class="empty-icon">📦</div>
        <p>No plugins available in the marketplace</p>
      </div>

      <div
        v-for="plugin in validPlugins"
        :key="plugin.resource.name"
        class="marketplace-plugin-card"
      >
        <div class="plugin-header">
          <div class="plugin-icon">🧩</div>
          <div class="plugin-info">
            <h3>{{ plugin.manifest.name }}</h3>
            <p class="plugin-id">{{ plugin.manifest.id }} • v{{ plugin.manifest.version }}</p>
          </div>
        </div>

        <div class="plugin-description">
          {{ plugin.manifest.description || 'No description provided' }}
        </div>

        <div class="plugin-meta">
          <div v-if="plugin.manifest.author" class="meta-item">
            <span class="meta-icon">👤</span>
            <span>{{ plugin.manifest.author }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-icon">📅</span>
            <span>{{ formatDate(plugin.resource.createdTime) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-icon">📦</span>
            <span>{{ formatFileSize(plugin.resource.fileSize) }}</span>
          </div>
        </div>

        <div class="plugin-features">
          <div v-if="plugin.manifest.tabs && plugin.manifest.tabs.length > 0" class="feature-badge">
            📑 {{ plugin.manifest.tabs.length }}
            {{ plugin.manifest.tabs.length === 1 ? 'tab' : 'tabs' }}
          </div>
          <div
            v-if="plugin.manifest.extensions && plugin.manifest.extensions.length > 0"
            class="feature-badge"
          >
            🔌 {{ plugin.manifest.extensions.length }}
            {{ plugin.manifest.extensions.length === 1 ? 'extension' : 'extensions' }}
          </div>
        </div>

        <div class="plugin-actions">
          <button
            class="install-button"
            :disabled="installingPlugins.has(plugin.manifest.id)"
            @click="installPlugin(plugin)"
          >
            {{ installingPlugins.has(plugin.manifest.id) ? 'Installing...' : 'Install' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'

interface ResourceData {
  owner: string
  name: string
  createdTime: string
  user: string
  provider: string
  application: string
  tag: string
  parent: string
  fileName: string
  fileType: string
  fileFormat: string
  fileSize: number
  url: string
  description: string
}

interface ApiResponse {
  status: string
  msg: string
  data: ResourceData[]
}

interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  tabs?: any[]
  extensions?: any[]
}

interface ValidPlugin {
  resource: ResourceData
  manifest: PluginManifest
}

const emit = defineEmits<{
  install: [plugin: { url: string; manifest: PluginManifest; fileName: string }]
}>()

const loading = ref(false)
const error = ref<string | null>(null)
const plugins = ref<ResourceData[]>([])
const installingPlugins = ref<Set<string>>(new Set())

// Filter and parse valid plugins
const validPlugins = computed<ValidPlugin[]>(() => {
  const valid: ValidPlugin[] = []

  for (const resource of plugins.value) {
    // Only process .zip files with description
    if (resource.fileFormat !== '.zip' || !resource.description) {
      continue
    }

    try {
      // Try to parse manifest from description
      const manifest = JSON.parse(resource.description) as PluginManifest

      // Validate manifest has required fields
      if (manifest.id && manifest.name && manifest.version) {
        valid.push({ resource, manifest })
      }
    } catch (e) {
      // Skip resources with invalid JSON in description
      continue
    }
  }

  return valid
})

async function fetchPlugins() {
  loading.value = true
  error.value = null

  try {
    // const response = await fetch('https://app.whyengineer.com/resources/api/get-resources')

    // if (!response.ok) {
    //   throw new Error(`Failed to fetch plugins: ${response.statusText}`)
    // }

    // const data: ApiResponse = await response.json()

    const data = {
      status: 'ok',
      msg: '',
      sub: '',
      name: '',
      data: [
        {
          owner: 'ecubus',
          name: '/resources/resource/ecubus/frankie/log_data_2025-10-18T00-56-10.zip',
          createdTime: '2025-10-22T14:32:56Z',
          user: 'frankie',
          provider: 'oss',
          application: 'app-built-in',
          tag: 'custom',
          parent: 'ResourceListPage',
          fileName: 'log_data_2025-10-18T00-56-10.zip',
          fileType: 'application',
          fileFormat: '.zip',
          fileSize: 198179,
          url: 'https://ecubus.oss-cn-chengdu.aliyuncs.com/resources/resource/ecubus/frankie/log_data_2025-10-18T00-56-10.zip',
          description:
            '{"id":"ecubus.frankie.log_data_2025-10-18T00-56-10","name":"Log Data","version":"1.0.0","description":"This is a plugin for EcuBus Pro","author":"Frankie","tabs":[],"extensions":[]}'
        }
      ],
      data2: null,
      data3: null
    }

    if (data.status !== 'ok') {
      throw new Error(data.msg || 'Failed to load plugins')
    }

    plugins.value = data.data || []
  } catch (e: any) {
    error.value = e.message || 'Failed to load plugins from marketplace'
    console.error('Error fetching plugins:', e)
  } finally {
    loading.value = false
  }
}

function installPlugin(plugin: ValidPlugin) {
  installingPlugins.value.add(plugin.manifest.id)

  emit('install', {
    url: plugin.resource.url,
    manifest: plugin.manifest,
    fileName: plugin.resource.fileName
  })

  // Remove from installing set after a delay (parent should handle actual installation)
  setTimeout(() => {
    installingPlugins.value.delete(plugin.manifest.id)
  }, 3000)
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString()
  } catch {
    return dateStr
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

onMounted(() => {
  fetchPlugins()
})
</script>

<style scoped>
.plugin-marketplace {
  padding: 20px;
  max-height: 80vh;
  overflow-y: auto;
}

.marketplace-header {
  margin-bottom: 24px;
}

.marketplace-header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.marketplace-header p {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

/* Loading State */
.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--el-border-color);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-state p {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

/* Error State */
.error-state {
  text-align: center;
  padding: 60px 20px;
}

.error-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.error-message {
  color: var(--el-color-error);
  font-size: 14px;
  margin-bottom: 16px;
}

.retry-button {
  padding: 8px 20px;
  background: var(--el-color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.retry-button:hover {
  background: var(--el-color-primary-light-3);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--el-text-color-secondary);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

/* Plugins List */
.marketplace-plugins {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.marketplace-plugin-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s;
}

.marketplace-plugin-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--el-color-primary-light-5);
}

.plugin-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.plugin-icon {
  font-size: 40px;
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
  font-size: 14px;
}

.plugin-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.meta-icon {
  font-size: 16px;
}

.plugin-features {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.feature-badge {
  padding: 4px 12px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.plugin-actions {
  display: flex;
  justify-content: flex-end;
}

.install-button {
  padding: 8px 24px;
  background: var(--el-color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.install-button:hover:not(:disabled) {
  background: var(--el-color-primary-light-3);
}

.install-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
