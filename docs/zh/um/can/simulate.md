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
3. Set bitrate / CAN-FD like any other vendor.
4. Bind a DBC, Interactive table, node script, or UDS tester as usual.

Two project nodes on **different** handles (Simulate-0 and Simulate-1) also loop back to each other. That is useful when both sides are EcuBus scripts.

## PC AUTOSAR MCAL (JSON-RPC)

A C `Can.c` keeps AUTOSAR signatures (`Can_Init`, `Can_Write`, `Can_MainFunction_Read`, …) and forwards each call as one JSON-RPC request.

```
[CanIf / CanTp / Com]
        |
    [Can.c]  -- TCP JSON-RPC -->  [EcuBus with Simulate-0 open]
                                        |
                                  Simulate-1 … N  (opened by Can.c)
```

### When the TCP server starts

The server is **not** started at application boot.

- **GUI:** starts listening when the project starts with **at least one** Simulate CAN device. Stops when the last project simulate device closes.
- **CLI `ecb_cli test`:** opens every device in the project. The listener runs for that command when at least one opened device is Simulate CAN.
- **CLI `ecb_cli seq`:** opens only that tester's CAN device. The listener runs when **that** device is Simulate. A project that merely contains another Simulate node does not listen.

Default bind: `127.0.0.1:17320` (Home → Setting → **SIM-CAN**). Listen address/port are bind settings only; they do not turn the server on by themselves.

Peak / Kvaser / Vector are **not** exposed on this API.

### Handle ownership

| Who                                 | Handle                                       | Result                                                                         |
| ----------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| EcuBus (project) | Simulate-0                                   | Opens and owns it                                                              |
| `Can.c`                             | Simulate-0 (already open) | **Rejected** (`already open`)                               |
| `Can.c`                             | Simulate-1 … 63 if free                      | Opens in the same process. `controllerId` **equals** `handle`  |
| `Can.DeInit`                        |                                              | Closes only RPC-owned handles. Never closes project Simulate-0 |

The table is the usual lab layout, with the project on Simulate-0. Any free handle works: if the project uses Simulate-5, `Can.c` may open handle 0. `controllerId` is always that handle.

`sys.shutdown` closes the controllers `Can.c` opened and leaves the TCP listener up. Stopping the project is what closes the port.

Start the EcuBus project (or CLI seq/test) first, then connect `Can.c`.

A POSIX demo is in [`resources/examples/mcal_can_rpc`](../../../../resources/examples/mcal_can_rpc/readme.md). It inits **handle 1** (and optionally 2), not handle 0.

### Wire format

- Transport: TCP.
- Framing: **NDJSON** (one JSON value + `\n`). Concatenated JSON and LSP `Content-Length` frames are also accepted.
- Spec: [JSON-RPC 2.0](https://www.jsonrpc.org/specification), including batches and notifications (no `id`).
- Named params only (`params` is an object).

Request / result:

```json
{"jsonrpc":"2.0","method":"Can.Write","params":{"hth":0,"id":256,"sdu":[1,2,3,4],"swPduHandle":1},"id":1}
{"jsonrpc":"2.0","result":{"result":"E_OK","resultCode":0,"ts":1234},"id":1}
```

Payload: byte array `[1,2,3]` or hex `"01 02 03"`. IDs: `256`, `"256"`, or `"0x100"`.

`E_NOT_OK` / `CAN_BUSY` for `Can.Write` are returned in `result`, not as JSON-RPC errors.

| Code   | Meaning                                   |
| ------ | ----------------------------------------- |
| -32700 | Parse error                               |
| -32600 | Invalid Request                           |
| -32601 | Method not found                          |
| -32602 | Invalid params                            |
| -32603 | Internal error                            |
| -32000 | CAN / driver error                        |
| -32001 | Controller not found                      |
| -32002 | Controller not STARTED                    |
| -32003 | HTH / HRH not found                       |
| -32005 | Handle already open / already initialized |

### AUTOSAR mapping

| AUTOSAR API                       | JSON-RPC method                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Can_Init`                        | `Can.Init`                                                                                                 |
| `Can_DeInit`                      | `Can.DeInit`                                                                                               |
| `Can_GetVersionInfo`              | `Can.GetVersionInfo`                                                                                       |
| `Can_SetControllerMode`           | `Can.SetControllerMode` (`CAN_T_START` / `CAN_T_STOP` / `CAN_T_SLEEP` / `CAN_T_WAKEUP`) |
| `Can_GetControllerMode`           | `Can.GetControllerMode`                                                                                    |
| `Can_DisableControllerInterrupts` | `Can.DisableControllerInterrupts`                                                                          |
| `Can_EnableControllerInterrupts`  | `Can.EnableControllerInterrupts`                                                                           |
| `Can_Write`                       | `Can.Write`                                                                                                |
| `Can_GetControllerErrorState`     | `Can.GetControllerErrorState`                                                                              |
| `Can_GetControllerTxErrorCounter` | `Can.GetControllerTxErrorCounter`                                                                          |
| `Can_GetControllerRxErrorCounter` | `Can.GetControllerRxErrorCounter`                                                                          |
| `Can_SetBaudrate`                 | `Can.SetBaudrate`                                                                                          |
| `Can_CheckWakeup`                 | `Can.CheckWakeup`                                                                                          |
| `Can_MainFunction_Write`          | `Can.MainFunction_Write` → `confirmations[]`                                                               |
| `Can_MainFunction_Read`           | `Can.MainFunction_Read` → `indications[]`                                                                  |
| `Can_MainFunction_BusOff`         | `Can.MainFunction_BusOff`                                                                                  |
| `Can_MainFunction_Wakeup`         | `Can.MainFunction_Wakeup`                                                                                  |
| `Can_MainFunction_Mode`           | `Can.MainFunction_Mode`                                                                                    |

`Can.Init` opens hardware but leaves controllers **STOPPED**. Call `Can.SetControllerMode` with `CAN_T_START` before `Can.Write`.

`controllerId` is the simulate handle. Example when EcuBus already holds Simulate-0:

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

Default hardware objects if `hardwareObjects` is omitted:

- HTH `handle * 2` — BASIC transmit
- HRH `handle * 2 + 1` — BASIC receive, standard id, accept all
- HRH `handle * 2 + 1000` — BASIC receive, extended id, accept all

**Polling (typical MCAL):** `Can_MainFunction_Read` then `CanIf_RxIndication` for each item.

**Push:** `can.subscribe`, then notifications `can.rxIndication`, `can.txConfirmation`, `can.controllerBusOff`, `can.controllerModeIndication`, `can.controllerWakeup`, `can.error`.

Low-level `can.open` / `can.write` / `can.read` are for bring-up. Production `Can.c` should use the `Can.*` methods. `rpc.discover` lists the catalog.

Keep one TCP connection while the server is listening. Do not reconnect on every successful `Can_Write`.

### Stop and reconnect

Stopping the project closes the TCP server and the simulate handles `Can.c` opened. That is not a CAN bus-off and not a controller mode change. `Can.c` does not call `CanIf_ControllerModeIndication` or `CanIf_ControllerBusOff`. The driver stays `CAN_READY`. While the listener is down, `Can_Write`, `Can_SetControllerMode`, `Can_GetControllerMode`, and `Can_MainFunction_*` return without calling CanIf.

Two pre-compile parameters on `CanGeneral/CanPcRpc`:

| Parameter                   | Default | Meaning                                                                                                                              |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `CanRpcAutoReconnect`       | true    | The next Can API call connects again after the listener is back                                                                      |
| `CanRpcReconnectIntervalMs` | 500     | Minimum milliseconds between attempts. `0` retries on every call. Ignored when auto reconnect is off |

Reconnect sends `Can.Init` with the same handles and hardware objects, then restores `CAN_CS_STARTED` or `CAN_CS_SLEEP`. `CAN_CS_STOPPED` is already the state after `Can.Init`. CanIf is not notified, because that mode is the one it already has. An injected error state does not survive the restart; the new session is Error Active. `Can_DeInit` does not reconnect.

### Error injection

Call `injectCanError` from a node script. The CAN device on that node must be Simulate; Peak, Kvaser, Vector, and the other vendors throw. The device selects the virtual bus. The error is applied to every Can.c controller open on that bus. There is no separate controller argument.

```ts
await injectCanError('BUSOFF')
await injectCanError('ACTIVE', { device: 'SIM0' })
```

| State     | Default counters | CanIf                                                                                                                                                                                                                                 |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ACTIVE`  | TEC 0, REC 0     | none; mode unchanged                                                                                                                                                                                                                  |
| `PASSIVE` | TEC 128          | none; mode stays `CAN_CS_STARTED`; TX and RX still work                                                                                                                                                                               |
| `BUSOFF`  | TEC 256          | `CanIf_ControllerBusOff` only. Mode stays unchanged. `Can_Write` returns `E_NOT_OK`. `can.write` and `can.startPeriodSend` are rejected, and a running period task stops transmitting |

`Can_SetControllerMode(CAN_CS_STOPPED)` after bus-off is what produces `CanIf_ControllerModeIndication(STOPPED)`. A later `CAN_CS_STARTED` clears the error state to Active and zeros the counters.

## What it is not

- Not real transceiver timing, ACK, or error frames.
- Not a gateway onto Peak / Kvaser / Vector. Those vendors stay independent hardware.
- Not a second process: do not run two EcuBus instances that both open simulate on the same port.
