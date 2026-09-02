# PC MCAL-CAN 通过 JSON-RPC

此示例展示了 AUTOSAR MCAL CAN 的 **C** 语言 PC 实现如何通过 `ecb_cli rpc` 与 EcuBus-Pro 硬件通信。

如果 **EcuBus-Pro GUI** 已在运行，请跳过 `ecb_cli rpc`，直接连接到同一 TCP 端口（默认为 `127.0.0.1:17320`）。 在该模式下，您的 `Can_Write` 帧将作为 EcuBus 跟踪中的 **Tx** 显示。 请先在 GUI 中启动项目。

您的生产 `Can.c` 应保留 AUTOSAR 签名（`Can_Init`、`Can_Write`、`Can_MainFunction_Read` 等） 并将每个函数实现为一次 JSON-RPC 调用。 `can_rpc_demo.c` 是一个小型 POSIX 客户端，它在两个 `simulate` 控制器上执行该序列。

## 运行

终端 1：

```bash
ecb_cli rpc --log-level=info
```

终端 2：

```bash
cd resources/examples/mcal_can_rpc
make
./can_rpc_demo
# 或：./can_rpc_demo 127.0.0.1 17320
```

您将看到 `Can.Init`、`Can.SetControllerMode`、`Can.Write`，随后是 `Can.MainFunction_Read` 在控制器 1 上返回回环帧。

## 文件

| 文件               | 作用                            |
| ---------------- | ----------------------------- |
| `can_rpc.h`      | 方法名宏以及 `E_OK` / `CAN_BUSY` 常量 |
| `can_rpc_demo.c` | POSIX TCP NDJSON 客户端          |
| `Makefile`       | `cc -std=c11`                 |

完整协议：[CLI JSON-RPC](/docs/en/um/cli/rpc.md)。
