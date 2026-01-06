<template>
  <div ref="logContainer" class="log-container">
    <div class="toolbar">
      <el-button-group>
        <el-tooltip effect="light" content="Clear Message" placement="bottom">
          <el-button type="danger" link @click="clearLog">
            <Icon :icon="circlePlusFilled" />
          </el-button>
        </el-tooltip>
      </el-button-group>

      <el-divider direction="vertical" />
      <el-dropdown size="small">
        <el-button type="info" link @click="saveLog">
          <Icon :icon="saveIcon" />
        </el-button>

        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>Save Message</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div
      ref="terminalContainer"
      class="terminal-container"
      :style="{ height: tableHeight + 'px', width: '100%' }"
      tabindex="-1"
    ></div>
  </div>
</template>
<script lang="ts" setup>
import { ref, shallowRef, onMounted, onUnmounted, computed, toRef, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { CanvasAddon } from '@xterm/addon-canvas'
import '@xterm/xterm/css/xterm.css'
import { useDark } from '@vueuse/core'
import { Icon } from '@iconify/vue'
import circlePlusFilled from '@iconify/icons-material-symbols/scan-delete-outline'
import saveIcon from '@iconify/icons-material-symbols/save'
import { useProjectStore } from '@r/stores/project'
import type { TestEvent } from 'node:test/reporters'
import { useGlobalStart } from '@r/stores/runtime'
interface LogData {
  time: string
  label: string
  level: string
  message: string
}

const terminalContainer = ref<HTMLElement>()
// Use shallowRef for third-party instances to avoid unnecessary reactivity overhead
const terminal = shallowRef<Terminal>()
const fitAddon = shallowRef<FitAddon>()
const canvasAddon = shallowRef<CanvasAddon>()
const globalStart = useGlobalStart()
const isDark = useDark()
const logContainer = ref<HTMLElement>()
const logBuffer: string[] = []
function clearLog() {
  terminal.value?.clear()
  logBuffer.length = 0
}

const props = withDefaults(
  defineProps<{
    height: number
    prefix?: string
    captureTest?: boolean
    captureSystem?: boolean
    testId?: string[]
    fields?: string[]
  }>(),
  {
    prefix: '',
    captureTest: false,
    captureSystem: true,
    fields: () => ['time', 'source', 'message']
  }
)

function getData() {
  return logBuffer.join('\n')
}

const testId = toRef(props, 'testId')
// const start = toRef(props, 'start')

defineExpose({
  clearLog,
  getData
})

watch(globalStart, (val) => {
  if (val) {
    clearLog()
  }
})
const tableHeight = toRef(props, 'height')
const project = useProjectStore()

// Terminal theme based on dark mode
const terminalTheme = computed(() => {
  if (isDark.value) {
    return {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: 'transparent',
      cursorAccent: 'transparent',
      selectionBackground: '#3a3d41',
      selectionForeground: '#ffffff',
      black: '#000000',
      red: '#f44747',
      green: '#4ec9b0',
      yellow: '#ffcc00',
      blue: '#3794ff',
      magenta: '#c586c0',
      cyan: '#89ddff',
      white: '#ffffff',
      brightBlack: '#666666',
      brightRed: '#f44747',
      brightGreen: '#4ec9b0',
      brightYellow: '#ffcc00',
      brightBlue: '#3794ff',
      brightMagenta: '#c586c0',
      brightCyan: '#89ddff',
      brightWhite: '#ffffff'
    }
  } else {
    return {
      background: '#ffffff',
      foreground: '#333333',
      cursor: 'transparent',
      cursorAccent: 'transparent',
      selectionBackground: '#add6ff',
      selectionForeground: '#000000',
      black: '#000000',
      red: '#cd3131',
      green: '#00bc00',
      yellow: '#949800',
      blue: '#0451a5',
      magenta: '#bc05bc',
      cyan: '#0598bc',
      white: '#555555',
      brightBlack: '#666666',
      brightRed: '#cd3131',
      brightGreen: '#14ce14',
      brightYellow: '#b5ba00',
      brightBlue: '#0451a5',
      brightMagenta: '#bc05bc',
      brightCyan: '#0598bc',
      brightWhite: '#a5a5a5'
    }
  }
})

// Watch theme changes and update terminal
watch(isDark, () => {
  if (terminal.value && terminalTheme.value) {
    terminal.value.options.theme = terminalTheme.value
  }
})

// Watch height and width changes to resize terminal
// watch(
//   () => [tableHeight.value],
//   () => {
//     nextTick(() => {
//       fitAddon.value?.fit()
//     })
//   }
// )

// ANSI color codes for different log levels
const colorCodes = {
  error: '\x1b[31m', // Red
  warn: '\x1b[33m', // Yellow
  info: '\x1b[36m', // Cyan
  success: '\x1b[32m', // Green
  primary: '\x1b[35m', // Magenta
  reset: '\x1b[0m' // Reset
}

function writeToTerminal(time: string, label: string, level: string, message: string) {
  if (!terminal.value) return

  const color = colorCodes[level as keyof typeof colorCodes] || colorCodes.reset

  let line = ''
  if (props.fields.includes('time')) {
    line += `${color}[${time}]${colorCodes.reset} `
  }
  if (props.fields.includes('source')) {
    line += `${color}[${label}]${colorCodes.reset} `
  }
  if (props.fields.includes('message')) {
    // Convert file:// paths to relative paths
    const processedMessage = message.replace(/file:\/\/([^\s]+)/g, (match, path) => {
      const relativePath = window.path.relative(project.projectInfo.path, path)
      return relativePath
    })
    line += `${color}${processedMessage}${colorCodes.reset}`
  }

  terminal.value.writeln(line)
  logBuffer.push(`[${time}] [${label}] ${message}`)
}

function saveLog() {
  const content = logBuffer.join('\n')
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function udsLog({ values }: { values: any[] }) {
  values.forEach((data) => {
    const time = new Date().toLocaleTimeString()
    writeToTerminal(time, data.label, data.level, data.message.data.msg)
  })
}
function normalLog({ values }: { values: any[] }) {
  values.forEach((data) => {
    const time = new Date().toLocaleTimeString()
    writeToTerminal(time, data.label, data.level, data.message.message)
  })
}
function testLog({
  values
}: {
  values: {
    message: {
      id: string
      data: TestEvent
      method: string
    }
    level: string
    label: string
  }[]
}) {
  const data = values
  const time = new Date().toLocaleTimeString()

  for (const item of data) {
    if ((item.message.data?.data as any).name == '____ecubus_pro_test___') {
      continue
    }
    if (item.message.data.type == 'test:dequeue') {
      const key =
        item.message.data.data.name +
        ':' +
        item.message.data.data.line +
        ':' +
        item.message.data.data.column
      if (testId.value != undefined && !testId.value.includes(key)) {
        continue
      }
      writeToTerminal(
        time,
        item.message.data.data.name,
        'primary',
        `----- Test ${item.message.data.data.name} starting -----`
      )
    } else if (item.message.data.type == 'test:pass') {
      const key =
        item.message.data.data.name +
        ':' +
        item.message.data.data.line +
        ':' +
        item.message.data.data.column
      if (testId.value != undefined && !testId.value.includes(key)) {
        continue
      }
      writeToTerminal(
        time,
        item.message.data.data.name,
        'success',
        `----- Test ${item.message.data.data.name} passed, ${item.message.data.data.details.duration_ms}ms -----`
      )
    } else if (item.message.data.type == 'test:fail') {
      const key =
        item.message.data.data.name +
        ':' +
        item.message.data.data.line +
        ':' +
        item.message.data.data.column
      if (testId.value != undefined && !testId.value.includes(key)) {
        continue
      }
      const errorMessage = item.message.data.data.details.error.message
      writeToTerminal(
        time,
        item.message.data.data.name,
        'error',
        `----- Test ${item.message.data.data.name} failed, ${item.message.data.data.details.duration_ms}ms, details: ${errorMessage} -----`
      )
    } else if (item.message.data.type == 'test:diagnostic') {
      writeToTerminal(time, 'Test Diagnostic', 'info', item.message.data.data.message)
    }
  }
}

let keydownHandler: ((event: KeyboardEvent) => void) | undefined

let resizeObserver: ResizeObserver | null = null
let resizeRaf = 0

onMounted(async () => {
  // Observe container size changes to keep terminal fitted
  if (logContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to avoid ResizeObserver loop warning
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => {
        fitAddon.value?.fit()
        resizeRaf = 0
      })
    })
    resizeObserver.observe(logContainer.value)
  }
  await nextTick()

  // Initialize terminal
  terminal.value = new Terminal({
    theme: terminalTheme.value,
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    cursorBlink: false,
    cursorStyle: 'bar',
    cursorWidth: 1,
    disableStdin: true,
    convertEol: true
  })

  fitAddon.value = new FitAddon()
  terminal.value.loadAddon(fitAddon.value)

  if (terminalContainer.value) {
    terminal.value.open(terminalContainer.value)

    // Load canvas addon for better performance
    canvasAddon.value = new CanvasAddon()
    terminal.value.loadAddon(canvasAddon.value)

    fitAddon.value.fit()

    // Enable keyboard shortcuts on document level
    keydownHandler = (event: KeyboardEvent) => {
      // Check if focus is in terminal area or if terminal has selection
      const isInTerminal = terminalContainer.value?.contains(document.activeElement)
      const hasSelection = terminal.value?.hasSelection()

      if (!isInTerminal && !hasSelection) return

      const isCtrlOrCmd = event.ctrlKey || event.metaKey

      // Ctrl+C or Cmd+C to copy selection
      if (isCtrlOrCmd && event.key === 'c') {
        const selection = terminal.value?.getSelection()
        if (selection) {
          event.preventDefault()
          event.stopPropagation()
          navigator.clipboard.writeText(selection)
        }
      }
      // Ctrl+A or Cmd+A to select all (only when focus is in terminal)
      else if (isCtrlOrCmd && event.key === 'a' && isInTerminal) {
        event.preventDefault()
        event.stopPropagation()
        terminal.value?.selectAll()
      }
    }

    // Add listener to document to capture all keyboard events
    document.addEventListener('keydown', keydownHandler, true)

    // Auto focus terminal when clicked
    terminalContainer.value.addEventListener('click', () => {
      terminalContainer.value?.focus()
    })
  }

  if (props.captureSystem) {
    window.logBus.on('ipc-log-main', normalLog)
  }
  if (props.captureTest) {
    window.logBus.on('testInfo', testLog)
  }
  window.logBus.on(props.prefix + 'udsSystem', udsLog)
  window.logBus.on(props.prefix + 'udsScript', udsLog)
  window.logBus.on(props.prefix + 'udsWarning', udsLog)
})

onUnmounted(() => {
  // Clean up event listeners first
  if (props.captureSystem) {
    window.logBus.off('ipc-log-main', normalLog)
  }
  if (props.captureTest) {
    window.logBus.off('testInfo', testLog)
  }
  window.logBus.off(props.prefix + 'udsSystem', udsLog)
  window.logBus.off(props.prefix + 'udsScript', udsLog)
  window.logBus.off(props.prefix + 'udsWarning', udsLog)

  // Remove keyboard event listener from document
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler, true)
  }

  // Disconnect resize observer and cancel pending animation frame
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  // Safely dispose terminal (which will dispose all loaded addons)
  if (terminal.value) {
    terminal.value.dispose()
  }
})
</script>

<style scoped>
.log-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.toolbar {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 2px;
  margin-left: 5px;
  padding: 2px;
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
}

.terminal-container {
  flex: 1;
  width: 100%;
  overflow: hidden;
  outline: none;
  cursor: text;
}

:deep(.xterm) {
  height: v-bind(tableHeight + 'px');
  padding: 8px;
}

:deep(.xterm .xterm-cursor-layer) {
  display: none !important;
}
</style>
