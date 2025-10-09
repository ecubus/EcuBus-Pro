import { registerApplication, start } from 'single-spa'
import type { AppProps, LifeCycles } from 'single-spa'

export interface MicroAppConfig {
  name: string
  activeWhen: string | ((location: Location) => boolean)
  customProps?: Record<string, any>
  entryUrl: string // local-resource URL to the app entry
}

export interface MicroApp {
  mount: (props: AppProps) => Promise<any>
  unmount: (props: AppProps) => Promise<any>
  bootstrap?: (props: AppProps) => Promise<any>
  update?: (props: AppProps) => Promise<any>
}

class PluginManager {
  private apps: Map<string, MicroAppConfig> = new Map()
  private importMapInitialized = false

  constructor() {
    this.initImportMap()
  }

  /**
   * Initialize import-map for shared dependencies (Vue, Element Plus, etc.)
   */
  private initImportMap() {
    if (this.importMapInitialized) return

    const importMap = document.createElement('script')
    importMap.type = 'importmap'
    importMap.textContent = JSON.stringify({
      imports: {
        vue: 'https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.esm-browser.prod.js',
        'element-plus': 'https://cdn.jsdelivr.net/npm/element-plus@2.11.0/dist/index.full.min.mjs',
        'element-plus/': 'https://cdn.jsdelivr.net/npm/element-plus@2.11.0/dist/',
        '@element-plus/icons-vue':
          'https://cdn.jsdelivr.net/npm/@element-plus/icons-vue@2.3.1/dist/index.js',
        'vue-router':
          'https://cdn.jsdelivr.net/npm/vue-router@4.2.5/dist/vue-router.esm-browser.js',
        pinia: 'https://cdn.jsdelivr.net/npm/pinia@3.0.2/dist/pinia.esm-browser.js'
      }
    })

    document.head.appendChild(importMap)
    this.importMapInitialized = true

    // Add Element Plus CSS
    this.addElementPlusStyles()
  }

  /**
   * Add Element Plus CSS to the document
   */
  private addElementPlusStyles() {
    if (document.getElementById('element-plus-styles')) return

    const link = document.createElement('link')
    link.id = 'element-plus-styles'
    link.rel = 'stylesheet'
    link.href = 'https://cdn.jsdelivr.net/npm/element-plus@2.11.0/dist/index.css'
    document.head.appendChild(link)
  }

  /**
   * Load a micro-app from local-resource URL
   */
  private async loadApp(config: MicroAppConfig): Promise<LifeCycles> {
    try {
      // Use dynamic import to load the app module
      const module = await import(/* @vite-ignore */ config.entryUrl)

      // Validate the loaded module has required lifecycle methods
      if (!module.mount || !module.unmount) {
        throw new Error(`App "${config.name}" must export mount and unmount functions`)
      }

      // Return module as LifeCycles compatible object
      return {
        bootstrap: module.bootstrap || (() => Promise.resolve()),
        mount: module.mount,
        unmount: module.unmount,
        update: module.update
      } as LifeCycles
    } catch (error) {
      console.error(`Failed to load app "${config.name}":`, error)
      throw error
    }
  }

  /**
   * Register a micro-app
   */
  async registerApp(config: MicroAppConfig): Promise<void> {
    if (this.apps.has(config.name)) {
      console.warn(`App "${config.name}" is already registered`)
      return
    }

    this.apps.set(config.name, config)

    try {
      registerApplication({
        name: config.name,
        app: () => this.loadApp(config),
        activeWhen: config.activeWhen,
        customProps: {
          ...config.customProps,
          domElement: null // Will be set at mount time
        }
      })

      console.log(`App "${config.name}" registered successfully`)
    } catch (error) {
      console.error(`Failed to register app "${config.name}":`, error)
      this.apps.delete(config.name)
      throw error
    }
  }

  /**
   * Unregister a micro-app
   */
  async unregisterApp(name: string): Promise<void> {
    if (!this.apps.has(name)) {
      console.warn(`App "${name}" is not registered`)
      return
    }

    try {
      const { unregisterApplication } = await import('single-spa')
      await unregisterApplication(name)
      this.apps.delete(name)
      console.log(`App "${name}" unregistered successfully`)
    } catch (error) {
      console.error(`Failed to unregister app "${name}":`, error)
      throw error
    }
  }

  /**
   * Get all registered apps
   */
  getRegisteredApps(): string[] {
    return Array.from(this.apps.keys())
  }

  /**
   * Get app configuration
   */
  getAppConfig(name: string): MicroAppConfig | undefined {
    return this.apps.get(name)
  }

  /**
   * Start single-spa
   */
  startSingleSpa(): void {
    start({
      urlRerouteOnly: true
    })
    console.log('single-spa started')
  }

  /**
   * Register multiple apps at once
   */
  async registerApps(configs: MicroAppConfig[]): Promise<void> {
    const promises = configs.map((config) => this.registerApp(config))
    await Promise.all(promises)
  }

  /**
   * Load apps from a local directory
   * Expects a manifest.json file in the directory
   */
  async loadAppsFromDirectory(directoryPath: string): Promise<void> {
    try {
      // Normalize path for local-resource protocol
      const normalizedPath = directoryPath.replace(/\\/g, '/')
      const manifestUrl = `local-resource:///${normalizedPath}/manifest.json`

      // Load manifest
      const response = await fetch(manifestUrl)
      if (!response.ok) {
        throw new Error(`Failed to load manifest from ${manifestUrl}`)
      }

      const manifest = await response.json()
      const configs: MicroAppConfig[] = manifest.apps || []

      // Resolve relative entry URLs
      configs.forEach((config) => {
        if (!config.entryUrl.startsWith('http') && !config.entryUrl.startsWith('local-resource')) {
          config.entryUrl = `local-resource:///${normalizedPath}/${config.entryUrl}`
        }
      })

      await this.registerApps(configs)
    } catch (error) {
      console.error('Failed to load apps from directory:', error)
      throw error
    }
  }
}

// Export singleton instance
export const pluginManager = new PluginManager()

// Export utility functions
export const registerMicroApp = (config: MicroAppConfig) => pluginManager.registerApp(config)
export const unregisterMicroApp = (name: string) => pluginManager.unregisterApp(name)
export const startMicroApps = () => pluginManager.startSingleSpa()
export const getRegisteredApps = () => pluginManager.getRegisteredApps()
export const loadAppsFromDirectory = (path: string) => pluginManager.loadAppsFromDirectory(path)

export default pluginManager
