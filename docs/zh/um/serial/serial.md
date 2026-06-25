# 串口（UART）

EcuBus-Pro 支持把串口（UART）作为一等硬件设备，与 CAN / LIN / PWM 一致。一个被配置的串口设备：

- 在工程**开始（Start）**时自动打开，
- 可以由脚本节点驱动（收发原始字节），
- 所有 TX/RX 数据都会显示在 **Trace** 窗口。

支持的硬件：

| 制造商 | 协议 |
|--------|------|
| 任意操作系统串口（USB 转串口、虚拟 COM 等） | 原始 UART |

> 如果你只需要不依赖设备配置的、按路径直连的临时访问，也可以在脚本里直接使用 `serialport` npm 包——见 [使用外部包](../script/SerialPort/scriptSerialPort.md)。

## 添加串口设备

1. 打开 **设备（Devices）** 窗口。
2. 在 **ECUBUS** 厂商下选择 **Serial**，点击 **+** 按钮。
3. 配置设备：
   - **端口（Port）** —— 操作系统串口（如 `COM7`、`/dev/ttyUSB0`）。点 **Refresh** 重新枚举端口。
   - **波特率（Baud Rate）** —— 预设包含 `115200`、`500000`、`1000000`；也可手动输入任意值。
   - **数据位（Data Bits）** —— `8` / `7` / `6` / `5`
   - **停止位（Stop Bits）** —— `1` / `1.5` / `2`
   - **校验（Parity）** —— `none` / `even` / `odd` / `mark` / `space`
4. 给设备起个**名字**（如 `ECUBUS_Serial_0`）并保存。

## 绑定脚本节点

在 **Network** 窗口创建一个脚本节点，把它的 **channel** 设为该串口设备。节点脚本即可按设备名收发字节。

### 脚本 API

```typescript
// 接收：发送(OUT)和接收(IN)的帧都会触发。
// 传入设备名，或传 `true` 监听所有串口设备。
Util.OnSerial('ECUBUS_Serial_0', (msg) => {
  // msg.dir : 'IN'(接收) | 'OUT'(发送)
  // msg.data: Buffer
  // msg.ts  : 时间戳（微秒，相对会话起点）
  if (msg.dir === 'IN') {
    console.log('rx:', msg.data.toString('hex'))
  }
})

// 发送：传入设备名，或传 `undefined` 使用该节点的第一个串口通道。
Util.Init(async () => {
  await Util.writeSerial('ECUBUS_Serial_0', Buffer.from([0x01, 0x02, 0x03]))
})
```

| 方法 | 说明 |
|------|------|
| `Util.OnSerial(device \| true, cb)` | 注册串口帧监听。`cb` 收到一个 `SerialMessage`，包含 `dir`、`data`、`ts`。 |
| `Util.writeSerial(device, data)` | 写入原始字节（`Buffer` 或 `number[]`），返回发送时间戳。`device` 传 `undefined` 时使用该节点的第一个串口通道。 |

## 在 Trace 中查看

打开 **Trace** 窗口——串口帧显示为 `Serial` 行，`Tx` 表示发送字节（`OUT`），`Rx` 表示接收字节（`IN`）。可用 `Serial` 过滤器显示/隐藏。

## 示例

示例列表的 **Serial** 分类下内置了一个可直接运行的示例（`resources/examples/serial`）：它配置一个串口设备，用 `Util.writeSerial` 周期发送一帧，并用 `Util.OnSerial` 打印接收到的数据。
