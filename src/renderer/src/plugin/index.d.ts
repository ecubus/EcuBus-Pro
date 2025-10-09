/**
 * Type definitions for the single-spa plugin system
 */

import type { AppProps } from 'single-spa'

/**
 * Configuration for registering a micro-app
 */
export interface MicroAppConfig {
  /** Unique name for the micro-app */
  name: string
  /** Route pattern or function to determine when app is active */
  activeWhen: string | ((location: Location) => boolean)
  /** Custom properties to pass to the app */
  customProps?: Record<string, any>
  /** URL to the app's entry point (local-resource:/// or http://) */
  entryUrl: string
}

/**
 * Micro-app module interface
 */
export interface MicroApp {
  /** Called every time the app should be rendered */
  mount: (props: AppProps) => Promise<any>
  /** Called every time the app should be removed */
  unmount: (props: AppProps) => Promise<any>
  /** Called once when the app is first loaded (optional) */
  bootstrap?: (props: AppProps) => Promise<any>
  /** Called when custom props change (optional) */
  update?: (props: AppProps) => Promise<any>
}

/**
 * Plugin manager class
 */
export declare class PluginManager {
  /** Register a single micro-app */
  registerApp(config: MicroAppConfig): Promise<void>
  /** Unregister a micro-app */
  unregisterApp(name: string): Promise<void>
  /** Register multiple apps at once */
  registerApps(configs: MicroAppConfig[]): Promise<void>
  /** Get list of registered app names */
  getRegisteredApps(): string[]
  /** Get configuration for a specific app */
  getAppConfig(name: string): MicroAppConfig | undefined
  /** Start single-spa router */
  startSingleSpa(): void
  /** Load apps from a directory with manifest.json */
  loadAppsFromDirectory(path: string): Promise<void>
}

/** Singleton plugin manager instance */
export declare const pluginManager: PluginManager

/** Register a micro-app */
export declare function registerMicroApp(config: MicroAppConfig): Promise<void>

/** Unregister a micro-app */
export declare function unregisterMicroApp(name: string): Promise<void>

/** Start single-spa */
export declare function startMicroApps(): void

/** Get list of registered apps */
export declare function getRegisteredApps(): string[]

/** Load apps from a directory */
export declare function loadAppsFromDirectory(path: string): Promise<void>

export default pluginManager
