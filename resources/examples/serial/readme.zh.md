# 串行（UART）硬件示例

## 概述

此示例展示了如何在 EcuBus-Pro 中将**串行端口**用作一流的**硬件设备**——在“设备”面板中配置，由脚本节点驱动，并在“跟踪”窗口中观察。

此处串行端口是一个已配置的设备（而不是在脚本中通过路径打开的临时端口）：

- 当项目**启动**时自动打开（如 CAN / LIN / PWM）。
- 绑定到该设备的脚本节点通过 `Util.writeSerial` / `Util.OnSerial` 发送和接收原始 UART 字节。
- 每个 TX/RX 字节流都显示在**跟踪**窗口中（`Serial` 行）。

## 项目布局

- **设备** `ECUBUS_Serial_0` —— `ECUBUS` 供应商下的串行设备（端口 `COM7`，`500000` 波特，8/N/1）。 在设备面板中更改端口/波特以匹配您的设置。
- **节点** `Node 1` —— 绑定到串行设备通道，运行 `serial_send.ts`。

## 脚本逻辑 (`serial_send.ts`)

- 每 500 毫秒向配置的设备发送一个固定帧：

  ```ts
  const SERIAL_DEVICE = 'ECUBUS_Serial_0'
  await Util.writeSerial(SERIAL_DEVICE, TX_FRAME)
  ```

- 通过 `Util.OnSerial` 接收数据（并观察自身的 TX 回显）：

  ```ts
  Util.OnSerial(SERIAL_DEVICE, (msg) => {
    console.log(`serial ${msg.dir}: ${hex(msg.data)}`)
  })
  ```

  `msg.dir` 对于发送的字节为 `'OUT'`，对于接收的字节为 `'IN'`。

## 运行

1. 打开项目并编辑 `ECUBUS_Serial_0` 设备，使**端口**和**波特率**与您的硬件匹配（USB 串行适配器，可选的另一端有环回或回显设备）。
2. 按**启动**。 设备打开，节点开始发送。
3. 打开**跟踪**窗口 —— 出现 `Serial` 行，显示 `Tx` (OUT) 数据，如果设备回复，则显示 `Rx` (IN) 数据。

## 自定义

- **更改设备**：编辑 `SERIAL_DEVICE` 为另一个已配置的串行设备名称，或传递 `undefined` 以使用节点的第一个串行通道。
- **更改周期/帧**：在 `serial_send.ts` 中编辑 `PERIOD_MS` 和 `TX_FRAME`。

## 备注

- 如果端口打开失败，请确保没有其他程序占用相同的 COM 端口，并且驱动程序已安装。
- 这种设备绑定的流程是集成串行硬件的推荐方式。
  对于不需要设备配置或跟踪的临时、基于路径的访问，您也可以直接在脚本中使用 `serialport` npm 包。
