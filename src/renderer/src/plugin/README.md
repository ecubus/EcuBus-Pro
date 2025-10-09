# Single-SPA Micro-App Plugin System

This plugin system enables dynamic loading and registration of micro-applications using single-spa, with support for loading apps from local resources and shared dependencies via import-maps.

## Features

- 🔌 Dynamic application registration and unregistration
- 📦 Shared dependencies (Vue, Element Plus) via import-maps
- 🗂️ Load apps from local-resource protocol
- 🔄 Hot reload support
- 🎯 Path-based routing
- 📝 TypeScript support

## Quick Start

### 1. Basic Usage

```typescript
import { pluginManager, registerMicroApp, startMicroApps } from '@r/plugin'

// Register a single app
await registerMicroApp({
  name: 'my-app',
  activeWhen: '/my-app',
  entryUrl: 'local-resource:///D:/apps/my-app/index.js',
  customProps: {
    someData: 'value'
  }
})

// Start single-spa
startMicroApps()
```

### 2. Load Apps from Directory

```typescript
import { loadAppsFromDirectory, startMicroApps } from '@r/plugin'

// Load all apps from a directory with manifest.json
await loadAppsFromDirectory('D:/apps/plugins')
startMicroApps()
```

### 3. Directory Structure

Create a plugins directory with the following structure:

```
D:/apps/plugins/
├── manifest.json
├── app1/
│   ├── index.js
│   └── style.css
└── app2/
    ├── index.js
    └── style.css
```

**manifest.json:**
```json
{
  "version": "1.0.0",
  "apps": [
    {
      "name": "app1",
      "activeWhen": "/app1",
      "entryUrl": "app1/index.js",
      "customProps": {
        "theme": "dark"
      }
    },
    {
      "name": "app2",
      "activeWhen": "/app2",
      "entryUrl": "app2/index.js"
    }
  ]
}
```

## Creating a Micro-App

### Minimal Example (index.js)

```javascript
import { createApp } from 'vue'
import { ElButton } from 'element-plus'

let app = null

export async function bootstrap(props) {
  console.log('App bootstrapped', props)
}

export async function mount(props) {
  app = createApp({
    setup() {
      return () => (
        <div>
          <h1>My Micro App</h1>
          <ElButton type="primary">Click Me</ElButton>
        </div>
      )
    }
  })
  
  const container = props.domElement || document.getElementById('app')
  app.mount(container)
}

export async function unmount(props) {
  if (app) {
    app.unmount()
    app = null
  }
}
```

### With Vue SFC Style

```javascript
import { createApp, h } from 'vue'
import { ElButton, ElCard } from 'element-plus'

let app = null

const MyComponent = {
  name: 'MyApp',
  setup() {
    const handleClick = () => {
      console.log('Button clicked')
    }
    
    return () => h(ElCard, null, {
      default: () => [
        h('h2', 'My Micro Application'),
        h(ElButton, { 
          type: 'primary',
          onClick: handleClick 
        }, () => 'Click Me')
      ]
    })
  }
}

export async function bootstrap(props) {
  console.log('Bootstrapping app with props:', props)
}

export async function mount(props) {
  app = createApp(MyComponent)
  
  // Get container from props or create one
  const container = props.domElement || 
                   document.getElementById(`micro-app-${props.name}`)
  
  if (container) {
    app.mount(container)
  }
}

export async function unmount(props) {
  if (app) {
    app.unmount()
    app = null
  }
}

// Optional: Handle prop updates
export async function update(props) {
  console.log('App updated with new props:', props)
}
```

## Available Shared Dependencies

The following dependencies are available via import-maps and can be imported directly:

```javascript
import { createApp, ref, computed } from 'vue'
import { ElButton, ElMessage, ElDialog } from 'element-plus'
import { Edit, Delete, Plus } from '@element-plus/icons-vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
```

## API Reference

### pluginManager

Main plugin manager instance.

#### Methods

- `registerApp(config: MicroAppConfig): Promise<void>`
  - Register a single micro-app
  
- `unregisterApp(name: string): Promise<void>`
  - Unregister a micro-app
  
- `registerApps(configs: MicroAppConfig[]): Promise<void>`
  - Register multiple apps at once
  
- `getRegisteredApps(): string[]`
  - Get list of registered app names
  
- `getAppConfig(name: string): MicroAppConfig | undefined`
  - Get configuration for a specific app
  
- `startSingleSpa(): void`
  - Start single-spa router
  
- `loadAppsFromDirectory(path: string): Promise<void>`
  - Load apps from a directory with manifest.json

### Types

#### MicroAppConfig

```typescript
interface MicroAppConfig {
  name: string
  activeWhen: string | ((location: Location) => boolean)
  customProps?: Record<string, any>
  entryUrl: string // local-resource URL to the app entry
}
```

## Active When Patterns

The `activeWhen` property supports multiple patterns:

```javascript
// Exact path match
activeWhen: '/my-app'

// Prefix match (any path starting with /my-app)
activeWhen: '/my-app/*'

// Custom function
activeWhen: (location) => location.pathname.startsWith('/my-app')

// Multiple paths
activeWhen: (location) => {
  return ['/app1', '/app2'].includes(location.pathname)
}
```

## Advanced Usage

### Custom Props

Pass custom props to your micro-apps:

```typescript
await registerMicroApp({
  name: 'my-app',
  activeWhen: '/my-app',
  entryUrl: 'local-resource:///D:/apps/my-app/index.js',
  customProps: {
    apiBaseUrl: 'https://api.example.com',
    theme: 'dark',
    user: { id: 1, name: 'John' }
  }
})
```

Access props in your app:

```javascript
export async function mount(props) {
  console.log(props.apiBaseUrl) // 'https://api.example.com'
  console.log(props.theme) // 'dark'
  console.log(props.user) // { id: 1, name: 'John' }
}
```

### Dynamic Unregistration

```typescript
import { unregisterMicroApp } from '@r/plugin'

// Unregister an app at runtime
await unregisterMicroApp('my-app')
```

### Event Handling

Monitor app lifecycle events:

```typescript
import { registerApplication } from 'single-spa'

window.addEventListener('single-spa:before-app-change', (evt) => {
  console.log('Apps about to change:', evt.detail)
})

window.addEventListener('single-spa:app-change', (evt) => {
  console.log('Apps changed:', evt.detail)
})
```

## Troubleshooting

### App Not Loading

1. Check browser console for errors
2. Verify the entry URL is correct
3. Ensure the app exports `mount` and `unmount` functions
4. Check if the local-resource protocol handler is working

### CSS Conflicts

Element Plus styles are loaded globally. If you need custom styles:

```javascript
export async function mount(props) {
  // Load app-specific CSS
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'local-resource:///path/to/your/style.css'
  link.id = 'my-app-styles'
  document.head.appendChild(link)
  
  // ... mount logic
}

export async function unmount(props) {
  // Clean up styles
  const styles = document.getElementById('my-app-styles')
  if (styles) styles.remove()
  
  // ... unmount logic
}
```

### Import Resolution Issues

Make sure you're using the exact package names from import-map:

```javascript
// ✅ Correct
import { createApp } from 'vue'
import { ElButton } from 'element-plus'

// ❌ Wrong
import { createApp } from 'vue/dist/vue.esm-browser.js'
import { ElButton } from 'element-plus/lib/components/button'
```

## Examples

See the `examples/` directory for complete working examples:

- `examples/simple-app/` - Basic app with a button
- `examples/complex-app/` - App with routing and state management
- `examples/dashboard-plugin/` - Dashboard widget example

## License

Same as the main project.

