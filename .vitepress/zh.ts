import { createRequire } from "模块";
import { defineConfig, type DefaultTheme } from 'vitepress';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
export const en = defineConfig({
  lang: 'en-US',
  description: "一款强大的汽车电子控制单元开发工具",
  themeConfig: {
    nav: nav(),
    sidebar: sidebar(),
    editLink: {
      pattern: 'https://github.com/ecubus/EcuBus-Pro/edit/master/:path',
      text: "在 GitHub 上编辑此页面"
    },
    docFooter: {
      prev: "上一页",
      next: "下一页"
    },
    outline: {
      label: "页面导航",
      level: [2, 4]
    },
    lastUpdated: {
      text: "最后更新",
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium'
      }
    },
    langMenuLabel: "语言",
    returnToTopLabel: "返回顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchLabel: "主题",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
    skipToContentLabel: "跳转到内容"
  }
});
function nav(): DefaultTheme.NavItem[] {
  return [{
    text: "📦 插件市场",
    link: '/docs/plugin/index.md'
  }, {
    text: "常见问题",
    link: '/docs/faq/index.md'
  }, {
    text: pkg.version,
    items: [{
      text: "更新日志",
      link: 'https://github.com/ecubus/EcuBus-Pro/blob/master/docs/dev/releases_note.md'
    }]
  }, {
    text: "脚本 API",
    link: 'https://app.whyengineer.com/scriptApi/index.html'
  }];
}
function sidebar(): DefaultTheme.SidebarItem[] {
  return [{
    text: "关于",
    items: [{
      text: "介绍",
      link: '/'
    }, {
      text: "安装",
      link: '/docs/about/install'
    }, {
      text: "赞助 ❤️",
      link: '/docs/about/sponsor'
    }, {
      text: "联系",
      link: '/docs/about/contact'
    }]
  }, {
    text: "用户手册",
    collapsed: true,
    base: '/docs/um/',
    items: [{
      text: "EcuBus 硬件",
      link: 'hardware/index.md',
      items: [{
        text: 'LinCable',
        link: 'hardware/lincable.md'
      }]
    }, {
      text: 'CAN',
      link: 'can/can.md'
    }, {
      text: 'LIN',
      link: 'lin/lin.md'
    }, {
      text: 'PWM',
      link: 'pwm/pwm.md'
    }, {
      text: "网络",
      items: [{
        text: "记录器",
        link: 'network/logger.md'
      }]
    }, {
      text: 'CLI',
      link: 'cli/cli.md'
    }, {
      text: "以太网",
      items: [{
        text: 'DoIP',
        link: 'doip/doip.md',
        items: [{
          text: "VIN 请求行为",
          link: 'doip/vin.md'
        }, {
          text: 'DoIP v3',
          link: 'doip/doipv3.md'
        }]
      }]
    }, {
      text: 'E2E',
      link: 'e2e/e2e.md'
    }, {
      text: 'SOME/IP',
      link: 'someip/index.md'
    }, {
      text: "OSEK OS 追踪",
      link: 'osTrace/index.md'
    }, {
      text: "诊断",
      items: [{
        text: "内置脚本",
        link: 'uds/buildInScript/buildInScript.md'
      }, {
        text: 'Tester Present',
        link: 'uds/testerPresent/testerPresent.md'
      }, {
        text: "UDS -> C 代码",
        link: 'uds/udscode/udscode.md'
      }, {
        text: "UDS Bootloader 实现指南",
        link: 'uds/example/example.md'
      }]
    }, {
      text: "追踪",
      link: 'trace/trace.md'
    }, {
      text: "图表",
      link: 'graph/graph.md'
    }, {
      text: "变量",
      link: 'var/var.md'
    }, {
      text: "脚本",
      link: 'script/script.md',
      items: [{
        text: "使用外部包",
        link: 'script/SerialPort/scriptSerialPort.md'
      }, {
        text: 'CAPL->TS',
        link: 'script/capl2ts/capl2ts.md'
      }]
    }, {
      text: "测试",
      link: 'test/test.md'
    }, {
      text: "数据库",
      link: 'database/database.md',
      items: [{
        text: 'LIN LDF',
        link: 'database/ldf/ldf.md'
      }, {
        text: 'CAN DBC',
        link: 'database/dbc/dbc.md'
      }]
    }, {
      text: "面板",
      link: 'panel/index.md'
    }, {
      text: "插件",
      link: 'plugin/plugin.md'
    }, {
      text: "设置",
      items: [{
        text: "通用",
        link: 'setting/general.md'
      }]
    }]
  }, {
    text: "示例",
    base: '/examples/',
    items: [{
      text: 'CAN',
      items: [{
        text: "CAN 基础",
        link: 'can/readme.md'
      }, {
        text: "CAN 高精度定时器",
        link: 'can_timer/readme.md'
      }, {
        text: 'NXP UDS Bootloader',
        link: 'nxp_bootloader/readme.md'
      }],
      collapsed: true
    }, {
      text: 'LIN',
      items: [{
        text: "LIN 通用",
        link: 'lin/readme.md'
      }, {
        text: 'LIN TP',
        link: 'lin_tp/readme.md'
      }, {
        text: "LIN 一致性测试",
        link: 'lin_conformance_test/readme.md'
      }, {
        text: "LIN SAE J2602 测试",
        link: 'lin_j2602_test/readme.md'
      }, {
        text: 'LIN OTA',
        link: 'NSUC1612_LIN_OTA/readme.md'
      }, {
        text: "LIN 自动寻址",
        link: 'lin_aa/readme.md'
      }],
      collapsed: true
    }, {
      text: 'DOIP',
      items: [{
        text: "DoIP 测试器",
        link: 'doip/readme.md'
      }, {
        text: "DoIP 模拟实体",
        link: 'doip_sim_entity/readme.md'
      }, {
        text: "DoIP 网关",
        link: 'doip_gateway/readme.md'
      }, {
        text: 'DoIP v3',
        link: 'doip_sim_entity_v3/readme.md'
      }],
      collapsed: true
    }, {
      text: 'UDS',
      items: [{
        text: "UDS Hex/S19 文件",
        link: 'uds_hex_s19_file/readme.md'
      }, {
        text: "UDS 二进制文件",
        link: 'uds_bin_file/readme.md'
      }, {
        text: "安全访问 dll",
        link: 'secure_access_dll/readme.md'
      }, {
        text: "UDS 代码生成",
        link: 'uds_generate_code/readme.md'
      }, {
        text: "UDS 认证服务(0x29)",
        link: 'uds_0x29/readme.md'
      }, {
        text: "UDS 安全访问(0x27)",
        link: 'uds_0x27/readme.md'
      }, {
        text: "UDS DoIP 大文件",
        link: 'uds_doip_large_file/readme.md'
      }],
      collapsed: true
    }, {
      text: "测试",
      items: [{
        text: "简单测试",
        link: 'test_simple/readme.md'
      }],
      collapsed: true
    }, {
      text: "面板",
      link: 'panel/readme.md',
      collapsed: true
    }, {
      text: 'SOME/IP',
      items: [{
        text: "请求/响应",
        link: 'someip/readme.md'
      }],
      collapsed: true
    }]
  }, {
    text: "开发者手册",
    base: '/docs/dev/',
    collapsed: true,
    items: [{
      text: "架构",
      link: 'arch.md'
    }, {
      text: "设置",
      link: 'setup.md',
      items: [{
        text: "学习资源",
        link: 'jslearn.md'
      }, {
        text: "开发新适配器",
        link: 'adapter.md'
      }]
    }, {
      text: "组件测试",
      link: 'test.md'
    }, {
      text: "插件",
      link: 'addon.md'
    }, {
      text: "插件",
      link: 'plugin.md'
    }, {
      text: "如何开发文档",
      link: 'doc.md'
    }, {
      text: "功能请求流程",
      link: 'feature.md'
    }, {
      text: "发布说明",
      link: 'releases_note.md'
    }]
  }];
}