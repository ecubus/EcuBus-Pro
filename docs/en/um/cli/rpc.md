# CLI JSON-RPC (PC MCAL-CAN)

`ecb_cli rpc` starts a **JSON-RPC 2.0** server so a PC implementation of an AUTOSAR **MCAL CAN** driver (typically written in C) can open EcuBus-Pro CAN adapters, transmit/receive frames, and poll `Can_MainFunction_*` style events.

The server is the hardware backend. Your C `Can.c` stays AUTOSAR-shaped (`Can_Init`, `Can_Write`, `Can_MainFunction_Read`, …) and forwards each call as one JSON-RPC request.

```
[AUTOSAR CanIf / COM]
        |
[PC Can.c  MCAL]  -- TCP JSON-RPC -->  [ecb_cli rpc]  -- vendor DLL -->  PEAK / Kvaser / Vector / simulate / ...
```

A POSIX C demo lives in [`resources/examples/mcal_can_rpc`](../../../../resources/examples/mcal_can_rpc/readme.md).

## Start the server

```bash
ecb_cli rpc -h
```

```bash
# TCP (default): 127.0.0.1:17320
ecb_cli rpc

# Bind another port / interface
ecb_cli rpc -H 127.0.0.1 -p 17320 --log-level=debug

# Use CAN devices from an EcuBus-Pro project when Can.Init has no controllers[]
ecb_cli rpc ./resources/examples/can/Can.ecb

# Open those project devices immediately (C code can skip Can.Init)
ecb_cli rpc ./project.ecb --auto-init

# Unix domain socket (Linux / macOS)
ecb_cli rpc --socket /tmp/ecb-rpc.sock

# One JSON object per line on stdin/stdout (logs go to stderr)
ecb_cli rpc --stdio
```

## Wire format

- Transport: TCP, Unix socket, or stdio.
- Framing: **NDJSON** (one JSON value + `\n`). Concatenated JSON and LSP `Content-Length` frames are also accepted.
- Spec: [JSON-RPC 2.0](https://www.jsonrpc.org/specification) including batches and notifications (no `id`).
- Named params only (`params` is an object). Easy to build from C.

Request:

```json
{"jsonrpc":"2.0","method":"Can.Write","params":{"hth":0,"id":256,"sdu":[1,2,3,4],"swPduHandle":1},"id":1}
```

Success / error:

```json
{"jsonrpc":"2.0","result":{"result":"E_OK","resultCode":0,"ts":1234},"id":1}
{"jsonrpc":"2.0","error":{"code":-32601,"message":"Method not found: foo"},"id":1}
```

CAN payload is accepted as a byte array `[1,2,3]` **or** a hex string `"01 02 03"` / `"0x010203"`. CAN ids accept `256`, `"256"`, or `"0x100"`.

### Error codes

| Code | Meaning |
| --- | --- |
| -32700 | Parse error |
| -32600 | Invalid Request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32000 | CAN / driver error |
| -32001 | Controller or device not found |
| -32002 | Controller not STARTED |
| -32003 | HTH / HRH not found |
| -32004 | Timeout |
| -32005 | Already initialized |

AUTOSAR `Can_Write` does **not** use JSON-RPC errors for `E_NOT_OK` / `CAN_BUSY`. Those are returned in `result`.

## Two API layers

| Layer | Methods | Use in C MCAL |
| --- | --- | --- |
| AUTOSAR-style | `Can.Init`, `Can.Write`, `Can.MainFunction_*`, … | Direct mapping of SWS_Can |
| Low-level | `can.open`, `can.write`, `can.read`, `can.subscribe`, … | Bring-up, debugging, non-AUTOSAR clients |

`rpc.discover` returns the full method catalog (names, params, AUTOSAR mapping).

Method names are case-sensitive where they would otherwise collide: `can.write` (low-level, uses `controllerId`) is not `Can.Write` (AUTOSAR, uses `hth`).

`sys.ping`, `sys.version`, `sys.listMethods`, `sys.shutdown` are always available.

`hw.listVendors`, `hw.listDevices`, `hw.getVersion` enumerate adapters (`simulate`, `peak`, `kvaser`, `vector`, `zlg`, `slcan`, `candle`, …).

## MCAL mapping

| AUTOSAR API | JSON-RPC method |
| --- | --- |
| `Can_Init` | `Can.Init` |
| `Can_DeInit` | `Can.DeInit` |
| `Can_GetVersionInfo` | `Can.GetVersionInfo` |
| `Can_SetControllerMode` | `Can.SetControllerMode` (`CAN_T_START` / `CAN_T_STOP` / `CAN_T_SLEEP` / `CAN_T_WAKEUP`) |
| `Can_GetControllerMode` | `Can.GetControllerMode` |
| `Can_DisableControllerInterrupts` | `Can.DisableControllerInterrupts` (nested) |
| `Can_EnableControllerInterrupts` | `Can.EnableControllerInterrupts` |
| `Can_Write` | `Can.Write` |
| `Can_GetControllerErrorState` | `Can.GetControllerErrorState` |
| `Can_GetControllerTxErrorCounter` | `Can.GetControllerTxErrorCounter` |
| `Can_GetControllerRxErrorCounter` | `Can.GetControllerRxErrorCounter` |
| `Can_SetBaudrate` | `Can.SetBaudrate` (controller must be STOPPED) |
| `Can_CheckWakeup` | `Can.CheckWakeup` |
| `Can_MainFunction_Write` | `Can.MainFunction_Write` → `confirmations[]` (`CanIf_TxConfirmation`) |
| `Can_MainFunction_Read` | `Can.MainFunction_Read` → `indications[]` (`CanIf_RxIndication`) |
| `Can_MainFunction_BusOff` | `Can.MainFunction_BusOff` |
| `Can_MainFunction_Wakeup` | `Can.MainFunction_Wakeup` |
| `Can_MainFunction_Mode` | `Can.MainFunction_Mode` |

Controller modes: `CAN_CS_UNINIT`, `CAN_CS_STOPPED`, `CAN_CS_STARTED`, `CAN_CS_SLEEP`.

`Can.Init` opens hardware but leaves controllers **STOPPED** (same as AUTOSAR). Call `Can.SetControllerMode` with `CAN_T_START` before `Can.Write`.

Default hardware objects if `hardwareObjects` is omitted:

- HTH `controllerId * 2` — BASIC transmit (dynamic CAN id)
- HRH `controllerId * 2 + 1` — BASIC receive, standard id, accept all
- HRH `controllerId * 2 + 1000` — BASIC receive, extended id, accept all

### `Can.Init` config

```json
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

`idMask: 0` means “accept all ids” of that `idType`. FULL transmit objects require a fixed `canId`. BASIC transmit objects take `id` in each `Can.Write`.

If a project file was passed on the CLI and `controllers` is omitted, every CAN device in the project is opened.

### `Can.Write`

```json
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

Returns `{ "result": "E_OK"|"E_NOT_OK"|"CAN_BUSY", "resultCode": 0|1|2, "ts": ... }`.

FULL HTHs allow one in-flight frame (`CAN_BUSY` otherwise). BASIC HTHs allow up to 8.

### Polling vs push notifications

**Polling (typical MCAL):** `Can_MainFunction_Read` in your C scheduler calls `Can.MainFunction_Read` and then `CanIf_RxIndication` for each item.

**Push:** `can.subscribe` then the server sends notifications (no `id`):

- `can.rxIndication`
- `can.txConfirmation`
- `can.controllerBusOff`
- `can.controllerModeIndication`
- `can.controllerWakeup`
- `can.error`

`Can_DisableControllerInterrupts` suppresses notifications (nested). MainFunction queues still fill.

## Low-level CAN methods

Useful when you are not wrapping AUTOSAR Hoh yet:

| Method | Role |
| --- | --- |
| `can.open` | Open vendor+handle, assign `controllerId`, start the controller |
| `can.close` | Close one or all |
| `can.list` | Controllers + Hoh map |
| `can.write` / `can.writeMany` | Send by controller id (bypass HTH) |
| `can.read` / `can.readPoll` | Drain this connection’s RX queue (`timeoutMs` to block) |
| `can.setMode` / `can.reset` | Mode and bus-off recovery |
| `can.getState` / `can.getBusLoading` | Mode, error state, load |
| `can.startPeriodSend` / `can.stopPeriodSend` / `can.changePeriodData` | Cyclic TX (software timer, or hardware timer when the vendor supports it) |

## C driver sketch

```c
Std_ReturnType Can_Write(Can_HwHandleType hth, const Can_PduType *pdu) {
    /* build JSON-RPC Can.Write with hth, pdu->id, pdu->sdu, pdu->swPduHandle */
    /* resultCode 0 -> E_OK, 2 -> CAN_BUSY, else E_NOT_OK */
}

void Can_MainFunction_Read(void) {
    /* call Can.MainFunction_Read, for each indication: CanIf_RxIndication(hrh, id, len, sdu) */
}
```

Keep a persistent TCP connection. Do not reconnect on every `Can_Write`.

## Simulate loopback (no hardware)

Open two `simulate` handles. A frame written on one appears as RX on the other (after ~1 ms):

```json
{"jsonrpc":"2.0","method":"can.open","params":{"vendor":"simulate","handle":0,"controllerId":0},"id":1}
{"jsonrpc":"2.0","method":"can.open","params":{"vendor":"simulate","handle":1,"controllerId":1},"id":2}
{"jsonrpc":"2.0","method":"can.write","params":{"controllerId":0,"id":"0x123","data":[1,2,3,4]},"id":3}
{"jsonrpc":"2.0","method":"can.read","params":{"controllerId":1,"timeoutMs":200},"id":4}
```

## GUI gateway (EcuBus client already running)

When the **EcuBus-Pro GUI** is running, the same JSON-RPC API is served from the application (default `127.0.0.1:17320`). You do **not** start `ecb_cli rpc` in that case — the GUI already owns the CAN adapters.

Enable/disable, host, and port are under **Home → Setting → General**. Click **Apply RPC** after changing bind settings. `sys.version` returns `"role": "gateway"`.

Direction:

| Source | What EcuBus shows | What the RPC client sees |
| --- | --- | --- |
| External `Can.Write` / `can.write` | **Tx** (`dir: OUT`) | TX confirmation (no self-echo as RX) |
| Hardware RX | Rx | RX indication |

RPC writes use the same `writeBase` path as the GUI, so they go out on the bus as Tx. Start the project in the GUI first so devices are open; `Can.Init` then returns the attached controllers. Do not run `ecb_cli rpc` on the same TCP port at the same time.
