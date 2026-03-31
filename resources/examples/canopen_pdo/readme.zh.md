# CANopen PDO 示例

## 概述

本示例展示了单 CAN 通道上的**过程数据对象 (PDO)**：一个脚本在对象字典值发生变化时**发送**一个 TPDO，另一个脚本**接收**该帧作为 RPDO 并打印解码后的映射。

与 SDO 相比，PDO 通信开销低，适用于周期性或事件驱动的过程数据。 此处两个节点都连接到 `canopen_pdo.ecb` 中定义的同一模拟 CAN 设备（`SIMULATE_0`，500 kbit/s）。

![image](./image.png)

---

![demo](./demo.gif)

## 项目结构

| 文件                | 角色                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `canopen_pdo.ecb` | 包含一个 CAN 设备上两个脚本节点的 ECUBUS 项目                                                               |
| `pdo_producer.ts` | CANopen 设备（节点 ID `0xB`），在 COB-ID `0x180` 上有一个 TPDO，映射 `0x2000`（计数器）+ `0x2001`（电机转速，`0-100`） |
| `pdo_consumer.ts` | **独立**脚本实例中的相同节点 ID，在 `0x180` 上有一个 RPDO，映射到 `0x2000` + `0x2001`                             |

每个脚本通过 `Util.OnCan` → `device.receive(...)` 将协议栈连接到总线，并通过 `device.addListener('message', ...)` → `output(...)` 转发协议栈的发送。

## 生产者 (`pdo_producer.ts`)

1. 添加对象 `0x2000`（8 位无符号测试值）和 `0x2001`（电机转速，`0-100`）。
2. 声明一个**发送 PDO**，其 `transmissionType: 254`（映射值变化时发送），COB-ID `0x180`，有效载荷来自 `0x2000` + `0x2001`。
3. 调用 `device.start()` 和 `device.nmt.startNode()` 以使设备进入运行状态。
4. 每 100 毫秒将 `0x2000` 递增三次（`1 -> 2 -> 3`），这会触发 TPDO 发送。
5. 转速（`0x2001`）由面板变量控制：
   - `MotorSpeedPlus`：将转速增加 1（限制在 `100`）
   - `MotorSpeedMinus`：将转速减少 1（限制在 `0`）
     每次更改都会更新 `0x2001` 并触发 TPDO 的发送-变化。

## 消费者（`pdo_consumer.ts`）

1. 添加对象 `0x2000` 和 `0x2001`，并在 COB-ID `0x180` 上配置一个**接收 PDO**，映射到这两个对象。
2. 在 `start()` / `startNode()` 之后，通过 `device.pdo.on('pdo', ...)` 监听并记录 COB-ID 及每个映射对象的值。
3. 当接收到对象 `0x2001` 时，通过 `setVar("MotorSpeed", value)` 将其值写入全局变量 `MotorSpeed`。

## 如何运行

1. 在 ECUBUS Pro 中打开 `canopen_pdo.ecb`。
2. 确保两个脚本（`pdo_producer`、`pdo_consumer`）使用相同的 CAN 通道（如捆绑项目中所示）。
3. 运行项目；观察消费者输出中带有两个映射值（计数器和速度）的 `Received PDO` 行。
4. 在面板中切换 `MotorSpeedPlus` / `MotorSpeedMinus` 以改变速度，并观察消费者端同步的 PDO 更新。

## 更多示例

底层堆栈遵循常见的 CANopen PDO 模式。 更多独立场景（NMT、SDO、SYNC、TIME、LSS、EMCY 等）请参阅 **node-canopen** 示例：

[https://github.com/Daxbot/node-canopen/tree/main/examples](https://github.com/Daxbot/node-canopen/tree/main/examples)
