# CAN 高精度定时器示例

> [!NOTE]
> 本示例要求 CAN 盒子具备硬件时间戳功能，以便测量接收到的 CAN 消息之间的时间间隔。
> 此演示使用的是 **KVASER** USB 转 CAN 设备。

## 概述

本示例演示如何使用硬件时间戳测量连续 CAN 消息之间的时间间隔。硬件时间戳提供微秒级精度，可以准确测量消息间隔。

## 代码示例

```typescript
import { setVar } from 'ECB'

let t1: number | undefined
Util.OnCan(1, (msg) => {
  const t = msg.ts
  if (!t1) {
    t1 = t
  } else {
    const diff = (t - t1) / 1000
    setVar('DIFF', diff)
    t1 = t
  }
})
```

## 工作原理

1. 代码使用 `Util.OnCan` 监听通道 1 上的 CAN 消息
2. 对于每个接收到的消息，提取硬件时间戳（`msg.ts`），单位为微秒
3. 计算连续消息之间的时间差
4. 将时间差转换为毫秒并存储在 `DIFF` 变量中

## 运行效果

![CAN 高精度定时器运行效果](./rt.gif)

通过硬件时间戳可以准确测量接收到的 CAN 消息之间的时间间隔，精度达到微秒级别。
