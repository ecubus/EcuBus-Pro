# Single-SPA Plugin System - Quick Usage Guide

## Installation

The plugin system is already integrated into EcuBus-Pro. Just import and use!

## Basic Usage

### Step 1: Import the Plugin System

```typescript
import { 
  loadAppsFromDirectory, 
  startMicroApps 
} from '@r/plugin'
```

### Step 2: Load Your Apps

**Option A: From a Directory** (Recommended)
```typescript
// Load all apps from a directory with manifest.json
await loadAppsFromDirectory('D:\\my-apps\\plugins')
startMicroApps()
```

**Option B: Register Manually**
```typescript
import { registerMicroApp, startMicroApps } from '@r/plugin'

await registerMicroApp({
  name: 'my-app',
  activeWhen: '/my-app',
  entryUrl: 'local-resource:///D:/apps/my-app/index.js',
  customProps: {
    apiUrl: 'https://api.example.com'
  }
})

startMicroApps()
```

### Step 3: Navigate to Your App

Once loaded, navigate to the route specified in `activeWhen`:
- Browser: `http://localhost:5173/my-app`

## Integration in Your App

### In main.ts (Recommended)

```typescript
// src/renderer/src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { loadAppsFromDirectory, startMicroApps } from '@r/plugin'

const app = createApp(App)
app.mount('#app')

// Initialize plugin system after app mounts
loadAppsFromDirectory('D:\\code\\ecubus-pro\\resources\\examples\\micro-apps')
  .then(() => {
    startMicroApps()
    console.log('Plugin system ready!')
  })
  .catch(err => {
    console.error('Failed to load plugins:', err)
  })
```

### In a Vue Component

```vue
<template>
  <div class="plugin-container">
    <el-button @click="loadPlugins">Load Plugins</el-button>
    <div id="plugin-view"></div>
  </div>
</template>

<script setup lang="ts">
import { loadAppsFromDirectory, startMicroApps } from '@r/plugin'
import { ElMessage } from 'element-plus'

const loadPlugins = async () => {
  try {
    await loadAppsFromDirectory('D:\\my-apps')
    startMicroApps()
    ElMessage.success('Plugins loaded!')
  } catch (error) {
    ElMessage.error('Failed to load plugins')
  }
}
</script>
```

### In Vue Router

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import PluginView from '@r/plugin/PluginManager.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Your existing routes...
    {
      path: '/plugins/:pathMatch(.*)*',
      name: 'plugins',
      component: PluginView
    }
  ]
})

export default router
```

## Creating a Micro-App

### Minimal App Structure

**Directory:**
```
my-app/
├── index.js
└── (optional) style.css
```

**index.js:**
```javascript
import { createApp, h, ref } from 'vue'
import { ElButton, ElCard } from 'element-plus'

let app = null

export async function mount(props) {
  const MyApp = {
    setup() {
      const count = ref(0)
      
      return () => h(ElCard, null, {
        default: () => [
          h('h2', `Count: ${count.value}`),
          h(ElButton, { 
            onClick: () => count.value++ 
          }, () => 'Increment')
        ]
      })
    }
  }
  
  app = createApp(MyApp)
  app.mount(props.domElement || document.getElementById('app'))
}

export async function unmount(props) {
  if (app) {
    app.unmount()
    app = null
  }
}
```

### With manifest.json

**manifest.json:**
```json
{
  "version": "1.0.0",
  "apps": [
    {
      "name": "my-app",
      "activeWhen": "/my-app",
      "entryUrl": "my-app/index.js"
    }
  ]
}
```

## Available APIs

### Plugin Manager

```typescript
import { pluginManager } from '@r/plugin'

// Register an app
await pluginManager.registerApp(config)

// Unregister an app
await pluginManager.unregisterApp('app-name')

// Get all registered apps
const apps = pluginManager.getRegisteredApps()

// Get app config
const config = pluginManager.getAppConfig('app-name')

// Start single-spa
pluginManager.startSingleSpa()
```

### Utility Functions

```typescript
import { 
  registerMicroApp,
  unregisterMicroApp,
  startMicroApps,
  getRegisteredApps,
  loadAppsFromDirectory
} from '@r/plugin'
```

## Examples

### Example 1: Load Built-in Examples

```typescript
import { loadAppsFromDirectory, startMicroApps } from '@r/plugin'

const examplesPath = 'D:\\code\\ecubus-pro\\resources\\examples\\micro-apps'
await loadAppsFromDirectory(examplesPath)
startMicroApps()

// Navigate to:
// - /plugins/hello-world
// - /plugins/dashboard
```

### Example 2: Dynamic Loading with UI

```typescript
import { ElButton, ElMessage } from 'element-plus'
import { loadAppsFromDirectory, startMicroApps } from '@r/plugin'

const loadFromUserSelection = async (path: string) => {
  try {
    await loadAppsFromDirectory(path)
    startMicroApps()
    ElMessage.success('Apps loaded successfully!')
  } catch (error) {
    ElMessage.error('Failed to load apps')
  }
}
```

### Example 3: Custom Route Matching

```typescript
import { registerMicroApp, startMicroApps } from '@r/plugin'

await registerMicroApp({
  name: 'admin-panel',
  activeWhen: (location) => {
    // Only activate for admin routes
    return location.pathname.startsWith('/admin')
  },
  entryUrl: 'local-resource:///D:/apps/admin/index.js',
  customProps: {
    userRole: 'admin'
  }
})

startMicroApps()
```

### Example 4: Multiple Apps at Once

```typescript
import { pluginManager, startMicroApps } from '@r/plugin'

const apps = [
  {
    name: 'app1',
    activeWhen: '/app1',
    entryUrl: 'local-resource:///D:/apps/app1/index.js'
  },
  {
    name: 'app2',
    activeWhen: '/app2',
    entryUrl: 'local-resource:///D:/apps/app2/index.js'
  }
]

await pluginManager.registerApps(apps)
startMicroApps()
```

## Shared Dependencies (Import Maps)

Your micro-apps can import these without bundling:

```javascript
// Vue 3
import { createApp, ref, reactive, computed, watch } from 'vue'

// Element Plus
import { 
  ElButton, ElCard, ElTable, ElDialog,
  ElMessage, ElMessageBox 
} from 'element-plus'

// Element Plus Icons
import { Edit, Delete, Plus, Search } from '@element-plus/icons-vue'

// Vue Router
import { createRouter, createWebHistory } from 'vue-router'

// Pinia
import { createPinia, defineStore } from 'pinia'
```

## CDN URLs (Automatic)

The system automatically loads:
- Vue 3.5.13 ESM
- Element Plus 2.11.0 ESM + CSS
- Element Plus Icons 2.3.1
- Vue Router 4.2.5 (available)
- Pinia 3.0.2 (available)

## File Paths

### Windows Paths
Convert Windows paths to local-resource URLs:
```typescript
// Windows path
'D:\\apps\\my-app\\index.js'

// Converted to local-resource URL
'local-resource:///D:/apps/my-app/index.js'
```

The plugin system handles this automatically when loading from directories.

## Debugging

### Enable Logging
All lifecycle events are logged:
```javascript
// Check console for:
[App Name] Bootstrap
[App Name] Mount
[App Name] Unmount
```

### Check Registered Apps
```typescript
import { getRegisteredApps, pluginManager } from '@r/plugin'

console.log('Registered:', getRegisteredApps())

getRegisteredApps().forEach(name => {
  console.log(name, pluginManager.getAppConfig(name))
})
```

### Listen to single-spa Events
```javascript
window.addEventListener('single-spa:before-app-change', evt => {
  console.log('Apps changing:', evt.detail)
})

window.addEventListener('single-spa:app-change', evt => {
  console.log('Apps changed:', evt.detail)
})
```

## Common Issues

### ❌ App not loading
**Solution:** Check entry URL, file existence, and browser console

### ❌ Dependencies not found
**Solution:** Use exact package names: `import { createApp } from 'vue'`

### ❌ App not visible
**Solution:** Check `activeWhen` route, ensure `startMicroApps()` was called

### ❌ Multiple apps conflict
**Solution:** Use unique IDs, namespace your CSS

## Next Steps

1. ✅ Load the example apps to see it in action
2. ✅ Create your first simple app
3. ✅ Read the full documentation in `README.md`
4. ✅ Check integration examples in `integration-example.ts`

## Full Documentation

- **Main Docs:** `src/renderer/src/plugin/README.md`
- **Getting Started:** `resources/examples/micro-apps/GETTING_STARTED.md`
- **Examples:** `resources/examples/micro-apps/`
- **Integration:** `src/renderer/src/plugin/integration-example.ts`
- **UI Component:** `src/renderer/src/plugin/PluginManager.vue`

## Support

For questions, check the documentation or create an issue in the project repository.

---

**Happy Plugin Development! 🚀**

