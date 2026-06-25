# Serial (UART)

EcuBus-Pro supports the serial port (UART) as a first-class hardware device,
just like CAN / LIN / PWM. A configured serial device:

- opens automatically when the project **Starts**,
- can be driven from a script node (send / receive raw bytes), and
- shows all TX/RX traffic in the **Trace** window.

Supported Hardware:

| Manufacturer | Protocols |
|--------------|-----------|
| Any OS serial port (USB-Serial, virtual COM, etc.) | Raw UART |

> If you only need ad-hoc, path-based access without device configuration, you
> can also use the `serialport` npm package directly in a script — see
> [Use External Packages](../script/SerialPort/scriptSerialPort.md).

## Add a Serial Device

1. Open the **Devices** window.
2. Under the **ECUBUS** vendor, select **Serial** and click the **+** button.
3. Configure the device:
   - **Port** — the OS serial port (e.g. `COM7`, `/dev/ttyUSB0`). Use **Refresh**
     to re-enumerate ports.
   - **Baud Rate** — presets include `115200`, `500000`, `1000000`; any custom
     value can be typed in.
   - **Data Bits** — `8` / `7` / `6` / `5`
   - **Stop Bits** — `1` / `1.5` / `2`
   - **Parity** — `none` / `even` / `odd` / `mark` / `space`
4. Give the device a **Name** (e.g. `ECUBUS_Serial_0`) and save.

## Bind a Script Node

In the **Network** window, create a script node and set its **channel** to the
serial device. The node's script then sends and receives bytes through the
device by name.

### Script API

```typescript
// Receive: fires for both received (IN) and transmitted (OUT) frames.
// Pass a device name, or `true` to listen to all serial devices.
Util.OnSerial('ECUBUS_Serial_0', (msg) => {
  // msg.dir : 'IN' (received) | 'OUT' (transmitted)
  // msg.data: Buffer
  // msg.ts  : timestamp (microseconds, relative to start)
  if (msg.dir === 'IN') {
    console.log('rx:', msg.data.toString('hex'))
  }
})

// Send: pass a device name, or `undefined` to use the node's first serial channel.
Util.Init(async () => {
  await Util.writeSerial('ECUBUS_Serial_0', Buffer.from([0x01, 0x02, 0x03]))
})
```

| Method | Description |
|--------|-------------|
| `Util.OnSerial(device \| true, cb)` | Register a listener for serial frames. `cb` receives a `SerialMessage` with `dir`, `data`, `ts`. |
| `Util.writeSerial(device, data)` | Write raw bytes (`Buffer` or `number[]`). Returns the sent timestamp. Pass `undefined` as `device` to use the node's first serial channel. |

## View in Trace

Open the **Trace** window — serial frames appear as `Serial` rows, with `Tx`
for transmitted bytes (`OUT`) and `Rx` for received bytes (`IN`). Use the
`Serial` filter to show/hide them.

## Example

A ready-to-run example is bundled under **Serial** in the examples list
(`resources/examples/serial`): it configures a serial device, periodically sends
a frame with `Util.writeSerial`, and logs received data with `Util.OnSerial`.
