<div align="center">
  <a href="https://app.whyengineer.com/zh">
    <img width="160" height="160" src="https://ecubus.oss-cn-chengdu.aliyuncs.com/img/logo256.png">
  </a>

  <h1>EcuBus-Pro</h1>

   <div style="margin:5px; display: flex; justify-content: center; align-items: center;gap:4px">
    <a href="https://github.com/ecubus/EcuBus-Pro/releases">
      <img src="https://github.com/ecubus/EcuBus-Pro/actions/workflows/build.yml/badge.svg" alt="github-ci" />
    </a>
    <a href="https://github.com/ecubus/EcuBus-Pro/releases">
      <img src="https://github.com/ecubus/EcuBus-Pro/actions/workflows/build-linux.yml/badge.svg" alt="github-ci" />
    </a>
    <a href="https://github.com/ecubus/EcuBus-Pro/actions/workflows/build-mac.yml">
      <img src="https://github.com/ecubus/EcuBus-Pro/actions/workflows/build-mac.yml/badge.svg" alt="github-ci" />
    </a>
    <a href="https://repology.org/project/ecubus-pro/versions">
       <img src="https://repology.org/badge/version-for-repo/aur/ecubus-pro.svg" alt="AUR package">
    </a>
    <a href="https://github.com/ecubus/EcuBus-Pro">
       <img src="https://img.shields.io/github/stars/ecubus/EcuBus-Pro"/>
    </a>
  </div>
  <b style="font-size:20px;margin:10px;display:block">功能强大的汽车ECU开发工具</b>
  <i>易于使用、跨平台、多适配器支持、强大的脚本能力、CLI支持</i><br/>
  文档: <a href="https://app.whyengineer.com/zh">https://app.whyengineer.com/zh</a> | <a href="https://app.whyengineer.com">English Document</a>
</div>

## 概览

![main](https://ecubus.oss-cn-chengdu.aliyuncs.com/img/main.png)

EcuBus-Pro是商业汽车诊断工具（如`CAN-OE`）的开源替代品。它为ECU开发和测试提供了全面的解决方案，具有以下特点：

- 🆓 开源且免费使用
- 🚀 现代化、直观的用户界面
- 💻 跨平台支持（Windows、Linux、MacOS）- [安装指南](./docs/about/install.md)
- 🔌 多硬件支持
  - **[EcuBus-LinCable](https://app.whyengineer.com/docs/um/hardware/lincable.html)**: LIN（支持LIN一致性测试）、[PWM](https://app.whyengineer.com/docs/um/pwm/pwm.html)
  - **PEAK**: CAN、CAN-FD、LIN
  - **KVASER**: CAN、CAN-FD、LIN
  - **ZLG**: CAN、CAN-FD
  - **Toomotss**: CAN、CAN-FD、LIN
  - **VECTOR**: CAN、CAN-FD、LIN
  - **SLCAN**: CAN、CAN-FD [详情](https://app.whyengineer.com/docs/um/can/can.html#slcan-special)
  - **GS_USB (CANDLE)**: CAN、CAN-FD [详情](https://app.whyengineer.com/docs/um/can/can.html#gs-usb)
- 🛠️ 全面的诊断功能
  - **诊断协议**: CAN/CAN-FD、DoIP、LIN
- 📝 **脚本**: 基于TypeScript的高级自动化 - [详情](./docs/um/script.md)
- 🧪 **测试**: HIL测试框架 - [详情](./docs/um/test/test.md)
- 📊 **数据库支持**: LIN LDF（编辑和导出）、CAN DBC（查看） - [详情](./docs/um/database.md)
- 📈 **数据可视化**: 实时信号图表和分析 - [详情](./docs/um/graph/graph.md)
- ⌨️ **命令行**: 功能齐全的CLI，支持自动化和集成 - [详情](./docs/um/cli.md)
- 🎨 **面板**: 拖拽式界面构建器，用于自定义UI - [详情](./docs/um/panel/index.md)

[阅读文档了解更多](https://app.whyengineer.com/zh/)


## 支持与赞助

<div align="center">
  <h3 style="padding:20px;font-size:22px">白金赞助商</h3>
  <table style="width: 80%; margin: 0 auto; border-collapse: collapse;">
    <tbody>
    <tr>
      <td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="./docs/about/sponsor">成为赞助商</a>
      </td>
      <td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #eee;">
          <a href="./docs/about/sponsor">成为赞助商</a>
      </td>
      <td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="./docs/about/sponsor">成为赞助商</a>
      </td>
    </tr>
    </tbody>
  </table>
  <h3 style="padding:20px;font-size:20px">金牌赞助商</h3>

  <table style="width: 90%; margin: 0 auto; border-collapse: collapse;">
    <tbody>
    <tr>
      <td style="width: 25%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="http://www.cdkhdz.com" target="_blank">
          <img src="./public/logo/KUNHONG-LOGO - re-E1.png" alt="KUNHONG" width="120"/>
        </a>
      </td>
      <td style="width: 25%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="./docs/about/sponsor">成为赞助商</a>
      </td>
      <td style="width: 25%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="./docs/about/sponsor">成为赞助商</a>
      </td>
      <td style="width: 25%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="./docs/about/sponsor">成为赞助商</a>
      </td>
    </tr>
    </tbody>
  </table>
</div>

---

考虑[成为赞助商](./docs/about/sponsor)以支持持续开发。赞助商将获得显著的徽标展示位置和网站链接。🙏

## 贡献者

感谢所有帮助塑造EcuBus-Pro的贡献者：

<a href="https://github.com/ecubus/EcuBus-Pro/graphs/contributors" target="_blank"><img src="https://contrib.rocks/image?repo=ecubus/EcuBus-Pro"></a>

我们欢迎贡献！在开始之前，请查看我们的[贡献指南](./.github/contributing.md)。


## 许可证

[许可证](./license.txt) 

