<template>
  <div class="plugin-marketplace">
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

    <!-- Main Layout -->
    <el-row v-else :gutter="20" class="marketplace-content">
      <!-- Left: Plugin List -->
      <el-col :span="8">
        <el-card class="plugin-list-panel">
          <div class="marketplace-header">
            <h3>Plugin Marketplace</h3>
            <p>{{ validPlugins.length }} plugins available</p>
          </div>
          <el-divider></el-divider>

          <el-scrollbar :height="props.height - 35 - 60 - 121 - 20">
            <div v-if="validPlugins.length === 0" class="empty-state">
              <div class="empty-icon">📦</div>
              <p>No plugins available</p>
            </div>

            <div
              v-for="plugin in validPlugins"
              :key="plugin.resource.name"
              class="plugin-list-item"
              :class="{ selected: selectedPlugin?.resource.name === plugin.resource.name }"
              @click="handlePluginSelect(plugin)"
            >
              <div class="plugin-list-icon">
                <img :src="plugin.icon" alt="Plugin Icon" class="plugin-list-icon-img" />
              </div>
              <div class="plugin-list-info">
                <div class="plugin-list-name">
                  {{ plugin.manifest.name }}
                  <span
                    v-if="getPluginStatus(plugin.manifest.id, plugin.manifest.version).canUpgrade"
                    class="upgrade-badge"
                  >
                    ⬆️
                  </span>
                  <span
                    v-else-if="
                      getPluginStatus(plugin.manifest.id, plugin.manifest.version).installed
                    "
                    class="installed-badge"
                  >
                    ✓
                  </span>
                </div>
                <div v-if="plugin.manifest.description" class="plugin-list-brief">
                  {{ plugin.manifest.description }}
                </div>
                <div class="plugin-list-meta">
                  <span v-if="plugin.manifest.author" class="plugin-list-author">
                    {{ plugin.manifest.author }}
                  </span>
                  <span
                    v-if="getPluginStatus(plugin.manifest.id, plugin.manifest.version).installed"
                    class="plugin-list-version"
                  >
                    v{{
                      getPluginStatus(plugin.manifest.id, plugin.manifest.version).installedVersion
                    }}
                  </span>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </el-card>
      </el-col>

      <!-- Right: Plugin Details -->
      <el-col :span="16">
        <el-card class="plugin-detail-panel">
          <div v-if="selectedPlugin" class="plugin-details">
            <!-- Plugin Header -->
            <div class="detail-header">
              <div class="detail-icon">
                <img :src="selectedPlugin.icon" alt="Plugin Icon" class="detail-icon-img" />
              </div>
              <div class="detail-title-section">
                <h2>{{ selectedPlugin.manifest.name }}</h2>
                <p class="detail-description">{{ selectedPlugin.manifest.description }}</p>
                <p class="detail-id">{{ selectedPlugin.manifest.id }}</p>
              </div>
            </div>

            <!-- Install/Upgrade Button -->
            <el-button
              :type="
                getPluginStatus(selectedPlugin.manifest.id, selectedPlugin.manifest.version)
                  .canUpgrade
                  ? 'warning'
                  : 'primary'
              "
              :disabled="isButtonDisabled(selectedPlugin)"
              style="width: 100%; margin-bottom: 20px"
              @click="installPlugin(selectedPlugin)"
            >
              {{ getButtonText(selectedPlugin) }}
            </el-button>

            <!-- Version Info for Installed Plugins -->
            <div
              v-if="
                getPluginStatus(selectedPlugin.manifest.id, selectedPlugin.manifest.version)
                  .installed
              "
              class="version-info"
            >
              <span class="current-version">
                Current: v{{
                  getPluginStatus(selectedPlugin.manifest.id, selectedPlugin.manifest.version)
                    .installedVersion
                }}
              </span>
              <span
                v-if="
                  getPluginStatus(selectedPlugin.manifest.id, selectedPlugin.manifest.version)
                    .canUpgrade
                "
                class="arrow"
              >
                →
              </span>
              <span
                v-if="
                  getPluginStatus(selectedPlugin.manifest.id, selectedPlugin.manifest.version)
                    .canUpgrade
                "
                class="new-version"
              >
                New: v{{ selectedPlugin.manifest.version }}
              </span>
            </div>

            <!-- Plugin Metadata -->
            <div class="plugin-metadata">
              <div class="metadata-row">
                <span class="metadata-label">Version:</span>
                <span class="metadata-value">{{ selectedPlugin.manifest.version }}</span>
              </div>
              <div v-if="selectedPlugin.manifest.author" class="metadata-row">
                <span class="metadata-label">Author:</span>
                <span class="metadata-value">{{ selectedPlugin.manifest.author }}</span>
              </div>
              <div class="metadata-row">
                <span class="metadata-label">Published:</span>
                <span class="metadata-value">{{
                  formatDate(selectedPlugin.resource.createdTime)
                }}</span>
              </div>
              <div class="metadata-row">
                <span class="metadata-label">Size:</span>
                <span class="metadata-value">{{
                  formatFileSize(selectedPlugin.resource.fileSize)
                }}</span>
              </div>
              <div v-if="selectedPlugin.manifest.tabs?.length" class="metadata-row">
                <span class="metadata-label">Tabs:</span>
                <span class="metadata-value">{{ selectedPlugin.manifest.tabs.length }}</span>
              </div>
              <div v-if="selectedPlugin.manifest.extensions?.length" class="metadata-row">
                <span class="metadata-label">Extensions:</span>
                <span class="metadata-value">{{ selectedPlugin.manifest.extensions.length }}</span>
              </div>
            </div>

            <!-- README -->
            <div class="readme-section">
              <div class="readme" v-html="renderedReadme"></div>
            </div>
          </div>

          <div v-else class="no-selection">
            <div class="no-selection-icon">🧩</div>
            <p>Select a plugin to view details</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import { ElRow, ElCol, ElCard, ElButton, ElDivider, ElScrollbar, ElMessage } from 'element-plus'
import { Marked } from 'marked'
import '../home/readme.css'
import { usePluginStore } from '@r/stores/plugin'

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
  readme?: string
}

interface ValidPlugin {
  resource: ResourceData
  manifest: PluginManifest
  icon: string
}

const props = defineProps<{
  height: number
}>()

interface PluginStatus {
  installed: boolean
  canUpgrade: boolean
  installedVersion?: string
}

const loading = ref(false)
const error = ref<string | null>(null)
const plugins = ref<ResourceData[]>([])
const installingPlugins = ref<Set<string>>(new Set())
const selectedPlugin = ref<ValidPlugin | null>(null)
const readmeHeight = computed(() => props.height - 35 - 40 - 121 - 200)
const pluginStore = usePluginStore()
let marked: Marked

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
        valid.push({
          resource,
          manifest,
          icon: 'https://ecubus.oss-cn-chengdu.aliyuncs.com/img/logo256.png'
        })
      }
    } catch (e) {
      // Skip resources with invalid JSON in description
      continue
    }
  }

  return valid
})

// Check plugin installation status
function getPluginStatus(pluginId: string, marketplaceVersion: string): PluginStatus {
  const installedPlugin = pluginStore.getPlugin(pluginId)

  if (!installedPlugin) {
    return { installed: false, canUpgrade: false }
  }

  const installedVersion = installedPlugin.manifest.version
  const canUpgrade = compareVersions(marketplaceVersion, installedVersion) > 0

  return {
    installed: true,
    canUpgrade,
    installedVersion
  }
}

// Compare semantic versions (e.g., "1.2.3" vs "1.2.4")
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0

    if (part1 > part2) return 1
    if (part1 < part2) return -1
  }

  return 0
}

// Get button text based on plugin status
function getButtonText(plugin: ValidPlugin): string {
  const status = getPluginStatus(plugin.manifest.id, plugin.manifest.version)

  if (installingPlugins.value.has(plugin.manifest.id)) {
    return status.canUpgrade ? 'Upgrading...' : 'Installing...'
  }

  if (status.canUpgrade) {
    return `Upgrade to ${plugin.manifest.version}`
  }

  if (status.installed) {
    return 'Installed'
  }

  return 'Install'
}

// Check if button should be disabled
function isButtonDisabled(plugin: ValidPlugin): boolean {
  const status = getPluginStatus(plugin.manifest.id, plugin.manifest.version)
  return installingPlugins.value.has(plugin.manifest.id) || (status.installed && !status.canUpgrade)
}

// Render README markdown
const renderedReadme = computed(() => {
  if (!selectedPlugin.value) return ''

  const readme = selectedPlugin.value.manifest.readme
  if (!readme) {
    return '<p class="no-readme">No README available for this plugin.</p>'
  }

  return marked.parse(readme) as string
})

// Handle plugin selection
function handlePluginSelect(plugin: ValidPlugin) {
  selectedPlugin.value = plugin
}

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
            '{"id":"ecubus.frankie.log_data","name":"Log Data","version":"1.0.0","description":"Advanced log data analysis plugin","author":"Frankie","tabs":[],"extensions":[],"readme":"# Log Data Plugin\\n\\nThis is a plugin for EcuBus Pro that provides advanced log data analysis capabilities.\\n\\n## Features\\n\\n- 📊 Real-time log monitoring\\n- 🔍 Advanced search and filtering\\n- 📈 Data visualization\\n- 💾 Export to multiple formats\\n\\n## Installation\\n\\nClick the Install button above to add this plugin to your EcuBus Pro installation.\\n\\n## Usage\\n\\nAfter installation, you can access the plugin from the main menu.\\n\\n## Requirements\\n\\n- EcuBus Pro v1.0.0 or higher\\n\\n## Support\\n\\nFor issues and feature requests, please contact the author."}'
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

async function installPlugin(plugin: ValidPlugin) {
  const status = getPluginStatus(plugin.manifest.id, plugin.manifest.version)
  installingPlugins.value.add(plugin.manifest.id)

  try {
    // Download plugin zip file
    const response = await fetch(plugin.resource.url)
    if (!response.ok) {
      throw new Error(`Failed to download plugin: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Get plugins directory
    const pluginsDir = await window.electron.ipcRenderer.invoke('ipc-get-plugins-dir')
    if (!pluginsDir) {
      throw new Error('Failed to get plugins directory')
    }

    const pluginDir = `${pluginsDir}/${plugin.manifest.id}`

    // If upgrading, remove old version first
    if (status.canUpgrade) {
      const exists = await window.electron.ipcRenderer.invoke('ipc-fs-exist', pluginDir)
      if (exists) {
        // Disable and close plugin before removing
        pluginStore.disablePlugin(plugin.manifest.id)
        await window.electron.ipcRenderer.invoke('ipc-plugin-close', plugin.manifest.id)
        await window.electron.ipcRenderer.invoke('ipc-fs-rmdir', pluginDir)
      }
    }

    // Save zip file temporarily
    const tempZipPath = `${pluginsDir}/${plugin.manifest.id}.zip`
    await window.electron.ipcRenderer.invoke('ipc-fs-writeFile', tempZipPath, buffer)

    // TODO: Need to implement unzip functionality
    // For now, show a message that manual extraction is needed
    ElMessage.warning({
      message: `Plugin downloaded to ${tempZipPath}. Please manually extract it to ${pluginDir}`,
      duration: 5000
    })

    // Refresh plugins list
    await pluginStore.refreshPlugins()

    // Enable the plugin if it's a new installation
    if (!status.installed) {
      pluginStore.enablePlugin(plugin.manifest.id)
    }

    ElMessage.success({
      message: status.canUpgrade
        ? `Plugin ${plugin.manifest.name} upgraded successfully!`
        : `Plugin ${plugin.manifest.name} installed successfully!`
    })
  } catch (error: any) {
    ElMessage.error({
      message: `Failed to install plugin: ${error.message || 'Unknown error'}`
    })
    console.error('Plugin installation error:', error)
  } finally {
    installingPlugins.value.delete(plugin.manifest.id)
  }
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
  marked = new Marked()
  fetchPlugins()
})
</script>

<style scoped>
.plugin-marketplace {
  padding: 20px;
}

.marketplace-content {
  height: 100%;
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

/* Left Panel - Plugin List */

.marketplace-header {
  text-align: left;
}

.marketplace-header h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.marketplace-header p {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--el-text-color-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.plugin-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--el-bg-color);
}

.plugin-list-item:hover {
  background: var(--el-fill-color-light);
}

.plugin-list-item.selected {
  background: var(--el-color-primary-light-9);
  border-left: 3px solid var(--el-color-primary);
}

.plugin-list-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.plugin-list-info {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.plugin-list-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.upgrade-badge {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.installed-badge {
  display: inline-flex;
  align-items: center;
  color: var(--el-color-success);
  font-size: 14px;
}

.plugin-list-icon-img {
  width: 64px;
  height: 64px;
}

.plugin-list-brief {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plugin-list-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plugin-list-author {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.plugin-list-version {
  font-size: 11px;
  color: var(--el-color-primary);
  font-family: monospace;
  background: var(--el-color-primary-light-9);
  padding: 2px 6px;
  border-radius: 4px;
}

/* Right Panel - Plugin Details */
.plugin-detail-panel {
  height: 100%;
}

.plugin-details {
  height: 100%;
}

.no-selection {
  text-align: center;
  padding: 100px 20px;
  color: var(--el-text-color-secondary);
}

.no-selection-icon {
  font-size: 80px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.no-selection p {
  font-size: 16px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.detail-description {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
}

.detail-icon {
  font-size: 64px;
  flex-shrink: 0;
}

.detail-title-section {
  flex: 1;
  min-width: 0;
  text-align: left;
  margin-left: 10px;
}

.detail-icon-img {
  width: 80px;
  height: 80px;
  margin-left: 10px;
}

.detail-title-section h2 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.detail-id {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

.plugin-metadata {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.metadata-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.metadata-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.metadata-value {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.readme-section {
  margin-top: 16px;
  height: v-bind(readmeHeight + 'px');
  overflow-y: auto;
}

.no-readme {
  color: var(--el-text-color-secondary);
  font-style: italic;
  text-align: center;
  padding: 40px 0;
}

/* Version Info */
.version-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  margin-bottom: 20px;
  font-size: 14px;
  justify-content: center;
}

.current-version {
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

.arrow {
  color: var(--el-color-warning);
  font-weight: bold;
}

.new-version {
  color: var(--el-color-warning);
  font-weight: 600;
  font-family: monospace;
}
</style>

<style>
.readme {
  overflow-y: auto;
  width: 100%;
  text-align: left;
  color: var(--el-text-color-primary);
  line-height: 1.6;
}

.readme h1,
.readme h2,
.readme h3,
.readme h4,
.readme h5,
.readme h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.readme h1 {
  font-size: 2em;
  border-bottom: 1px solid var(--el-border-color);
  padding-bottom: 0.3em;
}

.readme h2 {
  font-size: 1.5em;
  border-bottom: 1px solid var(--el-border-color);
  padding-bottom: 0.3em;
}

.readme p {
  margin-bottom: 16px;
}

.readme ul,
.readme ol {
  padding-left: 2em;
  margin-bottom: 16px;
}

.readme li {
  margin-bottom: 4px;
}

.readme code {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
}

.readme pre {
  background: var(--el-fill-color-light);
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin-bottom: 16px;
}

.readme pre code {
  background: none;
  padding: 0;
}

.readme blockquote {
  border-left: 4px solid var(--el-color-primary);
  padding-left: 16px;
  margin: 16px 0;
  color: var(--el-text-color-secondary);
}

.readme a {
  color: var(--el-color-primary);
  text-decoration: none;
}

.readme a:hover {
  text-decoration: underline;
}

.readme img {
  max-width: 100%;
  height: auto;
  margin: 16px 0;
}

.readme table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 16px;
}

.readme th,
.readme td {
  border: 1px solid var(--el-border-color);
  padding: 8px 12px;
  text-align: left;
}

.readme th {
  background: var(--el-fill-color-light);
  font-weight: 600;
}
</style>
