import { createRequire } from 'module'
import { defineConfig, type DefaultTheme } from 'vitepress'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

export const zh = defineConfig({
  lang: 'zh-Hans',
  description: '一个强大的汽车ECU开发工具',
  themeConfig: {
    nav: nav(),
    sidebar: sidebar(),
    editLink: {
      pattern: 'https://github.com/ecubus/EcuBus-Pro/edit/master/:path',
      text: '在 GitHub 上编辑此页面'
    },
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    outline: {
      label: '页面导航',
      level: [2, 4]
    },
    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium'
      }
    },
    langMenuLabel: '多语言',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    skipToContentLabel: '跳转到内容'
  }
})

function nav(): DefaultTheme.NavItem[] {
  return [
    {
      text: pkg.version,
      items: [
        {
          text: '更新日志',
          link: 'https://github.com/ecubus/EcuBus-Pro/blob/master/docs/dev/releases_note.md'
        }
      ]
    },
    {
      text: '脚本API',
      link: 'https://app.whyengineer.com/scriptApi/index.html'
    }
  ]
}

function sidebar(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: '关于',
      items: [
        { text: '介绍', link: '/zh/' },
        { text: '安装', link: '/zh/docs/about/install' },
        { text: '赞助 ❤️', link: '/zh/docs/about/sponsor' },
        { text: '联系', link: '/zh/docs/about/contact' }
      ]
    },
    {
      text: '用户手册',
      items: [
        {
          text: 'EcuBus的硬件',
          link: '/zh/docs/um/hardware/index',
          items: [{ text: 'LinCable', link: '/zh/docs/um/hardware/lincable' }]
        },
        { text: 'CAN', link: '/zh/docs/um/can/can' },
        { text: 'LIN', link: '/zh/docs/um/lin/lin' },
        { text: 'PWM', link: '/zh/docs/um/pwm/pwm' },
        { text: 'Network', items: [{ text: '日志记录器', link: '/zh/docs/um/network/logger' }] },
        { text: '命令行', link: '/zh/docs/um/cli/cli' },
        {
          text: '以太网',
          items: [
            {
              text: 'DoIP',
              link: '/zh/docs/um/doip/doip',
              items: [
                {
                  text: 'VIN请求行为',
                  link: '/zh/docs/um/doip/vin'
                }
              ]
            }
          ]
        },
        { text: 'SOME/IP', link: '/zh/docs/um/someip/index' },
        { text: 'OSEK OS Trace', link: '/zh/docs/um/osTrace/index' },
        {
          text: '诊断',
          items: [
            {
              text: '内建脚本',
              link: '/zh/docs/um/uds/buildInScript/buildInScript'
            },
            {
              text: '会话保持',
              link: '/zh/docs/um/uds/testerPresent/testerPresent'
            },
            {
              text: 'UDS转C代码',
              link: '/zh/docs/um/uds/udscode/udscode'
            },
            {
              text: 'UDS Bootloader实现指南',
              link: '/zh/docs/um/uds/example/example'
            }
          ]
        },
        { text: 'Trace', link: '/zh/docs/um/trace/trace' },
        { text: '图表', link: '/zh/docs/um/graph/graph' },
        { text: '变量', link: '/zh/docs/um/var/var' },
        {
          text: '脚本',
          link: '/zh/docs/um/script/script',
          items: [
            { text: '使用外部包', link: '/zh/docs/um/script/SerialPort/scriptSerialPort' },
            { text: 'CAPL转为TS', link: '/zh/docs/um/script/capl2ts/capl2ts' }
          ]
        },
        {
          text: '测试',
          link: '/zh/docs/um/test/test'
        },
        {
          text: '数据库',
          link: '/zh/docs/um/database/database',
          items: [
            { text: 'LIN LDF', link: '/zh/docs/um/database/ldf/ldf' },
            { text: 'CAN DBC', link: '/zh/docs/um/database/dbc/dbc' }
          ]
        },
        {
          text: '面板',
          link: '/zh/docs/um/panel/index'
        },
        {
          text: '设置',
          items: [{ text: '通用', link: '/zh/docs/um/setting/general' }]
        },
        {
          text: '常见问题',
          link: '/zh/docs/faq/index'
        }
      ]
    },
    {
      text: '示例',
      base: '/zh/examples/',
      items: [
        {
          text: 'CAN',
          items: [
            { text: 'CAN基础功能', link: 'can/readme' },
            { text: 'CAN高精度定时器', link: 'can_timer/readme' },
            { text: 'NXP UDS Bootloader', link: 'nxp_bootloader/readme' }
          ],
          collapsed: true
        },
        {
          text: 'LIN',
          items: [
            { text: 'LIN基本功能', link: 'lin/readme' },
            { text: 'LIN TP', link: 'lin_tp/readme' },
            { text: 'LIN一致性测试', link: 'lin_conformance_test/readme' },
            { text: 'LIN SAE J2602 Test', link: 'lin_j2602_test/readme' },
            { text: 'LIN OTA', link: 'NSUC1612_LIN_OTA/readme.md' },
            { text: 'LIN 自动寻址', link: 'lin_aa/readme.md' }
          ],
          collapsed: true
        },
        {
          text: 'DOIP',
          items: [
            { text: 'DoIP Tester', link: 'doip/readme' },
            { text: 'DoIP Simulate Entity', link: 'doip_sim_entity/readme' },
            { text: 'DoIP Gateway', link: 'doip_gateway/readme' }
          ],
          collapsed: true
        },
        {
          text: 'UDS',
          items: [
            { text: 'UDS Hex/S19 文件', link: 'uds_hex_s19_file/readme' },
            { text: 'UDS Binary 文件', link: 'uds_bin_file/readme' },
            { text: '用于安全访问的dll', link: 'secure_access_dll/readme' },
            { text: 'UDS 代码生成', link: 'uds_generate_code/readme' },
            { text: 'UDS 认证服务(0x29)', link: 'uds_0x29/readme' },
            { text: 'UDS 安全访问(0x27)', link: 'uds_0x27/readme' },
            { text: 'UDS DoIP 大文件传输', link: 'uds_doip_large_file/readme' }
          ],
          collapsed: true
        },
        {
          text: 'Test',
          items: [{ text: 'Test Simple', link: 'test_simple/readme' }],
          collapsed: true
        },
        {
          text: 'Panel',
          link: 'panel/readme',
          collapsed: true
        },
        {
          text: 'SOME/IP',
          items: [{ text: '请求/响应', link: 'someip/readme.md' }],
          collapsed: true
        }
      ]
    },
    {
      text: '开发文档',
      collapsed: true,
      items: [{ text: '如何开发文档', link: '/zh/docs/dev/doc.md' }]
    },
    {
      text: '开发者手册',
      collapsed: true,
      items: [
        { text: '架构', link: '/zh/docs/dev/arch.md' },
        {
          text: '安装/配置',
          link: '/zh/docs/dev/setup.md',
          items: [
            {
              text: '学习资源',
              link: '/zh/docs/dev/jslearn.md'
            },
            { text: '开发新适配器', link: '/zh/docs/dev/adapter.md' }
          ]
        },
        { text: '组件测试', link: '/zh/docs/dev/test.md' },
        { text: '插件开发', link: '/zh/docs/dev/addon.md' },
        { text: '功能请求流程', link: '/zh/docs/dev/feature.md' },
        { text: '发布说明', link: '/zh/docs/dev/releases_note.md' }
      ]
    }
  ]
}

export const search: DefaultTheme.AlgoliaSearchOptions['locales'] = {
  zh: {
    placeholder: '搜索文档',
    translations: {
      button: {
        buttonText: '搜索文档',
        buttonAriaLabel: '搜索文档'
      },
      modal: {
        searchBox: {
          resetButtonTitle: '清除查询条件',
          resetButtonAriaLabel: '清除查询条件',
          cancelButtonText: '取消',
          cancelButtonAriaLabel: '取消'
        },
        startScreen: {
          recentSearchesTitle: '搜索历史',
          noRecentSearchesText: '没有搜索历史',
          saveRecentSearchButtonTitle: '保存至搜索历史',
          removeRecentSearchButtonTitle: '从搜索历史中移除',
          favoriteSearchesTitle: '收藏',
          removeFavoriteSearchButtonTitle: '从收藏中移除'
        },
        errorScreen: {
          titleText: '无法获取结果',
          helpText: '你可能需要检查你的网络连接'
        },
        footer: {
          selectText: '选择',
          navigateText: '切换',
          closeText: '关闭',
          searchByText: '搜索提供者'
        },
        noResultsScreen: {
          noResultsText: '无法找到相关结果',
          suggestedQueryText: '你可以尝试查询',
          reportMissingResultsText: '你认为该查询应该有结果？',
          reportMissingResultsLinkText: '点击反馈'
        }
      }
    }
  }
}
