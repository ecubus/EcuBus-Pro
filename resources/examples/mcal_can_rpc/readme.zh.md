# PC MCAL-CAN 通过 JSON-RPC（Simulate CAN）

此示例展示 AUTOSAR MCAL CAN 的 **C** 语言 PC 实现如何通过 JSON-RPC 与 EcuBus-Pro **Simulate CAN** 通信。

先启动包含 **Simulate-0** 的工程（GUI，或 `ecb_cli seq` / `ecb_cli test`）。EcuBus 随后在 `127.0.0.1:17320` 上监听。`Can.c` 必须打开**空闲**句柄（`1`、`2`…），不能再次打开 Simulate-0。`Can.c` 发出的帧在 Simulate-0 的 Trace 中显示为 **RX**。

生产环境的 `Can.c` 应保留 AUTOSAR 签名，并将每个函数实现为一次 JSON-RPC 调用。`can_rpc_demo.c` 初始化 Simulate-1 与 Simulate-2。

## 运行

终端 1：用 Simulate-0 启动 EcuBus（GUI 或 CLI seq/test）。

终端 2：

```bash
cd resources/examples/mcal_can_rpc
make
./can_rpc_demo
# 或: ./can_rpc_demo 127.0.0.1 17320
```

## 文件

| 文件 | 作用 |
| --- | --- |
| `can_rpc.h` | 方法名宏与 `E_OK` / `CAN_BUSY` |
| `can_rpc_demo.c` | POSIX TCP NDJSON 客户端 |
| `Makefile` | `cc -std=c11` |

完整协议：[Simulate CAN](/docs/zh/um/can/simulate.md)。
