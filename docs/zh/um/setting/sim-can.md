# SIM-CAN

Home → Setting → **SIM-CAN** 配置 PC AUTOSAR `Can.c` 用于加入 [Simulate CAN](../can/simulate.md) 的 JSON-RPC TCP 绑定。

服务器**不会在应用启动时监听**。只有在进程打开至少一个 Simulate CAN 设备后才会启动。

## JSON-RPC

启用或禁用 Simulate CAN JSON-RPC API。关闭时，即使 Simulate 设备正在运行，`Can.c` 也无法连接。

## 监听地址

本地服务器的 TCP **绑定地址**——EcuBus 监听的接口。它不是你要连&#x63A5;_&#x5230;_&#x7684;远程主机名。

| 值               | 含义                         |
| --------------- | -------------------------- |
| `127.0.0.1`（默认） | 只有**此 PC** 上的 `Can.c` 可以连接 |
| `0.0.0.0`       | 在所有接口上监听，以便另一台机器可以连接       |

## 监听端口

`Can.c` 连接到的 TCP 端口。默认 `17320`。

更改地址或端口后，点击 **Apply**。有关句柄所有权，请参阅 [Simulate CAN](../can/simulate.md)。 `Can.c` 必须打开一个空闲句柄，不能重新打开项目已拥有的句柄。
