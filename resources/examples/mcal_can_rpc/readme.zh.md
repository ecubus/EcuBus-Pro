# 通过 JSON-RPC 实现 PC 版 MCAL-CAN

本示例展示如何用 **C** 在 PC 上实现 AUTOSAR MCAL CAN，并通过 `ecb_cli rpc` 操作 EcuBus-Pro 的 CAN 硬件。

如果 **EcuBus-Pro 图形界面** 已经在运行，不要再启动 `ecb_cli rpc`，直接连同一 TCP 端口（默认 `127.0.0.1:17320`）。该模式下 `Can_Write` 会在 EcuBus 跟踪里显示为 **Tx**。请先在 GUI 中启动工程。

量产 `Can.c` 应保留 AUTOSAR 函数签名（`Can_Init`、`Can_Write`、`Can_MainFunction_Read` 等），每个函数对应一次 JSON-RPC 调用。`can_rpc_demo.c` 是一个小型 POSIX 客户端，在两个 `simulate` 控制器上走完这一流程。

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

你应看到 `Can.Init`、`Can.SetControllerMode`、`Can.Write`，然后 `Can.MainFunction_Read` 在控制器 1 上返回回环帧。

## 文件

| 文件 | 作用 |
| --- | --- |
| `can_rpc.h` | 方法名宏以及 `E_OK` / `CAN_BUSY` 常量 |
| `can_rpc_demo.c` | POSIX TCP NDJSON 客户端 |
| `Makefile` | `cc -std=c11` |

完整协议见 [CLI JSON-RPC](/docs/zh/um/cli/rpc.md)。
