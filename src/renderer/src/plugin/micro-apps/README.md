# Micro-Apps Examples

This directory contains example micro-apps demonstrating the single-spa plugin system in EcuBus-Pro.

## Directory Structure

```
micro-apps/
├── manifest.json              # Central registry of all apps
├── GETTING_STARTED.md        # Quick start guide
├── hello-world/              # Simple button example
│   └── index.js
└── dashboard/                # Dashboard with live data
    └── index.js
```

## Quick Start

### 1. Load All Example Apps

```typescript
import { loadAppsFromDirectory, startMicroApps } from '@r/plugin'

// Load from this directory
const appsPath = 'D:\\code\\ecubus-pro\\resources\\examples\\micro-apps'
await loadAppsFromDirectory(appsPath)

// Start the plugin system
startMicroApps()
```

### 2. Access the Apps

Navigate to these routes:
- `/plugins/hello-world` - Simple Hello World app
- `/plugins/dashboard` - Live dashboard with statistics

## Available Examples

### Hello World (`hello-world/`)
A minimal example demonstrating:
- Basic Vue 3 app with Composition API
- Element Plus components (Card, Button)
- Reactive state with `ref()`
- Event handling

**Route:** `/plugins/hello-world`

### Dashboard (`dashboard/`)
A more complex example showing:
- Real-time data updates
- Multiple Element Plus components (Row, Col, Card, Statistic)
- Lifecycle management (onMounted, onUnmounted)
- Custom props usage
- Auto-refresh functionality

**Route:** `/plugins/dashboard`

## Creating Your Own App

See [GETTING_STARTED.md](./GETTING_STARTED.md) for a step-by-step guide.

### Basic Template

```javascript
import { createApp, h } from 'vue'
import { ElButton } from 'element-plus'

let app = null

export async function bootstrap(props) {
  // One-time initialization
}

export async function mount(props) {
  const MyApp = {
    setup() {
      return () => h('div', 'Hello World')
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

## manifest.json Format

```json
{
  "version": "1.0.0",
  "description": "Description of your app collection",
  "apps": [
    {
      "name": "unique-app-name",
      "activeWhen": "/route-path",
      "entryUrl": "relative/path/to/index.js",
      "customProps": {
        "key": "value"
      }
    }
  ]
}
```

## Shared Dependencies

All apps can use these without bundling:

- **Vue 3**: `import { createApp, ref, computed } from 'vue'`
- **Element Plus**: `import { ElButton, ElCard, ... } from 'element-plus'`
- **Element Plus Icons**: `import { Edit, Delete } from '@element-plus/icons-vue'`
- **Vue Router**: `import { createRouter } from 'vue-router'`
- **Pinia**: `import { createPinia } from 'pinia'`

## Props Available to Apps

```typescript
interface AppProps {
  name: string           // App name
  singleSpa: any        // single-spa instance
  domElement?: Element  // Container element
  // ... your custom props
}
```

## Debugging Tips

1. **Check browser console** for lifecycle logs:
   ```
   [App Name] Bootstrap
   [App Name] Mount
   [App Name] Unmount
   ```

2. **Verify route matching**:
   ```javascript
   console.log(window.location.pathname)
   ```

3. **Check registered apps**:
   ```javascript
   import { getRegisteredApps } from '@r/plugin'
   console.log(getRegisteredApps())
   ```

## Common Issues

### App not loading
- Verify the entry URL in manifest.json
- Check that the file exists at the specified path
- Look for errors in browser console

### Dependencies not found
- Make sure you're importing from the exact package names
- Use `import { createApp } from 'vue'` not `'vue/dist/...'`

### App not showing
- Check that your `activeWhen` matches current route
- Verify `startMicroApps()` was called
- Ensure mount() creates and mounts the app correctly

## Best Practices

1. **Always clean up** in unmount():
   ```javascript
   export async function unmount() {
     // Remove event listeners
     // Clear timers
     // Unmount app
   }
   ```

2. **Use unique IDs** for any DOM elements you create

3. **Namespace your CSS** to avoid conflicts

4. **Handle errors gracefully**:
   ```javascript
   export async function mount(props) {
     try {
       // Your code
     } catch (error) {
       console.error('Mount error:', error)
     }
   }
   ```

5. **Test independently** before integrating

## Documentation

- Main plugin docs: `src/renderer/src/plugin/README.md`
- Getting started: `GETTING_STARTED.md`
- Integration examples: `src/renderer/src/plugin/integration-example.ts`

## Support

For questions or issues:
1. Check the main documentation
2. Review the example apps
3. Look at the integration examples
4. Create an issue in the project repository

