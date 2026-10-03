import { createApp, h, ref } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import i18next from 'i18next'
import FreePanelEditor from '../../src/renderer/src/views/uds/panel/free/FreePanelEditor.vue'
import {
  createControl,
  createDocument,
  labelPositions
} from '../../src/renderer/src/views/uds/panel/free/model'
import type { PanelDocument } from '../../src/preload/panel'
import { createPinia } from 'pinia'
import mitt from 'mitt'
import { VxeLoading, VxeTooltip } from 'vxe-pc-ui'
import { VxeUI } from 'vxe-table'
import enUS from 'vxe-pc-ui/lib/language/en-US'
import 'vxe-table/lib/style.css'
import 'vxe-pc-ui/lib/style.css'
import { useDataStore } from '../../src/renderer/src/stores/data'
import { useRuntimeStore } from '../../src/renderer/src/stores/runtime'
import FreePanelView from '../../src/renderer/src/views/uds/panel/free/FreePanelView.vue'
import translations from '../../resources/locales/en/translation.json'
import galleryImage from '../../resources/icon.png'
import type { DataSet } from '../../src/preload/data'

// Standalone interaction fixture; intentionally has no Electron IPC or hardware connection.
await i18next.init({
  lng: 'zh',
  fallbackLng: 'en',
  resources: { en: { translation: translations } }
})
const params = new URLSearchParams(location.search)
if (params.has('dark')) document.documentElement.classList.add('dark')
VxeUI.setTheme(params.has('dark') ? 'dark' : 'default')
if (params.has('en')) await i18next.changeLanguage('en')
VxeUI.setI18n('en-US', enUS)
VxeUI.setLanguage('en-US')
const pinia = createPinia()
const data = useDataStore(pinia)
data.vars.level = {
  id: 'level',
  type: 'user',
  name: 'Level',
  value: { type: 'number', min: 0, max: 100, unit: '%', initValue: 0 }
}
if (params.has('sources')) {
  data.vars.state = {
    id: 'state',
    name: 'State',
    type: 'user',
    value: { type: 'string', initValue: 'Ready' }
  }
  data.database.can.demo = {
    name: 'Demo',
    messages: [
      {
        id: 256,
        name: 'Vehicle',
        signals: [{ name: 'Speed', start_bit: 0, bit_length: 16, values: {} }]
      }
    ]
  } as unknown as DataSet['database']['can'][string]
}
const runtime = useRuntimeStore(pinia)
window.logBus = mitt()
window.store = { get: () => 'en' } as unknown as typeof window.store
const writes = ref<string[]>([])
window.electron = {
  ipcRenderer: {
    send: (channel: string, payload: { name: string; value: number }) => {
      writes.value.push(`${channel} ${payload.name}=${payload.value}`)
      window.logBus.emit('level', { key: 'level', values: [[0, { rawValue: payload.value }]] })
    }
  }
} as unknown as typeof window.electron
const initial = createDocument()
initial.controls = [
  { ...createControl('display', 'speed', '车速', 32, 32), unit: 'km/h', initialValue: 80 },
  { ...createControl('led', 'ignition', '点火状态', 224, 32), initialValue: 1 },
  { ...createControl('switch', 'power', '电源', 384, 32), initialValue: 1 },
  { ...createControl('progress', 'charge', '电量', 32, 304), initialValue: 65, unit: '%' },
  {
    ...createControl('gauge', 'temperature', '温度', 304, 304),
    initialValue: 80,
    min: -40,
    max: 120,
    unit: '°C'
  },
  createControl('image', 'picture', '图片', 512, 304),
  { ...createControl('button', 'start', '启动', 32, 128), height: 40 },
  { ...createControl('slider', 'dimmer', '亮度', 224, 112), initialValue: 40 },
  { ...createControl('number', 'target', '目标值', 32, 208), initialValue: 30 },
  {
    ...createControl('select', 'mode', '模式', 224, 208),
    options: [
      { label: '关闭', value: 0 },
      { label: '自动', value: 1 }
    ]
  }
]
if (params.has('containers')) {
  const group = createControl('group', 'system', '电源控制', 32, 32)
  const tabs = {
    ...createControl('tabs', 'pages', '车辆状态', 384, 32),
    width: 360,
    height: 320,
    tabs: [
      { id: 'overview', label: '概览' },
      { id: 'details', label: '详情' }
    ],
    defaultTabId: 'overview'
  }
  initial.controls = [
    group,
    tabs,
    { ...createControl('switch', 'power', '电源', 16, 16), parentId: group.id, initialValue: 1 },
    { ...createControl('button', 'start', '启动', 16, 64), parentId: group.id, height: 32 },
    {
      ...createControl('group', 'readings', '传感器', 16, 16),
      parentId: tabs.id,
      tabId: 'overview',
      width: 320,
      height: 200
    },
    {
      ...createControl('progress', 'charge', '电量', 16, 16),
      parentId: 'readings',
      initialValue: 65,
      unit: '%'
    },
    {
      ...createControl('display', 'detail', '实时数值', 16, 16),
      parentId: tabs.id,
      tabId: 'details',
      initialValue: 80
    },
    {
      ...createControl('button', 'detail-button', '点动', 16, 96),
      parentId: tabs.id,
      tabId: 'details',
      height: 32
    }
  ]
}
if (params.has('gallery')) {
  initial.height = 600
  initial.controls = [
    {
      ...createControl('text', 'text', '文本 · 车辆控制面板', 24, 24),
      width: 232,
      height: 64,
      fontSize: 18
    },
    {
      ...createControl('display', 'value', '数值显示 · 车速', 280, 24),
      width: 232,
      initialValue: 88,
      unit: 'km/h'
    },
    {
      ...createControl('number', 'input', '数值输入 · 目标转速', 536, 24),
      width: 232,
      initialValue: 1500,
      max: 8000,
      step: 100
    },
    { ...createControl('button', 'button', '按钮 · 启动', 24, 120), width: 232, height: 40 },
    { ...createControl('switch', 'switch', '开关', 288, 124), initialValue: 1 },
    { ...createControl('led', 'led', '指示灯', 544, 124), initialValue: 1 },
    { ...createControl('slider', 'slider', '滑块 · 亮度', 24, 184), width: 232, initialValue: 60 },
    {
      ...createControl('select', 'select', '枚举选择 · 模式', 280, 184),
      width: 232,
      initialValue: 1,
      options: [
        { label: '手动', value: 0 },
        { label: '自动', value: 1 }
      ]
    },
    {
      ...createControl('progress', 'progress', '进度条 · 电量', 536, 192),
      width: 232,
      initialValue: 72,
      unit: '%'
    },
    {
      ...createControl('gauge', 'gauge', '仪表 · 温度', 24, 280),
      width: 232,
      height: 160,
      initialValue: 80,
      min: -40,
      max: 120,
      unit: '°C'
    },
    { ...createControl('text', 'image-label', '图片', 280, 280), height: 24 },
    {
      ...createControl('image', 'image', '图片', 320, 312),
      width: 136,
      height: 120,
      imageSrc: galleryImage
    },
    { ...createControl('group', 'group', '分组 · 灯光控制', 536, 280), width: 232, height: 160 },
    {
      ...createControl('switch', 'group-switch', '近光灯', 16, 16),
      parentId: 'group',
      initialValue: 1
    },
    { ...createControl('led', 'group-led', '远光灯', 16, 64), parentId: 'group' },
    {
      ...createControl('tabs', 'tabs', '标签页', 24, 464),
      width: 744,
      height: 112,
      tabs: [
        { id: 'overview', label: '标签页 · 概览' },
        { id: 'details', label: '详情' },
        { id: 'alarms', label: '告警' }
      ],
      defaultTabId: 'overview'
    },
    {
      ...createControl('display', 'tabs-value', '运行时间', 16, 8),
      parentId: 'tabs',
      tabId: 'overview',
      initialValue: 128,
      unit: 's'
    },
    {
      ...createControl('progress', 'tabs-progress', '任务进度', 256, 16),
      parentId: 'tabs',
      tabId: 'overview',
      initialValue: 45,
      unit: '%'
    }
  ]
}
if (params.has('labels')) {
  initial.width = 800
  initial.height = 400
  initial.controls = labelPositions.flatMap((position, index) => {
    const x = 24 + (index % 3) * 256
    const y = 24 + Math.floor(index / 3) * 176
    const title = createControl(
      'text',
      `title-${position}`,
      ['上', '下', '左', '右', '居中', '不显示'][index],
      x,
      y
    )
    return [
      title,
      ...(['switch', 'led', 'progress'] as const).map((type, row) => ({
        ...createControl(
          type,
          `${type}-${position}`,
          { switch: '电源', led: '连接状态', progress: '电量' }[type],
          x,
          y + 36 + row * 36
        ),
        width: 216,
        labelPosition: position,
        initialValue: type === 'progress' ? 65 : 1,
        unit: type === 'progress' ? '%' : ''
      }))
    ]
  })
}

if (params.has('runtime'))
  initial.controls.forEach((control) => {
    if (['group', 'tabs', 'image'].includes(control.type)) return
    control.binding = {
      kind: 'variable',
      node: {
        id: 'level',
        name: 'Level',
        type: 'variable',
        color: '',
        enable: true,
        bindValue: {
          variableId: 'level',
          variableName: 'Level',
          variableFullName: 'Level',
          variableType: 'user',
          variableValueType: 'number'
        }
      }
    }
  })
createApp({
  setup() {
    const document = ref(initial)
    const name = ref('控制面板')
    return () =>
      params.has('runtime')
        ? h('div', [
            h(
              'button',
              {
                onClick: () => {
                  runtime.globalStart = !runtime.globalStart
                }
              },
              'Start / Stop'
            ),
            h(
              'button',
              {
                onClick: () =>
                  window.logBus.emit('level', { key: 'level', values: [[0, { rawValue: 42 }]] })
              },
              'Receive 42'
            ),
            h(FreePanelView, { document: document.value, height: 500 }),
            h('output', writes.value.join('\n'))
          ])
        : h(FreePanelEditor, {
            initialDocument: document.value,
            initialName: name.value,
            height: window.innerHeight,
            onSave: (nextName: string, next: PanelDocument) => {
              document.value = next
              name.value = nextName
            }
          })
  }
})
  .use(ElementPlus)
  .use(pinia)
  .use(VxeTooltip)
  .use(VxeLoading)
  .mount('#app')
