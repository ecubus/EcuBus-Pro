import { createRequire } from 'module'
import { defineConfig, type DefaultTheme } from 'vitepress'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

export const en = defineConfig({
  lang: 'en-US',
  description: 'A powerful automotive ECU development tool',
  themeConfig: {
    nav: nav(),
    sidebar: sidebar(),
    editLink: {
      pattern: 'https://github.com/ecubus/EcuBus-Pro/edit/master/:path',
      text: 'Edit this page on GitHub'
    },
    docFooter: {
      prev: 'Previous',
      next: 'Next'
    },
    outline: {
      label: 'Page Navigation',
      level: [2, 4]
    },
    lastUpdated: {
      text: 'Last Updated',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium'
      }
    },
    langMenuLabel: 'Language',
    returnToTopLabel: 'Return to Top',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Theme',
    lightModeSwitchTitle: 'Switch to Light Mode',
    darkModeSwitchTitle: 'Switch to Dark Mode',
    skipToContentLabel: 'Skip to Content'
  }
})

function nav(): DefaultTheme.NavItem[] {
  return [
    {
      text: pkg.version,
      items: [
        {
          text: 'Changelog',
          link: 'https://github.com/ecubus/EcuBus-Pro/blob/master/docs/dev/releases_note.md'
        }
      ]
    },
    {
      text: 'Script API',
      link: 'https://app.whyengineer.com/scriptApi/index.html'
    }
  ]
}

function sidebar(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'About',
      items: [
        { text: 'Introduce', link: '/' },
        { text: 'Install', link: '/docs/about/install' },
        { text: 'Sponsor ❤️', link: '/docs/about/sponsor' },
        { text: 'Contact', link: '/docs/about/contact' }
      ]
    },
    {
      text: 'User Manual',
      items: [
        {
          text: 'EcuBus Hardware',
          link: '/docs/um/hardware/index.md',
          items: [{ text: 'LinCable', link: '/docs/um/hardware/lincable.md' }]
        },
        { text: 'CAN', link: '/docs/um/can/can.md' },
        { text: 'LIN', link: '/docs/um/lin/lin.md' },
        { text: 'PWM', link: '/docs/um/pwm/pwm.md' },
        { text: 'Network', items: [{ text: 'Logger', link: '/docs/um/network/logger.md' }] },
        { text: 'CLI', link: '/docs/um/cli/cli.md' },
        {
          text: 'Ethernet',
          items: [
            {
              text: 'DoIP',
              link: '/docs/um/doip/doip.md',
              items: [
                {
                  text: 'VIN Request Behavior',
                  link: '/docs/um/doip/vin.md'
                }
              ]
            }
          ]
        },
        { text: 'SOME/IP', link: '/docs/um/someip/index.md' },
        { text: 'OSEK OS Tracking', link: '/docs/um/osTrace/index.md' },
        {
          text: 'Diagnostic',
          items: [
            {
              text: 'Build In Script',
              link: '/docs/um/uds/buildInScript/buildInScript.md'
            },
            {
              text: 'Tester Present',
              link: '/docs/um/uds/testerPresent/testerPresent.md'
            },
            {
              text: 'UDS -> C Code',
              link: '/docs/um/uds/udscode/udscode.md'
            },
            {
              text: 'UDS Bootloader Implementation Guide',
              link: '/docs/um/uds/example/example.md'
            }
          ]
        },
        { text: 'Trace', link: '/docs/um/trace/trace.md' },
        { text: 'Graph', link: '/docs/um/graph/graph.md' },
        { text: 'Variable', link: '/docs/um/var/var.md' },
        {
          text: 'Script',
          link: '/docs/um/script/script.md',
          items: [
            {
              text: 'Use External Package',
              link: '/docs/um/script/SerialPort/scriptSerialPort.md'
            },
            { text: 'CAPL->TS', link: '/docs/um/script/capl2ts/capl2ts.md' }
          ]
        },
        {
          text: 'Test',
          link: '/docs/um/test/test.md'
        },
        {
          text: 'Database',
          link: '/docs/um/database/database.md',
          items: [
            { text: 'LIN LDF', link: '/docs/um/database/ldf/ldf.md' },
            { text: 'CAN DBC', link: '/docs/um/database/dbc/dbc.md' }
          ]
        },
        {
          text: 'Panel',
          link: '/docs/um/panel/index.md'
        },
        {
          text: 'Setting',
          items: [{ text: 'General', link: '/docs/um/setting/general.md' }]
        },
        {
          text: 'FAQ',
          link: '/docs/faq/index.md'
        }
      ]
    },
    {
      text: 'Example',
      base: '/examples/',
      items: [
        {
          text: 'CAN',
          items: [
            { text: 'CAN Basic', link: 'can/readme' },
            { text: 'CAN High-Precision Timer', link: 'can_timer/readme.md' },
            { text: 'NXP UDS Bootloader', link: 'nxp_bootloader/readme.md' }
          ],
          collapsed: true
        },
        {
          text: 'LIN',
          items: [
            { text: 'LIN General', link: 'lin/readme.md' },
            { text: 'LIN TP', link: 'lin_tp/readme.md' },
            { text: 'LIN Conformance Test', link: 'lin_conformance_test/readme.md' },
            { text: 'LIN SAE J2602 Test', link: 'lin_j2602_test/readme.md' },
            { text: 'LIN OTA', link: 'NSUC1612_LIN_OTA/readme.md' },
            { text: 'LIN Auto Addressing', link: 'lin_aa/readme.md' }
          ],
          collapsed: true
        },
        {
          text: 'DOIP',
          items: [
            { text: 'DoIP Tester', link: 'doip/readme.md' },
            { text: 'DoIP Simulate Entity', link: 'doip_sim_entity/readme.md' },
            { text: 'DoIP Gateway', link: 'doip_gateway/readme.md' }
          ],
          collapsed: true
        },
        {
          text: 'UDS',
          items: [
            { text: 'UDS Hex/S19 File', link: 'uds_hex_s19_file/readme.md' },
            { text: 'UDS Binary File', link: 'uds_bin_file/readme.md' },
            { text: 'Secure Access dll', link: 'secure_access_dll/readme.md' },
            { text: 'UDS Code Generate', link: 'uds_generate_code/readme.md' },
            { text: 'UDS Authentication Service(0x29)', link: 'uds_0x29/readme.md' },
            { text: 'UDS Security Access(0x27)', link: 'uds_0x27/readme.md' },
            { text: 'UDS DoIP Large File', link: 'uds_doip_large_file/readme.md' }
          ],
          collapsed: true
        },
        {
          text: 'Test',
          items: [{ text: 'Test Simple', link: 'test_simple/readme.md' }],
          collapsed: true
        },
        {
          text: 'Panel',
          link: 'panel/readme.md',
          collapsed: true
        },
        {
          text: 'SOME/IP',
          items: [{ text: 'Request/Response', link: 'someip/readme.md' }],
          collapsed: true
        }
      ]
    },
    {
      text: 'Development Docs',
      collapsed: true,
      items: [{ text: 'How to Development Docs', link: '/docs/dev/doc.md' }]
    },
    {
      text: 'Developer Manual',
      collapsed: true,
      items: [
        { text: 'Arch', link: '/docs/dev/arch.md' },
        {
          text: 'Setup',
          link: '/docs/dev/setup.md',
          items: [
            {
              text: 'Learning Resources',
              link: '/docs/dev/jslearn.md'
            },
            { text: 'Dev New Adapter', link: '/docs/dev/adapter.md' }
          ]
        },
        { text: 'Comp Test', link: '/docs/dev/test.md' },
        { text: 'Addon', link: '/docs/dev/addon.md' },
        { text: 'Feature Request Process', link: '/docs/dev/feature.md' },
        { text: 'Releases Note', link: '/docs/dev/releases_note.md' }
      ]
    }
  ]
}
