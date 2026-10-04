# PC MCAL-CAN over JSON-RPC（模拟 CAN）

此示例展示了基于 **C** 语言的 AUTOSAR MCAL CAN PC 端实现如何通过 JSON-RPC 与 EcuBus-Pro **模拟 CAN** 通信。

启动一个包含 **Simulate-0** 的工程（通过 GUI 启动，或使用 `ecb_cli seq` / `ecb_cli test`）。 EcuBus 随后监听 `127.0.0.1:17320`。你的 `Can.c` 必须打开 **空闲** 句柄（`1`、`2`、……）。它不能重新打开 Simulate-0。来自 `Can.c` 的帧在 Simulate-0 跟踪上显示为 **RX**。

您的生产 `Can.c` 应保留 AUTOSAR 签名（`Can_Init`、`Can_Write`、`Can_MainFunction_Read` 等）并将每个函数实现为一次 JSON-RPC 调用。 `can_rpc_demo.c` 初始化 Simulate-1 和 Simulate-2。

## 运行

终端 1：使用 Simulate-0 设备启动 EcuBus（GUI 或 CLI seq/test）。

终端 2：

```bash
cd resources/examples/mcal_can_rpc
make
./can_rpc_demo
# 或：./can_rpc_demo 127.0.0.1 17320
```

你应该会看到句柄 1 和 2 的 `Can.Init`、`Can.SetControllerMode`、句柄 1 上的 `Can.Write`，然后句柄 2 上的 `Can.MainFunction_Read` 返回环回帧。

## 文件

| 文件               | 作用                            |
| ---------------- | ----------------------------- |
| `can_rpc.h`      | 方法名宏以及 `E_OK` / `CAN_BUSY` 常量 |
| `can_rpc_demo.c` | POSIX TCP NDJSON 客户端          |
| `Makefile`       | `cc -std=c11`                 |

完整协议：[Simulate CAN](/docs/en/um/can/simulate.md)。
