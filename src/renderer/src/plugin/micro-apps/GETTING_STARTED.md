# Getting Started with Micro-Apps

This guide will help you create and load your first micro-app in EcuBus-Pro.

## Prerequisites

- EcuBus-Pro installed and running
- Basic knowledge of Vue 3 and JavaScript modules

## Quick Start

### Step 1: Understand the Directory Structure

All example micro-apps are located in:
```
D:\code\ecubus-pro\resources\examples\micro-apps\
```

The structure looks like this:
```
micro-apps/
├── manifest.json          # App registry
├── hello-world/
│   └── index.js          # Hello World app
└── dashboard/
    └── index.js          # Dashboard app
```

### Step 2: Load the Example Apps

In your renderer code:

```typescript
import { loadAppsFromDirectory, startMicroApps } from '@r/plugin'

// Load apps from the examples directory
const appsPath = 'D:\\code\\ecubus-pro\\resources\\examples\\micro-apps'
await loadAppsFromDirectory(appsPath)

// Start single-spa
startMicroApps()
```

### Step 3: Navigate to an App

Once loaded, navigate to:
- `http://localhost:5173/plugins/hello-world` for the Hello World app
- `http://localhost:5173/plugins/dashboard` for the Dashboard app

## Creating Your First Micro-App

### 1. Create App Directory

Create a new directory for your app:
```
D:\my-apps\my-first-app\
```

### 2. Create index.js

Create `index.js` with the following content:

```javascript
import { createApp, h, ref } from 'vue'
import { ElButton, ElCard } from 'element-plus'

let app = null

export async function bootstrap(props) {
  console.log('App bootstrapped', props)
}

export async function mount(props) {
  const MyApp = {
    setup() {
      const message = ref('Hello from my first micro-app!')
      
      const handleClick = () => {
        message.value = 'Button clicked! 🎉'
      }
      
      return () => h('div', { 
        style: { padding: '20px' } 
      }, [
        h(ElCard, null, {
          default: () => [
            h('h2', message.value),
            h(ElButton, { 
              type: 'primary',
              onClick: handleClick 
            }, () => 'Click Me')
          ]
        })
      ])
    }
  }
  
  app = createApp(MyApp)
  
  const container = props.domElement || 
                   document.getElementById(`micro-app-${props.name}`) ||
                   document.getElementById('app')
  
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
```

### 3. Create manifest.json

Create `manifest.json` in the `D:\my-apps\` directory:

```json
{
  "version": "1.0.0",
  "apps": [
    {
      "name": "my-first-app",
      "activeWhen": "/my-app",
      "entryUrl": "my-first-app/index.js"
    }
  ]
}
```

### 4. Load Your App

```typescript
import { loadAppsFromDirectory, startMicroApps } from '@r/plugin'

await loadAppsFromDirectory('D:\\my-apps')
startMicroApps()
```

### 5. Test Your App

Navigate to `http://localhost:5173/my-app`

## Available Dependencies

Your micro-apps can use these dependencies without bundling:

### Vue 3
```javascript
import { 
  createApp, 
  ref, 
  reactive, 
  computed, 
  watch,
  onMounted,
  onUnmounted 
} from 'vue'
```

### Element Plus
```javascript
import {
  ElButton,
  ElCard,
  ElInput,
  ElTable,
  ElMessage,
  ElDialog,
  // ... and all other Element Plus components
} from 'element-plus'
```

### Element Plus Icons
```javascript
import { 
  Edit, 
  Delete, 
  Plus, 
  Search 
} from '@element-plus/icons-vue'
```

### Vue Router (Optional)
```javascript
import { 
  createRouter, 
  createWebHistory 
} from 'vue-router'
```

### Pinia (Optional)
```javascript
import { createPinia } from 'pinia'
```

## Lifecycle Methods

Your app MUST export these functions:

### mount (Required)
Called when the app should be displayed:
```javascript
export async function mount(props) {
  // Create and mount your Vue app
  app = createApp(MyComponent)
  app.mount(props.domElement)
}
```

### unmount (Required)
Called when the app should be removed:
```javascript
export async function unmount(props) {
  // Clean up and unmount
  if (app) {
    app.unmount()
    app = null
  }
}
```

### bootstrap (Optional)
Called once when the app is first loaded:
```javascript
export async function bootstrap(props) {
  // One-time initialization
  console.log('Initializing app')
}
```

### update (Optional)
Called when props change:
```javascript
export async function update(props) {
  // Handle prop updates
  console.log('Props updated', props)
}
```

## Props

Your app receives these props:

```javascript
export async function mount(props) {
  // Props available:
  console.log(props.name)          // App name
  console.log(props.domElement)    // Container element
  console.log(props.customProps)   // Your custom props
}
```

## Advanced Usage

### Using Custom Props

In manifest.json:
```json
{
  "name": "my-app",
  "activeWhen": "/my-app",
  "entryUrl": "my-app/index.js",
  "customProps": {
    "apiUrl": "https://api.example.com",
    "theme": "dark",
    "features": ["feature1", "feature2"]
  }
}
```

Access in your app:
```javascript
export async function mount(props) {
  console.log(props.apiUrl)    // "https://api.example.com"
  console.log(props.theme)     // "dark"
  console.log(props.features)  // ["feature1", "feature2"]
}
```

### Multiple Routes

Use a custom function for `activeWhen`:

In your main app:
```typescript
await registerMicroApp({
  name: 'multi-route-app',
  activeWhen: (location) => {
    return ['/route1', '/route2', '/route3'].some(
      route => location.pathname.startsWith(route)
    )
  },
  entryUrl: 'local-resource:///D:/apps/multi-route-app/index.js'
})
```

Or use wildcard in manifest.json:
```json
{
  "activeWhen": "/my-app/*"
}
```

### Loading Additional Resources

Load CSS or other resources:
```javascript
export async function mount(props) {
  // Load CSS
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'local-resource:///D:/my-apps/my-app/style.css'
  link.id = 'my-app-styles'
  document.head.appendChild(link)
  
  // Mount app
  app = createApp(MyComponent)
  app.mount(props.domElement)
}

export async function unmount(props) {
  // Clean up CSS
  document.getElementById('my-app-styles')?.remove()
  
  // Unmount app
  if (app) {
    app.unmount()
    app = null
  }
}
```

## Debugging

### Enable Console Logs
All lifecycle events are logged. Check the browser console:
```
[Hello World] Bootstrap
[Hello World] Mount
[Hello World] Unmount
```

### Common Issues

**App not loading:**
- Check the entry URL is correct
- Verify the file exists
- Check browser console for errors

**Vue/Element Plus not found:**
- Make sure you're using exact imports: `import { createApp } from 'vue'`
- Don't use file paths like `vue/dist/vue.esm-browser.js`

**App not showing:**
- Check that `activeWhen` matches your current route
- Verify `startMicroApps()` was called
- Check that mount returns successfully

## Next Steps

- Explore the example apps in `resources/examples/micro-apps/`
- Read the full API documentation in `src/renderer/src/plugin/README.md`
- Try creating a more complex app with routing and state management

## Support

For issues and questions, check the main documentation or create an issue in the project repository.

