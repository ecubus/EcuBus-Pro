# CAN

CAN/CAN-FD 是一种行业标准的车辆总线协议，专为汽车应用中可靠的ECU通信而设计。

> [!IMPORTANT]
> 本节描述的某些功能可能需要CAN DBC文件。 有关DBC文件的更多信息，请参阅我们的[数据库文档](../dbc)。

支持的硬件：

| 制造商     | 协议          |
| ------- | ----------- |
| PEAK    | CAN, CAN-FD |
| KVASER  | CAN, CAN-FD |
| ZLG     | CAN, CAN-FD |
| Toomoss | CAN, CAN-FD |
| VECTOR  | CAN, CAN-FD |
| SLCAN   | CAN, CAN-FD |

## SLCAN 特殊说明

SLCAN 是一种低成本开源解决方案，固件来源于 [canable-fw](https://github.com/normaldotcom/canable-fw)，通信基于 USB-ACM。

> [!NOTE]
> 此固件目前不提供任何串行命令的 ACK/NACK 反馈。

## GS_USB

基于 usbfs 或 WinUSB WCID 的 Windows/Linux/Mac CAN 驱动程序，适用于 Geschwister Schneider USB/CAN 设备和 candleLight USB CAN 接口。

### Linux gs_usb

Linux 内核 3.7 及以上版本已合并 `gs_usb` 驱动程序。
使用以下命令检查 `gs_usb` 模块是否启用：

```bash
lsmod | grep gs_usb
```

如果未加载，请使用

```bash
sudo modprobe gs_usb
```

要移除它，请使用

```bash
sudo rmmod gs_usb
```

配置启动时自动加载：

```bash
echo "gs_usb"  | sudo tee /etc/modules-load.d/gs_usb.conf
```

非 root 用户需要相应的用户组成员资格。

使用 `devadm` 监控设备连接并获取精确的设备路径：

```bash
sudo devadm monitor --property
```

检查设备组所有权。 假设为 `ttyUSB0`（实际设备可能不同）：

```bash
stat -c "%G" /dev/ttyUSB0
```

- Arch Linux：应返回 `uucp`

```bash
sudo usermod -aG uucp $USER
newgrp uucp
```

- Debian/Ubuntu：应返回 `dialout`
- Fedora/RHEL：应返回 `dialout`

```bash
sudo usermod -aG dialout $USER
newgrp dialout
```

## 设备配置

出于演示目的，我们将使用模拟设备。 您可以在设备设置中配置波特率和采样点。

![alt text](../../../media/um/can/image.png)

### 波特率设置

波特率设置用于配置 CAN 总线的波特率。

点击 `Bit Timing` 按钮打开位时序配置窗口。
![alt text](../../../media/um/can/image-8.png)
![alt text](../../../media/um/can/image-9.png)

## 交互模式和节点脚本

EcuBus-Pro 提供两种主要的 CAN 通信方法：

- 交互模式：用于手动帧传输
- 节点脚本：用于使用自定义脚本进行自动化通信

![alt text](../../../media/um/can/image-1.png)

### 交互模式

每个帧可以配置为周期性传输或手动触发（单次触发或按键绑定）。
![alt text](../../../media/um/can/image-2.png)

您可以通过两种方式添加帧：

- 手动帧配置
- 从 DBC 数据库导入
  ![alt text](../../../media/um/can/image-3.png)

### 节点脚本

节点可以配置 UDS 功能（测试器）和自定义脚本。
![alt text](../../../media/um/can/image-4.png)

周期性信号更新的示例脚本：

```typescript
import { setSignal } from 'ECB'
let val = 0
// Update signal value every second
setInterval(() => {
  setSignal('Model3CAN.VCLEFT_liftgateLatchRequest', val++ % 5)
}, 1000)
```

## 诊断操作

1. **测试器配置**

   - 配置寻址
   - 设置诊断参数
     ![alt text](../../../media/um/can/image-5.png)

2. **诊断服务**

   - 配置诊断服务
   - 创建调度表和序列
     ![alt text](../../../media/um/can/image-6.png)

3. **消息监控**
   - 在跟踪窗口中查看发送和接收的消息
     ![alt text](../../../media/um/can/image-7.png)

