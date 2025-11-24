<template>
  <div class="plugin-marketplace">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>{{ $t('pluginMarketplace.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">⚠️</div>
      <p class="error-message">{{ error }}</p>
      <button class="retry-button" @click="fetchPlugins">
        {{ $t('pluginMarketplace.retry') }}
      </button>
    </div>

    <!-- Main Layout -->
    <el-row v-else :gutter="20" class="marketplace-content">
      <!-- Left: Plugin List -->
      <el-col :span="8">
        <el-card class="plugin-list-panel">
          <div class="marketplace-header">
            <div class="marketplace-header-text">
              <h3>{{ $t('pluginMarketplace.headerTitle') }}</h3>
              <p>{{ $t('pluginMarketplace.pluginCount', { count: validPlugins.length }) }}</p>
            </div>
            <el-dropdown trigger="click" @command="handleManualCommand">
              <el-button type="primary" size="small" plain>
                <el-icon><More /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="install">
                    <el-icon><Upload /></el-icon>
                    {{ $t('pluginMarketplace.installFromZip') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="load-path">
                    <el-icon><FolderOpened /></el-icon>
                    {{ $t('pluginMarketplace.loadFromPath') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="dev-plugin" divided>
                    <el-icon><DocumentAdd /></el-icon>
                    {{ $t('pluginMarketplace.devPlugin') }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <el-divider></el-divider>

          <el-scrollbar :height="props.height - 35 - 60 - 121 - 20">
            <div v-if="validPlugins.length === 0" class="empty-state">
              <div class="empty-icon">📦</div>
              <p>{{ $t('pluginMarketplace.noPlugins') }}</p>
            </div>

            <div
              v-for="plugin in validPlugins"
              :key="plugin.id"
              class="plugin-list-item"
              :class="{ selected: selectedPlugin?.id === plugin.id }"
              @click="handlePluginSelect(plugin)"
            >
              <div class="plugin-list-icon">
                <el-image
                  :src="getIconUrl(plugin)"
                  :alt="$t('pluginMarketplace.pluginIconAlt')"
                  class="plugin-list-icon-img"
                  fit="scale-down"
                />
              </div>
              <div class="plugin-list-info">
                <div class="plugin-list-name">
                  {{ plugin.name }}
                  <span
                    v-if="plugin.isTemporary"
                    class="temporary-badge"
                    :title="$t('pluginMarketplace.temporaryBadgeTitle')"
                  >
                    ⏳
                  </span>
                  <span
                    v-else-if="plugin.isLocalOnly"
                    class="local-only-badge"
                    :title="$t('pluginMarketplace.localOnlyBadgeTitle')"
                  >
                    📁
                  </span>
                  <span
                    v-else-if="getPluginStatus(plugin.id, plugin.version).canUpgrade"
                    class="upgrade-badge"
                  >
                    ⬆️
                  </span>
                  <span
                    v-else-if="getPluginStatus(plugin.id, plugin.version).installed"
                    class="installed-badge"
                  >
                    ✓
                  </span>
                </div>
                <div v-if="plugin.description" class="plugin-list-brief">
                  {{ plugin.description }}
                </div>
                <div class="plugin-list-meta">
                  <span v-if="plugin.author" class="plugin-list-author">
                    {{ plugin.author }}
                  </span>
                  <span
                    v-if="getPluginStatus(plugin.id, plugin.version).installed"
                    class="plugin-list-version"
                  >
                    v{{ getPluginStatus(plugin.id, plugin.version).installedVersion }}
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
                <el-image
                  :src="getIconUrl(selectedPlugin)"
                  :alt="$t('pluginMarketplace.pluginIconAlt')"
                  class="detail-icon-img"
                  fit="scale-down"
                />
              </div>
              <div class="detail-title-section">
                <h2>{{ selectedPlugin.name }}</h2>
                <p class="detail-description">{{ selectedPlugin.description }}</p>
                <p class="detail-id">{{ selectedPlugin.id }}</p>
              </div>
              <!-- Current Version in Top Right -->
              <div
                v-if="getPluginStatus(selectedPlugin.id, selectedPlugin.version).installed"
                class="current-version-badge"
              >
                v{{ getPluginStatus(selectedPlugin.id, selectedPlugin.version).installedVersion }}
              </div>
            </div>

            <!-- Action Buttons Row -->
            <div class="action-buttons-row">
              <!-- Only show Install button for remote plugins -->
              <el-button
                v-if="!selectedPlugin.isLocalOnly"
                type="primary"
                plain
                :disabled="isButtonDisabled(selectedPlugin)"
                @click="installPlugin(selectedPlugin)"
              >
                {{ getButtonText(selectedPlugin) }}
              </el-button>

              <template v-if="getPluginStatus(selectedPlugin.id, selectedPlugin.version).installed">
                <el-button
                  type="primary"
                  plain
                  :disabled="installingPlugins.has(selectedPlugin.id)"
                  @click="togglePluginStatus(selectedPlugin.id)"
                >
                  {{
                    pluginStore.pluginsDisabled[selectedPlugin.id]
                      ? $t('pluginMarketplace.action.enable')
                      : $t('pluginMarketplace.action.disable')
                  }}
                </el-button>

                <el-button
                  type="primary"
                  plain
                  :disabled="installingPlugins.has(selectedPlugin.id) || selectedPlugin.isTemporary"
                  :title="
                    selectedPlugin.isTemporary
                      ? $t('pluginMarketplace.tooltips.temporaryUninstallBlocked')
                      : ''
                  "
                  @click="uninstallPlugin(selectedPlugin)"
                >
                  {{ $t('pluginMarketplace.action.uninstall') }}
                </el-button>
              </template>
            </div>

            <!-- Upgrade Info for Installed Plugins -->
            <div
              v-if="getPluginStatus(selectedPlugin.id, selectedPlugin.version).canUpgrade"
              class="version-info"
            >
              <span class="upgrade-label">{{ $t('pluginMarketplace.upgradeLabel') }}</span>
              <span class="new-version"> v{{ selectedPlugin.version }} </span>
            </div>

            <!-- Plugin Metadata -->
            <div class="plugin-metadata">
              <div class="metadata-row">
                <span class="metadata-label">{{ $t('pluginMarketplace.metadata.version') }}</span>
                <span class="metadata-value">{{ selectedPlugin.version }}</span>
              </div>
              <div v-if="selectedPlugin.author" class="metadata-row">
                <span class="metadata-label">{{ $t('pluginMarketplace.metadata.author') }}</span>
                <span class="metadata-value">{{ selectedPlugin.author }}</span>
              </div>
              <div class="metadata-row">
                <span class="metadata-label">{{ $t('pluginMarketplace.metadata.published') }}</span>
                <span class="metadata-value">{{ formatDate(selectedPlugin.createdTime) }}</span>
              </div>
              <div v-if="selectedPlugin.manifestContent?.tabs?.length" class="metadata-row">
                <span class="metadata-label">{{ $t('pluginMarketplace.metadata.newTabs') }}</span>
                <span class="metadata-value">{{ selectedPlugin.manifestContent.tabs.length }}</span>
              </div>
              <div v-if="selectedPlugin.manifestContent?.extensions?.length" class="metadata-row">
                <span class="metadata-label">{{
                  $t('pluginMarketplace.metadata.extensions')
                }}</span>
                <span class="metadata-value">
                  {{ selectedPlugin.manifestContent.extensions.map((e) => e.targetTab).join(', ') }}
                </span>
              </div>
            </div>

            <!-- README -->
            <div id="pluginReadme" class="readme-section">
              <div class="readme" @click="handleReadmeClick($event)" v-html="renderedReadme"></div>
            </div>
          </div>

          <div v-else class="no-selection">
            <div class="no-selection-icon">🧩</div>
            <p>{{ $t('pluginMarketplace.noSelection') }}</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import {
  ElRow,
  ElCol,
  ElCard,
  ElButton,
  ElDivider,
  ElScrollbar,
  ElNotification,
  ElMessageBox,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElIcon,
  ElImage
} from 'element-plus'
import { More, Upload, FolderOpened, DocumentAdd } from '@element-plus/icons-vue'
import { Marked, MarkedExtension, Token, Tokens } from 'marked'
import '../home/readme.css'
import { usePluginStore } from '@r/stores/plugin'
import type { PluginManifest, RemotePluginInfo } from 'src/preload/plugin'
import { cloneDeep } from 'lodash'
import { i18next } from '@r/i18n'
interface PluginWithReadme extends RemotePluginInfo {
  readmeContent?: string
  manifestContent?: PluginManifest
  isLocalOnly?: boolean // Flag for locally installed plugins not in remote list
  isTemporary?: boolean // Flag for temporarily loaded plugins from custom path
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
const plugins = ref<PluginWithReadme[]>([])
const installingPlugins = ref<Set<string>>(new Set())
const selectedPlugin = ref<PluginWithReadme | null>(null)
const readmeHeight = computed(() => props.height - 35 - 40 - 121 - 200)
const pluginStore = usePluginStore()
const temporaryPlugins = ref<Set<string>>(new Set()) // Store IDs of temporary plugins
let marked: Marked
let pluginsDir = '' // Cache the plugins directory

// Initialize plugins directory
async function initPluginsDir() {
  try {
    pluginsDir = await window.electron.ipcRenderer.invoke('ipc-get-plugins-dir')
  } catch {
    pluginsDir = ''
  }
}

// Check if a plugin is temporarily loaded (not in standard plugins directory)
function isPluginTemporary(pluginPath: string): boolean {
  if (!pluginsDir) return true

  // Normalize paths for comparison
  const normalizedPluginPath = pluginPath.toLowerCase().replace(/\\/g, '/')
  const normalizedPluginsDir = pluginsDir.toLowerCase().replace(/\\/g, '/')

  return !normalizedPluginPath.startsWith(normalizedPluginsDir)
}

// Update temporary plugins set
function updateTemporaryPlugins() {
  const tempSet = new Set<string>()
  for (const [pluginId, plugin] of pluginStore.plugins.entries()) {
    if (isPluginTemporary(plugin.path)) {
      tempSet.add(pluginId)
    }
  }
  temporaryPlugins.value = tempSet
}

// Convert local icon path to local-resource URL
function getIconUrl(plugin: PluginWithReadme): string {
  if (!plugin.icon) return ''

  // Check if it's already a URL (http/https/data)
  const reIsAbsolute = /[\w+\-+]+:\/\//
  if (reIsAbsolute.test(plugin.icon)) {
    return plugin.icon
  }

  // For local plugins, get the full path
  const installedPlugin = pluginStore.getPlugin(plugin.id)
  if (installedPlugin && installedPlugin.path) {
    // Build full file path
    const fullPath = installedPlugin.path + '\\' + plugin.icon
    // Normalize to forward slashes
    const normalizedPath = fullPath.replace(/\\/g, '/')
    // Use triple slash after protocol
    return 'local-resource:///' + normalizedPath
  }

  return plugin.icon
}

// Merge remote plugins with locally installed plugins
const validPlugins = computed<PluginWithReadme[]>(() => {
  const remotePlugins = plugins.value
  const localPlugins = Array.from(pluginStore.plugins.values())

  // Create a map of remote plugins by ID for quick lookup
  const remotePluginMap = new Map<string, PluginWithReadme>()
  remotePlugins.forEach((plugin) => {
    remotePluginMap.set(plugin.id, plugin)
  })

  // Add local-only plugins (not in remote list)
  const allPlugins = [...remotePlugins]

  localPlugins.forEach((localPlugin) => {
    const pluginId = localPlugin.manifest.id
    const isTemporary = temporaryPlugins.value.has(pluginId)

    // If plugin is not in remote list, add it as a local-only plugin
    if (!remotePluginMap.has(pluginId)) {
      const localPluginInfo: PluginWithReadme = {
        id: pluginId,
        name: localPlugin.manifest.name,
        version: localPlugin.manifest.version,
        description: localPlugin.manifest.description || '',
        author: localPlugin.manifest.author || 'Unknown',
        icon:
          localPlugin.manifest.icon ||
          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-size="40"%3E?%3C/text%3E%3C/svg%3E',
        zipUrl: '',
        readme: '',
        createdTime: new Date().toISOString(),
        user: 'local',
        isLocalOnly: true, // Mark as local-only plugin
        isTemporary // Mark if temporarily loaded from custom path
      }
      allPlugins.push(localPluginInfo)
    } else if (isTemporary) {
      // If plugin exists in remote list but is temporarily loaded, mark it
      const remotePlugin = remotePluginMap.get(pluginId)!
      remotePlugin.isTemporary = true
    }
  })

  return allPlugins
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
function getButtonText(plugin: PluginWithReadme): string {
  const status = getPluginStatus(plugin.id, plugin.version)

  if (installingPlugins.value.has(plugin.id)) {
    return status.canUpgrade
      ? i18next.t('pluginMarketplace.button.upgrading')
      : i18next.t('pluginMarketplace.button.installing')
  }

  if (status.canUpgrade) {
    return i18next.t('pluginMarketplace.button.upgradeTo', { version: plugin.version })
  }

  if (status.installed) {
    return i18next.t('pluginMarketplace.button.installed')
  }

  return i18next.t('pluginMarketplace.button.install')
}

// Check if button should be disabled
function isButtonDisabled(plugin: PluginWithReadme): boolean {
  const status = getPluginStatus(plugin.id, plugin.version)
  return installingPlugins.value.has(plugin.id) || (status.installed && !status.canUpgrade)
}

// Get installed plugin manifest info
const installedPluginInfo = computed(() => {
  if (!selectedPlugin.value) return null
  const installedPlugin = pluginStore.getPlugin(selectedPlugin.value.id)
  return installedPlugin
})

// Render README markdown
const renderedReadme = computed(() => {
  if (!selectedPlugin.value) return ''

  const readme = selectedPlugin.value.readmeContent
  if (!readme) {
    return `<p class="no-readme">${i18next.t('pluginMarketplace.noReadme')}</p>`
  }

  return marked.parse(readme) as string
})

// Handle plugin selection and fetch README
async function handlePluginSelect(plugin: PluginWithReadme) {
  selectedPlugin.value = cloneDeep(plugin)

  // Fetch README content if not already loaded
  if (plugin.readme && !plugin.readmeContent) {
    try {
      const response = await window.electron.ipcRenderer.invoke('ipc-axios-get', plugin.readme)
      selectedPlugin.value.readmeContent = response
    } catch (e) {
      console.error('Failed to load README:', e)
    }
  }
  // For locally installed plugins (including loaded from custom path), try to read README from disk
  if (!plugin.readmeContent) {
    const installed = pluginStore.getPlugin(plugin.id)

    if (installed && installed.manifest?.readme) {
      try {
        // Set base path for resolving relative assets in README
        window.readmePath = installed.path
        // Build absolute path if manifest.readme is relative
        const readmePath = window.path.join(installed.path, installed.manifest.readme)

        const content = await window.electron.ipcRenderer.invoke('ipc-fs-readFile', readmePath)
        selectedPlugin.value.readmeContent = content
      } catch (e) {
        console.error('Failed to load local README:', e)
      }
    }
  }
  if (plugin.manifestUrl && !plugin.manifestContent) {
    try {
      const response = await window.electron.ipcRenderer.invoke('ipc-axios-get', plugin.manifestUrl)
      selectedPlugin.value.manifestContent = response
    } catch (e) {
      console.error('Failed to load manifest:', e)
    }
  }
}

async function fetchPlugins() {
  loading.value = true
  error.value = null

  try {
    // Use the new IPC handle to get remote plugins
    const remotePlugins = (await window.electron.ipcRenderer.invoke(
      'ipc-get-remote-plugins'
    )) as RemotePluginInfo[]

    plugins.value = remotePlugins
    // console.log(`Loaded ${plugins.value.length} plugins from marketplace`)
  } catch (e: any) {
    const message = i18next.t('pluginMarketplace.messages.loadFailed', {
      error: e?.message || i18next.t('common.unknownError')
    })
    error.value = message
    ElNotification.error({
      message,
      position: 'bottom-right'
    })
  } finally {
    loading.value = false
  }
}

async function installPlugin(plugin: PluginWithReadme) {
  const status = getPluginStatus(plugin.id, plugin.version)
  installingPlugins.value.add(plugin.id)

  try {
    if (!plugin.zipUrl) {
      throw new Error(i18next.t('pluginMarketplace.messages.zipUrlMissing'))
    }

    // If upgrading, disable the plugin first
    if (status.canUpgrade) {
      pluginStore.disablePlugin(plugin.id)
    }

    // Call backend to install/upgrade plugin
    const result = await window.electron.ipcRenderer.invoke(
      'ipc-install-remote-plugin',
      plugin.id,
      plugin.zipUrl,
      status.canUpgrade
    )

    if (!result.success) {
      throw new Error(result.message)
    }

    // Only load the newly installed/upgraded plugin from its directory
    if (result.pluginDir) {
      await pluginStore.loadPluginFromDirectory(result.pluginDir)
    }

    // Enable the plugin if it's a new installation
    if (!status.installed) {
      pluginStore.enablePlugin(plugin.id)
    } else if (status.canUpgrade) {
      // Re-enable after upgrade
      pluginStore.enablePlugin(plugin.id)
    }

    // Update temporary plugins list (this is an installed plugin, not temporary)
    updateTemporaryPlugins()

    const successMessage = status.canUpgrade
      ? i18next.t('pluginMarketplace.messages.upgradeSuccess', {
          name: plugin.name,
          version: plugin.version
        })
      : i18next.t('pluginMarketplace.messages.installSuccess', {
          name: plugin.name,
          version: plugin.version
        })

    ElNotification.success({
      message: successMessage,
      position: 'bottom-right'
    })
  } catch (error: any) {
    ElNotification.error({
      message: i18next.t('pluginMarketplace.messages.installError', {
        error: error?.message || i18next.t('common.unknownError')
      }),
      position: 'bottom-right'
    })
  } finally {
    installingPlugins.value.delete(plugin.id)
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

// Toggle plugin enable/disable status
async function togglePluginStatus(pluginId: string) {
  const isEnabled = !pluginStore.pluginsDisabled[pluginId]

  if (isEnabled) {
    await pluginStore.disablePlugin(pluginId)
    ElNotification.success({
      message: i18next.t('pluginMarketplace.messages.disableSuccess'),
      position: 'bottom-right'
    })
  } else {
    await pluginStore.enablePlugin(pluginId)
    ElNotification.success({
      message: i18next.t('pluginMarketplace.messages.enableSuccess'),
      position: 'bottom-right'
    })
  }
}

// Uninstall plugin
async function uninstallPlugin(plugin: PluginWithReadme) {
  try {
    await ElMessageBox.confirm(
      i18next.t('pluginMarketplace.dialog.uninstallMessage', { name: plugin.name }),
      i18next.t('pluginMarketplace.dialog.uninstallTitle'),
      {
        confirmButtonText: i18next.t('pluginMarketplace.dialog.uninstallConfirm'),
        cancelButtonText: i18next.t('pluginMarketplace.dialog.uninstallCancel'),
        type: 'warning'
      }
    )
  } catch {
    // User cancelled
    return
  }

  installingPlugins.value.add(plugin.id)

  try {
    await pluginStore.uninstallPlugin(plugin.id)

    ElNotification.success({
      message: i18next.t('pluginMarketplace.messages.uninstallSuccess', { name: plugin.name }),
      position: 'bottom-right'
    })

    // Clear selection if uninstalled plugin was selected
    if (selectedPlugin.value?.id === plugin.id) {
      selectedPlugin.value = null
    }
  } catch (error: any) {
    ElNotification.error({
      message: i18next.t('pluginMarketplace.messages.uninstallError', {
        error: error?.message || i18next.t('common.unknownError')
      }),
      position: 'bottom-right'
    })
  } finally {
    installingPlugins.value.delete(plugin.id)
  }
}

// Handle manual commands
async function handleManualCommand(command: string) {
  if (command === 'install') {
    // Manual install from ZIP file
    const result = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
      title: i18next.t('pluginMarketplace.dialog.selectZipTitle'),
      filters: [
        {
          name: i18next.t('pluginMarketplace.dialog.zipFilterName'),
          extensions: ['zip']
        }
      ],
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return
    }

    const filePath = result.filePaths[0]
    installingPlugins.value.add('manual-install')

    try {
      const installResult = await window.electron.ipcRenderer.invoke(
        'ipc-install-plugin-from-zip',
        filePath
      )

      if (!installResult.success) {
        throw new Error(installResult.message)
      }

      // Load the newly installed plugin
      if (installResult.pluginDir) {
        await pluginStore.loadPluginFromDirectory(installResult.pluginDir)
      }

      // Enable the plugin
      if (installResult.pluginId) {
        pluginStore.enablePlugin(installResult.pluginId)
      }

      ElNotification.success({
        message: i18next.t('pluginMarketplace.messages.installZipSuccess'),
        position: 'bottom-right'
      })

      // Update temporary plugins list (this is an installed plugin, not temporary)
      updateTemporaryPlugins()
    } catch (error: any) {
      ElNotification.error({
        message: i18next.t('pluginMarketplace.messages.installZipError', {
          error: error?.message || i18next.t('common.unknownError')
        }),
        position: 'bottom-right'
      })
    } finally {
      installingPlugins.value.delete('manual-install')
    }
  } else if (command === 'load-path') {
    // Manual load from path
    const result = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
      title: i18next.t('pluginMarketplace.dialog.selectDirTitle'),
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return
    }

    const dirPath = result.filePaths[0]

    try {
      const plugin = await pluginStore.loadPluginFromDirectory(dirPath)

      await pluginStore.enablePlugin(plugin.manifest.id)

      // Update temporary plugins list (this is a temporary plugin)
      updateTemporaryPlugins()

      ElNotification.success({
        message: i18next.t('pluginMarketplace.messages.loadDirSuccess'),
        position: 'bottom-right'
      })
    } catch (error: any) {
      ElNotification.error({
        message: i18next.t('pluginMarketplace.messages.loadDirError', {
          error: error?.message || i18next.t('common.unknownError')
        }),
        position: 'bottom-right'
      })
    }
  } else if (command === 'dev-plugin') {
    // Open plugin development documentation URL
    const devUrl = i18next.t('pluginMarketplace.devDocsUrl')
    window.electron.ipcRenderer.send('ipc-open-link', devUrl)
  }
}

function handleReadmeClick(e: MouseEvent) {
  if ((e.target as HTMLElement).tagName == 'A') {
    e.preventDefault()
    // Get href
    const href = (e.target as HTMLElement).getAttribute('href')
    window.electron.ipcRenderer.send('ipc-open-link', href)
  }
}

// Rewrite relative links/images in README to local-resource URLs based on the selected plugin path
function addLocalBaseUrl() {
  const reIsAbsolute = /[\w+\-+]+:\/\//
  return {
    walkTokens: (token: Token) => {
      // Handle Markdown links and images
      if (['link', 'image'].includes((token as any).type)) {
        const tempToken = token as Tokens.Image | Tokens.Link
        if (reIsAbsolute.test(tempToken.href)) {
          return
        }
        if (!window.readmePath) return
        const fullPath = window.readmePath + '\\' + tempToken.href
        const normalizedPath = fullPath.replace(/\\/g, '/')
        tempToken.href = 'local-resource:///' + normalizedPath
        return
      }
      // Handle raw HTML <img src="..."> inside markdown
      if ((token as any).type === 'html' && typeof (token as any).text === 'string') {
        if (!window.readmePath) return
        const html = (token as any).text as string
        const replaced = html.replace(
          /<img\s+([^>]*?)src=("|')([^"']+)(\2)([^>]*)>/gi,
          (_m, pre, q, src, _q2, post) => {
            if (
              reIsAbsolute.test(src) ||
              /^data:/i.test(src) ||
              src.startsWith('local-resource:///')
            ) {
              return `<img ${pre}src=${q}${src}${q}${post}>`
            }
            const fullPath = (window as any).readmePath + '\\' + src
            const normalizedPath = fullPath.replace(/\\/g, '/')
            const newSrc = 'local-resource:///' + normalizedPath
            return `<img ${pre}src=${q}${newSrc}${q}${post}>`
          }
        )
        ;(token as any).text = replaced
      }
    }
  } as MarkedExtension
}

onMounted(async () => {
  marked = new Marked()
  // Ensure relative links and images in README resolve correctly for local plugins
  marked.use(addLocalBaseUrl())
  await initPluginsDir()
  updateTemporaryPlugins()
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.marketplace-header-text {
  flex: 1;
  text-align: left;
}

.marketplace-header-text h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.marketplace-header-text p {
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

.local-only-badge {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  opacity: 0.8;
}

.temporary-badge {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  color: var(--el-color-warning);
}

.plugin-list-icon-img {
  width: 64px;
  height: 64px;
  overflow: hidden;
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
  position: relative;
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

.current-version-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
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

/* Action Buttons Row */
.action-buttons-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  justify-content: flex-start;
}

/* Version Info */
.version-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
  border-radius: 6px;
  margin-bottom: 20px;
  font-size: 14px;
  justify-content: center;
}

.upgrade-label {
  color: var(--el-color-warning-dark-2);
  font-weight: 500;
}

.new-version {
  color: var(--el-color-warning);
  font-weight: 700;
  font-family: monospace;
  font-size: 16px;
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
