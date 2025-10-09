/**
 * Utility functions for plugin management
 */

/**
 * Convert Windows path to local-resource URL
 */
export function pathToLocalResourceUrl(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/')
  return normalizedPath.startsWith('local-resource:///')
    ? normalizedPath
    : `local-resource:///${normalizedPath}`
}

/**
 * Create a container element for a micro-app
 */
export function createAppContainer(appName: string): HTMLElement {
  const container = document.createElement('div')
  container.id = `micro-app-${appName}`
  container.className = 'micro-app-container'
  return container
}

/**
 * Remove app container
 */
export function removeAppContainer(appName: string): void {
  const container = document.getElementById(`micro-app-${appName}`)
  if (container) {
    container.remove()
  }
}

/**
 * Check if a URL is a local-resource URL
 */
export function isLocalResourceUrl(url: string): boolean {
  return url.startsWith('local-resource:///')
}

/**
 * Validate micro-app module
 */
export function validateMicroApp(module: any, appName: string): boolean {
  if (!module) {
    console.error(`App "${appName}": Module is null or undefined`)
    return false
  }

  if (typeof module.mount !== 'function') {
    console.error(`App "${appName}": Missing or invalid mount function`)
    return false
  }

  if (typeof module.unmount !== 'function') {
    console.error(`App "${appName}": Missing or invalid unmount function`)
    return false
  }

  return true
}

/**
 * Generate unique app name
 */
export function generateAppName(baseName: string, existingNames: string[]): string {
  let counter = 1
  let name = baseName

  while (existingNames.includes(name)) {
    name = `${baseName}-${counter}`
    counter++
  }

  return name
}

/**
 * Parse activeWhen string to function
 */
export function parseActiveWhen(
  activeWhen: string | ((location: Location) => boolean)
): (location: Location) => boolean {
  if (typeof activeWhen === 'function') {
    return activeWhen
  }

  // Support simple path matching
  return (location: Location) => {
    const path = location.pathname

    // Exact match
    if (activeWhen === path) return true

    // Prefix match (e.g., "/app" matches "/app/something")
    if (activeWhen.endsWith('/*')) {
      const prefix = activeWhen.slice(0, -2)
      return path.startsWith(prefix)
    }

    // Regex match
    if (activeWhen.startsWith('/') && activeWhen.includes('(')) {
      try {
        const regex = new RegExp(activeWhen)
        return regex.test(path)
      } catch {
        return false
      }
    }

    return false
  }
}

/**
 * Load CSS file dynamically
 */
export function loadCSS(url: string, id?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) {
      resolve()
      return
    }

    const link = document.createElement('link')
    if (id) link.id = id
    link.rel = 'stylesheet'
    link.href = url
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`Failed to load CSS: ${url}`))
    document.head.appendChild(link)
  })
}

/**
 * Load script file dynamically
 */
export function loadScript(url: string, id?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) {
      resolve()
      return
    }

    const script = document.createElement('script')
    if (id) script.id = id
    script.type = 'module'
    script.src = url
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`))
    document.head.appendChild(script)
  })
}
