# Trace

Trace窗口提供了一个用于查看和导出数据的界面。 用户可以通过工具栏上的按钮保存数据，以便进一步分析或存档。 用户可以通过工具栏上的按钮保存数据，以便进一步分析或存档。

![alt text](../../../media/um/trace/image.png)

> [!INFO]
> 目前，Trace的最大存储容量为50,000条记录。 超过此限制时，最旧的数据将被自动删除。 超过此限制时，最旧的数据将被自动删除。

## 覆盖模式

使用下方按钮在覆盖模式和滚动模式之间切换。
![alt text](../../../media/um/trace/image-5.png)
![alt text](../../../media/um/trace/image-5.png)

在覆盖模式下，当达到最大存储容量时，Trace窗口将覆盖最旧的数据。
![ow](../../../media/um/trace/ow.gif)
![ow](../../../media/um/trace/ow.gif)

## 筛选

### 按设备筛选

Trace窗口支持按设备、信号名称和信号值进行筛选。

> [!NOTE]
> 选择所有设备或不选择任何设备具有相同的效果。

![alt text](../../../media/um/trace/image-3.png)

## 按消息类型筛选

![alt text](../../../media/um/trace/image-4.png)

- CAN - 接收CAN相关数据
- LIN - 接收LIN相关数据
- UDS - 接收UDS相关数据
- ETH - 接收以太网相关数据

## 支持的导出格式

- Excel - 以Microsoft Excel格式导出数据
- ASC (ASCII) - 以ASCII格式导出数据，兼容各种CAN分析工具
- [功能请求](./../../dev/feature.md)

## 列信息

Trace窗口通常包含以下列：

- **时间戳**：显示事件发生的精确时间
- **名称**：表示触发事件的帧信号名称
- **信号值**：显示信号的当前值
- **DIR (方向)**：指示信号方向（Tx表示发送，Rx表示接收）
- **ID**：表示信号标识符
- **DLC (数据长度代码)**：显示数据长度代码
- **LEN (长度)**：显示实际数据长度
- **类型**：指示信号类型（例如：布尔值、整数、浮点数）
- **通道**：显示通信通道编号
- **设备**：显示设备名称

当对应的硬件通道绑定到[数据库](../database.md)时，这些列信息有助于用户快速理解和分析系统的运行状态。

> [!INFO]
> 帧内的信号值只能在Trace窗口暂停时查看

## LIN信号显示

![lin](../../../media/um/trace/image-1.png)

## CAN信号显示

![can](../../../media/um/trace/image-2.png)
