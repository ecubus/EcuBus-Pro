<template>
  <div class="project-selector">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="template-list">
          <el-button type="primary" plain icon="Fold" @click="project.createNewProject"
            >Create Empty Project</el-button
          >
          <el-divider></el-divider>
          <!-- <h3 class="section-title">Available Templates</h3> -->
          <el-scrollbar :height="props.height - 35 - 40 - 121">
            <el-tree
              default-expand-all
              highlight-current
              :data="templates"
              @node-click="handleTemplateSelect"
            />
          </el-scrollbar>
        </el-card>
      </el-col>
      <el-col :span="16">
        <el-card id="mainReadme" class="action-panel">
          <div v-if="selectedTemplate" class="button-container">
            <el-button type="primary" @click="createTemplateProject">Create The Example</el-button>
            <el-divider></el-divider>
            <div class="readme">
              <div id="readme" v-html="readme" />
            </div>
          </div>
          <div v-else>
            <el-skeleton :rows="13" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRef, onMounted, onUnmounted, nextTick } from 'vue'
import { ElRow, ElCol, ElCard, ElButton, ElIcon, ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@r/stores/project'
import { Marked, MarkedExtension, Token, Tokens } from 'marked'
import './readme.css'
import { cloneDeep } from 'lodash'
import log from 'electron-log'
import mermaid from 'mermaid'

interface exampleL1 {
  level: 1
  catalog: string
}

interface exampleL2 {
  level: 2
  filePath: string
  readme: string
  folderPath: string
  detail: any
}

interface example {
  label: string
  data: exampleL1 | exampleL2
  children: example[]
}

let marked: Marked
const videoPlayers = ref([])
const readmeHeight = computed(() => props.height - 35 - 40 - 121)
const templates = ref<example[]>([])

const selectedTemplate = ref<example | null>(null)

function createTemplateProject() {
  if (selectedTemplate.value && selectedTemplate.value.data.level == 2) {
    window.electron.ipcRenderer
      .invoke('ipc-create-example', cloneDeep(selectedTemplate.value.data))
      .then((v) => {
        if (v) {
          project.createExampleProject(v)
        }
      })
      .catch((err) => {
        log.error(err)
        ElMessage.error('Failed to create example')
      })
  }
}

const readme = ref<string>('')
const handleTemplateSelect = async (template: example) => {
  if (template.data.level == 2) {
    selectedTemplate.value = template
    window.readmePath = template.data.folderPath
    readme.value = marked.parse(template.data.readme) as string

    // Wait for DOM update then render mermaid diagrams
    await nextTick()

    const elements = document.getElementsByClassName('mermaid')
    Array.from(elements).forEach((element) => {
      mermaid
        .render(`mermaid-${Date.now()}`, element.textContent || '')
        .then(({ svg }) => {
          element.innerHTML = svg
        })
        .catch((err) => {
          console.error('Mermaid rendering failed:', err)
          element.innerHTML = `<pre>${element.textContent}</pre>`
        })
    })
  } else selectedTemplate.value = null
}

const props = defineProps<{
  height: number
}>()

// const height = toRef(props, 'height')
const project = useProjectStore()

function addLocalBaseUrl() {
  // extension code here
  const reIsAbsolute = /[\w+\-+]+:\/\//
  return {
    walkTokens: (token: Token) => {
      if (!['link', 'image'].includes(token.type)) {
        return
      }
      const tempToken = token as Tokens.Image | Tokens.Link
      if (reIsAbsolute.test(tempToken.href)) {
        // the URL is absolute, do not touch it
        return
      }
      // Build full file path
      const fullPath = window.readmePath + '\\' + tempToken.href
      // Normalize to forward slashes
      const normalizedPath = fullPath.replace(/\\/g, '/')
      // Use triple slash after protocol to avoid browser parsing issues with drive letters
      // local-resource:///D:/path instead of local-resource://D:/path
      tempToken.href = 'local-resource:///' + normalizedPath
    }
  } as MarkedExtension
}

const videoRenderer = {
  name: 'video',
  level: 'inline',
  start(src) {
    return src.match(/@\[video\]/)?.index
  },
  tokenizer(src) {
    const rule = /^@\[video\]\((.*?)\)/
    const match = rule.exec(src)
    if (match) {
      return {
        type: 'video',
        raw: match[0],
        url: match[1]
      }
    }
    return undefined
  },
  renderer(token) {
    return `
                <div  style=" text-align: center;">
                <iframe class="video-container" src="${token.url}" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>
                </div>
                `
  }
}

// Add mermaid configuration before onMounted
const mermaidConfig = {
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose'
}

// Add mermaid renderer
const mermaidRenderer = {
  name: 'mermaid',
  level: 'block',
  start(src) {
    return src.match(/```mermaid/)?.index
  },
  tokenizer(src) {
    const rule = /^```mermaid\n([\s\S]*?)\n```/
    const match = rule.exec(src)
    if (match) {
      return {
        type: 'mermaid',
        raw: match[0],
        text: match[1].trim()
      }
    }
    return undefined
  },
  renderer(token) {
    return `<div class="mermaid">${token.text}</div>`
  }
}

onMounted(() => {
  window.electron.ipcRenderer
    .invoke('ipc-examples')
    .then((data: example[]) => {
      templates.value = data
    })
    .catch((err) => {
      ElMessage.error('Failed to load templates')
    })
  marked = new Marked()
  marked.use({ extensions: [videoRenderer, mermaidRenderer] })
  /** base url */
  marked.use(addLocalBaseUrl())

  //bind href click event
  document.getElementById('mainReadme')?.addEventListener('click', (e) => {
    //if e is <a> tag
    if ((e.target as HTMLElement).tagName == 'A') {
      e.preventDefault()
      //get href
      const href = (e.target as HTMLElement).getAttribute('href')
      window.electron.ipcRenderer.send('ipc-open-link', href)
    }
  })

  // Initialize mermaid
  mermaid.initialize(mermaidConfig as any)
})
</script>

<style>
.readme {
  height: v-bind(readmeHeight + 'px') !important;
  overflow-y: auto;
  width: 100%;
  text-align: left;
  width: 100%;
  color: var(--el-text-color-primary);
}
.video-container {
  max-width: 800px;
  width: 100%;
  height: 500px;
}
.mermaid {
  text-align: center;
  margin: 20px 0;
}
</style>
<style scoped>
.project-selector {
  padding: 20px;
  height: 100%;
}

.project-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  overflow: hidden;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 15px;
}

.category-section {
  margin: 20px;
}

.category-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #606266;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
}

.template-item {
  cursor: pointer;
  transition: border-color 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100px;
}

.template-item.selected {
  border-color: #409eff;
}

.template-icon {
  margin-top: 5px;
  font-size: 24px;
}

.template-name {
  margin: 2px;
  font-size: 14px;
  text-align: center;
}

.button-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.button-container .el-button + .el-button {
  margin-left: 0px !important;
}

.action-button {
  width: 100%;
}

.details-panel {
  margin-top: 20px;
}

.details-panel p {
  margin-bottom: 10px;
}

.lr {
  width: 100%;
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: center;
}
</style>
