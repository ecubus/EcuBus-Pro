# SIM-CAN

Home → Setting → **SIM-CAN** configures the JSON-RPC TCP bind used by a PC AUTOSAR `Can.c` to join [Simulate CAN](../can/simulate.md).

The server **does not listen at application boot**. It starts only after this process opens at least one Simulate CAN device.

## JSON-RPC

Enable or disable the Simulate CAN JSON-RPC API. When off, `Can.c` cannot connect even if a Simulate device is running.

## Listen address

TCP **bind address** of the local server — the interface EcuBus listens on. It is not a remote hostname you connect *to*.

| Value | Meaning |
| --- | --- |
| `127.0.0.1` (default) | Only `Can.c` on **this PC** can connect |
| `0.0.0.0` | Listen on all interfaces so another machine can connect |

## Listen port

TCP port `Can.c` connects to. Default `17320`.

Click **Apply** after changing address or port. See [Simulate CAN](../can/simulate.md) for handle ownership (`Can.c` opens sim1–N, not project Simulate-0).
