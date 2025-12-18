# 串口脚本示例

## 概述

本示例展示了如何使用 **Ecubus Pro** 脚本通过 `ECB` 库中的 `SerialPortClient` 与串口进行通信。  
该脚本：

- 在给定的 COM 端口上创建一个串口客户端。
- 列出可用的串口。
- 打开选定的端口。
- 发送一个预定义的类似 Modbus 的帧。
- 将接收到的任何数据打印到控制台。
- 在脚本结束时关闭端口。

## 脚本逻辑 (`seriaport.ts`)

- 创建一个串口客户端：

```ts
const sp = new SerialPortClient({
  path: 'COM22',
  baudRate: 115200
});
```

- 注册一个数据处理器：

```ts
sp.on('data', (data: Buffer) => {
  console.log('data received:', data);
});
```

- 在 `Util.Init` 中：
  - 记录可用串口列表：`await SerialPortClient.list()`。
  - 打开配置的端口。
  - 写入一个固定帧：`0x01 0x03 0x00 0x00 0x00 0x02 0xc4 0x0b`。
- 在 `Util.End` 中：
  - 优雅地关闭串口。

## 自定义

- **更改 COM 端口**：编辑 `SerialPortClient` 选项中的 `path`。
- **更改波特率**：编辑 `baudRate` 以匹配您的设备。
- **更改写入帧**：修改 `Buffer.from([...])` 的内容以发送不同的命令。
- **附加逻辑**：在 `sp.on('data', ...)` 处理器内或 `Util.Init` / `Util.End` 回调内添加解析、日志记录或 UI 集成。

## 注意事项

- 如果遇到打开端口的错误：
  - 确保没有其他程序正在使用同一个 COM 端口。
  - 确认端口名称以及设备驱动程序已安装。
- 此示例有意保持最小化，旨在作为在 Ecubus Pro 中构建更复杂串口通信脚本的起点。