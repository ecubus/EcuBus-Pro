import type { AppProps } from 'single-spa'

/**
 * Micro-app lifecycle hooks
 */
export interface MicroAppLifecycles {
  /**
   * Bootstrap is called once when the app is first loaded
   */
  bootstrap?: (props: AppProps) => Promise<void>

  /**
   * Mount is called every time the app should be rendered
   */
  mount: (props: AppProps) => Promise<void>

  /**
   * Unmount is called every time the app should be removed
   */
  unmount: (props: AppProps) => Promise<void>

  /**
   * Update is called when custom props change (optional)
   */
  update?: (props: AppProps) => Promise<void>
}

/**
 * Micro-app configuration
 */
export interface MicroAppManifest {
  name: string
  version: string
  description?: string
  entry: string
  activeWhen: string | string[]
  customProps?: Record<string, any>
  dependencies?: {
    vue?: string
    'element-plus'?: string
    [key: string]: string | undefined
  }
}

/**
 * Apps directory manifest
 */
export interface AppsManifest {
  version: string
  apps: Array<{
    name: string
    activeWhen: string | ((location: Location) => boolean)
    entryUrl: string
    customProps?: Record<string, any>
  }>
}

/**
 * Plugin manager events
 */
export type PluginEvent =
  | 'app:registered'
  | 'app:unregistered'
  | 'app:loading'
  | 'app:loaded'
  | 'app:error'
  | 'app:mounted'
  | 'app:unmounted'

export interface PluginEventData {
  appName: string
  timestamp: number
  data?: any
  error?: Error
}
