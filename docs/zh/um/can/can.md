# CAN

CAN/CAN-FD是一项行业标准的汽车公共汽车协议，旨在在汽车应用中可靠的ECU通信。

> [!IMPORTANT]
> 本节描述的一些功能可能需要 CAN DBC 文件。 欲了解更多关于 DBC 文件的信息，请参阅我们的 [数据库文档](../dbc)。

支持的硬件：

| 制造商    | Protocols   |
| ------ | ----------- |
| 染料     | CAN, CAN-FD |
| 克瓦塞尔   | CAN, CAN-FD |
| ZLG    | CAN, CAN-FD |
| Toomos | CAN, CAN-FD |
| 镜头     | CAN, CAN-FD |
| SLCAN  | CAN, CAN-FD |

## SLCAN Special

SLCAN是一个低成本的开放源代码解决方案，其固件源自 [canable-fw](https://github.com/normaldotcom/canable-fw)，通信基于USB-ACM。

> [!注意]
> 此固件目前没有为串行命令提供任何ACK/NACK反馈。

## USB_USB

基于 Geschwister Schneider USB/CAN 设备和 candleLight USB CAN 接口的 Windows/Linux/Mac CAN 驱动程序或WinUSB WCID 驱动程序。

### Linux gs_usb

Linux 内核3.7及以上已合并了 `gs_bank` 驱动程序。
检查是否使用 `gs_bank` 模块启用

```bash
lsomd | grep gs_usb
```

如果未加载，请使用

```bash
sudo modprobe gs_usb
```

要删除它，请使用

```bash
sudo rmod gs_usb
```

配置启动时自动加载：

```bash
echo "gs_bank" | sudo tee /etc/modules-load.d/gs_blaw.conf
```

非根用户需要相应的用户组成员。

使用 `devadm` 来监视设备连接并获取精确的设备路径：

```bash
sudo devadm 监视器 --property
```

检查设备组所有权。 假设`ttyUSB0` (实际设备可能不同):

```bash
stat -c "%G" /dev/ttyUSB0
```

- Arch Linux：应该返回 `uucp`

```bash
sudo usermod -aG uucp $USER
newgrp uucp
```

- Debian/Ubuntu: 应该返回 `dialout`
- Fedora/RHEL：返回 `dialout`

```bash
sudo usermod -aG dialout $USER
newgrp dialout
```

## 设备配置

为了演示目的，我们将使用模拟设备。 您可以在设备设置中配置波特率和采样点。

![alt text](../../../media/um/can/image.png)

### 波特率设置

波特率设置用于配置CAN 公共汽车的波特率。

点击 "Bit Timing" 按钮打开位计时设置窗口。
![alt text](../../../media/um/can/image-8.png)
![alt text](../../../media/um/can/image-9.png)

## 交互模式和节点脚本

EcuBus-Pro 公司提供两种主要方法来进行CAN 通信：

- 互动模式：手动帧传输
- 节点脚本：使用自定义脚本进行自动通信

![alt text](../../../media/um/can/image-1.png)

### 交互模式

每个帧都可以用于定期传输或手动触发(单射击或键盘)。
![alt text](../../../media/um/can/image-2.png)

您可以通过两种方式添加帧：

- 手动帧配置
- Import from DBC database
  ![alt text](../../../media/um/can/image-3.png)

### 节点脚本

节点可以使用 UDS 功能 (测试器) 和自定义脚本进行配置。
![alt text](../../../media/um/can/image-4.png)

定期信号更新的示例脚本：

```typescript
import { setSignal } from 'ECB'
let val = 0
// 每秒更新信号值
setInterval(() => {
  setSignal('Model3CAN.VCLEFT_liftgateLatchRequest', val++ % 5)
}, 1000)
```

## 诊断操作

1. **Tester 配置**

   - 配置地址
   - Set diagnostic parameters
     ![alt text](../../../media/um/can/image-5.png)

2. **诊断服务**

   - 配置诊断服务
   - Create schedule tables and sequences
     ![alt text](../../../media/um/can/image-6.png)

3. **消息监视**
   - View transmitted and received messages in the trace window
     ![alt text](../../../media/um/can/image-7.png)

