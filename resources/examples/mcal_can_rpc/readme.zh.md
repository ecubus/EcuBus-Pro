# PC MCAL-CAN over JSON-RPC (Simulate CAN)

This example shows how a **C** PC implementation of AUTOSAR MCAL CAN talks to EcuBus-Pro **Simulate CAN** through JSON-RPC.

Start a project that contains **Simulate-0** (GUI start, or `ecb_cli seq` / `ecb_cli test`). EcuBus then listens on `127.0.0.1:17320`. Your `Can.c` must open **free** handles (`1`, `2`, …). It cannot reopen Simulate-0. Frames from `Can.c` appear as **RX** on the Simulate-0 trace.

您的生产 `Can.c` 应保留 AUTOSAR 签名（`Can_Init`、`Can_Write`、`Can_MainFunction_Read` 等）并将每个函数实现为一次 JSON-RPC 调用。 `can_rpc_demo.c` inits Simulate-1 and Simulate-2.

## 运行

Terminal 1: start EcuBus with a Simulate-0 device (GUI or CLI seq/test).

终端 2：

```bash
cd resources/examples/mcal_can_rpc
make
./can_rpc_demo
# 或：./can_rpc_demo 127.0.0.1 17320
```

You should see `Can.Init` for handles 1 and 2, `Can.SetControllerMode`, `Can.Write` on handle 1, then `Can.MainFunction_Read` returning the loopback frame on handle 2.

## 文件

| 文件               | 作用                            |
| ---------------- | ----------------------------- |
| `can_rpc.h`      | 方法名宏以及 `E_OK` / `CAN_BUSY` 常量 |
| `can_rpc_demo.c` | POSIX TCP NDJSON 客户端          |
| `Makefile`       | `cc -std=c11`                 |

Full protocol: [Simulate CAN](/docs/en/um/can/simulate.md).
