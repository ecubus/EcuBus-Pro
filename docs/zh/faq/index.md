# 常见问题

## 如何配置 UDS 消息长度到 8 字节？

:::details 答案
您可以通过 UDS 测试器 -> Tp 基础 -> 填充启用来启用填充。 您也可以设置自己的填充值，默认为0x00。
![1](./1.png)
:::

## ZLG 调试，conditioning Puntary Pete 波特率失败？

:::details 答案
这是一个已知问题,请将EcuBus-Pro安装在非C盘的其他磁盘分区上即可解决。
:::

## 当使用序列器发送UDS服务时，使用ID0x3C和NAD 0x55在LIN上方， 为什么不发送ID为 0x3D 的 LIN 消息，然后从此从作者处回复？

:::details 答案
这是因为执行了林中时间表表。 您应该先开始任何计划表。
！[2](./2.png)
然后您可以通过ID 0x3D 发送LIN 消息。
![3](./3.png)
:::

## 如何计算消息的 CRC 值？

:::details 答案
您可以使用脚本中内置的 [CRC](https://app.whyengineer.com/scriptApi/classes/CRC.html) API计算CRC 值。 API 支持各种带有可配置参数的 CRC 算法，包括CRC8、CRC16和CR32。

:::

## 如何执行周期消息计数循环？

:::details 答案

**如果您有数据库并希望定期更新信号值：**

1. 首先，您需要定期配置信息。
2. 然后你就不再使用 [OnCan](https://app.whyengineer.com/scriptApi/classes/UtilClass.html#oncan) API来监听发送/接收的消息。
3. 使用 [setSignal](https://app.whyengineer.com/scriptApi/functions/setSignal.html) API 来更新信号值。

```ts
import { setSignal } from 'ECB'
let val = 0

Util.OnCan(0x142, (data) => {
   setSignal('Model3CAN.VCLEFT_liftgateLatchRequest', val++ % 5)
})
```

![demo](./loop.gif)

**没有数据库：**

1. 只需使用 [output](https://app.whyengineer.com/scriptApi/functions/output.html) API才能输出您想要的任何值。

```ts
import { output,CanMessage,CAN_ID_TYPE} from 'ECB'
setInterval(() => {
  const canMsg:CanMessage = {
      id: 0x111,
      data: Buffer.from([0,1,2,3,4,5,6,7]),
      dir: 'OUT',
      msgType:{
        idType: CAN_ID_TYPE.STANDARD,
        remote: false,
        brs: false,
        canfd: false,
      }
    }
   output(canMsg)
}, 1000)
```

:::
