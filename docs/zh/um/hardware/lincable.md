<script setup>
import LinCableProductPage from '../../../component/LinCableProductPage.vue'
</script>

# EcuadBus LinCable - USB to LIN Adapter for Automotive Development

<LinCableProductPage />

EcuadBus LinCable 适配器，可以通过
USB Type-C无缝连接LIN网络到计算机。 支持单个LIN频道。

**Board 尺寸：** 59毫米(高度) × 19毫米(长度)

## 图表

![lincable-diagram](../../../media/um/hardware/linCable.png)

## LIN协议支持

LinCable 完全支持LIN 2.0、2.1、2.2A 和 SAE J2602标准，提供了
与多种汽车LIN设备和网络兼容。 支持的波特率
包括19200、10400、9600和2400bps，使LinCable 既适合旧应用，也适合
现代LIN应用。

## PWM 输出能力

LinCable 包含先进的 [PWM](../pwm/pwm.md) 输出功能，使其成为汽车开发和测试的多功能工具。 PWM输出功能使得
能够准确控制各种汽车应用的数字信号。

### PWM 输出规范

- **Frequency Range**: 1 Hz - 20KHz 高精度
- **义务周期控制**：0%到100%，分辨率为0.1%。
- **输出电压**：高层等于 VBAT 输入电压，低层等于 0V
- **频道计数** ：单声道输出频道
- **频率精度**：±0.1% 典型的

## 电源控制

支持IUT 电源控制，最大电流2A，最大电压 18V

## 故障注入和配套测试

使用内置的高级故障注入能力，LinCable 允许工程师模拟
各种错误条件并进行全面的符合性测试。 这对于在开发和质量保证期间验证 LIN 节点和网络的稳健性和可靠性至关重要。

> 跟随ISO/DIS 17987-6

---

### 断开字段/分隔符长度控制

- **Break Length Length**: 可调整的间歇字段长度从 13 到 26 bits (默认：13 bit)
- **打断分隔符长度**: 可配置分隔符长度从 0 到 14.6 位(默认: 1 位)

### 字节间距控制

- **header Interbyte Space**: 控制同步字节和标识符字段之间的间距 (0-14位, 默认: 0)
- \*\*Data Interbyte Space \*\*: 个别控制每个数据字节之间的间距 (0-4bits 每个字节)

### 同步/ID字段自定义

- **同步值覆盖**：自定义同步字节值或完全禁用同步传输(默认：0x55，false methods master 不发送同步数据)
- **PID Override**: 自定义受保护的标识符 (PID) 值或禁用 PID 传输(默认: getPID(frameId), false means master 不发送pid)

### Bitlevel 喷射故障

- **Precise Bit Manipulation**: 在从中断字段开始的任何特定位置注入故障
- **位值控制**：强制特定位到高(1)或低(0) 状态

### 校验和覆盖

- **校验和覆盖**：用自定义值覆盖校验和

---

> 更多详情请访问 [Lin Conformance 测试示例](https://app.whyengineer.com/examples/lin_conformance_test/readme.html)。

## 跨平台和软件集成

LinCable 完全兼容Windows、 macOS和Linux 操作系统(USB-ACM 驱动程序)。 它将
与**EcuBus-Pro** 软件套装无缝地整合，并且还支持第三方汽车
开发工具。 一个完整的 SDK 和 API 用于自定义应用程序
开发。

## 为次要发展开放通信协议

LinCable 提供了一个开放的通信协议，使用户能够进行二级开发
并根据他们的具体要求定制。 协议文件整理完善，
包含全面的API。 允许开发者将LinCable 整合到他们自己的应用程序
或创建专门汽车测试场景的自定义解决方案。 此开放结构
确保了高级用户的灵活性和扩展性，他们需要的功能超过
标准功能。

## DFU 固件更新支持

LinCable 支持设备固件更新 (DFU) 功能，使用户能够轻松更新
设备固件到最新版本或安装自定义固件。 此功能确保 LinCable 可以通过最新的改进、错误修复和新功能保持更新，而无需更换硬件。 DFU过程是直截了当的，可以通过
EcuBus-Pro软件或专用DFU工具来完成。 为固件
更新提供可靠和安全的方法。

