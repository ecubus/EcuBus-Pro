<div align="center">
  <a href="https://app.whyengineer.com">
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
    <a href="https://github.com/ecubus/EcuBus-Pro">
       <img src="https://img.shields.io/github/stars/ecubus/EcuBus-Pro"/>
    </a>
  </div>
  <b style="font-size:20px;margin:10px;display:block">A powerful automotive ECU development tool</b>
  <i>Easy of use, Cross platform, Multi dongle, Powerful script ability, CLI support</i><br/>
  Document: <a href="https://app.whyengineer.com">https://app.whyengineer.com</a> | <a href="https://app.whyengineer.com/zh">中文文档</a>
</div>

## Overview

![main](https://ecubus.oss-cn-chengdu.aliyuncs.com/img/main.png)

EcuBus-Pro is an open-source alternative to commercial automotive diagnostic tools like `CAN-OE`. It provides a comprehensive solution for ECU development and testing with:

- 🆓 Open-source and free to use
- 🚀 Modern, intuitive user interface
- 💻 Cross-platform support (Windows, Linux, MacOS) - [Install](./docs/about/install.md)
- 🔌 Multi-hardware support
  - **[EcuBus-LinCable](https://app.whyengineer.com/docs/um/hardware/lincable.html)**: LIN (Support Lin conformance test), [PWM](https://app.whyengineer.com/docs/um/pwm/pwm.html)
  - **PEAK**: CAN, CAN-FD, LIN
  - **KVASER**: CAN, CAN-FD, LIN
  - **ZLG**: CAN, CAN-FD
  - **Toomotss**: CAN, CAN-FD, LIN
  - **VECTOR**: CAN, CAN-FD, LIN
  - **SLCAN**: CAN, CAN-FD [Detail](https://app.whyengineer.com/docs/um/can/can.html#slcan-special)
  - **GS_USB (CANDLE)**: CAN, CAN-FD [Detail](https://app.whyengineer.com/docs/um/can/can.html#gs-usb)
- 🛠️ Comprehensive diagnostic capabilities
  - **Diagnostic Protocols**: CAN/CAN-FD, DoIP, LIN
- 📝 **Scripting**: Advanced TypeScript-based automation - [Details](./docs/um/script.md)
- 🧪 **Test**: HIL Test Framework - [Details](./docs/um/test/test.md)
- 📊 **Database Support**: LIN LDF (edit & export), CAN DBC (view) - [Details](./docs/um/database.md)
- 📈 **Data Visualization**: Real-time signal graphing and analysis - [Details](./docs/um/graph/graph.md)
- ⌨️ **Command Line**: Full-featured CLI for automation and integration - [Details](./docs/um/cli.md)
- 🎨 **Panel**: Drag-and-drop interface builder for custom UI - [Details](./docs/um/panel/index.md)

[Read the Docs to Learn More.](https://app.whyengineer.com)


## Support & Sponsorship

<div align="center">
  <h3 style="padding:20px;font-size:22px">Platinum Sponsors</h3>
  <table style="width: 80%; margin: 0 auto; border-collapse: collapse;">
    <tbody>
    <tr>
      <td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="./docs/about/sponsor">Become a Sponsor</a>
      </td>
      <td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="./docs/about/sponsor">Become a Sponsor</a>
      </td>
      <td style="width: 33.33%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="./docs/about/sponsor">Become a Sponsor</a>
      </td>
    </tr>
    </tbody>
  </table>
  <h3 style="padding:20px;font-size:20px">Gold Sponsors</h3>

  <table style="width: 90%; margin: 0 auto; border-collapse: collapse;">
    <tbody>
    <tr>
      <td style="width: 25%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="http://www.cdkhdz.com" target="_blank">
          <img src="./public/logo/KUNHONG-LOGO - re-E1.png" alt="KUNHONG" width="120"/>
        </a>
      </td>
      <td style="width: 25%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="./docs/about/sponsor">Become a Sponsor</a>
      </td>
      <td style="width: 25%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="./docs/about/sponsor">Become a Sponsor</a>
      </td>
      <td style="width: 25%; text-align: center; padding: 20px; border: 1px solid #eee;">
        <a href="./docs/about/sponsor">Become a Sponsor</a>
      </td>
    </tr>
    </tbody>
  </table>
</div>

---

Consider [becoming a sponsor](./docs/about/sponsor) to support ongoing development. Sponsors receive prominent logo placement with website links. 🙏


## Contributors

Thanks to all the contributors who have helped shape EcuBus-Pro:

<a href="https://github.com/ecubus/EcuBus-Pro/graphs/contributors" target="_blank"><img src="https://contrib.rocks/image?repo=ecubus/EcuBus-Pro"></a>

We welcome contributions! Please review our [contribution guidelines](./.github/contributing.md) before getting started.

<!--@include: ./docs/share/comment.md-->

## License

[License](./license.txt)
