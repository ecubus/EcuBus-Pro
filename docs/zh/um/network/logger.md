# Logger

通过配置日志，您可以将所有相关的跟踪数据导出到别处，解决UI中追踪窗口的有限存储能力。

## 如何添加记录器

通过 `硬件-> Network` 打开网络配置，然后在 `Loggers` 下添加一个记录器。

![记录器](./../../../media/um/network/network.png)

## 配置记录器

悬停在目标记录器上，然后点击`✏️`按钮进行编辑。

![配置记录器](./../../../media/um/network/configLogger.png)
![配置记录器1](./../../../media/um/network/configLogger1.png)

- 运输
  - 文件: 将帧写入到文件; 选择目标路径
  - Socket: 将帧写入套接字(不支持)
- 格式
  - ASC：矢量ASC格式，`ASC是在串流模式下写入的`
  - CSV: 逗号分隔的文本格式(不支持)
  - BLF：矢量BLF格式 (不支持)
- 记录类型：选择要记录的框架类型

  - CAN：记录 CAN 帧
  - 行：记录 LIN 帧
  - ETH：记录以太网帧
  - UDS：记录 PW

## 降级：写入文件

![记录器](./../../../media/um/network/logger.gif)
