# 串口（UART）

EcuBus-Pro 支持将串口（UART）作为一级硬件设备，如同 CAN / LIN / PWM 一样。 已配置的串口设备：

- 在项目**启动**时自动打开，
- 可由脚本节点驱动（发送/接收原始字节），
- 在**追踪**窗口中显示所有 TX/RX 流量。

支持的硬件：

| 制造商                           | 协议      |
| ----------------------------- | ------- |
| 任何操作系统串口（USB-Serial、虚拟 COM 等） | 原始 UART |

> 如果您仅需要临时、基于路径的访问而无需设备配置，也可以直接在脚本中使用 `serialport` npm 包——请参阅[使用外部包](../script/SerialPort/scriptSerialPort.md)。

## 添加串口设备

1. 打开**设备**窗口。
2. 在 **ECUBUS** 供应商下选择**串口**，然后点击 **+** 按钮。
3. 配置设备：
   - **端口** — 操作系统串口（例如 `COM7`、`/dev/ttyUSB0`）。 使用**刷新**重新枚举端口。
   - **波特率** — 预设值包括 `115200`、`500000`、`1000000`；可手动输入任意自定义值。
   - **数据位** — `8` / `7` / `6` / `5`
   - **停止位** — `1` / `1.5` / `2`
   - **校验** — `无` / `偶` / `奇` / `标记` / `空格`
4. 为设备取一个**名称**（例如 `ECUBUS_Serial_0`）并保存。

## 绑定脚本节点

在**网络**窗口中，创建一个脚本节点，并将其**通道**设置为串行设备。 节点的脚本将通过设备名称发送和接收字节。

### 脚本 API

```typescript
// 接收：触发接收（IN）和发送（OUT）的帧。
// 传入设备名称，或 `true` 监听所有串行设备。
Util.OnSerial('ECUBUS_Serial_0', (msg) => {
  // msg.dir : 'IN'（接收）| 'OUT'（发送）
  // msg.data: Buffer
  // msg.ts  : 时间戳（微秒，相对于启动时）
  if (msg.dir === 'IN') {
    console.log('rx:', msg.data.toString('hex'))
  }
})

// 发送：传入设备名称，或 `undefined` 使用节点的第一个串行通道。
Util.Init(async () => {
  await Util.writeSerial('ECUBUS_Serial_0', Buffer.from([0x01, 0x02, 0x03]))
})
```

| 方法                                  | 描述                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `Util.OnSerial(device \| true, cb)` | 注册串行帧监听器。 `cb` 接收一个包含 `dir`、`data`、`ts` 的 `SerialMessage`。                        |
| `Util.writeSerial(device, data)`    | 写入原始字节（`Buffer` 或 `number[]`）。 返回发送的时间戳。 传入 `undefined` 作为 `device`，使用节点的第一个串行通道。 |

## 在 Trace 中查看

打开**Trace**窗口——串行帧显示为`Serial`行，`Tx`表示发送的字节（`OUT`），`Rx`表示接收的字节（`IN`）。 使用`Serial`过滤器显示/隐藏它们。

## 示例

一个可随时运行的示例捆绑在示例列表中的**Serial**下（`resources/examples/serial`）：它配置一个串行设备，使用`Util.writeSerial`定期发送帧，并使用`Util.OnSerial`记录接收到的数据。
