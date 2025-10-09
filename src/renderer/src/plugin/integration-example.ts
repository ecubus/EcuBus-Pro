/**
 * Integration Example: How to use the plugin system in your application
 *
 * Copy this code to your main renderer entry or a route component
 */

import {
  pluginManager,
  registerMicroApp,
  loadAppsFromDirectory,
  startMicroApps,
  type MicroAppConfig
} from '@r/plugin'

/**
 * Example 1: Load apps from a directory with manifest.json
 */
export async function loadFromDirectory() {
  try {
    // Path to your apps directory
    const appsPath = 'D:\\code\\ecubus-pro\\resources\\examples\\micro-apps'

    // Load all apps from the directory
    await loadAppsFromDirectory(appsPath)

    // Start single-spa
    startMicroApps()

    console.log('Apps loaded successfully!')
  } catch (error) {
    console.error('Failed to load apps:', error)
  }
}

/**
 * Example 2: Register apps manually
 */
export async function registerAppsManually() {
  try {
    // Register individual apps
    await registerMicroApp({
      name: 'hello-world',
      activeWhen: '/plugins/hello-world',
      entryUrl:
        'local-resource:///D:/code/ecubus-pro/resources/examples/micro-apps/hello-world/index.js',
      customProps: {
        title: 'Hello World App',
        theme: 'light'
      }
    })

    await registerMicroApp({
      name: 'dashboard',
      activeWhen: '/plugins/dashboard',
      entryUrl:
        'local-resource:///D:/code/ecubus-pro/resources/examples/micro-apps/dashboard/index.js',
      customProps: {
        refreshInterval: 5000
      }
    })

    // Start single-spa
    startMicroApps()

    console.log('Apps registered successfully!')
  } catch (error) {
    console.error('Failed to register apps:', error)
  }
}

/**
 * Example 3: Register with custom activeWhen function
 */
export async function registerWithCustomRouting() {
  await registerMicroApp({
    name: 'custom-app',
    activeWhen: (location) => {
      // Custom logic to determine when app should be active
      return location.pathname.startsWith('/custom') || location.pathname.startsWith('/special')
    },
    entryUrl: 'local-resource:///D:/apps/custom-app/index.js'
  })

  startMicroApps()
}

/**
 * Example 4: Batch register multiple apps
 */
export async function batchRegister() {
  const apps: MicroAppConfig[] = [
    {
      name: 'app1',
      activeWhen: '/app1',
      entryUrl: 'local-resource:///D:/apps/app1/index.js'
    },
    {
      name: 'app2',
      activeWhen: '/app2',
      entryUrl: 'local-resource:///D:/apps/app2/index.js'
    },
    {
      name: 'app3',
      activeWhen: '/app3',
      entryUrl: 'local-resource:///D:/apps/app3/index.js'
    }
  ]

  await pluginManager.registerApps(apps)
  startMicroApps()
}

/**
 * Example 5: Dynamic unregister
 */
export async function dynamicUnregister() {
  const { unregisterMicroApp } = await import('@r/plugin')

  // Unregister an app at runtime
  await unregisterMicroApp('app1')

  console.log('App unregistered')
}

/**
 * Example 6: Get registered apps info
 */
export function getAppsInfo() {
  const appNames = pluginManager.getRegisteredApps()
  console.log('Registered apps:', appNames)

  appNames.forEach((name) => {
    const config = pluginManager.getAppConfig(name)
    console.log(`App "${name}":`, config)
  })
}

/**
 * Example 7: Integration with Vue Router
 */
export async function integrateWithVueRouter(router: any) {
  // Register apps
  await registerMicroApp({
    name: 'plugin-page',
    activeWhen: '/plugins/*',
    entryUrl: 'local-resource:///D:/apps/plugin/index.js'
  })

  // Add a route in your Vue Router
  router.addRoute({
    path: '/plugins/:pathMatch(.*)*',
    name: 'plugins',
    component: () => import('@r/plugin/PluginManager.vue')
  })

  startMicroApps()
}

/**
 * Example 8: Use in Vue component setup
 */
export function useInVueComponent() {
  return `
<template>
  <div class="app-container">
    <div id="micro-app-container"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { 
  registerMicroApp, 
  unregisterMicroApp, 
  startMicroApps 
} from '@r/plugin'

onMounted(async () => {
  await registerMicroApp({
    name: 'my-plugin',
    activeWhen: '/plugin',
    entryUrl: 'local-resource:///D:/apps/my-plugin/index.js',
    customProps: {
      containerId: 'micro-app-container'
    }
  })
  
  startMicroApps()
})

onUnmounted(async () => {
  // Optional: Clean up when component is destroyed
  await unregisterMicroApp('my-plugin')
})
</script>
  `
}

/**
 * Example 9: With error handling
 */
export async function withErrorHandling() {
  try {
    await registerMicroApp({
      name: 'safe-app',
      activeWhen: '/safe-app',
      entryUrl: 'local-resource:///D:/apps/safe-app/index.js'
    })

    startMicroApps()
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to register app:', error.message)
      // Show user notification
      // ElMessage.error('Failed to load plugin')
    }
  }
}

/**
 * Example 10: Listen to single-spa events
 */
export function listenToEvents() {
  window.addEventListener('single-spa:before-app-change', (evt: any) => {
    console.log('Apps about to change:', {
      newApps: evt.detail.newAppStatuses,
      oldApps: evt.detail.oldAppStatuses
    })
  })

  window.addEventListener('single-spa:app-change', (evt: any) => {
    console.log('Apps changed:', evt.detail)
  })

  window.addEventListener('single-spa:routing-event', (evt: any) => {
    console.log('Routing event:', evt.detail)
  })
}

/**
 * Recommended: Initialize plugin system in main.ts
 */
export const initPluginSystem = async () => {
  try {
    // Load apps from examples directory
    const examplesPath = 'D:\\code\\ecubus-pro\\resources\\examples\\micro-apps'
    await loadAppsFromDirectory(examplesPath)

    // Start single-spa
    startMicroApps()

    // Listen to events (optional)
    listenToEvents()

    console.log('✅ Plugin system initialized')
  } catch (error) {
    console.error('❌ Failed to initialize plugin system:', error)
  }
}

// Usage in src/renderer/src/main.ts:
// import { initPluginSystem } from '@r/plugin/integration-example'
//
// app.mount('#app').then(() => {
//   initPluginSystem()
// })
