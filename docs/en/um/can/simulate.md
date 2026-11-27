# Simulate CAN

Simulate CAN is EcuBus-Pro’s **software virtual CAN bus**. It needs no adapter, vendor DLL, or USB device. Use it to develop scripts, UDS testers, and node scripts on the same virtual network.

It is the same idea as ETAS VirtualCan: Peak / Kvaser / Vector stay real hardware. Simulate is the in-process bus.

## Capabilities

| Capability | Detail |
| --- | --- |
| Channels | 64 handles: **Simulate-0** … **Simulate-63** |
| Protocols | CAN and CAN-FD |
| Platforms | Windows, Linux, macOS (no vendor SDK) |
| EcuBus features | DBC, Interactive, node scripts, UDS tester, trace |

## Virtual bus

Every **open** simulate handle is a node on **one** shared bus.

- A frame transmitted on Simulate-0 is received on every **other** open handle (Simulate-1, …) as **RX**.
- A node does **not** see its own TX as RX.
- The same handle can be opened only once in a process (`BUS ALREADY INIT`).

### Trace

EcuBus trace shows project devices. A script, Interactive send, or UDS request on Simulate-0 is **TX** on that node. The same frame is **RX** on every other open simulate node.

## Use in EcuBus

1. Hardware → **Simulate** → add a CAN node.
2. Pick a free handle (start with Simulate-0).
3. Set bitrate / CAN-FD like any other vendor.
4. Bind a DBC, Interactive table, node script, or UDS tester as usual.

Two project nodes on **different** handles (Simulate-0 and Simulate-1) also loop back to each other. That is useful when both sides are EcuBus scripts.

## What it is not

- Not real transceiver timing, ACK, or error frames.
- Not a gateway onto Peak / Kvaser / Vector. Those vendors stay independent hardware.
- Not shared across processes. Each EcuBus process has its own virtual bus.
