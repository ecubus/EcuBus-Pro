# OSEK OS Trace

OSEK OS Trace 是一个强大的功能，允许您通过外部接口实时获取 OSEK OS 的运行状态，并将其转换为可视化的图形界面。

> [!NOTE]
> 此功能需要 OS 提供相应的 ORTI 文件，在相应的 HOOK 中插入相关代码以记录相关信息，然后通过数据接口将数据传送给 EcuBus-Pro。

## 导入 ORTI 文件

通过点击 `Others->Database->Add OS(ORTI)` 来导入 ORTI 文件。您也可以查看已导入的 ORTI 文件。
![orti](./../../../media/um/osTrace/orti.png)

## 配置 ORTI

> [!NOTE]
> 导入 ORTI 文件后，仍然允许用户手动修改配置信息。

成功导入 ORTI 文件后，您可以看到从 ORTI 文件中解析出的配置信息。

### TASK/ISR

1.  设置名称
2.  设置实际的 CPU 运行频率（取决于您的时间戳格式。如果您的时间戳已经是微秒单位，则 CPU 频率可以设为 1）
3.  设置对象颜色
4.  为周期性任务设置理论激活间隔（Active Interval，单位微秒，仅适用于 Task）

> [!NOTE]
> Active Interval (us) 仅可针对 Task 类型进行配置。ISR 不支持此配置项。

![task](./../../../media/um/osTrace/task.png)

### Resource

![resource](./../../../media/um/osTrace/resource.png)

### Service

![service](./../../../media/um/osTrace/service.png)

### Hook

![hook](./../../../media/um/osTrace/hook.png)

### 连接器配置

连接器决定了您从何处获取 TRACE 数据。目前支持以下方式：

#### 串口

通过串口实时接收 OS Trace 数据。

**配置项：**

*   **Device**: 选择串口设备（例如 COM1, /dev/ttyUSB0 等）
*   **Baud Rate**: 波特率（例如 115200, 921600 等）
*   **Data Bits**: 数据位（5, 6, 7, 8）
*   **Stop Bits**: 停止位（1, 1.5, 2）
*   **Parity**: 校验位（None, Even, Odd, Mark, Space）

**数据格式：** 16字节二进制数据（小端序）

| 字段 | 长度 | 描述 |
|------|------|------|
| 帧头 | 4 字节 | 帧头 (05D5C5B5A) |
| 时间戳 | 4 字节 | 时间戳 (LSB) |
| 类型 ID | 2 字节 | 对象 ID (LSB) |
| 类型状态 | 2 字节 | 状态/参数 (LSB) |
| 索引 | 1 字节 | 事件索引 (0-255 循环) |
| 类型 | 1 字节 | 事件类型 |
| 核心ID | 1 字节 | 核心 ID |
| CRC8/保留 | 1 字节 | CRC8 校验和或保留字节 |

> [!NOTE]
>
> *   总帧长度固定为 16 字节
> *   CRC8 校验和计算自数据部分的 11 个字节（不包括帧头和 CRC 字节本身，包括：索引、时间戳、类型、类型 ID、类型状态、核心ID）
> *   当启用 CRC 校验时，最后一个字节用作 CRC8 校验和
> *   当禁用 CRC 校验时，最后一个字节用作保留字节，系统通过检查类型字段（有效值：0-5）来验证帧有效性

![serialPort](./../../../media/um/osTrace/serialPort.png)

#### 二进制文件

从二进制文件中读取 OS Trace 数据。数据格式与串口相同（16字节二进制数据）。

**配置项：**

*   **File**: 选择二进制文件路径（支持相对路径）

**数据格式：** 与串口相同，16字节二进制数据

#### CSV 文件

从 CSV 文件中读取 OS Trace 数据。

**配置项：**

*   **File**: 选择 CSV 文件路径（支持相对路径）

**数据格式：** CSV 格式，每行一个事件

> [!NOTE]
> CSV 文件格式为：timestamp,type,id,status。不允许有表头，时间戳单位为 tick。

```csv
1000,1,0,0
1500,1,0,1
2000,2,1,0
```

**字段描述：**

*   **timestamp**: 时间戳 (tick)
*   **type**: 事件类型
*   **id**: 对象 ID
*   **status**: 状态值

#### CAN/ETH

> [!NOTE]
> CAN 和 ETH 接口尚未实现。敬请期待。

### 记录文件

记录文件决定了 TRACE 数据写入本地文件的位置。写入的数据格式为 CSV 格式。

> [!NOTE]
> 每行一个事件，格式为：timestamp,type,id,status。时间戳单位为 tick。

![recordFile](./../../../media/um/osTrace/record.png)

### 保存

配置完 ORTI 相关信息后，点击右上角的保存按钮，即可保存 ORTI 配置信息。

## 查看 OS Trace 数据和自动生成的系统变量

通过 `Trace` 窗口可以查看 OS 发送的数据。

![trace](./../../../media/um/osTrace/trace.png)

配置 ORTI 后，ORTI 数据会自动生成为内置系统变量，可以通过 `Others->Variables->System Variables` 查看。

![var](./../../../media/um/osTrace/var.png)

## 查看 OS 统计信息

可以通过 `Others->Os Info->[对应 ORTI 文件名] Statistics` 查看 OS 统计信息。

![statistics](./../../../media/um/osTrace/info.png)

您可以使用光标在图表中检查时间戳，或查看两个光标之间的差异。

## 查看 OS 时间线

可以通过 `Others->Os Info->[对应 ORTI 文件名] Timeline` 查看 OS 时间线。

时间线使用 `pixi.js` 绘制，并由 GPU 加速。

> [!NOTE]
> 目前，时间线中仅可查看任务和 ISR。

![timeline](./../../../media/um/osTrace/timeline.png)

### 实时跟踪

在应用程序运行时支持实时跟踪。

![realTime](./../../../media/um/osTrace/rt.gif)

### 离线分析

您可以打开之前保存的 CSV 记录文件，以离线模式查看 OS 时间线。
![offline](./../../../media/um/osTrace/offline.png)

> [!NOTE]
> 如果启用了 `Link Trace` 并且跟踪窗口是打开的，离线事件也会被附加到跟踪窗口中。

### 链接跟踪

链接跟踪可以将时间线中的事件与跟踪窗口中的事件链接起来，使用户更容易查看事件之间的关系。
![link](./../../../media/um/osTrace/link.gif)

## 自定义查看特定变量信息

用户可以选择 **LINE、Gauge、Data** 等组件，根据需要显示这些变量。

例如：如果用户想要查看 5msTask 和 SystemTick ISR 的实时运行状态，点击 `Home->Graph->Line`，然后点击顶部的 `Add Variables`。
![addVar](./../../../media/um/osTrace/addLinVar.png)

选择 `5msTask->Status` 和 `SystemTick ISR->Status`，然后点击 `Add`，即可看到 5msTask 和 SystemTick ISR 的实时运行状态。
![addLine](./../../../media/um/osTrace/addVar2.png)

结果预览：
![demo](./../../../media/um/osTrace/demo.png)