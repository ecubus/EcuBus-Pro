# 模拟 CAN

模拟 CAN 是 EcuBus-Pro 的**软件虚拟 CAN 总线**。它不需要适配器、厂商 DLL 或 USB 设备。可使用它在同一虚拟网络上开发脚本、UDS 测试器以及 PC 端 AUTOSAR MCAL（`Can.c`）。

它与 ETAS VirtualCan 的理念相同：Peak / Kvaser / Vector 仍为真实硬件。 Simulate 是进程内总线。

## 功能

| 功能        | 详情                                                       |
| --------- | -------------------------------------------------------- |
| 通道        | 64 个句柄：**Simulate-0** … **Simulate-63**                  |
| 协议        | CAN 和 CAN-FD                                             |
| 平台        | Windows、Linux、macOS（无需厂商 SDK）                            |
| EcuBus 功能 | DBC、Interactive、节点脚本、UDS 测试器、trace                       |
| PC MCAL   | 当至少有一个模拟设备处于**打开**状态时启用 JSON-RPC 2.0 TCP |

## 虚拟总线

每个**打开**的模拟句柄都是**同一条**共享总线上的一个节点。

- 在 Simulate-0 上发送的帧会在其他每个**打开的**句柄（Simulate-1、…）上作为 **RX** 接收。作为 **RX**。
- 节点**不会**将自己的 TX 视为 RX。
- 同一句柄在一个进程中只能被打开一次（`BUS ALREADY INIT`）。

典型实验室布局：

```
EcuBus project:  Simulate-0   (tester / script / trace)
PC Can.c:        Simulate-1 … N   (virtual ECU, opened over JSON-RPC)
                 └── same virtual bus ──
```

### Trace

EcuBus trace 仅显示**项目设备**。如果项目中有 Simulate-0：

| 事件                        | Simulate-0 上的 Trace |
| ------------------------- | ------------------- |
| 脚本 / Interactive / UDS 发送 | **TX**              |
| `Can.c` 在 Simulate-1 上发送  | **RX**              |

Simulate-1 不是项目中的硬件节点，因此不会作为第二个 trace 通道出现。

## 在 EcuBus 中使用

1. 硬件 → **Simulate** → 添加一个 CAN 节点。
2. 选择一个空闲句柄（从 Simulate-0 开始）。
3. 像任何其他供应商一样设置比特率/CAN-FD。
4. 像往常一样绑定 DBC、交互表、节点脚本或 UDS 测试仪。

**不同**句柄上的两个项目节点（Simulate-0 和 Simulate-1）也会相互回环。当两端都是 EcuBus 脚本时，这很有用。

## PC AUTOSAR MCAL (JSON-RPC)

C 语言的 `Can.c` 保持 AUTOSAR 签名（`Can_Init`、`Can_Write`、`Can_MainFunction_Read`、……）并将每次调用作为单个 JSON-RPC 请求转发。

```
[CanIf / CanTp / Com]
        |
    [Can.c]  -- TCP JSON-RPC -->  [EcuBus with Simulate-0 open]
                                        |
                                  Simulate-1 … N  (opened by Can.c)
```

### 当 TCP 服务器启动时

服务器**不会**在应用程序启动时启动。

- **GUI：**当项目启动且**至少有一个** Simulate CAN 设备时开始监听。当最后一个项目仿真设备关闭时停止。
- \*\*CLI `ecb_cli test`：\*\*打开项目中的每个设备。当至少打开一个 Simulate CAN 设备时，该命令期间监听器运行。
- **CLI `ecb_cli seq`：**仅打开该测试仪的 CAN 设备。当**该**设备为 Simulate 时监听器运行。仅包含另一个 Simulate 节点的项目不会监听。

默认绑定：`127.0.0.1:17320`（主页 → 设置 → **SIM-CAN**）。监听地址/端口仅为绑定设置；它们本身不会开启服务器。

Peak / Kvaser / Vector **不**在此 API 上暴露。

### 句柄所有权

| 谁            | 句柄                   | 结果                                       |
| ------------ | -------------------- | ---------------------------------------- |
| EcuBus（项目）   | Simulate-0           | 打开并拥有它                                   |
| `Can.c`      | Simulate-0（已打开）      | **被拒绝**（`already open`）                  |
| `Can.c`      | Simulate-1 …若空闲则为 63 | 在同一进程中打开。 `controllerId` **等于** `handle` |
| `Can.DeInit` |                      | 仅关闭 RPC 拥有的句柄。从不关闭项目 Simulate-0          |

该表是通常的实验室布局，项目在 Simulate-0 上。任何空闲句柄都可用：如果项目使用 Simulate-5，`Can.c` 可以打开句柄 0。 `controllerId` 始终是该句柄。

`sys.shutdown` 关闭 `Can.c` 打开的控制器，并保持 TCP 监听器运行。停止项目才会关闭端口。

先启动 EcuBus 项目（或 CLI seq/test），然后连接 `Can.c`。

POSIX 演示位于 [`resources/examples/mcal_can_rpc`](../../../../resources/examples/mcal_can_rpc/readme.md)。它初始化**句柄 1**（可选 2），而不是句柄 0。

### 线格式

- 传输：TCP。
- 分帧：**NDJSON**（一个 JSON 值 + `\n`）。也接受拼接的 JSON 和 LSP `Content-Length` 帧。
- 规范：[JSON-RPC 2.0](https://www.jsonrpc.org/specification)，包括批处理和通知（无 `id`）。
- 仅命名参数（`params` 是对象）。

请求/结果：

```json
{"jsonrpc":"2.0","method":"Can.Write","params":{"hth":0,"id":256,"sdu":[1,2,3,4],"swPduHandle":1},"id":1}
{"jsonrpc":"2.0","result":{"result":"E_OK","resultCode":0,"ts":1234},"id":1}
```

有效载荷：字节数组 `[1,2,3]` 或十六进制 `"01 02 03"`。 ID：`256`、`"256"` 或 `"0x100"`。

`Can.Write` 的 `E_NOT_OK` / `CAN_BUSY` 在 `result` 中返回，而不是作为 JSON-RPC 错误。

| 代码     | 含义                |
| ------ | ----------------- |
| -32700 | 解析错误              |
| -32600 | 无效请求              |
| -32601 | 方法未找到             |
| -32602 | 无效参数              |
| -32603 | 内部错误              |
| -32000 | CAN/驱动错误          |
| -32001 | 未找到控制器            |
| -32002 | 控制器未处于 STARTED 状态 |
| -32003 | 未找到 HTH / HRH     |
| -32005 | 句柄已打开/已初始化        |

### AUTOSAR 映射

| AUTOSAR API                       | JSON-RPC 方法                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `Can_Init`                        | `Can.Init`                                                                             |
| `Can_DeInit`                      | `Can.DeInit`                                                                           |
| `Can_GetVersionInfo`              | `Can.GetVersionInfo`                                                                   |
| `Can_SetControllerMode`           | `Can.SetControllerMode`（`CAN_T_START` / `CAN_T_STOP` / `CAN_T_SLEEP` / `CAN_T_WAKEUP`） |
| `Can_GetControllerMode`           | `Can.GetControllerMode`                                                                |
| `Can_DisableControllerInterrupts` | `Can.DisableControllerInterrupts`                                                      |
| `Can_EnableControllerInterrupts`  | `Can.EnableControllerInterrupts`                                                       |
| `Can_Write`                       | `Can.Write`                                                                            |
| `Can_GetControllerErrorState`     | `Can.GetControllerErrorState`                                                          |
| `Can_GetControllerTxErrorCounter` | `Can.GetControllerTxErrorCounter`                                                      |
| `Can_GetControllerRxErrorCounter` | `Can.GetControllerRxErrorCounter`                                                      |
| `Can_SetBaudrate`                 | `Can.SetBaudrate`                                                                      |
| `Can_CheckWakeup`                 | `Can.CheckWakeup`                                                                      |
| `Can_MainFunction_Write`          | `Can.MainFunction_Write` → `confirmations[]`                                           |
| `Can_MainFunction_Read`           | `Can.MainFunction_Read` → `indications[]`                                              |
| `Can_MainFunction_BusOff`         | `Can.MainFunction_BusOff`                                                              |
| `Can_MainFunction_Wakeup`         | `Can.MainFunction_Wakeup`                                                              |
| `Can_MainFunction_Mode`           | `Can.MainFunction_Mode`                                                                |

`Can.Init` 打开硬件，但使控制器保持 **STOPPED** 状态。在 `Can.Write` 之前，使用 `CAN_T_START` 调用 `Can.SetControllerMode`。

`controllerId` 是模拟句柄。当 EcuBus 已持有 Simulate-0 时的示例：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "Can.Init",
  "params": {
    "controllers": [
      { "vendor": "simulate", "handle": 1, "name": "MCU" }
    ]
  }
}
```

如果省略 `hardwareObjects`，默认硬件对象：

- HTH `handle * 2` — BASIC 发送
- HRH `handle * 2 + 1` — BASIC 接收，标准 ID，接受所有
- HRH `handle * 2 + 1000` — BASIC 接收，扩展 ID，接受所有

**轮询（典型 MCAL）：** 对每一项先调用 `Can_MainFunction_Read`，然后调用 `CanIf_RxIndication`。

**推送：** `can.subscribe`，然后通知 `can.rxIndication`、`can.txConfirmation`、`can.controllerBusOff`、`can.controllerModeIndication`、`can.controllerWakeup`、`can.error`。

低级 `can.open` / `can.write` / `can.read` 用于启动。生产环境的 `Can.c` 应使用 `Can.*` 方法。 `rpc.discover` 列出目录。

服务器监听期间保持一个 TCP 连接。不要每次成功 `Can_Write` 后都重新连接。

### 停止并重新连接

停止项目会关闭 TCP 服务器以及 `Can.c` 打开的模拟句柄。这不是 CAN 总线关闭，也不是控制器模式更改。 `Can.c` 不调用 `CanIf_ControllerModeIndication` 或 `CanIf_ControllerBusOff`。驱动保持 `CAN_READY`。当监听器关闭时，`Can_Write`、`Can_SetControllerMode`、`Can_GetControllerMode` 和 `Can_MainFunction_*` 返回而不调用 CanIf。

`CanGeneral/CanPcRpc` 上的两个预编译参数：

| 参数                          | 默认值  | 含义                                    |
| --------------------------- | ---- | ------------------------------------- |
| `CanRpcAutoReconnect`       | true | 监听器恢复后，下一次 Can API 调用会再次连接            |
| `CanRpcReconnectIntervalMs` | 500  | 两次尝试之间的最小毫秒数。 `0` 表示每次调用都重试。自动重连关闭时忽略 |

重连会使用相同的句柄和硬件对象发送 `Can.Init`，然后恢复 `CAN_CS_STARTED` 或 `CAN_CS_SLEEP`。 `CAN_CS_STOPPED` 已经是 `Can.Init` 之后的状态。不通知 CanIf，因为该模式已经是它已有的模式。注入的错误状态在重启后不会保留；新会话为 Error Active。 `Can_DeInit` 不会重连。

### 错误注入

从节点脚本调用 `injectCanError`。该节点上的 CAN 设备必须是 Simulate；Peak、Kvaser、Vector 及其他供应商会抛出异常。设备选择虚拟总线。该错误会应用于该总线上打开的每个 Can.c 控制器。没有单独的控制器参数。

```ts
await injectCanError('BUSOFF')
await injectCanError('ACTIVE', { device: 'SIM0' })
```

| 状态        | 默认计数器       | CanIf                                                                                                               |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `ACTIVE`  | TEC 0，REC 0 | 无；模式不变                                                                                                              |
| `PASSIVE` | TEC 128     | 无；模式保持 `CAN_CS_STARTED`；TX 和 RX 仍工作                                                                                 |
| `BUSOFF`  | TEC 256     | 仅 `CanIf_ControllerBusOff`。模式保持不变。 `Can_Write` 返回 `E_NOT_OK`。 `can.write` 和 `can.startPeriodSend` 被拒绝，正在运行的周期任务停止发送 |

总线关闭后调用 `Can_SetControllerMode(CAN_CS_STOPPED)` 才会产生 `CanIf_ControllerModeIndication(STOPPED)`。之后的 `CAN_CS_STARTED` 会将错误状态清除为 Active，并将计数器清零。

## 它不是什么

- 不是真实的收发器时序、ACK 或错误帧。
- 不是通往 Peak / Kvaser / Vector 的网关。这些供应商保持独立硬件。
- 不是第二个进程：不要运行两个 EcuBus 实例，它们都在同一端口上打开 simulate。
