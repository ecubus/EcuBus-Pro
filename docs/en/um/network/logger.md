# Logger

By configuring a logger, you can export all related trace data elsewhere, addressing the limited storage capacity of the Trace window in the UI.

## How to add a logger

Open the network configuration via `Hardware -> Network`, then add a logger under `Loggers`.

![logger](./../../../media/um/network/network.png)

## Configure the logger

Hover over the target logger and click the `✏️` button to edit it.

![configLogger](./../../../media/um/network/configLogger.png)
![configLogger1](./../../../media/um/network/configLogger1.png)

- Transport
  - File: write frames to a file; select the destination path
  - Socket: write frames to a socket (not supported yet)
- Format
  - ASC: Vector ASC format, `ASC is written in streaming mode`
  - CSV: comma-separated text format (not supported yet)
  - BLF: Vector BLF format (not supported yet)
- Record Types: choose the types of frames to record

  - CAN: record CAN frames
  - LIN: record LIN frames
  - ETH: record Ethernet frames
  - UDS: record PW

## Demo: write to file

![logger](./../../../media/um/network/logger.gif)
