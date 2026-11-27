# 模拟 CAN

模拟 CAN 是 EcuBus-Pro 的**软件虚拟 CAN 总线**。它不需要适配器、厂商 DLL 或 USB 设备。使用它在同一虚拟网络上开发脚本、UDS 测试器和节点脚本。

它与 ETAS VirtualCan 的理念相同：Peak / Kvaser / Vector 仍为真实硬件。 Simulate 是进程内总线。

## 功能

| 功能        | 详情                                      |
| --------- | --------------------------------------- |
| 通道        | 64 个句柄：**Simulate-0** … **Simulate-63** |
| 协议        | CAN 和 CAN-FD                            |
| 平台        | Windows、Linux、macOS（无需厂商 SDK）           |
| EcuBus 功能 | DBC、Interactive、节点脚本、UDS 测试器、trace      |

## 虚拟总线

每个**打开**的模拟句柄都是**同一条**共享总线上的一个节点。

- 在 Simulate-0 上发送的帧会在其他每个**打开的**句柄（Simulate-1、…）上作为 **RX** 接收。作为 **RX**。
- 节点**不会**将自己的 TX 视为 RX。
- 同一句柄在一个进程中只能被打开一次（`BUS ALREADY INIT`）。

### Trace

EcuBus 跟踪显示项目设备。 Simulate-0 上的脚本、交互式发送或 UDS 请求是该节点上的 **TX**。同一帧在其他每个打开的模拟节点上都是 **RX**。

## 在 EcuBus 中使用

1. 硬件 → **Simulate** → 添加一个 CAN 节点。
2. 选择一个空闲句柄（从 Simulate-0 开始）。
3. 像任何其他供应商一样设置比特率/CAN-FD。
4. 像往常一样绑定 DBC、交互表、节点脚本或 UDS 测试仪。

**不同**句柄上的两个项目节点（Simulate-0 和 Simulate-1）也会相互回环。当两端都是 EcuBus 脚本时，这很有用。

## 它不是什么

- 不是真实的收发器时序、ACK 或错误帧。
- 不是通往 Peak / Kvaser / Vector 的网关。这些供应商保持独立硬件。
- 不跨进程共享。每个 EcuBus 进程都有其自己的虚拟总线。
