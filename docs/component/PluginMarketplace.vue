<template>
  <div class="marketplace-container" :style="{ height: `${props.height}px` }">
    <header class="nav-bar">
      <div class="nav-left" @click="goBack">
        <button class="nav-btn">
          <span class="icon">🏠</span>
          <span>Home</span>
        </button>
      </div>
      <div class="nav-title">Plugin Marketplace</div>
      <div class="nav-right"></div>
    </header>

    <main class="main-body">
      <div v-if="loading" class="state-center">
        <div class="spinner"></div>
        <p>Loading plugin resources...</p>
      </div>

      <div v-else-if="error" class="state-center error-state">
        <div class="error-icon">⚠️</div>
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="fetchPlugins">Retry</button>
      </div>

      <div v-else class="content-grid">
        <aside class="sidebar card">
          <div class="sidebar-header">
            <h3>Available Plugins</h3>
            <span class="badge">{{ plugins.length }}</span>
          </div>

          <div class="sidebar-scroll custom-scroll">
            <div v-if="plugins.length === 0" class="empty-list">
              <span class="empty-emoji">📦</span>
              <p>No plugins available</p>
            </div>

            <div
              v-for="plugin in plugins"
              :key="plugin.id"
              class="plugin-item"
              :class="{ active: selectedPlugin?.id === plugin.id }"
              @click="handlePluginSelect(plugin)"
            >
              <div class="plugin-icon-wrapper">
                <img
                  :src="getIconUrl(plugin)"
                  class="plugin-icon"
                  alt="icon"
                  @error="handleImgError"
                />
              </div>
              <div class="plugin-info">
                <div class="plugin-name-row">
                  <span class="plugin-name">{{ plugin.name }}</span>
                </div>
                <div class="plugin-desc">{{ plugin.description || 'No description' }}</div>
                <div class="plugin-meta">
                  <span class="badge badge-blue">v{{ plugin.version }}</span>
                  <span class="author">{{ plugin.author }}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section class="details-panel card">
          <div v-if="selectedPlugin" class="details-content">
            <div class="details-hero">
              <div class="hero-main">
                <img
                  :src="getIconUrl(selectedPlugin)"
                  class="hero-icon"
                  alt="icon"
                  @error="handleImgError"
                />
                <div class="hero-info">
                  <h1 class="hero-title">{{ selectedPlugin.name }}</h1>
                  <p class="hero-desc">{{ selectedPlugin.description }}</p>
                  <div class="hero-meta">
                    <span class="pill">Version: {{ selectedPlugin.version }}</span>
                    <span class="separator">•</span>
                    <span class="pill">Author: {{ selectedPlugin.author }}</span>
                    <span class="separator">•</span>
                    <span class="pill"
                      >Published: {{ formatDate(selectedPlugin.createdTime) }}</span
                    >
                  </div>
                </div>
              </div>
            </div>

            <div class="tech-bar">
              <div v-if="selectedPlugin.manifestContent?.tabs?.length" class="tech-item">
                <span class="tech-label">Tabs</span>
                <span class="tech-value">{{ selectedPlugin.manifestContent.tabs.length }}</span>
              </div>
              <div v-if="selectedPlugin.manifestContent?.extensions?.length" class="tech-item">
                <span class="tech-label">Extensions</span>
                <span class="tech-value">{{
                  selectedPlugin.manifestContent.extensions.map((e) => e.targetTab).join(', ')
                }}</span>
              </div>
              <div class="tech-item">
                <span class="tech-label">ID</span>
                <span class="tech-value code-font">{{ selectedPlugin.id }}</span>
              </div>
            </div>

            <div class="readme-wrapper custom-scroll">
              <div class="readme-header">README.md</div>
              <div
                class="markdown-body"
                @click="handleReadmeClick($event)"
                v-html="renderedReadme"
              ></div>
            </div>
          </div>

          <div v-else class="no-selection">
            <h2>Please select a plugin</h2>
            <p>Click on a plugin from the list to view details and documentation</p>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, withDefaults } from 'vue'
import { Marked } from 'marked'
import { useRouter } from 'vitepress'

// --- Interfaces ---
interface ResourceItem {
  owner: string
  name: string
  createdTime: string
  user: string
  provider: string
  application: string
  tag: string
  parent: string
  fileName: string
  fileType: string
  fileFormat: string
  fileSize: number
  url: string
  description: string
}

interface ResourceApiResponse {
  status: string
  msg: string
  data: ResourceItem[]
}

interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  icon?: string
  tabs?: any[]
  extensions?: Array<{ targetTab: string }>
}

interface RemotePluginInfo {
  id: string
  name?: string
  description?: string
  author?: string
  version: string
  icon?: string
  readme?: string
  zipUrl?: string
  manifestUrl?: string
  createdTime: string
  user: string
  readmeContent?: string
  manifestContent?: PluginManifest
}

// --- Props ---
const props = withDefaults(defineProps<{ height?: number }>(), { height: 800 })

// --- Router ---
const router = useRouter()

// --- State ---
const loading = ref(false)
const error = ref<string | null>(null)
const plugins = ref<RemotePluginInfo[]>([])
const selectedPlugin = ref<RemotePluginInfo | null>(null)
let marked: Marked

const PLUGIN_API_ENDPOINT = '/resources/api/get-resources'

// --- Methods ---

function goBack() {
  router.go('/')
}

// Handle broken images by replacing source with a data URI SVG
function handleImgError(e: Event) {
  const img = e.target as HTMLImageElement
  img.src =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/%3E%3C/svg%3E'
}

function getIconUrl(plugin: RemotePluginInfo): string {
  if (!plugin.icon)
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%23f0f0f0"%3E%3Crect width="100" height="100"/%3E%3Ctext x="50" y="50" dominant-baseline="middle" text-anchor="middle" font-size="50"%3E🧩%3C/text%3E%3C/svg%3E'

  if (/^[\w+\-+]+:\/\//.test(plugin.icon)) {
    return plugin.icon
  }
  return plugin.icon
}

const renderedReadme = computed(() => {
  if (!selectedPlugin.value) return ''
  const readme = selectedPlugin.value.readmeContent
  if (!readme) return '<div class="no-doc">No documentation available</div>'
  return marked.parse(readme) as string
})

async function handlePluginSelect(plugin: RemotePluginInfo) {
  selectedPlugin.value = { ...plugin }

  // Fetch Readme
  if (plugin.readme && !plugin.readmeContent) {
    try {
      const res = await fetch(plugin.readme)
      if (res.ok) selectedPlugin.value.readmeContent = await res.text()
    } catch (e) {
      console.error('Readme load failed', e)
    }
  }

  // Fetch Manifest
  if (plugin.manifestUrl && !plugin.manifestContent) {
    try {
      const res = await fetch(plugin.manifestUrl)
      if (res.ok) selectedPlugin.value.manifestContent = await res.json()
    } catch (e) {
      console.error('Manifest load failed', e)
    }
  }
}

async function fetchPlugins() {
  loading.value = true
  error.value = null
  try {
    const response = await fetch(PLUGIN_API_ENDPOINT)
    if (!response.ok) throw new Error('Network error')

    const apiResponse: ResourceApiResponse = await response.json()
    if (apiResponse.status !== 'ok') throw new Error(apiResponse.msg)

    const resources = apiResponse.data
    const pluginMap = new Map<string, RemotePluginInfo>()

    // Group resources by parent ID
    for (const res of resources) {
      if (!pluginMap.has(res.parent)) {
        pluginMap.set(res.parent, {
          id: res.parent,
          version: res.tag,
          createdTime: res.createdTime,
          user: res.user
        })
      }
      const p = pluginMap.get(res.parent)!

      if (res.fileType === 'image') p.icon = res.url
      else if (res.fileName.startsWith('readme')) p.readme = res.url
      else if (res.fileFormat === '.zip') p.zipUrl = res.url
      else if (res.fileFormat === '.json') {
        p.manifestUrl = res.url
        if (res.description) {
          try {
            const info = JSON.parse(res.description)
            p.name = info.name
            p.description = info.description
            p.author = info.author
          } catch {
            null
          }
        }
      }
    }

    // Filter valid plugins
    plugins.value = Array.from(pluginMap.values()).filter(
      (p) => p.icon && p.zipUrl && p.manifestUrl && p.name && p.author
    )
  } catch (e: any) {
    error.value = e.message || 'Load failed'
  } finally {
    loading.value = false
  }
}

function formatDate(str: string): string {
  try {
    return new Date(str).toLocaleDateString()
  } catch {
    return str
  }
}

function handleReadmeClick(e: MouseEvent) {
  if ((e.target as HTMLElement).tagName === 'A') {
    e.preventDefault()
    const href = (e.target as HTMLElement).getAttribute('href')
    if (href) window.open(href, '_blank')
  }
}

onMounted(() => {
  marked = new Marked()
  fetchPlugins()
})
</script>

<style scoped>
/* --- Reset & Variables --- */
:deep(*) {
  box-sizing: border-box;
}

.marketplace-container {
  /* Colors */
  --c-primary: #3b82f6;
  --c-primary-hover: #2563eb;
  --c-bg-app: #f3f4f6;
  --c-bg-card: #ffffff;
  --c-text-main: #1f2937;
  --c-text-sub: #6b7280;
  --c-border: #e5e7eb;
  --c-hover: #f9fafb;
  --c-active-bg: #eff6ff;
  --c-active-border: #3b82f6;

  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--c-bg-app);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--c-text-main);
}

/* --- Navigation --- */
.nav-bar {
  height: 60px;
  background: var(--c-bg-card);
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}

.nav-left,
.nav-right {
  width: 120px; /* Balance spacing */
}

.nav-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--c-text-main);
}

.nav-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--c-text-sub);
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.2s;
}

.nav-btn:hover {
  background-color: var(--c-hover);
  color: var(--c-primary);
}

/* --- Layout --- */
.main-body {
  flex: 1;
  padding: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content-grid {
  display: flex;
  gap: 16px;
  height: 100%;
}

.card {
  background: var(--c-bg-card);
  border-radius: 12px;
  border: 1px solid var(--c-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* --- Sidebar --- */
.sidebar {
  width: 300px;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--c-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.sidebar-scroll {
  flex: 1;
  overflow-y: auto;
}

.plugin-item {
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  cursor: pointer;
  border-bottom: 1px solid transparent;
  transition: background 0.2s;
  position: relative;
}

.plugin-item:hover {
  background: var(--c-hover);
}

.plugin-item.active {
  background: var(--c-active-bg);
}

.plugin-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--c-active-border);
}

.plugin-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: #f0f0f0;
  object-fit: contain;
  border: 1px solid var(--c-border);
}

.plugin-info {
  flex: 1;
  min-width: 0;
}

.plugin-name {
  font-weight: 500;
  font-size: 14px;
  display: block;
  margin-bottom: 2px;
}

.plugin-desc {
  font-size: 12px;
  color: var(--c-text-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 6px;
}

.plugin-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.author {
  font-size: 11px;
  color: #9ca3af;
}

/* --- Details Panel --- */
.details-panel {
  flex: 1;
  min-width: 0;
}

.details-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.details-hero {
  padding: 24px;
  background: linear-gradient(to bottom, #fff, #f9fafb);
  border-bottom: 1px solid var(--c-border);
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.hero-main {
  display: flex;
  gap: 20px;
}

.hero-icon {
  width: 80px;
  height: 80px;
  border-radius: 16px;
  border: 1px solid var(--c-border);
  background: #fff;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  object-fit: contain;
}

.hero-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
}

.hero-desc {
  margin: 0 0 12px;
  color: var(--c-text-sub);
  font-size: 14px;
  line-height: 1.5;
  max-width: 600px;
}

.hero-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: var(--c-text-sub);
}

.separator {
  color: #d1d5db;
}

.tech-bar {
  padding: 10px 24px;
  background: #fff;
  border-bottom: 1px solid var(--c-border);
  display: flex;
  gap: 16px;
}

.tech-item {
  display: flex;
  align-items: center;
  font-size: 12px;
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 4px;
}

.tech-label {
  color: #6b7280;
  margin-right: 6px;
  font-weight: 500;
}

.tech-value {
  color: #374151;
  font-weight: 600;
}

.code-font {
  font-family: monospace;
}

/* --- Readme --- */
.readme-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  background: #fff;
}

.readme-header {
  padding: 12px 24px;
  font-size: 12px;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(5px);
  border-bottom: 1px solid #f0f0f0;
}

.markdown-body {
  padding: 24px 40px 40px;
  line-height: 1.6;
  color: #24292e;
}

.no-doc {
  padding: 40px;
  text-align: center;
  color: #9ca3af;
  font-style: italic;
}

/* --- Common UI Elements --- */
.badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 12px;
  background: #e5e7eb;
  color: #4b5563;
}

.badge-blue {
  background: #eff6ff;
  color: #2563eb;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--c-primary);
  color: white;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary:hover {
  background: var(--c-primary-hover);
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
}

/* --- Custom Scrollbar --- */
.custom-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* --- States --- */
.state-center {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--c-text-sub);
}

.error-state {
  color: #ef4444;
}
.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.no-selection {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--c-text-sub);
  background: #f9fafb;
}

@keyframes bounceX {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-10px);
  }
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: var(--c-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-list {
  padding: 40px;
  text-align: center;
  color: #9ca3af;
}
.empty-emoji {
  font-size: 32px;
  display: block;
  margin-bottom: 10px;
}
</style>

<style>
/* Global Markdown Styles (Scoped can't reach v-html content easily) */
.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}
.markdown-body h1 {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}
.markdown-body h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}
.markdown-body p {
  margin-top: 0;
  margin-bottom: 16px;
}
.markdown-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  font-family: monospace;
}
.markdown-body pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
  margin-bottom: 16px;
}
.markdown-body pre code {
  background: none;
  padding: 0;
}
.markdown-body blockquote {
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  margin: 16px 0;
}
.markdown-body ul,
.markdown-body ol {
  padding-left: 2em;
  margin-bottom: 16px;
}
.markdown-body img {
  max-width: 100%;
  height: auto;
  object-fit: contain;
  box-sizing: content-box;
  background-color: #fff;
}
.markdown-body a {
  color: #0366d6;
  text-decoration: none;
}
.markdown-body a:hover {
  text-decoration: underline;
}
</style>
