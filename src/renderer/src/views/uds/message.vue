<template>
  <div ref="logContainer" class="log-container">
    <div class="toolbar">
      <el-button-group>
        <el-tooltip
          effect="light"
          :content="i18next.t('uds.message.tooltips.clearMessage')"
          placement="bottom"
        >
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
            <el-dropdown-item>{{ i18next.t('uds.message.actions.saveMessage') }}</el-dropdown-item>
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
import { Terminal, IDecoration, IMarker } from '@xterm/xterm'
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
import i18next from 'i18next'
import {
  beginTestLogEntry,
  createTestLogSeparatorState,
  currentTestLogIndent,
  endTestLogEntry,
  findOpenTestLogId,
  openTestLogFrames,
  resetTestLogSeparator
} from './testLogSeparator'
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
const testSeparator = createTestLogSeparatorState()

interface LogRow {
  marker: IMarker
  decoration?: IDecoration
}

interface LogBlock {
  id: string
  band: boolean
  shade: number
  rows: LogRow[]
  coveredEnd: number
}

const logBlocks = new Map<string, LogBlock>()
const hoverDecorations: IDecoration[] = []
let hoveredTestId: string | null = null
let nextBandShade = 0
let writeChain: Promise<void> = Promise.resolve()
let writeGeneration = 0

const bandColors = {
  dark: ['rgba(126, 178, 220, 0.18)', 'rgba(214, 176, 108, 0.16)'],
  light: ['rgba(70, 130, 180, 0.16)', 'rgba(180, 140, 60, 0.14)']
}
const railColors = {
  dark: ['#7eb6e0', '#e0c07a'],
  light: ['#3d7eae', '#b8893a']
}
const hoverColors = {
  dark: 'rgba(90, 170, 255, 0.32)',
  light: 'rgba(40, 120, 220, 0.22)'
}

function bufferLine() {
  const buffer = terminal.value?.buffer.active
  if (!buffer) return 0
  return buffer.baseY + buffer.cursorY
}

function disposeHover() {
  for (const decoration of hoverDecorations) decoration.dispose()
  hoverDecorations.length = 0
}

function decorateRow(marker: IMarker, color: string, first: boolean, hover = false, rail = '') {
  if (!terminal.value || marker.isDisposed) return undefined
  const decoration = terminal.value.registerDecoration({
    marker,
    x: 0,
    width: Math.max(terminal.value.cols, 1),
    height: 1,
    layer: 'bottom'
  })
  decoration?.onRender((element) => {
    element.style.pointerEvents = 'none'
    element.style.background = color
    const edge = rail || (isDark.value ? '#8ec7ff' : '#2f6fed')
    element.style.boxShadow = hover
      ? `inset 3px 0 0 ${edge}`
      : first
        ? `inset 3px 0 0 ${edge}, inset 0 1px 0 rgba(255,255,255,0.35)`
        : `inset 3px 0 0 ${edge}`
  })
  return decoration
}

function bandPaint(shade: number) {
  const theme = isDark.value ? 'dark' : 'light'
  return {
    color: bandColors[theme][shade % 2],
    rail: railColors[theme][shade % 2]
  }
}

function paintBlock(block: LogBlock) {
  if (!block.band || block.shade < 0) return
  const paint = bandPaint(block.shade)
  block.rows.forEach((row, index) => {
    row.decoration?.dispose()
    row.decoration = decorateRow(row.marker, paint.color, index === 0, false, paint.rail)
  })
}

function ensureBlock(id: string, band: boolean) {
  let block = logBlocks.get(id)
  if (!block) {
    block = {
      id,
      band,
      shade: band ? nextBandShade++ : -1,
      rows: [],
      coveredEnd: -1
    }
    logBlocks.set(id, block)
  }
  return block
}

function extendBlock(id: string, band: boolean, start: number, end: number) {
  if (!terminal.value || end < start) return
  const block = ensureBlock(id, band)
  const from = block.coveredEnd < 0 ? start : block.coveredEnd + 1
  const cursor = bufferLine()
  for (let line = from; line <= end; line++) {
    const marker = terminal.value.registerMarker(line - cursor)
    if (!marker || marker.isDisposed) continue
    const row: LogRow = { marker }
    if (block.band && block.shade >= 0) {
      const paint = bandPaint(block.shade)
      try {
        row.decoration = decorateRow(
          marker,
          paint.color,
          block.rows.length === 0,
          false,
          paint.rail
        )
      } catch {
        row.decoration = undefined
      }
    }
    block.rows.push(row)
  }
  if (end > block.coveredEnd) block.coveredEnd = end
}

function promoteBlock(id: string) {
  const block = logBlocks.get(id)
  if (!block || block.band) return
  block.band = true
  block.shade = nextBandShade++
  paintBlock(block)
}

function repaintBands() {
  const hovered = hoveredTestId
  disposeHover()
  hoveredTestId = null
  for (const block of logBlocks.values()) paintBlock(block)
  if (hovered) highlightTest(hovered)
}

function disposeBlocks() {
  disposeHover()
  hoveredTestId = null
  for (const block of logBlocks.values()) {
    for (const row of block.rows) {
      row.decoration?.dispose()
      row.marker.dispose()
    }
  }
  logBlocks.clear()
  nextBandShade = 0
}

function highlightTest(id: string | null) {
  const previous = hoveredTestId
  disposeHover()
  hoveredTestId = null
  if (previous) {
    for (const block of logBlocks.values()) paintBlock(block)
  }
  if (!id) return
  const block = logBlocks.get(id)
  if (!block) return
  hoveredTestId = id
  const lines = new Set(block.rows.map((row) => row.marker.line))
  for (const other of logBlocks.values()) {
    for (const row of other.rows) {
      if (row.decoration && lines.has(row.marker.line)) {
        row.decoration.dispose()
        row.decoration = undefined
      }
    }
  }
  const color = isDark.value ? hoverColors.dark : hoverColors.light
  const rail = isDark.value ? '#b9dcff' : '#1d4f91'
  block.rows.forEach((row, index) => {
    const decoration = decorateRow(row.marker, color, index === 0, true, rail)
    if (decoration) hoverDecorations.push(decoration)
  })
}

function clearLog() {
  writeGeneration++
  writeChain = Promise.resolve()
  disposeBlocks()
  terminal.value?.clear()
  logBuffer.length = 0
  resetTestLogSeparator(testSeparator)
}

const props = withDefaults(
  defineProps<{
    height: number
    width: number
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
  getData,
  highlightTest
})

watch(globalStart, (val) => {
  if (val) {
    clearLog()
  }
})
const tableHeight = toRef(props, 'height')
const tableWidth = toRef(props, 'width')
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
    repaintBands()
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

function indentLogMessage(message: string) {
  const spaces = props.captureTest ? currentTestLogIndent(testSeparator) : 0
  if (spaces <= 0) return message
  const pad = ' '.repeat(spaces)
  return message
    .split('\n')
    .map((line) => pad + line)
    .join('\n')
}

function writeToTerminal(time: string, label: string, level: string, message: string) {
  if (!terminal.value) return

  const color = colorCodes[level as keyof typeof colorCodes] || colorCodes.reset
  const owned = props.captureTest
    ? openTestLogFrames(testSeparator).map((frame) => ({ ...frame }))
    : []

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
    line += `${color}${indentLogMessage(processedMessage)}${colorCodes.reset}`
  }

  logBuffer.push(`[${time}] [${label}] ${indentLogMessage(message)}`)
  // xterm parses writes asynchronously, so the cursor only moves in the callback.
  const generation = writeGeneration
  writeChain = writeChain.then(
    () =>
      new Promise((resolve) => {
        if (!terminal.value || generation !== writeGeneration) {
          resolve()
          return
        }
        const start = bufferLine()
        terminal.value.writeln(line, () => {
          if (generation !== writeGeneration) {
            resolve()
            return
          }
          const end = bufferLine() - 1
          for (const frame of owned) extendBlock(frame.id, frame.band, start, end)
          if (hoveredTestId) highlightTest(hoveredTestId)
          resolve()
        })
      })
  )
}

function afterTerminalWrite(fn: () => void) {
  const generation = writeGeneration
  writeChain = writeChain.then(() => {
    if (generation !== writeGeneration) return
    fn()
  })
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
      const payload = item.message.data.data
      const begun = beginTestLogEntry(testSeparator, payload)
      const hidden = testId.value != undefined && !testId.value.includes(begun.id)
      if (hidden) continue
      writeToTerminal(
        time,
        payload.name,
        'primary',
        i18next.t('uds.message.testLog.testStarting', { name: payload.name })
      )
    } else if (item.message.data.type == 'test:pass') {
      const payload = item.message.data.data
      const openId = findOpenTestLogId(testSeparator, payload)
      const hidden =
        testId.value != undefined && (openId == undefined || !testId.value.includes(openId))
      if (!hidden) {
        if (payload.skip) {
          writeToTerminal(
            time,
            payload.name,
            'warning',
            i18next.t('uds.message.testLog.testSkipped', {
              name: payload.name,
              duration: payload.details.duration_ms
            })
          )
        } else {
          writeToTerminal(
            time,
            payload.name,
            'success',
            i18next.t('uds.message.testLog.testPassed', {
              name: payload.name,
              duration: payload.details.duration_ms
            })
          )
        }
      }
      const ended = endTestLogEntry(testSeparator, payload)
      if (ended?.promoteBand) afterTerminalWrite(() => promoteBlock(ended.id))
    } else if (item.message.data.type == 'test:fail') {
      const payload = item.message.data.data
      const openId = findOpenTestLogId(testSeparator, payload)
      const hidden =
        testId.value != undefined && (openId == undefined || !testId.value.includes(openId))
      if (!hidden) {
        const errorMessage = payload.details.error.message
        writeToTerminal(
          time,
          payload.name,
          'error',
          i18next.t('uds.message.testLog.testFailed', {
            name: payload.name,
            duration: payload.details.duration_ms,
            error: errorMessage
          })
        )
      }
      const ended = endTestLogEntry(testSeparator, payload)
      if (ended?.promoteBand) afterTerminalWrite(() => promoteBlock(ended.id))
    } else if (item.message.data.type == 'test:diagnostic') {
      writeToTerminal(
        time,
        i18next.t('uds.message.testLog.testDiagnostic'),
        'info',
        item.message.data.data.message
      )
    }
  }
}

let keydownHandler: ((event: KeyboardEvent) => void) | undefined
let resizeListener: { dispose: () => void } | undefined

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
    allowProposedApi: true,
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
    resizeListener = terminal.value.onResize(() => {
      repaintBands()
    })

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

  disposeBlocks()
  resizeListener?.dispose()

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
