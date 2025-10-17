// stores/counter.js
import { defineStore } from 'pinia'
import { toRef } from 'vue'
import type {
  Plugin,
  PluginManifest,
  PluginTabConfig,
  PluginTabExtension
} from '@r/plugin/tabPluginTypes'

export type TestTree = {
  label: string
  canAdd: boolean
  id: string
  type: 'test' | 'config' | 'root'
  children: TestTree[]
  time?: string
  status?: 'pass' | 'fail' | 'skip' | 'running'
  disabled?: boolean
  testCnt?: number
  nesting?: number
  parent?: TestTree
}

export type PluginState = {
  plugins: Map<string, Plugin>
  loaded: boolean
  loading: boolean
  error: string | null
}

export type RunTimeStatus = {
  testStates: {
    tData: TestTree[]
    activeTest?: TestTree
    realActiveId?: string
    isRunning: Record<string, boolean>
  }
  globalStart: boolean
  canPeriods: Record<string, boolean>
  someipPeriods: Record<string, boolean>
  rearrangeWindows: boolean
  pluginState: PluginState
}

export const useRuntimeStore = defineStore('useRuntimeStore', {
  state: (): RunTimeStatus => ({
    testStates: {
      tData: [],
      isRunning: {}
    },
    canPeriods: {},
    someipPeriods: {},
    globalStart: false,
    rearrangeWindows: false,
    pluginState: {
      plugins: new Map(),
      loaded: false,
      loading: false,
      error: null
    }
  }),

  getters: {
    // 获取所有插件
    allPlugins: (state) => Array.from(state.pluginState.plugins.values()),

    // 获取已启用的插件
    enabledPlugins: (state) =>
      Array.from(state.pluginState.plugins.values()).filter((p) => p.enabled),

    // 获取插件数量
    pluginCount: (state) => state.pluginState.plugins.size,

    // 获取已启用插件数量
    enabledPluginCount: (state) =>
      Array.from(state.pluginState.plugins.values()).filter((p) => p.enabled).length,

    // 获取所有新增的 tabs（仅启用的插件）
    newTabs: (state) => {
      const tabs: PluginTabConfig[] = []
      for (const plugin of state.pluginState.plugins.values()) {
        if (plugin.enabled && plugin.manifest.tabs) {
          tabs.push(...plugin.manifest.tabs)
        }
      }
      return tabs
    },

    // 获取插件加载状态
    pluginsLoaded: (state) => state.pluginState.loaded,

    // 获取插件加载中状态
    pluginsLoading: (state) => state.pluginState.loading
  },

  actions: {
    setCanPeriod(key: string, value: boolean) {
      this.canPeriods[key] = value
    },
    removeCanPeriod(key: string) {
      delete this.canPeriods[key]
    },
    setSomeipPeriod(key: string, value: boolean) {
      this.someipPeriods[key] = value
    },
    removeSomeipPeriod(key: string) {
      delete this.someipPeriods[key]
    },

    // 插件相关的 actions

    /**
     * 注册插件
     */
    registerPlugin(plugin: Plugin) {
      const { id } = plugin.manifest

      this.pluginState.plugins.set(id, plugin)
    },

    /**
     * 卸载插件
     */
    unregisterPlugin(pluginId: string) {
      if (this.pluginState.plugins.delete(pluginId)) {
        return true
      }
      return false
    },

    /**
     * 获取特定插件
     */
    getPlugin(pluginId: string): Plugin | undefined {
      return this.pluginState.plugins.get(pluginId)
    },

    /**
     * 获取对特定 tab 的所有扩展（仅启用的插件）
     */
    getTabExtensions(tabName: string): PluginTabExtension[] {
      const extensions: PluginTabExtension[] = []

      for (const plugin of this.pluginState.plugins.values()) {
        if (plugin.enabled && plugin.manifest.extensions) {
          const tabExtensions = plugin.manifest.extensions.filter(
            (ext) => ext.targetTab === tabName
          )
          extensions.push(...tabExtensions)
        }
      }

      return extensions
    },

    /**
     * 启用插件
     */
    enablePlugin(pluginId: string) {
      const plugin = this.pluginState.plugins.get(pluginId)
      if (plugin) {
        plugin.enabled = true
        console.log(`Plugin ${pluginId} enabled`)
        return true
      }
      return false
    },

    /**
     * 禁用插件
     */
    disablePlugin(pluginId: string) {
      const plugin = this.pluginState.plugins.get(pluginId)
      if (plugin) {
        plugin.enabled = false
        console.log(`Plugin ${pluginId} disabled`)
        return true
      }
      return false
    },

    /**
     * 切换插件启用状态
     */
    togglePlugin(pluginId: string) {
      const plugin = this.pluginState.plugins.get(pluginId)
      if (plugin) {
        const newState = !plugin.enabled
        plugin.enabled = newState
        // 强制更新 Map 以触发响应式
        this.pluginState.plugins = new Map(this.pluginState.plugins)
        console.log(`Plugin ${pluginId} ${newState ? 'enabled' : 'disabled'}`)
        return newState
      }
      return false
    },

    /**
     * 调用插件处理器
     */
    async callPluginHandler(pluginId: string, handlerName: string, ...args: any[]) {
      const plugin = this.pluginState.plugins.get(pluginId)

      if (!plugin) {
        console.error(`Plugin ${pluginId} not found`)
        return
      }

      const handler = plugin.handlers[handlerName]

      if (!handler) {
        console.error(`Handler ${handlerName} not found in plugin ${pluginId}`)
        return
      }

      try {
        return await handler(...args)
      } catch (error) {
        console.error(`Error calling handler ${handlerName} in plugin ${pluginId}:`, error)
        throw error
      }
    },

    /**
     * 从目录加载插件
     */
    async loadPluginFromDirectory(pluginDir: string): Promise<Plugin | null> {
      try {
        const manifestPath = `${pluginDir}/manifest.json`

        // 加载清单
        const manifestContent = await window.electron.ipcRenderer.invoke(
          'ipc-fs-readFile',
          manifestPath
        )
        const manifest: PluginManifest = JSON.parse(manifestContent)

        // 尝试加载处理器
        let handlers = {}
        try {
          const handlersPath = `${pluginDir}/handlers.js`
          const handlersModule = await import(/* @vite-ignore */ handlersPath)
          handlers = handlersModule.default || handlersModule
        } catch (error) {
          console.warn(`No handlers found for plugin ${manifest.id}, using empty handlers`)
        }

        const plugin: Plugin = {
          manifest,
          handlers,
          enabled: true // 默认启用
        }

        this.registerPlugin(plugin)
        return plugin
      } catch (error) {
        const errorMsg = `Failed to load plugin from directory ${pluginDir}: ${error}`
        console.error(errorMsg)
        this.pluginState.error = errorMsg
        return null
      }
    },

    /**
     * 批量加载插件目录
     */
    async loadPluginsFromDirectories(pluginDirs: string[]) {
      this.pluginState.loading = true
      this.pluginState.loaded = false
      this.pluginState.error = null

      const loadPromises = pluginDirs.map((dir) =>
        this.loadPluginFromDirectory(dir).catch((error) => {
          console.error(`Failed to load plugin from ${dir}:`, error)
          return null
        })
      )

      await Promise.all(loadPromises)

      this.pluginState.loaded = true
      this.pluginState.loading = false
    },

    /**
     * 加载所有插件
     */
    async loadAllPlugins() {
      try {
        // 获取插件目录
        const pluginsDir = await window.electron.ipcRenderer.invoke('ipc-get-plugins-dir')

        if (!pluginsDir) {
          this.pluginState.loaded = true
          return
        }

        // 获取所有插件子目录
        const pluginDirs = await window.electron.ipcRenderer.invoke(
          'ipc-list-plugin-dirs',
          pluginsDir
        )

        if (!pluginDirs || pluginDirs.length === 0) {
          this.pluginState.loaded = true
          return
        }

        // 加载所有插件

        await this.loadPluginsFromDirectories(pluginDirs)
      } catch (error) {
        this.pluginState.error = String(error)
        this.pluginState.loaded = true
      }

      console.log('this.pluginState.loaded', this.pluginState.loaded)
    },

    /**
     * 刷新插件（清空并重新加载）
     */
    async refreshPlugins() {
      this.pluginState.plugins.clear()
      this.pluginState.loaded = false
      this.pluginState.error = null
      await this.loadAllPlugins()
    },

    /**
     * 清空所有插件
     */
    clearPlugins() {
      this.pluginState.plugins.clear()
      this.pluginState.loaded = false
      this.pluginState.error = null
    },

    /**
     * 卸载插件（从磁盘删除）
     */
    async uninstallPlugin(pluginId: string): Promise<boolean> {
      try {
        const plugin = this.pluginState.plugins.get(pluginId)
        if (!plugin) {
          throw new Error(`Plugin ${pluginId} not found`)
        }

        // 获取插件目录
        const pluginsDir = await window.electron.ipcRenderer.invoke('ipc-get-plugins-dir')
        if (!pluginsDir) {
          throw new Error('Failed to get plugins directory')
        }

        const pluginDir = `${pluginsDir}/${pluginId}`

        // 检查目录是否存在
        const exists = await window.electron.ipcRenderer.invoke('ipc-fs-exist', pluginDir)
        if (!exists) {
          throw new Error(`Plugin directory not found: ${pluginDir}`)
        }

        // 从内存中删除
        this.pluginState.plugins.delete(pluginId)
        this.pluginState.plugins = new Map(this.pluginState.plugins)

        // 删除插件目录
        await window.electron.ipcRenderer.invoke('ipc-fs-rmdir', pluginDir)

        console.log(`Plugin ${pluginId} uninstalled successfully`)
        return true
      } catch (error) {
        console.error(`Failed to uninstall plugin ${pluginId}:`, error)
        throw error
      }
    }
  }
})

export function useGlobalStart() {
  const runtime = useRuntimeStore()
  return toRef(runtime, 'globalStart')
}
