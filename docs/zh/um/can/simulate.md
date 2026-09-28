# Simulate CAN

Simulate CAN 是 EcuBus-Pro 的 **软件虚拟 CAN 总线**。不需要适配器、厂商 DLL 或 USB 设备。可在同一条虚拟网络上开发脚本、UDS 测试仪，以及 PC 端 AUTOSAR MCAL（`Can.c`）。

对应 ETAS VirtualCan：Peak / Kvaser / Vector 仍是真实硬件；Simulate 是进程内总线。

## 能力

| 能力 | 说明 |
| --- | --- |
| 通道 | 64 个句柄：**Simulate-0** … **Simulate-63** |
| 协议 | CAN 与 CAN-FD |
| 平台 | Windows、Linux、macOS（无需厂商 SDK） |
| EcuBus 功能 | DBC、Interactive、节点脚本、UDS、Trace |
| PC MCAL | 至少一个 Simulate 设备**已打开**时提供 JSON-RPC 2.0 TCP |

## 虚拟总线

每个**已打开**的 simulate 句柄都是**同一条**共享总线上的节点。

- 在 Simulate-0 上发送的帧，会在其他已打开句柄（Simulate-1…）上作为 **RX** 接收。
- 节点**不会**把自己的 TX 看成 RX。
- 同一进程中同一句柄只能打开一次（`BUS ALREADY INIT`）。

典型布局：

```
EcuBus 工程：  Simulate-0   （测试仪 / 脚本 / Trace）
PC Can.c：     Simulate-1 … N   （虚拟 ECU，经 JSON-RPC 打开）
               └── 同一条虚拟总线 ──
```

### Trace

EcuBus Trace **只显示工程里的设备**。若工程只有 Simulate-0：

| 事件 | Simulate-0 上的 Trace |
| --- | --- |
| 脚本 / Interactive / UDS 发送 | **TX** |
| `Can.c` 在 Simulate-1 上发送 | **RX** |

Simulate-1 不是工程硬件节点，不会作为第二条 Trace 通道出现。

## 在 EcuBus 中使用

1. 硬件 → **Simulate** → 添加 CAN 节点。
2. 选择空闲句柄（从 Simulate-0 开始）。
3. 与其他厂商一样配置波特率 / CAN-FD。
4. 按需绑定 DBC、Interactive、节点脚本或 UDS。

工程中两个**不同句柄**的节点（Simulate-0 与 Simulate-1）也会互相回环，适合两侧都是 EcuBus 脚本的场景。

## PC AUTOSAR MCAL（JSON-RPC）

C 语言 `Can.c` 保持 AUTOSAR 签名（`Can_Init`、`Can_Write`、`Can_MainFunction_Read` 等），每次调用对应一次 JSON-RPC 请求。

```
[CanIf / CanTp / Com]
        |
    [Can.c]  -- TCP JSON-RPC -->  [已打开 Simulate-0 的 EcuBus]
                                        |
                                  Simulate-1 … N  （由 Can.c 打开）
```

### TCP 服务器何时启动

**不会**在应用启动时监听。

- **GUI：** 工程启动且至少有一个 Simulate CAN 设备时开始监听；最后一个工程 simulate 关闭时停止。
- **CLI：** 对包含 Simulate CAN 的 `.ecb` 运行 `ecb_cli seq` 或 `ecb_cli test` 时，在该命令生命周期内同样监听。

默认绑定：`127.0.0.1:17320`（主页 → 设置 → **SIM-CAN**）。监听地址/端口只是绑定配置，不会单独打开服务器。

Peak / Kvaser / Vector **不会**出现在此 API 中。

### 句柄所有权

| 谁 | 句柄 | 结果 |
| --- | --- | --- |
| EcuBus（工程） | Simulate-0 | 打开并持有 |
| `Can.c` | 已被打开的 Simulate-0 | **拒绝**（already open） |
| `Can.c` | 空闲的 Simulate-1 … 63 | 在同一进程中打开。`controllerId` **等于** `handle` |
| `Can.DeInit` | | 只关闭 RPC 打开的句柄，绝不关闭工程的 Simulate-0 |

先启动 EcuBus 工程（或 CLI seq/test），再连接 `Can.c`。

POSIX 示例见 [`resources/examples/mcal_can_rpc`](../../../../resources/examples/mcal_can_rpc/readme.md)。它初始化 **handle 1**（以及可选的 2），而不是 handle 0。

### 线路格式

- 传输：TCP。
- 分帧：**NDJSON**（一个 JSON 值 + `\n`）。也接受拼接 JSON 与 LSP `Content-Length`。
- 规范：[JSON-RPC 2.0](https://www.jsonrpc.org/specification)，含批处理与通知（无 `id`）。
- 仅命名参数（`params` 为对象）。

`Can.Write` 的 `E_NOT_OK` / `CAN_BUSY` 放在 `result` 中，不是 JSON-RPC error。

`controllerId` 就是 simulate 句柄。当 EcuBus 已占用 Simulate-0 时：

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

省略 `hardwareObjects` 时的默认硬件对象：

- HTH `handle * 2` — BASIC 发送
- HRH `handle * 2 + 1` — BASIC 接收，标准 ID，全接收
- HRH `handle * 2 + 1000` — BASIC 接收，扩展 ID，全接收

AUTOSAR API 与 `Can.*` 方法一一对应（`Can_Init` → `Can.Init`，`Can_Write` → `Can.Write`，`Can_MainFunction_*` 等）。完整目录见 `rpc.discover`。

服务在监听时保持一条 TCP 连接。不要在每次成功的 `Can_Write` 上重连。

### 停止与重连

停止工程会关闭 TCP 服务，并关闭 `Can.c` 打开的 simulate 句柄。这不是 CAN bus-off，也不是控制器模式变化。`Can.c` 不调用 `CanIf_ControllerModeIndication` 或 `CanIf_ControllerBusOff`。驱动保持 `CAN_READY`。监听未恢复时，`Can_Write`、`Can_SetControllerMode`、`Can_GetControllerMode` 和 `Can_MainFunction_*` 直接返回，不通知 CanIf。

`CanGeneral/CanPcRpc` 上的两个预编译参数：

| 参数 | 默认 | 含义 |
| --- | --- | --- |
| `CanRpcAutoReconnect` | true | 监听恢复后，下一次 Can API 调用会重新连接 |
| `CanRpcReconnectIntervalMs` | 500 | 两次尝试的最小间隔（毫秒）。`0` 表示每次调用都重试。自动重连关闭时忽略 |

重连会用相同的句柄和硬件对象再次发送 `Can.Init`，然后恢复 `CAN_CS_STARTED` 或 `CAN_CS_SLEEP`。`CAN_CS_STOPPED` 已是 `Can.Init` 之后的状态。不通知 CanIf，因为该模式本来就是 CanIf 当前认为的模式。注入的错误状态不会保留；新会话从 Error Active 开始。`Can_DeInit` 不会重连。

### 错误注入

只从节点脚本调用 `injectCanError`。节点上的 CAN 设备必须是 Simulate，Peak、Kvaser、Vector 等其他厂商会报错。设备就是这条虚拟总线，错误会加到这条总线上所有已打开的 Can.c 控制器。没有单独的 controller 参数。

```ts
await injectCanError('BUSOFF')
await injectCanError('ACTIVE', { device: 'SIM0' })
```

| 状态 | 默认计数 | CanIf |
| --- | --- | --- |
| `ACTIVE` | TEC 0，REC 0 | 无回调；模式不变 |
| `PASSIVE` | TEC 128 | 无回调；模式保持 `CAN_CS_STARTED`；收发仍可用 |
| `BUSOFF` | TEC 256 | 只调用 `CanIf_ControllerBusOff`。模式不变。`Can_Write` 返回 `E_NOT_OK` |

Bus-off 之后由 `Can_SetControllerMode(CAN_CS_STOPPED)` 产生 `CanIf_ControllerModeIndication(STOPPED)`。随后的 `CAN_CS_STARTED` 把错误状态清回 Active，并把计数清零。

## 不是什么

- 不是真实收发器时序、ACK 或错误帧。
- 不是把 Peak / Kvaser / Vector 接到 RPC 上的网关。那些厂商仍是独立硬件。
- 不要同时运行两个都会打开 simulate 且占用同一端口的 EcuBus 进程。
