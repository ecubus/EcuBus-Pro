# CLI JSON-RPC (PC MCAL-CAN)

`ecb_cli rpc` 启动一个 **JSON-RPC 2.0** 服务器，使得AUTOSAR **MCAL CAN** 驱动（通常用C语言编写）的PC实现可以打开 EcuBus-Pro CAN 适配器，收发帧，并轮询 `Can_MainFunction_*` 风格的事件。

服务器是硬件后端。 您的C代码 `Can.c` 保持AUTOSAR风格（`Can_Init`、`Can_Write`、`Can_MainFunction_Read`，……） 并在每次调用时转发为一条 JSON-RPC 请求。

````
```
[AUTOSAR CanIf / COM]
        |
[PC Can.c  MCAL]  -- TCP JSON-RPC -->  [ecb_cli rpc]  -- vendor DLL -->  PEAK / Kvaser / Vector / simulate / ...
```
````

一个 POSIX C 示例位于 [`resources/examples/mcal_can_rpc`](../../../../resources/examples/mcal_can_rpc/readme.md)。

## 启动服务器

````bash
```
ecb_cli rpc -h
```
````

````bash
```
# TCP (默认): 127.0.0.1:17320
ecb_cli rpc

# 绑定其他端口/接口
ecb_cli rpc -H 127.0.0.1 -p 17320 --log-level=debug

# 当 Can.Init 没有控制器[]时，使用 EcuBus-Pro 项目中的 CAN 设备
ecb_cli rpc ./resources/examples/can/Can.ecb

# 立即打开这些项目设备（C代码可跳过 Can.Init）
ecb_cli rpc ./project.ecb --auto-init

# Unix 域套接字（Linux / macOS）
ecb_cli rpc --socket /tmp/ecb-rpc.sock

# 标准输入输出上每行一个 JSON 对象（日志输出到 stderr）
ecb_cli rpc --stdio
```
````

## 线格式

- 传输方式：TCP、Unix 套接字或 stdio。
- 帧格式：**NDJSON**（一个 JSON 值 + `\n`）。 也接受拼接的 JSON 和 LSP `Content-Length` 帧。
- 规格：[JSON-RPC 2.0](https://www.jsonrpc.org/specification) 包括批处理与通知（无 `id`）。
- 仅提供命名参数（`params` 为对象）。 易于从C语言构建。

请求：

````json
```
{"jsonrpc":"2.0","method":"Can.Write","params":{"hth":0,"id":256,"sdu":[1,2,3,4],"swPduHandle":1},"id":1}
```
````

成功 / 错误：

````json
```
{"jsonrpc":"2.0","result":{"result":"E_OK","resultCode":0,"ts":1234},"id":1}
{"jsonrpc":"2.0","error":{"code":-32601,"message":"Method not found: foo"},"id":1}
```
````

CAN 有效载荷可接受为字节数组 `[1,2,3]` **或**十六进制字符串 `"01 02 03"` / `"0x010203"`。 CAN ID 接受 `256`、`"256"` 或 `"0x100"`。

### 错误码

| 代码     | 含义            |
| ------ | ------------- |
| -32700 | 解析错误          |
| -32600 | 无效请求          |
| -32601 | 方法未找到         |
| -32602 | 无效参数          |
| -32603 | 内部错误          |
| -32000 | CAN / 驱动错误    |
| -32001 | 控制器或设备未找到     |
| -32002 | 控制器未启动        |
| -32003 | HTH / HRH 未找到 |
| -32004 | 超时            |
| -32005 | 已初始化          |

AUTOSAR `Can_Write` **不**使用 JSON-RPC 错误来表示 `E_NOT_OK` / `CAN_BUSY`。 这些在 `result` 中返回。

## 两个 API 层

| 层          | 方法                                                   | 在 C MCAL 中使用                      |
| ---------- | ---------------------------------------------------- | --------------------------------- |
| AUTOSAR 风格 | `Can.Init`、`Can.Write`、`Can.MainFunction_*`，……       | 直接映射 SWS_Can |
| 底层         | `can.open`、`can.write`、`can.read`、`can.subscribe`，…… | 启动、调试、非 AUTOSAR 客户端               |

`rpc.discover` 返回完整的方法目录（名称、参数、AUTOSAR 映射）。

方法名区分大小写，以避免冲突：`can.write`（底层，使用 `controllerId`）不是 `Can.Write`（AUTOSAR，使用 `hth`）。

`sys.ping`、`sys.version`、`sys.listMethods`、`sys.shutdown` 始终可用。

`hw.listVendors`、`hw.listDevices`、`hw.getVersion` 枚举适配器（`simulate`、`peak`、`kvaser`、`vector`、`zlg`、`slcan`、`candle`，……）。

## MCAL 映射

| AUTOSAR API                       | JSON-RPC 方法                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `Can_Init`                        | `Can.Init`                                                                             |
| `Can_DeInit`                      | `Can.DeInit`                                                                           |
| `Can_GetVersionInfo`              | `Can.GetVersionInfo`                                                                   |
| `Can_SetControllerMode`           | `Can.SetControllerMode`（`CAN_T_START` / `CAN_T_STOP` / `CAN_T_SLEEP` / `CAN_T_WAKEUP`） |
| `Can_GetControllerMode`           | `Can.GetControllerMode`                                                                |
| `Can_DisableControllerInterrupts` | `Can.DisableControllerInterrupts`（可嵌套）                                                 |
| `Can_EnableControllerInterrupts`  | `Can.EnableControllerInterrupts`                                                       |
| `Can_Write`                       | `Can.Write`                                                                            |
| `Can_GetControllerErrorState`     | `Can.GetControllerErrorState`                                                          |
| `Can_GetControllerTxErrorCounter` | `Can.GetControllerTxErrorCounter`                                                      |
| `Can_GetControllerRxErrorCounter` | `Can.GetControllerRxErrorCounter`                                                      |
| `Can_SetBaudrate`                 | `Can.SetBaudrate`（控制器必须处于 `STOPPED` 状态）                                                |
| `Can_CheckWakeup`                 | `Can.CheckWakeup`                                                                      |
| `Can_MainFunction_Write`          | `Can.MainFunction_Write` → `confirmations[]`（`CanIf_TxConfirmation`）                   |
| `Can_MainFunction_Read`           | `Can.MainFunction_Read` → `indications[]`（`CanIf_RxIndication`）                        |
| `Can_MainFunction_BusOff`         | `Can.MainFunction_BusOff`                                                              |
| `Can_MainFunction_Wakeup`         | `Can.MainFunction_Wakeup`                                                              |
| `Can_MainFunction_Mode`           | `Can.MainFunction_Mode`                                                                |

控制器模式：`CAN_CS_UNINIT`、`CAN_CS_STOPPED`、`CAN_CS_STARTED`、`CAN_CS_SLEEP`。

`Can.Init` 打开硬件但将控制器保持为 **STOPPED**（与 AUTOSAR 相同）。 在 `Can.Write` 之前，使用 `CAN_T_START` 调用 `Can.SetControllerMode`。

如果省略 `hardwareObjects`，默认硬件对象为：

- HTH `controllerId * 2` — 基本发送（动态 CAN ID）
- HRH `controllerId * 2 + 1` — 基本接收，标准 ID，接受所有
- HRH `controllerId * 2 + 1000` — 基本接收，扩展 ID，接受所有

### `Can.Init` 配置

````json
```
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "Can.Init",
  "params": {
    "controllers": [
      {
        "controllerId": 0,
        "vendor": "simulate",
        "handle": 0,
        "name": "CanCtrl_0",
        "canfd": false,
        "bitrate": { "freq": 500000 }
      }
    ],
    "hardwareObjects": [
      {
        "hohId": 0,
        "controllerId": 0,
        "objectType": "TRANSMIT",
        "handleType": "BASIC",
        "idType": "STANDARD"
      },
      {
        "hohId": 1,
        "controllerId": 0,
        "objectType": "RECEIVE",
        "handleType": "BASIC",
        "idType": "STANDARD",
        "canId": 0,
        "idMask": 0
      }
    ],
    "baudRateConfigs": {
      "0": { "bitrate": { "freq": 500000 } },
      "1": { "bitrate": { "freq": 250000 } }
    }
  }
}
```
````

`idMask: 0` 表示“接受该 `idType` 的所有 ID”。 FULL 发送对象需要固定的 `canId`。 BASIC 发送对象在每次 `Can.Write` 中接受 `id`。

如果在 CLI 上传递了项目文件且省略 `controllers`，则将打开项目中的每个 CAN 设备。

### `Can.Write`

````json
```
{
  "hth": 0,
  "swPduHandle": 1,
  "id": "0x100",
  "sdu": [1, 2, 3, 4, 5, 6, 7, 8],
  "idType": "STANDARD",
  "canfd": false,
  "brs": false
}
```
````

返回 `{ "result": "E_OK"|"E_NOT_OK"|"CAN_BUSY", "resultCode": 0|1|2, "ts": ... }`。

FULL HTH 允许一个在途帧（否则返回 `CAN_BUSY`）。 BASIC HTH 最多允许 8 个。

### 轮询 vs 推送通知

**轮询（典型 MCAL）：** C 调度器中的 `Can_MainFunction_Read` 调用 `Can.MainFunction_Read`，然后针对每个项调用 `CanIf_RxIndication`。

**推送：** `can.subscribe` 然后服务器发送通知（无 `id`）：

- `can.rxIndication`
- `can.txConfirmation`
- `can.controllerBusOff`
- `can.controllerModeIndication`
- `can.controllerWakeup`
- `can.error`

`Can_DisableControllerInterrupts` 抑制通知（可嵌套）。 MainFunction 队列仍会填充。

## 底层 CAN 方法

当您尚未包装 AUTOSAR HOH 时很有用：

| 方法                                                                    | 作用                               |
| --------------------------------------------------------------------- | -------------------------------- |
| `can.open`                                                            | 打开供应商+句柄，分配 `controllerId`，启动控制器 |
| `can.close`                                                           | 关闭一个或全部                          |
| `can.list`                                                            | 控制器 + HOH 映射                     |
| `can.write` / `can.writeMany`                                         | 按控制器 ID 发送（绕过 HTH）               |
| `can.read` / `can.readPoll`                                           | 排空此连接的 RX 队列（`timeoutMs` 用于阻塞）   |
| `can.setMode` / `can.reset`                                           | 模式与总线关闭恢复                        |
| `can.getState` / `can.getBusLoading`                                  | 模式、错误状态、负载                       |
| `can.startPeriodSend` / `can.stopPeriodSend` / `can.changePeriodData` | 周期发送（软件定时器，或硬件定时器（如果供应商支持））      |

## C 驱动示例

````c
```
Std_ReturnType Can_Write(Can_HwHandleType hth, const Can_PduType *pdu) {
    /* 构建 JSON-RPC Can.Write，包含 hth、pdu->id、pdu->sdu、pdu->swPduHandle */
    /* resultCode 0 -> E_OK, 2 -> CAN_BUSY, 否则 E_NOT_OK */
}

void Can_MainFunction_Read(void) {
    /* 调用 Can.MainFunction_Read，对于每个指示：CanIf_RxIndication(hrh, id, len, sdu) */
}
```
````

保持持久的 TCP 连接。 不要每次 `Can_Write` 都重新连接。

## 模拟环回（无硬件）

打开两个 `simulate` 句柄。 一个句柄上写入的帧会在另一个句柄上显示为 RX（约 1 毫秒后）：

````json
```
{"jsonrpc":"2.0","method":"can.open","params":{"vendor":"simulate","handle":0,"controllerId":0},"id":1}
{"jsonrpc":"2.0","method":"can.open","params":{"vendor":"simulate","handle":1,"controllerId":1},"id":2}
{"jsonrpc":"2.0","method":"can.write","params":{"controllerId":0,"id":"0x123","data":[1,2,3,4]},"id":3}
{"jsonrpc":"2.0","method":"can.read","params":{"controllerId":1,"timeoutMs":200},"id":4}
```
````

## GUI 网关（EcuBus 客户端已在运行）

当 **EcuBus-Pro GUI** 运行时，相同的 JSON-RPC API 由应用程序提供（默认 `127.0.0.1:17320`）。 在这种情况下，您**无需**启动 `ecb_cli rpc` — GUI 已拥有 CAN 适配器。

启用/禁用、主机和端口位于 **Home → Setting → General** 下。 更改绑定设置后，点击 **Apply RPC**。 `sys.version` 返回 `"role": "gateway"`。

方向：

| 来源                           | EcuBus 显示的内容                           | RPC 客户端看到的内容     |
| ---------------------------- | -------------------------------------- | ---------------- |
| 外部 `Can.Write` / `can.write` | **Tx** (`dir: OUT`) | TX 确认（无自回显作为 RX） |
| 硬件 RX                        | Rx                                     | RX 指示            |

RPC 写入使用与 GUI 相同的 `writeBase` 路径，因此它们作为 Tx 发送到总线上。 先在 GUI 中启动项目以便设备打开；然后 `Can.Init` 返回附加的控制器。 不要同时在相同的 TCP 端口上运行 `ecb_cli rpc`。
