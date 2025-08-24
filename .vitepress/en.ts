import { createRequire } from 'module'
import { defineConfig, type DefaultTheme } from 'vitepress'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

export const en = defineConfig({
  lang: 'en-US',
  description: 'A powerful automotive ECU development tool',

  themeConfig: {
    nav: nav(),
    sidebar: sidebar()
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
        {
          text: 'PWM',
          link: '/docs/um/pwm/pwm.md'
        },
        {
          text: 'Diagnostic',
          items: [
            {
              text: 'Build In Script',
              link: '/docs/um/uds/buildInScript.md'
            },
            {
              text: 'Tester Present',
              link: '/docs/um/uds/testerPresent.md'
            },
            {
              text: 'UDS -> C Code',
              link: '/docs/um/uds/udscode.md'
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
        { text: 'CLI', link: '/docs/um/cli.md' },
        {
          text: 'Script',
          link: '/docs/um/script',
          items: [{ text: 'Use External Package', link: '/docs/um/script/scriptSerialPort' }]
        },
        {
          text: 'Test',
          link: '/docs/um/test/test.md'
        },
        {
          text: 'Database',
          link: '/docs/um/database',
          items: [
            { text: 'LIN LDF', link: '/docs/um/ldf' },
            { text: 'CAN DBC', link: '/docs/um/dbc' }
          ]
        },
        {
          text: 'Panel',
          link: '/docs/um/panel/index.md'
        },
        {
          text: 'Setting',
          items: [{ text: 'General', link: '/docs/um/setting/general' }]
        },
        {
          text: 'FAQ',
          link: '/docs/faq/index'
        }
      ]
    },
    {
      text: 'Example',
      items: [
        {
          text: 'CAN',
          items: [
            { text: 'CAN Basic', link: '/examples/can/readme' },
            { text: 'NXP UDS Bootloader', link: '/examples/nxp_bootloader/readme' }
          ],
          collapsed: true
        },
        {
          text: 'LIN',
          items: [
            { text: 'LIN General', link: '/examples/lin/readme' },
            { text: 'LIN TP', link: '/examples/lin_tp/readme' },
            { text: 'LIN Conformance Test', link: '/examples/lin_conformance_test/readme' },
            { text: 'LIN SAE J2602 Test', link: '/examples/lin_j2602_test/readme' }
          ],
          collapsed: true
        },
        {
          text: 'DOIP',
          items: [
            { text: 'DoIP Tester', link: '/examples/doip/readme' },
            { text: 'DoIP Simulate Entity', link: '/examples/doip_sim_entity/readme' },
            { text: 'DoIP Gateway', link: '/examples/doip_gateway/readme' }
          ],
          collapsed: true
        },
        {
          text: 'UDS',
          items: [
            { text: 'UDS Hex/S19 File', link: '/examples/uds_hex_s19_file/readme' },
            { text: 'UDS Binary File', link: '/examples/uds_bin_file/readme' },
            { text: 'Secure Access dll', link: '/examples/secure_access_dll/readme' },
            { text: 'UDS Code Generate', link: '/examples/uds_generate_code/readme' },
            { text: 'UDS Authentication Service(0x29)', link: '/examples/uds_0x29/readme' },
            { text: 'UDS Security Access(0x27)', link: '/examples/uds_0x27/readme' },
            { text: 'UDS DoIP Large File', link: '/examples/uds_doip_large_file/readme' }
          ],
          collapsed: true
        },
        {
          text: 'Test',
          items: [{ text: 'Test Simple', link: '/examples/test_simple/readme' }],
          collapsed: true
        },
        {
          text: 'Panel',
          link: '/examples/panel/readme'
        }
      ]
    },
    {
      text: 'Developer Manual',
      collapsed: true,
      items: [
        { text: 'Arch', link: '/docs/dev/arch' },
        {
          text: 'Setup',
          link: '/docs/dev/setup',
          items: [
            {
              text: 'Learning Resources',
              link: '/docs/dev/jslearn'
            },
            { text: 'Dev New Adapter', link: '/docs/dev/adapter' }
          ]
        },
        { text: 'Comp Test', link: '/docs/dev/test' },
        { text: 'Addon', link: '/docs/dev/addon' },
        { text: 'Feature Request Process', link: '/docs/dev/feature' },
        { text: 'Releases Note', link: '/docs/dev/releases_note' }
      ]
    }
  ]
}
