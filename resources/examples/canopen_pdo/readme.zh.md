# CANopen PDO 示例

## 概述

本示例演示在同一 CAN 通道上的 **过程数据对象（PDO）**：一个脚本在对象字典数值变化时 **发送** TPDO，另一个脚本将同一条报文作为 **RPDO** 接收并打印解码后的映射。

相比 SDO，PDO 开销更小，适合周期性或事件驱动的过程数据。工程中两个脚本共用 `canopen_pdo.ecb` 里配置的仿真 CAN（`SIMULATE_0`，500 kbit/s）。

![image](./image.png)

## 文件说明

| 文件 | 作用 |
|------|------|
| `canopen_pdo.ecb` | ECUBUS 工程：两个脚本节点挂同一 CAN 设备 |
| `pdo_producer.ts` | CANopen 设备（节点 ID `0xB`），COB-ID `0x180` 的 TPDO，映射 `0x2000`（计数）+ `0x2001`（电机速度 `0-100`） |
| `pdo_consumer.ts` | 另一脚本实例中的 RPDO，COB-ID `0x180`，映射到 `0x2000` + `0x2001` |

各脚本通过 `Util.OnCan` → `device.receive(...)` 把总线接入协议栈，通过 `device.addListener('message', ...)` → `output(...)` 把栈发出的帧送回总线。

## 生产者（`pdo_producer.ts`）

1. 添加对象 `0x2000`（8 位无符号测试量）和 `0x2001`（电机速度，`0-100`）。
2. 声明 **发送 PDO**：`transmissionType: 254`（映射值变化时发送），COB-ID `0x180`，数据来自 `0x2000` + `0x2001`。
3. `device.start()` 与 `device.nmt.startNode()` 使设备进入可操作状态。
4. 每隔 100 ms 将 `0x2000` 加 1，并将 `0x2001` 按 `0 -> 30 -> 60 -> 90` 递增，触发 TPDO 后停止设备。

## 消费者（`pdo_consumer.ts`）

1. 同样添加 `0x2000` 与 `0x2001`，并声明 **接收 PDO**（COB-ID `0x180` → 两个对象）。
2. `start()` / `startNode()` 后通过 `device.pdo.on('pdo', ...)` 打印 COB-ID 及各映射对象的值。
3. 用短时 `setTimeout` 做去抖，空闲后调用 `device.stop()`。

## 运行方式

1. 在 ECUBUS Pro 中打开 `canopen_pdo.ecb`。
2. 确认 `pdo_producer` 与 `pdo_consumer` 使用同一 CAN 通道（示例工程已配好）。
3. 运行工程，在消费者侧日志中查看 `Received PDO` 及两个映射值（计数与速度）。

## 更多示例

协议栈遵循常见 CANopen PDO 用法。更多独立示例（NMT、SDO、SYNC、TIME、LSS、EMCY 等）见 **node-canopen** 仓库：

[https://github.com/Daxbot/node-canopen/tree/main/examples](https://github.com/Daxbot/node-canopen/tree/main/examples)
