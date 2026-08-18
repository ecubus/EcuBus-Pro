# CLI JSON-RPC（PC 版 MCAL-CAN）

`ecb_cli rpc` 会启动一个 **JSON-RPC 2.0** 服务，让 PC 上用 C 实现的 AUTOSAR **MCAL CAN** 驱动可以打开 EcuBus-Pro 的 CAN 适配器、收发报文，并按 `Can_MainFunction_*` 的方式轮询事件。

服务端负责真正的硬件。你的 `Can.c` 仍保持 AUTOSAR 形态（`Can_Init`、`Can_Write`、`Can_MainFunction_Read` 等），每个 API 对应一次 JSON-RPC 调用。

```
[AUTOSAR CanIf / COM]
        |
[PC Can.c  MCAL]  -- TCP JSON-RPC -->  [ecb_cli rpc]  -- 厂商库 -->  PEAK / Kvaser / Vector / simulate / ...
```

POSIX C 示例见 [`resources/examples/mcal_can_rpc`](../../../../resources/examples/mcal_can_rpc/readme.zh.md)。

## 启动服务

```bash
ecb_cli rpc -h
```

```bash
# TCP（默认）：127.0.0.1:17320
ecb_cli rpc

# 指定地址和端口
ecb_cli rpc -H 127.0.0.1 -p 17320 --log-level=debug

# Can.Init 未提供 controllers[] 时，使用工程里的 CAN 设备
ecb_cli rpc ./resources/examples/can/Can.ecb

# 启动时立刻打开工程设备（C 侧可省略 Can.Init）
ecb_cli rpc ./project.ecb --auto-init

# Unix domain socket（Linux / macOS）
ecb_cli rpc --socket /tmp/ecb-rpc.sock

# 标准输入/输出，每行一个 JSON（日志打到 stderr）
ecb_cli rpc --stdio
```

## 报文格式

- 传输：TCP、Unix socket 或 stdio。
- 分帧：**NDJSON**（一个 JSON + `\n`）。也接受首尾相连的 JSON，以及 LSP 风格的 `Content-Length`。
- 规范：[JSON-RPC 2.0](https://www.jsonrpc.org/specification)，包含 batch 和通知（无 `id`）。
- 只使用命名参数（`params` 为对象），方便 C 拼 JSON。

请求：

```json
{"jsonrpc":"2.0","method":"Can.Write","params":{"hth":0,"id":256,"sdu":[1,2,3,4],"swPduHandle":1},"id":1}
```

成功 / 失败：

```json
{"jsonrpc":"2.0","result":{"result":"E_OK","resultCode":0,"ts":1234},"id":1}
{"jsonrpc":"2.0","error":{"code":-32601,"message":"Method not found: foo"},"id":1}
```

CAN 数据可以是字节数组 `[1,2,3]` **或** hex 字符串 `"01 02 03"` / `"0x010203"`。CAN id 可以是 `256`、`"256"` 或 `"0x100"`。

### 错误码

| 代码 | 含义 |
| --- | --- |
| -32700 | 解析错误 |
| -32600 | 非法请求 |
| -32601 | 方法不存在 |
| -32602 | 参数非法 |
| -32603 | 内部错误 |
| -32000 | CAN / 驱动错误 |
| -32001 | 控制器或设备不存在 |
| -32002 | 控制器未 STARTED |
| -32003 | HTH / HRH 不存在 |
| -32004 | 超时 |
| -32005 | 已经初始化 |

AUTOSAR 的 `Can_Write` 对 `E_NOT_OK` / `CAN_BUSY` **不会**走 JSON-RPC error，而是放在 `result` 里。

## 两层 API

| 层次 | 方法 | C MCAL 中的用途 |
| --- | --- | --- |
| AUTOSAR 风格 | `Can.Init`、`Can.Write`、`Can.MainFunction_*` 等 | 直接对应 SWS_Can |
| 底层 | `can.open`、`can.write`、`can.read`、`can.subscribe` 等 | 调试、非 AUTOSAR 客户端 |

`rpc.discover` 返回完整方法目录（名称、参数、AUTOSAR 对应关系）。

`sys.ping`、`sys.version`、`sys.listMethods`、`sys.shutdown` 始终可用。

`hw.listVendors`、`hw.listDevices`、`hw.getVersion` 用于枚举适配器。

## MCAL 映射

| AUTOSAR API | JSON-RPC 方法 |
| --- | --- |
| `Can_Init` | `Can.Init` |
| `Can_DeInit` | `Can.DeInit` |
| `Can_GetVersionInfo` | `Can.GetVersionInfo` |
| `Can_SetControllerMode` | `Can.SetControllerMode`（`CAN_T_START` / `CAN_T_STOP` / `CAN_T_SLEEP` / `CAN_T_WAKEUP`） |
| `Can_GetControllerMode` | `Can.GetControllerMode` |
| `Can_DisableControllerInterrupts` | `Can.DisableControllerInterrupts`（可嵌套） |
| `Can_EnableControllerInterrupts` | `Can.EnableControllerInterrupts` |
| `Can_Write` | `Can.Write` |
| `Can_GetControllerErrorState` | `Can.GetControllerErrorState` |
| `Can_GetControllerTxErrorCounter` | `Can.GetControllerTxErrorCounter` |
| `Can_GetControllerRxErrorCounter` | `Can.GetControllerRxErrorCounter` |
| `Can_SetBaudrate` | `Can.SetBaudrate`（控制器须为 STOPPED） |
| `Can_CheckWakeup` | `Can.CheckWakeup` |
| `Can_MainFunction_Write` | `Can.MainFunction_Write` → `confirmations[]`（`CanIf_TxConfirmation`） |
| `Can_MainFunction_Read` | `Can.MainFunction_Read` → `indications[]`（`CanIf_RxIndication`） |
| `Can_MainFunction_BusOff` | `Can.MainFunction_BusOff` |
| `Can_MainFunction_Wakeup` | `Can.MainFunction_Wakeup` |
| `Can_MainFunction_Mode` | `Can.MainFunction_Mode` |

控制器模式：`CAN_CS_UNINIT`、`CAN_CS_STOPPED`、`CAN_CS_STARTED`、`CAN_CS_SLEEP`。

`Can.Init` 打开硬件后控制器处于 **STOPPED**（与 AUTOSAR 一致）。发送前需要 `Can.SetControllerMode` + `CAN_T_START`。

未提供 `hardwareObjects` 时的默认 Hoh：

- HTH `controllerId * 2` — BASIC 发送（动态 CAN id）
- HRH `controllerId * 2 + 1` — BASIC 接收，标准帧，接收全部
- HRH `controllerId * 2 + 1000` — BASIC 接收，扩展帧，接收全部

### `Can.Write`

```json
{
  "hth": 0,
  "swPduHandle": 1,
  "id": "0x100",
  "sdu": [1, 2, 3, 4, 5, 6, 7, 8],
  "idType": "STANDARD"
}
```

返回 `{ "result": "E_OK"|"E_NOT_OK"|"CAN_BUSY", "resultCode": 0|1|2, "ts": ... }`。

FULL HTH 同时只允许 1 帧在途（否则 `CAN_BUSY`）。BASIC HTH 最多 8 帧。

### 轮询与推送

**轮询（MCAL 常用）：** C 调度里 `Can_MainFunction_Read` 调用 `Can.MainFunction_Read`，再对每条调用 `CanIf_RxIndication`。

**推送：** `can.subscribe` 后，服务端发送通知（无 `id`）：`can.rxIndication`、`can.txConfirmation`、`can.controllerBusOff` 等。

`Can_DisableControllerInterrupts` 会抑制通知（可嵌套），MainFunction 队列仍会填充。

## 底层 CAN 方法

尚未封装 AUTOSAR Hoh 时可以使用：`can.open` / `can.write` / `can.read` / `can.subscribe` / `can.startPeriodSend` 等。`can.open` 打开后会直接进入 STARTED。

## Simulate 回环（无硬件）

打开两个 `simulate` handle，在其中一个上发送的帧会出现在另一个的 RX 中（约 1 ms）：

```json
{"jsonrpc":"2.0","method":"can.open","params":{"vendor":"simulate","handle":0,"controllerId":0},"id":1}
{"jsonrpc":"2.0","method":"can.open","params":{"vendor":"simulate","handle":1,"controllerId":1},"id":2}
{"jsonrpc":"2.0","method":"can.write","params":{"controllerId":0,"id":"0x123","data":[1,2,3,4]},"id":3}
{"jsonrpc":"2.0","method":"can.read","params":{"controllerId":1,"timeoutMs":200},"id":4}
```
