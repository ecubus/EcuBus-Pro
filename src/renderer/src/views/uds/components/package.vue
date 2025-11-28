<template>
  <div class="package-manager" :style="{ width: `${w - 4}px`, height: `${h}px` }">
    <div class="header">
      <h2>Package Manager</h2>
    </div>

    <div v-if="!hasPackageJson" class="no-package-json">
      <el-empty :image-size="50">
        <template #description>
          <div class="init-description">
            <p>No package.json found</p>
            <p class="sub-text">{{ initDescription }}</p>
            <el-button
              type="primary"
              class="init-button"
              :disabled="!canInitPackageJson"
              @click="handleInitPackageJson"
            >
              Initialize package.json
            </el-button>
          </div>
        </template>
      </el-empty>
    </div>

    <template v-else>
      <div>
        <div style="padding: 10px">
          <el-form :inline="true" @submit.prevent="installPackage">
            <el-form-item>
              <el-input
                v-model="packageName"
                placeholder="Enter package name"
                clearable
                style="width: 200px"
              />
            </el-form-item>
            <el-form-item>
              <el-select v-model="installType" placeholder="Install type" style="width: 200px">
                <el-option label="Dependencies" value="dependencies" />
                <el-option label="Dev Dependencies" value="devDependencies" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="isInstalling" plain @click="installPackage"
                >Install</el-button
              >
            </el-form-item>
          </el-form>
        </div>

        <div class="terminal-container">
          <div class="terminal-header">
            <span>Installation Log</span>
            <el-button link @click="clearTerminal">Clear</el-button>
          </div>
          <div id="terminalElement" class="terminal"></div>
        </div>

        <div>
          <h3>Installed Packages</h3>

          <el-tabs v-model="activeTab">
            <el-tab-pane label="Dependencies" name="dependencies">
              <div class="table-container">
                <el-table :data="dependenciesList" style="width: 100%; min-height: 200px">
                  <el-table-column prop="name" label="Package Name" min-width="180" />
                  <el-table-column prop="version" label="Version" width="180" />
                  <el-table-column label="Actions" width="120" fixed="right">
                    <template #default="scope">
                      <el-button
                        type="danger"
                        size="small"
                        plain
                        @click="uninstallPackage(scope.row.name)"
                      >
                        Uninstall
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-tab-pane>

            <el-tab-pane label="Dev Dependencies" name="devDependencies">
              <div class="table-container">
                <el-table :data="devDependenciesList" style="width: 100%; min-height: 200px">
                  <el-table-column prop="name" label="Package Name" min-width="180" />
                  <el-table-column prop="version" label="Version" width="180" />
                  <el-table-column label="Actions" width="120" fixed="right">
                    <template #default="scope">
                      <el-button
                        type="danger"
                        size="small"
                        plain
                        @click="uninstallPackage(scope.row.name, true)"
                      >
                        Uninstall
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, toRef, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@r/stores/project'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'

const project = useProjectStore()
const packageName = ref('')
const installType = ref('dependencies')
const activeTab = ref('dependencies')
const packageJson = ref<any>(null)
const isInstalling = ref(false)
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null

const props = defineProps<{
  height: number
  width: number
}>()
const h = toRef(props, 'height')
const w = toRef(props, 'width')

const hasPackageJson = computed(() => packageJson.value !== null)

const canInitPackageJson = computed(() => !!project.projectInfo.path)
const initDescription = computed(() => {
  if (!project.projectInfo.path) {
    return 'Please save your project first before initializing package.json'
  }
  return 'Please initialize package.json first to manage dependencies'
})

const dependenciesList = computed(() => {
  if (!packageJson.value?.dependencies) return []
  return Object.entries(packageJson.value.dependencies).map(([name, version]) => ({
    name,
    version
  }))
})

const devDependenciesList = computed(() => {
  if (!packageJson.value?.devDependencies) return []
  return Object.entries(packageJson.value.devDependencies).map(([name, version]) => ({
    name,
    version
  }))
})

// 写入日志到终端
const writeToTerminal = (data: string, type: 'success' | 'error' | 'info' = 'info') => {
  if (!terminal) return

  const colorCodes = {
    success: '\x1b[32m', // 绿色
    error: '\x1b[31m', // 红色
    info: '\x1b[0m' // 默认色
  }

  const resetCode = '\x1b[0m'
  const colorCode = colorCodes[type]

  // 确保每行都是新行
  const lines = data.split('\n')
  lines.forEach((line, index) => {
    if (index === lines.length - 1 && line === '') return
    terminal?.write(colorCode + line + resetCode + '\r\n')
  })

  // 滚动到底部
  terminal.scrollToBottom()
  fitAddon?.fit()
}

// 初始化终端
const initTerminal = () => {
  terminal = new Terminal({
    theme: {
      background: '#ffffff',
      foreground: '#333333',
      black: '#000000',
      red: '#cc0000',
      green: '#4e9a06',
      yellow: '#c4a000',
      blue: '#3465a4',
      magenta: '#75507b',
      cyan: '#06989a',
      white: '#ffffff',
      brightBlack: '#555753',
      brightRed: '#ef2929',
      brightGreen: '#8ae234',
      brightYellow: '#fce94f',
      brightBlue: '#729fcf',
      brightMagenta: '#ad7fa8',
      brightCyan: '#34e2e2',
      brightWhite: '#ffffff'
    },
    fontSize: 12,
    fontFamily: 'Consolas, "Courier New", monospace',
    lineHeight: 1.2,
    convertEol: true,
    disableStdin: true,
    cursorStyle: 'block',
    cursorBlink: false
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(document.getElementById('terminalElement') as HTMLElement)
  terminal.clear()
  fitAddon.fit()
}

// 清空终端
const clearTerminal = () => {
  if (!terminal) return
  terminal.clear()
}

let close
// 监听安装日志事件
const setupLogListener = () => {
  close = window.electron.ipcRenderer.on('ipc-pnpm-log', (_event, log) => {
    writeToTerminal(log, 'info')
  })
}

// 初始化 package.json
const initPackageJson = async () => {
  try {
    isInstalling.value = true
    await window.electron.ipcRenderer.invoke('ipc-pnpm-init', project.projectInfo.path)
    writeToTerminal('✓ package.json initialized successfully', 'success')
    await loadPackageJson()
  } catch (error: any) {
    writeToTerminal(
      `✗ Failed to initialize package.json: ${error?.message || 'Unknown error'}`,
      'error'
    )
  } finally {
    isInstalling.value = false
  }
}

// 安装包
const installPackage = async () => {
  if (!packageName.value) {
    writeToTerminal('✗ Please enter a package name', 'error')
    return
  }

  try {
    isInstalling.value = true
    await window.electron.ipcRenderer.invoke(
      'ipc-pnpm-install',
      project.projectInfo.path,
      packageName.value,
      installType.value === 'devDependencies'
    )
    writeToTerminal(`✓ Package ${packageName.value} installed successfully`, 'success')
    packageName.value = ''
    await loadPackageJson()
  } catch (error: any) {
    writeToTerminal(
      `✗ Failed to install package ${packageName.value}: ${error?.message || 'Unknown error'}`,
      'error'
    )
  } finally {
    isInstalling.value = false
  }
}

// 卸载包
const uninstallPackage = async (name: string, isDev: boolean = false) => {
  try {
    isInstalling.value = true
    await window.electron.ipcRenderer.invoke('ipc-pnpm-uninstall', project.projectInfo.path, name)
    writeToTerminal(`✓ Package ${name} uninstalled successfully`, 'success')
    await loadPackageJson()
  } catch (error: any) {
    writeToTerminal(
      `✗ Failed to uninstall package ${name}: ${error?.message || 'Unknown error'}`,
      'error'
    )
  } finally {
    isInstalling.value = false
  }
}

// 读取 package.json
const loadPackageJson = async () => {
  try {
    const result = await window.electron.ipcRenderer.invoke(
      'ipc-pnpm-read',
      project.projectInfo.path
    )
    packageJson.value = result
    nextTick(() => {
      initTerminal()
    })
  } catch (error: any) {
    writeToTerminal(`✗ Failed to load package.json: ${error?.message || 'Unknown error'}`, 'error')
    initTerminal()
  }
}

const handleInitPackageJson = async () => {
  await initPackageJson()
}

watch([h, w], () => {
  nextTick(() => {
    fitAddon?.fit()
  })
})

onMounted(() => {
  loadPackageJson()
  setupLogListener()
})

onBeforeUnmount(() => {
  // 清理事件监听
  close()
  // 销毁终端
  terminal?.dispose()
})
</script>

<style scoped>
.package-manager {
  box-sizing: border-box;
  padding: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 40px;
  flex-shrink: 0;
}

.content-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-bottom: 16px;
}

.install-section {
  margin-bottom: 16px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
  flex-shrink: 0;
}

.no-package-json {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
  height: calc(100% - 56px); /* 减去header高度和margin-top */
  min-height: 250px;
  border-radius: 4px;
  padding: 20px;
  box-sizing: border-box;
}

.init-description {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.init-description p {
  margin: 0;
  color: #303133;
  font-size: 16px;
}

.init-description .sub-text {
  color: #909399;
  font-size: 14px;
}

.init-button {
  margin-top: 16px;
}

h3 {
  margin: 0 0 16px 0;
}

:deep(.el-empty__image) {
  margin-bottom: 16px;
}

.terminal-container {
  margin-bottom: 16px;
  background-color: #ffffff;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #f5f7fa;
  color: #333333;
  border-bottom: 1px solid #dcdfe6;
}

.terminal {
  height: 200px;
  padding: 8px;
  width: v-bind(w-55 + 'px');
  overflow-y: auto;
}
</style>
