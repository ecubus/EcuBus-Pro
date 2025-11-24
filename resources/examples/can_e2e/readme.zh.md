# CAN E2E（端到端）保护示例

## 概述

本示例演示如何使用 CRC8 校验和和序列计数器为 CAN 报文实现端到端（E2E）保护。 E2E 保护是汽车系统中常用的安全机制，用于检测报文损坏、丢失或重放攻击。 E2E 保护是汽车系统中常用的安全机制，用于检测报文损坏、丢失或重放攻击。

## E2E 保护机制

该示例实现了一个简单的 E2E 保护方案，其中：

- **字节 6**：包含一个序列计数器（0-255，循环回绕）
- **字节 7**：包含基于字节 0-6 计算出的 CRC8 校验和

这确保了：

1. 可以跟踪报文序列（计数器）
2. 可以验证报文完整性（CRC8 校验和）
3. 可以检测丢失或损坏的报文

## 代码示例

```typescript
import {CRC, setTxPending} from 'ECB'

let cnt=0;
const crc8=CRC.buildInCrc('CRC8')!
setTxPending((msg)=>{
    if(msg.id==1&&msg.data.length==8){
        msg.data[6]=(cnt++)%256;
        msg.data[7]=crc8.compute(msg.data.subarray(0,7))
        return msg.data
    }else{
        return msg.data
    }
})
```

## 工作原理

1. **CRC8 初始化**：使用内置 CRC 模块创建 CRC8 计算器
2. **报文拦截**：使用 `setTxPending` 在传输前拦截所有出站 CAN 报文
3. **E2E 保护**：对于 ID 为 1 且长度为 8 字节的报文：
   - 使用递增计数器（模 256）更新字节 6
   - 计算字节 0-6 的 CRC8 校验和
   - 将校验和写入字节 7
4. **报文传输**：返回修改后的报文数据进行传输

