

# Serial Port Script Example

## Overview

This example shows how to use **Ecubus Pro** scripting to communicate with a serial port using `SerialPortClient` from `ECB`.  
The script:

- Creates a serial port client on a given COM port.
- Lists available serial ports.
- Opens the selected port.
- Sends a predefined Modbus-like frame.
- Prints any received data to the console.
- Closes the port on script end.



## Script Logic (`seriaport.ts`)

- Creates a serial port client:

```ts
const sp = new SerialPortClient({
  path: 'COM22',
  baudRate: 115200
});
```

- Registers a data handler:

```ts
sp.on('data', (data: Buffer) => {
  console.log('data received:', data);
});
```

- In `Util.Init`:
  - Logs the list of available serial ports: `await SerialPortClient.list()`.
  - Opens the configured port.
  - Writes a fixed frame: `0x01 0x03 0x00 0x00 0x00 0x02 0xc4 0x0b`.
- In `Util.End`:
  - Closes the serial port gracefully.


## Customization

- **Change COM port**: Edit `path` in the `SerialPortClient` options.
- **Change baud rate**: Edit `baudRate` to match your device.
- **Change write frame**: Modify the `Buffer.from([...])` contents to send a different command.
- **Additional logic**: Add parsing, logging, or UI integration inside the `sp.on('data', ...)` handler or inside the `Util.Init` / `Util.End` callbacks.

## Notes

- If you encounter errors opening the port:
  - Make sure no other program is using the same COM port.
  - Confirm the port name and that the device driver is installed.
- This example is intentionally minimal to serve as a starting point for more complex serial communication scripts in Ecubus Pro.