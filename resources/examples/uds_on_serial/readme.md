# UDS on Serial (UART-CAN)

This example runs a **complete UDS / ISO 15765-2 diagnostic exchange over a
plain serial port**, with the ECU (slave) side fully simulated by a script
node — no external hardware or MCU firmware is required.

## What it contains

| Item | Description |
|------|-------------|
| `UDS_Serial` device | A **UDS** (uartcan) device on a serial port. Each CAN frame travels as a fixed 13-byte record (`ID(4, big-endian) + DLC(1) + data(8, zero-padded)`). |
| `Tester` | A CAN tester with address pair TxId `0x7AA` / RxId `0x7AB` and a `ReadVIN` service (`22 F1 90`). |
| `UDS_Slave` node (`node.ts`) | Simulates the ECU: answers `ReadVIN` with `62 F1 90` + the ASCII VIN `EcuBus-Pro-UDS-01`. |
| `Seq0` | A diagnostic sequence containing the `ReadVIN` service. |

Because the tester and the simulated slave share the same virtual CAN bus,
the exchange works even with nothing attached to the serial port — the frames
are also written out on the wire, so a real MCU can replace the simulation at
any time.

## How to run

1. Open the example, then select an available COM port in the `UDS_Serial`
   device configuration (Hardware → Devices → Serial → UDS).
2. **Start** the project.
3. Open the tester sequence view and run `Seq0` — or watch the exchange in
   the **Trace** window.

The response is 20 bytes long, so the exchange demonstrates real ISO-TP
multi-frame segmentation over the serial port: Single Frame request, First
Frame, Flow Control, and Consecutive Frames:

![seq](seq.png)

## Replace the simulation with a real MCU

Remove (or disable) the `UDS_Slave` node and connect an MCU that implements
the 13-byte UART bridge — see the
[UDS on Serial](https://app.whyengineer.com/docs/um/serial/uds.html)
documentation for the wire format and MCU-side notes.
