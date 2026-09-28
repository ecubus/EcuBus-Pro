# SIM-CAN

主页 → 设置 → **SIM-CAN** 配置 PC 端 AUTOSAR `Can.c` 接入 [Simulate CAN](../can/simulate.md) 时使用的 JSON-RPC TCP 绑定。

服务器**不会**在应用启动时监听。仅当本进程已打开至少一个 Simulate CAN 设备后才会开始监听。

## JSON-RPC

打开或关闭 Simulate CAN 的 JSON-RPC。关闭后，即使 Simulate 设备在运行，`Can.c` 也无法连接。

## 监听地址

本机服务器的 TCP **绑定地址**，即 EcuBus 在哪块网卡上监听。不是要去连接的远端主机名。

| 值 | 含义 |
| --- | --- |
| `127.0.0.1`（默认） | 只有**本机**上的 `Can.c` 能连接 |
| `0.0.0.0` | 在所有网卡上监听，其他电脑也可以连接 |

## 监听端口

`Can.c` 连接的 TCP 端口。默认 `17320`。

修改地址或端口后点击 **应用**。句柄归属（`Can.c` 打开 sim1–N，不能占用工程的 Simulate-0）见 [Simulate CAN](../can/simulate.md)。
