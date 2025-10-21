// stores/plugin.ts
import { defineStore } from 'pinia'
import type {
  EcuBusPlugin,
  PluginManifest,
  PluginTabConfig,
  PluginTabExtension
} from '../../../preload/plugin'
import { cloneDeep } from 'lodash'

export type PluginState = {
  plugins: Map<string, EcuBusPlugin>
  pluginsEanbled: Record<string, boolean>
  loaded: boolean
  loading: boolean
  error: string | null
}

export const usePluginStore = defineStore('usePluginStore', {
  state: (): PluginState => ({
    pluginsEanbled: (window.store.get('pluginsEanbled') as Record<string, boolean>) || {},
    plugins: new Map(),
    loaded: false,
    loading: false,
    error: null
  }),

  actions: {
    /**
     * 注册插件
     */
    registerPlugin(plugin: EcuBusPlugin) {
      const { id } = plugin.manifest

      this.plugins.set(id, plugin)
    },

    /**
     * 卸载插件
     */
    unregisterPlugin(pluginId: string) {
      if (this.plugins.delete(pluginId)) {
        return true
      }
      return false
    },

    /**
     * 获取特定插件
     */
    getPlugin(pluginId: string): EcuBusPlugin | undefined {
      return this.plugins.get(pluginId)
    },

    getEnabledPlugins(): EcuBusPlugin[] {
      return Array.from(this.plugins.values()).filter(
        (plugin) => this.pluginsEanbled[plugin.manifest.id]
      )
    },

    getPluginStats() {
      const allPlugins = this.plugins
      const enabledCount = this.getEnabledPlugins().length

      const newTabs: PluginTabConfig[] = []
      for (const plugin of this.getEnabledPlugins()) {
        if (plugin.manifest.tabs?.length && plugin.manifest.tabs.length > 0) {
          newTabs.push(...plugin.manifest.tabs)
        }
      }
      const allExtensions: PluginTabExtension[] = []
      for (const plugin of this.getEnabledPlugins()) {
        if (plugin.manifest.extensions?.length && plugin.manifest.extensions.length > 0) {
          allExtensions.push(...plugin.manifest.extensions)
        }
      }

      return {
        total: allPlugins.size,
        enabled: enabledCount,
        newTabs: newTabs.length,
        extensions: allExtensions
      }
    },

    /**
     * 启用插件
     */
    enablePlugin(pluginId: string) {
      const plugin = this.plugins.get(pluginId)
      if (plugin) {
        this.pluginsEanbled[pluginId] = true
        window.store.set('pluginsEanbled', cloneDeep(this.pluginsEanbled))
      }
    },

    /**
     * 禁用插件
     */
    disablePlugin(pluginId: string) {
      const plugin = this.plugins.get(pluginId)
      if (plugin) {
        this.pluginsEanbled[pluginId] = false
        window.store.set('pluginsEanbled', cloneDeep(this.pluginsEanbled))

        return true
      }
      return false
    },

    /**
     * 从目录加载插件
     */
    async loadPluginFromDirectory(pluginDir: string): Promise<EcuBusPlugin | null> {
      try {
        const manifestPath = `${pluginDir}/manifest.json`

        // 加载清单
        const manifestContent = await window.electron.ipcRenderer.invoke(
          'ipc-fs-readFile',
          manifestPath
        )
        const manifest: PluginManifest = JSON.parse(manifestContent)
        const plugin: EcuBusPlugin = {
          manifest,
          path: pluginDir
        }

        if (manifest.mainEntry) {
          try {
            await window.electron.ipcRenderer.invoke(
              'ipc-plugin-create',
              manifest.id,
              pluginDir,
              manifest.mainEntry
            )
            plugin.mainStatus = 'running'
          } catch (error) {
            plugin.mainStatus = 'error'
          }
        }

        this.registerPlugin(plugin)
        return plugin
      } catch (error) {
        const errorMsg = `Failed to load plugin from directory ${pluginDir}: ${error}`
        console.error(errorMsg)
        this.error = errorMsg
        throw new Error(errorMsg)
      }
    },

    /**
     * 批量加载插件目录
     */
    async loadPluginsFromDirectories(pluginDirs: string[]) {
      this.loading = true
      this.loaded = false
      this.error = null

      const loadPromises = pluginDirs.map((dir) =>
        this.loadPluginFromDirectory(dir).catch((error) => {
          console.error(`Failed to load plugin from ${dir}:`, error)
          return null
        })
      )

      await Promise.all(loadPromises)

      this.loaded = true
      this.loading = false
    },

    /**
     * 加载所有插件
     */
    async loadAllPlugins() {
      try {
        // 获取插件目录
        const pluginsDir = await window.electron.ipcRenderer.invoke('ipc-get-plugins-dir')

        if (!pluginsDir) {
          this.loaded = true
          return
        }

        // 获取所有插件子目录
        const pluginDirs = await window.electron.ipcRenderer.invoke(
          'ipc-list-plugin-dirs',
          pluginsDir
        )

        if (!pluginDirs || pluginDirs.length === 0) {
          this.loaded = true
          return
        }

        // 加载所有插件

        await this.loadPluginsFromDirectories(pluginDirs)
      } catch (error) {
        this.error = String(error)
        this.loaded = true
      }
    },

    /**
     * 刷新插件（清空并重新加载）
     */
    async refreshPlugins() {
      this.plugins.clear()
      this.loaded = false
      this.error = null
      await this.loadAllPlugins()
    },

    /**
     * 清空所有插件
     */
    clearPlugins() {
      this.plugins.clear()
      this.loaded = false
      this.error = null
    },

    /**
     * 卸载插件（从磁盘删除）
     */
    async uninstallPlugin(pluginId: string): Promise<boolean> {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      await window.electron.ipcRenderer.invoke('ipc-plugin-close', pluginId)

      // 获取插件目录
      const pluginsDir = await window.electron.ipcRenderer.invoke('ipc-get-plugins-dir')
      if (!pluginsDir) {
        throw new Error('Failed to get plugins directory')
      }

      const pluginDir = `${pluginsDir}/${pluginId}`

      // 检查目录是否存在

      const exists = await window.electron.ipcRenderer.invoke('ipc-fs-exist', pluginDir)
      if (exists) {
        await window.electron.ipcRenderer.invoke('ipc-fs-rmdir', pluginDir)
      }

      // 从内存中删除
      this.plugins.delete(pluginId)
      this.plugins = new Map(this.plugins)

      return true
    },

    /**
     * 手动加载插件路径
     */
    async loadPluginFromCustomPath(): Promise<boolean> {
      try {
        // 打开文件夹选择对话框
        const selectedPath = await window.electron.ipcRenderer.invoke('ipc-show-open-dialog', {
          title: 'Select Plugin Folder',
          properties: ['openDirectory']
        })

        if (!selectedPath || selectedPath.canceled) {
          return false // 用户取消了选择
        }

        // 尝试加载插件
        const plugin = await this.loadPluginFromDirectory(selectedPath.filePaths[0])

        if (plugin) {
          // 检查插件是否已经存在
          if (!this.pluginsEanbled[plugin.manifest.id]) {
            // 默认启用新加载的插件
            this.enablePlugin(plugin.manifest.id)
          }
          return true
        }

        return false
      } catch (error) {
        this.error = String(error)
        throw error
      }
    }
  }
})
