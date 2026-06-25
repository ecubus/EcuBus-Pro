# Serial (UART) Hardware Example

## Overview

This example shows how to use a **Serial port** as a first-class **hardware
device** in EcuBus-Pro — configured in the Devices panel, driven from a script
node, and observed in the Trace window.

Here the serial port is a configured device (rather than an ad-hoc port opened
by path inside the script):

- It is opened automatically when the project **Starts** (like CAN / LIN / PWM).
- A script node bound to the device sends and receives raw UART bytes through
  `Util.writeSerial` / `Util.OnSerial`.
- Every TX/RX byte stream is shown in the **Trace** window (`Serial` rows).

## Project Layout

- **Device** `ECUBUS_Serial_0` — a serial device under the `ECUBUS` vendor
  (port `COM7`, `500000` baud, 8/N/1). Change the port/baud to match your setup
  in the Devices panel.
- **Node** `Node 1` — bound to the serial device channel, running
  `serial_send.ts`.

## Script Logic (`serial_send.ts`)

- Periodically sends a fixed frame every 500 ms to the configured device:

  ```ts
  const SERIAL_DEVICE = 'ECUBUS_Serial_0'
  await Util.writeSerial(SERIAL_DEVICE, TX_FRAME)
  ```

- Receives data (and observes its own TX echo) via `Util.OnSerial`:

  ```ts
  Util.OnSerial(SERIAL_DEVICE, (msg) => {
    console.log(`serial ${msg.dir}: ${hex(msg.data)}`)
  })
  ```

  `msg.dir` is `'OUT'` for transmitted bytes and `'IN'` for received bytes.

## Running

1. Open the project and edit the `ECUBUS_Serial_0` device so the **Port** and
   **Baud Rate** match your hardware (a USB-serial adapter, optionally with a
   loopback or an echo device on the other end).
2. Press **Start**. The device opens and the node begins sending.
3. Open the **Trace** window — `Serial` rows appear with `Tx` (OUT) and, if the
   device replies, `Rx` (IN) data.

## Customization

- **Change device**: edit `SERIAL_DEVICE` to another configured serial device
  name, or pass `undefined` to use the node's first serial channel.
- **Change period / frame**: edit `PERIOD_MS` and `TX_FRAME` in
  `serial_send.ts`.

## Notes

- If the port fails to open, make sure no other program holds the same COM port
  and that the driver is installed.
- This device-bound flow is the recommended way to integrate serial hardware.
  For ad-hoc, path-based access that does not need device config or trace, you
  can also use the `serialport` npm package directly in a script.
