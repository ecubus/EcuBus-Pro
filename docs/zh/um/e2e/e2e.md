# E2E（端到端）保护

## 概述

E2E（端到端）保护是汽车系统中使用的一种安全机制，用于检测消息损坏、丢失或重放攻击。 此功能允许您通过拦截传输前的消息并添加校验和和序列计数器来为CAN消息实现E2E保护。 此功能允许您通过拦截传输前的消息并添加校验和和序列计数器来为CAN消息实现E2E保护。

> [!NOTE]
> 目前，E2E保护仅支持CAN总线消息。

## 背景

有时需要在CAN消息发送之前对计算出的校验和和计数器进行修改。 可能的原因包括： 可能的原因包括：

- 特殊的故障注入用例
- 与标准实现不同的自定义E2E保护方案

`setTxPending`回调允许用户在消息实际发送之前修改消息的有效载荷。 可以读取消息有效载荷的字节，也可以覆盖它们。 这使您能够： 可以读取消息有效载荷的字节，也可以覆盖它们。 这使您能够：

- 添加序列计数器以跟踪消息顺序
- 基于消息数据计算并插入校验和（CRC）
- 通过修改校验和或计数器执行故障注入
- 实现自定义E2E保护算法

## 工作原理

![E2E](../../../media/um/e2e/e2e.png)

`setTxPending`函数注册一个回调，该回调在传输前拦截所有传出消息。 该回调接收一个[`CanMessage`]对象，并且可以： 该回调接收一个[`CanMessage`]对象，并且可以：

1. **读取**消息数据（包括任何预计算的校验和或计数器）
2. **修改**消息数据（更新计数器、计算校验和等）
3. **返回**修改后的数据缓冲区以发送消息
4. **返回**`undefined`以抑制/阻止传输
5. **返回**原始`msg.data`以发送未更改的消息

## 基本用法

以下示例演示了一个基本的E2E保护方案，其中：

- **字节6**：包含一个序列计数器（0-255，循环回绕）
- **字节7**：包含基于字节0-6计算的CRC8校验和

```typescript
import { CRC, setTxPending } from 'ECB'

let cnt = 0
const crc8 = CRC.buildInCrc('CRC8')!

setTxPending((msg) => {
  if (msg.id === 1 && msg.data.length === 8) {
    // Update sequence counter in byte 6
    msg.data[6] = (cnt++) % 256
    
    // Calculate CRC8 over bytes 0-6 (excluding the checksum byte)
    msg.data[7] = crc8.compute(msg.data.subarray(0, 7))
    
    return msg.data
  } else {
    // For other messages, send unchanged
    return msg.data
  }
})
```

## 阻止消息传输

您可以通过返回`undefined`来阻止消息发送：

```typescript
import { setTxPending } from 'ECB'

setTxPending((msg) => {
  // Block transmission of messages with ID 0x100
  if (msg.id === 0x100) {
    return undefined  // Message will not be sent
  }
  return msg.data  // Other messages sent normally
})
```

## 重要注意事项

1. **性能**：回调函数会为**每个**传出的CAN消息调用。 保持回调逻辑高效，以避免影响消息传输时序。

2. **E2E配置文件兼容性**：内置CRC算法对应于常见的E2E配置文件，但对于完全符合AUTOSAR E2E配置文件，您可能需要实现除简单CRC计算之外的额外步骤（例如，包含数据ID、计数器处理）。 请参考相应的AUTOSAR规范以获取完整的E2E配置文件实现细节。 请参考相应的AUTOSAR规范以获取完整的E2E配置文件实现细节。


