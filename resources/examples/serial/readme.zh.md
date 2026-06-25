# 串口（UART）硬件示例

## 概述

本示例展示如何在 EcuBus-Pro 中把**串口**作为一等**硬件设备**使用——在「设备」面板里配置、由脚本节点驱动、并在 Trace 窗口中查看。

这里串口是一个被配置的设备（而不是在脚本里按路径临时打开的端口）：

- 工程**开始（Start）**时自动打开（与 CAN / LIN / PWM 一致）。
- 绑定到该设备的脚本节点，通过 `Util.writeSerial` / `Util.OnSerial` 收发原始 UART 数据。
- 每一帧 TX/RX 都会显示在 **Trace** 窗口（`Serial` 行）。

## 工程结构

- **设备** `ECUBUS_Serial_0` —— `ECUBUS` 厂商下的串口设备（端口 `COM7`，波特率 `500000`，8/N/1）。请在「设备」面板里把端口/波特率改成你自己的配置。
- **节点** `Node 1` —— 绑定到该串口设备通道，运行 `serial_send.ts`。

## 脚本逻辑 (`serial_send.ts`)

- 每 500ms 周期性地向配置的设备发送一帧固定数据：

  ```ts
  const SERIAL_DEVICE = 'ECUBUS_Serial_0'
  await Util.writeSerial(SERIAL_DEVICE, TX_FRAME)
  ```

- 通过 `Util.OnSerial` 接收数据（同时也能看到自己发送的 TX 回显）：

  ```ts
  Util.OnSerial(SERIAL_DEVICE, (msg) => {
    console.log(`serial ${msg.dir}: ${hex(msg.data)}`)
  })
  ```

  `msg.dir` 为 `'OUT'` 表示发送的数据，`'IN'` 表示接收的数据。

## 运行步骤

1. 打开工程，编辑 `ECUBUS_Serial_0` 设备，把**端口（Port）**和**波特率（Baud Rate）**改成你的硬件（USB 转串口适配器，另一端可接回环或回显设备）。
2. 点击 **Start**，设备打开，节点开始发送。
3. 打开 **Trace** 窗口——会出现 `Serial` 行，包含 `Tx`（OUT）数据；若设备有回复，则出现 `Rx`（IN）数据。

## 自定义

- **更换设备**：把 `SERIAL_DEVICE` 改成另一个已配置的串口设备名称；或传 `undefined` 使用该节点的第一个串口通道。
- **更改周期 / 帧内容**：编辑 `serial_send.ts` 中的 `PERIOD_MS` 与 `TX_FRAME`。

## 注意事项

- 若端口打开失败，请确认没有其他程序占用同一个 COM 端口，且驱动已安装。
- 这种「设备绑定」方式是集成串口硬件的推荐做法；若只需不依赖设备配置和 Trace 的临时按路径访问，也可以在脚本里直接使用 `serialport` npm 包。
